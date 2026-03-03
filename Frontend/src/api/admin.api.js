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
const DASHBOARD_CACHE_KEY = "adminDashboardCacheV1";
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

let dashboardCache = null;
let cacheTime = 0;

const readPersistedDashboardCache = () => {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.timestamp) return null;

    const isFresh = Date.now() - parsed.timestamp < DASHBOARD_CACHE_TTL_MS;
    return isFresh ? parsed : null;
  } catch {
    return null;
  }
};

const persistDashboardCache = (data, timestamp) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      DASHBOARD_CACHE_KEY,
      JSON.stringify({ data, timestamp })
    );
  } catch {
    // Ignore storage write failures to keep API flow stable.
  }
};

export const getCachedAdminDashboard = () => {
  const now = Date.now();
  if (dashboardCache && now - cacheTime < DASHBOARD_CACHE_TTL_MS) {
    return dashboardCache;
  }

  const persisted = readPersistedDashboardCache();
  if (!persisted) return null;

  dashboardCache = persisted.data;
  cacheTime = persisted.timestamp;
  return persisted.data;
};

export const fetchAdminDashboard = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh) {
    const cachedDashboard = getCachedAdminDashboard();
    if (cachedDashboard) return cachedDashboard;
  }

  const { data } = await client.get("/admin/dashboard");
  const now = Date.now();

  dashboardCache = data;
  cacheTime = now;
  persistDashboardCache(data, now);

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

export const approveAdminCustomerSubscription = async (customerId) => {
  const { data } = await client.patch(`/admin/customers/${customerId}/subscription/approve`);
  return data;
};

export const assignAdminCustomerPermanentPartner = async (customerId, agentId) => {
  const { data } = await client.patch(`/admin/customers/${customerId}/subscription/assign-partner`, {
    agentId,
  });
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

export const approveAdminDelivery = async (id) => {
  const { data } = await client.patch(`/admin/deliveries/${id}/approve`);
  return data;
};

export const approveAllAdminDeliveries = async () => {
  const { data } = await client.post("/admin/deliveries/approve-all");
  return data;
};

export const assignAdminDeliveryPartner = async (id, agentId) => {
  const { data } = await client.patch(`/admin/deliveries/${id}/assign-partner`, { agentId });
  return data;
};

export const resolveAdminDeliveryIssue = async (id, note = "") => {
  const { data } = await client.patch(`/admin/deliveries/${id}/resolve-issue`, { note });
  return data;
};

/* =========================
   PRODUCTS & STOCK
========================= */
export const fetchAdminProducts = async ({ search = "", includeInactive = true } = {}) => {
  const { data } = await client.get("/admin/products", {
    params: { search, includeInactive },
  });
  return data;
};

export const createAdminProduct = async (payload) => {
  const { data } = await client.post("/admin/products", payload);
  return data;
};

export const updateAdminProduct = async (id, payload) => {
  const { data } = await client.put(`/admin/products/${id}`, payload);
  return data;
};

export const deleteAdminProduct = async (id) => {
  const { data } = await client.delete(`/admin/products/${id}`);
  return data;
};

/* =========================
   PERFORMANCE & EARNINGS
========================= */
export const fetchAdminPerformance = async ({ startDate = "", endDate = "", agentId = "" } = {}) => {
  const params = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (agentId) params.agentId = agentId;

  const { data } = await client.get('/admin/performance', { params });
  return data;
};

export const fetchAdminTopPerformers = async ({ limit = 10 } = {}) => {
  const { data } = await client.get('/admin/performance/top-performers', {
    params: { limit },
  });
  return data;
};

export const fetchAdminMissedDeliveries = async ({ startDate = "", endDate = "" } = {}) => {
  const params = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const { data } = await client.get('/admin/performance/missed-deliveries', { params });
  return data;
};

export const fetchAdminPerformanceSummary = async () => {
  const { data } = await client.get('/admin/performance/summary');
  return data;
};

export const fetchAdminAgentTodayWorkSummary = async ({ agentId } = {}) => {
  const { data } = await client.get('/admin/earnings/today-summary', {
    params: { agentId },
  });
  return data;
};

export const fetchAdminAgentEarningsSummary = async ({ agentId, startDate = "", endDate = "" } = {}) => {
  const params = { agentId };
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const { data } = await client.get('/admin/earnings/summary', { params });
  return data;
};
