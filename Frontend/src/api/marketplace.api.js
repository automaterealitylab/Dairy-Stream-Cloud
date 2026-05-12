import client from "./client";

export const fetchMarketplaceDairies = async () => {
  const { data } = await client.get("/marketplace/dairies");
  return data?.data || [];
};

export const fetchMarketplaceProducts = async (dairyId) => {
  const { data } = await client.get(`/marketplace/dairies/${dairyId}/products`);
  return data?.data || [];
};

export const registerMarketplaceDairy = async (payload) => {
  const { data } = await client.post("/marketplace/dairies", payload);
  return data?.data || data;
};

export const createMarketplaceOrder = async (payload) => {
  const { data } = await client.post("/marketplace/orders", payload);
  return data?.data || data;
};

export const verifyMarketplacePayment = async (payload) => {
  const { data } = await client.post("/marketplace/payments/verify", payload);
  return data?.data || data;
};

export const fetchMarketplaceAdminDashboard = async () => {
  const { data } = await client.get("/marketplace/admin/dashboard");
  return data?.data || data;
};

export const fetchMarketplaceMonitoring = async () => {
  const { data } = await client.get("/marketplace/admin/monitoring");
  return data?.data || data;
};

export const fetchMarketplaceReconciliation = async () => {
  const { data } = await client.get("/marketplace/admin/reconciliation");
  return data?.data || data;
};

export const fetchMarketplaceDairyDashboard = async (dairyId) => {
  const { data } = await client.get(`/marketplace/dairies/${dairyId}/dashboard`);
  return data?.data || data;
};
