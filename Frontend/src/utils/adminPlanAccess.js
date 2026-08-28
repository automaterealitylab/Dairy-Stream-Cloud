const PLAN_RANK = {
  STARTER: 0,
  GROWTH: 1,
  PREMIUM: 2,
};

const FEATURE_MIN_PLAN = {
  // Base features available on all plans (STARTER, GROWTH, PREMIUM)
  dashboard: "STARTER",
  customers: "STARTER",
  deliveries: "STARTER",
  products: "STARTER",
  payments: "STARTER",
  profile: "STARTER",
  agents: "STARTER",
  notifications: "STARTER",
  monitoring: "STARTER",
  health: "STARTER",
  buildings: "STARTER",
  "farm-plan": "STARTER",
  bank: "STARTER",

  // Growth tier features
  performance: "GROWTH",

  // Premium tier features
  procurement: "PREMIUM",
  suppliers: "PREMIUM",
};

export const normalizeAdminPlan = (plan) => {
  const normalized = String(plan || "").trim().toUpperCase();
  if (normalized in PLAN_RANK) return normalized;
  return "STARTER";
};

export const canAccessAdminFeature = (plan, feature) => {
  const normalizedPlan = normalizeAdminPlan(plan);
  const requiredPlan = FEATURE_MIN_PLAN[feature] || "Prime";
  return PLAN_RANK[normalizedPlan] >= PLAN_RANK[requiredPlan];
};

export const getRestrictedAdminFeatures = (plan) => {
  return Object.keys(FEATURE_MIN_PLAN).filter(
    (feature) => !canAccessAdminFeature(plan, feature)
  );
};
