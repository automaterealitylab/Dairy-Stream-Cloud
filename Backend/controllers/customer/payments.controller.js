import {
  createCustomerPaymentOrder,
  getCustomerPaymentsData,
  verifyCustomerPayment,
} from "../../services/customer/payments.service.js";

export const getPayments = async (req, res) => {
  try {
    const data = await getCustomerPaymentsData(
      req.customer.id,
      req.customer?.dairyId ?? null
    );
    res.json(data);
  } catch (err) {
    console.error("CUSTOMER PAYMENTS ERROR:", err.message);
    res.status(500).json({
      message: "Failed to load payments",
      error: err.message,
    });
  }
};

export const createPaymentOrder = async (req, res) => {
  try {
    const { paymentId, payAll } = req.body || {};
    const data = await createCustomerPaymentOrder({
      customerId: req.customer.id,
      paymentId,
      payAll: Boolean(payAll),
      dairyId: req.customer?.dairyId ?? null,
    });
    res.json(data);
  } catch (err) {
    console.error("CREATE PAYMENT ORDER ERROR:", err.message);
    res.status(400).json({
      message: err.message || "Failed to create payment order",
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      paymentId,
      payAll,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = req.body || {};

    const data = await verifyCustomerPayment({
      customerId: req.customer.id,
      paymentId,
      payAll: Boolean(payAll),
      dairyId: req.customer?.dairyId ?? null,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    res.json(data);
  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err.message);
    res.status(400).json({
      message: err.message || "Payment verification failed",
    });
  }
};

