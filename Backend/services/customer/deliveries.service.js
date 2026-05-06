import { supabase } from "../../config/supabase.js";
import { appendDeliveryBillingMeta } from "./monthlyBilling.service.js";
import { addAmountToCustomerWallet } from "./payments.service.js";
import { getSubscriptionByCustomerId } from "./subscription.service.js";
import {
  autoFailOverduePendingSubscriptionDeliveriesForCustomer,
  ensureCustomerSubscriptionDeliveryForDate,
} from "./subscription.automation.service.js";

const VALID_ONE_TIME_SLOTS = new Set(["MORNING", "EVENING"]);
const SLOT_WINDOWS = {
  MORNING: "6:00 AM - 9:00 AM",
  EVENING: "5:00 PM - 8:00 PM",
};

const isValidDateString = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const getLocalDateInput = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toFiniteNumber = (value, fallback = NaN) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveId = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const buildCustomerAddress = (customer = {}) => {
  const parts = [
    customer?.building_name,
    customer?.wing,
    customer?.room_no,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return parts.join(", ");
};

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
};

const isMissingTableError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("relation") && message.includes("does not exist");
};

const isUuidSyntaxError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("invalid input syntax for type uuid");
};

const hasOpenSubscriptionStatus = (status) => {
  const value = String(status || "ACTIVE").trim().toUpperCase();
  return value !== "CLOSED" && value !== "CANCELLED" && value !== "CANCELED";
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
};

const normalizeOneTimeSlot = (value) => {
  const slot = String(value || "").trim().toUpperCase();
  if (slot.startsWith("MOR")) return "MORNING";
  if (slot.startsWith("EVE")) return "EVENING";
  return slot;
};

const normalizeOneTimePaymentMethod = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "PAY_NOW";
  if (
    normalized === "PAY_NOW" ||
    normalized === "PAYNOW" ||
    normalized === "ONLINE" ||
    normalized === "ONLINE_PAYMENT" ||
    normalized === "UPI" ||
    normalized === "RAZORPAY"
  ) {
    return "PAY_NOW";
  }
  if (normalized === "COD" || normalized === "CASH" || normalized === "CASH_ON_DELIVERY") {
    return "COD";
  }
  if (
    normalized === "MONTHLY_BILL" ||
    normalized === "MONTHLY BILL" ||
    normalized === "ADD_TO_SUBSCRIPTION" ||
    normalized === "SUBSCRIPTION"
  ) {
    return "MONTHLY_BILL";
  }
  return normalized;
};

const toSlotLabel = (slotKey) => {
  if (slotKey === "MORNING") return "Morning";
  if (slotKey === "EVENING") return "Evening";
  return String(slotKey || "").trim() || "-";
};

const getSlotWindow = (slotKey) => SLOT_WINDOWS[String(slotKey || "").toUpperCase()] || null;

const getDeliveryTypeLabel = (isOneTimeOrder) =>
  isOneTimeOrder ? "ONE_TIME" : "SUBSCRIPTION";

const parseOneTimeNotes = (notesValue) => {
  const notes = String(notesValue || "");
  const isOneTimeOrder = notes.includes("[ONE_TIME_ORDER]");
  if (!isOneTimeOrder) {
    return {
      isOneTimeOrder: false,
      slotKey: null,
      paymentMethod: null,
      address: null,
    };
  }

  const slotMatch = notes.match(/slot=([^;]+)/i);
  const paymentMatch = notes.match(/payment=([^;]+)/i);
  const addressMatch = notes.match(/address=(.*)$/i);
  const parsedSlot = normalizeOneTimeSlot(slotMatch?.[1] || "");
  const slotKey = VALID_ONE_TIME_SLOTS.has(parsedSlot) ? parsedSlot : null;

  return {
    isOneTimeOrder: true,
    slotKey,
    paymentMethod: paymentMatch?.[1]?.trim()?.toUpperCase() || null,
    address: addressMatch?.[1]?.trim() || null,
  };
};

