import React, { useEffect, useState } from "react";
import { CheckCircle, Clock, CreditCard, Loader2, Wallet, XCircle } from "lucide-react";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import { fetchCustomerPayments } from "../../api/customer.api.js";
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
  });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPayments = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      if (!token) throw new Error("Customer token missing");

      const data = await fetchCustomerPayments(token);
      setSummary({
        monthlyDue: Number(data?.summary?.monthlyDue || 0),
        walletBalance: Number(data?.summary?.walletBalance || 0),
        dueInDays:
          data?.summary?.dueInDays === null || data?.summary?.dueInDays === undefined
            ? null
            : Number(data.summary.dueInDays),
      });
      setHistory(Array.isArray(data?.history) ? data.history : []);
    } catch (err) {
      setError(err?.message || "Failed to load payments");
      setSummary({
        monthlyDue: 0,
        walletBalance: 0,
        dueInDays: null,
      });
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

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
              <p className="text-sm font-medium text-green-700">Current Due</p>
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h4 className="text-lg font-semibold text-gray-900">Recent Payments</h4>

          {loading ? (
            <LoadingIndicator className="py-8" message="Loading payments..." />
          ) : history.length === 0 ? (
            <div className="text-gray-600 py-4">No payment records found.</div>
          ) : (
            history.map((payment) => {
              const badge = statusBadge(payment.status);

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

