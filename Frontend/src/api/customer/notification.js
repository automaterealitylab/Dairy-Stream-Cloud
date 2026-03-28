import client from "../client.js";

const DELIVERY_ETA_CACHE_TTL_MS = 45 * 1000;
const deliveryEtaCache = new Map();
const deliveryEtaRequests = new Map();

const getEtaCacheKey = (deliveryId) =>
  `${String(localStorage.getItem("token") || "guest")}:${deliveryId}`;

export const getCachedDeliveryETA = (deliveryId) => {
  if (!deliveryId) return null;

  const entry = deliveryEtaCache.get(getEtaCacheKey(deliveryId));
  if (!entry || Date.now() - entry.at >= DELIVERY_ETA_CACHE_TTL_MS) {
    return null;
  }

  return entry.payload;
};

/**
 * Subscribe customer to push notifications
 */
export const subscribeToPush = async (subscription) => {
  const response = await client.post(
    "/customer/notifications/subscribe",
    subscription
  );
  return response.data;
};

/**
 * Get delivery ETA
 */
export const getDeliveryETA = async (deliveryId, { force = false } = {}) => {
  if (!deliveryId) return null;

  const cacheKey = getEtaCacheKey(deliveryId);
  const cachedEta = getCachedDeliveryETA(deliveryId);

  if (!force && cachedEta) {
    return cachedEta;
  }

  const inflight = deliveryEtaRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = client
    .get(`/customer/deliveries/${deliveryId}/eta`)
    .then((response) => {
      const eta = response.data.eta;
      deliveryEtaCache.set(cacheKey, { payload: eta, at: Date.now() });
      return eta;
    })
    .finally(() => {
      deliveryEtaRequests.delete(cacheKey);
    });

  deliveryEtaRequests.set(cacheKey, request);
  return request;
};

export default {
  subscribeToPush,
  getCachedDeliveryETA,
  getDeliveryETA,
};
