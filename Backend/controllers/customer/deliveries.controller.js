import { getCustomerDeliveries } from "../../services/customer/deliveries.service.js";

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

