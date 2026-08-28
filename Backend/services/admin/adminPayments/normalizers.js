// Display-status normalization for the admin payments domain.

export const normalizePaymentDisplayStatus = (row = {}) => {
  const rawStatus = String(row?.status || "PENDING").toUpperCase();
  const verificationStatus = String(row?.verification_status || "").toUpperCase();
  if (rawStatus !== "PAID" && verificationStatus === "SUBMITTED") {
    return "PAID";
  }
  return rawStatus;
};
