import express from "express";

// ✅ UPDATED IMPORTS (From New Controller)
import {
  addCustomerAuth,
  // loginCustomerAuth,
  requestOtpAuth,
  verifyOtpLoginAuth,
} from "../controllers/authentication/customer/customerAuth.controller.js";

// Existing Controllers...
import {
  getProfile,
  updateProfile,
} from "../controllers/customer/profile.controller.js";
import { getDashboard } from "../controllers/customer/dashboard.controller.js";
import {
  cancelOneTimeOrder,
  createOneTimeOrder,
  getDeliveries,
  reportIssue,
} from "../controllers/customer/deliveries.controller.js";
import {
  createPaymentOrder,
  createWalletTopupOrder,
  getPayments,
  verifyPayment,
  verifyWalletTopup,
} from "../controllers/customer/payments.controller.js";
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
import {
  subscribeToNotifications,
  fetchDeliveryETA,
} from "../controllers/customer/notification.controller.js";
import { uploadSingleImage } from "../middleware/upload.middleware.js";

// Middleware
import { authenticate } from "../middleware/cutomerAuthChecker.middleware.js";

const router = express.Router();

// ==========================================
// 🔐 PUBLIC ROUTES (Registration & specific auth)
// ==========================================
router.post("/addCustomer", addCustomerAuth);

// OTP Auth Flow
router.post("/login/otp", requestOtpAuth);
router.post("/login/otp/verify", verifyOtpLoginAuth);

// Email verification
router.get("/verify-email", verifyEmail);

// ==========================================
// 🛡️ PROTECTED ROUTES
// ==========================================

router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, uploadSingleImage, updateProfile);

router.get("/dashboard", authenticate, getDashboard);
router.get("/deliveries", authenticate, getDeliveries);
router.post("/deliveries/:id/issue", authenticate, reportIssue);
router.post("/orders/one-time", authenticate, createOneTimeOrder);
router.post("/orders/one-time/cancel", authenticate, cancelOneTimeOrder);
router.get("/payments", authenticate, getPayments);
router.post("/payments/order", authenticate, createPaymentOrder);
router.post("/payments/verify", authenticate, verifyPayment);
router.post("/payments/wallet/order", authenticate, createWalletTopupOrder);
router.post("/payments/wallet/verify", authenticate, verifyWalletTopup);

router.get("/subscription", authenticate, getSubscription);
router.post("/subscription", authenticate, saveSubscription);
router.delete("/subscription", authenticate, clearSubscription);

// ==========================================
// 📱 NOTIFICATIONS & ETA ROUTES
// ==========================================
router.post("/notifications/subscribe", authenticate, subscribeToNotifications);
router.get("/deliveries/:id/eta", authenticate, fetchDeliveryETA);

export default router;
