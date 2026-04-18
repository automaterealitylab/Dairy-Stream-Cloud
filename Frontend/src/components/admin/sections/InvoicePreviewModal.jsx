import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, Share2, Info, QrCode, ReceiptText, LoaderCircle } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { QRCodeSVG } from "qrcode.react";
import { fetchAdminCustomerBillDetails } from "../../../api/admin.api";

const formatCurrency = (value) =>
  `\u20B9${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB");
};

const formatQty = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateRange = (fromDate, toDate) => {
  if (fromDate && toDate) {
    if (fromDate === toDate) return formatDate(fromDate);
    return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
  }
  return formatDate(fromDate || toDate);
};

const normalizeProductText = (value) =>
  String(value || "")
    .replace(/\s*[\uFFFD\u00B7\u2022]+\s*/g, " | ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+/g, " ")
    .trim();

const splitProductLabel = (value) => {
  const normalized = normalizeProductText(value);
  if (!normalized) {
    return { primary: "-", secondary: "" };
  }

  const parts = normalized
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return { primary: normalized, secondary: "" };
  }

  return {
    primary: parts[0],
    secondary: parts.slice(1).join(" | "),
  };
};

const SectionTable = ({ title, rows, accent = "bg-[#F8F3EC]" }) => {
  const hasRows = Array.isArray(rows) && rows.length > 0;

  return (
    <div className="overflow-hidden rounded-[26px] border border-[#E7DAC6]">
      <div className={`px-6 py-4 ${accent}`}>
        <h3 className="text-[20px] font-black text-[#2C1A0E]">{title}</h3>
      </div>
      <table className="w-full border-collapse">
        <thead className="bg-[#FDF9F2] text-[#6F604B]">
          <tr className="text-left text-[11px] font-black uppercase tracking-[0.16em]">
            <th className="border-b border-[#EDE3D3] px-5 py-3">Product</th>
            <th className="border-b border-[#EDE3D3] px-5 py-3 text-center">Date Range</th>
            <th className="border-b border-[#EDE3D3] px-5 py-3 text-center">Qty/Day</th>
            <th className="border-b border-[#EDE3D3] px-5 py-3 text-center">Days</th>
            <th className="border-b border-[#EDE3D3] px-5 py-3 text-center">Total Qty</th>
            <th className="border-b border-[#EDE3D3] px-5 py-3 text-right">Rate</th>
            <th className="border-b border-[#EDE3D3] px-5 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {hasRows ? (
            rows.map((row, index) => {
              const productLabel = splitProductLabel(row.product);

              return (
                <tr key={`${title}-${row.product}-${index}`} className="text-[14px] font-semibold text-[#2C1A0E]">
                  <td className="border-b border-[#F3EBDD] px-5 py-3">
                    <div className="leading-tight">
                      <div>{productLabel.primary}</div>
                      {productLabel.secondary ? (
                        <div className="mt-1 text-[12px] font-bold text-[#8B7355]">
                          {productLabel.secondary}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-b border-[#F3EBDD] px-5 py-3 text-center">
                    {formatDateRange(row.fromDate, row.toDate)}
                  </td>
                  <td className="border-b border-[#F3EBDD] px-5 py-3 text-center">{formatQty(row.qtyPerDay)}</td>
                  <td className="border-b border-[#F3EBDD] px-5 py-3 text-center">{row.days}</td>
                  <td className="border-b border-[#F3EBDD] px-5 py-3 text-center">{formatQty(row.totalQty)}</td>
                  <td className="border-b border-[#F3EBDD] px-5 py-3 text-right">{formatQty(row.rate)}</td>
                  <td className="border-b border-[#F3EBDD] px-5 py-3 text-right font-black">{formatQty(row.amount)}</td>
                </tr>
              );
            })
          ) : (
            <tr className="text-[14px] font-semibold text-[#8B7355]">
              <td colSpan={7} className="border-b border-[#F3EBDD] px-5 py-5 text-center">
                No other products added in this billing period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const InvoicePreviewModal = ({ customer, adminName, dairyName, onClose }) => {
  const invoiceRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [billData, setBillData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [billConfig, setBillConfig] = useState({
    notes: "Please pay by the due date to avoid service interruption.",
    contact: "+91 98765 43210",
    email: "billing@dairystream.com",
    address: "Plot 42, Industrial Area, Milk City",
    upiId: "ayanm102435@okaxis",
  });

  useEffect(() => {
    let active = true;

    const loadBill = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const data = await fetchAdminCustomerBillDetails(customer?.id);
        if (!active) return;
        setBillData(data);
      } catch (error) {
        if (!active) return;
        setLoadError(error?.response?.data?.message || "Failed to load bill details");
      } finally {
        if (active) setLoading(false);
      }
    };

    if (customer?.id) {
      loadBill();
    }

    return () => {
      active = false;
    };
  }, [customer?.id]);

  const resolvedCustomer = billData?.customer || customer || {};
  const resolvedBilling = billData?.billing || {};
  const resolvedDairyName =
    dairyName ||
    billData?.dairy?.dairy_name ||
    resolvedCustomer?.dairy_name ||
    "DairyStream";
  const customerAddress = [
    resolvedCustomer?.building_name,
    resolvedCustomer?.wing,
    resolvedCustomer?.room_no,
  ]
    .filter(Boolean)
    .join(", ");

  const subscriptionRows = resolvedBilling?.subscriptionRows || [];
  const otherProductRows = resolvedBilling?.otherProductRows || [];
  const subscriptionTotal = Number(resolvedBilling?.subscriptionTotal || 0);
  const otherProductsTotal = Number(resolvedBilling?.otherProductsTotal || 0);
  const sectionSubtotal = Number(resolvedBilling?.sectionSubtotal || 0);
  const billedAmount = Number(resolvedBilling?.billedAmount ?? sectionSubtotal);
  const previousDueAmount = Number(resolvedBilling?.previousDueAmount || 0);
  const creditAdjustmentAmount = Number(resolvedBilling?.creditAdjustmentAmount || 0);
  const totalDue = Number(
    resolvedBilling?.amountDue ?? customer?.outstanding_balance ?? sectionSubtotal
  );

  const summaryRows = useMemo(() => {
    const rows = [];
    if (subscriptionTotal > 0) {
      rows.push({ label: "Subscriptions Total", amount: subscriptionTotal });
    }
    if (otherProductsTotal > 0) {
      rows.push({ label: "Other Products Total", amount: otherProductsTotal });
    }
    if (previousDueAmount > 0) {
      rows.push({ label: "Previous Due Added", amount: previousDueAmount });
    }
    if (rows.length === 0) {
      rows.push({ label: "Current Bill", amount: totalDue });
    }
    return rows;
  }, [
    otherProductsTotal,
    previousDueAmount,
    subscriptionTotal,
    totalDue,
  ]);

  const generateStyledPDF = async () => {
    const element = invoiceRef.current;
    if (!element) return null;

    const cloneContainer = document.createElement("div");
    cloneContainer.style.position = "absolute";
    cloneContainer.style.left = "-9999px";
    cloneContainer.style.top = "0";
    document.body.appendChild(cloneContainer);

    const clone = element.cloneNode(true);
    clone.style.transform = "none";
    clone.style.scale = "1";
    clone.style.margin = "0";
    cloneContainer.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 794,
        height: clone.scrollHeight || 1123,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let remainingHeight = imageHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imageHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        position = remainingHeight - imageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imageHeight);
        remainingHeight -= pageHeight;
      }

      document.body.removeChild(cloneContainer);
      return pdf;
    } catch (error) {
      document.body.removeChild(cloneContainer);
      console.error("PDF generation failed", error);
      return null;
    }
  };

  const handleDownloadPDF = async () => {
    const pdf = await generateStyledPDF();
    if (!pdf) return;
    const fileName = `${String(resolvedCustomer?.customer_name || "Customer").replace(/\s+/g, "_")}_${String(resolvedBilling?.billingPeriod || "Bill").replace(/\s+/g, "-")}_${resolvedBilling?.billNo || "invoice"}.pdf`;
    pdf.save(fileName);
  };

  const handleShare = async () => {
    try {
      const pdf = await generateStyledPDF();
      if (!pdf) return;

      const pdfBlob = pdf.output("blob");
      const fileName = `${String(resolvedCustomer?.customer_name || "Customer").replace(/\s+/g, "_")}_Bill.pdf`;
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Customer Bill" });
      } else {
        window.open(
          `https://wa.me/${resolvedCustomer?.phone_number || ""}?text=Hi, your bill for ${resolvedBilling?.billingPeriod || "this period"} is ${formatCurrency(totalDue)}.`,
          "_blank"
        );
      }
    } catch (err) {
      console.error("Sharing failed", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(15,23,42,0.88)] p-2 backdrop-blur-md sm:p-4">
      <div className="flex h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex shrink-0 flex-col gap-4 border-b border-[#EFE7DA] bg-[#FFFDF8] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#B8641A] text-white shadow-lg shadow-[#E8C79D]">
              <ReceiptText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#2C1A0E]">Bill Preview</h2>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B89970]">
                Download or share customer bill
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={handleShare}
              disabled={loading || !!loadError}
              className="inline-flex items-center gap-2 rounded-xl border border-[#D7E8C8] bg-[#EEF6E7] px-4 py-2.5 text-sm font-black text-[#4A7C2F] transition hover:bg-[#4A7C2F] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Share2 size={16} /> Share
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={loading || !!loadError}
              className="inline-flex items-center gap-2 rounded-xl bg-[#B8641A] px-4 py-2.5 text-sm font-black text-white shadow-[0_14px_28px_rgba(184,100,26,0.22)] transition hover:bg-[#9F5414] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={16} /> Download
            </button>
            <button onClick={onClose} className="ml-auto rounded-full border border-[#E7DAC6] p-2 text-[#8B7355] transition hover:bg-[#FDF6EC] hover:text-[#B8641A] sm:ml-0">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F5F2EC] p-4 sm:p-8">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 text-[#8B7355] shadow-lg">
                <LoaderCircle className="animate-spin" size={18} />
                <span className="text-sm font-bold">Loading bill details...</span>
              </div>
            </div>
          ) : loadError ? (
            <div className="mx-auto max-w-xl rounded-[28px] border border-[#F0D4CF] bg-white p-8 text-center shadow-lg">
              <p className="text-lg font-black text-[#A23D2C]">Could not load bill</p>
              <p className="mt-2 text-sm font-semibold text-[#8B7355]">{loadError}</p>
            </div>
          ) : (
            <div className="flex w-full justify-center">
              <div className="origin-top scale-[0.56] shadow-2xl sm:scale-[0.7] lg:scale-[0.84] xl:scale-100">
                <div
                  ref={invoiceRef}
                  className="flex min-h-[297mm] w-[210mm] flex-col overflow-hidden border border-[#E8DFD0] bg-white text-[#2C1A0E]"
                >
                <div className="bg-gradient-to-r from-[#3E2B18] via-[#5B3E24] to-[#8A6A46] px-14 py-12 text-white">
                  <div className="flex items-start justify-between gap-8">
                    <div className="max-w-[60%]">
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#F3D4A6]">
                        DairyStream Bill
                      </p>
                      <h1 className="mt-4 text-[40px] font-black tracking-tight">{resolvedDairyName}</h1>
                      <div className="mt-5 space-y-1.5 text-[13px] font-semibold text-white/82">
                        <p>{billConfig.address}</p>
                        <p>{billConfig.contact}</p>
                        <p>{billConfig.email}</p>
                      </div>
                    </div>

                    <div className="min-w-[220px] rounded-[28px] border border-white/15 bg-white/10 p-6 text-right">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#F3D4A6]">
                        Bill Number
                      </p>
                      <p className="mt-2 text-[28px] font-black">#{resolvedBilling?.billNo || "-"}</p>
                      <div className="mt-5 space-y-2 text-[12px] font-bold text-white/88">
                        <p>Date: {formatDate(resolvedBilling?.billDate)}</p>
                        <p>Billing Period: {resolvedBilling?.billingPeriod || "-"}</p>
                        <p>Due Date: {formatDate(resolvedBilling?.dueDate)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[1.1fr_0.9fr] gap-10 px-14 py-10">
                  <div className="rounded-[28px] border border-[#E9E0D3] bg-[#FFFDF8] p-7">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                      Customer Details
                    </p>
                    <h3 className="mt-3 text-[26px] font-black text-[#2C1A0E]">{resolvedCustomer?.customer_name || "Customer"}</h3>
                    <div className="mt-5 space-y-2 text-[14px] font-semibold text-[#6B5B3E]">
                      <p>Phone: {resolvedCustomer?.phone_number || "-"}</p>
                      <p>Address: {customerAddress || "-"}</p>
                      <p>Dairy: {resolvedDairyName}</p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-[#F0E5D5] bg-[#FFF7EB] p-7">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                      Monthly Bill
                    </p>
                    <p className="mt-3 text-[42px] font-black text-[#2C1A0E]">{formatCurrency(totalDue)}</p>
                    <p className="mt-2 text-[13px] font-semibold text-[#8B7355]">
                      Billing Period: {resolvedBilling?.billingPeriod || "-"}
                    </p>
                    {(previousDueAmount > 0 || creditAdjustmentAmount > 0) && (
                      <div className="mt-5 rounded-[22px] border border-[#EADCC7] bg-[#FFFDF8] p-4 text-left">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                          Due Breakdown
                        </p>
                        <div className="mt-3 space-y-2 text-[13px] font-semibold text-[#6B5B3E]">
                          <p>Current Bill: {formatCurrency(billedAmount)}</p>
                          {previousDueAmount > 0 && (
                            <p>Previous Due: {formatCurrency(previousDueAmount)}</p>
                          )}
                          {creditAdjustmentAmount > 0 && (
                            <p>Credit Applied: - {formatCurrency(creditAdjustmentAmount)}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mt-5 rounded-[22px] border border-[#EADCC7] bg-white/70 p-4 text-left">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                        Payment Window
                      </p>
                      <div className="mt-3 space-y-2 text-[13px] font-semibold text-[#6B5B3E]">
                        <p>Bill Date: {formatDate(resolvedBilling?.billDate)}</p>
                        <p>Pay By: {formatDate(resolvedBilling?.dueDate)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8 px-14">
                  <SectionTable title="Subscriptions" rows={subscriptionRows} />
                  <SectionTable title="Other Products" rows={otherProductRows} accent="bg-[#FFF6EA]" />

                  <div className="overflow-hidden rounded-[26px] border border-[#E7DAC6]">
                    <div className="grid grid-cols-[1.8fr_0.8fr] bg-[#F8F3EC] px-6 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                      <div>Summary</div>
                      <div className="text-right">Amount</div>
                    </div>
                    {summaryRows.map((row) => (
                      <div
                        key={row.label}
                        className="grid grid-cols-[1.8fr_0.8fr] border-t border-[#EFE7DA] px-6 py-4 text-[15px] font-semibold text-[#2C1A0E]"
                      >
                        <div>{row.label}</div>
                        <div className={`text-right ${row.amount < 0 ? "text-emerald-700" : ""}`}>
                          {row.amount < 0 ? `- ${formatCurrency(Math.abs(row.amount))}` : formatCurrency(row.amount)}
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-[1.8fr_0.8fr] border-t border-[#E7DAC6] bg-[#FFFDF8] px-6 py-5 text-[18px] font-black text-[#2C1A0E]">
                      <div>Total Payable</div>
                      <div className="text-right text-[#B64533]">{formatCurrency(totalDue)}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-[0.9fr_1.1fr] gap-10 px-14">
                  <div className="rounded-[28px] border border-dashed border-[#D8C8B3] bg-[#FFFDF8] p-7 text-center">
                    <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#FDF6EC] text-[#B8641A]">
                      <QrCode size={18} />
                    </div>
                    <div className="mb-4 flex justify-center">
                      <QRCodeSVG
                        value={`upi://pay?pa=${billConfig.upiId}&pn=${encodeURIComponent(resolvedDairyName)}&am=${Math.max(totalDue, 0)}&cu=INR`}
                        size={120}
                        level="H"
                      />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                      Scan To Pay
                    </p>
                    <p className="mt-2 text-[12px] font-semibold text-[#8B7355]">{billConfig.upiId}</p>
                  </div>

                  <div className="rounded-[28px] border border-[#E9E0D3] bg-white p-7">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                      <Info size={12} /> Notes
                    </div>
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="min-h-[120px] w-full rounded-[22px] border border-[#F1E8DB] bg-[#FFFCF8] p-5 text-[14px] font-semibold leading-7 text-[#6B5B3E] outline-none"
                      onBlur={(e) => setBillConfig((current) => ({ ...current, notes: e.target.innerText }))}
                    >
                      {billConfig.notes}
                    </div>

                    <div className="mt-8 flex items-end justify-between">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                          Authorized By
                        </p>
                        <p className="mt-3 text-[26px] font-black text-[#2C1A0E]">{adminName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                          Contact
                        </p>
                        <p className="mt-2 text-[13px] font-semibold text-[#6B5B3E]">{billConfig.contact}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto px-14 py-10">
                  <div className="flex items-center justify-between border-t border-[#EFE7DA] pt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#B89970]">
                    <span>DairyStream Billing System</span>
                    <span>{resolvedBilling?.billingPeriod || "-"}</span>
                  </div>
                </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;
