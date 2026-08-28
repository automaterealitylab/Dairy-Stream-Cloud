import { supabase } from "../../config/supabase.js";
import {
  getCurrentIstDateTime,
  getInclusiveDaysDifference,
  isDeliveryDateCutoffPassed,
  MAX_CUSTOMER_PAUSE_DAYS,
} from "../../utils/cutoff.js";
import {
  ensureCustomerSubscriptionDeliveryForDate,
} from "./subscription.automation.service.js";
import {
  getCurrentMonthSuccessfulSubscriptionDue,
  getUnpaidDeliveredSubscriptionMonthlySummary,
} from "./monthlyBilling.service.js";
import { invalidateCustomerDashboardCache } from "./dashboardCache.service.js";

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("column")) ||
    message.includes("schema cache")
  );
};

const isSpecificMissingColumnError = (error, columnName) => {
  const message = String(error?.message || "").toLowerCase();
  return isMissingColumnError(error) && message.includes(String(columnName || "").toLowerCase());
};

const isOnConflictConstraintError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("no unique or exclusion constraint matching the on conflict specification");
};

const isUuidSyntaxError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("invalid input syntax for type uuid");
};

const isMissingTableError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("relation") && message.includes("does not exist");
};

const isActiveSubscriptionStatus = (status) => {
  const value = String(status || "ACTIVE").trim().toUpperCase();
  return value !== "CLOSED" && value !== "CANCELLED" && value !== "CANCELED";
};

const normalizeRouteValue = (value) => String(value || "").trim().toLowerCase();

const WEEKDAY_KEYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const normalizeDeliveryDays = (value) => {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => String(item || "").trim().toUpperCase())
    .filter((item) => WEEKDAY_KEYS.includes(item));
  return [...new Set(normalized)];
};

const findAutoAssignedAgentId = async ({ customerId, dairyId }) => {
  if (!customerId || !dairyId) return null;

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, building_name")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();

  if (customerError) {
    if (isMissingTableError(customerError) || isMissingColumnError(customerError) || isUuidSyntaxError(customerError)) {
      return null;
    }
    throw customerError;
  }

  const customerRoute = normalizeRouteValue(customer?.building_name);
  if (!customerRoute) return null;

  const { data: agents, error: agentError } = await supabase
    .from("agents")
    .select("id, building, status")
    .eq("dairy_id", dairyId)
    .order("id", { ascending: true });

  if (agentError) {
    if (isMissingTableError(agentError) || isMissingColumnError(agentError) || isUuidSyntaxError(agentError)) {
      return null;
    }
    throw agentError;
  }

  const matchedAgent = (agents || []).find((agent) => {
    const agentRoute = normalizeRouteValue(agent?.building);
    const agentStatus = String(agent?.status || "ACTIVE").trim().toUpperCase();
    return agentRoute === customerRoute && agentStatus !== "INACTIVE";
  });

  return matchedAgent?.id ?? null;
};

const ensureCustomerDairyAssignment = async ({ customerId, dairyId }) => {
  if (!customerId) return;

  const { error } = await supabase
    .from("customers")
    .update({ dairy_id: dairyId ?? null })
    .eq("id", customerId);

  if (!error) return;
  if (isMissingTableError(error) || isMissingColumnError(error) || isUuidSyntaxError(error)) {
    return;
  }
  throw error;
};

