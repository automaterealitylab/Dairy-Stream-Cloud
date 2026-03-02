import {
  listPublicDairies,
  getPublicDairyById,
} from "../../services/public/dairies.service.js";

export const getPublicDairies = async (req, res) => {
  try {
    const { search, city, pincode, lat, lng, radius } = req.query;

    const parsedLat = lat !== undefined ? Number(lat) : null;
    const parsedLng = lng !== undefined ? Number(lng) : null;
    const parsedRadius =
      radius !== undefined && !Number.isNaN(Number(radius))
        ? Number(radius)
        : 10;

    const dairies = await listPublicDairies({
      search,
      city,
      pincode,
      lat: parsedLat,
      lng: parsedLng,
      radius: parsedRadius,
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

    res.status(500).json({
      message: "Failed to fetch dairy",
    });
  }
};
