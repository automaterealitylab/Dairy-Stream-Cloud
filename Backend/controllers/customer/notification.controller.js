import { savePushSubscription } from "../../services/shared/notification.service.js";
import { getDeliveryETA } from "../../services/shared/eta.service.js";

/**
 * Subscribe customer to push notifications
 */
export const subscribeToNotifications = async (req, res) => {
  try {
    const customerId = req.customer?.id;
    
    if (!customerId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const subscription = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        message: "Invalid subscription data",
      });
    }

    await savePushSubscription(customerId, subscription);

    return res.json({
      message: "Subscription saved successfully",
      success: true,
    });
  } catch (err) {
    console.error("NOTIFICATION SUBSCRIPTION ERROR:", err?.message || err);
    return res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to save subscription",
    });
  }
};

/**
 * Get delivery ETA for customer
 */
export const fetchDeliveryETA = async (req, res) => {
  try {
    const customerId = req.customer?.id;
    const deliveryId = req.params.id;

    if (!customerId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const etaData = await getDeliveryETA(deliveryId, customerId);

    return res.json({
      success: true,
      eta: etaData,
    });
  } catch (err) {
    console.error("FETCH DELIVERY ETA ERROR:", err?.message || err);
    const statusCode =
      err?.statusCode ||
      (String(err?.message || "").toLowerCase() === "delivery not found" ? 404 : null) ||
      (String(err?.message || "").toLowerCase() === "unauthorized" ? 403 : null) ||
      500;

    return res.status(statusCode).json({
      message: err?.message || "Failed to fetch delivery ETA",
    });
  }
};
