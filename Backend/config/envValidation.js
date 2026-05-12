import { logger } from "../utils/logger.js";

const requiredInProduction = [
  "JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

export const validateRuntimeEnv = () => {
  const missing = [];
  if (process.env.NODE_ENV === "production") {
    for (const key of requiredInProduction) {
      if (!String(process.env[key] || "").trim()) missing.push(key);
    }
  }

  if (process.env.REDIS_ENABLED === "true" && !String(process.env.REDIS_URL || "").trim()) {
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
    redisEnabled: process.env.REDIS_ENABLED === "true" || Boolean(process.env.REDIS_URL),
    apiSigningRequired: process.env.API_REQUEST_SIGNING_REQUIRED === "true",
  });
};
