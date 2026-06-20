import crypto from "crypto";
import { supabase } from "../../config/supabase.js";
import { logger } from "../../utils/logger.js";

const stableJson = (value) => JSON.stringify(value || {}, Object.keys(value || {}).sort());

export const hashPayload = (payload, previousHash = "") =>
  crypto.createHash("sha256").update(`${previousHash}:${stableJson(payload)}`).digest("hex");

export const writeImmutableAudit = async ({
  entityType,
  entityId = null,
  eventType,
  payload = {},
  correlationId = null,
}) => {
  const { data: previous } = await supabase
    .from("immutable_audit_logs")
    .select("hash")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousHash = previous?.hash || "";
  const hash = hashPayload({ entityType, entityId, eventType, payload, correlationId }, previousHash);
  const { error } = await supabase.from("immutable_audit_logs").insert({
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    event_type: eventType,
    payload,
    previous_hash: previousHash || null,
    hash,
    correlation_id: correlationId,
  });

  if (error) logger.warn("immutable_audit_write_failed", { error: error.message, entityType, eventType });
};

export const writeFinancialLedgerEntry = async ({
  paymentId = null,
  orderId = null,
  dairyId = null,
  customerId = null,
  entryType,
  direction,
  amount,
  currency = "INR",
  referenceType,
  referenceId,
  metadata = {},
}) => {
  const { error } = await supabase.from("financial_ledger_entries").insert({
    payment_id: paymentId,
    order_id: orderId,
    dairy_id: dairyId,
    customer_id: customerId,
    entry_type: entryType,
    direction,
    amount,
    currency,
    reference_type: referenceType,
    reference_id: referenceId,
    metadata,
  });

  if (error) logger.warn("financial_ledger_write_failed", { error: error.message, paymentId, entryType });
};

export const writeSettlementLedgerEntry = async ({
  paymentId = null,
  dairyId = null,
  razorpayTransferId = null,
  settlementId = null,
  amount = 0,
  status,
  metadata = {},
}) => {
  const { error } = await supabase.from("settlement_ledger_entries").insert({
    payment_id: paymentId,
    dairy_id: dairyId,
    razorpay_transfer_id: razorpayTransferId,
    settlement_id: settlementId,
    amount,
    status,
    metadata,
  });

  if (error) logger.warn("settlement_ledger_write_failed", { error: error.message, paymentId, status });
};
