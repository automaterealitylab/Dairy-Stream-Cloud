import express from "express";
import { detectUser } from "../controllers/authentication/customer/customerAuth.controller.js";
import { getPublicDairies, getPublicDairy } from "../controllers/public/dairies.controller.js";

const router = express.Router();

// Smart Detect (Gatekeeper)
router.post("/detect", detectUser);
router.get("/dairies", getPublicDairies);
router.get("/dairies/:id", getPublicDairy);

export default router;
