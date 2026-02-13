import express from "express";
import { adminLogin } from "../controllers/authentication/admin/auth.controller.js";
import { verifyAdmin } from "../middleware/admin.middleware.js";
import { getDashboard } from "../controllers/admin/dashboard.controller.js";
import {
  fetchAdminCustomers,
  fetchAdminCustomerById,
} from "../controllers/admin/adminCustomers.controller.js";
import { registerDairy } from "../controllers/admin/dairy.controller.js";

const router = express.Router();

router.post("/login", adminLogin);
router.post("/register-dairy", registerDairy);
router.get("/customers", verifyAdmin, fetchAdminCustomers);
router.get("/customers/:id", verifyAdmin, fetchAdminCustomerById);
router.get("/dashboard", verifyAdmin, getDashboard);

router.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

export default router;
