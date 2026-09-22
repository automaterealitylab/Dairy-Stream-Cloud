import { supabase } from "../../config/supabase.js";
import {
  isMissingColumnError,
  isMissingTableError,
  isUuidSyntaxError,
} from "../../utils/dbErrors.js";

const parseField = (text, field) => {
  const match = String(text || "").match(new RegExp(`${field}=([^;\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
};

export const parseDeliveryUnitPriceFromNotes = (notesValue) => {
  const rawValue = parseField(notesValue, "unit_price");
  if (rawValue === null) return null;

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const roundDeliveryMoney = (value) => {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Number(next.toFixed(2)) : null;
};

export const calculateDeliveryAmount = ({ quantityLiters, unitPrice } = {}) => {
  if (quantityLiters === null || quantityLiters === undefined || quantityLiters === "") return null;
  if (unitPrice === null || unitPrice === undefined || unitPrice === "") return null;

  const quantity = Number(quantityLiters);
  const price = Number(unitPrice);

  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(price) || price < 0) return null;

  return roundDeliveryMoney(quantity * price);
};

export const getProductRateForDelivery = async ({ dairyId, milkType }, rateCache = new Map()) => {
  if (!dairyId || !String(milkType || "").trim()) return null;

  const cacheKey = `${dairyId}:${String(milkType || "").trim().toLowerCase()}`;
  if (rateCache?.has?.(cacheKey)) return rateCache.get(cacheKey);

  const { data, error } = await supabase
    .from("products")
    .select("rate_per_unit, is_active")
    .eq("dairy_id", dairyId)
    .ilike("name", String(milkType || "").trim())
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error) || isMissingColumnError(error) || isUuidSyntaxError(error)) {
      rateCache?.set?.(cacheKey, null);
      return null;
    }
    throw error;
  }

  const rate = Number(data?.rate_per_unit);
  const resolved = Number.isFinite(rate) && rate >= 0 ? rate : null;
  rateCache?.set?.(cacheKey, resolved);
  return resolved;
};

export const resolveDeliveryUnitPrice = async (
  delivery,
  { rateCache = new Map(), rateLookup = getProductRateForDelivery } = {}
) => {
  const notesRate = parseDeliveryUnitPriceFromNotes(delivery?.notes);
  if (notesRate !== null) return notesRate;

  return rateLookup(
    {
      dairyId: delivery?.dairy_id,
      milkType: delivery?.milk_type || "Milk",
    },
    rateCache
  );
};

export const resolveDeliveryAmountForPersistence = async (
  delivery,
  options = {}
) => {
  const unitPrice = await resolveDeliveryUnitPrice(delivery, options);
  return calculateDeliveryAmount({
    quantityLiters: delivery?.quantity_liters,
    unitPrice,
  });
};

export const withPersistedDeliveryAmount = async (
  deliveryPayload,
  options = {}
) => {
  const { delivery_amount: _ignoredDeliveryAmount, ...safePayload } = deliveryPayload || {};
  const amount = await resolveDeliveryAmountForPersistence(safePayload, options);
  if (amount === null) return { ...safePayload };
  return {
    ...safePayload,
    delivery_amount: amount,
  };
};
