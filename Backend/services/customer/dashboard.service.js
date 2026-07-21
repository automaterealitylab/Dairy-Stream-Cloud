import { supabase } from "../../config/supabase.js";
import { getSubscriptionByCustomerId } from "./subscription.service.js";
import { getTodayDeliverySnapshot } from "./deliveries.service.js";
import { getCustomerPaymentsData } from "./payments.service.js";
import {
  getCachedCustomerDashboardPayload,
  setCachedCustomerDashboardPayload,
} from "./dashboardCache.service.js";

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

const getLocalDateInput = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const hasOpenSubscriptionStatus = (status) => {
  const value = String(status || "ACTIVE").trim().toUpperCase();
  return value !== "CLOSED" && value !== "CANCELLED" && value !== "CANCELED";
};

const normalizeOneTimeStatus = (status, approvalStatus) => {
  const normalizedApproval = String(approvalStatus || "").toUpperCase();
  if (normalizedApproval === "PENDING") return "PENDING_APPROVAL";
  if (normalizedApproval === "CANCELLED" || normalizedApproval === "CANCELED") {
    return "CANCELLED";
  }

  const value = String(status || "").toUpperCase();
  if (value === "DELIVERED" || value === "COMPLETED") return "DELIVERED";
  if (value === "CANCELLED" || value === "CANCELED") return "CANCELLED";
  if (value === "SKIPPED") return "SKIPPED";
  if (value === "PENDING") return "PENDING";
  return "PENDING";
};

const parseOneTimeNotes = (notesValue) => {
  const notes = String(notesValue || "");
  if (!notes.includes("[ONE_TIME_ORDER]")) {
    return {
      isOneTimeOrder: false,
      slot: null,
      paymentMethod: null,
    };
  }

  const slotMatch = notes.match(/slot=([^;]+)/i);
  const paymentMatch = notes.match(/payment=([^;]+)/i);

  return {
    isOneTimeOrder: true,
    slot: slotMatch?.[1]?.trim() || null,
    paymentMethod: paymentMatch?.[1]?.trim() || null,
  };
};

const formatQuantityLabel = (value) => {
  const quantityValue = Number(value);
  return Number.isFinite(quantityValue) && quantityValue > 0 ? `${quantityValue} L` : "-";
};

const mapOneTimeOrderRow = (row, dairyNamesMap = {}) => {
  const parsedNotes = parseOneTimeNotes(row?.notes);
  if (!parsedNotes.isOneTimeOrder) return null;

  return {
    id: row?.id,
    dairyId: row?.dairy_id ?? null,
    dairyName:
      dairyNamesMap[String(row?.dairy_id)] ||
      (row?.dairy_id ? `Dairy #${row.dairy_id}` : "Dairy"),
    deliveryDate: row?.delivery_date || null,
    product: row?.milk_type || "Milk",
    quantity: formatQuantityLabel(row?.quantity_liters),
    status: normalizeOneTimeStatus(row?.status, row?.approval_status),
    approvalStatus: String(row?.approval_status || "PENDING").toUpperCase(),
    slot: parsedNotes.slot || "-",
    paymentMethod: parsedNotes.paymentMethod || "-",
    createdAt: row?.created_at || null,
  };
};

const isClosedOneTimeOrder = (row) => {
  const status = String(row?.status || "").toUpperCase();
  const approvalStatus = String(row?.approval_status || "").toUpperCase();

  if (["CANCELLED", "CANCELED", "FAILED", "DELIVERED", "COMPLETED", "SKIPPED"].includes(status)) {
    return true;
  }

  return ["CANCELLED", "CANCELED", "REJECTED"].includes(approvalStatus);
};

