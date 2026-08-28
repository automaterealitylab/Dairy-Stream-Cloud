import { Link } from "react-router-dom";
import { ShieldCheck, MapPin } from "lucide-react";

import { headingFont } from "../../constants/loginPage.js";

// ================= MOBILE TOP LOGO CARD =================
export const MobileTopLogoCard = ({ onLogoClick }) => {
  return (
    <div className="order-1 px-4 pt-6 sm:px-6 lg:hidden">
      <div className="w-full max-w-md mx-auto rounded-[20px] border border-[#E7DAC6] bg-[#FFFDF7] p-4 text-center shadow-[0_8px_30px_rgba(44,26,14,0.06)]">
        <div className="cursor-pointer text-2xl font-bold text-[#2C1A0E]" style={headingFont} onClick={onLogoClick}>
          Dairy<span className="text-[#B8641A]">Vision</span>
        </div>
      </div>
    </div>
  );
};

// ================= MOBILE BOTTOM BRAND CARD =================
export const MobileBrandCard = () => {
  return (
    <div className="order-3 px-4 pb-6 sm:px-6 lg:hidden">
      <div className="relative overflow-hidden rounded-[28px] border border-[#5C3D1E]/10 bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] px-5 py-6 text-white shadow-[0_20px_50px_rgba(44,26,14,0.16)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(210,138,64,0.18),transparent_40%)]" />
        <div className="relative z-10">
          <p className="max-w-sm text-sm text-[#F5E6D2]">
            Manage milk deliveries, subscriptions, billing, and customer access from one calm, reliable platform.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link
              to="/register-dairy"
              className="inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-2 py-2 text-xs sm:text-sm font-semibold text-white no-underline transition hover:bg-white/16 text-center"
            >
              <ShieldCheck size={16} className="shrink-0" />
              <span className="truncate">Register Dairy</span>
            </Link>
            <Link
              to="/explore"
              className="inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-2 py-2 text-xs sm:text-sm font-semibold text-white no-underline transition hover:bg-white/16 text-center"
            >
              <MapPin size={16} className="shrink-0" />
              <span className="truncate">Explore Nearby</span>
            </Link>
          </div>
        </div>
        <div className="absolute -bottom-16 -right-14 h-40 w-40 rounded-full bg-[#D28A40]/20 blur-3xl" />
      </div>
    </div>
  );
};

// ================= LEFT BRAND SECTION =================
export const LeftBrandPanel = () => {
  return (
    <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#2C2416_0%,#4A3820_60%,#6B4F2A_100%)] px-20 text-white lg:flex lg:flex-col lg:justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(210,138,64,0.16),transparent_42%)]" />
      <div className="relative z-10">
        <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white" style={headingFont}>DairyVision</h1>
        <div className="mb-6 mt-4 h-1 w-12 rounded-full bg-[#D6A15D]" />
        <p className="max-w-md text-lg text-[#F5E6D2]">
          Manage milk deliveries, subscriptions, billing, and customer access from one calm, reliable platform.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            to="/register-dairy"
            className="flex items-center gap-2 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-4 py-2.5 text-white no-underline transition hover:bg-white/16"
          >
            <ShieldCheck size={18} /> Register Dairy
          </Link>
          <Link
            to="/explore"
            className="flex items-center gap-2 rounded-[14px] border border-[#EFD7B3]/40 bg-white/10 px-4 py-2.5 text-white no-underline transition hover:bg-white/16"
          >
            <MapPin size={18} /> Explore Nearby
          </Link>
        </div>
      </div>
      <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-[#D28A40]/20 blur-3xl"></div>
      <div className="absolute -top-24 left-10 h-52 w-52 rounded-full bg-[#FFF4E2]/8 blur-3xl"></div>
    </div>
  );
};
