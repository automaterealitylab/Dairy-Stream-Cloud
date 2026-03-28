import React, { useState, useEffect } from "react";
import {
  getCachedDeliveryETA,
  getDeliveryETA,
} from "../../api/customer/notification";

const DeliveryETADisplay = ({ deliveryId }) => {
  const cachedEta = getCachedDeliveryETA(deliveryId);
  const [etaData, setEtaData] = useState(cachedEta);
  const [loading, setLoading] = useState(() => !cachedEta);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!deliveryId) {
      setEtaData(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const initialCachedEta = getCachedDeliveryETA(deliveryId);
    if (initialCachedEta) {
      setEtaData(initialCachedEta);
      setLoading(false);
    }

    const fetchETA = async ({ force = false, showSpinner = force || !getCachedDeliveryETA(deliveryId) } = {}) => {
      try {
        if (showSpinner) {
          setLoading(true);
        }

        const data = await getDeliveryETA(deliveryId, { force });
        setEtaData(data);
        setError(null);
      } catch (err) {
        setError("Unable to fetch delivery ETA");
        console.error("ETA Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchETA();

    // Refresh ETA every 2 minutes
    const interval = setInterval(() => fetchETA({ force: true, showSpinner: false }), 120000);

    return () => clearInterval(interval);
  }, [deliveryId]);

  if (loading) {
    return (
      <div className="mt-6 rounded-[18px] border border-[#EFD7B3] bg-[#FFF8EC] p-4">
        <p className="text-center text-[#8B7355]">Loading ETA...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 rounded-[18px] border border-[#F2D0C8] bg-[#FDECEA] p-4">
        <p className="text-center text-sm text-[#C0392B]">{error}</p>
      </div>
    );
  }

  if (!etaData) return null;

  // COMPLETED status
  if (etaData.status === "COMPLETED") {
    return (
      <div className="mt-6 rounded-[18px] border border-[#DDE8D1] bg-[#EEF5E7] p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✅</span>
          <div>
            <h3 className="font-bold text-[#4A7C2F]">Delivery Completed</h3>
            <p className="text-sm text-[#4A7C2F]">Your order has been delivered</p>
          </div>
        </div>
      </div>
    );
  }

  // FAILED status
  if (etaData.status === "FAILED") {
    return (
      <div className="mt-6 rounded-[18px] border border-[#F2D0C8] bg-[#FDECEA] p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">❌</span>
          <div>
            <h3 className="font-bold text-[#C0392B]">Delivery Failed</h3>
            <p className="text-sm text-[#C0392B]">{etaData.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // No ETA available yet
  if (!etaData.eta) {
    return (
      <div className="mt-6 rounded-[18px] border border-[#F0D1B2] bg-[#FFF1E4] p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⏳</span>
          <div>
            <h3 className="font-bold text-[#B8641A]">ETA Not Available</h3>
            <p className="text-sm text-[#B8641A]">{etaData.message || "Agent will start soon"}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate remaining minutes
  const remainingMinutes = etaData.remainingMinutes || 0;
  const etaTime = new Date(etaData.eta).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
      <div className="mt-6 rounded-[20px] border border-[#EFD7B3] bg-[linear-gradient(135deg,#FFF8EC_0%,#FFF1E4_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-3xl">🚚</span>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-[#2C1A0E]">Delivery On The Way</h3>
            
            {/* ETA Minutes */}
            <div className="mt-2">
              <p className="text-sm text-[#8B7355]">Estimated Arrival Time</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-3xl font-bold text-[#B8641A]">{remainingMinutes}</span>
                <span className="text-[#8B7355]">minutes away</span>
              </div>
              <p className="text-xs text-[#A88763]">Around {etaTime}</p>
            </div>

            {/* Distance */}
            {etaData.remainingDistance !== null && (
              <div className="mt-3 border-t border-[#EFD7B3] pt-3">
                <p className="text-sm text-[#8B7355]">Distance</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">📍</span>
                  <p className="font-semibold text-[#B8641A]">{etaData.remainingDistance} km away</p>
                </div>
              </div>
            )}

            {/* Last Updated */}
            {etaData.lastUpdated && (
              <p className="mt-2 text-xs text-[#A88763]">
                Updated {new Date(etaData.lastUpdated).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Confidence Badge */}
        <div className="sm:ml-4">
          <span className="inline-block rounded bg-[#FDE9C9] px-2 py-1 text-xs font-bold text-[#B8641A]">
            Live
          </span>
        </div>
      </div>
    </div>
  );
};

export default DeliveryETADisplay;
