import React, { useEffect, useState } from "react";
import SuperAdminSidebar from "./SuperAdminSidebar.jsx";
import { fetchHealthApi, fetchLogsApi } from "../../api/superAdmin.api.js";
import toast from "react-hot-toast";
import {
  Activity,
  Cpu,
  Database,
  Terminal,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle,
  HardDrive
} from "lucide-react";

const SuperAdminMonitoring = () => {
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [healthResp, logsResp] = await Promise.all([
        fetchHealthApi(),
        fetchLogsApi(),
      ]);

      if (healthResp.success) setHealth(healthResp.health);
      if (logsResp.success) setLogs(logsResp.logs || []);
    } catch (err) {
      toast.error("Failed to refresh platform telemetry logs");
      console.error(err);
    }
  };

  useEffect(() => {
    const initLoad = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    initLoad();
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success("Telemetry and log streams refreshed!");
  };

  const getLogLevelColor = (level) => {
    switch (level) {
      case "ERROR": return "text-rose-400 font-bold";
      case "WARN": return "text-amber-400 font-bold";
      default: return "text-cyan-400";
    }
  };

  const filteredLogs = logs.filter(log => {
    if (logFilter === "ALL") return true;
    return log.level === logFilter;
  });

  if (loading) {
    return (
      <SuperAdminSidebar>
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mb-4"></div>
          <p className="text-slate-400 font-medium">Connecting to system telemetry feeds...</p>
        </div>
      </SuperAdminSidebar>
    );
  }

  return (
    <SuperAdminSidebar>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            System Telemetry & Monitoring
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Monitor API latencies, database locks, RAM utilization, and real-time security events.
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-xs font-semibold transition-all duration-200 cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          <span>Refresh Feeds</span>
        </button>
      </div>

      {health && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Server stats */}
          <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 space-y-4">
            <h3 className="font-extrabold text-slate-200 text-sm flex items-center gap-2">
              <Cpu size={16} className="text-cyan-400" />
              <span>Core Application Engine</span>
            </h3>
            
            <div className="space-y-3.5 text-xs text-slate-400">
              <div className="flex justify-between border-b border-slate-850/50 pb-2">
                <span>Server Status</span>
                <span className="font-bold text-emerald-400">{health.status}</span>
              </div>
              <div className="flex justify-between border-b border-slate-850/50 pb-2">
                <span>Process Uptime</span>
                <span className="font-medium text-slate-200 font-mono">
                  {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m {Math.floor(health.uptime % 60)}s
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-850/50 pb-2">
                <span>Database Response Delay</span>
                <span className="font-bold text-cyan-400 font-mono">{health.dbLatencyMs} ms</span>
              </div>
              <div className="flex justify-between pb-1">
                <span>OS Architecture</span>
                <span className="font-medium text-slate-200 font-mono">{health.os.platform} ({health.os.cpus} cores)</span>
              </div>
            </div>
          </div>

          {/* Ram sizes */}
          <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 space-y-4">
            <h3 className="font-extrabold text-slate-200 text-sm flex items-center gap-2">
              <HardDrive size={16} className="text-indigo-400" />
              <span>RAM Allocation (Process)</span>
            </h3>
            
            <div className="space-y-3.5 text-xs text-slate-400">
              <div className="flex justify-between border-b border-slate-850/50 pb-2">
                <span>RSS Memory Allocated</span>
                <span className="font-bold text-slate-200 font-mono">{health.memory.rss}</span>
              </div>
              <div className="flex justify-between border-b border-slate-850/50 pb-2">
                <span>Heap Memory Total</span>
                <span className="font-medium text-slate-200 font-mono">{health.memory.heapTotal}</span>
              </div>
              <div className="flex justify-between border-b border-slate-850/50 pb-2">
                <span>Heap Memory Used</span>
                <span className="font-bold text-indigo-400 font-mono">{health.memory.heapUsed}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span>Available System RAM</span>
                <span className="font-medium text-slate-200 font-mono">{health.os.freeMem} / {health.os.totalMem}</span>
              </div>
            </div>
          </div>

          {/* Services connectivity checks */}
          <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 space-y-4">
            <h3 className="font-extrabold text-slate-200 text-sm flex items-center gap-2">
              <Database size={16} className="text-purple-400" />
              <span>Integration Statuses</span>
            </h3>
            
            <div className="space-y-3.5 text-xs text-slate-400">
              {Object.keys(health.services).map((srv, idx) => (
                <div key={idx} className="flex justify-between border-b border-slate-850/50 pb-2 last:border-0 last:pb-0">
                  <span className="capitalize">{srv.replace(/([A-Z])/g, " $1")} Connection</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle size={12} />
                    <span>{health.services[srv]}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Real-time System Event Log Console */}
      <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-5 flex flex-col min-h-[400px]">
        
        {/* Console Header & Level Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h3 className="font-extrabold text-slate-200 text-sm flex items-center gap-2">
            <Terminal size={16} className="text-cyan-400" />
            <span>Real-time Log Consolidation Stream</span>
          </h3>

          <div className="flex gap-2">
            {["ALL", "INFO", "WARN", "ERROR"].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLogFilter(lvl)}
                className={`px-3 py-1 rounded-lg border text-[10px] font-bold font-mono tracking-wider transition-all duration-200 cursor-pointer ${
                  logFilter === lvl
                    ? "bg-slate-950 text-cyan-400 border-cyan-500/20"
                    : "border-slate-850 bg-slate-900/30 text-slate-500 hover:text-slate-350"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Streaming area */}
        <div className="flex-1 bg-slate-950 border border-slate-850 rounded-xl p-4 font-mono text-[11px] leading-normal text-slate-300 max-h-96 overflow-y-auto space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-20 text-slate-650">
              No telemetry events streaming matching filter.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-slate-900/60 pb-2">
                <span className="text-slate-500 select-none">
                  [{new Date(log.timestamp).toLocaleString("en-IN", { timeStyle: "medium" })}]
                </span>
                <span className={getLogLevelColor(log.level)}>[{log.level}]</span>
                <span className="text-slate-450 font-bold select-none">[{log.source}]</span>
                <span className="flex-1 text-slate-200">{log.message}</span>
                <span className="text-slate-600 select-none text-[10px]">IP: {log.ip}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </SuperAdminSidebar>
  );
};

export default SuperAdminMonitoring;
