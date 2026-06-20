import { supabase } from "../../config/supabase.js";
import { metrics } from "../../utils/metrics.js";
import { getQueueStats } from "./queue.service.js";
import { getReconciliationDashboard, getSettlementHealth } from "./reconciliation.service.js";

const count = async (table, builder) => {
  const query = supabase.from(table).select("id", { count: "exact", head: true });
  const { count: rowCount, error } = await builder(query);
  if (error && error.code !== "42P01") throw error;
  return rowCount || 0;
};

export const getEnterpriseMonitoringDashboard = async () => {
  const [
    paidPayments,
    failedPayments,
    totalPayments,
    transferProcessed,
    transferFailed,
    webhookFailures,
    deadLetters,
    fraudAlerts,
    settlementHealth,
    reconciliation,
    queueStats,
  ] = await Promise.all([
    count("payments", (q) => q.eq("status", "PAID")),
    count("payments", (q) => q.eq("status", "FAILED")),
    count("payments", (q) => q.not("status", "is", null)),
    count("payments", (q) => q.in("transfer_status", ["PROCESSED", "PROCESSED_WITH_ERRORS"])),
    count("payments", (q) => q.eq("transfer_status", "FAILED")),
    count("webhook_logs", (q) => q.not("processing_error", "is", null)),
    count("webhook_logs", (q) => q.eq("dead_letter", true)),
    count("fraud_alerts", (q) => q.neq("status", "CLOSED")),
    getSettlementHealth(),
    getReconciliationDashboard({ limit: 25 }),
    getQueueStats(),
  ]);

  const paymentSuccessRate = totalPayments > 0 ? Number(((paidPayments / totalPayments) * 100).toFixed(2)) : 0;
  const transferTotal = transferProcessed + transferFailed;
  const transferSuccessRate = transferTotal > 0 ? Number(((transferProcessed / transferTotal) * 100).toFixed(2)) : 0;

  return {
    paymentSuccessRate,
    transferSuccessRate,
    settlementDelays: settlementHealth.pendingSettlements,
    reconciliationMismatches: settlementHealth.openMismatches,
    webhookFailures,
    failedTransfers: transferFailed,
    deadLetters,
    fraudAlerts,
    queues: queueStats,
    retryCounts: {
      webhookDeadLetters: deadLetters,
      webhookFailures,
    },
    reconciliation,
    metrics: metrics.snapshot(),
  };
};
