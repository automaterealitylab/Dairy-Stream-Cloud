import { Building2 } from "lucide-react";
import { DeliveryRow } from "./DeliveryRow.jsx";

export const BuildingDeliveryGroup = ({
  group,
  approvingId,
  assigningId,
  resolvingIssueId,
  onApprove,
  onAssignPartner,
  onResolveIssue,
}) => (
  <section className="overflow-hidden rounded-lg border border-[#E5D9C7] bg-white shadow-[0_8px_24px_rgba(92,61,30,0.06)] dark:border-slate-800 dark:bg-[#121829]">
    <div className="flex items-center justify-between gap-3 border-b border-[#EDE8DF] bg-[#FFF9F1] px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#B8641A] shadow-sm dark:bg-slate-800 dark:text-[#00C896]">
          <Building2 size={17} />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#B89970]">Building</p>
          <h3 className="truncate text-sm font-extrabold text-[#2C1A0E] dark:text-white">{group.buildingName}</h3>
        </div>
      </div>
      <div className="shrink-0 rounded-full border border-[#E5D9C7] bg-white px-3 py-1 text-[10px] font-bold text-[#8B7355] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {group.deliveries.length} {group.deliveries.length === 1 ? "stop" : "stops"}
      </div>
    </div>

    <div className="divide-y divide-[#F3EEE5]">
      {group.deliveries.map((d) => (
        <DeliveryRow
          key={d.id}
          delivery={d}
          approvingId={approvingId}
          assigningId={assigningId}
          resolvingIssueId={resolvingIssueId}
          onApprove={onApprove}
          onAssignPartner={onAssignPartner}
          onResolveIssue={onResolveIssue}
        />
      ))}
    </div>
  </section>
);
