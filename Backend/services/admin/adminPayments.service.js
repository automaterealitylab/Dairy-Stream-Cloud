import { supabase } from "../../config/supabase.js";
import { addAmountToCustomerWallet } from "../customer/payments.service.js";
import { enqueueWhatsAppNotification } from "../shared/whatsapp.service.js";

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
      "id, selected_plan, status, updated_at, bank_account_holder_name, bank_account_number, bank_ifsc_code, bank_name, bank_branch, upi_id, payment_instructions, upi_qr_enabled, bank_transfer_enabled, payment_verification_mode, payments_enabled"
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
      customerId: row.customer_id,
      dairyId: row.dairy_id,
      customer: customer.customer_name || customer.email || `Customer #${row.customer_id ?? "-"}`,
      phone: customer.phone_number || "",
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

const getPendingPaymentsForCustomer = async ({ customerId, dairyId }) => {
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

const markPaymentAsPaid = async ({ paymentId, method, paidAtIso }) => {
  const { error } = await supabase
    .from("payments")
    .update({
      status: "PAID",
      method: String(method || "OFFLINE").toUpperCase(),
      paid_at: paidAtIso,
      updated_at: paidAtIso,
    })
    .eq("id", paymentId);

  if (error) throw error;
};

const reducePendingPaymentAmount = async ({ paymentId, remainingAmount, paidAtIso }) => {
  const nextAmount = Number(Number(remainingAmount || 0).toFixed(2));
  const { error } = await supabase
    .from("payments")
    .update({
      amount: nextAmount,
      updated_at: paidAtIso,
    })
    .eq("id", paymentId);

  if (error) throw error;
};

const createOfflineCollectionEntry = async ({
  customerId,
  dairyId,
  settledAmount,
  method,
  paidAtIso,
  note,
}) => {
  if (settledAmount <= 0) return;

  const description = `[OFFLINE_COLLECTION_ADMIN] settled=${settledAmount}; note=${String(
    note || ""
  ).trim() || "-"}`.slice(0, 300);

  const { error } = await supabase
    .from("payments")
    .insert({
      customer_id: customerId,
      dairy_id: dairyId ?? null,
      amount: settledAmount,
      status: "PAID",
      method: String(method || "CASH").toUpperCase(),
      description,
      due_date: paidAtIso.slice(0, 10),
      paid_at: paidAtIso,
    });

  if (error) throw error;
};

export const collectCustomerOfflinePayment = async ({
  customerId,
  dairyId,
  receivedAmount,
  method = "CASH",
  note = "",
}) => {
  const normalizedReceived = Number(Number(receivedAmount || 0).toFixed(2));
  if (!Number.isFinite(normalizedReceived) || normalizedReceived <= 0) {
    throw new Error("receivedAmount must be greater than zero");
  }

  const pendingPayments = await getPendingPaymentsForCustomer({ customerId, dairyId });
  const paidAtIso = new Date().toISOString();
  let remaining = normalizedReceived;
  let settledAmount = 0;

  for (const row of pendingPayments) {
    if (remaining <= 0) break;

    const amount = Number(Number(row.amount || 0).toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (remaining >= amount) {
      await markPaymentAsPaid({
        paymentId: row.id,
        method,
        paidAtIso,
      });
      settledAmount += amount;
      remaining = Number((remaining - amount).toFixed(2));
      continue;
    }

    const nextPending = Number((amount - remaining).toFixed(2));
    await reducePendingPaymentAmount({
      paymentId: row.id,
      remainingAmount: nextPending,
      paidAtIso,
    });
    settledAmount += remaining;
    remaining = 0;
    break;
  }

  if (settledAmount > 0) {
    await createOfflineCollectionEntry({
      customerId,
      dairyId,
      settledAmount: Number(settledAmount.toFixed(2)),
      method,
      paidAtIso,
      note,
    });
  }

  let walletCredit = null;
  if (remaining > 0) {
    walletCredit = await addAmountToCustomerWallet({
      customerId,
      dairyId,
      amount: remaining,
      source: "ADMIN_OFFLINE_EXTRA",
      method: String(method || "CASH").toUpperCase(),
      description: `[WALLET_TOPUP_ADMIN_OFFLINE] excess=${remaining}; note=${String(note || "").trim() || "-"}`,
    });
  }

  const totalPendingAfter = (await getPendingPaymentsForCustomer({ customerId, dairyId })).reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );

  const { data: customerRow, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();

  if (customerError) throw customerError;

  if (customerRow && Object.prototype.hasOwnProperty.call(customerRow, "outstanding_balance")) {
    const { error: outstandingError } = await supabase
      .from("customers")
      .update({
        outstanding_balance: Number(totalPendingAfter.toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (outstandingError) throw outstandingError;
  }

  return {
    success: true,
    settledAmount: Number(settledAmount.toFixed(2)),
    walletCreditedAmount: walletCredit?.creditedAmount || 0,
    walletBalance: walletCredit?.walletBalance ?? null,
    pendingAmount: Number(totalPendingAfter.toFixed(2)),
  };
};

const writeAdminPaymentAudit = async ({
  adminId,
  dairyId,
  customerId = null,
  entityType,
  entityId,
  action,
  metadata = {},
}) => {
  await supabase
    .from("audit_logs")
    .insert({
      actor_type: "ADMIN",
      actor_id: adminId || null,
      dairy_id: dairyId || null,
      customer_id: customerId || null,
      entity_type: entityType,
      entity_id: entityId == null ? null : String(entityId),
      action,
      metadata,
    })
    .then(({ error }) => {
      const message = String(error?.message || "").toLowerCase();
      if (error && !(message.includes("relation") && message.includes("does not exist"))) {
        throw error;
      }
    });
};

export const getPaymentVerificationQueue = async ({ dairyId, status = "PENDING", limit = 50 }) => {
  let query = supabase
    .from("payment_verifications")
    .select("*")
    .eq("dairy_id", dairyId)
    .order("submitted_at", { ascending: false })
    .limit(limit);

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;

  const customerIds = [...new Set((data || []).map((row) => row.customer_id).filter(Boolean))];
  const paymentIds = [...new Set((data || []).map((row) => row.payment_id).filter(Boolean))];

  const [customersRes, paymentsRes] = await Promise.all([
    customerIds.length
      ? supabase.from("customers").select("id, customer_name, name, email, phone_number, phone").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    paymentIds.length
      ? supabase.from("payments").select("id, amount, status, description, due_date").in("id", paymentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customersRes.error) throw customersRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const customersById = new Map((customersRes.data || []).map((row) => [row.id, row]));
  const paymentsById = new Map((paymentsRes.data || []).map((row) => [row.id, row]));

  return (data || []).map((row) => {
    const customer = customersById.get(row.customer_id) || {};
    const payment = paymentsById.get(row.payment_id) || {};
    return {
      ...row,
      customerName: customer.customer_name || customer.name || customer.email || `Customer #${row.customer_id}`,
      customerPhone: customer.phone_number || customer.phone || "",
      paymentTitle: payment.description || "Dairy bill payment",
      paymentStatus: payment.status || null,
    };
  });
};

const settleVerificationPayments = async ({ verification, adminId, dairyId }) => {
  const paidAtIso = new Date().toISOString();
  const duplicateCheck = verification?.duplicate_check || {};
  const candidateIds = Array.isArray(duplicateCheck.paymentIds)
    ? duplicateCheck.paymentIds.filter(Boolean)
    : verification.payment_id
    ? [verification.payment_id]
    : [];

  const pendingPayments = candidateIds.length
    ? await supabase
        .from("payments")
        .select("id, amount, status")
        .eq("customer_id", verification.customer_id)
        .eq("dairy_id", dairyId)
        .in("id", candidateIds)
        .in("status", ["PENDING", "OVERDUE"])
        .order("due_date", { ascending: true, nullsFirst: false })
    : await supabase
        .from("payments")
        .select("id, amount, status")
        .eq("customer_id", verification.customer_id)
        .eq("dairy_id", dairyId)
        .in("status", ["PENDING", "OVERDUE"])
        .order("due_date", { ascending: true, nullsFirst: false });

  if (pendingPayments.error) throw pendingPayments.error;

  let remaining = Number(Number(verification.amount || 0).toFixed(2));
  const settledPaymentIds = [];

  for (const payment of pendingPayments.data || []) {
    if (remaining <= 0) break;

    const amount = Number(Number(payment.amount || 0).toFixed(2));
    if (remaining >= amount) {
      const { error } = await supabase
        .from("payments")
        .update({
          status: "PAID",
          method: "UPI",
          verification_status: "VERIFIED",
          utr_number: verification.utr_number,
          payment_screenshot_url: verification.screenshot_url || null,
          verified_at: paidAtIso,
          verified_by_admin_id: adminId || null,
          paid_at: paidAtIso,
          updated_at: paidAtIso,
        })
        .eq("id", payment.id)
        .eq("dairy_id", dairyId);

      if (error) throw error;
      settledPaymentIds.push(payment.id);
      remaining = Number((remaining - amount).toFixed(2));
      continue;
    }

    const { error } = await supabase
      .from("payments")
      .update({
        amount: Number((amount - remaining).toFixed(2)),
        verification_status: "PARTIALLY_VERIFIED",
        verification_note: `Partial UPI payment verified under UTR ${verification.utr_number}`,
        updated_at: paidAtIso,
      })
      .eq("id", payment.id)
      .eq("dairy_id", dairyId);

    if (error) throw error;

    const { error: paidEntryError } = await supabase.from("payments").insert({
      customer_id: verification.customer_id,
      dairy_id: dairyId,
      amount: remaining,
      status: "PAID",
      method: "UPI",
      description: `[UPI_PARTIAL_COLLECTION] source=verification; verification_id=${verification.id}`,
      due_date: paidAtIso.slice(0, 10),
      paid_at: paidAtIso,
      verification_status: "VERIFIED",
      utr_number: verification.utr_number,
      payment_screenshot_url: verification.screenshot_url || null,
      verified_at: paidAtIso,
      verified_by_admin_id: adminId || null,
    });

    if (paidEntryError) throw paidEntryError;
    settledPaymentIds.push(payment.id);
    remaining = 0;
  }

  if (remaining > 0) {
    await addAmountToCustomerWallet({
      customerId: verification.customer_id,
      dairyId,
      amount: remaining,
      source: "UPI_VERIFICATION_EXTRA",
      method: "UPI",
      description: `[WALLET_TOPUP_UPI_EXTRA] verification_id=${verification.id}; utr=${verification.utr_number}`,
    });
  }

  const totalPendingAfter = (await getPendingPaymentsForCustomer({
    customerId: verification.customer_id,
    dairyId,
  })).reduce((sum, row) => sum + Number(row.amount || 0), 0);

  await supabase
    .from("customers")
    .update({
      outstanding_balance: Number(totalPendingAfter.toFixed(2)),
      updated_at: paidAtIso,
    })
    .eq("id", verification.customer_id);

  return {
    settledPaymentIds,
    walletCreditAmount: Number(Math.max(0, remaining).toFixed(2)),
    pendingAmount: Number(totalPendingAfter.toFixed(2)),
  };
};

export const approvePaymentVerification = async ({ verificationId, dairyId, adminId }) => {
  const { data: verification, error } = await supabase
    .from("payment_verifications")
    .select("*")
    .eq("id", verificationId)
    .eq("dairy_id", dairyId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!verification) throw new Error("Payment verification not found");
  if (String(verification.status || "").toUpperCase() !== "PENDING") {
    throw new Error("Only pending verifications can be approved");
  }

  const settlement = await settleVerificationPayments({ verification, adminId, dairyId });
  const reviewedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("payment_verifications")
    .update({
      status: "APPROVED",
      reviewed_at: reviewedAt,
      reviewed_by_admin_id: adminId || null,
      updated_at: reviewedAt,
    })
    .eq("id", verificationId)
    .eq("dairy_id", dairyId)
    .select("*")
    .single();

  if (updateError) throw updateError;

  await writeAdminPaymentAudit({
    adminId,
    dairyId,
    customerId: verification.customer_id,
    entityType: "payment_verification",
    entityId: verificationId,
    action: "UPI_VERIFICATION_APPROVED",
    metadata: settlement,
  });

  const { data: customerRow } = await supabase
    .from("customers")
    .select("customer_name, name, phone_number, phone")
    .eq("id", verification.customer_id)
    .limit(1)
    .maybeSingle();

  const customerPhone = customerRow?.phone_number || customerRow?.phone;
  if (customerPhone) {
    await enqueueWhatsAppNotification({
      customerId: verification.customer_id,
      dairyId,
      phone: customerPhone,
      templateKey: "PAYMENT_CONFIRMATION",
      payload: {
        customerName: customerRow?.customer_name || customerRow?.name,
        amount: verification.amount,
        utrNumber: verification.utr_number,
      },
    }).catch(() => null);
  }

  return { verification: updated, settlement };
};

export const rejectPaymentVerification = async ({ verificationId, dairyId, adminId, reason = "" }) => {
  const reviewedAt = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("payment_verifications")
    .update({
      status: "REJECTED",
      rejection_reason: String(reason || "").trim() || "Rejected by dairy admin",
      reviewed_at: reviewedAt,
      reviewed_by_admin_id: adminId || null,
      updated_at: reviewedAt,
    })
    .eq("id", verificationId)
    .eq("dairy_id", dairyId)
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!updated) throw new Error("Pending payment verification not found");

  if (updated.payment_id) {
    await supabase
      .from("payments")
      .update({
        verification_status: "REJECTED",
        verification_note: updated.rejection_reason,
        updated_at: reviewedAt,
      })
      .eq("id", updated.payment_id)
      .eq("dairy_id", dairyId);
  }

  await writeAdminPaymentAudit({
    adminId,
    dairyId,
    customerId: updated.customer_id,
    entityType: "payment_verification",
    entityId: verificationId,
    action: "UPI_VERIFICATION_REJECTED",
    metadata: { reason: updated.rejection_reason },
  });

  return updated;
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
