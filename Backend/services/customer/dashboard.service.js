import { supabase } from "../../config/supabase.js";
import { getSubscriptionByCustomerId } from "./subscription.service.js";

const MEMBERSHIP_LINK_COLUMNS = ["customer_id", "customerid", "customerId", "user_id"];
const MEMBERSHIP_DAIRY_COLUMNS = ["dairy_id", "dairyid", "dairyId"];

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
  for (const linkColumn of MEMBERSHIP_LINK_COLUMNS) {
    for (const dairyColumn of MEMBERSHIP_DAIRY_COLUMNS) {
      const { data, error } = await supabase
        .from("memberships")
        .select(dairyColumn)
        .eq(linkColumn, customerId)
        .limit(1)
        .maybeSingle();

      if (!error) {
        const dairyId = data?.[dairyColumn] ?? null;
        if (dairyId) return dairyId;
        continue;
      }

      if (isMissingTableError(error)) return null;
      if (isMissingColumnError(error) || isUuidSyntaxError(error)) continue;
      throw error;
    }
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

  if (!error && data) return data;

  // Fallback for mixed legacy id types (uuid/bigint) by matching as strings.
  const { data: allDairies, error: allError } = await supabase
    .from("dairies")
    .select("id, dairy_name, address, city, image_url")
    .limit(5000);

  if (allError) throw allError;

  const matched = (allDairies || []).find(
    (row) => String(row?.id ?? "") === String(dairyId)
  );

  return matched || null;
};

export const getCustomerDashboard = async (customerId, { dairyId } = {}) => {
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

  return {
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
    todayDelivery: {
      status: isActiveSubscription ? "PENDING" : "NOT_SUBSCRIBED",
      time: subscription?.delivery_slot === "Evening" ? "06:00 PM" : "07:00 AM",
      product: isActiveSubscription ? (subscription?.milk_type || "Milk") : "Milk",
      quantity: quantityLabel,
    },
    tomorrowDelivery: {
      quantity: quantityLabel,
      slot: subscription?.delivery_slot || "-",
    },
    billing: {
      monthlyDue: 0,
      walletBalance: 0,
      dueInDays: 5,
    },
  };
};