const parseNotesField = (notesValue, fieldName) => {
  const notes = String(notesValue || "");
  const field = String(fieldName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!field) return null;

  const match = notes.match(new RegExp(`(?:^|[;\\n]\\s*)${field}=([^;\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
};

const parseLatestCustomerIssueFromNotes = (notesValue) => {
  const notes = String(notesValue || "");
  const lines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const taggedIssueLines = lines.filter((line) => line.startsWith("[CUSTOMER_ISSUE]"));
  if (taggedIssueLines.length === 0) {
    return { issue: null, reportedAt: null };
  }

  const latestLine = taggedIssueLines[taggedIssueLines.length - 1];
  const match = latestLine.match(/^\[CUSTOMER_ISSUE\]\s*([^\s]+)\s*::\s*(.+)$/i);
  if (!match) {
    return { issue: latestLine.replace("[CUSTOMER_ISSUE]", "").trim() || null, reportedAt: null };
  }

  const reportedAtRaw = String(match[1] || "").trim();
  const issue = String(match[2] || "").trim() || null;
  const parsedDate = new Date(reportedAtRaw);

  return {
    issue,
    reportedAt: Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString(),
  };
};

const parseLatestCustomerIssue = (row = {}) => {
  const directIssue = String(row?.customer_issue_text || "").trim();
  const directReportedAt = row?.customer_issue_reported_at || null;
  const issueStatus = String(row?.customer_issue_status || "").toUpperCase();

  if (directIssue && issueStatus !== "RESOLVED") {
    return {
      issue: directIssue,
      reportedAt: directReportedAt,
    };
  }

  // Backward compatibility for older rows where issue text lived in notes only.
  return parseLatestCustomerIssueFromNotes(row?.notes);
};

const getIssueMeta = (row = {}) => {
  const issueStatus = String(row?.customer_issue_status || "").toUpperCase();
  const issueAdminAction = String(row?.customer_issue_admin_action || "").trim() || null;
  const issueResolvedAt = row?.customer_issue_resolved_at || null;

  return {
    issueStatus: issueStatus || (row?.customer_issue_text ? "OPEN" : "NONE"),
    issueAdminAction,
    issueResolvedAt,
  };
};

const toTitleStatus = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "DELIVERED" || value === "COMPLETED") return "DELIVERED";
  if (value === "IN_TRANSIT" || value === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (value === "FAILED" || value === "MISSED") return "FAILED";
  if (value === "CANCELLED" || value === "CANCELED") return "CANCELLED";
  if (value === "SKIPPED") return "SKIPPED";
  if (value === "PENDING") return "PENDING";
  return "PENDING";
};

const toApprovalStatus = (approvalStatus, { isOneTimeOrder = false } = {}) => {
  const normalized = String(approvalStatus || "").toUpperCase();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "PENDING") return "PENDING";
  if (normalized === "CANCELLED" || normalized === "CANCELED") return "CANCELLED";
  return isOneTimeOrder ? "PENDING" : "APPROVED";
};

const formatDateLabel = (value) => {
  if (!value) return "-";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "-";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yday = new Date(today);
  yday.setDate(today.getDate() - 1);
  const d = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yday.getTime()) return "Yesterday";
  return target.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const formatTimeLabel = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const getDairyNamesMap = async (rows = []) => {
  const dairyIds = [
    ...new Set(
      (rows || [])
        .map((row) => row?.dairy_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
    ),
  ];

  if (dairyIds.length === 0) return {};

  const { data, error } = await supabase
    .from("dairies")
    .select("id, dairy_name")
    .in("id", dairyIds);

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) return {};
    throw error;
  }

  return (data || []).reduce((acc, row) => {
    const key = row?.id;
    if (key != null) acc[String(key)] = row?.dairy_name || `Dairy #${key}`;
    return acc;
  }, {});
};

const getAgentDetailsMap = async (rows = []) => {
  const agentIds = [
    ...new Set(
      (rows || [])
        .map((row) => row?.agent_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
    ),
  ];

  if (agentIds.length === 0) return {};

  const { data, error } = await supabase
    .from("agents")
    .select("id, agent_name, phone_number, building")
    .in("id", agentIds);

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) return {};
    throw error;
  }

  return (data || []).reduce((acc, row) => {
    if (row?.id == null) return acc;
    acc[String(row.id)] = {
      id: row.id,
      name: row.agent_name || `Agent #${row.id}`,
      phone: row.phone_number || "-",
      route: row.building || "-",
    };
    return acc;
  }, {});
};

