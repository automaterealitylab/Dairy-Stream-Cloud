import express from "express";
import { supabase } from "../config/supabase.js";
import { getOrderLiveLocation } from "../socket/locationHandler.js";

const router = express.Router();

const canAccessOrderLocation = (user, delivery) => {
  if (!user || !delivery) return false;
  const role = String(user.role || "").toUpperCase();

  if (role === "ADMIN") {
    return String(delivery.dairy_id || "") === String(user.dairyId || "");
  }

  if (role === "AGENT" || role === "STAFF") {
    const deliveryAgentId = delivery.assigned_agent_id ?? delivery.agent_id ?? null;
    return String(deliveryAgentId || "") === String(user.agentId || user.id || "");
  }

  if (role === "CUSTOMER") {
    const deliveryCustomerId = delivery.customer_id ?? delivery.user_id ?? delivery.customerId ?? delivery.customerid ?? null;
    return String(deliveryCustomerId || "") === String(user.id || "");
  }

  return false;
};

router.get("/:orderId", async (req, res) => {
  const orderId = String(req.params?.orderId || "").trim();
  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "orderId is required",
    });
  }

  const { data: delivery, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("id", orderId)
    .limit(1)
    .maybeSingle();

  if (error || !canAccessOrderLocation(req.user, delivery)) {
    return res.status(404).json({
      success: false,
      message: "No live location available for this order",
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
