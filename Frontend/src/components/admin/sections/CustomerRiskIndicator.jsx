import React from "react";
import { ShieldAlert, AlertTriangle, Ghost, MessageSquareWarning, ShieldCheck } from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

const CustomerRiskIndicator = ({ riskData = [] }) => {
  const safeRiskData = Array.isArray(riskData) ? riskData : [];

  const getRiskLevel = (customer) => {
    const score = (customer.failed_payments || 0) + (customer.pauses || 0) * 0.5 + (customer.complaints || 0);

    if (score >= 5) return { label: "High Risk", color: "bg-[#A85734] dark:bg-red-500", text: "text-[#A85734] dark:text-red-400", bg: "bg-[#FFF4EE] dark:bg-red-500/5" };
    if (score >= 2.5) return { label: "Moderate", color: "bg-[#C26D2C] dark:bg-amber-500", text: "text-[#C26D2C] dark:text-amber-400", bg: "bg-[#FFF1E5] dark:bg-amber-500/5" };
    return { label: "Stable", color: "bg-[#6F8C45] dark:bg-emerald-500", text: "text-[#6F8C45] dark:text-emerald-400", bg: "bg-[#F4F7ED] dark:bg-emerald-500/5" };
  };

  return (
    <div
      className="rounded-[28px] border border-[#EDE8DF] bg-[#FFFDF8] p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:border-[#1E293B] dark:bg-[#121829] dark:shadow-none"
      style={adminShellFont}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#FDF6EC] text-[#B89970] dark:bg-slate-800 dark:text-slate-400">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C4A882] dark:text-slate-500">
              Customers
            </p>
            <h3 className="mt-1 text-xl font-black text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>
              Risk Analysis
            </h3>
          </div>
        </div>
        <span className="rounded-full bg-[#FDF6EC] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#B89970] dark:bg-slate-800 dark:text-slate-400">
          30D
        </span>
      </div>

      <div className="space-y-3">
        {safeRiskData.length > 0 ? (
          safeRiskData.map((customer, i) => {
            const risk = getRiskLevel(customer);
            return (
              <div key={i} className={`rounded-2xl border border-[#F2EDE4] p-4 transition-all hover:shadow-sm dark:border-[#1E293B] ${risk.bg}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${risk.color}`} />
                      <span className="text-sm font-bold text-[#2C1A0E] dark:text-white">{customer?.name || "Unknown"}</span>
                    </div>
                    <p className={`text-[10px] font-black uppercase ${risk.text}`}>{risk.label}</p>
                  </div>

                  <div className="flex items-center gap-4 text-[#8B7355] dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={12} className="text-[#A85734] dark:text-red-400" />
                      <span className="text-[11px] font-bold">{customer.failed_payments || 0} Fails</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Ghost size={12} className="text-[#C26D2C] dark:text-amber-400" />
                      <span className="text-[11px] font-bold">{customer.pauses || 0} Pauses</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquareWarning size={12} className="text-[#B8641A] dark:text-orange-400" />
                      <span className="text-[11px] font-bold">{customer.complaints || 0} Issues</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-[#E5D9C7] bg-[#FFFBF5] px-5 py-8 text-center dark:border-slate-800/60 dark:bg-slate-900/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-[#00A878] dark:bg-[#10B981]/15 dark:text-[#00C896]">
              <ShieldCheck size={20} />
            </div>
            <div className="text-center">
              <p className="text-sm font-extrabold text-[#2C1A0E] dark:text-white">All customers healthy</p>
              <p className="mt-1 text-xs font-semibold text-[#8B7355] dark:text-slate-400">No churn signals detected.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerRiskIndicator;
