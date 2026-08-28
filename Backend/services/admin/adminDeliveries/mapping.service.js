// Map delivery rows to the admin-facing delivery card shape.

import {
  extractIssueMeta,
  formatQuantity,
  formatUnitLabel,
  inferProductUnit,
  normalizeApprovalStatus,
  normalizeDate,
  normalizeProductKey,
  normalizeStatus,
  parseNotesField,
} from "./normalizers.js";

export const mapDeliveries = ({
  deliveries,
  customersById,
  agentsById,
  dairiesById,
  subscriptionByCustomer,
  productUnitByKey = new Map(),
}) => {
  return (deliveries || []).map((row) => {
    const customer = customersById.get(row.customer_id) || {};
    const agent = agentsById.get(row.agent_id) || {};
    const dairy = dairiesById.get(row.dairy_id) || {};
    const subscription = subscriptionByCustomer.get(row.customer_id) || {};

    const quantity = row.quantity_liters ?? subscription.quantity_liters ?? null;
    const productType = row.milk_type || subscription.milk_type || "Milk";
    const resolvedDairyId = row.dairy_id || subscription.dairy_id || null;
    const productUnit =
      productUnitByKey.get(`${resolvedDairyId}::${normalizeProductKey(productType)}`) ||
      inferProductUnit(productType);
    const route = customer.building_name || agent.building || "-";
    const notes = String(row.notes || "");
    const isOneTimeOrder = notes.includes("[ONE_TIME_ORDER]");
    const isSubscriptionExtraOrder = isOneTimeOrder && Boolean(subscription?.customer_id);
    const approvalStatus = normalizeApprovalStatus(row.approval_status, { isOneTimeOrder });
    const issueMeta = extractIssueMeta(row);
    const buildingName = customer.building_name || route || "-";
    const wingOrFloor = customer.wing || "";
    const roomNo = customer.room_no || "";
    const slot = subscription.delivery_slot || parseNotesField(notes, "slot") || "-";
    const paymentUtrNumber = parseNotesField(notes, "utr");
    const paymentScreenshotUrl = parseNotesField(notes, "screenshot_url");
    const deliveryId = row?.projectionKey || row?.id || null;
    const projectedAgentId = row?.projectedAgentId || subscription?.assigned_agent_id || null;
    const resolvedAgent = agentsById.get(projectedAgentId) || agent;
    const isProjected = Boolean(row?.isProjected);

    return {
      id: deliveryId != null ? `DLV-${deliveryId}` : "DLV-NA",
      rawId: isProjected ? null : row.id ?? null,
      agentId: isProjected ? projectedAgentId : row.agent_id ?? null,
      customerName: customer.customer_name || `Customer #${row.customer_id ?? "-"}`,
      agentName: resolvedAgent.agent_name || "Unassigned",
      latitude: Number.isFinite(Number(customer.latitude)) ? Number(customer.latitude) : null,
      longitude: Number.isFinite(Number(customer.longitude)) ? Number(customer.longitude) : null,
      customerLat: Number.isFinite(Number(customer.latitude)) ? Number(customer.latitude) : null,
      customerLng: Number.isFinite(Number(customer.longitude)) ? Number(customer.longitude) : null,
      dairyName: dairy.dairy_name || null,
      dairyLatitude: Number.isFinite(Number(dairy.latitude)) ? Number(dairy.latitude) : null,
      dairyLongitude: Number.isFinite(Number(dairy.longitude)) ? Number(dairy.longitude) : null,
      dairyLat: Number.isFinite(Number(dairy.latitude)) ? Number(dairy.latitude) : null,
      dairyLng: Number.isFinite(Number(dairy.longitude)) ? Number(dairy.longitude) : null,
      route,
      buildingName,
      wingOrFloor,
      roomNo,
      locationLabel: [buildingName, wingOrFloor, roomNo].filter(Boolean).join(" / ") || "-",
      quantity: formatQuantity(quantity, productUnit),
      quantityRaw: quantity,
      quantityUnit: formatUnitLabel(productUnit),
      productType,
      date: normalizeDate(row.delivery_date || row.created_at),
      slot,
      status: normalizeStatus(row.status),
      isOneTimeOrder,
      isSubscriptionExtraOrder,
      deliveryType: isSubscriptionExtraOrder
        ? "SUBSCRIPTION EXTRA"
        : isOneTimeOrder
        ? "BUY ONCE"
        : "SUBSCRIPTION",
      approvalStatus,
      needsApproval: approvalStatus === "PENDING" || approvalStatus === "PENDING_VERIFICATION",
      isAssigned: isProjected ? projectedAgentId != null : row.agent_id != null,
      isProjected,
      paymentUtrNumber,
      paymentScreenshotUrl,
      hasOpenIssue: issueMeta.hasOpenIssue,
      customerIssue: issueMeta.customerIssue,
      issueStatus: issueMeta.issueStatus,
      issueAdminAction: issueMeta.issueAdminAction,
      issueReportedAt: issueMeta.issueReportedAt,
      issueResolvedAt: issueMeta.issueResolvedAt,
    };
  });
};
