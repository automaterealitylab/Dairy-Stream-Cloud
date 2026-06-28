import React, { useState } from "react";
import { CheckCircle2, Truck, UserPlus, AlertCircle, X } from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

const activityMeta = {
  payment: {
    icon: CheckCircle2,
    color: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15 dark:text-[#00C896]",
  },
  route: {
    icon: Truck,
    color: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/15 dark:text-[#60A5FA]",
  },
  customer: {
    icon: UserPlus,
    color: "bg-amber-500/10 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400",
  },
  failed: {
    icon: AlertCircle,
    color: "bg-red-500/10 text-red-500 dark:bg-red-500/15 dark:text-red-400",
  },
};

const formatRelativeTime = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const diffMs = Date.now() - parsed.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  return `${Math.floor(diffMs / day)}d ago`;
};

export default function AdminActivity({ activities = [] }) {
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState("all"); 
  const [searchQuery, setSearchQuery] = useState("");
  const items = Array.isArray(activities) ? activities : [];

  const filteredItems = items.filter((act) => {
    const matchesSearch = 
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.desc.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterType === "all") return true;
    if (filterType === "payment") return act.type === "payment";
    if (filterType === "customer") return act.type === "customer";
    if (filterType === "delivery") return act.type === "route" || act.type === "failed";
    return true;
  });

  const renderAllActivitiesModal = () => {
    if (!showModal) return null;
    return (
      <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[rgba(44,26,14,0.45)] p-4 backdrop-blur-sm flex items-center justify-center">
        <div className="flex w-full max-w-xl max-h-[85vh] flex-col overflow-hidden rounded-[28px] border border-[#E7DAC6] bg-[#FFFDF7] shadow-[0_28px_70px_rgba(44,26,14,0.28)] dark:border-[#1E293B] dark:bg-[#121829]">
          
          {/* Header */}
          <div className="shrink-0 bg-gradient-to-r from-[#3E2B18] via-[#5B3E24] to-[#8A6A46] px-6 py-5 text-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F3D4A6]">Audit Feed</p>
              <h2 className="mt-1 text-2xl font-semibold" style={adminHeadingFont}>Activity Timeline</h2>
            </div>
            <button
              onClick={() => {
                setShowModal(false);
                setSearchQuery("");
                setFilterType("all");
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search & Filters */}
          <div className="p-5 border-b border-[#F2EDE4] dark:border-slate-800 space-y-4 shrink-0">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search activities..."
                className="w-full rounded-[16px] border border-[#EDE8DF] bg-[#FAF7F1] px-4 py-3 pl-10 text-sm font-semibold text-[#2C1A0E] outline-none transition focus:border-[#B8641A] focus:bg-white dark:border-[#222B40] dark:bg-[#161C2C] dark:text-white"
              />
              <span className="absolute left-3.5 top-3.5 text-xs text-[#A88763]">🔍</span>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All Logs", value: "all" },
                { label: "Payments", value: "payment" },
                { label: "Deliveries", value: "delivery" },
                { label: "Customers", value: "customer" },
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setFilterType(btn.value)}
                  className={`rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-colors ${
                    filterType === btn.value
                      ? "bg-[#B8641A] text-white"
                      : "bg-[#FDF6EC] text-[#8B7355] hover:bg-[#EEF5E7] dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0">
            {filteredItems.length > 0 ? (
              filteredItems.map((act) => {
                const meta = activityMeta[act.type] || activityMeta.route;
                const IconComponent = meta.icon;
                return (
                  <div
                    key={act.id}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-[#F2EDE4] bg-white p-4 shadow-[0_4px_12px_rgba(92,61,30,0.02)] dark:border-slate-800 dark:bg-slate-900/30 transition hover:bg-[#FFFBF5]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                        <IconComponent size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-[#2C1A0E] dark:text-white text-sm">{act.title}</p>
                        <p className="text-xs font-semibold text-[#8B7355] dark:text-slate-400 mt-0.5">{act.desc}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-[#C4A882] dark:text-slate-500">
                      {formatRelativeTime(act.at)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#E5D9C7] bg-[#FFFBF5] px-5 py-8 text-center dark:border-slate-800/60 dark:bg-slate-900/20">
                <p className="text-sm font-extrabold text-[#2C1A0E] dark:text-white">No activities found</p>
                <p className="mt-1 text-xs font-semibold text-[#8B7355] dark:text-slate-400">
                  Try adjusting your filter or search query.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  };

  return (
    <section
      className="rounded-[28px] border border-[#EDE8DF] bg-[#FFFDF8] p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:border-[#1E293B] dark:bg-[#121829] dark:shadow-none"
      style={adminShellFont}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C4A882] dark:text-slate-500">
            Timeline
          </p>
          <h4 className="mt-1 text-xl font-black text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>
            Recent Activity
          </h4>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-0.5 rounded-full bg-[#FDF6EC] px-3 py-1 text-[10px] font-black uppercase text-[#6F8C45] transition-colors hover:bg-[#EEF5E7] dark:bg-slate-800 dark:text-[#00C896]"
        >
          All <span className="text-[10px]">&gt;</span>
        </button>
      </div>

      <div className="space-y-2">
        {items.length > 0 ? items.slice(0, 8).map((act) => {
          const meta = activityMeta[act.type] || activityMeta.route;
          const IconComponent = meta.icon;
          return (
            <div key={act.id} className="flex items-center justify-between gap-3 rounded-[18px] px-1 py-2 text-sm transition-colors hover:bg-[#FFFBF5] dark:hover:bg-slate-900/30">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                  <IconComponent size={18} />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-[#2C1A0E] dark:text-white text-[13px]">{act.title}</p>
                  <p className="text-[11px] font-semibold text-[#8B7355] dark:text-slate-400 mt-0.5">{act.desc}</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-[#C4A882] dark:text-slate-500">
                {formatRelativeTime(act.at)}
              </span>
            </div>
          );
        }) : (
          <div className="flex min-h-[132px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#E5D9C7] bg-[#FFFBF5] px-5 py-7 text-center dark:border-slate-800/60 dark:bg-slate-900/20">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FDF6EC] text-[#B89970] dark:bg-slate-800 dark:text-slate-400">
              <CheckCircle2 size={19} />
            </div>
            <p className="mt-3 text-sm font-extrabold text-[#2C1A0E] dark:text-white">No recent activity</p>
            <p className="mt-1 text-xs font-semibold text-[#8B7355] dark:text-slate-400">New payments, deliveries, and customers will appear here.</p>
          </div>
        )}
      </div>
      {renderAllActivitiesModal()}
    </section>
  );
}
