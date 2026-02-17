import express from "express";

import {
  detectUserAuth,
  passwordLoginAuth,
  requestOtpAuth,
  verifyOtpLoginAuth,
} from "../middleware/customer/auth.handlers.middleware.js";

// ✅ ADMIN AUTH
import { adminLogin }
from "../controllers/authentication/adminAuth.controller.js";

import { agentLogin } from "../controllers/authentication/agentAuth.controller.js";

const router = express.Router();

// ================= AUTH ROUTES =================
router.post("/detect", detectUserAuth);
router.post("/admin/login", adminLogin);
router.post("/login/password", passwordLoginAuth);
router.post("/login/otp", requestOtpAuth);
router.post("/login/otp/verify", verifyOtpLoginAuth);

router.post("/agent/login", agentLogin)

export default router;
