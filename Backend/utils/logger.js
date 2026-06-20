const redactKeys = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "secret",
  "key_secret",
  "razorpay_signature",
]);

const redact = (value) => {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      redactKeys.has(String(key).toLowerCase()) ? "[REDACTED]" : redact(entry),
    ])
  );
};

const write = (level, message, meta = {}) => {
  const payload = {
    level,
    message,
    service: "dairy-stream-backend",
    timestamp: new Date().toISOString(),
    ...redact(meta),
  };

  const line = JSON.stringify(payload);
  if (level === "error") return console.error(line);
  if (level === "warn") return console.warn(line);
  return console.log(line);
};

export const logger = {
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
};

export const logError = (message, err, meta = {}) =>
  logger.error(message, {
    ...meta,
    error: {
      name: err?.name,
      message: err?.message || String(err),
      stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
      statusCode: err?.statusCode || err?.status,
    },
  });
