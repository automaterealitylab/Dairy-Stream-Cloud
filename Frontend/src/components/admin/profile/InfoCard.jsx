import { Eye, EyeOff, Loader2 } from "lucide-react";

export const InfoCard = ({ icon, label, value, onToggleReveal, isRevealed, isLoading }) => {
  const IconComponent = icon;
  return (
    <div className="rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF8] p-5 dark:border-[#222B40] dark:bg-[#161C2C]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="rounded-2xl bg-[#FFF3E2] p-3 text-[#B8641A] dark:bg-[#d97706]/10 dark:text-[#fbbf24] shrink-0">
            <IconComponent size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B89970] dark:text-slate-400">{label}</p>
            <p className="mt-1 break-words text-base font-black text-[#2C1A0E] dark:text-white">{value || "-"}</p>
          </div>
        </div>
        {onToggleReveal && (
          <button
            type="button"
            onClick={onToggleReveal}
            disabled={isLoading}
            className="rounded-full p-2 text-[#8B7355] transition hover:bg-[#FFF3E2] hover:text-[#B8641A] dark:hover:bg-[#222B40] dark:hover:text-[#fbbf24] shrink-0"
            title={isRevealed ? "Hide details" : "Show details"}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isRevealed ? (
              <EyeOff size={16} />
            ) : (
              <Eye size={16} />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
