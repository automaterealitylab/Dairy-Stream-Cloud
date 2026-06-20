import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ComposedChart } from 'recharts';
import { TrendingUp, Users, CheckCircle, XCircle, Zap, Target, Award, Loader2, UserCheck, Clock3, AlertCircle } from 'lucide-react';
import {
  fetchAdminPerformance,
  fetchAdminMissedDeliveries,
  fetchAdminAgents,
  fetchAdminPerformanceMonthlyTrends,
} from "../../api/admin.api";

// Layout Components
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";

const PERF_CACHE_KEY = "adminPerformanceCacheV1";
const PERF_CACHE_TTL_MS = 2 * 60 * 1000;

const readPerformanceCache = (range) => {
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

const writePerformanceCache = (range, payload) => {
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

const AdminPerformance = () => {
  const initialCache = readPerformanceCache('7days');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dateRange, setDateRange] = useState('7days');
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState('');
  const [performanceRows, setPerformanceRows] = useState(initialCache?.performanceRows || []);
  const [missedRows, setMissedRows] = useState(initialCache?.missedRows || []);
  const [registeredAgents, setRegisteredAgents] = useState(initialCache?.registeredAgents || []);
  const [monthlyTrends, setMonthlyTrends] = useState(initialCache?.monthlyTrends || []);

  const getDateRange = (range) => {
    const end = new Date();
    const start = new Date(end);

    if (range === '7days') {
      start.setDate(end.getDate() - 6);
    } else if (range === '30days') {
      start.setDate(end.getDate() - 29);
    } else {
      start.setDate(1);
    }

    const toISO = (d) => d.toISOString().split('T')[0];
    return { startDate: toISO(start), endDate: toISO(end) };
  };

  const aggregatedByAgent = useMemo(() => {
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
  }, [performanceRows, registeredAgents]);

  const performanceData = useMemo(
    () => [...aggregatedByAgent].sort((a, b) => b.completed - a.completed),
    [aggregatedByAgent]
  );

  const topPerformers = useMemo(
    () =>
      [...aggregatedByAgent]
        .sort((a, b) => b.efficiency - a.efficiency)
        .slice(0, 3)
        .map((a) => ({ name: a.agent, score: a.efficiency, count: a.completed })),
    [aggregatedByAgent]
  );

  const efficiencyStats = useMemo(() => {
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
  }, [aggregatedByAgent]);

  const kpi = useMemo(() => {
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
  }, [aggregatedByAgent]);

  const dairyFactors = useMemo(() => {
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
  }, [aggregatedByAgent, missedRows, performanceRows, registeredAgents]);

  const missedDeliveries = useMemo(
    () => {
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
    },
    [missedRows, registeredAgents]
  );

  const dailyPerformanceTrend = useMemo(() => {
    const grouped = {};
    performanceRows.forEach((row) => {
      const rawDate = row.performance_date;
      if (!rawDate) return;
      
      let formattedDate = rawDate;
      try {
        const d = new Date(rawDate);
        formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      } catch (e) {
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
  }, [performanceRows]);

  const failureReasonData = useMemo(() => {
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
  }, [missedRows]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const cached = readPerformanceCache(dateRange);
        if (cached) {
          setPerformanceRows(Array.isArray(cached.performanceRows) ? cached.performanceRows : []);
          setMissedRows(Array.isArray(cached.missedRows) ? cached.missedRows : []);
          setRegisteredAgents(Array.isArray(cached.registeredAgents) ? cached.registeredAgents : []);
          setMonthlyTrends(Array.isArray(cached.monthlyTrends) ? cached.monthlyTrends : []);
          setLoading(false);
        }

        const { startDate, endDate } = getDateRange(dateRange);
        const shouldFetchAgents = !registeredAgents.length;

        // Start all requests in parallel, but do not block initial render on missed logs.
        const performancePromise = fetchAdminPerformance({ startDate, endDate });
        const missedPromise = fetchAdminMissedDeliveries({ startDate, endDate });
        const agentsPromise = shouldFetchAgents
          ? fetchAdminAgents({ lite: true })
          : Promise.resolve({ agents: registeredAgents });
        const trendsPromise = fetchAdminPerformanceMonthlyTrends();

        const [performanceRes, agentsRes, trendsRes] = await Promise.allSettled([
          performancePromise,
          agentsPromise,
          trendsPromise,
        ]);

        let nextPerformanceRows = [];
        let nextRegisteredAgents = registeredAgents;
        let nextMonthlyTrends = monthlyTrends;
        const earlyErrors = [];

        if (performanceRes.status === "fulfilled") {
          nextPerformanceRows = Array.isArray(performanceRes.value?.data)
            ? performanceRes.value.data
            : [];
        } else {
          earlyErrors.push("performance");
        }

        if (agentsRes.status === "fulfilled") {
          nextRegisteredAgents = Array.isArray(agentsRes.value?.agents)
            ? agentsRes.value.agents
            : nextRegisteredAgents;
        } else if (shouldFetchAgents) {
          earlyErrors.push("agents");
        }

        if (trendsRes.status === "fulfilled") {
          nextMonthlyTrends = Array.isArray(trendsRes.value?.data)
            ? trendsRes.value.data
            : [];
        } else {
          earlyErrors.push("monthly trends");
        }

        setPerformanceRows(nextPerformanceRows);
        setRegisteredAgents(nextRegisteredAgents);
        setMonthlyTrends(nextMonthlyTrends);
        setLoading(false);

        const [missedRes] = await Promise.allSettled([missedPromise]);
        let nextMissedRows = [];
        const lateErrors = [];

        if (missedRes.status === "fulfilled") {
          nextMissedRows = Array.isArray(missedRes.value?.data)
            ? missedRes.value.data
            : [];
          setMissedRows(nextMissedRows);
        } else {
          lateErrors.push("missed deliveries");
        }

        writePerformanceCache(dateRange, {
          performanceRows: nextPerformanceRows,
          missedRows: nextMissedRows,
          registeredAgents: nextRegisteredAgents,
          monthlyTrends: nextMonthlyTrends,
        });

        const allErrors = [...earlyErrors, ...lateErrors];
        if (allErrors.length > 0) {
          setError(`Some data sources failed: ${allErrors.join(", ")}.`);
        }
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dateRange]);

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#2C1A0E]" style={adminShellFont}>
      <AdminMobileTopbar title="Performance Analytics" onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-10 pb-32 sm:px-8 lg:ml-64 lg:px-12">
        
        {/* HEADER AREA */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl tracking-tight text-[#2C1A0E]" style={adminHeadingFont}>Agent Intelligence</h1>
            <p className="text-sm font-medium text-[#8B7355]">Real-time delivery efficiency and reliability scores.</p>
          </div>
          
          <div className="flex rounded-[20px] border border-[#E5D9C7] bg-[#FFFDF8] p-1.5">
            {['7days', '30days', 'month'].map((range) => (
              <button 
                key={range}
                onClick={() => setDateRange(range)}
                className={`rounded-[14px] px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                  dateRange === range ? "bg-[#FDE9C9] text-[#B8641A] shadow-sm" : "text-[#B89970] hover:text-[#8B7355]"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="mb-6 rounded-2xl border border-[#E5D9C7] bg-[#FFFDF8] px-4 py-3 flex items-center gap-3">
            <Loader2 className="animate-spin text-[#B8641A]" size={18} />
            <p className="text-[11px] font-black uppercase tracking-widest text-[#8B7355]">Refreshing metrics...</p>
          </div>
        )}

        {/* KPI GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Avg Efficiency', val: `${kpi.avgEfficiency.toFixed(1)}%`, icon: Target, col: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Deliveries', val: String(kpi.totalDeliveries), icon: Zap, col: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Success Rate', val: `${kpi.successRate.toFixed(1)}%`, icon: CheckCircle, col: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Missed Hits', val: String(kpi.missed), icon: XCircle, col: 'text-rose-600', bg: 'bg-rose-50' }
          ].map((item, i) => (
            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 ${item.bg} ${item.col} rounded-xl flex items-center justify-center`}>
                  <item.icon size={20} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
              </div>
              <h3 className="text-2xl font-black text-slate-900">{item.val}</h3>
            </div>
          ))}
        </div>

        {/* PRIMARY SECTION */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          <div className="xl:col-span-2 bg-white p-7 rounded-[36px] shadow-sm border border-slate-100">
            <h3 className="text-base font-black text-slate-800 mb-6 uppercase tracking-tighter flex items-center gap-2">
              <Users size={18} className="text-blue-500" /> Delivery Volume by Agent
            </h3>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="agent" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="completed" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Successful" />
                  <Bar dataKey="failed" fill="#FDA4AF" radius={[6, 6, 0, 0]} name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-7 rounded-[36px] shadow-sm border border-slate-100">
            <h3 className="text-base font-black text-slate-800 mb-5 uppercase tracking-tighter flex items-center gap-2">
              <Award size={18} className="text-amber-500" /> Top Agents
            </h3>
            <div className="space-y-3">
              {topPerformers.length === 0 && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                  No performance data.
                </div>
              )}
              {topPerformers.map((agent, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xs">
                      #{i + 1}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 text-sm leading-tight">{agent.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{agent.count} Completed</p>
                    </div>
                  </div>
                  <p className="text-lg font-black text-blue-600">{agent.score}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TRENDS & FAILURES SECTION */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          <div className="xl:col-span-2 bg-white p-7 rounded-[36px] shadow-sm border border-slate-100">
            <h3 className="text-base font-black text-slate-800 mb-6 uppercase tracking-tighter flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-500" /> Daily Delivery Trend
            </h3>
            <div className="h-[360px]">
              {dailyPerformanceTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                  No trend data available for this range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyPerformanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Successful" />
                    <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Failed" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white p-7 rounded-[36px] shadow-sm border border-slate-100">
            <h3 className="text-base font-black text-slate-800 mb-5 uppercase tracking-tighter flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-500" /> Failure Reasons Analysis
            </h3>
            {failureReasonData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-sm text-slate-500">
                No failed deliveries recorded in this range.
              </div>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={failureReasonData} innerRadius={60} outerRadius={90} paddingAngle={6} dataKey="value">
                      {failureReasonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* MONTHLY CUSTOMER & INCOME TRENDS SECTION */}
        <div className="bg-white p-7 rounded-[36px] shadow-sm border border-slate-100 mb-8">
          <h3 className="text-base font-black text-slate-800 mb-6 uppercase tracking-tighter flex items-center gap-2">
            <TrendingUp size={18} className="text-[#B8641A]" /> Monthly Customer & Income Trends
          </h3>
          <div className="h-[380px]">
            {monthlyTrends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                No monthly trend data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrends} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} label={{ value: 'Customer Count', angle: -90, position: 'insideLeft', offset: -10, style: { fill: '#64748B', fontSize: 11, fontWeight: 700 } }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} label={{ value: 'Income (₹)', angle: 90, position: 'insideRight', offset: 0, style: { fill: '#64748B', fontSize: 11, fontWeight: 700 } }} />
                  <Tooltip contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar yAxisId="right" dataKey="income" fill="#B8641A" radius={[6, 6, 0, 0]} name="Income (₹)" />
                  <Line yAxisId="left" type="monotone" dataKey="totalCustomers" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Total Customers" />
                  <Line yAxisId="left" type="monotone" dataKey="activeCustomers" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Active Customers" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* SUPPORTING SECTION */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="space-y-8">
            <div className="bg-white p-7 rounded-[36px] shadow-sm border border-slate-100">
              <h3 className="text-base font-black text-slate-800 mb-5 uppercase tracking-tighter flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-500" /> Efficiency Clusters
              </h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={efficiencyStats} innerRadius={60} outerRadius={90} paddingAngle={6} dataKey="value">
                      {efficiencyStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={30} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-7 rounded-[36px] shadow-sm border border-slate-100">
              <h3 className="text-base font-black text-slate-800 mb-5 uppercase tracking-tighter">Operational Factors</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Active Agents', val: String(dairyFactors.activeAgents), icon: UserCheck, col: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Pending', val: String(dairyFactors.pending), icon: Clock3, col: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Idle Agents', val: String(dairyFactors.idleAgents), icon: Users, col: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Avg Load', val: dairyFactors.avgLoadPerAgent.toFixed(1), icon: Zap, col: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map((factor, i) => (
                  <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className={`h-8 w-8 ${factor.bg} ${factor.col} rounded-lg flex items-center justify-center mb-2`}>
                      <factor.icon size={16} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{factor.label}</p>
                    <p className="text-lg font-black text-slate-800">{factor.val}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Top Failure Reasons</p>
                <div className="space-y-1.5">
                  {dairyFactors.topFailureReasons.length === 0 && (
                    <p className="text-sm font-semibold text-slate-500">No failed deliveries in this range.</p>
                  )}
                  {dairyFactors.topFailureReasons.map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between text-sm font-bold text-slate-700">
                      <span>{String(reason).replaceAll('_', ' ')}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 bg-white rounded-[36px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-7 py-5 border-b border-slate-50">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tighter">Recent Failure Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-7 py-4">Agent / Customer</th>
                    <th className="px-7 py-4">Status / Reason</th>
                    <th className="px-7 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {missedDeliveries.length === 0 && (
                    <tr>
                      <td className="px-7 py-5 text-sm font-bold text-slate-500" colSpan={3}>
                        No failed deliveries for this period.
                      </td>
                    </tr>
                  )}
                  {missedDeliveries.map((item, i) => (
                    <tr key={i} className="hover:bg-blue-50/20 transition-all">
                      <td className="px-7 py-5">
                        <div className="font-black text-slate-800 text-sm">{item.agent}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To: {item.customer}</div>
                      </td>
                      <td className="px-7 py-5">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-widest">
                          {item.reason.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-7 py-5 text-sm font-bold text-slate-500">{item.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

      </main>
    </div>
  );
};

export default AdminPerformance;
