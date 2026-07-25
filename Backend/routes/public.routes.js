import express from "express";
import { createRateLimiter } from "../middleware/security.middleware.js";

import {
  getNearbyDairiesController,
  getSearchDairiesController,
  getCityDairiesController,
  getPublicDairy,
  getSearchSuggestionsController
} from "../controllers/public/dairies.controller.js";

const router = express.Router();
const publicSearchRateLimit = createRateLimiter({ windowMs: 60_000, max: 60, keyPrefix: "public-dairy-search" });

// Public Dairy Listings
router.get("/dairies/search", publicSearchRateLimit, getSearchDairiesController);
router.get("/dairies/suggestions", publicSearchRateLimit, getSearchSuggestionsController);

router.get("/dairies/nearby", publicSearchRateLimit, getNearbyDairiesController);

router.get("/dairies/city", publicSearchRateLimit, getCityDairiesController);
router.get("/dairies/:id", getPublicDairy);


export default router;
