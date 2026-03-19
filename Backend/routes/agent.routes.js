import express from 'express';
// We import from 'shared' because both Admins and Agents need this list
import { getUniqueBuildings } from '../controllers/shared/building.controller.js';
import { verifyAgent } from "../middleware/agent.middleware.js";
import {
  fetchAgentDashboard,
  fetchAssignedDeliveries,
  fetchAgentHistory,
  patchAgentAvailability,
  fetchAgentSelfProfile,
  patchAssignedDeliveryStatus,
  createAssignedDeliveryOnlineQr,
  createAssignedDeliveryOnlineOrder,
  verifyAssignedDeliveryOnlinePayment,
} from "../controllers/agent/delivery.controller.js";
import {
  updateAgentLocation,
  startDelivery,
} from "../controllers/agent/location.controller.js";

const router = express.Router();

// ==========================================
// 🏢 BUILDING ROUTES
// ==========================================

// Endpoint: GET http://localhost:4000/api/agent/buildings
router.get('/buildings', getUniqueBuildings);

router.get("/dashboard", verifyAgent, fetchAgentDashboard);
router.get("/deliveries/assigned", verifyAgent, fetchAssignedDeliveries);
router.get("/deliveries/history", verifyAgent, fetchAgentHistory);
router.post("/deliveries/:id/online-qr", verifyAgent, createAssignedDeliveryOnlineQr);
router.post("/deliveries/:id/online-order", verifyAgent, createAssignedDeliveryOnlineOrder);
router.post("/deliveries/:id/online-verify", verifyAgent, verifyAssignedDeliveryOnlinePayment);
router.patch("/deliveries/:id/status", verifyAgent, patchAssignedDeliveryStatus);
router.get("/profile", verifyAgent, fetchAgentSelfProfile);
router.patch("/profile/availability", verifyAgent, patchAgentAvailability);

// ==========================================
// 📍 LOCATION TRACKING & ETA ROUTES
// ==========================================
router.post("/deliveries/location/update", verifyAgent, updateAgentLocation);
router.post("/deliveries/start", verifyAgent, startDelivery);


// ==========================================
// ❌ REMOVED ROUTES
// ==========================================
// The '/addAgent' route has been removed from here.
// It is correctly located in 'admin.routes.js' now.


export default router;
