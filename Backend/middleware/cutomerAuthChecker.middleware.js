import jwt from "jsonwebtoken";

export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const jwtSecret = process.env.JWT_SECRET;

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

    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      });
    }

    const decoded = jwt.verify(token, jwtSecret);

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
