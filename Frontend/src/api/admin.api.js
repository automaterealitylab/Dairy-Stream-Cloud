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

const patchCachedDashboard = (updater) => {
  const now = Date.now();
  const current = getCachedAdminDashboard();
  if (!current) return null;

  const next = updater(current);
  dashboardCache = next;
  cacheTime = now;
  persistDashboardCache(next, now);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("admin-plan-updated", {
        detail: { selectedPlan: next?.selectedPlan || null },
      })
    );
  }
  return next;
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

  // When forceRefresh is true, also tell the backend to bypass its own cache.
  const { data } = await client.get("/admin/dashboard", {
    params: forceRefresh ? { refresh: "true" } : {},
  });
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

export const fetchAdminCustomerBillDetails = async (id) => {
  const { data } = await client.get(`/admin/customers/${id}/bill-details`);
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
export const fetchAdminAgents = async ({ page = 1, limit = 10, search = "", lite = false } = {}) => {
  const { data } = await client.get("/admin/agents", {
    params: { page, limit, search, lite },
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

export const fetchAdminProfile = async ({ revealBankDetails = false } = {}) => {
  const { data } = await client.get("/admin/profile", {
    params: revealBankDetails ? { revealBankDetails: "true" } : {},
  });
  return data?.data || data;
};

export const updateAdminProfile = async (payload) => {
  const { data } = await client.patch("/admin/profile", payload);
  return data?.data || data;
};

export const lookupAdminBankIfsc = async (ifsc) => {
  const { data } = await client.get(`/admin/bank/ifsc/${encodeURIComponent(ifsc)}`);
  return data?.ifsc || data;
};

export const verifyAdminBankAccount = async (payload) => {
  const { data } = await client.post("/admin/bank/verify", payload);
  return data?.verification || data;
};

export const fetchAdminDeliveries = async ({ limit = 1000, date = "" } = {}) => {
  const { data } = await client.get("/admin/deliveries", {
    params: { limit, ...(date ? { date } : {}) },
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

export const collectAdminOfflinePayment = async ({
  customerId,
  receivedAmount,
  method = "CASH",
  note = "",
} = {}) => {
  const { data } = await client.post("/admin/payments/offline-collect", {
    customerId,
    receivedAmount,
    method,
    note,
  });
  return data;
};

export const fetchAdminPaymentVerifications = async ({ status = "PENDING", limit = 50 } = {}) => {
  const { data } = await client.get("/admin/payments/verifications", {
    params: { status, limit },
  });
  return data?.verifications || [];
};

export const approveAdminPaymentVerification = async (id) => {
  const { data } = await client.patch(`/admin/payments/verifications/${id}/approve`);
  return data;
};

export const rejectAdminPaymentVerification = async (id, reason = "") => {
  const { data } = await client.patch(`/admin/payments/verifications/${id}/reject`, { reason });
  return data;
};

export const fetchAdminAccountingReport = async ({ from = "", to = "" } = {}) => {
  const { data } = await client.get("/admin/payments/reports/accounting", {
    params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
  });
  return data?.report || data;
};

export const fetchAdminOperationalMonitoring = async () => {
  const { data } = await client.get("/admin/monitoring/operations");
  return data?.monitoring || data;
};

export const processAdminWhatsAppQueue = async ({ limit = 25 } = {}) => {
  const { data } = await client.post("/admin/monitoring/whatsapp/process", { limit });
  return data;
};

export const updateAdminFarmPlan = async (plan) => {
  const { data } = await client.patch("/admin/farm-plan", { plan });
  patchCachedDashboard((current) => ({
    ...current,
    selectedPlan: data?.selected_plan || plan,
  }));
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

export const fetchAdminPerformanceMonthlyTrends = async () => {
  const { data } = await client.get('/admin/performance/monthly-trends');
  return data;
};



/* =========================
   PROCUREMENT & SUPPLY
========================= */
export const fetchProcurementLogs = async () => {
  const { data } = await client.get("/admin/procurement");
  return Array.isArray(data?.data) ? data.data : [];
};

export const addProcurementLog = async (logData) => {
  const { data } = await client.post("/admin/procurement", logData);
  return data;
};

export const updateProcurementLog = async (logId, logData) => {
  const { data } = await client.put(`/admin/procurement/${logId}`, logData);
  return data;
};

export const fetchAdminSuppliers = async () => {
  const { data } = await client.get("/admin/suppliers");
  return Array.isArray(data?.data) ? data.data : [];
};

export const createAdminSupplier = async (payload) => {
  const { data } = await client.post("/admin/suppliers", payload);
  return data?.data || data;
};

export const updateAdminSupplier = async (supplierId, payload) => {
  const { data } = await client.put(`/admin/suppliers/${supplierId}`, payload);
  return data?.data || data;
};

export const removeAdminSupplier = async (supplierId) => {
  const { data } = await client.delete(`/admin/suppliers/${supplierId}`);
  return data?.data || data;
};

// Use this for recording manual payments via the modal
export const recordManualPayment = async (payload) => {
  const { data } = await client.post("/admin/payments/manual", payload);
  return data;
};

/* =========================
   NOTIFICATIONS
========================= */
export const fetchAdminNotifications = async () => {
  const { data } = await client.get("/admin/notifications");
  return data?.notifications || [];
};

export const markAdminNotificationRead = async (id) => {
  const { data } = await client.patch(`/admin/notifications/${id}/read`);
  return data;
};

export const markAllAdminNotificationsRead = async () => {
  const { data } = await client.post("/admin/notifications/read-all");
  return data;
};

export const createAdminFarmPlanOrder = async ({ plan, cycle }) => {
  const { data } = await client.post("/admin/farm-plan/order", { plan, cycle });
  return data;
};

export const verifyAdminFarmPlanPayment = async (payload) => {
  const { data } = await client.post("/admin/farm-plan/verify", payload);
  patchCachedDashboard((current) => ({
    ...current,
    selectedPlan: data?.selected_plan || payload.plan,
  }));
  return data;
};

export const createAdminFarmPlanSubscription = async ({ plan, cycle }) => {
  const { data } = await client.post("/admin/farm-plan/subscription", { plan, cycle });
  return data;
};

export const verifyAdminFarmPlanSubscriptionPayment = async (payload) => {
  const { data } = await client.post("/admin/farm-plan/subscription/verify", payload);
  patchCachedDashboard((current) => ({
    ...current,
    selectedPlan: data?.selected_plan || payload.plan,
  }));
  return data;
};
