import { supabase } from "../../config/supabase.js";
import { sendEmail } from "../../utils/email.js";

const MAX_LIMIT = 2000;
const DEFAULT_LIMIT = 1000;

const toIntegerOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

const makeError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const isSubscriptionActive = (status) => {
  const value = String(status || "ACTIVE").toUpperCase();
  return value !== "CLOSED" && value !== "CANCELLED" && value !== "CANCELED";
};

const isValidDateString = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
};

const hasEmailConfig = () =>
  Boolean(process.env.EMAIL_USER) && Boolean(process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD);

const normalizeStatus = (status) => {
  const value = String(status || "").trim().toUpperCase();
  if (value === "DELIVERED" || value === "COMPLETED") return "DELIVERED";
  if (
    value === "FAILED" ||
    value === "CANCELLED" ||
    value === "CANCELED" ||
    value === "SKIPPED" ||
    value === "MISSED"
  ) {
    return "FAILED";
  }
  return "PENDING";
};

const normalizeApprovalStatus = (value, { isOneTimeOrder = false } = {}) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "PENDING") return "PENDING";
  return isOneTimeOrder ? "PENDING" : "APPROVED";
};

const formatQuantity = (value) => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return "-";
  const compact = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(2).replace(/\.?0+$/, "");
  return `${compact}L`;
};

const normalizeDate = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const resolveLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
};

const pickLatestSubscriptionByCustomer = (subscriptions, dairyId, { activeOnly = true } = {}) => {
  const byCustomer = new Map();
  const sortedRows = [...(subscriptions || [])].sort((a, b) => {
    const left = new Date(a?.updated_at || a?.created_at || 0).getTime();
    const right = new Date(b?.updated_at || b?.created_at || 0).getTime();
    return right - left;
  });

  for (const row of sortedRows) {
    const customerId = row?.customer_id;
    if (!customerId || byCustomer.has(customerId)) continue;
    if (dairyId && row?.dairy_id && Number(row.dairy_id) !== Number(dairyId)) continue;

    if (activeOnly && !isSubscriptionActive(row?.status)) continue;

    byCustomer.set(customerId, row);
  }

  return byCustomer;
};

