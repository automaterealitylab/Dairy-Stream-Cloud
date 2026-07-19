import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import {
  LayoutDashboard,
  Store,
  MapPin,
  CreditCard,
  Ticket,
  Megaphone,
  LifeBuoy,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  User
} from "lucide-react";

const SuperAdminSidebar = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { name: "Dashboard", path: "/super-admin/dashboard", icon: LayoutDashboard },
    { name: "Dairy Management", path: "/super-admin/dairies", icon: Store },
    { name: "Location Analytics", path: "/super-admin/location", icon: MapPin },
    { name: "Subscription Plans", path: "/super-admin/plans", icon: CreditCard },
    { name: "Coupon Codes", path: "/super-admin/coupons", icon: Ticket },
    { name: "Announcements", path: "/super-admin/announcements", icon: Megaphone },
    { name: "Support Desk", path: "/super-admin/support", icon: LifeBuoy },
    { name: "Platform Monitor", path: "/super-admin/monitoring", icon: Activity },
    { name: "System Settings", path: "/super-admin/settings", icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate("/super-admin/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex justify-between items-center px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-white text-lg">DS</div>
          <span className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">DairyStream HQ</span>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-slate-400 hover:text-white">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900/70 border-r border-slate-800/80 backdrop-blur-md z-40 transform transition-transform duration-300 md:translate-x-0 md:static md:flex md:flex-col ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-850 mt-16 md:mt-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-cyan-500/20">DS</div>
          <div>
            <h1 className="font-extrabold text-lg leading-tight bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">DairyStream</h1>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold font-mono">Super Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 group font-medium ${
                  isActive
                    ? "bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border-l-4 border-cyan-500 text-cyan-400 shadow-md shadow-cyan-500/5"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-850/50 border-l-4 border-transparent"
                }`}
              >
                <Icon size={19} className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-slate-200"}`} />
                <span className="text-[14px]">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-850 bg-slate-900/30">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-850/30 mb-3 border border-slate-800/40">
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700">
              <User size={18} />
            </div>
            <div className="overflow-hidden">
              <h4 className="font-semibold text-xs text-slate-200 truncate">{user?.name || "Super Admin"}</h4>
              <p className="text-[10px] text-slate-500 truncate">{user?.email || "owner@dairystream.com"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-500/20 text-rose-400 hover:text-white hover:bg-rose-500/10 font-medium text-xs transition-all duration-200 cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pt-16 md:pt-0">
        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default SuperAdminSidebar;
