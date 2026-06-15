import { 
  getAdminNotifications as fetchNotifications,
  markNotificationRead as dbMarkRead,
  markAllNotificationsRead as dbMarkAllRead
} from "../../services/admin/notifications.service.js";

export const getAdminNotifications = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId;
    if (!dairyId) {
      return res.status(400).json({ message: "Admin dairy affiliation not found." });
    }

    const notifications = await fetchNotifications({ dairyId });
    res.json({ success: true, notifications });
  } catch (err) {
    console.error("❌ ADMIN NOTIFICATIONS ERROR:", err.message);
    res.status(500).json({
      message: "Failed to load notifications",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId;
    const notificationId = req.params.id;
    if (!dairyId) {
      return res.status(400).json({ message: "Admin dairy affiliation not found." });
    }
    if (!notificationId) {
      return res.status(400).json({ message: "Notification ID is required." });
    }

    await dbMarkRead({ notificationId, dairyId });
    res.json({ success: true, message: "Notification marked as read." });
  } catch (err) {
    console.error("❌ ADMIN MARK NOTIFICATION READ ERROR:", err.message);
    res.status(500).json({
      message: "Failed to mark notification as read",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId;
    if (!dairyId) {
      return res.status(400).json({ message: "Admin dairy affiliation not found." });
    }

    await dbMarkAllRead({ dairyId });
    res.json({ success: true, message: "All notifications marked as read." });
  } catch (err) {
    console.error("❌ ADMIN MARK ALL READ ERROR:", err.message);
    res.status(500).json({
      message: "Failed to mark all notifications as read",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
