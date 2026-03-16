import React, { useEffect, useState } from "react";
import {
  CheckCircle, Clock, CreditCard, Loader2,
  Wallet, XCircle, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import {
  createCustomerPaymentOrder,
  fetchCustomerPayments,
  verifyCustomerPayment,
} from "../../api/customer/customer.api.js";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";

// ─── helpers ──────────────────────────────────────────────────────────────────

const getAuthToken = () => {
  const storedUser = localStorage.getItem("user");
  return JSON.parse(storedUser || "{}")?.token || localStorage.getItem("token") || null;
};

const fmt = (value) => `₹${Number(value || 0).toFixed(2)}`;

const dueText = (dueInDays) => {
  if (dueInDays === null || dueInDays === undefined) return "Due date not set";
  if (dueInDays < 0)   return `Overdue by ${Math.abs(dueInDays)} days`;
  if (dueInDays === 0) return "Due today";
  return `Due in ${dueInDays} days`;
};

/**
 * Parses raw DB title strings into a human-readable title + subtitle.
 * "[ONE_TIME_PAYMENT] delivery_id=51; product=cow milk; qty=1; date=2026-03-16"
 *   → { title: "One-time Delivery", subtitle: "Cow milk · 1 L · 16 Mar 2026" }
 */
const parseTitle = (raw = "", fallbackDate = "") => {
  const up = raw.toUpperCase();
  let title = "Payment";
  if (up.includes("ONE_TIME"))      title = "One-time Delivery";
  else if (up.includes("SUBSCRIPTION")) title = "Subscription Delivery";
  else if (up.includes("WALLET"))   title = "Wallet Topup";
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
    parts.push(new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    }));
  } else if (fallbackDate) {
    parts.push(fallbackDate);
  }

  return { title, subtitle: parts.join(" · ") };
};

const statusCfg = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "PAID")    return { pill: "bg-green-50 text-green-700",  iconBg: "bg-green-50 text-green-600",  Icon: CheckCircle, label: "Paid"    };
  if (s === "OVERDUE") return { pill: "bg-red-50 text-red-600",      iconBg: "bg-red-50 text-red-500",      Icon: XCircle,     label: "Overdue" };
  return                      { pill: "bg-amber-50 text-amber-700",  iconBg: "bg-amber-50 text-amber-500",  Icon: Clock,       label: "Pending" };
};

const INITIAL_SHOW = 7;

// ─── component ────────────────────────────────────────────────────────────────

