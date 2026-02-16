import { getCustomerDeliveries } from "../../services/customer/deliveries.service.js";

export const getDeliveries = async (req, res) => {
  try {
    const deliveries = await getCustomerDeliveries(req.customer.id);
    res.json({ deliveries });
  } catch (err) {
    console.error("CUSTOMER DELIVERIES ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to load deliveries",
    });
  }
};

