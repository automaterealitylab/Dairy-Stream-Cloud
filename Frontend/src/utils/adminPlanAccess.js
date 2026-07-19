const PLAN_RANK = {
  Free: 0,
  Growth: 1,
  Prime: 2,
};

const FEATURE_MIN_PLAN = {
  dashboard: "Free",
  customers: "Free",
  deliveries: "Free",
  products: "Free",
  payments: "Free",
  profile: "Free",
  agents: "Growth",
  performance: "Growth",
  procurement: "Prime",
  suppliers: "Prime",
};

export const normalizeAdminPlan = (plan) => {
  const normalized = String(plan || "").trim().toUpperCase();
  const mapping = {
    STARTER: "Free",
    FREE: "Free",
    GROWTH: "Growth",
    ENTERPRISE: "Prime",
    PRIME: "Prime",
  };
  const mapped = mapping[normalized] || normalized;
  const capitalizedMapped = mapped.charAt(0).toUpperCase() + mapped.slice(1).toLowerCase();
  if (capitalizedMapped in PLAN_RANK) return capitalizedMapped;
  if (mapped in PLAN_RANK) return mapped;
  return "Free";
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
