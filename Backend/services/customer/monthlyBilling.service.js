import { supabase } from "../../config/supabase.js";

export const MONTHLY_BILL_MARKER = "[MONTHLY_BILL]";
export const ONE_TIME_ORDER_MARKER = "[ONE_TIME_ORDER]";
export const ONE_TIME_PAYMENT_MARKER = "[ONE_TIME_PAYMENT]";
const SUBSCRIPTION_DELIVERY_PAYMENT_MARKER = "[SUBSCRIPTION_DELIVERY_PAYMENT]";

const normalizeDeliveryStatus = (status) => String(status || "").trim().toUpperCase();

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
};

const isMissingTableError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("relation") && message.includes("does not exist");
};

const isUuidSyntaxError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("invalid input syntax for type uuid");
};

const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const extractPaymentAmount = (row) =>
  toNumber(row?.amount ?? row?.total_amount ?? row?.total ?? row?.bill_amount ?? 0, 0);

export const getLocalTodayIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDateAsIso = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const isDeliveredStatus = (status) => {
  const value = normalizeDeliveryStatus(status);
  return value === "DELIVERED" || value === "COMPLETED";
};

const getMonthKey = (dateValue) => String(dateValue || "").slice(0, 7);

const getMonthEndDate = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return null;
  const [year, month] = String(monthKey).split("-").map(Number);
  const date = new Date(year, month, 0);
  return formatDateAsIso(date);
};

const getSubscriptionBillDueDate = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return null;
  const [year, month] = String(monthKey).split("-").map(Number);
  const date = new Date(year, month, 10);
  return formatDateAsIso(date);
};

