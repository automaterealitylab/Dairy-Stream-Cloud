// Public payment orchestration: Razorpay orders, wallet payments and UPI
// intents/verifications for the customer.

import crypto from "crypto";
import { supabase } from "../../../config/supabase.js";
import { getRazorpayConfig } from "../../../config/razorpay.js";
import { getLocalTodayIso } from "../../../utils/date.js";
import {
  isMissingColumnError,
  isMissingTableError,
} from "../../../utils/dbErrors.js";
import { writeSettlementLedgerEntry } from "../../marketplace/auditLedger.service.js";
import {
  getCurrentMonthSuccessfulSubscriptionDue,
  syncCustomerMonthlyBills,
} from "../monthlyBilling.service.js";
import {
  analyzeUpiVerificationSubmission,
  writeFraudAlertsForVerification,
} from "../smartPaymentVerification.service.js";
import {
  buildCurrentMonthBillDescription,
  buildUpiDeepLink,
  buildUpiIntentUrls,
  diffDaysFromToday,
  getCurrentMonthKey,
  getEffectivePaymentAmount,
  getPaymentMonthKey,
  isDirectCheckoutCustomerPaymentRow,
  isValidUpiId,
  isOutstandingCustomerPaymentRow,
  isVisibleCustomerPaymentRow,
  mapPaymentRow,
  normalizePaymentId,
  normalizeUpiId,
  normalizeUtr,
  parseDeliveryIdsFromDescription,
  toNumber,
} from "./normalizers.js";
import {
  fetchCustomerDeliveryStatusById,
  fetchPaymentsRows,
  getCustomerWalletBalance,
  getEligiblePendingPaymentsForCustomer,
  getPendingPaymentForCustomer,
  getPendingPaymentsForCustomer,
  resolveCustomerDairyId,
} from "./queries.service.js";
import {
  assertRazorpayPaymentCaptured,
  getDairyPayoutDetails,
  getRazorpayClient,
  getRazorpayOrderContext,
  getRazorpayVerificationSecret,
  isRazorpayMockAllowed,
} from "./razorpay.service.js";
import {
  buildPaidUpdatePayloadVariants,
  updatePaymentsWithFallbacks,
  writePaymentAudit,
} from "./update.service.js";
import {
  createWalletLedgerEntry,
  creditCustomerWalletBalance,
  debitCustomerWalletBalance,
} from "./wallet.service.js";

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
    const effectiveDairyId = pendingPayments[0]?.dairy_id || resolvedDairyId;
    const runningDueData = includeRunningDue
      ? await getCurrentMonthSuccessfulSubscriptionDue(customerId, effectiveDairyId)
      : null;
    const runningDueAmount = includeRunningDue
      ? Number(runningDueData?.payableTillDate || 0)
      : 0;
    const amountInRupees =
      historicalPendingAmount + Math.max(currentMonthPendingAmount, runningDueAmount);

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
    const [{ payment }, deliveryStatusById] = await Promise.all([
      getPendingPaymentForCustomer(customerId, paymentId, resolvedDairyId),
      fetchCustomerDeliveryStatusById(customerId, resolvedDairyId),
    ]);
    if (payment && isDirectCheckoutCustomerPaymentRow(payment, deliveryStatusById)) {
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
  if (isMockOrder && !isRazorpayMockAllowed()) {
    throw new Error("Mock Razorpay orders are not allowed");
  }
  const generatedSignature = isMockOrder
    ? razorpaySignature
    : crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new Error("Payment signature verification failed");
  }

  await assertRazorpayPaymentCaptured({ razorpayOrderId, razorpayPaymentId });

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
          dairyId: row.dairy_id || resolvedDairyId,
          paymentId: row.id,
          payloadVariants: payloadVariantsWithAmount,
        });

        const deliveryIds = parseDeliveryIdsFromDescription(row.description);
        if (deliveryIds.length > 0) {
          await supabase
            .from("deliveries")
            .update({ approval_status: "PENDING" })
            .in("id", deliveryIds)
            .eq("approval_status", "PENDING_PAYMENT");
        }
      }
    }

    const effectiveDairyId = pendingPayments[0]?.dairy_id || resolvedDairyId;
    const runningDueData = includeRunningDue
      ? await getCurrentMonthSuccessfulSubscriptionDue(customerId, effectiveDairyId)
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

  const deliveryIds = parseDeliveryIdsFromDescription(existingPayment.description);
  if (deliveryIds.length > 0) {
    await supabase
      .from("deliveries")
      .update({ approval_status: "PENDING" })
      .in("id", deliveryIds)
      .eq("approval_status", "PENDING_PAYMENT");
  }

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
  const razorpay = getRazorpayClient();
  const keyId = getRazorpayConfig().keyId;
  const orderPayload = {
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    receipt: `cust_${customerId}_wallet_${Date.now()}`.slice(0, 40),
    notes: orderNotes,
  };
  const order = await razorpay.orders.create(orderPayload);

  return {
    keyId,
    order,
    amount: amountInRupees,
    beneficiary: null,
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
  if (isMockOrder && !isRazorpayMockAllowed()) {
    throw new Error("Mock Razorpay orders are not allowed");
  }
  const generatedSignature = isMockOrder
    ? razorpaySignature
    : crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new Error("Payment signature verification failed");
  }

  await assertRazorpayPaymentCaptured({
    razorpayOrderId,
    razorpayPaymentId,
    expectedAmount: amountInRupees,
  });

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

