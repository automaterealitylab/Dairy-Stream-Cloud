import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DeliveryCard from "../../components/agent/DeliveryCard";
import DeliveryDetailsModal from "../../components/agent/DeliveryDetailsModal";
import FailedReasonModal from "../../components/agent/FailedReasonModal";
import DeliveryProofModal from "../../components/agent/DeliveryProofModal";
import { Home, List, History, User, Package } from "lucide-react";
import {
  fetchAssignedAgentDeliveries,
  updateAssignedAgentDeliveryStatus,
} from "../../api/agent/agent.api";
import { optimizeRouteWithPriority } from "../../utils/routeOptimization";

const headingFont = { fontFamily: "'Lora', serif" };

const NavTab = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex min-w-[64px] flex-col items-center gap-1 rounded-[18px] px-2 py-2 transition ${
      active ? "text-[#B8641A]" : "text-[#8B7355]"
    }`}
  >
    {icon}
    <span className="text-[8px] font-black uppercase tracking-[0.16em]">{label}</span>
    {active && <div className="h-1 w-1 rounded-full bg-[#B8641A]" />}
  </button>
);

const AgentWorkingPage = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [failedDelivery, setFailedDelivery] = useState(null);
  const [proofDelivery, setProofDelivery] = useState(null);

  useEffect(() => {
    const loadDeliveries = async () => {
      try {
        const payload = await fetchAssignedAgentDeliveries({ today: true });
        setDeliveries(payload || []);
      } catch (_err) {
        setDeliveries([]);
      }
    };
    loadDeliveries();
  }, []);

  const filteredDeliveries = deliveries.filter((delivery) => {
    if (filter === "ALL") return true;
    return delivery.status === filter;
  });

  const orderedDeliveries = optimizeRouteWithPriority(filteredDeliveries, ["PENDING", "COMPLETED", "FAILED"]);

  const handleCompleteWithProof = (delivery) => setProofDelivery(delivery);

  const handleProofSubmit = async ({ proofType, proofOtp, imagePreview }) => {
    if (!proofDelivery?.id) return;
    const deliveryId = proofDelivery.id;
    const proofNote = proofType === "OTP" ? `OTP_CONFIRMED:${proofOtp}` : "PHOTO_ATTACHED";

    setDeliveries((prev) =>
      prev.map((d) =>
        String(d.id) === String(deliveryId)
          ? {
              ...d,
              status: "COMPLETED",
              deliveryProofType: proofType,
              deliveryProofOtp: proofType === "OTP" ? proofOtp : null,
              deliveryProofImage: proofType === "PHOTO" ? imagePreview : null,
            }
          : d
      )
    );
    setProofDelivery(null);

    try {
      await updateAssignedAgentDeliveryStatus({
        deliveryId,
        status: "COMPLETED",
        proofType,
        proofOtp,
        proofImage: proofType === "PHOTO" ? imagePreview : "",
        reason: proofNote,
      });
    } catch (_err) {}
  };

  const handleStatusChange = async (deliveryId, newStatus) => {
    if (newStatus === "FAILED") {
      const delivery = deliveries.find((d) => String(d.id) === String(deliveryId));
      setFailedDelivery(delivery);
      return;
    }

    setDeliveries((prev) =>
      prev.map((d) => (String(d.id) === String(deliveryId) ? { ...d, status: newStatus } : d))
    );
    try {
      await updateAssignedAgentDeliveryStatus({ deliveryId, status: newStatus });
    } catch (_err) {}
  };

  const handleFailedSubmit = async ({ reason }) => {
    if (!failedDelivery?.id) return;
    const deliveryId = failedDelivery.id;
    setDeliveries((prev) =>
      prev.map((d) => (String(d.id) === String(deliveryId) ? { ...d, status: "FAILED", failedReason: reason } : d))
    );
    setFailedDelivery(null);
    try {
      await updateAssignedAgentDeliveryStatus({ deliveryId, status: "FAILED", reason });
    } catch (_err) {}
  };

  const stats = {
    all: deliveries.length,
    completed: deliveries.filter((d) => d.status === "COMPLETED").length,
    pending: deliveries.filter((d) => d.status === "PENDING").length,
    failed: deliveries.filter((d) => d.status === "FAILED").length,
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-4 pb-32 pt-5 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-5">
        <section className="rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] px-5 py-4 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Task Queue</p>
          <h1 className="mt-2 text-[28px] font-black leading-none text-[#2C1A0E]" style={headingFont}>
            Active Tasks
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#6B5B3E]">Route optimized by proximity</p>
        </section>

        <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar">
          {[
            { key: "ALL", label: "All", count: stats.all },
            { key: "PENDING", label: "Pending", count: stats.pending },
            { key: "COMPLETED", label: "Done", count: stats.completed },
            { key: "FAILED", label: "Failed", count: stats.failed },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex whitespace-nowrap items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                filter === tab.key
                  ? "border-[#B8641A] bg-[#B8641A] text-white shadow-lg shadow-[#F2D9B8]"
                  : "border-[#E7DAC6] bg-white text-[#8B7355]"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] ${
                  filter === tab.key ? "bg-white/20 text-white" : "bg-[#F8F1E7] text-[#A88763]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {orderedDeliveries.length === 0 ? (
            <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-12 text-center shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
              <Package className="mx-auto mb-3 text-[#D4B896]" size={40} />
              <p className="text-sm font-bold text-[#A88763]">No tasks found</p>
            </div>
          ) : (
            orderedDeliveries.map((delivery) => (
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

      <div className="fixed bottom-6 left-1/2 z-50 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab icon={<List size={18} />} label="Tasks" active onClick={() => navigate("/agent/working")} />
        <NavTab icon={<History size={18} />} label="History" onClick={() => navigate("/agent/history")} />
        <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
      </div>

      {selectedDelivery && <DeliveryDetailsModal delivery={selectedDelivery} onClose={() => setSelectedDelivery(null)} />}
      {failedDelivery && <FailedReasonModal delivery={failedDelivery} onSubmit={handleFailedSubmit} onClose={() => setFailedDelivery(null)} />}
      {proofDelivery && <DeliveryProofModal delivery={proofDelivery} onClose={() => setProofDelivery(null)} onSubmit={handleProofSubmit} />}
    </div>
  );
};

export default AgentWorkingPage;
