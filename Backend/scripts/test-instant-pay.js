import "../config/loadEnv.js";
import { createCustomerPaymentOrder } from "../services/customer/payments/orders.service.js";
import { getRazorpayClient, getRazorpayConfig } from "../services/customer/payments/razorpay.service.js";

async function test() {
  const rzp = getRazorpayClient();
  console.log("Testing Razorpay order creation directly...");
  try {
    const order = await rzp.orders.create({
      amount: 50000,
      currency: "INR",
      receipt: `test_receipt_${Date.now()}`.slice(0, 40),
      notes: { test: "true" }
    });
    console.log("Direct order created successfully!", order.id, order.amount);
  } catch (err) {
    console.error("Direct order failed:", err);
  }

  console.log("\nTesting createCustomerPaymentOrder for customer 26 with payAll...");
  try {
    const res = await createCustomerPaymentOrder({
      customerId: 26,
      payAll: true,
      includeRunningDue: true,
      dairyId: null,
    });
    console.log("createCustomerPaymentOrder result:", res.order?.id, "Amount:", res.payment?.amount);
  } catch (err) {
    console.error("createCustomerPaymentOrder failed:", err);
  }
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
