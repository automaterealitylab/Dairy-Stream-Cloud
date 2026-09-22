// Database read helpers for the agent delivery domain: cached delivery
// settings, agent core row, delivery rows, assigned-row lookup, linked payment
// rows and customer/dairy lookup maps.

import { supabase } from "../../../config/supabase.js";
import { isMissingColumnError } from "../../../utils/dbErrors.js";
import { getSetting } from "../../shared/appSettings.service.js";

// Dynamic settings (will be fetched from DB)
let cachedDeliverySettings = null;
let lastSettingsFetchTime = 0;
const SETTINGS_CACHE_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const getDeliverySettings = async () => {
  const now = Date.now();
  // Use cache if it's fresh
  if (cachedDeliverySettings && now - lastSettingsFetchTime < SETTINGS_CACHE_INTERVAL) {
    return cachedDeliverySettings;
  }

  // Fetch from database
  const [onlineCollectionTtlMs, nearbyPageSize] = await Promise.all([
    getSetting("ONLINE_COLLECTION_TTL_MS", 20 * 60 * 1000),
    getSetting("NEARBY_PAGE_SIZE", 20),
  ]);

  cachedDeliverySettings = {
    onlineCollectionTtlMs,
    nearbyPageSize,
  };
  lastSettingsFetchTime = now;
  return cachedDeliverySettings;
};

