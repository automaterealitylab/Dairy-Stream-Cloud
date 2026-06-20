import { supabase } from '../../config/supabase.js';

const toIdValue = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
};

const getAgentIdsForDairy = async (dairyId) => {
  if (!dairyId) return [];
  const resolvedDairyId = toIdValue(dairyId);
  const { data, error } = await supabase
    .from('agents')
    .select('id')
    .eq('dairy_id', resolvedDairyId);

  if (error) throw error;
  return (data || []).map((row) => row.id).filter(Boolean);
};

const buildDerivedPerformanceFromDeliveries = (deliveries = []) => {
  const grouped = deliveries.reduce((acc, row) => {
    const agentId = row?.agent_id;
    const deliveryDate = row?.delivery_date;
    if (!agentId || !deliveryDate) return acc;

    const key = `${agentId}_${deliveryDate}`;
    if (!acc[key]) {
      acc[key] = {
        agent_id: agentId,
        performance_date: deliveryDate,
        total_assigned: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        completion_rate: 0,
        efficiency_percentage: 0,
        agents: row?.agents || null,
      };
    }

    acc[key].total_assigned += 1;
    const status = String(row.status || '').toUpperCase();
    if (status === 'COMPLETED' || status === 'DELIVERED') acc[key].completed += 1;
    else if (status === 'FAILED' || status === 'CANCELLED' || status === 'CANCELED' || status === 'MISSED' || status === 'SKIPPED') acc[key].failed += 1;
    else acc[key].pending += 1;

    return acc;
  }, {});

  return Object.values(grouped)
    .map((item) => {
      const rate =
        item.total_assigned > 0
          ? Number(((item.completed / item.total_assigned) * 100).toFixed(2))
          : 0;

      return {
        ...item,
        completion_rate: rate,
        efficiency_percentage: rate,
      };
    })
    .sort((a, b) => new Date(b.performance_date) - new Date(a.performance_date));
};

/**
 * Get agent performance metrics
 * @param {number} agentId - Agent ID (optional, if not provided gets all agents)
 * @param {string} startDate - Start date (YYYY-MM-DD format)
 * @param {string} endDate - End date (YYYY-MM-DD format)
 */
export const getAgentPerformance = async (agentId, startDate, endDate, dairyId = null) => {
  try {
    const scopedAgentIds = dairyId ? await getAgentIdsForDairy(dairyId) : null;
    if (dairyId && (!scopedAgentIds || scopedAgentIds.length === 0)) {
      return [];
    }

    let query = supabase
      .from('agent_performance')
      .select('*')
      .gte('performance_date', startDate)
      .lte('performance_date', endDate);

    if (dairyId) {
      query = query.in('agent_id', scopedAgentIds);
    }

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query.order('performance_date', {
      ascending: false,
    });

    if (error) throw error;

    if (Array.isArray(data) && data.length > 0) {
      return data;
    }

    let deliveryQuery = supabase
      .from('deliveries')
      .select('agent_id, delivery_date, status')
      .gte('delivery_date', startDate)
      .lte('delivery_date', endDate);

    if (dairyId) {
      deliveryQuery = deliveryQuery.eq('dairy_id', toIdValue(dairyId));
    }

    if (agentId) {
      deliveryQuery = deliveryQuery.eq('agent_id', agentId);
    }

    const { data: deliveries, error: deliveryError } = await deliveryQuery;
    if (deliveryError) throw deliveryError;

    return buildDerivedPerformanceFromDeliveries(deliveries || []);
  } catch (error) {
    console.error('Error fetching agent performance:', error.message);
    throw error;
  }
};

/**
 * Get performance summary for dashboard
 */