const getPaymentIntentTarget = async ({
  customerId,
  dairyId = null,
  paymentId = null,
  payAll = false,
  includeRunningDue = true,
  isWalletTopup = false,
  amount = 0,
}) => {
  await syncCustomerMonthlyBills(customerId);
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);

  if (isWalletTopup) {
    const topupAmount = Number(amount || 0);
    if (!Number.isFinite(topupAmount) || topupAmount <= 0) {
      const error = new Error("Wallet top-up amount must be greater than zero");
      error.statusCode = 400;
      error.code = "INVALID_PAYMENT_AMOUNT";
      throw error;
    }
    if (topupAmount < 10) {
      const error = new Error("Minimum wallet top-up amount is Rs 10");
      error.statusCode = 400;
      error.code = "MINIMUM_AMOUNT_REQUIRED";
      throw error;
    }

    return {
      resolvedDairyId,
      payment: null,
      paymentIds: [],
      monthlyBillId: null,
      amount: Number(topupAmount.toFixed(2)),
      title: "Wallet Topup",
    };
  }

  const isGenericId = !paymentId || String(paymentId).startsWith("payment-") || String(paymentId) === "null" || String(paymentId) === "undefined";

  if (payAll || isGenericId) {
    const { payments } = await getEligiblePendingPaymentsForCustomer(customerId, resolvedDairyId);
    const effectiveDairyId = payments[0]?.dairy_id || resolvedDairyId;
    const runningDueData = includeRunningDue
      ? await getCurrentMonthSuccessfulSubscriptionDue(customerId, effectiveDairyId)
      : null;
    const runningDueAmount = includeRunningDue ? Number(runningDueData?.payableTillDate || 0) : 0;
    const pendingAmount = payments.reduce((sum, row) => sum + getEffectivePaymentAmount(row).totalAmount, 0);
    const totalAmount = Number((pendingAmount + runningDueAmount).toFixed(2));

    if (totalAmount <= 0) {
      const { data: anyPaidBill } = await supabase
        .from("monthly_bills")
        .select("id, status")
        .eq("customer_id", customerId)
        .eq("status", "PAID")
        .limit(1);

      if (anyPaidBill && anyPaidBill.length > 0) {
        const error = new Error("This bill is already fully paid.");
        error.statusCode = 400;
        error.code = "BILL_ALREADY_PAID";
        throw error;
      }

      const error = new Error("No pending payment or due found for this account.");
      error.statusCode = 400;
      error.code = "NO_PENDING_DUE";
      throw error;
    }

    return {
      resolvedDairyId: effectiveDairyId,
      payment: payments[0] || null,
      paymentIds: payments.map((row) => row.id),
      monthlyBillId: payments.find((row) => row.monthly_bill_id)?.monthly_bill_id || null,
      amount: totalAmount,
      title: payments[0]?.title || "Pending dairy bill",
    };
  }

  const parsedPaymentId = normalizePaymentId(paymentId);

  // 1. Check if payment exists in payments table for this customer
  const { payment, customerColumn } = await getPendingPaymentForCustomer(customerId, parsedPaymentId, resolvedDairyId);

  if (payment && customerColumn) {
    const effectiveDairyId = payment.dairy_id || resolvedDairyId;
    const effectiveAmount = getEffectivePaymentAmount(payment).totalAmount;

    if (effectiveAmount <= 0 || String(payment.status).toUpperCase() === "PAID") {
      const error = new Error("This bill is already fully paid.");
      error.statusCode = 400;
      error.code = "BILL_ALREADY_PAID";
      throw error;
    }

    return {
      resolvedDairyId: effectiveDairyId,
      payment,
      paymentIds: [payment.id],
      monthlyBillId: payment.monthly_bill_id || null,
      amount: effectiveAmount,
      title: payment.description || (payment.billing_month ? `${payment.billing_month} Milk Bill` : "Dairy Bill"),
    };
  }

  // 2. Check if payment exists for ANOTHER customer (security ownership check)
  const { data: otherCustomerPayment } = await supabase
    .from("payments")
    .select("id, customer_id, status, amount")
    .eq("id", parsedPaymentId)
    .limit(1)
    .maybeSingle();

  if (otherCustomerPayment) {
    if (String(otherCustomerPayment.customer_id) !== String(customerId)) {
      const error = new Error("The requested bill does not belong to the authenticated customer.");
      error.statusCode = 403;
      error.code = "UNAUTHORIZED_BILL_ACCESS";
      throw error;
    }

    if (String(otherCustomerPayment.status).toUpperCase() === "PAID") {
      const error = new Error("This bill is already fully paid.");
      error.statusCode = 400;
      error.code = "BILL_ALREADY_PAID";
      throw error;
    }
  }

  // 3. Check monthly_bills table if paymentId refers to a monthly_bill record
  const { data: monthlyBill } = await supabase
    .from("monthly_bills")
    .select("*")
    .eq("id", parsedPaymentId)
    .limit(1)
    .maybeSingle();

  if (monthlyBill) {
    if (String(monthlyBill.customer_id) !== String(customerId)) {
      const error = new Error("The requested bill does not belong to the authenticated customer.");
      error.statusCode = 403;
      error.code = "UNAUTHORIZED_BILL_ACCESS";
      throw error;
    }

    const dueAmount = toNumber(monthlyBill.due_amount, 0);
    const status = String(monthlyBill.status || "").toUpperCase();

    if (status === "PAID" || dueAmount <= 0) {
      const error = new Error("This bill is already fully paid.");
      error.statusCode = 400;
      error.code = "BILL_ALREADY_PAID";
      throw error;
    }

    if (status === "CANCELLED" || status === "CANCELED") {
      const error = new Error("This bill has been cancelled.");
      error.statusCode = 400;
      error.code = "BILL_CANCELLED";
      throw error;
    }

    return {
      resolvedDairyId: monthlyBill.dairy_id || resolvedDairyId,
      payment: null,
      paymentIds: [],
      monthlyBillId: monthlyBill.id,
      amount: dueAmount,
      title: `${monthlyBill.billing_month || "Monthly"} Bill (${monthlyBill.bill_number || `DV-${monthlyBill.id}`})`,
    };
  }

  const error = new Error("The requested bill or payment record was not found.");
  error.statusCode = 404;
  error.code = "BILL_NOT_FOUND";
  throw error;
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
    amount,
  });

  const finalAmount = isWalletTopup ? Number(amount || 0) : target.amount;

  if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
    const error = new Error("Payment amount must be greater than zero");
    error.statusCode = 400;
    error.code = "INVALID_PAYMENT_AMOUNT";
    throw error;
  }

  const beneficiary = await getDairyPayoutDetails(target.resolvedDairyId);
  let upiId = normalizeUpiId(beneficiary?.upiId);

  if (!upiId) {
    const fallbackUpi = process.env.DEFAULT_DAIRY_UPI_ID || (beneficiary?.dairyName ? `${beneficiary.dairyName.toLowerCase().replace(/[^a-z0-9]/g, "")}@upi` : "dairy@upi");
    upiId = normalizeUpiId(fallbackUpi);
  }

  if (!upiId || !isValidUpiId(upiId)) {
    upiId = "dairy@upi";
  }

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
    entityId: isWalletTopup ? "wallet_topup" : (target.payment?.id || target.monthlyBillId || "pay_all"),
    action: "UPI_INTENT_CREATED",
    metadata: {
      amount: finalAmount,
      paymentIds: target.paymentIds,
      monthlyBillId: target.monthlyBillId,
      transactionRef,
      isWalletTopup,
    },
  });

  return {
    payment: {
      id: isWalletTopup ? null : (target.payment?.id || target.monthlyBillId || null),
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
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);
  const [payableTillDateData, walletBalance, paymentRows] = await Promise.all([
    getCurrentMonthSuccessfulSubscriptionDue(customerId, resolvedDairyId),
    getCustomerWalletBalance(customerId),
    fetchPaymentsRows(customerId, dairyId),
  ]);
  const [beneficiary, deliveryStatusById] = await Promise.all([
    getDairyPayoutDetails(resolvedDairyId),
    fetchCustomerDeliveryStatusById(customerId, resolvedDairyId),
  ]);
  const payableTillDate = Number(payableTillDateData?.payableTillDate || 0);

  const history = paymentRows
    .filter((row) => isVisibleCustomerPaymentRow(row, deliveryStatusById))
    .map(mapPaymentRow);
  const pendingCandidates = paymentRows
    .filter((row) => isOutstandingCustomerPaymentRow(row, deliveryStatusById))
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

  const roundedMonthlyDue = Number(totalPendingAndOverdue.toFixed(2));
  const roundedOverdueAmount = Number(totalOverdue.toFixed(2));
  const roundedOverdueBaseAmount = Number(overdueBaseAmount.toFixed(2));
  const roundedOverduePenaltyAmount = Number(overduePenaltyAmount.toFixed(2));
  const roundedWalletBalance = Number(toNumber(walletBalance, 0).toFixed(2));
  const roundedPayableTillDate = Number(toNumber(payableTillDate, 0).toFixed(2));
  const roundedBillingSummaryAmount = Number(liveBillingSummaryAmount.toFixed(2));

  return {
    summary: {
      monthlyDue: roundedMonthlyDue,
      overdueAmount: roundedOverdueAmount,
      overdueBaseAmount: roundedOverdueBaseAmount,
      overduePenaltyAmount: roundedOverduePenaltyAmount,
      walletBalance: roundedWalletBalance,
      payableTillDate: roundedPayableTillDate,
      billingSummaryAmount: roundedBillingSummaryAmount,
      dueInDays: nearestDueInDays,
      beneficiary,
    },
    history,
  };
};

