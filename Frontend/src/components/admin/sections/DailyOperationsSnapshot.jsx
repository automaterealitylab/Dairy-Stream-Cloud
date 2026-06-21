import React from "react";
import { motion } from "framer-motion";
import { 
  Milk, 
  IndianRupee, 
  AlertCircle, 
  PackageCheck, 
  Droplets, 
  Users, 
  Truck, 
  Flame, 
  TrendingUp 
} from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

const DailyOperationsSnapshot = ({
  data = {},
  adminName = "Admin",
  headerAction = null,
}) => {
  const stats = data.stats || {};
  const needed = stats?.total_milk || 0;
  const procured = stats?.procured_milk || 0;
  const diff = procured - needed;
  const isShortage = needed > procured;
  const progressPercent = needed > 0 ? Math.min((procured / needed) * 100, 100) : 0;
  const unfulfilledPercent = Math.max(0, 100 - Math.round(progressPercent));

  // Determine Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="mb-8 space-y-6" style={adminShellFont}>
      {/* 1. Welcome Card Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-[32px] p-6 text-white shadow-lg bg-gradient-to-br from-[#B8641A] to-[#E5C79D] dark:bg-gradient-to-br dark:from-[#059669] dark:to-[#0D9488] dark:border-none"
      >
        {/* Background Decorative Circles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 h-36 w-36 rounded-full bg-white/10" />
          <div className="absolute right-12 bottom-0 -mb-10 h-28 w-28 rounded-full bg-white/5" />
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-medium text-white/80">{getGreeting()}</p>
            {headerAction}
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight" style={adminHeadingFont}>
            Welcome, {adminName}
          </h2>
          <p className="mt-1.5 text-xs text-white/90">
            Here's today's dairy operations summary.
          </p>

          {/* Core Banner Stats Row */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm border border-white/10 text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/80 block">Demand</span>
              <span className="mt-1 text-lg font-black block">{needed}L</span>
            </div>
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm border border-white/10 text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/80 block">Procured</span>
              <span className="mt-1 text-lg font-black block">{procured}L</span>
            </div>
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm border border-white/10 text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/80 block">Revenue</span>
              <span className="mt-1 text-lg font-black block">Rs {stats?.collected || 0}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. Milk Shortage Bar */}
      {isShortage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-between rounded-[24px] border p-4 shadow-sm border-[#E9C194] bg-[#FFFBF7] text-[#B8641A] dark:bg-[#F59E0B]/10 dark:border-[#F59E0B]/20 dark:text-[#F59E0B]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF1E5] text-[#C26D2C] dark:bg-[#F59E0B]/20 dark:text-[#F59E0B]">
              <Flame size={18} />
            </div>
            <div>
              <p className="font-extrabold text-sm text-[#2C1A0E] dark:text-[#F59E0B]">
                Milk Shortage: {Math.abs(diff).toFixed(1)}L
              </p>
              <p className="text-[11px] font-semibold text-[#8B7355] dark:text-slate-400">
                Procurement needed to meet demand
              </p>
            </div>
          </div>

          <button className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all bg-[#C26D2C] text-white hover:bg-[#A85734] dark:bg-[#F59E0B] dark:text-[#0B0F19] dark:hover:bg-[#D97706]">
            Action
          </button>
        </motion.div>
      )}

      {/* 3. Six Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Card 1: INVENTORY */}
        <div className="rounded-[28px] border bg-white/95 p-4 sm:p-5 shadow-sm border-[#EDE8DF] dark:bg-[#121829] dark:border-[#1E293B] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#C4A882] dark:text-slate-500">Inventory</p>
            <h3 className="mt-2 text-2xl font-black text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>
              {unfulfilledPercent}%
            </h3>
            <p className="mt-0.5 text-[10px] font-black text-[#A85734] dark:text-red-500 uppercase">
              Unfulfilled
            </p>
            <div className="mt-3 flex gap-2 text-[9px] font-bold text-[#8B7355] dark:text-slate-400">
              <span>P: <span className="text-[#2C1A0E] dark:text-white font-extrabold">{stats?.pending || 0}</span></span>
              <span>F: <span className="text-[#A85734] dark:text-red-500 font-extrabold">{stats?.failed || 0}</span></span>
            </div>
          </div>

          {/* Radial progress ring */}
          <div className="relative h-12 w-12 flex-shrink-0">
            <svg className="h-full w-full transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="18"
                className="stroke-[#F2EDE4] dark:stroke-slate-800"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="24"
                cy="24"
                r="18"
                className="stroke-[#A85734] dark:stroke-red-500"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={2 * Math.PI * 18 * (1 - unfulfilledPercent / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-[#A85734] dark:bg-red-500" />
            </div>
          </div>
        </div>

        {/* Card 2: AGENTS */}
        <div className="rounded-[28px] border bg-white/95 p-4 sm:p-5 shadow-sm border-[#EDE8DF] dark:bg-[#121829] dark:border-[#1E293B] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#C4A882] dark:text-slate-500">Agents</p>
            <h3 className="mt-2 text-2xl font-black text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>
              {data.activeAgents || 0}/{data.totalAgents || 0}
            </h3>
            <p className="mt-0.5 text-[10px] font-black text-[#8B7355] dark:text-slate-400 uppercase">
              All active
            </p>
            <div className="mt-3">
              <span className="rounded-full px-2 py-0.5 text-[8px] font-black bg-[#F4F7ED] text-[#5C7A35] dark:bg-[#10B981]/15 dark:text-[#00C896]">
                ONLINE
              </span>
            </div>
          </div>

          {/* Radial progress ring */}
          <div className="relative h-12 w-12 flex-shrink-0">
            <svg className="h-full w-full transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="18"
                className="stroke-[#F2EDE4] dark:stroke-slate-800"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="24"
                cy="24"
                r="18"
                className="stroke-[#6F8C45] dark:stroke-[#10B981]"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={
                  data.totalAgents > 0 
                    ? 2 * Math.PI * 18 * (1 - (data.activeAgents || 0) / data.totalAgents)
                    : 2 * Math.PI * 18
                }
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Deliveries Today */}
        <div className="rounded-[28px] border bg-white/95 p-4 sm:p-5 shadow-sm border-[#EDE8DF] dark:bg-[#121829] dark:border-[#1E293B] flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFFDF8] border border-[#F2EDE4] text-[#B8641A] dark:bg-[#3B82F6]/10 dark:border-none dark:text-[#60A5FA]">
            <Truck size={22} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>
              {data.deliveriesToday || 0}
            </h3>
            <p className="text-[10px] font-black text-[#8B7355] dark:text-slate-400 uppercase tracking-tighter mt-0.5">
              Deliveries today
            </p>
          </div>
        </div>

        {/* Card 4: Customers */}
        <div className="rounded-[28px] border bg-white/95 p-4 sm:p-5 shadow-sm border-[#EDE8DF] dark:bg-[#121829] dark:border-[#1E293B] flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFFDF8] border border-[#F2EDE4] text-[#6F8C45] dark:bg-[#10B981]/10 dark:border-none dark:text-[#00C896]">
            <Users size={22} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>
              {data.totalCustomers || 0}
            </h3>
            <p className="text-[10px] font-black text-[#8B7355] dark:text-slate-400 uppercase tracking-tighter mt-0.5">
              Customers
            </p>
          </div>
        </div>

        {/* Card 5: PENDING */}
        <div className="rounded-[28px] border bg-white/95 p-4 sm:p-5 shadow-sm border-[#EDE8DF] dark:bg-[#121829] dark:border-[#1E293B]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#C4A882] dark:text-slate-500">Pending</p>
          <h3 className="mt-2 text-2xl font-black text-[#C26D2C] dark:text-[#F59E0B]" style={adminHeadingFont}>
            ₹{Number(stats?.pendingPayments || 0).toLocaleString("en-IN")}
          </h3>
          <p className="mt-1 text-[10px] font-black text-[#8B7355] dark:text-slate-400 uppercase tracking-tighter">
            Awaiting payment
          </p>
        </div>

        {/* Card 6: OUTSTANDING */}
        <div className="rounded-[28px] border bg-white/95 p-4 sm:p-5 shadow-sm border-[#EDE8DF] dark:bg-[#121829] dark:border-[#1E293B]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#C4A882] dark:text-slate-500">Outstanding</p>
          <h3 className="mt-2 text-2xl font-black text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>
            Rs {Number(stats?.outstanding || 0).toLocaleString("en-IN")}
          </h3>
          <p className="mt-1 text-[10px] font-black text-[#6F8C45] dark:text-[#00C896] uppercase tracking-tighter">
            All clear
          </p>
        </div>
      </div>
    </div>
  );
};

export default DailyOperationsSnapshot;
