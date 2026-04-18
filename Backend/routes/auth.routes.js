import express from "express";

// ✅ 1. DETECT USER (The Gateway)
import { detectUser } from "../controllers/authentication/detectUser.controller.js";

// ✅ 2. ADMIN AUTH
import {
  adminLogin,
  requestAdminResetOtp,
  resetAdminPasswordWithOtp,
} from "../controllers/authentication/adminAuth.controller.js";

// ✅ 3. AGENT AUTH
import {
  agentLogin,
  requestAgentResetOtp,
  resetAgentPasswordWithOtp,
} from "../controllers/authentication/agentAuth.controller.js";

// ✅ 4. CUSTOMER AUTH (Shared OTP Routes)
// If your frontend calls /api/auth/login/otp, we need these here
import {
  requestOtpAuth,
  verifyOtpLoginAuth,
  validateTokenAuth,
} from "../controllers/authentication/customer/customerAuth.controller.js";

// Middleware
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// ================= AUTH ROUTES =================

// 1. Who are you?
router.post("/detect", detectUser);

// 2. Specialized Logins
router.post("/admin/login", adminLogin);
router.post("/admin/forgot-password/request-otp", requestAdminResetOtp);
router.post("/admin/forgot-password/reset", resetAdminPasswordWithOtp);
router.post("/agent/login", agentLogin);
router.post("/agent/forgot-password/request-otp", requestAgentResetOtp);
router.post("/agent/forgot-password/reset", resetAgentPasswordWithOtp);

// 3. Customer/Shared Login Methods
// These are often called by the generic login page
// router.post("/login/password", loginCustomerAuth); // Handles Customer Password Login
router.post("/login/otp", requestOtpAuth); // Request OTP
router.post("/login/otp/verify", verifyOtpLoginAuth); // Verify OTP

// 4. Token Validation (For Persistent Login)
router.get("/me", verifyToken, validateTokenAuth);

export default router;
