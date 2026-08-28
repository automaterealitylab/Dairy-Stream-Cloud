// Marketplace order pricing: line-item validation against the product catalog
// and tax/delivery-fee totals.

import { supabase } from "../../config/supabase.js";
import { assertArray, assertPositiveNumber } from "../../utils/validation.js";
import { getDeliveryFee, getTaxPercent } from "./normalizers.js";

export const calculateMarketplacePricing = async ({ dairyId, items }) => {
  const cleanItems = assertArray(items, "Order items").map((item) => ({
    productId: Number(item.product_id || item.productId),
    quantity: assertPositiveNumber(item.quantity, "Item quantity"),
  }));

  if (cleanItems.length > 25) {
    const error = new Error("Order cannot contain more than 25 line items");
    error.statusCode = 400;
    throw error;
  }

  const productIds = [...new Set(cleanItems.map((item) => item.productId).filter(Boolean))];
  if (productIds.length !== cleanItems.length) {
    const error = new Error("Each order item must reference one valid product");
    error.statusCode = 400;
    throw error;
  }

  const { data: products, error } = await supabase
    .from("products")
    .select("id, dairy_id, name, product_type, unit, rate_per_unit, stock_quantity, is_active")
    .eq("dairy_id", dairyId)
    .in("id", productIds);

  if (error) throw error;
  const productById = new Map((products || []).map((product) => [Number(product.id), product]));

  const lineItems = cleanItems.map((item) => {
    const product = productById.get(item.productId);
    if (!product || !product.is_active) {
      const err = new Error(`Product ${item.productId} is not available for this dairy`);
      err.statusCode = 400;
      throw err;
    }

    const rate = Number(product.rate_per_unit || 0);
    const stock = Number(product.stock_quantity || 0);
    if (rate <= 0) {
      const err = new Error(`${product.name} does not have a valid price`);
      err.statusCode = 400;
      throw err;
    }
    if (stock > 0 && item.quantity > stock) {
      const err = new Error(`${product.name} has only ${stock} ${product.unit || "units"} in stock`);
      err.statusCode = 400;
      throw err;
    }

    const lineTotal = Number((rate * item.quantity).toFixed(2));
    return {
      product_id: product.id,
      name: product.name,
      unit: product.unit,
      quantity: item.quantity,
      rate_per_unit: rate,
      line_total: lineTotal,
    };
  });

  const subtotal = Number(lineItems.reduce((sum, item) => sum + item.line_total, 0).toFixed(2));
  const taxPercent = getTaxPercent();
  const taxAmount = Number(((subtotal * taxPercent) / 100).toFixed(2));
  const deliveryFee = getDeliveryFee();
  const total = Number((subtotal + taxAmount + deliveryFee).toFixed(2));

  if (total < 1) {
    const error = new Error("Calculated order total must be at least INR 1.00");
    error.statusCode = 400;
    throw error;
  }

  return {
    subtotal,
    taxPercent,
    taxAmount,
    deliveryFee,
    total,
    lineItems,
  };
};
