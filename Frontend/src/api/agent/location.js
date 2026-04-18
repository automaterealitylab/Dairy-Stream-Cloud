import { primeAgentOfflineSync, startDeliveryWithOffline, updateAgentLocationWithOffline } from "./offlineSync";

/**
 * Update agent location and calculate ETA
 */
export const updateAgentLocation = async (deliveryId, latitude, longitude) => {
  primeAgentOfflineSync();
  return updateAgentLocationWithOffline(deliveryId, latitude, longitude);
};

/**
 * Start delivery - sets delivery status to IN_TRANSIT and sends notification
 */
export const startDelivery = async (deliveryId, latitude, longitude) => {
  primeAgentOfflineSync();
  return startDeliveryWithOffline(deliveryId, latitude, longitude);
};

export default {
  updateAgentLocation,
  startDelivery,
};
