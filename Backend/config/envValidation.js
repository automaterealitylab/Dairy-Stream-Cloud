import { logger } from "../utils/logger.js";

const requiredInProduction = [
  "JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const hasAny = (keys) => keys.some((key) => String(process.env[key] || "").trim());
const weakJwtSecrets = new Set([
  "secret",
  "jwt_secret",
  "changeme",
  "password",
  "development-secret",
]);

const validateJwtSecretStrength = () => {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) return;
  if (secret.length < 32 || weakJwtSecrets.has(secret.toLowerCase())) {
    throw new Error("JWT_SECRET must be at least 32 characters and non-default");
  }
};

export const validateRuntimeEnv = () => {
  const missing = [];
  const redisEnabled = String(process.env.REDIS_ENABLED || "").trim().toLowerCase();
  const isRedisEnabled =
    redisEnabled === "true" ||
    (redisEnabled !== "false" && Boolean(String(process.env.REDIS_URL || "").trim()));

  if (process.env.NODE_ENV === "production") {
    for (const key of requiredInProduction) {
      if (!String(process.env[key] || "").trim()) missing.push(key);
    }

    if (!hasAny(["DATA_ENCRYPTION_KEY", "BANK_ACCOUNT_ENCRYPTION_KEY", "BANK_VERIFICATION_ENCRYPTION_KEY"])) {
      missing.push("DATA_ENCRYPTION_KEY or BANK_ACCOUNT_ENCRYPTION_KEY");
    }

    if (!hasAny(["CORS_ORIGINS", "FRONTEND_ORIGIN", "FRONTEND_URL"])) {
      missing.push("CORS_ORIGINS or FRONTEND_ORIGIN");
    }

    if (String(process.env.DEBUG_AUTH_LOGS || "false").toLowerCase() === "true") {
      throw new Error("DEBUG_AUTH_LOGS must be false or unset in production");
    }

    if (String(process.env.RAZORPAY_MOCK || "false").toLowerCase() === "true") {
      throw new Error("RAZORPAY_MOCK must be false or unset in production");
    }
  }

  validateJwtSecretStrength();

  if (process.env.SUPABASE_URL && !String(process.env.SUPABASE_URL).startsWith("https://")) {
    throw new Error("SUPABASE_URL must use HTTPS");
  }

  if (redisEnabled === "true" && !String(process.env.REDIS_URL || "").trim()) {
    missing.push("REDIS_URL");
  }

  if (process.env.API_REQUEST_SIGNING_REQUIRED === "true" && !String(process.env.API_REQUEST_SIGNING_SECRET || "").trim()) {
    missing.push("API_REQUEST_SIGNING_SECRET");
  }

  if (missing.length) {
    throw new Error(`Missing required runtime environment variables: ${missing.join(", ")}`);
  }

  logger.info("runtime_env_validated", {
    nodeEnv: process.env.NODE_ENV || "development",
    redisEnabled: isRedisEnabled,
    apiSigningRequired: process.env.API_REQUEST_SIGNING_REQUIRED === "true",
  });
};




