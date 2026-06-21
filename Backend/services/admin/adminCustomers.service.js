import { supabase } from "../../config/supabase.js";
import { upsertSubscription } from "../customer/subscription.service.js";
import {
  ONE_TIME_ORDER_MARKER,
  isDeliveredStatus,
  parseDeliveryBillingMeta,
  parseMonthlyBillMeta,
} from "../customer/monthlyBilling.service.js";
import { encryptDeterministic, decryptDeterministic } from "../../utils/crypto.js";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveWalletBalance = (row) => {
  const walletBalance = toNumber(row?.wallet_balance, NaN);
  if (Number.isFinite(walletBalance)) return walletBalance;

  const camelWalletBalance = toNumber(row?.walletBalance, NaN);
  if (Number.isFinite(camelWalletBalance)) return camelWalletBalance;

  return 0;
};

const getMonthKey = (dateValue) => String(dateValue || "").slice(0, 7);

const formatMonthLabel = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return "Current Billing Period";
  const date = new Date(`${monthKey}-01T00:00:00`);
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const getOverdueDays = (dueDate) => {
  if (!dueDate) return 0;
  const due = new Date(`${String(dueDate).slice(0, 10)}T00:00:00`);
  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (Number.isNaN(due.getTime())) return 0;
  const diffMs = localToday.getTime() - due.getTime();
  return diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
};

const getBillIssueDate = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) {
    return new Date().toISOString().slice(0, 10);
  }
  const [year, month] = String(monthKey).split("-").map(Number);
  const issueDate = new Date(year, month, 1);
  return issueDate.toISOString().slice(0, 10);
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

    const message = String(error?.message || "").toLowerCase();
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    const isUuidTypeMismatch = message.includes("invalid input syntax for type uuid");
    const isMissingTable = message.includes("relation") && message.includes("does not exist");
    if (isMissingTable) return [];
    if (isMissingColumn || isUuidTypeMismatch) continue;
    throw error;
  }

  return [];
};

const getProductRate = async ({ dairyId, productName }, rateCache) => {
  const cacheKey = `${dairyId}:${String(productName || "").trim().toLowerCase()}`;
  if (rateCache.has(cacheKey)) return rateCache.get(cacheKey);

  const { data, error } = await supabase
    .from("products")
    .select("rate_per_unit, is_active")
    .eq("dairy_id", dairyId)
    .ilike("name", String(productName || "").trim())
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingTable = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingTable || isMissingColumn) {
      rateCache.set(cacheKey, null);
      return null;
    }
    throw error;
  }

  const rate = toNumber(data?.rate_per_unit, NaN);
  const resolvedRate = Number.isFinite(rate) && rate >= 0 ? rate : null;
  rateCache.set(cacheKey, resolvedRate);
  return resolvedRate;
};

const resolveDeliveryAmount = async (delivery, rateCache) => {
  const quantity = toNumber(delivery?.quantity_liters, 0);
  if (quantity <= 0) return 0;

  const notesMeta = parseDeliveryBillingMeta(delivery?.notes);
  const unitPrice =
    notesMeta.unitPrice ??
    (await getProductRate(
      {
        dairyId: delivery?.dairy_id,
        productName: delivery?.milk_type || "Milk",
      },
      rateCache
    ));

  if (!Number.isFinite(unitPrice) || unitPrice < 0) return 0;
  return Number((quantity * unitPrice).toFixed(2));
};

