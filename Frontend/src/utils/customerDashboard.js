export const formatCurrency = (value) => {
  const num = Number(value || 0);
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const getBillingDueText = (dueInDays) => {
  if (dueInDays === null || dueInDays === undefined) return "Due date not set";
  if (dueInDays < 0) return `Overdue by ${Math.abs(dueInDays)} days`;
  if (dueInDays === 0) return "Due today";
  return `Due in ${dueInDays} days`;
};

export const getDateInputValue = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getTomorrowDateInput = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getDateInputValue(tomorrow);
};

export const formatProductName = (name) => {
  let cleaned = String(name || "").trim();
  if (!cleaned) return "";

  cleaned = cleaned
    .replace(/buffalow\s*milk/i, "Buffalo Milk")
    .replace(/buffalowmilk/i, "Buffalo Milk")
    .replace(/buffalo\s*milk/i, "Buffalo Milk")
    .replace(/panner/i, "Paneer")
    .replace(/cow\s*milk/i, "Cow Milk")
    .replace(/cowmilk/i, "Cow Milk")
    .replace(/^2\s*milk$/i, "2 Milk")
    .replace(/^(\d+)\s*milk$/i, "$1 Milk");

  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
      .map((item) => {
        const type = deriveProductType(item.type || item.product_type, item.name);
        let rawUnit = item.unit || (type === "GHEE" || type === "PANEER" ? "KG" : "LITER");
        if (type === "GHEE" && (rawUnit.toUpperCase() === "LITER" || rawUnit.toUpperCase() === "L")) {
          rawUnit = "KG";
        }
        return {
          id: item.id || item.name,
          name: formatProductName(item.name),
          type,
          ratePerUnit: Number(item.ratePerUnit || 0),
          stockQuantity: Number(item.stockQuantity || 0),
          unit: rawUnit,
        };
      })
      .filter((item) => item.name && item.ratePerUnit > 0);
  }

  const legacyProducts = dairy?.products || {};
  return Object.keys(legacyProducts).map((name) => {
    const type = deriveProductType("MILK", name);
    const unit = type === "GHEE" || type === "PANEER" ? "KG" : "LITER";
    return {
      id: name,
      name: formatProductName(name),
      type,
      ratePerUnit: Number(legacyProducts[name] || 0),
      stockQuantity: Number.POSITIVE_INFINITY,
      unit,
    };
  });
};

export const normalizeProductUnit = (unit) => {
  const normalized = String(unit || "").trim().toUpperCase();
  if (!normalized) return "UNIT";
  if (["L", "LTR", "LITER", "LITRE", "LITERS", "LITRES"].includes(normalized)) {
    return "LITER";
  }
  if (["KG", "KGS", "KILOGRAM", "KILOGRAMS"].includes(normalized)) {
    return "KG";
  }
  return normalized;
};

export const getProductUnitLabel = (unit, { short = false, lowercase = false } = {}) => {
  const normalized = normalizeProductUnit(unit);

  let label = normalized;
  if (normalized === "LITER") {
    label = short ? "L" : "Liter";
  } else if (normalized === "KG") {
    label = short ? "kg" : "KG";
  }

  return lowercase ? label.toLowerCase() : label;
};

export const getProductQuantityStep = (unit) => {
  const normalized = normalizeProductUnit(unit);
  if (normalized === "KG") return "0.25";
  if (normalized === "LITER") return "0.5";
  return "1";
};

export const getDefaultProductQuantity = (product, fallbackQuantity = "1") => {
  const fallback = Number(fallbackQuantity);
  if (Number.isFinite(fallback) && fallback > 0) {
    return formatMeasureValue(fallback);
  }

  return getProductQuantityStep(product?.unit);
};

export const formatMeasureValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  if (Number.isInteger(numeric)) return String(numeric);
  return numeric.toFixed(2).replace(/\.?0+$/, "");
};

export const isProductOutOfStock = (stockQuantity) => {
  const stock = Number(stockQuantity);
  return Number.isFinite(stock) && stock <= 0;
};

export const getStoredCustomerAddress = () => {
  const storedUser = localStorage.getItem("user");
  if (!storedUser) return "";

  try {
    const parsed = JSON.parse(storedUser);
    return String(parsed?.user?.address || parsed?.address || "").trim();
  } catch {
    return "";
  }
};

export const buildUpiPaymentLink = ({ upiId, amount, name, note }) => {
  if (!upiId) return "";

  const params = new URLSearchParams();
  params.set("pa", String(upiId).trim());
  if (name) params.set("pn", String(name).trim());
  if (Number.isFinite(Number(amount)) && Number(amount) > 0) {
    params.set("am", Number(amount).toFixed(2));
  }
  params.set("cu", "INR");
  if (note) params.set("tn", String(note).trim());

  return `upi://pay?${params.toString()}`;
};

export const normalizeAddExtraPaymentOption = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (["SUBSCRIPTION", "ADD_TO_SUBSCRIPTION", "MONTHLY_BILL"].includes(normalized)) {
    return "ADD_TO_SUBSCRIPTION";
  }
  if (["COD", "CASH"].includes(normalized)) {
    return "PAY_NOW_CASH";
  }
  return "PAY_NOW_ONLINE";
};

