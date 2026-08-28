// Public customer delivery operations: today snapshot, delivery history,
// one-time order create/cancel and issue reporting.

import { supabase } from "../../../config/supabase.js";
import { isValidDateString } from "../../../utils/date.js";
import { isDeliveryDateCutoffPassed } from "../../../utils/cutoff.js";
import { appendDeliveryBillingMeta } from "../monthlyBilling.service.js";
import { addAmountToCustomerWallet } from "../payments.service.js";
import { getSubscriptionByCustomerId } from "../subscription.service.js";
import {
  autoFailOverduePendingSubscriptionDeliveriesForCustomer,
  ensureCustomerSubscriptionDeliveryForDate,
} from "../subscription.automation.service.js";
import {
  buildSubscriptionAgentFallback,
  buildDeliveryInsights,
  getTodayDeliveryFallback,
  getTodayDeliveryFromRows,
  mapDeliveryRow,
} from "./mapping.service.js";
import {
  appendCustomerCancellationNote,
  appendCustomerIssueNote,
  appendOneTimeOrderPaymentMeta,
  getLocalDateInput,
  mergeOneTimeOrderItems,
  normalizeOneTimePaymentMethod,
  normalizeOneTimeSlot,
  normalizeOneTimeOrderItems,
  normalizeUtrNumber,
  parseOneTimeNotes,
  toBoolean,
  toFiniteNumber,
  toPositiveId,
  VALID_ONE_TIME_SLOTS,
} from "./normalizers.js";
import {
  findLinkedOneTimePayment,
  isStandaloneOneTimePaymentMethod,
} from "./paymentLinks.service.js";
import {
  getAgentDetailsMap,
  getDairyNamesMap,
  getProductByNameForDairy,
  getSavedCustomerAddress,
  hasOpenSubscriptionForDairy,
  isAgentOutForDeliveryToday,
  tryFetchFromTable,
} from "./queries.service.js";
import {
  releaseStockForCancelledOrder,
  reserveStockForOrder,
} from "./stock.service.js";

export const getTodayDeliverySnapshot = async (customerId, { subscription } = {}) => {
  await autoFailOverduePendingSubscriptionDeliveriesForCustomer({ customerId });
  await ensureCustomerSubscriptionDeliveryForDate({ customerId });

  const resolvedSubscription =
    subscription === undefined
      ? await getSubscriptionByCustomerId(customerId)
      : subscription;
  const rows =
    (await tryFetchFromTable("deliveries", customerId)) ??
    (await tryFetchFromTable("milk_deliveries", customerId)) ??
    [];
  const todayDate = getLocalDateInput(new Date());
  const agentFallbackIds = resolvedSubscription?.assigned_agent_id
    ? [{ agent_id: resolvedSubscription.assigned_agent_id }]
    : [];
  const dairyNamesMap = await getDairyNamesMap(rows);
  const agentDetailsMap = await getAgentDetailsMap([...rows, ...agentFallbackIds]);
  const inferredAgentId =
    rows.find((row) => row?.agent_id != null)?.agent_id ??
    resolvedSubscription?.assigned_agent_id ??
    null;
  const agentOutForDelivery = await isAgentOutForDeliveryToday({
    agentId: inferredAgentId,
    todayDate,
  });

  const todayFromRows = getTodayDeliveryFromRows(
    rows,
    dairyNamesMap,
    agentDetailsMap,
    resolvedSubscription,
    { agentOutForDelivery }
  );
  const fallbackTracking = buildSubscriptionAgentFallback(resolvedSubscription, agentDetailsMap);

  return {
    todayDelivery:
      todayFromRows ||
      {
        ...getTodayDeliveryFallback(resolvedSubscription),
        ...fallbackTracking,
      },
    rows,
    dairyNamesMap,
  };
};

export const getCustomerDeliveries = async (customerId) => {
  const subscription = await getSubscriptionByCustomerId(customerId);
  const { rows, todayDelivery, dairyNamesMap } = await getTodayDeliverySnapshot(customerId, {
    subscription,
  });
  const filteredRows = rows || [];
  const mappedRows = filteredRows.map((row, index) =>
    mapDeliveryRow(row, index, null, null, dairyNamesMap || {})
  );
  const insights = buildDeliveryInsights(filteredRows);

  return {
    deliveries: mappedRows,
    todayDelivery,
    insights,
  };
};

