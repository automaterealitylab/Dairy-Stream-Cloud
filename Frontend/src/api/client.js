import axios from "axios";

// Cleanly fetch and trim the base URL
export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").trim();

const client = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach role-specific tokens so customer/admin APIs don't get mixed tokens.
client.interceptors.request.use((config) => {
  const requestPath = String(config.url || "");
  const adminToken = localStorage.getItem("adminToken");
  const customerToken = localStorage.getItem("token");
  const agentToken = localStorage.getItem("agentToken");

  let token = null;
  if (requestPath.startsWith("/customer")) {
    token = customerToken;
  } else if (requestPath.startsWith("/admin")) {
    token = adminToken;
  } else if (requestPath.startsWith("/agent")) {
    token = agentToken;
  } else {
    token = adminToken || customerToken || agentToken;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
