import axios from "axios";
import crypto from "crypto";
import Razorpay from "razorpay";
import { supabase } from "../../config/supabase.js";
import { getRazorpayConfig } from "../../config/razorpay.js";
import {
  ensureBuyOnceInvoiceForDeliveredOrder,
  syncCustomerMonthlyBills,
} from "../customer/monthlyBilling.service.js";

const onlineCollectionCache = new Map();
const ONLINE_COLLECTION_TTL_MS = 20 * 60 * 1000;

const isValidDateString = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
};

const parseDateSafe = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const deriveAgentAvailability = (agent = {}) => {
  const status = String(agent?.status || "ACTIVE").toUpperCase();
  const inactiveUntilRaw = agent?.inactive_until || null;
  const inactiveUntilDate = parseDateSafe(inactiveUntilRaw);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const inFutureWindow = inactiveUntilDate ? inactiveUntilDate >= todayStart : false;
  const isInactive = status === "INACTIVE" && (inactiveUntilDate ? inFutureWindow : true);

  let inactiveDaysRemaining = 0;
  if (isInactive && inactiveUntilDate) {
    const end = new Date(
      inactiveUntilDate.getFullYear(),
      inactiveUntilDate.getMonth(),
      inactiveUntilDate.getDate()
    );
    const diffMs = end.getTime() - todayStart.getTime();
    inactiveDaysRemaining = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1);
  } else if (isInactive) {
    inactiveDaysRemaining = Number(agent?.inactive_days || 0) || 0;
  }

  return {
    resolvedStatus: isInactive ? "INACTIVE" : "ACTIVE",
    isActive: !isInactive,
    inactiveUntil: inactiveUntilRaw,
    inactiveFrom: agent?.inactive_from || null,
    inactiveDaysRemaining,
  };
};

const getLocalTodayIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const normalizeDate = (value) => {
  if (!value) return "";
  if (isValidDateString(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const formatQuantity = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  const compact = Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toFixed(2).replace(/\.?0+$/, "");
  return `${compact} L`;
};

const SLOT_WINDOWS = {
  MORNING: "6:00 AM - 9:00 AM",
  EVENING: "5:00 PM - 8:00 PM",
};

const normalizeDeliverySlot = (value) => {
  const slot = String(value || "").trim().toUpperCase();
  if (slot.startsWith("MOR")) return "MORNING";
  if (slot.startsWith("EVE")) return "EVENING";
  return slot;
};

const toDeliverySlotLabel = (slotKey) => {
  if (slotKey === "MORNING") return "Morning";
  if (slotKey === "EVENING") return "Evening";
  return String(slotKey || "").trim() || "-";
};

const getDeliverySlotWindow = (slotKey) =>
  SLOT_WINDOWS[String(slotKey || "").toUpperCase()] || null;

const normalizeCoordinate = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(6)) : null;
};

