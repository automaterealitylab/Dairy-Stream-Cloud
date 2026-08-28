// Delivery-to-agent assignment: candidate selection, best-match ranking and
// automatic assignment on approval.

import { supabase } from "../../../config/supabase.js";
import { isMissingColumnError } from "../../../utils/dbErrors.js";
import { deriveAgentIsActive, routeMatchesCustomer } from "./normalizers.js";
import { getAgentAvailabilityMap } from "./queries.service.js";
import { getSubscriptionMapForCustomers } from "./subscriptions.service.js";

export const fetchAssignableAgentsForDairy = async ({ dairyId = null } = {}) => {
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

export const findBestAutoAssignAgentId = async ({
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

export const autoAssignDeliveryIfPossible = async ({ delivery, dairyId = null } = {}) => {
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
