// Database read helpers for the customer payments domain.

import { supabase } from "../../../config/supabase.js";
import {
  isMissingColumnError,
  isMissingTableError,
  isUuidSyntaxError,
} from "../../../utils/dbErrors.js";
import {
  cloneEmptyValue,
  hasQueryResult,
  isOutstandingCustomerPaymentRow,
  normalizePaymentId,
  toNumber,
} from "./normalizers.js";
import {
  MEMBERSHIP_CUSTOMER_COLUMNS,
  PAYMENT_CUSTOMER_COLUMNS,
} from "./constants.js";

export const getCustomerWalletBalance = async (customerId) => {
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

export const runPaymentsCustomerQuery = async ({
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

export const fetchPaymentsRows = async (customerId, dairyId = null, limit = null) => {
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

      if (limit) {
        query = query.limit(limit);
      }

      return query;
    },
  });

  return data || [];
};

export const fetchCustomerDeliveryStatusById = async (customerId, dairyId = null) => {
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

export const getCustomerById = async (customerId) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const getMembershipDairyId = async (customerId) => {
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

export const resolveCustomerDairyId = async (customerId, hintedDairyId = null, paymentRows = []) => {
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

  const { data: deliveryData } = await supabase
    .from("deliveries")
    .select("dairy_id")
    .eq("customer_id", customerId)
    .not("dairy_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (deliveryData?.dairy_id) {
    return deliveryData.dairy_id;
  }

  const paymentDairyId = (paymentRows || []).find((row) => row?.dairy_id)?.dairy_id;
  return paymentDairyId ?? null;
};

export const getPendingPaymentForCustomer = async (customerId, paymentId = null, dairyId = null) => {
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

export const getPendingPaymentsForCustomer = async (customerId, dairyId = null) => {
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

export const getEligiblePendingPaymentsForCustomer = async (
  customerId,
  dairyId = null,
  deliveryStatusById = null
) => {
  const [pendingResult, resolvedDeliveryStatusById] = await Promise.all([
    getPendingPaymentsForCustomer(customerId, dairyId),
    deliveryStatusById
      ? Promise.resolve(deliveryStatusById)
      : fetchCustomerDeliveryStatusById(customerId, dairyId),
  ]);

  const { payments, customerColumn } = pendingResult;

  const eligiblePayments = (payments || []).filter((row) =>
    isOutstandingCustomerPaymentRow(row, resolvedDeliveryStatusById)
  );

  return {
    payments: eligiblePayments,
    customerColumn,
  };
};
