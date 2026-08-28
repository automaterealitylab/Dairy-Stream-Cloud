// Database read helpers for the customer deliveries domain: dairy/agent maps,
// agent-out-for-delivery check, generic row fetch, product lookup,
// open-subscription check and saved-address lookup.

import { supabase } from "../../../config/supabase.js";
import {
  isMissingColumnError,
  isMissingTableError,
  isUuidSyntaxError,
} from "../../../utils/dbErrors.js";
import { buildCustomerAddress, hasOpenSubscriptionStatus } from "./normalizers.js";

export const getDairyNamesMap = async (rows = []) => {
  const dairyIds = [
    ...new Set(
      (rows || [])
        .map((row) => row?.dairy_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
    ),
  ];

  if (dairyIds.length === 0) return {};

  const { data, error } = await supabase
    .from("dairies")
    .select("id, dairy_name")
    .in("id", dairyIds);

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) return {};
    throw error;
  }

  return (data || []).reduce((acc, row) => {
    const key = row?.id;
    if (key != null) acc[String(key)] = row?.dairy_name || `Dairy #${key}`;
    return acc;
  }, {});
};

export const getAgentDetailsMap = async (rows = []) => {
  const agentIds = [
    ...new Set(
      (rows || [])
        .map((row) => row?.agent_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
    ),
  ];

  if (agentIds.length === 0) return {};

  const { data, error } = await supabase
    .from("agents")
    .select("id, agent_name, phone_number, building")
    .in("id", agentIds);

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) return {};
    throw error;
  }

  return (data || []).reduce((acc, row) => {
    if (row?.id == null) return acc;
    acc[String(row.id)] = {
      id: row.id,
      name: row.agent_name || `Agent #${row.id}`,
      phone: row.phone_number || "-",
      route: row.building || "-",
    };
    return acc;
  }, {});
};

export const isAgentOutForDeliveryToday = async ({ agentId, todayDate }) => {
  if (!agentId || !todayDate) return false;

  const { data, error } = await supabase
    .from("deliveries")
    .select("id")
    .eq("agent_id", agentId)
    .eq("delivery_date", todayDate)
    .in("status", ["IN_TRANSIT", "OUT_FOR_DELIVERY"])
    .limit(1);

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) return false;
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
};

export const tryFetchFromTable = async (table, customerId, limit = 31) => {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("customer_id", customerId)
    .order("delivery_date", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error) || isMissingColumnError(error) || isUuidSyntaxError(error)) {
      return null;
    }
    throw error;
  }

  return data || [];
};

export const getProductByNameForDairy = async ({ dairyId, productName }) => {
  const { data, error } = await supabase
    .from("products")
    .select("id, dairy_id, name, rate_per_unit, stock_quantity, is_active")
    .eq("dairy_id", dairyId)
    .ilike("name", productName)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) {
      throw new Error("Product inventory is not configured. Run latest migrations first.");
    }
    throw error;
  }

  return data || null;
};

export const hasOpenSubscriptionForDairy = async ({ customerId, dairyId }) => {
  if (!customerId || !dairyId) return false;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("customer_id", customerId)
    .eq("dairy_id", dairyId)
    .limit(20);

  if (error) {
    if (
      isMissingTableError(error) ||
      isMissingColumnError(error) ||
      isUuidSyntaxError(error)
    ) {
      return false;
    }
    throw error;
  }

  return (data || []).some((row) => hasOpenSubscriptionStatus(row?.status));
};

export const getSavedCustomerAddress = async (customerId) => {
  if (!customerId) return "";

  const { data, error } = await supabase
    .from("customers")
    .select("building_name, wing, room_no")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return buildCustomerAddress(data);
};
