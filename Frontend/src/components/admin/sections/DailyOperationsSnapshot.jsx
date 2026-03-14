import React from 'react';
import { motion } from 'framer-motion';
import { Milk, Truck, IndianRupee, AlertCircle, PackageCheck, Droplets } from 'lucide-react';

const DailyOperationsSnapshot = ({ stats = {} }) => {
  // 1. Get the values from props [cite: 65, 72]
  const needed = stats?.total_milk || 0;
  const procured = stats?.procured_milk || 0; 
  
  // 2. Calculate the difference [cite: 86]
  const diff = procured - needed;
  const isShortage = needed > procured;
  
  // 3. Calculate Progress for the bar
  const progressPercent = needed > 0 ? Math.min((procured / needed) * 100, 100) : 0;

  const cards = [
    { 
      label: "Milk Needed", 
      value: `${needed}L`, 
      icon: Milk, 
      color: "text-blue-600", 
      bg: "bg-blue-50",
      desc: "Customer Demand"
    },
    { 
      label: "Milk Procured", 
      value: `${procured}L`, 
      icon: PackageCheck, 
      color: "text-indigo-600", 
      bg: "bg-indigo-50",
      desc: "In Stock"
    },
    { 
      label: "Cash Collected", 
      value: `₹${stats?.collected || 0}`, 
      icon: IndianRupee, 
      color: "text-green-600", 
      bg: "bg-green-50",
      desc: "Today's Revenue"
    },
    { 
      label: isShortage ? "Milk Shortage" : "Milk Wastage", 
      value: `${Math.abs(diff).toFixed(1)}L`, 
      icon: Droplets, 
      color: isShortage ? "text-orange-600" : "text-rose-600", 
      bg: isShortage ? "bg-orange-50" : "bg-rose-50",
      desc: isShortage ? "Buy More Milk" : "Unused Stock" 
    },
  ];

  return (
    <div className="space-y-4 mb-8">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.1 }}
            key={i} 
            className={`bg-white p-5 rounded-[28px] border shadow-sm flex items-center gap-4 hover:shadow-md transition-all ${
              card.label === "Milk Shortage" && diff !== 0 ? "border-orange-200 ring-1 ring-orange-50" : "border-gray-100"
            }`}
          >
            <div className={`h-12 w-12 ${card.bg} ${card.color} rounded-2xl flex items-center justify-center shrink-0`}>
              <card.icon size={22} />
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest truncate">{card.label}</p>
              <h3 className="text-xl font-black text-gray-900 leading-tight">{card.value}</h3>
              <p className="text-[9px] font-bold text-gray-400 uppercase italic mt-0.5">{card.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Operational Efficiency Bar [cite: 125, 126] */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }}
        className="bg-white px-6 py-4 rounded-[24px] border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-600 uppercase tracking-tighter">
            Inventory Level: <span className="text-blue-600">{progressPercent.toFixed(0)}% Fulfilled</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 min-w-[150px] max-w-xs h-2 bg-gray-100 rounded-full overflow-hidden mx-4">
           <div 
             className={`h-full transition-all duration-700 ${progressPercent < 100 ? 'bg-orange-500' : 'bg-blue-600'}`} 
             style={{ width: `${progressPercent}%` }}
           />
        </div>

        <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
           <span>Pending: <span className="text-gray-900">{stats?.pending || 0}</span></span>
           <span className="h-3 w-[1px] bg-gray-200" />
           <span>Failed: <span className="text-red-500">{stats?.failed || 0}</span></span>
        </div>
      </motion.div>
    </div>
  );
};

export default DailyOperationsSnapshot;