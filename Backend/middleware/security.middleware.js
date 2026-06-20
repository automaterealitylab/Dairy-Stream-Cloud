import crypto from "crypto";
import { getRedisConnection } from "../config/redis.js";
import { supabase } from "../config/supabase.js";
import { logger } from "../utils/logger.js";
import { getSetting } from "../services/shared/appSettings.service.js";

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const DEFAULT_CORS_ORIGINS = [
  "https://dairy-stream-cloud-fronten.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

export const getAllowedCorsOrigins = () => {
  const configured = [
    ...parseCsv(process.env.CORS_ORIGINS),
    ...parseCsv(process.env.FRONTEND_ORIGIN),
    ...parseCsv(process.env.FRONTEND_URL),
  ];
  return [...new Set([...DEFAULT_CORS_ORIGINS, ...configured])];
};

export const secureHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'self'");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
};

const getIp = (req) =>
  req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
  req.socket?.remoteAddress ||
  "unknown";

export const requestFingerprinting = async (req, res, next) => {
  const fingerprintSource = [
    getIp(req),
    req.headers["user-agent"] || "",
    req.headers["accept-language"] || "",
  ].join("|");
  req.requestFingerprint = crypto.createHash("sha256").update(fingerprintSource).digest("hex");
  res.setHeader("X-Request-Fingerprint", req.requestFingerprint.slice(0, 16));

  if (String(process.env.SECURITY_AUDIT_DB_ENABLED || "false").toLowerCase() === "true") {
    supabase.from("security_events").insert({
      event_type: "REQUEST_FINGERPRINTED",
      severity: "INFO",
      ip_address: getIp(req),
      user_agent: req.headers["user-agent"] || null,
      fingerprint: req.requestFingerprint,
      path: req.originalUrl,
      method: req.method,
      correlation_id: req.correlationId || null,
    }).then(({ error }) => {
      if (error) logger.warn("security_audit_write_failed", { error: error.message });
    });
  }
  next();
};

