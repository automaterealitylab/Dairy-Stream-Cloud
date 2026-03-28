import { supabase } from "../../config/supabase.js";
import { appendDeliveryBillingMeta } from "./monthlyBilling.service.js";

const SUBSCRIPTION_DELIVERY_MARKER = "[SUBSCRIPTION_DAILY]";
const ONE_TIME_ORDER_MARKER = "[ONE_TIME_ORDER]";
const SUBSCRIPTION_PAYMENT_MARKER = "[SUBSCRIPTION_DELIVERY_PAYMENT]";
const SUBSCRIPTION_SELECT_BASE =
  "id, customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, approval_status, assigned_agent_id, start_date, payment_method, updated_at, created_at";
const SUBSCRIPTION_SELECT_WITH_DELIVERY_DAYS = `${SUBSCRIPTION_SELECT_BASE}, delivery_days`;
const WEEKDAY_KEYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const getLocalTodayIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isValidDateString = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeSubscriptionStatus = (status) =>
  String(status || "ACTIVE").trim().toUpperCase();

const isDeliverableSubscription = (status, approvalStatus) =>
  normalizeSubscriptionStatus(status) === "ACTIVE" &&
  String(approvalStatus || "APPROVED").trim().toUpperCase() === "APPROVED";

const normalizeDeliveryStatus = (status) => String(status || "").trim().toUpperCase();

const normalizeDeliveryDays = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .map((item) => String(item || "").trim().toUpperCase())
        .filter((item) => WEEKDAY_KEYS.includes(item))
    )];
  }

  if (typeof value === "string" && value.trim()) {
    return [...new Set(
      value
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter((item) => WEEKDAY_KEYS.includes(item))
    )];
  }

  return [];
};

const getWeekdayForDate = (targetDate) => {
  if (!isValidDateString(targetDate)) return null;
  const dt = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return WEEKDAY_KEYS[dt.getDay()] || null;
};

const isDeliveredStatus = (status) => {
  const value = normalizeDeliveryStatus(status);
  return value === "DELIVERED" || value === "COMPLETED";
};

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("column")) ||
    message.includes("schema cache")
  );
};

const selectSubscriptionsWithSchemaFallback = async (buildQuery) => {
  let result = await buildQuery(SUBSCRIPTION_SELECT_WITH_DELIVERY_DAYS);

  if (result.error && isMissingColumnError(result.error)) {
    result = await buildQuery(SUBSCRIPTION_SELECT_BASE);
  }

  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data : [];
};

const appendAutoFailNote = (notesValue, reason = "Delivery auto-failed at end of day") => {
  const notes = String(notesValue || "").trim();
  const lines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("[AUTO_FAILED]:"));

  lines.push(`[AUTO_FAILED]: ${reason}`);
  return lines.join("\n");
};