export const getPerformanceSummary = async (dairyId = null) => {
  try {
    // Get today's performance metrics
    const today = new Date().toISOString().split('T')[0];
    const scopedAgentIds = dairyId ? await getAgentIdsForDairy(dairyId) : null;
    if (dairyId && (!scopedAgentIds || scopedAgentIds.length === 0)) {
      return [];
    }

    let summaryQuery = supabase
      .from('agent_performance')
      .select('*')
      .eq('performance_date', today);

    if (dairyId) {
      summaryQuery = summaryQuery.in('agent_id', scopedAgentIds);
    }

    const { data, error } = await summaryQuery;

    if (error) throw error;

    if (Array.isArray(data) && data.length > 0) {
      return data;
    }

    let deliveriesQuery = supabase
      .from('deliveries')
      .select('agent_id, delivery_date, status')
      .eq('delivery_date', today);

    if (dairyId) {
      deliveriesQuery = deliveriesQuery.eq('dairy_id', toIdValue(dairyId));
    }

    const { data: deliveries, error: deliveryError } = await deliveriesQuery;

    if (deliveryError) throw deliveryError;

    return buildDerivedPerformanceFromDeliveries(deliveries || []);
  } catch (error) {
    console.error('Error fetching performance summary:', error.message);
    throw error;
  }
};

/**
 * Calculate and update agent performance metrics
 */
export const updateAgentPerformanceMetrics = async (agentId, performanceDate) => {
  try {
    // Get all deliveries for the agent on the given date
    const { data: deliveries, error: deliveryError } = await supabase
      .from('deliveries')
      .select('*')
      .eq('agent_id', agentId)
      .eq('delivery_date', performanceDate);

    if (deliveryError) throw deliveryError;

    // Calculate metrics
    const totalAssigned = deliveries.length;
    const completed = deliveries.filter((d) => {
      const status = String(d.status || '').toUpperCase();
      return status === 'COMPLETED' || status === 'DELIVERED';
    }).length;
    const failed = deliveries.filter((d) => {
      const status = String(d.status || '').toUpperCase();
      return ['FAILED', 'CANCELLED', 'CANCELED', 'MISSED', 'SKIPPED'].includes(status);
    }).length;
    const pending = deliveries.filter((d) => {
      const status = String(d.status || '').toUpperCase();
      return status !== 'COMPLETED' && status !== 'DELIVERED' && !['FAILED', 'CANCELLED', 'CANCELED', 'MISSED', 'SKIPPED'].includes(status);
    }).length;

    const completionRate =
      totalAssigned > 0 ? ((completed / totalAssigned) * 100).toFixed(2) : 0;
    const efficiencyPercentage =
      totalAssigned > 0 ? ((completed / totalAssigned) * 100).toFixed(2) : 0;

    // Upsert performance record
    const { data, error } = await supabase
      .from('agent_performance')
      .upsert(
        {
          agent_id: agentId,
          performance_date: performanceDate,
          total_assigned: totalAssigned,
          completed,
          failed,
          pending,
          completion_rate: parseFloat(completionRate),
          efficiency_percentage: parseFloat(efficiencyPercentage),
        },
        {
          onConflict: 'agent_id,performance_date',
        }
      )
      .select();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error(
      'Error updating agent performance metrics:',
      error.message
    );
    throw error;
  }
};

/**
 * Get top performing agents
 */
