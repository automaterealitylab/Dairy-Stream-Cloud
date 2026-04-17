import { updateDeliveryETA } from "../../services/shared/eta.service.js";
import { supabase } from "../../config/supabase.js";

/**
 * Update agent location and calculate delivery ETA
 */
export const updateAgentLocation = async (req, res) => {
  try {
    const agentId = req.agent?.id;
    const { deliveryId, latitude, longitude } = req.body;

    if (!agentId || !deliveryId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Missing required fields: deliveryId, latitude, longitude",
      });
    }

    // Update ETA and location
    const etaData = await updateDeliveryETA(deliveryId, latitude, longitude);

    // Save location to agent_locations table for analytics
    await supabase.from("agent_locations").insert({
      agent_id: agentId,
      delivery_id: deliveryId,
      latitude,
      longitude,
      recorded_at: new Date().toISOString(),
    }).catch((err) => {
      // Location tracking optional, don't fail if table doesn't exist
      console.log("Could not save location track:", err.message);
    });

    return res.json({
      success: true,
      message: "Location updated and ETA calculated",
      ...etaData,
    });
  } catch (err) {
    console.error("AGENT LOCATION UPDATE ERROR:", err?.message || err);
    return res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to update location",
    });
  }
};

/**
 * Start delivery - triggered when agent starts delivery
 * Calculates initial ETA and sends notification to customer
 */
export const startDelivery = async (req, res) => {
  try {
    const agentId = req.agent?.id;
    const { deliveryId, latitude, longitude } = req.body;

    if (!agentId || !deliveryId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Missing required fields: deliveryId, latitude, longitude",
      });
    }

    // Get delivery details
    const { data: delivery, error: fetchError } = await supabase
      .from("deliveries")
      .select("id, customer_id, status, agent_id")
      .eq("id", deliveryId)
      .eq("agent_id", agentId)
      .single();

    if (fetchError) {
      console.error("START DELIVERY FETCH ERROR:", fetchError.message || fetchError);
      return res.status(500).json({
        message: "Failed to load assigned delivery",
      });
    }

    if (!delivery) {
      return res.status(404).json({
        message: "Delivery not found",
      });
    }

    // Calculate initial ETA
    const etaData = await updateDeliveryETA(deliveryId, latitude, longitude);

    // Update delivery status to IN_TRANSIT
    await supabase
      .from("deliveries")
      .update({
        status: "IN_TRANSIT",
        updated_at: new Date().toISOString(),
      })
      .eq("id", deliveryId);

    // Send notification to customer (imported on demand to avoid circular deps)
    const { sendDeliveryStartedNotification } = await import("../../services/shared/notification.service.js");
    sendDeliveryStartedNotification(deliveryId).catch((err) => {
      console.error("Failed to send delivery started notification:", err);
    });

    return res.json({
      success: true,
      message: "Delivery started",
      ...etaData,
    });
  } catch (err) {
    console.error("START DELIVERY ERROR:", err?.message || err);
    return res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to start delivery",
    });
  }
};
