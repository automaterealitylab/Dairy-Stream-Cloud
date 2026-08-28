// Map delivery rows to the customer-facing delivery cards and today snapshot,
// plus the no-scheduled-delivery fallback and monthly insights.

import { getSlotWindow } from "../../../constants/deliverySlots.js";
import {
  formatDateLabel,
  formatTimeLabel,
  getDeliveryTypeLabel,
  getIssueMeta,
  isSameCalendarDay,
  normalizeOneTimeSlot,
  parseLatestCustomerIssue,
  parseNotesField,
  parseOneTimeNotes,
  toApprovalStatus,
  toSlotLabel,
  toTitleStatus,
  VALID_ONE_TIME_SLOTS,
} from "./normalizers.js";

export const buildSubscriptionAgentFallback = (subscription, agentDetailsMap = {}) => {
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

export const mapDeliveryRow = (row, index, fallbackProduct, fallbackQty, dairyNamesMap = {}) => {
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
    parsedNotes.isOneTimeOrder && (approvalStatus === "PENDING" || approvalStatus === "PENDING_PAYMENT" || approvalStatus === "PENDING_VERIFICATION")
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
    paymentUtrNumber: parsedNotes.utrNumber || parseNotesField(row?.notes, "utr") || null,
    paymentScreenshotUrl: parsedNotes.screenshotUrl || parseNotesField(row?.notes, "screenshot_url") || null,
    isOneTimeOrder: parsedNotes.isOneTimeOrder,
    deliveryType,
    customerIssue: parsedIssue.issue,
    issueReportedAt: parsedIssue.reportedAt,
    issueStatus: issueMeta.issueStatus,
    issueAdminAction: issueMeta.issueAdminAction,
    issueResolvedAt: issueMeta.issueResolvedAt,
  };
};

export const getTodayDeliveryFromRows = (
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

export const getTodayDeliveryFallback = (subscription) => {
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

export const buildDeliveryInsights = (rows = [], referenceDate = new Date()) => {
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
