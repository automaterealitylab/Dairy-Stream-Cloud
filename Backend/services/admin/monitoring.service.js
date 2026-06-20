import { supabase } from "../../config/supabase.js";
import { metrics } from "../../utils/metrics.js";

const isMissingTableOrColumn = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("column") && message.includes("does not exist"))
  );
};

const countRows = async (table, buildQuery) => {
  const { count, error } = await buildQuery(
    supabase.from(table).select("id", { count: "exact", head: true })
  );
  if (error) {
    if (isMissingTableOrColumn(error)) return 0;
    throw error;
  }
  return count || 0;
};

export const getOperationalMonitoring = async ({ dairyId }) => {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    pendingVerifications,
    lowConfidenceVerifications,
    failedOcr,
    queuedNotifications,
    failedNotifications,
    openFraudAlerts,
    overdueBills,
  ] = await Promise.all([
    countRows("payment_verifications", (query) => query.eq("dairy_id", dairyId).eq("status", "PENDING")),
    countRows("payment_verifications", (query) =>
      query.eq("dairy_id", dairyId).eq("status", "PENDING").lt("confidence_score", 70)
    ),
    countRows("ocr_processing_logs", (query) =>
      query.eq("dairy_id", dairyId).eq("status", "FAILED").gte("created_at", sinceIso)
    ),
    countRows("notification_events", (query) =>
      query.eq("dairy_id", dairyId).eq("channel", "WHATSAPP").in("status", ["QUEUED", "RETRY"])
    ),
    countRows("notification_events", (query) =>
      query.eq("dairy_id", dairyId).eq("channel", "WHATSAPP").eq("status", "FAILED").gte("created_at", sinceIso)
    ),
    countRows("fraud_alerts", (query) => query.eq("dairy_id", dairyId).neq("status", "CLOSED")),
    countRows("monthly_bills", (query) => query.eq("dairy_id", dairyId).eq("status", "OVERDUE")),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    health: {
      status:
        failedOcr > 10 || failedNotifications > 10 || openFraudAlerts > 20
          ? "ATTENTION"
          : "OK",
      pendingVerifications,
      lowConfidenceVerifications,
      failedOcr,
      queuedNotifications,
      failedNotifications,
      openFraudAlerts,
      overdueBills,
    },
    metrics: metrics.snapshot(),
  };
};
