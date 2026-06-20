import { useEffect, useState } from "react";
import { Bell, Sun, Moon } from "lucide-react";
import { 
  fetchAdminNotifications, 
  markAdminNotificationRead, 
  markAllAdminNotificationsRead 
} from "../../../api/admin.api.js";
import AdminNotificationsPopup from "../sections/AdminNotificationsPopup.jsx";
import { adminHeadingFont, adminShellFont, useTheme } from "../adminTheme";

export default function AdminMobileTopbar({ adminName, onMenu }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { isDark, toggleTheme } = useTheme();

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
      className="sticky top-0 z-30 flex items-center justify-between border-b border-[#EDE8DF] bg-[rgba(255,253,248,0.96)] px-4 py-3 backdrop-blur dark:border-[#1E293B] dark:bg-[#0B0F19]/95 lg:hidden"
      style={adminShellFont}
    >
      <button 
        onClick={onMenu} 
        className="flex items-center gap-1.5 rounded-full border-[1px] border-[#EDE8DF] bg-[#ffffff] px-3.5 py-1.5 text-xs font-black uppercase text-[#8B7355] transition-all hover:bg-[#FDF6EC] dark:border-[#1E293B] dark:bg-[#121829] dark:text-slate-300 dark:hover:bg-[#1C243A]"
      >
        <span className="flex flex-col gap-0.5 w-3.5">
          <span className="h-0.5 w-full bg-[#8B7355] dark:bg-slate-300 rounded" />
          <span className="h-0.5 w-full bg-[#8B7355] dark:bg-slate-300 rounded" />
        </span>
        Menu
      </button>
 
      <span className="text-lg font-black text-[#B8641A] dark:text-[#00C896]" style={adminHeadingFont}>
        DairyStream
      </span>
 
      <div className="flex items-center gap-2 relative">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-1.5 rounded-lg border-[1px] border-[#EDE8DF] bg-[#ffffff] text-[#B89970] hover:text-[#B8641A] dark:border-[#1E293B] dark:bg-[#121829] dark:text-slate-400 dark:hover:text-[#00C896] transition focus:outline-none flex items-center justify-center shadow-sm"
          title="Toggle Theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
 
        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
            }}
            className="relative p-1.5 rounded-lg border-[1px] border-[#EDE8DF] bg-[#ffffff] text-[#B89970] hover:text-[#B8641A] dark:border-[#1E293B] dark:bg-[#121829] dark:text-slate-400 dark:hover:text-[#00C896] transition focus:outline-none shadow-sm"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#B8641A] text-[8px] font-black text-white dark:bg-red-500">
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
 
        {/* Profile Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-[1px] border-[#EDE8DF] bg-[#ffffff] text-sm font-black text-[#8B7355] dark:border-none dark:bg-[#00C896] dark:text-white">
          {adminName?.charAt(0) || "A"}
        </div>
      </div>
    </div>
  );
}
