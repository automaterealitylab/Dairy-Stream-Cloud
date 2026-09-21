import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DeliveryDetailsModal from "../../components/agent/DeliveryDetailsModal";
import {
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
import { formatQuantity } from "../../utils/agentTaskGrouping";

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

  const todayKey = useMemo(() => getTodayKey(), []);
  const [selectedDate, setSelectedDate] = useState(() => todayKey);

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Data & Pagination State
  const [deliveries, setDeliveries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1, hasMore: false });
  const [summary, setSummary] = useState({ total: 0, completed: 0, failed: 0, pending: 0, totalQuantity: 0 });
  const [statusCounts, setStatusCounts] = useState({ all: 0, pending: 0, completed: 0, failed: 0 });
  const [activeDates, setActiveDates] = useState(() => new Set());

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load deliveries when selectedDate, selectedStatus, or debouncedSearch changes
  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
        const response = await fetchAgentDeliveryHistory({
          date: selectedDate,
          status: selectedStatus.toLowerCase(),
          search: debouncedSearch || undefined,
          page: 1,
          limit: 25,
          month: monthStr,
        });

        if (isCancelled) return;

        const list = Array.isArray(response?.deliveries) ? response.deliveries : [];
        setDeliveries(list);

        if (response?.pagination) {
          setPagination(response.pagination);
        } else {
          setPagination({ page: 1, limit: 25, total: list.length, totalPages: 1, hasMore: false });
        }

        if (response?.summary) {
          setSummary(response.summary);
        }
        if (response?.statusCounts) {
          setStatusCounts(response.statusCounts);
        }
        if (Array.isArray(response?.activeDates)) {
          setActiveDates(new Set(response.activeDates));
        }
      } catch (err) {
        console.error("Failed to load agent delivery history:", err);
        if (!isCancelled) {
          setDeliveries([]);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [selectedDate, selectedStatus, debouncedSearch, currentYear, currentMonth]);

  // Handle Load More (Incremental Page Fetching)
  const handleLoadMore = async () => {
    if (loadingMore || !pagination.hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = pagination.page + 1;
      const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
      const response = await fetchAgentDeliveryHistory({
        date: selectedDate,
        status: selectedStatus.toLowerCase(),
        search: debouncedSearch || undefined,
        page: nextPage,
        limit: 25,
        month: monthStr,
      });

      const nextList = Array.isArray(response?.deliveries) ? response.deliveries : [];
      setDeliveries((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        const uniqueNew = nextList.filter((d) => !existingIds.has(d.id));
        return [...prev, ...uniqueNew];
      });

      if (response?.pagination) {
        setPagination(response.pagination);
      }
    } catch (err) {
      console.error("Failed to load more deliveries:", err);
    } finally {
      setLoadingMore(false);
    }
  };

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
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ blank: true, key: `blank-${i}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = toDateKey(currentYear, currentMonth, d);
      const hasActivity = activeDates.has(dateKey);
      days.push({
        blank: false,
        dayNumber: d,
        dateKey,
        hasActivity,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedDate,
      });
    }

    return days;
  }, [currentYear, currentMonth, activeDates, todayKey, selectedDate]);

  const completionRate = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  const getStatusIcon = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed") {
      return <CheckCircle size={14} className="shrink-0 text-[#4A7C2F]" />;
    }
    if (s === "failed") {
      return <XCircle size={14} className="shrink-0 text-[#C0392B]" />;
    }
    return <Clock size={14} className="shrink-0 text-[#B8641A]" />;
  };

  return (
    <div className="agent-safe-top min-h-screen bg-[#FFFDF7] px-4 pb-32 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-3.5">
        {/* Header Banner */}
        <section className="rounded-[26px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] px-4 py-3 shadow-[0_12px_30px_rgba(92,61,30,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">History</p>
              <h1 className="mt-1 text-[24px] font-black leading-none text-[#2C1A0E]" style={headingFont}>
                Delivery History
              </h1>
              <p className="mt-1 text-xs font-semibold text-[#6B5B3E]">
                Scalable operational log for completed and past runs
              </p>
            </div>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-full border border-[#E7DAC6] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#B8641A] shadow-xs transition hover:bg-[#FFF8EF]"
            >
              Today
            </button>
          </div>
        </section>

        {/* Calendar Card */}
        <div className="rounded-[24px] border border-[#EDE8DF] bg-white p-3.5 shadow-xs">
          {/* Month Navigation */}
          <div className="flex items-center justify-between pb-2.5">
            <h2 className="text-sm font-black text-[#2C1A0E]" style={headingFont}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToPrevMonth}
                aria-label="Previous month"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E7DAC6] bg-[#FFFDF7] text-[#6B5B3E] transition active:scale-95"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={goToNextMonth}
                aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E7DAC6] bg-[#FFFDF7] text-[#6B5B3E] transition active:scale-95"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_NAMES.map((name) => (
              <span
                key={name}
                className="py-0.5 text-[9.5px] font-black uppercase tracking-[0.12em] text-[#A88763]"
              >
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 pt-1">
            {calendarDays.map((cell) => {
              if (cell.blank) {
                return <div key={cell.key} className="h-9" />;
              }

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateKey)}
                  className={`group relative flex h-9 flex-col items-center justify-center rounded-[12px] transition active:scale-95 ${
                    cell.isSelected
                      ? "bg-[#B8641A] font-black text-white shadow-xs"
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
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A88763]">Selected Date</p>
              <h2 className="text-base font-black text-[#2C1A0E]" style={headingFont}>
                {formatFullDateLabel(selectedDate)}
              </h2>
            </div>
            {summary.total > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE8D1] bg-[#EEF5E7] px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.12em] text-[#4A7C2F]">
                <CheckCircle2 size={11} />
                {completionRate}% Done
              </span>
            )}
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-[16px] border border-[#E7DAC6] bg-white p-2 text-center shadow-xs">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#A88763]">Deliveries</p>
              <p className="mt-0.5 text-sm font-black text-[#2C1A0E]">{summary.total}</p>
            </div>
            <div className="rounded-[16px] border border-[#DDE8D1] bg-[#EEF5E7] p-2 text-center shadow-xs">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#6B8A4A]">Completed</p>
              <p className="mt-0.5 text-sm font-black text-[#4A7C2F]">{summary.completed}</p>
            </div>
            <div className="rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] p-2 text-center shadow-xs">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#C0392B]">Failed</p>
              <p className="mt-0.5 text-sm font-black text-[#C0392B]">{summary.failed}</p>
            </div>
            <div className="rounded-[16px] border border-[#F0D9B9] bg-[#FFF4E2] p-2 text-center shadow-xs">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#B8641A]">Milk Vol</p>
              <p className="mt-0.5 text-sm font-black text-[#B8641A]">
                {formatQuantity(summary.totalQuantity)}L
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="group relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A88763]" size={15} />
          <input
            type="text"
            placeholder="Search customer, flat, building..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[20px] border border-[#E7DAC6] bg-white py-2.5 pl-10 pr-12 text-xs font-medium text-[#2C1A0E] shadow-xs outline-none transition focus:border-[#B8641A]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#F3E7D6] px-2 py-0.5 text-[9.5px] font-bold text-[#8B7355]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filters Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { key: "ALL", label: `ALL ${statusCounts.all}` },
            { key: "PENDING", label: `PENDING ${statusCounts.pending}` },
            { key: "COMPLETED", label: `COMPLETED ${statusCounts.completed}` },
            { key: "FAILED", label: `FAILED ${statusCounts.failed}` },
          ].map(({ key, label }) => {
            const isActive = selectedStatus === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedStatus(key)}
                className={`rounded-full px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.1em] transition whitespace-nowrap ${
                  isActive
                    ? "bg-[#B8641A] text-white shadow-xs shadow-[#B8641A]/20"
                    : "border border-[#E7DAC6] bg-white text-[#6B5B3E] hover:bg-[#FFF8EF]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Deliveries List (Compact Operational Rows) */}
        <div className="space-y-2">
          {loading ? (
            <div className="rounded-[24px] border border-[#EDE8DF] bg-white p-10 text-center shadow-xs">
              <Clock className="mx-auto mb-2 animate-spin text-[#B8641A]" size={28} />
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A88763]">
                Loading deliveries...
              </p>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="rounded-[24px] border border-[#EDE8DF] bg-white p-8 text-center shadow-xs">
              <Package className="mx-auto mb-2 text-[#D4B896]" size={32} />
              <p className="text-sm font-bold text-[#A88763]">
                {debouncedSearch
                  ? "No deliveries match your search query"
                  : selectedStatus !== "ALL"
                  ? `No ${selectedStatus.toLowerCase()} deliveries on this date`
                  : `No deliveries recorded on ${selectedDate}`}
              </p>
              <p className="mt-1 text-xs text-[#8B7355]">
                {debouncedSearch
                  ? "Try adjusting your search keywords."
                  : selectedStatus !== "ALL"
                  ? "Switch to ALL filter to see other records."
                  : "Choose another date on the calendar above."}
              </p>
            </div>
          ) : (
            deliveries.map((delivery) => {
              const s = String(delivery.status || "").toLowerCase();
              const isDone = s === "completed";
              const isFail = s === "failed";
              const statusLabel = isDone ? "Completed" : isFail ? "Failed" : "Pending";
              const badgeClass = isDone
                ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                : isFail
                ? "border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B]"
                : "border-[#F0D9B9] bg-[#FFF4E2] text-[#B8641A]";

              return (
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
                  className="cursor-pointer rounded-[18px] border border-[#EDE8DF] bg-white p-3 shadow-xs transition hover:bg-[#FFFDF9] hover:border-[#DECDB7] active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Primary & Secondary Information */}
                    <div className="min-w-0 flex-1">
                      {/* Customer Name */}
                      <p className="text-[14px] font-black text-[#2C1A0E] truncate leading-tight">
                        {delivery.customerName}
                      </p>

                      {/* Flat / Room + Building */}
                      <p className="text-[12px] font-bold text-[#6B5B3E] truncate mt-1">
                        {delivery.unitAndBuilding || delivery.address}
                      </p>

                      {/* Product + Quantity */}
                      <p className="text-[12px] font-extrabold text-[#B8641A] truncate mt-0.5">
                        {delivery.productAndQty || `${delivery.productLabel || "Milk"} • ${delivery.milkQuantity || 1} L`}
                      </p>

                      {/* Failure reason if any */}
                      {delivery.failedReason && (
                        <p className="text-[11px] font-medium text-[#C0392B] mt-0.5 truncate">
                          Reason: {delivery.failedReason}
                        </p>
                      )}
                    </div>

                    {/* Status Badge & Completed Time */}
                    <div className="flex flex-col items-end shrink-0 pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-[0.1em] ${badgeClass}`}
                      >
                        {getStatusIcon(delivery.status)}
                        {statusLabel}
                      </span>
                      {delivery.completedAt && delivery.completedAt !== "-" && (
                        <span className="text-[11px] font-semibold text-[#8B7D6B] mt-1">
                          {delivery.completedAt}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Load More & Pagination Bar */}
        {deliveries.length > 0 && (
          <div className="pt-1 pb-2 space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-bold text-[#8B7D6B]">
                Showing 1–{deliveries.length} of {pagination.total} deliveries
              </p>
              {pagination.totalPages > 1 && (
                <p className="text-[11px] font-bold text-[#A88763]">
                  Page {pagination.page} of {pagination.totalPages}
                </p>
              )}
            </div>

            {pagination.hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full rounded-[18px] border border-[#E7DAC6] bg-white py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#8B5E34] shadow-xs transition hover:bg-[#FFF8EF] active:scale-[0.99] disabled:opacity-60"
              >
                {loadingMore ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Clock size={14} className="animate-spin" />
                    Loading more deliveries...
                  </span>
                ) : (
                  `Load More Deliveries (${Math.min(25, pagination.total - deliveries.length)} remaining)`
                )}
              </button>
            )}

            {!pagination.hasMore && pagination.total > 25 && (
              <p className="text-center text-[11px] font-bold text-[#8B7D6B] py-1">
                ✓ All {pagination.total} deliveries loaded
              </p>
            )}
          </div>
        )}
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
