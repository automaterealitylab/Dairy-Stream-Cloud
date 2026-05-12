import { supabase } from "../../config/supabase.js";
import { metrics } from "../../utils/metrics.js";

export const detectSuspiciousMarketplaceOrder = async ({ customer, dairy, pricing, payload }) => {
  const alerts = [];
  const amount = Number(pricing?.total || 0);
  const highValueThreshold = Number(process.env.FRAUD_HIGH_VALUE_ORDER_INR || 50000);

  if (amount >= highValueThreshold) {
    alerts.push({
      alert_type: "HIGH_VALUE_ORDER",
      severity: "HIGH",
      signal: { amount, threshold: highValueThreshold },
    });
  }

  const phone = String(customer?.phone || customer?.phone_number || payload?.customer_phone || "");
  if (phone && phone.replace(/\D/g, "").length < 10) {
    alerts.push({
      alert_type: "SUSPICIOUS_PHONE",
      severity: "MEDIUM",
      signal: { phone },
    });
  }

  for (const alert of alerts) {
    metrics.increment("fraud_alerts_created", { alertType: alert.alert_type, severity: alert.severity });
    await supabase.from("fraud_alerts").insert({
      dairy_id: dairy?.id || null,
      customer_id: customer?.id || null,
      ...alert,
    });
  }

  return alerts;
};