const ensureMembershipLink = async ({ customerId, dairyId }) => {
  if (!customerId || !dairyId) return;

  const idColumns = ["customer_id", "user_id", "customerid", "customerId"];

  for (const idColumn of idColumns) {
    const payload = { [idColumn]: customerId, dairy_id: dairyId };

    const { error: upsertError } = await supabase
      .from("memberships")
      .upsert(payload, { onConflict: `${idColumn},dairy_id` });

    if (!upsertError) return;

    // Legacy schema case: memberships uses UUID ids while app uses BIGINT ids.
    // Do not fail subscription save because membership sync is auxiliary.
    if (isUuidSyntaxError(upsertError)) {
      return;
    }

    if (isMissingColumnError(upsertError)) {
      continue;
    }

    if (isOnConflictConstraintError(upsertError)) {
      const { data: existing, error: selectError } = await supabase
        .from("memberships")
        .select("id")
        .eq(idColumn, customerId)
        .eq("dairy_id", dairyId)
        .limit(1)
        .maybeSingle();

      if (selectError && !isMissingColumnError(selectError)) {
        if (isUuidSyntaxError(selectError)) return;
        throw selectError;
      }

      if (existing) return;

      const { error: insertError } = await supabase
        .from("memberships")
        .insert(payload);

      if (!insertError) return;
      if (isUuidSyntaxError(insertError)) return;
      if (isMissingColumnError(insertError)) continue;
      throw insertError;
    }

    if (isUuidSyntaxError(upsertError)) return;
    throw upsertError;
  }
};

export const getSubscriptionByCustomerId = async (customerId) => {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    // Legacy-safe behavior: dashboard should still load even if subscriptions
    // table/columns/types are not yet aligned in an older database.
    if (
      isMissingTableError(error) ||
      isMissingColumnError(error) ||
      isUuidSyntaxError(error)
    ) {
      return null;
    }
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return null;

  const active = rows.find((row) => isActiveSubscriptionStatus(row?.status));
  return active || rows[0] || null;
};

export const upsertSubscription = async (customerId, payload) => {
  let resolvedApprovalStatus = payload.approval_status;
  let existingAssignedAgentId = null;
  if (!resolvedApprovalStatus) {
    const { data: existingApproval, error: existingApprovalError } = await supabase
      .from("subscriptions")
      .select("approval_status, assigned_agent_id")
      .eq("customer_id", customerId)
      .eq("dairy_id", payload.dairy_id)
      .limit(1)
      .maybeSingle();

    if (existingApprovalError) throw existingApprovalError;
    resolvedApprovalStatus = existingApproval?.approval_status || "PENDING";
    existingAssignedAgentId = existingApproval?.assigned_agent_id ?? null;
  }

  if (existingAssignedAgentId == null) {
    const { data: existingAssignment, error: existingAssignmentError } = await supabase
      .from("subscriptions")
      .select("assigned_agent_id")
      .eq("customer_id", customerId)
      .eq("dairy_id", payload.dairy_id)
      .limit(1)
      .maybeSingle();

    if (existingAssignmentError) throw existingAssignmentError;
    existingAssignedAgentId = existingAssignment?.assigned_agent_id ?? null;
  }

  let resolvedAssignedAgentId =
    payload.assigned_agent_id !== undefined ? payload.assigned_agent_id : existingAssignedAgentId;

  const normalizedStatus = String(payload.status || "ACTIVE").toUpperCase();
  const normalizedApprovalStatus = String(resolvedApprovalStatus || "PENDING").toUpperCase();

  if (
    (resolvedAssignedAgentId == null || resolvedAssignedAgentId === "") &&
    normalizedStatus === "ACTIVE" &&
    normalizedApprovalStatus === "APPROVED"
  ) {
    resolvedAssignedAgentId = await findAutoAssignedAgentId({
      customerId,
      dairyId: payload.dairy_id,
    });
  }

  const body = {
    customer_id: customerId,
    dairy_id: payload.dairy_id,
    milk_type: payload.milk_type,
    quantity_liters: payload.quantity_liters,
    delivery_slot: payload.delivery_slot,
    start_date: payload.start_date,
    address: payload.address,
    payment_method: payload.payment_method,
    status: payload.status || "ACTIVE",
    approval_status: normalizedApprovalStatus,
    assigned_agent_id: resolvedAssignedAgentId ?? null,
  };

  if (payload.delivery_days !== undefined) {
    body.delivery_days = normalizeDeliveryDays(payload.delivery_days);
  }

  const persistSubscriptionRow = async (candidateBody) => {
    let data;
    let error;

    ({ data, error } = await supabase
      .from("subscriptions")
      .upsert(candidateBody, { onConflict: "customer_id,dairy_id" })
      .select("*")
      .single());

    if (error && isOnConflictConstraintError(error)) {
      const { data: existing, error: existingError } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("customer_id", customerId)
        .eq("dairy_id", payload.dairy_id)
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { data: updated, error: updateError } = await supabase
          .from("subscriptions")
          .update(candidateBody)
          .eq("id", existing.id)
          .select("*")
          .single();

        if (updateError) throw updateError;
        data = updated;
        error = null;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("subscriptions")
          .insert(candidateBody)
          .select("*")
          .single();

        if (insertError) throw insertError;
        data = inserted;
        error = null;
      }
    }

    if (error) throw error;
    return data;
  };

  let data;
  try {
    data = await persistSubscriptionRow(body);
  } catch (error) {
    if (body.delivery_days !== undefined && isSpecificMissingColumnError(error, "delivery_days")) {
      const legacyBody = { ...body };
      delete legacyBody.delivery_days;
      data = await persistSubscriptionRow(legacyBody);
    } else {
      const message = String(error?.message || "").toLowerCase();
      if (message.includes("invalid input syntax for type uuid")) {
        throw new Error(
          "Database schema mismatch for subscriptions IDs. Run updated SUPABASE_MIGRATIONS.sql and ensure subscriptions.customer_id/dairy_id types match customers.id/dairies.id.",
          { cause: error }
        );
      }
      throw error;
    }
  }

  await ensureMembershipLink({
    customerId,
    dairyId: payload.dairy_id,
  });
  await ensureCustomerDairyAssignment({
    customerId,
    dairyId: payload.dairy_id,
  });

  if (
    String(data?.status || payload?.status || "ACTIVE").toUpperCase() === "ACTIVE" &&
    String(data?.approval_status || payload?.approval_status || "APPROVED").toUpperCase() === "APPROVED"
  ) {
    // Keep daily recurring delivery in sync whenever subscription becomes active.
    await ensureCustomerSubscriptionDeliveryForDate({ customerId });
  }

  invalidateCustomerDashboardCache(customerId);
  return data;
};

