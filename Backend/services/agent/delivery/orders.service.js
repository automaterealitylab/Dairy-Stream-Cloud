// Public agent delivery operations: assigned deliveries, online collection
// (QR / order / verification), dashboard, history, profile, availability and
// delivery status updates.

import axios from "axios";
import crypto from "crypto";
import { supabase } from "../../../config/supabase.js";
import { getRazorpayConfig } from "../../../config/razorpay.js";
import { getLocalTodayIso } from "../../../utils/date.js";
import { isMissingColumnError } from "../../../utils/dbErrors.js";
import {
  ensureBuyOnceInvoiceForDeliveredOrder,
  syncCustomerMonthlyBills,
} from "../../customer/monthlyBilling.service.js";
import { mapAssignedDelivery } from "./mapping.service.js";
import {
  deriveAgentAvailability,
  normalizeCoordinate,
  normalizeDate,
  normalizeStatusForCard,
  normalizeStatusForHistory,
} from "./normalizers.js";
import {
  getDeliveryTypeFromNotes,
  parseDeliveryProof,
  parseFailedReason,
  parseOrderPaymentMeta,
  parsePaymentCollection,
  withDeliveryProof,
  withFailureReason,
  withPaymentCollection,
} from "./notes.service.js";
import {
  buildLookupMaps,
  fetchAgentCore,
  fetchAssignedDeliveryRow,
  fetchDeliveryRows,
  findPaymentRowByDeliveryId,
  getDeliverySettings,
} from "./queries.service.js";
import {
  getDairyLinkedAccountId,
  getRazorpayClient,
  onlineCollectionCache,
} from "./razorpay.service.js";

export const getAgentAssignedDeliveries = async ({
  agentDbId,
  dairyId = null,
  date = null,
} = {}) => {
  const rows = await fetchDeliveryRows({ agentDbId, dairyId, date, limit: 1000 });
  if (!rows.length) return [];
  const lookups = await buildLookupMaps(rows);
  return rows.map((row) => mapAssignedDelivery(row, lookups));
};

export const createAgentOnlineCollectionQr = async ({
  agentDbId,
  dairyId = null,
  deliveryId,
} = {}) => {
  const settings = await getDeliverySettings();
  const { keyId, keySecret } = getRazorpayConfig();

  const row = await fetchAssignedDeliveryRow({ agentDbId, dairyId, deliveryId });
  const paymentMeta = parseOrderPaymentMeta(row.notes, row.quantity_liters);
  const deliveryType = getDeliveryTypeFromNotes(row.notes);

  if (deliveryType !== "BUY ONCE" || paymentMeta.paymentMethod !== "COD") {
    const error = new Error("Razorpay QR is available only for COD buy-once deliveries");
    error.statusCode = 400;
    throw error;
  }

  if (normalizeStatusForCard(row.status) !== "PENDING") {
    const error = new Error("QR can only be generated for pending deliveries");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(paymentMeta.amountDue) || paymentMeta.amountDue <= 0) {
    const error = new Error("Unable to determine delivery amount for QR");
    error.statusCode = 400;
    throw error;
  }

  const cacheKey = `${row.id}:${Math.round(paymentMeta.amountDue * 100)}`;
  const cached = onlineCollectionCache.get(cacheKey);
  if (cached && Date.now() - cached.at < settings.onlineCollectionTtlMs) {
    return cached.payload;
  }

  try {
    const linkedAccountId = await getDairyLinkedAccountId(row.dairy_id);
    const linkPayload = {
      amount: Math.round(paymentMeta.amountDue * 100),
      currency: "INR",
      accept_partial: false,
      description: `Buy-once COD collection for delivery ${row.id}`,
      reference_id: `delivery_${row.id}_${Date.now()}`.slice(0, 40),
      expire_by: Math.floor(Date.now() / 1000) + 30 * 60,
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        delivery_id: String(row.id),
        customer_id: String(row.customer_id),
        dairy_id: String(row.dairy_id),
      },
      transfers: [
        {
          account: linkedAccountId,
          amount: Math.round(paymentMeta.amountDue * 100),
          currency: "INR",
          notes: {
            delivery_id: String(row.id),
            customer_id: String(row.customer_id),
            dairy_id: String(row.dairy_id),
            collection_mode: "AGENT_QR",
          },
        },
      ],
    };

    const linkResponse = await axios.post("https://api.razorpay.com/v1/payment_links", linkPayload, {
      auth: {
        username: keyId,
        password: keySecret,
      },
      timeout: 15000,
    });

    const payload = {
      qrId: null,
      imageUrl: null,
      shortUrl: linkResponse.data?.short_url || null,
      imageContent: null,
      amountDue: paymentMeta.amountDue,
      currency: "INR",
      closeBy: linkResponse.data?.expire_by || null,
      provider: "RAZORPAY_PAYMENT_LINK",
    };

    onlineCollectionCache.set(cacheKey, {
      payload,
      at: Date.now(),
    });

    return payload;
  } catch (err) {
    const message =
      err?.response?.data?.error?.description ||
      err?.response?.data?.description ||
      err?.message ||
      "Failed to create Razorpay payment link";
    const error = new Error(message);
    error.statusCode = err?.response?.status || 500;
    throw error;
  }
};

