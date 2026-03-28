const DASHBOARD_CACHE_TTL_MS = 10 * 1000;
const dashboardCache = new Map();

export const getCachedCustomerDashboardPayload = (cacheKey) => {
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.at < DASHBOARD_CACHE_TTL_MS) {
    return cached.payload;
  }

  return null;
};

export const setCachedCustomerDashboardPayload = (cacheKey, payload) => {
  dashboardCache.set(cacheKey, { payload, at: Date.now() });
};

export const invalidateCustomerDashboardCache = (customerId = null) => {
  if (customerId === null || customerId === undefined) {
    dashboardCache.clear();
    return;
  }

  const prefix = `${customerId}:`;
  [...dashboardCache.keys()].forEach((cacheKey) => {
    if (String(cacheKey).startsWith(prefix)) {
      dashboardCache.delete(cacheKey);
    }
  });
};
