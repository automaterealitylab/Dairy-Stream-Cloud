import {
  createMarketplaceOrder,
  getMarketplaceAdminDashboard,
  getMarketplaceDairyDashboard,
  handleMarketplaceWebhook,
  listMarketplaceDairies,
  listMarketplaceProducts,
  registerMarketplaceDairy,
  verifyMarketplacePayment,
} from "../services/marketplace/marketplace.service.js";
import {
  getSettlementHealth,
  getReconciliationDashboard,
  runMarketplaceReconciliation,
  verifyOrderSettlement,
} from "../services/marketplace/reconciliation.service.js";
import { getEnterpriseMonitoringDashboard } from "../services/marketplace/monitoring.service.js";
import { metrics } from "../utils/metrics.js";

const sendError = (res, err, fallback = "Request failed") => {
  res.status(err.statusCode || 400).json({
    success: false,
    error: err.message || fallback,
  });
};

export const registerDairy = async (req, res) => {
  try {
    const data = await registerMarketplaceDairy(req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("[MARKETPLACE_DAIRY_REGISTER]", err.message);
    sendError(res, err, "Failed to register dairy");
  }
};

export const fetchDairies = async (req, res) => {
  try {
    const data = await listMarketplaceDairies();
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "Failed to load dairies");
  }
};

export const fetchDairyProducts = async (req, res) => {
  try {
    const data = await listMarketplaceProducts(req.params.dairyId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "Failed to load marketplace products");
  }
};

export const createOrder = async (req, res) => {
  try {
    const data = await createMarketplaceOrder(req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("[MARKETPLACE_CREATE_ORDER]", err.message);
    sendError(res, err, "Failed to create order");
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const data = await verifyMarketplacePayment(req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "Failed to verify payment");
  }
};

export const razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const eventId = req.headers["x-razorpay-event-id"];
    const data = await handleMarketplaceWebhook({
      rawBody: req.rawBody || req.body,
      signature,
      eventId,
    });
    res.json(data);
  } catch (err) {
    console.error("[MARKETPLACE_WEBHOOK]", err.message);
    sendError(res, err, "Webhook failed");
  }
};

export const fetchAdminDashboard = async (req, res) => {
  try {
    const data = await getMarketplaceAdminDashboard();
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "Failed to load marketplace dashboard");
  }
};

export const reconcileMarketplace = async (req, res) => {
  try {
    const data = await runMarketplaceReconciliation({
      runType: req.body?.runType || "MANUAL_ADMIN",
      limit: Number(req.body?.limit || 100),
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "Marketplace reconciliation failed");
  }
};

export const fetchSettlementHealth = async (req, res) => {
  try {
    const data = await getSettlementHealth();
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "Failed to load settlement health");
  }
};

export const fetchReconciliationDashboard = async (req, res) => {
  try {
    const data = await getReconciliationDashboard({ limit: Number(req.query?.limit || 100) });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "Failed to load reconciliation dashboard");
  }
};

export const fetchEnterpriseMonitoringDashboard = async (req, res) => {
  try {
    const data = await getEnterpriseMonitoringDashboard();
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "Failed to load monitoring dashboard");
  }
};

export const fetchPrometheusMetrics = async (req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  res.send(metrics.prometheus());
};

export const verifySettlement = async (req, res) => {
  try {
    const data = await verifyOrderSettlement(req.params.razorpayOrderId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "Settlement verification failed");
  }
};

export const fetchDairyDashboard = async (req, res) => {
  try {
    const data = await getMarketplaceDairyDashboard(req.params.dairyId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "Failed to load dairy dashboard");
  }
};
