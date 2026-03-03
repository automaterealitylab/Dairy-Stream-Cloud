import { supabase } from '../../config/supabase.js';

/**
 * Get agent earnings data
 * @param {number} agentId - Agent ID
 * @param {string} startDate - Start date (YYYY-MM-DD format)
 * @param {string} endDate - End date (YYYY-MM-DD format)
 */
export const getAgentEarnings = async (agentId, startDate, endDate) => {
  try {
    const { data, error } = await supabase
      .from('agent_earnings')
      .select('*')
      .eq('agent_id', agentId)
      .gte('earning_date', startDate)
      .lte('earning_date', endDate)
      .order('earning_date', { ascending: false });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching agent earnings:', error.message);
    throw error;
  }
};

/**
 * Calculate and update earnings for an agent on a specific date
 */
export const calculateAndUpdateEarnings = async (
  agentId,
  earningDate,
  earningPerDelivery = 50
) => {
  try {
    // Get completed deliveries for the agent on the given date
    const { data: completedDeliveries, error: deliveryError } = await supabase
      .from('deliveries')
      .select('*')
      .eq('agent_id', agentId)
      .eq('delivery_date', earningDate)
      .eq('status', 'COMPLETED');

    if (deliveryError) throw deliveryError;

    const deliveriesCompleted = completedDeliveries.length;
    const totalEarnings = deliveriesCompleted * earningPerDelivery;
    const bonusAmount = 0; // Can be calculated based on efficiency
    const deductions = 0;
    const netEarnings = totalEarnings + bonusAmount - deductions;

    // Upsert earnings record
    const { data, error } = await supabase
      .from('agent_earnings')
      .upsert(
        {
          agent_id: agentId,
          earning_date: earningDate,
          deliveries_completed: deliveriesCompleted,
          earning_per_delivery: earningPerDelivery,
          total_earnings: totalEarnings,
          bonus_amount: bonusAmount,
          deductions,
          net_earnings: netEarnings,
        },
        {
          onConflict: 'agent_id,earning_date',
        }
      )
      .select();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error calculating earnings:', error.message);
    throw error;
  }
};

/**
 * Get today's work summary for agent
 */
export const getTodayWorkSummary = async (agentId) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get earnings
    const { data: earnings, error: earningsError } = await supabase
      .from('agent_earnings')
      .select('*')
      .eq('agent_id', agentId)
      .eq('earning_date', today)
      .single();

    if (earningsError && earningsError.code !== 'PGRST116') {
      throw earningsError;
    }

    // Get deliveries
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('deliveries')
      .select('*')
      .eq('agent_id', agentId)
      .eq('delivery_date', today);

    if (deliveriesError) throw deliveriesError;

    const completed = deliveries.filter((d) => d.status === 'COMPLETED').length;
    const pending = deliveries.filter((d) => d.status === 'PENDING').length;
    const failed = deliveries.filter((d) => d.status === 'FAILED').length;

    return {
      earnings: earnings || {
        deliveries_completed: 0,
        total_earnings: 0,
        net_earnings: 0,
        bonus_amount: 0,
      },
      deliveries: {
        total: deliveries.length,
        completed,
        pending,
        failed,
      },
    };
  } catch (error) {
    console.error('Error fetching work summary:', error.message);
    throw error;
  }
};

/**
 * Get earnings summary for date range
 */
export const getEarningsSummary = async (agentId, startDate, endDate) => {
  try {
    const { data, error } = await supabase
      .from('agent_earnings')
      .select('*')
      .eq('agent_id', agentId)
      .gte('earning_date', startDate)
      .lte('earning_date', endDate);

    if (error) throw error;

    // Calculate totals
    const totalEarnings = data.reduce((sum, item) => sum + item.net_earnings, 0);
    const totalDeliveries = data.reduce(
      (sum, item) => sum + item.deliveries_completed,
      0
    );
    const averagePerDay = data.length > 0 ? totalEarnings / data.length : 0;

    return {
      earnings: data,
      summary: {
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),
        totalDeliveries,
        averagePerDay: parseFloat(averagePerDay.toFixed(2)),
        count: data.length,
      },
    };
  } catch (error) {
    console.error('Error fetching earnings summary:', error.message);
    throw error;
  }
};
