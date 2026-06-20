import { useEffect, useState } from "react";
import { Calendar, Droplets, Milk, Phone, Store, User2, X } from "lucide-react";
import {
  fetchAdminCustomerById,
  updateAdminCustomer,
  deleteAdminCustomer,
} from "../../api/admin.api";
import LoadingIndicator from "../common/LoadingIndicator.jsx";
import { adminHeadingFont, adminShellFont, useTheme } from "../admin/adminTheme";

const DetailItem = ({ label, value }) => (
  <div className="space-y-1">
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B89970] dark:text-[#C4A882]">{label}</p>
    <p className="break-words overflow-hidden text-sm font-semibold text-[#2C1A0E] dark:text-white sm:text-[15px]">{value || "-"}</p>
  </div>
);

const StatusPill = ({ children, tone = "neutral" }) => {
  const toneClass =
    tone === "success"
      ? "border-[#D7E8C8] bg-[#EEF6E7] text-[#4A7C2F] dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "warning"
        ? "border-[#F3D6A2] bg-[#FFF5E6] text-[#B8641A] dark:border-[#d97706]/30 dark:bg-[#d97706]/10 dark:text-[#fbbf24]"
        : "border-[#E7DAC6] bg-[#F8F3EC] text-[#6B5B3E] dark:border-[#222B40] dark:bg-[#161C2C] dark:text-slate-300";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${toneClass}`}>
      {children}
    </span>
  );
};

export default function CustomerDrawer({ customerId, onClose, onChanged }) {
  const { isDark } = useTheme();
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

  const customer = data?.customer || {};
  const subscription = data?.subscription || null;
  const dairy = data?.dairy || null;
  const assignedAgent = data?.assignedAgent || null;
  const dairyName = dairy?.dairy_name || dairy?.name || (subscription?.dairy_id ? `Dairy #${subscription.dairy_id}` : "Not linked");

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

  const deliveryDaysLabel = Array.isArray(subscription?.delivery_days)
    ? subscription.delivery_days.join(", ")
    : subscription?.delivery_days || "-";

  const subscriptionTone =
    String(subscription?.status || "").toUpperCase() === "ACTIVE" ? "success" : "warning";
  const approvalTone =
    String(subscription?.approval_status || "").toUpperCase() === "APPROVED" ? "success" : "warning";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[rgba(44,26,14,0.45)] backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4" style={adminShellFont}>
        <div className="flex min-h-full items-start justify-center sm:items-center">
          <div className="flex w-full max-w-4xl max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[24px] sm:rounded-[32px] border border-[#E7DAC6] bg-[#FFFDF8] shadow-[0_28px_70px_rgba(44,26,14,0.28)] dark:border-[#1E293B] dark:bg-[#121829] dark:shadow-[0_28px_70px_rgba(0,0,0,0.45)]">
          <div className="shrink-0 bg-gradient-to-r from-[#3E2B18] via-[#5B3E24] to-[#8A6A46] px-5 py-4 text-white sm:px-8 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F3D4A6]">
                  Customer Profile
                </p>
                <h2 className="mt-2 text-2xl text-white sm:text-[30px]" style={adminHeadingFont}>
                  Customer Details
                </h2>
                <p className="mt-1 text-sm text-white/75">
                  Personal info, address, dairy link, and subscription overview.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {!data ? (
            <LoadingIndicator className="p-6 sm:p-8" message="Loading customer details..." />
          ) : (
            <div className="min-h-0 overflow-y-auto">
            <div className="space-y-5 p-4 sm:space-y-6 sm:p-8">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <section
                  className="rounded-[28px] border p-5 shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:shadow-none sm:p-6"
                  style={{
                    background: isDark ? "#161C2C" : "#ffffff",
                    borderColor: isDark ? "#222B40" : "#EDE8DF",
                  }}
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970] dark:text-[#C4A882]">
                        Customer
                      </p>
                      <h3 className="mt-2 text-xl font-bold text-[#2C1A0E] dark:text-white">
                        {customer.customer_name || "Unnamed Customer"}
                      </h3>
                    </div>
                    <div className="rounded-[18px] bg-[#FFF5E6] p-3 text-[#B8641A] dark:bg-[#d97706]/15 dark:text-[#fbbf24]">
                      <User2 size={20} />
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="space-y-2 sm:col-span-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A88763]">Full Name</span>
                        <input name="customer_name" value={form.customer_name} onChange={onInput} className="w-full rounded-[16px] border border-[#EDE8DF] bg-[#FAF7F1] px-4 py-3 font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A] focus:bg-white" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A88763]">Phone</span>
                        <input name="phone_number" value={form.phone_number} onChange={onInput} className="w-full rounded-[16px] border border-[#EDE8DF] bg-[#FAF7F1] px-4 py-3 font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A] focus:bg-white" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A88763]">Email</span>
                        <input name="email" value={form.email} onChange={onInput} className="w-full rounded-[16px] border border-[#EDE8DF] bg-[#FAF7F1] px-4 py-3 font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A] focus:bg-white" />
                      </label>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <DetailItem label="Phone" value={customer.phone_number} />
                      <DetailItem label="Email" value={customer.email} />
                      <DetailItem label="Building" value={customer.building_name} />
                      <DetailItem label="Wing / Room" value={[customer.wing, customer.room_no].filter(Boolean).join(" / ")} />
                    </div>
                  )}
                </section>

                <section className="rounded-[28px] border border-[#EDE8DF] bg-[#FFF8F0] p-5 shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:border-[#222B40] dark:bg-[#161C2C] dark:shadow-none sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970] dark:text-[#C4A882]">
                        Dairy Link
                      </p>
                      <h3 className="mt-2 text-xl font-bold text-[#2C1A0E] dark:text-white">
                        {dairyName}
                      </h3>
                    </div>
                    <div className="rounded-[18px] bg-white p-3 text-[#B8641A] dark:bg-[#0B0F19] dark:text-[#fbbf24]">
                      <Store size={20} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <DetailItem label="Customer ID" value={customer.id ? `#${customer.id}` : "-"} />
                    <DetailItem label="Assigned Agent" value={assignedAgent?.agent_name || "Not assigned"} />
                    <DetailItem label="Agent Phone" value={assignedAgent?.phone_number || "-"} />
                  </div>
                </section>
              </div>

              <section className="rounded-[30px] border border-[#E7DAC6] bg-gradient-to-br from-[#FFFDF8] via-[#FFF8F0] to-[#FDF3E4] p-6 shadow-[0_22px_50px_rgba(92,61,30,0.09)] dark:border-[#222B40] dark:from-[#161C2C] dark:via-[#161C2C] dark:to-[#0B0F19] dark:shadow-none">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970] dark:text-[#C4A882]">
                      Subscription Details
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-[#2C1A0E] dark:text-white">
                      {subscription ? "Active Customer Plan" : "No subscription found"}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone={subscription ? subscriptionTone : "neutral"}>
                      {subscription?.status || "Not Active"}
                    </StatusPill>
                    <StatusPill tone={subscription ? approvalTone : "neutral"}>
                      {subscription?.approval_status || "No Approval"}
                    </StatusPill>
                  </div>
                </div>

                {subscription ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[22px] border border-[#E7DAC6] bg-white/90 p-4 dark:border-[#222B40] dark:bg-[#0B0F19]">
                      <div className="mb-3 flex items-center gap-2 text-[#B8641A] dark:text-[#fbbf24]">
                        <Milk size={16} />
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Plan</span>
                      </div>
                      <p className="text-base font-bold text-[#2C1A0E] dark:text-white">{subscription.milk_type || "Milk Plan"}</p>
                      <p className="mt-1 text-sm text-[#7A644A] dark:text-slate-400">{subscription.quantity_liters || 0} litre(s)</p>
                    </div>

                    <div className="rounded-[22px] border border-[#E7DAC6] bg-white/90 p-4 dark:border-[#222B40] dark:bg-[#0B0F19]">
                      <div className="mb-3 flex items-center gap-2 text-[#B8641A] dark:text-[#fbbf24]">
                        <Calendar size={16} />
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Schedule</span>
                      </div>
                      <p className="text-base font-bold text-[#2C1A0E] dark:text-white">{subscription.delivery_slot || "-"}</p>
                      <p className="mt-1 text-sm text-[#7A644A] dark:text-slate-400">Starts {subscription.start_date ? new Date(subscription.start_date).toLocaleDateString("en-GB") : "-"}</p>
                    </div>

                    <div className="rounded-[22px] border border-[#E7DAC6] bg-white/90 p-4 dark:border-[#222B40] dark:bg-[#0B0F19]">
                      <div className="mb-3 flex items-center gap-2 text-[#B8641A] dark:text-[#fbbf24]">
                        <Droplets size={16} />
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Delivery Days</span>
                      </div>
                      <p className="text-base font-bold text-[#2C1A0E] dark:text-white">{deliveryDaysLabel}</p>
                      <p className="mt-1 text-sm text-[#7A644A] dark:text-slate-400">Payment: {subscription.payment_method || "-"}</p>
                    </div>

                    <div className="rounded-[22px] border border-[#E7DAC6] bg-white/90 p-4 dark:border-[#222B40] dark:bg-[#0B0F19]">
                      <div className="mb-3 flex items-center gap-2 text-[#B8641A] dark:text-[#fbbf24]">
                        <Phone size={16} />
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Service</span>
                      </div>
                      <p className="break-words text-base font-bold text-[#2C1A0E] dark:text-white">{dairyName}</p>
                      <p className="mt-1 text-sm text-[#7A644A] dark:text-slate-400">{assignedAgent?.agent_name || "Agent not assigned"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[#D8C8B3] bg-white/80 p-5 text-sm font-semibold text-[#8B7355] dark:border-[#222B40] dark:bg-[#0B0F19] dark:text-slate-300">
                    This customer does not have an active subscription yet. Once a plan is created, the milk type, quantity, slot, payment method, and assigned agent will appear here.
                  </div>
                )}
              </section>

              {isEditing && (
                <section className="rounded-[28px] border border-[#EDE8DF] bg-white p-5 shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:border-[#222B40] dark:bg-[#161C2C] dark:shadow-none sm:p-6">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970] dark:text-[#C4A882]">
                    Address Editor
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <label className="space-y-2 sm:col-span-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A88763]">Building</span>
                      <input name="building_name" value={form.building_name} onChange={onInput} className="w-full rounded-[16px] border border-[#EDE8DF] bg-[#FAF7F1] px-4 py-3 font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A] focus:bg-white" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A88763]">Wing</span>
                      <input name="wing" value={form.wing} onChange={onInput} className="w-full rounded-[16px] border border-[#EDE8DF] bg-[#FAF7F1] px-4 py-3 font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A] focus:bg-white" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A88763]">Room</span>
                      <input name="room_no" value={form.room_no} onChange={onInput} className="w-full rounded-[16px] border border-[#EDE8DF] bg-[#FAF7F1] px-4 py-3 font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A] focus:bg-white" />
                    </label>
                  </div>
                </section>
              )}
            </div>
            </div>
          )}

          <div className="shrink-0 flex flex-col gap-3 border-t border-[#E7DAC6] bg-[#FFF8F0] px-4 py-4 dark:border-[#1E293B] dark:bg-[#0B0F19] sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#A88763] dark:text-[#C4A882]">
              Customer ID: {customer.id || "-"}
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-[14px] border border-[#E7DAC6] bg-white px-4 py-2.5 text-sm font-bold text-[#8B7355] transition hover:bg-[#FDF6EC] dark:border-[#222B40] dark:bg-[#161C2C] dark:text-slate-300 dark:hover:bg-[#1C243A] dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-[14px] bg-[#B8641A] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#9F5414] disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-[14px] border border-[#E7DAC6] bg-white px-4 py-2.5 text-sm font-bold text-[#5C3D1E] transition hover:bg-[#FDF6EC] dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white dark:hover:bg-[#1C243A]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded-[14px] bg-[#D64545] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#BA3737] disabled:opacity-60"
                  >
                    {isDeleting ? "Removing..." : "Remove"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
