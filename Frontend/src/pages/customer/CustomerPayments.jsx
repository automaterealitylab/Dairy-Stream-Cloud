import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Filter,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import {
  createCustomerPaymentOrder,
  createCustomerWalletTopupOrder,
  fetchCustomerPayments,
  getCachedCustomerPayments,
  verifyCustomerPayment,
  verifyCustomerWalletTopup,
} from "../../api/customer/customer.api.js";

const bodyFont = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const headingFont = { fontFamily: "'Lora', serif" };

const FILTER_OPTIONS = [
  { value: "ALL", label: "All records" },
  { value: "PENDING", label: "Pending" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
];

const WALLET_TOPUP_PRESETS = [100, 250, 500, 1000];

const getAuthToken = () => {
  const storedUser = localStorage.getItem("user");
  return JSON.parse(storedUser || "{}")?.token || localStorage.getItem("token") || null;
};

const fmt = (value) => `\u20B9${Number(value || 0).toFixed(2)}`;

const formatPaymentMethodLabel = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized || normalized === "-") return "";
  if (normalized === "PAY_NOW" || normalized === "RAZORPAY") return "Online";
  if (normalized === "COD" || normalized === "CASH") return "Cash";
  if (normalized === "UPI") return "UPI";
  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDateLabel = (
  value,
  options = { day: "numeric", month: "short", year: "numeric" }
) => {
  if (!value) return "";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString("en-IN", options);
};

const dueText = (dueInDays) => {
  if (dueInDays === null || dueInDays === undefined) return "Due date not set";
  if (dueInDays < 0) return `Overdue by ${Math.abs(dueInDays)} days`;
  if (dueInDays === 0) return "Due today";
  return `Due in ${dueInDays} days`;
};

const parseTitle = (raw = "") => {
  const up = raw.toUpperCase();
  let title = "Payment";

  if (up.includes("ONE_TIME")) title = "One-time Delivery";
  else if (up.includes("SUBSCRIPTION")) title = "Subscription Delivery";
  else if (up.includes("WALLET")) title = "Wallet Topup";
  else {
    const cleaned = raw.replace(/\[.*?\]\s*/g, "").replace(/\w+=\S+;?\s*/g, "").trim();
    if (cleaned) title = cleaned;
  }

  const parts = [];
  const product = raw.match(/(?:product|milk)=([^;]+)/i)?.[1]?.trim();
  if (product) parts.push(product.charAt(0).toUpperCase() + product.slice(1));

  const qty = raw.match(/qty=([^;]+)/i)?.[1]?.trim();
  if (qty) parts.push(`${qty} L`);

  const dateStr = raw.match(/date=(\d{4}-\d{2}-\d{2})/i)?.[1];
  if (dateStr) {
    parts.push(formatDateLabel(dateStr));
  }

  return { title, subtitle: parts.join(" \u2022 ") };
};

const statusCfg = (status) => {
  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "PAID") {
    return {
      pill: "border border-[#D6EEDD] bg-[#F4FBF7] text-[#1A7A4A] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]",
      dot: "bg-[#1A7A4A]",
      label: "Paid",
    };
  }

  if (normalizedStatus === "OVERDUE") {
    return {
      pill: "border border-[#F4D1D1] bg-[#FFF5F5] text-[#C53030] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
      dot: "bg-[#C53030]",
      label: "Overdue",
    };
  }

  return {
    pill: "border border-[#F3E1B8] bg-[#FFF9EE] text-[#B45309] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    dot: "bg-[#B45309]",
    label: "Pending",
  };
};

const paymentTypeCfg = (raw = "") => {
  const normalizedTitle = String(raw || "").toUpperCase();

  if (normalizedTitle.includes("WALLET")) {
    return {
      Icon: Wallet,
      iconBg: "bg-[#EFF6FF] text-[#1D5FA5]",
    };
  }

  if (normalizedTitle.includes("SUBSCRIPTION")) {
    return {
      Icon: RefreshCw,
      iconBg: "bg-[#EBF7F1] text-[#1A7A4A]",
    };
  }

  return {
    Icon: CreditCard,
    iconBg: "bg-[#FFFBEB] text-[#B45309]",
  };
};

const getMonthEndDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
};

const getNextSubscriptionDueDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 10);
};

const INITIAL_SHOW = 7;
const EMPTY_SUMMARY = {
  monthlyDue: 0,
  overdueAmount: 0,
  overdueBaseAmount: 0,
  overduePenaltyAmount: 0,
  walletBalance: 0,
  dueInDays: null,
  beneficiary: null,
  payableTillDate: 0,
  billingSummaryAmount: 0,
};

const toPaymentsViewState = (data) => ({
  summary: {
    monthlyDue: Number(data?.summary?.monthlyDue || 0),
    overdueAmount: Number(data?.summary?.overdueAmount || 0),
    overdueBaseAmount: Number(data?.summary?.overdueBaseAmount || 0),
    overduePenaltyAmount: Number(data?.summary?.overduePenaltyAmount || 0),
    walletBalance: Number(data?.summary?.walletBalance || 0),
    dueInDays: data?.summary?.dueInDays == null ? null : Number(data.summary.dueInDays),
    beneficiary: data?.summary?.beneficiary || null,
    payableTillDate: Number(data?.summary?.payableTillDate || 0),
    billingSummaryAmount: Number(
      data?.summary?.billingSummaryAmount ??
        data?.summary?.payableTillDate ??
        data?.summary?.monthlyDue ??
        0
    ),
  },
  history: Array.isArray(data?.history) ? data.history : [],
});

