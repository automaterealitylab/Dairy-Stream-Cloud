import { adminHeadingFont, adminShellFont } from "../adminTheme";

export default function AdminMobileTopbar({ adminName, onMenu }) {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between border-b border-[#EDE8DF] bg-[rgba(255,253,248,0.96)] px-4 py-3 backdrop-blur lg:hidden"
      style={adminShellFont}
    >
      <button onClick={onMenu} className="text-xl text-[#8B7355]">
        Menu
      </button>

      <span className="text-lg text-[#B8641A]" style={adminHeadingFont}>
        DairyStream
      </span>

      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#EDE8DF] bg-white text-sm font-semibold text-[#8B7355]">
        {adminName?.charAt(0) || "A"}
      </div>
    </div>
  );
}
