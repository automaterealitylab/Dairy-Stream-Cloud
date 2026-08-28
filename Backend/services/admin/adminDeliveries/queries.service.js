// Database read helpers for the admin deliveries domain: customer/agent/dairy
// maps, product unit map, agent availability and dairy name lookup.

import { supabase } from "../../../config/supabase.js";
import { normalizeDate, normalizeProductKey } from "./normalizers.js";

export const getCustomerAndAgentMaps = async ({ customerIds, agentIds, dairyIds = [] }) => {
  const [customersResp, agentsResp, dairiesResp] = await Promise.all([
    customerIds.length > 0
      ? supabase
          .from("customers")
          .select("id, customer_name, building_name, wing, room_no, latitude, longitude")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    agentIds.length > 0
      ? supabase
          .from("agents")
          .select("id, agent_name, building, status, inactive_until")
          .in("id", agentIds)
      : Promise.resolve({ data: [], error: null }),
    dairyIds.length > 0
      ? supabase
          .from("dairies")
          .select("id, dairy_name, latitude, longitude")
          .in("id", dairyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customersResp.error) throw customersResp.error;
  if (agentsResp.error) throw agentsResp.error;
  if (dairiesResp.error) throw dairiesResp.error;

  return {
    customersById: new Map((customersResp.data || []).map((row) => [row.id, row])),
    agentsById: new Map((agentsResp.data || []).map((row) => [row.id, row])),
    dairiesById: new Map((dairiesResp.data || []).map((row) => [row.id, row])),
  };
};

export const getProductUnitMapForDairies = async ({ dairyIds = [] } = {}) => {
  const ids = [...new Set((dairyIds || []).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("products")
    .select("dairy_id, name, unit")
    .in("dairy_id", ids);

  if (error) throw error;

  const unitsByProduct = new Map();
  for (const row of data || []) {
    const dairyId = row?.dairy_id;
    const productKey = normalizeProductKey(row?.name);
    if (!dairyId || !productKey) continue;
    unitsByProduct.set(`${dairyId}::${productKey}`, row?.unit || "LITER");
  }

  return unitsByProduct;
};

export const getDairyNameById = async (dairyId) => {
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

export const getAgentAvailabilityMap = async ({ agentIds = [], deliveryDate }) => {
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
