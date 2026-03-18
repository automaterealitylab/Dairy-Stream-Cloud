import { supabase } from "../../config/supabase.js";
import { upsertSubscription } from "../customer/subscription.service.js";

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
    query = query.or(
      `customer_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`
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
  const agentNameById = new Map();
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

  const enrichedCustomers = customers.map((row) => {
    const sub = latestSubscriptionByCustomer.get(row.id) || null;
    const approvalStatus = String(sub?.approval_status || "APPROVED").toUpperCase();
    const subscriptionStatus = String(sub?.status || "ACTIVE").toUpperCase();
    const assignedAgentId = sub?.assigned_agent_id || null;

    return {
      ...row,
      subscriptionId: sub?.id || null,
      subscriptionStatus,
      subscriptionApprovalStatus: approvalStatus,
      hasPendingSubscriptionApproval: approvalStatus === "PENDING",
      assignedSubscriptionAgentId: assignedAgentId,
      assignedSubscriptionAgentName: assignedAgentId ? (agentNameById.get(assignedAgentId) || null) : null,
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
  if (membership?.dairy_id) {
    const { data } = await supabase
      .from("dairies")
      .select("*")
      .eq("id", membership.dairy_id)
      .single();
    dairy = data;
  }

  return {
    customer,
    membership,
    dairy,
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
    if (updates[key] !== undefined) payload[key] = updates[key];
  }

  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", customerId)
    .select("*")
    .single();

  if (error) throw error;

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
