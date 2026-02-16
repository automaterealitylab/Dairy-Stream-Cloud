import { getAdminDashboardStats } from "../../services/admin/dashboard.service.js";

export const getDashboard = async (req, res) => {
  try {
    console.log("📊 Fetching admin dashboard stats...");

    const stats = await getAdminDashboardStats({
      dairyId: req.admin?.dairyId,
    });
    
    res.json(stats);
  } catch (err) {
    console.error("❌ ADMIN DASHBOARD ERROR:", err.message);
    res.status(500).json({
      message: "Failed to load dashboard data",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
