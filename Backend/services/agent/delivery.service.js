import { supabase } from "../../config/supabase.js";

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

const normalizeStatusForCard = (status) => {
  const value = String(status || "").trim().toUpperCase();
  if (value === "DELIVERED" || value === "COMPLETED") return "COMPLETED";
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
  const parts = [customer.building_name, customer.wing, customer.room_no]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "-";
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

const buildLookupMaps = async (rows) => {
  const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
  const dairyIds = [...new Set(rows.map((row) => row.dairy_id).filter(Boolean))];

  const [customersResp, dairiesResp] = await Promise.all([
    customerIds.length
      ? supabase
          .from("customers")
          .select("id, customer_name, phone_number, building_name, wing, room_no")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    dairyIds.length
      ? supabase
          .from("dairies")
          .select("id, dairy_name")
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
  const parsedProof = parseDeliveryProof(row.notes);

  return {
    id: String(row.id),
    rawId: row.id,
    customerName: customer.customer_name || `Customer #${row.customer_id ?? "-"}`,
    phoneNumber: customer.phone_number || "-",
    address: formatAddress(customer),
    quantity: formatQuantity(row.quantity_liters),
    status: normalizeStatusForCard(row.status),
    dairyFarmId: row.dairy_id ?? null,
    dairyFarmName: dairy.dairy_name || "Dairy",
    farmPhoneNumber: "-",
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
    .select("id, agent_id, dairy_id, notes")
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

  return {
    deliveryId: updated.id,
    status: normalizeStatusForCard(updated.status),
    failedReason: parseFailedReason(updated.notes),
    deliveryProofType: parseDeliveryProof(updated.notes).proofType,
    deliveryProofValue: parseDeliveryProof(updated.notes).proofValue,
    updatedAt: updated.updated_at || null,
  };
};
