import React, { useEffect, useState } from "react";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import { 
  CreditCard, DollarSign, Calendar, TrendingUp, 
  MoreVertical, CheckCircle, Clock, AlertCircle, Edit2, Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import {
  fetchAdminPayments,
  updateAdminFarmPlan,
  updateAdminPaymentStatus,
} from "../../api/admin.api.js";

// MOCK API Call (Replace with actual import from admin.api.js)
// const fetchPaymentData = () => { ... } 

export default function AdminPayments() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data States
  const [farmPlan, setFarmPlan] = useState(null);
  const [revenue, setRevenue] = useState(0);
  const [payments, setPayments] = useState([]);
  
  // UI States
  const [filter, setFilter] = useState("ALL"); // ALL, PAID, PENDING
  const [editingPayment, setEditingPayment] = useState(null); // ID of payment being edited
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState("monthly");

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminPayments({ page: 1, status: filter });

      const farm = data?.farm || null;
      setFarmPlan({
        id: farm?.id || null,
        plan: farm?.selected_plan || "Standard",
        status: farm?.status || "ACTIVE",
        nextBilling: farm?.updated_at || null,
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

  // Handlers
  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateAdminPaymentStatus(id, newStatus);
      setPayments(payments.map(p => p.id === id ? { ...p, status: newStatus } : p));
      toast.success(`Payment marked as ${newStatus}`);
      setEditingPayment(null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update payment status");
    }
  };

  const handleChangeFarmPlan = () => {
    setPlanModalOpen(true);
  };

  const handlePlanSelect = (newPlan) => {
    updateAdminFarmPlan(newPlan)
      .then(() => {
        setFarmPlan({ ...(farmPlan || {}), plan: newPlan });
        toast.success("Farm plan updated successfully!");
        setPlanModalOpen(false);
      })
      .catch((err) => {
        toast.error(err?.response?.data?.error || "Failed to update farm plan");
      });
  };

  const planOptions = [
    {
      name: "Free",
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [
        "2 auto tracking",
        "7 day transaction clearing",
        "Email support",
        "Basic widget access",
      ],
      popular: false,
    },
    {
      name: "Growth",
      monthlyPrice: 150,
      yearlyPrice: 1500,
      features: [
        "AI advisor",
        "Unlimited auto tracking",
        "1 day transaction clearing",
        "Priority customer support",
        "All widget access",
      ],
      popular: true,
    },
    {
      name: "Prime",
      monthlyPrice: 180,
      yearlyPrice: 1800,
      features: [
        "Dedicated AI advisor",
        "Unlimited auto tracking",
        "Same day transaction clearing",
        "Priority customer support",
        "All widget access",
      ],
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminMobileTopbar title="Payments & Billing" onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 px-4 sm:px-6 lg:px-10 py-8">
        
        {/* === SECTION 1: YOUR FARM SUBSCRIPTION === */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Farm Plan Card */}
          <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CreditCard size={120} />
            </div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-200 text-sm font-medium uppercase tracking-wider">Your Subscription</p>
                  <h2 className="text-2xl font-bold mt-1">
                    {farmPlan?.plan || (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Loading...
                      </span>
                    )}
                  </h2>
                </div>
                <span className="bg-green-400/20 text-green-100 text-xs px-2 py-1 rounded-full border border-green-400/30">
                  {farmPlan?.status}
                </span>
              </div>

              <div className="mt-6 flex items-end gap-2">
                <span className="text-3xl font-bold">{farmPlan?.plan || "-"}</span>
              </div>

              <div className="mt-6 pt-6 border-t border-blue-500/30 flex justify-between items-center">
                <div className="text-xs text-blue-200">
                  Updated on {farmPlan?.nextBilling ? new Date(farmPlan.nextBilling).toLocaleDateString() : "-"}
                </div>
                <button 
                  onClick={handleChangeFarmPlan}
                  className="px-3 py-1.5 bg-white text-blue-900 text-sm font-semibold rounded-lg hover:bg-blue-50 transition"
                >
                  Change Plan
                </button>
              </div>
            </div>
          </div>

          {/* Revenue Stats */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                <DollarSign size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <h3 className="text-2xl font-bold text-gray-900">₹{revenue.toLocaleString()}</h3>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingUp size={12} className="mr-1" /> +12% this month
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                <Clock size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Payments</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  ₹{payments.filter((p) => p.status !== "PAID").reduce((sum, p) => sum + Number(p.amount || 0), 0).toLocaleString()}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {payments.filter((p) => p.status !== "PAID").length} customers pending
                </p>
              </div>
            </div>
          </div>
        </div>


        {/* === SECTION 2: CUSTOMER PAYMENTS TABLE === */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          
          {/* Filters */}
          <div className="px-6 py-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Customer Transactions</h3>
            
            <div className="flex gap-2">
              {["ALL", "PAID", "PENDING", "OVERDUE"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    filter === status 
                    ? "bg-blue-600 text-white" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 font-medium">Plan</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-10">
                      <LoadingIndicator message="Loading transactions..." />
                    </td>
                  </tr>
                ) : payments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-gray-50 transition group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{pay.customer}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {pay.plan}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(pay.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      ₹{pay.amount}
                    </td>
                    <td className="px-6 py-4">
                      {editingPayment === pay.id ? (
                        <select 
                          className="text-xs border rounded p-1"
                          defaultValue={pay.status}
                          onChange={(e) => handleStatusChange(pay.id, e.target.value)}
                          onBlur={() => setEditingPayment(null)}
                          autoFocus
                        >
                          <option value="PAID">PAID</option>
                          <option value="PENDING">PENDING</option>
                          <option value="OVERDUE">OVERDUE</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          pay.status === "PAID" ? "bg-green-50 text-green-700 border-green-200" :
                          pay.status === "PENDING" ? "bg-orange-50 text-orange-700 border-orange-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {pay.status === "PAID" && <CheckCircle size={10} />}
                          {pay.status === "PENDING" && <Clock size={10} />}
                          {pay.status === "OVERDUE" && <AlertCircle size={10} />}
                          {pay.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                         <button 
                            onClick={() => setEditingPayment(pay.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit Status"
                         >
                            <Edit2 size={16} />
                         </button>
                         <button 
                            className="text-xs text-blue-600 hover:underline"
                            onClick={handleChangeFarmPlan}
                         >
                            Change Plan
                         </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-6 py-4 border-t flex justify-between items-center">
             <span className="text-sm text-gray-500">Showing {payments.length} transactions</span>
             <div className="flex gap-2">
                <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50" disabled>Prev</button>
                <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Next</button>
             </div>
          </div>
        </div>

      </main>

      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] px-3 py-8 sm:px-6 md:py-10">
          <div className="w-full max-w-5xl overflow-hidden rounded-[24px] sm:rounded-[30px] border border-gray-200 bg-white p-4 sm:p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <div className="text-center">
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">Choose your plan</h3>
              <p className="mt-2 text-sm text-gray-500">Pick the best plan for your dairy operations.</p>

              <div className="mt-5 inline-flex items-center rounded-full border border-gray-200 bg-white p-1">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`text-sm font-semibold ${
                    billingCycle === "monthly"
                      ? "rounded-full bg-blue-600 px-4 py-2 text-white"
                      : "rounded-full px-4 py-2 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  Bill Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`text-sm font-semibold ${
                    billingCycle === "yearly"
                      ? "rounded-full bg-blue-600 px-4 py-2 text-white"
                      : "rounded-full px-4 py-2 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  Bill Yearly
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {planOptions.map((plan) => {
                const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
                const isCurrent = farmPlan?.plan === plan.name;

                return (
                  <div
                    key={plan.name}
                    className={`relative rounded-2xl border p-4 md:p-5 bg-white shadow-sm ${
                      plan.popular ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute left-0 right-0 -top-0 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-2 text-center text-xs font-bold tracking-wide text-white">
                        MOST POPULAR
                      </div>
                    )}

                    <div className={plan.popular ? "pt-5" : ""}>
                      <h4 className="text-lg font-bold text-gray-900">{plan.name}</h4>

                      <div className="mt-3 flex items-end gap-2">
                        <span className="text-4xl font-bold text-gray-900">${price}</span>
                        <span className="mb-1 text-sm text-gray-500">
                          / {billingCycle === "yearly" ? "Year" : "Month"}
                        </span>
                      </div>

                      <ul className="mt-4 space-y-2">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px]">
                              ✓
                            </span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handlePlanSelect(plan.name)}
                        className={`mt-5 w-full rounded-full px-4 py-2 text-sm font-semibold transition ${
                          isCurrent
                            ? "bg-gray-200 text-gray-700 cursor-default"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                        disabled={isCurrent}
                      >
                        {isCurrent ? "Current Plan" : "Purchase Plan"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setPlanModalOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
