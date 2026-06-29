import client from "../client";

const CUSTOMER_DASHBOARD_CACHE_TTL_MS = 10 * 1000;
const CUSTOMER_PROFILE_CACHE_TTL_MS = 30 * 1000;
const CUSTOMER_DELIVERIES_CACHE_TTL_MS = 15 * 1000;
const CUSTOMER_PAYMENTS_CACHE_TTL_MS = 15 * 1000;
const CUSTOMER_SUBSCRIPTION_CACHE_TTL_MS = 15 * 1000;

const customerDashboardCache = new Map();
const customerDashboardRequests = new Map();
const customerReadCache = new Map();
const customerReadRequests = new Map();

const getStoredCustomerToken = () => {
  const fallbackToken = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");

  if (!storedUser) return fallbackToken || null;

  try {
    return JSON.parse(storedUser)?.token || fallbackToken || null;
  } catch {
    return fallbackToken || null;
  }
};

const hasFreshCacheEntry = (entry, ttlMs) => Boolean(entry) && Date.now() - entry.at < ttlMs;
const getFreshCachePayload = (cache, cacheKey, ttlMs) => {
  const entry = cache.get(cacheKey);
  return hasFreshCacheEntry(entry, ttlMs) ? entry.payload : null;
};

// Helper to manage cache keys based on stored token.
const getCacheKey = () => String(getStoredCustomerToken() || "guest");
const getScopedCacheKey = (resourceName) => `${getCacheKey()}:${resourceName}`;

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

const loadCustomerReadResource = async ({
  resourceName,
  ttlMs,
  force = false,
  loader,
} = {}) => {
  const cacheKey = getScopedCacheKey(resourceName);
  const cached = getFreshCachePayload(customerReadCache, cacheKey, ttlMs);

  if (!force && cached) {
    return cached;
  }

  const inflight = customerReadRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = loader()
    .then((payload) => {
      customerReadCache.set(cacheKey, { payload, at: Date.now() });
      return payload;
    })
    .finally(() => {
      customerReadRequests.delete(cacheKey);
    });

  customerReadRequests.set(cacheKey, request);
  return request;
};

const getCachedCustomerReadResource = (resourceName, ttlMs) =>
  getFreshCachePayload(customerReadCache, getScopedCacheKey(resourceName), ttlMs);

const safePrefetch = (loader) => {
  if (!getStoredCustomerToken()) {
    return Promise.resolve(null);
  }

  return loader().catch(() => null);
};

const invalidateCustomerReadCache = (...resourceNames) => {
  if (!resourceNames.length) {
    customerReadCache.clear();
    customerReadRequests.clear();
    return;
  }

  resourceNames.forEach((resourceName) => {
    const cacheKey = getScopedCacheKey(resourceName);
    customerReadCache.delete(cacheKey);
    customerReadRequests.delete(cacheKey);
  });
};

export const invalidateCustomerDashboardCache = () => {
  const token = getStoredCustomerToken();
  if (!token) {
    customerDashboardCache.clear();
    customerDashboardRequests.clear();
    return;
  }

  const cacheKey = getCacheKey();
  customerDashboardCache.delete(cacheKey);
  customerDashboardRequests.delete(cacheKey);
};

/* =========================
    CORE API FUNCTIONS
========================= */

// 1. DASHBOARD
export const fetchCustomerDashboard = async ({ force = false } = {}) => {
  const cacheKey = getCacheKey();
  const cached = getFreshCachePayload(
    customerDashboardCache,
    cacheKey,
    CUSTOMER_DASHBOARD_CACHE_TTL_MS
  );

  if (!force && cached) {
    return cached;
  }

  const inflight = customerDashboardRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = client
    .get("/customer/dashboard")
    .then(({ data }) => {
      customerDashboardCache.set(cacheKey, { payload: data, at: Date.now() });
      return data;
    })
    .finally(() => {
      customerDashboardRequests.delete(cacheKey);
    });

  customerDashboardRequests.set(cacheKey, request);
  return request;
};

export const getCachedCustomerDashboard = () =>
  getFreshCachePayload(customerDashboardCache, getCacheKey(), CUSTOMER_DASHBOARD_CACHE_TTL_MS);

export const prefetchCustomerDashboard = () => safePrefetch(() => fetchCustomerDashboard());

// 2. PROFILE
export const fetchCustomerProfile = async ({ force = false } = {}) =>
  loadCustomerReadResource({
    resourceName: "profile",
    ttlMs: CUSTOMER_PROFILE_CACHE_TTL_MS,
    force,
    loader: async () => {
      const { data } = await client.get("/customer/profile");
      return data;
    },
  });

export const getCachedCustomerProfile = () =>
  getCachedCustomerReadResource("profile", CUSTOMER_PROFILE_CACHE_TTL_MS);

export const prefetchCustomerProfile = () => safePrefetch(() => fetchCustomerProfile());

export const updateCustomerProfile = async (payload) => {
  const hasPhoto = Boolean(payload?.photoFile);

  if (hasPhoto) {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || key === "photoFile") return;
      formData.append(key, value);
    });
    formData.append("image", payload.photoFile);

    const { data } = await client.put("/customer/profile", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    invalidateCustomerDashboardCache();
    invalidateCustomerReadCache("profile");
    return data;
  }

  const { data } = await client.put("/customer/profile", payload);
  invalidateCustomerDashboardCache();
  invalidateCustomerReadCache("profile");
  return data;
};

// 3. DELIVERIES & PAYMENTS
export const fetchCustomerDeliveries = async ({ force = false } = {}) => {
  const data = await loadCustomerReadResource({
    resourceName: "deliveries",
    ttlMs: CUSTOMER_DELIVERIES_CACHE_TTL_MS,
    force,
    loader: async () => {
      const response = await client.get("/customer/deliveries");
      return response.data;
    },
  });

  syncDashboardTodayDeliveryCache(data?.todayDelivery);
  return data;
};

