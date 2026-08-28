// Admin UPI payment verification: queue listing, approval with settlement,
// and rejection. Approvals settle pending payments, spill excess to the
// wallet, and enqueue a WhatsApp confirmation.

import { supabase } from "../../../config/supabase.js";
import { addAmountToCustomerWallet } from "../../customer/payments.service.js";
import { enqueueWhatsAppNotification } from "../../shared/whatsapp.service.js";
import { writeAdminPaymentAudit } from "./audit.service.js";
import { getPendingPaymentsForCustomer } from "./queries.service.js";

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
