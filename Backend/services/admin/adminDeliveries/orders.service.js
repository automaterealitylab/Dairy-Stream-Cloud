// Public admin delivery operations: listing, scheduling, approval and
// assignment orchestration.

import { supabase } from "../../../config/supabase.js";
import { isValidDateString } from "../../../utils/date.js";
import { isMissingColumnError } from "../../../utils/dbErrors.js";
import { findBestAutoAssignAgentId, autoAssignDeliveryIfPossible } from "./assignment.service.js";
import { mapDeliveries } from "./mapping.service.js";
import { sendScheduledDeliveryAlert } from "./notifications.service.js";
import {
  deriveAgentIsActive,
  extractIssueMeta,
  getWeekdayForDate,
  isSubscriptionActive,
  makeError,
  normalizeApprovalStatus,
  normalizeDeliveryDays,
  resolveLimit,
  toIntegerOrNull,
} from "./normalizers.js";
import {
  getAgentAvailabilityMap,
  getCustomerAndAgentMaps,
  getDairyNameById,
  getProductUnitMapForDairies,
} from "./queries.service.js";
import {
  getLatestActiveSubscriptionsForDairy,
  getSubscriptionMapForCustomers,
  pickLatestSubscriptionByCustomer,
} from "./subscriptions.service.js";

