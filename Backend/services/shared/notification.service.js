import { supabase } from "../../config/supabase.js";
import { sendNotification } from "../../push/sendNotification.js";

const PUSH_SUBSCRIPTION_COLUMN = "push_subscription";
let hasWarnedAboutMissingPushSubscriptionColumn = false;

const isMissingPushSubscriptionColumnError = (error) =>
  error?.code === "42703" &&
  String(error?.message || "").toLowerCase().includes(`customers.${PUSH_SUBSCRIPTION_COLUMN}`);

const warnMissingPushSubscriptionColumn = () => {
  if (hasWarnedAboutMissingPushSubscriptionColumn) return;
  hasWarnedAboutMissingPushSubscriptionColumn = true;
  console.warn(
    "Push notifications are disabled because customers.push_subscription is missing. Run Backend/sql/SUPABASE_MIGRATIONS.sql to add the column."
  );
};

const getNotificationDelivery = async (deliveryId) => {
  const { data, error } = await supabase
    .from("deliveries")
    .select("id, customer_id, quantity_liters")
    .eq("id", deliveryId)
    .single();

  if (error) throw error;
  return data || null;
};

/**
 * Save customer push notification subscription
 */
export const savePushSubscription = async (customerId, subscription) => {
  try {
    const { data, error } = await supabase
      .from("customers")
      .update({
        [PUSH_SUBSCRIPTION_COLUMN]: subscription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId)
      .select("id")
      .single();

    if (error) throw error;

    return { success: true, customerId: data.id };
  } catch (error) {
    if (isMissingPushSubscriptionColumnError(error)) {
      warnMissingPushSubscriptionColumn();
      const schemaError = new Error(
        "Push notification storage is not configured in the database. Run Backend/sql/SUPABASE_MIGRATIONS.sql and try again."
      );
      schemaError.statusCode = 500;
      throw schemaError;
    }
    console.error("Error saving push subscription:", error);
    throw error;
  }
};

/**
 * Get customer push subscription
 */
export const getCustomerSubscription = async (customerId) => {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select(PUSH_SUBSCRIPTION_COLUMN)
      .eq("id", customerId)
      .single();

    if (error) throw error;

    return data?.[PUSH_SUBSCRIPTION_COLUMN] || null;
  } catch (error) {
    if (isMissingPushSubscriptionColumnError(error)) {
      warnMissingPushSubscriptionColumn();
      return null;
    }
    console.error("Error fetching customer subscription:", error);
    return null;
  }
};

/**
 * Send delivery completion notification to customer
 */
export const sendDeliveryCompletionNotification = async (deliveryId) => {
  try {
    const delivery = await getNotificationDelivery(deliveryId);

    if (!delivery) {
      console.error("Delivery not found for notification:", deliveryId);
      return;
    }

    const subscription = await getCustomerSubscription(delivery.customer_id);
    if (!subscription) {
      console.log("No subscription for customer:", delivery.customer_id);
      return;
    }

    const payload = {
      notification: {
        title: "Delivery Completed",
        body: `Your ${delivery.quantity_liters || 0}L milk delivery has been completed.`,
        icon: "/icons/delivery-complete.png",
        badge: "/icons/badge.png",
      },
      data: {
        type: "DELIVERY_COMPLETED",
        deliveryId: deliveryId.toString(),
        timestamp: new Date().toISOString(),
        actionUrl: `/deliveries/${deliveryId}`,
      },
      actions: [
        {
          action: "RATE",
          title: "Rate Delivery",
        },
        {
          action: "VIEW",
          title: "View Details",
        },
      ],
    };

    await sendNotification(subscription, payload);
    console.log("Delivery completion notification sent to customer:", delivery.customer_id);
  } catch (error) {
    console.error("Error sending delivery completion notification:", error);
  }
};

/**
 * Send ETA update notification to customer
 */
export const sendETAUpdateNotification = async (deliveryId, etaMinutes) => {
  try {
    const delivery = await getNotificationDelivery(deliveryId);

    if (!delivery) {
      console.error("Delivery not found for ETA notification:", deliveryId);
      return;
    }

    const subscription = await getCustomerSubscription(delivery.customer_id);
    if (!subscription) {
      console.log("No subscription for customer:", delivery.customer_id);
      return;
    }

    const payload = {
      notification: {
        title: "Delivery ETA Updated",
        body: `Your delivery will arrive in approximately ${etaMinutes} minutes.`,
        icon: "/icons/eta-update.png",
        badge: "/icons/badge.png",
      },
      data: {
        type: "ETA_UPDATE",
        deliveryId: deliveryId.toString(),
        eta: String(etaMinutes ?? ""),
        etaMinutes: String(etaMinutes ?? ""),
        timestamp: new Date().toISOString(),
        actionUrl: `/deliveries/${deliveryId}`,
      },
    };

    await sendNotification(subscription, payload);
    console.log("ETA notification sent to customer:", delivery.customer_id);
  } catch (error) {
    console.error("Error sending ETA notification:", error);
  }
};

/**
 * Send delivery started notification
 */
export const sendDeliveryStartedNotification = async (deliveryId) => {
  try {
    const delivery = await getNotificationDelivery(deliveryId);

    if (!delivery) {
      console.error("Delivery not found for started notification:", deliveryId);
      return;
    }

    const subscription = await getCustomerSubscription(delivery.customer_id);
    if (!subscription) {
      console.log("No subscription for customer:", delivery.customer_id);
      return;
    }

    const payload = {
      notification: {
        title: "Delivery Started",
        body: `Agent is on the way with your ${delivery.quantity_liters || 0}L milk.`,
        icon: "/icons/delivery-started.png",
        badge: "/icons/badge.png",
      },
      data: {
        type: "DELIVERY_STARTED",
        deliveryId: deliveryId.toString(),
        timestamp: new Date().toISOString(),
        actionUrl: `/deliveries/${deliveryId}`,
      },
    };

    await sendNotification(subscription, payload);
    console.log("Delivery started notification sent to customer:", delivery.customer_id);
  } catch (error) {
    console.error("Error sending delivery started notification:", error);
  }
};
