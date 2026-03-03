import express from "express";

import {
  getNearbyDairiesController,
  getSearchDairiesController,
  getCityDairiesController,
  getPublicDairy,
  getSearchSuggestionsController
} from "../controllers/public/dairies.controller.js";

const router = express.Router();

// Public Dairy Listings
router.get("/dairies/search", getSearchDairiesController);
router.get("/dairies/suggestions", getSearchSuggestionsController);

router.get("/dairies/nearby", getNearbyDairiesController);

router.get("/dairies/city", getCityDairiesController);
router.get("/dairies/:id", getPublicDairy);


export default router;