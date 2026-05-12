import crypto from "crypto";
import { supabase } from "../config/supabase.js";
import { logger } from "../utils/logger.js";

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const getAllowedCorsOrigins = () => {
  const configured = parseCsv(process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN);
  if (configured.length) return configured;
  return ["http://localhost:5173", "http://localhost:3000"];
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
  return (req, res, next) => {
    const key = `${getIp(req)}:${req.requestFingerprint || "none"}`;
    const now = Date.now();
    const bucket = seen.get(key) || { count: 0, resetAt: now + 60_000 };
    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + 60_000;
    }
    bucket.count += 1;
    seen.set(key, bucket);
    if (bucket.count > Number(process.env.BOT_PROTECTION_RATE_PER_MINUTE || 600)) {
      return res.status(429).json({ success: false, error: "Request volume is temporarily restricted" });
    }
    next();
  };
}

export const createRateLimiter = ({
  windowMs = 60_000,
  max = 120,
  keyPrefix = "global",
} = {}) => {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const key = `${keyPrefix}:${ip}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please retry shortly.",
      });
    }

    return next();
  };
};

export const marketplaceRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.MARKETPLACE_RATE_LIMIT_PER_MINUTE || 60),
  keyPrefix: "marketplace",
});

export const webhookRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE || 300),
  keyPrefix: "webhook",
});
