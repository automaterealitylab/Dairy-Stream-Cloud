import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // e.g. http://localhost:4000/api
  headers: {
    "Content-Type": "application/json",
  },
});

// ===============================
// 1. DETECT USER
// ===============================
export const detectUserApi = async (identifier) => {
  const { data } = await API.post("/auth/detect", {
    identifier,
  });
  return data;
};

// ===============================
// 2. PASSWORD LOGIN (ADMIN / STAFF)
// ===============================
export const passwordLoginApi = async ({ identifier, password }) => {
  const { data } = await API.post("/auth/login/password", {
    identifier,
    password,
  });
  return data;
};

// ===============================
// 3. REQUEST OTP (CUSTOMER)
// ===============================
export const requestOtpApi = async ({ identifier, dairyId }) => {
  const { data } = await API.post("/auth/login/otp", {
    identifier,
    dairyId,
  });
  return data;
};

// ===============================
// 4. VERIFY OTP
// ===============================
export const verifyOtpApi = async ({ identifier, otp, dairyId }) => {
  const { data } = await API.post("/auth/login/otp/verify", {
    identifier,
    otp,
    dairyId,
  });
  return data;
};



export const agentLoginApi = async(data)=>{
  const res = await axios.post("/auth/agent/login", data);
  return res.data;
};
