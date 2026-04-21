import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Home, List, History, Map, Package, User } from "lucide-react";
import { fetchAssignedAgentDeliveries, flushAgentOfflineQueue } from "../../api/agent/agent.api";
import {
  getCachedAssignedAgentDeliveries,
  getPendingAgentSyncCount,
  subscribeToAgentOfflineState,
} from "../../api/agent/offlineSync";
import { buildBuildingTaskGroups } from "../../utils/agentTaskGrouping";

const headingFont = { fontFamily: "'Lora', serif" };

const NavTab = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex min-w-[64px] flex-col items-center gap-1 rounded-[18px] px-2 py-2 transition ${
      active ? "text-[#B8641A]" : "text-[#8B7355]"
    }`}
  >
    {icon}
    <span className="text-[8px] font-black uppercase tracking-[0.16em]">{label}</span>
    {active && <div className="h-1 w-1 rounded-full bg-[#B8641A]" />}
  </button>
);

const BuildingTaskCard = ({ group, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="w-full rounded-[22px] border border-[#EDE8DF] bg-white p-3 text-left shadow-[0_12px_28px_rgba(92,61,30,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(92,61,30,0.1)]"
  >
    <div className="flex items-start justify-between gap-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A88763]">Building Task</p>
        <h3 className="mt-1.5 text-lg font-black leading-tight text-[#2C1A0E]">{group.buildingName}</h3>
        <p className="mt-0.5 text-[13px] font-semibold text-[#6B5B3E]">
          {group.deliveries.length} {group.deliveries.length === 1 ? "delivery" : "deliveries"}
        </p>
      </div>
      <div className="rounded-[14px] border border-[#DDE8D1] bg-[#EEF5E7] px-2.5 py-1.5 text-right">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6B8A4A]">Drops</p>
        <p className="mt-0.5 text-base font-black text-[#2C1A0E]">{group.deliveries.length}</p>
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between rounded-[16px] border border-[#E7DAC6] bg-[#FFF8EF] px-3 py-2">
      <p className="text-[13px] font-semibold text-[#6B5B3E]">
        {group.deliveries.length} {group.deliveries.length === 1 ? "delivery" : "deliveries"}
      </p>
      <ChevronRight size={18} className="shrink-0 text-[#B8641A]" />
    </div>
  </button>
);

const AgentWorkingPage = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState(() => getCachedAssignedAgentDeliveries({ today: true }));
  const [filter, setFilter] = useState("ALL");
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingAgentSyncCount());

  useEffect(() => {
    const loadDeliveries = async () => {
      try {
        const payload = await fetchAssignedAgentDeliveries({ today: true });
        setDeliveries(payload || []);
      } catch (_err) {
        setDeliveries([]);
      }
    };
    loadDeliveries();
  }, []);

  useEffect(() => {
    const reload = async () => {
      setIsOnline(true);
      await flushAgentOfflineQueue();
      setPendingSyncCount(getPendingAgentSyncCount());
      try {
        const payload = await fetchAssignedAgentDeliveries({ today: true });
        setDeliveries(payload || []);
      } catch (_err) {}
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingSyncCount(getPendingAgentSyncCount());
    };

    const unsubscribe = subscribeToAgentOfflineState(() => {
      setPendingSyncCount(getPendingAgentSyncCount());
      setDeliveries(getCachedAssignedAgentDeliveries({ today: true }));
    });

    window.addEventListener("online", reload);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", reload);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const filteredDeliveries = useMemo(
    () =>
      deliveries.filter((delivery) => {
        if (filter === "ALL") return true;
        if (filter === "PENDING") {
          return ["PENDING", "OUT_FOR_DELIVERY"].includes(String(delivery?.status || "").toUpperCase());
        }
        return String(delivery?.status || "").toUpperCase() === filter;
      }),
    [deliveries, filter]
  );

  const groupedTasks = useMemo(
    () => buildBuildingTaskGroups(filteredDeliveries),
    [filteredDeliveries]
  );

  const stats = {
    all: deliveries.length,
    completed: deliveries.filter((d) => d.status === "COMPLETED").length,
    pending: deliveries.filter((d) => ["PENDING", "OUT_FOR_DELIVERY"].includes(String(d?.status || "").toUpperCase())).length,
    failed: deliveries.filter((d) => d.status === "FAILED").length,
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-4 pb-32 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-5">
        <section className="-mb-3 -mt-1 rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] px-5 py-4 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Task Queue</p>
          <h1 className="mt-2 text-[28px] font-black leading-none text-[#2C1A0E]" style={headingFont}>
            Building Tasks
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#6B5B3E]">
            Open a building to see flats and customers floor by floor
          </p>
        </section>

        {!isOnline || pendingSyncCount > 0 ? (
          <div className="rounded-[22px] border border-[#E7DAC6] bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#8B5E34] shadow-sm">
            {!isOnline
              ? `Offline mode${pendingSyncCount > 0 ? ` • ${pendingSyncCount} updates waiting` : ""}`
              : `${pendingSyncCount} updates waiting to sync`}
          </div>
        ) : null}

        <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar">
          {[
            { key: "ALL", label: "All", count: stats.all },
            { key: "PENDING", label: "Pending", count: stats.pending },
            { key: "COMPLETED", label: "Done", count: stats.completed },
            { key: "FAILED", label: "Failed", count: stats.failed },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex whitespace-nowrap items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                filter === tab.key
                  ? "border-[#B8641A] bg-[#B8641A] text-white shadow-lg shadow-[#F2D9B8]"
                  : "border-[#E7DAC6] bg-white text-[#8B7355]"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] ${
                  filter === tab.key ? "bg-white/20 text-white" : "bg-[#F8F1E7] text-[#A88763]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {groupedTasks.length === 0 ? (
            <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-12 text-center shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
              <Package className="mx-auto mb-3 text-[#D4B896]" size={40} />
              <p className="text-sm font-bold text-[#A88763]">No building tasks found</p>
            </div>
          ) : (
            groupedTasks.map((group) => (
              <BuildingTaskCard
                key={group.buildingName}
                group={group}
                onOpen={() =>
                  navigate(`/agent/working/building/${encodeURIComponent(group.buildingName)}`)
                }
              />
            ))
          )}
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 z-50 flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab
          icon={<Map size={18} />}
          label="Map"
          onClick={() => navigate("/agent/dashboard", { state: { section: "MAP" } })}
        />
        <NavTab icon={<List size={18} />} label="Tasks" active onClick={() => navigate("/agent/working")} />
        <NavTab icon={<History size={18} />} label="History" onClick={() => navigate("/agent/history")} />
        <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
      </div>
    </div>
  );
};

export default AgentWorkingPage;