export const clearSubscriptionByCustomerId = async (customerId) => {
  const [unpaidSummary, currentMonthDue] = await Promise.all([
    getUnpaidDeliveredSubscriptionMonthlySummary(customerId),
    getCurrentMonthSuccessfulSubscriptionDue(customerId),
  ]);

  const runningDueAmount = Number(currentMonthDue?.payableTillDate || 0);
  if (unpaidSummary.unpaidCount > 0) {
    const error = new Error(
      `Please clear all pending monthly subscription dues before closing. Unpaid delivered entries: ${unpaidSummary.unpaidCount}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (runningDueAmount > 0) {
    const error = new Error(
      `Please pay your running subscription bill before closing. Current unpaid due: Rs.${runningDueAmount.toFixed(2)}`
    );
    error.statusCode = 400;
    throw error;
  }

  const { data: deletedRows, error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("customer_id", customerId)
    .select("dairy_id");

  if (error) throw error;

  const dairyIds = [...new Set((deletedRows || []).map((row) => row?.dairy_id).filter(Boolean))];
  if (dairyIds.length === 0) {
    await ensureCustomerDairyAssignment({
      customerId,
      dairyId: null,
    });
    return { deleted: 0 };
  }

  // Best-effort cleanup of membership links for removed subscription dairies.
  const idColumns = ["customer_id", "user_id", "customerid", "customerId"];
  for (const idColumn of idColumns) {
    const { error: membershipError } = await supabase
      .from("memberships")
      .delete()
      .eq(idColumn, customerId)
      .in("dairy_id", dairyIds);

    if (!membershipError) break;
    if (isMissingColumnError(membershipError) || isUuidSyntaxError(membershipError)) continue;
    if (isMissingTableError(membershipError)) break;
    // Membership cleanup is auxiliary; don't fail clear-subscription for this.
    console.warn("MEMBERSHIP CLEANUP WARNING:", membershipError.message);
    break;
  }

  await ensureCustomerDairyAssignment({
    customerId,
    dairyId: null,
  });

  invalidateCustomerDashboardCache(customerId);
  return { deleted: deletedRows.length };
};

export const notifyDairyAdmin = async ({ dairyId, title, message, type = "SYSTEM" }) => {
  if (!dairyId) return null;
  const payload = {
    dairy_id: Number(dairyId),
    title,
    message,
    type,
    is_read: false,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("admin_notifications")
      .insert([payload])
      .select("*")
      .maybeSingle();

    if (error) {
      const { data: fallback } = await supabase
        .from("dairy_notifications")
        .insert([payload])
        .select("*")
        .maybeSingle();
      return fallback;
    }
    return data;
  } catch (err) {
    console.warn("Could not insert admin notification:", err.message);
    return null;
  }
};

export const pauseCustomerSubscription = async (customerId, { dairyId, durationType, startDate, endDate }) => {
  if (!customerId) {
    const err = new Error("customerId is required");
    err.statusCode = 401;
    throw err;
  }

  let targetDairyId = dairyId;
  const existingSub = await getSubscriptionByCustomerId(customerId);
  if (!targetDairyId) {
    targetDairyId = existingSub?.dairy_id || existingSub?.dairyId;
  }
  if (!targetDairyId) {
    const err = new Error("dairyId is required to pause subscription");
    err.statusCode = 400;
    throw err;
  }

  const currentIst = getCurrentIstDateTime();
  let resolvedStartDate = startDate;
  let resolvedEndDate = endDate;

  if (!resolvedStartDate || !resolvedEndDate) {
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowIso = tomorrowObj.toISOString().slice(0, 10);
    resolvedStartDate = resolvedStartDate || tomorrowIso;

    if (durationType === "2_DAYS") {
      const endObj = new Date(tomorrowObj);
      endObj.setDate(endObj.getDate() + 1);
      resolvedEndDate = endObj.toISOString().slice(0, 10);
    } else if (durationType === "1_WEEK") {
      const endObj = new Date(tomorrowObj);
      endObj.setDate(endObj.getDate() + 6);
      resolvedEndDate = endObj.toISOString().slice(0, 10);
    } else {
      resolvedEndDate = resolvedEndDate || resolvedStartDate;
    }
  }

  const pauseDays = getInclusiveDaysDifference(resolvedStartDate, resolvedEndDate);
  if (pauseDays <= 0) {
    const err = new Error("Please select a valid pause period.");
    err.statusCode = 400;
    throw err;
  }

  if (pauseDays > MAX_CUSTOMER_PAUSE_DAYS) {
    const err = new Error(`Maximum pause duration from the customer portal is ${MAX_CUSTOMER_PAUSE_DAYS} days. For a pause longer than 15 days, please contact customer support.`);
    err.statusCode = 400;
    throw err;
  }

  // Enforce 10:00 PM IST previous day cutoff for start date
  if (isDeliveryDateCutoffPassed(resolvedStartDate, currentIst)) {
    const err = new Error("This delivery can no longer be changed because the 10:00 PM cutoff has passed.");
    err.statusCode = 409;
    throw err;
  }

  const updateData = {
    status: "PAUSED",
    paused_from: resolvedStartDate,
    paused_until: resolvedEndDate,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("customer_id", customerId)
    .eq("dairy_id", targetDairyId)
    .neq("status", "CLOSED")
    .select("*")
    .maybeSingle();

  if (error) throw error;

  // Reconcile deliveries in pause date range [resolvedStartDate, resolvedEndDate]
  const [y1, m1, d1] = resolvedStartDate.split("-").map(Number);
  const [y2, m2, d2] = resolvedEndDate.split("-").map(Number);
  const startUtc = new Date(Date.UTC(y1, m1 - 1, d1));
  const endUtc = new Date(Date.UTC(y2, m2 - 1, d2));

  for (let dt = new Date(startUtc); dt <= endUtc; dt.setUTCDate(dt.getUTCDate() + 1)) {
    const dateStr = dt.toISOString().slice(0, 10);
    // Do not touch dates where cutoff has passed
    if (isDeliveryDateCutoffPassed(dateStr, currentIst)) continue;

    const { data: existingDelivery } = await supabase
      .from("deliveries")
      .select("id, status")
      .eq("customer_id", customerId)
      .eq("delivery_date", dateStr)
      .maybeSingle();

    if (existingDelivery?.id) {
      const curStatus = String(existingDelivery.status || "").toUpperCase();
      if (curStatus === "PENDING" || curStatus === "SCHEDULED") {
        await supabase
          .from("deliveries")
          .update({ status: "PAUSED", updated_at: new Date().toISOString() })
          .eq("id", existingDelivery.id);
      }
    } else {
      await supabase.from("deliveries").insert({
        customer_id: customerId,
        dairy_id: targetDairyId,
        delivery_date: dateStr,
        milk_type: existingSub?.milk_type || "Milk",
        quantity_liters: existingSub?.quantity_liters || 1,
        status: "PAUSED",
        approval_status: "APPROVED",
        notes: `[SUBSCRIPTION_PAUSED] subscription_id=${existingSub?.id || ""}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  invalidateCustomerDashboardCache();

  await notifyDairyAdmin({
    dairyId: targetDairyId,
    title: "Subscription Paused",
    message: `Customer #${customerId} paused subscription from ${resolvedStartDate} to ${resolvedEndDate}.`,
    type: "SUBSCRIPTION_PAUSED",
  });

  return updated || existingSub;
};

export const resumeCustomerSubscription = async (customerId, { dairyId }) => {
  if (!customerId) {
    const err = new Error("customerId is required");
    err.statusCode = 401;
    throw err;
  }

  let targetDairyId = dairyId;
  const existingSub = await getSubscriptionByCustomerId(customerId);
  if (!targetDairyId) {
    targetDairyId = existingSub?.dairy_id || existingSub?.dairyId;
  }
  if (!targetDairyId) {
    const err = new Error("dairyId is required to resume subscription");
    err.statusCode = 400;
    throw err;
  }

  const currentIst = getCurrentIstDateTime();
  const pausedFrom = existingSub?.paused_from;
  const pausedUntil = existingSub?.paused_until;

  if (pausedFrom && pausedUntil) {
    const [y1, m1, d1] = pausedFrom.split("-").map(Number);
    const [y2, m2, d2] = pausedUntil.split("-").map(Number);
    const startUtc = new Date(Date.UTC(y1, m1 - 1, d1));
    const endUtc = new Date(Date.UTC(y2, m2 - 1, d2));

    for (let dt = new Date(startUtc); dt <= endUtc; dt.setUTCDate(dt.getUTCDate() + 1)) {
      const dateStr = dt.toISOString().slice(0, 10);
      // CRITICAL REQUIREMENT #10: DO NOT RESURRECT LOCKED DELIVERIES!
      if (isDeliveryDateCutoffPassed(dateStr, currentIst)) continue;

      const { data: existingDelivery } = await supabase
        .from("deliveries")
        .select("id, status")
        .eq("customer_id", customerId)
        .eq("delivery_date", dateStr)
        .maybeSingle();

      if (existingDelivery?.id) {
        const curStatus = String(existingDelivery.status || "").toUpperCase();
        if (curStatus === "PAUSED") {
          await supabase
            .from("deliveries")
            .update({ status: "PENDING", updated_at: new Date().toISOString() })
            .eq("id", existingDelivery.id);
        }
      }
    }
  }

  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update({
      status: "ACTIVE",
      paused_from: null,
      paused_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("customer_id", customerId)
    .eq("dairy_id", targetDairyId)
    .neq("status", "CLOSED")
    .select("*")
    .maybeSingle();

  if (error) throw error;

  invalidateCustomerDashboardCache();

  await notifyDairyAdmin({
    dairyId: targetDairyId,
    title: "Subscription Resumed",
    message: `Customer #${customerId} resumed daily deliveries.`,
    type: "SUBSCRIPTION_RESUMED",
  });

  return updated || existingSub;
};
