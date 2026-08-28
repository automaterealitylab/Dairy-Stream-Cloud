import { ChevronUp, ChevronDown, Share2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import {
  formatPaymentDate,
  formatCurrency,
  isCollectibleStatus,
} from "../../../utils/adminPayments.js";

export const MobilePaymentCards = ({ groups, expanded, onToggle, onSendReminder, onCollect }) =>
  groups.map((group) => {
    const isExpanded = Boolean(expanded[group.groupKey]);

    return (
      <article
        key={group.groupKey}
        className="rounded-[20px] border border-[#F2EDE4] bg-[#FFFDF8] p-4 dark:border-[#1E293B] dark:bg-[#161C2C]"
      >
        <button
          type="button"
          onClick={() => onToggle(group.groupKey)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <h4 className="break-words text-base font-black text-[#2C1A0E] dark:text-white">
              {group.customer || "Customer"}
            </h4>
            <p className="mt-1 text-xs font-semibold text-[#8B7355] dark:text-slate-400">
              {group.items.length} payment{group.items.length > 1 ? "s" : ""} on this day
            </p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FDF6EC] text-[#B8641A] dark:bg-[#0B0F19] dark:text-[#d97706]">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#F2EDE4] bg-white px-3 py-2.5 dark:border-[#222B40] dark:bg-[#121829]">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#B89970] dark:text-slate-400">Date</p>
            <p className="mt-1 text-sm font-bold text-[#5C3D1E] dark:text-white">{formatPaymentDate(group.date)}</p>
          </div>
          <div className="rounded-2xl border border-[#F2EDE4] bg-white px-3 py-2.5 dark:border-[#222B40] dark:bg-[#121829]">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#B89970] dark:text-slate-400">Amount</p>
            <p className="mt-1 text-sm font-black text-[#2C1A0E] dark:text-white">{formatCurrency(group.displayAmount)}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={group.status} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggle(group.groupKey)}
              className="h-9 rounded-xl bg-[#FDF6EC] px-3 text-[11px] font-black uppercase text-[#B8641A] transition hover:bg-[#F7E8D3] dark:bg-[#0B0F19] dark:text-[#d97706] dark:hover:bg-[#1C243A]"
            >
              {isExpanded ? "Hide" : "View"} Details
            </button>
            <button
              type="button"
              onClick={() =>
                onSendReminder({
                  phone: group.phone,
                  customer: group.customer,
                  amount: group.displayAmount,
                  date: group.date,
                  status: group.status,
                  paymentCount: group.items.length,
                })
              }
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#EDE8DF] text-emerald-600 transition hover:bg-emerald-50 dark:border-[#222B40] dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              title="Send Reminder"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>

        {group.items.length > 1 && (
          <p className="mt-3 text-xs font-semibold text-[#8B7355] dark:text-slate-400">
            {group.hasCollectibleItems
              ? `Total activity: ${formatCurrency(group.totalAmount)}`
              : `Recorded total: ${formatCurrency(group.totalAmount)}`}
          </p>
        )}

        {isExpanded && (
          <div className="mt-4 space-y-3 rounded-[18px] border border-[#EFE4D6] bg-white p-3 dark:border-[#222B40] dark:bg-[#121829]">
            {group.items.map((pay) => (
              <div
                key={pay.id}
                className="border-b border-[#F8F2E8] pb-3 last:border-b-0 last:pb-0 dark:border-[#222B40]"
              >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#2C1A0E] dark:text-white">{formatCurrency(pay.amount)}</p>
                  <p className="mt-1 text-xs text-[#8B7355] dark:text-slate-400">
                    {formatPaymentDate(pay.date)} · Payment ID: {pay.id}
                  </p>
                  {String(pay.verificationStatus || "").toUpperCase() === "SUBMITTED" ? (
                    <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                      Paid, pending verification
                    </p>
                  ) : null}
                </div>
                  <StatusBadge status={pay.status} />
                </div>
                {isCollectibleStatus(pay.status) && (
                  <button
                    type="button"
                    onClick={() => onCollect(pay)}
                    className="mt-3 h-9 w-full rounded-xl bg-[#B8641A] text-[11px] font-black uppercase text-white transition hover:bg-[#9E5415]"
                  >
                    Collect Payment
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </article>
    );
  });
