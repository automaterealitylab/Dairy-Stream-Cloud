import { supabase } from "../../config/supabase.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import {
  getCurrentMonthSuccessfulSubscriptionDue,
  getLocalTodayIso,
  parseMonthlyBillMeta,
  syncCustomerMonthlyBills,
} from "./monthlyBilling.service.js";

const PAYMENT_CUSTOMER_COLUMNS = ["customer_id", "user_id", "customerId", "customerid"];
const MEMBERSHIP_CUSTOMER_COLUMNS = ["customer_id", "user_id", "customerId", "customerid"];
const SUBSCRIPTION_DELIVERY_PAYMENT_MARKER = "[SUBSCRIPTION_DELIVERY_PAYMENT]";
const ONE_TIME_PAYMENT_MARKER = "[ONE_TIME_PAYMENT]";
const WALLET_TOPUP_MARKER = "[WALLET_TOPUP";

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
};

const isMissingTableError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("relation") && message.includes("does not exist");
};

const isUuidSyntaxError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("invalid input syntax for type uuid");
};

const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const cloneEmptyValue = (value) => (Array.isArray(value) ? [] : value);

const hasQueryResult = (value) =>
  Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;

const maskAccountNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  const masked = "*".repeat(Math.max(0, digits.length - 4));
  return `${masked}${digits.slice(-4)}`;
};

const normalizeStatus = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "PAID") return "PAID";
  if (value === "PENDING") return "PENDING";
  if (value === "OVERDUE") return "OVERDUE";
  if (value === "FAILED") return "FAILED";
  return "PENDING";
};

const isDeliveredStatus = (status) => {
  const value = String(status || "").toUpperCase();
  return value === "DELIVERED" || value === "COMPLETED";
};

const parseDeliveryIdFromPaymentDescription = (description) => {
  const text = String(description || "");
  const match = text.match(/delivery_id=(\d+)/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isSubscriptionDeliveryPaymentRow = (row) =>
  String(row?.description || "").includes(SUBSCRIPTION_DELIVERY_PAYMENT_MARKER);

const isOneTimePaymentRow = (row) => {
  const description = String(row?.description || "");
  if (description.includes(ONE_TIME_PAYMENT_MARKER)) return true;
  return /\bone[_ -]?time\b/i.test(description);
};

const isWalletTopupPaymentRow = (row) => {
  const description = String(row?.description || "");
  if (description.includes(WALLET_TOPUP_MARKER)) return true;
  return /\bwallet\b/i.test(description);
};

const isMonthlyBillPaymentRow = (row) => {
  const monthMeta = parseMonthlyBillMeta(row?.description);
  if (monthMeta.isMonthlyBill) return true;

  if (row?.billing_month || row?.month) return true;

  const description = String(row?.description || "");
  if (!description) return false;

  if (/\b(one[_ -]?time|wallet)\b/i.test(description)) {
    return false;
  }

  return /\b(monthly bill|milk bill)\b/i.test(description);
};

const extractPaymentAmount = (row) =>
  toNumber(row?.amount ?? row?.total_amount ?? row?.total ?? row?.bill_amount ?? 0, 0);

const formatDate = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const diffDaysFromToday = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const today = new Date();
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const b = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
};

const normalizeMonthKey = (value) => {
  const monthKey = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : null;
};

const getPaymentMonthKey = (row) => {
  const monthMeta = parseMonthlyBillMeta(row?.description);
  const fallbackDate =
    row?.billing_month ||
    row?.month ||
    String(row?.due_date || row?.dueDate || row?.payment_date || row?.date || "").slice(0, 7);
  return normalizeMonthKey(monthMeta.monthKey || fallbackDate);
};

const getCustomerWalletBalance = async (customerId) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return 0;

  return (
    toNumber(data.wallet_balance, NaN) ||
    toNumber(data.walletBalance, NaN) ||
    toNumber(data.balance, 0)
  );
};

const runPaymentsCustomerQuery = async ({
  customerId,
  buildQuery,
  emptyValue,
}) => {
  let firstCompatibleColumn = null;
  let firstCompatibleValue = cloneEmptyValue(emptyValue);

  for (const customerColumn of PAYMENT_CUSTOMER_COLUMNS) {
    const { data, error } = await buildQuery(customerColumn);

    if (!error) {
      if (firstCompatibleColumn === null) {
        firstCompatibleColumn = customerColumn;
        firstCompatibleValue = data ?? cloneEmptyValue(emptyValue);
      }

      if (hasQueryResult(data)) {
        return { data, customerColumn };
      }

      continue;
    }

    if (isMissingTableError(error)) {
      return { data: cloneEmptyValue(emptyValue), customerColumn: null };
    }

    if (isMissingColumnError(error) || isUuidSyntaxError(error)) {
      continue;
    }

    throw error;
  }

  return {
    data: firstCompatibleValue,
    customerColumn: firstCompatibleColumn,
  };
};

const fetchPaymentsRows = async (customerId, dairyId = null) => {
  const { data } = await runPaymentsCustomerQuery({
    customerId,
    emptyValue: [],
    buildQuery: (customerColumn) => {
      let query = supabase
        .from("payments")
        .select("*")
        .eq(customerColumn, customerId)
        .order("created_at", { ascending: false });

      if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
        query = query.eq("dairy_id", dairyId);
      }

      return query.limit(50);
    },
  });

  return data || [];
};

const fetchCustomerDeliveryStatusById = async (customerId, dairyId = null) => {
  const { data } = await runPaymentsCustomerQuery({
    customerId,
    emptyValue: [],
    buildQuery: (customerColumn) => {
      let query = supabase
        .from("deliveries")
        .select("id, status")
        .eq(customerColumn, customerId)
        .order("delivery_date", { ascending: false });

      if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
        query = query.eq("dairy_id", dairyId);
      }

      return query.limit(2000);
    },
  });

  return new Map(
    (data || [])
      .map((row) => [Number(row?.id), String(row?.status || "").toUpperCase()])
      .filter(([deliveryId]) => Number.isFinite(deliveryId) && deliveryId > 0)
  );
};

const isDeliveredSubscriptionPaymentRow = (row, deliveryStatusById) => {
  if (!isSubscriptionDeliveryPaymentRow(row)) return false;

  const deliveryId = parseDeliveryIdFromPaymentDescription(row?.description);
  if (!deliveryId) return false;

  return isDeliveredStatus(deliveryStatusById.get(deliveryId));
};

const isVisibleCustomerPaymentRow = (row, deliveryStatusById) => {
  if (isWalletTopupPaymentRow(row)) return true;
  if (isOneTimePaymentRow(row)) return normalizeStatus(row?.status) === "PAID";
  if (isMonthlyBillPaymentRow(row)) return true;
  return false;
};

const isBillableCustomerPaymentRow = (row, deliveryStatusById) => {
  if (isWalletTopupPaymentRow(row)) return false;
  if (isOneTimePaymentRow(row)) return false;
  if (isMonthlyBillPaymentRow(row)) return true;
  return false;
};

const mapPaymentRow = (row, index) => {
  const amount = extractPaymentAmount(row);
  const status = normalizeStatus(row.status);
  const dateSource = row.payment_date || row.date || row.created_at || row.updated_at;
  const monthKey = getPaymentMonthKey(row);
  const monthMeta = parseMonthlyBillMeta(row.description);
  const monthLabel = row.billing_month || row.month || monthKey || null;
  const title = monthMeta.isMonthlyBill
    ? `${monthLabel ? `${monthLabel} Monthly Bill` : "Monthly Bill"}`
    : row.title || row.description || "Payment";

  return {
    id: row.id ?? `payment-${index}`,
    title,
    date: formatDate(dateSource),
    amount,
    status,
    method: row.method || row.payment_method || "-",
    dueDate: row.due_date || row.dueDate || null,
    monthKey,
  };
};

const normalizePaymentId = (value) => {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : value;
};

const getCustomerById = async (customerId) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

