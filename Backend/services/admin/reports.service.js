import { supabase } from "../../config/supabase.js";

const isMissingTableOrColumn = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("column") && message.includes("does not exist"))
  );
};

const toNumber = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getRange = ({ from, to } = {}) => {
  const end = toDateOnly(to) || new Date().toISOString().slice(0, 10);
  const start =
    toDateOnly(from) ||
    new Date(new Date(end).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from: start, to: end };
};

const safeSelect = async (table, buildQuery, fallback = []) => {
  const { data, error } = await buildQuery(supabase.from(table));
  if (error) {
    if (isMissingTableOrColumn(error)) return fallback;
    throw error;
  }
  return data || fallback;
};

export const getDairyAccountingReport = async ({ dairyId, from, to }) => {
  const range = getRange({ from, to });
  const fromIso = `${range.from}T00:00:00.000Z`;
  const toIso = `${range.to}T23:59:59.999Z`;

  const [payments, bills, verifications, fraudAlerts, reminders] = await Promise.all([
    safeSelect("payments", (query) =>
      query
        .select("id, customer_id, amount, status, method, due_date, paid_at, created_at")
        .eq("dairy_id", dairyId)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(5000)
    ),
    safeSelect("monthly_bills", (query) =>
      query
        .select("id, customer_id, billing_month, subtotal, tax_amount, discount_amount, late_fee_amount, total_amount, paid_amount, due_amount, status, due_date")
        .eq("dairy_id", dairyId)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(5000)
    ),
    safeSelect("payment_verifications", (query) =>
      query
        .select("id, amount, status, confidence_score, fraud_flags, submitted_at")
        .eq("dairy_id", dairyId)
        .gte("submitted_at", fromIso)
        .lte("submitted_at", toIso)
        .order("submitted_at", { ascending: false })
        .limit(1000)
    ),
    safeSelect("fraud_alerts", (query) =>
      query
        .select("id, alert_type, severity, status, created_at")
        .eq("dairy_id", dairyId)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(500)
    ),
    safeSelect("reminders", (query) =>
      query
        .select("id, reminder_type, channel, status, sent_at, created_at")
        .eq("dairy_id", dairyId)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(1000)
    ),
  ]);

  const paidPayments = payments.filter((row) => String(row.status || "").toUpperCase() === "PAID");
  const unpaidBills = bills.filter((row) =>
    ["PENDING", "OVERDUE", "PARTIAL"].includes(String(row.status || "").toUpperCase())
  );

  const revenueByDay = paidPayments.reduce((acc, row) => {
    const key = toDateOnly(row.paid_at || row.created_at) || "unknown";
    acc[key] = toNumber(acc[key]) + toNumber(row.amount);
    return acc;
  }, {});

  return {
    range,
    summary: {
      totalRevenue: paidPayments.reduce((sum, row) => sum + toNumber(row.amount), 0),
      totalBilled: bills.reduce((sum, row) => sum + toNumber(row.total_amount), 0),
      totalOutstanding: unpaidBills.reduce((sum, row) => sum + toNumber(row.due_amount || row.total_amount), 0),
      paidCount: paidPayments.length,
      unpaidBillCount: unpaidBills.length,
      verificationCount: verifications.length,
      lowConfidenceVerificationCount: verifications.filter((row) => toNumber(row.confidence_score) < 70).length,
      openFraudAlertCount: fraudAlerts.filter((row) => String(row.status || "").toUpperCase() !== "CLOSED").length,
      reminderCount: reminders.length,
    },
    revenueByDay: Object.entries(revenueByDay)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) })),
    unpaidBills,
    verifications,
    fraudAlerts,
    reminders,
  };
};
