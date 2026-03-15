import client from "../client";

const CUSTOMER_DASHBOARD_CACHE_TTL_MS = 10 * 1000;
const customerDashboardCache = new Map();

// Helper to manage cache keys based on stored token
const getCacheKey = () => String(localStorage.getItem("token") || "guest");

/* =========================
    CACHE HELPERS
========================= */
const syncDashboardTodayDeliveryCache = (todayDelivery) => {
  if (!todayDelivery) return;
  const cacheKey = getCacheKey();
  const cached = customerDashboardCache.get(cacheKey);
  if (!cached?.payload) return;

  customerDashboardCache.set(cacheKey, {
    ...cached,
    at: Date.now(),
    payload: { ...cached.payload, todayDelivery },
  });
};

export const invalidateCustomerDashboardCache = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    customerDashboardCache.clear();
    return;
  }
  customerDashboardCache.delete(getCacheKey());
};

/* =========================
    CORE API FUNCTIONS
========================= */

// 1. DASHBOARD
export const fetchCustomerDashboard = async ({ force = false } = {}) => {
  const cacheKey = getCacheKey();
  const cached = customerDashboardCache.get(cacheKey);

  if (!force && cached && Date.now() - cached.at < CUSTOMER_DASHBOARD_CACHE_TTL_MS) {
    return cached.payload;
  }

  const { data } = await client.get("/customer/dashboard");
  customerDashboardCache.set(cacheKey, { payload: data, at: Date.now() });
  return data;
};

// 2. PROFILE
export const fetchCustomerProfile = async () => {
  const { data } = await client.get("/customer/profile");
  return data;
};

export const updateCustomerProfile = async (payload) => {
  const hasPhoto = Boolean(payload?.photoFile);

  if (hasPhoto) {
    const formData = new FormData();
    // ✅ Extract all text fields and append to FormData
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || key === "photoFile") return;
      formData.append(key, value);
    });
    
    // ✅ Append the image file specifically with the key 'image' (must match Multer on backend)
    formData.append("image", payload.photoFile);

    // ✅ Axios handles the boundary automatically when headers are set to multipart/form-data
    const { data } = await client.put("/customer/profile", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    invalidateCustomerDashboardCache();
    return data;
  }

  // ✅ If no photo, send as standard JSON (Axios default)
  const { data } = await client.put("/customer/profile", payload);
  invalidateCustomerDashboardCache();
  return data;
};

// 3. DELIVERIES & PAYMENTS
export const fetchCustomerDeliveries = async () => {
  const { data } = await client.get("/customer/deliveries");
  syncDashboardTodayDeliveryCache(data?.todayDelivery);
  return data;
};

export const reportCustomerDeliveryIssue = async ({ deliveryId, issue }) => {
  const { data } = await client.post(`/customer/deliveries/${deliveryId}/issue`, { issue });
  invalidateCustomerDashboardCache();
  return data;
};

export const createCustomerOneTimeOrder = async (payload) => {
  const { data } = await client.post("/customer/orders/one-time", payload);
  invalidateCustomerDashboardCache();
  return data;
};

export const cancelCustomerOneTimeOrder = async (payload) => {
  const { data } = await client.post("/customer/orders/one-time/cancel", payload);
  invalidateCustomerDashboardCache();
  return data;
};

export const fetchCustomerPayments = async () => {
  const { data } = await client.get("/customer/payments");
  return data;
};

export const createCustomerPaymentOrder = async (payload = {}) => {
  const { data } = await client.post("/customer/payments/order", payload);
  return data;
};

export const verifyCustomerPayment = async (payload) => {
  const { data } = await client.post("/customer/payments/verify", payload);
  return data;
};

// 4. SUBSCRIPTION MANAGEMENT
export const fetchCustomerSubscription = async () => {
  const { data } = await client.get("/customer/subscription");
  return data;
};

export const saveCustomerSubscription = async (payload) => {
  // ✅ Payload is an object, client.js attaches the token via Interceptor
  const { data } = await client.post("/customer/subscription", payload);
  invalidateCustomerDashboardCache();
  return data;
};

export const clearCustomerSubscription = async () => {
  const { data } = await client.delete("/customer/subscription");
  invalidateCustomerDashboardCache();
  return data;
};

/* =========================
    REGISTRATION
========================= */
export const registerCustomer = (data) => 
  client.post("/customer/addCustomer", data);
