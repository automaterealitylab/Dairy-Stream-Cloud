import { supabase } from "../../config/supabase.js";

const DELIVERY_TABLES = ["deliveries", "milk_deliveries"];

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("column")) ||
    message.includes("schema cache")
  );
};

const isMissingTableError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("table") && message.includes("could not find")) ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("schema cache")
  );
};

const findDeliveryRecord = async (deliveryId) => {
  for (const table of DELIVERY_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", deliveryId)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error) || isMissingColumnError(error)) {
        continue;
      }
      throw error;
    }

    if (data) {
      return { table, delivery: data };
    }
  }

  return null;
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const buildRoutePath = (agentLat, agentLng, customerLat, customerLng) => {
  if (
    !Number.isFinite(Number(agentLat)) ||
    !Number.isFinite(Number(agentLng)) ||
    !Number.isFinite(Number(customerLat)) ||
    !Number.isFinite(Number(customerLng))
  ) {
    return [];
  }

  return [
    { lat: Number(agentLat), lng: Number(agentLng) },
    { lat: Number(customerLat), lng: Number(customerLng) },
  ];
};

/**
 * Get time of day category for ML
 */
const getTimeOfDay = (date) => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 9) return "EARLY_MORNING";
  if (hour >= 9 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 20) return "EVENING";
  return "NIGHT";
};

/**
 * Get day of week
 */
const getDayOfWeek = (date) => {
  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return days[date.getDay()];
};

/**
 * Calculate Smart ETA using historical delivery data
 */
export const calculateSmartETA = async ({
  agentId,
  agentLat,
  agentLng,
  customerLat,
  customerLng,
}) => {
  try {
    // Calculate distance
    const distance = calculateDistance(agentLat, agentLng, customerLat, customerLng);
    
    const now = new Date();
    const timeOfDay = getTimeOfDay(now);
    const dayOfWeek = getDayOfWeek(now);

    // Fetch historical delivery data for this agent
    const { data: analytics, error } = await supabase
      .from("delivery_analytics")
      .select("actual_duration_minutes, distance_km, time_of_day, day_of_week")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      if (!isMissingTableError(error)) {
        console.error("Error fetching analytics:", error);
      }
    }

    let estimatedMinutes = 15; // Default 15 minutes
    let confidence = "LOW";

    if (analytics && analytics.length > 0) {
      // Find deliveries with similar distance
      const relevantDeliveries = analytics.filter(
        (a) => a.distance_km && Math.abs(a.distance_km - distance) < 2
      );

      if (relevantDeliveries.length > 0) {
        // Calculate weighted average (recent = more weight)
        const weights = relevantDeliveries.map((_, idx) => 
          Math.exp(-idx / 10)
        );
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        
        const weightedSum = relevantDeliveries.reduce((sum, delivery, idx) => {
          return sum + (delivery.actual_duration_minutes || 15) * weights[idx];
        }, 0);

        estimatedMinutes = Math.round(weightedSum / totalWeight);
        confidence = relevantDeliveries.length >= 5 ? "HIGH" : "MEDIUM";
      }
    }

    // Add buffer (5 minutes) for safety
    estimatedMinutes += 5;

    const eta = new Date(now.getTime() + estimatedMinutes * 60 * 1000);

    return {
      estimatedMinutes,
      estimatedArrivalTime: eta.toISOString(),
      distance: parseFloat(distance.toFixed(2)),
      confidence,
      timeOfDay,
      dayOfWeek,
    };
  } catch (error) {
    console.error("Error calculating ETA:", error);
    // Fallback: 15 minutes
    const eta = new Date(Date.now() + 15 * 60 * 1000);
    return {
      estimatedMinutes: 15,
      estimatedArrivalTime: eta.toISOString(),
      distance: null,
      confidence: "LOW",
    };
  }
};

/**
 * Update delivery ETA in database
 */