const parseField = (text, field) => {
  const match = String(text || "").match(new RegExp(`${field}=([^;\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
};

const parseDeliveryIdFromPaymentDescription = (description) => {
  const match = String(description || "").match(/delivery_id=(\d+)/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const parseMonthlyBillMeta = (description) => {
  const text = String(description || "");
  if (!text.includes(MONTHLY_BILL_MARKER)) {
    return { isMonthlyBill: false, monthKey: null };
  }

  return {
    isMonthlyBill: true,
    monthKey: parseField(text, "month"),
    deliveredCount: toNumber(parseField(text, "deliveries"), 0),
    subscriptionCount: toNumber(parseField(text, "subscription"), 0),
  };
};

export const parseDeliveryBillingMeta = (notesValue) => {
  const notes = String(notesValue || "");
  return {
    paymentMethod: parseField(notes, "payment"),
    unitPrice: (() => {
      const parsed = Number(parseField(notes, "unit_price"));
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    })(),
  };
};

const isInstantOneTimePaymentMethod = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return (
    normalized === "PAY_NOW" ||
    normalized === "PAYNOW" ||
    normalized === "ONLINE" ||
    normalized === "ONLINE_PAYMENT" ||
    normalized === "UPI" ||
    normalized === "RAZORPAY"
  );
};

export const appendDeliveryBillingMeta = (notesValue, { paymentMethod, unitPrice } = {}) => {
  const notes = String(notesValue || "").trim();
  const hasPayment = /payment=/i.test(notes);
  const hasUnitPrice = /unit_price=/i.test(notes);
  const extras = [];

  if (!hasPayment && paymentMethod) {
    extras.push(`payment=${String(paymentMethod).trim().toUpperCase()}`);
  }
  if (!hasUnitPrice && Number.isFinite(Number(unitPrice))) {
    extras.push(`unit_price=${Number(unitPrice).toFixed(2)}`);
  }

  if (!extras.length) return notes;
  return notes ? `${notes}; ${extras.join("; ")}` : extras.join("; ");
};

const getProductRate = async ({ dairyId, milkType }, rateCache) => {
  const cacheKey = `${dairyId}:${String(milkType || "").trim().toLowerCase()}`;
  if (rateCache.has(cacheKey)) return rateCache.get(cacheKey);

  const { data, error } = await supabase
    .from("products")
    .select("rate_per_unit, is_active")
    .eq("dairy_id", dairyId)
    .ilike("name", String(milkType || "").trim())
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error) || isMissingColumnError(error) || isUuidSyntaxError(error)) {
      rateCache.set(cacheKey, null);
      return null;
    }
    throw error;
  }

  const rate = Number(data?.rate_per_unit);
  const resolved = Number.isFinite(rate) && rate >= 0 ? rate : null;
  rateCache.set(cacheKey, resolved);
  return resolved;
};

const resolveDeliveryAmount = async (delivery, rateCache) => {
  const quantity = Number(delivery?.quantity_liters || 0);
  const safeQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  if (safeQty <= 0) return 0;

  const notesMeta = parseDeliveryBillingMeta(delivery?.notes);
  const unitPrice =
    notesMeta.unitPrice ??
    (await getProductRate(
      {
        dairyId: delivery?.dairy_id,
        milkType: delivery?.milk_type || "Milk",
      },
      rateCache
    ));

  if (!Number.isFinite(unitPrice) || unitPrice < 0) return 0;
  return Number((safeQty * unitPrice).toFixed(2));
};

const fetchRowsByCandidateCustomerColumns = async ({
  table,
  customerId,
  select = "*",
  orderBy = [],
  limit = null,
}) => {
  const candidateCustomerColumns = ["customer_id", "user_id", "customerId", "customerid"];

  for (const customerColumn of candidateCustomerColumns) {
    let query = supabase.from(table).select(select).eq(customerColumn, customerId);

    for (const order of orderBy) {
      query = query.order(order.column, order.options || {});
    }

    if (limit != null) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (!error) {
      return Array.isArray(data) ? data : [];
    }

    if (isMissingTableError(error)) return [];
    if (isMissingColumnError(error) || isUuidSyntaxError(error)) continue;
    throw error;
  }

  return [];
};

const buildMonthlyBillDescription = ({ monthKey, deliveredCount, subscriptionCount }) =>
  `${MONTHLY_BILL_MARKER} month=${monthKey}; deliveries=${deliveredCount}; subscription=${subscriptionCount}`.slice(
    0,
    300
  );

const fetchSubscriptionPaymentMethods = async (customerId) => {
  const data = await fetchRowsByCandidateCustomerColumns({
    table: "subscriptions",
    customerId,
    select: "dairy_id, payment_method",
    orderBy: [
      { column: "updated_at", options: { ascending: false } },
      { column: "created_at", options: { ascending: false } },
    ],
    limit: 50,
  });

  return new Map((data || []).map((row) => [String(row?.dairy_id), row?.payment_method || "UPI"]));
};

const shouldCloseMonth = (monthKey, monthRows, todayIso) => {
  const currentMonthKey = getMonthKey(todayIso);
  const monthEndDate = getMonthEndDate(monthKey);
  if (!monthEndDate) return false;
  if (monthKey > currentMonthKey) return false;
  if (monthKey === currentMonthKey && todayIso !== monthEndDate) return false;

  const lastDayRows = monthRows.filter((row) => String(row?.delivery_date || "") === monthEndDate);
  if (lastDayRows.length === 0) {
    return monthKey < currentMonthKey || todayIso === monthEndDate;
  }

  return lastDayRows.every((row) => {
    const status = normalizeDeliveryStatus(row?.status);
    return status !== "PENDING" && status !== "PENDING_APPROVAL";
  });
};

const fetchCustomerDeliveries = async (customerId) => {
  return fetchRowsByCandidateCustomerColumns({
    table: "deliveries",
    customerId,
    select:
      "id, customer_id, dairy_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, created_at",
    orderBy: [{ column: "delivery_date", options: { ascending: false } }],
    limit: 2000,
  });
};

const fetchCustomerPayments = async (customerId) => {
  return fetchRowsByCandidateCustomerColumns({
    table: "payments",
    customerId,
    select: "*",
    orderBy: [{ column: "created_at", options: { ascending: false } }],
    limit: 1000,
  });
};

const buildSubscriptionPaymentAmountByDeliveryId = (paymentRows = []) => {
  const amountByDeliveryId = new Map();

  for (const row of paymentRows || []) {
    const description = String(row?.description || "");
    if (!description.includes(SUBSCRIPTION_DELIVERY_PAYMENT_MARKER)) continue;

    const deliveryId = parseDeliveryIdFromPaymentDescription(description);
    if (!deliveryId) continue;

    const amount = extractPaymentAmount(row);
    if (amount <= 0) continue;

    const existingAmount = toNumber(amountByDeliveryId.get(deliveryId), 0);
    if (amount > existingAmount) {
      amountByDeliveryId.set(deliveryId, amount);
    }
  }

  return amountByDeliveryId;
};

const resolveSubscriptionDeliveryAmount = async (
  delivery,
  rateCache,
  subscriptionPaymentAmountByDeliveryId
) => {
  const amountFromMetadata = await resolveDeliveryAmount(delivery, rateCache);
  if (amountFromMetadata > 0) return amountFromMetadata;

  const fallbackAmount = toNumber(
    subscriptionPaymentAmountByDeliveryId.get(Number(delivery?.id)),
    0
  );
  return fallbackAmount > 0 ? fallbackAmount : 0;
};

export const syncCustomerMonthlyBills = async (customerId) => {
  if (!customerId) return { synced: 0 };

  const [deliveries, paymentRows, paymentMethods] = await Promise.all([
    fetchCustomerDeliveries(customerId),
    fetchCustomerPayments(customerId),
    fetchSubscriptionPaymentMethods(customerId),
  ]);

  const todayIso = getLocalTodayIso();
  const rateCache = new Map();
  const subscriptionPaymentAmountByDeliveryId =
    buildSubscriptionPaymentAmountByDeliveryId(paymentRows);
  const groups = new Map();

  for (const row of deliveries) {
    const notes = String(row?.notes || "");
    if (notes.includes(ONE_TIME_ORDER_MARKER)) continue;

    const monthKey = getMonthKey(row?.delivery_date);
    if (!monthKey || !row?.dairy_id) continue;

    const groupKey = `${row.dairy_id}:${monthKey}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        dairyId: row.dairy_id,
        monthKey,
        monthRows: [],
        deliveredRows: [],
      });
    }

    const group = groups.get(groupKey);
    group.monthRows.push(row);
    if (isDeliveredStatus(row?.status)) {
      group.deliveredRows.push(row);
    }
  }

  const monthlyBillRows = (paymentRows || []).filter(
    (row) => parseMonthlyBillMeta(row?.description).isMonthlyBill
  );
  const existingByKey = new Map();
  for (const row of monthlyBillRows) {
    const meta = parseMonthlyBillMeta(row?.description);
    if (!meta.monthKey || !row?.dairy_id) continue;
    const groupKey = `${row.dairy_id}:${meta.monthKey}`;
    if (!existingByKey.has(groupKey)) {
      existingByKey.set(groupKey, []);
    }
    existingByKey.get(groupKey).push(row);
  }

  let synced = 0;

  for (const group of groups.values()) {
    if (!group.deliveredRows.length) continue;
    if (!shouldCloseMonth(group.monthKey, group.monthRows, todayIso)) continue;

    let totalAmount = 0;
    let subscriptionCount = 0;
    let paymentMethod = paymentMethods.get(String(group.dairyId)) || "UPI";

    for (const delivery of group.deliveredRows) {
      totalAmount += await resolveSubscriptionDeliveryAmount(
        delivery,
        rateCache,
        subscriptionPaymentAmountByDeliveryId
      );
      subscriptionCount += 1;

      const notesMeta = parseDeliveryBillingMeta(delivery?.notes);
      if (notesMeta.paymentMethod) {
        paymentMethod = notesMeta.paymentMethod;
      }
    }

    totalAmount = Number(totalAmount.toFixed(2));
    if (totalAmount <= 0) continue;

    const dueDate = getSubscriptionBillDueDate(group.monthKey);
    const description = buildMonthlyBillDescription({
      monthKey: group.monthKey,
      deliveredCount: group.deliveredRows.length,
      subscriptionCount,
    });

    const monthPayments = existingByKey.get(`${group.dairyId}:${group.monthKey}`) || [];
    const paidAmount = monthPayments.reduce((sum, row) => {
      const status = String(row?.status || "PENDING").toUpperCase();
      return status === "PAID" ? sum + extractPaymentAmount(row) : sum;
    }, 0);
    const existingOpenRow =
      monthPayments.find((row) => String(row?.status || "PENDING").toUpperCase() !== "PAID") ||
      null;
    const remainingAmount = Number(Math.max(0, totalAmount - paidAmount).toFixed(2));

    if (remainingAmount <= 0) continue;

    if (existingOpenRow?.id) {

      const { error: updateError } = await supabase
        .from("payments")
        .update({
          amount: remainingAmount,
          status: dueDate && dueDate < todayIso ? "OVERDUE" : "PENDING",
          method: String(paymentMethod || "UPI").trim().toUpperCase(),
          description,
          due_date: dueDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingOpenRow.id)
        .eq("customer_id", customerId);

      if (updateError) throw updateError;
      synced += 1;
      continue;
    }

    const { error: insertError } = await supabase.from("payments").insert({
      customer_id: customerId,
      dairy_id: group.dairyId,
      amount: remainingAmount,
      status: dueDate && dueDate < todayIso ? "OVERDUE" : "PENDING",
      method: String(paymentMethod || "UPI").trim().toUpperCase(),
      description,
      due_date: dueDate,
    });

    if (insertError) throw insertError;
    synced += 1;
  }

  return { synced };
};

