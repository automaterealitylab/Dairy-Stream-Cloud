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
/* ---------------- GEO DISCOVERY (DB-DRIVEN) ---------------- */

const NEARBY_PAGE_SIZE = 20;

export const getNearbyDairies = async (lat, lng, radius = 10, page = 0) => {
  const offset = page * NEARBY_PAGE_SIZE;

  const { data, error } = await supabase.rpc("get_nearby_dairies", {
  lat,
  lng,
  page_offset: page * 20,
  radius
});

  if (error) throw error;

  return data || [];
};


export const getSearchSuggestions = async (q) => {

  const { data, error } = await supabase.rpc(
    "search_dairy_suggestions",
    { q }
  );

  if (error) throw error;

  return data || [];

};

export const searchDairies = async (query) => {
  const { data, error } = await supabase.rpc("search_dairies", {
    q: query,
  });

  if (error) throw error;

  return data || [];
};

export const getCityDairies = async (city) => {
  const { data, error } = await supabase.rpc("get_city_dairies", {
    city,
  });

  if (error) throw error;

  return data || [];
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
