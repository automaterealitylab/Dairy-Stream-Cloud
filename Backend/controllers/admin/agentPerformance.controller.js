import {
  getAgentPerformance,
  getPerformanceSummary,
  getTopPerformingAgents,
  getMissedDeliveriesSummary,
  updateAgentPerformanceMetrics,
  getMonthlyTrends,
} from '../../services/admin/agentPerformance.service.js';

/**
 * Get performance metrics for all agents or specific agent
 */
export const getPerformance = async (req, res) => {
  try {
    const { agentId, startDate, endDate } = req.query;
    const dairyId = req.admin?.dairyId || null;

    // Default to last 7 days if not provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const performance = await getAgentPerformance(agentId, start, end, dairyId);

    res.json({
      success: true,
      data: performance,
      filters: { agentId, startDate: start, endDate: end },
    });
  } catch (error) {
    console.error('❌ GET PERFORMANCE ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get performance summary for dashboard
 */
export const getPerformanceSummaryData = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId || null;
    const summary = await getPerformanceSummary(dairyId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('❌ GET PERFORMANCE SUMMARY ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get top performing agents
 */
export const getTopPerformers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const dairyId = req.admin?.dairyId || null;
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const topAgents = await getTopPerformingAgents(parseInt(limit), start, end, dairyId);

    res.json({
      success: true,
      data: topAgents,
    });
  } catch (error) {
    console.error('❌ GET TOP PERFORMERS ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top performers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get missed deliveries summary
 */
export const getMissedDeliveries = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dairyId = req.admin?.dairyId || null;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const missedDeliveries = await getMissedDeliveriesSummary(start, end, dairyId);

    res.json({
      success: true,
      data: missedDeliveries,
      count: missedDeliveries.length,
    });
  } catch (error) {
    console.error('❌ GET MISSED DELIVERIES ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch missed deliveries',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update performance metrics for an agent
 */
export const updatePerformanceMetrics = async (req, res) => {
  try {
    const { agentId, performanceDate } = req.body;

    if (!agentId || !performanceDate) {
      return res.status(400).json({
        success: false,
        message: 'agentId and performanceDate are required',
      });
    }

    const updated = await updateAgentPerformanceMetrics(
      agentId,
      performanceDate
    );

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('❌ UPDATE PERFORMANCE METRICS ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update performance metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get monthly trend statistics (total/active customers and income)
 */
export const getPerformanceMonthlyTrends = async (req, res) => {
  try {
    const dairyId = req.admin?.dairyId || null;
    const trends = await getMonthlyTrends(dairyId);

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('❌ GET PERFORMANCE MONTHLY TRENDS ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly performance trends',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

