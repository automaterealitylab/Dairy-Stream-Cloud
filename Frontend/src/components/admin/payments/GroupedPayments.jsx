import { Fragment } from "react";
import { ChevronUp, ChevronDown, Share2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import {
  formatPaymentDate,
  formatCurrency,
  isCollectibleStatus,
} from "../../../utils/adminPayments.js";

export const GroupedPayments = ({ groups, expanded, onToggle, onSendReminder, onCollect }) =>
  groups.map((group) => {
    const isExpanded = Boolean(expanded[group.groupKey]);

    return (
      <Fragment key={group.groupKey}>
        <tr
          className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-[#1C243A]"
          onClick={() => onToggle(group.groupKey)}
        >
          <td className="px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FDF6EC] text-[#B8641A] dark:bg-[#0B0F19] dark:text-[#d97706]">
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              <div>
                <div className="font-bold text-gray-900 dark:text-white">{group.customer}</div>
                <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  {group.items.length} payment{group.items.length > 1 ? "s" : ""} on this day
                </div>
              </div>
            </div>
          </td>
          <td className="px-6 py-5 text-sm text-gray-500 dark:text-slate-400">{formatPaymentDate(group.date)}</td>
          <td className="px-6 py-5">
            <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(group.displayAmount)}</div>
            {group.items.length > 1 && (
              <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                {group.hasCollectibleItems
                  ? `Total activity: ${formatCurrency(group.totalAmount)}`
                  : `Recorded total: ${formatCurrency(group.totalAmount)}`}
              </div>
            )}
          </td>
          <td className="px-6 py-5"><StatusBadge status={group.status} /></td>
          <td className="px-6 py-5 text-right">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(group.groupKey);
                }}
                className="flex h-9 items-center justify-center rounded-xl bg-[#FDF6EC] px-4 text-[11px] font-black uppercase text-[#B8641A] transition-all hover:bg-[#F7E8D3] dark:bg-[#0B0F19] dark:text-[#d97706] dark:hover:bg-[#1C243A]"
              >
                {isExpanded ? "Hide" : "View"} Details
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSendReminder({
                    phone: group.phone,
                    customer: group.customer,
                    amount: group.displayAmount,
                    date: group.date,
                    status: group.status,
                    paymentCount: group.items.length,
                  });
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 text-emerald-500 transition-all hover:bg-emerald-50 hover:text-emerald-700 dark:border-[#222B40] dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
                title="Send Reminder"
              >
                <Share2 size={16} />
              </button>
            </div>
          </td>
        </tr>

        {isExpanded && (
          <tr className="bg-[#FFFCF8] dark:bg-[#1C243A]">
            <td colSpan="5" className="px-6 py-4">
              <div className="overflow-hidden rounded-[24px] border border-[#EFE4D6] bg-white dark:border-[#222B40] dark:bg-[#121829]">
                <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b border-[#F2EDE4] bg-[#FFF8F0] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#B89970] dark:border-[#222B40] dark:bg-[#161C2C] dark:text-slate-400">
                  <span>Customer</span>
                  <span>Date</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>

                {group.items.map((pay) => (
                  <div
                    key={pay.id}
                    className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b border-[#F8F2E8] px-4 py-4 last:border-b-0 dark:border-[#222B40]"
                  >
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">{pay.customer}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">Payment ID: {pay.id}</div>
                      {String(pay.verificationStatus || "").toUpperCase() === "SUBMITTED" ? (
                        <div className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                          Paid, pending verification
                        </div>
                      ) : null}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">{formatPaymentDate(pay.date)}</div>
                    <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(pay.amount)}</div>
                    <div><StatusBadge status={pay.status} /></div>
                    <div className="flex items-center justify-end gap-2">
                      {isCollectibleStatus(pay.status) && (
                        <button
                          onClick={() => onCollect(pay)}
                          className="h-9 px-4 bg-blue-600 text-white text-[11px] font-black uppercase rounded-xl hover:bg-blue-700 shadow-md shadow-blue-100 transition-all active:scale-95 flex items-center justify-center"
                        >
                          Collect
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  });
