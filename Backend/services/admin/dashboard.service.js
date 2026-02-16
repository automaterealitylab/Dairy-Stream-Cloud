import { supabase } from "../../config/supabase.js";

let dashboardCache = null;
let lastFetchTime = 0;
const CACHE_TTL = 60_000;

const countTable = async (table, filter = {}) => {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  Object.entries(filter).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};

export const getAdminDashboardStats = async ({ dairyId } = {}) => {
  const now = Date.now();

  if (dashboardCache && now - lastFetchTime < CACHE_TTL) {
    return dashboardCache;
  }

  let totalCustomers = 0;

  // Try to scope customers by dairy via memberships if available
  if (dairyId) {
    try {
      totalCustomers = await countTable("memberships", { dairy_id: dairyId });
    } catch (err) {
      totalCustomers = await countTable("customers");
    }
  } else {
    totalCustomers = await countTable("customers");
  }

  const totalAgents = await countTable("agents");
  const totalDairies = await countTable("dairies");

  const stats = {
    totalCustomers,
    totalAgents,
    totalDairies,
    activeAgents: totalAgents,
    deliveriesToday: 0,
    pendingPayments: 0,
  };

  dashboardCache = stats;
  lastFetchTime = now;

  return stats;
};
