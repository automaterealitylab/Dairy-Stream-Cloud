import { supabase } from "../../config/supabase.js"; // Adjust path to match your customer service import
import { encryptDeterministic, decryptDeterministic } from "../../utils/crypto.js";

const parseDateSafe = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const deriveAgentAvailability = (agent = {}) => {
  const rawStatus = String(agent?.status || "ACTIVE").toUpperCase();
  const inactiveUntil = agent?.inactive_until || null;
  const inactiveUntilDate = parseDateSafe(inactiveUntil);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inFutureWindow = inactiveUntilDate ? inactiveUntilDate >= todayStart : false;
  const isInactive = rawStatus === "INACTIVE" && (inactiveUntilDate ? inFutureWindow : true);

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
    status: isInactive ? "INACTIVE" : "ACTIVE",
    isActive: !isInactive,
    inactiveUntil,
    inactiveFrom: agent?.inactive_from || null,
    inactiveDaysRemaining,
  };
};

const mapAgentForAdmin = (agent = {}) => {
  const availability = deriveAgentAvailability(agent);
  return {
    ...agent,
    email: decryptDeterministic(agent.email),
    phone_number: decryptDeterministic(agent.phone_number),
    full_name: agent.agent_name,
    mobile: decryptDeterministic(agent.phone_number),
    status: availability.status,
    isActive: availability.isActive,
    inactive_until: availability.inactiveUntil,
    inactive_from: availability.inactiveFrom,
    inactive_days_remaining: availability.inactiveDaysRemaining,
  };
};

export const getAdminAgents = async ({
  page = 1,
  limit = 10,
  search = "",
  dairyId = null,
  lite = false,
}) => {
  if (lite) {
    let liteQuery = supabase
      .from("agents")
      .select("id, agent_name, phone_number, status, inactive_until, inactive_from, inactive_days")
      .order("agent_name", { ascending: true });

    if (dairyId) {
      liteQuery = liteQuery.eq("dairy_id", dairyId);
    }

    if (search) {
      const encryptedSearch = encryptDeterministic(search.trim());
      liteQuery = liteQuery.or(
        `agent_name.ilike.%${search}%,phone_number.ilike.%${search}%,phone_number.eq.${encryptedSearch}`
      );
    }

    const { data, error } = await liteQuery;
    if (error) throw error;

    return {
      agents: (data || []).map(mapAgentForAdmin),
      total: (data || []).length,
      page: 1,
      limit: (data || []).length,
    };
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Agents are stored in the 'agents' table
  let query = supabase
    .from("agents")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (dairyId) {
    query = query.eq("dairy_id", dairyId);
  }

  // 2. Apply Search
  if (search) {
    const encryptedSearch = encryptDeterministic(search.trim());
    query = query.or(
      `agent_name.ilike.%${search}%,email.ilike.%${search}%,phone_number.ilike.%${search}%,building.ilike.%${search}%,email.eq.${encryptedSearch},phone_number.eq.${encryptedSearch}`
    );
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    // Normalize fields to match frontend expectations
    agents: (data || []).map(mapAgentForAdmin),
    total: count,
    page,
    limit,
  };
};

export const getAgentDetails = async (agentId, { dairyId = null } = {}) => {
  // 1. Fetch Basic Agent Info from Agents table
  let query = supabase
    .from("agents")
    .select("*")
    .eq("id", agentId);

  if (dairyId) {
    query = query.eq("dairy_id", dairyId);
  }

  const { data: agent, error: agentError } = await query.single();

  if (agentError) throw agentError;

  // 2. (Optional) Fetch related delivery stats or assignments if you have them
  // For now, we return the agent profile to match the structure
  
  return {
    agent: mapAgentForAdmin(agent),
    // You can add more related data here later, like:
    // deliveries: [], 
    // assignments: null
  };
};

export const updateAgentById = async (agentId, updates) => {
  const allowed = [
    "agent_name",
    "phone_number",
    "email",
    "building",
    "status",
    "inactive_from",
    "inactive_until",
    "inactive_days",
  ];

  const payload = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (key === "email" || key === "phone_number") {
        payload[key] = encryptDeterministic(updates[key]);
      } else {
        payload[key] = updates[key];
      }
    }
  }

  const { data, error } = await supabase
    .from("agents")
    .update(payload)
    .eq("id", agentId)
    .select("*")
    .single();

  if (error) throw error;

  return mapAgentForAdmin(data);
};

export const deleteAgentById = async (agentId) => {
  const { error } = await supabase.from("agents").delete().eq("id", agentId);
  if (error) throw error;
  return { success: true };
};
