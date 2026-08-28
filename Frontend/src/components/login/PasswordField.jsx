import { Lock, Eye, EyeOff } from "lucide-react";

// ================= PASSWORD INPUT WITH SHOW/TOGGLE =================
export const PasswordField = ({
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  transition = false,
  autoFocus = false,
}) => {
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-[16px] border border-[#EDE8DF] bg-white py-3 pl-10 pr-10 text-[#2C1A0E] outline-none${transition ? " transition" : ""} focus:border-[#B8641A]`}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A88763] hover:text-[#5C3D1E]"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};
