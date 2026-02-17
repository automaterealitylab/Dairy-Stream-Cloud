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

const CustomerDashboard = () => {
  const { data, loading, error } = useCustomerDashboard();

  if (loading) {
    return (
      <CustomerLayout>
        <div className="py-20 text-center text-text-secondary">
          Loading your dashboard…
        </div>
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
  const { customer, todayDelivery, tomorrowDelivery, billing } = data;

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

          <button className="self-start sm:self-auto text-sm font-semibold text-brand hover:underline">
            Switch
          </button>
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
          <TomorrowDeliveryCard data={tomorrowDelivery} />
          <BillingSummaryCard data={billing} />
        </div>

      </div>
    </CustomerLayout>
  );
};

/* TODAY CARD */
const TodayStatusCard = ({ data = {} }) => {
  const isDelivered = data.status === "DELIVERED";

  return (
    <div className={`p-4 md:p-6 rounded-card border ${
      isDelivered ? "bg-success-soft border-border" : "bg-brand-soft border-border"
    }`}>
      <h3 className="text-xs sm:text-sm font-semibold text-text-muted uppercase mb-4">
        Today's Delivery
      </h3>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

        <div className="flex gap-4">
          <div className={`p-3 rounded-full ${
            isDelivered ? "bg-success text-white" : "bg-brand text-white"
          }`}>
            {isDelivered ? <CheckCircle size={22}/> : <AlertCircle size={22}/>}
          </div>

          <div>
            <h3 className="text-base md:text-lg font-bold text-text-primary">
              {isDelivered ? "Delivered Successfully" : "Delivery Pending"}
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
const TomorrowDeliveryCard = ({ data = {} }) => (
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

      <button className="text-sm font-semibold text-brand border border-border px-3 py-1 rounded-lg">
        Edit
      </button>

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
