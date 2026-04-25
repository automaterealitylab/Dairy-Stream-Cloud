import express from "express";
import { getOrderLiveLocation } from "../socket/locationHandler.js";

const router = express.Router();

router.get("/:orderId", (req, res) => {
  const orderId = String(req.params?.orderId || "").trim();
  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "orderId is required",
    });
  }

  const latest = getOrderLiveLocation(orderId);
  if (!latest) {
    return res.status(404).json({
      success: false,
      message: "No live location available for this order",
    });
  }

  return res.json({
    success: true,
    location: latest,
  });
});

export default router;

