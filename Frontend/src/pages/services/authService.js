// services/authService.js

const MOCK_DELAY = (ms = 500) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_CUSTOMERS = {
  "8888888888": {
    userType: "CUSTOMER",
    dairies: [
      { id: "D01", name: "Nandanvan Dairy", location: "Pune" },
      { id: "D02", name: "Shree Dairy", location: "Mumbai" },
    ],
  },
  "1234567890": {
    userType: "CUSTOMER",
    dairies: [{ id: "D01", name: "Nandanvan Dairy", location: "Pune" }],
  },
};

const MOCK_STAFF = {
  id: "STF001",
  password: "admin123",
};

const MOCK_ADMIN = {
  email: "admin@gmail.com",
  password: "admin123",
};

export const authService = {
  // 🔹 Customer Login (Mobile)
  detectCustomer: async (mobile) => {
    await MOCK_DELAY();
    return MOCK_CUSTOMERS[mobile] || null;
  },

  // 🔹 OTP Verification
  verifyOtp: async (mobile, otp) => {
    await MOCK_DELAY(400);
    return otp === "123456";
  },

  // 🔹 Staff Login
  staffLogin: async (staffId, password) => {
    await MOCK_DELAY();
    return (
      staffId === MOCK_STAFF.id && password === MOCK_STAFF.password
    );
  },

  // 🔹 Admin Login
  adminLogin: async (email, password) => {
    await MOCK_DELAY();
    return (
      email === MOCK_ADMIN.email &&
      password === MOCK_ADMIN.password
    );
  },
};
