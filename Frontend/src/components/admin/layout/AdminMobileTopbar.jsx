import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { 
  fetchAdminNotifications, 
  markAdminNotificationRead, 
  markAllAdminNotificationsRead 
} from "../../../api/admin.api.js";
import AdminNotificationsPopup from "../sections/AdminNotificationsPopup.jsx";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

export default function AdminMobileTopbar({ adminName, onMenu }) {
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
    const interval = setInterval(loadNotifications, 30000);
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

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between border-b border-[#EDE8DF] bg-[rgba(255,253,248,0.96)] px-4 py-3 backdrop-blur lg:hidden"
      style={adminShellFont}
    >
      <button onClick={onMenu} className="text-xl text-[#8B7355]">
        Menu
      </button>

      <span className="text-lg text-[#B8641A]" style={adminHeadingFont}>
        DairyStream
      </span>

      <div className="flex items-center gap-3 relative">
        <div className="relative">
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
            }}
            className="relative p-1.5 rounded-lg border border-[#EDE8DF] bg-white text-[#B89970] hover:text-[#B8641A] transition focus:outline-none"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#B8641A] text-[8px] font-black text-white">
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

        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#EDE8DF] bg-white text-sm font-semibold text-[#8B7355]">
          {adminName?.charAt(0) || "A"}
        </div>
      </div>
    </div>
  );
}
