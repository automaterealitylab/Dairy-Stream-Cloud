import React from "react";
import { motion } from "framer-motion";
import { Milk, IndianRupee, AlertCircle, PackageCheck, Droplets } from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

const DailyOperationsSnapshot = ({ stats = {} }) => {
  const needed = stats?.total_milk || 0;
  const procured = stats?.procured_milk || 0;
  const diff = procured - needed;
  const isShortage = needed > procured;
  const progressPercent = needed > 0 ? Math.min((procured / needed) * 100, 100) : 0;

  const cards = [
    {
      label: "Milk Needed",
      value: `${needed}L`,
      icon: Milk,
      color: "text-[#B8641A]",
      bg: "bg-[#FDF6EC]",
      desc: "Customer Demand",
    },
    {
      label: "Milk Procured",
      value: `${procured}L`,
      icon: PackageCheck,
      color: "text-[#6F4A27]",
      bg: "bg-[#F8F2E8]",
      desc: "In Stock",
    },
    {
      label: "Cash Collected",
      value: `Rs ${stats?.collected || 0}`,
      icon: IndianRupee,
      color: "text-[#6F8C45]",
      bg: "bg-[#F4F7ED]",
      desc: "Today's Revenue",
    },
    {
      label: isShortage ? "Milk Shortage" : "Milk Wastage",
      value: `${Math.abs(diff).toFixed(1)}L`,
      icon: Droplets,
      color: isShortage ? "text-[#C26D2C]" : "text-[#A85734]",
      bg: isShortage ? "bg-[#FFF1E5]" : "bg-[#FBEDEA]",
      desc: isShortage ? "Buy More Milk" : "Unused Stock",
    },
  ];

  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`flex items-center gap-4 rounded-[28px] border bg-white/95 p-5 shadow-[0_18px_45px_rgba(92,61,30,0.08)] transition-all hover:-translate-y-0.5 ${
              card.label === "Milk Shortage" && diff !== 0 ? "border-[#E9C194] ring-1 ring-[#FFF1E5]" : "border-[#EDE8DF]"
            }`}
            style={adminShellFont}
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${card.bg} ${card.color}`}>
              <card.icon size={22} />
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#C4A882]">{card.label}</p>
              <h3 className="text-3xl leading-tight text-[#2C1A0E]" style={adminHeadingFont}>
                {card.value}
              </h3>
              <p className="mt-0.5 text-[9px] font-bold uppercase italic text-[#8B7355]">{card.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[#EDE8DF] bg-white/95 px-6 py-4 shadow-[0_18px_45px_rgba(92,61,30,0.08)]"
        style={adminShellFont}
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-[#B8641A]" />
          <span className="text-xs font-bold uppercase tracking-tighter text-[#8B7355]">
            Inventory Level: <span className="text-[#B8641A]">{progressPercent.toFixed(0)}% Fulfilled</span>
          </span>
        </div>

        <div className="mx-4 h-2 min-w-[150px] max-w-xs flex-1 overflow-hidden rounded-full bg-[#F2EDE4]">
          <div
            className={`h-full transition-all duration-700 ${progressPercent < 100 ? "bg-[#C26D2C]" : "bg-[#B8641A]"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-[#B89970]">
          <span>
            Pending: <span className="text-[#2C1A0E]">{stats?.pending || 0}</span>
          </span>
          <span className="h-3 w-[1px] bg-[#E5D9C7]" />
          <span>
            Failed: <span className="text-[#A85734]">{stats?.failed || 0}</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default DailyOperationsSnapshot;
