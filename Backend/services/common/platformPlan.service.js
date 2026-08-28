import { supabase } from "../../config/supabase.js";

// In-memory cache for dynamic platform plans
let plansCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

/**
 * Fetch all active platform plans from DB with caching
 */
export const getAllActivePlatformPlans = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && plansCache && now - lastFetchTime < CACHE_TTL_MS) {
    return plansCache;
  }

  const { data, error } = await supabase
    .from("platform_plans")
    .select("id, plan_key, name, monthly_price, yearly_price, gst_percent, trial_period_days, features, status")
    .eq("status", "ACTIVE")
    .order("id", { ascending: true });

  if (error) {
    console.error("❌ Error fetching platform_plans from DB:", error.message);
    if (plansCache) return plansCache; // Fallback to stale cache if available
    throw error;
  }

  plansCache = (data || []).map((row) => ({
    id: row.id,
    plan_key: String(row.plan_key || "").toUpperCase().trim(),
    name: row.name,
    monthly_price: Number(row.monthly_price || 0),
    yearly_price: Number(row.yearly_price || 0),
    gst_percent: Number(row.gst_percent ?? 18),
    trial_period_days: Number(row.trial_period_days ?? 14),
    features: Array.isArray(row.features) ? row.features : [],
    status: row.status,
  }));

  lastFetchTime = now;
  return plansCache;
};

/**
 * Fetch a single platform plan by planKey from DB
 * @param {string} planKey - e.g. 'STARTER', 'GROWTH', 'PREMIUM'
 */
export const getPlatformPlan = async (planKey) => {
  if (!planKey) return null;
  const normalizedKey = String(planKey).toUpperCase().trim();
  const plans = await getAllActivePlatformPlans();
  return plans.find((p) => p.plan_key === normalizedKey) || null;
};

/**
 * Invalidate the in-memory plan cache (called when Super Admin creates/updates/deletes a plan)
 */
export const clearPlatformPlanCache = () => {
  plansCache = null;
  lastFetchTime = 0;
};
