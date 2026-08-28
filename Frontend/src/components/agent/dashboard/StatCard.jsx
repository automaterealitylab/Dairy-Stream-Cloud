import React from "react";

export const StatCard = ({ icon, label, value, accent, tint }) => (
  <div className="rounded-[24px] border border-[#EDE8DF] bg-white px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">{label}</p>
        <p className="mt-1 text-2xl font-black leading-none text-[#2C1A0E]">{value}</p>
      </div>
      <div className={`rounded-[16px] border px-2.5 py-2.5 ${tint}`}>
        {React.cloneElement(icon, { size: 16, className: accent })}
      </div>
    </div>
  </div>
);
