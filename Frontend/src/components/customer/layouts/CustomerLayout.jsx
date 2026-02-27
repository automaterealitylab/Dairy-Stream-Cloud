import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  Calendar,
  ShoppingBag,
  CreditCard,
  User,
  Bell,
  LogOut,
  MapPin
} from "lucide-react";

/* ================= NAV CONFIG (SINGLE SOURCE) ================= */
const NAV_ITEMS = [
  { icon: Home, label: "Home", path: "/customer/dashboard" },
  { icon: Calendar, label: "Deliveries", path: "/customer/dashboard/deliveries" },
  { icon: ShoppingBag, label: "My Subscription", path: "/customer/dashboard/subscriptions" },
  { icon: CreditCard, label: "Payments", path: "/customer/dashboard/payments" },
   { icon:MapPin, label: "Track Agent", path: "/customer/dashboard/track/agent" },
  { icon: User, label: "Profile", path: "/customer/dashboard/profile" },
];
const DASHBOARD_VISITED_FLAG = "customerDashboardVisited";

const CustomerLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.removeItem(DASHBOARD_VISITED_FLAG);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-border h-screen fixed">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-brand">DairyStream</h1>
          <p className="text-xs text-text-muted mt-1">Customer Dashboard</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`
                  flex items-center gap-3 w-full px-4 py-3 rounded-xl
                  text-sm font-medium transition
                  ${
                    active
                      ? "bg-brand-soft text-brand"
                      : "text-text-secondary hover:bg-background"
                  }
                `}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="
              flex items-center gap-3 w-full px-4 py-3
              text-red-500 rounded-xl text-sm font-medium
              hover:bg-red-50 transition
            "
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-20 bg-surface border-b border-border px-4 py-3 flex justify-between items-center">
          <h1 className="font-semibold text-text-primary">DairyStream</h1>
          <Bell size={20} className="text-text-secondary" />
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>

      {/* ================= MOBILE BOTTOM NAV ================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-4 py-2 flex justify-between z-30 shadow-lg">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`
                flex flex-col items-center justify-center gap-1
                w-full py-2 rounded-lg transition
                ${active ? "text-brand" : "text-text-muted"}
              `}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerLayout;
