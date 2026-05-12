import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL ||= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";

const { getScreenshotHash } = await import(
  "../../services/customer/smartPaymentVerification.service.js"
);

test("getScreenshotHash returns stable sha256 for uploaded screenshot buffers", () => {
  const first = getScreenshotHash(Buffer.from("payment-screenshot"));
  const second = getScreenshotHash(Buffer.from("payment-screenshot"));
  const different = getScreenshotHash(Buffer.from("different-payment-screenshot"));

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, different);
});

test("getScreenshotHash returns null when no screenshot buffer is provided", () => {
  assert.equal(getScreenshotHash(null), null);
});
