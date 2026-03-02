import {
  getNearbyDairies,
  searchDairies,
  getCityDairies,
  getPublicDairyById,
  getSearchSuggestions
} from "../../services/public/dairies.service.js";

export const getNearbyDairiesController = async (req, res) => {
  try {
    const { lat, lng, radius = "10", page = "0" } = req.query;

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedRadius = Number(radius);
    const parsedPage = Number(page);

    if (
      Number.isNaN(parsedLat) ||
      Number.isNaN(parsedLng) ||
      Number.isNaN(parsedRadius) ||
      Number.isNaN(parsedPage)
    ) {
      return res.status(400).json({ message: "Invalid geo parameters" });
    }

    const dairies = await getNearbyDairies(
      parsedLat,
      parsedLng,
      parsedRadius,
      parsedPage,
    );

    res.json({ dairies });
  } catch (err) {
    console.error("NEARBY DAIRIES ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch nearby dairies" });
  }
};

export const getSearchDairiesController = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const trimmed = String(q).trim();

    if (!trimmed) {
      return res.json({ dairies: [] });
    }

    const dairies = await searchDairies(trimmed);
    res.json({ dairies });
  } catch (err) {
    console.error("SEARCH DAIRIES ERROR:", err.message);
    res.status(500).json({ message: "Failed to search dairies" });
  }
};


export const getSearchSuggestionsController = async (req, res) => {
  try {
    const { q } = req.query;

    const suggestions = await getSearchSuggestions(q);

    // disable caching
    res.set("Cache-Control", "no-store");

    res.json({
      suggestions
    });

  } catch (error) {
    console.error("SEARCH SUGGESTION ERROR:", error.message);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
};
export const getCityDairiesController = async (req, res) => {
  try {
    const { city = "" } = req.query;
    const trimmed = String(city).trim();

    if (!trimmed) {
      return res.json({ dairies: [] });
    }

    const dairies = await getCityDairies(trimmed);
    res.json({ dairies });
  } catch (err) {
    console.error("CITY DAIRIES ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch city dairies" });
  }
};

export const getPublicDairy = async (req, res) => {
  try {
    const { id } = req.params;

    const dairy = await getPublicDairyById(id);

    res.json({ dairy });
  } catch (err) {
    console.error("PUBLIC DAIRY ERROR:", err.message);

    res.status(500).json({
      message: "Failed to fetch dairy",
    });
  }
};
