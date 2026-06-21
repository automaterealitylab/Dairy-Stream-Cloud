import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  Sun,
  Truck,
  Upload,
  UserRound,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";

import { fetchAdminDashboard, getCachedAdminDashboard } from "../../../api/admin.api.js";
import { canAccessAdminFeature, normalizeAdminPlan } from "../../../utils/adminPlanAccess.js";
import { adminHeadingFont, adminShellFont, useTheme } from "../adminTheme";

const menuItems = [
  {
    feature: "dashboard",
    label: "Dashboard",
    to: "/admin/AdminDashboard",
    icon: LayoutDashboard,
  },
  {
    feature: "customers",
    label: "Customers",
    to: "/admin/customers",
    icon: UsersRound,
  },
  {
    feature: "agents",
    label: "Agents",
    to: "/admin/agents",
    icon: UserRoundCheck,
  },
  {
    feature: "deliveries",
    label: "Deliveries",
    to: "/admin/deliveries",
    icon: Truck,
  },
  {
    feature: "products",
    label: "Products",
    to: "/admin/products",
    icon: Package,
  },
  {
    feature: "payments",
    label: "Payments",
    to: "/admin/payments",
    icon: CreditCard,
  },
  {
    feature: "procurement",
    label: "Purchases",
    to: "/admin/procurement",
    icon: Upload,
  },
  {
    feature: "suppliers",
    label: "Suppliers",
    to: "/admin/suppliers",
    icon: Package,
  },
  {
    feature: "performance",
    label: "Performance",
    to: "/admin/performance",
    icon: BarChart3,
  },
  {
    feature: "profile",
    label: "Profile",
    to: "/admin/profile",
    icon: UserRound,
  },
];

export default function AdminSidebar({ open, onClose }) {
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
          fixed inset-y-0 left-0 z-50 w-64 xl:w-80
          border-r border-[#EDE8DF] bg-white/95 backdrop-blur
          flex h-screen min-h-0 flex-col
          transform transition-transform duration-300 ease-out
          dark:border-[#20283A] dark:bg-[#0F1424]
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
        style={adminShellFont}
      >
        {/* Brand */}
        <div className="relative border-b border-[#F2EDE4] px-6 py-7 dark:border-[#222B3D] xl:px-[30px] xl:py-[34px]">
          <div>
            <h2 className="text-[26px] leading-none text-[#B8641A] dark:text-[#00C896] xl:text-[32px]" style={adminHeadingFont}>
              DairyVision
            </h2>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882] dark:text-slate-500 xl:mt-2 xl:text-[13px]">
              Admin Portal
            </p>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="lg:hidden absolute right-0 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 text-[#8B7355] dark:bg-white/10 dark:hover:bg-white/15 dark:text-slate-400 transition"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto pb-5 pt-2 xl:pt-3">
          <p className="px-6 pb-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#C4A882] xl:px-[30px] xl:pb-4 xl:text-[12px]">
            Menu
          </p>
          {visibleMenuItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `
                relative group flex items-center justify-between
                px-6 py-3 text-sm no-underline xl:min-h-[56px] xl:gap-5 xl:px-[30px] xl:text-[17px]
                transition-colors
                ${
                  isActive
                    ? "bg-[#FDE9C9] font-bold text-[#B8641A] dark:bg-[#083A36] dark:text-[#00E0A4]"
                    : "text-[#8B7355] hover:bg-[#FDF6EC] hover:text-[#5C3D1E] dark:text-[#CBD5E1] dark:hover:bg-white/5 dark:hover:text-white"
                }
              `
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-4">
                    <item.icon
                      size={17}
                      strokeWidth={1.8}
                      className={`shrink-0 transition-colors ${
                        isActive
                          ? "text-[#B8641A] dark:text-[#00E0A4]"
                          : "text-[#B89970] dark:text-[#9AA7BD] group-hover:text-[#8B7355] dark:group-hover:text-white"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {isActive && (
                    <>
                      <span className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-[#B8641A] dark:bg-[#00E0A4]" />
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-[#B8641A] dark:bg-[#00E0A4]"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Theme Toggle Button */}
        <div className="shrink-0 px-6 pb-3 xl:px-[30px]">
          <button
            type="button"
            onClick={toggleTheme}
            className="
              flex w-full items-center justify-between rounded-xl px-3 py-2.5
              text-xs font-semibold transition
              text-[#8B7355] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]
              dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white
              focus:outline-none focus:ring-2 focus:ring-[#00C896]/35
            "
          >
            <span className="flex items-center gap-3">
              {isDark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
              <span>{isDark ? "Light Theme" : "Dark Theme"}</span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
              {theme}
            </span>
          </button>
        </div>

        {/* Logout */}
        <div className="shrink-0 border-t border-[#F2EDE4] px-6 py-5 dark:border-[#222B3D] xl:px-[30px] xl:py-8">
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = "/";
            }}
            className="
              w-full flex items-center gap-3
              rounded-xl border px-3 py-3
              text-sm font-semibold
              border-[#EDE8DF] bg-white text-[#B89970]
              hover:border-[#F5C6C4] hover:bg-[#FDF6EC] hover:text-[#C0392B]
              transition
              focus:outline-none focus:ring-2 focus:ring-[#E8C6A2]
              dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400
              dark:hover:bg-red-500/20 dark:focus:ring-red-500/30
            "
          >
            <LogOut size={16} strokeWidth={1.8} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
