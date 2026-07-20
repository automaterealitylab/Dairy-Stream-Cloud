import { Geolocation as NativeGeolocation } from "@capacitor/geolocation";

export const GEO_ERROR = {
  UNSUPPORTED: "UNSUPPORTED",
  INSECURE_CONTEXT: "INSECURE_CONTEXT",
  PERMISSION_REQUIRED: "PERMISSION_REQUIRED",
  PERMISSION_BLOCKED: "PERMISSION_BLOCKED",
  GPS_OFF: "GPS_OFF",
  TIMEOUT: "TIMEOUT",
  UNAVAILABLE: "UNAVAILABLE",
};

export const isSecureGeolocationContext = () =>
  typeof window !== "undefined" &&
  (window.isSecureContext || ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname));

export const isCapacitorNative = () =>
  typeof window !== "undefined" && Boolean(window.Capacitor?.isNativePlatform?.());

export const getLocationPermissionState = async () => {
  if (isCapacitorNative()) {
    try {
      const status = await NativeGeolocation.checkPermissions();
      if (status.location === "granted") return "granted";
      if (status.location === "denied") return "denied";
      return "prompt";
    } catch {
      return "unknown";
    }
  }

  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unknown";
  }

  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state; // "granted", "prompt", "denied"
  } catch {
    return "unknown";
  }
};

export const requestDeviceLocation = async ({ userInitiated = false, timeoutMs = 10000 } = {}) => {
  // Handle native Android / iOS Capacitor platform
  if (isCapacitorNative()) {
    try {
      if (userInitiated) {
        const permStatus = await NativeGeolocation.requestPermissions();
        if (permStatus.location === "denied") {
          throw {
            code: 1,
            state: GEO_ERROR.PERMISSION_BLOCKED,
            message: "Location permission denied in app settings.",
          };
        }
      } else {
        const check = await NativeGeolocation.checkPermissions();
        if (check.location !== "granted") {
          throw {
            code: 1,
            state: check.location === "denied" ? GEO_ERROR.PERMISSION_BLOCKED : GEO_ERROR.PERMISSION_REQUIRED,
            message: "Location permission not granted yet.",
          };
        }
      }

      const position = await NativeGeolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: timeoutMs,
      });

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (err) {
      if (err?.state) throw err;
      const message = String(err?.message || "").toLowerCase();
      if (message.includes("location disabled") || message.includes("disabled") || message.includes("gps")) {
        throw { code: 2, state: GEO_ERROR.GPS_OFF, message: "Device location services are turned off." };
      }
      if (err?.code === 1 || message.includes("denied")) {
        throw { code: 1, state: GEO_ERROR.PERMISSION_BLOCKED, message: "Location permission denied." };
      }
      throw { code: 2, state: GEO_ERROR.UNAVAILABLE, message: err?.message || "Failed to fetch GPS coordinates." };
    }
  }

  // Handle Standard Web / PWA / Mobile Browsers
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw { code: 0, state: GEO_ERROR.UNSUPPORTED, message: "Geolocation is not supported by this browser." };
  }

  if (!isSecureGeolocationContext()) {
    throw {
      code: 0,
      state: GEO_ERROR.INSECURE_CONTEXT,
      message: "Geolocation requires HTTPS, except on localhost during development.",
    };
  }

  const initialPermissionState = await getLocationPermissionState();

  if (!userInitiated && initialPermissionState !== "granted") {
    throw {
      code: 1,
      state: initialPermissionState === "denied" ? GEO_ERROR.PERMISSION_BLOCKED : GEO_ERROR.PERMISSION_REQUIRED,
      message: "Location permission has not been granted yet.",
    };
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        let state = GEO_ERROR.UNAVAILABLE;
        const errMsg = String(err?.message || "").toLowerCase();

        if (err.code === 1) {
          // PERMISSION_DENIED
          state = userInitiated || initialPermissionState === "denied" ? GEO_ERROR.PERMISSION_BLOCKED : GEO_ERROR.PERMISSION_REQUIRED;
        } else if (err.code === 3) {
          state = GEO_ERROR.TIMEOUT;
        } else if (err.code === 2 || errMsg.includes("disabled") || errMsg.includes("provider") || errMsg.includes("gps")) {
          state = GEO_ERROR.GPS_OFF;
        }

        reject({
          code: err.code,
          state,
          message: err.message || "Failed to obtain current location.",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
};
