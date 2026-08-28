// Marketplace order/payment status transitions driven by Razorpay events,
// plus linked-account readiness verification and settlement ledger writes.

import { supabase } from "../../config/supabase.js";
import {
  writeFinancialLedgerEntry,
  writeImmutableAudit,
  writeSettlementLedgerEntry,
} from "./auditLedger.service.js";
import {
  isActivationStatusEnabled,
  isRouteStatusBlocking,
  normalizeStatus,
  normalizeString,
} from "./normalizers.js";
import { getOrderByRazorpayOrderId } from "./queries.service.js";
import { fetchLinkedAccount, fetchRouteProduct } from "./razorpayRoute.service.js";

export const verifyLinkedAccountReadiness = async ({ dairy, linkedAccountId }) => {
  if (!normalizeString(dairy?.razorpay_route_product_id)) {
    const error = new Error("Razorpay Route product is not configured for this dairy");
    error.statusCode = 400;
    throw error;
  }

  const account = await fetchLinkedAccount(linkedAccountId);
  const accountStatus = normalizeStatus(account?.status || account?.activation_status);
  if (isRouteStatusBlocking(accountStatus)) {
    const error = new Error(`Linked account is not active. Current status: ${accountStatus || "UNKNOWN"}`);
    error.statusCode = 400;
    throw error;
  }

  let product = null;
  product = await fetchRouteProduct({
    accountId: linkedAccountId,
    productId: dairy.razorpay_route_product_id,
  });
  const productStatus = normalizeStatus(product?.activation_status || product?.status);
  if (!isActivationStatusEnabled(productStatus)) {
    const error = new Error(`Route product is not active. Current status: ${productStatus || "UNKNOWN"}`);
    error.statusCode = 400;
    throw error;
  }

  return { account, product };
};

export const updateOrderAndPaymentStatus = async ({
  razorpayOrderId,
  razorpayPaymentId = null,
  paymentStatus,
  settlementStatus = null,
  transferId = null,
  transferStatus = null,
  settlementId = null,
  failureReason = null,
}) => {
  const order = await getOrderByRazorpayOrderId(razorpayOrderId);
  if (!order?.id) return null;

  const now = new Date().toISOString();
  const orderUpdate = {
    payment_status: paymentStatus,
    updated_at: now,
  };
  if (razorpayPaymentId) orderUpdate.razorpay_payment_id = razorpayPaymentId;

  const { error: orderError } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", order.id);

  if (orderError) throw orderError;

  const paymentUpdate = {
    status: paymentStatus,
    updated_at: now,
  };
  if (settlementStatus) paymentUpdate.settlement_status = settlementStatus;
  if (transferStatus) paymentUpdate.transfer_status = transferStatus;
  if (transferId) paymentUpdate.razorpay_transfer_id = transferId;
  if (settlementId) paymentUpdate.settlement_id = settlementId;
  if (failureReason) paymentUpdate.failure_reason = failureReason;
  if (razorpayPaymentId) paymentUpdate.razorpay_payment_id = razorpayPaymentId;

  const { error: paymentError } = await supabase
    .from("payments")
    .update(paymentUpdate)
    .eq("order_id", order.id);

  if (paymentError) throw paymentError;
  if (paymentStatus === "PAID") {
    await writeFinancialLedgerEntry({
      paymentId: null,
      orderId: order.id,
      dairyId: order.dairy_id,
      customerId: order.customer_id,
      entryType: "PAYMENT_CAPTURED",
      direction: "CREDIT",
      amount: order.amount,
      referenceType: "RAZORPAY_PAYMENT",
      referenceId: razorpayPaymentId,
      metadata: { razorpayOrderId, transferId, transferStatus, settlementId },
    });
  }
  await writeImmutableAudit({
    entityType: "payment",
    entityId: razorpayPaymentId || razorpayOrderId,
    eventType: `PAYMENT_STATUS_${paymentStatus}`,
    payload: { razorpayOrderId, razorpayPaymentId, settlementStatus, transferId, transferStatus, settlementId },
  });
  return order;
};

export const updatePaymentByTransferId = async ({
  transferId,
  settlementStatus,
  transferStatus,
  settlementId = null,
  failureReason = null,
}) => {
  if (!transferId) return null;

  const update = {
    updated_at: new Date().toISOString(),
  };
  if (settlementStatus) update.settlement_status = settlementStatus;
  if (transferStatus) update.transfer_status = transferStatus;
  if (settlementId) update.settlement_id = settlementId;
  if (failureReason) update.failure_reason = failureReason;

  const { data, error } = await supabase
    .from("payments")
    .update(update)
    .eq("razorpay_transfer_id", transferId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data?.id) {
    await writeSettlementLedgerEntry({
      paymentId: data.id,
      dairyId: data.dairy_id,
      razorpayTransferId: transferId,
      settlementId,
      amount: data.amount,
      status: settlementStatus || transferStatus,
      metadata: { failureReason },
    });
  }
  return data || null;
};

export const updatePaymentsBySettlementId = async ({ settlementId }) => {
  if (!settlementId) return [];

  const { data, error } = await supabase
    .from("payments")
    .update({
      settlement_status: "SETTLED",
      transfer_status: "PROCESSED",
      settlement_id: settlementId,
      updated_at: new Date().toISOString(),
    })
    .eq("settlement_id", settlementId)
    .select("*");

  if (error) throw error;
  await Promise.all(
    (data || []).map((payment) =>
      writeSettlementLedgerEntry({
        paymentId: payment.id,
        dairyId: payment.dairy_id,
        razorpayTransferId: payment.razorpay_transfer_id,
        settlementId,
        amount: payment.amount,
        status: "SETTLED",
      })
    )
  );
  return data || [];
};
