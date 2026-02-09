const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const fetchCustomerDashboard = async (token) => {
  const res = await fetch(`${API_BASE}/api/customer/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch dashboard data");
  }

  return res.json();
};