const creditCustomerWalletBalance = async ({
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

const createWalletLedgerEntry = async ({
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

const getRazorpayClient = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay is not configured on server");
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const getDairyBankDetails = async (dairyId) => {
  if (!dairyId) return null;

  const { data, error } = await supabase
    .from("dairies")
    .select(
      "id, dairy_name, bank_account_holder_name, bank_account_number, bank_ifsc_code, bank_name, bank_branch, upi_id"
    )
    .eq("id", dairyId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) return null;
    throw error;
  }

  if (!data) return null;

  return {
    dairyId: data.id,
    dairyName: data.dairy_name || "Dairy",
    accountHolderName: data.bank_account_holder_name || null,
    accountNumberMasked: maskAccountNumber(data.bank_account_number),
    ifscCode: data.bank_ifsc_code || null,
    bankName: data.bank_name || null,
    bankBranch: data.bank_branch || null,
    upiId: data.upi_id || null,
  };
};

const getMembershipDairyId = async (customerId) => {
  for (const customerColumn of MEMBERSHIP_CUSTOMER_COLUMNS) {
    const { data, error } = await supabase
      .from("memberships")
      .select("dairy_id")
      .eq(customerColumn, customerId)
      .limit(1)
      .maybeSingle();

    if (!error) {
      return data?.dairy_id ?? null;
    }

    if (isMissingTableError(error)) return null;
    if (isMissingColumnError(error) || isUuidSyntaxError(error)) continue;
    throw error;
  }

  return null;
};

const resolveCustomerDairyId = async (customerId, hintedDairyId = null, paymentRows = []) => {
  if (hintedDairyId !== null && hintedDairyId !== undefined && hintedDairyId !== "") {
    return hintedDairyId;
  }

  const membershipDairyId = await getMembershipDairyId(customerId);
  if (membershipDairyId) return membershipDairyId;

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("dairy_id")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();

  if (customerError) {
    if (!isMissingColumnError(customerError) && !isUuidSyntaxError(customerError)) {
      throw customerError;
    }
  } else if (customer?.dairy_id) {
    return customer.dairy_id;
  }

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("dairy_id, status, updated_at, created_at")
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (subscriptionError) {
    if (
      !isMissingTableError(subscriptionError) &&
      !isMissingColumnError(subscriptionError) &&
      !isUuidSyntaxError(subscriptionError)
    ) {
      throw subscriptionError;
    }
  } else {
    const activeSubscription = (subscriptions || []).find((row) => {
      const status = String(row?.status || "ACTIVE").trim().toUpperCase();
      return status !== "CLOSED" && status !== "CANCELLED" && status !== "CANCELED";
    });

    if (activeSubscription?.dairy_id) {
      return activeSubscription.dairy_id;
    }

    if (subscriptions?.[0]?.dairy_id) {
      return subscriptions[0].dairy_id;
    }
  }

  const paymentDairyId = (paymentRows || []).find((row) => row?.dairy_id)?.dairy_id;
  return paymentDairyId ?? null;
};

const getPendingPaymentForCustomer = async (customerId, paymentId = null, dairyId = null) => {
  const { data, customerColumn } = await runPaymentsCustomerQuery({
    customerId,
    emptyValue: null,
    buildQuery: (resolvedCustomerColumn) => {
      let query = supabase
        .from("payments")
        .select("*")
        .eq(resolvedCustomerColumn, customerId)
        .in("status", ["PENDING", "OVERDUE"]);

      if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
        query = query.eq("dairy_id", dairyId);
      }

      if (paymentId !== null && paymentId !== undefined) {
        query = query.eq("id", normalizePaymentId(paymentId));
      }

      return query
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    },
  });

  return {
    payment: data || null,
    customerColumn,
  };
};

const getPendingPaymentsForCustomer = async (customerId, dairyId = null) => {
  const { data, customerColumn } = await runPaymentsCustomerQuery({
    customerId,
    emptyValue: [],
    buildQuery: (resolvedCustomerColumn) => {
      let query = supabase
        .from("payments")
        .select("*")
        .eq(resolvedCustomerColumn, customerId)
        .in("status", ["PENDING", "OVERDUE"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
        query = query.eq("dairy_id", dairyId);
      }

      return query;
    },
  });

  return {
    payments: data || [],
    customerColumn,
  };
};

const getEligiblePendingPaymentsForCustomer = async (customerId, dairyId = null) => {
  const { payments, customerColumn } = await getPendingPaymentsForCustomer(customerId, dairyId);

  const eligiblePayments = (payments || []).filter((row) =>
    isBillableCustomerPaymentRow(row)
  );

  return {
    payments: eligiblePayments,
    customerColumn,
  };
};

const executePaymentUpdate = async ({
  customerColumn,
  customerId,
  dairyId = null,
  paymentId = null,
  statuses = null,
  payload,
}) => {
  let query = supabase
    .from("payments")
    .update(payload)
    .eq(customerColumn, customerId);

  if (paymentId !== null && paymentId !== undefined) {
    query = query.eq("id", normalizePaymentId(paymentId));
  }

  if (Array.isArray(statuses) && statuses.length > 0) {
    query = query.in("status", statuses);
  }

  if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
    query = query.eq("dairy_id", dairyId);
  }

  return query.select("id, status");
};

const buildPaidUpdatePayloadVariants = ({
  paymentMethod,
  paidAtIso,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const razorpayMeta = {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  };

  return [
    { status: "PAID", method: paymentMethod, paid_at: paidAtIso, updated_at: paidAtIso, ...razorpayMeta },
    { status: "PAID", payment_method: paymentMethod, payment_date: paidAtIso, updated_at: paidAtIso, ...razorpayMeta },
    { status: "PAID", payment_method: paymentMethod, paid_at: paidAtIso, updated_at: paidAtIso, ...razorpayMeta },
    { status: "PAID", method: paymentMethod, payment_date: paidAtIso, updated_at: paidAtIso, ...razorpayMeta },
    { status: "PAID", method: paymentMethod, paid_at: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", payment_method: paymentMethod, payment_date: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", payment_method: paymentMethod, paid_at: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", method: paymentMethod, payment_date: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", method: paymentMethod, updated_at: paidAtIso },
    { status: "PAID", payment_method: paymentMethod, updated_at: paidAtIso },
    { status: "PAID", paid_at: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", payment_date: paidAtIso, updated_at: paidAtIso },
    { status: "PAID", updated_at: paidAtIso },
    { status: "PAID" },
  ];
};

const updatePaymentsWithFallbacks = async ({
  customerColumn,
  customerId,
  dairyId = null,
  paymentId = null,
  statuses = null,
  payloadVariants,
}) => {
  let lastMissingColumnError = null;

  for (const payload of payloadVariants) {
    const { data, error } = await executePaymentUpdate({
      customerColumn,
      customerId,
      dairyId,
      paymentId,
      statuses,
      payload,
    });

    if (!error) {
      return data || [];
    }

    if (isMissingColumnError(error)) {
      lastMissingColumnError = error;
      continue;
    }

    throw error;
  }

  if (lastMissingColumnError) {
    throw lastMissingColumnError;
  }

  return [];
};

export const createCustomerPaymentOrder = async ({ customerId, paymentId, dairyId = null, payAll = false }) => {
  await syncCustomerMonthlyBills(customerId);
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);

  if (payAll) {
    const { payments: pendingPayments } = await getEligiblePendingPaymentsForCustomer(
      customerId,
      resolvedDairyId
    );
    if (!pendingPayments.length) {
      throw new Error("No pending payment found");
    }

    const amountInRupees = pendingPayments.reduce(
      (sum, row) => sum + extractPaymentAmount(row),
      0
    );
    if (amountInRupees <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const firstPending = pendingPayments[0];
    const razorpay = getRazorpayClient();
    const beneficiary = await getDairyBankDetails(
      firstPending?.dairy_id || resolvedDairyId
    );
    const order = await razorpay.orders.create({
      amount: Math.round(amountInRupees * 100),
      currency: "INR",
      receipt: `cust_${customerId}_payall_${Date.now()}`.slice(0, 40),
      notes: {
        customer_id: String(customerId),
        payment_mode: "ALL",
        dairy_id: String(firstPending?.dairy_id ?? resolvedDairyId ?? ""),
      },
    });

    return {
      keyId: process.env.RAZORPAY_KEY_ID,
      order,
      payment: {
        id: null,
        amount: amountInRupees,
        title: "Pending + Overdue Bills",
      },
      beneficiary,
    };
  }

  let pendingPayment = null;

  if (paymentId !== null && paymentId !== undefined) {
    const { payment } = await getPendingPaymentForCustomer(customerId, paymentId, resolvedDairyId);
    if (payment && isBillableCustomerPaymentRow(payment)) {
      pendingPayment = payment;
    }
  } else {
    const { payments } = await getEligiblePendingPaymentsForCustomer(customerId, resolvedDairyId);
    pendingPayment = payments[0] || null;
  }

  if (!pendingPayment) {
    throw new Error("No pending payment found");
  }

  const amountInRupees = extractPaymentAmount(pendingPayment);
  if (amountInRupees <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const razorpay = getRazorpayClient();
  const beneficiary = await getDairyBankDetails(
    pendingPayment.dairy_id || resolvedDairyId
  );
  const order = await razorpay.orders.create({
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    receipt: `cust_${customerId}_pay_${pendingPayment.id}_${Date.now()}`.slice(0, 40),
    notes: {
      customer_id: String(customerId),
      payment_id: String(pendingPayment.id),
      dairy_id: String(pendingPayment.dairy_id ?? resolvedDairyId ?? ""),
    },
  });

  return {
    keyId: process.env.RAZORPAY_KEY_ID,
    order,
    payment: {
      id: pendingPayment.id,
      amount: amountInRupees,
      title:
        pendingPayment.description ||
        (pendingPayment.billing_month
          ? `${pendingPayment.billing_month} Milk Bill`
          : "Milk Bill"),
    },
    beneficiary,
  };
};

export const verifyCustomerPayment = async ({
  customerId,
  paymentId,
  dairyId = null,
  payAll = false,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error("Missing Razorpay verification fields");
  }

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new Error("Payment signature verification failed");
  }

  const paidAtIso = new Date().toISOString();
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);
  const payloadVariants = buildPaidUpdatePayloadVariants({
    paymentMethod: "RAZORPAY",
    paidAtIso,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  if (payAll) {
    const { payments: pendingPayments, customerColumn } = await getEligiblePendingPaymentsForCustomer(
      customerId,
      resolvedDairyId
    );

    if (!pendingPayments.length || !customerColumn) {
      throw new Error("No pending payment found");
    }

    for (const row of pendingPayments) {
      await updatePaymentsWithFallbacks({
        customerColumn,
        customerId,
        dairyId: resolvedDairyId,
        paymentId: row.id,
        payloadVariants,
      });
    }

    return {
      success: true,
      paymentId: null,
      razorpayPaymentId,
      razorpayOrderId,
      status: "PAID",
    };
  }

  const normalizedPaymentId = normalizePaymentId(paymentId);
  const {
    payment: existingPayment,
    customerColumn,
  } = await getPendingPaymentForCustomer(customerId, normalizedPaymentId, resolvedDairyId);
  const deliveryStatusById = await fetchCustomerDeliveryStatusById(customerId, resolvedDairyId);

  if (
    !existingPayment ||
    !customerColumn ||
    !isBillableCustomerPaymentRow(existingPayment, deliveryStatusById)
  ) {
    throw new Error("Payment record not found");
  }

  await updatePaymentsWithFallbacks({
    customerColumn,
    customerId,
    dairyId: resolvedDairyId,
    paymentId: normalizedPaymentId,
    payloadVariants,
  });

  return {
    success: true,
    paymentId: normalizedPaymentId,
    razorpayPaymentId,
    razorpayOrderId,
    status: "PAID",
  };
};

export const createCustomerWalletTopupOrder = async ({
  customerId,
  dairyId = null,
  amount,
}) => {
  const amountInRupees = Number(Number(amount || 0).toFixed(2));
  if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
    throw new Error("Wallet top-up amount must be greater than zero");
  }
  if (amountInRupees < 10) {
    throw new Error("Minimum wallet top-up amount is 10");
  }

  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);
  const razorpay = getRazorpayClient();
  const order = await razorpay.orders.create({
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    receipt: `cust_${customerId}_wallet_${Date.now()}`.slice(0, 40),
    notes: {
      customer_id: String(customerId),
      payment_mode: "WALLET_TOPUP",
      dairy_id: String(resolvedDairyId ?? ""),
      amount_inr: String(amountInRupees),
    },
  });

  return {
    keyId: process.env.RAZORPAY_KEY_ID,
    order,
    amount: amountInRupees,
  };
};

export const verifyCustomerWalletTopup = async ({
  customerId,
  dairyId = null,
  amount,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error("Missing Razorpay verification fields");
  }

  const amountInRupees = Number(Number(amount || 0).toFixed(2));
  if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
    throw new Error("Wallet top-up amount must be greater than zero");
  }

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new Error("Payment signature verification failed");
  }

  const { data: existingTopup, error: existingTopupError } = await supabase
    .from("payments")
    .select("id")
    .eq("customer_id", customerId)
    .eq("razorpay_payment_id", razorpayPaymentId)
    .limit(1)
    .maybeSingle();

  if (existingTopupError && !isMissingColumnError(existingTopupError)) {
    throw existingTopupError;
  }
  if (existingTopup?.id) {
    throw new Error("This wallet top-up has already been processed");
  }

  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);
  const walletUpdate = await creditCustomerWalletBalance({
    customerId,
    amount: amountInRupees,
  });

  const paidAtIso = new Date().toISOString();
  const payment = await createWalletLedgerEntry({
    customerId,
    dairyId: resolvedDairyId,
    amount: amountInRupees,
    method: "RAZORPAY",
    description: `[WALLET_TOPUP_CUSTOMER] source=customer; order_id=${razorpayOrderId}; payment_id=${razorpayPaymentId}`,
    paidAtIso,
    extraPayload: {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    },
  });

  return {
    success: true,
    walletBalance: walletUpdate.walletBalance,
    creditedAmount: walletUpdate.creditedAmount,
    paymentId: payment?.id || null,
  };
};

