import { listPublicDairies, getPublicDairyById } from "../../services/public/dairies.service.js";

export const getPublicDairies = async (req, res) => {
  try {
    const search = req.query.search || "";
    
    // 1. Extract location parameters from the query string
    const lat = req.query.lat ? parseFloat(req.query.lat) : null;
    const lng = req.query.lng ? parseFloat(req.query.lng) : null;
    const radius = req.query.radius ? parseFloat(req.query.radius) : 10; // Default to 10km

    // 2. Pass these to the service
    // We include search, lat, lng, and radius to enable filtered discovery
    const dairies = await listPublicDairies({ 
      search, 
      lat, 
      lng, 
      radius 
    });

    res.json({ dairies });
  } catch (err) {
    console.error("PUBLIC DAIRIES ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch dairies" });
  }
};

export const getPublicDairy = async (req, res) => {
  try {
    const { id } = req.params;
    const dairy = await getPublicDairyById(id);
    res.json({ dairy });
  } catch (err) {
    console.error("PUBLIC DAIRY ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch dairy" });
  }
};