// Public admin customer operations: list/search customers, billing details,
// customer update/delete and subscription lifecycle management.

import { supabase } from "../../../config/supabase.js";
import {
  ONE_TIME_ORDER_MARKER,
  isDeliveredStatus,
  parseDeliveryBillingMeta,
  parseMonthlyBillMeta,
} from "../../customer/monthlyBilling.service.js";
import { upsertSubscription } from "../../customer/subscription.service.js";
import { encryptDeterministic, decryptDeterministic } from "../../../utils/crypto.js";
import { buildBillSectionRows } from "./billing.service.js";
import {
  formatMonthLabel,
  getBillIssueDate,
  getMonthKey,
  getOverdueDays,
  resolveWalletBalance,
  toNumber,
} from "./normalizers.js";
import { fetchRowsByCandidateCustomerColumns, getCustomerDetails } from "./queries.service.js";
import { assertCustomerBelongsToDairy } from "./validation.service.js";
import { resolveOrCreateCustomerHierarchy } from "../../propertyHierarchy/propertyHierarchy.service.js";

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
  const totalDue = Number(Math.max(0, grossPayable - walletBalance).toFixed(2));
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

export const updateCustomerById = async (customerId, updates, { dairyId = null } = {}) => {
  await assertCustomerBelongsToDairy(customerId, dairyId);

  // If hierarchy fields are provided, resolve or create hierarchy nodes
  let hierarchy = null;
  const hasHierarchyInput = Boolean(
    updates.property_id || updates.propertyId ||
    updates.property_name || updates.propertyName ||
    updates.building_id || updates.buildingId ||
    updates.building_name || updates.buildingName ||
    updates.floor_id || updates.floorId ||
    updates.floor_name || updates.floorName ||
    updates.unit_id || updates.unitId ||
    updates.unit_number || updates.unitNumber
  );

  if (hasHierarchyInput) {
    try {
      hierarchy = await resolveOrCreateCustomerHierarchy({
        propertyId: updates.property_id || updates.propertyId || null,
        propertyName: updates.property_name || updates.propertyName || "",
        buildingId: updates.building_id || updates.buildingId || null,
        buildingName: updates.building_name || updates.buildingName || "",
        hasWing: Boolean(
          (updates.has_wing ?? updates.hasWing) ??
          (updates.wing || updates.wing_name || updates.wingName)
        ),
        wingId: updates.wing_id || updates.wingId || null,
        wingName: updates.wing_name || updates.wingName || updates.wing || "",
        floorId: updates.floor_id || updates.floorId || null,
        floorName: updates.floor_name || updates.floorName || "",
        unitId: updates.unit_id || updates.unitId || null,
        unitType: updates.unit_type || updates.unitType || "Flat",
        unitNumber: updates.unit_number || updates.unitNumber || updates.room_no || updates.roomNo || "",
        address: [updates.address_line_1, updates.address_line_2].filter(Boolean).join(", "),
        dairyId,
      });
    } catch (hErr) {
      console.warn("Property hierarchy resolution in admin update fallback:", hErr?.message || hErr);
    }
  }

  const allowed = [
    "customer_name",
    "phone_number",
    "email",
    "building_name",
    "wing",
    "room_no",
    "address_line_1",
    "address_line_2",
    "latitude",
    "longitude",
    "property_id",
    "building_id",
    "wing_id",
    "floor_id",
    "unit_id",
    "property_name",
    "floor_name",
    "unit_type",
    "unit_number",
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

  // Dual-write hierarchy resolved attributes if resolved
  if (hierarchy) {
    if (hierarchy.propertyId) payload.property_id = hierarchy.propertyId;
    if (hierarchy.propertyName) payload.property_name = hierarchy.propertyName;
    if (hierarchy.buildingId) payload.building_id = hierarchy.buildingId;
    if (hierarchy.buildingName) {
      payload.building_name = hierarchy.buildingName;
    }
    payload.wing_id = hierarchy.wingId || null;
    payload.wing = hierarchy.wingName || null;
    if (hierarchy.floorId) payload.floor_id = hierarchy.floorId;
    if (hierarchy.floorName) payload.floor_name = hierarchy.floorName;
    if (hierarchy.unitId) payload.unit_id = hierarchy.unitId;
    if (hierarchy.unitType) payload.unit_type = hierarchy.unitType;
    if (hierarchy.unitNumber) {
      payload.unit_number = hierarchy.unitNumber;
      payload.room_no = hierarchy.unitNumber;
    }
  }

  let { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", customerId)
    .select("*")
    .single();

  // Graceful fallback if new hierarchy columns are missing in database
  if (error && (String(error.message).includes("column") || String(error.message).includes("does not exist"))) {
    console.warn("Retrying admin customer update without new hierarchy columns:", error.message);
    const legacyPayload = {};
    const legacyKeys = ["customer_name", "phone_number", "email", "building_name", "wing", "room_no", "address_line_1", "address_line_2", "latitude", "longitude"];
    legacyKeys.forEach((k) => {
      if (payload[k] !== undefined) legacyPayload[k] = payload[k];
    });
    const retry = await supabase.from("customers").update(legacyPayload).eq("id", customerId).select("*").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  if (data) {
    data.email = decryptDeterministic(data.email);
    data.phone_number = decryptDeterministic(data.phone_number);
  }

  return data;
};

export const deleteCustomerById = async (customerId, { dairyId = null } = {}) => {
  await assertCustomerBelongsToDairy(customerId, dairyId);
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

export const pauseCustomerSubscriptionById = async ({ customerId, dairyId, pausedFrom, pausedUntil }) => {
  if (!customerId) throw new Error("customerId is required");
  if (!dairyId) throw new Error("dairyId is required");

  const updateData = {
    status: "PAUSED",
    updated_at: new Date().toISOString(),
  };
  if (pausedFrom) updateData.paused_from = pausedFrom;
  if (pausedUntil) updateData.paused_until = pausedUntil;

  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("customer_id", customerId)
    .eq("dairy_id", dairyId)
    .neq("status", "CLOSED")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!updated) throw new Error("Subscription not found for this customer");
  return updated;
};

export const resumeCustomerSubscriptionById = async ({ customerId, dairyId }) => {
  if (!customerId) throw new Error("customerId is required");
  if (!dairyId) throw new Error("dairyId is required");

  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update({
      status: "ACTIVE",
      paused_from: null,
      paused_until: null,
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

export const cancelCustomerSubscriptionById = async ({ customerId, dairyId, cancelReason }) => {
  if (!customerId) throw new Error("customerId is required");
  if (!dairyId) throw new Error("dairyId is required");

  const updateData = {
    status: "CLOSED",
    updated_at: new Date().toISOString(),
  };
  if (cancelReason) updateData.cancel_reason = cancelReason;

  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("customer_id", customerId)
    .eq("dairy_id", dairyId)
    .neq("status", "CLOSED")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!updated) throw new Error("Subscription not found for this customer");
  return updated;
};
