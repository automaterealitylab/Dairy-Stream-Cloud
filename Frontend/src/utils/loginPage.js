// ================= LOGIN DATA HELPERS (pure) =================

export const normalizeIdentifier = (identifier) => String(identifier || "").trim();

export const normalizeStaffId = (identifier) => String(identifier || "").trim().toUpperCase();

export const sanitizeOtp = (value) => value.replace(/\D/g, "").slice(0, 6);

export const validateIdentifier = (normalizedIdentifier) => {
  const isEmail = normalizedIdentifier.includes("@");
  const isStaffId = normalizedIdentifier.toUpperCase().startsWith("STF");
  const isMobile = /^\d{10}$/.test(normalizedIdentifier);
  return { isEmail, isStaffId, isMobile };
};

export const getErrorMessage = (err, fallback) =>
  err.response?.data?.message ||
  err.response?.data?.error ||
  err.message ||
  fallback;

export const getOtpRequestsRemaining = (result) =>
  typeof result?.remainingRequests === "number" ? result.remainingRequests : null;