const buildSubscriptionAgentFallback = (subscription, agentDetailsMap = {}) => {
  const rawAgentId = subscription?.assigned_agent_id ?? null;
  if (rawAgentId == null) {
    return { agentId: null, agent: null, canTrackAgent: false };
  }

  const resolvedAgent = agentDetailsMap[String(rawAgentId)] || null;
  return {
    agentId: rawAgentId,
    agent: resolvedAgent,
    canTrackAgent: false,
  };
};

const mapDeliveryRow = (row, index, fallbackProduct, fallbackQty, dairyNamesMap = {}) => {
  const dateSource = row.delivery_date || row.date || row.created_at || row.updated_at;
  const timeSource = row.delivered_at || row.time || row.updated_at || row.created_at;
  const parsedNotes = parseOneTimeNotes(row?.notes);
  const parsedIssue = parseLatestCustomerIssue(row);
  const issueMeta = getIssueMeta(row);
  const rowSlot = normalizeOneTimeSlot(
    row?.delivery_slot || row?.slot || parseNotesField(row?.notes, "slot") || parsedNotes.slotKey || ""
  );
  const slotKey = VALID_ONE_TIME_SLOTS.has(rowSlot) ? rowSlot : null;
  const slotLabel = slotKey
    ? toSlotLabel(slotKey)
    : String(row?.delivery_slot || row?.slot || parseNotesField(row?.notes, "slot") || "-");
  const slotWindow = getSlotWindow(slotKey);
  const qty =
    row.quantity_liters ??
    row.qty ??
    row.quantity ??
    fallbackQty ??
    null;
  const product =
    row.milk_type ||
    row.product ||
    fallbackProduct ||
    "Milk";
  const dairyId = row?.dairy_id ?? row?.dairyId ?? null;
  const paymentMethod =
    parsedNotes.paymentMethod || row?.payment_method || row?.method || null;
  const normalizedStatus = toTitleStatus(row.status);
  const approvalStatus = toApprovalStatus(row?.approval_status, {
    isOneTimeOrder: parsedNotes.isOneTimeOrder,
  });
  const uiStatus =
    parsedNotes.isOneTimeOrder && approvalStatus === "PENDING"
      ? "PENDING_APPROVAL"
      : normalizedStatus;
  const deliveryType = getDeliveryTypeLabel(parsedNotes.isOneTimeOrder);

  return {
    id: String(row.id ?? `delivery-${index}`),
    date: formatDateLabel(dateSource),
    deliveryDate: row?.delivery_date || row?.date || null,
    product,
    qty: qty != null ? `${qty} L` : "-",
    status: uiStatus,
    approvalStatus,
    time: normalizedStatus === "DELIVERED" ? formatTimeLabel(timeSource) : null,
    dairyId,
    dairyName:
      dairyId == null ? null : dairyNamesMap[String(dairyId)] || `Dairy #${dairyId}`,
    slot: slotLabel || "-",
    slotWindow,
    paymentMethod: paymentMethod || "-",
    address: parsedNotes.address || null,
    isOneTimeOrder: parsedNotes.isOneTimeOrder,
    deliveryType,
    customerIssue: parsedIssue.issue,
    issueReportedAt: parsedIssue.reportedAt,
    issueStatus: issueMeta.issueStatus,
    issueAdminAction: issueMeta.issueAdminAction,
    issueResolvedAt: issueMeta.issueResolvedAt,
  };
};

const isSameCalendarDay = (dateValue, refDate) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === refDate.getFullYear() &&
    date.getMonth() === refDate.getMonth() &&
    date.getDate() === refDate.getDate()
  );
};

