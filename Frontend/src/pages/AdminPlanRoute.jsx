import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import LoadingIndicator from "../components/common/LoadingIndicator.jsx";
import { fetchAdminDashboard, getCachedAdminDashboard } from "../api/admin.api.js";
import { canAccessAdminFeature, normalizeAdminPlan } from "../utils/adminPlanAccess.js";

export default function AdminPlanRoute({
  feature,
  children,
  fallbackPath = "/admin/AdminDashboard",
}) {
  const [selectedPlan, setSelectedPlan] = useState(() => {
    const cached = getCachedAdminDashboard();
    return normalizeAdminPlan(cached?.selectedPlan);
  });
  const [loading, setLoading] = useState(() => !getCachedAdminDashboard()?.selectedPlan);

  useEffect(() => {
    let isMounted = true;

    const syncFromCache = () => {
      if (!isMounted) return;
      setSelectedPlan(normalizeAdminPlan(getCachedAdminDashboard()?.selectedPlan));
      setLoading(false);
    };

    const ensurePlan = async () => {
      try {
        const cached = getCachedAdminDashboard();
        if (cached?.selectedPlan) {
          if (isMounted) {
            setSelectedPlan(normalizeAdminPlan(cached.selectedPlan));
            setLoading(false);
          }
          return;
        }

        const dashboard = await fetchAdminDashboard();
        if (isMounted) {
          setSelectedPlan(normalizeAdminPlan(dashboard?.selectedPlan));
        }
      } catch {
        if (isMounted) {
          setSelectedPlan("Free");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    ensurePlan();
    window.addEventListener("admin-plan-updated", syncFromCache);

    return () => {
      isMounted = false;
      window.removeEventListener("admin-plan-updated", syncFromCache);
    };
  }, []);

  if (loading) {
    return <LoadingIndicator fullScreen message="Checking plan access..." />;
  }

  if (!canAccessAdminFeature(selectedPlan, feature)) {
    return <Navigate to={fallbackPath} replace state={{ planBlocked: true, feature }} />;
  }

  return children;
}
