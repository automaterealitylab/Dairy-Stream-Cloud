// Pure helpers for the customer deliveries domain: date/slot/payment-method
// normalization, one-time-order notes parsing and issue/status mapping.

export const VALID_ONE_TIME_SLOTS = new Set(["MORNING", "EVENING"]);

export const getLocalDateInput = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toFiniteNumber = (value, fallback = NaN) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toPositiveId = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) return num;
  const extracted = Number(String(value).replace(/\D+/g, ""));
  return Number.isFinite(extracted) && extracted > 0 ? extracted : null;
};

export const buildCustomerAddress = (customer = {}) => {
  const parts = [
    customer?.building_name,
    customer?.wing,
    customer?.room_no,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return parts.join(", ");
};

export const hasOpenSubscriptionStatus = (status) => {
  const value = String(status || "ACTIVE").trim().toUpperCase();
  return value !== "CLOSED" && value !== "CANCELLED" && value !== "CANCELED";
};

export const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
};

export const normalizeOneTimeSlot = (value) => {
  const slot = String(value || "").trim().toUpperCase();
  if (slot.startsWith("MOR")) return "MORNING";
  if (slot.startsWith("EVE")) return "EVENING";
  return slot;
};

export const normalizeOneTimePaymentMethod = (value) => {
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

export const toSlotLabel = (slotKey) => {
  if (slotKey === "MORNING") return "Morning";
  if (slotKey === "EVENING") return "Evening";
  return String(slotKey || "").trim() || "-";
};

export const getDeliveryTypeLabel = (isOneTimeOrder) =>
  isOneTimeOrder ? "ONE_TIME" : "SUBSCRIPTION";

export const parseOneTimeNotes = (notesValue) => {
  const notes = String(notesValue || "");
  const isOneTimeOrder = notes.includes("[ONE_TIME_ORDER]");
  if (!isOneTimeOrder) {
    return {
      isOneTimeOrder: false,
      slotKey: null,
      paymentMethod: null,
      address: null,
      utrNumber: null,
      screenshotUrl: null,
    };
  }

  const slotMatch = notes.match(/slot=([^;]+)/i);
  const paymentMatch = notes.match(/payment=([^;]+)/i);
  const addressMatch = notes.match(/address=(.*)$/i);
  const utrMatch = notes.match(/utr=([^;]+)/i);
  const screenshotMatch = notes.match(/screenshot_url=([^;]+)/i);
  const parsedSlot = normalizeOneTimeSlot(slotMatch?.[1] || "");
  const slotKey = VALID_ONE_TIME_SLOTS.has(parsedSlot) ? parsedSlot : null;

  return {
    isOneTimeOrder: true,
    slotKey,
    paymentMethod: paymentMatch?.[1]?.trim()?.toUpperCase() || null,
    address: addressMatch?.[1]?.trim() || null,
    utrNumber: utrMatch?.[1]?.trim() || null,
    screenshotUrl: screenshotMatch?.[1]?.trim() || null,
  };
};

export const parseNotesField = (notesValue, fieldName) => {
  const notes = String(notesValue || "");
  const field = String(fieldName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!field) return null;

  const match = notes.match(new RegExp(`(?:^|[;\\n]\\s*)${field}=([^;\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
};

export const normalizeUtrNumber = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");

export const appendOneTimeOrderPaymentMeta = (notesValue, { utrNumber, screenshotUrl, payerUpiId } = {}) => {
  const notes = String(notesValue || "").trim();
  const extras = [];

  const normalizedUtr = normalizeUtrNumber(utrNumber);
  if (normalizedUtr) extras.push(`utr=${normalizedUtr}`);
  if (screenshotUrl) extras.push(`screenshot_url=${String(screenshotUrl).trim()}`);
  if (payerUpiId) extras.push(`payer_upi_id=${String(payerUpiId).trim()}`);

  if (!extras.length) return notes;
  return notes ? `${notes}; ${extras.join("; ")}` : extras.join("; ");
};

export const parseLatestCustomerIssueFromNotes = (notesValue) => {
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

export const parseLatestCustomerIssue = (row = {}) => {
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

export const getIssueMeta = (row = {}) => {
  const issueStatus = String(row?.customer_issue_status || "").toUpperCase();
  const issueAdminAction = String(row?.customer_issue_admin_action || "").trim() || null;
  const issueResolvedAt = row?.customer_issue_resolved_at || null;

  return {
    issueStatus: issueStatus || (row?.customer_issue_text ? "OPEN" : "NONE"),
    issueAdminAction,
    issueResolvedAt,
  };
};

export const toTitleStatus = (status) => {
  const value = String(status || "").toUpperCase();
  if (value === "DELIVERED" || value === "COMPLETED") return "DELIVERED";
  if (value === "IN_TRANSIT" || value === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (value === "FAILED" || value === "MISSED") return "FAILED";
  if (value === "CANCELLED" || value === "CANCELED") return "CANCELLED";
  if (value === "SKIPPED") return "SKIPPED";
  if (value === "PENDING") return "PENDING";
  return "PENDING";
};

export const toApprovalStatus = (approvalStatus, { isOneTimeOrder = false } = {}) => {
  const normalized = String(approvalStatus || "").toUpperCase();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "PENDING") return "PENDING";
  if (normalized === "PENDING_PAYMENT") return "PENDING_PAYMENT";
  if (normalized === "PENDING_VERIFICATION") return "PENDING_VERIFICATION";
  if (normalized === "CANCELLED" || normalized === "CANCELED") return "CANCELLED";
  return isOneTimeOrder ? "PENDING" : "APPROVED";
};

export const formatDateLabel = (value) => {
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

export const formatTimeLabel = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

export const isSameCalendarDay = (dateValue, refDate) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === refDate.getFullYear() &&
    date.getMonth() === refDate.getMonth() &&
    date.getDate() === refDate.getDate()
  );
};

export const isStandaloneOneTimePaymentMethod = (paymentMethod) =>
  normalizeOneTimePaymentMethod(paymentMethod) === "PAY_NOW";

export const appendCustomerCancellationNote = (existingNotes, reason = "customer_cancelled") => {
  const previous = String(existingNotes || "").trim();
  const stamped = `[CUSTOMER_CANCELLED_ORDER] ${new Date().toISOString()} :: ${String(reason || "customer_cancelled").trim()}`;
  return previous ? `${previous}\n${stamped}`.slice(0, 500) : stamped.slice(0, 500);
};

export const appendCustomerIssueNote = (existingNotes, issueText) => {
  const trimmedIssue = String(issueText || "").trim();
  const previous = String(existingNotes || "").trim();
  const stamped = `[CUSTOMER_ISSUE] ${new Date().toISOString()} :: ${trimmedIssue}`;
  return previous ? `${previous}\n${stamped}` : stamped;
};

export const normalizeOneTimeOrderItems = (payload = {}) => {
  const rawItems = payload?.items;
  const explicitItems = Array.isArray(rawItems)
    ? rawItems
    : typeof rawItems === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(rawItems);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];
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

export const mergeOneTimeOrderItems = (items = []) => {
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
