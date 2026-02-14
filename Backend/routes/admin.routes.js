import express from "express";
import { adminLogin } from "../controllers/authentication/admin/auth.controller.js";
import { verifyAdmin } from "../middleware/admin.middleware.js";
import { getDashboard } from "../controllers/admin/dashboard.controller.js";
import {
  fetchAdminCustomers,
  fetchAdminCustomerById,
} from "../controllers/admin/adminCustomers.controller.js";
import { registerDairy } from "../controllers/admin/dairy.controller.js";
import { addAgent } from "../controllers/admin/addAgent.controller.js";
import { getUniqueBuildings } from "../controllers/shared/building.controller.js";
const router = express.Router();

router.post("/", adminLogin);
router.post("/register-dairy", registerDairy);
router.post("/addagent", verifyAdmin, addAgent)
router.get("/customers", verifyAdmin, fetchAdminCustomers); //need to work on this route, where we just fetch the customer data from the db, if no customer just a banner "you dont have any customer now, add you customer"
router.get("/customers/:id", verifyAdmin, fetchAdminCustomerById);
router.get("/dashboard", verifyAdmin, getDashboard);
router.get("/buildings", verifyAdmin, getUniqueBuildings)
router.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date() }); //dont get any output
});

export default router;
