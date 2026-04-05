import client from "./client";

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

    return client.get(`/admin/performance?${params}`);
  },

  // Get performance summary
  getPerformanceSummary: () => {
    return client.get("/admin/performance/summary");
  },

  // Get top performing agents
  getTopPerformers: (limit = 10) => {
    return client.get(`/admin/performance/top-performers?limit=${limit}`);
  },

  // Get missed deliveries
  getMissedDeliveries: (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return client.get(`/admin/performance/missed-deliveries?${params}`);
  },

  // Update performance metrics
  updatePerformanceMetrics: (agentId, performanceDate) => {
    return client.post("/admin/performance/update", { agentId, performanceDate });
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

    return client.get(`/admin/earnings?${params}`);
  },

  // Get today's work summary
  getTodayWorkSummary: (agentId) => {
    return client.get(`/admin/earnings/today-summary?agentId=${agentId}`);
  },

  // Get earnings summary
  getSummary: (agentId, startDate = null, endDate = null) => {
    const params = new URLSearchParams({ agentId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return client.get(`/admin/earnings/summary?${params}`);
  },

  // Calculate and update earnings
  calculateEarnings: (agentId, earningDate, earningPerDelivery = 50) => {
    return client.post("/admin/earnings/calculate", {
      agentId,
      earningDate,
      earningPerDelivery,
    });
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

    return client.get(`/agent/deliveries?${params}`);
  },

  // Update delivery status
  updateDeliveryStatus: (deliveryId, status) => {
    return client.patch(`/agent/deliveries/${deliveryId}/status`, { status });
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

    return client.post(`/agent/deliveries/${deliveryId}/proof`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
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

    return client.post(`/agent/deliveries/${deliveryId}/failed`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export default {
  agentPerformanceAPI,
  agentEarningsAPI,
  deliveryAPI,
};
