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
      totalRevenue: paymentsData.revenue
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
