import crypto from "crypto";
import { logger } from "../../utils/logger.js";

const parseSentryDsn = (dsnValue) => {
  try {
    const parsed = new URL(dsnValue);
    const publicKey = parsed.username;
    const projectId = parsed.pathname.replace("/", "");
    if (!parsed.host || !publicKey || !projectId) return null;
    return {
      publicKey,
      projectId,
      envelopeUrl: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
};

export const captureException = async (err, context = {}) => {
  const dsn = String(process.env.SENTRY_DSN || "").trim();
  if (!dsn) return { skipped: true };

  const sentry = parseSentryDsn(dsn);
  if (!sentry) return { skipped: true, reason: "invalid_dsn" };

  const eventId = crypto.randomUUID().replaceAll("-", "");
  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    logger: "dairy-stream-backend",
    environment: process.env.NODE_ENV || "development",
    message: err?.message || String(err),
    exception: {
      values: [
        {
          type: err?.name || "Error",
          value: err?.message || String(err),
          stacktrace: err?.stack
            ? {
                frames: String(err.stack)
                  .split("\n")
                  .slice(1, 30)
                  .map((line) => ({ function: line.trim() })),
              }
            : undefined,
        },
      ],
    },
    tags: {
      service: "dairy-stream-backend",
      correlationId: context.correlationId,
      path: context.path,
      method: context.method,
    },
    extra: context,
  };

  const envelope = [
    JSON.stringify({ event_id: eventId, dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  try {
    const response = await fetch(sentry.envelopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${sentry.publicKey}, sentry_client=dairy-stream/1.0`,
      },
      body: envelope,
    });
    return { sent: response.ok, status: response.status, eventId };
  } catch (sendError) {
    logger.warn("sentry_capture_failed", { error: sendError.message });
    return { sent: false, error: sendError.message };
  }
};
