export const Field = ({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  children,
  disabled = false,
  hint = "",
}) => (
  <label className={`rounded-[18px] border border-[#E5D9C7] bg-[#FFFDF8] px-3.5 py-2.5 ${className}`}>
    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B89970]">{label}</span>
    {children || (
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full bg-transparent text-sm font-black text-[#2C1A0E] outline-none disabled:text-[#8B7355]"
      />
    )}
    {hint ? <span className="mt-1 block text-[10px] font-semibold text-[#9B8469]">{hint}</span> : null}
  </label>
);
