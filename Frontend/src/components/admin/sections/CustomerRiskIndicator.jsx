import React from "react";
import { ShieldAlert, AlertTriangle, Ghost, MessageSquareWarning } from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

const CustomerRiskIndicator = ({ riskData = [] }) => {
  const safeRiskData = Array.isArray(riskData) ? riskData : [];

  const getRiskLevel = (customer) => {
    const score = (customer.failed_payments || 0) + (customer.pauses || 0) * 0.5 + (customer.complaints || 0);

    if (score >= 5) return { label: "High Risk", color: "bg-[#A85734]", text: "text-[#A85734]", bg: "bg-[#FFF4EE]" };
    if (score >= 2.5) return { label: "Moderate", color: "bg-[#C26D2C]", text: "text-[#C26D2C]", bg: "bg-[#FFF1E5]" };
    return { label: "Stable", color: "bg-[#6F8C45]", text: "text-[#6F8C45]", bg: "bg-[#F4F7ED]" };
  };

  return (
    <div
      className="rounded-[32px] border border-[#EDE8DF] bg-white/95 p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)]"
      style={adminShellFont}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={20} className="text-[#B89970]" />
          <h3 className="text-xl text-[#2C1A0E]" style={adminHeadingFont}>
            Risk Analysis
          </h3>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A882]">30 Day Window</span>
      </div>

      <div className="space-y-3">
        {safeRiskData.length > 0 ? (
          safeRiskData.map((customer, i) => {
            const risk = getRiskLevel(customer);
            return (
              <div key={i} className={`rounded-2xl border border-[#F2EDE4] p-4 transition-all hover:shadow-sm ${risk.bg}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${risk.color}`} />
                      <span className="text-sm font-bold text-[#2C1A0E]">{customer?.name || "Unknown"}</span>
                    </div>
                    <p className={`text-[10px] font-black uppercase ${risk.text}`}>{risk.label}</p>
                  </div>

                  <div className="flex items-center gap-4 text-[#8B7355]">
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={12} className="text-[#A85734]" />
                      <span className="text-[11px] font-bold">{customer.failed_payments || 0} Fails</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Ghost size={12} className="text-[#C26D2C]" />
                      <span className="text-[11px] font-bold">{customer.pauses || 0} Pauses</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquareWarning size={12} className="text-[#B8641A]" />
                      <span className="text-[11px] font-bold">{customer.complaints || 0} Issues</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm font-bold italic text-[#B89970]">All customers are healthy.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerRiskIndicator;
