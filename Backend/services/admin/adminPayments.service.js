import { supabase } from "../../../config.js";

/* ================================
   1. FARM SUBSCRIPTION (Your Plan)
   ================================ */
export const getFarmSubscription = async (adminId) => {
  // Get the dairy linked to this admin
  const { data: dairy } = await supabase
    .from("dairies")
    .select("id, subscription_plan, subscription_status, valid_until")
    .eq("admin_id", adminId)
    .single();

  return dairy;
};

export const updateFarmPlan = async (dairyId, newPlan) => {
  const { data, error } = await supabase
    .from("dairies")
    .update({ 
      subscription_plan: newPlan,
      updated_at: new Date() 
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
export const getCustomerPayments = async ({ page, limit, search, status }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Query 'payments' table linked to customers
  let query = supabase
    .from("payments")
    .select(`
      id, amount, status, date, method,
      customers ( id, full_name, mobile ),
      memberships ( plan_name )
    `, { count: "exact" })
    .order("date", { ascending: false })
    .range(from, to);

  if (status && status !== "ALL") {
    query = query.eq("status", status); // 'PAID', 'PENDING', 'OVERDUE'
  }

  // Basic search by payment ID (Search by customer name is harder in Supabase joins without Views, skipping for simplicity)
  
  const { data, count, error } = await query;
  if (error) throw error;

  // Calculate Total Revenue (Simple sum of all 'PAID' payments)
  // Note: For large DBs, use a separate RPC function for sum
  const { data: totalRev } = await supabase
    .from("payments")
    .select("amount")
    .eq("status", "PAID");
  
  const totalAmount = totalRev?.reduce((sum, row) => sum + row.amount, 0) || 0;

  return { 
    payments: data, 
    total: count,
    revenue: totalAmount 
  };
};

export const updateCustomerPaymentStatus = async (paymentId, newStatus) => {
  const { data, error } = await supabase
    .from("payments")
    .update({ status: newStatus })
    .eq("id", paymentId)
    .select();
  
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