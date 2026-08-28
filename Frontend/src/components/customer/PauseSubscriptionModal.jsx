import React, { useState } from "react";
import { Clock, X, Loader2, PauseCircle } from "lucide-react";
import { getTomorrowDateInput } from "../../utils/customerDashboard";

const headingFont = { fontFamily: "'Lora', serif" };

const formatDateLabel = (dateStr) => {
  if (!dateStr) return "";
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const addDaysToDate = (startDateStr, days) => {
  const parsed = new Date(`${startDateStr}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const PauseSubscriptionModal = ({
  isOpen,
  onClose,
  onConfirm,
  submitting = false,
}) => {
  const tomorrow = getTomorrowDateInput();
  const [durationType, setDurationType] = useState("2_DAYS");
  const [customStartDate, setCustomStartDate] = useState(tomorrow);
  const [customEndDate, setCustomEndDate] = useState(addDaysToDate(tomorrow, 7));

  if (!isOpen) return null;

  let resolvedStartDate = tomorrow;
  let resolvedEndDate = "";

  if (durationType === "2_DAYS") {
    resolvedStartDate = tomorrow;
    resolvedEndDate = addDaysToDate(tomorrow, 1);
  } else if (durationType === "1_WEEK") {
    resolvedStartDate = tomorrow;
    resolvedEndDate = addDaysToDate(tomorrow, 6);
  } else if (durationType === "CUSTOM_RANGE") {
    resolvedStartDate = customStartDate || tomorrow;
    resolvedEndDate = customEndDate || addDaysToDate(tomorrow, 7);
  } else if (durationType === "INDEFINITE") {
    resolvedStartDate = tomorrow;
    resolvedEndDate = "";
  }

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;

    onConfirm({
      action: "PAUSE",
      durationType,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(20,10,4,0.58)] p-0 backdrop-blur-xs sm:items-center sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg overflow-hidden rounded-t-[28px] border border-[#EDE8DF] bg-[#FFFDF7] shadow-[0_28px_80px_rgba(44,26,14,0.22)] animate-in fade-in zoom-in-95 duration-200 ease-out sm:rounded-[28px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F2EDE4] bg-[#FBF7F0] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1E4] text-[#C86D27]">
              <PauseCircle size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                Daily Deliveries
              </p>
              <h3 className="text-[20px] font-semibold leading-tight text-[#2C1A0E]" style={headingFont}>
                Pause Subscription
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full border border-[#EDE8DF] bg-white p-2 text-[#8B7355] transition hover:border-[#D4B896] hover:bg-[#FAF5EF] hover:text-[#2C1A0E] disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#A88763]">
              Pause Duration
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: "2_DAYS", label: "Next 2 Days", sub: "2 days pause" },
                { id: "1_WEEK", label: "For 1 Week", sub: "7 days pause" },
                { id: "CUSTOM_RANGE", label: "Custom Dates", sub: "Select range" },
                { id: "INDEFINITE", label: "Indefinite", sub: "Until resumed" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDurationType(opt.id)}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                    durationType === opt.id
                      ? "border-[#B8641A] bg-[#FFF4E2] ring-2 ring-[#B8641A]/10 shadow-xs"
                      : "border-[#EDE8DF] bg-white text-[#524134] hover:border-[#D4B896] hover:bg-[#FAF5EF]"
                  }`}
                >
                  <span className={`text-xs sm:text-sm font-bold ${durationType === opt.id ? "text-[#B8641A]" : "text-[#2C1A0E]"}`}>
                    {opt.label}
                  </span>
                  <span className="mt-0.5 text-[10px] text-[#8B7355] font-medium">
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          {durationType === "CUSTOM_RANGE" && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[#EDE8DF] bg-[#FAF5EF] p-3.5">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8B7355]">
                  Start Date
                </label>
                <input
                  type="date"
                  min={tomorrow}
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full rounded-lg border border-[#EDE8DF] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#2C1A0E] focus:border-[#B8641A] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8B7355]">
                  End Date
                </label>
                <input
                  type="date"
                  min={customStartDate || tomorrow}
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full rounded-lg border border-[#EDE8DF] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#2C1A0E] focus:border-[#B8641A] focus:outline-none"
                  required
                />
              </div>
            </div>
          )}

          {/* Summary Banner */}
          <div className="rounded-2xl border border-[#F0D1B2] bg-[#FFF1E4]/70 p-3.5 flex items-start gap-3">
            <Clock size={18} className="text-[#C86D27] shrink-0 mt-0.5" />
            <div className="text-xs text-[#524134]">
              <p className="font-bold text-[#2C1A0E]">
                {durationType === "INDEFINITE"
                  ? "Deliveries paused starting tomorrow until manually resumed."
                  : `Paused from ${formatDateLabel(resolvedStartDate)} to ${formatDateLabel(resolvedEndDate)}.`}
              </p>
              <p className="mt-0.5 text-[11px] text-[#7C6A5A]">
                No milk will be delivered or billed during this period.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-[#EDE8DF] bg-white py-3 text-xs font-bold text-[#7C6A5A] transition hover:bg-[#FAF5EF] hover:text-[#2C1A0E] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#C86D27] py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#B8641A] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Pausing...</span>
                </>
              ) : (
                <span>Confirm Pause</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PauseSubscriptionModal;
