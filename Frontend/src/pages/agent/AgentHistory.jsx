import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DeliveryDetailsModal from '../../components/agent/DeliveryDetailsModal';
import { Calendar, CheckCircle, XCircle, Search, ChevronDown, ChevronUp, Package, Home, List, History, User } from 'lucide-react';
import { fetchAgentDeliveryHistory } from "../../api/agent/agent.api";

const AgentHistory = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDates, setExpandedDates] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const payload = await fetchAgentDeliveryHistory();
        setHistory(payload || []);
        if (payload?.[0]?.date) setExpandedDates([payload[0].date]);
      } catch (_err) { setHistory([]); }
    };
    loadHistory();
  }, []);

  const toggleDateExpanded = (date) => {
    setExpandedDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  };

  const filteredHistory = history.map(day => ({
    ...day,
    deliveries: day.deliveries.filter(d => 
      d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.address.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(day => day.deliveries.length > 0);

  const getStatusIcon = (status) => status === 'completed' ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-32 px-4 pt-4">
      <div className="max-w-md mx-auto space-y-5">
        <div className="px-1">
          <h2 className="text-xl font-black tracking-tight">History</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Review past performance</p>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-600" size={16} />
          <input
            type="text"
            placeholder="Search deliveries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
          />
        </div>

        {/* List */}
        <div className="space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100">
              <Package className="mx-auto text-gray-200 mb-2" size={40} />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No History</p>
            </div>
          ) : (
            filteredHistory.map((day) => (
              <div key={day.date} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => toggleDateExpanded(day.date)} className="w-full px-5 py-4 flex items-center justify-between active:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600"><Calendar size={20} /></div>
                    <div className="text-left">
                      <p className="text-sm font-black text-gray-800">{day.date}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{day.deliveries.length} Tasks</p>
                    </div>
                  </div>
                  {expandedDates.includes(day.date) ? <ChevronUp size={20} className="text-gray-300" /> : <ChevronDown size={20} className="text-gray-300" />}
                </button>

                {expandedDates.includes(day.date) && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-50 pt-3">
                    {day.deliveries.map((delivery) => (
                      <div key={delivery.id} onClick={() => setSelectedDelivery(delivery)} className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between active:scale-95 transition-transform cursor-pointer">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-800 truncate">{delivery.customerName}</p>
                          <p className="text-[10px] font-bold text-gray-400 truncate uppercase mt-0.5">{delivery.id}</p>
                        </div>
                        {getStatusIcon(delivery.status)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white/90 backdrop-blur-md border border-gray-200 p-2 rounded-full flex justify-around items-center z-50 shadow-2xl">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab icon={<List size={18} />} label="Tasks" onClick={() => navigate("/agent/working")} />
        <NavTab icon={<History size={18} />} label="History" active onClick={() => navigate("/agent/history")} />
        <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
      </div>

      {selectedDelivery && <DeliveryDetailsModal delivery={selectedDelivery} onClose={() => setSelectedDelivery(null)} />}
    </div>
  );
};

const NavTab = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 p-2 rounded-2xl min-w-[60px] ${active ? "text-blue-600" : "text-gray-400"}`}>
    {icon} <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
    {active && <div className="w-1 h-1 bg-blue-600 rounded-full mt-0.5" />}
  </button>
);

export default AgentHistory;