import { supabase } from "../../config/supabase.js";

const toTitleStatus = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "DELIVERED" || value === "COMPLETED") return "DELIVERED";
  if (value === "SKIPPED" || value === "CANCELLED") return "SKIPPED";
  if (value === "PENDING") return "PENDING";
  return "PENDING";
};

const formatDateLabel = (value) => {
  if (!value) return "-";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "-";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yday = new Date(today);
  yday.setDate(today.getDate() - 1);
  const d = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yday.getTime()) return "Yesterday";
  return target.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const formatTimeLabel = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const mapDeliveryRow = (row, index, fallbackProduct, fallbackQty) => {
  const dateSource = row.delivery_date || row.date || row.created_at || row.updated_at;
  const timeSource = row.delivered_at || row.time || row.updated_at || row.created_at;
  const qty =
    row.quantity_liters ??
    row.qty ??
    row.quantity ??
    fallbackQty ??
    null;
  const product =
    row.milk_type ||
    row.product ||
    fallbackProduct ||
    "Milk";

  return {
    id: String(row.id ?? `delivery-${index}`),
    date: formatDateLabel(dateSource),
    product,
    qty: qty != null ? `${qty} L` : "-",
    status: toTitleStatus(row.status),
    time: toTitleStatus(row.status) === "DELIVERED" ? formatTimeLabel(timeSource) : null,
  };
};

const tryFetchFromTable = async (table, customerId) => {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    const message = String(error.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) return null;
    throw error;
  }

  return data || [];
};

export const getCustomerDeliveries = async (customerId) => {
  // Try common table names used across variants of this project.
  const rows =
    (await tryFetchFromTable("deliveries", customerId)) ??
    (await tryFetchFromTable("milk_deliveries", customerId)) ??
    [];

  if (rows.length > 0) {
    return rows.map((row, index) =>
      mapDeliveryRow(row, index, null, null)
    );
  }

  return [];
};
