import React, { useEffect, useState } from "react";
import { CheckCircle, Clock, CreditCard, Loader2, Wallet, XCircle } from "lucide-react";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import {
  createCustomerPaymentOrder,
  fetchCustomerPayments,
  verifyCustomerPayment,
} from "../../api/customer/customer.api.js";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";

const getAuthToken = () => {
  const storedUser = localStorage.getItem("user");
  const storedToken = storedUser ? JSON.parse(storedUser)?.token : null;
  return storedToken || localStorage.getItem("token") || null;
};

const formatCurrency = (value) => `Rs ${Number(value || 0).toFixed(2)}`;
const dueText = (dueInDays) => {
  if (dueInDays === null || dueInDays === undefined) return "Due date not set";
  if (dueInDays < 0) return `Overdue by ${Math.abs(dueInDays)} days`;
  if (dueInDays === 0) return "Due today";
  return `Due in ${dueInDays} days`;
};

const statusBadge = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "PAID") {
    return {
      className: "bg-green-50 text-green-700",
      icon: <CheckCircle size={16} />,
      label: "Paid",
    };
  }
  if (value === "OVERDUE") {
    return {
      className: "bg-red-50 text-red-700",
      icon: <XCircle size={16} />,
      label: "Overdue",
    };
  }
  return {
    className: "bg-yellow-50 text-yellow-700",
    icon: <Clock size={16} />,
    label: "Pending",
  };
};

const Payments = () => {
  const [summary, setSummary] = useState({
    monthlyDue: 0,
    walletBalance: 0,
    dueInDays: null,
    beneficiary: null,
  });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payingPaymentId, setPayingPaymentId] = useState(null);
  const [error, setError] = useState(null);

  const loadPayments = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      if (!token) throw new Error("Customer token missing");

      const data = await fetchCustomerPayments();
      setSummary({
        monthlyDue: Number(data?.summary?.monthlyDue || 0),
        walletBalance: Number(data?.summary?.walletBalance || 0),
        dueInDays:
          data?.summary?.dueInDays === null || data?.summary?.dueInDays === undefined
            ? null
            : Number(data.summary.dueInDays),
        beneficiary: data?.summary?.beneficiary || null,
      });
      setHistory(Array.isArray(data?.history) ? data.history : []);
    } catch (err) {
      setError(err?.message || "Failed to load payments");
      setSummary({
        monthlyDue: 0,
        walletBalance: 0,
        dueInDays: null,
        beneficiary: null,
      });
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const nextUnpaidPayment =
    history.find((item) => ["PENDING", "OVERDUE"].includes(String(item.status || "").toUpperCase())) ||
    null;

  const loadRazorpayCheckoutScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePayNow = async (payment, { payAll = false } = {}) => {
    try {
      if (!payAll && !payment?.id) {
        throw new Error("No pending payment found");
      }
      if (payAll && Number(summary.monthlyDue || 0) <= 0) {
        throw new Error("No pending payment found");
      }

      setPayingPaymentId(payAll ? "__ALL__" : payment.id);
      setError(null);

      const scriptLoaded = await loadRazorpayCheckoutScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load Razorpay checkout");
      }

      const orderPayload = await createCustomerPaymentOrder(
        payAll ? { payAll: true } : { paymentId: payment.id }
      );

      const options = {
        key: orderPayload.keyId,
        amount: orderPayload.order.amount,
        currency: orderPayload.order.currency,
        name: "Dairy Stream",
        description: orderPayload.payment?.title || "Milk Bill Payment",
        order_id: orderPayload.order.id,
        handler: async function onPaymentSuccess(response) {
          await verifyCustomerPayment({
            paymentId: payment?.id,
            payAll,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          await loadPayments();
        },
        theme: {
          color: "#2563eb",
        },
      };

      const checkout = new window.Razorpay(options);
      checkout.on("payment.failed", (failedResponse) => {
        setError(failedResponse?.error?.description || "Payment failed");
      });
      checkout.open();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to start payment");
    } finally {
      setPayingPaymentId(null);
    }
  };

  return (
    <CustomerLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
          <button
            onClick={loadPayments}
            disabled={loading}
            className="inline-flex items-center gap-2 text-blue-600 text-sm font-medium hover:underline disabled:text-gray-400"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="bg-yellow-50 text-yellow-700 p-4 rounded-xl border border-yellow-100">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:justify-between gap-6">
          <div>
            <p className="text-xs uppercase text-gray-400 tracking-wide">Billing Summary</p>
            <h3 className="text-3xl font-bold text-gray-900 mt-2">
              {formatCurrency(summary.monthlyDue)}
            </h3>
            <p className="text-sm text-red-500 mt-1">{dueText(summary.dueInDays)}</p>
            {summary.beneficiary?.dairyName && (
              <p className="text-xs text-gray-500 mt-2">
                Payee: {summary.beneficiary.dairyName}
                {summary.beneficiary.bankName ? ` (${summary.beneficiary.bankName})` : ""}
              </p>
            )}
          </div>

          <div className="space-y-2 text-right">
            <p className="text-sm text-gray-400">Wallet Balance</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(summary.walletBalance)}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-green-700">Pending + Overdue Due</p>
              <p className="text-xs text-green-600 mt-1">{formatCurrency(summary.monthlyDue)}</p>
            </div>
            <CreditCard className="text-green-600" />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-blue-700">Wallet</p>
              <p className="text-xs text-blue-600 mt-1">{formatCurrency(summary.walletBalance)}</p>
            </div>
            <Wallet className="text-blue-600" />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => handlePayNow(nextUnpaidPayment, { payAll: true })}
            disabled={Boolean(payingPaymentId) || loading || !nextUnpaidPayment || Number(summary.monthlyDue || 0) <= 0}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-gray-300"
          >
            {(Boolean(payingPaymentId) || loading) && <Loader2 size={14} className="animate-spin" />}
            {payingPaymentId === "__ALL__"
              ? "Opening checkout..."
              : `Pay Now ${formatCurrency(summary.monthlyDue)}`}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h4 className="text-lg font-semibold text-gray-900">Recent Payments</h4>

          {loading ? (
            <LoadingIndicator className="py-8" message="Loading payments..." />
          ) : history.length === 0 ? (
            <div className="text-gray-600 py-4">No payment records found.</div>
          ) : (
            history.map((payment) => {
              const badge = statusBadge(payment.status);
              const isUnpaid = ["PENDING", "OVERDUE"].includes(String(payment.status || "").toUpperCase());

              return (
                <div
                  key={payment.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b last:border-b-0 pb-4 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{payment.title || "Milk Bill"}</p>
                    <p className="text-xs text-gray-500">{payment.date || "-"}</p>
                    <p className="text-xs text-gray-500">Method: {payment.method || "-"}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-gray-900">{formatCurrency(payment.amount)}</p>
                    {isUnpaid && (
                      <button
                        onClick={() => handlePayNow(payment)}
                        disabled={loading || Boolean(payingPaymentId)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-300"
                      >
                        {payingPaymentId === payment.id && <Loader2 size={12} className="animate-spin" />}
                        {payingPaymentId === payment.id ? "Opening..." : "Pay Bill"}
                      </button>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </CustomerLayout>
  );
};

export default Payments;

