import { useEffect, useState } from "react";
import {
  fetchAdminCustomerById,
  updateAdminCustomer,
  deleteAdminCustomer,
} from "../../api/admin.api";
import LoadingIndicator from "../common/LoadingIndicator.jsx";

export default function CustomerDrawer({ customerId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    phone_number: "",
    email: "",
    building_name: "",
    wing: "",
    room_no: "",
  });

  useEffect(() => {
    if (!customerId) return;

    fetchAdminCustomerById(customerId).then((res) => {
      setData(res);
      const c = res?.customer || {};
      setForm({
        customer_name: c.customer_name || "",
        phone_number: c.phone_number || "",
        email: c.email || "",
        building_name: c.building_name || "",
        wing: c.wing || "",
        room_no: c.room_no || "",
      });
      setIsEditing(false);
    });
  }, [customerId]);

  if (!customerId) return null;

  const customer = data?.customer;

  const onInput = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await updateAdminCustomer(customerId, form);
      setData((prev) => ({ ...prev, customer: res.customer }));
      setIsEditing(false);
      if (onChanged) onChanged();
    } catch (err) {
      alert("Failed to update customer");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm("Delete this customer? This cannot be undone.");
    if (!ok) return;

    try {
      setIsDeleting(true);
      await deleteAdminCustomer(customerId);
      if (onChanged) onChanged();
      onClose();
    } catch (err) {
      alert("Failed to delete customer");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Customer Details</h2>
              <p className="text-sm text-gray-500">Profile and membership overview</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-9 w-9 rounded-full border border-red-100 text-red-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
            >
              X
            </button>
          </div>

          {!data ? (
            <LoadingIndicator className="p-6" message="Loading customer details..." />
          ) : (
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide">Customer</h3>
                  {isEditing ? (
                    <div className="mt-3 space-y-4">
                      <div>
                        <label className="text-xs text-gray-500">Full Name</label>
                        <input
                          name="customer_name"
                          value={form.customer_name}
                          onChange={onInput}
                          placeholder="Full name"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Phone</label>
                        <input
                          name="phone_number"
                          value={form.phone_number}
                          onChange={onInput}
                          placeholder="Phone"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Email</label>
                        <input
                          name="email"
                          value={form.email}
                          onChange={onInput}
                          placeholder="Email"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">Full Name</p>
                        <p className="font-medium">{customer?.customer_name || "Unnamed"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm text-gray-700">{customer?.phone_number || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm text-gray-700">{customer?.email || "-"}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide">Address</h3>
                  {isEditing ? (
                    <div className="mt-3 space-y-4">
                      <div>
                        <label className="text-xs text-gray-500">Building</label>
                        <input
                          name="building_name"
                          value={form.building_name}
                          onChange={onInput}
                          placeholder="Building"
                          className="w-full border-b border-gray-200 p-2 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500">Wing</label>
                          <input
                            name="wing"
                            value={form.wing}
                            onChange={onInput}
                            placeholder="Wing"
                            className="w-full border-b border-gray-200 p-2 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Room</label>
                          <input
                            name="room_no"
                            value={form.room_no}
                            onChange={onInput}
                            placeholder="Room"
                            className="w-full border-b border-gray-200 p-2 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">Building</p>
                        <p className="font-medium">{customer?.building_name || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Wing / Room</p>
                        <p className="text-sm text-gray-700">
                          {customer?.wing || "-"} {customer?.room_no || ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide">Membership</h3>
                  {data.membership ? (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">Active Since</p>
                      <p className="text-sm">
                        {new Date(data.membership.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-400">No membership</p>
                  )}
                </div>

                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide">Dairy</h3>
                  {data.dairy ? (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">Name</p>
                      <p className="font-medium">{data.dairy.name}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-400">Not linked</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="p-4 border-t bg-gray-50/60 flex items-center justify-between">
            <div className="text-xs text-gray-500">ID: {customer?.id}</div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-2 text-sm border rounded-lg hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-2 text-sm border rounded-lg hover:bg-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Removing..." : "Remove"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
