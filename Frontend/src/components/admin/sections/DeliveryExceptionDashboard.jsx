import React from "react";
import { AlertTriangle, UserX, CheckCircle2 } from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

const DeliveryExceptionDashboard = ({ exceptions = [], selectedIds = [], onToggleSelect, onReschedule }) => {
  const items = Array.isArray(exceptions) ? exceptions : [];

  return (
    <div
      className="rounded-[32px] border border-[#EDE8DF] bg-white/95 p-6 sm:p-8 shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:bg-[#121829] dark:border-[#1E293B] dark:shadow-none"
      style={adminShellFont}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#FFF1E5] p-2 text-[#C26D2C] dark:bg-amber-500/10 dark:text-[#F59E0B]">
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-xl sm:text-2xl text-[#2C1A0E] dark:text-white font-black" style={adminHeadingFont}>
            Delivery Exceptions
          </h3>
        </div>

        {items.length > 0 ? (
          <span className="rounded-full bg-[#FDF6EC] px-3 py-1 text-[10px] font-black uppercase text-[#B89970] dark:bg-slate-800 dark:text-slate-400">
            {items.length} Issues Found
          </span>
        ) : (
          <span className="rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-[#00C896] dark:bg-[#10B981]/15 dark:text-[#00C896]">
            TODAY
          </span>
        )}
      </div>

      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((exc) => {
            const isSelected = selectedIds.includes(exc.id);
            const reason = exc?.notes?.split("FAILED_REASON]: ")[1] || "Unknown Reason";

            return (
              <div
                key={exc.id}
                className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
                  isSelected 
                    ? "border-[#E5C79D] bg-[#FFF8EE] shadow-sm dark:border-[#00C896] dark:bg-[#00C896]/5" 
                    : "border-[#F2EDE4] bg-[#FFFDF8] dark:border-[#1E293B] dark:bg-[#161D30]/40"
                }`}
              >
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(exc.id)}
                    className="h-5 w-5 cursor-pointer rounded-md border-[#D7C7B2] text-[#B8641A] focus:ring-[#C98A42] dark:border-slate-700 dark:bg-slate-800 dark:text-[#00C896] dark:focus:ring-[#00C896]/30"
                  />

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffffff] text-[#A85734] shadow-sm dark:bg-slate-800 dark:text-red-400">
                    <UserX size={20} />
                  </div>

                  <div>
                    <p className="font-bold text-[#2C1A0E] dark:text-white">{exc?.customer_name || `Customer #${exc?.customer_id}`}</p>
                    <p className="text-[10px] font-black uppercase tracking-tighter text-[#A85734] dark:text-red-400">{reason}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="mr-4 hidden text-right sm:block">
                    <p className="text-[10px] font-black uppercase text-[#C4A882] dark:text-slate-500">Quantity</p>
                    <p className="font-black text-[#6F4A27] dark:text-slate-300">{exc?.quantity_liters}L</p>
                  </div>

                  <button
                    onClick={() => onReschedule?.(exc?.id)}
                    className="rounded-xl border border-[#E5C79D] bg-[#ffffff] px-4 py-2 text-xs font-black uppercase text-[#B8641A] transition-all hover:bg-[#B8641A] hover:text-white dark:border-[#00C896]/20 dark:bg-[#00C896]/10 dark:text-[#00C896] dark:hover:bg-[#00C896] dark:hover:text-[#0B0F19]"
                  >
                    Reschedule
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-[24px] border border-dashed border-[#E5D9C7] bg-[#FFFDF8] py-10 text-center dark:border-slate-800/60 dark:bg-slate-900/20 flex flex-col items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-[#00C896] dark:bg-[#10B981]/15 dark:text-[#00C896]">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-xs font-bold text-[#B89970] dark:text-slate-400">No exceptions for today</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryExceptionDashboard;
