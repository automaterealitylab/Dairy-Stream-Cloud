import React, { useEffect, useState } from "react";
import SuperAdminSidebar from "./SuperAdminSidebar.jsx";
import {
  fetchCouponsApi,
  createCouponApi,
  deleteCouponApi,
  fetchRedemptionsApi
} from "../../api/superAdmin.api.js";
import toast from "react-hot-toast";
import { Plus, Trash2, Calendar, Tag, CheckSquare, Layers, Download, X } from "lucide-react";

const SuperAdminCoupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [activeTab, setActiveTab] = useState("codes");
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form Fields
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [trialDays, setTrialDays] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxUses, setMaxUses] = useState("100");
  const [minPurchase, setMinPurchase] = useState("0");
  const [applicablePlans, setApplicablePlans] = useState([]);
  const [oneTime, setOneTime] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "codes") {
        const response = await fetchCouponsApi();
        if (response.success) {
          setCoupons(response.coupon || response.coupons || []);
        }
      } else {
        const response = await fetchRedemptionsApi();
        if (response.success) {
          setRedemptions(response.redemptions || []);
        }
      }
    } catch (err) {
      toast.error("Failed to load coupon metrics");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const togglePlanSelection = (planKey) => {
    setApplicablePlans(prev =>
      prev.includes(planKey) ? prev.filter(k => k !== planKey) : [...prev, planKey]
    );
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!code || !discountType || !startDate || !endDate) return;

    setActionLoading(true);
    try {
      const response = await createCouponApi({
        code: code.toUpperCase().trim(),
        discountType,
        discountValue: Number(discountValue || 0),
        trialExtensionDays: Number(trialDays || 0),
        startDate,
        endDate,
        maxUses: Number(maxUses || 99999),
        minPurchaseAmount: Number(minPurchase || 0),
        applicablePlans,
        oneTimePerDairy: oneTime
      });

      if (response.success) {
        toast.success("New discount coupon code created!");
        setCoupons(prev => [response.coupon, ...prev]);
        setIsModalOpen(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create coupon");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm("Are you sure you want to delete this coupon? This blocks any future redemptions immediately.")) return;

    try {
      const response = await deleteCouponApi(id);
      if (response.success) {
        toast.success("Coupon deleted.");
        setCoupons(prev => prev.filter(c => c.id !== id));
      }
    } catch (_err) {
      toast.error("Failed to delete coupon");
    }
  };

  const exportRedemptionsCSV = () => {
    if (redemptions.length === 0) return;
    const csvContent = [
      ["Redemption ID", "Coupon Code", "Discount Applied (INR)", "Redemption Date", "Redeemed By Dairy"],
      ...redemptions.map(r => [
        r.id,
        r.coupon_code,
        r.discount_applied,
        new Date(r.redeemed_at).toLocaleDateString(),
        r.dairies?.dairy_name || `Dairy ID: ${r.dairy_id}`
      ])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `coupon_redemption_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Redemption history exported to CSV!");
  };

  return (
    <SuperAdminSidebar>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Promo Coupon Engine
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Issue referral codes, check active redemption rates, and customize promotional features.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {activeTab === "redemptions" && redemptions.length > 0 && (
            <button
              onClick={exportRedemptionsCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-xs font-semibold transition-all duration-200 cursor-pointer"
            >
              <Download size={14} />
              <span>Export Redemptions Log</span>
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 active:scale-98 transition-all duration-200 cursor-pointer"
          >
            <Plus size={14} />
            <span>Generate Coupon Code</span>
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-900 gap-6">
        <button
          onClick={() => setActiveTab("codes")}
          className={`pb-3 font-semibold text-xs transition-colors relative cursor-pointer ${
            activeTab === "codes" ? "text-cyan-400" : "text-slate-500 hover:text-slate-350"
          }`}
        >
          <span>Active Promo Codes</span>
          {activeTab === "codes" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 rounded"></span>}
        </button>
        <button
          onClick={() => setActiveTab("redemptions")}
          className={`pb-3 font-semibold text-xs transition-colors relative cursor-pointer ${
            activeTab === "redemptions" ? "text-cyan-400" : "text-slate-500 hover:text-slate-350"
          }`}
        >
          <span>Redemption Logs</span>
          {activeTab === "redemptions" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 rounded"></span>}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "codes" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
          {loading ? (
            <div className="lg:col-span-3 text-center py-20 text-slate-500 text-xs">
              Fetching active promo codes database...
            </div>
          ) : coupons.length === 0 ? (
            <div className="lg:col-span-3 text-center py-20 text-slate-500 font-medium">
              No coupon codes created yet. Click "Generate Coupon Code" to launch a campaign.
            </div>
          ) : (
            coupons.map((coupon) => (
              <div key={coupon.id} className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 hover:border-slate-800 transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-cyan-400" />
                      <h4 className="font-extrabold text-sm text-slate-100">{coupon.code}</h4>
                    </div>
                    <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase tracking-wider font-mono">
                      {coupon.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-[11px] text-slate-400">
                    <p>
                      Type: <strong className="text-slate-300">
                        {coupon.discount_type === "PERCENTAGE" ? `${coupon.discount_value}% Discount` :
                         coupon.discount_type === "FLAT" ? `Flat ₹${coupon.discount_value} Off` :
                         coupon.discount_type === "FIRST_MONTH_FREE" ? "First Month Free" :
                         `Trial Extension: ${coupon.trial_extension_days} Days`}
                      </strong>
                    </p>
                    <p>Minimum Purchase: <strong className="text-slate-300">₹{coupon.min_purchase_amount}</strong></p>
                    <p>Usage: <strong className="text-slate-300">{coupon.current_uses} / {coupon.max_uses}</strong></p>
                    <p className="flex items-center gap-1">
                      <Calendar size={11} className="text-slate-500" />
                      <span>{new Date(coupon.start_date).toLocaleDateString()} - {new Date(coupon.end_date).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-850 pt-4 mt-5 flex justify-end">
                  <button
                    onClick={() => handleDeleteCoupon(coupon.id)}
                    className="p-1.5 rounded-lg bg-slate-950 border border-slate-850 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete Coupon"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Redemptions Table View */
        <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow-xl animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-850 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                  <th className="py-4.5 px-6">Redemption ID</th>
                  <th className="py-4.5 px-6">Coupon Applied</th>
                  <th className="py-4.5 px-6">Redeemed By Dairy</th>
                  <th className="py-4.5 px-6">Discount Applied</th>
                  <th className="py-4.5 px-6">Redeemed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-20 text-slate-400">
                      <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto mb-3"></div>
                      <span>Extracting redemption logs...</span>
                    </td>
                  </tr>
                ) : redemptions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-20 text-slate-500">
                      No redemptions recorded yet on platform plans.
                    </td>
                  </tr>
                ) : (
                  redemptions.map((red) => (
                    <tr key={red.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-[11px] text-slate-500">#{red.id}</td>
                      <td className="py-4 px-6 font-semibold text-cyan-400 font-mono">{red.coupon_code}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200">{red.dairies?.dairy_name || "Internal Dairy"}</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">Owner: {red.dairies?.owner_name || "-"}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-emerald-400 font-bold font-mono">₹{red.discount_applied}</td>
                      <td className="py-4 px-6 text-slate-400 font-mono text-[11px]">
                        {new Date(red.redeemed_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Coupon Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl relative animate-scaleUp max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-slate-100 text-lg">Generate Promotional Coupon</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg bg-slate-950 border border-slate-850 hover:bg-slate-850 text-slate-400">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-4 text-xs">
              {/* Code */}
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Coupon Trigger Code (alphanumeric, caps)</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="LAUNCH50"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200 font-mono uppercase tracking-wider"
                  required
                />
              </div>

              {/* Type Select */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Discount Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-300 outline-none"
                  >
                    <option value="PERCENTAGE">Percentage rate (%)</option>
                    <option value="FLAT">Flat Rate Off (₹)</option>
                    <option value="TRIAL_EXTENSION">Free Trial Extension (Days)</option>
                    <option value="FIRST_MONTH_FREE">First Month Free (100% off)</option>
                  </select>
                </div>
                
                {discountType === "TRIAL_EXTENSION" ? (
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold">Extension Period (Days)</label>
                    <input
                      type="number"
                      value={trialDays}
                      onChange={(e) => setTrialDays(e.target.value)}
                      placeholder="14"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                      required
                    />
                  </div>
                ) : discountType === "FIRST_MONTH_FREE" ? null : (
                  <div className="space-y-1">
                    <label className="text-slate-400 font-semibold">Discount Rate / Value</label>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === "PERCENTAGE" ? "10" : "500"}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Purchase requirement and Limit counts */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Minimum Purchase Requirement (₹)</label>
                  <input
                    type="number"
                    value={minPurchase}
                    onChange={(e) => setMinPurchase(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Total Uses Allowed</label>
                  <input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-cyan-500/80 outline-none text-slate-200"
                    required
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Campaign Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 outline-none text-slate-300"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Campaign Expiry Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-850 outline-none text-slate-300"
                    required
                  />
                </div>
              </div>

              {/* Scope plan check fields */}
              <div className="space-y-2 border-t border-slate-850 pt-4">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[9px] font-mono block">Scope Applicability</label>
                <div className="flex gap-4">
                  {["STARTER", "GROWTH", "ENTERPRISE"].map((tier) => (
                    <label key={tier} className="flex items-center gap-2 cursor-pointer select-none">
                       <input
                        type="checkbox"
                        checked={applicablePlans.includes(tier)}
                        onChange={() => togglePlanSelection(tier)}
                        className="w-4 h-4 rounded bg-slate-950 border-slate-850 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-xs text-slate-300">{tier} Plan</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* One time per dairy checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none border-t border-slate-850 pt-4">
                <input
                  type="checkbox"
                  checked={oneTime}
                  onChange={(e) => setOneTime(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-850 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-xs text-slate-300 font-semibold">Restrict usage to one-time per Dairy customer account</span>
              </label>

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
                  {actionLoading ? "Deploying campaign code..." : "Deploy Campaign Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SuperAdminSidebar>
  );
};

export default SuperAdminCoupons;
