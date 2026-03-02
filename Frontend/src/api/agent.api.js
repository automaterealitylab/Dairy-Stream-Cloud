import client from "./client";

export const fetchAgentDashboard = async () => {
  const { data } = await client.get("/agent/dashboard");
  return data;
};

export const fetchAssignedAgentDeliveries = async ({ today = false } = {}) => {
  const { data } = await client.get("/agent/deliveries/assigned", {
    params: { today },
  });
  return data?.deliveries || [];
};

export const fetchAgentDeliveryHistory = async () => {
  const { data } = await client.get("/agent/deliveries/history");
  return data?.history || [];
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
} = {}) => {
  if (!deliveryId) throw new Error("deliveryId is required");
  const { data } = await client.patch(`/agent/deliveries/${deliveryId}/status`, {
    status,
    reason,
    proofType,
    proofOtp,
    proofImage,
  });
  return data;
};
