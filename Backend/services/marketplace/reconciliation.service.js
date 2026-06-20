import { supabase } from "../../config/supabase.js";
import { metrics } from "../../utils/metrics.js";
import { logger } from "../../utils/logger.js";
import {
  fetchOrderTransfers,
  fetchRazorpayPayment,
} from "./razorpayRoute.service.js";
import { processStoredMarketplaceWebhook } from "./marketplace.service.js";
import { enqueueMarketplaceJob, isQueueEnabled, QUEUE_NAMES } from "./queue.service.js";
import { writeImmutableAudit } from "./auditLedger.service.js";

const normalizeStatus = (value) => String(value || "").trim().toUpperCase();

const startRun = async (runType) => {
  const { data, error } = await supabase
    .from("reconciliation_logs")
    .insert({ run_type: runType, status: "STARTED" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

const finishRun = async (runId, payload) => {
  const { data, error } = await supabase
    .from("reconciliation_logs")
    .update({
      ...payload,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

const writePaymentAudit = async ({ payment, previousState, nextState, eventType, metadata = {} }) => {
  await supabase.from("payment_audit_logs").insert({
    payment_id: payment?.id || null,
    order_id: payment?.order_id || null,
    event_type: eventType,
    previous_state: previousState || null,
    next_state: nextState || null,
    metadata,
  });
};

const recordMismatch = async ({ runId, payment, mismatchType, severity = "MEDIUM", expected, actual, metadata = {} }) => {
  metrics.increment("reconciliation_mismatches", { mismatchType, severity });
  const fingerprint = [
    mismatchType,
    payment?.id,
    payment?.razorpay_order_id,
    JSON.stringify(expected || {}),
    JSON.stringify(actual || {}),
  ].join(":");

  const { error } = await supabase.from("reconciliation_mismatches").upsert(
    {
      run_id: runId,
      payment_id: payment?.id || null,
      order_id: payment?.order_id || null,
      dairy_id: payment?.dairy_id || null,
      mismatch_type: mismatchType,
      severity,
      expected,
      actual,
      metadata,
      status: "OPEN",
      fingerprint,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "fingerprint" }
  );
  if (error && error.code !== "42P01") throw error;
};

const writeSnapshot = async ({ runId, stage, status, checked = 0, repaired = 0, failed = 0, anomalies = 0, details = {} }) => {
  const { error } = await supabase.from("reconciliation_snapshots").insert({
    run_id: runId,
    stage,
    status,
    checked_count: checked,
    repaired_count: repaired,
    failed_count: failed,
    anomaly_count: anomalies,
    details,
  });
  if (error && error.code !== "42P01") throw error;
};

const detectPaymentAnomalies = async ({ runId, payment, razorpayPayment, transfer }) => {
  const anomalies = [];
  if (razorpayPayment && Number(razorpayPayment.amount || 0) !== Math.round(Number(payment.amount || 0) * 100)) {
    anomalies.push({
      mismatchType: "PAYMENT_AMOUNT_MISMATCH",
      severity: "HIGH",
      expected: { amount: Math.round(Number(payment.amount || 0) * 100), currency: "INR" },
      actual: { amount: razorpayPayment.amount, currency: razorpayPayment.currency },
    });
  }
  if (razorpayPayment && razorpayPayment.order_id !== payment.razorpay_order_id) {
    anomalies.push({
      mismatchType: "PAYMENT_ORDER_MISMATCH",
      severity: "CRITICAL",
      expected: { razorpay_order_id: payment.razorpay_order_id },
      actual: { razorpay_order_id: razorpayPayment.order_id },
    });
  }
  if (transfer && payment.razorpay_transfer_id && transfer.id !== payment.razorpay_transfer_id) {
    anomalies.push({
      mismatchType: "TRANSFER_ID_MISMATCH",
      severity: "HIGH",
      expected: { transfer_id: payment.razorpay_transfer_id },
      actual: { transfer_id: transfer.id },
    });
  }

  for (const anomaly of anomalies) {
    await recordMismatch({ runId, payment, ...anomaly });
  }
  return anomalies.length;
};

const reconcilePaymentRow = async (payment, { runId = null } = {}) => {
  const previousState = {
    status: payment.status,
    settlement_status: payment.settlement_status,
    transfer_status: payment.transfer_status,
    razorpay_transfer_id: payment.razorpay_transfer_id,
    settlement_id: payment.settlement_id,
  };

  const update = {};
  let changed = false;

  if (payment.razorpay_payment_id) {
    var razorpayPayment = await fetchRazorpayPayment(payment.razorpay_payment_id);
    if (razorpayPayment?.status === "captured" && payment.status !== "PAID") {
      update.status = "PAID";
      changed = true;
    }
    if (razorpayPayment?.status === "failed" && payment.status !== "FAILED") {
      update.status = "FAILED";
      update.settlement_status = "NOT_SETTLED";
      update.failure_reason = razorpayPayment?.error_description || razorpayPayment?.error_reason || null;
      changed = true;
    }
  }

  if (payment.razorpay_order_id) {
    const transfers = await fetchOrderTransfers(payment.razorpay_order_id);
    var transfer = transfers[0] || null;
    if (!transfer && ["TRANSFER_CREATED", "TRANSFER_PROCESSED"].includes(payment.settlement_status)) {
      await recordMismatch({
        runId,
        payment,
        mismatchType: "MISSING_RAZORPAY_TRANSFER",
        severity: "HIGH",
        expected: { transfer: "present" },
        actual: { transfer: null },
      });
    }
    if (transfer) {
      if (transfer.id && payment.razorpay_transfer_id !== transfer.id) {
        update.razorpay_transfer_id = transfer.id;
        changed = true;
      }
      const transferStatus = normalizeStatus(transfer.status || "PENDING");
      if (transferStatus && payment.transfer_status !== transferStatus) {
        update.transfer_status = transferStatus;
        changed = true;
      }
      if (transfer.recipient_settlement_id && payment.settlement_id !== transfer.recipient_settlement_id) {
        update.settlement_id = transfer.recipient_settlement_id;
        update.settlement_status = "SETTLED";
        changed = true;
      } else if (transferStatus === "PROCESSED" && payment.settlement_status !== "TRANSFER_PROCESSED") {
        update.settlement_status = "TRANSFER_PROCESSED";
        changed = true;
      } else if (transferStatus === "FAILED" && payment.settlement_status !== "TRANSFER_FAILED") {
        update.settlement_status = "TRANSFER_FAILED";
        update.failure_reason = transfer.error_description || transfer.error_reason || "Transfer failed";
        changed = true;
      }
    }
  }

  const anomalyCount = await detectPaymentAnomalies({ runId, payment, razorpayPayment, transfer });

  if (!changed) {
    return { repaired: false, anomalyCount };
  }

  update.updated_at = new Date().toISOString();
  const { data: updatedPayment, error } = await supabase
    .from("payments")
    .update(update)
    .eq("id", payment.id)
    .select("*")
    .single();

  if (error) throw error;

  await writePaymentAudit({
    payment,
    previousState,
    nextState: update,
    eventType: "RECONCILIATION_REPAIR",
  });
  await writeImmutableAudit({
    entityType: "payment",
    entityId: payment.id,
    eventType: "RECONCILIATION_REPAIR",
    payload: { previousState, nextState: update, runId },
  });

  return { repaired: true, payment: updatedPayment, anomalyCount };
};

export const processPendingWebhookRetries = async ({ limit = 50 } = {}) => {
  const { data: rows, error } = await supabase
    .from("webhook_logs")
    .select("*")
    .eq("processed", false)
    .eq("dead_letter", false)
    .lte("next_retry_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  let processed = 0;
  let failed = 0;
  const failures = [];

  for (const row of rows || []) {
    try {
      const result = await processStoredMarketplaceWebhook(row);
      if (result.processed) processed += 1;
    } catch (err) {
      failed += 1;
      failures.push({
        webhook_log_id: row.id,
        event_type: row.event_type,
        error: err.message,
      });
    }
  }

  return { checked: rows?.length || 0, processed, failed, failures };
};

export const runMarketplaceReconciliation = async ({
  runType = "SCHEDULED",
  limit = 100,
} = {}) => {
  const run = await startRun(runType);
  let checkedCount = 0;
  let repairedCount = 0;
  let failedCount = 0;
  let anomalyCount = 0;
  const failures = [];

  try {
    await writeSnapshot({ runId: run.id, stage: "START", status: "STARTED" });
    const { data: payments, error } = await supabase
      .from("payments")
      .select("*")
      .not("razorpay_order_id", "is", null)
      .in("settlement_status", ["PENDING", "TRANSFER_CREATED", "TRANSFER_PROCESSED", "TRANSFER_FAILED"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    for (const payment of payments || []) {
      checkedCount += 1;
      try {
        const result = await reconcilePaymentRow(payment, { runId: run.id });
        if (result.repaired) repairedCount += 1;
        anomalyCount += Number(result.anomalyCount || 0);
      } catch (err) {
        failedCount += 1;
        failures.push({
          payment_id: payment.id,
          razorpay_order_id: payment.razorpay_order_id,
          error: err.message,
        });
      }
    }
    await writeSnapshot({
      runId: run.id,
      stage: "PAYMENT_TRANSFER_SETTLEMENT",
      status: "COMPLETED",
      checked: checkedCount,
      repaired: repairedCount,
      failed: failedCount,
      anomalies: anomalyCount,
    });

    const webhookRetryResult = isQueueEnabled()
      ? await enqueueMarketplaceJob({
          queueName: QUEUE_NAMES.retries,
          name: "webhook-retry-scan",
          data: { limit: 50 },
          jobId: `webhook-retry-scan-${new Date().toISOString().slice(0, 16)}`,
        }).then(() => ({ checked: 0, processed: 0, failed: 0, failures: [] }))
      : await processPendingWebhookRetries();
    if (webhookRetryResult.failed > 0) {
      failedCount += webhookRetryResult.failed;
      failures.push(...webhookRetryResult.failures);
    }
    await writeSnapshot({
      runId: run.id,
      stage: "WEBHOOK_RETRIES",
      status: webhookRetryResult.failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      checked: webhookRetryResult.checked,
      repaired: webhookRetryResult.processed,
      failed: webhookRetryResult.failed,
      details: webhookRetryResult,
    });

    return finishRun(run.id, {
      status: failedCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      checked_count: checkedCount,
      repaired_count: repairedCount,
      failed_count: failedCount,
      details: { failures, anomalyCount },
    });
  } catch (err) {
    await writeSnapshot({
      runId: run.id,
      stage: "FAILED",
      status: "FAILED",
      checked: checkedCount,
      repaired: repairedCount,
      failed: failedCount + 1,
      anomalies: anomalyCount,
      details: { error: err.message },
    });
    return finishRun(run.id, {
      status: "FAILED",
      checked_count: checkedCount,
      repaired_count: repairedCount,
      failed_count: failedCount + 1,
      details: { error: err.message, failures, anomalyCount },
    });
  }
};

export const verifyOrderSettlement = async (razorpayOrderId) => {
  const orderId = String(razorpayOrderId || "").trim();
  if (!orderId) {
    const error = new Error("Razorpay order id is required");
    error.statusCode = 400;
    throw error;
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("razorpay_order_id", orderId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!payment) {
    const notFound = new Error("Payment record not found for Razorpay order");
    notFound.statusCode = 404;
    throw notFound;
  }

  const result = await reconcilePaymentRow(payment);
  const { data: refreshedPayment, error: refreshedError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", payment.id)
    .single();

  if (refreshedError) throw refreshedError;

  return {
    repaired: result.repaired,
    payment: refreshedPayment,
    transfers: await fetchOrderTransfers(orderId),
  };
};

export const getSettlementHealth = async () => {
  const [pendingRes, failedRes, deadLetterRes, recentRunsRes, mismatchRes] = await Promise.all([
    supabase.from("payments").select("id", { count: "exact", head: true }).in("settlement_status", [
      "PENDING",
      "TRANSFER_CREATED",
      "TRANSFER_PROCESSED",
    ]),
    supabase.from("payments").select("id", { count: "exact", head: true }).in("settlement_status", [
      "TRANSFER_FAILED",
      "NOT_SETTLED",
    ]),
    supabase.from("webhook_logs").select("id", { count: "exact", head: true }).eq("dead_letter", true),
    supabase
      .from("reconciliation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("reconciliation_mismatches")
      .select("id", { count: "exact", head: true })
      .eq("status", "OPEN"),
  ]);

  if (pendingRes.error) throw pendingRes.error;
  if (failedRes.error) throw failedRes.error;
  if (deadLetterRes.error) throw deadLetterRes.error;
  if (recentRunsRes.error) throw recentRunsRes.error;
  if (mismatchRes.error && mismatchRes.error.code !== "42P01") throw mismatchRes.error;

  return {
    pendingSettlements: pendingRes.count || 0,
    failedSettlements: failedRes.count || 0,
    deadLetterWebhooks: deadLetterRes.count || 0,
    openMismatches: mismatchRes.count || 0,
    recentRuns: recentRunsRes.data || [],
  };
};

export const getReconciliationDashboard = async ({ limit = 100 } = {}) => {
  const [runsRes, mismatchRes, snapshotRes] = await Promise.all([
    supabase.from("reconciliation_logs").select("*").order("created_at", { ascending: false }).limit(25),
    supabase
      .from("reconciliation_mismatches")
      .select("*")
      .eq("status", "OPEN")
      .order("severity", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("reconciliation_snapshots").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  if (runsRes.error) throw runsRes.error;
  if (mismatchRes.error && mismatchRes.error.code !== "42P01") throw mismatchRes.error;
  if (snapshotRes.error && snapshotRes.error.code !== "42P01") throw snapshotRes.error;

  return {
    runs: runsRes.data || [],
    unresolvedMismatches: mismatchRes.data || [],
    snapshots: snapshotRes.data || [],
  };
};
