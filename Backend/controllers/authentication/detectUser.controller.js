import jwt from "jsonwebtoken";
import { detectUserService } from "../../services/authentication/detectUser.service.js";

const shouldLogAuthDebug = () => process.env.DEBUG_AUTH_LOGS === "true";

const logDetectDebug = (message, details = {}) => {
  if (shouldLogAuthDebug()) {
    console.log("[AUTH DETECT]", message, details);
  }
};

export const detectUser = async (req, res) => {
  const authHeader = req.headers.authorization;
  let token = null;

  try {
    if (authHeader) {
      if (!authHeader.startsWith("Bearer ")) {
        logDetectDebug("invalid authorization header");
        return res.status(401).json({
          success: false,
          message: "Invalid authorization format",
        });
      }

      token = authHeader.split(" ")[1];

      if (!token) {
        logDetectDebug("empty bearer token");
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }

      if (!process.env.JWT_SECRET) {
        logDetectDebug("missing JWT secret");
        return res.status(500).json({
          success: false,
          message: "JWT secret is not configured",
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      logDetectDebug("decoded jwt", { role: decoded?.role, id: decoded?.id });

      if (!req.body?.identifier) {
        return res.status(200).json({
          success: true,
          user: decoded,
        });
      }
    }

    const { identifier, requestCustomerOtp, dairyId } = req.body;

    if (!identifier) {
      return res.status(400).json({ 
        success: false, 
        message: "Identifier (Email, Phone, or Staff ID) is required" 
      });
    }

    // Call the service logic
    const result = await detectUserService(identifier, {
      requestCustomerOtp,
      dairyId,
    });

    // Send the roadmap back to Frontend
    return res.status(200).json({
      success: true,
      ...result 
      // Returns: { exists, userType, nextStep, name }
    });

  } catch (err) {
    console.error("Detect User Error:", {
      message: err?.message || String(err),
      name: err?.name,
      stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
    });

    if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const rawMessage = String(err?.message || err || "");
    const normalizedMessage = rawMessage.toLowerCase();
    const isOtpDeliveryError =
      normalizedMessage.includes("email delivery failed") ||
      normalizedMessage.includes("email credentials are not configured");
    const isDatabaseError =
      Boolean(err?.code) ||
      normalizedMessage.includes("fetch failed") ||
      normalizedMessage.includes("failed to fetch") ||
      normalizedMessage.includes("database") ||
      normalizedMessage.includes("supabase");

    return res.status(isOtpDeliveryError || isDatabaseError ? 503 : 500).json({
      success: false,
      message: isOtpDeliveryError
        ? rawMessage
        : isDatabaseError
          ? "Database connection unavailable"
        : "Unable to detect user. Please try again." 
    });
  }
};
