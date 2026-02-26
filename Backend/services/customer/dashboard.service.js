import { supabase } from "../../config/supabase.js";
import { getSubscriptionByCustomerId } from "./subscription.service.js";
import { getTodayDeliverySnapshot } from "./deliveries.service.js";

const DASHBOARD_CACHE_TTL_MS = 10 * 1000;
const dashboardCache = new Map();

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
    .select("id, delivery_date, milk_type, quantity_liters, status")
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
  };
};

export const getCustomerDashboard = async (customerId, { dairyId } = {}) => {
  const cacheKey = `${customerId}:${dairyId ?? "none"}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.at < DASHBOARD_CACHE_TTL_MS) {
    return cached.payload;
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (customerError) throw customerError;

  const subscription = await getSubscriptionByCustomerId(customerId);
  const isActiveSubscription =
    subscription && String(subscription.status || "ACTIVE").toUpperCase() !== "CLOSED";
  const membershipDairyId = await getMembershipDairyId(customerId);
  const linkedDairyId =
    membershipDairyId ??
    customer?.dairy_id ??
    dairyId ??
    (isActiveSubscription ? subscription?.dairy_id : null) ??
    null;
  let dairy = null;

  if (linkedDairyId) {
    dairy = await getDairyByIdLoose(linkedDairyId);
  }

  const quantityLabel = isActiveSubscription && subscription?.quantity_liters
    ? `${subscription.quantity_liters} L`
    : "-";
  const { todayDelivery } = await getTodayDeliverySnapshot(customerId, { subscription });
  const upcomingDeliveryAlert = await getUpcomingScheduledDelivery(customerId);

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
      dairy: resolvedDairyName || "Not assigned",
      dairyName: resolvedDairyName || "Not assigned",
      memberOfDairy: resolvedDairyName || "Not assigned",
    },
    subscription: isActiveSubscription
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
    },
    billing: {
      monthlyDue: 0,
      walletBalance: 0,
      dueInDays: 5,
    },
    alerts: {
      upcomingDelivery: upcomingDeliveryAlert,
    },
  };

  dashboardCache.set(cacheKey, { payload, at: Date.now() });
  return payload;
};
