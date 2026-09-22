import express from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import {
  getProperties,
  createProperty,
  getBuildings,
  createBuilding,
  getWings,
  createWing,
  getFloors,
  createFloor,
  getUnits,
  createUnit,
  resolveHierarchy,
} from "../controllers/propertyHierarchy/propertyHierarchy.controller.js";

const router = express.Router();

// Optional authentication middleware: attaches user info if valid token provided, but does not block registration guests
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token) {
      try {
        const decoded = await verifyAccessToken(token);
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          dairy_id: decoded.dairyId ?? null,
          dairyId: decoded.dairyId ?? null,
        };
      } catch (_) {
        // Ignore invalid token for public hierarchy discovery
      }
    }
  }
  next();
};

router.use(optionalAuth);

// Property routes
router.get("/properties", getProperties);
router.post("/properties", createProperty);

// Building routes
router.get("/buildings", getBuildings);
router.post("/buildings", createBuilding);

// Wing routes
router.get("/wings", getWings);
router.post("/wings", createWing);

// Floor routes
router.get("/floors", getFloors);
router.post("/floors", createFloor);

// Unit routes
router.get("/units", getUnits);
router.post("/units", createUnit);

// Single-pass resolve & create route
router.post("/resolve", resolveHierarchy);

export default router;
