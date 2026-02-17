import express from "express";
import { detectUserAuth } from "../middleware/customer/auth.handlers.middleware.js";
import { getPublicDairies, getPublicDairy } from "../controllers/public/dairies.controller.js";

const router = express.Router();

// Smart Detect (Gatekeeper)
router.post("/detect", detectUserAuth);
router.get("/dairies", getPublicDairies);
router.get("/dairies/:id", getPublicDairy);

export default router;
