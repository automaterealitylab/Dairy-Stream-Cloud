// One-time order stock reserve/release operations.

import { supabase } from "../../../config/supabase.js";
import { getProductByNameForDairy } from "./queries.service.js";

export const reserveStockForOrder = async ({ dairyId, productId, quantity }) => {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, stock_quantity")
    .eq("id", productId)
    .eq("dairy_id", dairyId)
    .limit(1)
    .maybeSingle();

  if (productError) throw productError;
  if (!product) throw new Error("Selected product not found");

  const availableStock = Number(product.stock_quantity || 0);
  if (availableStock < quantity) {
    throw new Error(`Insufficient stock. Only ${availableStock} left`);
  }

  const nextStock = Number((availableStock - quantity).toFixed(2));
  const { data: updatedProduct, error: updateError } = await supabase
    .from("products")
    .update({
      stock_quantity: nextStock,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("dairy_id", dairyId)
    .gte("stock_quantity", quantity)
    .select("id, stock_quantity")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updatedProduct) {
    throw new Error("Stock changed recently. Please try again.");
  }

  return {
    previousStock: availableStock,
    currentStock: Number(updatedProduct.stock_quantity || 0),
  };
};

export const releaseStockForCancelledOrder = async ({ dairyId, milkType, quantity }) => {
  const resolvedDairyId = Number(dairyId);
  const resolvedQuantity = Number(quantity);
  if (!Number.isFinite(resolvedDairyId) || resolvedDairyId <= 0) return;
  if (!Number.isFinite(resolvedQuantity) || resolvedQuantity <= 0) return;
  if (!String(milkType || "").trim()) return;

  const product = await getProductByNameForDairy({
    dairyId: resolvedDairyId,
    productName: milkType,
  });

  if (!product?.id) return;

  const currentStock = Number(product.stock_quantity || 0);
  const nextStock = Number((currentStock + resolvedQuantity).toFixed(2));

  const { error } = await supabase
    .from("products")
    .update({
      stock_quantity: nextStock,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id)
    .eq("dairy_id", resolvedDairyId);

  if (error) throw error;
};
