import React from "react";
import {
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  AlertCircle,
  Ban,
  Slash,
} from "lucide-react";
import { isDeliveryDateCutoffPassed } from "../../utils/cutoff";

const headingFont = { fontFamily: "'Lora', serif" };

const STATUS_CFG = {
  DELIVERED: {
    icon: CheckCircle,
    iconBg: "bg-emerald-50 text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: "Delivered",
  },
  SKIPPED: {
    icon: XCircle,
    iconBg: "bg-stone-100 text-stone-600",
    badge: "bg-stone-100 text-stone-600 border border-stone-200",
    label: "Skipped",
  },
  PAUSED: {
    icon: XCircle,
    iconBg: "bg-stone-100 text-stone-600",
    badge: "bg-stone-100 text-stone-600 border border-stone-200",
    label: "Paused",
  },
  FAILED: {
    icon: XCircle,
    iconBg: "bg-rose-50 text-rose-700",
    badge: "bg-rose-50 text-rose-700 border border-rose-200",
    label: "Failed",
  },
  MISSED: {
    icon: XCircle,
    iconBg: "bg-rose-50 text-rose-700",
    badge: "bg-rose-50 text-rose-700 border border-rose-200",
    label: "Missed",
  },
  CANCELLED: {
    icon: XCircle,
    iconBg: "bg-rose-50 text-rose-700",
    badge: "bg-rose-50 text-rose-700 border border-rose-200",
    label: "Cancelled",
  },
  PENDING: {
    icon: Clock,
    iconBg: "bg-amber-50 text-amber-700",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "Pending",
  },
  PENDING_APPROVAL: {
    icon: Clock,
    iconBg: "bg-amber-50 text-amber-700",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "Approval Pending",
  },
};

function getCfg(status) {
  return STATUS_CFG[String(status || "").toUpperCase()] || STATUS_CFG.PENDING;
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

export default function DeliveryDetailsModal({
  cell,
  items: directItems,
  formattedDate: directDate,
  onClose,
  onCancelOrder,
  onTrackAgent,
  onReportIssue,
  onSkipDelivery,
  cancellingOrderId,
  skippingDeliveryId,
}) {
  const items = cell?.items || directItems || [];
  const dateStr = cell?.dateStr;

  const formattedDate =
    directDate ||
    (dateStr
      ? new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Delivery Details");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Bottom Sheet Container */}
      <div className="fixed inset-x-0 bottom-0 z-50 w-full max-h-[85vh] flex flex-col rounded-t-3xl bg-[#FAF7F2] p-5 pb-8 shadow-2xl border-t border-[#E8E2D9] box-border animate-in slide-in-from-bottom duration-250 ease-out">
        {/* Centered Drag Handle Pill */}
        <div className="w-10 h-1 bg-[#D6CEBE] rounded-full mx-auto mb-3 shrink-0" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E8E2D9] w-full box-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E4] text-[#B8641A]">
              <CalendarIcon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882] truncate">
                Delivery Details
              </p>
              <h3
                className="text-[17px] sm:text-[19px] font-semibold leading-tight text-[#2C1A0E] truncate"
                style={headingFont}
              >
                {formattedDate}
              </h3>
            </div>
          </div>

          {/* Explicit Close Button (✕) aligned to top right */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#EDE8DF] bg-white text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FAF5EF] hover:text-[#2C1A0E] active:scale-95 font-bold text-sm leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-4 space-y-4 overflow-y-auto w-full box-border flex-1 pr-0.5">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E7DAC6] bg-white p-8 text-center w-full box-border">
              <Clock size={28} className="mx-auto text-[#C4A882] mb-2" />
              <p className="text-sm font-semibold text-[#2C1A0E]">
                No scheduled deliveries
              </p>
              <p className="text-xs text-[#8B7355] mt-1">
                No orders were recorded for this date.
              </p>
            </div>
          ) : (
            <div className="space-y-3 w-full box-border">
              {items.map((item, idx) => {
                const cfg = getCfg(item.status);
                const Icon = cfg.icon;
                const canCancel = canCancelPendingOneTimeOrder(item);
                const canTrack = isDeliveryOutForTracking(item?.status);
                const statusUpper = String(item?.status || "").toUpperCase();
                const isFailedOrMissed =
                  statusUpper === "FAILED" || statusUpper === "MISSED";

                const formattedQty = String(
                  item.qty || item.quantity || "-"
                )
                  .toLowerCase()
                  .includes("l")
                  ? item.qty || item.quantity
                  : `${item.qty || item.quantity || "-"} L`;
                const formattedProd = String(item.product || "Milk").replace(
                  /^(\d+)([a-zA-Z])/,
                  "$1 $2"
                );

                return (
                  <div
                    key={item.id ?? `${dateStr || 'item'}-${idx}`}
                    className="w-full box-border rounded-2xl border border-[#EDE8DF] bg-white p-4 space-y-3 shadow-xs"
                  >
                    {/* Card Header: Product/Qty & Status Badge */}
                    <div className="flex items-start justify-between gap-3 w-full box-border">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg}`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#2C1A0E] truncate">
                            {formattedQty} · {formattedProd}
                          </p>
                          <p className="text-xs text-[#8B7355] truncate">
                            {getDeliveryTypeLabel(item)} Order
                          </p>
                        </div>
                      </div>

                      {/* Status Badge with shrink-0 */}
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.badge}`}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    {/* Card Meta Info */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F2EDE4] text-xs text-[#6B5B3E] w-full box-border">
                      <div>
                        <span className="text-[10px] text-[#A88763] uppercase font-bold block">
                          Delivery Slot
                        </span>
                        <span className="font-semibold text-[#2C1A0E] truncate block">
                          {item.slot || "Morning Slot"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#A88763] uppercase font-bold block">
                          Payment Method
                        </span>
                        <span className="font-semibold text-[#2C1A0E] truncate block">
                          {item.paymentMethod || "UPI"}
                        </span>
                      </div>
                    </div>

                    {/* Contextual Actions & Report Issue / Get Help link */}
                    {(canCancel || canTrack || isFailedOrMissed) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F2EDE4] w-full box-border">
                        {isFailedOrMissed ? (
                          <button
                            type="button"
                            onClick={() => {
                              onClose?.();
                              if (onReportIssue) {
                                onReportIssue(item);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C0392B] hover:text-[#962D22] transition underline underline-offset-2"
                          >
                            <AlertCircle size={13} className="shrink-0" />
                            <span>Report Issue / Get Help</span>
                          </button>
                        ) : (
                          <div />
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose?.();
                                onCancelOrder?.(item);
                              }}
                              disabled={
                                String(cancellingOrderId) === String(item.id)
                              }
                              className="rounded-xl border border-[#F2D0C8] bg-[#FDECEA] px-3.5 py-1.5 text-xs font-bold text-[#C0392B] transition hover:bg-[#F8DDD6] disabled:opacity-50"
                            >
                              {String(cancellingOrderId) === String(item.id)
                                ? "Cancelling..."
                                : "Cancel Order"}
                            </button>
                          )}
                          {canTrack && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose?.();
                                onTrackAgent?.(item);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#EFD7B3] bg-[#FFF4E2] px-3.5 py-1.5 text-xs font-bold text-[#B8641A] transition hover:bg-[#FDE9C9]"
                            >
                              <Truck size={14} />
                              Track Agent
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
