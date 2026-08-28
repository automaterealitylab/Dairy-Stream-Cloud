import { Edit2 } from "lucide-react";

import { IDENTITY_CONFIG, IDENTITY_DEFAULT_CONFIG } from "../../constants/loginPage.js";

// ================= IDENTITY BADGE COMPONENT =================
export const IdentityDisplay = ({ detectedUser, identifier, onReset }) => {
  if (!detectedUser) return null;

  const { Icon, label, badgeColor } = IDENTITY_CONFIG[detectedUser.userType] ?? IDENTITY_DEFAULT_CONFIG;

  return (
    <div className="mb-6 flex items-center justify-between rounded-[16px] border border-[#EDE8DF] bg-[#FBF7F0] p-3">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={`p-2 rounded-full ${badgeColor}`}>
          <Icon size={16} />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A88763]">
            {label}
          </span>
          <span className="truncate text-sm font-semibold text-[#2C1A0E]">
            {identifier}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="p-2 text-[#A88763] transition-colors hover:text-[#B8641A]"
        title="Change User"
      >
        <Edit2 size={16} />
      </button>
    </div>
  );
};
