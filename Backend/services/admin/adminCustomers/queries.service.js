// Database read helpers for the admin customers domain: candidate-column row
// fetches, product-rate lookup with a shared cache, and the customer details
// composite (customer + membership + subscription + agent + dairy).

import { supabase } from "../../../config/supabase.js";
import { decryptDeterministic } from "../../../utils/crypto.js";
import { toNumber } from "./normalizers.js";

export const fetchRowsByCandidateCustomerColumns = async ({
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

export const getProductRate = async ({ dairyId, productName }, rateCache) => {
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

export const getCustomerDetails = async (customerId, options = {}) => {
  const dairyId = typeof options === "object" && options !== null ? options.dairyId : options;

  if (dairyId) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("customer_id", customerId)
      .eq("dairy_id", dairyId)
      .neq("status", "CLOSED")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Customer not found for this dairy");
  }

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

  let subscriptionQuery = supabase
    .from("subscriptions")
    .select("*")
    .eq("customer_id", customerId);

  if (dairyId) subscriptionQuery = subscriptionQuery.eq("dairy_id", dairyId);

  const { data: subscriptionRow, error: subscriptionError } = await subscriptionQuery
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) throw subscriptionError;
  subscription = subscriptionRow ?? null;

  const effectiveDairyId = subscription?.dairy_id || membership?.dairy_id || null;

  if (effectiveDairyId) {
    const { data } = await supabase
      .from("dairies")
      .select("*")
      .eq("id", effectiveDairyId)
      .maybeSingle();
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