const getCustomerAndAgentMaps = async ({ customerIds, agentIds }) => {
  const [customersResp, agentsResp] = await Promise.all([
    customerIds.length > 0
      ? supabase
          .from("customers")
          .select("id, customer_name, building_name")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    agentIds.length > 0
      ? supabase
          .from("agents")
          .select("id, agent_name, building")
          .in("id", agentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customersResp.error) throw customersResp.error;
  if (agentsResp.error) throw agentsResp.error;

  return {
    customersById: new Map((customersResp.data || []).map((row) => [row.id, row])),
    agentsById: new Map((agentsResp.data || []).map((row) => [row.id, row])),
  };
};

const getSubscriptionMapForCustomers = async ({ customerIds, dairyId }) => {
  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    return new Map();
  }

  let query = supabase
    .from("subscriptions")
    .select(
      "customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, created_at, updated_at"
    )
    .in("customer_id", customerIds);

  if (dairyId) {
    query = query.eq("dairy_id", dairyId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return pickLatestSubscriptionByCustomer(data || [], dairyId, { activeOnly: true });
};

const mapDeliveries = ({ deliveries, customersById, agentsById, subscriptionByCustomer }) => {
  return (deliveries || []).map((row) => {
    const customer = customersById.get(row.customer_id) || {};
    const agent = agentsById.get(row.agent_id) || {};
    const subscription = subscriptionByCustomer.get(row.customer_id) || {};

    const quantity = row.quantity_liters ?? subscription.quantity_liters ?? null;
    const route = customer.building_name || agent.building || "-";
    const notes = String(row.notes || "");
    const isOneTimeOrder = notes.includes("[ONE_TIME_ORDER]");
    const approvalStatus = normalizeApprovalStatus(row.approval_status, { isOneTimeOrder });

    return {
      id: row.id != null ? `DLV-${row.id}` : "DLV-NA",
      rawId: row.id ?? null,
      agentId: row.agent_id ?? null,
      customerName: customer.customer_name || `Customer #${row.customer_id ?? "-"}`,
      agentName: agent.agent_name || "Unassigned",
      route,
      quantity: formatQuantity(quantity),
      date: normalizeDate(row.delivery_date || row.created_at),
      slot: subscription.delivery_slot || "-",
      status: normalizeStatus(row.status),
      isOneTimeOrder,
      approvalStatus,
      needsApproval: approvalStatus === "PENDING",
      isAssigned: row.agent_id != null,
    };
  });
};

const getAgentAvailabilityMap = async ({ agentIds = [], deliveryDate }) => {
  const ids = [...new Set((agentIds || []).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const targetDate = normalizeDate(deliveryDate) || normalizeDate(new Date());
  const { data, error } = await supabase
    .from("deliveries")
    .select("agent_id, status, delivery_date")
    .in("agent_id", ids)
    .eq("delivery_date", targetDate);

  if (error) throw error;

  const availabilityMap = new Map();
  for (const id of ids) {
    availabilityMap.set(id, {
      assignedCount: 0,
      availability: "AVAILABLE",
    });
  }

  for (const row of data || []) {
    const agentId = row?.agent_id;
    if (!agentId || !availabilityMap.has(agentId)) continue;

    const current = availabilityMap.get(agentId);
    const status = String(row?.status || "").toUpperCase();
    const isOpenDelivery = status === "PENDING" || status === "PENDING_APPROVAL";
    const nextCount = current.assignedCount + (isOpenDelivery ? 1 : 0);

    availabilityMap.set(agentId, {
      assignedCount: nextCount,
      availability: nextCount > 0 ? "BUSY" : "AVAILABLE",
    });
  }

  return availabilityMap;
};

const getDairyNameById = async (dairyId) => {
  if (!dairyId) return "Dairy";
  const { data, error } = await supabase
    .from("dairies")
    .select("dairy_name")
    .eq("id", dairyId)
    .limit(1)
    .maybeSingle();
  if (error) return "Dairy";
  return data?.dairy_name || "Dairy";
};

const sendScheduledDeliveryAlert = async ({
  email,
  customerName,
  dairyName,
  deliveryDate,
  quantityLiters,
  milkType,
  slot,
}) => {
  if (!email || !hasEmailConfig()) return;

  const quantityLabel =
    quantityLiters == null || Number.isNaN(Number(quantityLiters))
      ? "-"
      : `${Number(quantityLiters)} L`;

  const formattedDate = normalizeDate(deliveryDate) || deliveryDate;

  try {
    await sendEmail({
      to: email,
      subject: `Delivery Scheduled for ${formattedDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2 style="margin-bottom: 8px;">Delivery Scheduled</h2>
          <p>Hello ${customerName || "Customer"},</p>
          <p>Your milk delivery has been scheduled by ${dairyName || "your dairy"}.</p>
          <ul>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Milk:</strong> ${milkType || "Milk"}</li>
            <li><strong>Quantity:</strong> ${quantityLabel}</li>
            <li><strong>Slot:</strong> ${slot || "-"}</li>
          </ul>
          <p>Please open your dashboard to track delivery updates.</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn("DELIVERY ALERT EMAIL WARNING:", err?.message || err);
  }
};

export const getAdminDeliveries = async ({ dairyId = null, limit } = {}) => {
  const resolvedLimit = resolveLimit(limit);

  let deliveriesQuery = supabase
    .from("deliveries")
    .select(
      "id, customer_id, dairy_id, agent_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, created_at"
    )
    .order("delivery_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(resolvedLimit);

  if (dairyId) {
    deliveriesQuery = deliveriesQuery.eq("dairy_id", dairyId);
  }

  const { data: deliveries, error: deliveriesError } = await deliveriesQuery;
  if (deliveriesError) throw deliveriesError;

  if (!Array.isArray(deliveries) || deliveries.length === 0) {
    return { deliveries: [] };
  }

  const customerIds = [...new Set(deliveries.map((row) => row.customer_id).filter(Boolean))];
  const agentIds = [...new Set(deliveries.map((row) => row.agent_id).filter(Boolean))];

  const [{ customersById, agentsById }, subscriptionByCustomer] = await Promise.all([
    getCustomerAndAgentMaps({ customerIds, agentIds }),
    getSubscriptionMapForCustomers({ customerIds, dairyId }),
  ]);

  return {
    deliveries: mapDeliveries({
      deliveries,
      customersById,
      agentsById,
      subscriptionByCustomer,
    }),
  };
};

export const getDeliverySchedulingOptions = async ({ dairyId = null } = {}) => {
  let subscriptionsQuery = supabase
    .from("subscriptions")
    .select(
      "customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, created_at, updated_at"
    );

  if (dairyId) {
    subscriptionsQuery = subscriptionsQuery.eq("dairy_id", dairyId);
  }

  const { data: subscriptions, error: subscriptionsError } = await subscriptionsQuery;
  if (subscriptionsError) throw subscriptionsError;

  const subscriptionByCustomer = pickLatestSubscriptionByCustomer(subscriptions || [], dairyId, {
    activeOnly: true,
  });
  const customerIds = [...subscriptionByCustomer.keys()];

  const { data: customers, error: customersError } = customerIds.length
    ? await supabase
        .from("customers")
        .select("id, customer_name, phone_number, building_name, wing, room_no")
        .in("id", customerIds)
    : { data: [], error: null };

  if (customersError) throw customersError;

  const fetchAgents = async () => {
    let queryWithStatus = supabase
      .from("agents")
      .select("id, agent_name, building, status");

    if (dairyId) {
      queryWithStatus = queryWithStatus.eq("dairy_id", dairyId);
    }

    const withStatusResult = await queryWithStatus.order("agent_name", {
      ascending: true,
    });

    if (!withStatusResult.error) {
      return withStatusResult.data || [];
    }

    if (!isMissingColumnError(withStatusResult.error)) {
      throw withStatusResult.error;
    }

    let fallbackQuery = supabase
      .from("agents")
      .select("id, agent_name, building");

    if (dairyId) {
      fallbackQuery = fallbackQuery.eq("dairy_id", dairyId);
    }

    const fallbackResult = await fallbackQuery.order("agent_name", {
      ascending: true,
    });

    if (fallbackResult.error) throw fallbackResult.error;
    return (fallbackResult.data || []).map((row) => ({ ...row, status: "ACTIVE" }));
  };

  const agents = await fetchAgents();

  const customerById = new Map((customers || []).map((row) => [row.id, row]));

  const schedulableCustomers = [...subscriptionByCustomer.entries()]
    .map(([customerId, subscription]) => {
      const customer = customerById.get(customerId) || {};
      const room =
        customer.wing && customer.room_no
          ? `${customer.wing}-${customer.room_no}`
          : customer.room_no || customer.wing || "";

      return {
        id: customerId,
        name: customer.customer_name || `Customer #${customerId}`,
        phone: customer.phone_number || "",
        route: customer.building_name || "-",
        room,
        milkType: subscription.milk_type || "Milk",
        quantityLiters: subscription.quantity_liters ?? null,
        slot: subscription.delivery_slot || "-",
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const agentIds = (agents || []).map((agent) => agent?.id).filter(Boolean);
  const availabilityMap = await getAgentAvailabilityMap({
    agentIds,
    deliveryDate: new Date(),
  });

  const availableAgents = (agents || []).map((agent) => {
    const normalizedStatus = String(agent?.status || "ACTIVE").toUpperCase();
    const isActive = normalizedStatus !== "INACTIVE";
    const availability = availabilityMap.get(agent?.id) || {
      assignedCount: 0,
      availability: "AVAILABLE",
    };

    return {
      id: agent.id,
      name: agent.agent_name || `Agent #${agent.id}`,
      route: agent.building || "-",
      status: normalizedStatus,
      isActive,
      availability: availability.availability,
      assignedCount: availability.assignedCount,
    };
  });

  return {
    customers: schedulableCustomers,
    agents: availableAgents,
  };
};

export const scheduleDeliveryForSubscribedCustomer = async ({
  dairyId = null,
  customerId,
  agentId = null,
  deliveryDate,
  notes = null,
} = {}) => {
  const parsedCustomerId = toIntegerOrNull(customerId);
  if (!parsedCustomerId) {
    throw makeError("customerId is required");
  }
  if (!isValidDateString(deliveryDate)) {
    throw makeError("deliveryDate must be in YYYY-MM-DD format");
  }

  const parsedAgentId = toIntegerOrNull(agentId);

  let subscriptionQuery = supabase
    .from("subscriptions")
    .select("customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, updated_at, created_at")
    .eq("customer_id", parsedCustomerId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  if (dairyId) {
    subscriptionQuery = subscriptionQuery.eq("dairy_id", dairyId);
  }

  const { data: customerSubscriptions, error: subscriptionError } = await subscriptionQuery;
  if (subscriptionError) throw subscriptionError;

  const activeSubscription = (customerSubscriptions || []).find((row) =>
    isSubscriptionActive(row?.status)
  );

  if (!activeSubscription) {
    throw makeError("Customer does not have an active subscription", 400);
  }

  const resolvedDairyId = activeSubscription.dairy_id || dairyId;
  if (!resolvedDairyId) {
    throw makeError("Could not resolve dairy for this customer", 400);
  }

  if (parsedAgentId) {
    let agentQuery = supabase.from("agents").select("id").eq("id", parsedAgentId).limit(1);
    agentQuery = agentQuery.eq("dairy_id", resolvedDairyId);

    const { data: agent, error: agentError } = await agentQuery.maybeSingle();
    if (agentError) throw agentError;
    if (!agent) {
      throw makeError("Selected agent is not available for this dairy", 400);
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("deliveries")
    .select("id")
    .eq("customer_id", parsedCustomerId)
    .eq("dairy_id", resolvedDairyId)
    .eq("delivery_date", deliveryDate)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    throw makeError("Delivery already scheduled for this customer on selected date", 409);
  }

  const insertPayload = {
    customer_id: parsedCustomerId,
    dairy_id: resolvedDairyId,
    agent_id: parsedAgentId,
    delivery_date: deliveryDate,
    milk_type: activeSubscription.milk_type || "Milk",
    quantity_liters: activeSubscription.quantity_liters ?? null,
    status: "PENDING",
    approval_status: "APPROVED",
    notes: notes ? String(notes).slice(0, 500) : null,
  };

  const { data: createdDelivery, error: createError } = await supabase
    .from("deliveries")
    .insert(insertPayload)
    .select(
      "id, customer_id, dairy_id, agent_id, delivery_date, milk_type, quantity_liters, status, created_at"
    )
    .single();

  if (createError) throw createError;

  const { customersById, agentsById } = await getCustomerAndAgentMaps({
    customerIds: [createdDelivery.customer_id],
    agentIds: createdDelivery.agent_id ? [createdDelivery.agent_id] : [],
  });

  const subscriptionByCustomer = new Map([[createdDelivery.customer_id, activeSubscription]]);

  const [mappedRow] = mapDeliveries({
    deliveries: [createdDelivery],
    customersById,
    agentsById,
    subscriptionByCustomer,
  });

  const { data: customerForAlert } = await supabase
    .from("customers")
    .select("email, customer_name")
    .eq("id", createdDelivery.customer_id)
    .limit(1)
    .maybeSingle();

  const dairyName = await getDairyNameById(resolvedDairyId);
  await sendScheduledDeliveryAlert({
    email: customerForAlert?.email || null,
    customerName: customerForAlert?.customer_name || mappedRow?.customerName,
    dairyName,
    deliveryDate: createdDelivery.delivery_date,
    quantityLiters: createdDelivery.quantity_liters,
    milkType: createdDelivery.milk_type,
    slot: activeSubscription.delivery_slot || "-",
  });

  return mappedRow;
};

export const scheduleBulkDeliveriesForDate = async ({
  dairyId = null,
  deliveryDate,
  agentId = null,
  slot = "ALL",
  route = "ALL",
  notes = null,
} = {}) => {
  if (!isValidDateString(deliveryDate)) {
    throw makeError("deliveryDate must be in YYYY-MM-DD format");
  }

  const parsedAgentId = toIntegerOrNull(agentId);
  const normalizedSlot = String(slot || "ALL").toUpperCase();
  const normalizedRoute = String(route || "ALL").trim();

  if (parsedAgentId) {
    let agentQuery = supabase.from("agents").select("id, dairy_id").eq("id", parsedAgentId).limit(1);
    if (dairyId) {
      agentQuery = agentQuery.eq("dairy_id", dairyId);
    }
    const { data: agent, error: agentError } = await agentQuery.maybeSingle();
    if (agentError) throw agentError;
    if (!agent) {
      throw makeError("Selected agent is not available for this dairy", 400);
    }
  }

  let subscriptionQuery = supabase
    .from("subscriptions")
    .select(
      "customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, updated_at, created_at"
    );

  if (dairyId) {
    subscriptionQuery = subscriptionQuery.eq("dairy_id", dairyId);
  }

  const { data: subscriptionRows, error: subscriptionError } = await subscriptionQuery;
  if (subscriptionError) throw subscriptionError;

  const activeByCustomer = pickLatestSubscriptionByCustomer(subscriptionRows || [], dairyId, {
    activeOnly: true,
  });
  const allCandidates = [...activeByCustomer.entries()];
  const candidateCustomerIds = allCandidates.map(([customerId]) => customerId);

  if (candidateCustomerIds.length === 0) {
    return {
      deliveryDate,
      requestedCustomers: 0,
      eligibleCustomers: 0,
      createdCount: 0,
      skippedExistingCount: 0,
      skippedNoDairyCount: 0,
      skippedByFilterCount: 0,
    };
  }

  const { data: customers, error: customerError } = await supabase
    .from("customers")
    .select("id, customer_name, email, building_name")
    .in("id", candidateCustomerIds);

  if (customerError) throw customerError;
  const customerById = new Map((customers || []).map((row) => [row.id, row]));

  const filteredCandidates = allCandidates.filter(([customerId, sub]) => {
    const customer = customerById.get(customerId) || {};

    if (normalizedSlot !== "ALL") {
      const candidateSlot = String(sub?.delivery_slot || "").toUpperCase();
      if (candidateSlot !== normalizedSlot) return false;
    }

    if (normalizedRoute !== "ALL") {
      const candidateRoute = String(customer?.building_name || "").trim().toLowerCase();
      if (candidateRoute !== normalizedRoute.toLowerCase()) return false;
    }

    return true;
  });

  const filteredCustomerIds = filteredCandidates.map(([customerId]) => customerId);
  if (filteredCustomerIds.length === 0) {
    return {
      deliveryDate,
      requestedCustomers: candidateCustomerIds.length,
      eligibleCustomers: 0,
      createdCount: 0,
      skippedExistingCount: 0,
      skippedNoDairyCount: 0,
      skippedByFilterCount: candidateCustomerIds.length,
    };
  }

  let existingQuery = supabase
    .from("deliveries")
    .select("id, customer_id")
    .eq("delivery_date", deliveryDate)
    .in("customer_id", filteredCustomerIds);
  if (dairyId) {
    existingQuery = existingQuery.eq("dairy_id", dairyId);
  }

  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) throw existingError;
  const existingCustomerIds = new Set((existingRows || []).map((row) => row.customer_id));

  const insertRows = [];
  let skippedNoDairyCount = 0;

  for (const [customerId, sub] of filteredCandidates) {
    if (existingCustomerIds.has(customerId)) continue;

    const resolvedDairyId = sub?.dairy_id || dairyId || null;
    if (!resolvedDairyId) {
      skippedNoDairyCount += 1;
      continue;
    }

    insertRows.push({
      customer_id: customerId,
      dairy_id: resolvedDairyId,
      agent_id: parsedAgentId,
      delivery_date: deliveryDate,
      milk_type: sub?.milk_type || "Milk",
      quantity_liters: sub?.quantity_liters ?? null,
      status: "PENDING",
      approval_status: "APPROVED",
      notes: notes ? String(notes).slice(0, 500) : null,
    });
  }

  let createdRows = [];
  if (insertRows.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("deliveries")
      .insert(insertRows)
      .select("id, customer_id, dairy_id, milk_type, quantity_liters, delivery_date");

    if (insertError) throw insertError;
    createdRows = inserted || [];
  }

  const dairyName = await getDairyNameById(dairyId || insertRows[0]?.dairy_id || null);
  const createdByCustomer = new Map(createdRows.map((row) => [row.customer_id, row]));

  await Promise.all(
    filteredCandidates.map(async ([customerId, sub]) => {
      const created = createdByCustomer.get(customerId);
      if (!created) return;

      const customer = customerById.get(customerId) || {};
      await sendScheduledDeliveryAlert({
        email: customer?.email || null,
        customerName: customer?.customer_name || `Customer #${customerId}`,
        dairyName,
        deliveryDate: created.delivery_date,
        quantityLiters: created.quantity_liters,
        milkType: created.milk_type,
        slot: sub?.delivery_slot || "-",
      });
    })
  );

  return {
    deliveryDate,
    requestedCustomers: candidateCustomerIds.length,
    eligibleCustomers: filteredCustomerIds.length,
    createdCount: createdRows.length,
    skippedExistingCount: filteredCustomerIds.length - createdRows.length - skippedNoDairyCount,
    skippedNoDairyCount,
    skippedByFilterCount: candidateCustomerIds.length - filteredCustomerIds.length,
  };
};

export const approvePendingDeliveryOrder = async ({ dairyId = null, deliveryId }) => {
  const parsedDeliveryId = toIntegerOrNull(deliveryId);
  if (!parsedDeliveryId) {
    throw makeError("deliveryId is required");
  }

  let existingQuery = supabase
    .from("deliveries")
    .select("id, dairy_id, notes, approval_status")
    .eq("id", parsedDeliveryId)
    .limit(1);
  if (dairyId) {
    existingQuery = existingQuery.eq("dairy_id", dairyId);
  }

  const { data: delivery, error: deliveryError } = await existingQuery.maybeSingle();
  if (deliveryError) throw deliveryError;
  if (!delivery) throw makeError("Order not found", 404);

  const isOneTimeOrder = String(delivery?.notes || "").includes("[ONE_TIME_ORDER]");
  if (!isOneTimeOrder) {
    throw makeError("Only customer one-time orders require approval", 400);
  }

  const currentStatus = normalizeApprovalStatus(delivery?.approval_status, {
    isOneTimeOrder: true,
  });
  if (currentStatus === "APPROVED") {
    return {
      approvedCount: 0,
      alreadyApproved: true,
      deliveryId: parsedDeliveryId,
    };
  }

  const { data: updatedDelivery, error: updateError } = await supabase
    .from("deliveries")
    .update({
      approval_status: "APPROVED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedDeliveryId)
    .eq("dairy_id", delivery.dairy_id)
    .select("id, approval_status")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updatedDelivery) throw makeError("Failed to approve order", 500);

  return {
    approvedCount: 1,
    deliveryId: updatedDelivery.id,
    approvalStatus: String(updatedDelivery.approval_status || "APPROVED").toUpperCase(),
  };
};

export const approveAllPendingDeliveryOrders = async ({ dairyId = null } = {}) => {
  if (!dairyId) {
    throw makeError("dairyId is required", 400);
  }

  const { data: pendingRows, error: pendingError } = await supabase
    .from("deliveries")
    .select("id")
    .eq("dairy_id", dairyId)
    .ilike("notes", "%[ONE_TIME_ORDER]%")
    .eq("approval_status", "PENDING");

  if (pendingError) throw pendingError;
  const pendingIds = (pendingRows || []).map((row) => row.id).filter(Boolean);
  if (pendingIds.length === 0) {
    return { approvedCount: 0 };
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("deliveries")
    .update({
      approval_status: "APPROVED",
      updated_at: new Date().toISOString(),
    })
    .in("id", pendingIds)
    .select("id");

  if (updateError) throw updateError;

  return {
    approvedCount: (updatedRows || []).length,
  };
};

export const assignDeliveryPartnerToOrder = async ({
  dairyId = null,
  deliveryId,
  agentId,
} = {}) => {
  const parsedDeliveryId = toIntegerOrNull(deliveryId);
  const parsedAgentId = toIntegerOrNull(agentId);
  if (!parsedDeliveryId) throw makeError("deliveryId is required");
  if (!parsedAgentId) throw makeError("agentId is required");

  let deliveryQuery = supabase
    .from("deliveries")
    .select("id, dairy_id, agent_id, notes, approval_status")
    .eq("id", parsedDeliveryId)
    .limit(1);
  if (dairyId) {
    deliveryQuery = deliveryQuery.eq("dairy_id", dairyId);
  }

  const { data: delivery, error: deliveryError } = await deliveryQuery.maybeSingle();
  if (deliveryError) throw deliveryError;
  if (!delivery) throw makeError("Delivery not found", 404);

  const isOneTimeOrder = String(delivery?.notes || "").includes("[ONE_TIME_ORDER]");
  const approvalStatus = normalizeApprovalStatus(delivery?.approval_status, {
    isOneTimeOrder,
  });
  if (isOneTimeOrder && approvalStatus !== "APPROVED") {
    throw makeError("Approve order first, then assign delivery partner", 400);
  }

  const resolvedDairyId = delivery?.dairy_id || dairyId;
  if (!resolvedDairyId) throw makeError("Could not resolve dairy for this delivery", 400);

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, dairy_id")
    .eq("id", parsedAgentId)
    .eq("dairy_id", resolvedDairyId)
    .limit(1)
    .maybeSingle();

  if (agentError) throw agentError;
  if (!agent) throw makeError("Selected delivery partner is not valid for this dairy", 400);

  const { data: updated, error: updateError } = await supabase
    .from("deliveries")
    .update({
      agent_id: parsedAgentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedDeliveryId)
    .eq("dairy_id", resolvedDairyId)
    .select("id, agent_id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) throw makeError("Failed to assign delivery partner", 500);

  return {
    deliveryId: updated.id,
    agentId: updated.agent_id,
  };
};
