import { supabase } from "../../config/supabase.js";

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
      "id, name, product_type, unit, rate_per_unit, stock_quantity, is_active"
    )
    .eq("dairy_id", dairyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingRelation =
      message.includes("relation") && message.includes("does not exist");
    const isMissingColumn =
      message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) {
      return {
        productItems: [],
        products: {},
      };
    }
    throw error;
  }

  const productItems = (data || []).map(mapProductForPublic);
  return {
    productItems,
    products: buildLegacyProductsMap(productItems),
  };
};

export const listPublicDairies = async ({ search = "" }) => {
  const PUBLIC_DAIRY_FIELDS =
    "id, dairy_name, category, address, city, state, pincode, image_url, service_type, service_pincodes, service_radius, selected_plan, status, created_at";

  let query = supabase
    .from("dairies")
    .select(PUBLIC_DAIRY_FIELDS)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `dairy_name.ilike.%${search}%,dairy_email.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
};

export const getPublicDairyById = async (id) => {
  const PUBLIC_DAIRY_FIELDS =
    "id, dairy_name, category, address, city, state, pincode, image_url, service_type, service_pincodes, service_radius, selected_plan, status, created_at";

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