const getTodayDeliveryFromRows = (
  rows,
  dairyNamesMap = {},
  agentDetailsMap = {},
  subscription = null,
  { agentOutForDelivery = false } = {}
) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const now = new Date();

  const todayRows = rows.filter((row) =>
    isSameCalendarDay(
      row.delivery_date || row.date || row.created_at || row.updated_at,
      now
    )
  );

  const todayRow =
    todayRows.find((row) => {
      const status = String(row?.status || "").toUpperCase();
      const approvalStatus = String(row?.approval_status || "").toUpperCase();
      return (
        status !== "CANCELLED" &&
        status !== "CANCELED" &&
        approvalStatus !== "CANCELLED" &&
        approvalStatus !== "CANCELED"
      );
    }) ||
    todayRows[0] ||
    null;

  if (!todayRow) return null;

  const normalized = mapDeliveryRow(todayRow, 0, null, null, dairyNamesMap);
  const isSubscriptionDelivery = !String(todayRow?.notes || "").includes("[ONE_TIME_ORDER]");
  const fallbackAgentId =
    isSubscriptionDelivery && !todayRow?.agent_id ? subscription?.assigned_agent_id ?? null : null;
  const rawAgentId = todayRow?.agent_id ?? fallbackAgentId ?? null;
  const resolvedAgent =
    rawAgentId == null
      ? null
      : agentDetailsMap[String(rawAgentId)] || {
          id: rawAgentId,
          name: `Agent #${rawAgentId}`,
          phone: "-",
          route: "-",
        };
  const expectedWindow =
    normalized?.slotWindow && normalized?.slot && normalized.slot !== "-"
      ? `${normalized.slot} (${normalized.slotWindow})`
      : null;
  const agentLat = Number(todayRow?.agent_current_lat);
  const agentLng = Number(todayRow?.agent_current_lng);
  const currentAgentLocation =
    Number.isFinite(agentLat) && Number.isFinite(agentLng)
      ? { lat: agentLat, lng: agentLng }
      : null;
  const isOutForDelivery = normalized.status === "OUT_FOR_DELIVERY";
  const canInferOutForDeliveryFromAgentRun =
    Boolean(agentOutForDelivery) &&
    normalized.status === "PENDING" &&
    normalized.approvalStatus === "APPROVED" &&
    !normalized.isOneTimeOrder;
  const effectiveStatus = canInferOutForDeliveryFromAgentRun
    ? "OUT_FOR_DELIVERY"
    : normalized.status || "PENDING";
  const effectiveOutForDelivery = effectiveStatus === "OUT_FOR_DELIVERY";

  return {
    id: normalized.id || null,
    deliveryId: normalized.id || null,
    status: effectiveStatus,
    approvalStatus: normalized.approvalStatus || "APPROVED",
    product: normalized.product || "Milk",
    quantity: normalized.qty || "-",
    time: normalized.time || null,
    slot: normalized.slot || "-",
    slotWindow: normalized.slotWindow || null,
    expectedWindow,
    dairyName: normalized.dairyName || null,
    paymentMethod: normalized.paymentMethod || null,
    address: normalized.address || null,
    isOneTimeOrder: Boolean(normalized.isOneTimeOrder),
    deliveryType: normalized.deliveryType || getDeliveryTypeLabel(normalized.isOneTimeOrder),
    customerIssue: normalized.customerIssue || null,
    issueReportedAt: normalized.issueReportedAt || null,
    issueStatus: normalized.issueStatus || "NONE",
    issueAdminAction: normalized.issueAdminAction || null,
    issueResolvedAt: normalized.issueResolvedAt || null,
    agentId: rawAgentId,
    agent: resolvedAgent,
    currentAgentLocation: effectiveOutForDelivery ? currentAgentLocation : null,
    agentLocationUpdatedAt: todayRow?.agent_location_updated_at || null,
    canTrackAgent: Boolean(rawAgentId && effectiveOutForDelivery),
  };
};

const isAgentOutForDeliveryToday = async ({ agentId, todayDate }) => {
  if (!agentId || !todayDate) return false;

  const { data, error } = await supabase
    .from("deliveries")
    .select("id")
    .eq("agent_id", agentId)
    .eq("delivery_date", todayDate)
    .in("status", ["IN_TRANSIT", "OUT_FOR_DELIVERY"])
    .limit(1);

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) return false;
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
};

const getTodayDeliveryFallback = (subscription) => {
  const isActiveSubscription =
    subscription && String(subscription.status || "ACTIVE").toUpperCase() === "ACTIVE";
  const normalizedSlot = normalizeOneTimeSlot(subscription?.delivery_slot);
  const slotKey = VALID_ONE_TIME_SLOTS.has(normalizedSlot) ? normalizedSlot : null;
  const slotLabel = slotKey ? toSlotLabel(slotKey) : String(subscription?.delivery_slot || "-");
  const slotWindow = getSlotWindow(slotKey);
  const expectedWindow =
    slotWindow && slotLabel && slotLabel !== "-" ? `${slotLabel} (${slotWindow})` : null;

  const quantityLabel = isActiveSubscription && subscription?.quantity_liters
    ? `${subscription.quantity_liters} L`
    : "-";

  return {
    id: null,
    deliveryId: null,
    status: isActiveSubscription ? "NOT_SCHEDULED" : "NOT_SUBSCRIBED",
    time: null,
    product: isActiveSubscription ? (subscription?.milk_type || "Milk") : "Milk",
    quantity: quantityLabel,
    slot: slotLabel,
    slotWindow,
    expectedWindow,
    dairyName: null,
    paymentMethod: null,
    address: null,
    isOneTimeOrder: false,
    deliveryType: "SUBSCRIPTION",
    customerIssue: null,
    issueReportedAt: null,
    issueStatus: "NONE",
    issueAdminAction: null,
    issueResolvedAt: null,
    agentId: null,
    agent: null,
    canTrackAgent: false,
  };
};

