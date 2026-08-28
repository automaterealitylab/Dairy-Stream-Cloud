import { supabase } from "../config/supabase.js";

/**
 * Middleware to verify admin's subscription plan has access to a required feature
 *
 * Flow:
 * 1. Get dairy ID from authenticated admin (already verified by verifyAdmin)
 * 2. Find active platform subscription for that dairy
 * 3. Get plan features from platform_plans table
 * 4. Check if required feature is included in plan features
 * 5. Allow or reject with 403
 */

// Cache for plan features to avoid repeated DB queries
const planFeaturesCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

const getCachedPlanFeatures = (planKey) => {
  const cached = planFeaturesCache.get(planKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.features;
  }
  return null;
};

const setCachedPlanFeatures = (planKey, features) => {
  planFeaturesCache.set(planKey, { features, timestamp: Date.now() });
};

/**
 * Get the active plan features for a dairy
 * @param {number} dairyId - The dairy ID
 * @returns {Promise<{planKey: string, features: string[]} | null>} Plan info or null if no active subscription
 */
const getDairyActivePlanFeatures = async (dairyId) => {
  if (!Number.isFinite(dairyId) || dairyId <= 0) {
    return null;
  }

  // Get active subscription for this dairy
  const { data: subscription, error: subError } = await supabase
    .from("platform_subscriptions")
    .select("plan_key, status, trial_end_date, end_date")
    .eq("dairy_id", dairyId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError) {
    console.error("❌ Error fetching platform subscription:", subError.message);
    throw subError;
  }

  if (!subscription) {
    return null;
  }

  // Check if subscription is still valid (not expired trial/end date)
  const now = new Date();
  const trialEnd = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null;
  const endDate = subscription.end_date ? new Date(subscription.end_date) : null;

  if (trialEnd && trialEnd < now) {
    // Trial expired
    return null;
  }
  if (endDate && endDate < now) {
    // Subscription expired
    return null;
  }

  const planKey = subscription.plan_key;

  // Check cache first
  const cachedFeatures = getCachedPlanFeatures(planKey);
  if (cachedFeatures !== null) {
    return { planKey, features: cachedFeatures };
  }

  // Fetch plan features from platform_plans
  const { data: plan, error: planError } = await supabase
    .from("platform_plans")
    .select("plan_key, features")
    .eq("plan_key", planKey)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (planError) {
    console.error("❌ Error fetching platform plan:", planError.message);
    throw planError;
  }

  if (!plan) {
    return null;
  }

  const features = Array.isArray(plan.features) ? plan.features : [];
  setCachedPlanFeatures(planKey, features);

  return { planKey, features };
};

/**
 * Creates a middleware that checks if the admin's dairy has access to a specific feature
 * @param {string} requiredFeature - The feature key required (e.g., 'procurement', 'suppliers', 'performance')
 * @returns {Function} Express middleware
 */
export const verifyAdminPlan = (requiredFeature) => {
  return async (req, res, next) => {
    try {
      // Admin should already be authenticated and attached by verifyAdmin middleware
      const admin = req.admin;

      if (!admin || !admin.dairyId) {
        return res.status(401).json({
          success: false,
          message: "Admin authentication required"
        });
      }

      const dairyId = Number(admin.dairyId);
      if (!Number.isFinite(dairyId) || dairyId <= 0) {
        return res.status(403).json({
          success: false,
          message: "Invalid dairy context"
        });
      }

      // Get active plan features for this dairy
      const planInfo = await getDairyActivePlanFeatures(dairyId);

      if (!planInfo) {
        return res.status(403).json({
          success: false,
          message: "No active subscription found. Please upgrade your plan to access this feature.",
          code: "NO_ACTIVE_SUBSCRIPTION"
        });
      }

      const { planKey, features } = planInfo;

      // Check if the required feature is included in the plan
      const hasFeature = features.includes(requiredFeature);

      if (!hasFeature) {
        return res.status(403).json({
          success: false,
          message: `This feature requires a higher subscription plan. Your current plan (${planKey}) does not include '${requiredFeature}'.`,
          code: "INSUFFICIENT_PLAN",
          currentPlan: planKey,
          requiredFeature,
          availableFeatures: features
        });
      }

      // Attach plan info to request for potential use in controllers
      req.adminPlan = {
        planKey,
        features
      };

      next();
    } catch (err) {
      console.error("❌ Admin plan verification error:", err.message);

      // Don't expose internal errors
      return res.status(500).json({
        success: false,
        message: "Failed to verify subscription plan"
      });
    }
  };
};

/**
 * Middleware to verify admin has access to ANY of the listed features (OR logic)
 * @param {string[]} requiredFeatures - Array of feature keys, access granted if any matches
 * @returns {Function} Express middleware
 */
export const verifyAdminPlanAny = (requiredFeatures) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;

      if (!admin || !admin.dairyId) {
        return res.status(401).json({
          success: false,
          message: "Admin authentication required"
        });
      }

      const dairyId = Number(admin.dairyId);
      if (!Number.isFinite(dairyId) || dairyId <= 0) {
        return res.status(403).json({
          success: false,
          message: "Invalid dairy context"
        });
      }

      const planInfo = await getDairyActivePlanFeatures(dairyId);

      if (!planInfo) {
        return res.status(403).json({
          success: false,
          message: "No active subscription found. Please upgrade your plan to access this feature.",
          code: "NO_ACTIVE_SUBSCRIPTION"
        });
      }

      const { planKey, features } = planInfo;

      // Check if ANY of the required features are included
      const hasFeature = requiredFeatures.some(f => features.includes(f));

      if (!hasFeature) {
        return res.status(403).json({
          success: false,
          message: `This feature requires a higher subscription plan. Your current plan (${planKey}) does not include any of the required features: ${requiredFeatures.join(', ')}.`,
          code: "INSUFFICIENT_PLAN",
          currentPlan: planKey,
          requiredFeatures,
          availableFeatures: features
        });
      }

      req.adminPlan = {
        planKey,
        features
      };

      next();
    } catch (err) {
      console.error("❌ Admin plan verification error:", err.message);
      return res.status(500).json({
        success: false,
        message: "Failed to verify subscription plan"
      });
    }
  };
};

/**
 * Clear the plan features cache (useful when plans are updated)
 */
export const clearPlanFeaturesCache = () => {
  planFeaturesCache.clear();
};

/**
 * Get plan features for a specific plan key (for testing/admin use)
 */
export const getPlanFeatures = async (planKey) => {
  const cached = getCachedPlanFeatures(planKey);
  if (cached !== null) return cached;

  const { data: plan, error } = await supabase
    .from("platform_plans")
    .select("plan_key, features")
    .eq("plan_key", planKey)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) throw error;
  if (!plan) return null;

  const features = Array.isArray(plan.features) ? plan.features : [];
  setCachedPlanFeatures(planKey, features);
  return features;
};