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

const isSubscriptionActive = (status, approvalStatus = "APPROVED") => {
  const value = String(status || "ACTIVE").toUpperCase();
  const approval = String(approvalStatus || "APPROVED").toUpperCase();
  return value === "ACTIVE" && approval === "APPROVED";
};

const isValidDateString = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const WEEKDAY_KEYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
};

const parseDateSafe = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const deriveAgentIsActive = (agent = {}) => {
  const status = String(agent?.status || "ACTIVE").toUpperCase();
  const inactiveUntilDate = parseDateSafe(agent?.inactive_until);
  if (status !== "INACTIVE") return true;
  if (!inactiveUntilDate) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return inactiveUntilDate < todayStart;
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

const parseNotesField = (notesValue, field) => {
  const match = String(notesValue || "").match(new RegExp(`${field}=([^;\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
};

const normalizeDate = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

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

const extractIssueMetaFromNotes = (notesValue) => {
  const lines = String(notesValue || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let lastIssueIndex = -1;
  let lastResolveIndex = -1;
  let latestIssueText = null;

  lines.forEach((line, index) => {
    if (line.startsWith("[CUSTOMER_ISSUE]")) {
      lastIssueIndex = index;
      const match = line.match(/^\[CUSTOMER_ISSUE\]\s*[^\s]+\s*::\s*(.+)$/i);
      latestIssueText = match?.[1]?.trim() || line.replace("[CUSTOMER_ISSUE]", "").trim();
    }
    if (line.startsWith("[ISSUE_RESOLVED]")) {
      lastResolveIndex = index;
    }
  });

  const hasOpenIssue =
    lastIssueIndex >= 0 && (lastResolveIndex < 0 || lastResolveIndex < lastIssueIndex);

  return {
    hasOpenIssue,
    customerIssue: hasOpenIssue ? latestIssueText || "Issue reported by customer" : null,
  };
};

const extractIssueMeta = (row = {}) => {
  const status = String(row?.customer_issue_status || "").toUpperCase();
  const issueText = String(row?.customer_issue_text || "").trim();
  const adminAction = String(row?.customer_issue_admin_action || "").trim() || null;
  const reportedAt = row?.customer_issue_reported_at || null;
  const resolvedAt = row?.customer_issue_resolved_at || null;

  if (issueText) {
    const hasOpenIssue = status !== "RESOLVED";
    return {
      hasOpenIssue,
      customerIssue: hasOpenIssue ? issueText : null,
      issueStatus: hasOpenIssue ? "OPEN" : "RESOLVED",
      issueAdminAction: adminAction,
      issueReportedAt: reportedAt,
      issueResolvedAt: resolvedAt,
    };
  }

  const fallback = extractIssueMetaFromNotes(row?.notes);
  return {
    hasOpenIssue: fallback.hasOpenIssue,
    customerIssue: fallback.customerIssue,
    issueStatus: fallback.hasOpenIssue ? "OPEN" : "NONE",
    issueAdminAction: null,
    issueReportedAt: null,
    issueResolvedAt: null,
  };
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

    if (activeOnly && !isSubscriptionActive(row?.status, row?.approval_status)) continue;

    byCustomer.set(customerId, row);
  }

  return byCustomer;
};

const getCustomerAndAgentMaps = async ({ customerIds, agentIds }) => {
  const [customersResp, agentsResp] = await Promise.all([
    customerIds.length > 0
      ? supabase
          .from("customers")
          .select("id, customer_name, building_name, wing, room_no")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    agentIds.length > 0
      ? supabase
          .from("agents")
          .select("id, agent_name, building, status, inactive_until")
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
      "customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, approval_status, assigned_agent_id, created_at, updated_at"
    )
    .in("customer_id", customerIds);

  if (dairyId) {
    query = query.eq("dairy_id", dairyId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return pickLatestSubscriptionByCustomer(data || [], dairyId, { activeOnly: true });
};

const getLatestActiveSubscriptionsForDairy = async ({ dairyId = null } = {}) => {
  const selectWithDeliveryDays =
    "customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, approval_status, assigned_agent_id, start_date, delivery_days, created_at, updated_at";
  const selectWithoutDeliveryDays =
    "customer_id, dairy_id, milk_type, quantity_liters, delivery_slot, status, approval_status, assigned_agent_id, start_date, created_at, updated_at";

  const runQuery = async (selectClause) => {
    let query = supabase.from("subscriptions").select(selectClause);
    if (dairyId) {
      query = query.eq("dairy_id", dairyId);
    }
    return query;
  };

  let result = await runQuery(selectWithDeliveryDays);
  if (result.error && isMissingColumnError(result.error)) {
    result = await runQuery(selectWithoutDeliveryDays);
  }
  if (result.error) throw result.error;

  return pickLatestSubscriptionByCustomer(result.data || [], dairyId, {
    activeOnly: true,
  });
};

const normalizeRouteValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const routeMatchesCustomer = (agentRoute, customerRoute) => {
  const target = normalizeRouteValue(customerRoute);
  if (!target) return false;

  return String(agentRoute || "")
    .split(",")
    .map((part) => normalizeRouteValue(part))
    .filter(Boolean)
    .some((part) => part === target);
};

const fetchAssignableAgentsForDairy = async ({ dairyId = null } = {}) => {
  let query = supabase
    .from("agents")
    .select("id, agent_name, building, status, inactive_until");

  if (dairyId) {
    query = query.eq("dairy_id", dairyId);
  }

  const { data, error } = await query.order("agent_name", { ascending: true });
  if (!error) {
    return data || [];
  }

  if (!isMissingColumnError(error)) {
    throw error;
  }

  let fallbackQuery = supabase.from("agents").select("id, agent_name, building");
  if (dairyId) {
    fallbackQuery = fallbackQuery.eq("dairy_id", dairyId);
  }

  const fallback = await fallbackQuery.order("agent_name", { ascending: true });
  if (fallback.error) throw fallback.error;

  return (fallback.data || []).map((row) => ({
    ...row,
    status: "ACTIVE",
    inactive_until: null,
  }));
};

const findBestAutoAssignAgentId = async ({
  dairyId = null,
  deliveryDate,
  customer = null,
  subscription = null,
} = {}) => {
  const candidateAgents = await fetchAssignableAgentsForDairy({ dairyId });
  const activeAgents = candidateAgents.filter((agent) => deriveAgentIsActive(agent));
  if (activeAgents.length === 0) return null;

  const activeAgentIds = activeAgents.map((agent) => agent.id).filter(Boolean);
  const preferredAgentId = Number(subscription?.assigned_agent_id || 0);
  if (preferredAgentId > 0 && activeAgentIds.includes(preferredAgentId)) {
    return preferredAgentId;
  }

  const availabilityMap = await getAgentAvailabilityMap({
    agentIds: activeAgentIds,
    deliveryDate,
  });

  const rankedAgents = activeAgents
    .map((agent) => {
      const availability = availabilityMap.get(agent.id) || {
        assignedCount: 0,
        availability: "AVAILABLE",
      };

      return {
        ...agent,
        assignedCount: availability.assignedCount,
        routeMatch: routeMatchesCustomer(agent?.building, customer?.building_name),
      };
    })
    .sort((left, right) => {
      if (Number(right.routeMatch) !== Number(left.routeMatch)) {
        return Number(right.routeMatch) - Number(left.routeMatch);
      }
      if ((left.assignedCount || 0) !== (right.assignedCount || 0)) {
        return (left.assignedCount || 0) - (right.assignedCount || 0);
      }
      return String(left.agent_name || "").localeCompare(String(right.agent_name || ""));
    });

  return rankedAgents[0]?.id || null;
};

const autoAssignDeliveryIfPossible = async ({ delivery, dairyId = null } = {}) => {
  const parsedDeliveryId = Number(delivery?.id);
  if (!Number.isFinite(parsedDeliveryId) || parsedDeliveryId <= 0) {
    return { agentId: null, assigned: false };
  }
  if (delivery?.agent_id) {
    return { agentId: delivery.agent_id, assigned: false };
  }

  const customerId = Number(delivery?.customer_id || 0);
  if (!customerId) {
    return { agentId: null, assigned: false };
  }

  const resolvedDairyId = delivery?.dairy_id || dairyId || null;
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, building_name, wing, room_no")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();
  if (customerError) throw customerError;

  const subscriptionByCustomer = await getSubscriptionMapForCustomers({
    customerIds: [customerId],
    dairyId: resolvedDairyId,
  });
  const subscription = subscriptionByCustomer.get(customerId) || null;

  const nextAgentId = await findBestAutoAssignAgentId({
    dairyId: resolvedDairyId,
    deliveryDate: delivery?.delivery_date || new Date(),
    customer,
    subscription,
  });

  if (!nextAgentId) {
    return { agentId: null, assigned: false };
  }

  const { data: updated, error: updateError } = await supabase
    .from("deliveries")
    .update({
      agent_id: nextAgentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedDeliveryId)
    .select("id, agent_id")
    .maybeSingle();

  if (updateError) throw updateError;

  return {
    agentId: updated?.agent_id || nextAgentId,
    assigned: Boolean(updated?.agent_id),
  };
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
    const isSubscriptionExtraOrder = isOneTimeOrder && Boolean(subscription?.customer_id);
    const approvalStatus = normalizeApprovalStatus(row.approval_status, { isOneTimeOrder });
    const issueMeta = extractIssueMeta(row);
    const buildingName = customer.building_name || route || "-";
    const wingOrFloor = customer.wing || "";
    const roomNo = customer.room_no || "";
    const slot = subscription.delivery_slot || parseNotesField(notes, "slot") || "-";
    const deliveryId = row?.projectionKey || row?.id || null;
    const projectedAgentId = row?.projectedAgentId || subscription?.assigned_agent_id || null;
    const resolvedAgent = agentsById.get(projectedAgentId) || agent;
    const isProjected = Boolean(row?.isProjected);

    return {
      id: deliveryId != null ? `DLV-${deliveryId}` : "DLV-NA",
      rawId: isProjected ? null : row.id ?? null,
      agentId: isProjected ? projectedAgentId : row.agent_id ?? null,
      customerName: customer.customer_name || `Customer #${row.customer_id ?? "-"}`,
      agentName: resolvedAgent.agent_name || "Unassigned",
      route,
      buildingName,
      wingOrFloor,
      roomNo,
      locationLabel: [buildingName, wingOrFloor, roomNo].filter(Boolean).join(" / ") || "-",
      quantity: formatQuantity(quantity),
      date: normalizeDate(row.delivery_date || row.created_at),
      slot,
      status: normalizeStatus(row.status),
      isOneTimeOrder,
      isSubscriptionExtraOrder,
      deliveryType: isSubscriptionExtraOrder
        ? "SUBSCRIPTION EXTRA"
        : isOneTimeOrder
        ? "BUY ONCE"
        : "SUBSCRIPTION",
      approvalStatus,
      needsApproval: approvalStatus === "PENDING",
      isAssigned: isProjected ? projectedAgentId != null : row.agent_id != null,
      isProjected,
      hasOpenIssue: issueMeta.hasOpenIssue,
      customerIssue: issueMeta.customerIssue,
      issueStatus: issueMeta.issueStatus,
      issueAdminAction: issueMeta.issueAdminAction,
      issueReportedAt: issueMeta.issueReportedAt,
      issueResolvedAt: issueMeta.issueResolvedAt,
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

  const { customersById, agentsById } = await getCustomerAndAgentMaps({ customerIds, agentIds });

  return {
    deliveries: mapDeliveries({
      deliveries: combinedRows,
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
