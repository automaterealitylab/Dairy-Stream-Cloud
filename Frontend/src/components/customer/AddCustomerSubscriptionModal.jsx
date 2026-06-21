import { useEffect, useState } from "react";
import { Calendar, Clock3, Droplets, X } from "lucide-react";
import { createAdminCustomerSubscription } from "../../api/admin.api";

const initialForm = {
  milkType: "Buffalo Milk",
  quantity: 1,
  slot: "Morning",
  startDate: new Date().toISOString().slice(0, 10),
  address: "",
  paymentMethod: "UPI",
  status: "ACTIVE",
};

export default function AddCustomerSubscriptionModal({
  open,
  customer,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !customer) return;

    const addressParts = [
      customer.building_name || customer.buildingName || "",
      customer.wing || "",
      customer.room_no || customer.roomNo || "",
    ].filter(Boolean);

    setForm({
      ...initialForm,
      address: addressParts.join(", "),
    });
    setError("");
    setSaving(false);
  }, [open, customer]);

  if (!open || !customer) return null;

  const onInput = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const closeModal = () => {
    setForm(initialForm);
    setSaving(false);
    setError("");
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createAdminCustomerSubscription(customer.id, {
        ...form,
        quantity: Number(form.quantity),
      });
      alert("Subscription saved successfully.");
      if (onSaved) onSaved();
      closeModal();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save subscription");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={closeModal} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:border dark:border-[#1E293B] dark:bg-[#121829] dark:text-white dark:ring-white/10">
          <div className="flex items-center justify-between border-b bg-gradient-to-r from-gray-50 to-white px-6 py-4 dark:border-[#1E293B] dark:from-[#161C2C] dark:to-[#121829]">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Setup Customer Subscription</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {customer.customer_name || customer.customerName || "Customer"} - linked to your dairy
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 text-red-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-[#222B40] dark:bg-[#0B0F19] dark:text-red-400 dark:hover:border-red-500/40 dark:hover:bg-red-500/10"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4 p-6">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</div>}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Milk Type</label>
              <select
                name="milkType"
                value={form.milkType}
                onChange={onInput}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:focus:ring-blue-500/20"
              >
                <option>Buffalo Milk</option>
                <option>Cow Milk</option>
                <option>Full Cream</option>
                <option>Toned</option>
                <option>Double Toned</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Quantity (Liters)</label>
                <div className="relative">
                  <Droplets size={16} className="absolute left-3 top-3 text-blue-500" />
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    name="quantity"
                    value={form.quantity}
                    onChange={onInput}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 outline-none focus:ring-2 focus:ring-blue-100 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:focus:ring-blue-500/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Delivery Slot</label>
                <div className="relative">
                  <Clock3 size={16} className="absolute left-3 top-3 text-gray-500 dark:text-slate-500" />
                  <select
                    name="slot"
                    value={form.slot}
                    onChange={onInput}
                    className="w-full appearance-none rounded-lg border border-gray-300 py-2 pl-9 pr-3 outline-none focus:ring-2 focus:ring-blue-100 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:focus:ring-blue-500/20"
                  >
                    <option>Morning</option>
                    <option>Evening</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Start Date</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-3 text-gray-500 dark:text-slate-500" />
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={onInput}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 outline-none focus:ring-2 focus:ring-blue-100 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Address (Optional)</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={onInput}
                placeholder="Building, wing, room, landmark"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-blue-500/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Payment Method</label>
                <select
                  name="paymentMethod"
                  value={form.paymentMethod}
                  onChange={onInput}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:focus:ring-blue-500/20"
                >
                  <option>UPI</option>
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={onInput}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:focus:ring-blue-500/20"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-2 dark:border-[#1E293B]">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-[#222B40] dark:bg-[#161C2C] dark:text-slate-300 dark:hover:bg-[#1C243A] dark:hover:text-white"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Subscription"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