const getDairyNamesMap = async (dairyIds) => {
  const ids = [...new Set((dairyIds || []).filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("dairies")
    .select("id, dairy_name")
    .in("id", ids);

  if (error) {
    if (isMissingTableError(error) || isMissingColumnError(error) || isUuidSyntaxError(error)) {
      return {};
    }
    throw error;
  }

  return (data || []).reduce((acc, row) => {
    const key = row?.id;
    if (key != null) {
      acc[String(key)] = row?.dairy_name || `Dairy #${key}`;
    }
    return acc;
  }, {});
};

const getRecentOneTimeOrders = async (customerId) => {
  const { data, error } = await supabase
    .from("deliveries")
    .select("id, dairy_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, created_at")
    .eq("customer_id", customerId)
    .neq("approval_status", "PENDING_PAYMENT")
    .ilike("notes", "%[ONE_TIME_ORDER]%")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    if (isMissingTableError(error) || isMissingColumnError(error) || isUuidSyntaxError(error)) {
      return [];
    }
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const dairyNamesMap = await getDairyNamesMap(rows.map((row) => row?.dairy_id));

  return rows.map((row) => mapOneTimeOrderRow(row, dairyNamesMap)).filter(Boolean);
};

const getTomorrowOneTimeOrders = async (customerId) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = getLocalDateInput(tomorrow);

  const { data, error } = await supabase
    .from("deliveries")
    .select("id, dairy_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, created_at")
    .eq("customer_id", customerId)
    .eq("delivery_date", tomorrowIso)
    .neq("approval_status", "PENDING_PAYMENT")
    .ilike("notes", "%[ONE_TIME_ORDER]%")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingTableError(error) || isMissingColumnError(error) || isUuidSyntaxError(error)) {
      return [];
    }
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const dairyNamesMap = await getDairyNamesMap(rows.map((row) => row?.dairy_id));

  return rows
    .filter((row) => !isClosedOneTimeOrder(row))
    .map((row) => mapOneTimeOrderRow(row, dairyNamesMap))
    .filter(Boolean);
};

