import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Sun, Moon, X } from "lucide-react";

import { fetchAdminDashboard, getCachedAdminDashboard } from "../../../api/admin.api.js";
import { canAccessAdminFeature, normalizeAdminPlan } from "../../../utils/adminPlanAccess.js";
import { adminHeadingFont, adminShellFont, useTheme } from "../adminTheme";

const menuItems = [
  {
    feature: "dashboard",
    label: "Dashboard",
    to: "/admin/AdminDashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      </svg>
    ),
  },
  {
    feature: "customers",
    label: "Customers",
    to: "/admin/customers",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
  },
  {
    feature: "agents",
    label: "Agents",
    to: "/admin/agents",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
      </svg>
    ),
  },
  {
    feature: "deliveries",
    label: "Deliveries",
    to: "/admin/deliveries",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M20 8h-3V4H1v13h2a3 3 0 006 0h6a3 3 0 006 0h2v-5l-3-4z" />
      </svg>
    ),
  },
  {
    feature: "products",
    label: "Products",
    to: "/admin/products",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M21 16V8a1 1 0 00-.5-.87l-8-4.5a1 1 0 00-1 0l-8 4.5A1 1 0 003 8v8a1 1 0 00.5.87l8 4.5a1 1 0 001 0l8-4.5A1 1 0 0021 16zm-9 3.85L5 16V9.15l7 3.94v6.76zm1-8.49L6.04 7.5 12 4.15 17.96 7.5 13 11.36zM19 16l-6 3.85v-6.76l6-3.94V16z" />
      </svg>
    ),
  },
  {
    feature: "payments",
    label: "Payments",
    to: "/admin/payments",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M2 6h20v12H2V6zm18 4H4v2h16v-2z" />
      </svg>
    ),
  },
  {
    feature: "procurement",
    label: "Purchases",
    to: "/admin/procurement",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M12 2l4 4-1.41 1.41L13 5.83V14h-2V5.83L9.41 7.41 8 6l4-4zm-7 9h2v8h12v-8h2v10H5V11z" />
      </svg>
    ),
  },
  {
    feature: "suppliers",
    label: "Suppliers",
    to: "/admin/suppliers",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M16 6a3 3 0 110 6 3 3 0 010-6zM8 7a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm8 7c2.67 0 8 1.34 8 4v2h-8.26A6.97 6.97 0 0016 18c0-1.46-.48-2.8-1.29-3.88.45-.07.87-.12 1.29-.12zM8 14c3.33 0 8 1.67 8 5v1H0v-1c0-3.33 4.67-5 8-5z" />
      </svg>
    ),
  },
  {
    feature: "performance",
    label: "Performance",
    to: "/admin/performance",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M3 17h2v2H3v-2zm4-4h2v6H7v-6zm4-3h2v9h-2v-9zm4-5h2v14h-2V5zm4 8h2v6h-2v-6z" />
      </svg>
    ),
  },
  {
    feature: "profile",
    label: "Profile",
    to: "/admin/profile",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z" />
      </svg>
    ),
  },
];

