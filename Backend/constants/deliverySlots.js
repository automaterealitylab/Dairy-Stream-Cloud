// Delivery slot windows shared by the customer and agent delivery flows.

export const SLOT_WINDOWS = {
  MORNING: "6:00 AM - 9:00 AM",
  EVENING: "5:00 PM - 8:00 PM",
};

export const getSlotWindow = (slotKey) =>
  SLOT_WINDOWS[String(slotKey || "").toUpperCase()] || null;
