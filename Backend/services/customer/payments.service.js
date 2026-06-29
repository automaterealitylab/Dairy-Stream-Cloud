import { supabase } from "../../config/supabase.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { getRazorpayConfig } from "../../config/razorpay.js";
import {
  MONTHLY_BILL_MARKER,
  getCurrentMonthSuccessfulSubscriptionDue,
  getLocalTodayIso,
  parseMonthlyBillMeta,
  syncCustomerMonthlyBills,
} from "./monthlyBilling.service.js";
import {
  analyzeUpiVerificationSubmission,
  writeFraudAlertsForVerification,
} from "./smartPaymentVerification.service.js";

const PAYMENT_CUSTOMER_COLUMNS = ["customer_id", "user_id", "customerId", "customerid"];
const MEMBERSHIP_CUSTOMER_COLUMNS = ["customer_id", "user_id", "customerId", "customerid"];
const SUBSCRIPTION_DELIVERY_PAYMENT_MARKER = "[SUBSCRIPTION_DELIVERY_PAYMENT]";
const ONE_TIME_PAYMENT_MARKER = "[ONE_TIME_PAYMENT]";
const WALLET_TOPUP_MARKER = "[WALLET_TOPUP";
const ONE_TIME_ORDER_CANCEL_MARKER = "[ONE_TIME_ORDER_CANCEL]";

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

const OVERDUE_PENALTY_RATE = 0.01;

const isDeliveredStatus = (status) => {
  const value = String(status || "").toUpperCase();
  return value === "DELIVERED" || value === "COMPLETED";
};

const isCancelledStatus = (status) => {
  const value = String(status || "").toUpperCase();
  return value === "CANCELLED" || value === "CANCELED";
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
  if (description.includes(ONE_TIME_ORDER_CANCEL_MARKER)) return true;
  return /\bwallet\b/i.test(description);
};