export const getAddExtraOrderPaymentMethod = (option) => {
  if (option === "ADD_TO_SUBSCRIPTION") return "MONTHLY_BILL";
  if (option === "PAY_NOW_CASH") return "COD";
  return "PAY_NOW";
};

export const normalizeAddExtraSlot = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.startsWith("EVE")) return "Evening";
  return "Morning";
};

export const formatTomorrowExtraStatus = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PENDING_APPROVAL" || normalized === "PENDING_VERIFICATION") return "Approval Pending";
  if (normalized === "PENDING") return "Scheduled";
  if (normalized === "DELIVERED") return "Delivered";
  if (normalized === "FAILED") return "Failed";
  if (normalized === "SKIPPED") return "Skipped";
  if (normalized === "CANCELLED") return "Cancelled";
  return "Scheduled";
};

export const getTomorrowExtraStatusClasses = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "DELIVERED") return "bg-[#EEF5E7] text-[#4A7C2F]";
  if (normalized === "FAILED" || normalized === "CANCELLED") {
    return "bg-[#FDECEA] text-[#C0392B]";
  }
  if (normalized === "PENDING_APPROVAL" || normalized === "PENDING_VERIFICATION") return "bg-[#FFF1E4] text-[#C86A2B]";
  return "bg-[#FFF4E2] text-[#B8641A]";
};

export const getTodayDeliveryMeta = (delivery = {}) => {
  const status = String(delivery?.status || "").toUpperCase();
  const hasAgent = Boolean(delivery?.agent?.name || delivery?.agentId);

  if (status === "DELIVERED") {
    return {
      title: "Delivered Successfully",
      tone: "success",
      helperText: "Your order was delivered successfully.",
    };
  }

  if (status === "PENDING_APPROVAL" || status === "PENDING_VERIFICATION") {
    return {
      title: "Approval Pending",
      tone: "approval",
      helperText: "Your one-time order is waiting for dairy admin approval.",
    };
  }

  if (status === "OUT_FOR_DELIVERY" || status === "IN_TRANSIT") {
    return {
      title: "Out for Delivery",
      tone: "pending",
      helperText: "Your order is scheduled and out for delivery.",
    };
  }

  if (status === "CANCELLED") {
    return {
      title: "Order Cancelled",
      tone: "failed",
      helperText: "This one-time order was cancelled and remains in your history.",
    };
  }

  if (status === "FAILED") {
    return {
      title: "Delivery Failed",
      tone: "failed",
      helperText: "This delivery could not be completed today.",
    };
  }

  if (status === "NOT_SUBSCRIBED") {
    return {
      title: "No Delivery Scheduled Today",
      tone: "idle",
      helperText: "Start a subscription or place a one-time order to get a delivery.",
    };
  }

  if (status === "NOT_SCHEDULED") {
    return {
      title: "No Delivery Scheduled Today",
      tone: "idle",
      helperText: "Your subscription is active, but there is no delivery planned for today.",
    };
  }

  if (status === "PENDING" && !hasAgent) {
    return {
      title: "Delivery Partner Not Assigned",
      tone: "pending",
      helperText: "We are assigning a delivery partner for your order.",
    };
  }

  return {
    title: "Delivery Pending",
    tone: "pending",
    helperText: "Your order is scheduled and awaiting delivery.",
  };
};

export const getPreferredExtraProductName = ({ subscription, tomorrow, today }) =>
  String(
    subscription?.milkType ||
    tomorrow?.product ||
    today?.product ||
    ""
  ).trim();

export const getPreferredExtraQuantity = ({ subscription, tomorrow, today }) => {
  const rawQuantity = subscription?.quantity ?? tomorrow?.quantity ?? today?.quantity ?? 1;
  const numericQuantity = Number.parseFloat(String(rawQuantity).replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    return "1";
  }

  return formatMeasureValue(numericQuantity);
};

export const getDailyDeliverySummary = ({ subscription, tomorrow, today }) => {
  const scheduledQuantity = String(tomorrow?.quantity || today?.quantity || "").trim();
  const rawProduct = String(tomorrow?.product || today?.product || subscription?.milkType || "").trim();
  const formattedProduct = formatProductName(rawProduct) || "Milk";

  if (scheduledQuantity) {
    const qty = String(scheduledQuantity).toLowerCase().includes("l") ? scheduledQuantity : `${scheduledQuantity} L`;
    return `${qty} · ${formattedProduct}`;
  }

  const subscriptionQuantity = getPreferredExtraQuantity({ subscription, tomorrow: null, today: null });
  return `${subscriptionQuantity} L · ${formattedProduct}`;
};

export const toSubscriptionPayload = (subscription, nextStatus) => ({
  dairyId: subscription?.dairyId,
  milkType: subscription?.milkType || "Milk",
  quantity: Number(subscription?.quantity || 1),
  slot: subscription?.slot || "Morning",
  startDate: subscription?.startDate || undefined,
  address: subscription?.address || "",
  paymentMethod: subscription?.paymentMethod || "UPI",
  status: nextStatus,
});
