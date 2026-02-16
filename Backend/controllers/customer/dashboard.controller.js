import { getCustomerDashboard } from "../../services/customer/dashboard.service.js";

export const getDashboard = async (req, res) => {
  try {
    const data = await getCustomerDashboard(req.customer.id, {
      dairyId: req.customer?.dairyId ?? null,
    });
    res.json(data);
  } catch (err) {
    console.error("CUSTOMER DASHBOARD ERROR:", err.message);
    res.status(500).json({
      message: "Failed to load dashboard",
      error: err.message,
    });
  }
};
