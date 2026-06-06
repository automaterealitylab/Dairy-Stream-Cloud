import { BarChart3, Home, List, UserCircle } from "lucide-react";
import { NavLink } from "react-router-dom";
import { adminShellFont } from "../adminTheme";

const bottomItems = [
  { label: "Home", to: "/admin/AdminDashboard", icon: Home },
  { label: "Orders", to: "/admin/deliveries", icon: List },
  { label: "Inventory", to: "/admin/products", icon: BarChart3 },
  { label: "Account", to: "/admin/profile", icon: UserCircle },
];

export default function AdminMobileBottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-1 border-t border-[#EFE7DE] bg-[#FFF7F2]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-12px_35px_rgba(95,61,32,0.08)] backdrop-blur lg:hidden"
      style={adminShellFont}
      aria-label="Admin mobile navigation"
    >
      {bottomItems.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          className={({ isActive }) =>
            `flex h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[10px] font-medium tracking-[0.18em] transition ${
              isActive
                ? "bg-[#FFD45C] text-[#3B210F]"
                : "text-[#1F1711] hover:bg-[#FFF0D4]"
            }`
          }
        >
          <item.icon size={17} strokeWidth={1.9} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
