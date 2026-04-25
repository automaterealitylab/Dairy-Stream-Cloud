import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import TrackAgentMap from "../../components/TrackAgentMap.jsx";
import {
  fetchCustomerDeliveries,
  getCachedCustomerDeliveries,
} from "../../api/customer/customer.api.js";
import {
  ArrowLeft,
  Phone,
  User,
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Truck,
} from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const steps = [
  { label: "Order Placed", mobileLabel: "Placed", status: "PENDING" },
  { label: "Out for Delivery", mobileLabel: "On Way", status: "OUT_FOR_DELIVERY" },
  { label: "Delivered", mobileLabel: "Done", status: "DELIVERED" },
];

const normalizeTrackingStatus = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "IN_TRANSIT" || normalized === "OUT_FOR_DELIVERY") {
    return "OUT_FOR_DELIVERY";
  }
  if (normalized === "COMPLETED" || normalized === "DELIVERED") {
    return "DELIVERED";
  }
  return normalized || "PENDING";
};

const getSafeStepIndex = (status) => {
  const index = steps.findIndex((step) => step.status === normalizeTrackingStatus(status));
  return index >= 0 ? index : 0;
};

const getDeliveryTypeLabel = (delivery = {}) => {
  const normalizedType = String(delivery?.deliveryType || "").toUpperCase();
  if (normalizedType === "ONE_TIME") return "One-time";
  if (normalizedType === "SUBSCRIPTION") return "Subscription";
  return delivery?.isOneTimeOrder ? "One-time" : "Subscription";
};

const getStatusMeta = (status) => {
  const normalized = normalizeTrackingStatus(status);
  if (normalized === "DELIVERED") {
    return {
      badge: "bg-[#EEF5E7] text-[#4A7C2F]",
      label: "Delivered",
    };
  }
  if (normalized === "OUT_FOR_DELIVERY") {
    return {
      badge: "bg-[#FFF4E2] text-[#B8641A]",
      label: "Out for delivery",
    };
  }
  return {
    badge: "bg-[#FBF7F0] text-[#8B7355]",
    label: "Preparing delivery",
  };
};

const resolveTrackedDelivery = ({ response, targetOrderId }) => {
  const todayDelivery = response?.todayDelivery || null;
  const deliveries = Array.isArray(response?.deliveries) ? response.deliveries : [];

  if (targetOrderId) {
    const normalizedTarget = String(targetOrderId);

    if (String(todayDelivery?.deliveryId || todayDelivery?.id || "") === normalizedTarget) {
      return todayDelivery;
    }

    return (
      deliveries.find((item) => String(item?.id || item?.deliveryId || "") === normalizedTarget) || null
    );
  }

  return todayDelivery;
};

