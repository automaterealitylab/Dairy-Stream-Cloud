import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import { useCustomerDashboard } from "../hooks/useCustomerDashboard";

import {
  CheckCircle,
  AlertCircle,
  Calendar,
  Plus,
  PauseCircle,
  Banknote,
  ChevronRight,
  Droplets,
} from "lucide-react";

/* ======================================================
   CUSTOMER DASHBOARD (BACKEND READY)
====================================================== */

const CustomerDashboard = () => {
  const { data, loading, error } = useCustomerDashboard();

  /* ---------- LOADING STATE ---------- */
  if (loading) {
    return (
      <CustomerLayout>
        <div className="py-20 text-center text-text-secondary">
          Loading your dashboard…
        </div>
      </CustomerLayout>
    );
  }

  /* ---------- ERROR STATE ---------- */
  if (error) {
    return (
      <CustomerLayout>
        <div className="py-20 text-center text-red-500">
          {error}
        </div>
      </CustomerLayout>
    );
  }

  /* ---------- DATA FROM BACKEND ---------- */
  const { customer, todayDelivery, tomorrowDelivery, billing } = data;

  return (
    <CustomerLayout>
      <div className="space-y-6">

        {/* ================= HEADER ================= */}
        <header className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">
              Good Morning, {customer.name} 👋
            </h2>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-text-secondary">Member of</span>
              <span className="text-sm font-semibold text-brand bg-brand-soft px-2 py-0.5 rounded-lg border border-border">
                {customer.dairy}
              </span>
            </div>
          </div>

          <button className="text-sm font-semibold text-brand hover:underline">
            Switch
          </button>
        </header>

        <section className="bg-surface border border-border rounded-card shadow-card p-4">
          <h3 className="text-sm font-semibold text-text-muted uppercase mb-3">
            Your Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-text-muted">Customer ID</p>
              <p className="font-semibold text-text-primary">{customer.id ?? "-"}</p>
            </div>
            <div>
              <p className="text-text-muted">Email</p>
              <p className="font-semibold text-text-primary break-all">{customer.email || "-"}</p>
            </div>
            <div>
              <p className="text-text-muted">Mobile</p>
              <p className="font-semibold text-text-primary">{customer.phone || "-"}</p>
            </div>
          </div>
        </section>

        {/* ================= TODAY STATUS ================= */}
        <TodayStatusCard data={todayDelivery} />

        {/* ================= QUICK ACTIONS ================= */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction icon={Plus} label="Add Extra" color="brand"  to="/customer/dashboard/subscriptions" />
          <QuickAction icon={PauseCircle} label="Pause" color="warning"  to="/customer/dashboard/subscriptions" />
          <QuickAction
            icon={Calendar}
            label="Deliveries"
            color="brand"
            to="/customer/dashboard/deliveries"
          />
          <QuickAction icon={Banknote} label="Pay Bill" color="success"  to="/customer/dashboard/payments" />
        </div>

        {/* ================= TOMORROW + BILLING ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TomorrowDeliveryCard data={tomorrowDelivery} />
          <BillingSummaryCard data={billing} />
        </div>

      </div>
    </CustomerLayout>
  );
};

/* ======================================================
   SUB COMPONENTS
====================================================== */

const TodayStatusCard = ({ data }) => {
  const isDelivered = data.status === "DELIVERED";

  return (
    <div
      className={`p-6 rounded-card border ${
        isDelivered
          ? "bg-success-soft border-border"
          : "bg-brand-soft border-border"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div
            className={`p-3 rounded-full ${
              isDelivered ? "bg-success text-white" : "bg-brand text-white"
            }`}
          >
            {isDelivered ? (
              <CheckCircle size={22} />
            ) : (
              <AlertCircle size={22} />
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-text-primary">
              {isDelivered ? "Delivered Successfully" : "Delivery Pending"}
            </h3>

            <p className="text-sm text-text-secondary mt-1">
              {data.quantity} • {data.product}
            </p>

            {isDelivered && (
              <p className="text-xs text-text-muted mt-2">
                Dropped at Doorstep • {data.time}
              </p>
            )}
          </div>
        </div>

        <button className="text-xs font-semibold text-text-secondary underline">
          Report Issue
        </button>
      </div>
    </div>
  );
};

const TomorrowDeliveryCard = ({ data }) => (
  <div className="bg-surface border border-border rounded-card shadow-card p-6">
    <h3 className="text-sm font-semibold text-text-muted uppercase mb-4">
      Tomorrow
    </h3>

    <div className="flex items-center gap-4">
      <div className="bg-brand-soft p-3 rounded-xl text-brand">
        <Droplets size={22} />
      </div>

      <div className="flex-1">
        <h4 className="font-bold text-text-primary">
          {data.quantity} Milk
        </h4>
        <p className="text-sm text-text-secondary">{data.slot}</p>
      </div>

      <button className="text-sm font-semibold text-brand border border-border px-3 py-1 rounded-lg">
        Edit
      </button>
    </div>
  </div>
);

const BillingSummaryCard = ({ data }) => (
  <div className="bg-surface border border-border rounded-card shadow-card p-6 flex flex-col justify-between">
    <div>
      <h3 className="text-sm font-semibold text-text-muted uppercase mb-2">
        Billing Summary
      </h3>

      <div className="flex justify-between items-end">
        <div>
          <p className="text-3xl font-bold text-text-primary">
            ₹{data.monthlyDue}
          </p>
          <p className="text-xs text-red-500 font-medium mt-1">
            Due in {data.dueInDays} days
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-text-muted">Wallet Balance</p>
          <p className="font-semibold text-text-secondary">
            ₹{data.walletBalance}
          </p>
        </div>
      </div>
    </div>

    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center hover:bg-background rounded-lg p-2 -mx-2 transition cursor-pointer">
      <span className="text-sm font-medium text-brand">
        View Full Invoice
      </span>
      <ChevronRight size={16} className="text-brand" />
    </div>
  </div>
);

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
      className={`flex flex-col items-center justify-center p-4 rounded-xl border border-border transition hover:bg-background ${colorMap[color]}`}
    >
      <Icon size={22} className="mb-2" />
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
};

export default CustomerDashboard;
