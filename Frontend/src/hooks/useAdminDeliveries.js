import { useEffect, useState } from "react";
import {
  fetchAdminDeliveries,
  fetchAdminDeliverySchedulingOptions,
} from "../api/admin.api.js";

export const useAdminDeliveries = (date) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deliveries, setDeliveries] = useState([]);
  const [scheduleOptions, setScheduleOptions] = useState({ customers: [], agents: [] });

  const loadDeliveries = async () => {
    const response = await fetchAdminDeliveries({ date });
    setDeliveries(Array.isArray(response?.deliveries) ? response.deliveries : []);
  };

  const loadSchedulingOptions = async () => {
    const response = await fetchAdminDeliverySchedulingOptions();
    setScheduleOptions({
      customers: Array.isArray(response?.customers) ? response.customers : [],
      agents: Array.isArray(response?.agents) ? response.agents : [],
    });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [deliveryData, optionsData] = await Promise.all([
          fetchAdminDeliveries({ date }),
          fetchAdminDeliverySchedulingOptions(),
        ]);
        if (!active) return;
        setDeliveries(Array.isArray(deliveryData?.deliveries) ? deliveryData.deliveries : []);
        setScheduleOptions({
          customers: Array.isArray(optionsData?.customers) ? optionsData.customers : [],
          agents: Array.isArray(optionsData?.agents) ? optionsData.agents : [],
        });
      } catch (err) {
        if (!active) return;
        setLoadError(err?.message || "Failed to load data.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => { active = false; };
  }, [date]);

  return {
    loading,
    loadError,
    deliveries,
    scheduleOptions,
    loadDeliveries,
    loadSchedulingOptions,
  };
};
