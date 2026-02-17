import React, { useEffect, useState } from "react";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import { 
  CreditCard, DollarSign, Calendar, TrendingUp, 
  MoreVertical, CheckCircle, Clock, AlertCircle, Edit2, Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";

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

  useEffect(() => {
    // Simulate API Fetch
    setTimeout(() => {
      setFarmPlan({
        plan: "Premium Dairy Plan",
        price: "$49/mo",
        status: "ACTIVE",
        nextBilling: "2026-03-15"
      });
      setRevenue(12450);
      setPayments([
        { id: 1, customer: "Rajesh Kumar", plan: "Gold Plan (2L)", amount: 1500, status: "PAID", date: "2026-02-14" },
        { id: 2, customer: "Suresh Singh", plan: "Silver Plan (1L)", amount: 750, status: "PENDING", date: "2026-02-13" },
        { id: 3, customer: "Anita Desai", plan: "Gold Plan (2L)", amount: 1500, status: "OVERDUE", date: "2026-02-10" },
      ]);
      setLoading(false);
    }, 1000);
  }, [filter]);

  // Handlers
  const handleStatusChange = async (id, newStatus) => {
    // Call API here...
    toast.success(`Payment marked as ${newStatus}`);
    setPayments(payments.map(p => p.id === id ? { ...p, status: newStatus } : p));
    setEditingPayment(null);
  };

  const handleChangeFarmPlan = () => {
    const plans = ["Basic", "Pro", "Enterprise"];
    const newPlan = prompt(`Enter new plan name (${plans.join(", ")}):`, farmPlan.plan);
    if (newPlan) {
        setFarmPlan({...farmPlan, plan: newPlan});
        toast.success("Farm plan updated successfully!");
    }
  };

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
                <span className="text-3xl font-bold">{farmPlan?.price}</span>
                <span className="text-blue-200 mb-1">/ month</span>
              </div>

              <div className="mt-6 pt-6 border-t border-blue-500/30 flex justify-between items-center">
                <div className="text-xs text-blue-200">
                  Renews on {farmPlan?.nextBilling}
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
                <h3 className="text-2xl font-bold text-gray-900">₹2,250</h3>
                <p className="text-xs text-gray-500 mt-1">3 customers pending</p>
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
                            onClick={() => alert(`Change plan for ${pay.customer}`)}
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
    </div>
  );
}
