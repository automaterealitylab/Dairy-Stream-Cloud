import { useEffect, useRef } from "react";

const DEFAULT_RETRY_THROTTLE_MS = 3000;

export const useGeolocationAutoRetry = ({
  enabled = true,
  onRetry,
  retryThrottleMs = DEFAULT_RETRY_THROTTLE_MS,
} = {}) => {
  const onRetryRef = useRef(onRetry);
  const lastRetryAtRef = useRef(0);

  useEffect(() => {
    onRetryRef.current = onRetry;
  }, [onRetry]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof navigator === "undefined") {
      return undefined;
    }

    let isDisposed = false;
    let permissionStatus = null;

    const runRetry = () => {
      const now = Date.now();
      if (now - lastRetryAtRef.current < retryThrottleMs) {
        return;
      }

      lastRetryAtRef.current = now;
      onRetryRef.current?.();
    };

    const checkPermissionAndRetry = async () => {
      if (isDisposed) return;

      if (!navigator.permissions?.query) {
        runRetry();
        return;
      }

      try {
        const status = await navigator.permissions.query({ name: "geolocation" });
        if (isDisposed) return;

        permissionStatus = status;
        if (status.state === "granted") {
          runRetry();
        }
      } catch {
        runRetry();
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "hidden") return;
      checkPermissionAndRetry();
    };

    checkPermissionAndRetry();

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (isDisposed) return;

          permissionStatus = status;
          status.onchange = () => {
            if (status.state === "granted") {
              runRetry();
            }
          };
        })
        .catch(() => {});
    }

    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("pageshow", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      isDisposed = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("pageshow", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [enabled, retryThrottleMs]);
};

export default useGeolocationAutoRetry;
