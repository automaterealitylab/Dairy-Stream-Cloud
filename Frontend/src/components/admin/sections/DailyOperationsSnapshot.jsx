import React from "react";
import { motion as Motion } from "framer-motion";
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
    <div className="mb-8 space-y-8" style={adminShellFont}>
      {/* Brown overview hero */}
      <Motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative min-h-[312px] overflow-hidden rounded-[28px] border border-[#5C3D1E]/10 bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] px-[30px] py-[31px] text-white shadow-[0_22px_55px_rgba(44,26,14,0.18)]"
      >
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_right,rgba(255,241,228,0.18),transparent_40%)]" />
        <div className="absolute -right-7 -top-8 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-14 left-9 h-36 w-36 rounded-full bg-[#D28A40]/10" />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-white/50">
                Admin Overview
              </p>
              <h2 className="mt-5 text-[43px] font-semibold leading-[1.08] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]" style={adminHeadingFont}>
                <span style={{ color: "#FFFFFF", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
                  Welcome,
                </span>{" "}
                <span className="text-[#FFDFAE]">{adminName}</span>
              </h2>
              <p className="mt-3 text-[17px] text-white/85">
                {getGreeting()} — here&apos;s today&apos;s dairy operations summary.
              </p>
            </div>

            {headerAction ? (
              <div className="hidden shrink-0 xl:block">
                {headerAction}
              </div>
            ) : null}
          </div>

          <div className="mt-9 grid grid-cols-3 gap-4">
            <div className="rounded-[20px] border border-white/70 bg-white/10 px-4 py-4 text-center backdrop-blur-sm">
              <span className="block text-[11px] font-black uppercase tracking-widest text-white/75">Demand</span>
              <span className="mt-2 block text-2xl font-black">{needed}L</span>
            </div>
            <div className="rounded-[20px] border border-white/70 bg-white/10 px-4 py-4 text-center backdrop-blur-sm">
              <span className="block text-[11px] font-black uppercase tracking-widest text-white/75">Procured</span>
              <span className="mt-2 block text-2xl font-black">{procured}L</span>
            </div>
            <div className="rounded-[20px] border border-white/70 bg-white/10 px-4 py-4 text-center backdrop-blur-sm">
              <span className="block text-[11px] font-black uppercase tracking-widest text-white/75">Revenue</span>
              <span className="mt-2 block text-2xl font-black">Rs {stats?.collected || 0}</span>
            </div>
          </div>
        </div>
      </Motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-[22px] xl:grid-cols-4">
        {/* Card 1: INVENTORY */}
        <div className="col-span-2 flex min-h-[178px] items-center justify-between rounded-[28px] border border-[#EDE8DF] bg-[#FFFDF8] p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)] xl:col-span-2">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#C4A882]">Inventory</p>
            <h3 className="mt-4 text-[34px] font-semibold text-[#2C1A0E]" style={adminHeadingFont}>
              {unfulfilledPercent}%
            </h3>
            <p className="mt-1 text-[11px] font-black uppercase text-[#A85734]">
              Unfulfilled
            </p>
            <div className="mt-6 flex gap-3 text-[11px] font-bold text-[#8B7355]">
              <span>P: <span className="font-extrabold text-[#2C1A0E]">{stats?.pending || 0}</span></span>
              <span>F: <span className="font-extrabold text-[#A85734]">{stats?.failed || 0}</span></span>
            </div>
          </div>

          {/* Radial progress ring */}
          <div className="relative h-14 w-14 flex-shrink-0">
            <svg className="h-full w-full transform -rotate-90">
              <circle
                cx="28"
                cy="28"
                r="20"
                className="stroke-[#F2EDE4]"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="28"
                cy="28"
                r="20"
                className="stroke-[#A85734]"
                strokeWidth="5"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - unfulfilledPercent / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-[#A85734]" />
            </div>
          </div>
        </div>

        {/* Card 2: AGENTS */}
        <div className="col-span-2 flex min-h-[178px] items-center justify-between rounded-[28px] border border-[#EDE8DF] bg-[#FFFDF8] p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)] xl:col-span-2">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#C4A882]">Agents</p>
            <h3 className="mt-4 text-[34px] font-semibold text-[#2C1A0E]" style={adminHeadingFont}>
              {data.activeAgents || 0}/{data.totalAgents || 0}
            </h3>
            <p className="mt-1 text-[11px] font-black uppercase text-[#8B7355]">
              All active
            </p>
            <div className="mt-6">
              <span className="rounded-full bg-[#EEF5E7] px-3 py-1 text-[10px] font-black text-[#4A7C2F]">
                ONLINE
              </span>
            </div>
          </div>

          {/* Radial progress ring */}
          <div className="relative h-14 w-14 flex-shrink-0">
            <svg className="h-full w-full transform -rotate-90">
              <circle
                cx="28"
                cy="28"
                r="20"
                className="stroke-[#F2EDE4]"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="28"
                cy="28"
                r="20"
                className="stroke-[#6F8C45]"
                strokeWidth="5"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={
                  data.totalAgents > 0 
                    ? 2 * Math.PI * 20 * (1 - (data.activeAgents || 0) / data.totalAgents)
                    : 2 * Math.PI * 20
                }
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Deliveries Today */}
        <div className="relative min-h-[160px] rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] p-4 shadow-[0_18px_45px_rgba(92,61,30,0.08)] sm:rounded-[28px] sm:p-6">
          <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-[#F2EDE4] bg-white text-[#B8641A] sm:right-6 sm:top-6 sm:h-10 sm:w-10 sm:rounded-[14px]">
            <Truck size={18} />
          </div>
          <p className="pr-10 text-[10px] font-black uppercase tracking-[0.14em] text-[#C4A882] sm:pr-12 sm:text-[12px] sm:tracking-[0.22em]">Deliveries</p>
          <h3 className="mt-5 text-[28px] font-semibold text-[#2C1A0E] sm:mt-4 sm:text-[34px]" style={adminHeadingFont}>
            {data.deliveriesToday || 0}
          </h3>
          <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-[#8B7355]">Scheduled today</p>
        </div>

        {/* Card 4: Customers */}
        <div className="relative min-h-[160px] rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] p-4 shadow-[0_18px_45px_rgba(92,61,30,0.08)] sm:rounded-[28px] sm:p-6">
          <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-[#F2EDE4] bg-white text-[#6F8C45] sm:right-6 sm:top-6 sm:h-10 sm:w-10 sm:rounded-[14px]">
            <Users size={18} />
          </div>
          <p className="pr-10 text-[10px] font-black uppercase tracking-[0.14em] text-[#C4A882] sm:pr-12 sm:text-[12px] sm:tracking-[0.22em]">Customers</p>
          <h3 className="mt-5 text-[28px] font-semibold text-[#2C1A0E] sm:mt-4 sm:text-[34px]" style={adminHeadingFont}>
            {data.totalCustomers || 0}
          </h3>
          <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-[#8B7355]">Active accounts</p>
        </div>

        {/* Card 5: PENDING */}
        <div className="relative min-h-[160px] rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] p-4 shadow-[0_18px_45px_rgba(92,61,30,0.08)] sm:rounded-[28px] sm:p-6">
          <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-[#F2EDE4] bg-white text-[#B8641A] sm:right-6 sm:top-6 sm:h-10 sm:w-10 sm:rounded-[14px]">
            <IndianRupee size={18} />
          </div>
          <p className="pr-10 text-[10px] font-black uppercase tracking-[0.14em] text-[#C4A882] sm:pr-12 sm:text-[12px] sm:tracking-[0.22em]">Pending</p>
          <h3 className="mt-5 text-[24px] font-semibold text-[#2C1A0E] sm:mt-4 sm:text-[34px]" style={adminHeadingFont}>
            ₹{Number(stats?.pendingPayments || 0).toLocaleString("en-IN")}
          </h3>
          <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-[#8B7355]">
            Awaiting payment
          </p>
        </div>

        {/* Card 6: OUTSTANDING */}
        <div className="relative min-h-[160px] rounded-[22px] border border-[#EDE8DF] bg-[#FFFDF8] p-4 shadow-[0_18px_45px_rgba(92,61,30,0.08)] sm:rounded-[28px] sm:p-6">
          <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-[#F2EDE4] bg-white text-[#6F8C45] sm:right-6 sm:top-6 sm:h-10 sm:w-10 sm:rounded-[14px]">
            <AlertCircle size={18} />
          </div>
          <p className="pr-10 text-[10px] font-black uppercase tracking-[0.14em] text-[#C4A882] sm:pr-12 sm:text-[12px] sm:tracking-[0.22em]">Outstanding</p>
          <h3 className="mt-5 text-[22px] font-semibold text-[#2C1A0E] sm:mt-4 sm:text-[34px]" style={adminHeadingFont}>
            Rs {Number(stats?.outstanding || 0).toLocaleString("en-IN")}
          </h3>
          <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-[#6F8C45]">
            All clear
          </p>
        </div>
      </div>
    </div>
  );
};

export default DailyOperationsSnapshot;
