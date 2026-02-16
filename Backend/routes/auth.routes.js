import express from "express";

// ✅ IMPORT FROM REAL CUSTOMER AUTH CONTROLLER
import {
  detectUser,
  passwordLogin,
  requestOtp,
  verifyOtpLogin,
} from "../controllers/authentication/customer/customerAuth.controller.js";

// ✅ ADMIN AUTH
import { adminLogin }
from "../controllers/authentication/adminAuth.controller.js";

import { agentLogin } from "../controllers/authentication/agentAuth.controller.js";

const router = express.Router();

// ================= AUTH ROUTES =================
router.post("/detect", detectUser);
router.post("/admin/login", adminLogin);
router.post("/login/password", passwordLogin);
router.post("/login/otp", requestOtp);
router.post("/login/otp/verify", verifyOtpLogin);

router.post("/agent/login", agentLogin)

export default router;
