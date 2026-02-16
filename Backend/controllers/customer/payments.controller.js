import { getCustomerPaymentsData } from "../../services/customer/payments.service.js";

export const getPayments = async (req, res) => {
  try {
    const data = await getCustomerPaymentsData(req.customer.id);
    res.json(data);
  } catch (err) {
    console.error("CUSTOMER PAYMENTS ERROR:", err.message);
    res.status(500).json({
      message: "Failed to load payments",
      error: err.message,
    });
  }
};

