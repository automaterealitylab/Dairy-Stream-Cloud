const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").trim();

/* =========================
   ADMIN LOGIN
========================= */
export const adminApiLogin = async (email, password) => {
  const res = await fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || "Admin login failed");
  }

  const data = JSON.parse(text);

  if (!data.token) {
    throw new Error("No token received from server");
  }

  localStorage.setItem("adminToken", data.token);

  if (data.admin) {
    localStorage.setItem("adminUser", JSON.stringify(data.admin));
  }

  return data;
};

/* =========================
   DASHBOARD (CACHED)
========================= */
let dashboardCache = null;
let cacheTime = 0;

export const fetchAdminDashboard = async () => {
  const now = Date.now();

  // 60 seconds cache
  if (dashboardCache && now - cacheTime < 60000) {
    return dashboardCache;
  }

  const token = localStorage.getItem("token");
  if (!token) throw new Error("Admin token missing");

  const res = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || "Failed to fetch dashboard");

  const data = JSON.parse(text);

  dashboardCache = data;
  cacheTime = now;

  return data;
};

// fetch customer in admin dashboard
export const fetchAdminCustomers = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Admin token missing");

  const params = new URLSearchParams({
    page,
    limit,
    search,
  });

  const res = await fetch(
    `${BASE_URL}/api/admin/customers?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const text = await res.text();
  if (!res.ok) throw new Error(text);

  return JSON.parse(text);
};

export const fetchAdminCustomerById = async (id) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Admin token missing");

  const res = await fetch(
    `${BASE_URL}/api/admin/customers/${id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const text = await res.text();
  if (!res.ok) throw new Error(text);

  return JSON.parse(text);
};

/* =========================
   REGISTER DAIRY
========================= */
export const registerDairyApi = async (dairyData) => {
  const res = await fetch(`${BASE_URL}/api/admin/register-dairy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dairyData),
  });

  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(
      payload?.error || payload?.message || text || "Failed to register dairy"
    );
  }

  return payload ?? {};
};


/* =========================
   FETCH AGENTS (DELIVERY STAFF)
========================= */
export const fetchAdminAgents = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Admin token missing");

  const params = new URLSearchParams({
    page,
    limit,
    search,
  });

  const res = await fetch(
    `${BASE_URL}/api/admin/agents?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const text = await res.text();
  if (!res.ok) throw new Error(text);

  return JSON.parse(text);
};

export const fetchAdminAgentsById = async (id) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Admin token missing");

  const res = await fetch(
    `${BASE_URL}/api/admin/agents/${id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const text = await res.text();
  if (!res.ok) throw new Error(text);

  return JSON.parse(text);
};