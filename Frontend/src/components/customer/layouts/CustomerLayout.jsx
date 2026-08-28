import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  Calendar,
  ShoppingBag,
  CreditCard,
  User,
  Bell,
  LogOut,
  MapPin,
  X
} from "lucide-react";
import {
  prefetchCustomerDashboard,
  prefetchCustomerDeliveries,
  prefetchCustomerPayments,
  prefetchCustomerProfile,
  prefetchCustomerSubscription,
} from "../../../api/customer/customer.api.js";

const shellFont = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const brandFont = { fontFamily: "'Lora', serif" };

const preloadDashboardPage = () => import("../../../pages/customer/DairyCustomerDashboard.jsx");
const preloadDeliveriesPage = () => import("../../../pages/customer/CustomerDeliveryHistory.jsx");
const preloadSubscriptionPage = () => import("../../../pages/customer/CustomerSubscription.jsx");
const preloadPaymentsPage = () => import("../../../pages/customer/CustomerPayments.jsx");
const preloadTrackAgentPage = () => import("../../../pages/customer/TrackAgent.jsx");
const preloadProfilePage = () => import("../../../pages/customer/CustomerProfile.jsx");

/* ================= NAV CONFIG (SINGLE SOURCE) ================= */
const NAV_ITEMS = [
  {
    icon: Home,
    label: "Home",
    mobileLabel: "Home",
    path: "/customer/dashboard",
    preload: preloadDashboardPage,
    prefetchData: [prefetchCustomerDashboard],
  },
  {
    icon: Calendar,
    label: "Deliveries",
    mobileLabel: "Deliveries",
    path: "/customer/dashboard/deliveries",
    preload: preloadDeliveriesPage,
    prefetchData: [prefetchCustomerDeliveries],
  },
  {
    icon: ShoppingBag,
    label: "My Subscription",
    mobileLabel: "Subscriptions",
    path: "/customer/dashboard/subscriptions",
    preload: preloadSubscriptionPage,
    prefetchData: [prefetchCustomerSubscription],
  },
  {
    icon: CreditCard,
    label: "Payments",
    mobileLabel: "Payments",
    path: "/customer/dashboard/payments",
    preload: preloadPaymentsPage,
    prefetchData: [prefetchCustomerPayments],
  },
  {
    icon: MapPin,
    label: "Track Agent",
    mobileLabel: "Track",
    path: "/customer/dashboard/track/agent",
    preload: preloadTrackAgentPage,
    prefetchData: [prefetchCustomerDeliveries],
  },
  {
    icon: User,
    label: "Profile",
    mobileLabel: "Profile",
    path: "/customer/dashboard/profile",
    preload: preloadProfilePage,
    prefetchData: [prefetchCustomerProfile, prefetchCustomerDashboard],
  },
];
const DASHBOARD_VISITED_FLAG = "customerDashboardVisited";

const CustomerLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;
  const warmRouteChunk = (item) => {
    item?.preload?.().catch(() => {
      // Ignore prefetch failures and allow navigation to request the chunk normally.
    });
  };
  const warmRouteData = (item) => {
    item?.prefetchData?.forEach((job) => {
      job?.();
    });
  };
  const warmRoute = (item) => {
    warmRouteChunk(item);
    warmRouteData(item);
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;
    const timerIds = [];

    const preloadSiblingRoutes = () => {
      NAV_ITEMS.forEach((item, index) => {
        if (item.path === location.pathname) return;

        const timerId = window.setTimeout(() => {
          if (!cancelled) {
            warmRoute(item);
          }
        }, index * 180);

        timerIds.push(timerId);
      });
    };

    let idleId = null;
    let timeoutId = null;

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(preloadSiblingRoutes, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(preloadSiblingRoutes, 1200);
    }

    return () => {
      cancelled = true;
      timerIds.forEach((timerId) => window.clearTimeout(timerId));

      if (idleId !== null) {
        window.cancelIdleCallback?.(idleId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.removeItem(DASHBOARD_VISITED_FLAG);
    window.location.href = "/";
  };

  return (
    <div className="ds-portal ds-customer-portal flex min-h-screen bg-[#FAFAF7] text-[#2C1A0E]" style={shellFont}>
      <aside className="fixed inset-y-0 hidden w-[260px] flex-col border-r border-[#F0EBE1] bg-[#FDFBF7] md:flex">
        <div className="border-b border-[#F0EBE1] px-5 py-6">
          <h1 className="text-[24px] font-semibold leading-tight text-[#B8641A]" style={brandFont}>
            DairyVision
          </h1>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#B0997D]">
            Customer Portal
          </p>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3.5 pb-4 pt-5">
          <div>
            <p className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B0997D]">
              MAIN
            </p>
            <div className="space-y-1">
              {NAV_ITEMS.slice(0, 4).map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    onMouseEnter={() => warmRoute(item)}
                    onFocus={() => warmRoute(item)}
                    className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
                      active
                        ? "bg-[#FAF5EF] font-semibold text-[#2C1A0E]"
                        : "font-medium text-[#524134] hover:bg-[#FAF6F0] hover:text-[#2C1A0E]"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[#C86D27]" />
                    )}
                    <Icon
                      className={`h-5 w-5 flex-shrink-0 transition-colors ${
                        active ? "text-[#C86D27]" : "text-[#7C6A5A] group-hover:text-[#2C1A0E]"
                      }`}
                      strokeWidth={active ? 2 : 1.75}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B0997D]">
              ACCOUNT
            </p>
            <div className="space-y-1">
              {NAV_ITEMS.slice(4).map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    onMouseEnter={() => warmRoute(item)}
                    onFocus={() => warmRoute(item)}
                    className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
                      active
                        ? "bg-[#FAF5EF] font-semibold text-[#2C1A0E]"
                        : "font-medium text-[#524134] hover:bg-[#FAF6F0] hover:text-[#2C1A0E]"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[#C86D27]" />
                    )}
                    <Icon
                      className={`h-5 w-5 flex-shrink-0 transition-colors ${
                        active ? "text-[#C86D27]" : "text-[#7C6A5A] group-hover:text-[#2C1A0E]"
                      }`}
                      strokeWidth={active ? 2 : 1.75}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="mt-auto border-t border-[#F0EBE1] p-3.5">
          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#524134] transition-all hover:bg-[#FAF5EF] hover:text-[#2C1A0E]"
          >
            <LogOut className="h-5 w-5 flex-shrink-0 text-[#7C6A5A] transition-colors group-hover:text-[#2C1A0E]" strokeWidth={1.75} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 pb-[calc(env(safe-area-inset-bottom)+88px)] md:ml-[260px] md:pb-0">
        <header className="sticky top-0 z-20 border-b border-[#F0EBE1] bg-[rgba(253,251,247,0.96)] px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg text-[#B8641A]" style={brandFont}>
                DairyVision
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B0997D]">
                Customer Portal
              </p>
            </div>
            <div className="flex items-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F0EBE1] bg-white text-[#7C6A5A]">
                <Bell size={18} strokeWidth={1.75} />
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1480px] px-2 pb-5 pt-2 sm:px-5 sm:pb-5 sm:pt-3 md:px-6 md:py-6 lg:px-8 lg:py-8 xl:max-w-none xl:px-[10px] xl:pb-10 xl:pt-0">
          {children}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#F0EBE1] bg-[rgba(253,251,247,0.98)] px-1.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-[0_-10px_30px_rgba(100,72,35,0.06)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-0.5">
          {NAV_ITEMS.filter((item) => item.path !== "/customer/dashboard/track/agent").map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => warmRoute(item)}
                onFocus={() => warmRoute(item)}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1.5 transition-all duration-150 active:scale-95 ${
                  active
                    ? "bg-[#FAF5EF] font-semibold text-[#2C1A0E]"
                    : "text-[#7C6A5A] hover:bg-[#FAF6F0] hover:text-[#2C1A0E]"
                }`}
              >
                <Icon className={`transition-transform duration-150 ${active ? "text-[#C86D27] scale-105" : "text-[#7C6A5A]"}`} size={18} strokeWidth={active ? 2 : 1.75} />
                <span className="text-center text-[8px] leading-tight sm:text-[9px]">
                  {item.mobileLabel || item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>


    </div>
  );
};

export default CustomerLayout;
