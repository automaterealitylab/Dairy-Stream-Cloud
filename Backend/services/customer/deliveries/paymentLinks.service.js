// Payment-link helpers for one-time delivery orders: matching payment rows to
// deliveries via the notes description and standalone-method detection.

import { supabase } from "../../../config/supabase.js";
import { normalizeOneTimePaymentMethod } from "./normalizers.js";

export const parseDeliveryIdFromPaymentDescription = (description) => {
  const text = String(description || "");
  const match = text.match(/delivery_id=(\d+)/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const paymentDescriptionIncludesDeliveryId = (description, orderId) => {
  const text = String(description || "");
  const normalizedId = Number(orderId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return false;
  if (parseDeliveryIdFromPaymentDescription(text) === normalizedId) return true;

  const bundleMatch = text.match(/delivery_ids=([0-9,\s]+)/i);
  if (!bundleMatch) return false;

  return bundleMatch[1]
    .split(",")
    .map((value) => Number(String(value || "").trim()))
    .some((value) => value === normalizedId);
};

export const findLinkedOneTimePayment = async ({
  customerId,
  orderId,
  paymentId = null,
  dairyId = null,
} = {}) => {
  if (paymentId) {
    const { data, error } = await supabase
      .from("payments")
      .select("id, customer_id, dairy_id, amount, status, description, created_at")
      .eq("id", paymentId)
      .eq("customer_id", customerId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  let query = supabase
    .from("payments")
    .select("id, customer_id, dairy_id, amount, status, description, created_at")
    .eq("customer_id", customerId)
    .or(`description.ilike.%delivery_id=${orderId}%,description.ilike.%delivery_ids=%${orderId}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (dairyId != null) {
    query = query.eq("dairy_id", dairyId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return (
    rows.find((row) => paymentDescriptionIncludesDeliveryId(row?.description, orderId)) ||
    rows[0] ||
    null
  );
};

export const isStandaloneOneTimePaymentMethod = (paymentMethod) =>
  normalizeOneTimePaymentMethod(paymentMethod) === "PAY_NOW";
