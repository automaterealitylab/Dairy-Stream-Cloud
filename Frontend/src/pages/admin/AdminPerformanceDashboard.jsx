import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Users, Target, MapPin, Loader2, Zap, CheckCircle, XCircle } from 'lucide-react';
import {
  fetchAdminPerformance,
  fetchAdminMissedDeliveries,
  fetchAdminAgents,
  fetchAdminPerformanceMonthlyTrends,
  fetchAdminCustomers,
  fetchAdminProfile,
} from "../../api/admin.api";
import {
  readPerformanceCache,
  writePerformanceCache,
  getDateRange,
  aggregateByAgent,
  computePerformanceData,
  computeTopPerformers,
  computeEfficiencyStats,
  computeKpi,
  computeDairyFactors,
  computeMissedDeliveries,
  computeDailyPerformanceTrend,
  computeFailureReasonData,
} from "../../utils/adminPerformance";
import { PERFORMANCE_DATE_RANGES } from "../../constants/adminPerformance";
import { StatCard } from "../../components/admin/performance";
import {
  DailyDeliveryVolumeCard,
  MonthlyIncomeCard,
  SubscriptionTrendsCard,
  ChurnAnalysisCard,
  DeliveryVolumeByAgentCard,
  TopAgentsCard,
  EfficiencyClustersCard,
  OperationalFactorsCard,
  FailureReasonsAnalysisCard,
  RecentFailureLogsCard,
} from "../../components/admin/performance/charts";
import { CustomerDistributionMap } from "../../components/admin/performance/CustomerDistributionMap";

// Layout Components
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import AdminMobileBottomNav from "../../components/admin/layout/AdminMobileBottomNav";
import { adminHeadingFont, adminShellFont } from "../../components/admin/adminTheme";

