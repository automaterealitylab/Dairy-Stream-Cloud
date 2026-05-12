import "../config/loadEnv.js";
import { fetchOrderTransfers, fetchRazorpayPayment } from "../services/marketplace/razorpayRoute.service.js";

const [, , razorpayOrderId, razorpayPaymentId] = process.argv;

if (!razorpayOrderId) {
  console.error("Usage: node scripts/verify-marketplace-order.js <razorpay_order_id> [razorpay_payment_id]");
  process.exit(1);
}

const result = {};

try {
  result.transfers = await fetchOrderTransfers(razorpayOrderId);
  if (razorpayPaymentId) {
    result.payment = await fetchRazorpayPayment(razorpayPaymentId);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(err?.response?.data || err);
  process.exit(1);
}
