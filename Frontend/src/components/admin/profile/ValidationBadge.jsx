export const ValidationBadge = ({ tone = "neutral", children }) => {
  const classes = {
    neutral: "border-[#E5D9C7] bg-white text-[#8B7355]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${classes[tone] || classes.neutral}`}>
      {children}
    </span>
  );
};
