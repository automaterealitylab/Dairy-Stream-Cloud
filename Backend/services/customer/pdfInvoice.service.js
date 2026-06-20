const escapePdfText = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "");

const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const buildLines = (invoice) => {
  const dairy = invoice.dairy || {};
  const customer = invoice.customer || {};
  const invoiceNumber = invoice.invoiceNumber || invoice.bill_number || `Invoice ${invoice.id}`;
  const customerName = customer.customer_name || customer.name || `Customer #${invoice.customer_id}`;
  const dairyName = dairy.dairy_name || "DairyStream Dairy";
  const status = String(invoice.status || "PENDING").toUpperCase();

  return [
    "DairyStream Invoice",
    dairyName,
    dairy.gstin ? `GSTIN: ${dairy.gstin}` : "",
    `${dairy.address || ""} ${dairy.city || ""} ${dairy.state || ""}`.trim(),
    "",
    `Invoice No: ${invoiceNumber}`,
    `Billing Month: ${invoice.billing_month || "-"}`,
    `Generated: ${String(invoice.generated_at || invoice.created_at || "").slice(0, 10) || "-"}`,
    `Due Date: ${invoice.due_date || "-"}`,
    `Status: ${status}`,
    "",
    "Bill To",
    customerName,
    customer.phone_number || customer.phone ? `Phone: ${customer.phone_number || customer.phone}` : "",
    customer.email ? `Email: ${customer.email}` : "",
    [customer.building_name, customer.room_no, customer.address].filter(Boolean).join(", "),
    "",
    "Billing Summary",
    `Subtotal: ${money(invoice.subtotal)}`,
    `Tax/GST: ${money(invoice.tax_amount)}`,
    `Discount: ${money(invoice.discount_amount)}`,
    `Late Fee: ${money(invoice.late_fee_amount)}`,
    `Previous Adjustments: ${money(invoice.adjustments)}`,
    `Total Amount: ${money(invoice.total_amount)}`,
    `Paid Amount: ${money(invoice.paid_amount)}`,
    `Due Amount: ${money(invoice.due_amount)}`,
    "",
    "Payment",
    dairy.upi_id ? `UPI ID: ${dairy.upi_id}` : "UPI ID: Not configured",
    invoice.shareUrl ? `Invoice Link: ${invoice.shareUrl}` : "",
    "",
    "Customer pays the dairy owner directly through UPI. DairyStream tracks verification only.",
  ].filter((line) => line !== "");
};

export const generateInvoicePdfBuffer = (invoice) => {
  const lines = buildLines(invoice);
  const objects = [];

  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  const pageId = addObject("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>");
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const contentLines = ["BT", "/F2 20 Tf", "50 790 Td"];
  lines.forEach((line, index) => {
    const isHeading = index === 0 || ["Bill To", "Billing Summary", "Payment"].includes(line);
    if (index > 0) contentLines.push("0 -22 Td");
    contentLines.push(isHeading ? "/F2 13 Tf" : "/F1 10 Tf");
    contentLines.push(`(${escapePdfText(line)}) Tj`);
  });
  contentLines.push("ET");

  const contentStream = contentLines.join("\n");
  addObject(`<< /Length ${Buffer.byteLength(contentStream)} >>\nstream\n${contentStream}\nendstream`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "binary");
};