const buildDeliveryInsights = (rows = [], referenceDate = new Date()) => {
  const targetMonth = referenceDate.getMonth();
  const targetYear = referenceDate.getFullYear();

  const baseInsights = {
    monthLabel: referenceDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    monthlyDeliveryCount: 0,
    skippedDays: 0,
    extraOrders: 0,
  };

  return (rows || []).reduce((acc, row) => {
    const sourceDate = row?.delivery_date || row?.date || row?.created_at || row?.updated_at;
    if (!sourceDate) return acc;

    const parsedDate = new Date(sourceDate);
    if (Number.isNaN(parsedDate.getTime())) return acc;
    if (parsedDate.getMonth() !== targetMonth || parsedDate.getFullYear() !== targetYear) {
      return acc;
    }

    const normalizedStatus = toTitleStatus(row?.status);
    if (normalizedStatus === "DELIVERED") {
      acc.monthlyDeliveryCount += 1;
    }
    if (normalizedStatus === "SKIPPED" || normalizedStatus === "FAILED") {
      acc.skippedDays += 1;
    }
    if (parseOneTimeNotes(row?.notes).isOneTimeOrder) {
      acc.extraOrders += 1;
    }

    return acc;
  }, baseInsights);
};

const tryFetchFromTable = async (table, customerId) => {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    const message = String(error.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) return null;
    throw error;
  }

  return data || [];
};

const getProductByNameForDairy = async ({ dairyId, productName }) => {
  const { data, error } = await supabase
    .from("products")
    .select("id, dairy_id, name, rate_per_unit, stock_quantity, is_active")
    .eq("dairy_id", dairyId)
    .ilike("name", productName)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    const message = String(error?.message || "").toLowerCase();
    const isMissingRelation = message.includes("relation") && message.includes("does not exist");
    const isMissingColumn = message.includes("column") && message.includes("does not exist");
    if (isMissingRelation || isMissingColumn) {
      throw new Error("Product inventory is not configured. Run latest migrations first.");
    }
    throw error;
  }

  return data || null;
};

