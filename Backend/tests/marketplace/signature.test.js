import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

process.env.RAZORPAY_KEY_ID = "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = "checkout_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_secret";

const { verifyCheckoutSignature, verifyWebhookSignature } = await import("../../services/marketplace/razorpayRoute.service.js");

test("verifies Razorpay checkout HMAC signatures", () => {
  const razorpayOrderId = "order_123";
  const razorpayPaymentId = "pay_123";
  const razorpaySignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  assert.equal(verifyCheckoutSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }), true);
  assert.equal(verifyCheckoutSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature: "bad" }), false);
});

test("verifies Razorpay webhook HMAC signatures over raw body", () => {
  const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured", id: "evt_123" }));
  const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");

  assert.equal(verifyWebhookSignature({ rawBody, signature }), true);
  assert.equal(verifyWebhookSignature({ rawBody, signature: "bad" }), false);
});
