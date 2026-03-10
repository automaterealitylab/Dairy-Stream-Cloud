import React from 'react';
import { motion } from 'framer-motion';
import { Milk, Truck, IndianRupee, AlertCircle } from 'lucide-react';

// ✅ Added default = {} to prevent "undefined" errors
const DailyOperationsSnapshot = ({ stats = {} }) => {
  const cards = [
    // ✅ Added optional chaining stats?.total_milk
    { label: "Milk Needed", value: `${stats?.total_milk || 0}L`, icon: Milk, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending Deliveries", value: stats?.pending || 0, icon: Truck, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Cash Collected", value: `₹${stats?.collected || 0}`, icon: IndianRupee, color: "text-green-600", bg: "bg-green-50" },
    { label: "Failed Today", value: stats?.failed || 0, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {cards.map((card, i) => (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: i * 0.1 }}
          key={i} 
          className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm flex items-center gap-4"
        >
          <div className={`h-12 w-12 ${card.bg} ${card.color} rounded-xl flex items-center justify-center`}>
            <card.icon size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{card.label}</p>
            <h3 className="text-xl font-black text-gray-900">{card.value}</h3>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default DailyOperationsSnapshot;