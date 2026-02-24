import { supabase } from "../../config/supabase.js";
import Razorpay from "razorpay";
import crypto from "crypto";

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

const fetchPaymentsRows = async (customerId, dairyId = null) => {
  const candidateCustomerColumns = ["customer_id", "user_id", "customerId", "customerid"];

  for (const customerColumn of candidateCustomerColumns) {
    let query = supabase
      .from("payments")
      .select("*")
      .eq(customerColumn, customerId)
      .order("created_at", { ascending: false });

    if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
      query = query.eq("dairy_id", dairyId);
    }

    const { data, error } = await query.limit(50);

    if (!error) return data || [];
    if (isMissingTableError(error)) return [];
    if (isMissingColumnError(error) || isUuidSyntaxError(error)) continue;
    throw error;
  }

  return [];
};

const mapPaymentRow = (row, index) => {
  const amount = toNumber(
    row.amount ?? row.total_amount ?? row.total ?? row.bill_amount ?? 0,
    0
  );
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

const getPendingPaymentForCustomer = async (customerId, paymentId = null, dairyId = null) => {
  let query = supabase
    .from("payments")
    .select("*")
    .eq("customer_id", customerId)
    .in("status", ["PENDING", "OVERDUE"]);

  if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
    query = query.eq("dairy_id", dairyId);
  }

  if (paymentId !== null && paymentId !== undefined) {
    query = query.eq("id", normalizePaymentId(paymentId));
  }

  const { data, error } = await query
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const createCustomerPaymentOrder = async ({ customerId, paymentId, dairyId = null }) => {
  const pendingPayment = await getPendingPaymentForCustomer(customerId, paymentId, dairyId);

  if (!pendingPayment) {
    throw new Error("No pending payment found");
  }

  const amountInRupees = toNumber(pendingPayment.amount, 0);
  if (amountInRupees <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const razorpay = getRazorpayClient();
  const beneficiary = await getDairyBankDetails(pendingPayment.dairy_id || dairyId);
  const order = await razorpay.orders.create({
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    receipt: `cust_${customerId}_pay_${pendingPayment.id}_${Date.now()}`.slice(0, 40),
    notes: {
      customer_id: String(customerId),
      payment_id: String(pendingPayment.id),
      dairy_id: String(pendingPayment.dairy_id ?? dairyId ?? ""),
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

  const normalizedPaymentId = normalizePaymentId(paymentId);
  let fetchQuery = supabase
    .from("payments")
    .select("id, customer_id, dairy_id, status")
    .eq("id", normalizedPaymentId)
    .eq("customer_id", customerId);

  if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
    fetchQuery = fetchQuery.eq("dairy_id", dairyId);
  }

  const { data: existingPayment, error: fetchError } = await fetchQuery.limit(1).maybeSingle();

  if (fetchError) throw fetchError;
  if (!existingPayment) throw new Error("Payment record not found");

  const updatePayload = {
    status: "PAID",
    method: "RAZORPAY",
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  };

  let updateQuery = supabase
    .from("payments")
    .update(updatePayload)
    .eq("id", normalizedPaymentId)
    .eq("customer_id", customerId);

  if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
    updateQuery = updateQuery.eq("dairy_id", dairyId);
  }

  const { error: updateError } = await updateQuery;

  if (updateError && isMissingColumnError(updateError)) {
    let fallbackUpdateQuery = supabase
      .from("payments")
      .update({
        status: "PAID",
        method: "RAZORPAY",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", normalizedPaymentId)
      .eq("customer_id", customerId);

    if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
      fallbackUpdateQuery = fallbackUpdateQuery.eq("dairy_id", dairyId);
    }

    const { error: fallbackError } = await fallbackUpdateQuery;
    if (fallbackError) throw fallbackError;
  } else if (updateError) {
    throw updateError;
  }

  return {
    success: true,
    paymentId: normalizedPaymentId,
    razorpayPaymentId,
    razorpayOrderId,
    status: "PAID",
  };
};

export const getCustomerPaymentsData = async (customerId, dairyId = null) => {
  const [walletBalance, paymentRows, beneficiary] = await Promise.all([
    getCustomerWalletBalance(customerId),
    fetchPaymentsRows(customerId, dairyId),
    getDairyBankDetails(dairyId),
  ]);

  const history = paymentRows.map(mapPaymentRow);
  const pendingCandidates = history.filter(
    (item) => item.status === "PENDING" || item.status === "OVERDUE"
  );
  const latestPending = pendingCandidates[0] || null;

  return {
    summary: {
      monthlyDue: latestPending?.amount || 0,
      walletBalance: toNumber(walletBalance, 0),
      dueInDays: latestPending ? diffDaysFromToday(latestPending.dueDate) : null,
      beneficiary,
    },
    history,
  };
};