const buildBillSectionRows = async (deliveries = [], rateCache = new Map()) => {
  const grouped = new Map();

  for (const delivery of deliveries) {
    const productParts = [
      String(delivery?.milk_type || "Milk").trim() || "Milk",
      String(delivery?.delivery_slot || "").trim(),
    ].filter(Boolean);
    const product = productParts.join(" - ");
    const key = product.toLowerCase();
    const quantity = Number(toNumber(delivery?.quantity_liters, 0).toFixed(2));
    const amount = await resolveDeliveryAmount(delivery, rateCache);
    const notesMeta = parseDeliveryBillingMeta(delivery?.notes);

    if (!grouped.has(key)) {
      grouped.set(key, {
        product,
        daysSet: new Set(),
        totalQty: 0,
        amount: 0,
        unitPrices: [],
        firstDate: null,
        lastDate: null,
      });
    }

    const row = grouped.get(key);
    const deliveryDate = String(delivery?.delivery_date || "");
    if (deliveryDate) {
      row.daysSet.add(deliveryDate);
      if (!row.firstDate || deliveryDate < row.firstDate) {
        row.firstDate = deliveryDate;
      }
      if (!row.lastDate || deliveryDate > row.lastDate) {
        row.lastDate = deliveryDate;
      }
    }
    row.totalQty += quantity;
    row.amount += amount;
    if (Number.isFinite(notesMeta.unitPrice) && notesMeta.unitPrice >= 0) {
      row.unitPrices.push(notesMeta.unitPrice);
    }
  }

  return [...grouped.values()].map((row) => {
    const days = row.daysSet.size || 0;
    const totalQty = Number(row.totalQty.toFixed(2));
    const amount = Number(row.amount.toFixed(2));
    const avgQtyPerDay = days > 0 ? Number((totalQty / days).toFixed(2)) : totalQty;
    const derivedRate =
      row.unitPrices.length > 0
        ? Number((row.unitPrices.reduce((sum, value) => sum + value, 0) / row.unitPrices.length).toFixed(2))
        : totalQty > 0
        ? Number((amount / totalQty).toFixed(2))
        : 0;

    return {
      product: row.product,
      fromDate: row.firstDate,
      toDate: row.lastDate,
      qtyPerDay: avgQtyPerDay,
      days,
      totalQty,
      rate: derivedRate,
      amount,
    };
  });
};

export const getAdminCustomers = async ({
  page = 1,
  limit = 10,
  search = "",
  dairyId = null,
}) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const getActiveSubscribedCustomerIdsForDairy = async (targetDairyId) => {
    if (!targetDairyId) return null;

    const { data, error } = await supabase
      .from("subscriptions")
      .select("customer_id, status")
      .eq("dairy_id", targetDairyId);

    if (error) throw error;

    const ids = new Set(
      (data || [])
        .filter((row) => String(row?.status || "ACTIVE").toUpperCase() !== "CLOSED")
        .map((row) => row?.customer_id)
        .filter(Boolean)
    );

    return [...ids];
  };

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (dairyId) {
    const scopedCustomerIds = await getActiveSubscribedCustomerIdsForDairy(dairyId);
    if (!scopedCustomerIds || scopedCustomerIds.length === 0) {
      return {
        customers: [],
        total: 0,
        page,
        limit,
      };
    }
    query = query.in("id", scopedCustomerIds);
  }

  if (search) {
    const encryptedSearch = encryptDeterministic(search.trim());
    query = query.or(
      `customer_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%,phone_number.eq.${encryptedSearch},email.eq.${encryptedSearch}`
    );
  }

  const { data, error, count } = await query;

  if (error) throw error;

  const customers = Array.isArray(data) ? data : [];
  const customerIds = customers.map((row) => row?.id).filter(Boolean);

  let latestSubscriptionByCustomer = new Map();
  if (customerIds.length > 0) {
    let subQuery = supabase
      .from("subscriptions")
      .select(
        "id, customer_id, dairy_id, status, approval_status, assigned_agent_id, updated_at, created_at"
      )
      .in("customer_id", customerIds)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (dairyId) {
      subQuery = subQuery.eq("dairy_id", dairyId);
    }

    const { data: subRows, error: subError } = await subQuery;
    if (subError) throw subError;

    for (const row of subRows || []) {
      if (!row?.customer_id) continue;
      if (!latestSubscriptionByCustomer.has(row.customer_id)) {
        latestSubscriptionByCustomer.set(row.customer_id, row);
      }
    }
  }

  const assignedAgentIds = [...new Set(
    [...latestSubscriptionByCustomer.values()].map((row) => row?.assigned_agent_id).filter(Boolean)
  )];
  const dairyIds = [...new Set(
    [...latestSubscriptionByCustomer.values()].map((row) => row?.dairy_id).filter(Boolean)
  )];
  const agentNameById = new Map();
  const dairyNameById = new Map();
  if (assignedAgentIds.length > 0) {
    const { data: agentRows, error: agentErr } = await supabase
      .from("agents")
      .select("id, agent_name")
      .in("id", assignedAgentIds);
    if (agentErr) throw agentErr;
    for (const row of agentRows || []) {
      agentNameById.set(row.id, row.agent_name || `Agent #${row.id}`);
    }
  }

  if (dairyIds.length > 0) {
    const { data: dairyRows, error: dairyErr } = await supabase
      .from("dairies")
      .select("id, dairy_name")
      .in("id", dairyIds);
    if (dairyErr) throw dairyErr;
    for (const row of dairyRows || []) {
      dairyNameById.set(row.id, row.dairy_name || `Dairy #${row.id}`);
    }
  }

  const pendingAmountByCustomer = new Map();
  if (customerIds.length > 0) {
    let paymentQuery = supabase
      .from("payments")
      .select("customer_id, amount, status, dairy_id")
      .in("customer_id", customerIds)
      .in("status", ["PENDING", "OVERDUE"]);

    if (dairyId) {
      paymentQuery = paymentQuery.eq("dairy_id", dairyId);
    }

    const { data: paymentRows, error: paymentError } = await paymentQuery;
    if (paymentError) throw paymentError;

    for (const row of paymentRows || []) {
      if (!row?.customer_id) continue;
      const current = pendingAmountByCustomer.get(row.customer_id) || 0;
      pendingAmountByCustomer.set(
        row.customer_id,
        Number((current + toNumber(row.amount, 0)).toFixed(2))
      );
    }
  }

  const enrichedCustomers = customers.map((row) => {
    const decryptedRow = {
      ...row,
      email: decryptDeterministic(row.email),
      phone_number: decryptDeterministic(row.phone_number),
      phone: decryptDeterministic(row.phone || row.phone_number),
    };
    const sub = latestSubscriptionByCustomer.get(row.id) || null;
    const approvalStatus = String(sub?.approval_status || "APPROVED").toUpperCase();
    const subscriptionStatus = String(sub?.status || "ACTIVE").toUpperCase();
    const assignedAgentId = sub?.assigned_agent_id || null;
    const pendingAmount = pendingAmountByCustomer.get(row.id) || 0;
    const walletBalance = resolveWalletBalance(decryptedRow);
    const outstandingBalance = Number((pendingAmount - walletBalance).toFixed(2));

    return {
      ...decryptedRow,
      subscriptionId: sub?.id || null,
      subscriptionStatus,
      subscriptionApprovalStatus: approvalStatus,
      hasPendingSubscriptionApproval: approvalStatus === "PENDING",
      assignedSubscriptionAgentId: assignedAgentId,
      assignedSubscriptionAgentName: assignedAgentId ? (agentNameById.get(assignedAgentId) || null) : null,
      dairy_name: sub?.dairy_id ? (dairyNameById.get(sub.dairy_id) || null) : null,
      pendingAmount,
      walletBalance,
      outstanding_balance: outstandingBalance,
    };
  });

  return {
    customers: enrichedCustomers,
    total: count,
    page,
    limit,
  };
};

