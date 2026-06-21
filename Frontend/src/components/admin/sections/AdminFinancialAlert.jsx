import { WalletCards } from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

export default function AdminFinancialAlert({ amount }) {
  return (
    <section
      className="rounded-[28px] border border-[#EDE8DF] bg-[#FFFDF8] p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:border-[#1E293B] dark:bg-[#121829] dark:shadow-none"
      style={adminShellFont}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C9927A] dark:text-slate-400">
            Outstanding Payments
          </p>
          <p className="mt-3 text-[34px] font-semibold leading-none text-[#A85734] dark:text-white" style={adminHeadingFont}>
            Rs {Number(amount || 0).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#FFF1E5] text-[#B8641A] dark:bg-[#00C896]/10 dark:text-[#00C896]">
          <WalletCards size={22} />
        </div>
      </div>
    </section>
  );
}
