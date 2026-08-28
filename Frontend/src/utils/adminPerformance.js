const PERF_CACHE_KEY = "adminPerformanceCacheV1";
const PERF_CACHE_TTL_MS = 2 * 60 * 1000;

export const readPerformanceCache = (range) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PERF_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.range !== range || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > PERF_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writePerformanceCache = (range, payload) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PERF_CACHE_KEY,
      JSON.stringify({
        range,
        timestamp: Date.now(),
        ...payload,
      })
    );
  } catch {
    // ignore cache write failures
  }
};

export const getDateRange = (range) => {
  const end = new Date();
  const start = new Date(end);

  if (range === '7days') {
    start.setDate(end.getDate() - 6);
  } else if (range === 'monthly') {
    start.setDate(end.getDate() - 29);
  } else if (range === '6months') {
    start.setMonth(end.getMonth() - 6);
  } else if (range === 'yearly') {
    start.setFullYear(end.getFullYear() - 1);
  } else {
    start.setDate(end.getDate() - 6);
  }

  const toISO = (d) => d.toISOString().split('T')[0];
  return { startDate: toISO(start), endDate: toISO(end) };
};

export const aggregateByAgent = (performanceRows, registeredAgents) => {
  const grouped = {};

  // Always seed with all registered dairy agents (including zero-delivery agents).
  registeredAgents.forEach((agent) => {
    const id = agent?.id;
    if (!id) return;
    grouped[id] = {
      agentId: id,
      agent: agent?.agent_name || agent?.full_name || `Agent #${id}`,
      completed: 0,
      failed: 0,
      totalAssigned: 0,
    };
  });

  performanceRows.forEach((row) => {
    const agentId = row.agent_id || row?.agents?.id || row.id || row.agent_name;
    if (!agentId) return;
    if (!grouped[agentId]) {
      grouped[agentId] = {
        agentId,
        agent: row?.agents?.agent_name || row?.agent_name || `Agent #${agentId}`,
        completed: 0,
        failed: 0,
        totalAssigned: 0,
      };
    }
    grouped[agentId].completed += Number(row.completed || 0);
    grouped[agentId].failed += Number(row.failed || 0);
    grouped[agentId].totalAssigned += Number(row.total_assigned || 0);
    if (!row?.agents?.agent_name && row?.agent_name) {
      grouped[agentId].agent = row.agent_name;
    }
  });

  return Object.values(grouped).map((entry) => ({
    ...entry,
    efficiency: entry.totalAssigned > 0
      ? Number(((entry.completed / entry.totalAssigned) * 100).toFixed(1))
      : 0,
  }));
};

export const computePerformanceData = (aggregatedByAgent) =>
  [...aggregatedByAgent].sort((a, b) => b.completed - a.completed);

export const computeTopPerformers = (aggregatedByAgent) =>
  [...aggregatedByAgent]
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 3)
    .map((a) => ({ name: a.agent, score: a.efficiency, count: a.completed }));

export const computeEfficiencyStats = (aggregatedByAgent) => {
  const bucket = aggregatedByAgent.reduce(
    (acc, row) => {
      if (row.efficiency >= 90) acc.high += 1;
      else if (row.efficiency >= 80) acc.mid += 1;
      else acc.low += 1;
      return acc;
    },
    { high: 0, mid: 0, low: 0 }
  );

  return [
    { name: '90-100%', value: bucket.high, color: '#10b981' },
    { name: '80-90%', value: bucket.mid, color: '#f59e0b' },
    { name: '< 80%', value: bucket.low, color: '#ef4444' },
  ];
};

export const computeKpi = (aggregatedByAgent) => {
  const totals = aggregatedByAgent.reduce(
    (acc, row) => {
      acc.completed += row.completed;
      acc.failed += row.failed;
      acc.totalAssigned += row.totalAssigned;
      return acc;
    },
    { completed: 0, failed: 0, totalAssigned: 0 }
  );
  const avgEfficiency = aggregatedByAgent.length
    ? aggregatedByAgent.reduce((sum, row) => sum + row.efficiency, 0) / aggregatedByAgent.length
    : 0;
  const successRate = totals.totalAssigned > 0
    ? (totals.completed / totals.totalAssigned) * 100
    : 0;

  return {
    avgEfficiency,
    totalDeliveries: totals.totalAssigned,
    successRate,
    missed: totals.failed,
  };
};

export const computeDairyFactors = (aggregatedByAgent, missedRows, performanceRows, registeredAgents) => {
  const total = aggregatedByAgent.reduce((sum, row) => sum + Number(row.totalAssigned || 0), 0);
  const pending = performanceRows.reduce((sum, row) => sum + Number(row.pending || 0), 0);
  const failed = aggregatedByAgent.reduce((sum, row) => sum + Number(row.failed || 0), 0);
  const activeAgents = aggregatedByAgent.filter((a) => Number(a.totalAssigned || 0) > 0).length;
  const idleAgents = Math.max(registeredAgents.length - activeAgents, 0);
  const avgLoadPerAgent = activeAgents > 0 ? total / activeAgents : 0;
  const lowEfficiencyAgents = aggregatedByAgent.filter((a) => a.efficiency < 80).length;

  const failureReasons = missedRows.reduce((acc, row) => {
    const reason = String(row?.failed_reason || "OTHER").toUpperCase();
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});

  const topFailureReasons = Object.entries(failureReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return {
    pending,
    failed,
    idleAgents,
    activeAgents,
    avgLoadPerAgent,
    lowEfficiencyAgents,
    topFailureReasons,
  };
};

export const computeMissedDeliveries = (missedRows, registeredAgents) => {
  const nameByAgentId = new Map();
  registeredAgents.forEach((agent) => {
    if (agent?.id && (agent?.agent_name || agent?.full_name)) {
      nameByAgentId.set(String(agent.id), agent.agent_name || agent.full_name);
    }
  });

  return missedRows.slice(0, 20).map((item) => ({
    agent:
      item?.agent_name ||
      nameByAgentId.get(String(item.agent_id || "")) ||
      `Agent #${item.agent_id || "NA"}`,
    customer: item.customer_name || "Unknown customer",
    reason: item.failed_reason || "OTHER",
    date: item.delivery_date
      ? new Date(item.delivery_date).toLocaleDateString('en-GB')
      : '-',
  }));
};

export const computeDailyPerformanceTrend = (performanceRows) => {
  const grouped = {};
  performanceRows.forEach((row) => {
    const rawDate = row.performance_date;
    if (!rawDate) return;

    let formattedDate = rawDate;
    try {
      const d = new Date(rawDate);
      formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } catch (_e) {
      // ignore format failure
    }

    if (!grouped[rawDate]) {
      grouped[rawDate] = {
        rawDate,
        date: formattedDate,
        completed: 0,
        failed: 0,
      };
    }
    grouped[rawDate].completed += Number(row.completed || 0);
    grouped[rawDate].failed += Number(row.failed || 0);
  });

  return Object.values(grouped).sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
};

export const computeFailureReasonData = (missedRows) => {
  const reasons = {};
  missedRows.forEach((row) => {
    const reason = String(row?.failed_reason || "OTHER")
      .toUpperCase()
      .replaceAll('_', ' ');
    reasons[reason] = (reasons[reason] || 0) + 1;
  });

  const colors = ['#F59E0B', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#6B7280'];
  return Object.entries(reasons).map(([name, value], i) => ({
    name,
    value,
    color: colors[i % colors.length],
  }));
};