const isCancelledOneTimePaymentRow = (row, deliveryStatusById) => {
  if (!isOneTimePaymentRow(row)) return false;

  const deliveryId = parseDeliveryIdFromPaymentDescription(row?.description);
  if (!deliveryId) return false;

  return isCancelledStatus(deliveryStatusById.get(deliveryId));
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

const getOverduePenaltyAmount = (row) => {
  const status = normalizeStatus(row?.status);
  if (status !== "OVERDUE") return 0;

  const baseAmount = extractPaymentAmount(row);
  if (baseAmount <= 0) return 0;

  return Number((baseAmount * OVERDUE_PENALTY_RATE).toFixed(2));
};

const getEffectivePaymentAmount = (row) => {
  const baseAmount = extractPaymentAmount(row);
  const overduePenaltyAmount = getOverduePenaltyAmount(row);

  return {
    baseAmount: Number(baseAmount.toFixed(2)),
    overduePenaltyAmount,
    totalAmount: Number((baseAmount + overduePenaltyAmount).toFixed(2)),
  };
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
  if (isOneTimePaymentRow(row)) {
    if (isCancelledOneTimePaymentRow(row, deliveryStatusById)) return false;
    return normalizeStatus(row?.status) === "PAID";
  }
  if (isMonthlyBillPaymentRow(row)) return true;
  return false;
};

const isBillableCustomerPaymentRow = (row, deliveryStatusById) => {
  if (isWalletTopupPaymentRow(row)) return false;
  if (isOneTimePaymentRow(row)) return false;
  if (isMonthlyBillPaymentRow(row)) return true;
  return false;
};

const isDirectCheckoutCustomerPaymentRow = (row, deliveryStatusById) => {
  if (isWalletTopupPaymentRow(row)) return false;
  if (isOneTimePaymentRow(row)) {
    if (isCancelledOneTimePaymentRow(row, deliveryStatusById)) return false;
    const status = normalizeStatus(row?.status);
    return status === "PENDING" || status === "OVERDUE";
  }
  return isBillableCustomerPaymentRow(row, deliveryStatusById);
};

const mapPaymentRow = (row, index) => {
  const { baseAmount, overduePenaltyAmount, totalAmount } = getEffectivePaymentAmount(row);
  const status = normalizeStatus(row.status);
  const dateSource = row.payment_date || row.date || row.created_at || row.updated_at;
  const monthKey = getPaymentMonthKey(row);
  const monthMeta = parseMonthlyBillMeta(row.description);
  const monthLabel = row.billing_month || row.month || monthKey || null;
  let title = monthMeta.isMonthlyBill
    ? `${monthLabel ? `${monthLabel} Monthly Bill` : "Monthly Bill"}`
    : row.title || row.description || "Payment";

  if (String(row?.description || "").includes(ONE_TIME_ORDER_CANCEL_MARKER)) {
    title = "Refund to Wallet";
  }

  return {
    id: row.id ?? `payment-${index}`,
    title,
    date: formatDate(dateSource),
    amount: totalAmount,
    baseAmount,
    overduePenaltyAmount,
    status,
    method: row.method || row.payment_method || "-",
    dueDate: row.due_date || row.dueDate || null,
    monthKey,
    verificationStatus: row.verification_status || "NOT_SUBMITTED",
    utrNumber: row.utr_number || null,
    submittedAt: row.submitted_at || null,
  };
};

const normalizePaymentId = (value) => {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : value;
};

const getCurrentMonthKey = () => String(getLocalTodayIso()).slice(0, 7);

const buildCurrentMonthBillDescription = (monthKey) =>
  `${MONTHLY_BILL_MARKER} month=${monthKey}; deliveries=0; subscription=0`.slice(0, 300);

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
  if (process.env.RAZORPAY_MOCK === "true") {
    return {
      orders: {
        create: async (payload) => {
          return {
            id: `order_mock_${Math.random().toString(36).substr(2, 9)}`,
            entity: "order",
            amount: payload.amount,
            amount_paid: 0,
            amount_due: payload.amount,
            currency: payload.currency,
            receipt: payload.receipt,
            status: "created",
            attempts: 0,
            notes: payload.notes || {},
            created_at: Math.floor(Date.now() / 1000),
          };
        }
      }
    };
  }
  const { keyId, keySecret } = getRazorpayConfig();

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

const getRazorpayOrderContext = async ({ dairyId, amountInRupees, notes = {} }) => {
  const { beneficiary, transfers } = await buildOrderTransfers({
    dairyId,
    amountInRupees,
    notes,
  });

  return {
    razorpay: getRazorpayClient(),
    keyId: getRazorpayConfig().keyId,
    beneficiary,
    transfers,
  };
};

const getRazorpayVerificationSecret = async (dairyId) => {
  return getRazorpayConfig().keySecret;
};

const getDairyPayoutDetails = async (dairyId) => {
  if (!dairyId) return null;

  const { data, error } = await supabase
    .from("dairies")
    .select(
      "id, dairy_name, bank_account_holder_name, bank_account_number, bank_ifsc_code, bank_name, bank_branch, upi_id, razorpay_linked_account_id, upi_qr_enabled, bank_transfer_enabled, one_time_accept_direct_upi, one_time_accept_razorpay, subscription_accept_direct_upi, subscription_accept_razorpay"
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
    upiQrEnabled: data.upi_qr_enabled !== false,
    bankTransferEnabled: data.bank_transfer_enabled !== false,
    oneTimePaymentMethod: data.one_time_accept_razorpay ? "RAZORPAY" : "DIRECT_UPI",
    subscriptionPaymentMethod: data.subscription_accept_razorpay ? "RAZORPAY" : "DIRECT_UPI",
    oneTimeAcceptDirectUpi: data.one_time_accept_direct_upi !== false,
    oneTimeAcceptRazorpay: Boolean(data.one_time_accept_razorpay),
    subscriptionAcceptDirectUpi: data.subscription_accept_direct_upi !== false,
    subscriptionAcceptRazorpay: Boolean(data.subscription_accept_razorpay),
    razorpayLinkedAccountId: String(data.razorpay_linked_account_id || "").trim() || null,
  };
};

const getRequiredDairyTransferConfig = async (dairyId) => {
  const payoutDetails = await getDairyPayoutDetails(dairyId);
  const linkedAccountId = String(payoutDetails?.razorpayLinkedAccountId || "").trim();

  if (!linkedAccountId && process.env.RAZORPAY_ROUTE_ENABLED !== "false") {
    const error = new Error(
      "This dairy is not configured for direct Razorpay settlement yet. Save its razorpay_linked_account_id first."
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    beneficiary: payoutDetails,
    linkedAccountId: linkedAccountId || null,
  };
};

const buildOrderTransfers = async ({ dairyId, amountInRupees, notes = {} }) => {
  const { beneficiary, linkedAccountId } = await getRequiredDairyTransferConfig(dairyId);

  const transfers = (linkedAccountId && process.env.RAZORPAY_ROUTE_ENABLED !== "false")
    ? [
        {
          account: linkedAccountId,
          amount: Math.round(Number(amountInRupees || 0) * 100),
          currency: "INR",
          notes,
        },
      ]
    : null;

  return {
    beneficiary,
    transfers,
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

export const createCustomerPaymentOrder = async ({
  customerId,
  paymentId,
  dairyId = null,
  payAll = false,
  includeRunningDue = true,
}) => {
  await syncCustomerMonthlyBills(customerId);
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);

  if (payAll) {
    const { payments: pendingPayments } = await getEligiblePendingPaymentsForCustomer(
      customerId,
      resolvedDairyId
    );
    const runningDueData = includeRunningDue
      ? await getCurrentMonthSuccessfulSubscriptionDue(customerId)
      : null;
    const runningDueAmount = includeRunningDue
      ? Number(runningDueData?.payableTillDate || 0)
      : 0;
    const currentMonthKey = getCurrentMonthKey();
    const historicalPendingAmount = pendingPayments.reduce((sum, row) => {
      return getPaymentMonthKey(row) === currentMonthKey
        ? sum
        : sum + getEffectivePaymentAmount(row).totalAmount;
    }, 0);
    const currentMonthPendingAmount = pendingPayments.reduce((sum, row) => {
      return getPaymentMonthKey(row) === currentMonthKey
        ? sum + getEffectivePaymentAmount(row).totalAmount
        : sum;
    }, 0);
    const amountInRupees =
      historicalPendingAmount + Math.max(currentMonthPendingAmount, runningDueAmount);
    const effectiveDairyId = pendingPayments[0]?.dairy_id || resolvedDairyId;

    if (!pendingPayments.length && runningDueAmount <= 0) {
      throw new Error("No pending payment found");
    }

    if (amountInRupees <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const orderNotes = {
      customer_id: String(customerId),
      dairy_id: String(effectiveDairyId ?? ""),
      payment_mode: "ALL",
      month: getCurrentMonthKey(),
    };
    const { razorpay, keyId, beneficiary, transfers } = await getRazorpayOrderContext({
      dairyId: effectiveDairyId,
      amountInRupees,
      notes: orderNotes,
    });
    const orderPayload = {
      amount: Math.round(amountInRupees * 100),
      currency: "INR",
      receipt: `cust_${customerId}_payall_${Date.now()}`.slice(0, 40),
      partial_payment: false,
      notes: orderNotes,
    };
    if (transfers) orderPayload.transfers = transfers;
    const order = await razorpay.orders.create(orderPayload);

    return {
      keyId,
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
    if (payment && isDirectCheckoutCustomerPaymentRow(payment)) {
      pendingPayment = payment;
    }
  } else {
    const { payments } = await getEligiblePendingPaymentsForCustomer(customerId, resolvedDairyId);
    pendingPayment = payments[0] || null;
  }

  if (!pendingPayment) {
    throw new Error("No pending payment found");
  }

  const amountInRupees = getEffectivePaymentAmount(pendingPayment).totalAmount;
  if (amountInRupees <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const effectiveDairyId = pendingPayment.dairy_id || resolvedDairyId;
  const orderNotes = {
    customer_id: String(customerId),
    payment_id: String(pendingPayment.id),
    dairy_id: String(effectiveDairyId ?? ""),
  };
  const { razorpay, keyId, beneficiary, transfers } = await getRazorpayOrderContext({
    dairyId: effectiveDairyId,
    amountInRupees,
    notes: orderNotes,
  });
  const orderPayload = {
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    receipt: `cust_${customerId}_pay_${pendingPayment.id}_${Date.now()}`.slice(0, 40),
    partial_payment: false,
    notes: orderNotes,
  };
  if (transfers) orderPayload.transfers = transfers;
  const order = await razorpay.orders.create(orderPayload);

  return {
    keyId,
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
  includeRunningDue = true,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error("Missing Razorpay verification fields");
  }

  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);
  const keySecret = await getRazorpayVerificationSecret(resolvedDairyId);
  const isMockOrder = String(razorpayOrderId).startsWith("order_mock_");
  const generatedSignature = isMockOrder
    ? razorpaySignature
    : crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new Error("Payment signature verification failed");
  }

  const paidAtIso = new Date().toISOString();
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
    const currentMonthKey = getCurrentMonthKey();

    if (pendingPayments.length && customerColumn) {
      for (const row of pendingPayments) {
        const { totalAmount } = getEffectivePaymentAmount(row);
        const payloadVariantsWithAmount = payloadVariants.map((payload) => ({
          ...payload,
          amount: totalAmount,
        }));
        await updatePaymentsWithFallbacks({
          customerColumn,
          customerId,
          dairyId: resolvedDairyId,
          paymentId: row.id,
          payloadVariants: payloadVariantsWithAmount,
        });
      }
    }

    const runningDueData = includeRunningDue
      ? await getCurrentMonthSuccessfulSubscriptionDue(customerId)
      : null;
    const runningDueAmount = includeRunningDue
      ? Number(runningDueData?.payableTillDate || 0)
      : 0;
    const hasCurrentMonthPendingBill = pendingPayments.some(
      (row) => getPaymentMonthKey(row) === currentMonthKey
    );

    if (runningDueAmount > 0 && !hasCurrentMonthPendingBill) {
      const description = buildCurrentMonthBillDescription(currentMonthKey);
      const paidRowPayload = {
        customer_id: customerId,
        dairy_id: resolvedDairyId,
        amount: Number(runningDueAmount.toFixed(2)),
        status: "PAID",
        method: "RAZORPAY",
        description,
        due_date: getLocalTodayIso(),
        paid_at: paidAtIso,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
      };

      const payloadVariantsForInsert = [
        paidRowPayload,
        {
          ...paidRowPayload,
          method: undefined,
          payment_method: "RAZORPAY",
          paid_at: undefined,
          payment_date: paidAtIso,
        },
        {
          customer_id: customerId,
          dairy_id: resolvedDairyId,
          amount: Number(runningDueAmount.toFixed(2)),
          status: "PAID",
          description,
          due_date: getLocalTodayIso(),
        },
      ];

      let lastMissingColumnError = null;
      let inserted = false;
      for (const variant of payloadVariantsForInsert) {
        const cleanPayload = Object.fromEntries(
          Object.entries(variant).filter(([, value]) => value !== undefined)
        );
        const { error } = await supabase.from("payments").insert(cleanPayload);
        if (!error) {
          inserted = true;
          break;
        }
        if (isMissingColumnError(error)) {
          lastMissingColumnError = error;
          continue;
        }
        throw error;
      }

      if (!inserted && lastMissingColumnError) {
        throw lastMissingColumnError;
      }
    }

    if (!pendingPayments.length && runningDueAmount <= 0) {
      throw new Error("No pending payment found");
    }

    await syncCustomerMonthlyBills(customerId);

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
    !isDirectCheckoutCustomerPaymentRow(existingPayment, deliveryStatusById)
  ) {
    throw new Error("Payment record not found");
  }

  await updatePaymentsWithFallbacks({
    customerColumn,
    customerId,
    dairyId: resolvedDairyId,
    paymentId: normalizedPaymentId,
    payloadVariants: payloadVariants.map((payload) => ({
      ...payload,
      amount: getEffectivePaymentAmount(existingPayment).totalAmount,
    })),
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
  const orderNotes = {
    customer_id: String(customerId),
    payment_mode: "WALLET_TOPUP",
    dairy_id: String(resolvedDairyId ?? ""),
    amount_inr: String(amountInRupees),
  };
  const { razorpay, keyId, beneficiary, transfers } = await getRazorpayOrderContext({
    dairyId: resolvedDairyId,
    amountInRupees,
    notes: orderNotes,
  });
  const orderPayload = {
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    receipt: `cust_${customerId}_wallet_${Date.now()}`.slice(0, 40),
    notes: orderNotes,
  };
  if (transfers) orderPayload.transfers = transfers;
  const order = await razorpay.orders.create(orderPayload);

  return {
    keyId,
    order,
    amount: amountInRupees,
    beneficiary,
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

  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);
  const keySecret = await getRazorpayVerificationSecret(resolvedDairyId);
  const isMockOrder = String(razorpayOrderId).startsWith("order_mock_");
  const generatedSignature = isMockOrder
    ? razorpaySignature
    : crypto
        .createHmac("sha256", keySecret)
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

const normalizeUpiId = (value) => String(value || "").trim().toLowerCase();

const isValidUpiId = (value) => {
  const normalized = normalizeUpiId(value);
  return /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9._-]{2,63}$/.test(normalized);
};

const normalizeUtr = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const buildUpiDeepLink = ({ upiId, payeeName, amount, note, transactionRef }) => {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName || "Dairy",
    am: Number(amount || 0).toFixed(2),
    cu: "INR",
  });

  if (note) params.set("tn", String(note).slice(0, 80));
  if (transactionRef) params.set("tr", String(transactionRef).slice(0, 35));

  return `upi://pay?${params.toString()}`;
};

const buildUpiIntentUrls = (upiLink) => {
  const query = upiLink.replace(/^upi:\/\/pay\?/i, "");
  return {
    upi: upiLink,
    googlePay: `gpay://upi/pay?${query}`,
    phonePe: `phonepe://pay?${query}`,
    paytm: `paytmmp://pay?${query}`,
  };
};

const getPaymentIntentTarget = async ({
  customerId,
  dairyId = null,
  paymentId = null,
  payAll = false,
  includeRunningDue = true,
  isWalletTopup = false,
}) => {
  await syncCustomerMonthlyBills(customerId);
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);

  if (isWalletTopup) {
    return {
      resolvedDairyId,
      payment: null,
      paymentIds: [],
      monthlyBillId: null,
      amount: 0,
      title: "Wallet Topup",
    };
  }

  if (payAll) {
    const { payments } = await getEligiblePendingPaymentsForCustomer(customerId, resolvedDairyId);
    const runningDueData = includeRunningDue
      ? await getCurrentMonthSuccessfulSubscriptionDue(customerId)
      : null;
    const runningDueAmount = includeRunningDue ? Number(runningDueData?.payableTillDate || 0) : 0;
    const amount = payments.reduce((sum, row) => sum + getEffectivePaymentAmount(row).totalAmount, 0);
    const totalAmount = Number((amount + runningDueAmount).toFixed(2));

    if (totalAmount <= 0) {
      const error = new Error("No pending payment found");
      error.statusCode = 400;
      throw error;
    }

    return {
      resolvedDairyId,
      payment: null,
      paymentIds: payments.map((row) => row.id),
      monthlyBillId: payments.find((row) => row.monthly_bill_id)?.monthly_bill_id || null,
      amount: totalAmount,
      title: "Pending dairy bills",
    };
  }

  const { payment } = await getPendingPaymentForCustomer(customerId, paymentId, resolvedDairyId);
  if (!payment) {
    const error = new Error("Payment record not found");
    error.statusCode = 404;
    throw error;
  }

  return {
    resolvedDairyId,
    payment,
    paymentIds: [payment.id],
    monthlyBillId: payment.monthly_bill_id || null,
    amount: getEffectivePaymentAmount(payment).totalAmount,
    title:
      payment.description ||
      (payment.billing_month ? `${payment.billing_month} Milk Bill` : "Dairy Bill"),
  };
};

const writePaymentAudit = async ({
  actorType,
  actorId,
  dairyId,
  customerId,
  entityType,
  entityId,
  action,
  metadata = {},
}) => {
  await supabase
    .from("audit_logs")
    .insert({
      actor_type: actorType,
      actor_id: actorId || null,
      dairy_id: dairyId || null,
      customer_id: customerId || null,
      entity_type: entityType,
      entity_id: entityId == null ? null : String(entityId),
      action,
      metadata,
    })
    .then(({ error }) => {
      if (error && !isMissingTableError(error)) throw error;
    });
};

export const createCustomerUpiPaymentIntent = async ({
  customerId,
  paymentId = null,
  dairyId = null,
  payAll = false,
  includeRunningDue = true,
  isWalletTopup = false,
  amount = 0,
}) => {
  const target = await getPaymentIntentTarget({
    customerId,
    dairyId,
    paymentId,
    payAll,
    includeRunningDue,
    isWalletTopup,
  });
  const beneficiary = await getDairyPayoutDetails(target.resolvedDairyId);
  const upiId = normalizeUpiId(beneficiary?.upiId);

  if (!upiId) {
    const error = new Error("This dairy has not configured a UPI ID yet");
    error.statusCode = 400;
    throw error;
  }

  if (!isValidUpiId(upiId)) {
    const error = new Error(
      `The dairy UPI ID "${beneficiary?.upiId}" is invalid. Ask the dairy admin to save a valid UPI ID like name@bank.`
    );
    error.statusCode = 400;
    throw error;
  }

  const finalAmount = isWalletTopup ? Number(amount || 0) : target.amount;
  const transactionRef = `DS${customerId}${Date.now()}`.slice(0, 35);
  const note = isWalletTopup ? "Wallet Topup - DairyStream" : `${target.title} - DairyStream`;
  const upiLink = buildUpiDeepLink({
    upiId,
    payeeName: beneficiary?.dairyName || "Dairy",
    amount: finalAmount,
    note,
    transactionRef,
  });

  await writePaymentAudit({
    actorType: "CUSTOMER",
    actorId: customerId,
    dairyId: target.resolvedDairyId,
    customerId,
    entityType: "payment",
    entityId: isWalletTopup ? "wallet_topup" : (target.payment?.id || "pay_all"),
    action: "UPI_INTENT_CREATED",
    metadata: {
      amount: finalAmount,
      paymentIds: target.paymentIds,
      transactionRef,
      isWalletTopup,
    },
  });

  return {
    payment: {
      id: isWalletTopup ? null : (target.payment?.id || null),
      paymentIds: target.paymentIds,
      monthlyBillId: target.monthlyBillId,
      amount: finalAmount,
      title: isWalletTopup ? "Wallet Topup" : target.title,
    },
    beneficiary,
    amount: finalAmount,
    transactionRef,
    upiLink,
    intents: buildUpiIntentUrls(upiLink),
  };
};

export const submitCustomerUpiPaymentVerification = async ({
  customerId,
  paymentId = null,
  dairyId = null,
  payAll = false,
  includeRunningDue = true,
  isWalletTopup = false,
  amount,
  utrNumber,
  payerUpiId = "",
  screenshotUrl = null,
  screenshotHash = null,
  originalFilename = "",
  ocrResult = null,
}) => {
  const normalizedUtr = normalizeUtr(utrNumber);
  if (!/^[A-Z0-9]{8,30}$/.test(normalizedUtr)) {
    const error = new Error("Enter a valid UTR/reference number");
    error.statusCode = 400;
    throw error;
  }

  const target = await getPaymentIntentTarget({
    customerId,
    dairyId,
    paymentId,
    payAll,
    includeRunningDue,
    isWalletTopup,
  });
  const submittedAmount = Number(Number(amount || target.amount).toFixed(2));

  if (!Number.isFinite(submittedAmount) || submittedAmount <= 0) {
    const error = new Error("Payment amount must be greater than zero");
    error.statusCode = 400;
    throw error;
  }
  if (!isWalletTopup && Math.abs(submittedAmount - Number(target.amount || 0)) > 1) {
    const error = new Error("Submitted amount does not match the payable amount");
    error.statusCode = 400;
    throw error;
  }

  const { data: duplicate, error: duplicateError } = await supabase
    .from("payment_verifications")
    .select("id, status")
    .eq("dairy_id", target.resolvedDairyId)
    .ilike("utr_number", normalizedUtr)
    .neq("status", "REJECTED")
    .limit(1)
    .maybeSingle();

  if (duplicateError && !isMissingTableError(duplicateError)) throw duplicateError;
  if (duplicate?.id) {
    const error = new Error("This UTR/reference number is already submitted");
    error.statusCode = 409;
    throw error;
  }

  const verificationAnalysis = await analyzeUpiVerificationSubmission({
    dairyId: target.resolvedDairyId,
    customerId,
    expectedAmount: target.amount,
    submittedAmount,
    utrNumber: normalizedUtr,
    payerUpiId,
    screenshotHash,
    originalFilename,
    ocrResult,
  });

  const verificationPayload = {
    payment_id: target.payment?.id || null,
    monthly_bill_id: target.monthlyBillId || null,
    customer_id: customerId,
    dairy_id: target.resolvedDairyId,
    amount: submittedAmount,
    method: "UPI",
    utr_number: normalizedUtr,
    payer_upi_id: normalizeUpiId(payerUpiId) || null,
    screenshot_url: screenshotUrl || null,
    screenshot_sha256: screenshotHash || null,
    status: "PENDING",
    ocr_status: verificationAnalysis.ocr.status,
    ocr_payload: verificationAnalysis.ocr,
    duplicate_check: {
      paymentIds: target.paymentIds,
      expectedAmount: target.amount,
      ...verificationAnalysis.duplicateCheck,
    },
    fraud_flags: verificationAnalysis.flags,
    confidence_score: verificationAnalysis.confidenceScore,
    review_recommendation: verificationAnalysis.reviewRecommendation,
  };

  let { data: verification, error } = await supabase
    .from("payment_verifications")
    .insert(verificationPayload)
    .select("*")
    .single();

  if (error && isMissingColumnError(error)) {
    const {
      screenshot_sha256,
      fraud_flags,
      confidence_score,
      review_recommendation,
      ...legacyPayload
    } = verificationPayload;

    const legacyResponse = await supabase
      .from("payment_verifications")
      .insert(legacyPayload)
      .select("*")
      .single();
    verification = legacyResponse.data;
    error = legacyResponse.error;
  }

  if (error) throw error;

  await writeFraudAlertsForVerification({
    verificationId: verification.id,
    dairyId: target.resolvedDairyId,
    customerId,
    paymentId: target.payment?.id || null,
    analysis: verificationAnalysis,
  });

  const submittedAt = new Date().toISOString();
  if (target.paymentIds.length > 0) {
    await supabase
      .from("payments")
      .update({
        verification_status: "SUBMITTED",
        utr_number: normalizedUtr,
        payment_screenshot_url: screenshotUrl || null,
        submitted_at: submittedAt,
        updated_at: submittedAt,
      })
      .in("id", target.paymentIds)
      .eq("customer_id", customerId);
  }

  await writePaymentAudit({
    actorType: "CUSTOMER",
    actorId: customerId,
    dairyId: target.resolvedDairyId,
    customerId,
    entityType: "payment_verification",
    entityId: verification.id,
    action: "UPI_VERIFICATION_SUBMITTED",
    metadata: {
      amount: submittedAmount,
      utrNumber: normalizedUtr,
      paymentIds: target.paymentIds,
      hasScreenshot: Boolean(screenshotUrl),
      confidenceScore: verificationAnalysis.confidenceScore,
      fraudFlags: verificationAnalysis.flags,
    },
  });

  return {
    success: true,
    verification,
    status: "PENDING_VERIFICATION",
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
  const [beneficiary, deliveryStatusById] = await Promise.all([
    getDairyPayoutDetails(resolvedDairyId),
    fetchCustomerDeliveryStatusById(customerId, resolvedDairyId),
  ]);
  const payableTillDate = Number(payableTillDateData?.payableTillDate || 0);

  const history = paymentRows
    .filter((row) => isVisibleCustomerPaymentRow(row, deliveryStatusById))
    .map(mapPaymentRow);
  const pendingCandidates = paymentRows
    .filter((row) => isBillableCustomerPaymentRow(row, deliveryStatusById))
    .map(mapPaymentRow)
    .filter(
    (item) => item.status === "PENDING" || item.status === "OVERDUE"
    );
  const overdueCandidates = pendingCandidates.filter((item) => item.status === "OVERDUE");
  const totalPendingAndOverdue = pendingCandidates.reduce(
    (sum, item) => sum + toNumber(item.amount, 0),
    0
  );
  const totalOverdue = overdueCandidates.reduce((sum, item) => sum + toNumber(item.amount, 0), 0);
  const overdueBaseAmount = overdueCandidates.reduce(
    (sum, item) => sum + toNumber(item.baseAmount, 0),
    0
  );
  const overduePenaltyAmount = overdueCandidates.reduce(
    (sum, item) => sum + toNumber(item.overduePenaltyAmount, 0),
    0
  );
  const currentMonthKey = String(getLocalTodayIso()).slice(0, 7);
  const historicalPendingAndOverdue = pendingCandidates.reduce((sum, item) => {
    return item.monthKey === currentMonthKey ? sum : sum + toNumber(item.amount, 0);
  }, 0);
  const currentMonthPendingAndOverdue = pendingCandidates.reduce((sum, item) => {
    return item.monthKey === currentMonthKey ? sum + toNumber(item.amount, 0) : sum;
  }, 0);
  const liveBillingSummaryAmount =
    historicalPendingAndOverdue +
    Math.max(currentMonthPendingAndOverdue, toNumber(payableTillDate, 0));
  const nearestDueInDays = pendingCandidates.reduce((nearest, item) => {
    const days = diffDaysFromToday(item.dueDate);
    if (days === null) return nearest;
    if (nearest === null) return days;
    return days < nearest ? days : nearest;
  }, null);

  return {
    summary: {
      monthlyDue: totalPendingAndOverdue,
      overdueAmount: Number(totalOverdue.toFixed(2)),
      overdueBaseAmount: Number(overdueBaseAmount.toFixed(2)),
      overduePenaltyAmount: Number(overduePenaltyAmount.toFixed(2)),
      walletBalance: toNumber(walletBalance, 0),
      payableTillDate: toNumber(payableTillDate, 0),
      billingSummaryAmount: Number(liveBillingSummaryAmount.toFixed(2)),
      dueInDays: nearestDueInDays,
      beneficiary,
    },
    history,
  };
};

