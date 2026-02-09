import express from "express";
import {
  detectUser,
  passwordLogin,
  requestOtp,
  verifyOtp
} from "../controller/AuthController.js";

const router = express.Router();

router.post("/detect", detectUser);
router.post("/login/password", passwordLogin);
router.post("/login/otp", requestOtp);
router.post("/login/otp/verify", verifyOtp);

export default router;