export const createAgentOnlineCollectionOrder = async ({
  agentDbId,
  dairyId = null,
  deliveryId,
} = {}) => {
  const row = await fetchAssignedDeliveryRow({ agentDbId, dairyId, deliveryId });
  const paymentMeta = parseOrderPaymentMeta(row.notes, row.quantity_liters);
  const deliveryType = getDeliveryTypeFromNotes(row.notes);

  if (deliveryType !== "BUY ONCE" || paymentMeta.paymentMethod !== "COD") {
    const error = new Error("Online collection is available only for COD buy-once deliveries");
    error.statusCode = 400;
    throw error;
  }

  if (normalizeStatusForCard(row.status) !== "PENDING") {
    const error = new Error("Online payment can only be started for pending deliveries");
    error.statusCode = 400;
    throw error;
  }

  const paymentRow = await findPaymentRowByDeliveryId({
    customerId: row.customer_id,
    dairyId: row.dairy_id,
    deliveryId: row.id,
  });

  if (!paymentRow?.id) {
    const error = new Error("Payment record not found for this delivery");
    error.statusCode = 404;
    throw error;
  }

  const amountInRupees = Number(paymentRow.amount ?? paymentMeta.amountDue ?? 0);
  if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
    const error = new Error("Payment amount must be greater than zero");
    error.statusCode = 400;
    throw error;
  }

  const razorpay = getRazorpayClient();
  const linkedAccountId = await getDairyLinkedAccountId(row.dairy_id);
  const order = await razorpay.orders.create({
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    receipt: `agent_collect_${row.id}_${Date.now()}`.slice(0, 40),
    partial_payment: false,
    notes: {
      delivery_id: String(row.id),
      payment_id: String(paymentRow.id),
      customer_id: String(row.customer_id),
      dairy_id: String(row.dairy_id),
      collection_mode: "AGENT_ONLINE",
    },
    transfers: [
      {
        account: linkedAccountId,
        amount: Math.round(amountInRupees * 100),
        currency: "INR",
        notes: {
          delivery_id: String(row.id),
          payment_id: String(paymentRow.id),
          customer_id: String(row.customer_id),
          dairy_id: String(row.dairy_id),
          collection_mode: "AGENT_ONLINE",
        },
      },
    ],
  });

  return {
    keyId: getRazorpayConfig().keyId,
    order,
    payment: {
      id: paymentRow.id,
      amount: amountInRupees,
      title: paymentRow.description || `Delivery ${row.id} Payment`,
    },
  };
};

export const verifyAgentOnlineCollectionPayment = async ({
  agentDbId,
  dairyId = null,
  deliveryId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
} = {}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    const error = new Error("Missing Razorpay verification fields");
    error.statusCode = 400;
    throw error;
  }

  const row = await fetchAssignedDeliveryRow({ agentDbId, dairyId, deliveryId });
  const deliveryType = getDeliveryTypeFromNotes(row.notes);
  const paymentMeta = parseOrderPaymentMeta(row.notes, row.quantity_liters);

  if (deliveryType !== "BUY ONCE" || paymentMeta.paymentMethod !== "COD") {
    const error = new Error("Online collection is available only for COD buy-once deliveries");
    error.statusCode = 400;
    throw error;
  }

  const paymentRow = await findPaymentRowByDeliveryId({
    customerId: row.customer_id,
    dairyId: row.dairy_id,
    deliveryId: row.id,
  });

  if (!paymentRow?.id) {
    const error = new Error("Payment record not found for this delivery");
    error.statusCode = 404;
    throw error;
  }

  const generatedSignature = crypto
    .createHmac("sha256", getRazorpayConfig().keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    const error = new Error("Payment signature verification failed");
    error.statusCode = 400;
    throw error;
  }

  const updatePayload = {
    status: "PAID",
    method: "RAZORPAY_UPI",
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  };

  let updateQuery = supabase
    .from("payments")
    .update(updatePayload)
    .eq("id", paymentRow.id)
    .eq("customer_id", row.customer_id)
    .eq("dairy_id", row.dairy_id);

  const { error: updateError } = await updateQuery;
  if (updateError && isMissingColumnError(updateError)) {
    const { error: fallbackError } = await supabase
      .from("payments")
      .update({
        status: "PAID",
        method: "RAZORPAY_UPI",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id)
      .eq("customer_id", row.customer_id)
      .eq("dairy_id", row.dairy_id);

    if (fallbackError) throw fallbackError;
  } else if (updateError) {
    throw updateError;
  }

  return {
    success: true,
    paymentId: paymentRow.id,
    razorpayPaymentId,
    razorpayOrderId,
    status: "PAID",
  };
};

