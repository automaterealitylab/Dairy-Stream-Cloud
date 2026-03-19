import React, { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  Wallet,
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

const headingFont = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

const getAuthToken = () => {
  const storedUser = localStorage.getItem("user");
  return JSON.parse(storedUser || "{}")?.token || localStorage.getItem("token") || null;
};

const fmt = (value) => `₹${Number(value || 0).toFixed(2)}`;

const dueText = (dueInDays) => {
  if (dueInDays === null || dueInDays === undefined) return "Due date not set";
  if (dueInDays < 0) return `Overdue by ${Math.abs(dueInDays)} days`;
  if (dueInDays === 0) return "Due today";
  return `Due in ${dueInDays} days`;
};

const parseTitle = (raw = "", fallbackDate = "") => {
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
    parts.push(
      new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    );
  } else if (fallbackDate) {
    parts.push(fallbackDate);
  }

  return { title, subtitle: parts.join(" · ") };
};

const statusCfg = (status) => {
  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "PAID") {
    return {
      pill: "bg-[#EBF7F1] text-[#1A7A4A]",
      dot: "bg-[#1A7A4A]",
      label: "Paid",
    };
  }

  if (normalizedStatus === "OVERDUE") {
    return {
      pill: "bg-[#FEF2F2] text-[#C53030]",
      dot: "bg-[#C53030]",
      label: "Overdue",
    };
  }

  return {
    pill: "bg-[#FFFBEB] text-[#B45309]",
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

const INITIAL_SHOW = 7;
const EMPTY_SUMMARY = {
  monthlyDue: 0,
  walletBalance: 0,
  dueInDays: null,
  beneficiary: null,
  payableTillDate: 0,
  billingSummaryAmount: 0,
};

const toPaymentsViewState = (data) => ({
  summary: {
    monthlyDue: Number(data?.summary?.monthlyDue || 0),
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
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

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
        payAll ? { payAll: true } : { paymentId: payment.id }
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
            razorpay_order_id: res.razorpay_order_id,
            razorpay_payment_id: res.razorpay_payment_id,
            razorpay_signature: res.razorpay_signature,
          });
          await loadPayments({ force: true });
        },
        theme: { color: "#111111" },
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

  const nextUnpaidPayment =
    history.find((payment) =>
      ["PENDING", "OVERDUE"].includes(String(payment.status || "").toUpperCase())
    ) ?? null;

  const isOverdue = summary.dueInDays !== null && summary.dueInDays < 0;
  const hasDue = Number(summary.monthlyDue || 0) > 0;
  const isBusy = Boolean(payingPaymentId) || loading;
  const hasDeliveredRunningBill = Number(summary.payableTillDate || 0) > 0;
  const billingSummaryHelper = hasDue
    ? dueText(summary.dueInDays)
    : hasDeliveredRunningBill
    ? "Updates automatically as deliveries are completed"
    : "No delivered items billed yet";

  const payeeText = summary.beneficiary?.dairyName
    ? `${summary.beneficiary.dairyName}${
        summary.beneficiary.bankName ? ` · ${summary.beneficiary.bankName}` : ""
      }`
    : "Payee details will appear here";

  const heroTagClasses = isOverdue
    ? "border border-[#dc262640] bg-[#dc262626] text-[#fecaca]"
    : hasDue
    ? "border border-[#d9770640] bg-[#d9770629] text-[#fcd34d]"
    : "border border-white/10 bg-white/10 text-white/70";

  const payAllButtonClasses =
    hasDue && nextUnpaidPayment
      ? "bg-[#D97706] text-white hover:bg-[#B45309] disabled:bg-white/15 disabled:text-white/45"
      : "bg-white/12 text-white/40 hover:bg-white/12 disabled:bg-white/12 disabled:text-white/40";

  const visibleHistory = showAll ? history : history.slice(0, INITIAL_SHOW);
  const hiddenCount = history.length - INITIAL_SHOW;

  return (
    <CustomerLayout>
      <div className="w-full px-2 py-8 md:px-4 lg:py-10" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="rounded-[30px] border border-[#B491502E] bg-[#F5F0E8] p-5 shadow-[0_18px_60px_rgba(84,52,16,0.08)] sm:p-7 lg:p-9 xl:p-10">
          <div className="space-y-7 lg:space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  className="text-[28px] font-extrabold tracking-[-0.03em] text-[#2C2416]"
                  style={headingFont}
                >
                  My <span className="text-[#B45309]">Payments</span>
                </h2>
                <p className="mt-1 text-sm text-[#8B7355]">
                  Track bills, wallet credits, and recent payments in one place.
                </p>
              </div>

              <button
                onClick={() => loadPayments({ force: true })}
                disabled={loading}
                className="inline-flex items-center gap-2 self-start rounded-[12px] border border-[#B491502E] bg-[#FFFDF7] px-4 py-2 text-xs font-semibold text-[#6B5B3E] transition hover:border-[#D97706] hover:text-[#B45309] disabled:opacity-50"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#C53030]">
                <XCircle size={15} className="mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="grid gap-7 xl:grid-cols-[minmax(0,0.92fr)_minmax(380px,1.08fr)] xl:items-start xl:gap-8">
              <div className="space-y-7">
                <div className="rounded-[20px] border border-[#B4915020] bg-[#FFFDF7] px-5 py-4 xl:px-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A8936A]">
                    Payments Overview
                  </p>
                  <div className="mt-2 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <h3
                        className="text-[26px] font-extrabold tracking-[-0.04em] text-[#2C2416]"
                        style={headingFont}
                      >
                        Desktop-ready billing view
                      </h3>
                      <p className="mt-1 text-sm text-[#8B7355]">
                        Summary cards stay on the left while recent payments get a full desktop panel.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF8EC] px-3 py-1 text-xs font-semibold text-[#B45309]">
                      <Clock size={12} />
                      Live payment status
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] p-7 sm:p-9 xl:min-h-[320px]">
                  <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-[rgba(217,119,6,0.12)]" />
                  <div className="absolute -bottom-16 left-6 h-40 w-40 rounded-full bg-[rgba(255,255,255,0.04)]" />

                  <div className="relative z-10">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
                      Billing Summary
                    </p>
                    <h3
                      className="mt-2 text-[44px] font-extrabold leading-none tracking-[-0.05em] text-white sm:text-[52px]"
                      style={headingFont}
                    >
                      {fmt(summary.billingSummaryAmount)}
                    </h3>

                    <div className="mt-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${heroTagClasses}`}
                      >
                        <Clock size={12} />
                        {billingSummaryHelper}
                      </span>
                    </div>

                    {hasDeliveredRunningBill && (
                      <p className="mt-3 text-sm text-white/60">
                        Delivered till date:{" "}
                        <span className="font-semibold text-white/80">{fmt(summary.payableTillDate)}</span>
                      </p>
                    )}

                    <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-white/55">
                        Payee: <span className="font-semibold text-white/80">{payeeText}</span>
                      </p>

                      <button
                        onClick={() => handlePayNow(nextUnpaidPayment, { payAll: true })}
                        disabled={isBusy || !nextUnpaidPayment || !hasDue}
                        className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-5 py-3 text-sm font-bold transition ${payAllButtonClasses}`}
                        style={headingFont}
                      >
                        {isBusy ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                        {payingPaymentId === "__ALL__"
                          ? "Opening checkout..."
                          : `Pay Now ${fmt(summary.monthlyDue)}`}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="rounded-[18px] border border-[#B491502E] bg-[#FFFDF7] p-5">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#EBF7F1] text-[#1A7A4A]">
                      <Wallet size={18} />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A8936A]">
                      Wallet Balance
                    </p>
                    <p
                      className="mt-2 text-[30px] font-extrabold leading-none tracking-[-0.04em] text-[#1A7A4A]"
                      style={headingFont}
                    >
                      {fmt(summary.walletBalance)}
                    </p>
                    <p className="mt-2 text-xs text-[#A8936A]">Available balance</p>
                  </div>

                  <div className="rounded-[18px] border border-[#B491502E] bg-[#FFFDF7] p-5">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#FEF2F2] text-[#C53030]">
                      <CreditCard size={18} />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A8936A]">
                      Pending + Overdue
                    </p>
                    <p
                      className="mt-2 text-[30px] font-extrabold leading-none tracking-[-0.04em] text-[#C53030]"
                      style={headingFont}
                    >
                      {fmt(summary.monthlyDue)}
                    </p>
                    <p className="mt-2 text-xs text-[#A8936A]">Outstanding bills</p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-[#B491502E] bg-[#FFFDF7] xl:min-h-[100%]">
                <div className="flex items-center justify-between border-b border-[#B4915020] px-5 py-4 sm:px-6">
                  <div>
                    <h4 className="text-base font-extrabold text-[#2C2416]" style={headingFont}>
                      Recent Payments
                    </h4>
                    <p className="mt-1 text-xs text-[#A8936A]">
                      Recent transactions and pending bills
                    </p>
                  </div>
                  <span className="rounded-full bg-[#FFF8EC] px-3 py-1 text-xs font-semibold text-[#A8936A]">
                    {history.length} records
                  </span>
                </div>

                {loading ? (
                  <LoadingIndicator className="py-16" message="Loading payments..." />
                ) : history.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF8EC] text-[#A8936A]">
                      <Wallet size={24} />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-[#6B5B3E]">No payment records found yet.</p>
                    <p className="mt-1 text-xs text-[#A8936A]">
                      Your transactions will appear here once deliveries begin.
                    </p>
                  </div>
                ) : (
                  <>
                    {visibleHistory.map((payment) => {
                      const cfg = statusCfg(payment.status);
                      const typeCfg = paymentTypeCfg(payment.title);
                      const { Icon } = typeCfg;
                      const isUnpaid = ["PENDING", "OVERDUE"].includes(
                        String(payment.status || "").toUpperCase()
                      );
                      const { title, subtitle } = parseTitle(payment.title || "", payment.date || "");

                      return (
                        <div
                          key={payment.id}
                          className="flex flex-col gap-3 border-b border-[#B4915020] px-5 py-4 transition hover:bg-[#FFF8EC] md:flex-row md:items-center md:justify-between sm:px-6"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] ${typeCfg.iconBg}`}
                            >
                              <Icon size={17} />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#2C2416]">{title}</p>
                              <p className="mt-0.5 truncate text-xs text-[#A8936A]">
                                {subtitle || payment.date || "-"}
                                {payment.method && payment.method !== "-" ? ` · ${payment.method}` : ""}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pl-[52px] md:pl-0">
                            <p
                              className="mr-1 text-sm font-extrabold text-[#2C2416]"
                              style={headingFont}
                            >
                              {fmt(payment.amount)}
                            </p>

                            {isUnpaid && (
                              <button
                                onClick={() => handlePayNow(payment)}
                                disabled={isBusy}
                                className="inline-flex items-center gap-1 rounded-[10px] bg-[#2C2416] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#B45309] disabled:cursor-not-allowed disabled:bg-[#DDD2BF] disabled:text-[#8B7355]"
                              >
                                {payingPaymentId === payment.id ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <CreditCard size={11} />
                                )}
                                {payingPaymentId === payment.id ? "Opening..." : "Pay Bill"}
                              </button>
                            )}

                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold ${cfg.pill}`}
                            >
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {history.length > INITIAL_SHOW && (
                      <button
                        onClick={() => setShowAll((prev) => !prev)}
                        className="flex w-full items-center justify-center gap-1.5 border-t border-[#B4915020] px-4 py-4 text-sm font-semibold text-[#A8936A] transition hover:bg-[#FFF8EC] hover:text-[#B45309]"
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
