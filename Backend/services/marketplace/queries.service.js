// Marketplace database read helpers: dairy lookup (with field decryption),
// order lookup by Razorpay order id and first-transfer resolution.

import { supabase } from "../../config/supabase.js";
import { decryptDairyFields } from "../admin/dairy.service.js";
import { fetchOrderTransfers } from "./razorpayRoute.service.js";

export const getDairyById = async (dairyId) => {
  const id = Number(dairyId);
  if (!Number.isFinite(id) || id <= 0) {
    const error = new Error("Valid dairy is required");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from("dairies")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const notFound = new Error("Dairy not found");
    notFound.statusCode = 404;
    throw notFound;
  }
  return decryptDairyFields(data);
};

export const getOrderByRazorpayOrderId = async (razorpayOrderId) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("razorpay_order_id", razorpayOrderId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const getFirstOrderTransfer = async (orderId) => {
  try {
    const transfers = await fetchOrderTransfers(orderId);
    return transfers[0] || null;
  } catch {
    return null;
  }
};
