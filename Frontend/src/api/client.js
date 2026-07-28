import axios from "axios";

const RENDER_BACKEND_URL = "https://dairy-stream-cloud-backend.onrender.com";
let csrfTokenPromise = null;

const getCsrfTokenFromCookie = () => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const fetchCsrfToken = async () => {
  if (typeof window === "undefined") return null;
  const existing = getCsrfTokenFromCookie();
  if (existing) return existing;
  if (csrfTokenPromise) return csrfTokenPromise;

  csrfTokenPromise = axios.get(`${API_BASE_URL}/auth/csrf`, { withCredentials: true })
    .then((response) => response?.data?.csrfToken || getCsrfTokenFromCookie())
    .finally(() => {
      csrfTokenPromise = null;
    });

  return csrfTokenPromise;
};

const isStateChangingMethod = (method = "get") => ["post", "put", "patch", "delete"].includes(String(method).toLowerCase());

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
export const API_BASE_URL = `${BASE_URL}/api`;

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach role-specific tokens so customer/admin APIs don't get mixed tokens.
client.interceptors.request.use(async (config) => {
  const existingAuthorization =
    config.headers?.Authorization || config.headers?.authorization;

  if (existingAuthorization) {
    return config;
  }

  if (isStateChangingMethod(config.method)) {
    const csrfToken = await fetchCsrfToken();
    if (csrfToken) {
      config.headers = {
        ...(config.headers || {}),
        "X-CSRF-Token": csrfToken,
      };
    }
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
  async (error) => {
    const status = error.response ? error.response.status : null;
    const requestPath = error.config ? String(error.config.url || "") : "";
    const isRefreshRequest = requestPath.includes("/auth/refresh");

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
      "/auth/csrf",
    ].some((path) => requestPath.startsWith(path));

    if (status === 401 && !isPublicAuthRoute && !isRefreshRequest) {
      const requestConfig = error.config || {};
      const retryCount = requestConfig.__retryCount || 0;

      if (retryCount >= 1) {
        console.warn("Unauthorized API request detected (401) after refresh retry, logging out user...");
        localStorage.clear();
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem("refreshToken");
      const sessionId = localStorage.getItem("sessionId");
      if (refreshToken && sessionId) {
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { sessionId, refreshToken },
            { withCredentials: true, timeout: 15000 }
          );
          if (data?.success && data?.accessToken) {
            localStorage.setItem("token", data.accessToken);
            if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
            if (data.sessionId) localStorage.setItem("sessionId", data.sessionId);
            requestConfig.__retryCount = retryCount + 1;
            requestConfig.headers = {
              ...(requestConfig.headers || {}),
              Authorization: `Bearer ${data.accessToken}`,
            };
            return client(requestConfig);
          }
        } catch (refreshError) {
          const refreshStatus = refreshError?.response?.status || 0;
          const refreshMessage = refreshError?.response?.data?.message || refreshError?.message || "Unknown error";
          console.warn("Refresh token failed", { status: refreshStatus, message: refreshMessage });
        }
      }

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