export default function Payments() {
  const [summary, setSummary] = useState({
    monthlyDue: 0, walletBalance: 0, dueInDays: null, beneficiary: null,
  });
  const [history,         setHistory]         = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [payingPaymentId, setPayingPaymentId] = useState(null);
  const [error,           setError]           = useState(null);
  const [showAll,         setShowAll]         = useState(false);

  // ── data ────────────────────────────────────────────────────────────────────
  const loadPayments = async () => {
    setLoading(true); setError(null);
    try {
      if (!getAuthToken()) throw new Error("Session expired. Please log in again.");
      const data = await fetchCustomerPayments();
      setSummary({
        monthlyDue:    Number(data?.summary?.monthlyDue    || 0),
        walletBalance: Number(data?.summary?.walletBalance || 0),
        dueInDays:     data?.summary?.dueInDays == null ? null : Number(data.summary.dueInDays),
        beneficiary:   data?.summary?.beneficiary || null,
      });
      setHistory(Array.isArray(data?.history) ? data.history : []);
    } catch (err) {
      setError(err?.message || "Failed to load payments.");
      setSummary({ monthlyDue: 0, walletBalance: 0, dueInDays: null, beneficiary: null });
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPayments(); }, []);

  // ── razorpay ────────────────────────────────────────────────────────────────
  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload  = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handlePayNow = async (payment, { payAll = false } = {}) => {
    try {
      if (!payAll && !payment?.id)                        throw new Error("No pending payment selected.");
      if (payAll && Number(summary.monthlyDue || 0) <= 0) throw new Error("Nothing to pay.");

      setPayingPaymentId(payAll ? "__ALL__" : payment.id);
      setError(null);

      if (!await loadRazorpay()) throw new Error("Could not load payment gateway.");

      const orderPayload = await createCustomerPaymentOrder(
        payAll ? { payAll: true } : { paymentId: payment.id }
      );

      const { title } = parseTitle(orderPayload.payment?.title || "");

      const checkout = new window.Razorpay({
        key:         orderPayload.keyId,
        amount:      orderPayload.order.amount,
        currency:    orderPayload.order.currency,
        name:        "Dairy Stream",
        description: title,
        order_id:    orderPayload.order.id,
        handler: async (res) => {
          await verifyCustomerPayment({
            paymentId: payment?.id, payAll,
            razorpay_order_id:   res.razorpay_order_id,
            razorpay_payment_id: res.razorpay_payment_id,
            razorpay_signature:  res.razorpay_signature,
          });
          await loadPayments();
        },
        theme: { color: "#111111" },
      });
      checkout.on("payment.failed", (r) =>
        setError(r?.error?.description || "Payment failed. Please try again.")
      );
      checkout.open();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to start payment.");
    } finally {
      setPayingPaymentId(null);
    }
  };

  // ── derived ─────────────────────────────────────────────────────────────────
  const nextUnpaidPayment = history.find((p) =>
    ["PENDING", "OVERDUE"].includes(String(p.status || "").toUpperCase())
  ) ?? null;

  const isOverdue = summary.dueInDays !== null && summary.dueInDays < 0;
  const hasDue    = Number(summary.monthlyDue || 0) > 0;
  const isBusy    = Boolean(payingPaymentId) || loading;

  // Show first 7, rest on demand
  const visibleHistory = showAll ? history : history.slice(0, INITIAL_SHOW);
  const hiddenCount    = history.length - INITIAL_SHOW;

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <CustomerLayout>
      <div className="w-full px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
          <button
            onClick={loadPayments}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 transition disabled:opacity-40"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
            <XCircle size={15} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* ── Billing summary card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-gray-400 tracking-widest font-semibold mb-2">
              Billing Summary
            </p>
            <h3 className="text-4xl font-bold text-gray-900 tracking-tight">
              {fmt(summary.monthlyDue)}
            </h3>
            <p className={`text-sm font-medium mt-1.5 ${isOverdue ? "text-red-500" : "text-amber-500"}`}>
              {dueText(summary.dueInDays)}
            </p>
            {summary.beneficiary?.dairyName && (
              <p className="text-xs text-gray-400 mt-1">
                Payee: {summary.beneficiary.dairyName}
                {summary.beneficiary.bankName ? ` · ${summary.beneficiary.bankName}` : ""}
              </p>
            )}
          </div>
          <div className="md:text-right">
            <p className="text-xs text-gray-400 font-medium mb-1">Wallet Balance</p>
            <p className="text-lg font-semibold text-gray-900">{fmt(summary.walletBalance)}</p>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-1.5">
                Pending + Overdue
              </p>
              <p className="text-2xl font-bold text-red-500">{fmt(summary.monthlyDue)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-400 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-1.5">
                Wallet Balance
              </p>
              <p className="text-2xl font-bold text-blue-500">{fmt(summary.walletBalance)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-400 flex items-center justify-center">
              <Wallet size={18} />
            </div>
          </div>
        </div>

        {/* ── Pay All CTA ── */}
        <div className="flex justify-end">
          <button
            onClick={() => handlePayNow(nextUnpaidPayment, { payAll: true })}
            disabled={isBusy || !nextUnpaidPayment || !hasDue}
            className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-gray-700 transition active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {isBusy
              ? <Loader2 size={14} className="animate-spin" />
              : <CreditCard size={14} />}
            {payingPaymentId === "__ALL__"
              ? "Opening checkout…"
              : `Pay Now ${fmt(summary.monthlyDue)}`}
          </button>
        </div>

        {/* ── Payment history ── */}
        <div className="bg-white rounded-2xl border border-gray-100">

          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h4 className="text-base font-semibold text-gray-900">Recent Payments</h4>
            <span className="text-xs text-gray-400">{history.length} records</span>
          </div>

          {loading ? (
            <LoadingIndicator className="py-12" message="Loading payments…" />
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No payment records found.
            </div>
          ) : (
            <>
              {visibleHistory.map((payment) => {
                const cfg      = statusCfg(payment.status);
                const { Icon } = cfg;
                const isUnpaid = ["PENDING", "OVERDUE"].includes(
                  String(payment.status || "").toUpperCase()
                );
                const { title, subtitle } = parseTitle(
                  payment.title || "",
                  payment.date  || ""
                );

                return (
                  <div
                    key={payment.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 py-4 border-b border-gray-50 last:border-none hover:bg-gray-50/50 transition-colors"
                  >
                    {/* left: icon + info */}
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {subtitle || payment.date || "—"}
                          {payment.method && payment.method !== "-" && (
                            <>
                              <span className="text-gray-300 mx-1">·</span>
                              {payment.method}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* right: amount + actions */}
                    <div className="flex items-center gap-2.5 md:flex-shrink-0 pl-12 md:pl-0">
                      <p className="font-semibold text-gray-900 tabular-nums">
                        {fmt(payment.amount)}
                      </p>

                      {isUnpaid && (
                        <button
                          onClick={() => handlePayNow(payment)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-gray-700 transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          {payingPaymentId === payment.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : null}
                          {payingPaymentId === payment.id ? "Opening…" : "Pay Bill"}
                        </button>
                      )}

                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.pill}`}>
                        {badge(payment.status)}
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* show more / show less */}
              {history.length > INITIAL_SHOW && (
                <button
                  onClick={() => setShowAll((p) => !p)}
                  className="w-full flex items-center justify-center gap-1.5 py-3.5 border-t border-gray-50 text-xs font-semibold text-gray-400 hover:text-gray-700 hover:bg-gray-50/50 transition-colors"
                >
                  {showAll ? (
                    <><ChevronUp size={14} /> Show less</>
                  ) : (
                    <><ChevronDown size={14} /> Show {hiddenCount} more payments</>
                  )}
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </CustomerLayout>
  );
}

// tiny helper to render the right icon inline without JSX inside a const
function badge(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PAID")    return <CheckCircle size={11} />;
  if (s === "OVERDUE") return <XCircle size={11} />;
  return <Clock size={11} />;
}