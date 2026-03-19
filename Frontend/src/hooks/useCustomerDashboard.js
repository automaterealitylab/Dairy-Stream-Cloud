import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.jsx";
import {
  fetchCustomerDashboard,
  getCachedCustomerDashboard,
} from "../api/customer/customer.api.js";

export const useCustomerDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(() => getCachedCustomerDashboard());
  const [loading, setLoading] = useState(() => !getCachedCustomerDashboard());
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      const cachedDashboard = getCachedCustomerDashboard();

      if (!cancelled) {
        if (cachedDashboard) {
          setData(cachedDashboard);
        }
        setLoading(!cachedDashboard);
        setError(null);
      }

      try {
        const storedUser = localStorage.getItem("user");
        let storedToken = null;

        try {
          storedToken = storedUser ? JSON.parse(storedUser)?.token : null;
        } catch {
          storedToken = null;
        }

        const token = user?.token || storedToken || localStorage.getItem("token");
        if (!token) {
          if (!cancelled) {
            setData(null);
            setError("Customer token missing");
            setLoading(false);
          }
          return;
        }

        const res = await fetchCustomerDashboard();

        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setError("Failed to load dashboard");
          setLoading(false);
        }
      }
    };

    if (authLoading && !getCachedCustomerDashboard()) {
      return undefined;
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { data, loading, error };
};
