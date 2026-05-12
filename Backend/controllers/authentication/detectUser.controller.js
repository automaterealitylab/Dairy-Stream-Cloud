import jwt from "jsonwebtoken";
import { supabase } from "../../config/supabase.js";
import { detectUserService } from "../../services/authentication/detectUser.service.js";

const maskToken = (token) => {
  if (!token) return null;
  if (token.length <= 12) return "[REDACTED]";
  return `${token.slice(0, 6)}...[${token.length}]...${token.slice(-6)}`;
};

const logDetectRequest = (req, authHeader, token, decodedJwt = null) => {
  console.log("[AUTH DETECT] request headers:", {
    ...req.headers,
    authorization: authHeader ? "Bearer [REDACTED]" : undefined,
  });
  console.log("[AUTH DETECT] authorization token:", maskToken(token));
  if (decodedJwt) console.log("[AUTH DETECT] decoded JWT:", decodedJwt);
};

const verifyDatabaseConnection = async () => {
  const { error } = await supabase.from("customers").select("id").limit(1);
  if (error) {
    console.error("[AUTH DETECT] database lookup error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }
};

export const detectUser = async (req, res) => {
  const authHeader = req.headers.authorization;
  let token = null;

  try {
    if (authHeader) {
      if (!authHeader.startsWith("Bearer ")) {
        logDetectRequest(req, authHeader, null);
        return res.status(401).json({
          success: false,
          message: "Invalid authorization format",
        });
      }

      token = authHeader.split(" ")[1];

      if (!token) {
        logDetectRequest(req, authHeader, token);
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }

      if (!process.env.JWT_SECRET) {
        logDetectRequest(req, authHeader, token);
        return res.status(500).json({
          success: false,
          message: "JWT secret is not configured",
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      logDetectRequest(req, authHeader, token, decoded);

      if (!req.body?.identifier) {
        return res.status(200).json({
          success: true,
          user: decoded,
        });
      }
    } else {
      logDetectRequest(req, authHeader, token);
    }

    const { identifier, requestCustomerOtp, dairyId } = req.body;

    if (!identifier) {
      return res.status(400).json({ 
        success: false, 
        message: "Identifier (Email, Phone, or Staff ID) is required" 
      });
    }

    await verifyDatabaseConnection();

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
