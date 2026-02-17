const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").trim();
const CUSTOMER_DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const customerDashboardCache = new Map();

const getCustomerDashboardCacheKey = (token) => String(token || "");

export const fetchCustomerDashboard = async (token, { force = false } = {}) => {
  const cacheKey = getCustomerDashboardCacheKey(token);
  const cached = customerDashboardCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.at < CUSTOMER_DASHBOARD_CACHE_TTL_MS) {
    return cached.payload;
  }

  const res = await fetch(`${API_BASE}/api/customer/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch dashboard data");
  }

  const payload = await res.json();
  customerDashboardCache.set(cacheKey, { payload, at: Date.now() });
  return payload;
};

export const invalidateCustomerDashboardCache = (token) => {
  if (!token) {
    customerDashboardCache.clear();
    return;
  }
  customerDashboardCache.delete(getCustomerDashboardCacheKey(token));
};

export const fetchCustomerProfile = async (token) => {
  const res = await fetch(`${API_BASE}/api/customer/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Failed to fetch profile");
  }

  return data;
};

export const updateCustomerProfile = async (token, payload) => {
  const hasPhoto = Boolean(payload?.photoFile);

  let body;
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (hasPhoto) {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || key === "photoFile") return;
      formData.append(key, String(value));
    });
    formData.append("image", payload.photoFile);
    body = formData;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(payload);
  }

  const res = await fetch(`${API_BASE}/api/customer/profile`, {
    method: "PUT",
    headers,
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Failed to update profile");
  }

  invalidateCustomerDashboardCache(token);
  return data;
};

export const fetchCustomerDeliveries = async (token) => {
  const res = await fetch(`${API_BASE}/api/customer/deliveries`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Failed to fetch deliveries");
  }

  return data;
};

export const fetchCustomerPayments = async (token) => {
  const res = await fetch(`${API_BASE}/api/customer/payments`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Failed to fetch payments");
  }

  return data;
};

export const fetchCustomerSubscription = async (token) => {
  const res = await fetch(`${API_BASE}/api/customer/subscription`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch subscription");
  }

  return res.json();
};

export const saveCustomerSubscription = async (token, payload) => {
  const res = await fetch(`${API_BASE}/api/customer/subscription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to save subscription");
  }

  const data = await res.json();
  invalidateCustomerDashboardCache(token);
  return data;
};

export const clearCustomerSubscription = async (token) => {
  const res = await fetch(`${API_BASE}/api/customer/subscription`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Failed to clear subscription");
  }

  invalidateCustomerDashboardCache(token);
  return data;
};
