import client from "./client"; // ✅ Use the centralized client

/**
 * Fetch all public dairies with optional search and location filtering.
 * Supports a 10km radius filter for "Nearby Dairies".
 */
export const fetchPublicDairies = async ({ search = "", lat = null, lng = null, radius = 10 } = {}) => {
  const { data } = await client.get("/dairies", {
    params: { 
      search,
      lat,   // ✅ Latitude from browser geolocation
      lng,   // ✅ Longitude from browser geolocation
      radius // ✅ 10km limit as per project requirements
    }, 
  });
  return data;
};

/**
 * Fetch details for a specific dairy by its ID.
 */
export const fetchPublicDairyById = async (id) => {
  const { data } = await client.get(`/dairies/${id}`);
  return data;
};