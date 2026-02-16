import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.jsx";
import {
  fetchCustomerDashboard,
  fetchCustomerProfile,
} from "../../api/customer.api.js";

export const useCustomerDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        const storedToken = storedUser ? JSON.parse(storedUser)?.token : null;
        const token = user?.token || storedToken || localStorage.getItem("token");
        if (!token) {
          setError("Customer token missing");
          setLoading(false);
          return;
        }
        const res = await fetchCustomerDashboard(token);

        const needsDairyFallback =
          !res?.customer?.memberOfDairy ||
          String(res.customer.memberOfDairy).trim().toLowerCase() === "not assigned";

        if (needsDairyFallback) {
          try {
            const profile = await fetchCustomerProfile(token);
            const profileDairyName =
              profile?.member_of_dairy || profile?.dairy_name || null;

            if (profileDairyName) {
              const normalized = {
                ...res,
                customer: {
                  ...res.customer,
                  dairy: profileDairyName,
                  dairyName: profileDairyName,
                  memberOfDairy: profileDairyName,
                },
                subscription: res.subscription
                  ? {
                      ...res.subscription,
                      dairyName:
                        !res.subscription.dairyName ||
                        res.subscription.dairyName === "Dairy"
                          ? profileDairyName
                          : res.subscription.dairyName,
                    }
                  : res.subscription,
              };
              setData(normalized);
              setLoading(false);
              return;
            }
          } catch (profileErr) {
            // Ignore fallback failures and continue with dashboard payload.
          }
        }

        setData(res);
        setLoading(false);
      } catch (err) {
        setError("Failed to load dashboard");
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user]);

  return { data, loading, error };
};
