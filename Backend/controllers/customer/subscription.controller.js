import {
  getSubscriptionByCustomerId,
  upsertSubscription,
  clearSubscriptionByCustomerId,
} from "../../services/customer/subscription.service.js";

export const getSubscription = async (req, res) => {
  try {
    const subscription = await getSubscriptionByCustomerId(req.customer.id);
    res.json({ subscription });
  } catch (err) {
    console.error("CUSTOMER SUBSCRIPTION ERROR:", err.message);
    res.status(500).json({ message: "Failed to load subscription" });
  }
};

export const saveSubscription = async (req, res) => {
  try {
    const {
      dairyId,
      milkType,
      quantity,
      slot,
      startDate,
      address,
      paymentMethod,
      deliveryDays,
      status,
      approvalStatus,
      assignedAgentId,
    } = req.body;

    if (!dairyId) {
      return res.status(400).json({ message: "dairyId is required" });
    }

    const subscription = await upsertSubscription(req.customer.id, {
      dairy_id: dairyId,
      milk_type: milkType,
      quantity_liters: Number(quantity),
      delivery_slot: slot,
      start_date: startDate,
      address,
      payment_method: paymentMethod,
      delivery_days: deliveryDays,
      status,
      approval_status: approvalStatus,
      assigned_agent_id:
        assignedAgentId === undefined || assignedAgentId === null || assignedAgentId === ""
          ? undefined
          : Number(assignedAgentId),
    });

    res.json({ subscription });
  } catch (err) {
    console.error("CUSTOMER SUBSCRIPTION SAVE ERROR:", err.message);
    res.status(500).json({
      message: err?.message || "Failed to save subscription",
    });
  }
};

export const clearSubscription = async (req, res) => {
  try {
    const result = await clearSubscriptionByCustomerId(req.customer.id);
    res.json({
      success: true,
      message: "Subscription closed successfully",
      ...result,
    });
  } catch (err) {
    console.error("CUSTOMER SUBSCRIPTION CLEAR ERROR:", err.message);
    const statusCode = err?.statusCode || (/pending|dues|unpaid|clear/i.test(String(err?.message || "")) ? 400 : 500);
    res.status(statusCode).json({
      message: err?.message || "Failed to clear subscription",
    });
  }
};
