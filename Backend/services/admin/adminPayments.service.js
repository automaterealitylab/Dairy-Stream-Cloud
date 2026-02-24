import { supabase } from "../../config/supabase.js";

/* ================================
   1. FARM SUBSCRIPTION (Your Plan)
   ================================ */
export const getFarmSubscription = async ({ adminId, dairyId }) => {
  let resolvedDairyId = dairyId ?? null;

  if (!resolvedDairyId && adminId) {
    const { data: adminRow, error: adminError } = await supabase
      .from("admins")
      .select("dairy_id")
      .eq("id", adminId)
      .limit(1)
      .maybeSingle();

    if (adminError) throw adminError;
    resolvedDairyId = adminRow?.dairy_id ?? null;
  }

  if (!resolvedDairyId) return null;

  const { data: dairy, error } = await supabase
    .from("dairies")
    .select(
      "id, selected_plan, status, updated_at, bank_account_holder_name, bank_account_number, bank_ifsc_code, bank_name, bank_branch, upi_id"
    )
    .eq("id", resolvedDairyId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return dairy;
};

export const updateFarmPlan = async (dairyId, newPlan) => {
  const { data, error } = await supabase
    .from("dairies")
    .update({ 
      selected_plan: newPlan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dairyId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/* ================================
   2. CUSTOMER PAYMENTS
   ================================ */
export const getCustomerPayments = async ({ page, limit, status, dairyId }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("payments")
    .select("id, customer_id, dairy_id, amount, status, method, paid_at, due_date, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (dairyId) {
    query = query.eq("dairy_id", dairyId);
  }

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }
  
  const { data: payments, count, error } = await query;
  if (error) throw error;

  const customerIds = [...new Set((payments || []).map((item) => item.customer_id).filter(Boolean))];

  const [customersResp, membershipsResp, paidRowsResp] = await Promise.all([
    customerIds.length
      ? supabase
          .from("customers")
          .select("id, customer_name, email, phone_number")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabase
          .from("memberships")
          .select("customer_id, dairy_id, plan_name")
          .in("customer_id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "PAID")
      .eq("dairy_id", dairyId),
  ]);

  if (customersResp.error) throw customersResp.error;
  if (membershipsResp.error) throw membershipsResp.error;
  if (paidRowsResp.error) throw paidRowsResp.error;

  const customersById = new Map((customersResp.data || []).map((row) => [row.id, row]));
  const membershipByCustomer = new Map();
  for (const row of membershipsResp.data || []) {
    if (!membershipByCustomer.has(row.customer_id) && (!dairyId || row.dairy_id === dairyId)) {
      membershipByCustomer.set(row.customer_id, row);
    }
  }

  const normalizedPayments = (payments || []).map((row) => {
    const customer = customersById.get(row.customer_id) || {};
    const membership = membershipByCustomer.get(row.customer_id) || {};
    return {
      id: row.id,
      customer: customer.customer_name || customer.email || `Customer #${row.customer_id ?? "-"}`,
      plan: membership.plan_name || "Standard Plan",
      amount: Number(row.amount || 0),
      status: row.status || "PENDING",
      date: row.paid_at || row.created_at || row.due_date || null,
      method: row.method || "-",
    };
  });

  const totalAmount = (paidRowsResp.data || []).reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );

  return {
    payments: normalizedPayments,
    total: count || 0,
    revenue: totalAmount,
  };
};

export const updateCustomerPaymentStatus = async (paymentId, newStatus, dairyId) => {
  let query = supabase
    .from("payments")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...(String(newStatus).toUpperCase() === "PAID" ? { paid_at: new Date().toISOString() } : {}),
    })
    .eq("id", paymentId);

  if (dairyId) {
    query = query.eq("dairy_id", dairyId);
  }

  const { data, error } = await query.select();
  
  if (error) throw error;
  return data;
};

// Update Customer's Membership Plan
export const updateCustomerPlan = async (customerId, newPlanName) => {
  const { data, error } = await supabase
    .from("memberships")
    .update({ plan_name: newPlanName })
    .eq("user_id", customerId) // Assuming one active membership per user
    .select();

  if (error) throw error;
  return data;
};
