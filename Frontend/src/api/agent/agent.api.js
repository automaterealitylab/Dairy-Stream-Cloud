import client from "../client";
import {
  fetchAssignedAgentDeliveriesWithOffline,
  flushAgentOfflineQueue,
  primeAgentOfflineSync,
  updateAssignedAgentDeliveryStatusWithOffline,
} from "./offlineSync";

export const fetchAgentDashboard = async () => {
  const { data } = await client.get("/agent/dashboard");
  return data;
};

export const fetchAssignedAgentDeliveries = async ({ today = false } = {}) => {
  primeAgentOfflineSync();
  return fetchAssignedAgentDeliveriesWithOffline({ today });
};

export const fetchAgentDeliveryHistory = async () => {
  const { data } = await client.get("/agent/deliveries/history");
  return data?.history || [];
};

export const createAssignedDeliveryOnlineOrder = async (deliveryId) => {
  if (!deliveryId) throw new Error("deliveryId is required");
  const { data } = await client.post(`/agent/deliveries/${deliveryId}/online-order`);
  return data;
};

export const verifyAssignedDeliveryOnlinePayment = async ({
  deliveryId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
} = {}) => {
  if (!deliveryId) throw new Error("deliveryId is required");
  const { data } = await client.post(`/agent/deliveries/${deliveryId}/online-verify`, {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });
  return data;
};

export const createAssignedDeliveryOnlineQr = async (deliveryId) => {
  if (!deliveryId) throw new Error("deliveryId is required");
  const { data } = await client.post(`/agent/deliveries/${deliveryId}/online-qr`);
  return data;
};

export const fetchAgentProfile = async () => {
  const { data } = await client.get("/agent/profile");
  return data?.profile || null;
};

export const updateAgentAvailability = async ({
  isActive,
  inactiveDays = null,
} = {}) => {
  const { data } = await client.patch("/agent/profile/availability", {
    isActive,
    inactiveDays,
  });
  return data;
};

export const updateAssignedAgentDeliveryStatus = async ({
  deliveryId,
  status,
  reason = "",
  proofType = "",
  proofOtp = "",
  proofImage = "",
  collectionMethod = "",
} = {}) => {
  primeAgentOfflineSync();
  return updateAssignedAgentDeliveryStatusWithOffline({
    deliveryId,
    status,
    reason,
    proofType,
    proofOtp,
    proofImage,
    collectionMethod,
  });
};

export { flushAgentOfflineQueue };
