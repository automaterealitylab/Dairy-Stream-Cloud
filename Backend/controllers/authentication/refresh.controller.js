import { refreshAuthSession } from "../../utils/jwt.js";
import { logger } from "../../utils/logger.js";

const REFRESH_TIMEOUT_MS = 10000; // 10 second timeout

const withTimeout = async (promise, timeoutMs) => {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) =>
    (timeoutHandle = setTimeout(() => reject(new Error("Request timeout")), timeoutMs))
  );
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
};

export const refreshAuth = async (req, res) => {
  try {
    const { sessionId, refreshToken } = req.body || {};

    // Validate required fields
    if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid session ID is required",
      });
    }
    if (!refreshToken || typeof refreshToken !== "string" || refreshToken.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid refresh token is required",
      });
    }

    // Perform refresh with timeout protection
    const tokens = await withTimeout(
      refreshAuthSession({
        sessionId: sessionId.trim(),
        refreshToken: refreshToken.trim(),
        id: req.user?.id ?? null,
        email: req.user?.email ?? null,
        role: req.user?.role ?? null,
        dairyId: req.user?.dairyId ?? null,
        agentId: req.user?.agentId ?? null,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      }),
      REFRESH_TIMEOUT_MS
    );

    res.json({ success: true, ...tokens });
  } catch (err) {
    const message = String(err?.message || "").toLowerCase();
    const correlationId = req.correlationId || null;

    // Invalid or expired token
    if (message.includes("invalid or expired refresh token")) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    // Timeout
    if (message.includes("timeout")) {
      logger.warn("refresh_token_timeout", {
        correlationId,
        sessionId: req.body?.sessionId,
      });
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable. Please retry.",
      });
    }

    // Database or infrastructure errors
    if (message.includes("connection") || message.includes("network") || message.includes("enotfound") || message.includes("etimedout")) {
      logger.error("refresh_token_infra_error", {
        correlationId,
        error: err.message,
      });
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable. Please retry.",
      });
    }

    // Supabase or unknown errors
    logger.error("refresh_token_failed", {
      correlationId,
      error: err.message,
      code: err.code,
    });
    return res.status(500).json({
      success: false,
      message: "Token refresh failed",
    });
  }
};
