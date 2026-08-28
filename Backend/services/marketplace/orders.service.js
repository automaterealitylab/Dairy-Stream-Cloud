// Marketplace checkout: create a Razorpay order with Route transfer and verify
// the captured payment against the local order.

import { supabase } from "../../config/supabase.js";
import { detectSuspiciousMarketplaceOrder } from "./fraud.service.js";
import { upsertCustomer } from "./customers.service.js";
import { isDairyRouteReady, normalizeStatus, normalizeString } from "./normalizers.js";
import { calculateMarketplacePricing } from "./pricing.service.js";
import { getDairyById, getFirstOrderTransfer, getOrderByRazorpayOrderId } from "./queries.service.js";
import {
  fetchRazorpayPayment,
  getRouteKeyId,
  getRouteRazorpayClient,
  verifyCheckoutSignature,
} from "./razorpayRoute.service.js";
import { updateOrderAndPaymentStatus, verifyLinkedAccountReadiness } from "./status.service.js";

export const createMarketplaceOrder = async (payload = {}) => {
  const dairy = await getDairyById(payload.dairy_id);

  const linkedAccountId =
    normalizeString(dairy.razorpay_account_id) ||
    normalizeString(dairy.razorpay_linked_account_id);

  if (!linkedAccountId) {
    const error = new Error("Dairy is not configured with a Razorpay linked account");
    error.statusCode = 400;
    throw error;
  }

  if (!isDairyRouteReady(dairy)) {
    const error = new Error(
      `Dairy Razorpay Route account is not ready for payments. Current status: ${
        dairy.route_activation_status || dairy.razorpay_onboarding_status || "PENDING"
      }`
    );
    error.statusCode = 400;
    throw error;
  }

  await verifyLinkedAccountReadiness({ dairy, linkedAccountId });

  const customer = await upsertCustomer({
    name: payload.customer_name,
    phone: payload.customer_phone,
    address: payload.customer_address,
  });

  const pricing = await calculateMarketplacePricing({
    dairyId: dairy.id,
    items: payload.items,
  });
  await detectSuspiciousMarketplaceOrder({ customer, dairy, pricing, payload });
  const amount = pricing.total;
  const amountInPaise = Math.round(amount * 100);
  const razorpay = getRouteRazorpayClient();
  const receipt = `mkt_${Date.now()}_${dairy.id}`.slice(0, 40);
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt,
    partial_payment: false,
    notes: {
      customer_id: String(customer.id),
      dairy_id: String(dairy.id),
      marketplace: "dairy_stream_cloud",
      commission: "0",
    },
    transfers: [
      {
        account: linkedAccountId,
        amount: amountInPaise,
        currency: "INR",
        notes: {
          dairy_id: String(dairy.id),
          customer_id: String(customer.id),
          commission: "0",
        },
        linked_account_notes: ["dairy_id", "customer_id", "commission"],
        on_hold: false,
      },
    ],
  });

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customer.id,
      dairy_id: dairy.id,
      amount,
      subtotal: pricing.subtotal,
      tax_amount: pricing.taxAmount,
      delivery_fee: pricing.deliveryFee,
      pricing_snapshot: {
        tax_percent: pricing.taxPercent,
        line_items: pricing.lineItems,
      },
      payment_status: "CREATED",
      razorpay_order_id: order.id,
    })
    .select("*")
    .single();

  if (orderError) throw orderError;

  const transfer = Array.isArray(order?.transfers)
    ? order.transfers[0]
    : await getFirstOrderTransfer(order.id);
  const transferId = transfer?.id || null;
  const { data: paymentRow, error: paymentError } = await supabase
    .from("payments")
    .insert({
      order_id: orderRow.id,
      customer_id: customer.id,
      dairy_id: dairy.id,
      amount,
      status: "CREATED",
      settlement_status: transferId ? "TRANSFER_CREATED" : "PENDING",
      transfer_status: transfer?.status ? normalizeStatus(transfer.status) : "PENDING",
      razorpay_order_id: order.id,
      razorpay_transfer_id: transferId || null,
    })
    .select("*")
    .single();

  if (paymentError) throw paymentError;

  return {
    keyId: getRouteKeyId(),
    order,
    orderRow,
    payment: paymentRow,
    customer,
    pricing,
    dairy: {
      id: dairy.id,
      dairy_name: dairy.dairy_name,
      razorpay_account_id: linkedAccountId,
    },
  };
};

export const verifyMarketplacePayment = async ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    const error = new Error("Missing Razorpay verification fields");
    error.statusCode = 400;
    throw error;
  }

  const isValid = verifyCheckoutSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });

  if (!isValid) {
    const error = new Error("Payment signature verification failed");
    error.statusCode = 400;
    throw error;
  }

  const localOrder = await getOrderByRazorpayOrderId(razorpay_order_id);
  if (!localOrder?.id) {
    const error = new Error("Local order not found for Razorpay order");
    error.statusCode = 404;
    throw error;
  }

  const payment = await fetchRazorpayPayment(razorpay_payment_id);
  const expectedAmount = Math.round(Number(localOrder.amount || 0) * 100);
  if (payment?.order_id !== razorpay_order_id) {
    const error = new Error("Razorpay payment does not belong to this order");
    error.statusCode = 400;
    throw error;
  }
  if (Number(payment?.amount || 0) !== expectedAmount || payment?.currency !== "INR") {
    const error = new Error("Razorpay payment amount or currency mismatch");
    error.statusCode = 400;
    throw error;
  }
  if (payment?.status !== "captured" && payment?.captured !== true) {
    const error = new Error(`Payment is not captured yet. Current Razorpay status: ${payment?.status || "unknown"}`);
    error.statusCode = 409;
    throw error;
  }

  const transfer = await getFirstOrderTransfer(razorpay_order_id);
  const order = await updateOrderAndPaymentStatus({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    paymentStatus: "PAID",
    settlementStatus: transfer?.recipient_settlement_id ? "SETTLED" : "TRANSFER_CREATED",
    transferId: transfer?.id || null,
    transferStatus: transfer?.status ? normalizeStatus(transfer.status) : "PENDING",
    settlementId: transfer?.recipient_settlement_id || null,
  });

  return {
    success: true,
    order,
    razorpay_payment_id,
  };
};