export const getCurrentMonthSuccessfulSubscriptionDue = async (customerId) => {
  if (!customerId) return { payableTillDate: 0 };

  const [deliveries, paymentRows] = await Promise.all([
    fetchCustomerDeliveries(customerId),
    fetchCustomerPayments(customerId),
  ]);
  const todayIso = getLocalTodayIso();
  const currentMonthKey = getMonthKey(todayIso);
  const rateCache = new Map();
  const subscriptionPaymentAmountByDeliveryId =
    buildSubscriptionPaymentAmountByDeliveryId(paymentRows);

  let total = 0;
  for (const delivery of deliveries) {
    const notes = String(delivery?.notes || "");
    if (notes.includes(ONE_TIME_ORDER_MARKER)) continue;
    if (!isDeliveredStatus(delivery?.status)) continue;
    if (getMonthKey(delivery?.delivery_date) !== currentMonthKey) continue;
    if (String(delivery?.delivery_date || "") > todayIso) continue;

    total += await resolveSubscriptionDeliveryAmount(
      delivery,
      rateCache,
      subscriptionPaymentAmountByDeliveryId
    );
  }

  return {
    payableTillDate: Number(total.toFixed(2)),
  };
};

export const getUnpaidDeliveredSubscriptionMonthlySummary = async (customerId) => {
  if (!customerId) return { unpaidCount: 0, unpaidDeliveryIds: [] };

  await syncCustomerMonthlyBills(customerId);

  const [deliveries, paymentRows] = await Promise.all([
    fetchCustomerDeliveries(customerId),
    fetchCustomerPayments(customerId),
  ]);

  const todayIso = getLocalTodayIso();
  const paidStatusByGroup = new Map();
  for (const row of paymentRows) {
    const meta = parseMonthlyBillMeta(row?.description);
    if (!meta.isMonthlyBill || !meta.monthKey || !row?.dairy_id) continue;
    paidStatusByGroup.set(
      `${row.dairy_id}:${meta.monthKey}`,
      String(row?.status || "PENDING").toUpperCase()
    );
  }

  const unpaidDeliveryIds = [];
  for (const delivery of deliveries) {
    const notes = String(delivery?.notes || "");
    if (notes.includes(ONE_TIME_ORDER_MARKER)) continue;
    if (!isDeliveredStatus(delivery?.status)) continue;

    const monthKey = getMonthKey(delivery?.delivery_date);
    const monthEndDate = getMonthEndDate(monthKey);
    if (!monthKey || !monthEndDate) continue;
    if (monthEndDate >= todayIso) continue;

    const groupStatus = paidStatusByGroup.get(`${delivery.dairy_id}:${monthKey}`) || "PENDING";
    if (groupStatus !== "PAID") {
      const deliveryId = Number(delivery?.id);
      if (Number.isFinite(deliveryId) && deliveryId > 0) {
        unpaidDeliveryIds.push(deliveryId);
      }
    }
  }

  return {
    unpaidCount: unpaidDeliveryIds.length,
    unpaidDeliveryIds,
  };
};

