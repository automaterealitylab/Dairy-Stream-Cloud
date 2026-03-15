import { getAdminDashboardStats } from "../../services/admin/dashboard.service.js";

export const getDashboard = async (req, res) => {
  try {
    // Check if the user wants to bypass the cache
    const forceRefresh = req.query.refresh === 'true';

    const stats = await getAdminDashboardStats({
      dairyId: req.admin?.dairyId,
      forceRefresh: forceRefresh // We pass this to the service
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