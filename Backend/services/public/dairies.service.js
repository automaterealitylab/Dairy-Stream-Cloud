import { supabase } from "../../config/supabase.js";

/* ---------------- PRODUCTS ---------------- */

const mapProductForPublic = (row = {}) => ({
  id: row.id,
  name: row.name,
  type: row.product_type || "MILK",
  unit: row.unit || "LITER",
  ratePerUnit: Number(row.rate_per_unit || 0),
  stockQuantity: Number(row.stock_quantity || 0),
});

const buildLegacyProductsMap = (items = []) =>
  items.reduce((acc, item) => {
    if (!item?.name) return acc;
    acc[item.name] = Number(item.ratePerUnit || 0);
    return acc;
  }, {});

const getPublicProductsByDairyId = async (dairyId) => {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, product_type, unit, rate_per_unit, stock_quantity, is_active",
    )
    .eq("dairy_id", dairyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("relation") || message.includes("column")) {
      return { productItems: [], products: {} };
    }
    throw error;
  }

  const productItems = (data || []).map(mapProductForPublic);
  return {
    productItems,
    products: buildLegacyProductsMap(productItems),
  };
};

/* ---------------- DISTANCE HELPER ---------------- */

const getDistance = (lat1, lon1, lat2, lon2) => {
 if (
  lat1 === null || lon1 === null ||
  lat2 === null || lon2 === null
) return Infinity; 
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/* ---------------- PUBLIC DAIRIES ---------------- */

export const listPublicDairies = async ({
  search = "",
  city = "",
  pincode = "",
  lat = null,
  lng = null,
  radius = 10,
}) => {
  const PUBLIC_DAIRY_FIELDS = "id, dairy_name, category, address, city, state, pincode, image_url, latitude, longitude, status, created_at";

  let query = supabase
    .from("dairies")
    .select(PUBLIC_DAIRY_FIELDS);
    // REMOVED .eq("status", "ACTIVE") since you mentioned it's not set

  // Filter Logic
if (search) {
  query = query.or(`dairy_name.ilike.%${search}%,address.ilike.%${search}%`);
}

if (city) {
  query = query.ilike("city", `%${city}%`);
}

if (pincode) {
  query = query.eq("pincode", pincode);
}

  const { data, error } = await query;
  if (error) throw error;

  let dairies = data || [];

  // Define these INSIDE the function so they are accessible
  const hasUserCoords = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);
  const isExplicitSearch = Boolean(search || city || pincode);

  if (hasUserCoords) {
    dairies = dairies
      .map((row) => {
        const dLat = parseFloat(row.latitude);
        const dLng = parseFloat(row.longitude);

        const distanceKm = (!isNaN(dLat) && !isNaN(dLng)) 
          ? getDistance(lat, lng, dLat, dLng) 
          : Infinity;

        return { ...row, distance: distanceKm };
      })
      .filter((row) => {
        // This is the most important part: 
        // If user searched for a name or clicked a city, DO NOT filter by radius.
        if (isExplicitSearch) return true; 
        return row.distance <= radius;
      })
      .sort((a, b) => a.distance - b.distance);
  }

  return dairies;
};

/* ---------------- SINGLE DAIRY ---------------- */

export const getPublicDairyById = async (id) => {
  const PUBLIC_DAIRY_FIELDS =
    "id, dairy_name, category, address, city, state, pincode, image_url, latitude, longitude, service_type, service_pincodes, service_radius, selected_plan, status, created_at";

  const { data, error } = await supabase
    .from("dairies")
    .select(PUBLIC_DAIRY_FIELDS)
    .eq("id", id)
    .single();

  if (error) throw error;

  const productsPayload = await getPublicProductsByDairyId(data.id);

  return {
    ...data,
    ...productsPayload,
  };
};