export const getAdminDeliveries = async ({ dairyId = null, limit, date = null } = {}) => {
  const resolvedLimit = resolveLimit(limit);

  let deliveriesQuery = supabase
    .from("deliveries")
    .select(
      "id, customer_id, dairy_id, agent_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, customer_issue_text, customer_issue_status, customer_issue_reported_at, customer_issue_admin_action, customer_issue_resolved_at, created_at"
    )
    .order("delivery_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(resolvedLimit);

  if (dairyId) {
    deliveriesQuery = deliveriesQuery.eq("dairy_id", dairyId);
  }

  if (isValidDateString(date)) {
    deliveriesQuery = deliveriesQuery.eq("delivery_date", date);
  }

  const { data: deliveries, error: deliveriesError } = await deliveriesQuery;
  if (deliveriesError) throw deliveriesError;
  const deliveryRows = Array.isArray(deliveries) ? deliveries : [];

  let projectedRows = [];
  let subscriptionByCustomer;

  if (isValidDateString(date)) {
    subscriptionByCustomer = await getLatestActiveSubscriptionsForDairy({ dairyId });
    const existingSubscriptionCustomerIds = new Set(
      deliveryRows
        .filter((row) => !String(row?.notes || "").includes("[ONE_TIME_ORDER]"))
        .map((row) => row.customer_id)
        .filter(Boolean)
    );
    const targetWeekday = getWeekdayForDate(date);

    projectedRows = [...subscriptionByCustomer.entries()]
      .filter(([customerId, subscription]) => {
        if (!customerId || !subscription?.dairy_id) return false;
        if (existingSubscriptionCustomerIds.has(customerId)) return false;
        if (subscription?.start_date && String(subscription.start_date) > date) return false;

        const selectedDays = normalizeDeliveryDays(subscription?.delivery_days);
        if (selectedDays.length > 0) {
          if (!targetWeekday || !selectedDays.includes(targetWeekday)) return false;
        }

        return true;
      })
      .map(([customerId, subscription]) => ({
        projectionKey: `projected-${customerId}-${date}`,
        id: null,
        customer_id: customerId,
        dairy_id: subscription.dairy_id,
        agent_id: null,
        projectedAgentId: subscription.assigned_agent_id || null,
        delivery_date: date,
        milk_type: subscription.milk_type || "Milk",
        quantity_liters: subscription.quantity_liters ?? null,
        status: "PENDING",
        approval_status: "APPROVED",
        notes: "[PROJECTED_SUBSCRIPTION_DELIVERY]",
        created_at: `${date}T00:00:00.000Z`,
        customer_issue_text: null,
        customer_issue_status: null,
        customer_issue_reported_at: null,
        customer_issue_admin_action: null,
        customer_issue_resolved_at: null,
        isProjected: true,
      }));
  } else {
    subscriptionByCustomer = await getSubscriptionMapForCustomers({
      customerIds: [...new Set(deliveryRows.map((row) => row.customer_id).filter(Boolean))],
      dairyId,
    });
  }

  const combinedRows = [...deliveryRows, ...projectedRows];
  if (combinedRows.length === 0) {
    return { deliveries: [] };
  }

  const customerIds = [...new Set(combinedRows.map((row) => row.customer_id).filter(Boolean))];
  const agentIds = [
    ...new Set(
      combinedRows
        .flatMap((row) => [row.agent_id, row.projectedAgentId])
        .filter(Boolean)
    ),
  ];
  const dairyIds = [...new Set(combinedRows.map((row) => row.dairy_id).filter(Boolean))];

  const { customersById, agentsById, dairiesById } = await getCustomerAndAgentMaps({
    customerIds,
    agentIds,
    dairyIds,
  });
  const productUnitByKey = await getProductUnitMapForDairies({ dairyIds });

  return {
    deliveries: mapDeliveries({
      deliveries: combinedRows,
      customersById,
      agentsById,
      dairiesById,
      subscriptionByCustomer,
      productUnitByKey,
    }),
  };
};

export const getDeliverySchedulingOptions = async ({ dairyId = null } = {}) => {
  let subscriptionsQuery = supabase
    .from("subscriptions")
    .select(
      "customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, approval_status, assigned_agent_id, created_at, updated_at"
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
      .select("id, agent_name, building, status, inactive_until");

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
    const isActive = deriveAgentIsActive(agent);
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

  let parsedAgentId = toIntegerOrNull(agentId);

  let subscriptionQuery = supabase
    .from("subscriptions")
    .select("customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, approval_status, updated_at, created_at")
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
    isSubscriptionActive(row?.status, row?.approval_status)
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

  if (!parsedAgentId) {
    const { data: customerForAssignment, error: customerError } = await supabase
      .from("customers")
      .select("id, building_name, wing, room_no")
      .eq("id", parsedCustomerId)
      .limit(1)
      .maybeSingle();
    if (customerError) throw customerError;

    parsedAgentId = await findBestAutoAssignAgentId({
      dairyId: resolvedDairyId,
      deliveryDate,
      customer: customerForAssignment,
      subscription: activeSubscription,
    });
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

  const { customersById, agentsById, dairiesById } = await getCustomerAndAgentMaps({
    customerIds: [createdDelivery.customer_id],
    agentIds: createdDelivery.agent_id ? [createdDelivery.agent_id] : [],
    dairyIds: createdDelivery.dairy_id ? [createdDelivery.dairy_id] : [],
  });

  const subscriptionByCustomer = new Map([[createdDelivery.customer_id, activeSubscription]]);

  const [mappedRow] = mapDeliveries({
    deliveries: [createdDelivery],
    customersById,
    agentsById,
    dairiesById,
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
      "customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, approval_status, assigned_agent_id, updated_at, created_at"
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
    .select("id, customer_name, email, building_name, wing, room_no")
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

    const customer = customerById.get(customerId) || {};
    const autoAssignedAgentId = parsedAgentId
      ? parsedAgentId
      : await findBestAutoAssignAgentId({
          dairyId: resolvedDairyId,
          deliveryDate,
          customer,
          subscription: sub,
        });

    insertRows.push({
      customer_id: customerId,
      dairy_id: resolvedDairyId,
      agent_id: autoAssignedAgentId,
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
    .select("id, customer_id, dairy_id, agent_id, delivery_date, notes, approval_status")
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

  const autoAssignment = await autoAssignDeliveryIfPossible({
    delivery,
    dairyId: delivery.dairy_id || dairyId,
  });

  return {
    approvedCount: 1,
    deliveryId: updatedDelivery.id,
    approvalStatus: String(updatedDelivery.approval_status || "APPROVED").toUpperCase(),
    autoAssignedAgentId: autoAssignment.agentId,
  };
};

export const approveAllPendingDeliveryOrders = async ({ dairyId = null } = {}) => {
  if (!dairyId) {
    throw makeError("dairyId is required", 400);
  }

  const { data: pendingRows, error: pendingError } = await supabase
    .from("deliveries")
    .select("id, customer_id, dairy_id, agent_id, delivery_date")
    .eq("dairy_id", dairyId)
    .ilike("notes", "%[ONE_TIME_ORDER]%")
    .in("approval_status", ["PENDING", "PENDING_VERIFICATION"]);

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

  let autoAssignedCount = 0;
  for (const row of pendingRows || []) {
    const assignment = await autoAssignDeliveryIfPossible({
      delivery: row,
      dairyId,
    });
    if (assignment.assigned) {
      autoAssignedCount += 1;
    }
  }

  return {
    approvedCount: (updatedRows || []).length,
    autoAssignedCount,
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

export const resolveDeliveryIssue = async ({
  dairyId = null,
  deliveryId,
  note = "",
} = {}) => {
  const parsedDeliveryId = toIntegerOrNull(deliveryId);
  if (!parsedDeliveryId) throw makeError("deliveryId is required");

  let deliveryQuery = supabase
    .from("deliveries")
    .select("id, dairy_id, notes, customer_issue_text, customer_issue_status")
    .eq("id", parsedDeliveryId)
    .limit(1);
  if (dairyId) {
    deliveryQuery = deliveryQuery.eq("dairy_id", dairyId);
  }

  const { data: delivery, error: deliveryError } = await deliveryQuery.maybeSingle();
  if (deliveryError) throw deliveryError;
  if (!delivery) throw makeError("Delivery not found", 404);

  const issueMeta = extractIssueMeta(delivery);
  if (!issueMeta.hasOpenIssue) {
    return {
      resolved: false,
      alreadyResolved: true,
      deliveryId: parsedDeliveryId,
    };
  }

  const resolutionNote = String(note || "").trim();
  const marker = `[ISSUE_RESOLVED] ${new Date().toISOString()}${
    resolutionNote ? ` :: ${resolutionNote.slice(0, 250)}` : ""
  }`;
  const currentNotes = String(delivery.notes || "").trim();
  const nextNotes = currentNotes ? `${currentNotes}\n${marker}` : marker;

  const { data: updated, error: updateError } = await supabase
    .from("deliveries")
    .update({
      customer_issue_status: "RESOLVED",
      customer_issue_admin_action: resolutionNote || "Issue resolved by admin",
      customer_issue_resolved_at: new Date().toISOString(),
      notes: nextNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedDeliveryId)
    .eq("dairy_id", delivery.dairy_id)
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) throw makeError("Failed to resolve issue", 500);

  return {
    resolved: true,
    deliveryId: updated.id,
  };
};

export const addAdminCustomerExtraDelivery = async ({
  dairyId,
  customerId,
  deliveryDate,
  milkType,
  quantityLiters,
  notes,
  status = "PENDING",
}) => {
  if (!dairyId) throw makeError("dairyId is required", 400);
  if (!customerId) throw makeError("customerId is required", 400);
  if (!deliveryDate) throw makeError("deliveryDate is required", 400);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("assigned_agent_id")
    .eq("customer_id", customerId)
    .eq("dairy_id", dairyId)
    .maybeSingle();

  const insertPayload = {
    dairy_id: dairyId,
    customer_id: Number(customerId),
    delivery_date: deliveryDate,
    milk_type: milkType || "Extra Order",
    quantity_liters: Number(quantityLiters || 1),
    status: status.toUpperCase(),
    assigned_agent_id: sub?.assigned_agent_id || null,
    notes: notes ? `[EXTRA ORDER] ${notes}` : "[EXTRA ORDER] Requested via phone call",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from("deliveries")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw error;
  return created;
};