export const getCustomerDetails = async (customerId) => {
  // Customer
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (customerError) throw customerError;
  if (customer) {
    customer.email = decryptDeterministic(customer.email);
    customer.phone_number = decryptDeterministic(customer.phone_number);
    customer.phone = decryptDeterministic(customer.phone || customer.phone_number);
  }

  // Membership (supports multiple possible customer id column names)
  let membership = null;
  const membershipCustomerColumns = ["customer_id", "customerid", "customerId", "user_id"];
  for (const column of membershipCustomerColumns) {
    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .eq(column, customerId)
      .limit(1)
      .maybeSingle();

    if (!error) {
      membership = data ?? null;
      break;
    }

    const message = String(error.message || "").toLowerCase();
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    const isUuidTypeMismatch = message.includes("invalid input syntax for type uuid");
    if (!isMissingColumn && !isUuidTypeMismatch) throw error;
  }

  // Dairy
  let dairy = null;
  let subscription = null;
  let assignedAgent = null;

  const { data: subscriptionRow, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) throw subscriptionError;
  subscription = subscriptionRow ?? null;

  const dairyId = subscription?.dairy_id || membership?.dairy_id || null;

  if (dairyId) {
    const { data } = await supabase
      .from("dairies")
      .select("*")
      .eq("id", dairyId)
      .single();
    if (data) {
      data.dairy_phone = decryptDeterministic(data.dairy_phone);
      data.dairy_email = decryptDeterministic(data.dairy_email);
      data.phone = decryptDeterministic(data.phone);
      data.email = decryptDeterministic(data.email);
      data.bank_ifsc_code = decryptDeterministic(data.bank_ifsc_code);
      data.ifsc = decryptDeterministic(data.ifsc);
      data.pan = decryptDeterministic(data.pan);
      data.bank_branch = decryptDeterministic(data.bank_branch);
    }
    dairy = data;
  }

  if (subscription?.assigned_agent_id) {
    const { data: agentData, error: agentError } = await supabase
      .from("agents")
      .select("id, agent_name, phone_number")
      .eq("id", subscription.assigned_agent_id)
      .maybeSingle();

    if (agentError) throw agentError;
    if (agentData) {
      agentData.phone_number = decryptDeterministic(agentData.phone_number);
    }
    assignedAgent = agentData ?? null;
  }

  return {
    customer,
    membership,
    subscription,
    assignedAgent,
    dairy,
  };
};

