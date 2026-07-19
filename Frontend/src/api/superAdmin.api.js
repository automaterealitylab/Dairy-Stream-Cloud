import client from "./client";

// ===============================
// 1. AUTHENTICATION APIs
// ===============================
export const superAdminLoginApi = async (email, password) => {
  const { data } = await client.post("/super-admin/auth/login", { email, password });
  return data;
};

export const superAdminGetMeApi = async (token) => {
  const { data } = await client.get("/super-admin/auth/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// ===============================
// 2. DASHBOARD APIs
// ===============================
export const fetchDashboardMetrics = async () => {
  const { data } = await client.get("/super-admin/dashboard/metrics");
  return data;
};

export const fetchDashboardCharts = async () => {
  const { data } = await client.get("/super-admin/dashboard/charts");
  return data;
};

export const logPageviewApi = async (payload) => {
  const { data } = await client.post("/super-admin/analytics/pageview", payload);
  return data;
};

// ===============================
// 3. DAIRY MANAGEMENT APIs
// ===============================
export const fetchDairiesApi = async (params = {}) => {
  const { data } = await client.get("/super-admin/dairies", { params });
  return data;
};

export const updateDairyStatusApi = async (id, status) => {
  const { data } = await client.patch(`/super-admin/dairies/${id}/status`, { status });
  return data;
};

export const upgradeDairySubscriptionApi = async (id, plan, billingCycle) => {
  const { data } = await client.patch(`/super-admin/dairies/${id}/upgrade`, { plan, billingCycle });
  return data;
};

export const resetOwnerPasswordApi = async (id, newPassword) => {
  const { data } = await client.patch(`/super-admin/dairies/${id}/reset-password`, { newPassword });
  return data;
};

export const deleteDairyApi = async (id) => {
  const { data } = await client.delete(`/super-admin/dairies/${id}`);
  return data;
};

// ===============================
// 4. PLATFORM PLANS APIs
// ===============================
export const fetchPlansApi = async () => {
  const { data } = await client.get("/super-admin/plans");
  return data;
};

export const createPlanApi = async (payload) => {
  const { data } = await client.post("/super-admin/plans", payload);
  return data;
};

export const updatePlanApi = async (id, payload) => {
  const { data } = await client.put(`/super-admin/plans/${id}`, payload);
  return data;
};

export const deletePlanApi = async (id) => {
  const { data } = await client.delete(`/super-admin/plans/${id}`);
  return data;
};

// ===============================
// 5. COUPONS APIs
// ===============================
export const fetchCouponsApi = async () => {
  const { data } = await client.get("/super-admin/coupons");
  return data;
};

export const createCouponApi = async (payload) => {
  const { data } = await client.post("/super-admin/coupons", payload);
  return data;
};

export const deleteCouponApi = async (id) => {
  const { data } = await client.delete(`/super-admin/coupons/${id}`);
  return data;
};

export const fetchRedemptionsApi = async () => {
  const { data } = await client.get("/super-admin/coupons/redemptions");
  return data;
};

export const validateCouponApi = async (payload) => {
  const { data } = await client.post("/super-admin/coupons/validate", payload);
  return data;
};

// ===============================
// 6. SUPPORT TICKETS APIs
// ===============================
export const fetchTicketsApi = async (params = {}) => {
  const { data } = await client.get("/super-admin/support/tickets", { params });
  return data;
};

export const createTicketApi = async (payload) => {
  const { data } = await client.post("/super-admin/support/tickets", payload);
  return data;
};

export const updateTicketApi = async (id, payload) => {
  const { data } = await client.put(`/super-admin/support/tickets/${id}`, payload);
  return data;
};

// ===============================
// 7. PLATFORM SETTINGS APIs
// ===============================
export const fetchSettingsApi = async () => {
  const { data } = await client.get("/super-admin/settings");
  return data;
};

export const updateSettingsApi = async (payload) => {
  const { data } = await client.post("/super-admin/settings", payload);
  return data;
};

// ===============================
// 8. APP MONITORING APIs
// ===============================
export const fetchHealthApi = async () => {
  const { data } = await client.get("/super-admin/monitoring/health");
  return data;
};

export const fetchLogsApi = async () => {
  const { data } = await client.get("/super-admin/monitoring/logs");
  return data;
};

// ===============================
// 9. ANNOUNCEMENTS APIs
// ===============================
export const fetchAnnouncementsApi = async () => {
  const { data } = await client.get("/super-admin/announcements");
  return data;
};

export const createAnnouncementApi = async (payload) => {
  const { data } = await client.post("/super-admin/announcements", payload);
  return data;
};
