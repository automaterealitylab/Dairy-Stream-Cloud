import { NavLink, useNavigate } from "react-router-dom";

const menuItems = [
  {
    label: "Dashboard",
    to: "/admin/AdminDashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      </svg>
    ),
  },
  {
    label: "Customers",
    to: "/admin/customers",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
  },
  {
    label: "Agents",
    to: "/admin/agents",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
      </svg>
    ),
  },
  {
    label: "Deliveries",
    to: "/admin/deliveries",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M20 8h-3V4H1v13h2a3 3 0 006 0h6a3 3 0 006 0h2v-5l-3-4z" />
      </svg>
    ),
  },
  {
    label: "Products",
    to: "/admin/products",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M21 16V8a1 1 0 00-.5-.87l-8-4.5a1 1 0 00-1 0l-8 4.5A1 1 0 003 8v8a1 1 0 00.5.87l8 4.5a1 1 0 001 0l8-4.5A1 1 0 0021 16zm-9 3.85L5 16V9.15l7 3.94v6.76zm1-8.49L6.04 7.5 12 4.15 17.96 7.5 13 11.36zM19 16l-6 3.85v-6.76l6-3.94V16z" />
      </svg>
    ),
  },
  {
    label: "Payments",
    to: "/admin/payments",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M2 6h20v12H2V6zm18 4H4v2h16v-2z" />
      </svg>
    ),
  },
];

export default function AdminSidebar({ open, onClose }) {
  const navigate = useNavigate();

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
          bg-white border-r
          flex flex-col
          transform transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Brand */}
        <div className="px-6 py-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            DairyStream
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Admin Panel</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `
                relative group flex items-center gap-4
                px-4 py-2.5 rounded-lg text-sm font-medium
                transition-all
                ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }
              `
              }
            >
              {/* Active indicator (Stripe-style) */}
              <span
                className={`
                  absolute left-0 top-1/2 -translate-y-1/2
                  h-6 w-1 rounded-full
                  bg-blue-600
                  transition-opacity
                  opacity-0 group-[.active]:opacity-100
                `}
              />

              {/* Icon */}
              <span className="text-gray-400 group-hover:text-gray-600 group-[.active]:text-blue-600">
                {item.icon}
              </span>

              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-6 py-4 border-t">
          <button
            onClick={() => {
              localStorage.removeItem("adminToken");
              localStorage.removeItem("adminUser");
              navigate("/", { replace: true });
            }}
            className="
              w-full flex items-center justify-center gap-2
              bg-red-500 hover:bg-red-600
              text-white text-sm font-semibold
              py-2.5 rounded-lg
              transition
              focus:outline-none focus:ring-2 focus:ring-red-300
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
