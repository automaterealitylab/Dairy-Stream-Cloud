import { adminHeadingFont, adminShellFont } from "./adminTheme";

export default function StatCard({ label, value, color }) {
  return (
    <div
      className={`animate-fade-up rounded-[28px] border border-[#EDE8DF] bg-white/95 p-4 sm:p-6 text-left shadow-[0_18px_45px_rgba(92,61,30,0.08)] shrink-0 w-[200px] sm:w-auto sm:shrink snap-center ${color || ""}`}
      style={adminShellFont}
    >
      <p className="mb-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">{label}</p>
      <h2 className="text-2xl sm:text-3xl text-[#2C1A0E]" style={adminHeadingFont}>{value}</h2>
    </div>
  );
}
