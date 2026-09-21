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
import { logout } from "../controllers/authentication/logout.controller.js";
import { refreshAuth } from "../controllers/authentication/refresh.controller.js";
import {
  authRateLimit,
  issueCsrfToken,
  loginRateLimit,
  otpRateLimit,
  passwordResetRateLimit,
} from "../middleware/security.middleware.js";

const router = express.Router();

// ================= AUTH ROUTES =================

// 1. Who are you?
// NOTE: /csrf is handled directly in server.js BEFORE apiRateLimit to avoid all rate limiting.
// The route below is kept as a fallback but server.js takes priority for GET /api/auth/csrf.
router.get("/csrf", issueCsrfToken);

// /detect uses identity-keyed loginRateLimit (per-user) + IP-keyed authRateLimit
router.post("/detect", authRateLimit, loginRateLimit, detectUser);

// 2. Specialized Logins
router.post("/admin/login", authRateLimit, loginRateLimit, adminLogin);
router.post("/admin/forgot-password/request-otp", authRateLimit, passwordResetRateLimit, requestAdminResetOtp);
router.post("/admin/forgot-password/reset", authRateLimit, passwordResetRateLimit, resetAdminPasswordWithOtp);
router.post("/agent/login", authRateLimit, loginRateLimit, agentLogin);
router.post("/agent/forgot-password/request-otp", authRateLimit, passwordResetRateLimit, requestAgentResetOtp);
router.post("/agent/forgot-password/reset", authRateLimit, passwordResetRateLimit, resetAgentPasswordWithOtp);

// 3. Customer/Shared Login Methods
// router.post("/login/password", loginCustomerAuth); // Handles Customer Password Login
router.post("/login/otp", authRateLimit, otpRateLimit, requestOtpAuth);       // Request OTP
router.post("/login/otp/verify", authRateLimit, loginRateLimit, verifyOtpLoginAuth); // Verify OTP

// 4. Token Validation (For Persistent Login)
router.get("/me", verifyToken, validateTokenAuth);
router.post("/refresh", authRateLimit, refreshAuth);
router.post("/logout", verifyToken, authRateLimit, logout);

export default router;
