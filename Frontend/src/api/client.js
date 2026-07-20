import axios from "axios";

const RENDER_BACKEND_URL = "https://dairy-stream-cloud-backend.onrender.com";

const getDynamicBaseUrl = () => {
  const envUrl =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_BASE_URL;

  if (envUrl) {
    return envUrl.replace(/\/api\/?$/, "");
  }

  if (typeof window !== "undefined") {
    const hostname = window.location?.hostname || "";
    const protocol = window.location?.protocol || "";
    const userAgent = typeof navigator !== "undefined" ? navigator?.userAgent || "" : "";

    const isMobileDevice =
      protocol === "file:" ||
      protocol === "capacitor:" ||
      protocol === "ionic:" ||
      Boolean(window.Capacitor) ||
      Boolean(window.cordova) ||
      /Mobile|Android|iPhone|iPad|iPod|wv/i.test(userAgent);

    if (isMobileDevice) {
      return RENDER_BACKEND_URL;
    }

    if ((hostname === "localhost" || hostname === "127.0.0.1") && import.meta.env.VITE_USE_LOCAL_BACKEND === "true") {
      return "http://localhost:4000";
    }
  }

  return RENDER_BACKEND_URL;
};

export const BASE_URL = getDynamicBaseUrl();
console.log("🚀 API BASE_URL resolved:", BASE_URL);
export const API_BASE_URL = `${BASE_URL}/api`;

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach role-specific tokens so customer/admin APIs don't get mixed tokens.
client.interceptors.request.use((config) => {
  const existingAuthorization =
    config.headers?.Authorization || config.headers?.authorization;

  if (existingAuthorization) {
    return config;
  }

  const requestPath = String(config.url || "");
  const isPublicAuthRoute = [
    "/auth/detect",
    "/auth/admin/login",
    "/auth/admin/forgot-password/request-otp",
    "/auth/admin/forgot-password/reset",
    "/auth/agent/login",
    "/auth/agent/forgot-password/request-otp",
    "/auth/agent/forgot-password/reset",
    "/auth/login/otp",
    "/auth/login/otp/verify",
  ].some((path) => requestPath.startsWith(path));

  if (isPublicAuthRoute) {
    return config;
  }

  const adminToken = localStorage.getItem("adminToken");
  const customerToken = localStorage.getItem("token");
  const agentToken = localStorage.getItem("agentToken");
  const superAdminToken = localStorage.getItem("superAdminToken");
  const storedUserRaw = localStorage.getItem("user");
  let storedUser = null;
  try {
    storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
  } catch {
    storedUser = null;
  }
  const fallbackRole = String(storedUser?.role || localStorage.getItem("userRole") || "").toUpperCase();
  const fallbackToken = storedUser?.token || null;

  let token = null;
  if (requestPath.startsWith("/super-admin")) {
    token = superAdminToken || (["SUPER_ADMIN", "OWNER", "COMPANY_STAFF"].includes(fallbackRole) ? fallbackToken : null);
  } else if (requestPath.startsWith("/customer")) {
    token = customerToken || (fallbackRole === "CUSTOMER" ? fallbackToken : null);
  } else if (requestPath.startsWith("/admin")) {
    token = adminToken || (fallbackRole === "ADMIN" ? fallbackToken : null);
  } else if (requestPath.startsWith("/agent")) {
    token = agentToken || ((fallbackRole === "AGENT" || fallbackRole === "STAFF") ? fallbackToken : null);
  } else {
    if (["SUPER_ADMIN", "OWNER", "COMPANY_STAFF"].includes(fallbackRole)) {
      token = superAdminToken || fallbackToken;
    } else if (fallbackRole === "ADMIN") {
      token = adminToken || fallbackToken || customerToken || agentToken;
    } else if (fallbackRole === "AGENT" || fallbackRole === "STAFF") {
      token = agentToken || fallbackToken || adminToken || customerToken;
    } else if (fallbackRole === "CUSTOMER") {
      token = customerToken || fallbackToken || adminToken || agentToken;
    } else {
      token = superAdminToken || adminToken || customerToken || agentToken || fallbackToken;
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global response interceptor to handle session expiration (401 Unauthorized)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    const requestPath = error.config ? String(error.config.url || "") : "";

    // Skip public routes to let them handle their own error messages
    const isPublicAuthRoute = [
      "/auth/detect",
      "/auth/admin/login",
      "/auth/admin/forgot-password/request-otp",
      "/auth/admin/forgot-password/reset",
      "/auth/agent/login",
      "/auth/agent/forgot-password/request-otp",
      "/auth/agent/forgot-password/reset",
      "/auth/login/otp",
      "/auth/login/otp/verify",
    ].some((path) => requestPath.startsWith(path));

    if (status === 401 && !isPublicAuthRoute) {
      console.warn("Unauthorized API request detected (401), logging out user...");
      localStorage.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export { client };
export default client;
