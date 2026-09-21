import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Home,
  List,
  History,
  Map as MapIcon,
  Package,
  User,
  CheckCircle2,
  Navigation,
} from "lucide-react";
import { fetchAssignedAgentDeliveries, flushAgentOfflineQueue } from "../../api/agent/agent.api";
import {
  getCachedAssignedAgentDeliveries,
  getCachedAgentLocation,
  getPendingAgentSyncCount,
  subscribeToAgentOfflineState,
} from "../../api/agent/offlineSync";
import {
  buildBuildingTaskGroups,
  separateBuildingTaskGroups,
} from "../../utils/agentTaskGrouping";
import {
  fetchRoadDistanceTable,
  formatDistanceLabel,
  getDistanceInMeters,
} from "../../utils/agentRouting";

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

const BuildingTaskCard = ({ group, distanceLabel, isCompleted, onOpen }) => {
  if (isCompleted) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-[22px] border border-[#E5E0D8] bg-[#F8F6F2] px-3.5 py-3 text-left opacity-85 shadow-[0_6px_16px_rgba(92,61,30,0.04)] transition hover:opacity-100 hover:shadow-[0_10px_22px_rgba(92,61,30,0.07)]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE8D1] bg-[#EEF5E7] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#4A7C2F]">
                <CheckCircle2 size={11} />
                Completed
              </span>
            </div>
            <h3 className="mt-1.5 text-base font-black leading-tight text-[#5C4D3E]">{group.buildingName}</h3>
            <p className="mt-0.5 text-[12px] font-semibold text-[#8B7D6B]">
              {group.deliveries.length} {group.deliveries.length === 1 ? "delivery" : "deliveries"} processed
            </p>
          </div>
          <div className="rounded-[14px] border border-[#E5E0D8] bg-white px-2 py-1 text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8B7D6B]">Done</p>
            <p className="mt-0 text-sm font-black leading-none text-[#4A7C2F]">{group.completedCount || group.deliveries.length}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-[14px] border border-[#E5E0D8] bg-white/70 px-2.5 py-1.5">
          <p className="text-[12px] font-medium text-[#7D7060]">View completed record</p>
          <ChevronRight size={16} className="shrink-0 text-[#A89886]" />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[22px] border border-[#EDE8DF] bg-white px-3.5 py-3 text-left shadow-[0_12px_28px_rgba(92,61,30,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(92,61,30,0.1)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A88763]">Building Task</p>
            {distanceLabel && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#F0D9B9] bg-[#FFF4E2] px-2 py-0.5 text-[9px] font-bold text-[#B8641A]">
                <Navigation size={10} />
                {distanceLabel}
              </span>
            )}
          </div>
          <h3 className="mt-1 text-lg font-black leading-tight text-[#2C1A0E]">{group.buildingName}</h3>
          <p className="mt-0.5 text-[13px] font-semibold leading-tight text-[#6B5B3E]">
            {group.pendingCount || group.activeDeliveries?.length || group.deliveries.length} pending drop
            {(group.pendingCount || group.activeDeliveries?.length || group.deliveries.length) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-[14px] border border-[#DDE8D1] bg-[#EEF5E7] px-2.5 py-1.5 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6B8A4A]">Drops</p>
          <p className="mt-0 text-base font-black leading-none text-[#2C1A0E]">
            {group.pendingCount || group.activeDeliveries?.length || group.deliveries.length}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between rounded-[16px] border border-[#E7DAC6] bg-[#FFF8EF] px-2.5 py-1.5">
        <p className="text-[13px] font-semibold leading-tight text-[#6B5B3E]">
          {group.deliveries.length} total {group.deliveries.length === 1 ? "delivery" : "deliveries"}
        </p>
        <ChevronRight size={18} className="shrink-0 text-[#B8641A]" />
      </div>
      {group.paymentDueCount > 0 ? (
        <div className="mt-2 rounded-[14px] border border-[#F0D9B9] bg-[#FFF4E2] px-2.5 py-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#B8641A]">Payment to Collect</p>
          <p className="mt-0.5 text-[12px] font-semibold leading-tight text-[#8B5E34]">
            {group.paymentDueAmount > 0
              ? `Rs ${group.paymentDueAmount.toFixed(2)} from ${group.paymentDueCount} task${
                  group.paymentDueCount === 1 ? "" : "s"
                }`
              : `Pending collection in ${group.paymentDueCount} task${
                  group.paymentDueCount === 1 ? "" : "s"
                }`}
          </p>
        </div>
      ) : null}
    </button>
  );
};

const AgentWorkingPage = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState(() => getCachedAssignedAgentDeliveries({ today: true }));
  const [filter, setFilter] = useState("ALL");
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingAgentSyncCount());

  const [agentLocation, setAgentLocation] = useState(() => {
    const cached = getCachedAgentLocation();
    return cached && Number.isFinite(cached.lat) && Number.isFinite(cached.lng)
      ? [cached.lat, cached.lng]
      : null;
  });
  const [buildingRoadDistanceMap, setBuildingRoadDistanceMap] = useState({});

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAgentLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    const loadDeliveries = async () => {
      try {
        const payload = await fetchAssignedAgentDeliveries({ today: true });
        setDeliveries(payload || []);
      } catch {
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
      } catch {
        /* ignore */
      }
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

  const allBuildingGroups = useMemo(
    () => buildBuildingTaskGroups(deliveries),
    [deliveries]
  );

  const { active: activeGroups, completed: completedGroups } = useMemo(
    () => separateBuildingTaskGroups(allBuildingGroups),
    [allBuildingGroups]
  );

  const activeBuildingsWithCoords = useMemo(
    () => activeGroups.filter((b) => Array.isArray(b.coordinates)),
    [activeGroups]
  );

  const roadOrigin = useMemo(
    () =>
      Array.isArray(agentLocation)
        ? [Number(agentLocation[0].toFixed(4)), Number(agentLocation[1].toFixed(4))]
        : null,
    [agentLocation]
  );

  const activeBuildingsCoordsKey = useMemo(
    () =>
      activeBuildingsWithCoords
        .map((b) => `${b.buildingName}:${b.coordinates[0]?.toFixed?.(4)}:${b.coordinates[1]?.toFixed?.(4)}`)
        .join("|"),
    [activeBuildingsWithCoords]
  );

  useEffect(() => {
    if (!roadOrigin || activeBuildingsWithCoords.length === 0) {
      setBuildingRoadDistanceMap({});
      return undefined;
    }

    const controller = new AbortController();
    const destinations = activeBuildingsWithCoords.map((b) => ({
      id: b.buildingName,
      coordinates: b.coordinates,
    }));

    fetchRoadDistanceTable(roadOrigin, destinations, controller.signal)
      .then((distMap) => {
        setBuildingRoadDistanceMap(distMap || {});
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        // Gracefully fall back to straight-line
      });

    return () => controller.abort();
  }, [activeBuildingsCoordsKey, roadOrigin]);

  const orderedActiveBuildings = useMemo(() => {
    if (activeGroups.length === 0) return [];
    return [...activeGroups].sort((a, b) => {
      const distA =
        buildingRoadDistanceMap[a.buildingName] ??
        (agentLocation && a.coordinates ? getDistanceInMeters(agentLocation, a.coordinates) : null);
      const distB =
        buildingRoadDistanceMap[b.buildingName] ??
        (agentLocation && b.coordinates ? getDistanceInMeters(agentLocation, b.coordinates) : null);

      if (Number.isFinite(distA) && Number.isFinite(distB) && distA !== distB) {
        return distA - distB;
      }
      if (Number.isFinite(distA)) return -1;
      if (Number.isFinite(distB)) return 1;
      return a.buildingName.localeCompare(b.buildingName);
    });
  }, [activeGroups, agentLocation, buildingRoadDistanceMap]);

  const getBuildingDistanceLabel = (building) => {
    const dist =
      buildingRoadDistanceMap[building.buildingName] ??
      (agentLocation && building.coordinates ? getDistanceInMeters(agentLocation, building.coordinates) : null);
    return Number.isFinite(dist) ? formatDistanceLabel(dist) : null;
  };

  const failedGroups = useMemo(
    () =>
      allBuildingGroups.filter((g) =>
        g.deliveries.some((d) => String(d?.status || "").toUpperCase() === "FAILED")
      ),
    [allBuildingGroups]
  );

  const stats = {
    all: deliveries.length,
    completed: deliveries.filter((d) => d.status === "COMPLETED").length,
    pending: deliveries.filter((d) =>
      ["PENDING", "OUT_FOR_DELIVERY"].includes(String(d?.status || "").toUpperCase())
    ).length,
    failed: deliveries.filter((d) => d.status === "FAILED").length,
  };

  return (
    <div className="agent-safe-top min-h-screen bg-[#FFFDF7] px-4 pb-32 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-5">
        <section className="rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF3E8_100%)] px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Task Queue</p>
          <h1 className="mt-1 text-[26px] font-black leading-none text-[#2C1A0E]" style={headingFont}>
            Building Tasks
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#6B5B3E]">
            Ordered by distance • Open a building to view flats and customers
          </p>
        </section>

        {!isOnline || pendingSyncCount > 0 ? (
          <div className="rounded-[22px] border border-[#E7DAC6] bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#8B5E34] shadow-sm">
            {!isOnline
              ? `Offline mode${pendingSyncCount > 0 ? ` • ${pendingSyncCount} updates waiting` : ""}`
              : `${pendingSyncCount} updates waiting to sync`}
          </div>
        ) : null}

        <div className="grid grid-cols-4 gap-1.5 py-1">
          {[
            { key: "ALL", label: "All", count: stats.all },
            { key: "PENDING", label: "Pending", count: stats.pending },
            { key: "COMPLETED", label: "Done", count: stats.completed },
            { key: "FAILED", label: "Failed", count: stats.failed },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex min-w-0 items-center justify-center gap-1 rounded-full border px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition ${
                filter === tab.key
                  ? "border-[#B8641A] bg-[#B8641A] text-white shadow-lg shadow-[#F2D9B8]"
                  : "border-[#E7DAC6] bg-white text-[#8B7355]"
              }`}
            >
              <span className="truncate">{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[8px] ${
                  filter === tab.key ? "bg-white/20 text-white" : "bg-[#F8F1E7] text-[#A88763]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filter === "ALL" && (
            <>
              {orderedActiveBuildings.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#A88763]">
                      Active Buildings ({orderedActiveBuildings.length})
                    </h2>
                    <span className="text-[10px] font-bold text-[#8B7355]">Nearest first</span>
                  </div>
                  {orderedActiveBuildings.map((group) => (
                    <BuildingTaskCard
                      key={group.buildingName}
                      group={group}
                      distanceLabel={getBuildingDistanceLabel(group)}
                      isCompleted={false}
                      onOpen={() =>
                        navigate(`/agent/working/building/${encodeURIComponent(group.buildingName)}`)
                      }
                    />
                  ))}
                </div>
              )}

              {completedGroups.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8B7D6B]">
                      Completed Buildings ({completedGroups.length})
                    </h2>
                    <span className="text-[10px] font-bold text-[#4A7C2F]">✓ Finished</span>
                  </div>
                  {completedGroups.map((group) => (
                    <BuildingTaskCard
                      key={group.buildingName}
                      group={group}
                      isCompleted={true}
                      onOpen={() =>
                        navigate(`/agent/working/building/${encodeURIComponent(group.buildingName)}`)
                      }
                    />
                  ))}
                </div>
              )}

              {orderedActiveBuildings.length === 0 && completedGroups.length === 0 && (
                <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-12 text-center shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
                  <Package className="mx-auto mb-3 text-[#D4B896]" size={40} />
                  <p className="text-sm font-bold text-[#A88763]">No building tasks found</p>
                </div>
              )}
            </>
          )}

          {filter === "PENDING" && (
            <div className="space-y-3">
              {orderedActiveBuildings.length === 0 ? (
                <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-12 text-center shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
                  <CheckCircle2 className="mx-auto mb-3 text-[#4A7C2F]" size={40} />
                  <p className="text-sm font-bold text-[#4A7C2F]">All buildings completed!</p>
                  <p className="mt-1 text-xs text-[#8B7355]">No pending delivery tasks remain.</p>
                </div>
              ) : (
                orderedActiveBuildings.map((group) => (
                  <BuildingTaskCard
                    key={group.buildingName}
                    group={group}
                    distanceLabel={getBuildingDistanceLabel(group)}
                    isCompleted={false}
                    onOpen={() =>
                      navigate(`/agent/working/building/${encodeURIComponent(group.buildingName)}`)
                    }
                  />
                ))
              )}
            </div>
          )}

          {filter === "COMPLETED" && (
            <div className="space-y-3">
              {completedGroups.length === 0 ? (
                <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-12 text-center shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
                  <Package className="mx-auto mb-3 text-[#D4B896]" size={40} />
                  <p className="text-sm font-bold text-[#A88763]">No completed buildings yet</p>
                </div>
              ) : (
                completedGroups.map((group) => (
                  <BuildingTaskCard
                    key={group.buildingName}
                    group={group}
                    isCompleted={true}
                    onOpen={() =>
                      navigate(`/agent/working/building/${encodeURIComponent(group.buildingName)}`)
                    }
                  />
                ))
              )}
            </div>
          )}

          {filter === "FAILED" && (
            <div className="space-y-3">
              {failedGroups.length === 0 ? (
                <div className="rounded-[28px] border border-[#EDE8DF] bg-white p-12 text-center shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
                  <Package className="mx-auto mb-3 text-[#D4B896]" size={40} />
                  <p className="text-sm font-bold text-[#A88763]">No failed delivery tasks</p>
                </div>
              ) : (
                failedGroups.map((group) => (
                  <BuildingTaskCard
                    key={group.buildingName}
                    group={group}
                    isCompleted={group.isCompleted}
                    onOpen={() =>
                      navigate(`/agent/working/building/${encodeURIComponent(group.buildingName)}`)
                    }
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 z-50 flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
        <NavTab icon={<Home size={18} />} label="Home" onClick={() => navigate("/agent/dashboard")} />
        <NavTab
          icon={<MapIcon size={18} />}
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

