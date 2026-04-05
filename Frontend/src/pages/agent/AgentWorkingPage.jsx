import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DeliveryCard from '../../components/agent/DeliveryCard';
import DeliveryDetailsModal from '../../components/agent/DeliveryDetailsModal';
import FailedReasonModal from '../../components/agent/FailedReasonModal';
import DeliveryProofModal from '../../components/agent/DeliveryProofModal';
import { Filter, Home, List, History, User, Package, MapIcon } from 'lucide-react';
import {
  fetchAssignedAgentDeliveries,
  updateAssignedAgentDeliveryStatus,
} from "../../api/agent/agent.api";
import { optimizeRouteWithPriority } from '../../utils/routeOptimization';

const AgentWorkingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [deliveries, setDeliveries] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [failedDelivery, setFailedDelivery] = useState(null);
  const [proofDelivery, setProofDelivery] = useState(null);

  useEffect(() => {
    const loadDeliveries = async () => {
      try {
        const payload = await fetchAssignedAgentDeliveries();
        setDeliveries(payload || []);
      } catch (_err) {
        setDeliveries([]);
      }
    };
    loadDeliveries();
  }, []);

  const filteredDeliveries = deliveries.filter(delivery => {
    if (filter === 'ALL') return true;
    return delivery.status === filter;
  });

  const orderedDeliveries = optimizeRouteWithPriority(filteredDeliveries, ['PENDING', 'COMPLETED', 'FAILED']);

  const handleCompleteWithProof = (delivery) => setProofDelivery(delivery);

  const handleProofSubmit = async ({ proofType, proofOtp, imagePreview }) => {
    if (!proofDelivery?.id) return;
    const deliveryId = proofDelivery.id;
    const proofNote = proofType === 'OTP' ? `OTP_CONFIRMED:${proofOtp}` : `PHOTO_ATTACHED`;

    setDeliveries((prev) =>
      prev.map((d) => String(d.id) === String(deliveryId) ? {
        ...d, status: 'COMPLETED', deliveryProofType: proofType,
        deliveryProofOtp: proofType === 'OTP' ? proofOtp : null,
        deliveryProofImage: proofType === 'PHOTO' ? imagePreview : null,
      } : d)
    );
    setProofDelivery(null);
    try {
      await updateAssignedAgentDeliveryStatus({
        deliveryId, status: 'COMPLETED', proofType, proofOtp,
        proofImage: proofType === 'PHOTO' ? imagePreview : '', reason: proofNote,
      });
    } catch (_err) {}
  };

  const handleStatusChange = async (deliveryId, newStatus) => {
    if (newStatus === 'FAILED') {
      const delivery = deliveries.find((d) => String(d.id) === String(deliveryId));
      setFailedDelivery(delivery);
    } else {
      setDeliveries((prev) => prev.map((d) => String(d.id) === String(deliveryId) ? { ...d, status: newStatus } : d));
      try { await updateAssignedAgentDeliveryStatus({ deliveryId, status: newStatus }); } catch (_err) {}
    }
  };

  const handleFailedSubmit = async ({ reason, imagePreview }) => {
    if (!failedDelivery?.id) return;
    const deliveryId = failedDelivery.id;
    setDeliveries((prev) => prev.map((d) => String(d.id) === String(deliveryId) ? { ...d, status: 'FAILED', failedReason: reason, failedImage: imagePreview } : d));
    setFailedDelivery(null);
    try { await updateAssignedAgentDeliveryStatus({ deliveryId, status: "FAILED", reason }); } catch (_err) {}
  };

  const stats = {
    all: deliveries.length,
    completed: deliveries.filter(d => d.status === 'COMPLETED').length,
    pending: deliveries.filter(d => d.status === 'PENDING').length,
    failed: deliveries.filter(d => d.status === 'FAILED').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-32 px-4 pt-4 font-sans">
      <div className="max-w-md mx-auto space-y-5">
        <div className="px-1">
          <h2 className="text-xl font-black tracking-tight">Active Tasks</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Route optimized by proximity</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'ALL', label: 'All', count: stats.all },
            { key: 'PENDING', label: 'Pending', count: stats.pending },
            { key: 'COMPLETED', label: 'Done', count: stats.completed },
            { key: 'FAILED', label: 'Failed', count: stats.failed },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap border ${
                filter === tab.key ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-gray-500 border-gray-100'
              }`}
            >
              {tab.label} <span className={`px-1.5 py-0.5 rounded-lg text-[9px] ${filter === tab.key ? 'bg-white/20' : 'bg-gray-100'}`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Deliveries List */}
        <div className="space-y-4">
          {orderedDeliveries.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100">
              <Package className="mx-auto text-gray-200 mb-3" size={40} />
              <p className="text-sm font-bold text-gray-400">No tasks found</p>
            </div>
          ) : (
            orderedDeliveries.map(delivery => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                onStatusChange={handleStatusChange}
                onClick={setSelectedDelivery}
                onCompleteRequest={handleCompleteWithProof}
              />
            ))
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white/90 backdrop-blur-md border border-gray-200 p-2 rounded-full flex justify-around items-center z-50 shadow-2xl">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab icon={<List size={18} />} label="Tasks" active onClick={() => navigate("/agent/working")} />
        <NavTab icon={<History size={18} />} label="History" onClick={() => navigate("/agent/history")} />
        <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
      </div>

      {/* Modals */}
      {selectedDelivery && <DeliveryDetailsModal delivery={selectedDelivery} onClose={() => setSelectedDelivery(null)} />}
      {failedDelivery && <FailedReasonModal delivery={failedDelivery} onSubmit={handleFailedSubmit} onClose={() => setFailedDelivery(null)} />}
      {proofDelivery && <DeliveryProofModal delivery={proofDelivery} onClose={() => setProofDelivery(null)} onSubmit={handleProofSubmit} />}
    </div>
  );
};

const NavTab = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 p-2 rounded-2xl min-w-[60px] ${active ? "text-blue-600" : "text-gray-400"}`}>
    {icon} <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
    {active && <div className="w-1 h-1 bg-blue-600 rounded-full mt-0.5" />}
  </button>
);

export default AgentWorkingPage;