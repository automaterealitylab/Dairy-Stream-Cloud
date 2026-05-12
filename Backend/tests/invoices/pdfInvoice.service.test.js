import assert from "node:assert/strict";
import test from "node:test";

const { generateInvoicePdfBuffer } = await import("../../services/customer/pdfInvoice.service.js");

test("generateInvoicePdfBuffer creates a valid PDF document", () => {
  const pdf = generateInvoicePdfBuffer({
    id: 1,
    invoiceNumber: "DS-INV-1",
    billing_month: "2026-05",
    subtotal: 100,
    tax_amount: 5,
    discount_amount: 10,
    late_fee_amount: 2,
    total_amount: 97,
    paid_amount: 50,
    due_amount: 47,
    status: "PARTIAL",
    customer: { customer_name: "Test Customer", phone_number: "9999999999" },
    dairy: { dairy_name: "Test Dairy", upi_id: "test@upi", gstin: "27ABCDE1234F1Z5" },
  });

  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 8).toString(), "%PDF-1.4");
  assert.match(pdf.toString("latin1"), /DS-INV-1/);
});