export const getCachedCustomerDeliveries = () =>
  getCachedCustomerReadResource("deliveries", CUSTOMER_DELIVERIES_CACHE_TTL_MS);

export const prefetchCustomerDeliveries = () => safePrefetch(() => fetchCustomerDeliveries());

export const reportCustomerDeliveryIssue = async ({ deliveryId, issue }) => {
  const { data } = await client.post(`/customer/deliveries/${deliveryId}/issue`, { issue });
  invalidateCustomerDashboardCache();
  invalidateCustomerReadCache("deliveries");
  return data;
};

export const createCustomerOneTimeOrder = async (payload) => {
  const { data } = await client.post("/customer/orders/one-time", payload);
  invalidateCustomerDashboardCache();
  invalidateCustomerReadCache("deliveries", "payments");
  return data;
};

export const cancelCustomerOneTimeOrder = async (payload) => {
  const { data } = await client.post("/customer/orders/one-time/cancel", payload);
  invalidateCustomerDashboardCache();
  invalidateCustomerReadCache("deliveries", "payments");
  return data;
};

export const fetchCustomerPayments = async ({ force = false } = {}) =>
  loadCustomerReadResource({
    resourceName: "payments",
    ttlMs: CUSTOMER_PAYMENTS_CACHE_TTL_MS,
    force,
    loader: async () => {
      const { data } = await client.get("/customer/payments");
      return data;
    },
  });

export const getCachedCustomerPayments = () =>
  getCachedCustomerReadResource("payments", CUSTOMER_PAYMENTS_CACHE_TTL_MS);

export const prefetchCustomerPayments = () => safePrefetch(() => fetchCustomerPayments());

export const createCustomerPaymentOrder = async (payload = {}) => {
  const { data } = await client.post("/customer/payments/order", payload);
  return data;
};

export const createCustomerUpiPaymentIntent = async (payload = {}) => {
  const { data } = await client.post("/customer/payments/upi-intent", payload);
  return data;
};

export const submitCustomerUpiPaymentVerification = async (payload = {}) => {
  const hasScreenshot = Boolean(payload?.screenshotFile);

  if (hasScreenshot) {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || key === "screenshotFile") return;
      formData.append(key, value);
    });
    formData.append("image", payload.screenshotFile);

    const { data } = await client.post("/customer/payments/verify-upi", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    invalidateCustomerDashboardCache();
    invalidateCustomerReadCache("payments");
    return data;
  }

  const { data } = await client.post("/customer/payments/verify-upi", payload);
  invalidateCustomerDashboardCache();
  invalidateCustomerReadCache("payments");
  return data;
};

export const previewCustomerPaymentScreenshotOcr = async (screenshotFile) => {
  const formData = new FormData();
  formData.append("image", screenshotFile);

  const { data } = await client.post("/customer/payments/ocr-preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const verifyCustomerPayment = async (payload) => {
  const { data } = await client.post("/customer/payments/verify", payload);
  invalidateCustomerDashboardCache();
  invalidateCustomerReadCache("payments");
  return data;
};

export const createCustomerWalletTopupOrder = async (payload) => {
  const { data } = await client.post("/customer/payments/wallet/order", payload);
  return data;
};

export const verifyCustomerWalletTopup = async (payload) => {
  const { data } = await client.post("/customer/payments/wallet/verify", payload);
  invalidateCustomerDashboardCache();
  invalidateCustomerReadCache("payments");
  return data;
};

export const payCustomerBillWithWallet = async (payload) => {
  const { data } = await client.post("/customer/payments/pay-wallet", payload);
  invalidateCustomerDashboardCache();
  invalidateCustomerReadCache("payments");
  return data;
};

export const fetchCustomerInvoices = async ({ limit = 24 } = {}) => {
  const { data } = await client.get("/customer/invoices", { params: { limit } });
  return data?.invoices || [];
};

export const fetchCustomerInvoiceDetail = async (id) => {
  const { data } = await client.get(`/customer/invoices/${id}`);
  return data?.invoice || data;
};

export const getCustomerInvoicePdfUrl = (id) => `/customer/invoices/${id}/pdf`;

export const shareCustomerInvoiceWhatsApp = async (id, payload = {}) => {
  const { data } = await client.post(`/customer/invoices/${id}/share-whatsapp`, payload);
  return data;
};

// 4. SUBSCRIPTION MANAGEMENT
export const fetchCustomerSubscription = async ({ force = false } = {}) =>
  loadCustomerReadResource({
    resourceName: "subscription",
    ttlMs: CUSTOMER_SUBSCRIPTION_CACHE_TTL_MS,
    force,
    loader: async () => {
      const { data } = await client.get("/customer/subscription");
      return data;
    },
  });

export const getCachedCustomerSubscription = () =>
  getCachedCustomerReadResource("subscription", CUSTOMER_SUBSCRIPTION_CACHE_TTL_MS);

export const prefetchCustomerSubscription = () =>
  safePrefetch(() => fetchCustomerSubscription());

export const saveCustomerSubscription = async (payload) => {
  const { data } = await client.post("/customer/subscription", payload);
  invalidateCustomerDashboardCache();
  invalidateCustomerReadCache("subscription", "deliveries", "payments");
  return data;
};

export const clearCustomerSubscription = async () => {
  const { data } = await client.delete("/customer/subscription");
  invalidateCustomerDashboardCache();
  invalidateCustomerReadCache("subscription", "deliveries", "payments");
  return data;
};

/* =========================
    REGISTRATION
========================= */
export const registerCustomer = (data) => client.post("/customer/addCustomer", data);
