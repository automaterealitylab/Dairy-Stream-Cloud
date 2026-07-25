import { verifyAccessToken } from "../utils/jwt.js";


export const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "Missing authorization header" });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Invalid authorization format" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = await verifyAccessToken(token);

    if (decoded.role !== "admin" && decoded.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired. Please login again." });
    }
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
