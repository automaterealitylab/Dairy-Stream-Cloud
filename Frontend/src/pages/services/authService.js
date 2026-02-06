// services/authService.js

export const authService = {
  // Customer Login (Mobile)
  detectCustomer: async (mobile) => {
    // 🔹 Replace with real API later
    if (mobile === "8888888888") {
      return {
        userType: "CUSTOMER",
        dairies: [
          { id: "D01", name: "Nandanvan Dairy", location: "Pune" },
          { id: "D02", name: "Shree Dairy", location: "Mumbai" },
        ],
      };
    }

    if (mobile === "1234567890") {
      return {
        userType: "CUSTOMER",
        dairies: [{ id: "D01", name: "Nandanvan Dairy", location: "Pune" }],
      };
    }

    return null;
  },

  // OTP Verification
  verifyOtp: async (mobile, otp) => {
    // 🔹 Replace with real API
    return otp === "123456";
  },

  // Staff Login
  staffLogin: async (staffId, password) => {
    return staffId === "STF001" && password === "admin123";
  },

  // Admin Login
  adminLogin: async (email, password) => {
    return email === "admin@gmail.com" && password === "admin123";
  },
};
