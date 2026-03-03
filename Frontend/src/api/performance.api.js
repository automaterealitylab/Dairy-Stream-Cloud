import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ============================================
// Agent Performance APIs
// ============================================

export const agentPerformanceAPI = {
  // Get performance metrics
  getPerformance: (agentId = null, startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (agentId) params.append('agentId', agentId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return axios.get(
      `${API_BASE_URL}/admin/performance?${params}`,
      { withCredentials: true }
    );
  },

  // Get performance summary
  getPerformanceSummary: () => {
    return axios.get(`${API_BASE_URL}/admin/performance/summary`, {
      withCredentials: true,
    });
  },

  // Get top performing agents
  getTopPerformers: (limit = 10) => {
    return axios.get(
      `${API_BASE_URL}/admin/performance/top-performers?limit=${limit}`,
      { withCredentials: true }
    );
  },

  // Get missed deliveries
  getMissedDeliveries: (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return axios.get(
      `${API_BASE_URL}/admin/performance/missed-deliveries?${params}`,
      { withCredentials: true }
    );
  },

  // Update performance metrics
  updatePerformanceMetrics: (agentId, performanceDate) => {
    return axios.post(
      `${API_BASE_URL}/admin/performance/update`,
      { agentId, performanceDate },
      { withCredentials: true }
    );
  },
};

// ============================================
// Agent Earnings APIs
// ============================================

export const agentEarningsAPI = {
  // Get earnings for date range
  getEarnings: (agentId, startDate = null, endDate = null) => {
    const params = new URLSearchParams({ agentId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return axios.get(`${API_BASE_URL}/admin/earnings?${params}`, {
      withCredentials: true,
    });
  },

  // Get today's work summary
  getTodayWorkSummary: (agentId) => {
    return axios.get(
      `${API_BASE_URL}/admin/earnings/today-summary?agentId=${agentId}`,
      { withCredentials: true }
    );
  },

  // Get earnings summary
  getSummary: (agentId, startDate = null, endDate = null) => {
    const params = new URLSearchParams({ agentId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return axios.get(
      `${API_BASE_URL}/admin/earnings/summary?${params}`,
      { withCredentials: true }
    );
  },

  // Calculate and update earnings
  calculateEarnings: (agentId, earningDate, earningPerDelivery = 50) => {
    return axios.post(
      `${API_BASE_URL}/admin/earnings/calculate`,
      { agentId, earningDate, earningPerDelivery },
      { withCredentials: true }
    );
  },
};

// ============================================
// Delivery APIs
// ============================================

export const deliveryAPI = {
  // Get agent deliveries
  getDeliveries: (agentId, date = null) => {
    const params = new URLSearchParams({ agentId });
    if (date) params.append('date', date);

    return axios.get(
      `${API_BASE_URL}/agent/deliveries?${params}`,
      { withCredentials: true }
    );
  },

  // Update delivery status
  updateDeliveryStatus: (deliveryId, status) => {
    return axios.patch(
      `${API_BASE_URL}/agent/deliveries/${deliveryId}/status`,
      { status },
      { withCredentials: true }
    );
  },

  // Submit delivery proof
  submitDeliveryProof: (deliveryId, proofType, file = null, otp = null) => {
    const formData = new FormData();
    formData.append('deliveryId', deliveryId);
    formData.append('proofType', proofType);

    if (file) {
      formData.append('proof', file);
    }

    if (otp) {
      formData.append('otp', otp);
    }

    return axios.post(
      `${API_BASE_URL}/agent/deliveries/${deliveryId}/proof`,
      formData,
      {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
  },

  // Mark delivery as failed
  markDeliveryFailed: (deliveryId, reason, reasonDetails = null, file = null) => {
    const formData = new FormData();
    formData.append('deliveryId', deliveryId);
    formData.append('reason', reason);

    if (reasonDetails) {
      formData.append('reasonDetails', reasonDetails);
    }

    if (file) {
      formData.append('proof', file);
    }

    return axios.post(
      `${API_BASE_URL}/agent/deliveries/${deliveryId}/failed`,
      formData,
      {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
  },
};

export default {
  agentPerformanceAPI,
  agentEarningsAPI,
  deliveryAPI,
};
