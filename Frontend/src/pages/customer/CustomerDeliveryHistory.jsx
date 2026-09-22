import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  CalendarCheck2,
  CalendarX2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  X,
  XCircle,
  AlertCircle,
  Truck,
} from "lucide-react";

import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import {
  cancelCustomerOneTimeOrder,
  fetchCustomerDeliveries,
  getCachedCustomerDeliveries,
  reportCustomerDeliveryIssue,
  skipCustomerDelivery,
} from "../../api/customer/customer.api";
import { isDeliveryDateCutoffPassed } from "../../utils/cutoff";
import DeliveryDetailsModal from "../../components/customer/DeliveryDetailsModal";
import { ReportIssueModal } from "../../components/customer/ReportIssueModal";

const headingFont = { fontFamily: "'Lora', serif" };

const STATUS_CFG = {
  DELIVERED: {
    icon: CheckCircle,
    iconBg: "bg-emerald-50 text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: "Delivered",
    sub: (item) => (item.time ? `Dropped at ${item.time}` : "Delivered"),
  },
  SKIPPED: {
    icon: XCircle,
    iconBg: "bg-stone-100 text-stone-600",
    badge: "bg-stone-100 text-stone-600 border border-stone-200",
    label: "Skipped",
    sub: () => "Not delivered",
  },
  PAUSED: {
    icon: XCircle,
    iconBg: "bg-stone-100 text-stone-600",
    badge: "bg-stone-100 text-stone-600 border border-stone-200",
    label: "Paused",
    sub: () => "Paused delivery",
  },
  FAILED: {
    icon: XCircle,
    iconBg: "bg-rose-50 text-rose-700",
    badge: "bg-rose-50 text-rose-700 border border-rose-200",
    label: "Failed",
    sub: () => "Auto-failed after scheduled day",
  },
  CANCELLED: {
    icon: XCircle,
    iconBg: "bg-rose-50 text-rose-700",
    badge: "bg-rose-50 text-rose-700 border border-rose-200",
    label: "Cancelled",
    sub: () => "Order cancelled by you",
  },
  PENDING: {
    icon: Clock,
    iconBg: "bg-amber-50 text-amber-700",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "Pending",
    sub: (item) =>
      String(item?.deliveryType || "").toUpperCase() === "SUBSCRIPTION"
        ? "Scheduled for delivery"
        : "Awaiting delivery",
  },
  PENDING_APPROVAL: {
    icon: Clock,
    iconBg: "bg-amber-50 text-amber-700",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "Approval Pending",
    sub: () => "Waiting for dairy approval",
  },
};

function getCfg(status) {
  return STATUS_CFG[String(status || "").toUpperCase()] || STATUS_CFG.PENDING;
}

