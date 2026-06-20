import axios from "axios";

// Cleanly fetch and trim the base URL
export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").trim();
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
  if (requestPath.startsWith("/customer")) {
    token = customerToken || (fallbackRole === "CUSTOMER" ? fallbackToken : null);
  } else if (requestPath.startsWith("/admin")) {
    token = adminToken || (fallbackRole === "ADMIN" ? fallbackToken : null);
  } else if (requestPath.startsWith("/agent")) {
    token = agentToken || ((fallbackRole === "AGENT" || fallbackRole === "STAFF") ? fallbackToken : null);
  } else {
    if (fallbackRole === "ADMIN") {
      token = adminToken || fallbackToken || customerToken || agentToken;
    } else if (fallbackRole === "AGENT" || fallbackRole === "STAFF") {
      token = agentToken || fallbackToken || adminToken || customerToken;
    } else if (fallbackRole === "CUSTOMER") {
      token = customerToken || fallbackToken || adminToken || agentToken;
    } else {
      token = adminToken || customerToken || agentToken || fallbackToken;
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export { client };
export default client;
