import React, { useEffect, useState } from "react";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import { 
  CreditCard, DollarSign, Calendar, TrendingUp, 
  CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Eye, EyeOff, KeyRound, Loader2, Share2, ShieldCheck, X, Wallet
} from "lucide-react";
import toast from "react-hot-toast";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import ManualPaymentModal from "../../components/admin/sections/ManualPaymentModal";
import {
  collectAdminOfflinePayment,
  fetchAdminPayments,
  updateDairyRazorpaySetupApi,
  updateAdminFarmPlan,
} from "../../api/admin.api.js";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";

export default function AdminPayments() {
  const AUTOPAY_STORAGE_PREFIX = "adminFarmAutopayV1";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data States
  const [farmPlan, setFarmPlan] = useState(null);
  const [revenue, setRevenue] = useState(0);
  const [payments, setPayments] = useState([]);
  
  // UI States
  const [filter, setFilter] = useState("ALL"); 
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [activePaymentModal, setActivePaymentModal] = useState(null);
  const [planUpdating, setPlanUpdating] = useState(false);
  const [autopayModalOpen, setAutopayModalOpen] = useState(false);
  const [selectedAutopayMethod, setSelectedAutopayMethod] = useState("");
  const [pendingAutopayPlan, setPendingAutopayPlan] = useState(null);
  const [autopaySaving, setAutopaySaving] = useState(false);
  const [expandedPaymentGroups, setExpandedPaymentGroups] = useState({});
  const [razorpaySaving, setRazorpaySaving] = useState(false);
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);
  const [razorpayForm, setRazorpayForm] = useState({
    razorpayKeyId: "",
    razorpayKeySecret: "",
  });

  const getAutopayStorageKey = (dairyId) =>
    `${AUTOPAY_STORAGE_PREFIX}:${dairyId || "default"}`;

  const readStoredAutopay = (dairyId) => {
    if (typeof window === "undefined") return null;

    try {
      const raw = window.localStorage.getItem(getAutopayStorageKey(dairyId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const persistAutopay = (dairyId, value) => {
    if (typeof window === "undefined") return;

    try {
      if (!value) {
        window.localStorage.removeItem(getAutopayStorageKey(dairyId));
        return;
      }

      window.localStorage.setItem(
        getAutopayStorageKey(dairyId),
        JSON.stringify(value)
      );
    } catch {
      // Ignore storage issues so billing UI keeps working.
    }
  };

  const isCollectibleStatus = (status) => {
    const normalized = String(status || "").toUpperCase();
    return normalized === "PENDING" || normalized === "OVERDUE";
  };

  const getPaymentDayKey = (value) => {
    if (!value) return "unknown-date";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatPaymentDate = (value) => {
    if (!value) return "-";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString("en-GB");
  };

  const formatCurrency = (value) => `\u20B9${Number(value || 0).toLocaleString("en-IN")}`;

  const getGroupStatus = (items) => {
    const statuses = [...new Set(items.map((item) => String(item.status || "").toUpperCase()))];

    if (statuses.length === 1) return statuses[0];
    if (statuses.includes("OVERDUE")) return "OVERDUE";
    if (statuses.includes("PENDING")) return "PENDING";
    if (statuses.includes("PAID")) return "PAID";
    return "MIXED";
  };

  const groupedPayments = payments
    .reduce((groups, payment) => {
      const dayKey = getPaymentDayKey(payment.date);
      const groupKey = `${payment.customerId || payment.customer || "unknown"}-${dayKey}`;
      const existingGroup = groups.find((group) => group.groupKey === groupKey);

      if (existingGroup) {
        existingGroup.items.push(payment);
        existingGroup.totalAmount += Number(payment.amount || 0);
        existingGroup.collectibleAmount += isCollectibleStatus(payment.status)
          ? Number(payment.amount || 0)
          : 0;
        return groups;
      }

      groups.push({
        groupKey,
        customerId: payment.customerId,
        customer: payment.customer,
        phone: payment.phone,
        date: payment.date,
        items: [payment],
        totalAmount: Number(payment.amount || 0),
        collectibleAmount: isCollectibleStatus(payment.status) ? Number(payment.amount || 0) : 0,
      });
      return groups;
    }, [])
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      ),
      status: getGroupStatus(group.items),
      hasCollectibleItems: group.items.some((item) => isCollectibleStatus(item.status)),
      displayAmount: group.items.some((item) => isCollectibleStatus(item.status))
        ? group.collectibleAmount
        : group.totalAmount,
    }));

  const togglePaymentGroup = (groupKey) => {
    setExpandedPaymentGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const renderStatusBadge = (status) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${
      status === "PAID"
        ? "bg-green-50 text-green-700 border-green-200"
        : status === "PENDING"
          ? "bg-orange-50 text-orange-700 border-orange-200"
          : "bg-red-50 text-red-700 border-red-200"
    }`}>
      {status === "PAID" ? <CheckCircle size={10} /> : <Clock size={10} />} {status}
    </span>
  );

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminPayments({ page: 1, status: filter });

      const farm = data?.farm || null;
      const storedAutopay = readStoredAutopay(farm?.id || null);
      setFarmPlan({
        id: farm?.id || null,
        plan: farm?.selected_plan || "Standard",
        status: farm?.status || "ACTIVE",
        nextBilling: farm?.updated_at || null,
        upiId: farm?.upi_id || "",
        bankName: farm?.bank_name || "",
        bankBranch: farm?.bank_branch || "",
        bankAccountHolderName: farm?.bank_account_holder_name || "",
        bankAccountNumber: farm?.bank_account_number || "",
        bankIfscCode: farm?.bank_ifsc_code || "",
        autopayEnabled: Boolean(storedAutopay?.enabled),
        autopayMethod: storedAutopay?.method || "",
        autopayConfiguredAt: storedAutopay?.configuredAt || null,
        razorpayKeyId: farm?.razorpay_key_id || "",
        razorpayStatus: farm?.razorpay_onboarding_status || "PENDING",
        paymentsEnabled: Boolean(farm?.payments_enabled),
      });
      setRazorpayForm({
        razorpayKeyId: farm?.razorpay_key_id || "",
        razorpayKeySecret: "",
      });

      setRevenue(Number(data?.totalRevenue || 0));
      setPayments(Array.isArray(data?.payments) ? data.payments : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load payments");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [filter]);

  const handleOfflineCollect = async (payData) => {
    try {
      await collectAdminOfflinePayment({
        customerId: activePaymentModal?.customerId,
        receivedAmount: payData.received,
        method: payData.method,
        note: payData.note,
      });
      toast.success("Offline payment recorded");
      setActivePaymentModal(null);
      await loadPayments();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to record offline payment");
    }
  };

  const handlePlanSelect = async (planName) => {
    if (!planName || planName === farmPlan?.plan || planUpdating) return;

    try {
      setPlanUpdating(true);
      const updated = await updateAdminFarmPlan(planName);

      setFarmPlan((prev) => ({
        id: updated?.id ?? prev?.id ?? null,
        plan: updated?.selected_plan || planName,
        status: updated?.status || prev?.status || "ACTIVE",
        nextBilling: updated?.updated_at || new Date().toISOString(),
        upiId: prev?.upiId || "",
        bankName: prev?.bankName || "",
        bankBranch: prev?.bankBranch || "",
        bankAccountHolderName: prev?.bankAccountHolderName || "",
        bankAccountNumber: prev?.bankAccountNumber || "",
        bankIfscCode: prev?.bankIfscCode || "",
        autopayEnabled: prev?.autopayEnabled || false,
        autopayMethod: prev?.autopayMethod || "",
        autopayConfiguredAt: prev?.autopayConfiguredAt || null,
        razorpayKeyId: prev?.razorpayKeyId || "",
        razorpayStatus: prev?.razorpayStatus || "PENDING",
        paymentsEnabled: prev?.paymentsEnabled || false,
      }));

      toast.success(`${getPlanLabel(planName)} plan selected`);
      setPlanModalOpen(false);
      setPendingAutopayPlan(planName);
      setSelectedAutopayMethod("");
      setAutopayModalOpen(true);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to update plan");
    } finally {
      setPlanUpdating(false);
    }
  };

  const autopayOptions = [
    {
      id: "UPI",
      label: "UPI AutoPay",
      description: farmPlan?.upiId
        ? `Use dairy UPI ${farmPlan.upiId} for recurring plan billing.`
        : "Add a dairy UPI ID first to enable recurring UPI billing.",
      available: Boolean(farmPlan?.upiId),
    },
    {
      id: "BANK",
      label: "Bank AutoPay",
      description:
        farmPlan?.bankAccountNumber && farmPlan?.bankIfscCode
          ? `Use ${farmPlan.bankName || "registered bank"} account ending ${String(
              farmPlan.bankAccountNumber
            ).slice(-4)} for scheduled collections.`
          : "Add bank account and IFSC details first to enable account-based autopay.",
      available: Boolean(farmPlan?.bankAccountNumber && farmPlan?.bankIfscCode),
    },
  ];

  const setupAutopay = async () => {
    if (!selectedAutopayMethod || autopaySaving) return;

    try {
      setAutopaySaving(true);
      const config = {
        enabled: true,
        method: selectedAutopayMethod,
        configuredAt: new Date().toISOString(),
        plan: pendingAutopayPlan || farmPlan?.plan || "",
        cycle: billingCycle,
      };

      persistAutopay(farmPlan?.id, config);
      setFarmPlan((prev) => ({
        ...prev,
        autopayEnabled: true,
        autopayMethod: selectedAutopayMethod,
        autopayConfiguredAt: config.configuredAt,
      }));
      setAutopayModalOpen(false);
      setPendingAutopayPlan(null);
      toast.success(
        `${selectedAutopayMethod} autopay enabled for ${pendingAutopayPlanLabel}`
      );
    } finally {
      setAutopaySaving(false);
    }
  };

  const skipAutopaySetup = () => {
    setAutopayModalOpen(false);
    setPendingAutopayPlan(null);
    setSelectedAutopayMethod("");
  };

  const handleRazorpayFormChange = (event) => {
    const { name, value } = event.target;
    setRazorpayForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveRazorpaySetup = async () => {
    const keyId = razorpayForm.razorpayKeyId.trim();
    const keySecret = razorpayForm.razorpayKeySecret.trim();

    if (!keyId) {
      toast.error("Enter Razorpay Key ID");
      return;
    }

    if (!farmPlan?.paymentsEnabled && !keySecret) {
      toast.error("Enter Razorpay Key Secret");
      return;
    }

    try {
      setRazorpaySaving(true);
      const response = await updateDairyRazorpaySetupApi({
        razorpayKeyId: keyId,
        razorpayKeySecret: keySecret,
      });
      const setup = response?.data || response;
      setFarmPlan((prev) => ({
        ...prev,
        razorpayKeyId: setup?.razorpay_key_id || keyId,
        razorpayStatus: setup?.razorpay_onboarding_status || "CONFIGURED",
        paymentsEnabled: setup?.payments_enabled ?? true,
      }));
      setRazorpayForm((prev) => ({
        ...prev,
        razorpayKeyId: setup?.razorpay_key_id || keyId,
        razorpayKeySecret: "",
      }));
      toast.success("Razorpay keys saved for this dairy");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save Razorpay setup");
    } finally {
      setRazorpaySaving(false);
    }
  };

  const planOptions = [
    {
      value: "Free",
      label: "Starter",
      monthlyPrice: 499,
      yearlyPrice: 4990,
      features: [
        "Basic customer and product management",
        "Manual delivery scheduling",
        "Limited payment tracking dashboard",
        "Single dairy admin access",
      ],
      popular: false,
    },
    {
      value: "Growth",
      label: "Growth",
      monthlyPrice: 999,
      yearlyPrice: 9990,
      features: [
        "Customer, agent, and subscription management",
        "Delivery approvals and route assignment",
        "Razorpay payment and wallet tracking",
        "Performance dashboard with delivery analytics",
      ],
      popular: true,
    },
    {
      value: "Prime",
      label: "Enterprise",
      monthlyPrice: 2499,
      yearlyPrice: 24990,
      features: [
        "Everything in Growth plan",
        "Procurement and supplier management",
        "Push notifications and ETA visibility",
        "Offline-ready delivery operations support",
      ],
      popular: false,
    },
  ];

  const activePlanDetails =
    planOptions.find((option) => option.value === farmPlan?.plan) || planOptions[0];
  const activePlanLabel = activePlanDetails?.label || farmPlan?.plan || "Starter";
  const getPlanLabel = (planValue) =>
    planOptions.find((option) => option.value === planValue)?.label || planValue || "Starter";
  const pendingAutopayPlanLabel = getPlanLabel(pendingAutopayPlan || farmPlan?.plan);
  const activePlanPrice =
    billingCycle === "yearly"
      ? activePlanDetails?.yearlyPrice ?? 0
      : activePlanDetails?.monthlyPrice ?? 0;
  const activePlanPeriod = billingCycle === "yearly" ? "/yr" : "/mo";

  const renderGroupedPayments = () =>
    groupedPayments.map((group) => {
      const isExpanded = Boolean(expandedPaymentGroups[group.groupKey]);

      return (
        <React.Fragment key={group.groupKey}>
          <tr
            className="cursor-pointer hover:bg-gray-50 transition group"
            onClick={() => togglePaymentGroup(group.groupKey)}
          >
            <td className="px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FDF6EC] text-[#B8641A]">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{group.customer}</div>
                  <div className="text-xs font-semibold text-gray-500">
                    {group.items.length} payment{group.items.length > 1 ? "s" : ""} on this day
                  </div>
                </div>
              </div>
            </td>
            <td className="px-6 py-5 text-sm text-gray-500">{formatPaymentDate(group.date)}</td>
            <td className="px-6 py-5">
              <div className="font-bold text-gray-900">{formatCurrency(group.displayAmount)}</div>
              {group.items.length > 1 && (
                <div className="text-xs font-semibold text-gray-500">
                  {group.hasCollectibleItems
                    ? `Total activity: ${formatCurrency(group.totalAmount)}`
                    : `Recorded total: ${formatCurrency(group.totalAmount)}`}
                </div>
              )}
            </td>
            <td className="px-6 py-5">{renderStatusBadge(group.status)}</td>
            <td className="px-6 py-5 text-right">
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePaymentGroup(group.groupKey);
                  }}
                  className="h-9 px-4 bg-[#FDF6EC] text-[#B8641A] text-[11px] font-black uppercase rounded-xl hover:bg-[#F7E8D3] transition-all flex items-center justify-center"
                >
                  {isExpanded ? "Hide" : "View"} Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`https://wa.me/${group.phone}?text=Bill Reminder`, "_blank");
                  }}
                  className="h-9 w-9 flex items-center justify-center text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-100 rounded-xl transition-all"
                  title="Send Reminder"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </td>
          </tr>

          {isExpanded && (
            <tr className="bg-[#FFFCF8]">
              <td colSpan="5" className="px-6 py-4">
                <div className="overflow-hidden rounded-[24px] border border-[#EFE4D6] bg-white">
                  <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b border-[#F2EDE4] bg-[#FFF8F0] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                    <span>Customer</span>
                    <span>Date</span>
                    <span>Amount</span>
                    <span>Status</span>
                    <span className="text-right">Actions</span>
                  </div>

                  {group.items.map((pay) => (
                    <div
                      key={pay.id}
                      className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b border-[#F8F2E8] px-4 py-4 last:border-b-0"
                    >
                      <div>
                        <div className="font-bold text-gray-900">{pay.customer}</div>
                        <div className="text-xs text-gray-500">Payment ID: {pay.id}</div>
                      </div>
                      <div className="text-sm text-gray-500">{formatPaymentDate(pay.date)}</div>
                      <div className="font-bold text-gray-900">{formatCurrency(pay.amount)}</div>
                      <div>{renderStatusBadge(pay.status)}</div>
                      <div className="flex items-center justify-end gap-2">
                        {isCollectibleStatus(pay.status) && (
                          <button
                            onClick={() => setActivePaymentModal(pay)}
                            className="h-9 px-4 bg-blue-600 text-white text-[11px] font-black uppercase rounded-xl hover:bg-blue-700 shadow-md shadow-blue-100 transition-all active:scale-95 flex items-center justify-center"
                          >
                            Collect
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    });

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#2C1A0E]" style={adminShellFont}>
      <AdminMobileTopbar title="Payments & Billing" onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-8 sm:px-6 lg:ml-64 lg:px-10">
        
        {/* SECTION 1: STATS */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#3E2B18] via-[#5B3E24] to-[#8A6A46] p-6 text-white shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-10"><CreditCard size={120} /></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-200 text-sm font-medium tracking-wide">
                    SUBSCRIPTION PLAN
                  </p>
                  <h2 className="text-2xl font-bold mt-1">{activePlanLabel}</h2>
                </div>
                <span className="bg-green-400/20 text-green-100 text-xs px-2 py-1 rounded-full border border-green-400/30 font-bold uppercase tracking-widest">
                  {farmPlan?.status}
                </span>
              </div>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-3xl font-bold">₹{activePlanPrice}</span>
                <span className="text-blue-200 text-xs font-medium pb-1">{activePlanPeriod}</span>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90">
                <span className={`h-2.5 w-2.5 rounded-full ${farmPlan?.autopayEnabled ? "bg-emerald-400" : "bg-amber-300"}`} />
                {farmPlan?.autopayEnabled
                  ? `Autopay active via ${farmPlan.autopayMethod}`
                  : "Autopay not configured"}
              </div>
              <div className="mt-6 pt-6 border-t border-blue-500/30 flex justify-between items-center">
                <div className="text-xs text-blue-200">Refreshed: {farmPlan?.nextBilling ? new Date(farmPlan.nextBilling).toLocaleDateString() : "-"}</div>
                <button onClick={() => setPlanModalOpen(true)} className="px-3 py-1.5 bg-white text-blue-900 text-sm font-bold rounded-lg hover:bg-blue-50 transition">Change Plan</button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center gap-4 rounded-[28px] border border-[#EDE8DF] bg-white/95 p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
              <div className="rounded-xl bg-[#F4F7ED] p-3 text-[#6F8C45]"><DollarSign size={28} /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
                <h3 className="text-2xl font-bold text-gray-900">₹{revenue.toLocaleString()}</h3>
                {revenue > 0 && <p className="text-xs text-green-600 flex items-center mt-1 font-bold"><TrendingUp size={12} className="mr-1" /> Stable Growth</p>}
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-[28px] border border-[#EDE8DF] bg-white/95 p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
              <div className="rounded-xl bg-[#FFF1E5] p-3 text-[#C26D2C]"><Wallet size={28} /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Pending Dues</p>
                <h3 className="text-2xl font-bold text-gray-900">₹{payments.filter(p => isCollectibleStatus(p.status)).reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString()}</h3>
                <p className="text-xs text-gray-500 mt-1 font-bold italic">{groupedPayments.filter(group => group.hasCollectibleItems).length} Customer Dues</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 overflow-hidden rounded-[32px] border border-[#EDE8DF] bg-white/95 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
          <div className="flex flex-col gap-4 border-b border-[#F2EDE4] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FDF6EC] text-[#B8641A]">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-xl text-[#2C1A0E]" style={adminHeadingFont}>Dairy Razorpay Keys</h3>
                <p className="mt-1 text-sm font-semibold text-[#8B7355]">
                  Store this dairy's Razorpay credentials for customer checkout and wallet payments.
                </p>
              </div>
            </div>
            <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${
              farmPlan?.paymentsEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}>
              <ShieldCheck size={13} />
              {farmPlan?.paymentsEnabled ? farmPlan?.razorpayStatus || "CONFIGURED" : "Needs Setup"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">Key ID</span>
              <input
                type="text"
                name="razorpayKeyId"
                value={razorpayForm.razorpayKeyId}
                onChange={handleRazorpayFormChange}
                placeholder="rzp_live_xxxxxxxxxxxxx"
                className="w-full rounded-[16px] border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none transition placeholder:text-[#B7A188] focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">Key Secret</span>
              <div className="relative">
                <input
                  type={showRazorpaySecret ? "text" : "password"}
                  name="razorpayKeySecret"
                  value={razorpayForm.razorpayKeySecret}
                  onChange={handleRazorpayFormChange}
                  placeholder={farmPlan?.paymentsEnabled ? "Leave blank to keep existing secret" : "Paste Razorpay key secret"}
                  className="w-full rounded-[16px] border border-[#E7DAC6] bg-white py-3 pl-4 pr-11 text-sm font-semibold text-[#2C1A0E] outline-none transition placeholder:text-[#B7A188] focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
                />
                <button
                  type="button"
                  onClick={() => setShowRazorpaySecret((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A88763] transition hover:text-[#5C3D1E]"
                  title={showRazorpaySecret ? "Hide secret" : "Show secret"}
                >
                  {showRazorpaySecret ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <button
              type="button"
              onClick={saveRazorpaySetup}
              disabled={razorpaySaving}
              className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] px-5 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#9F5414] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {razorpaySaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              Save Keys
            </button>
          </div>
        </div>

        {/* SECTION 2: TABLE */}
        <div className="overflow-hidden rounded-[32px] border border-[#EDE8DF] bg-white/95 shadow-[0_18px_45px_rgba(92,61,30,0.08)]">
          <div className="flex flex-col justify-between gap-4 border-b border-[#F2EDE4] px-6 py-5 sm:flex-row sm:items-center">
            <h3 className="text-2xl text-[#2C1A0E]" style={adminHeadingFont}>Customer Transactions</h3>
            <div className="flex gap-2">
              {["ALL", "PAID", "PENDING", "OVERDUE"].map((s) => (
                <button key={s} onClick={() => setFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === s ? "bg-[#B8641A] text-white shadow-sm" : "bg-[#FDF6EC] text-[#8B7355] hover:bg-[#F7E8D3]"}`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[#F2EDE4] bg-[#FFFDF8] text-[10px] font-black uppercase tracking-wider text-[#C4A882]">
                <tr>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="5" className="py-10 text-center"><LoadingIndicator message="Fetching Ledger..." /></td></tr>
                ) : (
                  renderGroupedPayments() || payments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-gray-50 transition group">
                      <td className="px-6 py-5"><div className="font-bold text-gray-900">{pay.customer}</div></td>
                      <td className="px-6 py-5 text-sm text-gray-500">{new Date(pay.date).toLocaleDateString('en-GB')}</td>
                      <td className="px-6 py-5 font-bold text-gray-900">{formatCurrency(pay.amount)}</td>
                      <td className="px-6 py-5">{renderStatusBadge(pay.status)}</td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isCollectibleStatus(pay.status) && (
                            <button 
                              onClick={() => setActivePaymentModal(pay)} 
                              className="h-9 px-4 bg-blue-600 text-white text-[11px] font-black uppercase rounded-xl hover:bg-blue-700 shadow-md shadow-blue-100 transition-all active:scale-95 flex items-center justify-center"
                            >
                              Collect
                            </button>
                          )}
                          <button 
                            onClick={() => window.open(`https://wa.me/${pay.phone}?text=Bill Reminder`, "_blank")} 
                            className="h-9 w-9 flex items-center justify-center text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-100 rounded-xl transition-all"
                            title="Send Reminder"
                          >
                            <Share2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* PLAN MODAL */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(44,26,14,0.45)] p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-[#E7DAC6] bg-[#FFFDF8] shadow-[0_28px_70px_rgba(44,26,14,0.28)]">
            <div className="bg-gradient-to-r from-[#3E2B18] via-[#5B3E24] to-[#8A6A46] px-8 py-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F3D4A6]">
                    Subscription Upgrade
                  </p>
                  <h3 className="mt-2 text-2xl text-white" style={adminHeadingFont}>
                    Select Dairy Plan
                  </h3>
                  <p className="mt-1 text-sm text-white/70">
                    Choose the plan that best fits your dairy operations.
                  </p>
                </div>
                <button
                  onClick={() => setPlanModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="border-b border-[#F2EDE4] px-8 py-4">
              <div className="inline-flex rounded-[14px] border border-[#E7DAC6] bg-[#F8F3EC] p-1">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`rounded-[10px] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                    billingCycle === "monthly"
                      ? "bg-[#B8641A] text-white"
                      : "text-[#8B7355] hover:text-[#5C3D1E]"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={`rounded-[10px] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                    billingCycle === "yearly"
                      ? "bg-[#B8641A] text-white"
                      : "text-[#8B7355] hover:text-[#5C3D1E]"
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 p-8 md:grid-cols-3">
              {planOptions.map((p) => (
                <div key={p.value} className={`relative rounded-[28px] border bg-white p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)] transition ${p.value === farmPlan?.plan ? 'border-[#B8641A] ring-2 ring-[#F3D6A2]' : 'border-[#EDE8DF]'}`}>
                  {p.popular && (
                    <span className="absolute right-5 top-5 rounded-full bg-[#FFF1E4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#B8641A]">
                      Popular
                    </span>
                  )}
                  <h4 className="text-2xl font-bold text-[#2C1A0E]">{p.label}</h4>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#C4A882]">Dairy SaaS Plan</p>
                  <div className="text-3xl font-black text-[#2C1A0E] mb-6 mt-6">₹{billingCycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice}<span className="text-xs text-[#8B7355] font-normal"> / {billingCycle === 'yearly' ? 'yr' : 'mo'}</span></div>
                  <ul className="space-y-3 mb-8">
                    {p.features.map(f => <li key={f} className="text-xs text-[#6B5B3E] font-bold flex items-center gap-2"><CheckCircle size={14} className="text-[#B8641A]" /> {f}</li>)}
                  </ul>
                  <button
                    onClick={() => handlePlanSelect(p.value)}
                    disabled={p.value === farmPlan?.plan || planUpdating}
                    className={`w-full py-3 rounded-[16px] font-bold text-xs uppercase tracking-[0.12em] transition ${p.value === farmPlan?.plan ? 'bg-[#F1ECE4] text-[#B89970] cursor-default' : 'bg-[#B8641A] text-white hover:bg-[#9F5414]'} disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {p.value === farmPlan?.plan ? 'Current' : planUpdating ? 'Updating...' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* COLLECT MODAL */}
      {activePaymentModal && (
        <ManualPaymentModal
          delivery={activePaymentModal}
          onClose={() => setActivePaymentModal(null)}
          onSave={handleOfflineCollect}
        />
      )}

      {autopayModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(44,26,14,0.45)] p-2 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[24px] sm:rounded-[30px] border border-[#E7DAC6] bg-[#FFFDF8] shadow-[0_28px_70px_rgba(44,26,14,0.28)]">
            <div className="bg-gradient-to-r from-[#3E2B18] via-[#5B3E24] to-[#8A6A46] px-5 py-4 sm:px-7 sm:py-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F3D4A6]">
                    Plan Billing
                  </p>
                  <h3 className="mt-1.5 text-xl sm:text-2xl text-white" style={adminHeadingFont}>
                    Set Up Autopay
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-white/70">
                    Enable recurring billing for the {pendingAutopayPlanLabel} plan.
                  </p>
                </div>
                <button
                  onClick={skipAutopaySetup}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
              <div className="rounded-[20px] border border-[#EDE8DF] bg-[#FFF8F0] p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#B89970]">
                      Selected Plan
                    </p>
                    <h4 className="mt-1 text-lg sm:text-xl font-bold text-[#2C1A0E]">
                      {pendingAutopayPlanLabel}
                    </h4>
                    <p className="mt-1 text-xs sm:text-sm text-[#7A644A]">
                      Recurring amount: Rs. {activePlanPrice} {activePlanPeriod}
                    </p>
                  </div>
                  <div className="rounded-[16px] bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-[#5C3D1E] shadow-sm">
                    Billing cycle: {billingCycle === "yearly" ? "Yearly" : "Monthly"}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-[#B89970]">
                  Choose Autopay Method
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {autopayOptions.map((option) => {
                    const isSelected = selectedAutopayMethod === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => option.available && setSelectedAutopayMethod(option.id)}
                        disabled={!option.available}
                        className={`rounded-[20px] border p-4 text-left transition ${
                          isSelected
                            ? "border-[#B8641A] bg-[#FFF3E3] shadow-[0_18px_45px_rgba(184,100,26,0.12)]"
                            : option.available
                              ? "border-[#EDE8DF] bg-white hover:border-[#D5C3AD]"
                              : "border-[#EFE8DE] bg-[#FAF6F0] opacity-70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-base sm:text-lg font-bold text-[#2C1A0E]">{option.label}</h4>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${
                              option.available
                                ? "bg-[#EAF7E8] text-[#3C7A35]"
                                : "bg-[#F8E9E5] text-[#B45A3E]"
                            }`}
                          >
                            {option.available ? "Available" : "Needs setup"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs sm:text-sm leading-5 text-[#6B5B3E]">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[18px] border border-dashed border-[#D8C8B3] bg-[#FFFCF7] p-3 text-xs sm:text-sm leading-5 text-[#7A644A]">
                Autopay is currently saved as a billing preference and can later be connected to a full recurring mandate flow.
              </div>

              <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={skipAutopaySetup}
                  className="rounded-[14px] border border-[#E7DAC6] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7A644A] transition hover:bg-[#F8F3EC]"
                >
                  Setup Later
                </button>
                <button
                  type="button"
                  onClick={setupAutopay}
                  disabled={!selectedAutopayMethod || autopaySaving}
                  className="rounded-[14px] bg-[#B8641A] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#9F5414] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {autopaySaving ? "Saving..." : "Enable Autopay"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

