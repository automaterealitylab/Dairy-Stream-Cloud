import express from "express";

import {
  registerCustomer,
  loginCustomer,
} from "../controllers/customer/auth.controller.js";

import {
  getProfile,
  updateProfile,
} from "../controllers/customer/profile.controller.js";

import {
  forgotPassword,
  resetPassword,
} from "../controllers/customer/password.controller.js";

import {
  verifyEmail,
} from "../controllers/customer/verifyEmail.controller.js";

import { authenticate } from "../middleware/customer/auth.middleware.js";
console.log("🔥 CUSTOMER ROUTES LOADED");

const router = express.Router();

/**
 * AUTH ROUTES
 */
router.post("/register", registerCustomer);
router.post("/login", (req, res, next) => {
  console.log("🔥 LOGIN ROUTE HIT");
  next();
}, loginCustomer);

/**
 * EMAIL VERIFICATION
 */
router.get("/verify-email", verifyEmail);

/**
 * PASSWORD RESET
 */
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

/**
 * PROFILE (PROTECTED)
 */
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);

export default router;