const getMembershipDairyId = async (customerId) => {
  const candidateColumns = ["customer_id", "user_id", "customerid", "customerId"];

  for (const linkColumn of candidateColumns) {
    const { data, error } = await supabase
      .from("memberships")
      .select("dairy_id")
      .eq(linkColumn, customerId)
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

const getDairyByIdLoose = async (dairyId) => {
  if (!dairyId) return null;

  const { data, error } = await supabase
    .from("dairies")
    .select("id, dairy_name, address, city, image_url")
    .eq("id", dairyId)
    .limit(1)
    .maybeSingle();

  if (!error) return data || null;
  if (isUuidSyntaxError(error)) return null;
  throw error;
};

const getUpcomingScheduledDelivery = async (customerId) => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayIso = `${y}-${m}-${d}`;

  const { data, error } = await supabase
    .from("deliveries")
    .select("id, delivery_date, milk_type, quantity_liters, status, approval_status, notes")
    .eq("customer_id", customerId)
    .gte("delivery_date", todayIso)
    .order("delivery_date", { ascending: true })
    .limit(10);

  if (error) {
    if (isMissingTableError(error) || isMissingColumnError(error) || isUuidSyntaxError(error)) {
      return null;
    }
    throw error;
  }

  const upcoming = (data || []).find((row) => {
    const status = String(row?.status || "PENDING").toUpperCase();
    const approvalStatus = String(row?.approval_status || "").toUpperCase();
    const isOneTimeOrder = String(row?.notes || "").includes("[ONE_TIME_ORDER]");
    const isCancelled =
      status === "CANCELLED" ||
      status === "CANCELED" ||
      approvalStatus === "CANCELLED" ||
      approvalStatus === "CANCELED";
    if (isCancelled) return false;
    const blockedByApproval = isOneTimeOrder && approvalStatus === "PENDING";
    if (blockedByApproval) return true;
    return status !== "DELIVERED" && status !== "COMPLETED" && status !== "FAILED";
  });

  if (!upcoming) return null;

  return {
    id: upcoming.id,
    date: upcoming.delivery_date,
    product: upcoming.milk_type || "Milk",
    quantity:
      upcoming.quantity_liters == null ? "-" : `${Number(upcoming.quantity_liters)} L`,
    status: String(upcoming.status || "PENDING").toUpperCase(),
    approvalStatus: String(upcoming.approval_status || "").toUpperCase() || null,
  };
};

export const getCustomerDashboard = async (customerId, { dairyId } = {}) => {
  const cacheKey = `${customerId}:${dairyId ?? "none"}`;
  const cached = getCachedCustomerDashboardPayload(cacheKey);
  if (cached) {
    return cached;
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (customerError) throw customerError;

  const subscription = await getSubscriptionByCustomerId(customerId);
  const hasExistingSubscription = subscription && hasOpenSubscriptionStatus(subscription.status);
  const isActiveSubscription =
    hasExistingSubscription && String(subscription.status || "ACTIVE").toUpperCase() === "ACTIVE";
  const membershipDairyId = await getMembershipDairyId(customerId);
  const linkedDairyId =
    membershipDairyId ??
    customer?.dairy_id ??
    dairyId ??
    (hasExistingSubscription ? subscription?.dairy_id : null) ??
    null;
  let dairy = null;

  if (linkedDairyId) {
    dairy = await getDairyByIdLoose(linkedDairyId);
  }

  const quantityLabel = isActiveSubscription && subscription?.quantity_liters
    ? `${subscription.quantity_liters} L`
    : "-";
  const [
    { todayDelivery },
    upcomingDeliveryAlert,
    oneTimeOrders,
    tomorrowExtraOrders,
    paymentsData,
  ] = await Promise.all([
    getTodayDeliverySnapshot(customerId, { subscription }),
    getUpcomingScheduledDelivery(customerId),
    getRecentOneTimeOrders(customerId),
    getTomorrowOneTimeOrders(customerId),
    getCustomerPaymentsData(customerId, linkedDairyId),
  ]);

  const legacyDairyName =
    customer?.dairy_name ??
    customer?.dairyName ??
    subscription?.dairy_name ??
    subscription?.dairyName ??
    null;
  const resolvedDairyName =
    dairy?.dairy_name ||
    legacyDairyName ||
    (linkedDairyId ? `Dairy #${linkedDairyId}` : null);

  const payload = {
    customer: {
      id: customer.id,
      name: customer.customer_name || customer.name || "Customer",
      email: customer.email || "-",
      phone: customer.phone_number || customer.phone || "-",
      dairyId: linkedDairyId ?? null,
      dairy: resolvedDairyName || "Not assigned",
      dairyName: resolvedDairyName || "Not assigned",
      memberOfDairy: resolvedDairyName || "Not assigned",
    },
    subscription: hasExistingSubscription
      ? {
          dairyId: subscription.dairy_id,
          dairyName: resolvedDairyName || "Dairy",
          milkType: subscription.milk_type || "-",
          quantity: subscription.quantity_liters || null,
          slot: subscription.delivery_slot || "-",
          startDate: subscription.start_date || null,
          address: subscription.address || "-",
          paymentMethod: subscription.payment_method || "-",
          status: subscription.status || "ACTIVE",
        }
      : null,
    todayDelivery,
    tomorrowDelivery: {
      quantity: quantityLabel,
      slot: subscription?.delivery_slot || "-",
      extraOrders: tomorrowExtraOrders,
    },
    billing: {
      monthlyDue: Number(paymentsData?.summary?.monthlyDue || 0),
      walletBalance: Number(paymentsData?.summary?.walletBalance || 0),
      payableTillDate: Number(paymentsData?.summary?.payableTillDate || 0),
      dueInDays:
        paymentsData?.summary?.dueInDays === null || paymentsData?.summary?.dueInDays === undefined
          ? null
          : Number(paymentsData.summary.dueInDays),
    },
    alerts: {
      upcomingDelivery: upcomingDeliveryAlert,
    },
    oneTimeOrders,
  };

  setCachedCustomerDashboardPayload(cacheKey, payload);
  return payload;
};
