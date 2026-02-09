import { useEffect, useState } from "react";

export const useCustomerDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // 🔧 TEMP DATA (until backend API exists)
        const mockResponse = {
          customer: {
            name: "Rahul",
            dairy: "Nandanvan Farms",
          },
          todayDelivery: {
            status: "DELIVERED",
            time: "07:15 AM",
            product: "Buffalo Milk",
            quantity: "1.5 L",
          },
          tomorrowDelivery: {
            quantity: "1.5 Liters",
            slot: "Morning (6:00 - 8:00 AM)",
          },
          billing: {
            monthlyDue: 1200,
            walletBalance: 450,
            dueInDays: 5,
          },
        };

        // simulate API delay
        setTimeout(() => {
          setData(mockResponse);
          setLoading(false);
        }, 500);
      } catch (err) {
        setError("Failed to load dashboard");
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  return { data, loading, error };
};