export const getAgentDashboard = async ({ agentDbId, dairyId = null } = {}) => {
  const today = getLocalTodayIso();
  const deliveries = await getAgentAssignedDeliveries({ agentDbId, dairyId, date: today });

  const completed = deliveries.filter((row) => row.status === "COMPLETED").length;
  const failed = deliveries.filter((row) => row.status === "FAILED").length;
  const pending = deliveries.filter((row) => row.status === "PENDING").length;

  return {
    stats: {
      totalAssigned: deliveries.length,
      completed,
      pending,
      failed,
      date: new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    },
    deliveries,
  };
};

export const getAgentDeliveryHistory = async ({ agentDbId, dairyId = null } = {}) => {
  const today = getLocalTodayIso();
  const rows = await fetchDeliveryRows({
    agentDbId,
    dairyId,
    beforeDate: today,
    limit: 2000,
  });

  if (!rows.length) return [];
  const lookups = await buildLookupMaps(rows);

  const grouped = new Map();
  for (const row of rows) {
    const mapped = mapAssignedDelivery(row, lookups);
    const dateKey = normalizeDate(row.delivery_date || row.created_at) || today;
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);

    const completedAtValue = mapped.completedAt ? new Date(mapped.completedAt) : null;
    const completedAt = completedAtValue && !Number.isNaN(completedAtValue.getTime())
      ? completedAtValue.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : "-";

    grouped.get(dateKey).push({
      id: mapped.id,
      customerName: mapped.customerName,
      milkQuantity: mapped.quantity,
      address: mapped.address,
      phone: mapped.phoneNumber,
      status: normalizeStatusForHistory(mapped.status),
      completedAt,
      dairyName: mapped.dairyFarmName,
      failedReason: mapped.failedReason,
      failedImage: mapped.failedImage,
    });
  }

  return [...grouped.entries()]
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([date, deliveries]) => ({ date, deliveries }));
};

