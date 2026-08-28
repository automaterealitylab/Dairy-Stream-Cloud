// Marketplace Razorpay webhook ingestion and processing: signature check,
// duplicate/lineage logging, queue-or-process handling and event-driven
// order/payment status transitions.

import { supabase } from "../../config/supabase.js";
import { metrics } from "../../utils/metrics.js";
import {
  writeImmutableAudit,
} from "./auditLedger.service.js";
import {
  isWebhookQueueRequired,
  normalizeStatus,
  normalizeString,
  razorpayOrderIdFromPayload,
} from "./normalizers.js";
import {
  enqueueMarketplaceJob,
  isQueueEnabled,
  QUEUE_NAMES,
} from "./queue.service.js";
import { getFirstOrderTransfer } from "./queries.service.js";
import { verifyWebhookSignature } from "./razorpayRoute.service.js";
import {
  updateOrderAndPaymentStatus,
  updatePaymentsBySettlementId,
  updatePaymentByTransferId,
} from "./status.service.js";

export const processMarketplaceWebhookPayload = async (payload = {}) => {
  const eventType = payload?.event || "unknown";
  const paymentEntity = payload?.payload?.payment?.entity || {};
  const orderEntity = payload?.payload?.order?.entity || {};
  const transferEntity = payload?.payload?.transfer?.entity || {};
  const settlementEntity = payload?.payload?.settlement?.entity || {};
  const razorpayOrderId = paymentEntity.order_id || orderEntity.id || transferEntity.source || null;
  const razorpayPaymentId = paymentEntity.id || null;
  const transferId = transferEntity.id || null;
  metrics.increment("marketplace_webhook_processed", { event: eventType });
  await writeImmutableAudit({
    entityType: "razorpay_webhook",
    entityId: payload?.id || paymentEntity?.id || transferId || razorpayOrderId,
    eventType,
    payload: {
      razorpayOrderId,
      razorpayPaymentId,
      transferId,
      settlementId: settlementEntity?.id || transferEntity?.recipient_settlement_id || null,
    },
  });

  if (eventType === "payment.captured" || eventType === "order.paid") {
    if (razorpayOrderId) {
      const transfer = await getFirstOrderTransfer(razorpayOrderId);
      await updateOrderAndPaymentStatus({
        razorpayOrderId,
        razorpayPaymentId,
        paymentStatus: "PAID",
        settlementStatus: transfer?.recipient_settlement_id ? "SETTLED" : "TRANSFER_CREATED",
        transferId: transfer?.id || null,
        transferStatus: transfer?.status ? normalizeStatus(transfer.status) : "PENDING",
        settlementId: transfer?.recipient_settlement_id || null,
      });
    }
  }

  if (eventType === "payment.failed") {
    if (razorpayOrderId) {
      await updateOrderAndPaymentStatus({
        razorpayOrderId,
        razorpayPaymentId,
        paymentStatus: "FAILED",
        settlementStatus: "NOT_SETTLED",
        failureReason: paymentEntity?.error_description || paymentEntity?.error_reason || null,
      });
    }
  }

  if (eventType === "transfer.processed") {
    await updatePaymentByTransferId({
      transferId,
      settlementStatus: transferEntity?.recipient_settlement_id ? "SETTLED" : "TRANSFER_PROCESSED",
      transferStatus: "PROCESSED",
      settlementId: transferEntity?.recipient_settlement_id || null,
    });
  }

  if (eventType === "transfer.failed") {
    await updatePaymentByTransferId({
      transferId,
      settlementStatus: "TRANSFER_FAILED",
      transferStatus: "FAILED",
      failureReason: transferEntity?.error_description || transferEntity?.error_reason || "Transfer failed",
    });
  }

  if (eventType === "settlement.processed") {
    const settlementId = settlementEntity?.id || transferEntity?.recipient_settlement_id || null;
    if (transferId) {
      await updatePaymentByTransferId({
        transferId,
        settlementStatus: "SETTLED",
        transferStatus: transferEntity?.status ? normalizeStatus(transferEntity.status) : "PROCESSED",
        settlementId,
      });
    } else {
      await updatePaymentsBySettlementId({ settlementId });
    }
  }

  return { event: eventType };
};

