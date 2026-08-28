// Pure helpers for the admin deliveries domain: parsing, normalization,
// status mapping, issue-meta extraction and route matching.

import { isValidDateString } from "../../../utils/date.js";

export const MAX_LIMIT = 2000;
export const DEFAULT_LIMIT = 1000;

export const toIntegerOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

export const makeError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

export const isSubscriptionActive = (status, approvalStatus = "APPROVED") => {
  const value = String(status || "ACTIVE").toUpperCase();
  const approval = String(approvalStatus || "APPROVED").toUpperCase();
  return value === "ACTIVE" && approval === "APPROVED";
};

export const WEEKDAY_KEYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export const parseDateSafe = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const deriveAgentIsActive = (agent = {}) => {
  const status = String(agent?.status || "ACTIVE").toUpperCase();
  const inactiveUntilDate = parseDateSafe(agent?.inactive_until);
  if (status !== "INACTIVE") return true;
  if (!inactiveUntilDate) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return inactiveUntilDate < todayStart;
};

export const normalizeStatus = (status) => {
  const value = String(status || "").trim().toUpperCase();
  if (value === "DELIVERED" || value === "COMPLETED") return "DELIVERED";
  if (
    value === "FAILED" ||
    value === "CANCELLED" ||
    value === "CANCELED" ||
    value === "SKIPPED" ||
    value === "MISSED"
  ) {
    return "FAILED";
  }
  return "PENDING";
};

export const normalizeApprovalStatus = (value, { isOneTimeOrder = false } = {}) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "PENDING") return "PENDING";
  if (normalized === "PENDING_VERIFICATION") return "PENDING_VERIFICATION";
  return isOneTimeOrder ? "PENDING" : "APPROVED";
};

export const normalizeProductKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const formatUnitLabel = (value) => {
  const unit = String(value || "").trim().toUpperCase();
  if (["L", "LITER", "LITRE", "LITERS", "LITRES"].includes(unit)) return "L";
  if (["KG", "KGS", "KILOGRAM", "KILOGRAMS"].includes(unit)) return "KG";
  if (["G", "GRAM", "GRAMS"].includes(unit)) return "G";
  if (["ML", "MILLILITER", "MILLILITRE", "MILLILITERS", "MILLILITRES"].includes(unit)) return "ML";
  if (["PCS", "PIECE", "PIECES"].includes(unit)) return "PCS";
  return unit || "L";
};

export const inferProductUnit = (productName) => {
  const normalized = normalizeProductKey(productName);
  if (normalized === "paneer" || normalized === "panner") return "KG";
  return "LITER";
};

export const formatQuantity = (value, unit = "LITER") => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return "-";
  const compact = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(2).replace(/\.?0+$/, "");
  return `${compact}${formatUnitLabel(unit)}`;
};

export const parseNotesField = (notesValue, field) => {
  const match = String(notesValue || "").match(new RegExp(`${field}=([^;\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
};

export const normalizeDate = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

export const normalizeDeliveryDays = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .map((item) => String(item || "").trim().toUpperCase())
        .filter((item) => WEEKDAY_KEYS.includes(item))
    )];
  }

  if (typeof value === "string" && value.trim()) {
    return [...new Set(
      value
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter((item) => WEEKDAY_KEYS.includes(item))
    )];
  }

  return [];
};

export const getWeekdayForDate = (targetDate) => {
  if (!isValidDateString(targetDate)) return null;
  const dt = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return WEEKDAY_KEYS[dt.getDay()] || null;
};

export const extractIssueMetaFromNotes = (notesValue) => {
  const lines = String(notesValue || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let lastIssueIndex = -1;
  let lastResolveIndex = -1;
  let latestIssueText = null;

  lines.forEach((line, index) => {
    if (line.startsWith("[CUSTOMER_ISSUE]")) {
      lastIssueIndex = index;
      const match = line.match(/^\[CUSTOMER_ISSUE\]\s*[^\s]+\s*::\s*(.+)$/i);
      latestIssueText = match?.[1]?.trim() || line.replace("[CUSTOMER_ISSUE]", "").trim();
    }
    if (line.startsWith("[ISSUE_RESOLVED]")) {
      lastResolveIndex = index;
    }
  });

  const hasOpenIssue =
    lastIssueIndex >= 0 && (lastResolveIndex < 0 || lastResolveIndex < lastIssueIndex);

  return {
    hasOpenIssue,
    customerIssue: hasOpenIssue ? latestIssueText || "Issue reported by customer" : null,
  };
};

export const extractIssueMeta = (row = {}) => {
  const status = String(row?.customer_issue_status || "").toUpperCase();
  const issueText = String(row?.customer_issue_text || "").trim();
  const adminAction = String(row?.customer_issue_admin_action || "").trim() || null;
  const reportedAt = row?.customer_issue_reported_at || null;
  const resolvedAt = row?.customer_issue_resolved_at || null;

  if (issueText) {
    const hasOpenIssue = status !== "RESOLVED";
    return {
      hasOpenIssue,
      customerIssue: hasOpenIssue ? issueText : null,
      issueStatus: hasOpenIssue ? "OPEN" : "RESOLVED",
      issueAdminAction: adminAction,
      issueReportedAt: reportedAt,
      issueResolvedAt: resolvedAt,
    };
  }

  const fallback = extractIssueMetaFromNotes(row?.notes);
  return {
    hasOpenIssue: fallback.hasOpenIssue,
    customerIssue: fallback.customerIssue,
    issueStatus: fallback.hasOpenIssue ? "OPEN" : "NONE",
    issueAdminAction: null,
    issueReportedAt: null,
    issueResolvedAt: null,
  };
};

export const resolveLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
};

export const normalizeRouteValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const routeMatchesCustomer = (agentRoute, customerRoute) => {
  const target = normalizeRouteValue(customerRoute);
  if (!target) return false;

  return String(agentRoute || "")
    .split(",")
    .map((part) => normalizeRouteValue(part))
    .filter(Boolean)
    .some((part) => part === target);
};
