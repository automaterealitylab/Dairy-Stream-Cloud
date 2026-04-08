import {
  createCustomerPaymentOrder,
  createCustomerWalletTopupOrder,
  getCustomerPaymentsData,
  verifyCustomerWalletTopup,
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
    const { paymentId, payAll, includeRunningDue } = req.body || {};
    const data = await createCustomerPaymentOrder({
      customerId: req.customer.id,
      paymentId,
      payAll: Boolean(payAll),
      includeRunningDue: includeRunningDue === undefined ? true : Boolean(includeRunningDue),
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
      includeRunningDue,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = req.body || {};

    const data = await verifyCustomerPayment({
      customerId: req.customer.id,
      paymentId,
      payAll: Boolean(payAll),
      includeRunningDue: includeRunningDue === undefined ? true : Boolean(includeRunningDue),
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

export const createWalletTopupOrder = async (req, res) => {
  try {
    const amount = Number(req.body?.amount || 0);
    const data = await createCustomerWalletTopupOrder({
      customerId: req.customer.id,
      dairyId: req.customer?.dairyId ?? null,
      amount,
    });
    res.json(data);
  } catch (err) {
    console.error("CREATE WALLET TOPUP ORDER ERROR:", err.message);
    res.status(400).json({
      message: err.message || "Failed to create wallet top-up order",
    });
  }
};

export const verifyWalletTopup = async (req, res) => {
  try {
    const {
      amount,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = req.body || {};

    const data = await verifyCustomerWalletTopup({
      customerId: req.customer.id,
      dairyId: req.customer?.dairyId ?? null,
      amount,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    res.json(data);
  } catch (err) {
    console.error("VERIFY WALLET TOPUP ERROR:", err.message);
    res.status(400).json({
      message: err.message || "Wallet top-up verification failed",
    });
  }
};

