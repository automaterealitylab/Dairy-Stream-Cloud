// Cutoff and business timezone rules engine for DairyVision (Asia/Kolkata).

export const BUSINESS_TIMEZONE = "Asia/Kolkata";
export const DELIVERY_CUTOFF_HOUR_IST = 22; // 10:00 PM IST
export const MAX_CUSTOMER_PAUSE_DAYS = 15;

/** Get current date and time breakdown in Asia/Kolkata timezone. */
export const getCurrentIstDateTime = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const map = {};
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  const hour = Number(map.hour) % 24;
  const minute = Number(map.minute);
  const second = Number(map.second);
  const dateStr = `${map.year}-${map.month}-${map.day}`;

  return {
    dateStr,
    hour,
    minute,
    second,
    now,
  };
};

/** Get the ISO YYYY-MM-DD string for the calendar day preceding the given ISO date string. */
export const getPreviousDayIso = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const [y, m, d] = dateStr.trim().split("-").map(Number);
  if (!y || !m || !d) return null;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  dateObj.setUTCDate(dateObj.getUTCDate() - 1);
  return dateObj.toISOString().slice(0, 10);
};

/**
 * Returns whether the 10:00 PM IST previous-day cutoff has passed for a given delivery date.
 * Delivery Date D cutoff = (D - 1 day) at 22:00 IST.
 */
export const isDeliveryDateCutoffPassed = (deliveryDateStr, currentIst = getCurrentIstDateTime()) => {
  if (!deliveryDateStr) return true;
  const cutoffDateStr = getPreviousDayIso(deliveryDateStr);
  if (!cutoffDateStr) return true;

  if (currentIst.dateStr > cutoffDateStr) {
    return true;
  }

  if (currentIst.dateStr < cutoffDateStr) {
    return false;
  }

  return currentIst.hour >= DELIVERY_CUTOFF_HOUR_IST;
};

/** Calculate the inclusive number of days between two ISO date strings. */
export const getInclusiveDaysDifference = (startDateStr, endDateStr) => {
  if (!startDateStr || !endDateStr) return 0;
  const [y1, m1, d1] = startDateStr.split("-").map(Number);
  const [y2, m2, d2] = endDateStr.split("-").map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const diffTime = t2 - t1;
  if (diffTime < 0) return 0;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
};
