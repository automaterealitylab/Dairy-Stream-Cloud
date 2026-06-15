import { verifyAccessToken } from "../utils/jwt.js";

const isDebugAuthLogsEnabled = () => process.env.DEBUG_AUTH_LOGS === "true";

export const verifyAdmin = async (req, res, next) => {
  try {
    const debug = isDebugAuthLogsEnabled();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      if (debug) console.log("No authorization header provided");
      return res.status(401).json({ message: "Missing authorization header" });
    }

    if (!authHeader.startsWith("Bearer ")) {
      if (debug) console.log("Invalid authorization header format");
      return res.status(401).json({ message: "Invalid authorization format" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      if (debug) console.log("No token extracted from authorization header");
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = await verifyAccessToken(token);

    if (decoded.role !== "admin" && decoded.role !== "ADMIN") {
      if (debug) console.log(`User role is ${decoded.role}, admin access required`);
      return res.status(403).json({ message: "Admin access required" });
    }

    req.admin = decoded;
    const isDashboardRequest =
      req.method === "GET" && String(req.originalUrl || "").includes("/admin/dashboard");
    if (isDashboardRequest) {
      console.log(`Admin verified: ${decoded.email || decoded.id}`);
    } else if (debug) {
      console.log(`Admin verified: ${decoded.email || decoded.id}`);
    }
    next();
  } catch (err) {
    if (isDebugAuthLogsEnabled()) {
      console.error("Token verification error:", err.message);
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired. Please login again." });
    }
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
