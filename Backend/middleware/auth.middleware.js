import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
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

    // Set user info based on role
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      dairyId: decoded.dairyId ?? null,
    };

    // Also set role-specific properties for backward compatibility
    if (decoded.role === "CUSTOMER") {
      req.customer = req.user;
    } else if (decoded.role === "ADMIN") {
      req.admin = req.user;
    } else if (decoded.role === "AGENT" || decoded.role === "STAFF") {
      req.agent = req.user;
    }

    next();
  } catch (err) {
    console.error("[AUTH MIDDLEWARE] token verification error:", {
      name: err?.name,
      message: err?.message || String(err),
    });
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