const normalizeDateOnly = (val) => {
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function getDeliveryDateValue(delivery = {}) {
  if (delivery?.deliveryDate) {
    const parsed = new Date(`${delivery.deliveryDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (delivery?.date) {
    const parsed = new Date(delivery.date);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function getDayKey(delivery = {}) {
  if (delivery?.deliveryDate) return delivery.deliveryDate;
  const parsed = getDeliveryDateValue(delivery);
  if (!parsed) return String(delivery?.date || "unknown-date");
  return normalizeDateOnly(parsed);
}

function toDeliveryViewState(data) {
  return {
    deliveries: Array.isArray(data?.deliveries) ? data.deliveries : [],
    todayDelivery: data?.todayDelivery || null,
    insights: {
      monthLabel: data?.insights?.monthLabel || "",
      monthlyDeliveryCount: Number(data?.insights?.monthlyDeliveryCount || 0),
      skippedDays: Number(data?.insights?.skippedDays || 0),
      extraOrders: Number(data?.insights?.extraOrders || 0),
    },
  };
}

function getDeliveryTypeLabel(delivery = {}) {
  const normalizedType = String(delivery?.deliveryType || "").toUpperCase();
  if (normalizedType === "ONE_TIME") return "One-time";
  if (normalizedType === "SUBSCRIPTION") return "Subscription";
  return delivery?.isOneTimeOrder ? "One-time" : "Subscription";
}

function canCancelPendingOneTimeOrder(delivery = {}) {
  if (!delivery?.id || !delivery?.isOneTimeOrder) return false;
  const status = String(delivery?.status || "").toUpperCase();
  const approvalStatus = String(delivery?.approvalStatus || "").toUpperCase();

  if (
    ["DELIVERED", "COMPLETED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "CANCELLED", "CANCELED", "FAILED"].includes(status)
  ) {
    return false;
  }

  if (["APPROVED", "CANCELLED", "CANCELED"].includes(approvalStatus)) {
    return false;
  }

  return status === "PENDING_APPROVAL" || status === "PENDING" || approvalStatus === "PENDING";
}

function isDeliveryOutForTracking(status) {
  const normalizedStatus = String(status || "").toUpperCase();
  return normalizedStatus === "OUT_FOR_DELIVERY" || normalizedStatus === "IN_TRANSIT";
}

export default function Deliveries() {
  const navigate = useNavigate();
  const cachedDeliveries = getCachedCustomerDeliveries();
  const initialDeliveryState = toDeliveryViewState(cachedDeliveries);

  const [deliveries, setDeliveries] = useState(initialDeliveryState.deliveries);
  const [todayDelivery, setToday] = useState(initialDeliveryState.todayDelivery);
  const [insights, setInsights] = useState(initialDeliveryState.insights);
  const [loading, setLoading] = useState(() => !cachedDeliveries);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [selectedDayCell, setSelectedDayCell] = useState(null);
  const [issueTarget, setIssueTarget] = useState(null);
  const [issueText, setIssueText] = useState("");
  const [reportingIssue, setReportingIssue] = useState(false);

  const handleReportIssue = (item) => {
    setIssueTarget(item);
    setIssueText("");
  };

  const submitIssue = async () => {
    if (!issueText || issueText.trim().length < 5) return;
    setReportingIssue(true);
    try {
      await reportCustomerDeliveryIssue({
        issueText,
        deliveryId: issueTarget?.id,
      });
      setNotice("Delivery issue reported successfully.");
      setIssueTarget(null);
      setIssueText("");
    } catch (err) {
      setError(err?.message || "Failed to submit issue.");
    } finally {
      setReportingIssue(false);
    }
  };

  const [skipTarget, setSkipTarget] = useState(null);
  const [skippingDeliveryId, setSkippingDeliveryId] = useState(null);

  const openSkipModal = (item) => {
    setNotice(null);
    setSkipTarget(item || null);
  };

  const confirmSkipDelivery = async () => {
    const target = skipTarget;
    if (!target) return;

    const targetId = target?.id;
    const targetDate = target?.deliveryDate || selectedDayCell?.dateStr;

    setSkippingDeliveryId(targetId ? String(targetId) : targetDate);
    setNotice(null);

    try {
      const response = await skipCustomerDelivery({
        deliveryId: targetId,
        deliveryDate: targetDate,
      });
      setSkipTarget(null);
      setSelectedDayCell(null);
      setNotice({
        type: "success",
        message: response?.message || "Delivery skipped successfully.",
      });
      await load({ force: true, showSpinner: false });
    } catch (err) {
      setNotice({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to skip delivery.",
      });
    } finally {
      setSkippingDeliveryId(null);
    }
  };

  // Month navigation state (defaults to active month)
  const [activeDate, setActiveDate] = useState(() => new Date());

  const applyDeliveryState = (data) => {
    const nextState = toDeliveryViewState(data);
    setDeliveries(nextState.deliveries);
    setToday(nextState.todayDelivery);
    setInsights(nextState.insights);
  };

  const load = async ({
    force = false,
    showSpinner = force || !getCachedCustomerDeliveries(),
  } = {}) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchCustomerDeliveries({ force });
      applyDeliveryState(data);
    } catch (err) {
      setError(err?.message || "Could not load deliveries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ force: false });
  }, []);

  const deliveriesMap = useMemo(() => {
    const map = new Map();
    (deliveries || []).forEach((delivery) => {
      const dateKey = getDayKey(delivery);
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey).push(delivery);
    });
    return map;
  }, [deliveries]);

  // Calendar Grid Matrix calculation (7 columns x 5 or 6 weeks)
  const calendarGridDays = useMemo(() => {
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();

    const firstDayObj = new Date(year, month, 1);
    const startDayOfWeek = firstDayObj.getDay(); // 0 = Sun, 1 = Mon...
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const todayStr = normalizeDateOnly(new Date());
    const grid = [];

    // Preceding month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = normalizeDateOnly(prevDate);
      grid.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        items: deliveriesMap.get(dateStr) || [],
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const dateStr = normalizeDateOnly(curDate);
      grid.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        items: deliveriesMap.get(dateStr) || [],
      });
    }

    // Trailing month padding
    const totalCells = grid.length > 35 ? 42 : 35;
    const remaining = totalCells - grid.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = normalizeDateOnly(nextDate);
      grid.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        items: deliveriesMap.get(dateStr) || [],
      });
    }

    return grid;
  }, [activeDate, deliveriesMap]);

  const prevMonth = () => {
    setActiveDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setActiveDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const resetToToday = () => {
    setActiveDate(new Date());
  };

  const currentMonthLabel = activeDate.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const insightCards = [
    {
      label: "Delivered",
      value: insights.monthlyDeliveryCount,
      color: "text-[#4A7C2F]",
      iconBg: "bg-[#EEF5E7] text-[#4A7C2F]",
      Icon: CalendarCheck2,
    },
    {
      label: "Skipped / Paused",
      value: insights.skippedDays,
      color: "text-[#8B7355]",
      iconBg: "bg-[#FAF5EF] text-[#8B7355]",
      Icon: CalendarX2,
    },
    {
      label: "Extra Orders",
      value: insights.extraOrders,
      color: "text-[#B8641A]",
      iconBg: "bg-[#FFF1E4] text-[#B8641A]",
      Icon: CirclePlus,
    },
  ];

  const openCancelModal = (delivery) => {
    setNotice(null);
    setCancelTarget(delivery || null);
  };

  const openLiveTrack = (delivery) => {
    const orderId = String(delivery?.deliveryId || delivery?.id || "").trim();
    if (!orderId) return;
    navigate(`/customer/track/${orderId}`, { state: { delivery } });
  };

  const closeCancelModal = () => {
    if (cancellingOrderId) return;
    setCancelTarget(null);
  };

  const confirmCancelOrder = async () => {
    const target = cancelTarget;
    if (!target?.id) return;

    setCancellingOrderId(String(target.id));
    setNotice(null);

    try {
      const rawIdStr = String(target.rawId || target.id || "").trim();
      const extractedNum = Number(rawIdStr.replace(/\D+/g, ""));
      const cleanId = Number.isFinite(extractedNum) && extractedNum > 0 ? extractedNum : target.id;
      const response = await cancelCustomerOneTimeOrder({
        orderId: cleanId,
        orderIds: [cleanId],
      });
      setCancelTarget(null);
      setNotice({
        type: "success",
        message: response?.message || "Order cancelled successfully.",
      });
      await load({ force: true, showSpinner: false });
    } catch (err) {
      setNotice({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to cancel this order.",
      });
    } finally {
      setCancellingOrderId(null);
    }
  };

  return (
    <CustomerLayout>
      <div className="w-full min-w-0 space-y-5 sm:space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {/* Header Overview Card */}
        <div className="w-full min-w-0 rounded-[24px] border border-[#EDE8DF] bg-[linear-gradient(180deg,#F7F1E8_0%,#FDF9F3_100%)] p-3.5 sm:p-7 xl:p-8 shadow-[0_20px_60px_rgba(84,52,16,0.08)] sm:rounded-[30px]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A882]">
                Delivery Overview
              </p>
              <h1
                className="mt-1 text-[26px] font-semibold leading-tight text-[#2C1A0E] sm:text-[34px]"
                style={headingFont}
              >
                Delivery <span className="text-[#B8641A]">Calendar</span>
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#8B7355]">
                View your monthly delivery schedule, completed drops, and scheduled items.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={resetToToday}
                className="rounded-xl border border-[#EDE8DF] bg-white px-3 py-2 text-xs font-bold text-[#6B5B3E] transition hover:border-[#B8641A] hover:text-[#B8641A]"
              >
                Today
              </button>
              <button
                onClick={() => load({ force: true })}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#EDE8DF] bg-white px-3.5 py-2 text-xs font-semibold text-[#6B5B3E] transition hover:border-[#D97706] hover:text-[#B45309] disabled:opacity-40"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-[16px] border border-[#F2D0C8] bg-[#FDECEA] px-4 py-3 text-xs sm:text-sm text-[#C0392B]">
              {error}
            </div>
          )}

          {notice && (
            <div
              className={`mt-4 rounded-[16px] px-4 py-3 text-xs sm:text-sm ${
                notice.type === "success"
                  ? "border border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                  : "border border-[#F2D0C8] bg-[#FDECEA] text-[#C0392B]"
              }`}
            >
              {notice.message}
            </div>
          )}

          {/* Insights Summary Cards */}
          {!loading && (
            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-4 w-full min-w-0">
              {insightCards.map((card) => {
                const InsightIcon = card.Icon;
                return (
                  <div
                    key={card.label}
                    className="relative flex flex-col min-w-0 w-full overflow-hidden rounded-[16px] border border-[#EDE8DF] bg-white p-2 sm:rounded-[20px] sm:p-4 transition-transform hover:-translate-y-0.5"
                  >
                    <div className="pr-6 sm:pr-10 min-w-0">
                      <p className="mb-1 text-[7px] sm:text-[10px] font-bold uppercase leading-tight tracking-wider text-[#C4A882] sm:tracking-[0.18em] truncate">
                        {card.label}
                      </p>
                      <p className={`text-xl font-extrabold leading-none tracking-tight sm:text-3xl ${card.color}`}>
                        {card.value}
                      </p>
                    </div>
                    <div
                      className={`absolute right-1.5 top-1.5 sm:right-4 sm:top-4 flex h-6 w-6 sm:h-9 sm:w-9 items-center justify-center rounded-md sm:rounded-xl ${card.iconBg}`}
                    >
                      <InsightIcon size={12} className="sm:h-4 sm:w-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Calendar Control & Legend Bar */}
        <div className="w-full min-w-0 rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF7] p-3 sm:p-4 shadow-xs space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full min-w-0">
            {/* Month Navigator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-xl border border-[#EDE8DF] bg-white p-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="rounded-lg p-1.5 text-[#6B5B3E] transition hover:bg-[#FAF5EF] hover:text-[#2C1A0E]"
                  title="Previous Month"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="min-w-[130px] text-center text-sm font-bold text-[#2C1A0E]">
                  {currentMonthLabel}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="rounded-lg p-1.5 text-[#6B5B3E] transition hover:bg-[#FAF5EF] hover:text-[#2C1A0E]"
                  title="Next Month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Visual Status Legend */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 w-full sm:w-auto py-0.5">
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Delivered
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold text-amber-700 border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Pending
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold text-stone-600 border border-stone-200">
                <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
                Skipped / Paused
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold text-rose-700 border border-rose-200">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Failed / Missed
              </span>
            </div>
          </div>

          {/* 7-Day Monthly Calendar Grid */}
          <div className="overflow-hidden w-full min-w-0">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2.5 mb-2 text-center w-full min-w-0">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
                <div
                  key={dayName}
                  className={`py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                    idx === 0 || idx === 6 ? "text-[#B8641A]" : "text-[#A88763]"
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Grid Cells */}
            {loading ? (
              <div className="grid grid-cols-7 gap-1 sm:gap-2.5 w-full min-w-0 animate-pulse">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="h-20 sm:h-24 rounded-xl border border-[#EDE8DF] bg-[#FAF7F2]" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1 sm:gap-2.5 w-full min-w-0">
                {calendarGridDays.map((cell, idx) => {
                  const { dateStr, dayNumber, isCurrentMonth, isToday, items } = cell;

                  // Evaluate status for the cell
                  let statusKey = "";
                  if (items.length > 0) {
                    const statuses = items.map((i) => String(i.status || "").toUpperCase());
                    if (statuses.includes("DELIVERED")) statusKey = "DELIVERED";
                    else if (statuses.some((s) => ["FAILED", "CANCELLED", "CANCELED"].includes(s))) statusKey = "FAILED";
                    else if (statuses.some((s) => ["SKIPPED", "PAUSED"].includes(s))) statusKey = "SKIPPED";
                    else statusKey = "PENDING";
                  }

                  const cfg = statusKey ? getCfg(statusKey) : null;

                  // Full Product summary string for Desktop
                  const productPreview = items.length > 0
                    ? items.map((i) => {
                        const qtyRaw = String(i.qty || i.quantity || "-").trim();
                        const formattedQty = qtyRaw.toLowerCase().includes("l") ? qtyRaw : `${qtyRaw} L`;
                        const formattedProd = String(i.product || "Milk").replace(/^(\d+)([a-zA-Z])/, "$1 $2");
                        return `${formattedQty} · ${formattedProd}`;
                      }).join(", ")
                    : "";

                  // Short volume string for Mobile (e.g. "1.5L")
                  const shortVolumePreview = items.length > 0
                    ? items.map((i) => {
                        const qtyRaw = String(i.qty || i.quantity || "").trim();
                        if (!qtyRaw) return "";
                        const cleaned = qtyRaw.replace(/\s+/g, "").toUpperCase();
                        return cleaned.includes("L") ? cleaned : `${cleaned}L`;
                      }).filter(Boolean).join(", ")
                    : "";

                  return (
                    <button
                      key={`${dateStr}-${idx}`}
                      type="button"
                      onClick={() => isCurrentMonth && setSelectedDayCell(cell)}
                      disabled={!isCurrentMonth}
                      className={`relative flex flex-col items-center justify-between min-w-0 w-full p-1 sm:p-2.5 min-h-[68px] sm:min-h-[96px] text-center sm:text-left rounded-xl sm:rounded-2xl border transition-all duration-150 ${
                        !isCurrentMonth
                          ? "bg-[#FAF8F5]/50 border-[#EDE8DF]/40 opacity-30 text-stone-400 cursor-default pointer-events-none"
                          : isToday
                            ? "bg-[#FFF9F2] border-[#B8641A] ring-2 ring-[#B8641A]/20 shadow-xs hover:bg-[#FFF4E2] active:scale-95"
                            : items.length > 0
                              ? "bg-white border-[#EDE8DF] hover:border-[#D4B896] hover:bg-[#F3EDE2] hover:shadow-xs active:scale-95"
                              : "bg-[#FFFDF7] border-[#F2EDE4] hover:border-[#D4B896] hover:bg-[#F3EDE2] active:scale-95"
                      }`}
                    >
                      {/* Top: Date Number */}
                      <div className="flex items-center justify-center sm:justify-between w-full">
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            isToday
                              ? "flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-[#B8641A] text-white"
                              : isCurrentMonth
                                ? "text-[#2C1A0E]"
                                : "text-[#A88763]"
                          }`}
                        >
                          {dayNumber}
                        </span>

                        {cfg && isCurrentMonth && (
                          <span className={`hidden sm:inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                        )}
                      </div>

                      {/* Middle: Volume / Item Preview */}
                      {isCurrentMonth && items.length > 0 ? (
                        <div className="my-0.5 sm:my-1 min-w-0 w-full text-center sm:text-left">
                          {/* Short Volume for Mobile */}
                          <p className="block sm:hidden text-[10px] font-bold text-stone-600 truncate">
                            {shortVolumePreview}
                          </p>
                          {/* Full Product Preview for Desktop */}
                          <p className="hidden sm:block text-xs font-semibold text-[#524134] truncate">
                            {productPreview}
                          </p>
                          {items.length > 1 && (
                            <span className="hidden sm:inline-block text-[9px] text-[#A88763] font-bold">
                              +{items.length - 1} extra
                            </span>
                          )}
                        </div>
                      ) : isCurrentMonth ? (
                        <div className="my-0.5 sm:my-1 text-[10px] text-[#C4A882]/60 font-medium text-center">
                          —
                        </div>
                      ) : null}

                      {/* Bottom: Centered Status Dot for Mobile */}
                      {cfg && isCurrentMonth ? (
                        <div className="w-full flex items-center justify-center sm:justify-end">
                          <span
                            className={`sm:hidden h-2 w-2 rounded-full ${
                              statusKey === "DELIVERED"
                                ? "bg-emerald-500"
                                : statusKey === "FAILED"
                                  ? "bg-rose-500"
                                  : statusKey === "SKIPPED"
                                    ? "bg-stone-400"
                                    : "bg-amber-500"
                            }`}
                          />
                        </div>
                      ) : (
                        <div className="sm:hidden h-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delivery Details Bottom Sheet Modal */}
      {selectedDayCell && (
        <DeliveryDetailsModal
          cell={selectedDayCell}
          onClose={() => setSelectedDayCell(null)}
          onCancelOrder={openCancelModal}
          onTrackAgent={openLiveTrack}
          onReportIssue={handleReportIssue}
          onSkipDelivery={openSkipModal}
          cancellingOrderId={cancellingOrderId}
          skippingDeliveryId={skippingDeliveryId}
        />
      )}

      {/* Skip Delivery Modal */}
      {skipTarget && (
        <SkipDeliveryModal
          delivery={skipTarget}
          skipping={Boolean(skippingDeliveryId)}
          onClose={() => setSkipTarget(null)}
          onConfirm={confirmSkipDelivery}
        />
      )}

      {/* Report Issue Modal */}
      {issueTarget && (
        <ReportIssueModal
          issueText={issueText}
          saving={reportingIssue}
          onClose={() => setIssueTarget(null)}
          onChange={setIssueText}
          onSubmit={submitIssue}
        />
      )}

      {/* Cancel Order Modal */}
      {cancelTarget && (
        <CancelOrderModal
          delivery={cancelTarget}
          cancelling={String(cancellingOrderId) === String(cancelTarget?.id)}
          onClose={closeCancelModal}
          onConfirm={confirmCancelOrder}
        />
      )}
    </CustomerLayout>
  );
}

function CancelOrderModal({ delivery, cancelling = false, onClose, onConfirm }) {
  const deliveryDate = delivery?.deliveryDate
    ? new Date(`${delivery.deliveryDate}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : delivery?.date || "-";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C1A0E]/45 px-4 pb-4 sm:items-center sm:pb-0">
      <div className="w-full max-w-md rounded-[24px] border border-[#E7DAC6] bg-[#FFFDF7] p-5 shadow-[0_24px_60px_rgba(44,26,14,0.28)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
          Cancel One-time Order
        </p>
        <h3 className="mt-2 text-xl font-semibold text-[#2C1A0E]" style={headingFont}>
          Cancel this approval-pending order?
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#8B7355]">
          {delivery?.qty || "-"} {delivery?.product || "Milk"} for {deliveryDate} will be removed from your deliveries.
          If this order was already paid, the amount will be added back to your wallet.
        </p>

        <div className="mt-5 rounded-[18px] border border-[#EDE8DF] bg-white px-4 py-3 text-sm text-[#5C3D1E]">
          <p className="font-semibold">{getDeliveryTypeLabel(delivery)} order</p>
          <p className="mt-1 text-xs text-[#8B7355]">
            Status: Approval pending
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={cancelling}
            className="rounded-[14px] border border-[#EDE8DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Keep Order
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={cancelling}
            className="rounded-[14px] bg-[#C0392B] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#A93226] disabled:cursor-not-allowed disabled:bg-[#D8C8B2]"
          >
            {cancelling ? "Cancelling..." : "Yes, Cancel Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkipDeliveryModal({ delivery, skipping = false, onClose, onConfirm }) {
  const deliveryDate = delivery?.deliveryDate
    ? new Date(`${delivery.deliveryDate}T00:00:00`).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : delivery?.date || "-";

  const formattedQty = String(delivery?.qty || delivery?.quantity || "1")
    .toLowerCase()
    .includes("l")
    ? delivery?.qty || delivery?.quantity
    : `${delivery?.qty || delivery?.quantity || "1"} L`;

  const formattedProd = String(delivery?.product || "Milk").replace(/^(\d+)([a-zA-Z])/, "$1 $2");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C1A0E]/45 px-4 pb-4 sm:items-center sm:pb-0">
      <div className="w-full max-w-md rounded-[24px] border border-[#E7DAC6] bg-[#FFFDF7] p-5 shadow-[0_24px_60px_rgba(44,26,14,0.28)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B8641A]">
          Skip Delivery
        </p>
        <h3 className="mt-2 text-xl font-semibold text-[#2C1A0E]" style={headingFont}>
          Skip this delivery?
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#8B7355]">
          You are skipping your scheduled delivery for <span className="font-bold text-[#2C1A0E]">{deliveryDate}</span>. You will not be charged for this delivery.
        </p>

        <div className="mt-4 rounded-[18px] border border-[#EDE8DF] bg-white p-4 text-sm text-[#5C3D1E] space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#8B7355] font-semibold uppercase">Product</span>
            <span className="font-bold text-[#2C1A0E]">{formattedQty} · {formattedProd}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-[#F2EDE4]">
            <span className="text-xs text-[#8B7355] font-semibold uppercase">Date</span>
            <span className="font-semibold text-[#2C1A0E]">{deliveryDate}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-[#F2EDE4]">
            <span className="text-xs text-[#8B7355] font-semibold uppercase">Expected Charge</span>
            <span className="font-extrabold text-emerald-700">₹0.00</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={skipping}
            className="rounded-[14px] border border-[#EDE8DF] bg-white px-4 py-2.5 text-sm font-semibold text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FDF6EC] hover:text-[#5C3D1E] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={skipping}
            className="rounded-[14px] bg-[#B8641A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#9A5213] disabled:opacity-60"
          >
            {skipping ? "Skipping..." : "Skip Delivery"}
          </button>
        </div>
      </div>
    </div>
  );
}
