import { SLOT_META } from "../constants/agent";

export const getLocalDateKey = (value = new Date()) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getSlotSortOrder = (slotKey = "") => {
  if (slotKey === "MORNING") return 1;
  if (slotKey === "EVENING") return 2;
  return 3;
};

export const compareScheduledDeliveries = (left, right) => {
  const leftDate = String(left?.date || "");
  const rightDate = String(right?.date || "");

  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  const leftSlot = getSlotSortOrder(String(left?.slotKey || "").toUpperCase());
  const rightSlot = getSlotSortOrder(String(right?.slotKey || "").toUpperCase());
  if (leftSlot !== rightSlot) {
    return leftSlot - rightSlot;
  }

  return String(left?.customerName || "").localeCompare(String(right?.customerName || ""));
};

export const getDeliveryScheduleState = (delivery, now = new Date()) => {
  const deliveryDate = String(delivery?.date || "").trim();
  const todayKey = getLocalDateKey(now);

  if (!deliveryDate) {
    return { phase: "UNSCHEDULED", isStartable: false, helperText: "Schedule not available" };
  }

  if (deliveryDate < todayKey) {
    return { phase: "PAST", isStartable: false, helperText: "Scheduled window has passed" };
  }

  if (deliveryDate > todayKey) {
    return { phase: "FUTURE", isStartable: false, helperText: `Scheduled for ${deliveryDate}` };
  }

  const slotKey = String(delivery?.slotKey || "").toUpperCase();
  const slotMeta = SLOT_META[slotKey];
  if (!slotMeta) {
    return { phase: "TODAY", isStartable: true, helperText: "Ready for today's delivery" };
  }

  const slotStart = new Date(now);
  slotStart.setHours(slotMeta.startHour, slotMeta.startMinute, 0, 0);

  const slotEnd = new Date(now);
  slotEnd.setHours(slotMeta.endHour, slotMeta.endMinute, 0, 0);

  if (now < slotStart) {
    return {
      phase: "UPCOMING_TODAY",
      isStartable: true,
      helperText: `${slotMeta.label} slot starts at ${delivery?.slotWindow || "-"}, but you can start delivery now`,
    };
  }

  if (now > slotEnd) {
    return {
      phase: "ENDED_TODAY",
      isStartable: true,
      helperText: "",
    };
  }

  return {
    phase: "ACTIVE_TODAY",
    isStartable: true,
    helperText: `${slotMeta.label} slot is active now`,
  };
};