export const processStoredMarketplaceWebhook = async (logRow) => {
  if (!logRow?.id) return { processed: false };

  try {
    await processMarketplaceWebhookPayload(logRow.payload || {});
    await supabase
      .from("webhook_logs")
      .update({
        processed: true,
        processing_error: null,
        next_retry_at: null,
        dead_letter: false,
        processed_at: new Date().toISOString(),
      })
      .eq("id", logRow.id);

    return { processed: true };
  } catch (err) {
    const attempts = Number(logRow.attempts || 0) + 1;
    await supabase
      .from("webhook_logs")
      .update({
        attempts,
        processing_error: err.message || "Webhook retry processing failed",
        next_retry_at: attempts >= 5 ? null : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        dead_letter: attempts >= 5,
      })
      .eq("id", logRow.id);

    throw err;
  }
};

export const handleMarketplaceWebhook = async ({ rawBody, signature, eventId = null }) => {
  if (!verifyWebhookSignature({ rawBody, signature })) {
    const error = new Error("Invalid Razorpay webhook signature");
    error.statusCode = 400;
    throw error;
  }

  const payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "{}"));
  const eventType = payload?.event || "unknown";
  const resolvedEventId = normalizeString(eventId) || normalizeString(payload?.id) || null;
  const eventCreatedAt = Number(payload?.created_at || payload?.payload?.payment?.entity?.created_at || 0);
  const replayWindowSeconds = Number(process.env.RAZORPAY_WEBHOOK_REPLAY_WINDOW_SECONDS || 86400);
  if (eventCreatedAt > 0 && Math.abs(Date.now() / 1000 - eventCreatedAt) > replayWindowSeconds) {
    const error = new Error("Webhook event is outside replay protection window");
    error.statusCode = 400;
    throw error;
  }

  let logRow = null;
  let webhookAttempts = 0;
  if (resolvedEventId) {
    const { data: existingLog, error: existingLogError } = await supabase
      .from("webhook_logs")
      .select("id, processed, attempts")
      .eq("razorpay_event_id", resolvedEventId)
      .limit(1)
      .maybeSingle();

    if (existingLogError) throw existingLogError;
    if (existingLog?.processed) {
      return { received: true, duplicate: true, event: eventType };
    }
    if (existingLog?.id) {
      webhookAttempts = Number(existingLog.attempts || 0);
      const { data: updatedLog, error: updateLogError } = await supabase
        .from("webhook_logs")
        .update({
          event_type: eventType,
          payload,
          processing_error: null,
          event_version: String(payload?.version || "v1"),
          lineage_key: razorpayOrderIdFromPayload(payload) || resolvedEventId,
        })
        .eq("id", existingLog.id)
        .select("id")
        .single();

      if (updateLogError) throw updateLogError;
      logRow = updatedLog;
    }
  }

  if (!logRow?.id) {
    const { data: insertedLog, error: logError } = await supabase.from("webhook_logs").insert({
      razorpay_event_id: resolvedEventId,
      event_type: eventType,
      payload,
      event_version: String(payload?.version || "v1"),
      lineage_key: razorpayOrderIdFromPayload(payload) || resolvedEventId,
    }).select("id").maybeSingle();
    if (logError) {
      if (logError.code === "23505") {
        return { received: true, duplicate: true, event: eventType };
      }
      throw logError;
    }
    logRow = insertedLog;
  }

  const { data: queuedLog, error: queuedLogError } = await supabase
    .from("webhook_logs")
    .select("*")
    .eq("id", logRow.id)
    .single();
  if (queuedLogError) throw queuedLogError;

  if (isQueueEnabled()) {
    const queued = await enqueueMarketplaceJob({
      queueName: QUEUE_NAMES.webhooks,
      name: eventType,
      data: queuedLog,
      jobId: resolvedEventId || `webhook-log-${logRow.id}`,
    });
    await supabase
      .from("webhook_logs")
      .update({ queued_at: new Date().toISOString() })
      .eq("id", logRow.id);
    return { received: true, queued: queued.queued, event: eventType };
  }

  if (isWebhookQueueRequired()) {
    const error = new Error("Webhook queue is required but Redis/BullMQ is unavailable");
    error.statusCode = 503;
    throw error;
  }

  try {
    await processMarketplaceWebhookPayload(payload);

    if (logRow?.id) {
      await supabase
        .from("webhook_logs")
        .update({ processed: true, processing_error: null, processed_at: new Date().toISOString() })
        .eq("id", logRow.id);
    }
  } catch (err) {
    if (logRow?.id) {
      const attempts = webhookAttempts + 1;
      const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await supabase
        .from("webhook_logs")
        .update({
          processed: false,
          processing_error: err.message || "Webhook processing failed",
          attempts,
          next_retry_at: attempts >= 5 ? null : nextRetryAt,
          dead_letter: attempts >= 5,
        })
        .eq("id", logRow.id);
    }
    throw err;
  }

  return { received: true, event: eventType };
};
