import { User, Mail, Briefcase, Smartphone } from "lucide-react";

const DASHBOARD_VISITED_FLAG = "customerDashboardVisited";
const headingFont = { fontFamily: "'Lora', serif" };

// Role → badge config shown under the Sign In header
const ROLE_BADGE_CONFIG = {
  ADMIN: { label: "Dairy Admin", className: "border-[#F0D1B2] bg-[#FFF1E4] text-[#C86A2B]" },
  AGENT: { label: "Delivery Agent", className: "border-[#F0D1B2] bg-[#FFF1E4] text-[#C86A2B]" },
  STAFF: { label: "Delivery Agent", className: "border-[#F0D1B2] bg-[#FFF1E4] text-[#C86A2B]" },
  CUSTOMER: { label: "Customer", className: "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]" },
};

// Role → icon/label/color for the identity badge inside login/OTP forms
const IDENTITY_CONFIG = {
  ADMIN: { Icon: Mail, label: "Admin ID", badgeColor: "bg-[#FFF1E4] text-[#C86A2B]" },
  AGENT: { Icon: Briefcase, label: "Staff ID", badgeColor: "bg-[#FFF1E4] text-[#C86A2B]" },
  STAFF: { Icon: Briefcase, label: "Staff ID", badgeColor: "bg-[#FFF1E4] text-[#C86A2B]" },
  CUSTOMER: { Icon: Smartphone, label: "Email/Mobile", badgeColor: "bg-[#EEF5E7] text-[#4A7C2F]" },
};

const IDENTITY_DEFAULT_CONFIG = {
  Icon: User,
  label: "User",
  badgeColor: "bg-[#FFF4E2] text-[#B8641A]",
};

export {
  DASHBOARD_VISITED_FLAG,
  headingFont,
  ROLE_BADGE_CONFIG,
  IDENTITY_CONFIG,
  IDENTITY_DEFAULT_CONFIG,
};