export const getAgentProfile = async ({ agentDbId, dairyId = null } = {}) => {
  const agent = await fetchAgentCore(agentDbId, dairyId);
  if (!agent) {
    const error = new Error("Agent not found");
    error.statusCode = 404;
    throw error;
  }

  const routes = String(agent.building || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const availability = deriveAgentAvailability(agent);
  let dairy = null;

  if (agent.dairy_id) {
    const { data, error } = await supabase
      .from("dairies")
      .select("id, dairy_name, latitude, longitude")
      .eq("id", agent.dairy_id)
      .maybeSingle();

    if (error) throw error;
    dairy = data || null;
  }

  return {
    agentId: agent.agent_id || "",
    name: agent.agent_name || "",
    email: agent.email || "",
    phone: agent.phone_number || "",
    address: agent.building || "",
    status: availability.resolvedStatus,
    isActive: availability.isActive,
    inactiveFrom: availability.inactiveFrom,
    inactiveUntil: availability.inactiveUntil,
    inactiveDaysRemaining: availability.inactiveDaysRemaining,
    joinedDate: agent.created_at || null,
    deliveryRoutes: routes,
    dairyName: dairy?.dairy_name || "",
    dairyLatitude: normalizeCoordinate(dairy?.latitude),
    dairyLongitude: normalizeCoordinate(dairy?.longitude),
  };
};

export const updateAgentAvailability = async ({
  agentDbId,
  dairyId = null,
  isActive,
  inactiveDays = null,
} = {}) => {
  const makeError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  };

  if (typeof isActive !== "boolean") {
    throw makeError("isActive must be provided as true or false");
  }

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const toDateOnly = (dateObj) =>
    `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(
      dateObj.getDate()
    ).padStart(2, "0")}`;

  let payload = {};
  if (isActive) {
    payload = {
      status: "ACTIVE",
      inactive_from: null,
      inactive_until: null,
      inactive_days: null,
      updated_at: new Date().toISOString(),
    };
  } else {
    const parsedDays = Number(inactiveDays);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      throw makeError("inactiveDays must be a positive number");
    }
    const safeDays = Math.min(Math.floor(parsedDays), 365);
    const until = new Date(todayDate);
    until.setDate(until.getDate() + safeDays - 1);

    payload = {
      status: "INACTIVE",
      inactive_from: new Date().toISOString(),
      inactive_until: toDateOnly(until),
      inactive_days: safeDays,
      updated_at: new Date().toISOString(),
    };
  }

  let query = supabase.from("agents").update(payload).eq("id", agentDbId);
  if (dairyId) query = query.eq("dairy_id", dairyId);
  query = query.select("id, status, inactive_from, inactive_until, inactive_days").maybeSingle();

  const { data, error } = await query;
  if (!error && data) {
    const availability = deriveAgentAvailability(data);
    return {
      status: availability.resolvedStatus,
      isActive: availability.isActive,
      inactiveFrom: availability.inactiveFrom,
      inactiveUntil: availability.inactiveUntil,
      inactiveDaysRemaining: availability.inactiveDaysRemaining,
    };
  }

  if (!isMissingColumnError(error)) {
    throw error;
  }

  // Fallback for older schemas that only have `status`.
  const statusOnlyPayload = {
    status: isActive ? "ACTIVE" : "INACTIVE",
    updated_at: new Date().toISOString(),
  };
  let fallback = supabase.from("agents").update(statusOnlyPayload).eq("id", agentDbId);
  if (dairyId) fallback = fallback.eq("dairy_id", dairyId);
  fallback = fallback.select("id, status").maybeSingle();

  const { data: fallbackData, error: fallbackError } = await fallback;
  if (fallbackError) {
    if (isMissingColumnError(fallbackError)) {
      throw makeError(
        "Agent status columns are missing in database. Run latest SUPABASE_MIGRATIONS.sql.",
        500
      );
    }
    throw fallbackError;
  }

  if (!fallbackData) {
    throw makeError("Unable to update agent availability", 500);
  }

  if (!isActive && inactiveDays) {
    // DB accepted status update but does not support inactivity date range columns.
    return {
      status: "INACTIVE",
      isActive: false,
      inactiveFrom: null,
      inactiveUntil: null,
      inactiveDaysRemaining: Number(inactiveDays) || 0,
      warning: "Database does not support inactivity date tracking yet. Run latest migration.",
    };
  }

  return {
    status: String(fallbackData.status || "ACTIVE").toUpperCase(),
    isActive: String(fallbackData.status || "ACTIVE").toUpperCase() !== "INACTIVE",
    inactiveFrom: null,
    inactiveUntil: null,
    inactiveDaysRemaining: 0,
  };
};

