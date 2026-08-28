// Razorpay client, order context, transfer and verification helpers.

import Razorpay from "razorpay";
import { supabase } from "../../../config/supabase.js";
import { getRazorpayConfig } from "../../../config/razorpay.js";
import { isMissingColumnError } from "../../../utils/dbErrors.js";
import { maskAccountNumber } from "./normalizers.js";

export const getRazorpayClient = () => {
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

export const getRazorpayOrderContext = async ({ dairyId, amountInRupees, notes = {} }) => {
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

export const getRazorpayVerificationSecret = async (dairyId) => {
  return getRazorpayConfig().keySecret;
};

export const isRazorpayMockAllowed = () =>
  process.env.RAZORPAY_MOCK === "true" &&
  String(process.env.NODE_ENV || "development").toLowerCase() !== "production";

export const assertRazorpayPaymentCaptured = async ({
  razorpayOrderId,
  razorpayPaymentId,
  expectedAmount = null,
}) => {
  if (String(razorpayOrderId).startsWith("order_mock_")) {
    if (isRazorpayMockAllowed()) return;
    throw new Error("Mock Razorpay orders are not allowed");
  }

  const razorpay = getRazorpayClient();
  const payment = await razorpay.payments.fetch(razorpayPaymentId);
  if (!payment || String(payment.status || "").toLowerCase() !== "captured") {
    throw new Error("Payment is not captured");
  }
  if (String(payment.order_id || "") !== String(razorpayOrderId)) {
    throw new Error("Payment order mismatch");
  }
  if (expectedAmount !== null) {
    const expectedPaise = Math.round(Number(expectedAmount || 0) * 100);
    if (Number(payment.amount || 0) !== expectedPaise) {
      throw new Error("Payment amount mismatch");
    }
  }
};

export const getDairyPayoutDetails = async (dairyId) => {
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

export const isValidRazorpayAccountId = (accountId) =>
  /^acc_[a-zA-Z0-9]{14}$/.test(String(accountId || "").trim());

export const isRazorpayRouteEnabled = () =>
  String(process.env.RAZORPAY_ROUTE_ENABLED || "false").toLowerCase() === "true";

export const getRequiredDairyTransferConfig = async (dairyId) => {
  const payoutDetails = await getDairyPayoutDetails(dairyId);
  const rawAccountId = String(payoutDetails?.razorpayLinkedAccountId || "").trim();
  const linkedAccountId = isValidRazorpayAccountId(rawAccountId) ? rawAccountId : null;
  const isRouteExplicitlyRequired = isRazorpayRouteEnabled();

  if (!linkedAccountId && isRouteExplicitlyRequired) {
    const error = new Error(
      "This dairy is not configured for direct Razorpay settlement yet. Save its razorpay_linked_account_id first."
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    beneficiary: payoutDetails,
    linkedAccountId: isRouteExplicitlyRequired && linkedAccountId ? linkedAccountId : null,
  };
};

export const buildOrderTransfers = async ({ dairyId, amountInRupees, notes = {} }) => {
  const { beneficiary, linkedAccountId } = await getRequiredDairyTransferConfig(dairyId);

  const transfers = linkedAccountId
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