export const updateDeliveryETA = async (deliveryId, agentLat, agentLng) => {
  try {
    const deliveryRecord = await findDeliveryRecord(deliveryId);
    if (!deliveryRecord?.delivery) {
      const notFoundError = new Error("Delivery not found");
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    const { table, delivery } = deliveryRecord;

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("latitude, longitude")
      .eq("id", delivery.customer_id)
      .single();

    if (customerError) {
      throw customerError;
    }

    const customerLat = Number(customer?.latitude);
    const customerLng = Number(customer?.longitude);

    // Check if customer coordinates exist or are provided
    if (!Number.isFinite(customerLat) || !Number.isFinite(customerLng)) {
      // If not in DB, we'll just use the new location
      const fallbackPayload = {
        estimatedMinutes: 15,
        estimatedArrivalTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        distance: null,
        message: "Customer location not available yet",
      };

      const { error: fallbackUpdateError } = await supabase
        .from(table)
        .update({
          agent_current_lat: agentLat,
          agent_current_lng: agentLng,
          agent_location_updated_at: new Date().toISOString(),
          estimated_arrival_time: fallbackPayload.estimatedArrivalTime,
        })
        .eq("id", deliveryId);

      if (fallbackUpdateError && !isMissingColumnError(fallbackUpdateError)) {
        throw fallbackUpdateError;
      }

      return {
        ...fallbackPayload,
        remainingMinutes: fallbackPayload.estimatedMinutes,
        remainingDistance: null,
        agentLocation: {
          lat: agentLat,
          lng: agentLng,
        },
        customerLocation: null,
        routePath: [],
      };
    }

    // Calculate ETA
    const etaData = await calculateSmartETA({
      agentId: delivery.agent_id,
      agentLat,
      agentLng,
      customerLat,
      customerLng,
    });

    // Update delivery with ETA and agent location
    const { error: updateError } = await supabase
      .from(table)
      .update({
        agent_current_lat: agentLat,
        agent_current_lng: agentLng,
        agent_location_updated_at: new Date().toISOString(),
        estimated_arrival_time: etaData.estimatedArrivalTime,
      })
      .eq("id", deliveryId);

    if (updateError && !isMissingColumnError(updateError)) {
      throw updateError;
    }

    return {
      ...etaData,
      remainingMinutes: etaData.estimatedMinutes,
      remainingDistance: etaData.distance,
      agentLocation: {
        lat: agentLat,
        lng: agentLng,
      },
      customerLocation: {
        lat: customerLat,
        lng: customerLng,
      },
      routePath: buildRoutePath(agentLat, agentLng, customerLat, customerLng),
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error updating delivery ETA:", error);
    throw error;
  }
};

/**
 * Get delivery ETA for customer
 */
export const getDeliveryETA = async (deliveryId, customerId = null) => {
  try {
    const deliveryRecord = await findDeliveryRecord(deliveryId);
    const data = deliveryRecord?.delivery || null;

    if (!data) {
      const notFoundError = new Error("Delivery not found");
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    // Verify customer owns this delivery if customerId provided
    if (customerId && data.customer_id !== customerId) {
      const unauthorizedError = new Error("Unauthorized");
      unauthorizedError.statusCode = 403;
      throw unauthorizedError;
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("latitude, longitude")
      .eq("id", data.customer_id)
      .single();

    if (customerError && !isMissingColumnError(customerError)) {
      throw customerError;
    }

    const agentLat = Number(data.agent_current_lat);
    const agentLng = Number(data.agent_current_lng);
    const customerLat = Number(customer?.latitude);
    const customerLng = Number(customer?.longitude);
    const customerLocation =
      Number.isFinite(customerLat) && Number.isFinite(customerLng)
        ? { lat: customerLat, lng: customerLng }
        : null;
    const remainingDistance =
      Number.isFinite(agentLat) &&
      Number.isFinite(agentLng) &&
      Number.isFinite(customerLat) &&
      Number.isFinite(customerLng)
        ? parseFloat(calculateDistance(agentLat, agentLng, customerLat, customerLng).toFixed(2))
        : null;
    const routePath = buildRoutePath(agentLat, agentLng, customerLat, customerLng);

    // Check if ETA is still valid (location updated within last 10 minutes)
    if (!data.agent_location_updated_at) {
      return {
        status: data.status,
        eta: null,
        remainingMinutes: null,
        remainingDistance,
        customerLocation,
        routePath,
        message: "Agent location not available. ETA will be updated soon.",
      };
    }

    const lastUpdate = new Date(data.agent_location_updated_at);
    const now = new Date();
    const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);

    if (minutesSinceUpdate > 10) {
      return {
        status: data.status,
        eta: data.estimated_arrival_time,
        remainingMinutes: null,
        remainingDistance,
        customerLocation,
        routePath,
        message: "Agent location update pending...",
      };
    }

    // Calculate remaining minutes
    const etaTime = new Date(data.estimated_arrival_time);
    const remainingMs = etaTime - now;
    const remainingMinutes = Math.max(0, Math.round(remainingMs / (1000 * 60)));

    return {
      status: data.status,
      eta: data.estimated_arrival_time,
      remainingMinutes,
      remainingDistance,
      lastUpdated: data.agent_location_updated_at,
      agentLocation: data.agent_current_lat ? {
        lat: data.agent_current_lat,
        lng: data.agent_current_lng,
      } : null,
      customerLocation,
      routePath,
    };
  } catch (error) {
    console.error("Error getting delivery ETA:", error);
    throw error;
  }
};