export const updateAgentDeliveryStatus = async ({
  agentDbId,
  dairyId = null,
  deliveryId,
  status,
  reason = "",
  proofType = "",
  proofOtp = "",
  proofImage = "",
  collectionMethod = "",
} = {}) => {
  const parsedId = Number(deliveryId);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    const error = new Error("deliveryId is required");
    error.statusCode = 400;
    throw error;
  }

  const nextStatus = normalizeStatusForCard(status);
  if (!["PENDING", "COMPLETED", "FAILED"].includes(nextStatus)) {
    const error = new Error("Invalid status");
    error.statusCode = 400;
    throw error;
  }

  let existingQuery = supabase
    .from("deliveries")
    .select("id, customer_id, agent_id, dairy_id, delivery_date, milk_type, quantity_liters, status, notes")
    .eq("id", parsedId)
    .eq("agent_id", agentDbId)
    .limit(1);

  if (dairyId) existingQuery = existingQuery.eq("dairy_id", dairyId);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw existingError;
  if (!existing) {
    const error = new Error("Assigned delivery not found");
    error.statusCode = 404;
    throw error;
  }

  const dbStatus = nextStatus === "COMPLETED" ? "COMPLETED" : nextStatus;
  const deliveryType = getDeliveryTypeFromNotes(existing.notes);
  const orderPaymentMeta = parseOrderPaymentMeta(existing.notes, existing.quantity_liters);
  const normalizedCollectionMethod = String(collectionMethod || "").trim().toUpperCase();
  const paymentRow = await findPaymentRowByDeliveryId({
    customerId: existing.customer_id,
    dairyId: existing.dairy_id,
    deliveryId: existing.id,
  });

  if (
    nextStatus === "COMPLETED" &&
    deliveryType === "BUY ONCE" &&
    orderPaymentMeta.paymentMethod === "COD" &&
    !["CASH", "ONLINE"].includes(normalizedCollectionMethod)
  ) {
    const error = new Error("Payment collection method is required for COD buy-once deliveries");
    error.statusCode = 400;
    throw error;
  }

  if (
    nextStatus === "COMPLETED" &&
    deliveryType === "BUY ONCE" &&
    orderPaymentMeta.paymentMethod === "COD" &&
    normalizedCollectionMethod === "ONLINE" &&
    String(paymentRow?.status || "").toUpperCase() !== "PAID"
  ) {
    const error = new Error("Complete the Razorpay payment before confirming delivery");
    error.statusCode = 400;
    throw error;
  }

  const normalizedProofType = String(proofType || "").trim().toUpperCase();
  const otpMasked = String(proofOtp || "").trim();
  const hasProofImage = Boolean(String(proofImage || "").trim());

  const proofValue = normalizedProofType === "OTP"
    ? `OTP_${otpMasked.slice(-4).padStart(4, "*")}`
    : normalizedProofType === "PHOTO" && hasProofImage
    ? "PHOTO_ATTACHED"
    : "";

  let notes = nextStatus === "FAILED"
    ? withFailureReason(existing.notes, reason)
    : withFailureReason(existing.notes, "");

  if (nextStatus === "COMPLETED") {
    notes = withDeliveryProof(notes, normalizedProofType, proofValue);
    if (deliveryType === "BUY ONCE" && orderPaymentMeta.paymentMethod === "COD") {
      notes = withPaymentCollection(notes, normalizedCollectionMethod, "PAID");
    } else {
      notes = withPaymentCollection(notes, "", "");
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("deliveries")
    .update({
      status: dbStatus,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedId)
    .eq("agent_id", agentDbId)
    .select("id, status, notes, updated_at")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) {
    const error = new Error("Failed to update delivery status");
    error.statusCode = 500;
    throw error;
  }

  if (nextStatus === "COMPLETED") {
    // Reduce product stock for subscription-based/regular deliveries
    if (normalizeStatusForCard(existing.status) !== "COMPLETED" && deliveryType !== "BUY ONCE") {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, stock_quantity")
        .eq("dairy_id", existing.dairy_id)
        .ilike("name", existing.milk_type)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!productError && product) {
        const availableStock = Number(product.stock_quantity || 0);
        const quantity = Number(existing.quantity_liters || 0);
        const nextStock = Number(Math.max(0, availableStock - quantity).toFixed(2));

        await supabase
          .from("products")
          .update({
            stock_quantity: nextStock,
            updated_at: new Date().toISOString(),
          })
          .eq("id", product.id)
          .eq("dairy_id", existing.dairy_id);
      }
    }

    if (
      deliveryType === "BUY ONCE" &&
      orderPaymentMeta.paymentMethod === "COD" &&
      normalizedCollectionMethod === "CASH"
    ) {
      const descriptionPattern = `%delivery_id=${existing.id}%`;
      const { error: paymentUpdateError } = await supabase
        .from("payments")
        .update({
          status: "PAID",
          method: "CASH",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("customer_id", existing.customer_id)
        .eq("dairy_id", existing.dairy_id)
        .ilike("description", descriptionPattern);

      if (paymentUpdateError) throw paymentUpdateError;
    }

    await ensureBuyOnceInvoiceForDeliveredOrder({
      ...existing,
      status: updated.status,
      notes: updated.notes,
      updated_at: updated.updated_at,
    });
    await syncCustomerMonthlyBills(existing.customer_id);
  }

  return {
    deliveryId: updated.id,
    status: normalizeStatusForCard(updated.status),
    failedReason: parseFailedReason(updated.notes),
    deliveryProofType: parseDeliveryProof(updated.notes).proofType,
    deliveryProofValue: parseDeliveryProof(updated.notes).proofValue,
    paymentCollectionMethod: parsePaymentCollection(updated.notes).collectionMethod,
    updatedAt: updated.updated_at || null,
  };
};
