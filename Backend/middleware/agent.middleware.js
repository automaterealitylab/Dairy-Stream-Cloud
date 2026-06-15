import { verifyAccessToken } from "../utils/jwt.js";

export const verifyAgent = async (req, res, next) => {
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

    if (String(decoded?.role || "").toUpperCase() !== "AGENT") {
      return res.status(403).json({ message: "Access denied. Agents only." });
    }

    req.agent = {
      id: decoded.id,
      agentId: decoded.agentId,
      dairyId: decoded.dairyId ?? null,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error("[AGENT AUTH] token verification error:", {
      name: err?.name,
      message: err?.message || String(err),
    });
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

