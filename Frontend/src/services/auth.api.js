import client from "../api/client"; // ✅ Use the centralized client instead of re-creating axios

// ===============================
// 1. DETECT USER (Gatekeeper)
// ===============================
export const detectUserApi = async (identifier, options = {}) => {
  const { data } = await client.post("/auth/detect", {
    identifier,
    ...options,
  });
  return data;
};

// ===============================
// 2. CUSTOMER OTP FLOW
// ===============================
export const requestOtpApi = async (payload) => {
  const { data } = await client.post("/auth/login/otp", payload);
  return data;
};

export const verifyOtpApi = async (payload) => {
  const { data } = await client.post("/auth/login/otp/verify", payload);
  return data;
};

// ===============================
// 3. TOKEN VALIDATION (For Persistent Login)
// ===============================
export const validateTokenApi = async () => {
  const { data } = await client.get("/auth/me");
  return data;
};

// ===============================
// 4. ADMIN LOGIN
// ===============================
export const adminLoginApi = async (payload) => {
  const { data } = await client.post("/auth/admin/login", payload);
  return data;
};

export const requestAdminPasswordResetOtpApi = async (payload) => {
  const { data } = await client.post(
    "/auth/admin/forgot-password/request-otp",
    payload,
  );
  return data;
};

export const resetAdminPasswordWithOtpApi = async (payload) => {
  const { data } = await client.post(
    "/auth/admin/forgot-password/reset",
    payload,
  );
  return data;
};

// ===============================
// 5. AGENT LOGIN
// ===============================
export const agentLoginApi = async (payload) => {
  const { data } = await client.post("/auth/agent/login", payload);
  return data;
};

export const requestAgentPasswordResetOtpApi = async (payload) => {
  const { data } = await client.post(
    "/auth/agent/forgot-password/request-otp",
    payload,
  );
  return data;
};

export const resetAgentPasswordWithOtpApi = async (payload) => {
  const { data } = await client.post(
    "/auth/agent/forgot-password/reset",
    payload,
  );
  return data;
};
