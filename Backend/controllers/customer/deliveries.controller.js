import {
  cancelPendingOneTimeDeliveryOrder,
  createOneTimeDeliveryOrder,
  getCustomerDeliveries,
  reportCustomerDeliveryIssue,
} from "../../services/customer/deliveries.service.js";

export const getDeliveries = async (req, res) => {
  try {
    const payload = await getCustomerDeliveries(req.customer.id);
    res.json(payload);
  } catch (err) {
    console.error("CUSTOMER DELIVERIES ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to load deliveries",
    });
  }
};

export const createOneTimeOrder = async (req, res) => {
  try {
    const payload = await createOneTimeDeliveryOrder(req.customer.id, req.body || {});
    res.status(201).json(payload);
  } catch (err) {
    const message = err?.message || "Failed to place one-time order";
    const isValidationError = /required|must|cannot|not found|already exists|past date|slot|address/i.test(
      message
    );
    const status = isValidationError ? 400 : 500;
    res.status(status).json({ message });
  }
};

export const cancelOneTimeOrder = async (req, res) => {
  try {
    const payload = await cancelPendingOneTimeDeliveryOrder(req.customer.id, req.body || {});
    res.json(payload);
  } catch (err) {
    const message = err?.message || "Failed to cancel one-time order";
    const isValidationError = /required|not found|only|already/i.test(message);
    const status = isValidationError ? 400 : 500;
    res.status(status).json({ message });
  }
};

export const reportIssue = async (req, res) => {
  try {
    const payload = await reportCustomerDeliveryIssue(req.customer.id, {
      deliveryId: req.params?.id,
      issue: req.body?.issue,
    });
    res.json(payload);
  } catch (err) {
    const message = err?.message || "Failed to report issue";
    const isValidationError = /required|must|not found|characters/i.test(message);
    const status = isValidationError ? 400 : 500;
    res.status(status).json({ message });
  }
};