const reserveStockForOrder = async ({ dairyId, productId, quantity }) => {
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

const releaseStockForCancelledOrder = async ({ dairyId, milkType, quantity }) => {
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

const parseDeliveryIdFromPaymentDescription = (description) => {
  const text = String(description || "");
  const match = text.match(/delivery_id=(\d+)/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const paymentDescriptionIncludesDeliveryId = (description, orderId) => {
  const text = String(description || "");
  const normalizedId = Number(orderId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return false;
  if (parseDeliveryIdFromPaymentDescription(text) === normalizedId) return true;

  const bundleMatch = text.match(/delivery_ids=([0-9,\s]+)/i);
  if (!bundleMatch) return false;

  return bundleMatch[1]
    .split(",")
    .map((value) => Number(String(value || "").trim()))
    .some((value) => value === normalizedId);
};

const findLinkedOneTimePayment = async ({
  customerId,
  orderId,
  paymentId = null,
  dairyId = null,
} = {}) => {
  if (paymentId) {
    const { data, error } = await supabase
      .from("payments")
      .select("id, customer_id, dairy_id, amount, status, description, created_at")
      .eq("id", paymentId)
      .eq("customer_id", customerId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  let query = supabase
    .from("payments")
    .select("id, customer_id, dairy_id, amount, status, description, created_at")
    .eq("customer_id", customerId)
    .ilike("description", `%delivery_id=${orderId}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (dairyId != null) {
    query = query.eq("dairy_id", dairyId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return (
    rows.find((row) => paymentDescriptionIncludesDeliveryId(row?.description, orderId)) ||
    rows[0] ||
    null
  );
};

const isStandaloneOneTimePaymentMethod = (paymentMethod) =>
  normalizeOneTimePaymentMethod(paymentMethod) !== "MONTHLY_BILL";

const appendCustomerCancellationNote = (existingNotes, reason = "customer_cancelled") => {
  const previous = String(existingNotes || "").trim();
  const stamped = `[CUSTOMER_CANCELLED_ORDER] ${new Date().toISOString()} :: ${String(reason || "customer_cancelled").trim()}`;
  return previous ? `${previous}\n${stamped}`.slice(0, 500) : stamped.slice(0, 500);
};

const appendCustomerIssueNote = (existingNotes, issueText) => {
  const trimmedIssue = String(issueText || "").trim();
  const previous = String(existingNotes || "").trim();
  const stamped = `[CUSTOMER_ISSUE] ${new Date().toISOString()} :: ${trimmedIssue}`;
  return previous ? `${previous}\n${stamped}` : stamped;
};

const hasOpenSubscriptionForDairy = async ({ customerId, dairyId }) => {
  if (!customerId || !dairyId) return false;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("customer_id", customerId)
    .eq("dairy_id", dairyId)
    .limit(20);

  if (error) {
    if (
      isMissingTableError(error) ||
      isMissingColumnError(error) ||
      isUuidSyntaxError(error)
    ) {
      return false;
    }
    throw error;
  }

  return (data || []).some((row) => hasOpenSubscriptionStatus(row?.status));
};

const getSavedCustomerAddress = async (customerId) => {
  if (!customerId) return "";

  const { data, error } = await supabase
    .from("customers")
    .select("building_name, wing, room_no")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return buildCustomerAddress(data);
};

const normalizeOneTimeOrderItems = (payload = {}) => {
  const explicitItems = Array.isArray(payload?.items) ? payload.items : [];
  if (explicitItems.length > 0) {
    return explicitItems
      .map((item) => ({
        milkType: String(item?.milkType || item?.name || "").trim(),
        quantity: toFiniteNumber(item?.quantity),
      }))
      .filter((item) => item.milkType);
  }

  return [
    {
      milkType: String(payload?.milkType || "").trim(),
      quantity: toFiniteNumber(payload?.quantity),
    },
  ].filter((item) => item.milkType);
};

const mergeOneTimeOrderItems = (items = []) => {
  const merged = new Map();

  for (const item of items) {
    const key = String(item?.milkType || "").trim().toLowerCase();
    if (!key) continue;

    const current = merged.get(key) || {
      milkType: String(item?.milkType || "").trim(),
      quantity: 0,
    };

    current.quantity = Number((current.quantity + Number(item?.quantity || 0)).toFixed(2));
    merged.set(key, current);
  }

  return [...merged.values()];
};

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
  const mappedRows = rows.map((row, index) =>
    mapDeliveryRow(row, index, null, null, dairyNamesMap || {})
  );
  const insights = buildDeliveryInsights(rows);

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

    const { data: duplicate, error: duplicateError } = await supabase
      .from("deliveries")
      .select("id")
      .eq("customer_id", customerId)
      .eq("dairy_id", dairyId)
      .eq("delivery_date", deliveryDate)
      .eq("milk_type", item.milkType)
      .in("status", ["PENDING", "DELIVERED"])
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
      const deliveryNotes = appendDeliveryBillingMeta(
        `[ONE_TIME_ORDER] slot=${slot}; payment=${paymentMethod}; address=${resolvedAddress}`,
        {
          paymentMethod,
          unitPrice: item.unitPrice,
        }
      ).slice(0, 500);

      const { data: createdDelivery, error: createDeliveryError } = await supabase
        .from("deliveries")
        .insert({
          customer_id: customerId,
          dairy_id: dairyId,
          delivery_date: deliveryDate,
          milk_type: item.milkType,
          quantity_liters: item.quantity,
          status: "PENDING",
          approval_status: "PENDING",
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
  if (isStandaloneOneTimePaymentMethod(paymentMethod)) {
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
    if (!String(delivery?.notes || "").includes("[ONE_TIME_ORDER]")) {
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
    if (approvalStatus !== "PENDING") {
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
  if (!payment && requiresStandalonePayment) {
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
