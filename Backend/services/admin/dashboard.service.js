import { supabase } from "../../config/supabase.js";

const dashboardCache = new Map();
const CACHE_TTL = 30_000;

const normalizeDateOnly = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isOnOrAfter = (value, thresholdIso) => {
  if (!value) return false;
  const parsed = new Date(value);
  const threshold = new Date(thresholdIso);
  if (Number.isNaN(parsed.getTime()) || Number.isNaN(threshold.getTime())) return false;
  return parsed.getTime() >= threshold.getTime();
};

const isActiveSubscription = (row = {}) => {
  const status = String(row?.status || "ACTIVE").toUpperCase();
  const approvalStatus = String(row?.approval_status || "APPROVED").toUpperCase();
  return status !== "CLOSED" && approvalStatus === "APPROVED";
};

const getActiveCustomerCountForDairy = async (dairyId) => {
  if (!Number.isFinite(Number(dairyId))) return 0;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("customer_id, status, approval_status")
    .eq("dairy_id", Number(dairyId));

  if (error) throw error;

  return new Set(
    (data || [])
      .filter((row) => row?.customer_id && isActiveSubscription(row))
      .map((row) => row.customer_id)
  ).size;
};

export const getAdminDashboardStats = async ({ dairyId, forceRefresh = false } = {}) => {
  const now = Date.now();
  const cacheKey = String(dairyId ?? "global");
  const cached = dashboardCache.get(cacheKey);

  if (!forceRefresh && cached && now - cached.at < CACHE_TTL) {
    return cached.payload;
  }

  const targetDairyId = Number(dairyId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayDate = normalizeDateOnly(startOfDay);
  const startIso = startOfDay.toISOString();

  const [totalCustomers, totalAgents, dairyRow, suppliersRes, deliveriesRes, procurementRes, paymentsRes] =
    await Promise.all([
      getActiveCustomerCountForDairy(targetDairyId),
      supabase.from("agents").select("id", { count: "exact", head: true }).eq("dairy_id", targetDairyId),
      supabase.from("dairies").select("dairy_name").eq("id", targetDairyId).maybeSingle(),
      supabase.from("suppliers").select("id, name").eq("status", "ACTIVE"),
      supabase
        .from("deliveries")
        .select("id, quantity_liters, status")
        .eq("dairy_id", targetDairyId)
        .eq("delivery_date", todayDate),
      supabase
        .from("procurement_logs")
        .select("id, supplier_name, quantity, rate_per_liter, total_cost, fat_percentage, snf_percentage, created_at")
        .eq("dairy_id", targetDairyId)
        .gte("created_at", startIso)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("amount, paid_at, created_at")
        .eq("dairy_id", targetDairyId)
        .eq("status", "PAID"),
    ]);

  if (totalAgents.error) throw totalAgents.error;
  if (dairyRow.error) throw dairyRow.error;
  if (suppliersRes.error) throw suppliersRes.error;
  if (deliveriesRes.error) throw deliveriesRes.error;
  if (procurementRes.error) throw procurementRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const deliveriesToday = deliveriesRes.data || [];
  const procurementToday = procurementRes.data || [];
  const paymentsToday = paymentsRes.data || [];

  const milkNeeded = deliveriesToday.reduce(
    (sum, delivery) => sum + Number(delivery.quantity_liters || 0),
    0
  );
  const pendingCount = deliveriesToday.filter(
    (delivery) => String(delivery.status || "").toUpperCase() === "PENDING"
  ).length;
  const failedCount = deliveriesToday.filter(
    (delivery) => String(delivery.status || "").toUpperCase() === "FAILED"
  ).length;
  const milkProcured = procurementToday.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const cashCollected = paymentsToday
    .filter((row) => isOnOrAfter(row.paid_at || row.created_at, startIso))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pendingPayments = 0;

  const finalResponse = {
    dairyName: dairyRow.data?.dairy_name || "My Dairy",
    totalCustomers: totalCustomers || 0,
    totalAgents: totalAgents.count || 0,
    activeAgents: totalAgents.count || 0,
    deliveriesToday: deliveriesToday.length,
    pendingPayments,
    suppliers: suppliersRes.data || [],
    stats: {
      total_milk: milkNeeded,
      procured_milk: milkProcured,
      collected: cashCollected,
      pending: pendingCount,
      failed: failedCount,
      pendingPayments,
    },
    procurementLogs: procurementToday,
    exceptions: [],
    riskData: [],
  };

  dashboardCache.set(cacheKey, { payload: finalResponse, at: now });
  return finalResponse;
};
