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

const parseDateSafe = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isAgentActive = (agent = {}) => {
  const status = normalizeStatus(agent.status || "ACTIVE");
  if (status !== "INACTIVE") return true;

  const inactiveUntilDate = parseDateSafe(agent.inactive_until);
  if (!inactiveUntilDate) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return inactiveUntilDate < todayStart;
};

const normalizeStatus = (value) => String(value || "").trim().toUpperCase();

const formatCustomerName = (customer = {}, fallbackId = "") =>
  customer?.customer_name ||
  customer?.name ||
  customer?.email ||
  (fallbackId ? `Customer #${fallbackId}` : "Customer");

const extractFailureReason = (notes = "") => {
  const failedReason = String(notes || "").match(/\[FAILED_REASON\]:\s*([^\n]+)/i)?.[1];
  return failedReason?.trim() || null;
};

const compactLiters = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0L";
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2).replace(/\.?0+$/, "")}L`;
};

const buildCustomerMap = async (customerIds = []) => {
  const ids = [...new Set(customerIds.filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_name, name, email, phone_number, phone, outstanding_balance, created_at")
    .in("id", ids);

  if (error) throw error;
  return new Map((data || []).map((row) => [row.id, row]));
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
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

  const [
    totalCustomers,
    totalAgents,
    dairyRow,
    suppliersRes,
    deliveriesRes,
    procurementRes,
    paidTodayRes,
    createdTodayWithoutPaidAtRes,
    pendingPaymentsRes,
    outstandingCustomersRes,
    exceptionDeliveriesRes,
    riskCustomersRes,
    riskPaymentsRes,
    riskDeliveriesRes,
    riskSubscriptionsRes,
    recentPaymentsRes,
    recentDeliveriesRes,
    recentCustomersRes,
  ] =
    await Promise.all([
      getActiveCustomerCountForDairy(targetDairyId),
      supabase
        .from("agents")
        .select("id, status, inactive_until", { count: "exact" })
        .eq("dairy_id", targetDairyId),
      supabase
        .from("dairies")
        .select("dairy_name, selected_plan")
        .eq("id", targetDairyId)
        .maybeSingle(),
      supabase.from("suppliers").select("id, name").eq("dairy_id", targetDairyId).eq("status", "ACTIVE"),
      supabase
        .from("deliveries")
        .select("id, quantity_liters, status")
        .eq("dairy_id", targetDairyId)
        .eq("delivery_date", todayDate),
      supabase
        .from("procurement_logs")
        .select("id, supplier_id, supplier_name, item_name, item_category, unit, quantity, rate_per_unit, rate_per_liter, total_cost, fat_percentage, snf_percentage, created_at")
        .eq("dairy_id", targetDairyId)
        .gte("created_at", startIso)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id, amount, paid_at, created_at")
        .eq("dairy_id", targetDairyId)
        .eq("status", "PAID")
        .gte("paid_at", startIso),
      supabase
        .from("payments")
        .select("id, amount, paid_at, created_at")
        .eq("dairy_id", targetDairyId)
        .eq("status", "PAID")
        .is("paid_at", null)
        .gte("created_at", startIso),
      supabase
        .from("payments")
        .select("id, customer_id, amount, status")
        .eq("dairy_id", targetDairyId)
        .in("status", ["PENDING", "OVERDUE"]),
      supabase
        .from("customers")
        .select("id, outstanding_balance")
        .eq("dairy_id", targetDairyId),
      supabase
        .from("deliveries")
        .select("id, customer_id, agent_id, quantity_liters, status, approval_status, customer_issue_text, customer_issue_status, customer_issue_reported_at, customer_issue_admin_action, notes, updated_at, created_at")
        .eq("dairy_id", targetDairyId)
        .eq("delivery_date", todayDate)
        .or("status.in.(FAILED,CANCELLED,CANCELED,SKIPPED,MISSED),customer_issue_status.in.(OPEN,PENDING,REPORTED)"),
      supabase
        .from("customers")
        .select("id, customer_name, name, email, outstanding_balance, created_at")
        .eq("dairy_id", targetDairyId),
      supabase
        .from("payments")
        .select("id, customer_id, status, amount, created_at, due_date")
        .eq("dairy_id", targetDairyId)
        .gte("created_at", thirtyDaysAgoIso),
      supabase
        .from("deliveries")
        .select("id, customer_id, status, customer_issue_status, created_at, updated_at")
        .eq("dairy_id", targetDairyId)
        .gte("created_at", thirtyDaysAgoIso),
      supabase
        .from("subscriptions")
        .select("id, customer_id, status, updated_at")
        .eq("dairy_id", targetDairyId)
        .gte("updated_at", thirtyDaysAgoIso),
      supabase
        .from("payments")
        .select("id, customer_id, amount, status, paid_at, created_at")
        .eq("dairy_id", targetDairyId)
        .eq("status", "PAID")
        .order("paid_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("deliveries")
        .select("id, customer_id, agent_id, quantity_liters, status, delivered_at, updated_at, created_at")
        .eq("dairy_id", targetDairyId)
        .in("status", ["DELIVERED", "COMPLETED", "FAILED", "CANCELLED", "CANCELED", "SKIPPED", "MISSED"])
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("customers")
        .select("id, customer_name, name, email, created_at")
        .eq("dairy_id", targetDairyId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  if (totalAgents.error) throw totalAgents.error;
  if (dairyRow.error) throw dairyRow.error;
  if (suppliersRes.error) throw suppliersRes.error;
  if (deliveriesRes.error) throw deliveriesRes.error;
  if (procurementRes.error) throw procurementRes.error;
  if (paidTodayRes.error) throw paidTodayRes.error;
  if (createdTodayWithoutPaidAtRes.error) throw createdTodayWithoutPaidAtRes.error;
  if (pendingPaymentsRes.error) throw pendingPaymentsRes.error;
  if (outstandingCustomersRes.error) throw outstandingCustomersRes.error;
  if (exceptionDeliveriesRes.error) throw exceptionDeliveriesRes.error;
  if (riskCustomersRes.error) throw riskCustomersRes.error;
  if (riskPaymentsRes.error) throw riskPaymentsRes.error;
  if (riskDeliveriesRes.error) throw riskDeliveriesRes.error;
  if (riskSubscriptionsRes.error) throw riskSubscriptionsRes.error;
  if (recentPaymentsRes.error) throw recentPaymentsRes.error;
  if (recentDeliveriesRes.error) throw recentDeliveriesRes.error;
  if (recentCustomersRes.error) throw recentCustomersRes.error;

  const deliveriesToday = deliveriesRes.data || [];
  const procurementToday = procurementRes.data || [];
  const paymentsToday = [
    ...(paidTodayRes.data || []),
    ...(createdTodayWithoutPaidAtRes.data || []),
  ];

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
  const milkProcured = procurementToday.reduce((sum, row) => {
    const category = String(row.item_category || "MILK").toUpperCase();
    return category === "MILK" ? sum + Number(row.quantity || 0) : sum;
  }, 0);
  const cashCollected = paymentsToday
    .filter((row) => isOnOrAfter(row.paid_at || row.created_at, startIso))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pendingPayments = (pendingPaymentsRes.data || []).reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
  const customerOutstanding = (outstandingCustomersRes.data || []).reduce(
    (sum, row) => sum + Math.max(0, Number(row.outstanding_balance || 0)),
    0
  );
  const outstanding = Math.max(customerOutstanding, pendingPayments);

  const dashboardCustomerIds = [
    ...(exceptionDeliveriesRes.data || []).map((row) => row.customer_id),
    ...(riskPaymentsRes.data || []).map((row) => row.customer_id),
    ...(riskDeliveriesRes.data || []).map((row) => row.customer_id),
    ...(riskSubscriptionsRes.data || []).map((row) => row.customer_id),
    ...(recentPaymentsRes.data || []).map((row) => row.customer_id),
    ...(recentDeliveriesRes.data || []).map((row) => row.customer_id),
    ...(recentCustomersRes.data || []).map((row) => row.id),
  ];
  const customersById = await buildCustomerMap(dashboardCustomerIds);

  const exceptions = (exceptionDeliveriesRes.data || []).map((row) => {
    const status = normalizeStatus(row.status);
    const issueStatus = normalizeStatus(row.customer_issue_status);
    const issueText = String(row.customer_issue_text || "").trim();
    const reason =
      issueText ||
      extractFailureReason(row.notes) ||
      (issueStatus && issueStatus !== "NONE" ? "Customer issue reported" : "Delivery failed");

    return {
      id: row.id,
      customer_id: row.customer_id,
      customer_name: formatCustomerName(customersById.get(row.customer_id), row.customer_id),
      agent_id: row.agent_id,
      quantity_liters: Number(row.quantity_liters || 0),
      status,
      reason,
      notes: row.notes || "",
      reported_at: row.customer_issue_reported_at || row.updated_at || row.created_at,
      issue_admin_action: row.customer_issue_admin_action || null,
    };
  });

  const riskByCustomer = new Map(
    (riskCustomersRes.data || []).map((customer) => [
      customer.id,
      {
        customer_id: customer.id,
        name: formatCustomerName(customer, customer.id),
        outstanding_balance: Number(customer.outstanding_balance || 0),
        failed_payments: 0,
        pauses: 0,
        complaints: 0,
      },
    ])
  );

  const ensureRisk = (customerId) => {
    if (!customerId) return null;
    if (!riskByCustomer.has(customerId)) {
      riskByCustomer.set(customerId, {
        customer_id: customerId,
        name: formatCustomerName(customersById.get(customerId), customerId),
        outstanding_balance: Number(customersById.get(customerId)?.outstanding_balance || 0),
        failed_payments: 0,
        pauses: 0,
        complaints: 0,
      });
    }
    return riskByCustomer.get(customerId);
  };

  for (const row of riskPaymentsRes.data || []) {
    const risk = ensureRisk(row.customer_id);
    if (!risk) continue;
    const status = normalizeStatus(row.status);
    if (["FAILED", "REJECTED", "OVERDUE"].includes(status)) risk.failed_payments += 1;
    if (status === "PENDING" && row.due_date && new Date(row.due_date) < startOfDay) {
      risk.failed_payments += 1;
    }
  }

  for (const row of riskDeliveriesRes.data || []) {
    const risk = ensureRisk(row.customer_id);
    if (!risk) continue;
    const status = normalizeStatus(row.status);
    const issueStatus = normalizeStatus(row.customer_issue_status);
    if (["FAILED", "CANCELLED", "CANCELED", "SKIPPED", "MISSED"].includes(status)) {
      risk.complaints += 1;
    }
    if (["OPEN", "PENDING", "REPORTED"].includes(issueStatus)) risk.complaints += 1;
  }

  for (const row of riskSubscriptionsRes.data || []) {
    const risk = ensureRisk(row.customer_id);
    if (!risk) continue;
    if (["PAUSED", "INACTIVE", "SUSPENDED"].includes(normalizeStatus(row.status))) {
      risk.pauses += 1;
    }
  }

  const riskData = [...riskByCustomer.values()]
    .map((risk) => ({
      ...risk,
      score:
        risk.failed_payments +
        risk.pauses * 0.5 +
        risk.complaints +
        (risk.outstanding_balance > 0 ? 1 : 0),
    }))
    .filter((risk) => risk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const recentActivity = [
    ...(recentPaymentsRes.data || []).map((row) => ({
      id: `payment-${row.id}`,
      type: "payment",
      title: "Payment received",
      desc: `${formatCustomerName(customersById.get(row.customer_id), row.customer_id)} · Rs ${Number(row.amount || 0).toLocaleString("en-IN")}`,
      at: row.paid_at || row.created_at,
    })),
    ...(recentDeliveriesRes.data || []).map((row) => {
      const status = normalizeStatus(row.status);
      const failed = ["FAILED", "CANCELLED", "CANCELED", "SKIPPED", "MISSED"].includes(status);
      return {
        id: `delivery-${row.id}`,
        type: failed ? "failed" : "route",
        title: failed ? "Delivery failed" : "Delivery completed",
        desc: `${formatCustomerName(customersById.get(row.customer_id), row.customer_id)} · ${compactLiters(row.quantity_liters)}`,
        at: row.delivered_at || row.updated_at || row.created_at,
      };
    }),
    ...(recentCustomersRes.data || []).map((row) => ({
      id: `customer-${row.id}`,
      type: "customer",
      title: "New customer",
      desc: `${formatCustomerName(row, row.id)} added`,
      at: row.created_at,
    })),
  ]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const finalResponse = {
    dairyName: dairyRow.data?.dairy_name || "My Dairy",
    selectedPlan: dairyRow.data?.selected_plan || "Free",
    totalCustomers: totalCustomers || 0,
    totalAgents: totalAgents.count || 0,
    activeAgents: (totalAgents.data || []).filter(isAgentActive).length,
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
      outstanding,
    },
    procurementLogs: procurementToday,
    exceptions,
    riskData,
    recentActivity,
  };

  dashboardCache.set(cacheKey, { payload: finalResponse, at: now });
  return finalResponse;
};
