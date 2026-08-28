import React from "react";
import { Download, Eye } from "lucide-react";
import { fmt, headingFont } from "../../../utils/customerPayments.js";

export function PaymentRow({
  payment,
  cfg,
  typeCfg,
  title,
  subtitle,
  paymentDateLabel,
  onRowClick,
  onDownloadPdf,
}) {
  const { Icon } = typeCfg;

  const handleDownload = (e) => {
    e.stopPropagation();
    if (onDownloadPdf) {
      onDownloadPdf(payment);
    }
  };

  const handleView = (e) => {
    e.stopPropagation();
    if (onRowClick) {
      onRowClick(payment);
    }
  };

  return (
    <div
      onClick={() => onRowClick && onRowClick(payment)}
      className="group cursor-pointer border-t border-[#F2EDE4] first:border-t-0 transition hover:bg-[#FAF7F2] md:first:border-t-0"
    >
      <div className="px-4 py-3.5 sm:px-6 sm:py-4">
        {/* Mobile View */}
        <div className="md:hidden">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] ${typeCfg.iconBg}`}
            >
              <Icon size={16} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold text-[#2C1A0E]">
                  {title}
                </p>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${cfg.pill}`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              </div>

              {subtitle && (
                <p className="mt-0.5 truncate text-[11px] text-[#B89970]">
                  {subtitle}
                </p>
              )}

              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-[#8B7355] font-medium">{paymentDateLabel || "-"}</span>
                <span
                  className="font-semibold text-[#2C1A0E]"
                  style={headingFont}
                >
                  {fmt(payment.amount)}
                </span>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleView}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E7DAC6] bg-white px-2.5 py-1 text-[11px] font-bold text-[#5C3D1E] hover:bg-[#FDF6EC]"
                >
                  <Eye size={12} /> View Bill
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#B8641A] px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-[#9F5414]"
                >
                  <Download size={12} /> Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(100px,0.9fr)_minmax(110px,1fr)_minmax(100px,1fr)_auto] md:items-center md:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] ${typeCfg.iconBg}`}
            >
              <Icon size={17} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#2C1A0E]">{title}</p>
              <p className="mt-0.5 truncate text-xs text-[#B89970]">
                {subtitle || "Monthly billing"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#5C3D1E]">{paymentDateLabel}</p>
          </div>

          <div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${cfg.pill}`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>

          <div className="text-right">
            <p
              className="text-base font-bold text-[#2C1A0E]"
              style={headingFont}
            >
              {fmt(payment.amount)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleView}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#EDE8DF] bg-white px-3 py-1.5 text-xs font-bold text-[#5C3D1E] transition hover:border-[#B8641A] hover:bg-[#FAF5EF]"
            >
              <Eye size={13} /> View Bill
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#B8641A] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#9F5414]"
            >
              <Download size={13} /> Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
