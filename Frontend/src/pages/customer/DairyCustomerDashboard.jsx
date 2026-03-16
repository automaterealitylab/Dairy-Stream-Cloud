import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import { useCustomerDashboard } from "../../hooks/useCustomerDashboard";
import {
  fetchCustomerDashboard,
  saveCustomerSubscription,
} from "../../api/customer/customer.api.js";
import {
  PlusCircle,
  PauseCircle,
  PlayCircle,
  Truck,
  CreditCard,
  CheckCircle,
  Clock,
  User,
  ChevronRight,
  X,
  AlertCircle,
} from "lucide-react";

const ACTIONS = [
  {
    key: "add",
    label: "Add Extra",
    Icon: PlusCircle,
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-100",
    route: "/customer/dashboard/subscriptions",
  },
  {
    key: "pause",
    label: "Pause",
    Icon: PauseCircle,
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-100",
    route: null,
  },
  {
    key: "deliveries",
    label: "Deliveries",
    Icon: Truck,
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-100",
    route: "/customer/dashboard/deliveries",
  },
  {
    key: "pay",
    label: "Pay Bill",
    Icon: CreditCard,
    bg: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-100",
    route: "/customer/dashboard/payments",
  },
];

const formatUpcomingMessage = (alert) => {
  if (!alert?.date) return "";
  const parts = [];
  if (alert.product) parts.push(alert.product);
  if (alert.quantity) parts.push(alert.quantity);
  const itemSummary = parts.join(" ");
  return `Upcoming delivery scheduled${
    itemSummary ? `: ${itemSummary}` : ""
  } on ${alert.date}.`;
};

const toSubscriptionPayload = (subscription, nextStatus) => ({
  dairyId: subscription?.dairyId,
  milkType: subscription?.milkType || "Milk",
  quantity: Number(subscription?.quantity || 1),
  slot: subscription?.slot || "Morning",
  startDate: subscription?.startDate || undefined,
  address: subscription?.address || "",
  paymentMethod: subscription?.paymentMethod || "UPI",
  status: nextStatus,
});

