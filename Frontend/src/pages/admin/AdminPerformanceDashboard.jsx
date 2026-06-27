import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ComposedChart, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Users, UserMinus, CheckCircle, XCircle, Zap, Target, Award, Loader2, UserCheck, Clock3, AlertCircle, DollarSign, Activity, MapPin } from 'lucide-react';
import {
  fetchAdminPerformance,
  fetchAdminMissedDeliveries,
  fetchAdminAgents,
  fetchAdminPerformanceMonthlyTrends,
  fetchAdminCustomers,
  fetchAdminProfile,
} from "../../api/admin.api";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Layout Components
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import AdminMobileBottomNav from "../../components/admin/layout/AdminMobileBottomNav";
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

const CustomerDistributionMap = ({ customers, dairy }) => {
  const dairyCoords = useMemo(() => {
    const lat = Number(dairy?.latitude || dairy?.lat);
    const lng = Number(dairy?.longitude || dairy?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 ? [lat, lng] : null;
  }, [dairy]);

  const mapCenter = useMemo(() => {
    if (dairyCoords) return dairyCoords;
    const valid = customers.find(c => {
      const lat = Number(c?.latitude);
      const lng = Number(c?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    });
    if (valid) {
      return [Number(valid.latitude), Number(valid.longitude)];
    }
    return [18.5204, 73.8567]; // Pune default center
  }, [customers, dairyCoords]);

  const getCoordinates = (customer, index) => {
    const lat = Number(customer?.latitude);
    const lng = Number(customer?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      return [lat, lng];
    }
    // Deterministic circular offsets around Pune default center
    const baseLat = 18.5204;
    const baseLng = 73.8567;
    const seed = customer?.id 
      ? String(customer.id).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : index;
    const angle = (seed * 17) % 360;
    const radius = 0.01 + ((seed * 11) % 4) * 0.01;
    const radians = (angle * Math.PI) / 180;
    return [baseLat + Math.sin(radians) * radius, baseLng + Math.cos(radians) * radius];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-full bg-[#EF4444] border-2 border-white shadow-sm"></span> Dairy Source
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 border border-dashed border-[#EF4444] rounded-full bg-[#EF4444]/10"></span> Delivery Radius ({dairy?.service_radius || 10}km)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#10B981]"></span> Active Subscriptions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#F59E0B]"></span> Pending Approval
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#9CA3AF]"></span> Inactive/Closed
          </span>
        </div>
        <div className="text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
          Total Mapped Customers: {customers.length}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800/80">
        <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="h-[450px] w-full z-0">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Render Dairy Source Marker */}
          {dairyCoords && (
            <>
              <Marker
                position={dairyCoords}
                icon={L.divIcon({
                  className: "custom-div-icon",
                  html: '<div style="background-color: #EF4444; width: 20px; height: 20px; border-radius: 999px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                })}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-[#2C1A0E]">
                    <p className="text-xs font-black m-0 leading-tight">{dairy?.dairy_name || "Our Dairy"}</p>
                    <p className="text-[10px] text-slate-500 m-0">{dairy?.address || "Source Facility"}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-widest mt-1">
                      Dairy Source
                    </span>
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={dairyCoords}
                radius={Number(dairy?.service_radius || 10) * 1000}
                pathOptions={{
                  color: "#EF4444",
                  fillColor: "#EF4444",
                  fillOpacity: 0.05,
                  weight: 2,
                  dashArray: "5, 10",
                }}
              />
            </>
          )}

          {/* Render Customer Markers */}
          {customers.map((c, i) => {
            const coords = getCoordinates(c, i);
            const isActive = c.subscriptionStatus === "ACTIVE" && c.subscriptionApprovalStatus === "APPROVED";
            const isPending = c.subscriptionApprovalStatus === "PENDING" || c.hasPendingSubscriptionApproval;
            const markerColor = isActive ? "#10B981" : isPending ? "#F59E0B" : "#9CA3AF";
            const building = c.building_name || c.buildingName || "Unknown Building";
            const room = c.room_no || c.roomNo || "";
            const wingStr = c.wing ? `, Wing ${c.wing}` : "";

            return (
              <Marker
                key={c.id || i}
                position={coords}
                icon={L.divIcon({
                  className: "custom-div-icon",
                  html: `<div style="background-color: ${markerColor}; width: 16px; height: 16px; border-radius: 999px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25);"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8],
                })}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-[#2C1A0E]">
                    <p className="text-xs font-black m-0 leading-tight">{c.customer_name || c.customerName || "Customer"}</p>
                    <p className="text-[10px] font-bold text-slate-500 m-0">{c.phone_number || c.phone || "No phone"}</p>
                    <p className="text-[10px] text-slate-500 m-0 leading-snug">
                      {building}{wingStr}{room ? `, Apt ${room}` : ""}
                    </p>
                    <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                      <span className="text-slate-400">Status:</span>
                      <span style={{ color: markerColor }}>
                        {isActive ? "Active" : isPending ? "Pending" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
          <div className="absolute bottom-[18px] right-[55px] z-[1000] bg-white/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-[#8B7355] pointer-events-none select-none rounded border border-[#EDE8DF]/40">
      DairyVision Maps
    </div>
      </div>
    </div>
  );
};

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

  const getDateRange = (range) => {
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
            {[
              { value: '7days', label: '7 Days' },
              { value: 'monthly', label: 'Monthly' },
              { value: '6months', label: '6 Months' },
              { value: 'yearly', label: 'Yearly' }
            ].map((item) => (
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
            <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 ${item.bg} ${item.col} rounded-xl flex items-center justify-center`}>
                  <item.icon size={20} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{item.val}</h3>
            </div>
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
            {/* Card A: Daily Delivery Volume & Trend */}
            <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-6 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-500" /> Daily Delivery Volumes
              </h3>
              <div className="h-[320px]">
                {dailyPerformanceTrend.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                    No trend data available for this range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyPerformanceTrend}>
                      <defs>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1E293B', color: '#FFF' }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" name="Successful" />
                      <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorFailed)" name="Failed" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            
            {/* Card B: Monthly Income Trend */}
            <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-6 uppercase tracking-wider flex items-center gap-2">
                <DollarSign size={16} className="text-[#B8641A]" /> Monthly Income & Revenue
              </h3>
              <div className="h-[320px]">
                {monthlyTrends.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                    No revenue data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrends}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#B8641A" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#B8641A" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
                      <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                      <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Income']} contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1E293B', color: '#FFF' }} />
                      <Bar dataKey="income" fill="url(#colorIncome)" radius={[8, 8, 0, 0]} name="Income (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
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
            {/* Card A: Customer Growth & Active Subscriptions */}
            <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-6 uppercase tracking-wider flex items-center gap-2">
                <Activity size={16} className="text-blue-500" /> Subscription Trends
              </h3>
              <div className="h-[320px]">
                {monthlyTrends.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                    No subscription data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
                      <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1E293B', color: '#FFF' }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Line type="monotone" dataKey="totalCustomers" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} name="Total Subscriptions" />
                      <Line type="monotone" dataKey="activeCustomers" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Active Subscriptions" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Card B: Customer Churn Analysis */}
            <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-6 uppercase tracking-wider flex items-center gap-2">
                <UserMinus size={16} className="text-rose-500" /> Customer Churn & Onboarding
              </h3>
              <div className="h-[320px]">
                {monthlyTrends.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                    No churn data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
                      <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#EC4899', fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1E293B', color: '#FFF' }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar yAxisId="left" dataKey="newCustomers" fill="#10B981" radius={[4, 4, 0, 0]} name="New Subscriptions" />
                      <Bar yAxisId="left" dataKey="churnedCustomers" fill="#EF4444" radius={[4, 4, 0, 0]} name="Closed/Churned" />
                      <Line yAxisId="right" type="monotone" dataKey="churnRate" stroke="#EC4899" strokeWidth={3} dot={{ r: 4 }} name="Churn Rate (%)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
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
            <div className="xl:col-span-2 bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-6 uppercase tracking-wider flex items-center gap-2">
                <Users size={18} className="text-blue-500" /> Delivery Volume by Agent
              </h3>
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
                    <XAxis dataKey="agent" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                    <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1E293B', color: '#FFF' }} />
                    <Bar dataKey="completed" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Successful" />
                    <Bar dataKey="failed" fill="#FDA4AF" radius={[6, 6, 0, 0]} name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-5 uppercase tracking-wider flex items-center gap-2">
                <Award size={18} className="text-amber-500" /> Top Agents
              </h3>
              <div className="space-y-3">
                {topPerformers.length === 0 && (
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm text-slate-500">
                    No performance data.
                  </div>
                )}
                {topPerformers.map((agent, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xs">
                        #{i + 1}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-white text-sm leading-tight">{agent.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{agent.count} Completed</p>
                      </div>
                    </div>
                    <p className="text-lg font-black text-blue-600 dark:text-blue-400">{agent.score}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Supporting Agent Section: Efficiency Clusters, Operational factors, Failure reasons & Logs */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="space-y-8 flex-shrink-0">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60 flex flex-col h-[200px]">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wider flex items-center gap-2 flex-shrink-0">
                  <TrendingUp size={18} className="text-emerald-500" /> Efficiency Clusters
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={efficiencyStats} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={6} dataKey="value">
                        {efficiencyStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={20} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60 flex flex-col justify-between h-[280px]">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wider">Operational Factors</h3>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  {[
                    { label: 'Active Agents', val: String(dairyFactors.activeAgents), icon: UserCheck, col: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
                    { label: 'Pending', val: String(dairyFactors.pending), icon: Clock3, col: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
                    { label: 'Idle Agents', val: String(dairyFactors.idleAgents), icon: Users, col: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
                    { label: 'Avg Load', val: dairyFactors.avgLoadPerAgent.toFixed(1), icon: Zap, col: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
                  ].map((factor, i) => (
                    <div key={i} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5">
                      <div className={`h-8 w-8 ${factor.bg} ${factor.col} rounded-lg flex items-center justify-center mb-1.5`}>
                        <factor.icon size={16} />
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{factor.label}</p>
                      <p className="text-base font-black text-slate-800 dark:text-white leading-none mt-1">{factor.val}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Top Failure Reasons</p>
                  <div className="space-y-1">
                    {dairyFactors.topFailureReasons.length === 0 && (
                      <p className="text-xs font-semibold text-slate-500">No failed deliveries in this range.</p>
                    )}
                    {dairyFactors.topFailureReasons.slice(0, 2).map(([reason, count]) => (
                      <div key={reason} className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span className="truncate max-w-[120px]">{String(reason).replaceAll('_', ' ')}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Failure reasons pie chart */}
            <div className="bg-white dark:bg-slate-900 p-7 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60 flex flex-col h-[512px] flex-shrink-0">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-5 uppercase tracking-wider flex items-center gap-2 flex-shrink-0">
                <AlertCircle size={18} className="text-rose-500" /> Failure Reasons Analysis
              </h3>
              {failureReasonData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
                  No failed deliveries recorded in this range.
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={failureReasonData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={6} dataKey="value">
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

            {/* Recent Failure Logs */}
            <div className="bg-white dark:bg-slate-900 rounded-[36px] shadow-sm border border-slate-100 dark:border-slate-800/60 overflow-hidden flex flex-col h-[512px] flex-shrink-0">
              <div className="px-7 py-5 border-b border-slate-50 dark:border-slate-800 flex-shrink-0">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Recent Failure Logs</h3>
              </div>
              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">
                <table className="w-full text-left table-fixed">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-400 text-[9px] font-black uppercase tracking-widest sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-3 w-[50%]">Agent / Customer</th>
                      <th className="px-3 py-3 text-center w-[28%]">Reason</th>
                      <th className="px-3 py-3 text-right w-[22%]">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {missedDeliveries.length === 0 && (
                      <tr>
                        <td className="px-3 py-5 text-sm font-bold text-slate-500" colSpan={3}>
                          No failed deliveries for this period.
                        </td>
                      </tr>
                    )}
                    {missedDeliveries.map((item, i) => (
                      <tr key={i} className="hover:bg-blue-50/20 dark:hover:bg-slate-800/20 transition-all">
                        <td className="px-3 py-3.5 align-middle">
                          <div className="font-black text-slate-800 dark:text-slate-200 text-[11px] leading-snug truncate" title={item.agent}>{item.agent}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate" title={item.customer}>To: {item.customer}</div>
                        </td>
                        <td className="px-2 py-3.5 text-center align-middle">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 uppercase tracking-widest">
                            {item.reason.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 align-middle whitespace-nowrap">{item.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
