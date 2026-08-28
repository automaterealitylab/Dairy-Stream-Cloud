// LocalStorage helpers for the Admin Payments page's autopay settings.

const AUTOPAY_STORAGE_PREFIX = "adminFarmAutopayV1";

const getAutopayStorageKey = (dairyId) =>
  `${AUTOPAY_STORAGE_PREFIX}:${dairyId || "default"}`;

export const readStoredAutopay = (dairyId) => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getAutopayStorageKey(dairyId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const persistAutopay = (dairyId, value) => {
  if (typeof window === "undefined") return;

  try {
    if (!value) {
      window.localStorage.removeItem(getAutopayStorageKey(dairyId));
      return;
    }

    window.localStorage.setItem(
      getAutopayStorageKey(dairyId),
      JSON.stringify(value)
    );
  } catch {
    // Ignore storage issues so billing UI keeps working.
  }
};
