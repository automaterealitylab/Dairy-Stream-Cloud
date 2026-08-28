import PDFDocument from "pdfkit";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return String(dateValue);
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const formatMonthPeriod = (monthKey) => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return String(monthKey || "-");
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const monthName = firstDay.toLocaleString("en-US", { month: "long" });
  return `1 ${monthName} ${year} - ${lastDay.getDate()} ${monthName} ${year}`;
};

export const getBillPdfFilename = (invoice) => {
  const monthKey = invoice?.billing_month || "2026-08";
  const [yearStr, monthStr] = monthKey.split("-");
  const monthDate = new Date(Number(yearStr) || 2026, (Number(monthStr) || 8) - 1, 1);
  const monthName = monthDate.toLocaleString("en-US", { month: "long" });
  const year = yearStr || "2026";
  const rawBillNo = invoice?.bill_number || invoice?.invoiceNumber || `DV-${invoice?.id || "0001"}`;
  const sanitizedBillNo = String(rawBillNo).replace(/[^a-zA-Z0-9_-]/g, "_");

  return `DairyVision_Bill_${monthName}_${year}_${sanitizedBillNo}.pdf`;
};

export const generateInvoicePdfBuffer = (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const dairy = invoice.dairy || {};
      const customer = invoice.customer || {};
      const summary = invoice.deliverySummary || { totalScheduled: 0, delivered: 0, skipped: 0, paused: 0 };
      const items = Array.isArray(invoice.items) ? invoice.items : [];
      const payments = Array.isArray(invoice.paymentHistory) ? invoice.paymentHistory : [];

      const billNo = invoice.bill_number || invoice.invoiceNumber || `DV-${invoice.id}`;
      const status = String(invoice.status || "PENDING").toUpperCase();

      const primaryDark = "#2C1A0E";
      const brandAmber = "#B8641A";
      const textMuted = "#6B5B3E";
      const bgLight = "#FAF6F0";
      const borderColor = "#EDE2D3";

      let y = 40;

      // Header Banner
      doc.rect(40, y, 515, 68).fill("#2C1A0E");
      doc.fillColor("#FFFFFF").fontSize(22).font("Helvetica-Bold").text("DairyVision", 56, y + 14);
      doc.fillColor("#E2A66C").fontSize(9).font("Helvetica").text("Customer Dairy Management Platform", 56, y + 42);

      // Dairy / Business Details Box (Top Right inside banner)
      const dairyName = dairy.dairy_name || "DairyVision Partner Dairy";
      const dairyAddress = [dairy.address, dairy.city, dairy.state, dairy.pincode].filter(Boolean).join(", ");
      const dairyContact = [dairy.phone ? `Ph: ${dairy.phone}` : "", dairy.gstin ? `GST: ${dairy.gstin}` : ""].filter(Boolean).join(" | ");

      doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold").text(dairyName, 260, y + 14, { width: 280, align: "right" });
      if (dairyAddress) {
        doc.fillColor("#D6C8B8").fontSize(8).font("Helvetica").text(dairyAddress, 260, y + 30, { width: 280, align: "right" });
      }
      if (dairyContact) {
        doc.fillColor("#D6C8B8").fontSize(8).font("Helvetica").text(dairyContact, 260, y + 44, { width: 280, align: "right" });
      }

      y += 82;

      // Section 1: Customer & Bill Details Columns
      const colWidth = 250;

      // Left Column: Customer Info Box
      doc.rect(40, y, colWidth, 100).fillAndStroke("#FFFDF8", borderColor);
      doc.fillColor(brandAmber).fontSize(8).font("Helvetica-Bold").text("CUSTOMER INFORMATION", 50, y + 10);
      doc.fillColor(primaryDark).fontSize(12).font("Helvetica-Bold").text(customer.customer_name || customer.name || `Customer #${invoice.customer_id}`, 50, y + 24);
      doc.fillColor(textMuted).fontSize(8.5).font("Helvetica");
      doc.text(`Account ID: DV-CUST-${invoice.customer_id}`, 50, y + 42);
      doc.text(`Mobile: ${customer.phone_number || customer.phone || "-"}`, 50, y + 54);
      const custAddr = [customer.building_name, customer.wing, customer.room_no, customer.address].filter(Boolean).join(", ");
      if (custAddr) {
        doc.text(`Address: ${custAddr.slice(0, 75)}`, 50, y + 66, { width: 230 });
      }

      // Right Column: Bill Meta Info Box
      doc.rect(305, y, colWidth, 100).fillAndStroke("#FFFDF8", borderColor);
      doc.fillColor(brandAmber).fontSize(8).font("Helvetica-Bold").text("BILL INFORMATION", 315, y + 10);
      doc.fillColor(primaryDark).fontSize(12).font("Helvetica-Bold").text(`Bill No: ${billNo}`, 315, y + 24);
      doc.fillColor(textMuted).fontSize(8.5).font("Helvetica");
      doc.text(`Billing Period: ${formatMonthPeriod(invoice.billing_month)}`, 315, y + 42);
      doc.text(`Generated Date: ${formatDate(invoice.generated_at || invoice.created_at)}`, 315, y + 54);
      doc.text(`Payment Due Date: ${formatDate(invoice.due_date)}`, 315, y + 66);

      // Status Pill
      let statusBg = "#FFF3E0";
      let statusColor = "#C86D27";
      if (status === "PAID") { statusBg = "#E8F5E9"; statusColor = "#2E7D32"; }
      else if (status === "OVERDUE") { statusBg = "#FFEBEE"; statusColor = "#C62828"; }

      doc.rect(480, y + 8, 70, 16).fill(statusBg);
      doc.fillColor(statusColor).fontSize(7.5).font("Helvetica-Bold").text(status, 480, y + 12, { width: 70, align: "center" });

      y += 112;

      // Section 2: Delivery Transparency Summary Box
      doc.rect(40, y, 515, 48).fillAndStroke(bgLight, borderColor);
      doc.fillColor(brandAmber).fontSize(8).font("Helvetica-Bold").text("DELIVERY SUMMARY (MONTHLY TRANSPARENCY)", 50, y + 8);

      const metricBoxWidth = 118;
      const metrics = [
        { label: "Scheduled", value: summary.totalScheduled },
        { label: "Delivered", value: summary.delivered },
        { label: "Skipped", value: summary.skipped },
        { label: "Paused", value: summary.paused },
      ];

      metrics.forEach((m, idx) => {
        const mx = 50 + idx * metricBoxWidth;
        doc.fillColor(textMuted).fontSize(8).font("Helvetica").text(`${m.label}: `, mx, y + 22, { continued: true });
        doc.fillColor(primaryDark).font("Helvetica-Bold").text(String(m.value || 0));
      });

      doc.fillColor("#8A735B").fontSize(7.5).font("Helvetica-Oblique").text("Skipped and paused deliveries are transparently excluded and not charged.", 50, y + 35);

      y += 60;

      // Section 3: Product Breakdown Table
      doc.fillColor(primaryDark).fontSize(10).font("Helvetica-Bold").text("DELIVERY & PRODUCT BREAKDOWN", 40, y);
      y += 14;

      // Table Header
      doc.rect(40, y, 515, 20).fill("#F3EDE4");
      doc.fillColor(primaryDark).fontSize(8).font("Helvetica-Bold");
      doc.text("Product / Item", 48, y + 6, { width: 170 });
      doc.text("Deliveries", 220, y + 6, { width: 75, align: "center" });
      doc.text("Total Qty", 300, y + 6, { width: 75, align: "center" });
      doc.text("Rate", 380, y + 6, { width: 80, align: "right" });
      doc.text("Amount", 465, y + 6, { width: 80, align: "right" });

      y += 20;

      if (items.length === 0) {
        doc.rect(40, y, 515, 24).fillAndStroke("#FFFFFF", borderColor);
        doc.fillColor(textMuted).fontSize(8.5).font("Helvetica").text("No billable deliveries found for this period.", 48, y + 7);
        y += 24;
      } else {
        items.forEach((item, index) => {
          const bg = index % 2 === 0 ? "#FFFFFF" : "#FAF8F5";
          doc.rect(40, y, 515, 22).fillAndStroke(bg, borderColor);
          doc.fillColor(primaryDark).fontSize(8.5).font("Helvetica");
          doc.text(String(item.product || "Milk"), 48, y + 6, { width: 170 });
          doc.text(`${item.days || item.deliveries || 1} Days`, 220, y + 6, { width: 75, align: "center" });
          doc.text(`${Number(item.totalQty || item.quantity || 0).toFixed(1)} L/Pcs`, 300, y + 6, { width: 75, align: "center" });
          doc.text(money(item.rate || item.unitPrice), 380, y + 6, { width: 80, align: "right" });
          doc.fillColor(primaryDark).font("Helvetica-Bold").text(money(item.amount), 465, y + 6, { width: 80, align: "right" });
          y += 22;
        });
      }

      y += 12;

      // Section 4: Bill Summary Block (Right Aligned Totals)
      const summaryLeft = 320;
      const summaryWidth = 235;

      doc.rect(summaryLeft, y, summaryWidth, 110).fillAndStroke("#FFFDF8", borderColor);
      let sy = y + 8;

      const addSummaryRow = (label, val, isBold = false, color = primaryDark) => {
        doc.fillColor(textMuted).fontSize(8.5).font(isBold ? "Helvetica-Bold" : "Helvetica").text(label, summaryLeft + 10, sy);
        doc.fillColor(color).fontSize(8.5).font(isBold ? "Helvetica-Bold" : "Helvetica").text(money(val), summaryLeft + 110, sy, { width: 115, align: "right" });
        sy += 14;
      };

      addSummaryRow("Subtotal", invoice.subtotal);
      if (Number(invoice.discount_amount) > 0) addSummaryRow("Discount", -Number(invoice.discount_amount));
      if (Number(invoice.late_fee_amount) > 0) addSummaryRow("Late Fee / Charges", invoice.late_fee_amount);
      if (Number(invoice.tax_amount) > 0) addSummaryRow("Tax / GST", invoice.tax_amount);

      doc.moveTo(summaryLeft + 10, sy - 2).lineTo(summaryLeft + 225, sy - 2).strokeColor(borderColor).stroke();

      addSummaryRow("Total Bill Amount", invoice.total_amount, true, primaryDark);
      addSummaryRow("Amount Paid", invoice.paid_amount, false, "#2E7D32");
      addSummaryRow("Amount Due", invoice.due_amount, true, Number(invoice.due_amount) > 0 ? "#C62828" : "#2E7D32");

      y += 122;

      // Section 5: Payment History Table
      if (payments.length > 0) {
        doc.fillColor(primaryDark).fontSize(10).font("Helvetica-Bold").text("PAYMENT HISTORY", 40, y);
        y += 14;

        doc.rect(40, y, 515, 18).fill("#F3EDE4");
        doc.fillColor(primaryDark).fontSize(8).font("Helvetica-Bold");
        doc.text("Payment Date", 48, y + 5, { width: 90 });
        doc.text("Payment / Reference ID", 140, y + 5, { width: 150 });
        doc.text("Method", 295, y + 5, { width: 75 });
        doc.text("Status", 375, y + 5, { width: 80 });
        doc.text("Amount Paid", 460, y + 5, { width: 85, align: "right" });

        y += 18;

        payments.forEach((p, idx) => {
          const bg = idx % 2 === 0 ? "#FFFFFF" : "#FAF8F5";
          doc.rect(40, y, 515, 20).fillAndStroke(bg, borderColor);
          doc.fillColor(primaryDark).fontSize(8).font("Helvetica");
          doc.text(formatDate(p.created_at || p.date), 48, y + 5, { width: 90 });
          doc.text(String(p.utr_number || p.id || "PAY-" + p.id), 140, y + 5, { width: 150 });
          doc.text(String(p.method || "UPI").toUpperCase(), 295, y + 5, { width: 75 });
          doc.text(String(p.status || "PAID").toUpperCase(), 375, y + 5, { width: 80 });
          doc.fillColor("#2E7D32").font("Helvetica-Bold").text(money(p.amount), 460, y + 5, { width: 85, align: "right" });
          y += 20;
        });

        y += 16;
      }

      // Section 6: Footer Box
      const pageHeight = 841.89;
      const footerY = Math.max(y + 20, pageHeight - 60);

      doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor(borderColor).stroke();
      doc.fillColor(textMuted).fontSize(8).font("Helvetica").text("Thank you for choosing DairyVision as your trusted dairy management platform.", 40, footerY + 8, { align: "center", width: 515 });
      doc.fillColor("#A09080").fontSize(7.5).font("Helvetica").text(`Generated on ${formatDate(new Date())} • Document ID: ${billNo}`, 40, footerY + 20, { align: "center", width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
