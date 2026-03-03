import { supabase } from '../../config/supabase.js';

/**
 * Get agent performance metrics
 * @param {number} agentId - Agent ID (optional, if not provided gets all agents)
 * @param {string} startDate - Start date (YYYY-MM-DD format)
 * @param {string} endDate - End date (YYYY-MM-DD format)
 */
export const getAgentPerformance = async (agentId, startDate, endDate) => {
  try {
    let query = supabase
      .from('agent_performance')
      .select('*')
      .gte('performance_date', startDate)
      .lte('performance_date', endDate);

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query.order('performance_date', {
      ascending: false,
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching agent performance:', error.message);
    throw error;
  }
};

/**
 * Get performance summary for dashboard
 */
export const getPerformanceSummary = async () => {
  try {
    // Get today's performance metrics
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('agent_performance')
      .select(
        `
        *,
        agents(id, agent_name, email)
      `
      )
      .eq('performance_date', today);

    if (error) throw error;

    return data;
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
export const getTopPerformingAgents = async (limit = 10, startDate, endDate) => {
  try {
    const { data, error } = await supabase
      .from('agent_performance')
      .select(
        `
        agent_id,
        agents(agent_name, email),
        completed,
        efficiency_percentage,
        performance_date
      `
      )
      .gte('performance_date', startDate)
      .lte('performance_date', endDate)
      .order('efficiency_percentage', { ascending: false })
      .limit(limit);

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
export const getMissedDeliveriesSummary = async (startDate, endDate) => {
  try {
    const { data, error } = await supabase
      .from('deliveries')
      .select(
        `
        *,
        agents(agent_name, email)
      `
      )
      .eq('status', 'FAILED')
      .gte('delivery_date', startDate)
      .lte('delivery_date', endDate);

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching missed deliveries:', error.message);
    throw error;
  }
};