export const payCustomerBillWithWallet = async ({
  customerId,
  paymentId,
  payAll = false,
  includeRunningDue = true,
  dairyId = null,
}) => {
  const resolvedDairyId = await resolveCustomerDairyId(customerId, dairyId);
  let amountInRupees = 0;
  let paymentsToPay = [];

  const { payments: pendingPayments, customerColumn } = await getEligiblePendingPaymentsForCustomer(
    customerId,
    resolvedDairyId
  );

  if (payAll) {
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
    const effectiveDairyId = pendingPayments[0]?.dairy_id || resolvedDairyId;
    const runningDueData = includeRunningDue
      ? await getCurrentMonthSuccessfulSubscriptionDue(customerId, effectiveDairyId)
      : null;
    const runningDueAmount = includeRunningDue
      ? Number(runningDueData?.payableTillDate || 0)
      : 0;

    amountInRupees = historicalPendingAmount + Math.max(currentMonthPendingAmount, runningDueAmount);

    if (!pendingPayments.length && runningDueAmount <= 0) {
      throw new Error("No pending payment found");
    }

    paymentsToPay = pendingPayments;
  } else {
    if (!paymentId) throw new Error("No pending payment selected");
    const { payment } = await getPendingPaymentForCustomer(customerId, paymentId, resolvedDairyId);
    if (!payment) throw new Error("Payment record not found");
    amountInRupees = getEffectivePaymentAmount(payment).totalAmount;
    paymentsToPay = [payment];
  }

  if (amountInRupees <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const walletBalance = await getCustomerWalletBalance(customerId);
  if (walletBalance < amountInRupees) {
    throw new Error("Insufficient wallet balance");
  }

  const walletUpdate = await debitCustomerWalletBalance({ customerId, amount: amountInRupees });

  const paidAtIso = new Date().toISOString();
  const payloadVariants = buildPaidUpdatePayloadVariants({
    paymentMethod: "WALLET",
    paidAtIso,
    razorpayOrderId: null,
    razorpayPaymentId: null,
    razorpaySignature: null,
  });

  if (payAll) {
    if (paymentsToPay.length && customerColumn) {
      for (const row of paymentsToPay) {
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

        await writeSettlementLedgerEntry({
          paymentId: row.id,
          dairyId: resolvedDairyId,
          amount: totalAmount,
          status: "PENDING",
          metadata: { paid_via: "WALLET", pay_all: true },
        });
      }
    }
  } else {
    const singlePayment = paymentsToPay[0];
    if (singlePayment && customerColumn) {
      const { totalAmount } = getEffectivePaymentAmount(singlePayment);
      const payloadVariantsWithAmount = payloadVariants.map((payload) => ({
        ...payload,
        amount: totalAmount,
      }));
      await updatePaymentsWithFallbacks({
        customerColumn,
        customerId,
        dairyId: resolvedDairyId,
        paymentId: singlePayment.id,
        payloadVariants: payloadVariantsWithAmount,
      });

      await writeSettlementLedgerEntry({
        paymentId: singlePayment.id,
        dairyId: resolvedDairyId,
        amount: totalAmount,
        status: "PENDING",
        metadata: { paid_via: "WALLET" },
      });
    }
  }

  await createWalletLedgerEntry({
    customerId,
    dairyId: resolvedDairyId,
    amount: amountInRupees,
    method: "WALLET",
    description: `[WALLET_DEBIT_CUSTOMER] paid bills with wallet; amount=${amountInRupees}`,
    paidAtIso,
  });

  return {
    success: true,
    amount: amountInRupees,
    previousWalletBalance: walletUpdate.previousWalletBalance,
    walletBalance: walletUpdate.walletBalance,
  };
};
