// Pure normalization/validation helpers for the marketplace domain: string
// cleaning, environment-driven config, Route-status checks and error shaping.

import crypto from "crypto";

export const normalizeString = (value) => String(value || "").trim();
export const normalizeEmail = (value) => normalizeString(value).toLowerCase();
export const normalizeDigits = (value) => normalizeString(value).replace(/\D/g, "");
export const normalizeIfsc = (value) => normalizeString(value).toUpperCase();
export const normalizePan = (value) => normalizeString(value).toUpperCase();
export const normalizeStatus = (value) => normalizeString(value).toUpperCase();

export const isWebhookQueueRequired = () =>
  String(process.env.WEBHOOK_QUEUE_REQUIRED || "false").toLowerCase() === "true";

export const getTaxPercent = () => {
  const value = Number(process.env.MARKETPLACE_TAX_PERCENT || 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
};

export const getDeliveryFee = () => {
  const value = Number(process.env.MARKETPLACE_DELIVERY_FEE || 0);
  return Number.isFinite(value) && value >= 0 ? Number(value.toFixed(2)) : 0;
};

export const requireField = (payload, key, label = key) => {
  const value = normalizeString(payload?.[key]);
  if (!value) {
    const error = new Error(`${label} is required`);
    error.statusCode = 400;
    throw error;
  }
  return value;
};

export const parseRouteError = (err, fallback) => {
  const description =
    err?.response?.data?.error?.description ||
    err?.response?.data?.error?.reason ||
    err?.response?.data?.message ||
    err?.message ||
    fallback;
  const error = new Error(description);
  error.statusCode = err?.response?.status || err?.statusCode || 400;
  throw error;
};

export const getSyntheticMarketplaceEmail = (phone) =>
  `marketplace-${normalizeDigits(phone)}@dairy-stream.local`;

export const getSyntheticMarketplacePassword = () =>
  `marketplace:${crypto.randomBytes(24).toString("hex")}`;

export const isRouteStatusBlocking = (status) =>
  ["RAZORPAY_SETUP_FAILED", "REJECTED", "SUSPENDED", "DISABLED", "FAILED"].includes(
    normalizeStatus(status)
  );

export const isDairyRouteReady = (dairy) =>
  Boolean(dairy?.payments_enabled) &&
  Boolean(normalizeString(dairy?.razorpay_account_id) || normalizeString(dairy?.razorpay_linked_account_id)) &&
  !isRouteStatusBlocking(dairy?.route_activation_status || dairy?.razorpay_onboarding_status);

export const isActivationStatusEnabled = (status) =>
  ["ACTIVE", "ACTIVATED", "ENABLED", "LINKED"].includes(normalizeStatus(status));

export const razorpayOrderIdFromPayload = (payload = {}) =>
  payload?.payload?.payment?.entity?.order_id ||
  payload?.payload?.order?.entity?.id ||
  payload?.payload?.transfer?.entity?.source ||
  null;
