import { adminHeadingFont, adminShellFont } from "../adminTheme";

export default function AdminFinancialAlert({ amount }) {
  return (
    <section className="mb-14">
      <div
        className="rounded-[28px] border border-[#F0D7CC] bg-[#FFF7F4] p-6 shadow-[0_18px_45px_rgba(92,61,30,0.08)]"
        style={adminShellFont}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C9927A]">
          Outstanding Payments
        </p>
        <p className="mt-3 text-3xl text-[#A85734]" style={adminHeadingFont}>
          Rs {amount}
        </p>
      </div>
    </section>
  );
}
