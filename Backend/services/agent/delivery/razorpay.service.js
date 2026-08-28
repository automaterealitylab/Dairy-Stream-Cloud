// Razorpay client construction and per-dairy linked-account resolution, plus
// the in-memory cache for generated online-collection payment links.

import Razorpay from "razorpay";
import { supabase } from "../../../config/supabase.js";
import { getRazorpayConfig } from "../../../config/razorpay.js";
import { isMissingColumnError } from "../../../utils/dbErrors.js";

export const onlineCollectionCache = new Map();

export const getRazorpayClient = () => {
  const { keyId, keySecret } = getRazorpayConfig();

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

export const getDairyLinkedAccountId = async (dairyId) => {
  if (!dairyId) return null;

  const { data, error } = await supabase
    .from("dairies")
    .select("id, dairy_name, razorpay_linked_account_id")
    .eq("id", dairyId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      const missingConfigError = new Error(
        "Database is missing dairy Razorpay Route configuration. Run the latest migrations first."
      );
      missingConfigError.statusCode = 500;
      throw missingConfigError;
    }
    throw error;
  }

  const linkedAccountId = String(data?.razorpay_linked_account_id || "").trim();
  if (!linkedAccountId) {
    const configError = new Error(
      `Dairy ${data?.dairy_name || ""}`.trim()
        ? `${data?.dairy_name} is not configured for direct Razorpay settlement yet.`
        : "This dairy is not configured for direct Razorpay settlement yet."
    );
    configError.statusCode = 400;
    throw configError;
  }

  return linkedAccountId;
};
