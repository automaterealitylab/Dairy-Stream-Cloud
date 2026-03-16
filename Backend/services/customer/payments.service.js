import { supabase } from "../../config/supabase.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const PAYMENT_CUSTOMER_COLUMNS = ["customer_id", "user_id", "customerId", "customerid"];
const MEMBERSHIP_CUSTOMER_COLUMNS = ["customer_id", "user_id", "customerId", "customerid"];

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

const mapPaymentRow = (row, index) => {
  const amount = extractPaymentAmount(row);
  const status = normalizeStatus(row.status);
  const dateSource = row.payment_date || row.date || row.created_at || row.updated_at;
  const monthLabel = row.billing_month || row.month || null;

  return {
    id: row.id ?? `payment-${index}`,
    title: row.title || row.description || (monthLabel ? `${monthLabel} Milk Bill` : "Milk Bill"),
    date: formatDate(dateSource),
    amount,
    status,
    method: row.method || row.payment_method || "-",
    dueDate: row.due_date || row.dueDate || null,
  };
};

const normalizePaymentId = (value) => {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : value;
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
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);

  if (payAll) {
    const { payments: pendingPayments } = await getPendingPaymentsForCustomer(
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

  const { payment: pendingPayment } = await getPendingPaymentForCustomer(
    customerId,
    paymentId,
    resolvedDairyId
  );

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
    const { payments: pendingPayments, customerColumn } = await getPendingPaymentsForCustomer(
      customerId,
      resolvedDairyId
    );

    if (!pendingPayments.length || !customerColumn) {
      throw new Error("No pending payment found");
    }

    await updatePaymentsWithFallbacks({
      customerColumn,
      customerId,
      dairyId: resolvedDairyId,
      statuses: ["PENDING", "OVERDUE"],
      payloadVariants,
    });

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

  if (!existingPayment || !customerColumn) {
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

export const getCustomerPaymentsData = async (customerId, dairyId = null) => {
  const [walletBalance, paymentRows] = await Promise.all([
    getCustomerWalletBalance(customerId),
    fetchPaymentsRows(customerId, dairyId),
  ]);
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId, paymentRows);
  const beneficiary = await getDairyBankDetails(resolvedDairyId);

  const history = paymentRows.map(mapPaymentRow);
  const pendingCandidates = history.filter(
    (item) => item.status === "PENDING" || item.status === "OVERDUE"
  );
  const totalPendingAndOverdue = pendingCandidates.reduce(
    (sum, item) => sum + toNumber(item.amount, 0),
    0
  );
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
      dueInDays: nearestDueInDays,
      beneficiary,
    },
    history,
  };
};

