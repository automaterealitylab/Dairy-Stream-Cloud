import React, { useEffect, useState } from "react";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import { 
  CreditCard, DollarSign, Calendar, TrendingUp, 
  CheckCircle, Clock, AlertCircle, Edit2, Loader2, Share2, X, Wallet
} from "lucide-react";
import toast from "react-hot-toast";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import ManualPaymentModal from "../../components/admin/sections/ManualPaymentModal";
import {
  fetchAdminPayments,
  updateAdminFarmPlan,
  updateAdminPaymentStatus,
} from "../../api/admin.api.js";

export default function AdminPayments() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data States
  const [farmPlan, setFarmPlan] = useState(null);
  const [revenue, setRevenue] = useState(0);
  const [payments, setPayments] = useState([]);
  
  // UI States
  const [filter, setFilter] = useState("ALL"); 
  const [editingPayment, setEditingPayment] = useState(null); 
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [activePaymentModal, setActivePaymentModal] = useState(null);

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

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateAdminPaymentStatus(id, newStatus);
      setPayments(payments.map(p => p.id === id ? { ...p, status: newStatus } : p));
      toast.success(`Payment marked as ${newStatus}`);
      setEditingPayment(null);
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const planOptions = [
    { name: "Free", monthlyPrice: 0, yearlyPrice: 0, features: ["2 auto tracking", "7 day transaction clearing", "Email support", "Basic widget access"], popular: false },
    { name: "Growth", monthlyPrice: 150, yearlyPrice: 1500, features: ["AI advisor", "Unlimited auto tracking", "1 day transaction clearing", "Priority customer support"], popular: true },
    { name: "Prime", monthlyPrice: 180, yearlyPrice: 1800, features: ["Dedicated AI advisor", "Unlimited auto tracking", "Same day transaction clearing", "Priority customer support"], popular: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminMobileTopbar title="Payments & Billing" onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 px-4 sm:px-6 lg:px-10 py-8">
        
        {/* SECTION 1: STATS */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><CreditCard size={120} /></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-200 text-sm font-medium uppercase tracking-wider">Your Subscription</p>
                  <h2 className="text-2xl font-bold mt-1">{farmPlan?.plan}</h2>
                </div>
                <span className="bg-green-400/20 text-green-100 text-xs px-2 py-1 rounded-full border border-green-400/30 font-bold uppercase tracking-widest">
                  {farmPlan?.status}
                </span>
              </div>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-3xl font-bold">₹{farmPlan?.plan === 'Free' ? '0' : '150'}</span>
                <span className="text-blue-200 text-xs font-medium pb-1">/mo</span>
              </div>
              <div className="mt-6 pt-6 border-t border-blue-500/30 flex justify-between items-center">
                <div className="text-xs text-blue-200">Refreshed: {farmPlan?.nextBilling ? new Date(farmPlan.nextBilling).toLocaleDateString() : "-"}</div>
                <button onClick={() => setPlanModalOpen(true)} className="px-3 py-1.5 bg-white text-blue-900 text-sm font-bold rounded-lg hover:bg-blue-50 transition">Change Plan</button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-xl"><DollarSign size={28} /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
                <h3 className="text-2xl font-bold text-gray-900">₹{revenue.toLocaleString()}</h3>
                {revenue > 0 && <p className="text-xs text-green-600 flex items-center mt-1 font-bold"><TrendingUp size={12} className="mr-1" /> Stable Growth</p>}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Wallet size={28} /></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Pending Dues</p>
                <h3 className="text-2xl font-bold text-gray-900">₹{payments.filter(p => p.status !== "PAID").reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString()}</h3>
                <p className="text-xs text-gray-500 mt-1 font-bold italic">{payments.filter(p => p.status !== "PAID").length} Customer Dues</p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-bold text-gray-900 text-lg">Customer Transactions</h3>
            <div className="flex gap-2">
              {["ALL", "PAID", "PENDING", "OVERDUE"].map((s) => (
                <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${filter === s ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-gray-500 text-[10px] font-black uppercase tracking-wider border-b">
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
                  payments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-gray-50 transition group">
                      <td className="px-6 py-5"><div className="font-bold text-gray-900">{pay.customer}</div></td>
                      <td className="px-6 py-5 text-sm text-gray-500">{new Date(pay.date).toLocaleDateString('en-GB')}</td>
                      <td className="px-6 py-5 font-bold text-gray-900">₹{pay.amount}</td>
                      <td className="px-6 py-5">
                        {editingPayment === pay.id ? (
                          <select className="text-xs border rounded p-1 outline-none" defaultValue={pay.status} onChange={(e) => handleStatusChange(pay.id, e.target.value)} onBlur={() => setEditingPayment(null)} autoFocus>
                            <option value="PAID">PAID</option>
                            <option value="PENDING">PENDING</option>
                            <option value="OVERDUE">OVERDUE</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${
                            pay.status === "PAID" ? "bg-green-50 text-green-700 border-green-200" :
                            pay.status === "PENDING" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-red-50 text-red-700 border-red-200"
                          }`}>
                            {pay.status === "PAID" ? <CheckCircle size={10} /> : <Clock size={10} />} {pay.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {pay.status !== "PAID" && (
                            <button 
                              onClick={() => setActivePaymentModal(pay)} 
                              className="h-9 px-4 bg-blue-600 text-white text-[11px] font-black uppercase rounded-xl hover:bg-blue-700 shadow-md shadow-blue-100 transition-all active:scale-95 flex items-center justify-center"
                            >
                              Collect
                            </button>
                          )}
                          <button 
                            onClick={() => setEditingPayment(pay.id)} 
                            className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-100 rounded-xl transition-all" 
                            title="Change Status"
                          >
                            <Edit2 size={16} />
                          </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden relative p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Select Dairy Plan</h3>
              <button onClick={() => setPlanModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={24} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {planOptions.map((p) => (
                <div key={p.name} className={`p-6 rounded-2xl border-2 transition ${p.name === farmPlan?.plan ? 'border-blue-600 bg-blue-50/20' : 'border-gray-100'}`}>
                  <h4 className="text-xl font-bold text-gray-900 mb-4">{p.name}</h4>
                  <div className="text-3xl font-bold mb-6">₹{billingCycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice}<span className="text-xs text-gray-400 font-normal"> / mo</span></div>
                  <ul className="space-y-3 mb-8">
                    {p.features.map(f => <li key={f} className="text-xs text-gray-600 font-bold flex items-center gap-2"><CheckCircle size={14} className="text-blue-500" /> {f}</li>)}
                  </ul>
                  <button onClick={() => { updateAdminFarmPlan(p.name); setPlanModalOpen(false); }} className={`w-full py-3 rounded-xl font-bold text-xs uppercase ${p.name === farmPlan?.plan ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    {p.name === farmPlan?.plan ? 'Current' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* COLLECT MODAL */}
      {activePaymentModal && (
        <ManualPaymentModal delivery={activePaymentModal} onClose={() => setActivePaymentModal(null)} onSave={loadPayments} />
      )}
    </div>
  );
}