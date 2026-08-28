// Subscription selection helpers for admin delivery scheduling.

import { supabase } from "../../../config/supabase.js";
import { isMissingColumnError } from "../../../utils/dbErrors.js";
import { isSubscriptionActive } from "./normalizers.js";

export const pickLatestSubscriptionByCustomer = (
  subscriptions,
  dairyId,
  { activeOnly = true } = {}
) => {
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

export const getSubscriptionMapForCustomers = async ({ customerIds, dairyId }) => {
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

export const getLatestActiveSubscriptionsForDairy = async ({ dairyId = null } = {}) => {
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
