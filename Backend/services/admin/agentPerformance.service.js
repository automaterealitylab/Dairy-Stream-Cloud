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
    if (row.status === 'COMPLETED') acc[key].completed += 1;
    else if (row.status === 'FAILED') acc[key].failed += 1;
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
    const completed = deliveries.filter((d) => d.status === 'COMPLETED').length;
    const failed = deliveries.filter((d) => d.status === 'FAILED').length;
    const pending = deliveries.filter((d) => d.status === 'PENDING').length;

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
      .eq('status', 'FAILED')
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
