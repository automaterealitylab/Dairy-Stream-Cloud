// Customer wallet balance operations and their ledger entries.

import { supabase } from "../../../config/supabase.js";
import { isMissingColumnError } from "../../../utils/dbErrors.js";
import { getCustomerById } from "./queries.service.js";
import { toNumber } from "./normalizers.js";

export const creditCustomerWalletBalance = async ({
  customerId,
  amount,
}) => {
  const normalizedAmount = Number(Number(amount || 0).toFixed(2));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error("Wallet credit amount must be greater than zero");
  }

  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");

  const currentWallet =
    toNumber(customer.wallet_balance, NaN) ||
    toNumber(customer.walletBalance, NaN) ||
    toNumber(customer.balance, 0);

  const nextWallet = Number((currentWallet + normalizedAmount).toFixed(2));
  const payload = { updated_at: new Date().toISOString() };

  if (Object.prototype.hasOwnProperty.call(customer, "wallet_balance")) {
    payload.wallet_balance = nextWallet;
  }
  if (Object.prototype.hasOwnProperty.call(customer, "walletBalance")) {
    payload.walletBalance = nextWallet;
  }
  if (Object.prototype.hasOwnProperty.call(customer, "balance")) {
    payload.balance = nextWallet;
  }

  if (
    !Object.prototype.hasOwnProperty.call(payload, "wallet_balance") &&
    !Object.prototype.hasOwnProperty.call(payload, "walletBalance") &&
    !Object.prototype.hasOwnProperty.call(payload, "balance")
  ) {
    payload.wallet_balance = nextWallet;
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", customerId);

  if (updateError) throw updateError;

  return {
    previousWalletBalance: Number(currentWallet.toFixed(2)),
    walletBalance: nextWallet,
    creditedAmount: normalizedAmount,
  };
};

export const debitCustomerWalletBalance = async ({
  customerId,
  amount,
}) => {
  const normalizedAmount = Number(Number(amount || 0).toFixed(2));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error("Wallet debit amount must be greater than zero");
  }

  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Customer not found");

  const currentWallet =
    toNumber(customer.wallet_balance, NaN) ||
    toNumber(customer.walletBalance, NaN) ||
    toNumber(customer.balance, 0);

  if (currentWallet < normalizedAmount) {
    throw new Error("Insufficient wallet balance");
  }

  const nextWallet = Number((currentWallet - normalizedAmount).toFixed(2));
  const payload = { updated_at: new Date().toISOString() };

  if (Object.prototype.hasOwnProperty.call(customer, "wallet_balance")) {
    payload.wallet_balance = nextWallet;
  }
  if (Object.prototype.hasOwnProperty.call(customer, "walletBalance")) {
    payload.walletBalance = nextWallet;
  }
  if (Object.prototype.hasOwnProperty.call(customer, "balance")) {
    payload.balance = nextWallet;
  }

  if (
    !Object.prototype.hasOwnProperty.call(payload, "wallet_balance") &&
    !Object.prototype.hasOwnProperty.call(payload, "walletBalance") &&
    !Object.prototype.hasOwnProperty.call(payload, "balance")
  ) {
    payload.wallet_balance = nextWallet;
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", customerId);

  if (updateError) throw updateError;

  return {
    previousWalletBalance: Number(currentWallet.toFixed(2)),
    walletBalance: nextWallet,
    debitedAmount: normalizedAmount,
  };
};

export const createWalletLedgerEntry = async ({
  customerId,
  dairyId,
  amount,
  method,
  description,
  paidAtIso = new Date().toISOString(),
  extraPayload = {},
}) => {
  const normalizedAmount = Number(Number(amount || 0).toFixed(2));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) return null;

  const basePayload = {
    customer_id: customerId,
    dairy_id: dairyId ?? null,
    amount: normalizedAmount,
    status: "PAID",
    method: String(method || "WALLET").trim().toUpperCase(),
    description: String(description || "[WALLET_TOPUP]").slice(0, 300),
    due_date: paidAtIso.slice(0, 10),
    paid_at: paidAtIso,
  };

  const payloadVariants = [
    { ...basePayload, ...extraPayload },
    basePayload,
    {
      ...basePayload,
      payment_method: basePayload.method,
      method: undefined,
      payment_date: paidAtIso,
      paid_at: undefined,
    },
  ];

  let lastMissingColumnError = null;
  for (const payload of payloadVariants) {
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    );

    const { data, error } = await supabase
      .from("payments")
      .insert(cleanPayload)
      .select("id, amount, status, method, description, created_at")
      .maybeSingle();

    if (!error) return data || null;
    if (isMissingColumnError(error)) {
      lastMissingColumnError = error;
      continue;
    }
    throw error;
  }

  if (lastMissingColumnError) throw lastMissingColumnError;
  return null;
};