export const validateApiSignature = (req, res, next) => {
  const secret = String(process.env.API_REQUEST_SIGNING_SECRET || "").trim();
  if (!secret || String(process.env.API_REQUEST_SIGNING_REQUIRED || "false").toLowerCase() !== "true") {
    return next();
  }

  const signature = String(req.headers["x-api-signature"] || "");
  const timestamp = Number(req.headers["x-api-timestamp"] || 0);
  if (!signature || !timestamp || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return res.status(401).json({ success: false, error: "Invalid request signature" });
  }

  const body = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${req.method}.${req.originalUrl}.${body}`).digest("hex");
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return res.status(401).json({ success: false, error: "Invalid request signature" });
  }
  return next();
};

export const csrfProtection = (req, res, next) => {
  if (String(process.env.CSRF_PROTECTION_REQUIRED || "false").toLowerCase() !== "true") {
    return next();
  }
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (String(req.originalUrl || "").includes("/api/webhooks/raw")) return next();

  const headerToken = String(req.headers["x-csrf-token"] || "");
  const cookieToken = String(req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrf_token="))
    ?.split("=")[1];

  if (!headerToken || !cookieToken || headerToken !== decodeURIComponent(cookieToken)) {
    return res.status(403).json({ success: false, error: "CSRF token validation failed" });
  }
  return next();
};

const ipInCidr = (ip, cidr) => {
  if (!cidr || cidr.includes(":") || ip.includes(":")) return ip === cidr;
  const [range, bitsText] = cidr.split("/");
  const bits = Number(bitsText || 32);
  const toInt = (value) => value.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (toInt(ip) & mask) === (toInt(range) & mask);
};

export const validateWebhookIp = (req, res, next) => {
  const allowlist = parseCsv(process.env.RAZORPAY_WEBHOOK_IP_ALLOWLIST);
  if (!allowlist.length) return next();
  const ip = getIp(req);
  if (allowlist.some((entry) => ipInCidr(ip, entry))) return next();
  return res.status(403).json({ success: false, error: "Webhook source IP is not allowed" });
};

export const ssrfGuard = (req, res, next) => {
  const payload = JSON.stringify(req.body || {});
  const blocked = [
    "169.254.169.254",
    "metadata.google.internal",
    "localhost",
    "127.0.0.1",
    "::1",
  ];
  if (blocked.some((value) => payload.includes(value))) {
    return res.status(400).json({ success: false, error: "Blocked unsafe URL in request payload" });
  }
  next();
};

export const botProtection = createBotProtection();

function createBotProtection() {
  const seen = new Map();
  return async (req, res, next) => {
    const key = `${getIp(req)}:${req.requestFingerprint || "none"}`;
    const now = Date.now();
    const limit = Number(process.env.BOT_PROTECTION_RATE_PER_MINUTE || 600);
    const redis = getRedisConnection();

    if (redis) {
      try {
        const redisKey = `bot:${key}`;
        const count = await redis.incr(redisKey);
        if (count === 1) await redis.pexpire(redisKey, 60_000);
        if (count > limit) {
          return res.status(429).json({ success: false, error: "Request volume is temporarily restricted" });
        }
        return next();
      } catch (err) {
        logger.warn("redis_bot_protection_failed_using_memory_fallback", { error: err.message });
      }
    }

    const bucket = seen.get(key) || { count: 0, resetAt: now + 60_000 };
    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + 60_000;
    }
    bucket.count += 1;
    seen.set(key, bucket);
    if (bucket.count > limit) {
      return res.status(429).json({ success: false, error: "Request volume is temporarily restricted" });
    }
    next();
  };
}

export const createRateLimiter = ({
  windowMs = 60_000,
  max = 120,
  keyPrefix = "global",
  settingKey = null,
} = {}) => {
  const buckets = new Map();
  let cachedMax = max;
  let lastSettingsFetchTime = 0;
  const SETTINGS_CACHE_INTERVAL = 5 * 60 * 1000; // 5 minutes

  return async (req, res, next) => {
    let now = Date.now();

    // Fetch dynamic limit from database if settingKey is provided
    if (settingKey) {
      if (now - lastSettingsFetchTime > SETTINGS_CACHE_INTERVAL) {
        try {
          const value = await getSetting(settingKey, max);
          cachedMax = Number(value) || max;
          lastSettingsFetchTime = now;
        } catch (err) {
          logger.warn(`Failed to fetch rate limit setting ${settingKey}:`, err.message);
          // Use cached value on error
        }
      }
    }

    const ip = getIp(req);
    const key = `${keyPrefix}:${ip}`;
    const redis = getRedisConnection();

    if (redis) {
      try {
        const redisKey = `rate:${key}`;
        const count = await redis.incr(redisKey);
        if (count === 1) await redis.pexpire(redisKey, windowMs);
        const ttlMs = await redis.pttl(redisKey);

        res.setHeader("X-RateLimit-Limit", String(cachedMax));
        res.setHeader("X-RateLimit-Remaining", String(Math.max(0, cachedMax - count)));
        if (ttlMs > 0) res.setHeader("X-RateLimit-Reset", String(Math.ceil(ttlMs / 1000)));

        if (count > cachedMax) {
          res.setHeader("Retry-After", String(Math.max(1, Math.ceil(ttlMs / 1000))));
          return res.status(429).json({
            success: false,
            error: "Too many requests. Please retry shortly.",
          });
        }

        return next();
      } catch (err) {
        logger.warn("redis_rate_limit_failed_using_memory_fallback", {
          keyPrefix,
          error: err.message,
        });
      }
    }

    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > cachedMax) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please retry shortly.",
      });
    }

    return next();
  };
};

export const apiRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.API_RATE_LIMIT_PER_MINUTE || 300),
  keyPrefix: "api",
  settingKey: "API_RATE_LIMIT_PER_MINUTE",
});

export const authRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE || 30),
  keyPrefix: "auth",
  settingKey: "AUTH_RATE_LIMIT_PER_MINUTE",
});

export const marketplaceRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.MARKETPLACE_RATE_LIMIT_PER_MINUTE || 60),
  keyPrefix: "marketplace",
  settingKey: "MARKETPLACE_RATE_LIMIT_PER_MINUTE",
});

export const webhookRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE || 300),
  keyPrefix: "webhook",
  settingKey: "WEBHOOK_RATE_LIMIT_PER_MINUTE",
});
