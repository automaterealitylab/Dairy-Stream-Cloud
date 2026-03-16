import client from "../client.js";

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
export const getDeliveryETA = async (deliveryId) => {
  const response = await client.get(`/customer/deliveries/${deliveryId}/eta`);
  return response.data.eta;
};

export default {
  subscribeToPush,
  getDeliveryETA,
};
