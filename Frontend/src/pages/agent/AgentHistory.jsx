import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DeliveryDetailsModal from "../../components/agent/DeliveryDetailsModal";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Search,
  Package,
  Home,
  List,
  History,
  Map as MapIcon,
  User,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { fetchAgentDeliveryHistory } from "../../api/agent/agent.api";
import { formatQuantity, getProductLabel } from "../../utils/agentTaskGrouping";

const headingFont = { fontFamily: "'Lora', serif" };

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const toDateKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getTodayKey = () => {
  const d = new Date();
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
};

const formatFullDateLabel = (dateStr) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(dateObj.getTime())) return dateStr;
  return dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const todayKey = useMemo(() => getTodayKey(), []);
  const [selectedDate, setSelectedDate] = useState(() => todayKey);

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const payload = await fetchAgentDeliveryHistory();
        const list = Array.isArray(payload) ? payload : [];
        setHistory(list);

        // If there is history, default to the most recent delivery date
        if (list.length > 0 && list[0]?.date) {
          const latestDate = list[0].date;
          setSelectedDate(latestDate);
          const parts = latestDate.split("-");
          if (parts.length === 3) {
            setCurrentYear(Number(parts[0]));
            setCurrentMonth(Number(parts[1]) - 1);
          }
        }
      } catch (err) {
        console.error("Failed to load agent delivery history:", err);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  const historyByDate = useMemo(() => {
    const map = new Map();
    history.forEach((dayGroup) => {
      if (dayGroup?.date) {
        map.set(dayGroup.date, dayGroup.deliveries || []);
      }
    });
    return map;
  }, [history]);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setSelectedDate(todayKey);
  };

  // Build calendar matrix
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days = [];
    // Blank padding before the first of the month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ blank: true, key: `blank-${i}` });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = toDateKey(currentYear, currentMonth, d);
      const dayDeliveries = historyByDate.get(dateKey) || [];
      days.push({
        blank: false,
        dayNumber: d,
        dateKey,
        hasActivity: dayDeliveries.length > 0,
        activityCount: dayDeliveries.length,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedDate,
      });
    }

    return days;
  }, [currentYear, currentMonth, historyByDate, todayKey, selectedDate]);

  // Selected date's deliveries
  const selectedDateDeliveries = useMemo(() => {
    return historyByDate.get(selectedDate) || [];
  }, [historyByDate, selectedDate]);

  // Filtered deliveries by search query
  const filteredDeliveries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return selectedDateDeliveries;

    return selectedDateDeliveries.filter((d) => {
      const nameMatch = String(d?.customerName || "").toLowerCase().includes(query);
      const idMatch = String(d?.id || "").toLowerCase().includes(query);
      const addressMatch = String(d?.address || "").toLowerCase().includes(query);
      const productMatch = getProductLabel(d).toLowerCase().includes(query);
      return nameMatch || idMatch || addressMatch || productMatch;
    });
  }, [selectedDateDeliveries, searchQuery]);

  // Summary statistics for the selected date
  const selectedDateStats = useMemo(() => {
    const total = selectedDateDeliveries.length;
    const completed = selectedDateDeliveries.filter(
      (d) => String(d?.status || "").toLowerCase() === "completed"
    ).length;
    const failed = selectedDateDeliveries.filter(
      (d) => String(d?.status || "").toLowerCase() === "failed"
    ).length;
    const pending = selectedDateDeliveries.filter(
      (d) => String(d?.status || "").toLowerCase() === "pending"
    ).length;
    const totalQuantity = selectedDateDeliveries.reduce((sum, d) => {
      if (String(d?.status || "").toLowerCase() === "completed") {
        const qty = Number(d?.milkQuantity || d?.quantity || 0);
        return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
      }
      return sum;
    }, 0);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      failed,
      pending,
      totalQuantity,
      completionRate,
    };
  }, [selectedDateDeliveries]);

  const getStatusIcon = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed") {
      return <CheckCircle size={15} className="shrink-0 text-[#4A7C2F]" />;
    }
    if (s === "failed") {
      return <XCircle size={15} className="shrink-0 text-[#C0392B]" />;
    }
    return <Clock size={15} className="shrink-0 text-[#B8641A]" />;
  };

  return (
    <div className="agent-safe-top min-h-screen bg-[#FFFDF7] px-4 pb-32 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-4">
        {/* Header Banner */}
        <section className="rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">History</p>
              <h1 className="mt-1 text-[26px] font-black leading-none text-[#2C1A0E]" style={headingFont}>
                Delivery History
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#6B5B3E]">
                Select a date to view completed and past deliveries
              </p>
            </div>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-full border border-[#E7DAC6] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#B8641A] shadow-sm transition hover:bg-[#FFF8EF]"
            >
              Today
            </button>
          </div>
        </section>

        {/* Search Bar */}
        <div className="group relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A88763]" size={16} />
          <input
            type="text"
            placeholder="Search deliveries by customer, flat, item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[22px] border border-[#E7DAC6] bg-white py-3 pl-11 pr-4 text-sm text-[#2C1A0E] shadow-[0_10px_25px_rgba(92,61,30,0.04)] outline-none transition focus:border-[#B8641A]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full bg-[#F3E7D6] px-2 py-0.5 text-[10px] font-bold text-[#8B7355]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Calendar Card */}
        <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-4 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          {/* Month Navigation */}
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-base font-black text-[#2C1A0E]" style={headingFont}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToPrevMonth}
                aria-label="Previous month"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E7DAC6] bg-[#FFFDF7] text-[#6B5B3E] transition active:scale-95"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={goToNextMonth}
                aria-label="Next month"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E7DAC6] bg-[#FFFDF7] text-[#6B5B3E] transition active:scale-95"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_NAMES.map((name) => (
              <span
                key={name}
                className="py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#A88763]"
              >
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 pt-1">
            {calendarDays.map((cell) => {
              if (cell.blank) {
                return <div key={cell.key} className="h-10" />;
              }

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateKey)}
                  className={`group relative flex h-10 flex-col items-center justify-center rounded-[14px] transition active:scale-95 ${
                    cell.isSelected
                      ? "bg-[#B8641A] font-black text-white shadow-md shadow-[#B8641A]/30"
                      : cell.isToday
                      ? "border border-[#B8641A] bg-[#FFF8EF] font-black text-[#B8641A]"
                      : cell.hasActivity
                      ? "bg-[#FAF7F2] font-bold text-[#2C1A0E] hover:bg-[#FFF4E2]"
                      : "text-[#8B7D6B] hover:bg-[#FAF7F2]"
                  }`}
                >
                  <span className="text-xs">{cell.dayNumber}</span>
                  {cell.hasActivity && (
                    <span
                      className={`mt-0.5 h-1 w-1 rounded-full ${
                        cell.isSelected ? "bg-white" : "bg-[#B8641A]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Summary Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A88763]">Selected Date</p>
              <h2 className="text-lg font-black text-[#2C1A0E]" style={headingFont}>
                {formatFullDateLabel(selectedDate)}
              </h2>
            </div>
            {selectedDateStats.total > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE8D1] bg-[#EEF5E7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#4A7C2F]">
                <CheckCircle2 size={12} />
                {selectedDateStats.completionRate}% Done
              </span>
            )}
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-[18px] border border-[#E7DAC6] bg-white p-2.5 text-center shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#A88763]">Deliveries</p>
              <p className="mt-0.5 text-base font-black text-[#2C1A0E]">{selectedDateStats.total}</p>
            </div>
            <div className="rounded-[18px] border border-[#DDE8D1] bg-[#EEF5E7] p-2.5 text-center shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#6B8A4A]">Completed</p>
              <p className="mt-0.5 text-base font-black text-[#4A7C2F]">{selectedDateStats.completed}</p>
            </div>
            <div className="rounded-[18px] border border-[#F2D0C8] bg-[#FDECEA] p-2.5 text-center shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#C0392B]">Failed</p>
              <p className="mt-0.5 text-base font-black text-[#C0392B]">{selectedDateStats.failed}</p>
            </div>
            <div className="rounded-[18px] border border-[#F0D9B9] bg-[#FFF4E2] p-2.5 text-center shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#B8641A]">Milk Vol</p>
              <p className="mt-0.5 text-base font-black text-[#B8641A]">
                {formatQuantity(selectedDateStats.totalQuantity)}L
              </p>
            </div>
          </div>
        </div>

        {/* Deliveries List for Selected Date */}
        <div className="space-y-2.5">
          {loading ? (
            <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-12 text-center shadow-sm">
              <Clock className="mx-auto mb-2 animate-spin text-[#B8641A]" size={32} />
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A88763]">
                Loading delivery history...
              </p>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-10 text-center shadow-sm">
              <Package className="mx-auto mb-2 text-[#D4B896]" size={36} />
              <p className="text-sm font-bold text-[#A88763]">
                {searchQuery
                  ? "No deliveries match your search query"
                  : `No deliveries recorded on ${selectedDate}`}
              </p>
              <p className="mt-1 text-xs text-[#8B7355]">
                {selectedDateStats.total === 0
                  ? "Choose a highlighted date on the calendar above to inspect records."
                  : "Try clearing your search query."}
              </p>
            </div>
          ) : (
            filteredDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDelivery(delivery)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedDelivery(delivery);
                  }
                }}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-[22px] border border-[#EDE8DF] bg-white p-3.5 shadow-[0_10px_25px_rgba(92,61,30,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(92,61,30,0.09)] active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-[#2C1A0E]">{delivery.customerName}</p>
                    {delivery.completedAt && delivery.completedAt !== "-" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF7F2] px-2 py-0.5 text-[9px] font-semibold text-[#8B7D6B]">
                        <Clock size={10} />
                        {delivery.completedAt}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-[#6B5B3E]">
                    {getProductLabel(delivery)} • {formatQuantity(delivery.milkQuantity || delivery.quantity || 1)}L
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#A88763]">{delivery.address}</p>
                  {delivery.failedReason && (
                    <p className="mt-1 text-[11px] font-medium text-[#C0392B]">
                      Reason: {delivery.failedReason}
                    </p>
                  )}
                </div>
                <div className="shrink-0 pt-0.5">
                  {(() => {
                    const s = String(delivery.status || "").toLowerCase();
                    const isDone = s === "completed";
                    const isFail = s === "failed";
                    const label = isDone ? "Delivered" : isFail ? "Failed" : "Pending";
                    const badgeClass = isDone
                      ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                      : isFail
                      ? "border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B]"
                      : "border-[#F0D9B9] bg-[#FFF4E2] text-[#B8641A]";

                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${badgeClass}`}
                      >
                        {getStatusIcon(delivery.status)}
                        {label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Floating Navigation */}
      <div className="fixed bottom-6 left-1/2 z-50 flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab
          icon={<MapIcon size={18} />}
          label="Map"
          onClick={() => navigate("/agent/dashboard", { state: { section: "MAP" } })}
        />
        <NavTab icon={<List size={18} />} label="Tasks" onClick={() => navigate("/agent/working")} />
        <NavTab icon={<History size={18} />} label="History" active onClick={() => navigate("/agent/history")} />
        <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
      </div>

      {selectedDelivery && (
        <DeliveryDetailsModal delivery={selectedDelivery} onClose={() => setSelectedDelivery(null)} />
      )}
    </div>
  );
};

export default AgentHistory;

