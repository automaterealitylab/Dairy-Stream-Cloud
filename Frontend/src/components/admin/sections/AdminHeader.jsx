import { adminHeadingFont, adminShellFont } from "../adminTheme";

export default function AdminHeader({ adminName }) {
  return (
    <div className="mb-10" style={adminShellFont}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
        Admin Overview
      </p>
      <h1 className="mt-3 text-4xl text-[#2C1A0E]" style={adminHeadingFont}>
        Welcome back, {adminName || "Admin"}
      </h1>
      <p className="mt-2 text-sm text-[#8B7355]">
        Here's what's happening today.
      </p>
    </div>
  );
}
