import { verifyAccessToken } from "../utils/jwt.js";

const isDebugAuthLogsEnabled = () => process.env.DEBUG_AUTH_LOGS === "true";

export const verifySuperAdmin = async (req, res, next) => {
  try {
    const debug = isDebugAuthLogsEnabled();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      if (debug) console.log("No authorization header provided for super admin");
      return res.status(401).json({ message: "Missing authorization header" });
    }

    if (!authHeader.startsWith("Bearer ")) {
      if (debug) console.log("Invalid authorization header format for super admin");
      return res.status(401).json({ message: "Invalid authorization format" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      if (debug) console.log("No token extracted from authorization header for super admin");
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = await verifyAccessToken(token);

    // Verify if the role is a platform-level role
    const normalizedRole = String(decoded.role || "").toUpperCase();
    if (normalizedRole !== "SUPER_ADMIN" && normalizedRole !== "OWNER" && normalizedRole !== "COMPANY_STAFF") {
      if (debug) console.log(`User role is ${decoded.role}, super admin access required`);
      return res.status(403).json({ message: "Super Admin access required" });
    }

    req.superAdmin = decoded;
    next();
  } catch (err) {
    if (isDebugAuthLogsEnabled()) {
      console.error("Super Admin token verification error:", err.message);
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired. Please login again." });
    }
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