const AdminPerformance = () => {
  const initialCache = readPerformanceCache('7days');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const adminName = useMemo(() => {
    try {
      const adminUserStr = localStorage.getItem("adminUser");
      return adminUserStr ? JSON.parse(adminUserStr)?.name : "Admin";
    } catch {
      return "Admin";
    }
  }, []);
  const [dateRange, setDateRange] = useState('7days');
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState('');
  const [performanceRows, setPerformanceRows] = useState(initialCache?.performanceRows || []);
  const [missedRows, setMissedRows] = useState(initialCache?.missedRows || []);
  const [registeredAgents, setRegisteredAgents] = useState(initialCache?.registeredAgents || []);
  const [monthlyTrends, setMonthlyTrends] = useState(initialCache?.monthlyTrends || []);
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [dairy, setDairy] = useState(null);

  const aggregatedByAgent = useMemo(
    () => aggregateByAgent(performanceRows, registeredAgents),
    [performanceRows, registeredAgents]
  );

  const performanceData = useMemo(
    () => computePerformanceData(aggregatedByAgent),
    [aggregatedByAgent]
  );

  const topPerformers = useMemo(
    () => computeTopPerformers(aggregatedByAgent),
    [aggregatedByAgent]
  );

  const efficiencyStats = useMemo(
    () => computeEfficiencyStats(aggregatedByAgent),
    [aggregatedByAgent]
  );

  const kpi = useMemo(
    () => computeKpi(aggregatedByAgent),
    [aggregatedByAgent]
  );

  const dairyFactors = useMemo(
    () => computeDairyFactors(aggregatedByAgent, missedRows, performanceRows, registeredAgents),
    [aggregatedByAgent, missedRows, performanceRows, registeredAgents]
  );

  const missedDeliveries = useMemo(
    () => computeMissedDeliveries(missedRows, registeredAgents),
    [missedRows, registeredAgents]
  );

  const dailyPerformanceTrend = useMemo(
    () => computeDailyPerformanceTrend(performanceRows),
    [performanceRows]
  );

  const failureReasonData = useMemo(
    () => computeFailureReasonData(missedRows),
    [missedRows]
  );

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

  useEffect(() => {
    const loadCustomersAndProfile = async () => {
      setLoadingCustomers(true);
      try {
        const [customerRes, profileRes] = await Promise.allSettled([
          fetchAdminCustomers({ page: 1, limit: 1000 }),
          fetchAdminProfile()
        ]);

        if (customerRes.status === "fulfilled") {
          const res = customerRes.value;
          if (res && Array.isArray(res.customers)) {
            setCustomers(res.customers);
          } else if (res && Array.isArray(res.data)) {
            setCustomers(res.data);
          } else if (Array.isArray(res)) {
            setCustomers(res);
          }
        }

        if (profileRes.status === "fulfilled" && profileRes.value?.dairy) {
          setDairy(profileRes.value.dairy);
        }
      } catch (err) {
        console.error("Failed to load map data:", err);
      } finally {
        setLoadingCustomers(false);
      }
    };
    loadCustomersAndProfile();
  }, []);

  return (
    <div className="ds-portal ds-admin-portal min-h-screen bg-[#FAFAF7] text-[#2C1A0E] dark:bg-[#0B0F19] dark:text-white" style={adminShellFont}>
      <AdminMobileTopbar adminName={adminName} onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-10 pb-32 sm:px-8 lg:ml-64 lg:px-12 xl:ml-80">

        {/* HEADER AREA */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl tracking-tight text-[#2C1A0E] dark:text-white" style={adminHeadingFont}>Intelligence & Performance</h1>
            <p className="text-sm font-medium text-[#8B7355] dark:text-slate-400">Real-time dairy throughput, client analytics, and partner efficiency scores.</p>
          </div>

          <div className="flex rounded-[20px] border border-[#E5D9C7] dark:border-slate-800 bg-[#FFFDF8] dark:bg-slate-900 p-1.5">
            {PERFORMANCE_DATE_RANGES.map((item) => (
              <button
                key={item.value}
                onClick={() => setDateRange(item.value)}
                className={`rounded-[14px] px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                  dateRange === item.value ? "bg-[#FDE9C9] text-[#B8641A] dark:bg-amber-600 dark:text-white shadow-sm" : "text-[#B89970] dark:text-slate-400 hover:text-[#8B7355] dark:hover:text-slate-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="mb-6 rounded-2xl border border-[#E5D9C7] dark:border-slate-800 bg-[#FFFDF8] dark:bg-slate-950 px-4 py-3 flex items-center gap-3">
            <Loader2 className="animate-spin text-[#B8641A]" size={18} />
            <p className="text-[11px] font-black uppercase tracking-widest text-[#8B7355] dark:text-slate-400">Refreshing metrics...</p>
          </div>
        )}

        {/* KPI GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Avg Efficiency', val: `${kpi.avgEfficiency.toFixed(1)}%`, icon: Target, col: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50' },
            { label: 'Total Deliveries', val: String(kpi.totalDeliveries), icon: Zap, col: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50' },
            { label: 'Success Rate', val: `${kpi.successRate.toFixed(1)}%`, icon: CheckCircle, col: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
            { label: 'Missed Hits', val: String(kpi.missed), icon: XCircle, col: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50' }
          ].map((item, i) => (
            <StatCard key={i} item={item} />
          ))}
        </div>

        {/* ========================================================
            SECTION 1: DAIRY PERFORMANCE ANALYTICS (TOP)
            ======================================================== */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2" style={adminHeadingFont}>
              <Activity size={22} className="text-[#B8641A]" /> Dairy Performance Analytics
            </h2>
            <p className="text-xs font-semibold text-slate-400">Fulfillment success, daily delivery rates, and overall dairy monthly revenue.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <DailyDeliveryVolumeCard data={dailyPerformanceTrend} />
            <MonthlyIncomeCard data={monthlyTrends} />
          </div>
        </div>

        {/* ========================================================
            SECTION 2: CUSTOMER ANALYTICS (DELIVERY & CHURN) (MIDDLE)
            ======================================================== */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2" style={adminHeadingFont}>
              <Users size={22} className="text-blue-500" /> Customer Analytics (Delivery & Churn)
            </h2>
            <p className="text-xs font-semibold text-slate-400">Total subscriber growth tracks, registration additions, and subscription churn analysis.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <SubscriptionTrendsCard data={monthlyTrends} />
            <ChurnAnalysisCard data={monthlyTrends} />
          </div>
        </div>

        {/* ========================================================
            SECTION 3: AGENT PERFORMANCE ANALYTICS (BOTTOM)
            ======================================================== */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2" style={adminHeadingFont}>
              <Target size={22} className="text-amber-500" /> Agent Performance & Monitoring
            </h2>
            <p className="text-xs font-semibold text-slate-400">Driver delivery completions, efficiency leaderboard, cluster analytics, and logistics failure reports.</p>
          </div>

          {/* Primary Agent Section: Delivery Volume & Leaderboard */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
            <DeliveryVolumeByAgentCard data={performanceData} />
            <TopAgentsCard data={topPerformers} />
          </div>

          {/* Supporting Agent Section: Efficiency Clusters, Operational factors, Failure reasons & Logs */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="space-y-8 flex-shrink-0">
              <EfficiencyClustersCard data={efficiencyStats} />
              <OperationalFactorsCard data={dairyFactors} />
            </div>

            <FailureReasonsAnalysisCard data={failureReasonData} />

            <RecentFailureLogsCard data={missedDeliveries} />
          </div>
        </div>

        {/* ========================================================
            SECTION 4: GEOGRAPHIC CUSTOMER DISTRIBUTION MAP
            ======================================================== */}
        <div className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2" style={adminHeadingFont}>
                <MapPin size={22} className="text-[#B8641A]" /> Customer Density & Logistics Map
              </h2>
              <p className="text-xs font-semibold text-slate-400">Geographic footprint of subscribers, delivery routes, and active subscription clusters.</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60 overflow-hidden">
            {loadingCustomers ? (
              <div className="h-[450px] flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-[#B8641A]" size={24} />
                <p className="text-xs font-semibold text-slate-400">Loading customer location data...</p>
              </div>
            ) : (
              <CustomerDistributionMap customers={customers} dairy={dairy} />
            )}
          </div>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

      </main>
      <AdminMobileBottomNav />
    </div>
  );
};

export default AdminPerformance;