export const getCustomerBillDetails = async ({ customerId, dairyId = null }) => {
  if (!customerId) throw new Error("customerId is required");

  const [customerDetail, paymentRows, deliveryRows] = await Promise.all([
    getCustomerDetails(customerId),
    fetchRowsByCandidateCustomerColumns({
      table: "payments",
      customerId,
      select: "*",
      orderBy: [
        { column: "due_date", options: { ascending: false, nullsFirst: false } },
        { column: "created_at", options: { ascending: false } },
      ],
      limit: 1000,
    }),
    fetchRowsByCandidateCustomerColumns({
      table: "deliveries",
      customerId,
      select:
        "id, customer_id, dairy_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, created_at",
      orderBy: [{ column: "delivery_date", options: { ascending: false } }],
      limit: 2000,
    }),
  ]);

  const customer = customerDetail?.customer || null;
  const subscription = customerDetail?.subscription || null;
  const dairy = customerDetail?.dairy || null;
  const effectiveDairyId = dairyId || subscription?.dairy_id || dairy?.id || null;
  const scopedPayments = (paymentRows || []).filter(
    (row) => !effectiveDairyId || String(row?.dairy_id) === String(effectiveDairyId)
  );
  const openPayments = scopedPayments.filter((row) => {
    const status = String(row?.status || "").toUpperCase();
    return status !== "PAID" && status !== "CANCELLED" && status !== "CANCELED";
  });

  const monthlyPayments = scopedPayments.filter((row) => parseMonthlyBillMeta(row?.description).isMonthlyBill);
  const openMonthlyPayments = monthlyPayments.filter(
    (row) => String(row?.status || "").toUpperCase() !== "PAID"
  );

  const referencePayment = openMonthlyPayments[0] || monthlyPayments[0] || null;
  const paymentMeta = parseMonthlyBillMeta(referencePayment?.description);
  const billingMonthKey = paymentMeta?.monthKey || getMonthKey(new Date().toISOString());
  const billingPeriod = formatMonthLabel(billingMonthKey);

  const scopedDeliveries = (deliveryRows || []).filter((row) => {
    if (!isDeliveredStatus(row?.status)) return false;
    if (effectiveDairyId && String(row?.dairy_id) !== String(effectiveDairyId)) return false;
    if (getMonthKey(row?.delivery_date) !== billingMonthKey) return false;
    return true;
  });

  const subscriptionDeliveries = scopedDeliveries.filter(
    (row) => !String(row?.notes || "").includes(ONE_TIME_ORDER_MARKER)
  );
  const otherProductDeliveries = scopedDeliveries.filter((row) => {
    const notes = String(row?.notes || "");
    if (!notes.includes(ONE_TIME_ORDER_MARKER)) return false;
    return String(parseDeliveryBillingMeta(notes).paymentMethod || "").toUpperCase() === "MONTHLY_BILL";
  });

  const rateCache = new Map();
  const [subscriptionRows, otherProductRows] = await Promise.all([
    buildBillSectionRows(subscriptionDeliveries, rateCache),
    buildBillSectionRows(otherProductDeliveries, rateCache),
  ]);

  const subscriptionTotal = Number(
    subscriptionRows.reduce((sum, row) => sum + toNumber(row.amount, 0), 0).toFixed(2)
  );
  const otherProductsTotal = Number(
    otherProductRows.reduce((sum, row) => sum + toNumber(row.amount, 0), 0).toFixed(2)
  );
  const sectionSubtotal = Number((subscriptionTotal + otherProductsTotal).toFixed(2));
  const currentBillAmount = sectionSubtotal;
  const previousDueAmount = Number(
    openPayments
      .filter((row) => {
        if (!referencePayment?.id) return true;
        return String(row?.id) !== String(referencePayment.id);
      })
      .reduce((sum, row) => sum + toNumber(row?.amount, 0), 0)
      .toFixed(2)
  );
  const grossPayable = Number((currentBillAmount + previousDueAmount).toFixed(2));
  const walletBalance = resolveWalletBalance(customer);
  const totalDue = Number(Math.max(0, grossPayable - totalDue).toFixed(2));
  const creditAdjustmentAmount = Number(Math.max(0, grossPayable - totalDue).toFixed(2));
  const paymentStatus = String(referencePayment?.status || "PENDING").toUpperCase();
  const overdueDays = getOverdueDays(referencePayment?.due_date);

  return {
    customer,
    subscription,
    dairy,
    billing: {
      billNo: referencePayment?.id ? `B-${referencePayment.id}` : `B-${customerId}-${billingMonthKey.replace("-", "")}`,
      billingMonthKey,
      billingPeriod,
      billDate: getBillIssueDate(billingMonthKey),
      dueDate: referencePayment?.due_date || null,
      paymentId: referencePayment?.id || null,
      paymentStatus,
      isOverdue: false,
      overdueDays: 0,
      overdueAmount: 0,
      amountDue: totalDue,
      billedAmount: currentBillAmount,
      previousDueAmount: Number(previousDueAmount.toFixed(2)),
      creditAdjustmentAmount: Number(creditAdjustmentAmount.toFixed(2)),
      sectionSubtotal,
      adjustmentAmount: Number((grossPayable - totalDue).toFixed(2)),
      subscriptionRows,
      otherProductRows,
      subscriptionTotal,
      otherProductsTotal,
    },
  };
};

