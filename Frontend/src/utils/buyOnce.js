export const toDateInput = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const getDefaultBuyOnceDate = () => {
  const now = new Date();
  const eveningCutoff = new Date(now);
  eveningCutoff.setHours(16, 0, 0, 0);
  if (now <= eveningCutoff) return toDateInput(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateInput(tomorrow);
};

export const getTomorrowBuyOnceDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateInput(tomorrow);
};

export const getDeliverySlotOptions = (deliveryDate) => {
  const now = new Date();
  const todayIso = toDateInput(now);

  const baseSlots = [
    {
      id: "Morning",
      label: "Morning (6:00 AM - 9:00 AM)",
      cutoffHour: 5,
      cutoffMinute: 30,
    },
    {
      id: "Evening",
      label: "Evening (5:00 PM - 8:00 PM)",
      cutoffHour: 16,
      cutoffMinute: 0,
    },
  ];

  if (!deliveryDate) return baseSlots.map((slot) => ({ ...slot, available: false }));

  if (deliveryDate > todayIso) {
    return baseSlots.map((slot) => ({ ...slot, available: true, reason: "Available" }));
  }

  if (deliveryDate < todayIso) {
    return baseSlots.map((slot) => ({
      ...slot,
      available: false,
      reason: "Past date not allowed",
    }));
  }

  return baseSlots.map((slot) => {
    const cutoff = new Date(now);
    cutoff.setHours(slot.cutoffHour, slot.cutoffMinute, 0, 0);
    const available = now <= cutoff;
    return {
      ...slot,
      available,
      reason: available ? "Available today" : "Cut-off passed for today",
    };
  });
};

export const deriveProductType = (type, name) => {
  const t = String(type || "").trim().toUpperCase();
  if (t && t !== "OTHER" && ["MILK", "CURD", "PANEER", "GHEE"].includes(t)) {
    return t;
  }
  const n = String(name || "").toLowerCase();
  if (n.includes("milk")) return "MILK";
  if (n.includes("curd") || n.includes("dahi") || n.includes("yogurt")) return "CURD";
  if (n.includes("paneer") || n.includes("panner") || n.includes("cheese")) return "PANEER";
  if (n.includes("ghee") || n.includes("butter")) return "GHEE";
  return "OTHER";
};

export const normalizeProducts = (dairy = {}) => {
  const explicitItems = Array.isArray(dairy?.productItems) ? dairy.productItems : [];
  if (explicitItems.length > 0) {
    return explicitItems
      .map((item) => ({
        id: item.id || item.name,
        name: String(item.name || "").trim(),
        type: deriveProductType(item.type || item.product_type, item.name),
        ratePerUnit: Number(item.ratePerUnit || 0),
        stockQuantity: Number(item.stockQuantity || 0),
        unit: item.unit || "LITER",
      }))
      .filter((item) => item.name && item.ratePerUnit > 0);
  }

  const legacyProducts = dairy?.products || {
    "Full Cream": 64,
    Toned: 54,
    "Cow Milk": 60,
    "Buffalo Milk": 72,
  };

  return Object.keys(legacyProducts).map((name) => ({
    id: name,
    name,
    type: deriveProductType("MILK", name),
    ratePerUnit: Number(legacyProducts[name] || 0),
    stockQuantity: Number.POSITIVE_INFINITY,
    unit: "LITER",
  }));
};

export const isProductOutOfStock = (stockQuantity) => {
  const stock = Number(stockQuantity);
  return Number.isFinite(stock) && stock <= 0;
};

export const formatProductStockLabel = (stockQuantity) => {
  const stock = Number(stockQuantity);
  if (!Number.isFinite(stock)) return "Unlimited";
  if (stock <= 0) return "Out of Stock";
  return String(stock);
};

export const hasOpenSubscriptionStatus = (status) => {
  const value = String(status || "ACTIVE").trim().toUpperCase();
  return value !== "CLOSED" && value !== "CANCELLED" && value !== "CANCELED";
};

export const computeTotalPrice = (selectedItems) =>
  selectedItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.ratePerUnit || 0),
    0
  );

export const getOrderPaymentId = (response) =>
  response?.payment?.id ||
  response?.paymentId ||
  response?.order?.payment_id ||
  response?.order?.paymentId ||
  response?.order?.payment?.id ||
  null;
