import {
  getAgentEarnings,
  calculateAndUpdateEarnings,
  getTodayWorkSummary,
  getEarningsSummary,
} from '../../services/admin/agentEarnings.service.js';

/**
 * Get agent earnings for date range
 */
export const getEarnings = async (req, res) => {
  try {
    const { agentId, startDate, endDate } = req.query;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'agentId is required',
      });
    }

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const earnings = await getAgentEarnings(agentId, start, end);

    res.json({
      success: true,
      data: earnings,
      filters: { agentId, startDate: start, endDate: end },
    });
  } catch (error) {
    console.error('❌ GET EARNINGS ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get today's work summary for agent
 */
export const getTodayWorkSummaryData = async (req, res) => {
  try {
    const { agentId } = req.query;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'agentId is required',
      });
    }

    const workSummary = await getTodayWorkSummary(agentId);

    res.json({
      success: true,
      data: workSummary,
    });
  } catch (error) {
    console.error('❌ GET TODAY WORK SUMMARY ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today work summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get earnings summary for date range
 */
export const getSummary = async (req, res) => {
  try {
    const { agentId, startDate, endDate } = req.query;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'agentId is required',
      });
    }

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const summary = await getEarningsSummary(agentId, start, end);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('❌ GET EARNINGS SUMMARY ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Calculate and update earnings for an agent
 */
export const calculateEarnings = async (req, res) => {
  try {
    const { agentId, earningDate, earningPerDelivery } = req.body;

    if (!agentId || !earningDate) {
      return res.status(400).json({
        success: false,
        message: 'agentId and earningDate are required',
      });
    }

    const updated = await calculateAndUpdateEarnings(
      agentId,
      earningDate,
      earningPerDelivery || 50
    );

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('❌ CALCULATE EARNINGS ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate earnings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
