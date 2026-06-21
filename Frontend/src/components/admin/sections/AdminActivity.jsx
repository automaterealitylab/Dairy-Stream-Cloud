import React from "react";
import { CheckCircle2, Truck, UserPlus, AlertCircle } from "lucide-react";
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
  const items = Array.isArray(activities) ? activities : [];

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
        <button className="flex items-center gap-0.5 rounded-full bg-[#FDF6EC] px-3 py-1 text-[10px] font-black uppercase text-[#6F8C45] transition-colors hover:bg-[#EEF5E7] dark:bg-slate-800 dark:text-[#00C896]">
          All <span className="text-[10px]">&gt;</span>
        </button>
      </div>

      <div className="space-y-2">
        {items.length > 0 ? items.map((act) => {
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
    </section>
  );
}
