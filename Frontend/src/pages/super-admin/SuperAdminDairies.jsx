import React, { useEffect, useState } from "react";
import SuperAdminSidebar from "./SuperAdminSidebar.jsx";
import {
  fetchDairiesApi,
  updateDairyStatusApi,
  upgradeDairySubscriptionApi,
  resetOwnerPasswordApi,
  deleteDairyApi
} from "../../api/superAdmin.api.js";
import toast from "react-hot-toast";
import {
  Search,
  Filter,
  Eye,
  UserCheck,
  UserX,
  Trash2,
  Lock,
  ChevronRight,
  TrendingUp,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  UserMinus,
  Calendar,
  X
} from "lucide-react";

const SuperAdminDairies = () => {
  const [dairies, setDairies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");

  // Selected Dairy for Details Drawer
  const [selectedDairy, setSelectedDairy] = useState(null);
  
  // Actions states
  const [newPlan, setNewPlan] = useState("GROWTH");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [newPassword, setNewPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadDairies = async () => {
    setLoading(true);
    try {
      const response = await fetchDairiesApi({
        status: statusFilter,
        plan: planFilter,
        search: searchTerm
      });
      if (response.success) {
        setDairies(response.dairies || []);
      }
    } catch (err) {
      toast.error("Failed to load dairies list");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDairies();
  }, [statusFilter, planFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadDairies();
  };

  // Toggle dairy status (suspend/activate)
  const handleToggleStatus = async (dairy, newStatus) => {
    setActionLoading(true);
    try {
      const response = await updateDairyStatusApi(dairy.id, newStatus);
      if (response.success) {
        toast.success(`Dairy ${newStatus === "ACTIVE" ? "activated" : "suspended"} successfully!`);
        // Update local state
        setDairies(prev => prev.map(d => d.id === dairy.id ? { ...d, status: newStatus } : d));
        if (selectedDairy && selectedDairy.id === dairy.id) {
          setSelectedDairy(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update dairy status");
    } finally {
      setActionLoading(false);
    }
  };

  // Upgrade Plan
  const handleUpgradePlan = async (e) => {
    e.preventDefault();
    if (!selectedDairy) return;
    
    setActionLoading(true);
    try {
      const response = await upgradeDairySubscriptionApi(selectedDairy.id, newPlan, billingCycle);
      if (response.success) {
        toast.success(`Upgraded plan to ${newPlan} (${billingCycle})!`);
        setDairies(prev => prev.map(d => d.id === selectedDairy.id ? { ...d, selected_plan: newPlan } : d));
        setSelectedDairy(prev => ({ ...prev, selected_plan: newPlan }));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update subscription");
    } finally {
      setActionLoading(false);
    }
  };

  // Reset owner password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedDairy || !newPassword) return;

    setActionLoading(true);
    try {
      const response = await resetOwnerPasswordApi(selectedDairy.id, newPassword);
      if (response.success) {
        toast.success("Password reset successfully!");
        setNewPassword("");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to reset password");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete dairy
  const handleDeleteDairy = async (dairyId) => {
    if (!window.confirm("Are you absolutely sure you want to delete this dairy? This deletes all associated products, agents, customers, and order history! This cannot be undone.")) return;

    setActionLoading(true);
    try {
      const response = await deleteDairyApi(dairyId);
      if (response.success) {
        toast.success("Dairy deleted from platform.");
        setDairies(prev => prev.filter(d => d.id !== dairyId));
        setSelectedDairy(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete dairy");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SuperAdminSidebar>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Dairy Management Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Perform KYC verification, subscription upgrades, reset owner passwords, or suspend accounts.
          </p>
        </div>
      </div>

      {/* Advanced Search and Filter Bar */}
      <div className="bg-slate-900/40 border border-slate-850/60 backdrop-blur rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by dairy name, email, or owner..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950/40 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200 text-xs transition-all duration-200"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex-1 md:flex-none">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-44 px-3 py-2.5 rounded-xl bg-slate-950/40 border border-slate-850 text-slate-300 text-xs focus:border-cyan-500/80 outline-none transition-colors"
            >
              <option value="ALL">All Account Statuses</option>
              <option value="ACTIVE">Active Account</option>
              <option value="SUSPENDED">Suspended Account</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div className="flex-1 md:flex-none">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="w-full md:w-44 px-3 py-2.5 rounded-xl bg-slate-950/40 border border-slate-850 text-slate-300 text-xs focus:border-cyan-500/80 outline-none transition-colors"
            >
              <option value="ALL">All Platform Plans</option>
              <option value="FREE">Free Plan</option>
              <option value="GROWTH">Growth Plan</option>
              <option value="PRIME">Prime Plan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dairies Table */}
      <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-850 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                <th className="py-4.5 px-6">Dairy Info</th>
                <th className="py-4.5 px-6">Location</th>
                <th className="py-4.5 px-6">Reg Date</th>
                <th className="py-4.5 px-6">Plan Status</th>
                <th className="py-4.5 px-6">Analytics Summary</th>
                <th className="py-4.5 px-6 text-center">Status</th>
                <th className="py-4.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-20 text-slate-400">
                    <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto mb-3"></div>
                    <span>Loading registered dairies ledger...</span>
                  </td>
                </tr>
              ) : dairies.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-20 text-slate-500 font-medium">
                    No dairies found matching the filters.
                  </td>
                </tr>
              ) : (
                dairies.map((dairy) => (
                  <tr key={dairy.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-200 text-[13px]">{dairy.dairy_name}</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Owner: {dairy.owner_name}</span>
                        <span className="text-[10px] text-slate-500">{dairy.dairy_email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-300">
                      <div className="flex flex-col text-[11px]">
                        <span>{dairy.city}, {dairy.state}</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">PIN: {dairy.pincode}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-medium font-mono text-[11px]">
                      {new Date(dairy.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase font-mono ${
                        dairy.selected_plan === "PRIME"
                          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"
                          : dairy.selected_plan === "GROWTH"
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/10"
                          : "bg-slate-500/10 text-slate-400 border border-slate-500/10"
                      }`}>
                        {dairy.selected_plan || "Starter"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-300">
                      <div className="flex flex-col gap-0.5 text-[11px]">
                        <span>👥 Customers: <strong className="text-slate-200">{dairy.totalCustomers}</strong></span>
                        <span>📦 Orders: <strong className="text-slate-200">{dairy.totalOrders}</strong></span>
                        <span>💰 Rev: <strong className="text-cyan-400">₹{dairy.totalRevenue}</strong></span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        dairy.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/10"
                      }`}>
                        {dairy.status || "ACTIVE"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => setSelectedDairy(dairy)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors border border-slate-850 cursor-pointer"
                          title="View Details & Manage"
                        >
                          <Eye size={14} />
                        </button>
                        {dairy.status === "ACTIVE" ? (
                          <button
                            onClick={() => handleToggleStatus(dairy, "SUSPENDED")}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors border border-slate-850 cursor-pointer"
                            title="Suspend Account"
                          >
                            <UserX size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(dairy, "ACTIVE")}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition-colors border border-slate-850 cursor-pointer"
                            title="Re-activate Account"
                          >
                            <UserCheck size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDairy(dairy.id)}
                          disabled={actionLoading}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors border border-slate-850 cursor-pointer"
                          title="Delete Dairy"
                        >
                          <Trash2 size={14} />
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

      {/* Slide-out Drawer for Dairy Details & Management Operations */}
      {selectedDairy && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
          {/* Close Overlay Trigger */}
          <div className="absolute inset-0" onClick={() => setSelectedDairy(null)}></div>
          
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-8 shadow-2xl flex flex-col justify-between animate-slideLeft z-10">
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-100">{selectedDairy.dairy_name}</h3>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">ID: {selectedDairy.id}</span>
                </div>
                <button onClick={() => setSelectedDairy(null)} className="p-2 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400">
                  <X size={16} />
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3.5 mb-6">
                {[
                  { label: "Customers", val: selectedDairy.totalCustomers },
                  { label: "Orders", val: selectedDairy.totalOrders },
                  { label: "Revenue", val: `₹${selectedDairy.totalRevenue}` }
                ].map((stat, i) => (
                  <div key={i} className="p-3 bg-slate-950/50 border border-slate-850 rounded-xl text-center">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold font-mono">{stat.label}</p>
                    <h4 className="text-sm font-extrabold text-slate-200 mt-1">{stat.val}</h4>
                  </div>
                ))}
              </div>

              {/* Profile Details List */}
              <div className="space-y-4 mb-8 bg-slate-950/20 border border-slate-900 rounded-2xl p-5 text-xs text-slate-300">
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-slate-850 pb-2 mb-3">Owner Contact Profile</h4>
                
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-slate-500" />
                  <div>
                    <p className="text-[10px] text-slate-500">Registered Owner Email</p>
                    <p className="font-medium text-slate-200">{selectedDairy.dairy_email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-slate-500" />
                  <div>
                    <p className="text-[10px] text-slate-500">Contact Number</p>
                    <p className="font-medium text-slate-200">{selectedDairy.dairy_phone || selectedDairy.phone || "-"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-slate-500" />
                  <div>
                    <p className="text-[10px] text-slate-500">Geographic Address</p>
                    <p className="font-medium text-slate-200">{selectedDairy.address}, {selectedDairy.city}, {selectedDairy.state} - {selectedDairy.pincode}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar size={14} className="text-slate-500" />
                  <div>
                    <p className="text-[10px] text-slate-500">Member Since</p>
                    <p className="font-medium text-slate-200">{new Date(selectedDairy.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Action: Plan Upgrade */}
              <div className="border-t border-slate-850 pt-5 mb-6">
                <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-cyan-400" />
                  <span>Upgrade Subscription Plan</span>
                </h4>
                <form onSubmit={handleUpgradePlan} className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-300 outline-none"
                  >
                    <option value="FREE">FREE Starter Plan (14 Days Trial)</option>
                    <option value="GROWTH">GROWTH Premium Plan (₹999/mo)</option>
                    <option value="PRIME">PRIME Platform Plan (₹2499/mo)</option>
                  </select>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-300 outline-none"
                  >
                    <option value="monthly">Monthly billing</option>
                    <option value="yearly">Yearly billing</option>
                  </select>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs active:scale-98 transition-all duration-200 cursor-pointer"
                  >
                    Apply
                  </button>
                </form>
              </div>

              {/* Action: Password Reset */}
              <div className="border-t border-slate-850 pt-5">
                <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
                  <Lock size={14} className="text-indigo-400" />
                  <span>Reset Owner Password</span>
                </h4>
                <form onSubmit={handleResetPassword} className="flex gap-3">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new account password"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-300 outline-none focus:border-indigo-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={actionLoading || !newPassword}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs active:scale-98 transition-all duration-200 cursor-pointer"
                  >
                    Reset Password
                  </button>
                </form>
              </div>
            </div>

            {/* Suspend / Delete buttons at the bottom */}
            <div className="border-t border-slate-850 pt-5 mt-8 flex gap-3.5">
              {selectedDairy.status === "ACTIVE" ? (
                <button
                  onClick={() => handleToggleStatus(selectedDairy, "SUSPENDED")}
                  disabled={actionLoading}
                  className="flex-1 py-3 border border-rose-500/20 text-rose-400 hover:text-white hover:bg-rose-500/10 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Suspend Dairy
                </button>
              ) : (
                <button
                  onClick={() => handleToggleStatus(selectedDairy, "ACTIVE")}
                  disabled={actionLoading}
                  className="flex-1 py-3 border border-emerald-500/20 text-emerald-400 hover:text-white hover:bg-emerald-500/10 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Re-activate Dairy
                </button>
              )}
              <button
                onClick={() => handleDeleteDairy(selectedDairy.id)}
                disabled={actionLoading}
                className="py-3 px-4 bg-rose-950/20 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminSidebar>
  );
};

export default SuperAdminDairies;
