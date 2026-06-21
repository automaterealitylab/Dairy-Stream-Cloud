import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { 
  fetchAdminNotifications, 
  markAdminNotificationRead, 
  markAllAdminNotificationsRead 
} from "../../../api/admin.api.js";
import AdminNotificationsPopup from "./AdminNotificationsPopup.jsx";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

export default function AdminHeader({
  adminName,
  notificationsOnly = false,
  embedded = false,
}) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      const list = await fetchAdminNotifications();
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.is_read).length);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id) => {
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await markAdminNotificationRead(id);
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      await markAllAdminNotificationsRead();
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
      loadNotifications();
    }
  };

  const notificationControl = (
    <div className="relative hidden lg:block">
      <button
        onClick={() => {
          setShowNotifications(!showNotifications);
        }}
        className={`relative flex items-center justify-center rounded-2xl border p-2.5 transition focus:outline-none ${
          embedded
            ? "border-white/20 bg-white/15 text-white hover:bg-white/25"
            : "border-[#EDE8DF] bg-white text-[#B89970] shadow-sm hover:bg-[#FDF6EC] hover:text-[#B8641A] dark:border-[#1E293B] dark:bg-[#121829] dark:text-slate-400 dark:hover:text-[#00C896]"
        }`}
        title="Notifications"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#B8641A] text-[10px] font-black text-white dark:bg-red-500">
            {unreadCount}
          </span>
        )}
      </button>
      {showNotifications && (
        <AdminNotificationsPopup
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
        />
      )}
    </div>
  );

  if (notificationsOnly) {
    return (
      <div
        className={embedded ? "" : "mb-5 flex justify-end"}
        style={adminShellFont}
      >
        {notificationControl}
      </div>
    );
  }

  return (
    <div className="mb-10" style={adminShellFont}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882] dark:text-[#E5C79D]">
        Admin Overview
      </p>
      
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-3xl sm:text-4xl text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>
          Welcome back, {adminName || "Admin"}
        </h1>
        
        {notificationControl}
      </div>
      
      <p className="mt-2 text-sm text-[#8B7355] dark:text-slate-400">
        Here's what's happening today.
      </p>
    </div>
  );
}
