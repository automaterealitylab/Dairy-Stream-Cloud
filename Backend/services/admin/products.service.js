import { supabase } from "../../config/supabase.js";

const toNumber = (value, fallback = NaN) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value) => String(value || "").trim();

const normalizeProductPayload = (payload = {}) => {
  const name = normalizeText(payload.name || payload.productName);
  const type = normalizeText(payload.type || payload.productType || "MILK");
  const unit = normalizeText(payload.unit || "LITER").toUpperCase();
  const ratePerUnit = toNumber(payload.ratePerUnit ?? payload.rate ?? payload.price);
  const stockQuantity = toNumber(payload.stockQuantity ?? payload.stock);
  const isActive =
    payload.isActive === undefined ? true : Boolean(payload.isActive);

  return {
    name,
    type,
    unit,
    ratePerUnit,
    stockQuantity,
    isActive,
  };
};

const validateDairyId = (dairyId) => {
  const parsed = Number(dairyId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Valid dairyId is required");
  }
  return parsed;
};

const validateProductInput = ({ name, ratePerUnit, stockQuantity }) => {
  if (!name) {
    throw new Error("Product name is required");
  }
  if (!Number.isFinite(ratePerUnit) || ratePerUnit <= 0) {
    throw new Error("Rate must be greater than zero");
  }
  if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
    throw new Error("Stock must be zero or greater");
  }
};

const mapProduct = (row = {}) => ({
  id: row.id,
  name: row.name,
  type: row.product_type || "MILK",
  unit: row.unit || "LITER",
  ratePerUnit: Number(row.rate_per_unit || 0),
  stockQuantity: Number(row.stock_quantity || 0),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const ensureUniqueProductName = async ({ dairyId, name, excludeId = null }) => {
  let query = supabase
    .from("products")
    .select("id")
    .eq("dairy_id", dairyId)
    .ilike("name", name)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (data?.id) {
    throw new Error("Product with this name already exists");
  }
};

export const getAdminProducts = async ({
  dairyId,
  search = "",
  includeInactive = true,
}) => {
  const resolvedDairyId = validateDairyId(dairyId);
  let query = supabase
    .from("products")
    .select(
      "id, dairy_id, name, product_type, unit, rate_per_unit, stock_quantity, is_active, created_at, updated_at"
    )
    .eq("dairy_id", resolvedDairyId)
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  if (search.trim()) {
    query = query.or(
      `name.ilike.%${search}%,product_type.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    products: (data || []).map(mapProduct),
  };
};

export const createAdminProduct = async ({ dairyId, payload = {} }) => {
  const resolvedDairyId = validateDairyId(dairyId);
  const parsed = normalizeProductPayload(payload);
  validateProductInput(parsed);
  await ensureUniqueProductName({ dairyId: resolvedDairyId, name: parsed.name });

  const { data, error } = await supabase
    .from("products")
    .insert({
      dairy_id: resolvedDairyId,
      name: parsed.name,
      product_type: parsed.type,
      unit: parsed.unit,
      rate_per_unit: parsed.ratePerUnit,
      stock_quantity: parsed.stockQuantity,
      is_active: parsed.isActive,
    })
    .select(
      "id, dairy_id, name, product_type, unit, rate_per_unit, stock_quantity, is_active, created_at, updated_at"
    )
    .single();

  if (error) throw error;
  return mapProduct(data);
};

export const updateAdminProduct = async ({
  dairyId,
  productId,
  payload = {},
}) => {
  const resolvedDairyId = validateDairyId(dairyId);
  const resolvedProductId = Number(productId);
  if (!Number.isFinite(resolvedProductId) || resolvedProductId <= 0) {
    throw new Error("Valid product id is required");
  }

  const parsed = normalizeProductPayload(payload);
  validateProductInput(parsed);
  await ensureUniqueProductName({
    dairyId: resolvedDairyId,
    name: parsed.name,
    excludeId: resolvedProductId,
  });

  const { data, error } = await supabase
    .from("products")
    .update({
      name: parsed.name,
      product_type: parsed.type,
      unit: parsed.unit,
      rate_per_unit: parsed.ratePerUnit,
      stock_quantity: parsed.stockQuantity,
      is_active: parsed.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resolvedProductId)
    .eq("dairy_id", resolvedDairyId)
    .select(
      "id, dairy_id, name, product_type, unit, rate_per_unit, stock_quantity, is_active, created_at, updated_at"
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Product not found");
  return mapProduct(data);
};

export const deleteAdminProduct = async ({ dairyId, productId }) => {
  const resolvedDairyId = validateDairyId(dairyId);
  const resolvedProductId = Number(productId);
  if (!Number.isFinite(resolvedProductId) || resolvedProductId <= 0) {
    throw new Error("Valid product id is required");
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", resolvedProductId)
    .eq("dairy_id", resolvedDairyId);

  if (error) throw error;
  return { success: true };
};