export const updateCustomerById = async (customerId, updates) => {
  const allowed = [
    "customer_name",
    "phone_number",
    "email",
    "building_name",
    "wing",
    "room_no",
  ];

  const payload = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (key === "email" || key === "phone_number") {
        payload[key] = encryptDeterministic(updates[key]);
      } else {
        payload[key] = updates[key];
      }
    }
  }

  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", customerId)
    .select("*")
    .single();

  if (error) throw error;
  if (data) {
    data.email = decryptDeterministic(data.email);
    data.phone_number = decryptDeterministic(data.phone_number);
  }

  return data;
};

export const deleteCustomerById = async (customerId) => {
  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) throw error;
  return { success: true };
};

export const upsertAdminCustomerSubscriptionById = async ({
  customerId,
  dairyId,
  milkType,
  quantity,
  slot,
  startDate,
  address,
  paymentMethod,
  deliveryDays,
  status,
  approvalStatus,
  assignedAgentId,
}) => {
  if (!customerId) throw new Error("customerId is required");
  if (!dairyId) throw new Error("dairyId is required");

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError) throw customerError;
  if (!customer) throw new Error("Customer not found");

  const subscription = await upsertSubscription(customerId, {
    dairy_id: dairyId,
    milk_type: milkType || "Buffalo Milk",
    quantity_liters: Number(quantity || 1),
    delivery_slot: slot || "Morning",
    start_date: startDate || undefined,
    address: address || "",
    payment_method: paymentMethod || "UPI",
    delivery_days: deliveryDays,
    status: (status || "ACTIVE").toUpperCase(),
    approval_status: (approvalStatus || "APPROVED").toUpperCase(),
    assigned_agent_id: assignedAgentId ? Number(assignedAgentId) : null,
  });

  return subscription;
};

export const approveCustomerSubscriptionById = async ({ customerId, dairyId }) => {
  if (!customerId) throw new Error("customerId is required");
  if (!dairyId) throw new Error("dairyId is required");

  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update({
      approval_status: "APPROVED",
      status: "ACTIVE",
      updated_at: new Date().toISOString(),
    })
    .eq("customer_id", customerId)
    .eq("dairy_id", dairyId)
    .neq("status", "CLOSED")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!updated) throw new Error("Subscription not found for this customer");
  return updated;
};

export const assignPermanentDeliveryPartnerByCustomerId = async ({
  customerId,
  dairyId,
  agentId,
}) => {
  if (!customerId) throw new Error("customerId is required");
  if (!dairyId) throw new Error("dairyId is required");
  const parsedAgentId = Number(agentId);
  if (!Number.isFinite(parsedAgentId) || parsedAgentId <= 0) {
    throw new Error("Valid agentId is required");
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id")
    .eq("id", parsedAgentId)
    .eq("dairy_id", dairyId)
    .maybeSingle();
  if (agentError) throw agentError;
  if (!agent) throw new Error("Selected agent is not valid for this dairy");

  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update({
      assigned_agent_id: parsedAgentId,
      approval_status: "APPROVED",
      status: "ACTIVE",
      updated_at: new Date().toISOString(),
    })
    .eq("customer_id", customerId)
    .eq("dairy_id", dairyId)
    .neq("status", "CLOSED")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!updated) throw new Error("Subscription not found for this customer");
  return updated;
};
