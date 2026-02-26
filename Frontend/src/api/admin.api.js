import client from "./client";

/* =========================
   ADMIN LOGIN
========================= */
// export const adminApiLogin = async (email, password) => {
//   const { data } = await client.post("/admin/login", { email, password });

//   if (!data.token) throw new Error("No token received from server");

//   localStorage.setItem("adminToken", data.token);
//   if (data.admin) {
//     localStorage.setItem("adminUser", JSON.stringify(data.admin));
//   }

//   return data;
// };

/* =========================
   DASHBOARD (WITH CACHE)
========================= */
let dashboardCache = null;
let cacheTime = 0;

export const fetchAdminDashboard = async () => {
  const now = Date.now();
  if (dashboardCache && now - cacheTime < 60000) {
    return dashboardCache;
  }

  const { data } = await client.get("/admin/dashboard");
  dashboardCache = data;
  cacheTime = now;
  return data;
};

/* =========================
   CUSTOMER MANAGEMENT
========================= */
export const fetchAdminCustomers = async ({ page = 1, limit = 10, search = "" }) => {
  const { data } = await client.get("/admin/customers", {
    params: { page, limit, search },
  });
  return data;
};

export const fetchAdminCustomerById = async (id) => {
  const { data } = await client.get(`/admin/customers/${id}`);
  return data;
};

export const updateAdminCustomer = async (id, payload) => {
  const { data } = await client.put(`/admin/customers/${id}`, payload);
  return data;
};

export const deleteAdminCustomer = async (id) => {
  const { data } = await client.delete(`/admin/customers/${id}`);
  return data;
};

export const createAdminCustomerSubscription = async (customerId, payload) => {
  const { data } = await client.post(`/admin/customers/${customerId}/subscription`, payload);
  return data;
};

/* =========================
   AGENT MANAGEMENT
========================= */
export const fetchAdminAgents = async ({ page = 1, limit = 10, search = "" }) => {
  const { data } = await client.get("/admin/agents", {
    params: { page, limit, search },
  });
  return data;
};

export const fetchAdminAgentsById = async (id) => {
  const { data } = await client.get(`/admin/agents/${id}`);
  return data;
};

export const updateAdminAgent = async (id, payload) => {
  const { data } = await client.put(`/admin/agents/${id}`, payload);
  return data;
};

export const deleteAdminAgent = async (id) => {
  const { data } = await client.delete(`/admin/agents/${id}`);
  return data;
};

/* =========================
   DAIRY REGISTRATION
========================= */
export const registerDairyApi = async (dairyData) => {
  // Use a custom header for multipart/form-data if dairyData is FormData
  const config = dairyData instanceof FormData 
    ? { headers: { "Content-Type": "multipart/form-data" } } 
    : {};

  const { data } = await client.post("/admin/register-dairy", dairyData, config);
  return data;
};

export const fetchAdminDeliveries = async ({ limit = 1000 } = {}) => {
  const { data } = await client.get("/admin/deliveries", {
    params: { limit },
  });
  return data;
};

export const fetchAdminDeliverySchedulingOptions = async () => {
  const { data } = await client.get("/admin/deliveries/scheduling-options");
  return data;
};

export const scheduleAdminDelivery = async ({ customerId, agentId, deliveryDate, notes } = {}) => {
  const { data } = await client.post("/admin/deliveries/schedule", {
    customerId,
    agentId,
    deliveryDate,
    notes,
  });
  return data;
};

export const scheduleAdminDeliveriesBulk = async ({
  deliveryDate,
  agentId,
  slot = "ALL",
  route = "ALL",
  notes,
} = {}) => {
  const { data } = await client.post("/admin/deliveries/schedule-bulk", {
    deliveryDate,
    agentId,
    slot,
    route,
    notes,
  });
  return data;
};

/* =========================
   PAYMENTS
========================= */
export const fetchAdminPayments = async ({ page = 1, status = "ALL" } = {}) => {
  const { data } = await client.get("/admin/payments", {
    params: { page, status },
  });
  return data;
};

export const updateAdminPaymentStatus = async (id, status) => {
  const { data } = await client.patch(`/admin/payments/${id}/status`, { status });
  return data;
};

export const updateAdminFarmPlan = async (plan) => {
  const { data } = await client.patch("/admin/farm-plan", { plan });
  return data;
};
