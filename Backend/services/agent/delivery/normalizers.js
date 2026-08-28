// Pure normalization/formatting helpers for the agent delivery domain:
// dates, quantities, slots, coordinates, statuses and agent availability.

import { isValidDateString } from "../../../utils/date.js";

export const parseDateSafe = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const deriveAgentAvailability = (agent = {}) => {
  const status = String(agent?.status || "ACTIVE").toUpperCase();
  const inactiveUntilRaw = agent?.inactive_until || null;
  const inactiveUntilDate = parseDateSafe(inactiveUntilRaw);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const inFutureWindow = inactiveUntilDate ? inactiveUntilDate >= todayStart : false;
  const isInactive = status === "INACTIVE" && (inactiveUntilDate ? inFutureWindow : true);

  let inactiveDaysRemaining = 0;
  if (isInactive && inactiveUntilDate) {
    const end = new Date(
      inactiveUntilDate.getFullYear(),
      inactiveUntilDate.getMonth(),
      inactiveUntilDate.getDate()
    );
    const diffMs = end.getTime() - todayStart.getTime();
    inactiveDaysRemaining = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1);
  } else if (isInactive) {
    inactiveDaysRemaining = Number(agent?.inactive_days || 0) || 0;
  }

  return {
    resolvedStatus: isInactive ? "INACTIVE" : "ACTIVE",
    isActive: !isInactive,
    inactiveUntil: inactiveUntilRaw,
    inactiveFrom: agent?.inactive_from || null,
    inactiveDaysRemaining,
  };
};

export const normalizeDate = (value) => {
  if (!value) return "";
  if (isValidDateString(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

export const formatQuantity = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  const compact = Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toFixed(2).replace(/\.?0+$/, "");
  return `${compact} L`;
};

export const normalizeDeliverySlot = (value) => {
  const slot = String(value || "").trim().toUpperCase();
  if (slot.startsWith("MOR")) return "MORNING";
  if (slot.startsWith("EVE")) return "EVENING";
  return slot;
};

export const toDeliverySlotLabel = (slotKey) => {
  if (slotKey === "MORNING") return "Morning";
  if (slotKey === "EVENING") return "Evening";
  return String(slotKey || "").trim() || "-";
};

export const normalizeCoordinate = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(6)) : null;
};

export const normalizeStatusForCard = (status) => {
  const value = String(status || "").trim().toUpperCase();
  if (value === "DELIVERED" || value === "COMPLETED") return "COMPLETED";
  if (value === "IN_TRANSIT" || value === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (
    value === "FAILED" ||
    value === "CANCELLED" ||
    value === "CANCELED" ||
    value === "MISSED" ||
    value === "SKIPPED"
  ) {
    return "FAILED";
  }
  return "PENDING";
};

export const normalizeStatusForHistory = (status) => {
  const cardStatus = normalizeStatusForCard(status);
  if (cardStatus === "COMPLETED") return "completed";
  if (cardStatus === "FAILED") return "failed";
  return "pending";
};

export const formatAddress = (customer = {}) => {
  const parts = [
    customer.address_line_1,
    customer.address_line_2,
    customer.building_name,
    customer.wing,
    customer.room_no,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "-";
};
