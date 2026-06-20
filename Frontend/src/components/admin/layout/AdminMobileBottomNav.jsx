import { LayoutGrid, ClipboardList, Truck, Users, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { adminShellFont } from "../adminTheme";

const bottomItems = [
  { label: "Dashboard", to: "/admin/AdminDashboard", icon: LayoutGrid },
  { label: "Orders", to: "/admin/deliveries", icon: ClipboardList },
  { label: "Agents", to: "/admin/agents", icon: Truck },
  { label: "Customers", to: "/admin/customers", icon: Users },
  { label: "Settings", to: "/admin/profile", icon: Settings },
];

export default function AdminMobileBottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-1 border-t border-[#EFE7DE] bg-[#FFF7F2]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-12px_35px_rgba(95,61,32,0.08)] backdrop-blur dark:border-[#1E293B] dark:bg-[#0B0F19]/95 dark:shadow-[0_-12px_35px_rgba(0,0,0,0.4)] lg:hidden"
      style={adminShellFont}
      aria-label="Admin mobile navigation"
    >
      {bottomItems.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          className={({ isActive }) =>
            `flex h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[10px] font-black tracking-wider transition ${
              isActive
                ? "bg-[#FFD45C] text-[#3B210F] dark:bg-transparent dark:text-[#00C896]"
                : "text-[#8B7355] hover:bg-[#FFF0D4] dark:text-slate-400 dark:hover:bg-slate-800/40"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