export const fetchAgentCore = async (agentDbId, dairyId = null) => {
  const selectableSets = [
    "id, agent_id, agent_name, email, phone_number, building, dairy_id, status, inactive_from, inactive_until, inactive_days, created_at",
    "id, agent_id, agent_name, email, phone_number, building, dairy_id, status, created_at",
    "id, agent_id, agent_name, email, phone_number, building, dairy_id, created_at",
  ];

  for (const fields of selectableSets) {
    let query = supabase
      .from("agents")
      .select(fields)
      .eq("id", agentDbId)
      .limit(1);

    if (dairyId) {
      query = query.eq("dairy_id", dairyId);
    }

    const { data, error } = await query.maybeSingle();
    if (!error) {
      return {
        ...data,
        status: data?.status || "ACTIVE",
        inactive_from: data?.inactive_from || null,
        inactive_until: data?.inactive_until || null,
        inactive_days: data?.inactive_days ?? null,
      };
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  return null;
};

export const fetchDeliveryRows = async ({
  agentDbId,
  dairyId = null,
  date = null,
  beforeDate = null,
  maxDate = null,
  limit = 500,
} = {}) => {
  let query = supabase
    .from("deliveries")
    .select(
      "id, customer_id, dairy_id, agent_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, updated_at, created_at"
    )
    .eq("agent_id", agentDbId)
    .neq("approval_status", "PENDING_PAYMENT")
    .order("delivery_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (dairyId) query = query.eq("dairy_id", dairyId);
  if (date) query = query.eq("delivery_date", date);
  if (maxDate) query = query.lte("delivery_date", maxDate);
  else if (beforeDate) query = query.lte("delivery_date", beforeDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const fetchAgentMonthActiveDates = async ({ agentDbId, dairyId = null, month = null } = {}) => {
  const now = new Date();
  const currentMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearStr, monthStr] = currentMonth.split("-");
  const year = parseInt(yearStr, 10) || now.getFullYear();
  const m = parseInt(monthStr, 10) || now.getMonth() + 1;
  const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(year, m, 0).getDate();
  const endDate = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  let query = supabase
    .from("deliveries")
    .select("delivery_date")
    .eq("agent_id", agentDbId)
    .neq("approval_status", "PENDING_PAYMENT")
    .gte("delivery_date", startDate)
    .lte("delivery_date", endDate)
    .order("delivery_date", { ascending: false });

  if (dairyId) query = query.eq("dairy_id", dairyId);

  const { data, error } = await query;
  if (error) throw error;

  const dates = [...new Set((data || []).map((row) => row.delivery_date).filter(Boolean))];
  return dates;
};

export const fetchAgentDayDeliverySummary = async ({ agentDbId, dairyId = null, date } = {}) => {
  let query = supabase
    .from("deliveries")
    .select("status, quantity_liters, approval_status")
    .eq("agent_id", agentDbId)
    .eq("delivery_date", date)
    .neq("approval_status", "PENDING_PAYMENT");

  if (dairyId) query = query.eq("dairy_id", dairyId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data || [];
  const total = rows.length;
  let completed = 0;
  let failed = 0;
  let pending = 0;
  let totalQuantity = 0;

  rows.forEach((row) => {
    const s = String(row?.status || "").toUpperCase();
    if (s === "COMPLETED") {
      completed += 1;
      const qty = Number(row?.quantity_liters || 0);
      if (Number.isFinite(qty) && qty > 0) totalQuantity += qty;
    } else if (s === "FAILED") {
      failed += 1;
    } else {
      pending += 1;
    }
  });

  return {
    summary: {
      total,
      completed,
      failed,
      pending,
      totalQuantity,
    },
    statusCounts: {
      all: total,
      pending,
      completed,
      failed,
    },
  };
};

export const fetchAgentPaginatedHistoryRows = async ({
  agentDbId,
  dairyId = null,
  date,
  status = "all",
  search = null,
  page = 1,
  limit = 25,
} = {}) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("deliveries")
    .select(
      "id, customer_id, dairy_id, agent_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, updated_at, created_at",
      { count: "exact" }
    )
    .eq("agent_id", agentDbId)
    .eq("delivery_date", date)
    .neq("approval_status", "PENDING_PAYMENT");

  if (dairyId) query = query.eq("dairy_id", dairyId);

  // Status filter
  const normalizedStatus = String(status || "").toLowerCase();
  if (normalizedStatus === "completed") {
    query = query.eq("status", "COMPLETED");
  } else if (normalizedStatus === "failed") {
    query = query.eq("status", "FAILED");
  } else if (normalizedStatus === "pending") {
    query = query.in("status", ["PENDING", "OUT_FOR_DELIVERY", "IN_TRANSIT", "ASSIGNED"]);
  }

  // Search filter
  if (search && search.trim()) {
    const term = search.trim();
    const isNumeric = /^\d+$/.test(term);

    // Look for customers matching name, phone, building, room_no, wing, address
    let customerFilterQuery = supabase
      .from("customers")
      .select("id")
      .or(
        `customer_name.ilike.%${term}%,phone_number.ilike.%${term}%,building_name.ilike.%${term}%,room_no.ilike.%${term}%,wing.ilike.%${term}%,address_line_1.ilike.%${term}%`
      )
      .limit(100);

    if (dairyId) customerFilterQuery = customerFilterQuery.eq("dairy_id", dairyId);
    const { data: matchedCustomers } = await customerFilterQuery;
    const matchedCustomerIds = (matchedCustomers || []).map((c) => c.id).filter(Boolean);

    const orConditions = [];
    if (isNumeric) {
      orConditions.push(`id.eq.${parseInt(term, 10)}`);
    }
    if (matchedCustomerIds.length > 0) {
      orConditions.push(`customer_id.in.(${matchedCustomerIds.join(",")})`);
    }
    orConditions.push(`milk_type.ilike.%${term}%`);

    query = query.or(orConditions.join(","));
  }

  // Default sort: PENDING first, FAILED second, COMPLETED last, then created_at desc
  query = query
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    rows: data || [],
    total: count ?? (data ? data.length : 0),
  };
};

export const fetchAssignedDeliveryRow = async ({ agentDbId, dairyId = null, deliveryId } = {}) => {
  const parsedId = Number(deliveryId);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    const error = new Error("Valid deliveryId is required");
    error.statusCode = 400;
    throw error;
  }

  let query = supabase
    .from("deliveries")
    .select(
      "id, customer_id, dairy_id, agent_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, updated_at, created_at"
    )
    .eq("id", parsedId)
    .eq("agent_id", agentDbId)
    .limit(1);

  if (dairyId) query = query.eq("dairy_id", dairyId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) {
    const notFound = new Error("Assigned delivery not found");
    notFound.statusCode = 404;
    throw notFound;
  }

  return data;
};

export const findPaymentRowByDeliveryId = async ({ customerId, dairyId, deliveryId } = {}) => {
  const descriptionPattern = `%delivery_id=${deliveryId}%`;
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("customer_id", customerId)
    .eq("dairy_id", dairyId)
    .ilike("description", descriptionPattern)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const buildLookupMaps = async (rows) => {
  const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
  const dairyIds = [...new Set(rows.map((row) => row.dairy_id).filter(Boolean))];

  const [customersResp, dairiesResp] = await Promise.all([
    customerIds.length
      ? supabase
          .from("customers")
          .select("*")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    dairyIds.length
      ? supabase
          .from("dairies")
          .select("id, dairy_name, upi_id, latitude, longitude")
          .in("id", dairyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customersResp.error) throw customersResp.error;
  if (dairiesResp.error) throw dairiesResp.error;

  return {
    customersById: new Map((customersResp.data || []).map((row) => [row.id, row])),
    dairiesById: new Map((dairiesResp.data || []).map((row) => [row.id, row])),
  };
};
