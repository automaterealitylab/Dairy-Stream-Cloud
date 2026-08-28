// Bill-section building for the admin customer billing view: aggregate
// delivered rows per product with date ranges, quantities, rates and amounts.

import { parseDeliveryBillingMeta } from "../../customer/monthlyBilling.service.js";
import { getProductRate } from "./queries.service.js";
import { toNumber } from "./normalizers.js";

export const resolveDeliveryAmount = async (delivery, rateCache) => {
  const quantity = toNumber(delivery?.quantity_liters, 0);
  if (quantity <= 0) return 0;

  const notesMeta = parseDeliveryBillingMeta(delivery?.notes);
  const unitPrice =
    notesMeta.unitPrice ??
    (await getProductRate(
      {
        dairyId: delivery?.dairy_id,
        productName: delivery?.milk_type || "Milk",
      },
      rateCache
    ));

  if (!Number.isFinite(unitPrice) || unitPrice < 0) return 0;
  return Number((quantity * unitPrice).toFixed(2));
};

export const buildBillSectionRows = async (deliveries = [], rateCache = new Map()) => {
  const grouped = new Map();

  for (const delivery of deliveries) {
    const productParts = [
      String(delivery?.milk_type || "Milk").trim() || "Milk",
      String(delivery?.delivery_slot || "").trim(),
    ].filter(Boolean);
    const product = productParts.join(" - ");
    const key = product.toLowerCase();
    const quantity = Number(toNumber(delivery?.quantity_liters, 0).toFixed(2));
    const amount = await resolveDeliveryAmount(delivery, rateCache);
    const notesMeta = parseDeliveryBillingMeta(delivery?.notes);

    if (!grouped.has(key)) {
      grouped.set(key, {
        product,
        daysSet: new Set(),
        totalQty: 0,
        amount: 0,
        unitPrices: [],
        firstDate: null,
        lastDate: null,
      });
    }

    const row = grouped.get(key);
    const deliveryDate = String(delivery?.delivery_date || "");
    if (deliveryDate) {
      row.daysSet.add(deliveryDate);
      if (!row.firstDate || deliveryDate < row.firstDate) {
        row.firstDate = deliveryDate;
      }
      if (!row.lastDate || deliveryDate > row.lastDate) {
        row.lastDate = deliveryDate;
      }
    }
    row.totalQty += quantity;
    row.amount += amount;
    if (Number.isFinite(notesMeta.unitPrice) && notesMeta.unitPrice >= 0) {
      row.unitPrices.push(notesMeta.unitPrice);
    }
  }

  return [...grouped.values()].map((row) => {
    const days = row.daysSet.size || 0;
    const totalQty = Number(row.totalQty.toFixed(2));
    const amount = Number(row.amount.toFixed(2));
    const avgQtyPerDay = days > 0 ? Number((totalQty / days).toFixed(2)) : totalQty;
    const derivedRate =
      row.unitPrices.length > 0
        ? Number((row.unitPrices.reduce((sum, value) => sum + value, 0) / row.unitPrices.length).toFixed(2))
        : totalQty > 0
        ? Number((amount / totalQty).toFixed(2))
        : 0;

    return {
      product: row.product,
      fromDate: row.firstDate,
      toDate: row.lastDate,
      qtyPerDay: avgQtyPerDay,
      days,
      totalQty,
      rate: derivedRate,
      amount,
    };
  });
};
