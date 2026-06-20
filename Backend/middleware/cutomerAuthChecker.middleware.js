import { verifyAccessToken } from "../utils/jwt.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    const decoded = await verifyAccessToken(token);

    // ✅ SECURITY ADDITION: Check if it's actually a customer token
    if (decoded.role !== "CUSTOMER") {
        return res.status(403).json({ message: "Access denied. Customers only." });
    }

    req.customer = {
      id: decoded.id,
      email: decoded.email,
      dairyId: decoded.dairyId ?? null,
      role: decoded.role // Good to keep track of role
    };

    next();
  } catch (err) {
    console.error("[CUSTOMER AUTH] token verification error:", {
      name: err?.name,
      message: err?.message || String(err),
    });
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