export const createOneTimeDeliveryOrder = async (customerId, payload = {}) => {
  const dairyId = Number(payload?.dairyId);
  const normalizedItems = mergeOneTimeOrderItems(normalizeOneTimeOrderItems(payload));
  const deliveryDate = String(payload?.deliveryDate || "").trim();
  const allowDuplicate = toBoolean(payload?.allowDuplicate);
  const isExtraOrder = toBoolean(payload?.isExtraOrder);
  const paymentMethod = normalizeOneTimePaymentMethod(payload?.paymentMethod);
  const inputAddress = String(payload?.address || "").trim();
  const resolvedAddress = inputAddress || String(await getSavedCustomerAddress(customerId) || "").trim();
  const slot = normalizeOneTimeSlot(payload?.slot);
  const pricePerLiterInput = toFiniteNumber(payload?.pricePerLiter ?? payload?.unitPrice);
  const allowedPaymentMethods = new Set(["PAY_NOW", "COD", "MONTHLY_BILL"]);
  const utrNumber = normalizeUtrNumber(payload?.utrNumber);
  const screenshotUrl = String(payload?.screenshotUrl || "").trim();
  const payerUpiId = String(payload?.payerUpiId || "").trim();

  if (!Number.isFinite(dairyId) || dairyId <= 0) {
    throw new Error("Valid dairyId is required");
  }
  if (!normalizedItems.length) {
    throw new Error("At least one product is required");
  }
  if (!isValidDateString(deliveryDate)) {
    throw new Error("deliveryDate must be in YYYY-MM-DD format");
  }
  if (!VALID_ONE_TIME_SLOTS.has(slot)) {
    throw new Error("slot must be Morning or Evening");
  }
  if (!allowedPaymentMethods.has(paymentMethod)) {
    throw new Error("Payment method must be online, cash on delivery, or subscription bill");
  }
  if (paymentMethod === "PAY_NOW" && !utrNumber) {
    throw new Error("UTR/reference number is required for online payment orders");
  }
  if (!resolvedAddress || resolvedAddress.length < 10) {
    throw new Error("Detailed delivery address is required");
  }
  const todayIso = getLocalDateInput();
  if (deliveryDate < todayIso) {
    throw new Error("Cannot place one-time order for a past date");
  }
  if (isExtraOrder) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDayIso = getLocalDateInput(tomorrow);

    if (deliveryDate !== nextDayIso) {
      throw new Error("Extra orders are available only for next-day delivery");
    }
  }

  const { data: dairy, error: dairyError } = await supabase
    .from("dairies")
    .select("id, dairy_name")
    .eq("id", dairyId)
    .limit(1)
    .maybeSingle();

  if (dairyError) throw dairyError;
  if (!dairy) throw new Error("Selected dairy not found");

  const hasSubscriptionInSameDairy = await hasOpenSubscriptionForDairy({
    customerId,
    dairyId,
  });
  if (hasSubscriptionInSameDairy && !isExtraOrder) {
    throw new Error(
      "You already have an active subscription with this dairy. One-time delivery is not available."
    );
  }
  if (paymentMethod === "MONTHLY_BILL" && !hasSubscriptionInSameDairy) {
    throw new Error("Add to subscription bill is available only for customers with an active subscription in this dairy");
  }
  const preparedItems = [];
  for (const item of normalizedItems) {
    if (!item.milkType) {
      throw new Error("Product name is required for each item");
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error(`Quantity must be greater than zero for ${item.milkType}`);
    }

    const selectedProduct = await getProductByNameForDairy({
      dairyId,
      productName: item.milkType,
    });
    if (!selectedProduct) {
      throw new Error(`${item.milkType} is not available in this dairy`);
    }

    const databaseRate = toFiniteNumber(selectedProduct?.rate_per_unit);
    const resolvedPricePerLiter =
      Number.isFinite(databaseRate) && databaseRate > 0 ? databaseRate : pricePerLiterInput;
    if (!Number.isFinite(resolvedPricePerLiter) || resolvedPricePerLiter <= 0) {
      throw new Error(`Invalid product rate for ${item.milkType}. Ask dairy admin to update product price.`);
    }

    await supabase
      .from("deliveries")
      .delete()
      .eq("customer_id", customerId)
      .eq("dairy_id", dairyId)
      .eq("delivery_date", deliveryDate)
      .eq("milk_type", item.milkType)
      .eq("approval_status", "PENDING_PAYMENT");

    const { data: duplicate, error: duplicateError } = await supabase
      .from("deliveries")
      .select("id")
      .eq("customer_id", customerId)
      .eq("dairy_id", dairyId)
      .eq("delivery_date", deliveryDate)
      .eq("milk_type", item.milkType)
      .in("status", ["PENDING", "DELIVERED"])
      .neq("approval_status", "PENDING_PAYMENT")
      .limit(1)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate && !allowDuplicate) {
      throw new Error("A one-time order for this product/date already exists");
    }

    preparedItems.push({
      milkType: item.milkType,
      quantity: item.quantity,
      productId: selectedProduct.id,
      unitPrice: resolvedPricePerLiter,
    });
  }

  const reservedItems = [];
  const createdDeliveries = [];
  try {
    for (const item of preparedItems) {
      await reserveStockForOrder({
        dairyId,
        productId: item.productId,
        quantity: item.quantity,
      });
      reservedItems.push(item);
    }

    for (const item of preparedItems) {
      const baseNotes = appendDeliveryBillingMeta(
        `[ONE_TIME_ORDER] slot=${slot}; payment=${paymentMethod}; address=${resolvedAddress}`,
        {
          paymentMethod,
          unitPrice: item.unitPrice,
        }
      );
      const deliveryNotes = appendOneTimeOrderPaymentMeta(baseNotes, {
        utrNumber: paymentMethod === "PAY_NOW" ? utrNumber : null,
        screenshotUrl: paymentMethod === "PAY_NOW" ? screenshotUrl : null,
        payerUpiId: paymentMethod === "PAY_NOW" ? payerUpiId : null,
      }).slice(0, 500);
      const approvalStatus =
        paymentMethod === "PAY_NOW"
          ? (utrNumber ? "PENDING_VERIFICATION" : "PENDING_PAYMENT")
          : "PENDING";

      const { data: createdDelivery, error: createDeliveryError } = await supabase
        .from("deliveries")
        .insert({
          customer_id: customerId,
          dairy_id: dairyId,
          delivery_date: deliveryDate,
          milk_type: item.milkType,
          quantity_liters: item.quantity,
          status: "PENDING",
          approval_status: approvalStatus,
          notes: deliveryNotes,
        })
        .select("id, customer_id, dairy_id, delivery_date, milk_type, quantity_liters, status, approval_status, created_at")
        .single();

      if (createDeliveryError) throw createDeliveryError;
      createdDeliveries.push(createdDelivery);
    }
  } catch (error) {
    for (const created of createdDeliveries) {
      await supabase.from("deliveries").delete().eq("id", created.id).eq("customer_id", customerId);
    }
    for (const item of reservedItems) {
      await releaseStockForCancelledOrder({
        dairyId,
        milkType: item.milkType,
        quantity: item.quantity,
      });
    }
    throw error;
  }

  const amount = Number(
    preparedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)
  );
  let createdPayment = null;
  if (paymentMethod === "PAY_NOW" && !utrNumber) {
    const deliveryIds = createdDeliveries.map((item) => item.id).join(",");
    const summaryLabel = preparedItems
      .map((item) => `${item.milkType} ${item.quantity}L`)
      .join(", ")
      .slice(0, 180);
    const paymentDescription = `One-time order bundle: delivery_ids=${deliveryIds}; ${summaryLabel} (${slot}) for ${deliveryDate}`.slice(0, 300);

    const { data: paymentRow, error: createPaymentError } = await supabase
      .from("payments")
      .insert({
        customer_id: customerId,
        dairy_id: dairyId,
        amount,
        status: "PENDING",
        method: paymentMethod,
        description: paymentDescription,
        due_date: deliveryDate,
      })
      .select("id, amount, status, due_date")
      .single();

    if (createPaymentError) {
      for (const created of createdDeliveries) {
        await supabase.from("deliveries").delete().eq("id", created.id).eq("customer_id", customerId);
      }
      for (const item of reservedItems) {
        await releaseStockForCancelledOrder({
          dairyId,
          milkType: item.milkType,
          quantity: item.quantity,
        });
      }
      throw createPaymentError;
    }

    createdPayment = paymentRow;
  }

  return {
    order: {
      id: createdDeliveries[0]?.id || null,
      dairyId,
      dairyName: dairy.dairy_name || "Dairy",
      deliveryDate,
      milkType: preparedItems[0]?.milkType || "",
      quantity: preparedItems[0]?.quantity || 0,
      slot,
      status: createdDeliveries[0]?.status || "PENDING",
      approvalStatus: String(createdDeliveries[0]?.approval_status || "PENDING").toUpperCase(),
    },
    orders: createdDeliveries.map((delivery, index) => ({
      id: delivery.id,
      dairyId,
      dairyName: dairy.dairy_name || "Dairy",
      deliveryDate,
      milkType: preparedItems[index]?.milkType || delivery.milk_type,
      quantity: preparedItems[index]?.quantity || delivery.quantity_liters,
      slot,
      status: delivery.status || "PENDING",
      approvalStatus: String(delivery.approval_status || "PENDING").toUpperCase(),
    })),
    orderIds: createdDeliveries.map((delivery) => delivery.id),
    payment: createdPayment,
  };
};