export const getTopPerformingAgents = async (limit = 10, startDate, endDate, dairyId = null) => {
  try {
    const scopedAgentIds = dairyId ? await getAgentIdsForDairy(dairyId) : null;
    if (dairyId && (!scopedAgentIds || scopedAgentIds.length === 0)) {
      return [];
    }

    let query = supabase
      .from('agent_performance')
      .select(
        `
        agent_id,
        completed,
        efficiency_percentage,
        performance_date
      `
      )
      .gte('performance_date', startDate)
      .lte('performance_date', endDate)
      .order('efficiency_percentage', { ascending: false });

    if (dairyId) {
      query = query.in('agent_id', scopedAgentIds);
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching top performing agents:', error.message);
    throw error;
  }
};

/**
 * Get missed deliveries summary
 */
export const getMissedDeliveriesSummary = async (startDate, endDate, dairyId = null) => {
  try {
    let query = supabase
      .from('deliveries')
      .select('*')
      .in('status', ['FAILED', 'CANCELLED', 'CANCELED', 'MISSED', 'SKIPPED'])
      .gte('delivery_date', startDate)
      .lte('delivery_date', endDate);

    if (dairyId) {
      query = query.eq('dairy_id', toIdValue(dairyId));
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching missed deliveries:', error.message);
    throw error;
  }
};

/**
 * Get month-wise customer (total and active) and income trends for the last 6 months
 */
export const getMonthlyTrends = async (dairyId) => {
  try {
    const resolvedDairyId = dairyId ? toIdValue(dairyId) : null;
    if (!resolvedDairyId) {
      return [];
    }

    // 1. Generate the last 6 months list dynamically based on current UTC/local time
    const trends = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const monthKey = `${year}-${month}`; // YYYY-MM
      
      const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
      
      const monthStart = new Date(Date.UTC(year, d.getMonth(), 1, 0, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(year, d.getMonth() + 1, 1, 0, 0, 0, 0) - 1);

      trends.push({
        month: monthKey,
        monthLabel: label,
        monthStart,
        monthEnd,
        totalCustomers: 0,
        activeCustomers: 0,
        income: 0,
      });
    }

    // 2. Fetch subscriptions for total & active customers
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("subscriptions")
      .select("customer_id, created_at, updated_at, status, approval_status")
      .eq("dairy_id", resolvedDairyId);

    if (subscriptionsError) throw subscriptionsError;

    // 3. Fetch successful payments for income
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("amount, paid_at, created_at")
      .eq("dairy_id", resolvedDairyId)
      .eq("status", "PAID");

    if (paymentsError) throw paymentsError;

    // 4. Aggregate metrics per month
    for (const t of trends) {
      // Total customers count: unique customer IDs with subscriptions created on or before monthEnd
      const totalCustIds = new Set();
      (subscriptions || []).forEach(s => {
        if (!s.customer_id) return;
        const createDate = new Date(s.created_at);
        if (createDate <= t.monthEnd) {
          totalCustIds.add(s.customer_id);
        }
      });
      t.totalCustomers = totalCustIds.size;

      // Active customers count: unique customer IDs with approved subscriptions active during the month
      const activeCustIds = new Set();
      (subscriptions || []).forEach(s => {
        if (!s.customer_id) return;
        const createDate = new Date(s.created_at);
        const updateDate = new Date(s.updated_at);
        
        // Subscription must have been created on or before monthEnd
        const wasCreated = createDate <= t.monthEnd;
        // Must be approved
        const isApproved = String(s.approval_status).toUpperCase() === "APPROVED";
        // Must not be closed before the start of the month
        const isNotClosedBefore = String(s.status).toUpperCase() !== "CLOSED" || updateDate >= t.monthStart;

        if (wasCreated && isApproved && isNotClosedBefore) {
          activeCustIds.add(s.customer_id);
        }
      });
      t.activeCustomers = activeCustIds.size;

      // Income sum: successful payments in this month
      let incomeSum = 0;
      (payments || []).forEach(p => {
        const payDate = new Date(p.paid_at || p.created_at);
        if (payDate >= t.monthStart && payDate <= t.monthEnd) {
          incomeSum += Number(p.amount || 0);
        }
      });
      t.income = Number(incomeSum.toFixed(2));
    }

    // Remove the Date objects from the final response to keep payload clean
    return trends.map(t => ({
      month: t.month,
      monthLabel: t.monthLabel,
      totalCustomers: t.totalCustomers,
      activeCustomers: t.activeCustomers,
      income: t.income,
    }));
  } catch (error) {
    console.error('Error fetching monthly performance trends:', error.message);
    throw error;
  }
};

