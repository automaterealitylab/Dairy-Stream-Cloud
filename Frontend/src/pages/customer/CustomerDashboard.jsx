import { useEffect, useState } from "react";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import { useCustomerDashboard } from "../../hooks/useCustomerDashboard";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import {
  fetchCustomerDashboard,
  reportCustomerDeliveryIssue,
  saveCustomerSubscription,
} from "../../api/customer.api.js";
import { useNavigate, useLocation } from "react-router-dom";

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
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, error } = useCustomerDashboard();
  const [dashboardData, setDashboardData] = useState(null);
  const [guestDairyName, setGuestDairyName] = useState("");
  const [guestDairyId, setGuestDairyId] = useState(null);
  const [showEditTomorrowModal, setShowEditTomorrowModal] = useState(false);
  const [savingTomorrow, setSavingTomorrow] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueText, setIssueText] = useState("");
  const [reportingIssue, setReportingIssue] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [editTomorrowForm, setEditTomorrowForm] = useState({
    quantity: "1",
    slot: "Morning",
  });

  useEffect(() => {
    if (data) setDashboardData(data);
  }, [data]);

  useEffect(() => {
    const incomingState = location.state;
    const incomingFromBuyOnce = incomingState?.from === "buy-once";

    if (incomingFromBuyOnce) {
      const nextName = String(incomingState?.dairyName || "").trim();
      const nextDairyId = incomingState?.dairyId ?? null;
      if (nextName) {
        setGuestDairyName(nextName);
        localStorage.setItem("guest_dairy_name", nextName);
      }
      if (nextDairyId != null) {
        setGuestDairyId(String(nextDairyId));
        localStorage.setItem("guest_dairy_id", String(nextDairyId));
      }
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    const persisted = localStorage.getItem("guest_dairy_name");
    const persistedDairyId = localStorage.getItem("guest_dairy_id");
    if (persisted) {
      setGuestDairyName(persisted);
    }
    if (persistedDairyId) {
      setGuestDairyId(persistedDairyId);
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    const currentSubscription = (dashboardData || data)?.subscription;
    const hasCurrentSubscription =
      !!currentSubscription &&
      String(currentSubscription.status || "ACTIVE").toUpperCase() !== "CLOSED";

    if (!hasCurrentSubscription) return;

    setGuestDairyName("");
    setGuestDairyId(null);
    localStorage.removeItem("guest_dairy_name");
    localStorage.removeItem("guest_dairy_id");
  }, [dashboardData, data]);

  useEffect(() => {
    if (loading) return undefined;

    let cancelled = false;

    const refreshDashboard = async () => {
      try {
        const fresh = await fetchCustomerDashboard({ force: true });
        if (!cancelled) {
          setDashboardData(fresh);
        }
      } catch {
        // Ignore transient refresh failures; existing dashboard data remains visible.
      }
    };

    const interval = setInterval(refreshDashboard, 30000);
    const handleFocus = () => {
      refreshDashboard();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loading]);

  if (loading) {
    return (
      <CustomerLayout>
        <LoadingIndicator
          className="py-20"
          message="Loading your dashboard..."
        />
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

  /* ---------- DATA RESOLUTION ---------- */
  const resolvedData = dashboardData || data;
  const {
    customer,
    todayDelivery,
    tomorrowDelivery,
    billing,
    subscription,
    alerts,
    oneTimeOrders = [],
  } = resolvedData;
  const hasActiveSubscription =
    !!subscription &&
    String(subscription.status || "ACTIVE").toUpperCase() !== "CLOSED";
  const latestGuestOrder =
    Array.isArray(oneTimeOrders) && oneTimeOrders.length > 0 ? oneTimeOrders[0] : null;
  const customerDairyName = String(customer?.dairy || "").trim();
  const fallbackGuestDairy =
    customerDairyName && customerDairyName.toLowerCase() !== "not assigned"
      ? customerDairyName
      : String(latestGuestOrder?.dairyName || "").trim();
  const resolvedGuestDairy = guestDairyName || fallbackGuestDairy;
  const resolvedGuestDairyId =
    guestDairyId ??
    (latestGuestOrder?.dairyId !== null && latestGuestOrder?.dairyId !== undefined
      ? String(latestGuestOrder.dairyId)
      : null);
  const latestDeliveredOneTimeOrder = Array.isArray(oneTimeOrders)
    ? oneTimeOrders.find(
        (order) => String(order?.status || "").toUpperCase() === "DELIVERED"
      )
    : null;
  const promptDairyName = String(
    latestDeliveredOneTimeOrder?.dairyName || resolvedGuestDairy || ""
  ).trim();
  const promptDairyId =
    resolvedGuestDairyId ??
    (latestDeliveredOneTimeOrder?.dairyId !== null &&
    latestDeliveredOneTimeOrder?.dairyId !== undefined
      ? String(latestDeliveredOneTimeOrder.dairyId)
      : null);
  const showPostDeliveryPrompt = !hasActiveSubscription && Boolean(latestDeliveredOneTimeOrder);
  const showGuestBanner =
    !showPostDeliveryPrompt && !hasActiveSubscription && Boolean(resolvedGuestDairy);
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good Morning"
      : currentHour < 17
      ? "Good Afternoon"
      : currentHour < 21
      ? "Good Evening"
      : "Good Night";

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

      await saveCustomerSubscription({
        dairyId: subscription.dairyId,
        milkType: subscription.milkType || "Milk",
        quantity: Number(editTomorrowForm.quantity || 1),
        slot: editTomorrowForm.slot,
        startDate: subscription.startDate || undefined,
        address: subscription.address || "",
        paymentMethod: subscription.paymentMethod || "UPI",
        status: subscription.status || "ACTIVE",
      });

      const freshDashboard = await fetchCustomerDashboard({ force: true });
      setDashboardData(freshDashboard);
      setShowEditTomorrowModal(false);
    } catch (err) {
      setActionError(err?.message || "Failed to update tomorrow delivery.");
    } finally {
      setSavingTomorrow(false);
    }
  };

  const openIssueModal = () => {
    const deliveryId = Number(todayDelivery?.deliveryId ?? todayDelivery?.id);
    if (!Number.isFinite(deliveryId) || deliveryId <= 0) {
      setActionError("No valid today's delivery found to report.");
      return;
    }
    setIssueText("");
    setActionError("");
    setActionSuccess("");
    setShowIssueModal(true);
  };

  const submitIssue = async () => {
    const deliveryId = Number(todayDelivery?.deliveryId ?? todayDelivery?.id);
    const trimmedIssue = String(issueText || "").trim();

    if (!Number.isFinite(deliveryId) || deliveryId <= 0) {
      setActionError("No valid delivery selected for reporting.");
      return;
    }
    if (trimmedIssue.length < 5) {
      setActionError("Please enter at least 5 characters.");
      return;
    }

    try {
      setReportingIssue(true);
      setActionError("");
      setActionSuccess("");
      await reportCustomerDeliveryIssue({ deliveryId, issue: trimmedIssue });
      setShowIssueModal(false);
      setIssueText("");
      setActionSuccess("Issue reported successfully. Our team will check it soon.");
    } catch (err) {
      setActionError(err?.message || "Failed to report issue.");
    } finally {
      setReportingIssue(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="space-y-4 md:space-y-6 px-2 sm:px-4">
        {showGuestBanner && (
          <GuestSubscribeBanner
            dairyName={resolvedGuestDairy}
            onSubscribe={() =>
              navigate("/customer/dashboard/subscriptions", {
                state: resolvedGuestDairyId
                  ? {
                      from: "guest-banner",
                      guestDairyId: resolvedGuestDairyId,
                      guestDairyName: resolvedGuestDairy,
                    }
                  : null,
              })
            }
            onBuyOnce={
              resolvedGuestDairyId ? () => navigate(`/buy-once/${resolvedGuestDairyId}`) : null
            }
          />
        )}
        {showPostDeliveryPrompt && (
          <PostDeliveryDecisionCard
            dairyName={promptDairyName}
            onSubscribe={() =>
              navigate("/customer/dashboard/subscriptions", {
                state: promptDairyId
                  ? {
                      from: "one-time-delivered",
                      guestDairyId: promptDairyId,
                      guestDairyName: promptDairyName,
                    }
                  : null,
              })
            }
            onExplore={() =>
              navigate("/explore", {
                state: {
                  from: "one-time-delivered",
                  dairyId: promptDairyId || null,
                },
              })
            }
          />
        )}

        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
              {greeting}, {customer.name || "Customer"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-text-secondary">Member of</span>
              <span className="text-sm font-semibold text-brand bg-brand-soft px-2 py-0.5 rounded-lg border border-border">
                {customer.dairy}
              </span>
            </div>
          </div>
        </header>

        <UpcomingDeliveryAlert alert={alerts?.upcomingDelivery} />

        {/* ================= TODAY STATUS ================= */}
        <TodayStatusCard data={todayDelivery} navigate={navigate} onReportIssue={openIssueModal} />

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <QuickAction icon={Plus} label="Add Extra" color="brand" to="/customer/dashboard/subscriptions" />
          <QuickAction icon={PauseCircle} label="Pause" color="warning" to="/customer/dashboard/subscriptions" />
          <QuickAction icon={Calendar} label="Deliveries" color="brand" to="/customer/dashboard/deliveries" />
          <QuickAction icon={Banknote} label="Pay Bill" color="success" to="/customer/dashboard/payments" />
        </div>

        {/* TOMORROW + BILLING */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <TomorrowDeliveryCard data={tomorrowDelivery} onEdit={openTomorrowEdit} />
          <BillingSummaryCard data={billing} />
        </div>

        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {actionError}
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {actionSuccess}
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

        {showIssueModal && (
          <ReportIssueModal
            issueText={issueText}
            saving={reportingIssue}
            onClose={() => setShowIssueModal(false)}
            onChange={setIssueText}
            onSubmit={submitIssue}
          />
        )}
      </div>
    </CustomerLayout>
  );
};

const GuestSubscribeBanner = ({ dairyName, onSubscribe, onBuyOnce }) => (
  <div className="rounded-2xl border-2 border-amber-300 bg-amber-100/90 px-5 py-4 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm sm:text-base font-semibold text-amber-900">
        You are viewing {dairyName} as a guest. Subscribe now to schedule your first 6 AM delivery.
      </p>
      <div className="flex gap-2 flex-wrap">
        {onBuyOnce && (
          <button
            onClick={onBuyOnce}
            className="inline-flex items-center rounded-lg bg-white px-3 py-1 text-xs sm:text-sm font-bold text-amber-800 border border-amber-300 hover:bg-amber-50 transition-colors"
          >
            Buy Product Once
          </button>
        )}
        <button
          onClick={onSubscribe}
          className="inline-flex items-center rounded-lg bg-amber-700 px-3 py-1 text-xs sm:text-sm font-bold text-white hover:bg-amber-800 transition-colors"
        >
          Subscribe Now
        </button>
      </div>
    </div>
  </div>
);

const PostDeliveryDecisionCard = ({ dairyName, onSubscribe, onExplore }) => (
  <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-5 py-4 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm sm:text-base font-semibold text-emerald-900">
        Your product has been delivered{dairyName ? ` from ${dairyName}` : ""}. Do you want to continue with a subscription?
      </p>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onSubscribe}
          className="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-1 text-xs sm:text-sm font-bold text-white hover:bg-emerald-800 transition-colors"
        >
          Continue Subscription
        </button>
        <button
          onClick={onExplore}
          className="inline-flex items-center rounded-lg bg-white px-3 py-1 text-xs sm:text-sm font-bold text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors"
        >
          Back to Explore Dairies
        </button>
      </div>
    </div>
  </div>
);

/* TODAY CARD */
const TodayStatusCard = ({ data = {}, navigate, onReportIssue }) => {
  const isDelivered = data.status === "DELIVERED";
  const isPending = data.status === "PENDING";
  const isApprovalPending = data.status === "PENDING_APPROVAL";
  const isPartnerUnassigned = isPending && !data?.agent?.name;
  const reportId = Number(data?.deliveryId ?? data?.id);
  const canReportIssue = Number.isFinite(reportId) && reportId > 0;
  const issueStatus = String(data?.issueStatus || "").toUpperCase();
  const hasIssue = Boolean(String(data?.customerIssue || "").trim());
  const hasAdminAction = Boolean(String(data?.issueAdminAction || "").trim());

  const title = isDelivered
    ? "Delivered Successfully"
    : isApprovalPending
    ? "Approval Pending"
    : isPartnerUnassigned
    ? "Delivery Partner Not Assigned"
    : isPending
    ? "Delivery Pending"
    : "No Delivery Scheduled Today";

  return (
    <div className={`p-4 md:p-6 rounded-card border ${isDelivered ? "bg-success-soft border-border" : isApprovalPending ? "bg-indigo-50 border-indigo-200" : isPending ? "bg-brand-soft border-border" : "bg-gray-50 border-border"}`}>
      <h3 className="text-xs sm:text-sm font-semibold text-text-muted uppercase mb-4">Today's Delivery</h3>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex gap-4">
          <div className={`p-3 rounded-full ${isDelivered ? "bg-success text-white" : isApprovalPending ? "bg-indigo-600 text-white" : isPending ? "bg-brand text-white" : "bg-gray-300 text-gray-700"}`}>
            {isDelivered ? <CheckCircle size={22} /> : <AlertCircle size={22} />}
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-text-primary">{title}</h3>
            <p className="text-sm text-text-secondary mt-1">{data.quantity || "-"} • {data.product || "-"}</p>
            {isApprovalPending && (
              <p className="text-xs text-indigo-700 mt-2 font-medium">
                Your order is waiting for dairy admin approval.
              </p>
            )}
            {data?.agent?.name ? (
              <p className="text-xs text-text-muted mt-2">Agent: {data.agent.name} ({data.agent.phone || "-"})</p>
            ) : (
              <p className="text-xs text-text-muted mt-2">Delivery partner not assigned yet.</p>
            )}
            {isDelivered && (
              <p className="text-xs text-text-muted mt-2">Dropped at Doorstep • {data.time || "-"}</p>
            )}
            {hasIssue && (
              <p className="text-xs text-rose-700 mt-2 font-medium">
                Reported Issue: {data.customerIssue}
              </p>
            )}
            {hasAdminAction && (
              <p className="text-xs text-emerald-700 mt-1 font-medium">
                Action Taken: {data.issueAdminAction}
              </p>
            )}
            {hasIssue && issueStatus === "OPEN" && (
              <p className="text-xs text-amber-700 mt-1 font-medium">
                Issue Status: Pending resolution
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 self-start">
          <button
            onClick={() => navigate("/customer/dashboard/track/agent", { state: { delivery: data } })}
            disabled={isApprovalPending}
            className="text-xs font-semibold text-brand border border-border px-3 py-1.5 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Track Agent
          </button>
          <button
            onClick={onReportIssue}
            disabled={!canReportIssue}
            className="text-xs font-semibold text-text-secondary underline disabled:opacity-50 disabled:no-underline"
          >
            Report Issue
          </button>
        </div>
      </div>
    </div>
  );
};
const UpcomingDeliveryAlert = ({ alert }) => {
  if (!alert?.date) return null;
  const dateLabel = new Date(alert.date).toLocaleDateString();
  const isApprovalPending = String(alert?.approvalStatus || "").toUpperCase() === "PENDING";

  return (
    <div className={`rounded-xl px-4 py-3 text-sm ${isApprovalPending ? "border border-indigo-200 bg-indigo-50 text-indigo-800" : "border border-blue-200 bg-blue-50 text-blue-800"}`}>
      {isApprovalPending
        ? `Order approval pending: ${alert.quantity} ${alert.product} for ${dateLabel}.`
        : `Upcoming delivery scheduled: ${alert.quantity} ${alert.product} on ${dateLabel}.`}
    </div>
  );
};

/* TOMORROW */
const TomorrowDeliveryCard = ({ data = {}, onEdit }) => (
  <div className="bg-surface border border-border rounded-card shadow-card p-4 md:p-6">
    <h3 className="text-xs sm:text-sm font-semibold text-text-muted uppercase mb-4">Tomorrow</h3>
    <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
      <div className="bg-brand-soft p-3 rounded-xl text-brand">
        <Droplets size={22} />
      </div>
      <div className="flex-1 min-w-[120px]">
        <h4 className="font-bold text-text-primary">{data.quantity || "-"} Milk</h4>
        <p className="text-sm text-text-secondary">{data.slot || "-"}</p>
      </div>
      <button onClick={onEdit} className="text-sm font-semibold text-brand border border-border px-3 py-1 rounded-lg">Edit</button>
    </div>
  </div>
);

const EditTomorrowModal = ({ form, saving, onClose, onChange, onSave }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Edit Next Day Delivery</h3>
        <button onClick={onClose} className="rounded-lg p-1 text-text-secondary hover:bg-background"><X size={18} /></button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Quantity (L)</label>
          <input type="number" min="0.5" step="0.5" value={form.quantity} onChange={(e) => onChange({ quantity: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Delivery Slot</label>
          <select value={form.slot} onChange={(e) => onChange({ slot: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary">
            <option>Morning</option>
            <option>Evening</option>
          </select>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Cancel</button>
        <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  </div>
);

const ReportIssueModal = ({ issueText, saving, onClose, onChange, onSubmit }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Report Delivery Issue</h3>
        <button onClick={onClose} className="rounded-lg p-1 text-text-secondary hover:bg-background">
          <X size={18} />
        </button>
      </div>

      <label className="mb-2 block text-sm font-medium text-text-secondary">
        Describe the issue
      </label>
      <textarea
        rows={4}
        value={issueText}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Example: Milk packet was damaged / quantity mismatch..."
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
      />

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Submitting..." : "Submit Issue"}
        </button>
      </div>
    </div>
  </div>
);

/* BILLING */
const BillingSummaryCard = ({ data = {} }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-4 md:p-6 flex flex-col justify-between">
      <div>
        <h3 className="text-xs sm:text-sm font-semibold text-text-muted uppercase mb-2">Billing Summary</h3>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-2xl md:text-3xl font-bold text-text-primary">₹{data.monthlyDue || 0}</p>
            <p className="text-xs text-red-500 font-medium mt-1">Due in {data.dueInDays || 0} days</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted">Wallet Balance</p>
            <p className="font-semibold text-text-secondary">₹{data.walletBalance || 0}</p>
          </div>
        </div>
      </div>
      <div onClick={() => navigate("/customer/dashboard/payments")} className="mt-4 pt-4 border-t border-border flex justify-between items-center hover:bg-background rounded-lg p-2 -mx-2 transition cursor-pointer">
        <span className="text-sm font-medium text-brand">View Full Invoice</span>
        <ChevronRight size={16} className="text-brand" />
      </div>
    </div>
  );
};

/* QUICK ACTION */
const QuickAction = ({ icon, label, color, to }) => {
  const Icon = icon;
  const navigate = useNavigate();
  const colorMap = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-orange-600",
  };

  return (
    <button
      onClick={() => to && navigate(to)}
      className={`flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border border-border transition hover:bg-background ${colorMap[color]}`}
    >
      <Icon size={20} className="mb-1 md:mb-2" />
      <span className="text-xs md:text-sm font-bold">{label}</span>
    </button>
  );
};

export default CustomerDashboard;


