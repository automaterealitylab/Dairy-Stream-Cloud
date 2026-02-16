import express from "express";
import { detectUser } from "../controllers/authentication/customer/customerAuth.controller.js";

const router = express.Router();

// Smart Detect (Gatekeeper)
router.post("/detect", detectUser);

export default router;