export const cancelPendingOneTimeDeliveryOrder = async (customerId, payload = {}) => {
  const orderId = toPositiveId(payload?.orderId);
  const orderIds = Array.isArray(payload?.orderIds)
    ? payload.orderIds.map((value) => toPositiveId(value)).filter(Boolean)
    : [];
  const paymentId = toPositiveId(payload?.paymentId);
  const removeFromHistory = toBoolean(payload?.removeFromHistory);
  const targetOrderIds = [...new Set([...(orderIds || []), ...(orderId ? [orderId] : [])])];

  if (!targetOrderIds.length) {
    throw new Error("Valid orderId is required");
  }

  const { data: deliveries, error: deliveryFetchError } = await supabase
    .from("deliveries")
    .select("id, customer_id, dairy_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes")
    .in("id", targetOrderIds)
    .eq("customer_id", customerId)
    .order("id", { ascending: true });

  if (deliveryFetchError) throw deliveryFetchError;
  if (!Array.isArray(deliveries) || deliveries.length !== targetOrderIds.length) {
    throw new Error("Order not found");
  }

  for (const delivery of deliveries) {
    const notesStr = String(delivery?.notes || "");
    const isOneTime = notesStr.includes("[ONE_TIME_ORDER]") || notesStr.includes("payment=") || notesStr.includes("slot=") || !notesStr;
    if (!isOneTime) {
      throw new Error("Only one-time orders can be cancelled");
    }

    const deliveryStatus = String(delivery?.status || "PENDING").toUpperCase();
    const approvalStatus = String(delivery?.approval_status || "PENDING").toUpperCase();

    if (deliveryStatus === "IN_TRANSIT") {
      throw new Error("This order is already out for delivery and can no longer be cancelled");
    }
    if (deliveryStatus === "DELIVERED" || deliveryStatus === "COMPLETED") {
      throw new Error("Delivered orders cannot be cancelled");
    }
    if (deliveryStatus === "FAILED") {
      throw new Error("Failed orders cannot be cancelled");
    }
    if (deliveryStatus === "CANCELLED" || deliveryStatus === "CANCELED") {
      throw new Error("This order has already been cancelled");
    }
    if (deliveryStatus !== "PENDING") {
      throw new Error("Only pending one-time orders can be cancelled");
    }
    if (approvalStatus === "APPROVED") {
      throw new Error("This order has already been approved and cannot be cancelled by the customer");
    }
    if (approvalStatus === "CANCELLED" || approvalStatus === "CANCELED") {
      throw new Error("This order has already been cancelled");
    }
    if (approvalStatus !== "PENDING" && approvalStatus !== "PENDING_PAYMENT" && approvalStatus !== "PENDING_VERIFICATION") {
      throw new Error("Only approval-pending one-time orders can be cancelled");
    }
  }

  const primaryDelivery = deliveries[0];
  const paymentMethod = normalizeOneTimePaymentMethod(parseOneTimeNotes(primaryDelivery?.notes).paymentMethod);
  const payment = await findLinkedOneTimePayment({
    customerId,
    orderId: primaryDelivery?.id,
    paymentId,
    dairyId: primaryDelivery?.dairy_id ?? null,
  });
  const requiresStandalonePayment = isStandaloneOneTimePaymentMethod(paymentMethod);
  const primaryApprovalStatus = String(primaryDelivery?.approval_status || "").toUpperCase();
  if (
    !payment &&
    requiresStandalonePayment &&
    !removeFromHistory &&
    primaryApprovalStatus !== "PENDING_PAYMENT" &&
    primaryApprovalStatus !== "PENDING_VERIFICATION"
  ) {
    throw new Error("Payment record not found");
  }

  const paymentStatus = String(payment?.status || "PENDING").toUpperCase();
  let walletCredit = null;

  if (paymentStatus === "PAID") {
    const paidAmount = Number(Number(payment?.amount || 0).toFixed(2));
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      throw new Error("Paid amount is invalid for cancellation");
    }

    walletCredit = await addAmountToCustomerWallet({
      customerId,
      dairyId: primaryDelivery?.dairy_id ?? null,
      amount: paidAmount,
      source: "ONE_TIME_ORDER_CANCEL",
      method: "WALLET",
      description: `[ONE_TIME_ORDER_CANCEL] order_ids=${targetOrderIds.join(",")}; original_payment_id=${payment.id}; amount=${paidAmount}; reason=approval_pending`,
    });
  }

  if (removeFromHistory) {
    const { error: deleteDeliveryError } = await supabase
      .from("deliveries")
      .delete()
      .in("id", targetOrderIds)
      .eq("customer_id", customerId);

    if (deleteDeliveryError) throw deleteDeliveryError;

    if (payment?.id && paymentStatus !== "PAID") {
      const { error: deletePaymentError } = await supabase
        .from("payments")
        .delete()
        .eq("id", payment.id)
        .eq("customer_id", customerId);

      if (deletePaymentError) {
        throw deletePaymentError;
      }
    }
  } else {
    const { error: updateDeliveryError } = await supabase
      .from("deliveries")
      .update({
        status: "CANCELLED",
        approval_status: "CANCELLED",
        updated_at: new Date().toISOString(),
      })
      .in("id", targetOrderIds)
      .eq("customer_id", customerId);

    if (updateDeliveryError) throw updateDeliveryError;

    for (const delivery of deliveries) {
      const { error: notesUpdateError } = await supabase
        .from("deliveries")
        .update({
          notes: appendCustomerCancellationNote(delivery?.notes, "approval_pending"),
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id)
        .eq("customer_id", customerId);

      if (notesUpdateError) throw notesUpdateError;
    }

    if (payment?.id && paymentStatus !== "PAID") {
      const { error: updatePaymentError } = await supabase
        .from("payments")
        .update({
          status: "CANCELLED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .eq("customer_id", customerId);

      if (updatePaymentError) {
        throw updatePaymentError;
      }
    }
  }

  for (const delivery of deliveries) {
    await releaseStockForCancelledOrder({
      dairyId: delivery?.dairy_id,
      milkType: delivery?.milk_type,
      quantity: delivery?.quantity_liters,
    });
  }

  return {
    success: true,
    cancelled: true,
    removedFromHistory: removeFromHistory,
    orderId: primaryDelivery?.id || null,
    orderIds: targetOrderIds,
    paymentId: payment?.id || paymentId || null,
    walletCredited: Boolean(walletCredit),
    creditedAmount: walletCredit?.creditedAmount || 0,
    walletBalance: walletCredit?.walletBalance ?? null,
    message: removeFromHistory
      ? "Order cancelled successfully."
      : walletCredit
      ? "Order cancelled. The paid amount has been added to your wallet."
      : "Order cancelled successfully.",
  };
};

export const reportCustomerDeliveryIssue = async (customerId, payload = {}) => {
  const deliveryId = toPositiveId(payload?.deliveryId);
  const issue = String(payload?.issue || "").trim();

  if (!deliveryId) {
    throw new Error("Valid deliveryId is required");
  }
  if (!issue || issue.length < 5) {
    throw new Error("Issue must be at least 5 characters");
  }
  if (issue.length > 500) {
    throw new Error("Issue must be 500 characters or less");
  }

  const { data: delivery, error: fetchError } = await supabase
    .from("deliveries")
    .select("id, customer_id, notes")
    .eq("id", deliveryId)
    .eq("customer_id", customerId)
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!delivery) {
    throw new Error("Delivery not found");
  }

  const nextNotes = appendCustomerIssueNote(delivery.notes, issue);
  const { data: updated, error: updateError } = await supabase
    .from("deliveries")
    .update({
      customer_issue_text: issue,
      customer_issue_reported_at: new Date().toISOString(),
      customer_issue_status: "OPEN",
      customer_issue_admin_action: null,
      customer_issue_resolved_at: null,
      notes: nextNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .eq("customer_id", customerId)
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) {
    throw new Error("Failed to save issue");
  }

  return {
    success: true,
    deliveryId,
  };
};

export const skipCustomerDelivery = async (customerId, payload = {}) => {
  const deliveryId = toPositiveId(payload?.deliveryId || payload?.id);
  const deliveryDateInput = String(payload?.deliveryDate || payload?.date || "").trim();

  if (!customerId) {
    const err = new Error("customerId is required");
    err.statusCode = 401;
    throw err;
  }

  let deliveryRow = null;

  if (deliveryId) {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", deliveryId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (error) throw error;
    deliveryRow = data;
  } else if (deliveryDateInput) {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("customer_id", customerId)
      .eq("delivery_date", deliveryDateInput)
      .maybeSingle();

    if (error) throw error;
    deliveryRow = data;
  }

  const targetDate = deliveryRow?.delivery_date || deliveryDateInput;
  if (!targetDate || !isValidDateString(targetDate)) {
    const err = new Error("Valid delivery date or ID is required");
    err.statusCode = 400;
    throw err;
  }

  // 1. Enforce 10:00 PM IST previous day cutoff rule
  if (isDeliveryDateCutoffPassed(targetDate)) {
    const err = new Error("This delivery can no longer be changed because the 10:00 PM cutoff has passed.");
    err.statusCode = 409;
    throw err;
  }

  // 2. Idempotency Check
  const currentStatus = String(deliveryRow?.status || "PENDING").toUpperCase();
  if (currentStatus === "SKIPPED") {
    return {
      success: true,
      message: "Delivery is already skipped",
      delivery: deliveryRow,
    };
  }

  if (["DELIVERED", "COMPLETED", "FAILED", "IN_TRANSIT"].includes(currentStatus)) {
    const err = new Error(`Cannot skip delivery with status ${currentStatus}`);
    err.statusCode = 400;
    throw err;
  }

  const subscription = await getSubscriptionByCustomerId(customerId);
  const targetDairyId = deliveryRow?.dairy_id || subscription?.dairy_id || subscription?.dairyId;

  let updatedDelivery = null;

  if (deliveryRow?.id) {
    const { data, error } = await supabase
      .from("deliveries")
      .update({
        status: "SKIPPED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", deliveryRow.id)
      .eq("customer_id", customerId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    updatedDelivery = data;
  } else {
    if (!targetDairyId) {
      const err = new Error("Active dairy subscription required to skip delivery");
      err.statusCode = 400;
      throw err;
    }

    const payloadRow = {
      customer_id: customerId,
      dairy_id: targetDairyId,
      delivery_date: targetDate,
      milk_type: subscription?.milk_type || "Milk",
      quantity_liters: subscription?.quantity_liters || 1,
      status: "SKIPPED",
      approval_status: "APPROVED",
      notes: `[SUBSCRIPTION_SKIPPED] subscription_id=${subscription?.id || ""}; slot=${subscription?.delivery_slot || "Morning"}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("deliveries")
      .insert(payloadRow)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    updatedDelivery = data;
  }

  return {
    success: true,
    message: `Delivery for ${targetDate} skipped successfully`,
    delivery: updatedDelivery,
  };
};
