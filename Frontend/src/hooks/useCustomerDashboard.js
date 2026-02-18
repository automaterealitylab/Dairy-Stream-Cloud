import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.jsx";
import { fetchCustomerDashboard } from "../api/customer.api.js";

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
