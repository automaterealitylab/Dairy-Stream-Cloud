import express from "express";
const router = express.Router();

// --- CONTROLLER IMPORTS ---
import { adminLogin } from "../controllers/authentication/adminAuth.controller.js";
import { verifyAdmin } from "../middleware/admin.middleware.js";
import { getDashboard } from "../controllers/admin/dashboard.controller.js";
import { 
  getAdminNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from "../controllers/admin/notifications.controller.js";
import {
  approveAdminDelivery,
  approveAllAdminDeliveries,
  assignAdminDeliveryPartner,
  fetchAdminDeliveries,
  fetchDeliverySchedulingOptions,
  resolveAdminDeliveryIssue,
  scheduleAdminDelivery,
  scheduleAdminDeliveriesBulk,
} from "../controllers/admin/adminDeliveries.controller.js";
import {
  fetchAdminCustomers,
  fetchAdminCustomerById,
  fetchAdminCustomerBillDetails,
  updateAdminCustomerById,
  deleteAdminCustomerById,
  approveAdminCustomerSubscription,
  assignAdminCustomerPermanentPartner,
  upsertAdminCustomerSubscription,
} from "../controllers/admin/adminCustomers.controller.js";
import {
  getAdminDairyProfile,
  registerDairy,
  updateAdminDairyProfile,
} from "../controllers/admin/dairy.controller.js";
import { uploadSingleImage } from "../middleware/upload.middleware.js";
import { addAgent, getUniqueAgentId } from "../controllers/admin/addAgent.controller.js";
import { getUniqueBuildings } from "../controllers/shared/building.controller.js";
import {
  fetchAdminAgents,
  fetchAdminAgentById,
  updateAdminAgentById,
  deleteAdminAgentById,
} from "../controllers/admin/adminAgent.controller.js";
import {
  
  collectOfflinePayment,
  approvePaymentVerification,
  changeFarmPlan,
  fetchPageData,
  fetchPaymentVerifications,
  rejectPaymentVerification,
  updateStatus,
} from "../controllers/admin/adminPayments.controller.js";
import {
  addAdminProduct,
  editAdminProduct,
  fetchAdminProducts,
  removeAdminProduct,
} from "../controllers/admin/products.controller.js";
import {
  getPerformance,
  getPerformanceSummaryData,
  getTopPerformers,
  getMissedDeliveries,
  updatePerformanceMetrics,
} from "../controllers/admin/agentPerformance.controller.js";
import {
  getEarnings,
  getTodayWorkSummaryData,
  getSummary,
  calculateEarnings,
} from "../controllers/admin/agentEarnings.controller.js";
import { 
  addProcurementLog, 
  fetchProcurementLogs,
  updateProcurementLog,
} from "../controllers/admin/procurement.controller.js";

import { 
  addSupplier, 
  fetchSuppliers,
  deactivateSupplier,
  updateSupplier,
} from "../controllers/suppliers/supplier.controller.js";
import { fetchDairyAccountingReport } from "../controllers/admin/reports.controller.js";
import {
  fetchOperationalMonitoring,
  processWhatsAppQueue,
} from "../controllers/admin/monitoring.controller.js";
import {
  lookupAdminBankIfsc,
  verifyAdminBankAccount,
} from "../controllers/admin/bankVerification.controller.js";
import { createRateLimiter } from "../middleware/security.middleware.js";

// ==========================================
// 1. AUTHENTICATION & INITIAL SETUP
// ==========================================
router.post("/", adminLogin); // Admin login route
router.post("/register-dairy", uploadSingleImage, registerDairy); // Initial dairy registration with logo upload
router.get("/profile", verifyAdmin, getAdminDairyProfile);
router.patch("/profile", verifyAdmin, updateAdminDairyProfile);
router.get(
  "/bank/ifsc/:ifsc",
  verifyAdmin,
  createRateLimiter({ windowMs: 60_000, max: 30, keyPrefix: "admin-ifsc-lookup" }),
  lookupAdminBankIfsc
);
router.post(
  "/bank/verify",
  verifyAdmin,
  createRateLimiter({ windowMs: 60_000, max: 10, keyPrefix: "admin-bank-verify" }),
  verifyAdminBankAccount
);

// ==========================================
// 2. DASHBOARD & CORE METRICS
// ==========================================
router.get("/dashboard", verifyAdmin, getDashboard); // Main dashboard data (Needed vs Procured, etc.)
router.get("/notifications", verifyAdmin, getAdminNotifications); // Admin notifications list
router.patch("/notifications/:id/read", verifyAdmin, markNotificationAsRead); // Mark individual notification as read
router.post("/notifications/read-all", verifyAdmin, markAllNotificationsAsRead); // Mark all notifications as read
router.get("/monitoring/operations", verifyAdmin, fetchOperationalMonitoring);
router.post("/monitoring/whatsapp/process", verifyAdmin, processWhatsAppQueue);
router.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// ==========================================
// 3. CUSTOMER MANAGEMENT
// ==========================================
router.get("/customers", verifyAdmin, fetchAdminCustomers); // List all customers
router.get("/customers/:id", verifyAdmin, fetchAdminCustomerById); // Get specific customer details
router.get("/customers/:id/bill-details", verifyAdmin, fetchAdminCustomerBillDetails); // Get bill detail rows
router.put("/customers/:id", verifyAdmin, updateAdminCustomerById); // Edit customer info
router.delete("/customers/:id", verifyAdmin, deleteAdminCustomerById); // Remove customer

// Subscriptions & Assignments
router.post("/customers/:id/subscription", verifyAdmin, upsertAdminCustomerSubscription); // Add/Update customer plan
router.patch("/customers/:id/subscription/approve", verifyAdmin, approveAdminCustomerSubscription); // Approve requested sub
router.patch("/customers/:id/subscription/assign-partner", verifyAdmin, assignAdminCustomerPermanentPartner); // Link agent to customer

// ==========================================
// 4. AGENT (DELIVERY PARTNER) MANAGEMENT
// ==========================================
router.get("/agents", verifyAdmin, fetchAdminAgents); // List all agents
router.post("/addagent", verifyAdmin, addAgent); // Onboard new agent
router.get("/agents/generate-id", verifyAdmin, getUniqueAgentId); // Helper for unique agent IDs
router.get("/agents/:id", verifyAdmin, fetchAdminAgentById); // View specific agent profile
router.put("/agents/:id", verifyAdmin, updateAdminAgentById); // Edit agent info
router.delete("/agents/:id", verifyAdmin, deleteAdminAgentById); // Remove agent

// ==========================================
// 5. DELIVERY OPERATIONS
// ==========================================
router.get("/deliveries", verifyAdmin, fetchAdminDeliveries); // View current/past delivery logs
router.get("/deliveries/scheduling-options", verifyAdmin, fetchDeliverySchedulingOptions); // Get shifts/times for scheduling
router.post("/deliveries/schedule", verifyAdmin, scheduleAdminDelivery); // Single delivery schedule
router.post("/deliveries/schedule-bulk", verifyAdmin, scheduleAdminDeliveriesBulk); // Batch scheduling
router.patch("/deliveries/:id/approve", verifyAdmin, approveAdminDelivery); // Approve a specific delivery
router.patch("/deliveries/:id/assign-partner", verifyAdmin, assignAdminDeliveryPartner); // Change agent for a delivery
router.patch("/deliveries/:id/resolve-issue", verifyAdmin, resolveAdminDeliveryIssue); // Handle failed/missed delivery
router.post("/deliveries/approve-all", verifyAdmin, approveAllAdminDeliveries); // Bulk approval for current shift

// ==========================================
// 6. PROCUREMENT (SUPPLY CHAIN)
// ==========================================
router.get("/procurement", verifyAdmin, fetchProcurementLogs); // View milk purchase history
router.post("/procurement", verifyAdmin, addProcurementLog); // Log new milk purchase from supplier
router.put("/procurement/:id", verifyAdmin, updateProcurementLog); // Correct an existing purchase entry

// ==========================================
// 7. PAYMENTS & BILLING
// ==========================================
router.get("/payments", verifyAdmin, fetchPageData); // Fetch payment ledger data
router.get("/payments/verifications", verifyAdmin, fetchPaymentVerifications);
router.get("/payments/reports/accounting", verifyAdmin, fetchDairyAccountingReport);
router.patch("/payments/verifications/:id/approve", verifyAdmin, approvePaymentVerification);
router.patch("/payments/verifications/:id/reject", verifyAdmin, rejectPaymentVerification);
router.patch("/payments/:id/status", verifyAdmin, updateStatus); // Manually update payment status (PAID/PENDING)
router.post("/payments/offline-collect", verifyAdmin, collectOfflinePayment); // Collect offline payment and add excess to wallet
router.patch("/farm-plan", verifyAdmin, changeFarmPlan); // Upgrade/Downgrade the SaaS platform plan

// ==========================================
// 8. PRODUCT & INVENTORY
// ==========================================
router.get("/products", verifyAdmin, fetchAdminProducts); // List products (Milk, Paneer, Dahi)
router.post("/products", verifyAdmin, addAdminProduct); // Add new product
router.put("/products/:id", verifyAdmin, editAdminProduct); // Edit product price/details
router.delete("/products/:id", verifyAdmin, removeAdminProduct); // Remove product

// ==========================================
// 9. ANALYTICS & EARNINGS
// ==========================================
// Agent Performance
router.get("/performance", verifyAdmin, getPerformance);
router.get("/performance/summary", verifyAdmin, getPerformanceSummaryData);
router.get("/performance/top-performers", verifyAdmin, getTopPerformers);
router.get("/performance/missed-deliveries", verifyAdmin, getMissedDeliveries);
router.post("/performance/update", verifyAdmin, updatePerformanceMetrics);

// Earnings & Work Summaries
router.get("/earnings", verifyAdmin, getEarnings);
router.get("/earnings/today-summary", verifyAdmin, getTodayWorkSummaryData);
router.get("/earnings/summary", verifyAdmin, getSummary);
router.post("/earnings/calculate", verifyAdmin, calculateEarnings);

// Utilities
router.get("/buildings", verifyAdmin, getUniqueBuildings); // Fetch list of service locations



// ==========================================
// 10. SUPPLIER MANAGEMENT
// ==========================================
router.get("/suppliers", verifyAdmin, fetchSuppliers); // Fetch all active suppliers
router.post("/suppliers", verifyAdmin, addSupplier); // Register a new supplier
router.put("/suppliers/:id", verifyAdmin, updateSupplier); // Edit supplier details
router.delete("/suppliers/:id", verifyAdmin, deactivateSupplier); // Deactivate supplier from active use

export default router;
