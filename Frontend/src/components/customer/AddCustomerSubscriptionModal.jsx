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
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
          <div className="px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Setup Customer Subscription</h2>
              <p className="text-sm text-gray-500">
                {customer.customer_name || customer.customerName || "Customer"} - linked to your dairy
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="h-9 w-9 rounded-full border border-red-100 text-red-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={submit} className="p-6 space-y-4">
            {error && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-lg">{error}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Milk Type</label>
              <select
                name="milkType"
                value={form.milkType}
                onChange={onInput}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option>Buffalo Milk</option>
                <option>Cow Milk</option>
                <option>Full Cream</option>
                <option>Toned</option>
                <option>Double Toned</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (Liters)</label>
                <div className="relative">
                  <Droplets size={16} className="absolute left-3 top-3 text-blue-500" />
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    name="quantity"
                    value={form.quantity}
                    onChange={onInput}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Slot</label>
                <div className="relative">
                  <Clock3 size={16} className="absolute left-3 top-3 text-gray-500" />
                  <select
                    name="slot"
                    value={form.slot}
                    onChange={onInput}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
                  >
                    <option>Morning</option>
                    <option>Evening</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={onInput}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address (Optional)</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={onInput}
                placeholder="Building, wing, room, landmark"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  name="paymentMethod"
                  value={form.paymentMethod}
                  onChange={onInput}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option>UPI</option>
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={onInput}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
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
