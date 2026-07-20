import React, { useEffect, useState } from "react";
import SuperAdminSidebar from "./SuperAdminSidebar.jsx";
import {
  fetchPlansApi,
  createPlanApi,
  updatePlanApi,
  deletePlanApi
} from "../../api/superAdmin.api.js";
import toast from "react-hot-toast";
import { Plus, Edit3, Trash2, ShieldCheck, Check, Power, PowerOff, X } from "lucide-react";

const AVAILABLE_FEATURES = [
  { key: "agents", label: "Delivery Agents Management" },
  { key: "performance", label: "Agent Performance Dashboard" },
  { key: "procurement", label: "Procurement Logging & Metrics" },
  { key: "suppliers", label: "Supplier Profiling & Contracts" },
];

const SuperAdminPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  // Form Fields
  const [planKey, setPlanKey] = useState("");
  const [name, setName] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [yearlyPrice, setYearlyPrice] = useState("");
  const [gstPercent, setGstPercent] = useState("18");
  const [trialDays, setTrialDays] = useState("14");
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const response = await fetchPlansApi();
      if (response.success) {
        setPlans(response.plans || []);
      }
    } catch (err) {
      toast.error("Failed to load plans");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const openAddModal = () => {
    setEditingPlan(null);
    setPlanKey("");
    setName("");
    setMonthlyPrice("");
    setYearlyPrice("");
    setGstPercent("18");
    setTrialDays("14");
    setSelectedFeatures([]);
    setIsModalOpen(true);
  };

  const openEditModal = (plan) => {
    setEditingPlan(plan);
    setPlanKey(plan.plan_key);
    setName(plan.name);
    setMonthlyPrice(plan.monthly_price);
    setYearlyPrice(plan.yearly_price);
    setGstPercent(plan.gst_percent || "18");
    setTrialDays(plan.trial_period_days || "14");
    setSelectedFeatures(plan.features || []);
    setIsModalOpen(true);
  };

  const handleFeatureToggle = (featureKey) => {
    setSelectedFeatures(prev =>
      prev.includes(featureKey)
        ? prev.filter(k => k !== featureKey)
        : [...prev, featureKey]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || monthlyPrice === "" || yearlyPrice === "") return;

    setActionLoading(true);
    const payload = {
      planKey: planKey.toUpperCase().trim(),
      name,
      monthlyPrice: Number(monthlyPrice),
      yearlyPrice: Number(yearlyPrice),
      gstPercent: Number(gstPercent),
      trialPeriodDays: Number(trialDays),
      features: selectedFeatures,
    };

    try {
      if (editingPlan) {
        const response = await updatePlanApi(editingPlan.id, payload);
        if (response.success) {
          toast.success("Platform subscription plan updated!");
          setPlans(prev => prev.map(p => p.id === editingPlan.id ? response.plan : p));
        }
      } else {
        const response = await createPlanApi(payload);
        if (response.success) {
          toast.success("New platform plan created successfully!");
          setPlans(prev => [...prev, response.plan]);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save plan");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (plan) => {
    const nextStatus = plan.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const response = await updatePlanApi(plan.id, { status: nextStatus });
      if (response.success) {
        toast.success(`Plan ${nextStatus === "ACTIVE" ? "resumed" : "paused"} successfully.`);
        setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: nextStatus } : p));
      }
    } catch (_err) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this subscription plan? Existing subscribed dairies won't be modified but no new signups can buy this tier.")) return;

    try {
      const response = await deletePlanApi(id);
      if (response.success) {
        toast.success("Plan deleted.");
        setPlans(prev => prev.filter(p => p.id !== id));
      }
    } catch (_err) {
      toast.error("Failed to delete plan");
    }
  };

  return (
    <SuperAdminSidebar>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            SaaS Plan Configurator
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Customize package pricing structures, GST rate schedules, and allocate active system capabilities.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 active:scale-98 transition-all duration-200 cursor-pointer"
        >
          <Plus size={14} />
          <span>Add Subscription Plan</span>
        </button>
      </div>

      {/* Grid of Package Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="md:col-span-3 text-center py-20 text-slate-500 text-xs">
            Fetching active pricing plans list...
          </div>
        ) : plans.length === 0 ? (
          <div className="md:col-span-3 text-center py-20 text-slate-500 font-medium">
            No subscription plans created yet. Click "Add Subscription Plan" to begin.
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-slate-900/40 border rounded-2xl p-6 flex flex-col justify-between hover:border-slate-800 transition-all duration-300 relative overflow-hidden ${
                plan.status === "PAUSED" ? "border-slate-900 opacity-60" : "border-slate-850/60"
              }`}
            >
              {plan.status === "PAUSED" && (
                <div className="absolute top-3.5 right-3.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold uppercase tracking-wider font-mono border border-amber-500/10">
                  Paused
                </div>
              )}
              
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-200 text-base leading-snug">{plan.name}</h3>
                    <span className="text-[10px] text-slate-500 tracking-wider font-bold font-mono uppercase mt-0.5 block">{plan.plan_key}</span>
                  </div>
                </div>

                <div className="my-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-100">₹{Number(plan.monthly_price).toLocaleString()}</span>
                    <span className="text-slate-500 text-xs font-semibold">/ month</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400 font-medium mt-1.5 flex gap-2.5">
                    <span>Yearly: ₹{Number(plan.yearly_price).toLocaleString()}</span>
                    <span className="text-slate-700">•</span>
                    <span>GST: {plan.gst_percent}%</span>
                  </div>
                  <p className="text-[10.5px] text-cyan-400 font-medium mt-1 font-mono">Free Trial: {plan.trial_period_days || 14} Days</p>
                </div>

                {/* Allocated features list */}
                <div className="space-y-2 border-t border-slate-850 pt-5 mb-8">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono mb-3">Feature Allocation</h4>
                  {AVAILABLE_FEATURES.map((feature, idx) => {
                    const hasFeature = plan.features?.includes(feature.key);
                    return (
                      <div key={idx} className={`flex items-center gap-2.5 text-xs ${hasFeature ? "text-slate-300" : "text-slate-600 line-through"}`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center ${hasFeature ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/10" : "bg-slate-950 border border-slate-900 text-slate-700"}`}>
                          {hasFeature && <Check size={11} />}
                        </div>
                        <span className="text-[11px] font-medium">{feature.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 border-t border-slate-850 pt-5 bg-slate-900/10">
                <button
                  onClick={() => openEditModal(plan)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-850 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Edit3 size={12} />
                  <span>Edit Package</span>
                </button>
                <button
                  onClick={() => handleToggleStatus(plan)}
                  className={`p-2 rounded-xl border text-xs cursor-pointer ${
                    plan.status === "ACTIVE"
                      ? "border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                      : "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                  }`}
                  title={plan.status === "ACTIVE" ? "Pause plan registration" : "Resume plan registration"}
                >
                  {plan.status === "ACTIVE" ? <PowerOff size={13} /> : <Power size={13} />}
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="p-2 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-xs cursor-pointer"
                  title="Delete subscription plan"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Plan Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl relative animate-scaleUp max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-slate-100 text-lg">
                {editingPlan ? "Modify Plan Specifications" : "Create Subscription Package"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-850 text-slate-400">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Plan Key Code */}
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Plan Unique Key (e.g. GROWTH, STARTER)</label>
                <input
                  type="text"
                  value={planKey}
                  onChange={(e) => setPlanKey(e.target.value)}
                  placeholder="GROWTH"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                  disabled={editingPlan}
                  required
                />
              </div>

              {/* Package Display Name */}
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Package Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Growth Premium Plan"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                  required
                />
              </div>

              {/* Pricing row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Monthly Price (INR)</label>
                  <input
                    type="number"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="999"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Yearly Price (INR)</label>
                  <input
                    type="number"
                    value={yearlyPrice}
                    onChange={(e) => setYearlyPrice(e.target.value)}
                    placeholder="9990"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                    required
                  />
                </div>
              </div>

              {/* Additional parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">GST Percentage (%)</label>
                  <input
                    type="number"
                    value={gstPercent}
                    onChange={(e) => setGstPercent(e.target.value)}
                    placeholder="18"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Free Trial Period (Days)</label>
                  <input
                    type="number"
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                    placeholder="14"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                    required
                  />
                </div>
              </div>

              {/* Feature checkboxes selection */}
              <div className="space-y-2 border-t border-slate-850 pt-4">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[9px] font-mono mb-2 block">Allocate Feature Access</label>
                <div className="space-y-2">
                  {AVAILABLE_FEATURES.map((feature) => (
                    <label key={feature.key} className="flex items-center gap-3 p-2 rounded-xl bg-slate-950 border border-slate-850/40 hover:border-slate-800 transition-colors cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedFeatures.includes(feature.key)}
                        onChange={() => handleFeatureToggle(feature.key)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-[11.5px] font-medium text-slate-300">{feature.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-slate-850 pt-5 flex gap-3.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold shadow-lg shadow-cyan-500/20 active:scale-98 transition-all duration-200 cursor-pointer"
                >
                  {actionLoading ? "Saving specifications..." : editingPlan ? "Save Plan Parameters" : "Publish SaaS Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SuperAdminSidebar>
  );
};

export default SuperAdminPlans;
