import React from "react";
import { CheckCircle2, Truck, UserPlus, AlertCircle } from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

export default function AdminActivity() {
  const activities = [
    {
      id: 1,
      type: "payment",
      title: "Payment received",
      desc: "Rajesh Kumar · ₹480",
      time: "2m ago",
      icon: CheckCircle2,
      color: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15 dark:text-[#00C896]",
    },
    {
      id: 2,
      type: "route",
      title: "Route completed",
      desc: "Agent Priya · 6 stops",
      time: "18m ago",
      icon: Truck,
      color: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/15 dark:text-[#60A5FA]",
    },
    {
      id: 3,
      type: "customer",
      title: "New customer",
      desc: "Sunita Devi added",
      time: "1h ago",
      icon: UserPlus,
      color: "bg-amber-500/10 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400",
    },
    {
      id: 4,
      type: "failed",
      title: "Delivery failed",
      desc: "Order #2091 · retry",
      time: "2h ago",
      icon: AlertCircle,
      color: "bg-red-500/10 text-red-500 dark:bg-red-500/15 dark:text-red-400",
    },
  ];

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
        {activities.map((act) => {
          const IconComponent = act.icon;
          return (
            <div key={act.id} className="flex items-center justify-between gap-3 rounded-[18px] px-1 py-2 text-sm transition-colors hover:bg-[#FFFBF5] dark:hover:bg-slate-900/30">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${act.color}`}>
                  <IconComponent size={18} />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-[#2C1A0E] dark:text-white text-[13px]">{act.title}</p>
                  <p className="text-[11px] font-semibold text-[#8B7355] dark:text-slate-400 mt-0.5">{act.desc}</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-[#C4A882] dark:text-slate-500">
                {act.time}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
