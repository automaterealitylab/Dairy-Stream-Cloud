import { useState } from "react";
import { Milk, PlusCircle, X } from "lucide-react";
import { addAdminCustomerExtraDelivery } from "../../api/admin.api";
import { adminHeadingFont, adminShellFont, useTheme } from "../admin/adminTheme";

export default function AddExtraDeliveryModal({ customerId, customerName, onClose, onSuccess }) {
  const { isDark } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [deliveryDate, setDeliveryDate] = useState(tomorrow);
  const [milkType, setMilkType] = useState("Buffalo Milk");
  const [quantityLiters, setQuantityLiters] = useState("1");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await addAdminCustomerExtraDelivery(customerId, {
        deliveryDate,
        milkType,
        quantityLiters: Number(quantityLiters),
        notes,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to add extra order");
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
          isDark ? "border-slate-800 bg-emerald-950/20" : "border-emerald-100 bg-emerald-50/50"
        }`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-700 dark:text-emerald-300" style={adminHeadingFont}>Add One-Off Extra Order</h3>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-stone-600 dark:text-slate-300 block mb-1">
              Delivery Date
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              required
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                isDark
                  ? "border-slate-700 bg-slate-900 text-white focus:border-emerald-500"
                  : "border-stone-200 bg-stone-50 text-stone-900 focus:border-emerald-500"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-600 dark:text-slate-300 block mb-1">
                Item / Product Type
              </label>
              <select
                value={milkType}
                onChange={(e) => setMilkType(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-white focus:border-emerald-500"
                    : "border-stone-200 bg-stone-50 text-stone-900 focus:border-emerald-500"
                }`}
              >
                <option value="Buffalo Milk">Buffalo Milk</option>
                <option value="Cow Milk">Cow Milk</option>
                <option value="Paneer 500g">Paneer 500g</option>
                <option value="Ghee 500g">Ghee 500g</option>
                <option value="Curd 1kg">Curd 1kg</option>
                <option value="Custom Product">Custom Product</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 dark:text-slate-300 block mb-1">
                Quantity / Liters
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={quantityLiters}
                onChange={(e) => setQuantityLiters(e.target.value)}
                required
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-white focus:border-emerald-500"
                    : "border-stone-200 bg-stone-50 text-stone-900 focus:border-emerald-500"
                }`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600 dark:text-slate-300 block mb-1">
              Instructions for Delivery Agent (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Requested 1L extra over phone call"
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                isDark
                  ? "border-slate-700 bg-slate-900 text-white focus:border-emerald-500"
                  : "border-stone-200 bg-stone-50 text-stone-900 focus:border-emerald-500"
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add Extra Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
