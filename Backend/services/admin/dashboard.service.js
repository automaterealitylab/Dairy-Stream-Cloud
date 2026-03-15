import { supabase } from "../../config/supabase.js";

const dashboardCache = new Map();
const CACHE_TTL = 30_000;

export const getAdminDashboardStats = async ({ dairyId, forceRefresh = false } = {}) => {
  const now = Date.now();
  const cacheKey = String(dairyId ?? "global");
  const cached = dashboardCache.get(cacheKey);

  if (!forceRefresh && cached && now - cached.at < CACHE_TTL) {
    return cached.payload;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startIso = startOfDay.toISOString();

  // 1. Fetch Basic Row Counts & Suppliers
  const targetDairyId = Number(dairyId); 

  const [totalCustomers, totalAgents, dairyRow, suppliersRes] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("dairy_id", targetDairyId),
    supabase.from("agents").select("id", { count: "exact", head: true }).eq("dairy_id", targetDairyId),
    supabase.from("dairies").select("dairy_name").eq("id", targetDairyId).maybeSingle(),
    // NOTE: We intentionally DO NOT filter suppliers by dairy_id here
    // so that a single supplier can work with multiple dairies and
    // still appear in every admin's procurement dropdown.
    supabase.from("suppliers").select("id, name").eq("status", "ACTIVE")
  ]);

  // 2. FETCH MILK NEEDED (Fixed the variable name typo: dairyId)
  const { data: deliveriesToday } = await supabase
    .from("deliveries")
    .select("quantity, status")
    .eq("dairy_id", dairyId) // ✅ Fixed: changed dairy_id to dairyId
    .gte("created_at", startIso);

  const milkNeeded = deliveriesToday?.reduce((sum, d) => sum + Number(d.quantity || 0), 0) || 0;
  const pendingCount = deliveriesToday?.filter(d => d.status === 'PENDING').length || 0;
  const failedCount = deliveriesToday?.filter(d => d.status === 'FAILED').length || 0;

  // 3. FETCH MILK PROCURED (AND RECENT LOGS FOR THIS DAIRY)
  const { data: procurementToday } = await supabase
    .from("procurement_logs")
    .select("id, supplier_name, quantity, rate_per_liter, total_cost, fat_percentage, snf_percentage, created_at")
    .eq("dairy_id", dairyId)
    .gte("created_at", startIso)
    .order("created_at", { ascending: false });
  const milkProcured =
    procurementToday?.reduce((sum, p) => sum + Number(p.quantity || 0), 0) || 0;

  // 4. FETCH REVENUE
  const { data: paymentsToday } = await supabase
    .from("payments")
    .select("amount")
    .eq("dairy_id", dairyId)
    .eq("status", "PAID")
    .gte("created_at", startIso);

  const cashCollected = paymentsToday?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

  // 5. Structure the final response to match frontend expectations
  const finalResponse = {
    dairyName: dairyRow.data?.dairy_name || "My Dairy",
    totalCustomers: totalCustomers.count || 0,
    totalAgents: totalAgents.count || 0,
    activeAgents: totalAgents.count || 0,
    deliveriesToday: deliveriesToday?.length || 0,
    suppliers: suppliersRes.data || [], // ✅ At top level for ProcurementTracker
    
    // ✅ Nested 'stats' object so DailyOperationsSnapshot.jsx doesn't get 'undefined'
    stats: {
      total_milk: milkNeeded,
      procured_milk: milkProcured,
      collected: cashCollected,
      pending: pendingCount,
      failed: failedCount,
      pendingPayments: 0 
    },
    
    // Recent procurement logs for this dairy (today only for now)
    procurementLogs: procurementToday || [],

    exceptions: [], // Populate these if you have the logic ready
    riskData: []
  };

  dashboardCache.set(cacheKey, { payload: finalResponse, at: now });
  return finalResponse;
};