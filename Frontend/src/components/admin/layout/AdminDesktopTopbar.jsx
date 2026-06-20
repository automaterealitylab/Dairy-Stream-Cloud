import { Bell, Search } from "lucide-react";
import { adminShellFont } from "../adminTheme";

export default function AdminDesktopTopbar() {
  return (
    <header
      className="hidden h-20 items-center justify-between border-b border-[#EDE8DF] bg-white/95 px-10 backdrop-blur lg:flex"
      style={adminShellFont}
    >
      <label className="flex h-10 w-[320px] items-center gap-3 rounded-full border border-[#F2EDE4] bg-[#FFFDF8] px-5 text-[#2C1A0E] shadow-[0_8px_24px_rgba(92,61,30,0.05)]">
        <Search size={22} strokeWidth={2.1} />
        <input
          type="search"
          placeholder="Search data..."
          className="w-full bg-transparent text-sm tracking-[0.08em] text-[#6D6470] outline-none placeholder:text-[#6D6470]"
        />
      </label>

      <button className="flex h-10 w-10 items-center justify-center text-[#2C1A0E]" aria-label="Notifications">
        <Bell size={22} strokeWidth={1.9} />
      </button>
    </header>
  );
}
