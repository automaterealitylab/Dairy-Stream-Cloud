import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cancelAdminCustomerSubscription } from "../../api/admin.api";
import { adminHeadingFont, adminShellFont, useTheme } from "../admin/adminTheme";

export default function CancelSubscriptionModal({ customerId, customerName, onClose, onSuccess }) {
  const { isDark } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await cancelAdminCustomerSubscription(customerId, {
        cancelReason,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to cancel subscription");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200" style={adminShellFont}>
      <div className={`w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl transition-all ${
        isDark ? "border-slate-800 bg-[#0F172A] text-white" : "border-[#EDE8DF] bg-white text-[#2C1A0E]"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-6 py-4 ${
          isDark ? "border-slate-800 bg-red-950/20" : "border-red-100 bg-red-50/50"
        }`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-red-600 dark:text-red-400" style={adminHeadingFont}>Cancel Subscription</h3>
              <p className="text-xs text-stone-500 dark:text-slate-400">{customerName || `Customer #${customerId}`}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          <p className="text-xs font-semibold text-stone-600 dark:text-slate-300">
            Are you sure you want to cancel the recurring subscription for this customer? Future scheduled deliveries will be stopped.
          </p>

          <div>
            <label className="text-xs font-semibold text-stone-600 dark:text-slate-300 block mb-1">
              Reason for Cancellation (Optional)
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Customer relocating, requested service termination via phone call"
              className={`w-full rounded-xl border p-3 text-sm outline-none transition ${
                isDark
                  ? "border-slate-700 bg-slate-900 text-white focus:border-red-500"
                  : "border-stone-200 bg-stone-50 text-stone-900 focus:border-red-500"
              }`}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Go Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/25 hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Cancelling..." : "Confirm Cancellation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
