import express from "express";
import { adminLogin } from "../controllers/authentication/adminAuth.controller.js";
import { verifyAdmin } from "../middleware/admin.middleware.js";
import { getDashboard } from "../controllers/admin/dashboard.controller.js";
import {
  fetchAdminCustomers,
  fetchAdminCustomerById,
  updateAdminCustomerById,
  deleteAdminCustomerById,
  upsertAdminCustomerSubscription,
} from "../controllers/admin/adminCustomers.controller.js";
import { registerDairy } from "../controllers/admin/dairy.controller.js";
import { uploadSingleImage } from "../middleware/upload.middleware.js";
import { addAgent, getUniqueAgentId } from "../controllers/admin/addAgent.controller.js";
import { getUniqueBuildings } from "../controllers/shared/building.controller.js";
import {
  fetchAdminAgents,
  fetchAdminAgentById,
  updateAdminAgentById,
  deleteAdminAgentById,
} from "../controllers/admin/adminagent.controller.js";
import {
  changeFarmPlan,
  fetchPageData,
  updateStatus,
} from "../controllers/admin/adminPayments.controller.js";
const router = express.Router();

router.post("/", adminLogin);
router.post("/register-dairy", uploadSingleImage, registerDairy);
router.post("/addagent", verifyAdmin, addAgent);
router.get("/agents/generate-id", verifyAdmin, getUniqueAgentId);
router.get("/customers", verifyAdmin, fetchAdminCustomers); //need to work on this route, where we just fetch the customer data from the db, if no customer just a banner "you dont have any customer now, add you customer"
router.get("/customers/:id", verifyAdmin, fetchAdminCustomerById);
router.put("/customers/:id", verifyAdmin, updateAdminCustomerById);
router.delete("/customers/:id", verifyAdmin, deleteAdminCustomerById);
router.post("/customers/:id/subscription", verifyAdmin, upsertAdminCustomerSubscription);
router.get("/dashboard", verifyAdmin, getDashboard);
router.get("/buildings", verifyAdmin, getUniqueBuildings);
router.get("/agents",verifyAdmin, fetchAdminAgents);
router.get("/agents/:id",verifyAdmin,fetchAdminAgentById);
router.put("/agents/:id", verifyAdmin, updateAdminAgentById);
router.delete("/agents/:id", verifyAdmin, deleteAdminAgentById);
router.get("/payments", verifyAdmin, fetchPageData);
router.patch("/payments/:id/status", verifyAdmin, updateStatus);
router.patch("/farm-plan", verifyAdmin, changeFarmPlan);

router.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date() }); //dont get any output
});

export default router;
