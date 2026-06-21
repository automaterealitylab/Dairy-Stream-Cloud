import { useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Bell, 
  CheckCircle2, 
  IndianRupee, 
  UserPlus, 
  ShoppingBag, 
  X, 
  Check,
  FileText,
  AlertTriangle
} from "lucide-react";
import { adminHeadingFont, adminShellFont } from "../adminTheme";

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "";
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// Group notifications by date buckets
const groupNotifications = (list) => {
  const groups = [
    { key: "today", label: "Today", items: [] },
    { key: "yesterday", label: "Yesterday", items: [] },
    { key: "last7Days", label: "Last 7 Days", items: [] },
    { key: "last30Days", label: "Last 30 Days", items: [] },
    { key: "older", label: "Older", items: [] },
  ];

  const now = new Date();
  
  // Today start: 00:00:00
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  // Yesterday start: 00:00:00
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  
  // Last 7 days start (excluding today/yesterday)
  const sevenDaysStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  
  // Last 30 days start
  const thirtyDaysStart = todayStart - 30 * 24 * 60 * 60 * 1000;

  list.forEach((notif) => {
    const time = new Date(notif.timestamp).getTime();
    if (time >= todayStart) {
      groups[0].items.push(notif);
    } else if (time >= yesterdayStart) {
      groups[1].items.push(notif);
    } else if (time >= sevenDaysStart) {
      groups[2].items.push(notif);
    } else if (time >= thirtyDaysStart) {
      groups[3].items.push(notif);
    } else {
      groups[4].items.push(notif);
    }
  });

  // Filter out groups with zero items
  return groups.filter((g) => g.items.length > 0);
};

export default function AdminNotificationsPopup({ 
  notifications, 
  onClose, 
  onMarkRead,
  onMarkAllRead 
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const getNotificationStyles = (type) => {
    switch (type) {
      case "DELIVERY_PENDING":
        return {
          icon: <Bell size={18} className="text-amber-600" />,
          bg: "bg-amber-50 border border-amber-100",
        };
      case "DELIVERIES_COMPLETE":
        return {
          icon: <CheckCircle2 size={18} className="text-emerald-600" />,
          bg: "bg-emerald-50 border border-emerald-100",
        };
      case "PAYMENT_RECEIVED":
        return {
          icon: <IndianRupee size={16} className="text-emerald-600" />,
          bg: "bg-emerald-50 border border-emerald-100",
        };
      case "NEW_CUSTOMER":
        return {
          icon: <UserPlus size={18} className="text-blue-600" />,
          bg: "bg-blue-50 border border-blue-100",
        };
      case "ONE_TIME_ORDER":
        return {
          icon: <ShoppingBag size={18} className="text-purple-600" />,
          bg: "bg-purple-50 border border-purple-100",
        };
      case "MONTHLY_BILL_GENERATED":
        return {
          icon: <FileText size={18} className="text-indigo-600" />,
          bg: "bg-indigo-50 border border-indigo-100",
        };
      case "MONTHLY_BILL_OVERDUE":
        return {
          icon: <AlertTriangle size={18} className="text-rose-600" />,
          bg: "bg-rose-50 border border-rose-100",
        };
      default:
        return {
          icon: <Bell size={18} className="text-gray-600" />,
          bg: "bg-gray-50 border border-gray-100",
        };
    }
  };

  const grouped = groupNotifications(notifications);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="flex max-h-[min(720px,85vh)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[#EDE8DF] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.25)]"
        style={adminShellFont}
        onMouseDown={(event) => event.stopPropagation()}
      >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#F2EDE4] px-5 py-4 bg-[#FFFDF8] shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-black text-[#2C1A0E]" style={adminHeadingFont}>
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B8641A] px-1.5 text-[10px] font-black text-white">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button 
              onClick={onMarkAllRead}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#B8641A] hover:text-[#9E5415] transition focus:outline-none"
            >
              <Check size={14} strokeWidth={2.5} />
              Mark all read
            </button>
          )}
          <button 
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDF6EC] text-[#B89970] mb-3">
              <Bell size={22} />
            </div>
            <p className="text-sm font-bold text-[#8B7355]">All caught up!</p>
            <p className="text-xs text-gray-400 mt-1">No notifications stored in database.</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.key} className="bg-white">
              {/* Group Heading */}
              <div className="sticky top-0 z-10 bg-[#FAF9F5] px-5 py-1.5 border-y border-[#F2EDE4] text-[10px] font-black uppercase tracking-[0.15em] text-[#C4A882]">
                {group.label}
              </div>
              
              {/* Group items */}
              <div className="divide-y divide-[#F5EFE6]">
                {group.items.map((notif) => {
                  const styles = getNotificationStyles(notif.type);
                  return (
                    <div 
                      key={notif.id}
                      onClick={() => !notif.is_read && onMarkRead && onMarkRead(notif.id)}
                      className={`flex items-start gap-4 p-4 transition cursor-pointer relative ${
                        notif.is_read 
                          ? "bg-white hover:bg-[#FFFDF8]" 
                          : "bg-[#F0F7FF] hover:bg-[#E5F1FF]"
                      }`}
                    >
                      {/* Unread indicator dot */}
                      {!notif.is_read && (
                        <span className="absolute left-2 top-[22px] h-2 w-2 rounded-full bg-[#B8641A]" />
                      )}
                      
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${styles.bg}`}>
                        {styles.icon}
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-extrabold text-[#2C1A0E]">
                            {notif.title}
                          </p>
                          <span className="text-[10px] font-medium text-gray-400 shrink-0">
                            {formatRelativeTime(notif.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-[#6D6470] leading-relaxed font-semibold">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </div>,
    document.body
  );
}