const parseDeliveryIdFromPaymentDescription = (description) => {
  const text = String(description || "");
  const match = text.match(/delivery_id=(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const syncExistingSubscriptionDeliveryAgent = async ({ deliveryId, assignedAgentId }) => {
  const parsedDeliveryId = Number(deliveryId);
  const parsedAgentId = Number(assignedAgentId);

  if (!Number.isFinite(parsedDeliveryId) || parsedDeliveryId <= 0) return;
  if (!Number.isFinite(parsedAgentId) || parsedAgentId <= 0) return;

  const { error } = await supabase
    .from("deliveries")
    .update({
      agent_id: parsedAgentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedDeliveryId)
    .is("agent_id", null);

  if (error) throw error;
};

const getLatestDeliverableSubscription = async (customerId) => {
  const rows = await selectSubscriptionsWithSchemaFallback((selectClause) =>
    supabase
      .from("subscriptions")
      .select(selectClause)
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20)
  );

  return rows.find((row) => isDeliverableSubscription(row?.status, row?.approval_status)) || null;
};

const getProductRateForSubscription = async ({ dairyId, milkType }) => {
  if (!dairyId || !String(milkType || "").trim()) return null;

  const { data, error } = await supabase
    .from("products")
    .select("rate_per_unit, is_active")
    .eq("dairy_id", dairyId)
    .ilike("name", String(milkType).trim())
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) return null;
    throw error;
  }

  const rate = Number(data?.rate_per_unit);
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
};

const ensureSubscriptionDeliveryBillingMeta = async ({ delivery, paymentMethod }) => {
  if (!delivery?.id) {
    return { delivery, updated: false };
  }

  const unitPrice = await getProductRateForSubscription({
    dairyId: delivery?.dairy_id,
    milkType: delivery?.milk_type || "Milk",
  });
  const nextNotes = appendDeliveryBillingMeta(delivery?.notes, {
    paymentMethod,
    unitPrice,
  });
  const currentNotes = String(delivery?.notes || "").trim();

  if (nextNotes === currentNotes) {
    return { delivery, updated: false };
  }

  const { error } = await supabase
    .from("deliveries")
    .update({
      notes: nextNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.id);

  if (error) throw error;

  return {
    delivery: {
      ...delivery,
      notes: nextNotes,
    },
    updated: true,
  };
};

const ensurePaymentForDelivery = async ({ customerId, dairyId, delivery, paymentMethod }) => {
  if (!delivery?.id) return null;

  const { data: paymentRows, error: paymentFetchError } = await supabase
    .from("payments")
    .select("id, status, description")
    .eq("customer_id", customerId)
    .eq("dairy_id", dairyId)
    .ilike("description", `%delivery_id=${delivery.id}%`)
    .limit(10);

  if (paymentFetchError) throw paymentFetchError;
  if (Array.isArray(paymentRows) && paymentRows.length > 0) return paymentRows[0];

  const quantity = Number(delivery.quantity_liters || 0);
  const safeQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const rate = await getProductRateForSubscription({
    dairyId,
    milkType: delivery.milk_type || "Milk",
  });
  const amount = Number.isFinite(rate) ? Number((safeQty * rate).toFixed(2)) : 0;
  const computedStatus = amount > 0 ? "PENDING" : "PAID";
  const dueDate = delivery.delivery_date || getLocalTodayIso();

  const description = `${SUBSCRIPTION_PAYMENT_MARKER} delivery_id=${delivery.id}; milk=${
    delivery.milk_type || "Milk"
  }; qty=${safeQty}; date=${dueDate}`.slice(0, 300);

  const { data: createdPayment, error: createPaymentError } = await supabase
    .from("payments")
    .insert({
      customer_id: customerId,
      dairy_id: dairyId,
      amount,
      status: computedStatus,
      method: String(paymentMethod || "UPI").trim().toUpperCase(),
      description,
      due_date: dueDate,
    })
    .select("id, status, amount, due_date, description")
    .maybeSingle();

  if (createPaymentError) throw createPaymentError;
  return createdPayment || null;
};

const ensureDailyDeliveryForSubscription = async ({
  subscription,
  customerId,
  targetDate,
} = {}) => {
  if (!subscription?.dairy_id) {
    return { created: false, reason: "missing_dairy_id" };
  }
  if (!isValidDateString(targetDate)) {
    return { created: false, reason: "invalid_date" };
  }

  if (subscription?.start_date && String(subscription.start_date) > targetDate) {
    return { created: false, reason: "before_start_date" };
  }

  const targetWeekday = getWeekdayForDate(targetDate);
  const selectedDays = normalizeDeliveryDays(subscription?.delivery_days);
  if (selectedDays.length > 0 && (!targetWeekday || !selectedDays.includes(targetWeekday))) {
    return { created: false, reason: "weekday_not_selected" };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("deliveries")
    .select("id, customer_id, dairy_id, delivery_date, milk_type, quantity_liters, status, notes, agent_id")
    .eq("customer_id", customerId)
    .eq("dairy_id", subscription.dairy_id)
    .eq("delivery_date", targetDate)
    .limit(20);

  if (existingError) throw existingError;

  const existing = (existingRows || []).find((row) => {
    const notes = String(row?.notes || "");
    return !notes.includes(ONE_TIME_ORDER_MARKER);
  });

  if (existing) {
    if (!existing?.agent_id && subscription?.assigned_agent_id) {
      await syncExistingSubscriptionDeliveryAgent({
        deliveryId: existing.id,
        assignedAgentId: subscription.assigned_agent_id,
      });
    }

    await ensureSubscriptionDeliveryBillingMeta({
      delivery: existing,
      paymentMethod: subscription.payment_method,
    });
    return { created: false, reason: "already_exists", deliveryId: existing.id };
  }

  const baseDeliveryNotes = `${SUBSCRIPTION_DELIVERY_MARKER} subscription_id=${
    subscription.id
  }; slot=${subscription.delivery_slot || "-"}`.slice(0, 500);
  const unitPrice = await getProductRateForSubscription({
    dairyId: subscription.dairy_id,
    milkType: subscription.milk_type || "Milk",
  });
  const deliveryNotes = appendDeliveryBillingMeta(baseDeliveryNotes, {
    paymentMethod: subscription.payment_method,
    unitPrice,
  });

  const { data: createdDelivery, error: createDeliveryError } = await supabase
    .from("deliveries")
    .insert({
      customer_id: customerId,
      dairy_id: subscription.dairy_id,
      agent_id: subscription.assigned_agent_id ?? null,
      delivery_date: targetDate,
      milk_type: subscription.milk_type || "Milk",
      quantity_liters: subscription.quantity_liters ?? null,
      status: "PENDING",
      approval_status: "APPROVED",
      notes: deliveryNotes,
    })
    .select("id, customer_id, dairy_id, delivery_date, milk_type, quantity_liters, status, notes, agent_id")
    .maybeSingle();

  if (createDeliveryError) throw createDeliveryError;
  if (!createdDelivery) return { created: false, reason: "insert_failed" };

  return { created: true, deliveryId: createdDelivery.id };
};

export const ensureCustomerSubscriptionDeliveryForDate = async ({
  customerId,
  targetDate = getLocalTodayIso(),
} = {}) => {
  if (!customerId || !isValidDateString(targetDate)) {
    return { created: 0, skipped: true };
  }

  const subscription = await getLatestDeliverableSubscription(customerId);
  if (!subscription) return { created: 0, skipped: true };

  const result = await ensureDailyDeliveryForSubscription({
    subscription,
    customerId,
    targetDate,
  });

  return {
    created: result?.created ? 1 : 0,
    skipped: !result?.created,
    reason: result?.reason || null,
  };
};

export const ensureDeliveredSubscriptionPaymentsForCustomer = async (customerId) => {
  if (!customerId) return { ensured: 0 };

  const { data: deliveries, error: deliveryError } = await supabase
    .from("deliveries")
    .select("id, customer_id, dairy_id, delivery_date, milk_type, quantity_liters, status, notes")
    .eq("customer_id", customerId)
    .order("delivery_date", { ascending: false })
    .limit(500);

  if (deliveryError) throw deliveryError;

  const candidateRows = (deliveries || []).filter((row) => {
    const notes = String(row?.notes || "");
    if (notes.includes(ONE_TIME_ORDER_MARKER)) return false;
    return isDeliveredStatus(row?.status);
  });

  if (candidateRows.length === 0) return { ensured: 0 };

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("dairy_id, payment_method")
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (subscriptionError) throw subscriptionError;
  const paymentMethodByDairy = new Map(
    (subscriptions || []).map((row) => [row?.dairy_id, row?.payment_method || "UPI"])
  );

  let ensured = 0;
  for (const delivery of candidateRows) {
    const { updated } = await ensureSubscriptionDeliveryBillingMeta({
      delivery,
      paymentMethod: paymentMethodByDairy.get(delivery.dairy_id) || "UPI",
    });
    if (updated) ensured += 1;
  }

  return { ensured };
};

export const getUnpaidDeliveredSubscriptionPaymentSummary = async (customerId) => {
  if (!customerId) return { unpaidCount: 0, unpaidDeliveryIds: [] };

  const { data: deliveries, error: deliveryError } = await supabase
    .from("deliveries")
    .select("id, status, notes")
    .eq("customer_id", customerId)
    .order("delivery_date", { ascending: false })
    .limit(500);

  if (deliveryError) throw deliveryError;

  const deliveredRows = (deliveries || []).filter((row) => {
    const notes = String(row?.notes || "");
    if (notes.includes(ONE_TIME_ORDER_MARKER)) return false;
    return isDeliveredStatus(row?.status);
  });
  if (deliveredRows.length === 0) return { unpaidCount: 0, unpaidDeliveryIds: [] };

  const { data: payments, error: paymentError } = await supabase
    .from("payments")
    .select("id, status, description")
    .eq("customer_id", customerId)
    .limit(1000);

  if (paymentError) throw paymentError;

  const paymentStatusByDeliveryId = new Map();
  for (const row of payments || []) {
    const deliveryId = parseDeliveryIdFromPaymentDescription(row?.description);
    if (!deliveryId) continue;
    const status = String(row?.status || "PENDING").toUpperCase();
    const current = paymentStatusByDeliveryId.get(deliveryId);
    if (!current || current !== "PAID") {
      paymentStatusByDeliveryId.set(deliveryId, status);
    }
  }

  const unpaidDeliveryIds = deliveredRows
    .map((row) => Number(row?.id))
    .filter((id) => Number.isFinite(id) && id > 0)
    .filter((id) => String(paymentStatusByDeliveryId.get(id) || "PENDING").toUpperCase() !== "PAID");

  return {
    unpaidCount: unpaidDeliveryIds.length,
    unpaidDeliveryIds,
  };
};

export const runDailySubscriptionAutomationForAllCustomers = async ({
  targetDate = getLocalTodayIso(),
} = {}) => {
  if (!isValidDateString(targetDate)) {
    return { date: targetDate, createdCount: 0, skippedCount: 0 };
  }

  const subscriptions = await selectSubscriptionsWithSchemaFallback((selectClause) =>
    supabase
      .from("subscriptions")
      .select(selectClause)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000)
  );

  const latestByCustomer = new Map();
  for (const row of subscriptions || []) {
    const customerId = row?.customer_id;
    if (!customerId || latestByCustomer.has(customerId)) continue;
    latestByCustomer.set(customerId, row);
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const [customerId, sub] of latestByCustomer.entries()) {
    if (!isDeliverableSubscription(sub?.status, sub?.approval_status)) {
      skippedCount += 1;
      continue;
    }

    const result = await ensureDailyDeliveryForSubscription({
      subscription: sub,
      customerId,
      targetDate,
    });

    if (result?.created) createdCount += 1;
    else skippedCount += 1;
  }

  return { date: targetDate, createdCount, skippedCount };
};

export const autoFailPendingSubscriptionDeliveriesForDate = async ({
  targetDate = getLocalTodayIso(),
} = {}) => {
  if (!isValidDateString(targetDate)) {
    return { date: targetDate, failedCount: 0 };
  }

  const { data: deliveries, error } = await supabase
    .from("deliveries")
    .select("id, notes, status, delivery_date")
    .eq("delivery_date", targetDate)
    .eq("status", "PENDING")
    .limit(5000);

  if (error) throw error;

  const subscriptionRows = (deliveries || []).filter((row) => {
    const notes = String(row?.notes || "");
    return !notes.includes(ONE_TIME_ORDER_MARKER);
  });

  if (!subscriptionRows.length) {
    return { date: targetDate, failedCount: 0 };
  }

  let failedCount = 0;
  for (const row of subscriptionRows) {
    const { error: updateError } = await supabase
      .from("deliveries")
      .update({
        status: "FAILED",
        notes: appendAutoFailNote(row?.notes),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "PENDING");

    if (updateError) throw updateError;
    failedCount += 1;
  }

  return { date: targetDate, failedCount };
};
