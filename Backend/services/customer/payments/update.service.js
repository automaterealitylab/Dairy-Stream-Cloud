// Payment row updates (with column-schema fallbacks) and audit writes.

import { supabase } from "../../../config/supabase.js";
import {
  isMissingColumnError,
  isMissingTableError,
} from "../../../utils/dbErrors.js";
import { normalizePaymentId } from "./normalizers.js";

export const executePaymentUpdate = async ({
  customerColumn,
  customerId,
  dairyId = null,
  paymentId = null,
  statuses = null,
  payload,
}) => {
  let query = supabase
    .from("payments")
    .update(payload)
    .eq(customerColumn, customerId);

  if (paymentId !== null && paymentId !== undefined) {
    query = query.eq("id", normalizePaymentId(paymentId));
  }

  if (Array.isArray(statuses) && statuses.length > 0) {
    query = query.in("status", statuses);
  }

  if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
    query = query.eq("dairy_id", dairyId);
  }

  return query.select("id, status");
};

export const buildPaidUpdatePayloadVariants = ({
  paymentMethod,
  paidAtIso,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const razorpayMeta = {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  };

  return [
    { status: "PAID", method: paymentMethod, paid_at: paidAtIso, updated_at: paidAtIso, ...razorpayMeta },
    { status: "PAID", payment_method: paymentMethod, payment_date: paidAtIso, updated_at: paidAtIso, ...razorpayMeta },
    { status: "PAID", payment_method: paymentMethod, paid_at: paidAtIso, updated_at: paidAtIso, ...razorpayMeta },
    { status: "PAID", method: paymentMethod, payment_date: paidAtIso, updated_at: paidAtIso, ...razorpayMeta },
    { status: "PAID", method: paymentMethod, paid_at: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", payment_method: paymentMethod, payment_date: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", payment_method: paymentMethod, paid_at: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", method: paymentMethod, payment_date: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", method: paymentMethod, updated_at: paidAtIso },
    { status: "PAID", payment_method: paymentMethod, updated_at: paidAtIso },
    { status: "PAID", paid_at: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", payment_date: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", updated_at: paidAtIso },
    { status: "PAID" },
  ];
};

export const updatePaymentsWithFallbacks = async ({
  customerColumn,
  customerId,
  dairyId = null,
  paymentId = null,
  statuses = null,
  payloadVariants,
}) => {
  let lastMissingColumnError = null;

  for (const payload of payloadVariants) {
    const { data, error } = await executePaymentUpdate({
      customerColumn,
      customerId,
      dairyId,
      paymentId,
      statuses,
      payload,
    });

    if (!error) {
      return data || [];
    }

    if (isMissingColumnError(error)) {
      lastMissingColumnError = error;
      continue;
    }

    throw error;
  }

  if (lastMissingColumnError) {
    throw lastMissingColumnError;
  }

  return [];
};

export const writePaymentAudit = async ({
  actorType,
  actorId,
  dairyId,
  customerId,
  entityType,
  entityId,
  action,
  metadata = {},
}) => {
  await supabase
    .from("audit_logs")
    .insert({
      actor_type: actorType,
      actor_id: actorId || null,
      dairy_id: dairyId || null,
      customer_id: customerId || null,
      entity_type: entityType,
      entity_id: entityId == null ? null : String(entityId),
      action,
      metadata,
    })
    .then(({ error }) => {
      if (error && !isMissingTableError(error)) throw error;
    });
};
