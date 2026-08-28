// Pure helpers and static config for the Admin Deliveries page.

export const toQuantityValue = (value) => {
  const parsed = Number.parseFloat(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toDateTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const formatDate = (value) => {
  const timestamp = toDateTimestamp(value);
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const cleanMetaText = (value) =>
  String(value || "")
    .replace(/\s*[\uFFFD\u00B7\u2022]+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const buildDeliveryMeta = (delivery) => {
  const parts = [];

  if (delivery?.wingOrFloor) {
    parts.push(`Wing ${cleanMetaText(delivery.wingOrFloor)}`);
  }

  const quantity = cleanMetaText(delivery?.quantity);
  if (quantity && quantity !== "-") {
    parts.push(quantity);
  }

  const slot = cleanMetaText(delivery?.slot);
  if (slot && slot !== "-") {
    parts.push(slot);
  }

  const date = formatDate(delivery?.date);
  if (date && date !== "-") {
    parts.push(date);
  }

  return parts;
};

export const getTodayDateInput = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const getRelativeDateInput = (dayOffset = 0) => {
  const now = new Date();
  now.setDate(now.getDate() + dayOffset);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const naturalCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export const compareLocationPart = (left, right) =>
  naturalCollator.compare(String(left || "").trim(), String(right || "").trim());
