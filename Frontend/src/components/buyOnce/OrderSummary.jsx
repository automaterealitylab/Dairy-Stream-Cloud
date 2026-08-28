import React from "react";
import { Clock3, CreditCard, MapPin } from "lucide-react";

export const OrderSummary = ({
  selectedItems,
  totalPrice,
  form,
  setForm,
  handleSubmit,
  submitting,
  hasSubscriptionForThisDairy,
  isCustomerExtraFlow,
  hasAvailableSlot,
  invalidStockItem,
  dairy,
  nextAvailableDate,
}) => (
  <div id="order-summary-section" className="lg:w-[380px] space-y-6 scroll-mt-24">
    <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl sticky top-24">
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
        <CreditCard size={20} className="text-blue-400" /> Order Summary
      </h3>

      <div className="space-y-4 border-b border-slate-800 pb-6 mb-6">
        {selectedItems.length > 0 ? (
          selectedItems.map((item) => (
            <div key={item.name} className="flex justify-between text-sm">
              <span className="text-slate-400">{item.name} x {item.quantity}L</span>
              <span className="font-bold">Rs {(item.quantity * item.ratePerUnit).toFixed(2)}</span>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-400">No products selected yet.</div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Delivery Fee</span>
          <span className="text-green-400 font-bold uppercase text-[10px] bg-green-400/10 px-2 py-1 rounded">Free</span>
        </div>
      </div>

      <div className="flex justify-between items-end mb-8">
        <span className="text-slate-400 text-sm">Grand Total</span>
        <span className="text-3xl font-black">Rs {totalPrice.toFixed(2)}</span>
      </div>

      <div className="space-y-3 mb-8">
        <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Method</label>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
          <p className="text-sm font-bold text-white">Online payment required</p>
          <p className="mt-1 text-xs text-slate-300">
            One-time deliveries are confirmed only after successful payment.
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-8">
        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
          <MapPin size={10} /> Delivery Address
        </label>
        <textarea
          rows={2} value={form.address}
          onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          placeholder="Street, Landmark, City..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-all"
        />
      </div>

      <button
        onClick={() => handleSubmit(false)}
        disabled={submitting || (hasSubscriptionForThisDairy && !isCustomerExtraFlow) || !hasAvailableSlot || !selectedItems.length || Boolean(invalidStockItem) || dairy.productItems.length === 0}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98] disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
      >
        {submitting
          ? "Processing..."
          : hasSubscriptionForThisDairy && !isCustomerExtraFlow
          ? "Unavailable For Active Subscribers"
          : isCustomerExtraFlow
          ? "Pay & Add Extra"
          : "Pay & Place Order"}
      </button>
      {(invalidStockItem || !selectedItems.length) && (
        <p className="mt-2 text-xs text-red-400 font-medium">
          {invalidStockItem
            ? `${invalidStockItem.name} quantity is more than available stock`
            : "Select at least one product"}
        </p>
      )}
    </div>

    {!hasAvailableSlot && nextAvailableDate && (
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3">
        <Clock3 className="text-amber-600 shrink-0" size={18} />
        <p className="text-[11px] text-amber-800 font-medium">
          Cut-off reached for today. Next slot opens on <span className="font-bold">{nextAvailableDate}</span>.
        </p>
      </div>
    )}
  </div>
);
