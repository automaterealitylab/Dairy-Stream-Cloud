import express from "express";
const router = express.Router();

import { verifySuperAdmin } from "../middleware/superAdmin.middleware.js";

// --- CONTROLLER IMPORTS ---
import {
  superAdminLogin,
  getMe
} from "../controllers/superAdmin/superAdminAuth.controller.js";

import {
  getDashboardMetrics,
  getDashboardCharts,
  logPageview
} from "../controllers/superAdmin/superAdminDashboard.controller.js";

import {
  fetchDairies,
  updateDairyStatus,
  upgradeDairySubscription,
  resetOwnerPassword,
  deleteDairy
} from "../controllers/superAdmin/superAdminDairies.controller.js";

import {
  fetchPlans,
  createPlan,
  updatePlan,
  deletePlan
} from "../controllers/superAdmin/superAdminPlans.controller.js";

import {
  fetchCoupons,
  createCoupon,
  deleteCoupon,
  validateCoupon,
  fetchRedemptions
} from "../controllers/superAdmin/superAdminCoupons.controller.js";

import {
  fetchTickets,
  createTicket,
  updateTicket
} from "../controllers/superAdmin/superAdminSupport.controller.js";

import {
  fetchSettings,
  updateSettings
} from "../controllers/superAdmin/superAdminSettings.controller.js";

import {
  getHealth,
  getErrorLogs
} from "../controllers/superAdmin/superAdminMonitoring.controller.js";

import {
  fetchAnnouncements,
  createAnnouncement
} from "../controllers/superAdmin/superAdminAnnouncements.controller.js";

// ==========================================
// 1. PUBLIC PLATFORM ENDPOINTS
// ==========================================
router.post("/auth/login", superAdminLogin);
router.post("/analytics/pageview", logPageview);
router.post("/coupons/validate", validateCoupon); // Accessible by dairy checkout

// ==========================================
// 2. SECURED SUPER ADMIN ENDPOINTS (REQUIRED JWT & RBAC)
// ==========================================
router.use(verifySuperAdmin);

// Auth Me
router.get("/auth/me", getMe);

// Dashboard Metrics & Charts
router.get("/dashboard/metrics", getDashboardMetrics);
router.get("/dashboard/charts", getDashboardCharts);

// Dairy Management
router.get("/dairies", fetchDairies);
router.patch("/dairies/:id/status", updateDairyStatus);
router.patch("/dairies/:id/upgrade", upgradeDairySubscription);
router.patch("/dairies/:id/reset-password", resetOwnerPassword);
router.delete("/dairies/:id", deleteDairy);

// Subscription Plans Management
router.get("/plans", fetchPlans);
router.post("/plans", createPlan);
router.put("/plans/:id", updatePlan);
router.delete("/plans/:id", deletePlan);

// Coupon Codes Management
router.get("/coupons", fetchCoupons);
router.post("/coupons", createCoupon);
router.delete("/coupons/:id", deleteCoupon);
router.get("/coupons/redemptions", fetchRedemptions);

// Announcements & Notifications
router.get("/announcements", fetchAnnouncements);
router.post("/announcements", createAnnouncement);

// Support Ticket Desk
router.get("/support/tickets", fetchTickets);
router.post("/support/tickets", createTicket);
router.put("/support/tickets/:id", updateTicket);

// Global Platform Settings
router.get("/settings", fetchSettings);
router.post("/settings", updateSettings);

// Server Monitoring & Observability
router.get("/monitoring/health", getHealth);
router.get("/monitoring/logs", getErrorLogs);

export default router;
