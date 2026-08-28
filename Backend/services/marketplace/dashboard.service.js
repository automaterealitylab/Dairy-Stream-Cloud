// Marketplace dashboards: aggregate admin overview and per-dairy order/payment
// listing for a single dairy.

import { supabase } from "../../config/supabase.js";
import { getDairyById } from "./queries.service.js";

export const getMarketplaceAdminDashboard = async () => {
  const [dairiesRes, ordersRes, paymentsRes, logsRes, mismatchRes, fraudRes] = await Promise.all([
    supabase.from("dairies").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("webhook_logs").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("reconciliation_mismatches").select("*").eq("status", "OPEN").order("created_at", { ascending: false }).limit(50),
    supabase.from("fraud_alerts").select("*").neq("status", "CLOSED").order("created_at", { ascending: false }).limit(50),
  ]);

  if (dairiesRes.error) throw dairiesRes.error;
  if (ordersRes.error) throw ordersRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (logsRes.error) throw logsRes.error;
  if (mismatchRes.error && mismatchRes.error.code !== "42P01") throw mismatchRes.error;
  if (fraudRes.error && fraudRes.error.code !== "42P01") throw fraudRes.error;

  return {
    dairies: dairiesRes.data || [],
    orders: ordersRes.data || [],
    payments: paymentsRes.data || [],
    webhookLogs: logsRes.data || [],
    reconciliationMismatches: mismatchRes.data || [],
    fraudAlerts: fraudRes.data || [],
  };
};

export const getMarketplaceDairyDashboard = async (dairyId) => {
  const dairy = await getDairyById(dairyId);
  const [ordersRes, paymentsRes] = await Promise.all([
    supabase.from("orders").select("*").eq("dairy_id", dairy.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("dairy_id", dairy.id).order("created_at", { ascending: false }),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  return {
    dairy,
    orders: ordersRes.data || [],
    payments: paymentsRes.data || [],
  };
};