export default function Payments() {
  const cachedPayments = getCachedCustomerPayments();
  const initialPaymentsState = toPaymentsViewState(cachedPayments);
  const [summary, setSummary] = useState(initialPaymentsState.summary);
  const [history, setHistory] = useState(initialPaymentsState.history);
  const [loading, setLoading] = useState(() => !cachedPayments);
  const [payingPaymentId, setPayingPaymentId] = useState(null);
  const [walletTopupAmount, setWalletTopupAmount] = useState("250");
  const [walletTopupLoading, setWalletTopupLoading] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const applyPaymentsState = (data) => {
    const nextState = toPaymentsViewState(data);
    setSummary(nextState.summary);
    setHistory(nextState.history);
  };

  const loadPayments = async ({ force = false, showSpinner = force || !getCachedCustomerPayments() } = {}) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);

    try {
      if (!getAuthToken()) throw new Error("Session expired. Please log in again.");

      const data = await fetchCustomerPayments({ force });
      applyPaymentsState(data);
    } catch (err) {
      setError(err?.message || "Failed to load payments.");
      const hasVisiblePayments =
        history.length > 0 ||
        Number(summary.billingSummaryAmount || 0) > 0 ||
        Number(summary.monthlyDue || 0) > 0 ||
        Number(summary.walletBalance || 0) > 0;

      if (!hasVisiblePayments) {
        setSummary(EMPTY_SUMMARY);
        setHistory([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadPayments({ force: true, showSpinner: false });
    }, 30000);

    const handleFocus = () => {
      loadPayments({ force: true, showSpinner: false });
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    setShowAll(false);
  }, [statusFilter]);

  useEffect(() => {
    if (!walletModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setWalletModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [walletModalOpen]);

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePayNow = async (payment, { payAll = false } = {}) => {
    try {
      if (!payAll && !payment?.id) throw new Error("No pending payment selected.");
      if (payAll && Number(summary.monthlyDue || 0) <= 0) throw new Error("Nothing to pay.");

      setPayingPaymentId(payAll ? "__ALL__" : payment.id);
      setError(null);

      if (!(await loadRazorpay())) throw new Error("Could not load payment gateway.");

      const orderPayload = await createCustomerPaymentOrder(
        payAll ? { payAll: true, includeRunningDue: false } : { paymentId: payment.id }
      );
      const { title } = parseTitle(orderPayload.payment?.title || "");

      const checkout = new window.Razorpay({
        key: orderPayload.keyId,
        amount: orderPayload.order.amount,
        currency: orderPayload.order.currency,
        name: "Dairy Stream",
        description: title,
        order_id: orderPayload.order.id,
        handler: async (res) => {
          await verifyCustomerPayment({
            paymentId: payment?.id,
            payAll,
            includeRunningDue: payAll ? false : undefined,
            razorpay_order_id: res.razorpay_order_id,
            razorpay_payment_id: res.razorpay_payment_id,
            razorpay_signature: res.razorpay_signature,
          });
          await loadPayments({ force: true });
        },
        theme: { color: "#2C1A0E" },
      });

      checkout.on("payment.failed", (res) => {
        setError(res?.error?.description || "Payment failed. Please try again.");
      });

      checkout.open();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to start payment.");
    } finally {
      setPayingPaymentId(null);
    }
  };

  const handleWalletTopup = async () => {
    try {
      const amount = Number(Number(walletTopupAmount || 0).toFixed(2));
      if (!Number.isFinite(amount) || amount < 10) {
        throw new Error("Minimum wallet top-up amount is 10.");
      }

      setWalletTopupLoading(true);
      setError(null);

      if (!(await loadRazorpay())) throw new Error("Could not load payment gateway.");

      const orderPayload = await createCustomerWalletTopupOrder({ amount });
      const checkout = new window.Razorpay({
        key: orderPayload.keyId,
        amount: orderPayload.order.amount,
        currency: orderPayload.order.currency,
        name: "Dairy Stream",
        description: `Wallet Top-up ${fmt(amount)}`,
        order_id: orderPayload.order.id,
        handler: async (res) => {
          await verifyCustomerWalletTopup({
            amount,
            razorpay_order_id: res.razorpay_order_id,
            razorpay_payment_id: res.razorpay_payment_id,
            razorpay_signature: res.razorpay_signature,
          });
          await loadPayments({ force: true });
          setWalletModalOpen(false);
        },
        theme: { color: "#2C1A0E" },
      });

      checkout.on("payment.failed", (res) => {
        setError(res?.error?.description || "Wallet top-up failed. Please try again.");
      });

      checkout.open();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to start wallet top-up.");
    } finally {
      setWalletTopupLoading(false);
    }
  };

  const nextUnpaidPayment =
    history.find((payment) =>
      ["PENDING", "OVERDUE"].includes(String(payment.status || "").toUpperCase())
    ) ?? null;

  const isOverdue = summary.dueInDays !== null && summary.dueInDays < 0;
  const hasDue = Number(summary.monthlyDue || 0) > 0;
  const walletTopupValue = Number(walletTopupAmount);
  const canTopupWallet = Number.isFinite(walletTopupValue) && walletTopupValue >= 10;
  const walletTopupButtonLabel =
    walletTopupLoading || !canTopupWallet ? "Add Money" : `Add ${fmt(walletTopupValue)}`;
  const projectedWalletBalance = summary.walletBalance + (canTopupWallet ? walletTopupValue : 0);
  const isBusy = Boolean(payingPaymentId) || walletTopupLoading || loading;
  const hasRunningSubscriptionBill = Number(summary.payableTillDate || 0) > 0;
  const subscriptionDueDateLabel = formatDateLabel(getNextSubscriptionDueDate(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const heroAmount = hasDue ? summary.monthlyDue : summary.billingSummaryAmount;
  const heroLabel = hasDue
    ? "Amount Due Now"
    : hasRunningSubscriptionBill
    ? "Running Subscription Bill"
    : "Amount Due This Month";
  const billingSummaryHelper = hasDue
    ? dueText(summary.dueInDays)
    : hasRunningSubscriptionBill
    ? "Subscription deliveries are billed monthly and due by the 10th of next month"
    : "No delivered items billed yet";

  const payeeText = summary.beneficiary?.dairyName
    ? `${summary.beneficiary.dairyName}${
        summary.beneficiary.bankName ? ` \u2022 ${summary.beneficiary.bankName}` : ""
      }`
    : "Payee details will appear here";

  const heroTagClasses = isOverdue
    ? "border border-[#dc262640] bg-[#dc262626] text-[#fecaca]"
    : hasDue
    ? "border border-[#f59e0b40] bg-[#f59e0b21] text-[#FDE68A]"
    : "border border-white/10 bg-white/10 text-white/70";

  const payAllButtonClasses =
    hasDue && nextUnpaidPayment
      ? "bg-[#B8641A] text-white hover:bg-[#9F5414] disabled:bg-white/12 disabled:text-white/40"
      : "bg-white/12 text-white/40 hover:bg-white/12 disabled:bg-white/12 disabled:text-white/40";

  const filteredHistory = history.filter((payment) => {
    if (statusFilter === "ALL") return true;
    return String(payment.status || "").toUpperCase() === statusFilter;
  });

  const visibleHistory = showAll ? filteredHistory : filteredHistory.slice(0, INITIAL_SHOW);
  const hiddenCount = Math.max(filteredHistory.length - INITIAL_SHOW, 0);
  const nextBillDateLabel = formatDateLabel(getMonthEndDate(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const nextBillHint = "Monthly bill closes at the end of the month";
  const overdueHelperText =
    Number(summary.overduePenaltyAmount || 0) > 0
      ? `${fmt(summary.overdueBaseAmount)} + ${fmt(summary.overduePenaltyAmount)}`
      : "Increases only after the 10th if unpaid";
  const lastMonthBillText =
    Number(summary.overdueBaseAmount || 0) > 0
      ? `Last month bill: ${fmt(summary.overdueBaseAmount)}`
      : "No unpaid bill from last month";
  const overdueCarryForwardText =
    Number(summary.overdueAmount || 0) > 0
      ? "This overdue stays added until that bill is paid"
      : "No overdue is being carried forward";

  return (
    <CustomerLayout>
      <div className="w-full px-0 py-4 sm:px-2 sm:py-6 md:px-4 lg:py-10" style={bodyFont}>
        <div className="rounded-[24px] border border-[#E5DCCF] bg-[#F5EFE6] p-4 shadow-[0_18px_60px_rgba(84,52,16,0.08)] sm:rounded-[30px] sm:p-7 lg:p-9 xl:p-10">
          <div className="space-y-5 sm:space-y-6 lg:space-y-7">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2
                  className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-[#2C1A0E] sm:text-[34px]"
                  style={headingFont}
                >
                  My <span className="text-[#B8641A]">Payments</span>
                </h2>

                <button
                  onClick={() => loadPayments({ force: true })}
                  disabled={loading}
                  className="inline-flex h-9 flex-shrink-0 items-center justify-center gap-1.5 self-start rounded-[10px] border border-[#E5DCCF] bg-white px-3 text-xs font-semibold text-[#8B7355] transition hover:border-[#D8C5AA] hover:text-[#5C3D1E] disabled:opacity-50 sm:h-10 sm:px-3.5 sm:text-sm"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#B89970]">
                Track bills, wallet credits, and recent payments in one place.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#C53030]">
                <XCircle size={15} className="mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <section className="relative overflow-hidden rounded-[20px] bg-[#2C1A0E] px-4 py-5 sm:rounded-[22px] sm:px-8 sm:py-6 lg:px-9 lg:py-8">
              <div className="absolute -right-8 -top-10 h-52 w-52 rounded-full bg-[rgba(184,100,26,0.15)]" />
              <div className="absolute bottom-[-52px] right-20 h-36 w-36 rounded-full bg-[rgba(245,200,122,0.08)]" />

              <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 max-w-xl">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C87A73]">
                    {heroLabel}
                  </p>
                  <h3
                    className="mt-2 break-words text-[28px] font-semibold leading-none tracking-[-0.04em] text-white sm:text-[52px]"
                    style={headingFont}
                  >
                    {fmt(heroAmount)}
                  </h3>

                  <div className="mt-4">
                    <span
                      className={`inline-flex max-w-full flex-wrap items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold leading-5 ${heroTagClasses}`}
                    >
                      <Clock size={12} />
                      {billingSummaryHelper}
                    </span>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:w-auto lg:flex-col lg:items-end">
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/40 lg:text-right">Pay to</p>
                    <p className="mt-1 break-words text-sm font-bold leading-6 text-white/85 lg:max-w-[260px] lg:text-right">
                      {payeeText}
                    </p>
                  </div>

                  <button
                    onClick={() => handlePayNow(nextUnpaidPayment, { payAll: true })}
                    disabled={isBusy || !nextUnpaidPayment || !hasDue}
                    className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-sm font-extrabold transition sm:w-auto lg:min-w-[200px] ${payAllButtonClasses}`}
                  >
                    {payingPaymentId === "__ALL__" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CreditCard size={15} />
                    )}
                    {payingPaymentId === "__ALL__"
                      ? "Opening checkout..."
                      : `Pay Now ${fmt(summary.monthlyDue)}`}
                  </button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 [grid-auto-rows:1fr] xl:grid-cols-4">
              <div className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#EDE8DF] bg-white p-3 sm:p-5">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FDE9C9] text-[#B8641A]">
                  <Wallet size={16} />
                </div>
                <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#C4A882] sm:text-[9px]">
                  Wallet Balance
                </p>
                <p
                  className="mt-1.5 break-words text-[18px] font-semibold leading-none tracking-[-0.04em] text-[#4A7C2F] sm:text-[26px]"
                  style={headingFont}
                >
                  {fmt(summary.walletBalance)}
                </p>
                <p className="mt-1.5 text-[10px] leading-4 text-[#B89970] sm:mt-2 sm:text-[11px] sm:leading-5">
                  Available for payments
                </p>
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(true)}
                  className="mt-auto inline-flex min-h-[34px] items-center gap-1.5 self-start rounded-[9px] border border-[#C0DD97] bg-[#EAF3DE] px-2.5 py-1.5 text-[10px] font-bold text-[#3B6D11] transition hover:bg-[#D9EDBE] sm:min-h-[40px] sm:px-3 sm:text-xs"
                >
                  <Plus size={12} />
                  Add Money
                </button>
              </div>

              <div className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#EDE8DF] bg-white p-3 sm:p-5">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FDECEA] text-[#C0392B]">
                  <CreditCard size={16} />
                </div>
                <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#C4A882] sm:text-[9px]">
                  Overdue
                </p>
                <p
                  className="mt-1.5 break-words text-[18px] font-semibold leading-none tracking-[-0.04em] text-[#C0392B] sm:text-[26px]"
                  style={headingFont}
                >
                  {fmt(summary.overdueAmount)}
                </p>
                <p className="mt-1.5 text-[10px] leading-4 text-[#B89970] sm:mt-2 sm:text-[11px] sm:leading-5">
                  {overdueHelperText}
                </p>
                <p className="mt-1 text-[10px] font-semibold leading-4 text-[#8B7355] sm:text-[11px] sm:leading-5">
                  {lastMonthBillText}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-[#B89970] sm:text-[11px] sm:leading-5">
                  {overdueCarryForwardText}
                </p>
              </div>

              <div className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#EDE8DF] bg-white p-3 sm:p-5">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EBF7F1] text-[#1A7A4A]">
                  <RefreshCw size={16} />
                </div>
                <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#C4A882] sm:text-[9px]">
                  Subscription Bill
                </p>
                <p
                  className="mt-1.5 break-words text-[18px] font-semibold leading-none tracking-[-0.04em] text-[#1A7A4A] sm:text-[26px]"
                  style={headingFont}
                >
                  {fmt(summary.payableTillDate)}
                </p>
                <p className="mt-1.5 text-[10px] leading-4 text-[#B89970] sm:mt-2 sm:text-[11px] sm:leading-5">
                  {hasRunningSubscriptionBill
                    ? "Running total from delivered subscription items"
                    : "Starts building as subscription deliveries are completed"}
                </p>
                <p className="mt-auto pt-2.5 text-[10px] font-semibold leading-4 text-[#8B7355] sm:pt-3 sm:text-[11px] sm:leading-5">
                  Payable by {subscriptionDueDateLabel}
                </p>
              </div>

              <div className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#EDE8DF] bg-white p-3 sm:p-5">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#E8F4E0] text-[#4A7C2F]">
                  <CalendarDays size={16} />
                </div>
                <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#C4A882] sm:text-[9px]">
                  Next Bill Date
                </p>
                <p
                  className="mt-1.5 break-words text-[18px] font-semibold leading-none tracking-[-0.04em] text-[#B8641A] sm:text-[26px]"
                  style={headingFont}
                >
                  {nextBillDateLabel}
                </p>
                <p className="mt-auto pt-2.5 text-[10px] leading-4 text-[#B89970] sm:pt-3 sm:text-[11px] sm:leading-5">
                  {nextBillHint}
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-[16px] border border-[#EDE8DF] bg-white sm:rounded-[18px]">
              <div className="flex flex-col gap-3 border-b border-[#F2EDE4] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                <div>
                  <h4 className="text-base font-extrabold text-[#2C1A0E]">Recent Payments</h4>
                  <p className="mt-1 text-xs text-[#B89970]">
                    Review your latest bills, completed payments, and pending dues.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="relative w-full sm:w-auto">
                    <Filter
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]"
                    />
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="w-full appearance-none rounded-[10px] border border-[#EDE8DF] bg-[#FAFAF7] py-2 pl-9 pr-9 text-sm font-semibold text-[#8B7355] outline-none transition hover:border-[#D8C5AA] focus:border-[#B8641A] sm:w-auto"
                    >
                      {FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8B7355]"
                    />
                  </div>

                  <span className="self-start rounded-full bg-[#FDE9C9] px-3 py-1 text-xs font-bold text-[#B8641A]">
                    {filteredHistory.length} {filteredHistory.length === 1 ? "record" : "records"}
                  </span>
                </div>
              </div>

              {loading ? (
                <LoadingIndicator className="py-16" message="Loading payments..." />
              ) : filteredHistory.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#EDE8DF] bg-[#FDF6EC] text-[#B89970]">
                    <Wallet size={24} />
                  </div>
                  <p className="mt-4 text-sm font-bold text-[#5C3D1E]">
                    {history.length === 0
                      ? "No payment records yet"
                      : "No payments match this filter"}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#B89970]">
                    {history.length === 0
                      ? "Your payment history will appear here once your first delivery is billed."
                      : "Try switching the filter to see bills from another payment status."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(120px,0.95fr)_minmax(130px,0.95fr)_minmax(170px,1fr)] md:gap-4 md:bg-[#FAFAF7] md:px-6 md:py-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#C4A882]">
                      Description
                    </p>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#C4A882]">
                      Date
                    </p>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#C4A882]">
                      Status
                    </p>
                    <p className="text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#C4A882]">
                      Amount
                    </p>
                  </div>

                  {visibleHistory.map((payment) => {
                    const cfg = statusCfg(payment.status);
                    const typeCfg = paymentTypeCfg(payment.title);
                    const { Icon } = typeCfg;
                    const normalizedStatus = String(payment.status || "").toUpperCase();
                    const isUnpaid = ["PENDING", "OVERDUE"].includes(normalizedStatus);
                    const isPaid = normalizedStatus === "PAID";
                    const { title, subtitle } = parseTitle(payment.title || "");
                    const paymentDateLabel = formatDateLabel(payment.date) || payment.date || "-";
                    const paymentMethodLabel = formatPaymentMethodLabel(payment.method);
                    const subtitleHasPaymentDate =
                      subtitle && paymentDateLabel && paymentDateLabel !== "-"
                        ? subtitle.includes(paymentDateLabel)
                        : false;
                    const paymentStatusMeta = isUnpaid
                      ? payment.dueDate
                        ? dueText(
                            Math.round(
                              (new Date(payment.dueDate).getTime() - new Date().getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                          )
                        : "Due date not set"
                      : paymentMethodLabel
                      ? `${paymentMethodLabel} payment`
                      : "Recorded payment";
                    const mobileMeta = [
                      !subtitleHasPaymentDate && paymentDateLabel !== "-" ? paymentDateLabel : "",
                      !isPaid ? paymentMethodLabel : "",
                    ]
                      .filter(Boolean)
                      .join(" \u2022 ");

                    return (
                      <div
                        key={payment.id}
                        className="border-t border-[#F2EDE4] first:border-t-0 md:first:border-t-0"
                      >
                        <div className="px-3 py-3 sm:px-6 sm:py-4">
                          <div className="md:hidden">
                            <div className="flex min-w-0 items-start gap-2">
                              <div
                                className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] ${typeCfg.iconBg}`}
                              >
                                <Icon size={15} />
                              </div>

                              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="min-w-0 flex-1 break-words text-[12px] font-bold leading-[1.35] text-[#2C1A0E]">
                                    {title}
                                  </p>
                                  {subtitle ? (
                                    <p className="mt-0.5 break-words text-[10px] leading-4 text-[#B89970]">
                                      {subtitle}
                                    </p>
                                  ) : null}
                                  {mobileMeta ? (
                                    <p className="mt-0.5 text-[10px] leading-4 text-[#B89970]">
                                      {mobileMeta}
                                    </p>
                                  ) : !subtitle ? (
                                    <p className="mt-0.5 text-[10px] leading-4 text-[#B89970]">
                                      Payment details will appear here.
                                    </p>
                                  ) : null}

                                  <div className="mt-1 flex flex-nowrap items-center gap-1.5 px-3 py-1">
                                    <p className="truncate text-[10px] font-medium leading-none text-[#7B654B]">
                                      {paymentStatusMeta}
                                    </p>
                                    <span
                                      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold leading-none ${cfg.pill}`}
                                    >
                                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                      {cfg.label}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                                  <p
                                    className="whitespace-nowrap pt-0.5 text-[15px] font-semibold leading-none tracking-[-0.03em] text-[#2C1A0E]"
                                    style={headingFont}
                                  >
                                    {fmt(payment.amount)}
                                  </p>

                                  {isUnpaid && (
                                    <button
                                      onClick={() => handlePayNow(payment)}
                                      disabled={isBusy}
                                      className="inline-flex min-h-[30px] items-center gap-1 rounded-[9px] bg-[#2C1A0E] px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#B8641A] disabled:cursor-not-allowed disabled:bg-[#DDD2BF] disabled:text-[#8B7355]"
                                    >
                                      {payingPaymentId === payment.id ? (
                                        <Loader2 size={10} className="animate-spin" />
                                      ) : (
                                        <CreditCard size={10} />
                                      )}
                                      {payingPaymentId === payment.id ? "Opening..." : "Pay Bill"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="hidden md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(120px,0.95fr)_minmax(130px,0.95fr)_minmax(170px,1fr)] md:items-center md:gap-4">
                            <div className="flex min-w-0 items-start gap-3">
                              <div
                                className={`mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] ${typeCfg.iconBg}`}
                              >
                                <Icon size={17} />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#2C1A0E]">{title}</p>
                                <p className="mt-1 truncate text-xs text-[#B89970]">
                                  {subtitle || "Monthly dairy billing"}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-[#5C3D1E]">{paymentDateLabel}</p>
                            </div>

                            <div className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-medium text-[#7B654B]">
                                  {paymentStatusMeta}
                                </p>
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold ${cfg.pill}`}
                                >
                                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.label}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col items-start gap-2 md:items-end">
                              <p
                                className="text-[22px] font-semibold leading-none tracking-[-0.03em] text-[#2C1A0E]"
                                style={headingFont}
                              >
                                {fmt(payment.amount)}
                              </p>

                              {isUnpaid && (
                                <button
                                  onClick={() => handlePayNow(payment)}
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#2C1A0E] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#B8641A] disabled:cursor-not-allowed disabled:bg-[#DDD2BF] disabled:text-[#8B7355]"
                                >
                                  {payingPaymentId === payment.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <CreditCard size={12} />
                                  )}
                                  {payingPaymentId === payment.id ? "Opening..." : "Pay Bill"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredHistory.length > INITIAL_SHOW && (
                    <button
                      onClick={() => setShowAll((prev) => !prev)}
                      className="flex w-full items-center justify-center gap-1.5 border-t border-[#F2EDE4] px-4 py-4 text-sm font-semibold text-[#8B7355] transition hover:bg-[#FDF6EC] hover:text-[#B8641A]"
                    >
                      {showAll ? (
                        <>
                          <ChevronUp size={14} /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> Show {hiddenCount} more payments
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {walletModalOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(20,10,4,0.55)] px-0 py-0 sm:items-center sm:px-4 sm:py-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setWalletModalOpen(false);
            }
          }}
        >
          <div className="h-[100svh] w-full max-w-[420px] overflow-hidden rounded-none bg-white shadow-[0_30px_90px_rgba(30,16,8,0.24)] sm:h-auto sm:max-h-[92vh] sm:rounded-[22px]">
            <div className="h-[3px] w-full bg-[linear-gradient(90deg,#3B6D11_0%,#97C459_100%)]" />

            <div className="border-b border-[#F2EAE0] px-5 pb-5 pt-6 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#EAF3DE] text-[#3B6D11]">
                    <Wallet size={20} />
                  </div>
                  <h3
                    className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#1E1008]"
                    style={headingFont}
                  >
                    Add Money to Wallet
                  </h3>
                  <p className="mt-2 text-sm text-[#B89970]">
                    Recharge instantly {"\u2022"} Used for future bills {"\u2022"} Min. {fmt(10)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setWalletModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F2EB] text-[#8B7355] transition hover:bg-[#EDE4D8]"
                  aria-label="Close wallet top-up"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-6 sm:px-6">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                  Quick Select
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WALLET_TOPUP_PRESETS.map((amount) => {
                    const selected = walletTopupAmount === String(amount);

                    return (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setWalletTopupAmount(String(amount))}
                        className={`rounded-[10px] border px-3 py-2.5 text-sm font-bold transition ${
                          selected
                            ? "border-[#3B6D11] bg-[#EAF3DE] text-[#3B6D11]"
                            : "border-[#EDE8DF] bg-[#FAFAF7] text-[#8B7355] hover:border-[#B8641A] hover:bg-[#FEF6EC] hover:text-[#B8641A]"
                        }`}
                      >
                        {fmt(amount)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                  Or Enter Custom Amount
                </p>
                <label className="relative block">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-[#8B7355]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    inputMode="decimal"
                    value={walletTopupAmount}
                    onChange={(event) => setWalletTopupAmount(event.target.value)}
                    placeholder="Enter amount"
                    className="w-full rounded-[11px] border-[1.5px] border-[#EDE8DF] bg-[#FAFAF7] py-3 pl-8 pr-4 text-base font-semibold text-[#1E1008] outline-none transition placeholder:font-normal placeholder:text-[#C4A882] focus:border-[#3B6D11]"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2 rounded-[11px] border border-[#C0DD97] bg-[#F0F8E8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-[#4A7C2F]">
                  Current balance {"\u2192"} New balance after top-up
                </p>
                <p
                  className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-[#3B6D11]"
                  style={headingFont}
                >
                  {fmt(projectedWalletBalance)}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#B89970]">
                <Info size={13} />
                Amount will be credited instantly to your DairyStream wallet.
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(false)}
                  className="rounded-[11px] border border-[#EDE4D8] bg-[#F7F2EB] px-4 py-3 text-sm font-bold text-[#8B7355] transition hover:bg-[#EDE4D8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleWalletTopup}
                  disabled={loading || walletTopupLoading || !canTopupWallet}
                  className="inline-flex items-center justify-center gap-2 rounded-[11px] bg-[#1E1008] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3B6D11] disabled:cursor-not-allowed disabled:bg-[#D4C4A8] disabled:text-[#8B7355]"
                >
                  {walletTopupLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  {walletTopupLoading ? "Opening checkout..." : walletTopupButtonLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
}
