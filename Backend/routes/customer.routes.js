import express from "express";

import {
  requestOtp,
  verifyOtpLogin
} from "../controllers/authentication/customer/customerAuth.controller.js";

import {
  getProfile,
  updateProfile,
} from "../controllers/customer/profile.controller.js";
import { getDashboard } from "../controllers/customer/dashboard.controller.js";
import { getDeliveries } from "../controllers/customer/deliveries.controller.js";
import { getPayments } from "../controllers/customer/payments.controller.js";
import {
  getSubscription,
  saveSubscription,
  clearSubscription,
} from "../controllers/customer/subscription.controller.js";

import {
  forgotPassword,
  resetPassword,
} from "../controllers/authentication/customer/password.controller.js";

import { verifyEmail } from "../controllers/customer/verifyEmail.controller.js";
import { uploadSingleImage } from "../middleware/upload.middleware.js";

import { authenticate } from "../middleware/customer/auth.middleware.js";

const router = express.Router();

// ==========================================
// 🔐 PUBLIC ROUTES
// ==========================================

// OTP Login
router.post("/login/otp", requestOtp);
router.post("/login/otp/verify", verifyOtpLogin);

// Account recovery
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Email verification
router.get("/verify-email", verifyEmail);

// ==========================================
// 🛡️ PROTECTED ROUTES
// ==========================================

router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, uploadSingleImage, updateProfile);
router.get("/dashboard", authenticate, getDashboard);
router.get("/deliveries", authenticate, getDeliveries);
router.get("/payments", authenticate, getPayments);
router.get("/subscription", authenticate, getSubscription);
router.post("/subscription", authenticate, saveSubscription);
router.delete("/subscription", authenticate, clearSubscription);

export default router;
