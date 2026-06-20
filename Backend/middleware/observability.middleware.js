import crypto from "crypto";
import { logger, logError } from "../utils/logger.js";
import { metrics } from "../utils/metrics.js";
import { captureException } from "../services/shared/errorTracking.service.js";

export const correlationMiddleware = (req, res, next) => {
  const incoming =
    req.headers["x-correlation-id"] ||
    req.headers["x-request-id"] ||
    crypto.randomUUID();
  req.correlationId = String(incoming).slice(0, 128);
  res.setHeader("X-Correlation-Id", req.correlationId);

  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    metrics.increment("http_requests", {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
    metrics.observe("http_request_duration_ms", { method: req.method, status: res.statusCode }, durationMs);
    logger.info("http_request", {
      correlationId: req.correlationId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
    });
  });

  next();
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, error: "Route not found", correlationId: req.correlationId });
};

export const globalErrorHandler = (err, req, res, next) => {
  logError("global_error", err, {
    correlationId: req?.correlationId,
    method: req?.method,
    path: req?.originalUrl,
  });
  captureException(err, {
    correlationId: req?.correlationId,
    method: req?.method,
    path: req?.originalUrl,
    statusCode: err?.statusCode || err?.status || 500,
  }).catch(() => null);

  if (err?.type === "entity.too.large" || err?.status === 413) {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large",
      error: err.message,
      correlationId: req.correlationId,
    });
  }

  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: status >= 500 ? "Internal Server Error" : err.message,
    error: process.env.NODE_ENV === "production" && status >= 500 ? undefined : err.message,
    correlationId: req.correlationId,
  });
};
