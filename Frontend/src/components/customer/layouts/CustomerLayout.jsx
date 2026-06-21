import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Home,
  Calendar,
  ShoppingBag,
  CreditCard,
  User,
  Bell,
  LogOut,
  MapPin,
  QrCode,
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
    mobileLabel: "Plans",
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
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    const handleOpenQr = () => setShowQrModal(true);
    window.addEventListener("open-customer-qr-modal", handleOpenQr);
    return () => window.removeEventListener("open-customer-qr-modal", handleOpenQr);
  }, []);

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
      <aside className="fixed inset-y-0 hidden w-64 flex-col border-r border-[#EDE8DF] bg-white/95 backdrop-blur md:flex xl:w-80">
        <div className="border-b border-[#F2EDE4] px-6 py-7 xl:px-[30px] xl:py-[34px]">
          <h1 className="text-[26px] text-[#B8641A] xl:text-[32px]" style={brandFont}>
            DairyStream
          </h1>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882] xl:mt-2 xl:text-[13px]">
            Customer Portal
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto pb-5 pt-2 xl:pt-3">
          <p className="px-6 pb-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#C4A882] xl:px-[30px] xl:pb-7 xl:text-[12px]">
            Menu
          </p>
          {NAV_ITEMS.slice(0, 4).map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => warmRoute(item)}
                onFocus={() => warmRoute(item)}
                className={`relative flex w-full items-center gap-3 px-6 py-3 text-left text-sm transition xl:min-h-[65px] xl:gap-5 xl:px-[30px] xl:text-[17px] ${active
                    ? "bg-[#FDE9C9] font-bold text-[#B8641A]"
                    : "text-[#8B7355] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
                  }`}
              >
                {active && (
                  <span className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-[#B8641A]" />
                )}
                <Icon className="h-[18px] w-[18px] xl:h-[21px] xl:w-[21px]" strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </button>
            );
          })}

          <p className="px-6 pb-2 pt-6 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#C4A882] xl:px-[30px] xl:pb-7 xl:pt-8 xl:text-[12px]">
            Support
          </p>
          {NAV_ITEMS.slice(4).map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => warmRoute(item)}
                onFocus={() => warmRoute(item)}
                className={`relative flex w-full items-center gap-3 px-6 py-3 text-left text-sm transition xl:min-h-[65px] xl:gap-5 xl:px-[30px] xl:text-[17px] ${active
                    ? "bg-[#FDE9C9] font-bold text-[#B8641A]"
                    : "text-[#8B7355] hover:bg-[#FDF6EC] hover:text-[#5C3D1E]"
                  }`}
              >
                {active && (
                  <span className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-[#B8641A]" />
                )}
                <Icon className="h-[18px] w-[18px] xl:h-[21px] xl:w-[21px]" strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[#F2EDE4] px-6 py-5 xl:px-[30px] xl:py-12">
          <button
            onClick={() => setShowQrModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#EFD7B3] bg-[#FFF4E2] px-4 py-2.5 text-sm font-semibold text-[#B8641A] transition hover:bg-[#FCE8CB] xl:hidden"
          >
            <QrCode size={16} />
            My QR Code
          </button>

          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#EDE8DF] px-4 py-2.5 text-sm font-semibold text-[#B89970] transition hover:border-[#F5C6C4] hover:bg-[#FDF6EC] hover:text-[#C0392B] xl:mt-0 xl:h-[52px] xl:text-[16px]"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 pb-[calc(env(safe-area-inset-bottom)+88px)] md:ml-64 md:pb-0 xl:ml-80">
        <header className="sticky top-0 z-20 border-b border-[#EDE8DF] bg-[rgba(255,253,248,0.96)] px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg text-[#B8641A]" style={brandFont}>
                DairyStream
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C4A882]">
                Customer Portal
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQrModal(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EDE8DF] bg-white text-[#8B7355] transition hover:border-[#B8641A] hover:bg-[#FFF4E2] hover:text-[#B8641A]"
                title="My QR Code"
              >
                <QrCode size={18} />
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EDE8DF] bg-white text-[#8B7355]">
                <Bell size={18} />
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#EDE8DF] bg-white px-3 text-xs font-semibold text-[#8B7355] transition hover:border-[#F5C6C4] hover:bg-[#FDF6EC] hover:text-[#C0392B]"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1480px] px-2 pb-5 pt-2 sm:px-5 sm:pb-5 sm:pt-3 md:px-6 md:py-6 lg:px-8 lg:py-8 xl:max-w-none xl:px-[10px] xl:pb-10 xl:pt-0">
          {children}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#EDE8DF] bg-[rgba(255,253,248,0.98)] px-1.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-[0_-10px_30px_rgba(100,72,35,0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-6 gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => warmRoute(item)}
                onFocus={() => warmRoute(item)}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[12px] px-0.5 py-2 transition ${active
                    ? "bg-[#FDE9C9] text-[#B8641A]"
                    : "text-[#B89970] hover:bg-[#FDF6EC] hover:text-[#8B7355]"
                  }`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span className="text-center text-[8px] font-semibold leading-tight sm:text-[9px]">
                  {item.mobileLabel || item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MY QR CODE MODAL */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C2416]/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[28px] border border-[#E7DAC6] bg-[#FFFDF7] p-5 shadow-[0_24px_60px_rgba(44,26,14,0.18)] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B8641A]">Delivery Verification</p>
                <h3 className="mt-1 text-xl font-semibold text-[#2C1A0E]" style={brandFont}>My QR Code</h3>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="rounded-full border border-[#EDE8DF] bg-white p-2 text-[#8B7355] transition hover:border-[#D4B896] hover:text-[#5C3D1E]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-5 text-center">
              <div className="mx-auto inline-flex rounded-[24px] border border-[#EDE8DF] bg-white p-4.5 shadow-sm">
                <QRCodeSVG
                  value={(() => {
                    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
                    return JSON.stringify({
                      customerId: storedUser?.id || storedUser?.customerId || "GUEST",
                      name: storedUser?.name || storedUser?.customer_name || "Customer",
                      dairy: storedUser?.dairy || storedUser?.dairyName || localStorage.getItem("guest_dairy_name") || "Not linked",
                      address: storedUser?.address || "Address not set"
                    });
                  })()}
                  size={200}
                  includeMargin
                />
              </div>

              <p className="mt-4 text-xs font-semibold text-[#8B7355]">
                Show this code to your delivery agent to verify drops
              </p>

              <div className="mt-6 space-y-2.5 rounded-[20px] border border-[#F2EDE4] bg-[#FBF7F0] p-4 text-left">
                <div className="flex items-center justify-between border-b border-[#EDE8DF]/60 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C4A882]">Name</span>
                  <span className="text-sm font-bold text-[#2C1A0E]">
                    {(() => {
                      const u = JSON.parse(localStorage.getItem("user") || "{}");
                      return u?.name || u?.customer_name || "Customer";
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-[#EDE8DF]/60 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C4A882]">Dairy</span>
                  <span className="text-sm font-bold text-[#B8641A]">
                    {(() => {
                      const u = JSON.parse(localStorage.getItem("user") || "{}");
                      return u?.dairy || u?.dairyName || localStorage.getItem("guest_dairy_name") || "Not linked";
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C4A882]">ID / Room</span>
                  <span className="text-sm font-bold text-[#2C1A0E]">
                    {(() => {
                      const u = JSON.parse(localStorage.getItem("user") || "{}");
                      const room = [u?.wing, u?.room_no || u?.roomNo].filter(Boolean).join(" - ");
                      return room ? `#${u?.id || ""} (${room})` : `#${u?.id || "GUEST"}`;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full rounded-[16px] bg-[#2C2416] py-3 text-sm font-bold text-white transition hover:bg-[#4A3820]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerLayout;
