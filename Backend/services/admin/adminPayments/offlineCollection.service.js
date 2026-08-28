// Admin offline cash/UPI collection: settle received amounts against pending
// payments, spill excess into the customer wallet, and refresh outstanding
// balance.

import { supabase } from "../../../config/supabase.js";
import { addAmountToCustomerWallet } from "../../customer/payments.service.js";
import { getPendingPaymentsForCustomer } from "./queries.service.js";

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
