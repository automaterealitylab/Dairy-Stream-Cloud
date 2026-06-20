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
      className="rounded-[28px] border border-[#EDE8DF] bg-white/95 p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:bg-[#121829] dark:border-[#1E293B] dark:shadow-none"
      style={adminShellFont}
    >
      <div className="flex items-center justify-between mb-5">
        <h4 className="text-xl text-[#2C1A0E] dark:text-white font-black" style={adminHeadingFont}>
          Recent Activity
        </h4>
        <button className="text-xs font-black uppercase text-[#6F8C45] dark:text-[#00C896] hover:underline flex items-center gap-0.5">
          All <span className="text-[10px]">&gt;</span>
        </button>
      </div>

      <div className="space-y-4">
        {activities.map((act) => {
          const IconComponent = act.icon;
          return (
            <div key={act.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${act.color}`}>
                  <IconComponent size={18} />
                </div>
                <div>
                  <p className="font-extrabold text-[#2C1A0E] dark:text-white text-[13px]">{act.title}</p>
                  <p className="text-[11px] font-semibold text-[#8B7355] dark:text-slate-400 mt-0.5">{act.desc}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#C4A882] dark:text-slate-500 shrink-0">
                {act.time}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
