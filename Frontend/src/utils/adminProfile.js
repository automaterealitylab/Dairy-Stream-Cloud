// Pure helpers and static config for the Admin Profile page.

export const isCiphertext = (val) =>
  typeof val === "string" && val.startsWith("ENC_DET:aes-256-gcm:");

export const sanitizeEncryptedValues = (value) => {
  if (typeof value === "string") {
    return isCiphertext(value) ? "" : value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeEncryptedValues);
  }
  if (value && typeof value === "object") {
    const sanitized = {};
    for (const key of Object.keys(value)) {
      sanitized[key] = sanitizeEncryptedValues(value[key]);
    }
    return sanitized;
  }
  return value;
};

/**
 * Reads the cached admin object from localStorage but strips any field values
 * that are still raw ciphertext. This prevents showing encrypted strings in
 * the UI during the brief window before the live API response arrives.
 */
export const readStoredAdmin = () => {
  let parsed = null;
  try {
    const directAdmin = localStorage.getItem("adminUser");
    if (directAdmin) parsed = JSON.parse(directAdmin);
  } catch {
    // ignore
  }

  if (!parsed) {
    try {
      const user = localStorage.getItem("user");
      if (user) {
        const p = JSON.parse(user);
        if (String(p?.role || "").toUpperCase() === "ADMIN") parsed = p;
      }
    } catch {
      // ignore
    }
  }

  if (!parsed) return null;
  return sanitizeEncryptedValues(parsed);
};

export const buildFormFromProfile = (dairy = {}, admin = {}) => ({
  dairy_name: dairy?.dairy_name || "",
  dairy_email: dairy?.dairy_email || "",
  dairy_phone: dairy?.dairy_phone || "",
  address: dairy?.address || "",
  city: dairy?.city || "",
  state: dairy?.state || "",
  pincode: dairy?.pincode || "",
  owner_name: dairy?.owner_name || admin?.name || "",
  admin_email: admin?.email || "",
  admin_phone: admin?.phone || admin?.phone_number || "",
  bank_account_holder_name: dairy?.bank_account_holder_name || "",
  bank_account_number: dairy?.bank_account_number || "",
  masked_account_number: dairy?.masked_account_number || dairy?.bank_account_number || "",
  bank_account_number_revealed: dairy?.bank_account_number_revealed ?? false,
  bank_ifsc_code: dairy?.bank_ifsc_code || "",
  bank_name: dairy?.bank_name || "",
  bank_branch: dairy?.bank_branch || "",
  upi_id: dairy?.upi_id || "",
  bank_verified: dairy?.bank_verified ?? false,
  verification_provider: dairy?.verification_provider || "",
  verification_reference_id: dairy?.verification_reference_id || "",
  bank_verification_status: dairy?.bank_verification_status || "NOT_SUBMITTED",
  bank_verification_timestamp: dairy?.bank_verification_timestamp || "",
  account_name_match_score: dairy?.account_name_match_score ?? null,
  bank_metadata: dairy?.bank_metadata || {},
  verified_account_holder_name: dairy?.verified_account_holder_name || "",
  verified_upi_id: dairy?.verified_upi_id || "",
  account_verification_response: dairy?.account_verification_response || {},
  verification_attempts: dairy?.verification_attempts || 0,
  verification_last_error: dairy?.verification_last_error || "",
  verification_method: dairy?.verification_method || "",
  vpa_detected: dairy?.vpa_detected ?? false,
  vpa_verified: dairy?.vpa_verified ?? false,
  bank_verification_reset_at: dairy?.bank_verification_reset_at || "",
  verification_required: dairy?.verification_required ?? false,
  account_last_updated_at: dairy?.account_last_updated_at || "",
  payment_instructions: dairy?.payment_instructions || "",
  upi_qr_enabled: dairy?.upi_qr_enabled ?? true,
  bank_transfer_enabled: dairy?.bank_transfer_enabled ?? true,
  pan: dairy?.pan || "",
  one_time_payment_method: dairy?.one_time_payment_method || "DIRECT_UPI",
  subscription_payment_method: dairy?.subscription_payment_method || "DIRECT_UPI",
});

export const getInitials = (name) =>
  String(name || "Admin")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "A";

export const maskValue = (val, visibleChars = 4) => {
  if (!val) return "-";
  const str = String(val);
  if (str.length <= visibleChars) return "•".repeat(str.length);
  return "•".repeat(str.length - visibleChars) + str.slice(-visibleChars);
};

export const maskUpiId = (val) => {
  if (!val) return "-";
  const parts = String(val).split("@");
  if (parts.length < 2) return "•".repeat(val.length);
  const local = parts[0];
  const domain = parts[1];
  const maskedLocal = local.length > 3 ? local.slice(0, 2) + "•".repeat(local.length - 3) + local.slice(-1) : "•".repeat(local.length);
  return `${maskedLocal}@${domain}`;
};

export const isValidIfscFormat = (value) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(value || "").trim().toUpperCase());
export const normalizeAccountNumber = (value) => String(value || "").replace(/\D/g, "");
export const maskAccountNumber = (value) => {
  const normalized = normalizeAccountNumber(value);
  if (!normalized) return "";
  return `${"X".repeat(Math.max(normalized.length - 4, 0))}${normalized.slice(-4)}`;
};

export const formatPaymentMethod = (method) =>
  method === "RAZORPAY" ? "Razorpay Checkout" : "Direct UPI QR";
