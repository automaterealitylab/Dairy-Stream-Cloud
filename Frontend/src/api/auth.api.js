import client from "../api/client"; // ✅ Use the centralized client

// ==========================================
// 1. DETECT USER (The Gatekeeper)
// ==========================================
export const detectUserApi = async (identifier) => {
  const { data } = await client.post("/auth/detect", { identifier });
  return data;
};

// ==========================================
// 2. ADMIN LOGIN (Email + Password)
// ==========================================
export const adminLoginApi = async (payload) => {
  // Payload: { email, password }
  const { data } = await client.post("/auth/admin/login", payload);
  
  // Save credentials for the Admin Domain
  if (data.token) {
    localStorage.setItem("adminToken", data.token);
    localStorage.setItem("userRole", "ADMIN");
  }
  if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
  if (data.sessionId) localStorage.setItem("sessionId", data.sessionId);
  return data;
};

export const requestAdminPasswordResetOtpApi = async (payload) => {
  const { data } = await client.post("/auth/admin/forgot-password/request-otp", payload);
  return data;
};

export const resetAdminPasswordWithOtpApi = async (payload) => {
  const { data } = await client.post("/auth/admin/forgot-password/reset", payload);
  return data;
};

// ==========================================
// 3. AGENT LOGIN (Staff ID + Password)
// ==========================================
export const agentLoginApi = async (payload) => {
  // Payload: { agentId, password }
  const { data } = await client.post("/auth/agent/login", payload);
  
  if (data.token) {
    localStorage.setItem("agentToken", data.token);
    localStorage.setItem("userRole", "AGENT");
  }
  if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
  if (data.sessionId) localStorage.setItem("sessionId", data.sessionId);
  return data;
};

export const requestAgentPasswordResetOtpApi = async (payload) => {
  const { data } = await client.post("/auth/agent/forgot-password/request-otp", payload);
  return data;
};

export const resetAgentPasswordWithOtpApi = async (payload) => {
  const { data } = await client.post("/auth/agent/forgot-password/reset", payload);
  return data;
};

// ==========================================
// 4. CUSTOMER OTP FLOW
// ==========================================
export const requestOtpApi = async (payload) => {
  // Payload: { identifier, dairyId }
  const { data } = await client.post("/auth/login/otp", payload);
  return data;
};

export const verifyOtpApi = async (payload) => {
  // Payload: { identifier, otp, dairyId }
  const { data } = await client.post("/auth/login/otp/verify", payload);
  
  if (data.token) {
    localStorage.setItem("token", data.token); // Generic token for customers
    localStorage.setItem("userRole", "CUSTOMER");
  }
  if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
  if (data.sessionId) localStorage.setItem("sessionId", data.sessionId);
  return data;
};
