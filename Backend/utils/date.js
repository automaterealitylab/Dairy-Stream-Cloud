// Shared date/calendar helpers used across services.

/** Current local date as an ISO `YYYY-MM-DD` string (no time component). */
export const getLocalTodayIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Whether a value is a `YYYY-MM-DD` date string. */
export const isValidDateString = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
