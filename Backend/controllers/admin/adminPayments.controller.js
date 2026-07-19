import * as paymentService from "../../services/admin/adminPayments.service.js";

export const fetchPageData = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const status = req.query.status || "ALL";
    const adminId = req.admin.id;
    const dairyId = req.admin.dairyId || null;

    // Parallel Fetching
    const [farmData, paymentsData] = await Promise.all([
      paymentService.getFarmSubscription({ adminId, dairyId }),
      paymentService.getCustomerPayments({ page, limit: 10, status, dairyId }),
    ]);

    res.json({
      farm: farmData,
      payments: paymentsData.payments,
      totalPayments: paymentsData.total,
      totalRevenue: paymentsData.revenue,
      pendingDues: paymentsData.pendingDues,
    });
  } catch (err) {
    console.error("PAYMENT PAGE ERROR:", err);
    res.status(500).json({ error: "Failed to load payment data" });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await paymentService.updateCustomerPaymentStatus(id, status, req.admin.dairyId || null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const changeFarmPlan = async (req, res) => {
  try {
    const { dairyId: bodyDairyId, plan } = req.body;
    const dairyId = req.admin.dairyId || bodyDairyId;
    const updated = await paymentService.updateFarmPlan(dairyId, plan);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const collectOfflinePayment = async (req, res) => {
  try {
    const { customerId, receivedAmount, method, note } = req.body || {};
    const dairyId = req.admin.dairyId || null;
    const result = await paymentService.collectCustomerOfflinePayment({
      customerId: Number(customerId),
      dairyId,
      receivedAmount,
      method,
      note,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to record offline payment" });
  }
};

export const fetchPaymentVerifications = async (req, res) => {
  try {
    const dairyId = req.admin.dairyId || null;
    if (!dairyId) {
      return res.status(400).json({ error: "Dairy context is required" });
    }

    const data = await paymentService.getPaymentVerificationQueue({
      dairyId,
      status: req.query.status || "PENDING",
      limit: Number(req.query.limit || 50),
    });

    res.json({ success: true, verifications: data });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load payment verifications" });
  }
};

export const approvePaymentVerification = async (req, res) => {
  try {
    const dairyId = req.admin.dairyId || null;
    if (!dairyId) {
      return res.status(400).json({ error: "Dairy context is required" });
    }

    const result = await paymentService.approvePaymentVerification({
      verificationId: Number(req.params.id),
      dairyId,
      adminId: req.admin.id,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to approve payment verification" });
  }
};

export const rejectPaymentVerification = async (req, res) => {
  try {
    const dairyId = req.admin.dairyId || null;
    if (!dairyId) {
      return res.status(400).json({ error: "Dairy context is required" });
    }

    const verification = await paymentService.rejectPaymentVerification({
      verificationId: Number(req.params.id),
      dairyId,
      adminId: req.admin.id,
      reason: req.body?.reason,
    });

    res.json({ success: true, verification });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to reject payment verification" });
  }
};

export const createFarmPlanOrder = async (req, res) => {
  try {
    const { plan, cycle, couponCode } = req.body;
    const dairyId = req.admin.dairyId;
    if (!dairyId) {
      return res.status(400).json({ error: "Dairy context is required" });
    }

    const orderData = await paymentService.createFarmPlanOrder({
      dairyId,
      plan,
      cycle,
      couponCode,
    });

    res.json(orderData);
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to create farm plan order" });
  }
};

export const verifyFarmPlanPayment = async (req, res) => {
  try {
    const { plan, cycle, razorpayOrderId, razorpayPaymentId, razorpaySignature, couponCode } = req.body;
    const dairyId = req.admin.dairyId;
    if (!dairyId) {
      return res.status(400).json({ error: "Dairy context is required" });
    }

    const updated = await paymentService.verifyFarmPlanPayment({
      dairyId,
      plan,
      cycle,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      couponCode,
    });

    res.json({ success: true, dairy: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to verify farm plan payment" });
  }
};

export const createFarmPlanSubscription = async (req, res) => {
  try {
    const { plan, cycle } = req.body;
    const dairyId = req.admin.dairyId;
    if (!dairyId) {
      return res.status(400).json({ error: "Dairy context is required" });
    }

    const subData = await paymentService.createFarmPlanSubscription({
      dairyId,
      plan,
      cycle,
    });

    res.json(subData);
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to create farm plan subscription" });
  }
};

export const verifyFarmPlanSubscriptionPayment = async (req, res) => {
  try {
    const { plan, cycle, razorpayPaymentId, razorpaySubscriptionId, razorpaySignature } = req.body;
    const dairyId = req.admin.dairyId;
    if (!dairyId) {
      return res.status(400).json({ error: "Dairy context is required" });
    }

    const updated = await paymentService.verifyFarmPlanSubscriptionPayment({
      dairyId,
      plan,
      cycle,
      razorpayPaymentId,
      razorpaySubscriptionId,
      razorpaySignature,
    });

    res.json({ success: true, dairy: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to verify farm plan subscription payment" });
  }
};