const TrackAgent = () => {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialOrderId = String(
    orderId || location.state?.delivery?.deliveryId || location.state?.delivery?.id || ""
  ).trim();
  const cachedResponse = getCachedCustomerDeliveries() || null;
  const initialDelivery =
    resolveTrackedDelivery({
      response: cachedResponse,
      targetOrderId: initialOrderId || null,
    }) ||
    location.state?.delivery ||
    null;
  const [delivery, setDelivery] = useState(initialDelivery);
  const [loading, setLoading] = useState(() => !initialDelivery);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadTrackingData = async ({ force = false, showSpinner = force || !initialDelivery } = {}) => {
      try {
        if (showSpinner) {
          setLoading(true);
        }
        setError("");

        const response = await fetchCustomerDeliveries({ force });
        const resolvedDelivery = resolveTrackedDelivery({
          response,
          targetOrderId: initialOrderId || null,
        });

        if (!cancelled) {
          setDelivery(resolvedDelivery);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Unable to load tracking data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const needsRefresh = !initialDelivery;

    if (needsRefresh) {
      loadTrackingData();
    } else {
      setLoading(false);
      loadTrackingData({ force: true, showSpinner: false });
    }

    const intervalId = setInterval(() => {
      loadTrackingData({ force: true, showSpinner: false });
    }, 15000);

    const handleFocus = () => {
      loadTrackingData({ force: true, showSpinner: false });
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [initialDelivery, initialOrderId, location.state]);

  const agent = delivery?.agent || null;
  const normalizedStatus = normalizeTrackingStatus(delivery?.status);
  const currentStepIndex = getSafeStepIndex(normalizedStatus);
  const resolvedOrderId = String(delivery?.deliveryId || delivery?.id || "").trim();
  const canTrackLive = normalizedStatus === "OUT_FOR_DELIVERY";
  const hasTrackingContext = Boolean(resolvedOrderId);
  const statusMeta = getStatusMeta(normalizedStatus);

  if (loading) {
    return (
      <CustomerLayout>
        <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-2 py-6 sm:px-4">
          <div className="w-full max-w-xl rounded-[28px] border border-[#EDE8DF] bg-[#FFFDF7] px-6 py-12 text-center shadow-sm sm:px-8">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF4E2] text-[#B8641A]">
              <Loader2 size={24} className="animate-spin" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#2C1A0E]">Loading delivery tracking</h3>
            <p className="mt-2 text-sm text-[#8B7355]">
              Bringing in the latest route, status, and partner details.
            </p>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  if (!hasTrackingContext) {
    return (
      <CustomerLayout>
        <div className="rounded-[28px] border border-[#EDE8DF] bg-[#FFFDF7] px-6 py-12 text-center shadow-sm">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#FBF7F0] text-[#A88763]">
            <Truck size={24} />
          </div>
          <h3 className="mt-4 text-lg font-bold text-[#2C1A0E]">No live tracking available</h3>
          <p className="mt-2 text-sm text-[#8B7355]">
            This delivery does not have an active tracking session right now.
          </p>
          {error ? <p className="mt-2 text-sm text-[#C0392B]">{error}</p> : null}
          <button
            onClick={() => navigate(-1)}
            className="mt-5 rounded-full border border-[#EDE8DF] bg-white px-5 py-2.5 text-sm font-bold text-[#8B7355] transition hover:bg-[#FBF7F0]"
          >
            Back to Dashboard
          </button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div
        className="space-y-5 pb-8 sm:space-y-6 lg:space-y-8"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <button
              onClick={() => navigate(-1)}
              className="rounded-full border border-[#EDE8DF] bg-white p-2.5 transition-colors hover:bg-[#FBF7F0]"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                Delivery Tracking
              </p>
              <h2
                className="mt-1 text-[24px] font-semibold text-[#2C1A0E] sm:text-[32px]"
                style={headingFont}
              >
                Track <span className="text-[#B8641A]">Your Order</span>
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-[#8B7355]">
                Follow delivery progress, see the current map view, and contact the assigned
                partner from one place.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF7] px-4 py-6 shadow-sm sm:rounded-[32px] sm:p-9">
          <div className="mb-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
              Delivery Progress
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#2C1A0E]" style={headingFont}>
              Order Journey
            </h3>
          </div>
          <div className="px-2 sm:px-6">
            <div className="relative">
              <div className="absolute left-[16.666%] right-[16.666%] top-1/2 z-0 h-1 -translate-y-1/2 bg-[#F2EDE4]"></div>
              <div
                className="absolute left-[16.666%] top-1/2 z-0 h-1 -translate-y-1/2 bg-[#B8641A] transition-all duration-700"
                style={{ width: `${(currentStepIndex / (steps.length - 1)) * 66.666}%` }}
              ></div>

              <div className="relative z-10 grid grid-cols-3 items-center">
                {steps.map((step, index) => {
                  const isActive = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;

                  return (
                    <div key={step.label} className="flex min-w-0 justify-center">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 sm:h-10 sm:w-10 ${
                          isCurrent
                            ? "bg-[#B8641A] ring-4 ring-[#FDE9C9] text-white"
                            : isActive
                            ? "bg-[#B8641A] text-white"
                            : "bg-white border-2 border-[#EDE8DF] text-[#C4A882]"
                        }`}
                      >
                        {isActive ? <CheckCircle2 size={20} /> : <div className="h-2 w-2 rounded-full bg-[#C4A882]"></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {steps.map((step, index) => {
                const isActive = index <= currentStepIndex;

                return (
                  <span
                    key={step.label}
                    className={`mx-auto min-w-0 max-w-[78px] text-center text-[10px] font-black uppercase leading-snug tracking-normal sm:max-w-[140px] sm:text-xs ${
                      isActive ? "text-[#B8641A]" : "text-[#A88763]"
                    }`}
                  >
                    <span className="sm:hidden">{step.mobileLabel || step.label}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5 rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF7] p-5 shadow-sm sm:rounded-[32px] sm:p-8">
            <div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                  Delivery Partner
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[#2C1A0E]" style={headingFont}>
                  Assigned Agent
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-[22px] border border-[#F2EDE4] bg-[#FBF7F0] p-4">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white text-[#A88763] shadow-sm">
                  <User size={30} />
                </div>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white bg-[#4A7C2F] animate-pulse"></div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="break-words text-lg font-bold text-[#2C1A0E]">
                    {agent?.name || "Delivery Partner"}
                  </h4>
                  <ShieldCheck size={18} className="text-[#B8641A]" />
                </div>
                <p className="mt-1 text-sm text-[#8B7355]">
                  {agent?.route && agent.route !== "-"
                    ? `Route: ${agent.route}`
                    : "Assigned route will appear here."}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-[22px] border border-[#F2EDE4] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#8B7355]">Phone</span>
                <span className="text-sm font-bold text-[#2C1A0E]">{agent?.phone || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#8B7355]">Route</span>
                <span className="text-sm font-bold text-[#2C1A0E]">{agent?.route || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#8B7355]">Status</span>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusMeta.badge}`}>
                  {statusMeta.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href={agent?.phone ? `tel:${agent.phone}` : "#"}
                onClick={(event) => {
                  if (!agent?.phone) {
                    event.preventDefault();
                  }
                }}
                className={`flex min-h-[52px] items-center justify-center gap-3 rounded-[16px] px-4 py-3.5 text-sm font-bold transition-all sm:rounded-[18px] sm:py-4 ${
                  agent?.phone
                    ? "bg-[#4A7C2F] text-white shadow-lg shadow-[#DDE8D1] hover:bg-[#3F6B27]"
                    : "cursor-not-allowed bg-[#EDE8DF] text-[#8B7355]"
                }`}
              >
                <Phone size={20} /> Call Agent
              </a>
              <button
                type="button"
                disabled
                className="flex min-h-[52px] cursor-not-allowed items-center justify-center gap-3 rounded-[16px] border border-[#EDE8DF] bg-[#FBF7F0] px-4 py-3.5 text-sm font-bold text-[#8B7355] sm:rounded-[18px] sm:py-4"
              >
                <MessageSquare size={20} /> Message Soon
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF7] p-5 shadow-sm sm:rounded-[32px] sm:p-8">
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                Live Tracking
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[#2C1A0E]" style={headingFont}>
                Live Map
              </h3>
            </div>
            <TrackAgentMap
              orderId={resolvedOrderId}
              agentId={agent?.id || delivery?.agentId || null}
              initialPosition={delivery?.currentAgentLocation || null}
              customerPosition={delivery?.customerLocation || null}
              canTrack={canTrackLive}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-[24px] border border-[#EDE8DF] bg-[#F5F0E8] p-5 shadow-sm sm:space-y-5 sm:rounded-[32px] sm:p-8">
          <h5 className="text-xs font-bold uppercase tracking-[0.18em] text-[#C4A882]">Order Details</h5>
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm text-[#8B7355]">Product</span>
            <span className="max-w-[55%] text-right text-sm font-bold text-[#2C1A0E] sm:max-w-none">
              {delivery.quantity} {delivery.product}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm text-[#8B7355]">Delivery Slot</span>
            <span className="max-w-[55%] text-right text-sm font-bold text-[#2C1A0E] sm:max-w-none">
              {delivery.expectedWindow || delivery.slotWindow || delivery.slot || "-"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm text-[#8B7355]">Status</span>
            <span className="max-w-[55%] text-right text-sm font-bold text-[#2C1A0E] sm:max-w-none">{normalizedStatus || "-"}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm text-gray-600">Delivery Type</span>
            <span className="max-w-[55%] text-right text-sm font-bold sm:max-w-none">{getDeliveryTypeLabel(delivery)}</span>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default TrackAgent;