export default function DairyCustomerDashboard() {
  const navigate = useNavigate();
  const { data, loading, error } = useCustomerDashboard();

  const [dashboardData, setDashboardData] = useState(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [savingPause, setSavingPause] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (data) {
      setDashboardData(data);
    }
  }, [data]);

  const resolvedData = dashboardData || data;
  const customer = resolvedData?.customer || {};
  const today = resolvedData?.todayDelivery || null;
  const tomorrow = resolvedData?.tomorrowDelivery || null;
  const billing = resolvedData?.billing || {};
  const subscription = resolvedData?.subscription || null;
  const upcomingMsg = useMemo(
    () => formatUpcomingMessage(resolvedData?.alerts?.upcomingDelivery),
    [resolvedData?.alerts?.upcomingDelivery]
  );

  const customerName = customer?.name || "Customer";
  const dairyName = customer?.dairy || customer?.dairyName || "Not assigned";
  const isPaused = String(subscription?.status || "").toUpperCase() === "PAUSED";
  const canTogglePause = Boolean(subscription?.dairyId) && !savingPause;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(null), 3000);
  };

  const refreshDashboard = async () => {
    const fresh = await fetchCustomerDashboard({ force: true });
    setDashboardData(fresh);
  };

  const handlePauseResume = async () => {
    if (!subscription?.dairyId) {
      showToast("No active subscription found.", "error");
      return;
    }

    setSavingPause(true);
    try {
      const nextStatus = isPaused ? "ACTIVE" : "PAUSED";
      await saveCustomerSubscription(toSubscriptionPayload(subscription, nextStatus));
      await refreshDashboard();
      showToast(
        nextStatus === "ACTIVE" ? "Subscription resumed!" : "Subscription paused.",
        nextStatus === "ACTIVE" ? "success" : "warning"
      );
    } catch (err) {
      showToast(err?.message || "Failed to update subscription status.", "error");
    } finally {
      setSavingPause(false);
    }
  };

  const handleAction = (key) => {
    if (key === "pause") {
      handlePauseResume();
      return;
    }

    const action = ACTIONS.find((item) => item.key === key);
    if (action?.route) {
      navigate(action.route);
    }
  };

  if (loading && !resolvedData) {
    return (
      <CustomerLayout>
        <LoadingIndicator className="py-20" message="Loading your dashboard..." />
      </CustomerLayout>
    );
  }

  if (error && !resolvedData) {
    return (
      <CustomerLayout>
        <div className="py-20 text-center text-red-500">{error}</div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="w-full px-6 py-8 space-y-5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold transition-all ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : toast.type === "warning"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {toast.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {toast.msg}
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {greeting}, {customerName}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm text-gray-400">Member of</span>
            <span className="bg-white border border-gray-200 rounded-lg px-2.5 py-0.5 text-xs font-bold text-gray-600">
              {dairyName}
            </span>
          </div>
        </div>

        {bannerVisible && upcomingMsg && (
          <div className="flex items-center justify-between bg-white border border-amber-100 border-l-4 border-l-amber-400 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2.5 text-sm text-amber-700">
              <AlertCircle size={15} className="flex-shrink-0 text-amber-500" />
              {upcomingMsg}
            </div>
            <button
              onClick={() => setBannerVisible(false)}
              className="text-gray-300 hover:text-gray-500 transition ml-3 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {today && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/60 to-white rounded-2xl pointer-events-none" />
            <p className="relative text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
              Today&apos;s Delivery
            </p>
            <div className="relative flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  String(today.status || "").toUpperCase() === "DELIVERED"
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-amber-100 text-amber-500"
                }`}
              >
                {String(today.status || "").toUpperCase() === "DELIVERED" ? (
                  <CheckCircle size={28} />
                ) : (
                  <Clock size={28} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {String(today.status || "").toUpperCase() === "DELIVERED"
                    ? "Delivered Successfully"
                    : "Delivery Pending"}
                </h3>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-gray-400">
                    {today.quantity || "-"} - {today.product || "Milk"}
                  </p>
                  {today?.agent?.name && (
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <User size={11} />
                      Agent: {today.agent.name} {today.agent.phone ? `(${today.agent.phone})` : ""}
                    </p>
                  )}
                  {today.time && (
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Clock size={11} />
                      Dropped at Doorstep - {today.time}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() =>
                    navigate("/customer/dashboard/track/agent", { state: { delivery: today } })
                  }
                  disabled={!today?.canTrackAgent}
                  className="border border-gray-200 bg-white rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 hover:border-gray-300 hover:text-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Track Agent
                </button>
                <button
                  onClick={() => navigate("/customer/dashboard/deliveries")}
                  className="border border-red-100 bg-red-50 rounded-xl px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-100 transition"
                >
                  Report Issue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          {ACTIONS.map(({ key, label, Icon, bg, text, border }) => (
            <button
              key={key}
              onClick={() => handleAction(key)}
              disabled={key === "pause" && !canTogglePause}
              className={`bg-white border ${border} rounded-2xl py-4 px-3 flex flex-col items-center gap-2 hover:-translate-y-1 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg} ${text}`}>
                {key === "pause" && isPaused ? <PlayCircle size={20} /> : <Icon size={20} />}
              </div>
              <span className="text-xs font-bold text-gray-600">
                {key === "pause" ? (isPaused ? "Resume" : "Pause") : label}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
            {tomorrow && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-3">
                  Tomorrow
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                    <Truck size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-gray-900">
                      {tomorrow.quantity || "-"} {subscription?.milkType || "Milk"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{tomorrow.slot || "-"} slot</p>
                  </div>
                  <button
                    onClick={() => navigate("/customer/dashboard/subscriptions")}
                    className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-500 hover:border-gray-300 hover:text-gray-800 transition flex-shrink-0"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-gray-50 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-3">
                Subscription
              </p>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">
                  {subscription
                    ? `${subscription.milkType || "Milk"} - ${subscription.quantity || "-"} L Daily`
                    : "No active subscription"}
                </p>
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                    isPaused
                      ? "bg-amber-50 text-amber-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {subscription ? (isPaused ? "Paused" : "Active") : "Inactive"}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Start date: {subscription?.startDate || "Not available"}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handlePauseResume}
                  disabled={!canTogglePause}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border disabled:opacity-50 disabled:cursor-not-allowed ${
                    isPaused
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      : "border-red-100 bg-red-50 text-red-500 hover:bg-red-100"
                  }`}
                >
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={() => navigate("/customer/dashboard/subscriptions")}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                >
                  Modify Plan
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-4">
              Billing Summary
            </p>
            <div className="mb-1">
              <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                Rs.{billing.monthlyDue ?? 0}
              </span>
            </div>
            {billing.dueInDays != null && (
              <p className="text-xs font-semibold text-red-400 mb-4">
                Due in {billing.dueInDays} days
              </p>
            )}
            <div className="space-y-0 mb-4">
              {[
                { label: "Wallet Balance", value: `Rs.${billing.walletBalance ?? 0}` },
                { label: "Last Payment", value: "Not available" },
                { label: "Payment Mode", value: subscription?.paymentMethod || "UPI" },
                { label: "Status", value: billing.monthlyDue > 0 ? "Pending" : "Clear", highlight: true },
              ].map(({ label, value, highlight }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-none"
                >
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className={`text-xs font-semibold ${highlight ? "text-amber-600" : "text-gray-700"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate("/customer/dashboard/payments")}
              className="w-full bg-gray-900 text-white rounded-2xl py-3 text-sm font-bold hover:bg-gray-700 transition active:scale-95 mb-2"
            >
              Pay Now
            </button>
            <button
              onClick={() => navigate("/customer/dashboard/payments")}
              className="w-full flex items-center justify-center gap-1.5 border border-gray-200 bg-white rounded-2xl py-2.5 text-xs font-semibold text-gray-500 hover:border-gray-300 hover:text-gray-800 transition"
            >
              View Full Invoice <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
