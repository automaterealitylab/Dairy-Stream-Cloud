// Pure helpers for classifying, normalizing and formatting payment rows.
// These functions do no I/O and are reused by the query/wallet/order modules.

import { getLocalTodayIso } from "../../../utils/date.js";
import { MONTHLY_BILL_MARKER, parseMonthlyBillMeta } from "../monthlyBilling.service.js";
import {
  OVERDUE_PENALTY_RATE,
  SUBSCRIPTION_DELIVERY_PAYMENT_MARKER,
  ONE_TIME_PAYMENT_MARKER,
  WALLET_TOPUP_MARKER,
  ONE_TIME_ORDER_CANCEL_MARKER,
} from "./constants.js";

export const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

export const cloneEmptyValue = (value) => (Array.isArray(value) ? [] : value);

export const hasQueryResult = (value) =>
  Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;

export const maskAccountNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  const masked = "*".repeat(Math.max(0, digits.length - 4));
  return `${masked}${digits.slice(-4)}`;
};

export const normalizeStatus = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "PAID") return "PAID";
  if (value === "PENDING") return "PENDING";
  if (value === "OVERDUE") return "OVERDUE";
  if (value === "FAILED") return "FAILED";
  return "PENDING";
};

export const normalizePaymentDisplayStatus = (row = {}) => {
  const rawStatus = normalizeStatus(row?.status);
  const verificationStatus = String(row?.verification_status || "").toUpperCase();

  if (rawStatus !== "PAID" && verificationStatus === "SUBMITTED") {
    return "PAID";
  }

  return rawStatus;
};

export const isDeliveredStatus = (status) => {
  const value = String(status || "").toUpperCase();
  return value === "DELIVERED" || value === "COMPLETED";
};

export const isCancelledStatus = (status) => {
  const value = String(status || "").toUpperCase();
  return value === "CANCELLED" || value === "CANCELED";
};

