import { MapPin, Package, UserRound } from "lucide-react";
import { buildDeliveryMeta } from "../../../utils/adminDeliveries.js";
import { StatusPill } from "./StatusPill.jsx";

export const DeliveryRow = ({
  delivery,
  approvingId,
  assigningId,
  resolvingIssueId,
  onApprove,
  onAssignPartner,
  onResolveIssue,
}) => {
  const d = delivery;

  return (
    <article className="grid grid-cols-1 items-start gap-4 px-5 py-4 transition-colors hover:bg-[#FFFCF7] dark:hover:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.9fr_0.9fr_1.05fr_auto] lg:items-center">
      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="shrink-0 text-[#B8641A] dark:text-[#00C896]" />
          <p className="truncate text-[13px] font-extrabold uppercase tracking-[0.1em] text-[#2C1A0E] dark:text-white">Flat {d.roomNo || "-"}</p>
        </div>
        <p className="mt-1 truncate pl-[22px] text-[11px] text-[#8B7355] dark:text-slate-400">
          {buildDeliveryMeta(d).join(" | ")}
        </p>
        {d.isProjected ? (
          <p className="mt-1 truncate text-[11px] font-semibold text-[#B8641A]">
            Projected from active subscription for this date
          </p>
        ) : null}
        {d.hasOpenIssue ? (
          <p className="mt-1 truncate text-[11px] font-semibold text-rose-700">
            Issue: {d.customerIssue || "Reported by customer"}
          </p>
        ) : null}
        {!d.hasOpenIssue && d.issueStatus === "RESOLVED" && d.issueAdminAction ? (
          <p className="mt-1 truncate text-[11px] font-semibold text-emerald-700">
            Action taken: {d.issueAdminAction}
          </p>
        ) : null}
        {d.paymentUtrNumber ? (
          <p className="mt-1 text-[11px] font-semibold text-[#5C3D1E]">
            UTR: <span className="font-black text-[#2C1A0E]">{d.paymentUtrNumber}</span>
          </p>
        ) : null}
        {d.paymentScreenshotUrl ? (
          <a
            href={d.paymentScreenshotUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex text-[11px] font-bold text-[#B8641A] hover:underline"
          >
            View payment screenshot
          </a>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#B89970]"><Package size={12} /> Product</p>
        <p className="mt-1 truncate text-sm font-bold text-[#2C1A0E] dark:text-white">
          {d.productType || "Milk"}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-[#8B7355] dark:text-slate-400">{d.quantity}</p>
      </div>

      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#B89970]"><UserRound size={12} /> Agent</p>
        <p className="mt-1 truncate text-sm font-bold text-[#2C1A0E] dark:text-white">{d.agentName || "Unassigned"}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div>
          <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#B89970]">Approval</p>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            d.approvalStatus === "PENDING" || d.approvalStatus === "PENDING_VERIFICATION"
              ? "bg-amber-100 text-amber-700 border-amber-200"
              : "bg-green-100 text-green-700 border-green-200"
          }`}>
            {d.approvalStatus === "PENDING_VERIFICATION"
              ? "PENDING VERIFICATION"
              : d.approvalStatus || "APPROVED"}
          </span>
        </div>
        <div>
          <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#B89970]">Delivery</p>
          <StatusPill status={d.status} />
        </div>
      </div>

      <div className="flex justify-start lg:justify-end">
        {d.isProjected ? (
          <span className="text-[10px] font-medium text-[#B8641A]">Projected</span>
        ) : d.hasOpenIssue ? (
          <button
            type="button"
            onClick={() => onResolveIssue(d)}
            disabled={resolvingIssueId === d.rawId}
            className="rounded bg-rose-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-700 disabled:bg-rose-300"
          >
            {resolvingIssueId === d.rawId ? "Resolving..." : "Resolve Issue"}
          </button>
        ) : d.needsApproval ? (
          <button
            type="button"
            onClick={() => onApprove(d)}
            disabled={approvingId === d.rawId}
            className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {approvingId === d.rawId ? "Approving..." : "Approve"}
          </button>
        ) : !d.isAssigned ? (
          <button
            type="button"
            onClick={() => onAssignPartner(d)}
            disabled={assigningId === d.rawId}
            className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {assigningId === d.rawId ? "Assigning..." : "Assign Partner"}
          </button>
        ) : (
          <span className="text-[10px] font-medium text-slate-400">Ready</span>
        )}
      </div>
    </article>
  );
};
