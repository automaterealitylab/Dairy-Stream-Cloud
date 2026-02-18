import { useEffect, useState } from "react";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import { useCustomerDashboard } from "../../hooks/useCustomerDashboard";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import { fetchCustomerDashboard, saveCustomerSubscription } from "../../api/customer.api.js";

import {
  CheckCircle,
  AlertCircle,
  Calendar,
  Plus,
  PauseCircle,
  Banknote,
  ChevronRight,
  Droplets,
  Loader2,
  X,
} from "lucide-react";

const CustomerDashboard = () => {
  const { data, loading, error } = useCustomerDashboard();
  const [dashboardData, setDashboardData] = useState(null);
  const [showEditTomorrowModal, setShowEditTomorrowModal] = useState(false);
  const [savingTomorrow, setSavingTomorrow] = useState(false);
  const [actionError, setActionError] = useState("");
  const [editTomorrowForm, setEditTomorrowForm] = useState({
    quantity: "1",
    slot: "Morning",
  });

  useEffect(() => {
    if (data) setDashboardData(data);
  }, [data]);

  if (loading) {
    return (
      <CustomerLayout>
        <LoadingIndicator className="py-20" message="Loading your dashboard..." />
      </CustomerLayout>
    );
  }

  if (error) {
    return (
      <CustomerLayout>
        <div className="py-20 text-center text-red-500">{error}</div>
      </CustomerLayout>
    );
  }

  /* ---------- DATA FROM BACKEND ---------- */
  const resolvedData = dashboardData || data;
  const { customer, todayDelivery, tomorrowDelivery, billing, subscription } = resolvedData;

  const openTomorrowEdit = () => {
    if (!subscription?.dairyId) {
      setActionError("No active subscription found to edit tomorrow delivery.");
      return;
    }

    const numericQty = Number(subscription.quantity || 1);
    setEditTomorrowForm({
      quantity: Number.isFinite(numericQty) && numericQty > 0 ? String(numericQty) : "1",
      slot: subscription.slot || "Morning",
    });
    setActionError("");
    setShowEditTomorrowModal(true);
  };

  const saveTomorrowDelivery = async () => {
    try {
      setSavingTomorrow(true);
      setActionError("");

      const storedUser = localStorage.getItem("user");
      const token = storedUser ? JSON.parse(storedUser)?.token : localStorage.getItem("token");
      if (!token) throw new Error("Customer token missing");

      await saveCustomerSubscription(token, {
        dairyId: subscription.dairyId,
        milkType: subscription.milkType || "Milk",
        quantity: Number(editTomorrowForm.quantity || 1),
        slot: editTomorrowForm.slot,
        startDate: subscription.startDate || undefined,
        address: subscription.address || "",
        paymentMethod: subscription.paymentMethod || "UPI",
        status: subscription.status || "ACTIVE",
      });

      const freshDashboard = await fetchCustomerDashboard(token, { force: true });
      setDashboardData(freshDashboard);
      setShowEditTomorrowModal(false);
    } catch (err) {
      setActionError(err?.message || "Failed to update tomorrow delivery.");
    } finally {
      setSavingTomorrow(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="space-y-4 md:space-y-6 px-2 sm:px-4">

        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
              Good Morning, {customer.name || "Customer"} 👋
            </h2>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-text-secondary">Member of</span>
              <span className="text-sm font-semibold text-brand bg-brand-soft px-2 py-0.5 rounded-lg border border-border">
                {customer.dairy}
              </span>
            </div>
          </div>
        </header>

        {/* ================= TODAY STATUS ================= */}
        <TodayStatusCard data={todayDelivery} />

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <QuickAction icon={Plus} label="Add Extra" color="brand"  to="/customer/dashboard/subscriptions" />
          <QuickAction icon={PauseCircle} label="Pause" color="warning"  to="/customer/dashboard/subscriptions" />
          <QuickAction icon={Calendar} label="Deliveries" color="brand" to="/customer/dashboard/deliveries" />
          <QuickAction icon={Banknote} label="Pay Bill" color="success"  to="/customer/dashboard/payments" />
        </div>

        {/* TOMORROW + BILLING */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <TomorrowDeliveryCard
            data={tomorrowDelivery}
            onEdit={openTomorrowEdit}
          />
          <BillingSummaryCard data={billing} />
        </div>

        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {actionError}
          </div>
        )}

        {showEditTomorrowModal && (
          <EditTomorrowModal
            form={editTomorrowForm}
            saving={savingTomorrow}
            onClose={() => setShowEditTomorrowModal(false)}
            onChange={(next) => setEditTomorrowForm((prev) => ({ ...prev, ...next }))}
            onSave={saveTomorrowDelivery}
          />
        )}
      </div>
    </CustomerLayout>
  );
};

/* TODAY CARD */
const TodayStatusCard = ({ data = {} }) => {
  const isDelivered = data.status === "DELIVERED";
  const isPending = data.status === "PENDING";
  const isNotScheduled =
    data.status === "NOT_SCHEDULED" || data.status === "NOT_SUBSCRIBED";
  const title = isDelivered
    ? "Delivered Successfully"
    : isPending
      ? "Delivery Pending"
      : "No Delivery Scheduled Today";

  return (
    <div className={`p-4 md:p-6 rounded-card border ${
      isDelivered
        ? "bg-success-soft border-border"
        : isPending
          ? "bg-brand-soft border-border"
          : "bg-gray-50 border-border"
    }`}>
      <h3 className="text-xs sm:text-sm font-semibold text-text-muted uppercase mb-4">
        Today's Delivery
      </h3>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

        <div className="flex gap-4">
          <div className={`p-3 rounded-full ${
            isDelivered
              ? "bg-success text-white"
              : isPending
                ? "bg-brand text-white"
                : "bg-gray-300 text-gray-700"
          }`}>
            {isDelivered ? <CheckCircle size={22}/> : <AlertCircle size={22}/>}
          </div>

          <div>
            <h3 className="text-base md:text-lg font-bold text-text-primary">
              {title}
            </h3>

            <p className="text-sm text-text-secondary mt-1">
              {data.quantity || "-"} • {data.product || "-"}
            </p>

            {data?.agent?.name && (
              <p className="text-xs text-text-muted mt-2">
                Agent: {data.agent.name} ({data.agent.phone || "-"})
              </p>
            )}

            {isDelivered && (
              <p className="text-xs text-text-muted mt-2">
                Dropped at Doorstep • {data.time || "-"}
              </p>
            )}

            {isNotScheduled && (
              <p className="text-xs text-text-muted mt-2">
                A delivery will appear here when it is scheduled in backend.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 self-start">
          <button
            onClick={() => window.location.assign("/customer/dashboard/deliveries")}
            className="text-xs font-semibold text-brand border border-border px-3 py-1.5 rounded-lg"
          >
            Track Agent
          </button>
          <button className="text-xs font-semibold text-text-secondary underline">
            Report Issue
          </button>
        </div>

      </div>
    </div>
  );
};

/* TOMORROW */
const TomorrowDeliveryCard = ({ data = {}, onEdit }) => (
  <div className="bg-surface border border-border rounded-card shadow-card p-4 md:p-6">
    <h3 className="text-xs sm:text-sm font-semibold text-text-muted uppercase mb-4">
      Tomorrow
    </h3>

    <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">

      <div className="bg-brand-soft p-3 rounded-xl text-brand">
        <Droplets size={22}/>
      </div>

      <div className="flex-1 min-w-[120px]">
        <h4 className="font-bold text-text-primary">
          {data.quantity || "-"} Milk
        </h4>
        <p className="text-sm text-text-secondary">{data.slot || "-"}</p>
      </div>

      <button
        onClick={onEdit}
        className="text-sm font-semibold text-brand border border-border px-3 py-1 rounded-lg"
      >
        Edit
      </button>

    </div>
  </div>
);

const EditTomorrowModal = ({ form, saving, onClose, onChange, onSave }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Edit Next Day Delivery</h3>
        <button onClick={onClose} className="rounded-lg p-1 text-text-secondary hover:bg-background">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Quantity (L)</label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={form.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Delivery Slot</label>
          <select
            value={form.slot}
            onChange={(e) => onChange({ slot: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary"
          >
            <option>Morning</option>
            <option>Evening</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  </div>
);

/* BILLING */
const BillingSummaryCard = ({ data = {} }) => (
  <div className="bg-surface border border-border rounded-card shadow-card p-4 md:p-6 flex flex-col justify-between">

    <div>
      <h3 className="text-xs sm:text-sm font-semibold text-text-muted uppercase mb-2">
        Billing Summary
      </h3>

      <div className="flex justify-between items-end">
        <div>
          <p className="text-2xl md:text-3xl font-bold text-text-primary">
            ₹{data.monthlyDue || 0}
          </p>
          <p className="text-xs text-red-500 font-medium mt-1">
            Due in {data.dueInDays || 0} days
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-text-muted">Wallet Balance</p>
          <p className="font-semibold text-text-secondary">
            ₹{data.walletBalance || 0}
          </p>
        </div>
      </div>
    </div>

    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center hover:bg-background rounded-lg p-2 -mx-2 transition cursor-pointer">
      <span className="text-sm font-medium text-brand">
        View Full Invoice
      </span>
      <ChevronRight size={16} className="text-brand"/>
    </div>

  </div>
);

/* QUICK ACTION */
const QuickAction = ({ icon, label, color, to }) => {
  const Icon = icon;

  const colorMap = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-orange-600",
  };

  return (
    <button
      onClick={() => to && window.location.assign(to)}
      className={`flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border border-border transition hover:bg-background ${colorMap[color]}`}
    >
      <Icon size={20} className="mb-1 md:mb-2"/>
      <span className="text-xs md:text-sm font-bold">{label}</span>
    </button>
  );
};

export default CustomerDashboard;