export const ensureBuyOnceInvoiceForDeliveredOrder = async (delivery) => {
  if (!delivery?.id || !delivery?.customer_id || !delivery?.dairy_id) return null;

  const notes = String(delivery?.notes || "");
  if (!notes.includes(ONE_TIME_ORDER_MARKER)) return null;
  if (!isDeliveredStatus(delivery?.status)) return null;

  const descriptionPattern = `%delivery_id=${delivery.id}%`;
  const { data: existingPayment, error: existingError } = await supabase
    .from("payments")
    .select("id, status, method, amount")
    .eq("customer_id", delivery.customer_id)
    .eq("dairy_id", delivery.dairy_id)
    .ilike("description", descriptionPattern)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  const computedAmount = await resolveDeliveryAmount(delivery, new Map());
  const existingAmount = Number(existingPayment?.amount);
  const amount =
    computedAmount > 0
      ? computedAmount
      : Number.isFinite(existingAmount) && existingAmount > 0
      ? existingAmount
      : 0;
  const paymentMethod = parseDeliveryBillingMeta(notes).paymentMethod || null;
  const shouldAutoMarkPaid = isInstantOneTimePaymentMethod(paymentMethod);
  const description = `${ONE_TIME_PAYMENT_MARKER} delivery_id=${delivery.id}; product=${
    delivery.milk_type || "Milk"
  }; qty=${Number(delivery.quantity_liters || 0)}; date=${delivery.delivery_date || getLocalTodayIso()}`.slice(0, 300);

  if (existingPayment?.id) {
    const nextStatus =
      String(existingPayment.status || "").toUpperCase() === "PAID" || shouldAutoMarkPaid
        ? "PAID"
        : "PENDING";

    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update({
        amount,
        status: nextStatus,
        method: String(
          existingPayment.method || paymentMethod || (shouldAutoMarkPaid ? "PAY_NOW" : "COD")
        )
          .trim()
          .toUpperCase(),
        description,
        due_date: delivery.delivery_date || getLocalTodayIso(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingPayment.id)
      .eq("customer_id", delivery.customer_id)
      .select("*")
      .maybeSingle();

    if (updateError) throw updateError;
    return updatedPayment || existingPayment;
  }

  const { data: createdPayment, error: createError } = await supabase
    .from("payments")
    .insert({
      customer_id: delivery.customer_id,
      dairy_id: delivery.dairy_id,
      amount,
      status: shouldAutoMarkPaid ? "PAID" : "PENDING",
      method: String(paymentMethod || (shouldAutoMarkPaid ? "PAY_NOW" : "COD"))
        .trim()
        .toUpperCase(),
      description,
      due_date: delivery.delivery_date || getLocalTodayIso(),
    })
    .select("*")
    .maybeSingle();

  if (createError) throw createError;
  return createdPayment || null;
};

export const runMonthEndSubscriptionBillingForAllCustomers = async () => {
  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("customer_id")
    .limit(5000);

  if (error) throw error;

  const customerIds = [...new Set((subscriptions || []).map((row) => row?.customer_id).filter(Boolean))];
  let customers = 0;
  let bills = 0;

  for (const customerId of customerIds) {
    const result = await syncCustomerMonthlyBills(customerId);
    customers += 1;
    bills += Number(result?.synced || 0);
  }

  return {
    date: getLocalTodayIso(),
    customers,
    bills,
  };
};
