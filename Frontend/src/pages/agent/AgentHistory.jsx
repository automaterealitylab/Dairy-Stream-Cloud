import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DeliveryDetailsModal from "../../components/agent/DeliveryDetailsModal";
import {
  Calendar,
  CheckCircle,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Package,
  Home,
  List,
  History,
  Map,
  User,
} from "lucide-react";
import { fetchAgentDeliveryHistory } from "../../api/agent/agent.api";
import { getProductLabel } from "../../utils/agentTaskGrouping";

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

const AgentHistory = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDates, setExpandedDates] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const payload = await fetchAgentDeliveryHistory();
        setHistory(payload || []);
        if (payload?.[0]?.date) setExpandedDates([payload[0].date]);
      } catch (_err) {
        setHistory([]);
      }
    };
    loadHistory();
  }, []);

  const toggleDateExpanded = (date) => {
    setExpandedDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));
  };

  const filteredHistory = history
    .map((day) => ({
      ...day,
      deliveries: day.deliveries.filter(
        (d) =>
          d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
          getProductLabel(d).toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((day) => day.deliveries.length > 0);

  const getStatusIcon = (status) =>
    status === "completed" ? (
      <CheckCircle size={14} className="text-[#4A7C2F]" />
    ) : (
      <XCircle size={14} className="text-[#C0392B]" />
    );

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-4 pb-32 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-5">
        <section className="rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">History</p>
          <h1 className="mt-1 text-[26px] font-black leading-none text-[#2C1A0E]" style={headingFont}>
            Delivery Archive
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#6B5B3E]">Review past performance</p>
        </section>

        <div className="group relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A88763]" size={16} />
          <input
            type="text"
            placeholder="Search deliveries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[22px] border border-[#E7DAC6] bg-white py-3.5 pl-11 pr-4 text-sm text-[#2C1A0E] shadow-[0_14px_35px_rgba(92,61,30,0.05)] outline-none focus:border-[#D4B896]"
          />
        </div>

        <div className="space-y-2.5">
          {filteredHistory.length === 0 ? (
            <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-12 text-center shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
              <Package className="mx-auto mb-2 text-[#D4B896]" size={40} />
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#A88763]">No History</p>
            </div>
          ) : (
            filteredHistory.map((day) => (
              <div
                key={day.date}
                className="overflow-hidden rounded-[26px] border border-[#EDE8DF] bg-white shadow-[0_14px_35px_rgba(92,61,30,0.07)]"
              >
                <button
                  onClick={() => toggleDateExpanded(day.date)}
                  className="flex w-full items-center justify-between px-4 py-2.5 transition-colors active:bg-[#FFF8EF]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-[14px] border border-[#F0D9B9] bg-[#FFF4E2] p-2 text-[#B8641A]">
                      <Calendar size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-[#2C1A0E]">{day.date}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#A88763]">
                        {day.deliveries.length} Tasks
                      </p>
                    </div>
                  </div>
                  {expandedDates.includes(day.date) ? (
                    <ChevronUp size={20} className="text-[#B89970]" />
                  ) : (
                    <ChevronDown size={20} className="text-[#B89970]" />
                  )}
                </button>

                {expandedDates.includes(day.date) && (
                  <div className="space-y-1.5 border-t border-[#F3E7D6] px-3 pb-2.5 pt-2.5">
                    {day.deliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        onClick={() => setSelectedDelivery(delivery)}
                        className="flex cursor-pointer items-center justify-between rounded-[18px] border border-[#F3E7D6] bg-[#FFF8EF] px-3 py-2 transition-transform active:scale-[0.98]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#2C1A0E]">{delivery.customerName}</p>
                          <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[#A88763]">
                            {delivery.id}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-[#6B5B3E]">
                            {getProductLabel(delivery)}
                          </p>
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

      <div className="fixed bottom-6 left-1/2 z-50 flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab
          icon={<Map size={18} />}
          label="Map"
          onClick={() => navigate("/agent/dashboard", { state: { section: "MAP" } })}
        />
        <NavTab icon={<List size={18} />} label="Tasks" onClick={() => navigate("/agent/working")} />
        <NavTab icon={<History size={18} />} label="History" active onClick={() => navigate("/agent/history")} />
        <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
      </div>

      {selectedDelivery && <DeliveryDetailsModal delivery={selectedDelivery} onClose={() => setSelectedDelivery(null)} />}
    </div>
  );
};

export default AgentHistory;