export const parseDeliveryIdFromPaymentDescription = (description) => {
  const text = String(description || "");
  const match = text.match(/delivery_id=(\d+)/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const parseDeliveryIdsFromDescription = (description) => {
  const text = String(description || "");
  const match = text.match(/delivery_ids=([\d,]+)/i);
  if (!match) return [];
  return match[1].split(",").map(Number).filter(Boolean);
};

export const isSubscriptionDeliveryPaymentRow = (row) =>
  String(row?.description || "").includes(SUBSCRIPTION_DELIVERY_PAYMENT_MARKER);

export const isOneTimePaymentRow = (row) => {
  const description = String(row?.description || "");
  if (description.includes(ONE_TIME_PAYMENT_MARKER)) return true;
  return /\bone[_ -]?time\b/i.test(description);
};

export const isWalletTopupPaymentRow = (row) => {
  const description = String(row?.description || "");
  if (description.includes(WALLET_TOPUP_MARKER)) return true;
  if (description.includes(ONE_TIME_ORDER_CANCEL_MARKER)) return true;
  return /\bwallet\b/i.test(description);
};

export const isCancelledOneTimePaymentRow = (row, deliveryStatusById) => {
  if (!isOneTimePaymentRow(row)) return false;

  const deliveryId = parseDeliveryIdFromPaymentDescription(row?.description);
  if (!deliveryId || !deliveryStatusById) return false;

  const status = deliveryStatusById instanceof Map
    ? deliveryStatusById.get(deliveryId)
    : deliveryStatusById[deliveryId];

  return isCancelledStatus(status);
};

export const isMonthlyBillPaymentRow = (row) => {
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

export const extractPaymentAmount = (row) =>
  toNumber(row?.amount ?? row?.total_amount ?? row?.total ?? row?.bill_amount ?? 0, 0);

export const getOverduePenaltyAmount = (row) => {
  const status = normalizeStatus(row?.status);
  if (status !== "OVERDUE") return 0;

  const baseAmount = extractPaymentAmount(row);
  if (baseAmount <= 0) return 0;

  return Number((baseAmount * OVERDUE_PENALTY_RATE).toFixed(2));
};

export const getEffectivePaymentAmount = (row) => {
  const baseAmount = extractPaymentAmount(row);
  const overduePenaltyAmount = getOverduePenaltyAmount(row);

  return {
    baseAmount: Number(baseAmount.toFixed(2)),
    overduePenaltyAmount,
    totalAmount: Number((baseAmount + overduePenaltyAmount).toFixed(2)),
  };
};

export const formatDate = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const diffDaysFromToday = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const today = new Date();
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const b = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
};

export const normalizeMonthKey = (value) => {
  const monthKey = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : null;
};

export const getPaymentMonthKey = (row) => {
  const monthMeta = parseMonthlyBillMeta(row?.description);
  const fallbackDate =
    row?.billing_month ||
    row?.month ||
    String(row?.due_date || row?.dueDate || row?.payment_date || row?.date || "").slice(0, 7);
  return normalizeMonthKey(monthMeta.monthKey || fallbackDate);
};

export const isDeliveredSubscriptionPaymentRow = (row, deliveryStatusById) => {
  if (!isSubscriptionDeliveryPaymentRow(row)) return false;

  const deliveryId = parseDeliveryIdFromPaymentDescription(row?.description);
  if (!deliveryId || !deliveryStatusById) return false;

  const status = deliveryStatusById instanceof Map
    ? deliveryStatusById.get(deliveryId)
    : deliveryStatusById[deliveryId];

  return isDeliveredStatus(status);
};

export const isVisibleCustomerPaymentRow = (row, deliveryStatusById) => {
  if (isWalletTopupPaymentRow(row)) return true;
  if (isOneTimePaymentRow(row)) {
    if (isCancelledOneTimePaymentRow(row, deliveryStatusById)) return false;
    return true;
  }
  if (isMonthlyBillPaymentRow(row)) return true;
  return false;
};

export const isBillableCustomerPaymentRow = (row, deliveryStatusById) => {
  if (isWalletTopupPaymentRow(row)) return false;
  if (isOneTimePaymentRow(row)) return false;
  if (isMonthlyBillPaymentRow(row)) return true;
  return false;
};

export const isOutstandingCustomerPaymentRow = (row, deliveryStatusById) => {
  if (isWalletTopupPaymentRow(row)) return false;
  if (isOneTimePaymentRow(row) && isCancelledOneTimePaymentRow(row, deliveryStatusById)) return false;

  const status = normalizePaymentDisplayStatus(row);
  return status === "PENDING" || status === "OVERDUE";
};

export const isDirectCheckoutCustomerPaymentRow = (row, deliveryStatusById) => {
  return isOutstandingCustomerPaymentRow(row, deliveryStatusById);
};

export const mapPaymentRow = (row, index) => {
  const { baseAmount, overduePenaltyAmount, totalAmount } = getEffectivePaymentAmount(row);
  const status = normalizePaymentDisplayStatus(row);
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

export const normalizePaymentId = (value) => {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : value;
};

export const getCurrentMonthKey = () => String(getLocalTodayIso()).slice(0, 7);

export const buildCurrentMonthBillDescription = (monthKey) =>
  `${MONTHLY_BILL_MARKER} month=${monthKey}; deliveries=0; subscription=0`.slice(0, 300);

export const normalizeUpiId = (value) => String(value || "").trim().toLowerCase();

export const isValidUpiId = (value) => {
  const normalized = normalizeUpiId(value);
  return /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9._-]{2,63}$/.test(normalized);
};

export const normalizeUtr = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

export const buildUpiDeepLink = ({ upiId, payeeName, amount, note, transactionRef }) => {
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

export const buildUpiIntentUrls = (upiLink) => {
  const query = upiLink.replace(/^upi:\/\/pay\?/i, "");
  return {
    upi: upiLink,
    googlePay: `gpay://upi/pay?${query}`,
    phonePe: `phonepe://pay?${query}`,
    paytm: `paytmmp://pay?${query}`,
  };
};
