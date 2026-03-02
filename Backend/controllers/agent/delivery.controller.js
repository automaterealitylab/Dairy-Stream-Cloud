import {
  getAgentAssignedDeliveries,
  getAgentDashboard,
  getAgentDeliveryHistory,
  getAgentProfile,
  updateAgentAvailability,
  updateAgentDeliveryStatus,
} from "../../services/agent/delivery.service.js";

const getAgentContext = (req) => ({
  agentDbId: req.agent?.id,
  dairyId: req.agent?.dairyId || null,
});

const getLocalTodayIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const fetchAgentDashboard = async (req, res) => {
  try {
    const payload = await getAgentDashboard(getAgentContext(req));
    return res.json(payload);
  } catch (err) {
    console.error("AGENT DASHBOARD ERROR:", err?.message || err);
    return res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to fetch dashboard",
    });
  }
};

export const fetchAssignedDeliveries = async (req, res) => {
  try {
    const todayOnly = String(req.query.today || "false").toLowerCase() === "true";
    const todayDate = getLocalTodayIso();
    const payload = await getAgentAssignedDeliveries({
      ...getAgentContext(req),
      date: todayOnly ? todayDate : null,
    });
    return res.json({ deliveries: payload });
  } catch (err) {
    console.error("AGENT ASSIGNED DELIVERIES ERROR:", err?.message || err);
    return res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to fetch assigned deliveries",
    });
  }
};

export const fetchAgentHistory = async (req, res) => {
  try {
    const payload = await getAgentDeliveryHistory(getAgentContext(req));
    return res.json({ history: payload });
  } catch (err) {
    console.error("AGENT HISTORY ERROR:", err?.message || err);
    return res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to fetch delivery history",
    });
  }
};

export const fetchAgentSelfProfile = async (req, res) => {
  try {
    const payload = await getAgentProfile(getAgentContext(req));
    return res.json({ profile: payload });
  } catch (err) {
    console.error("AGENT PROFILE ERROR:", err?.message || err);
    return res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to fetch agent profile",
    });
  }
};

export const patchAssignedDeliveryStatus = async (req, res) => {
  try {
    const payload = await updateAgentDeliveryStatus({
      ...getAgentContext(req),
      deliveryId: req.params.id,
      status: req.body?.status,
      reason: req.body?.reason || "",
      proofType: req.body?.proofType || "",
      proofOtp: req.body?.proofOtp || "",
      proofImage: req.body?.proofImage || "",
    });
    return res.json({
      message: "Delivery status updated",
      ...payload,
    });
  } catch (err) {
    console.error("AGENT DELIVERY STATUS UPDATE ERROR:", err?.message || err);
    return res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to update delivery status",
    });
  }
};

export const patchAgentAvailability = async (req, res) => {
  try {
    const payload = await updateAgentAvailability({
      ...getAgentContext(req),
      isActive: req.body?.isActive,
      inactiveDays: req.body?.inactiveDays,
    });
    return res.json({
      message: "Agent availability updated",
      ...payload,
    });
  } catch (err) {
    console.error("AGENT AVAILABILITY UPDATE ERROR:", err?.message || err);
    return res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to update availability",
    });
  }
};
