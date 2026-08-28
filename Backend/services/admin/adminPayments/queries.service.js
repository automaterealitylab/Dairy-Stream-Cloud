// Database read helpers shared across the admin payments modules.

import { supabase } from "../../../config/supabase.js";

export const getPendingPaymentsForCustomer = async ({ customerId, dairyId }) => {
  let query = supabase
    .from("payments")
    .select("id, amount, status, due_date, created_at")
    .eq("customer_id", customerId)
    .in("status", ["PENDING", "OVERDUE"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (dairyId) query = query.eq("dairy_id", dairyId);

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};
