/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState, useCallback } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

const headingFont = { fontFamily: "'Lora', serif" };

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const verifyConnection = useCallback(async () => {
    const onlineState = typeof navigator !== "undefined" ? navigator.onLine : true;
    setIsOnline(onlineState);
    return onlineState;
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, verifyConnection };
};

const NetworkErrorScreen = ({ onRetry }) => {
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Lock scrolling completely on body & html when Network Error Screen is active
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  const handleRetryClick = async () => {
    setChecking(true);
    try {
      if (onRetry) {
        await onRetry();
      }
    } finally {
      setTimeout(() => setChecking(false), 500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#F7F2EA] px-6 text-center select-none"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="w-full max-w-md rounded-[28px] border border-[#E5D9C7] bg-[#FFFDF8] p-8 shadow-[0_24px_60px_rgba(92,61,30,0.14)]">
        {/* Network Offline Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#F5DEC7] bg-[#FFF1E4] shadow-sm">
          <WifiOff size={38} className="text-[#B8641A]" />
        </div>

        {/* Error Title */}
        <h1
          className="text-2xl md:text-3xl font-extrabold text-[#2C1A0E]"
          style={headingFont}
        >
          No Internet Connection
        </h1>

        {/* Error Description */}
        <p className="mt-3.5 text-sm md:text-base leading-relaxed text-[#6B5B3E]">
          DairyVision requires an active internet connection. Please check your network settings and try again.
        </p>

        {/* Manual Retry Action Button */}
        <button
          type="button"
          onClick={handleRetryClick}
          disabled={checking}
          className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-full bg-[#B8641A] px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:bg-[#965215] active:scale-95 disabled:opacity-75"
        >
          <RefreshCw size={18} className={checking ? "animate-spin" : ""} />
          <span>{checking ? "Checking connection..." : "Retry"}</span>
        </button>
      </div>
    </div>
  );
};

export default NetworkErrorScreen;
