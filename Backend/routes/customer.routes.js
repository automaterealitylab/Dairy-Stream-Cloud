import express from "express";

// --- 1. AUTH CONTROLLERS (From the new structure) ---
import {
  registerCustomer,
  verifyLogin as loginCustomer, // Renamed to match your route preference
} from "../controllers/authentication/customer/auth.controller.js";

// --- 2. FEATURE CONTROLLERS (Keep these in controllers/customer/) ---
// You will need to make sure these files exist in src/controllers/customer/
import {
  getProfile,
  updateProfile,
} from "../controllers/customer/profile.controller.js";

import {
  forgotPassword,
  resetPassword,
} from "../controllers/authentication/customer/password.controller.js";

import {
  verifyEmail,
} from "../controllers/customer/verifyEmail.controller.js";

// --- 3. MIDDLEWARE ---
import { authenticate } from "../middleware/customer/auth.middleware.js";

console.log("🔥 CUSTOMER ROUTES LOADED");

const router = express.Router();

// ==========================================
// 🔐 PUBLIC ROUTES (No Login Required)
// ==========================================

// --- Auth ---
router.post("/register", registerCustomer);

router.post("/login", (req, res, next) => {
  console.log("🔥 LOGIN ROUTE HIT");
  next();
}, loginCustomer);

// --- Account Recovery ---
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// --- Verification ---
router.get("/verify-email", verifyEmail);


// ==========================================
// 🛡️ PROTECTED ROUTES (Login Required)
// ==========================================

// --- Profile Management ---
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);

export default router;