import React from 'react';
import { ShieldAlert, AlertTriangle, Ghost, MessageSquareWarning } from 'lucide-react';

const CustomerRiskIndicator = ({ riskData = [] }) => {
  const safeRiskData = Array.isArray(riskData) ? riskData : [];

  const getRiskLevel = (customer) => {
    // Logic: 1 point per failed payment, 0.5 per pause, 1 per complaint
    const score = (customer.failed_payments || 0) + 
                  ((customer.pauses || 0) * 0.5) + 
                  (customer.complaints || 0);

    if (score >= 5) return { label: "High Risk", color: "bg-red-500", text: "text-red-700", bg: "bg-red-50" };
    if (score >= 2.5) return { label: "Moderate", color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
    return { label: "Stable", color: "bg-green-500", text: "text-green-700", bg: "bg-green-50" };
  };

  return (
    <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldAlert size={20} className="text-gray-400" />
          <h3 className="text-lg font-black text-gray-800">Risk Analysis</h3>
        </div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">30 Day Window</span>
      </div>

      <div className="space-y-3">
        {safeRiskData.length > 0 ? (
          safeRiskData.map((customer, i) => {
            const risk = getRiskLevel(customer);
            return (
              <div key={i} className={`p-4 rounded-2xl border border-white transition-all hover:shadow-md ${risk.bg}`}>
                <div className="flex flex-col gap-3">
                  
                  {/* Top Row: Name and Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${risk.color}`} />
                      <span className="font-black text-gray-800 text-sm">{customer?.name || "Unknown"}</span>
                    </div>
                    <p className={`text-[10px] font-black uppercase ${risk.text}`}>{risk.label}</p>
                  </div>

                  {/* Bottom Row: Detailed Metrics */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-gray-500">
                      <AlertTriangle size={12} className="text-red-400" />
                      <span className="text-[11px] font-bold">{customer.failed_payments || 0} Fails</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Ghost size={12} className="text-amber-500" />
                      <span className="text-[11px] font-bold">{customer.pauses || 0} Pauses</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <MessageSquareWarning size={12} className="text-blue-500" />
                      <span className="text-[11px] font-bold">{customer.complaints || 0} Issues</span>
                    </div>
                  </div>
                  
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 italic font-bold">All customers are healthy.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerRiskIndicator;