import { updateDeliveryETA } from "../../services/shared/eta.service.js";
import { supabase } from "../../config/supabase.js";

const isMissingTableError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("table") && message.includes("could not find")) ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("schema cache")
  );
};

const isTransientFetchError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("timeout") ||
    details.includes("fetch failed") ||
    details.includes("connect timeout") ||
    details.includes("und_err_connect_timeout")
  );
};

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

    let etaData;
    try {
      etaData = await updateDeliveryETA(deliveryId, latitude, longitude);
    } catch (etaError) {
      if (!isTransientFetchError(etaError)) {
        throw etaError;
      }

      console.warn("ETA refresh skipped due to transient fetch error:", etaError?.message || etaError);
      etaData = {
        estimatedMinutes: null,
        estimatedArrivalTime: null,
        distance: null,
        remainingMinutes: null,
        remainingDistance: null,
        confidence: "LOW",
        lastUpdated: new Date().toISOString(),
        agentLocation: {
          lat: Number(latitude),
          lng: Number(longitude),
        },
        customerLocation: null,
        routePath: [],
        message: "Location received. ETA refresh will retry on the next update.",
      };
    }

    // Save location to agent_locations table for analytics.
    // This insert is optional, so we log and continue if the table/schema is missing.
    const { error: locationTrackError } = await supabase.from("agent_locations").insert({
      agent_id: agentId,
      delivery_id: deliveryId,
      latitude,
      longitude,
      recorded_at: new Date().toISOString(),
    });

    if (locationTrackError && !isMissingTableError(locationTrackError)) {
      console.log("Could not save location track:", locationTrackError.message || locationTrackError);
    }

    return res.json({
      success: true,
      message: etaData?.estimatedArrivalTime
        ? "Location updated and ETA calculated"
        : "Location updated. ETA refresh pending.",
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
