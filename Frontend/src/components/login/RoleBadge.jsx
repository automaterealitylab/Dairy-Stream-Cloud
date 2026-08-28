import { ROLE_BADGE_CONFIG } from "../../constants/loginPage.js";

// ================= ROLE TAG (under Sign In header) =================
export const RoleBadge = ({ userType }) => {
  const config = ROLE_BADGE_CONFIG[userType] ?? ROLE_BADGE_CONFIG.CUSTOMER;

  return (
    <div className="flex justify-center mt-3">
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase ${config.className}`}>
        {config.label}
      </span>
    </div>
  );
};