export const addAmountToCustomerWallet = async ({
  customerId,
  dairyId = null,
  amount,
  source = "SYSTEM",
  method = "WALLET",
  description = "",
}) => {
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);
  const walletUpdate = await creditCustomerWalletBalance({ customerId, amount });
  const entry = await createWalletLedgerEntry({
    customerId,
    dairyId: resolvedDairyId,
    amount: walletUpdate.creditedAmount,
    method,
    description:
      description ||
      `[WALLET_TOPUP] source=${String(source || "SYSTEM").toLowerCase()}; amount=${walletUpdate.creditedAmount}`,
  });

  return {
    ...walletUpdate,
    paymentId: entry?.id || null,
  };
};

export const getCustomerPaymentsData = async (customerId, dairyId = null) => {
  await syncCustomerMonthlyBills(customerId);
  const [payableTillDateData, walletBalance, paymentRows] = await Promise.all([
    getCurrentMonthSuccessfulSubscriptionDue(customerId),
    getCustomerWalletBalance(customerId),
    fetchPaymentsRows(customerId, dairyId),
  ]);
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId, paymentRows);
  const beneficiary = await getDairyBankDetails(resolvedDairyId);
  const payableTillDate = Number(payableTillDateData?.payableTillDate || 0);

  const history = paymentRows
    .filter((row) => isVisibleCustomerPaymentRow(row))
    .map(mapPaymentRow);
  const pendingCandidates = paymentRows
    .filter((row) => isBillableCustomerPaymentRow(row))
    .map(mapPaymentRow)
    .filter(
    (item) => item.status === "PENDING" || item.status === "OVERDUE"
    );
  const totalPendingAndOverdue = pendingCandidates.reduce(
    (sum, item) => sum + toNumber(item.amount, 0),
    0
  );
  const currentMonthKey = String(getLocalTodayIso()).slice(0, 7);
  const historicalPendingAndOverdue = pendingCandidates.reduce((sum, item) => {
    return item.monthKey === currentMonthKey ? sum : sum + toNumber(item.amount, 0);
  }, 0);
  const currentMonthPendingAndOverdue = pendingCandidates.reduce((sum, item) => {
    return item.monthKey === currentMonthKey ? sum + toNumber(item.amount, 0) : sum;
  }, 0);
  const fallbackLiveBillingSummaryAmount =
    historicalPendingAndOverdue +
    Math.max(currentMonthPendingAndOverdue, toNumber(payableTillDate, 0));
  const liveBillingSummaryAmount =
    totalPendingAndOverdue > 0 ? totalPendingAndOverdue : fallbackLiveBillingSummaryAmount;
  const nearestDueInDays = pendingCandidates.reduce((nearest, item) => {
    const days = diffDaysFromToday(item.dueDate);
    if (days === null) return nearest;
    if (nearest === null) return days;
    return days < nearest ? days : nearest;
  }, null);

  return {
    summary: {
      monthlyDue: totalPendingAndOverdue,
      walletBalance: toNumber(walletBalance, 0),
      payableTillDate: toNumber(payableTillDate, 0),
      billingSummaryAmount: Number(liveBillingSummaryAmount.toFixed(2)),
      dueInDays: nearestDueInDays,
      beneficiary,
    },
    history,
  };
};

