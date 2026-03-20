import { adminHeadingFont, adminShellFont } from "../adminTheme";

export default function AdminActivity() {
  return (
    <section
      className="rounded-[28px] border border-[#EDE8DF] bg-white/95 p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)]"
      style={adminShellFont}
    >
      <h4 className="text-xl text-[#2C1A0E]" style={adminHeadingFont}>
        Recent Activity
      </h4>
      <ul className="mt-4 space-y-3 text-sm text-[#8B7355]">
        <li className="rounded-2xl bg-[#FFFDF8] px-4 py-3">Payment received</li>
        <li className="rounded-2xl bg-[#FFFDF8] px-4 py-3">Agent completed route</li>
        <li className="rounded-2xl bg-[#FFFDF8] px-4 py-3">New customer added</li>
      </ul>
    </section>
  );
}
