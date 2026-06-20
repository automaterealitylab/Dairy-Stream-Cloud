import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL ||= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";

const { extractPaymentFieldsFromOcrText } = await import("../../services/customer/ocr.service.js");

test("extractPaymentFieldsFromOcrText parses UTR, amount, timestamp and app", () => {
  const parsed = extractPaymentFieldsFromOcrText(`
    Google Pay
    Paid by Swapnil Patil
    Amount ₹1,240.50
    UPI Ref No 412345678901
    12 May 2026, 09:42 PM
  `);

  assert.equal(parsed.utrNumber, "412345678901");
  assert.equal(parsed.amount, 1240.5);
  assert.equal(parsed.appName, "Google Pay");
  assert.equal(parsed.payerName, "Swapnil Patil");
  assert.match(parsed.timestamp, /12 May 2026/);
});

test("extractPaymentFieldsFromOcrText handles PhonePe reference labels", () => {
  const parsed = extractPaymentFieldsFromOcrText("PhonePe Reference ID: ABCD1234567890 INR 99.00");

  assert.equal(parsed.utrNumber, "ABCD1234567890");
  assert.equal(parsed.amount, 99);
  assert.equal(parsed.appName, "PhonePe");
});
