import express from "express";
import {
  createOrder,
  fetchAdminDashboard,
  fetchEnterpriseMonitoringDashboard,
  fetchPrometheusMetrics,
  fetchReconciliationDashboard,
  fetchDairies,
  fetchDairyProducts,
  fetchDairyDashboard,
  fetchSettlementHealth,
  reconcileMarketplace,
  registerDairy,
  verifyPayment,
  verifySettlement,
} from "../controllers/marketplace.controller.js";
import { verifyAdmin } from "../middleware/admin.middleware.js";
import { marketplaceRateLimit } from "../middleware/security.middleware.js";

const router = express.Router();

router.get("/dairies", marketplaceRateLimit, fetchDairies);
router.post("/dairies", marketplaceRateLimit, registerDairy);
router.get("/dairies/:dairyId/products", marketplaceRateLimit, fetchDairyProducts);
router.get("/dairies/:dairyId/dashboard", fetchDairyDashboard);

router.post("/orders", marketplaceRateLimit, createOrder);
router.post("/payments/verify", marketplaceRateLimit, verifyPayment);

router.get("/admin/dashboard", verifyAdmin, fetchAdminDashboard);
router.get("/admin/monitoring", verifyAdmin, fetchEnterpriseMonitoringDashboard);
router.get("/admin/reconciliation", verifyAdmin, fetchReconciliationDashboard);
router.get("/admin/settlement-health", verifyAdmin, fetchSettlementHealth);
router.get("/admin/orders/:razorpayOrderId/settlement", verifyAdmin, verifySettlement);
router.post("/admin/reconcile", verifyAdmin, reconcileMarketplace);
router.get("/metrics", verifyAdmin, fetchPrometheusMetrics);

export default router;
