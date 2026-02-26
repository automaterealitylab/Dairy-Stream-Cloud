import {
  getAdminDeliveries,
  getDeliverySchedulingOptions,
  scheduleBulkDeliveriesForDate,
  scheduleDeliveryForSubscribedCustomer,
} from "../../services/admin/adminDeliveries.service.js";

export const fetchAdminDeliveries = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId || null;
    const limit = Number(req.query.limit || 1000);

    const result = await getAdminDeliveries({ dairyId, limit });
    res.json(result);
  } catch (err) {
    console.error("ADMIN DELIVERIES ERROR:", err.message);
    res.status(500).json({
      message: "Failed to fetch deliveries",
    });
  }
};

export const fetchDeliverySchedulingOptions = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId || null;
    const result = await getDeliverySchedulingOptions({ dairyId });
    res.json(result);
  } catch (err) {
    console.error("ADMIN DELIVERY OPTIONS ERROR:", err.message);
    res.status(500).json({
      message: "Failed to load scheduling options",
    });
  }
};

export const scheduleAdminDelivery = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId || null;
    const { customerId, agentId, deliveryDate, notes } = req.body || {};

    const delivery = await scheduleDeliveryForSubscribedCustomer({
      dairyId,
      customerId,
      agentId,
      deliveryDate,
      notes,
    });

    res.status(201).json({
      message: "Delivery scheduled successfully",
      delivery,
    });
  } catch (err) {
    console.error("ADMIN DELIVERY SCHEDULE ERROR:", err.message);
    res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to schedule delivery",
    });
  }
};

export const scheduleAdminDeliveriesBulk = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId || null;
    const { deliveryDate, agentId, slot, route, notes } = req.body || {};

    const result = await scheduleBulkDeliveriesForDate({
      dairyId,
      deliveryDate,
      agentId,
      slot,
      route,
      notes,
    });

    res.status(201).json({
      message: "Bulk scheduling completed",
      summary: result,
    });
  } catch (err) {
    console.error("ADMIN BULK DELIVERY SCHEDULE ERROR:", err.message);
    res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to schedule deliveries in bulk",
    });
  }
};
