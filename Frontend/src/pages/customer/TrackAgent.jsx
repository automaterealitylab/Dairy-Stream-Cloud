import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import DeliveryETADisplay from "../../components/customer/DeliveryETADisplay.jsx";
import { fetchCustomerDeliveries } from "../../api/customer/customer.api.js";
import {
  ArrowLeft,
  Phone,
  User,
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const steps = [
  { label: "Order Placed", status: "PENDING" },
  { label: "Out for Delivery", status: "OUT_FOR_DELIVERY" },
  { label: "Delivered", status: "DELIVERED" },
];

const getSafeStepIndex = (status) => {
  const index = steps.findIndex((step) => step.status === status);
  return index >= 0 ? index : 0;
};

const TrackAgent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState(location.state?.delivery || null);
  const [loading, setLoading] = useState(!location.state?.delivery);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadTrackingData = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetchCustomerDeliveries();
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
          <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <Loader2 size={18} className="animate-spin text-blue-600" />
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
          <p className="text-gray-500 font-bold">No active delivery tracking data available.</p>
          {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
          <button onClick={() => navigate(-1)} className="text-blue-600 mt-4 underline">
            Go Back
          </button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Track Order</h2>
        </div>

        <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
          <div className="relative flex justify-between items-center">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0"></div>
            <div
              className="absolute top-1/2 left-0 h-1 bg-blue-600 -translate-y-1/2 transition-all duration-700 z-0"
              style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
            ></div>

            {steps.map((step, index) => {
              const isActive = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.label} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCurrent
                        ? "bg-blue-600 ring-4 ring-blue-100 text-white"
                        : isActive
                        ? "bg-blue-600 text-white"
                        : "bg-white border-2 border-gray-200 text-gray-400"
                    }`}
                  >
                    {isActive ? <CheckCircle2 size={20} /> : <div className="w-2 h-2 rounded-full bg-gray-300"></div>}
                  </div>
                  <span
                    className={`absolute -bottom-7 text-[10px] font-black uppercase tracking-tighter whitespace-nowrap ${
                      isActive ? "text-blue-600" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm space-y-8 mt-10">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 overflow-hidden">
                <User size={40} />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-green-500 h-5 w-5 rounded-full border-4 border-white animate-pulse"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xl font-bold text-gray-900">{agent.name}</h4>
                <ShieldCheck size={18} className="text-blue-500" />
              </div>
              <p className="text-gray-500 text-sm">
                {agent.route && agent.route !== "-" ? `Route: ${agent.route}` : "On the way to your address"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <a
              href={`tel:${agent.phone}`}
              className="flex items-center justify-center gap-3 bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100"
            >
              <Phone size={20} /> Call Agent
            </a>
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-3 bg-slate-200 text-slate-500 py-4 rounded-2xl font-bold cursor-not-allowed"
            >
              <MessageSquare size={20} /> Message Soon
            </button>
          </div>

          <DeliveryETADisplay deliveryId={delivery.deliveryId} />
        </div>

        <div className="bg-gray-50 rounded-[32px] p-8 space-y-4">
          <h5 className="font-bold text-gray-900 uppercase text-xs tracking-widest">Order Details</h5>
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-600">Product</span>
            <span className="font-bold text-right">{delivery.quantity} {delivery.product}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-600">Delivery Slot</span>
            <span className="font-bold text-right">
              {delivery.expectedWindow || delivery.slotWindow || delivery.slot || "-"}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-600">Status</span>
            <span className="font-bold text-right">{delivery.status || "-"}</span>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default TrackAgent;
