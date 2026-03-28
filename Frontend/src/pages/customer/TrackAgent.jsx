import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import DeliveryETADisplay from "../../components/customer/DeliveryETADisplay.jsx";
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
} from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

const steps = [
  { label: "Order Placed", mobileLabel: "Placed", status: "PENDING" },
  { label: "Out for Delivery", mobileLabel: "On Way", status: "OUT_FOR_DELIVERY" },
  { label: "Delivered", mobileLabel: "Done", status: "DELIVERED" },
];

const getSafeStepIndex = (status) => {
  const index = steps.findIndex((step) => step.status === status);
  return index >= 0 ? index : 0;
};

const getDeliveryTypeLabel = (delivery = {}) => {
  const normalizedType = String(delivery?.deliveryType || "").toUpperCase();
  if (normalizedType === "ONE_TIME") return "One-time";
  if (normalizedType === "SUBSCRIPTION") return "Subscription";
  return delivery?.isOneTimeOrder ? "One-time" : "Subscription";
};

const TrackAgent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const cachedTodayDelivery = getCachedCustomerDeliveries()?.todayDelivery || null;
  const cachedTrackableDelivery =
    cachedTodayDelivery?.agent && cachedTodayDelivery?.deliveryId ? cachedTodayDelivery : null;
  const initialDelivery = location.state?.delivery || cachedTrackableDelivery || null;
  const [delivery, setDelivery] = useState(initialDelivery);
  const [loading, setLoading] = useState(!initialDelivery);
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
        const todayDelivery = response?.todayDelivery || null;

        if (!cancelled) {
          setDelivery(todayDelivery);
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

    const needsRefresh =
      !location.state?.delivery ||
      !location.state?.delivery?.agent ||
      !location.state?.delivery?.deliveryId;

    if (needsRefresh) {
      loadTrackingData();
    } else {
      setLoading(false);
      loadTrackingData({ force: true, showSpinner: false });
    }

    return () => {
      cancelled = true;
    };
  }, [location.state]);

  const agent = delivery?.agent || null;
  const currentStepIndex = getSafeStepIndex(String(delivery?.status || "PENDING").toUpperCase());
  const canTrack = Boolean(delivery?.deliveryId && agent);

  if (loading) {
    return (
      <CustomerLayout>
        <div className="p-8 text-center text-gray-500">
          <div className="inline-flex items-center gap-2 rounded-[16px] border border-[#EDE8DF] bg-[#FFFDF7] px-4 py-3">
            <Loader2 size={18} className="animate-spin text-[#B8641A]" />
            <span className="font-semibold">Loading active delivery tracking...</span>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  if (!canTrack) {
    return (
      <CustomerLayout>
        <div className="p-8 text-center">
          <p className="font-bold text-[#8B7355]">No active delivery tracking data available.</p>
          {error ? <p className="mt-2 text-sm text-[#C0392B]">{error}</p> : null}
          <button onClick={() => navigate(-1)} className="mt-4 text-[#B8641A] underline">
            Go Back
          </button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="space-y-5 pb-8 sm:space-y-6 lg:space-y-10" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="flex items-start gap-3 sm:items-center sm:gap-5">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full border border-[#EDE8DF] bg-white p-2 transition-colors hover:bg-[#FBF7F0]"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">Delivery Tracking</p>
            <h2 className="mt-1 text-[24px] font-semibold text-[#2C1A0E] sm:text-[32px]" style={headingFont}>Track <span className="text-[#B8641A]">Order</span></h2>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF7] px-4 pb-10 pt-5 shadow-sm sm:rounded-[32px] sm:p-9">
          <div className="relative flex justify-between items-center">
            <div className="absolute top-1/2 left-0 h-1 w-full -translate-y-1/2 bg-[#F2EDE4] z-0"></div>
            <div
              className="absolute top-1/2 left-0 z-0 h-1 -translate-y-1/2 bg-[#B8641A] transition-all duration-700"
              style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
            ></div>

            {steps.map((step, index) => {
              const isActive = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.label} className="relative z-10 flex flex-col items-center">
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
                  <span
                    className={`absolute -bottom-7 max-w-[70px] text-center text-[9px] font-black uppercase leading-tight tracking-tight sm:-bottom-8 sm:max-w-none sm:text-[10px] sm:whitespace-nowrap ${
                      isActive ? "text-[#B8641A]" : "text-[#A88763]"
                    }`}
                  >
                    <span className="sm:hidden">{step.mobileLabel || step.label}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 space-y-6 rounded-[24px] border border-[#EDE8DF] bg-[#FFFDF7] p-5 shadow-sm sm:mt-12 sm:space-y-10 sm:rounded-[32px] sm:p-9">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#FBF7F0] text-[#A88763] sm:h-20 sm:w-20">
                <User size={32} className="sm:hidden" />
                <User size={40} className="hidden sm:block" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white bg-[#4A7C2F] animate-pulse"></div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <h4 className="break-words text-lg font-bold text-[#2C1A0E] sm:text-xl">{agent.name}</h4>
                <ShieldCheck size={18} className="text-[#B8641A]" />
              </div>
              <p className="mt-1 text-sm text-[#8B7355]">
                {agent.route && agent.route !== "-" ? `Route: ${agent.route}` : "On the way to your address"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <a
              href={`tel:${agent.phone}`}
              className="flex min-h-[52px] items-center justify-center gap-3 rounded-[16px] bg-[#4A7C2F] px-4 py-3.5 text-sm font-bold text-white transition-all shadow-lg shadow-[#DDE8D1] hover:bg-[#3F6B27] sm:rounded-[18px] sm:py-4"
            >
              <Phone size={20} /> Call Agent
            </a>
            <button
              type="button"
              disabled
              className="flex min-h-[52px] cursor-not-allowed items-center justify-center gap-3 rounded-[16px] bg-[#EADFCC] px-4 py-3.5 text-sm font-bold text-[#8B7355] sm:rounded-[18px] sm:py-4"
            >
              <MessageSquare size={20} /> Message Soon
            </button>
          </div>

          <DeliveryETADisplay deliveryId={delivery.deliveryId} />
        </div>

        <div className="space-y-4 rounded-[24px] border border-[#EDE8DF] bg-[#F5F0E8] p-5 sm:space-y-5 sm:rounded-[32px] sm:p-9">
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
            <span className="max-w-[55%] text-right text-sm font-bold text-[#2C1A0E] sm:max-w-none">{delivery.status || "-"}</span>
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
