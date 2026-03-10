import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';

const CustomerRiskIndicator = ({ riskData = [] }) => { // ✅ Safety default
  // ✅ Extra layer: Normalize to array
  const safeRiskData = Array.isArray(riskData) ? riskData : [];

  const getRiskLevel = (score) => {
    if (score >= 5) return { label: "High Risk", color: "bg-red-500", text: "text-red-700", bg: "bg-red-50" };
    if (score >= 2) return { label: "Moderate", color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
    return { label: "Low Risk", color: "bg-green-500", text: "text-green-700", bg: "bg-green-50" };
  };

  return (
    <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <ShieldAlert size={20} className="text-gray-400" />
        <h3 className="text-lg font-black text-gray-800">Risk Analysis</h3>
      </div>

      <div className="space-y-4">
        {safeRiskData.length > 0 ? (
          safeRiskData.map((customer, i) => {
            const risk = getRiskLevel(customer?.failed_payments || 0);
            return (
              <div key={i} className={`p-4 rounded-2xl flex items-center justify-between ${risk.bg}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${risk.color}`} />
                  <span className="font-bold text-gray-700">{customer?.name || "Unknown Customer"}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-[10px] font-black uppercase ${risk.text}`}>{risk.label}</p>
                    <p className="text-xs font-medium text-gray-500">{customer?.failed_payments || 0} fails</p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-400 italic text-center py-4 font-bold">No customer risks detected.</p>
        )}
      </div>
    </div>
  );
};

export default CustomerRiskIndicator;