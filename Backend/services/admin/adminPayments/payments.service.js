// Admin customer payments listing, payment-status updates, and membership
// plan changes.

import { supabase } from "../../../config/supabase.js";
import { normalizePaymentDisplayStatus } from "./normalizers.js";

export const getCustomerPayments = async ({ page, limit, status, dairyId }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("payments")
    .select("id, customer_id, dairy_id, amount, status, verification_status, method, paid_at, due_date, created_at", {
      count: "exact",
    })
    .not("status", "in", '("CANCELLED","CANCELED")')
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

  let paidRowsQuery = supabase
    .from("payments")
    .select("amount")
    .eq("status", "PAID");

  let pendingRowsQuery = supabase
    .from("payments")
    .select("customer_id, amount, verification_status")
    .in("status", ["PENDING", "OVERDUE"]);

  if (dairyId) {
    paidRowsQuery = paidRowsQuery.eq("dairy_id", dairyId);
    pendingRowsQuery = pendingRowsQuery.eq("dairy_id", dairyId);
  }

  const [customersResp, membershipsResp, paidRowsResp, pendingRowsResp] = await Promise.all([
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
    paidRowsQuery,
    pendingRowsQuery,
  ]);

  if (customersResp.error) throw customersResp.error;
  if (membershipsResp.error) throw membershipsResp.error;
  if (paidRowsResp.error) throw paidRowsResp.error;
  if (pendingRowsResp.error) throw pendingRowsResp.error;

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
      customerId: row.customer_id,
      dairyId: row.dairy_id,
      customer: customer.customer_name || customer.email || `Customer #${row.customer_id ?? "-"}`,
      phone: customer.phone_number || "",
      plan: membership.plan_name || "Standard Plan",
      amount: Number(row.amount || 0),
      status: normalizePaymentDisplayStatus(row),
      verificationStatus: row.verification_status || "NOT_SUBMITTED",
      date: row.paid_at || row.created_at || row.due_date || null,
      method: row.method || "-",
    };
  });

  const totalAmount = (paidRowsResp.data || []).reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
  const pendingRows = (pendingRowsResp.data || []).filter(
    (row) => String(row.verification_status || "").toUpperCase() !== "SUBMITTED"
  );

  const pendingAmount = pendingRows.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
  const pendingCustomerCount = new Set(pendingRows.map((row) => row.customer_id).filter(Boolean)).size;

  return {
    payments: normalizedPayments,
    total: count || 0,
    revenue: totalAmount,
    pendingDues: {
      amount: Number(pendingAmount.toFixed(2)),
      customerCount: pendingCustomerCount,
    },
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