export default function AdminSidebar({ open, onClose }) {
  const navigate = useNavigate();
  const { theme, isDark, toggleTheme } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState(() =>
    normalizeAdminPlan(getCachedAdminDashboard()?.selectedPlan)
  );


  useEffect(() => {
    let isMounted = true;

    const syncPlan = async () => {
      try {
        const cached = getCachedAdminDashboard();
        if (cached?.selectedPlan) {
          if (isMounted) setSelectedPlan(normalizeAdminPlan(cached.selectedPlan));
          return;
        }

        const dashboard = await fetchAdminDashboard();
        if (isMounted) {
          setSelectedPlan(normalizeAdminPlan(dashboard?.selectedPlan));
        }
      } catch {
        if (isMounted) setSelectedPlan("Free");
      }
    };

    const syncFromCache = () => {
      setSelectedPlan(normalizeAdminPlan(getCachedAdminDashboard()?.selectedPlan));
    };

    syncPlan();
    window.addEventListener("admin-plan-updated", syncFromCache);

    return () => {
      isMounted = false;
      window.removeEventListener("admin-plan-updated", syncFromCache);
    };
  }, []);

  const effectivePlan = normalizeAdminPlan(
    getCachedAdminDashboard()?.selectedPlan || selectedPlan
  );
  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => canAccessAdminFeature(effectivePlan, item.feature)),
    [effectivePlan]
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64
          border-r border-[#EDE8DF] bg-white/95 backdrop-blur
          flex h-screen min-h-0 flex-col
          transform transition-transform duration-300 ease-out
          dark:border-[#1E293B] dark:bg-[#0B0F19]
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
        style={adminShellFont}
      >
        {/* Brand */}
        <div className="relative border-b border-[#F2EDE4] px-5 py-4 dark:border-[#1E293B]">
          <div>
            <h2 className="text-[26px] text-[#B8641A] dark:text-[#00C896] font-black" style={adminHeadingFont}>
              DairyStream
            </h2>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882] dark:text-slate-500">
              Admin Portal
            </p>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="lg:hidden absolute right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 text-[#8B7355] dark:bg-white/10 dark:hover:bg-white/15 dark:text-slate-400 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-5 overflow-y-auto">
          {visibleMenuItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `
                relative flex items-center justify-between
                px-3 py-2.5 rounded-xl text-sm font-semibold
                transition-all border
                ${
                  isActive
                    ? "bg-[#FDE9C9] text-[#B8641A] border-[#E5C79D] dark:bg-transparent dark:text-[#00C896] dark:border-[#00C896]"
                    : "text-[#8B7355] border-transparent hover:bg-[#FDF6EC] hover:text-[#5C3D1E] dark:text-slate-400 dark:hover:bg-[#121829] dark:hover:text-white"
                }
              `
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <span
                      className={`transition-colors ${
                        isActive
                          ? "text-[#B8641A] dark:text-[#00C896]"
                          : "text-[#B89970] dark:text-slate-400 group-hover:text-[#8B7355] dark:group-hover:text-white"
                      }`}
                    >
                      {item.icon}
                    </span>

                    <span className="truncate">{item.label}</span>
                  </div>

                  {/* Active indicators */}
                  {/* Left stripe in light mode */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-[#B8641A] dark:hidden" />
                  )}

                  {/* Right green dot in dark mode */}
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00C896] hidden dark:block" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Theme Toggle Button */}
        <div className="px-3 py-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="
              w-full flex items-center justify-between
              rounded-[12px] border-[1px] border-[#EDE8DF] bg-[#ffffff] py-2 px-4
              text-xs font-bold text-[#8B7355] dark:text-slate-400
              dark:border-[#1E293B] dark:bg-[#121829]
              hover:border-[#F2EDE4] hover:bg-[#FDF6EC] dark:hover:bg-[#1C243A]
              transition focus:outline-none shadow-sm
            "
          >
            <span className="flex items-center gap-2">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
              <span>{isDark ? "Light Theme" : "Dark Theme"}</span>
            </span>
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
              {theme}
            </span>
          </button>
        </div>

        {/* Logout */}
        <div className="shrink-0 border-t border-[#F2EDE4] px-5 py-4 dark:border-[#1E293B]">
          <button
            onClick={() => {
              localStorage.removeItem("adminToken");
              localStorage.removeItem("adminUser");
              navigate("/", { replace: true });
            }}
            className="
              w-full flex items-center justify-center gap-2
              rounded-[12px] border-[1px] border-[#EDE8DF] bg-[#ffffff] py-2.5
              text-sm font-semibold text-[#B89970]
              hover:border-[#F5C6C4] hover:bg-[#FDF6EC] hover:text-[#C0392B]
              transition
              focus:outline-none focus:ring-2 focus:ring-[#E8C6A2]
              dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400
              dark:hover:bg-red-500/20 dark:focus:ring-red-500/30
            "
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M16 13v-2H7V8l-5 4 5 4v-3zM20 3h-8v2h8v14h-8v2h8a2 2 0 002-2V5a2 2 0 00-2-2z" />
            </svg>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