const normalizeStatusForCard = (status) => {
  const value = String(status || "").trim().toUpperCase();
  if (value === "DELIVERED" || value === "COMPLETED") return "COMPLETED";
  if (value === "IN_TRANSIT" || value === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (
    value === "FAILED" ||
    value === "CANCELLED" ||
    value === "CANCELED" ||
    value === "MISSED" ||
    value === "SKIPPED"
  ) {
    return "FAILED";
  }
  return "PENDING";
};

const normalizeStatusForHistory = (status) => {
  const cardStatus = normalizeStatusForCard(status);
  if (cardStatus === "COMPLETED") return "completed";
  if (cardStatus === "FAILED") return "failed";
  return "pending";
};

const formatAddress = (customer = {}) => {
  const parts = [
    customer.address_line_1,
    customer.address_line_2,
    customer.building_name,
    customer.wing,
    customer.room_no,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "-";
};

const getRazorpayClient = () => {
  const { keyId, keySecret } = getRazorpayConfig();

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

const getDairyLinkedAccountId = async (dairyId) => {
  if (!dairyId) return null;

  const { data, error } = await supabase
    .from("dairies")
    .select("id, dairy_name, razorpay_linked_account_id")
    .eq("id", dairyId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      const missingConfigError = new Error(
        "Database is missing dairy Razorpay Route configuration. Run the latest migrations first."
      );
      missingConfigError.statusCode = 500;
      throw missingConfigError;
    }
    throw error;
  }

  const linkedAccountId = String(data?.razorpay_linked_account_id || "").trim();
  if (!linkedAccountId) {
    const configError = new Error(
      `Dairy ${data?.dairy_name || ""}`.trim()
        ? `${data?.dairy_name} is not configured for direct Razorpay settlement yet.`
        : "This dairy is not configured for direct Razorpay settlement yet."
    );
    configError.statusCode = 400;
    throw configError;
  }

  return linkedAccountId;
};

const parseNotesField = (notes, field) => {
  const match = String(notes || "").match(new RegExp(`${field}=([^;\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
};

const getDeliveryTypeFromNotes = (notes) => {
  const text = String(notes || "");
  if (text.includes("[ONE_TIME_ORDER]")) {
    return "BUY ONCE";
  }
  if (text.includes("[SUBSCRIPTION_DAILY]")) {
    return "SUBSCRIPTION";
  }
  return "REGULAR";
};

const parseOrderPaymentMeta = (notes, quantityLiters) => {
  const paymentMethod = String(parseNotesField(notes, "payment") || "").trim().toUpperCase() || null;
  const unitPrice = Number(parseNotesField(notes, "unit_price"));
  const quantity = Number(quantityLiters || 0);
  const amountDue =
    Number.isFinite(unitPrice) && unitPrice >= 0 && Number.isFinite(quantity) && quantity > 0
      ? Number((unitPrice * quantity).toFixed(2))
      : 0;

  return {
    paymentMethod,
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
    amountDue,
  };
};

const parseFailedReason = (notes) => {
  const text = String(notes || "");
  const marker = "[FAILED_REASON]:";
  const index = text.indexOf(marker);
  if (index < 0) return null;
  const reason = text.slice(index + marker.length).trim();
  return reason || null;
};

const parseDeliveryProof = (notes) => {
  const text = String(notes || "");
  const marker = "[DELIVERY_PROOF]:";
  const index = text.indexOf(marker);
  if (index < 0) return { proofType: null, proofValue: null };
  const raw = text.slice(index + marker.length).trim();
  if (!raw) return { proofType: null, proofValue: null };

  const [typePart, valuePart] = raw.split("|", 2);
  return {
    proofType: String(typePart || "").trim() || null,
    proofValue: String(valuePart || "").trim() || null,
  };
};

const parsePaymentCollection = (notes) => {
  const text = String(notes || "");
  const marker = "[PAYMENT_COLLECTION]:";
  const index = text.indexOf(marker);
  if (index < 0) return { collectionMethod: null, paymentStatus: null };

  const raw = text.slice(index + marker.length).trim();
  const [methodPart, statusPart] = raw.split("|", 2);
  return {
    collectionMethod: String(methodPart || "").trim().toUpperCase() || null,
    paymentStatus: String(statusPart || "").trim().toUpperCase() || null,
  };
};

const withDeliveryProof = (notes, proofType, proofValue = "") => {
  const safeType = String(proofType || "").trim().toUpperCase();
  const safeValue = String(proofValue || "").trim();
  const current = String(notes || "").trim();

  const lines = current
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[DELIVERY_PROOF]:"));

  if (!safeType) {
    return lines.length ? lines.join("\n") : null;
  }

  lines.push(`[DELIVERY_PROOF]: ${safeType}${safeValue ? `|${safeValue}` : ""}`);
  return lines.join("\n");
};

const withFailureReason = (notes, reason) => {
  const safeReason = String(reason || "").trim();
  const current = String(notes || "").trim();
  const lines = current
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[FAILED_REASON]:"));

  if (!safeReason) return lines.length ? lines.join("\n") : null;
  lines.push(`[FAILED_REASON]: ${safeReason}`);
  return lines.join("\n");
};

const withPaymentCollection = (notes, collectionMethod = "", paymentStatus = "") => {
  const current = String(notes || "").trim();
  const lines = current
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[PAYMENT_COLLECTION]:"));

  const safeMethod = String(collectionMethod || "").trim().toUpperCase();
  const safeStatus = String(paymentStatus || "").trim().toUpperCase();
  if (!safeMethod && !safeStatus) {
    return lines.length ? lines.join("\n") : null;
  }

  lines.push(`[PAYMENT_COLLECTION]: ${safeMethod}${safeStatus ? `|${safeStatus}` : ""}`);
  return lines.join("\n");
};

const fetchAgentCore = async (agentDbId, dairyId = null) => {
  const selectableSets = [
    "id, agent_id, agent_name, email, phone_number, building, dairy_id, status, inactive_from, inactive_until, inactive_days, created_at",
    "id, agent_id, agent_name, email, phone_number, building, dairy_id, status, created_at",
    "id, agent_id, agent_name, email, phone_number, building, dairy_id, created_at",
  ];

  for (const fields of selectableSets) {
    let query = supabase
      .from("agents")
      .select(fields)
      .eq("id", agentDbId)
      .limit(1);

    if (dairyId) {
      query = query.eq("dairy_id", dairyId);
    }

    const { data, error } = await query.maybeSingle();
    if (!error) {
      return {
        ...data,
        status: data?.status || "ACTIVE",
        inactive_from: data?.inactive_from || null,
        inactive_until: data?.inactive_until || null,
        inactive_days: data?.inactive_days ?? null,
      };
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  return null;
};

const fetchDeliveryRows = async ({
  agentDbId,
  dairyId = null,
  date = null,
  beforeDate = null,
  limit = 500,
} = {}) => {
  let query = supabase
    .from("deliveries")
    .select(
      "id, customer_id, dairy_id, agent_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, updated_at, created_at"
    )
    .eq("agent_id", agentDbId)
    .order("delivery_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (dairyId) query = query.eq("dairy_id", dairyId);
  if (date) query = query.eq("delivery_date", date);
  if (beforeDate) query = query.lt("delivery_date", beforeDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

const fetchAssignedDeliveryRow = async ({ agentDbId, dairyId = null, deliveryId } = {}) => {
  const parsedId = Number(deliveryId);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    const error = new Error("Valid deliveryId is required");
    error.statusCode = 400;
    throw error;
  }

  let query = supabase
    .from("deliveries")
    .select(
      "id, customer_id, dairy_id, agent_id, delivery_date, milk_type, quantity_liters, status, approval_status, notes, updated_at, created_at"
    )
    .eq("id", parsedId)
    .eq("agent_id", agentDbId)
    .limit(1);

  if (dairyId) query = query.eq("dairy_id", dairyId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) {
    const notFound = new Error("Assigned delivery not found");
    notFound.statusCode = 404;
    throw notFound;
  }

  return data;
};

const findPaymentRowByDeliveryId = async ({ customerId, dairyId, deliveryId } = {}) => {
  const descriptionPattern = `%delivery_id=${deliveryId}%`;
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("customer_id", customerId)
    .eq("dairy_id", dairyId)
    .ilike("description", descriptionPattern)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

const buildLookupMaps = async (rows) => {
  const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
  const dairyIds = [...new Set(rows.map((row) => row.dairy_id).filter(Boolean))];

  const [customersResp, dairiesResp] = await Promise.all([
    customerIds.length
      ? supabase
          .from("customers")
          .select(
            "id, customer_name, phone_number, address_line_1, address_line_2, building_name, wing, room_no, latitude, longitude"
          )
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    dairyIds.length
      ? supabase
          .from("dairies")
          .select("id, dairy_name, upi_id, latitude, longitude")
          .in("id", dairyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customersResp.error) throw customersResp.error;
  if (dairiesResp.error) throw dairiesResp.error;

  return {
    customersById: new Map((customersResp.data || []).map((row) => [row.id, row])),
    dairiesById: new Map((dairiesResp.data || []).map((row) => [row.id, row])),
  };
};

const mapAssignedDelivery = (row, lookups) => {
  const customer = lookups.customersById.get(row.customer_id) || {};
  const dairy = lookups.dairiesById.get(row.dairy_id) || {};
  const latitude = normalizeCoordinate(customer.latitude);
  const longitude = normalizeCoordinate(customer.longitude);
  const dairyLatitude = normalizeCoordinate(dairy.latitude);
  const dairyLongitude = normalizeCoordinate(dairy.longitude);
  const parsedProof = parseDeliveryProof(row.notes);
  const deliveryType = getDeliveryTypeFromNotes(row.notes);
  const paymentMeta = parseOrderPaymentMeta(row.notes, row.quantity_liters);
  const paymentCollection = parsePaymentCollection(row.notes);
  const requiresPaymentCollection =
    deliveryType === "BUY ONCE" && paymentMeta.paymentMethod === "COD";
  const parsedSlot = normalizeDeliverySlot(row.delivery_slot || parseNotesField(row.notes, "slot") || "");
  const slotKey = ["MORNING", "EVENING"].includes(parsedSlot) ? parsedSlot : null;
  const slot = slotKey ? toDeliverySlotLabel(slotKey) : String(row.delivery_slot || parseNotesField(row.notes, "slot") || "-");
  const slotWindow = getDeliverySlotWindow(slotKey);

  return {
    id: String(row.id),
    rawId: row.id,
    customerName: customer.customer_name || `Customer #${row.customer_id ?? "-"}`,
    phoneNumber: customer.phone_number || "-",
    address: formatAddress(customer),
    addressLine1: customer.address_line_1 || "",
    addressLine2: customer.address_line_2 || "",
    buildingName: customer.building_name || "",
    wing: customer.wing || "",
    roomNo: customer.room_no || "",
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    hasLocationPin: latitude !== null && longitude !== null,
    milk_type: row.milk_type || "",
    milkType: row.milk_type || "",
    product: row.milk_type || "",
    productName: row.milk_type || "",
    quantity_liters: Number(row.quantity_liters ?? 0),
    quantity: formatQuantity(row.quantity_liters),
    status: normalizeStatusForCard(row.status),
    dairyFarmId: row.dairy_id ?? null,
    dairyFarmName: dairy.dairy_name || "Dairy",
    dairyLatitude,
    dairyLongitude,
    dairyLat: dairyLatitude,
    dairyLng: dairyLongitude,
    farmPhoneNumber: "-",
    deliveryType,
    slot,
    slotKey,
    slotWindow,
    orderPaymentMethod: paymentMeta.paymentMethod || null,
    requiresPaymentCollection,
    amountDue: paymentMeta.amountDue,
    upiId: dairy.upi_id || null,
    paymentCollectionMethod: paymentCollection.collectionMethod,
    paymentCollectionStatus: paymentCollection.paymentStatus,
    failedReason: parseFailedReason(row.notes),
    deliveryProofType: parsedProof.proofType,
    deliveryProofValue: parsedProof.proofValue,
    failedImage: null,
    date: normalizeDate(row.delivery_date || row.created_at),
    completedAt: row.updated_at || row.created_at || null,
  };
};

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
  if (cached && Date.now() - cached.at < ONLINE_COLLECTION_TTL_MS) {
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
