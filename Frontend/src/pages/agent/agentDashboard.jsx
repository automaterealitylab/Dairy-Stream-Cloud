import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Navigation,
  Map as MapIcon,
  Home,
  List,
  User,
  History,
  LocateFixed,
  LogOut,
  Truck,
} from "lucide-react";

import {
  fetchAssignedAgentDeliveries,
  fetchAgentProfile,
  flushAgentOfflineQueue,
} from "../../api/agent/agent.api";
import {
  getCachedAgentLocation,
  getCachedAssignedAgentDeliveries,
  getPendingAgentSyncCount,
  storeAgentLocation,
  subscribeToAgentOfflineState,
} from "../../api/agent/offlineSync";
import { startDelivery, updateAgentLocation } from "../../api/agent/location.js";

const headingFont = { fontFamily: "'Lora', serif" };
const DELIVERY_RUN_STORAGE_KEY = "agent-dashboard-delivery-run";
const SLOT_META = {
  MORNING: {
    label: "Morning",
    startHour: 6,
    startMinute: 0,
    endHour: 9,
    endMinute: 0,
  },
  EVENING: {
    label: "Evening",
    startHour: 17,
    startMinute: 0,
    endHour: 20,
    endMinute: 0,
  },
};

const DefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapController = ({ center, zoom, trigger }) => {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    map.flyTo(center, zoom || 15, {
      animate: true,
      duration: 1.2,
    });
  }, [center, zoom, trigger, map]);

  return null;
};

const MapBoundsController = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(points) || points.length < 2) return;
    map.fitBounds(points, { padding: [32, 32] });
  }, [map, points]);

  return null;
};

const ROAD_ROUTE_PRECISION = 5;
const roadRouteCache = new Map();

const buildRouteCacheKey = (agentCoordinates, customerCoordinates) => {
  if (!Array.isArray(agentCoordinates) || !Array.isArray(customerCoordinates)) return null;

  return [
    agentCoordinates[0].toFixed(ROAD_ROUTE_PRECISION),
    agentCoordinates[1].toFixed(ROAD_ROUTE_PRECISION),
    customerCoordinates[0].toFixed(ROAD_ROUTE_PRECISION),
    customerCoordinates[1].toFixed(ROAD_ROUTE_PRECISION),
  ].join(":");
};

const fetchRoadRoute = async (agentCoordinates, customerCoordinates, signal) => {
  if (!Array.isArray(agentCoordinates) || !Array.isArray(customerCoordinates)) {
    return [];
  }

  const cacheKey = buildRouteCacheKey(agentCoordinates, customerCoordinates);
  if (cacheKey && roadRouteCache.has(cacheKey)) {
    return roadRouteCache.get(cacheKey);
  }

  const [agentLat, agentLng] = agentCoordinates;
  const [customerLat, customerLng] = customerCoordinates;
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${agentLng},${agentLat};${customerLng},${customerLat}` +
    `?overview=full&geometries=geojson`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Road route request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const geometry = payload?.routes?.[0]?.geometry?.coordinates;
  const routePoints = Array.isArray(geometry)
    ? geometry
        .map((point) => {
          const lng = Number(point?.[0]);
          const lat = Number(point?.[1]);
          return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
        })
        .filter(Boolean)
    : [];

  if (cacheKey) {
    roadRouteCache.set(cacheKey, routePoints);
  }

  return routePoints;
};

const getDeliveryCoordinates = (delivery) => {
  const lat = Number(
    delivery?.lat ??
      delivery?.latitude ??
      delivery?.customerLat ??
      delivery?.customerLatitude ??
      delivery?.location?.lat ??
      delivery?.location?.latitude
  );
  const lng = Number(
    delivery?.lng ??
      delivery?.longitude ??
      delivery?.customerLng ??
      delivery?.customerLongitude ??
      delivery?.location?.lng ??
      delivery?.location?.longitude
  );

  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

const getDistanceInMeters = (from, to) => {
  if (!from || !to) return null;

  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getAutoZoomLevel = (distanceInMeters) => {
  if (!Number.isFinite(distanceInMeters)) return 15;
  if (distanceInMeters <= 75) return 18;
  if (distanceInMeters <= 150) return 18;
  if (distanceInMeters <= 300) return 17;
  if (distanceInMeters <= 700) return 16;
  if (distanceInMeters <= 1500) return 15;
  return 14;
};

const getLocalDateKey = (value = new Date()) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getSlotSortOrder = (slotKey = "") => {
  if (slotKey === "MORNING") return 1;
  if (slotKey === "EVENING") return 2;
  return 3;
};

const compareScheduledDeliveries = (left, right) => {
  const leftDate = String(left?.date || "");
  const rightDate = String(right?.date || "");

  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  const leftSlot = getSlotSortOrder(String(left?.slotKey || "").toUpperCase());
  const rightSlot = getSlotSortOrder(String(right?.slotKey || "").toUpperCase());
  if (leftSlot !== rightSlot) {
    return leftSlot - rightSlot;
  }

  return String(left?.customerName || "").localeCompare(String(right?.customerName || ""));
};

const getDeliveryScheduleState = (delivery, now = new Date()) => {
  const deliveryDate = String(delivery?.date || "").trim();
  const todayKey = getLocalDateKey(now);

  if (!deliveryDate) {
    return { phase: "UNSCHEDULED", isStartable: false, helperText: "Schedule not available" };
  }

  if (deliveryDate < todayKey) {
    return { phase: "PAST", isStartable: false, helperText: "Scheduled window has passed" };
  }

  if (deliveryDate > todayKey) {
    return { phase: "FUTURE", isStartable: false, helperText: `Scheduled for ${deliveryDate}` };
  }

  const slotKey = String(delivery?.slotKey || "").toUpperCase();
  const slotMeta = SLOT_META[slotKey];
  if (!slotMeta) {
    return { phase: "TODAY", isStartable: true, helperText: "Ready for today's delivery" };
  }

  const slotStart = new Date(now);
  slotStart.setHours(slotMeta.startHour, slotMeta.startMinute, 0, 0);

  const slotEnd = new Date(now);
  slotEnd.setHours(slotMeta.endHour, slotMeta.endMinute, 0, 0);

  if (now < slotStart) {
    return {
      phase: "UPCOMING_TODAY",
      isStartable: true,
      helperText: `${slotMeta.label} slot starts at ${delivery?.slotWindow || "-"}, but you can start delivery now`,
    };
  }

  if (now > slotEnd) {
    return {
      phase: "ENDED_TODAY",
      isStartable: true,
      helperText: `${slotMeta.label} slot ended for today, but you can still mark it out for delivery`,
    };
  }

  return {
    phase: "ACTIVE_TODAY",
    isStartable: true,
    helperText: `${slotMeta.label} slot is active now`,
  };
};

const StatCard = ({ icon, label, value, accent, tint }) => (
  <div className="rounded-[24px] border border-[#EDE8DF] bg-white px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">{label}</p>
        <p className="mt-1 text-2xl font-black leading-none text-[#2C1A0E]">{value}</p>
      </div>
      <div className={`rounded-[16px] border px-2.5 py-2.5 ${tint}`}>
        {React.cloneElement(icon, { size: 16, className: accent })}
      </div>
    </div>
  </div>
);

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

const AgentDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [stats, setStats] = useState({ totalAssigned: 0, completed: 0, pending: 0, failed: 0 });
  const [deliveries, setDeliveries] = useState(() => getCachedAssignedAgentDeliveries());
  const [agentProfile, setAgentProfile] = useState({ name: "", dairyName: "" });
  const [agentLocation, setAgentLocation] = useState(() => {
    const cachedLocation = getCachedAgentLocation();
    return cachedLocation ? [cachedLocation.lat, cachedLocation.lng] : null;
  });
  const [mapView, setMapView] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [hasAutoFocusedDestination, setHasAutoFocusedDestination] = useState(false);
  const [startingDelivery, setStartingDelivery] = useState(false);
  const [startDeliveryMessage, setStartDeliveryMessage] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [roadRoute, setRoadRoute] = useState([]);
  const [deliveryRunStartedAt, setDeliveryRunStartedAt] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingAgentSyncCount());
  const lastLocationSyncAtRef = useRef(0);

  const loadDashboard = useCallback(async () => {
    try {
      const assigned = await fetchAssignedAgentDeliveries();
      const resolved = assigned || [];
      setDeliveries(resolved);
    } catch (_err) {
      setDeliveries([]);
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setAgentProfile((prev) => ({
          ...prev,
          name: parsed?.name || parsed?.user?.name || prev.name,
          dairyName:
            parsed?.dairyName ||
            parsed?.user?.dairyName ||
            parsed?.dairy?.name ||
            parsed?.user?.dairy?.name ||
            prev.dairyName,
        }));
      } catch (_err) {}
    }

    loadDashboard();

    if (navigator.geolocation) {
      const watcher = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setAgentLocation(coords);
          storeAgentLocation({ lat: coords[0], lng: coords[1] });
        },
        (err) => console.error("GPS Error:", err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watcher);
    }
  }, [loadDashboard]);

  useEffect(() => {
    const loadAgentProfile = async () => {
      try {
        const profile = await fetchAgentProfile();
        if (!profile) return;
        setAgentProfile((prev) => ({
          ...prev,
          name: profile?.name || prev.name,
        }));
      } catch (_err) {}
    };

    loadAgentProfile();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await flushAgentOfflineQueue();
      setPendingSyncCount(getPendingAgentSyncCount());
      await loadDashboard();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingSyncCount(getPendingAgentSyncCount());
    };

    const unsubscribe = subscribeToAgentOfflineState(() => {
      setPendingSyncCount(getPendingAgentSyncCount());
    });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadDashboard]);

  useEffect(() => {
    try {
      const storedValue = localStorage.getItem(DELIVERY_RUN_STORAGE_KEY);
      if (!storedValue) return;
      const parsed = JSON.parse(storedValue);
      if (parsed?.date === getLocalDateKey(new Date())) {
        setDeliveryRunStartedAt(parsed.date);
      } else {
        localStorage.removeItem(DELIVERY_RUN_STORAGE_KEY);
      }
    } catch (_err) {
      localStorage.removeItem(DELIVERY_RUN_STORAGE_KEY);
    }
  }, []);

  const now = useMemo(() => new Date(nowTick), [nowTick]);
  const todayKey = useMemo(() => getLocalDateKey(now), [now]);
  const todayDeliveries = useMemo(
    () => deliveries.filter((delivery) => String(delivery?.date || "") === todayKey),
    [deliveries, todayKey]
  );
  const todayOpenDeliveries = useMemo(
    () =>
      todayDeliveries
        .filter((delivery) => {
          const status = String(delivery?.status || "").toUpperCase();
          return status === "PENDING" || status === "OUT_FOR_DELIVERY";
        })
        .sort((left, right) => {
          const leftStatus = String(left?.status || "").toUpperCase();
          const rightStatus = String(right?.status || "").toUpperCase();
          if (leftStatus !== rightStatus) {
            return leftStatus === "OUT_FOR_DELIVERY" ? -1 : 1;
          }
          return compareScheduledDeliveries(left, right);
        }),
    [todayDeliveries]
  );
  const outForDeliveryItems = useMemo(
    () =>
      todayOpenDeliveries.filter((delivery) => String(delivery?.status || "").toUpperCase() === "OUT_FOR_DELIVERY"),
    [todayOpenDeliveries]
  );
  const pendingUpcomingDeliveries = useMemo(
    () =>
      deliveries
        .filter(
          (delivery) =>
            String(delivery?.status || "").toUpperCase() === "PENDING" &&
            (!delivery?.date || String(delivery.date) >= todayKey)
        )
        .sort(compareScheduledDeliveries),
    [deliveries, todayKey]
  );
  const isDeliveryRunActive = useMemo(() => {
    if (outForDeliveryItems.length > 0) return true;
    return deliveryRunStartedAt === todayKey && todayOpenDeliveries.length > 0;
  }, [deliveryRunStartedAt, outForDeliveryItems.length, todayKey, todayOpenDeliveries.length]);
  const startableDelivery = useMemo(
    () =>
      pendingUpcomingDeliveries.find((delivery) => getDeliveryScheduleState(delivery, now).isStartable) || null,
    [now, pendingUpcomingDeliveries]
  );
  const nextTask = isDeliveryRunActive
    ? todayOpenDeliveries[0] || null
    : startableDelivery || pendingUpcomingDeliveries[0] || null;
  const nextTaskSchedule = useMemo(
    () => (nextTask ? getDeliveryScheduleState(nextTask, now) : null),
    [nextTask, now]
  );
  const statsForToday = useMemo(
    () => ({
      totalAssigned: todayDeliveries.length,
      completed: todayDeliveries.filter((d) => d.status === "COMPLETED").length,
      pending: todayDeliveries.filter((d) => ["PENDING", "OUT_FOR_DELIVERY"].includes(String(d?.status || "").toUpperCase())).length,
      failed: todayDeliveries.filter((d) => d.status === "FAILED").length,
    }),
    [todayDeliveries]
  );

  useEffect(() => {
    setStats(statsForToday);
  }, [statsForToday]);

  useEffect(() => {
    if (todayOpenDeliveries.length > 0) return;
    setDeliveryRunStartedAt(null);
    localStorage.removeItem(DELIVERY_RUN_STORAGE_KEY);
  }, [todayOpenDeliveries.length]);

  const completionPercentage =
    stats.totalAssigned > 0 ? Math.round((stats.completed / stats.totalAssigned) * 100) : 0;

  const nextTaskCoordinates = getDeliveryCoordinates(nextTask);
  const deliveriesWithCoordinates = useMemo(
    () => deliveries.filter((delivery) => getDeliveryCoordinates(delivery)),
    [deliveries]
  );
  const dairyName =
    agentProfile.dairyName ||
    deliveries.find((delivery) => delivery?.dairyFarmName)?.dairyFarmName ||
    "No dairy assigned";
  const distanceToNextTask = useMemo(
    () => getDistanceInMeters(agentLocation, nextTaskCoordinates),
    [agentLocation, nextTaskCoordinates]
  );
  const routeCoordinates = useMemo(() => {
    if (!isDeliveryRunActive) return [];
    if (roadRoute.length >= 2) return roadRoute;
    return [agentLocation, nextTaskCoordinates].filter(Boolean);
  }, [agentLocation, isDeliveryRunActive, nextTaskCoordinates, roadRoute]);

  useEffect(() => {
    if (hasAutoFocusedDestination) return;

    if (nextTaskCoordinates) {
      setMapView(nextTaskCoordinates);
      setZoomLevel(17);
      setHasAutoFocusedDestination(true);
      return;
    }

    const firstPinnedCoordinates = getDeliveryCoordinates(deliveriesWithCoordinates[0]);
    if (firstPinnedCoordinates) {
      setMapView(firstPinnedCoordinates);
      setZoomLevel(16);
      setHasAutoFocusedDestination(true);
      return;
    }

    if (!mapView && agentLocation) {
      setMapView(agentLocation);
      setZoomLevel(15);
    }
  }, [
    agentLocation,
    deliveriesWithCoordinates,
    hasAutoFocusedDestination,
    mapView,
    nextTaskCoordinates,
  ]);

  useEffect(() => {
    if (!nextTaskCoordinates || !agentLocation) return;
    setZoomLevel(getAutoZoomLevel(distanceToNextTask));
  }, [agentLocation, distanceToNextTask, nextTaskCoordinates]);

  useEffect(() => {
    if (!isDeliveryRunActive || !agentLocation || !nextTaskCoordinates) {
      setRoadRoute([]);
      return undefined;
    }

    const controller = new AbortController();

    fetchRoadRoute(agentLocation, nextTaskCoordinates, controller.signal)
      .then((points) => {
        setRoadRoute(Array.isArray(points) ? points : []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Agent road route fetch failed:", err);
        setRoadRoute([]);
      });

    return () => controller.abort();
  }, [
    agentLocation?.[0],
    agentLocation?.[1],
    isDeliveryRunActive,
    nextTaskCoordinates?.[0],
    nextTaskCoordinates?.[1],
  ]);

  useEffect(() => {
    if (!isDeliveryRunActive || !nextTask?.id || !agentLocation) return;

    const nowTs = Date.now();
    if (nowTs - lastLocationSyncAtRef.current < 15000) return;
    lastLocationSyncAtRef.current = nowTs;

    updateAgentLocation(nextTask.id, agentLocation[0], agentLocation[1]).catch((err) => {
      console.error("Agent location sync failed:", err);
    });
  }, [agentLocation, isDeliveryRunActive, nextTask?.id]);

  const handleMarkOutForDelivery = useCallback(async () => {
    if (!startableDelivery?.id) {
      setStartDeliveryMessage("No pending delivery is available to start.");
      return;
    }

    if (!agentLocation) {
      setStartDeliveryMessage("Waiting for your current GPS location. Please try again.");
      return;
    }

    try {
      setStartingDelivery(true);
      setStartDeliveryMessage("");
      await startDelivery(startableDelivery.id, agentLocation[0], agentLocation[1]);
      setDeliveryRunStartedAt(todayKey);
      localStorage.setItem(DELIVERY_RUN_STORAGE_KEY, JSON.stringify({ date: todayKey }));
      setStartDeliveryMessage("Delivering. Keep going until today's deliveries are completed or failed.");
      await loadDashboard();
    } catch (err) {
      setStartDeliveryMessage(err?.message || "Failed to mark this delivery out for delivery.");
    } finally {
      setStartingDelivery(false);
    }
  }, [agentLocation, loadDashboard, startableDelivery, todayKey]);

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-4 pb-32 pt-5 text-[#2C1A0E]">
      <div className="mx-auto max-w-md space-y-5">
        <section className="relative overflow-hidden rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#2C1A0E_0%,#4A3820_58%,#6B4F2A_100%)] px-5 py-3.5 text-white shadow-[0_22px_50px_rgba(92,61,30,0.22)]">
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">Agent Portal</p>
              <h1 className="mt-2 text-[28px] font-black leading-none text-white" style={headingFont}>
                {agentProfile.name || "Agent"}
              </h1>
              <p className="mt-3 max-w-[220px] text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
                {dairyName}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${
                  isOnline
                    ? "border-[#D9E7C8] bg-[#EEF5E7] text-[#4A7C2F]"
                    : "border-white/10 bg-white/10 text-white/70"
                }`}
              >
                {isOnline ? "Online" : "Offline"}
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/15"
              >
                <LogOut size={12} />
                Logout
              </button>
              {isDeliveryRunActive ? (
                <div className="rounded-full border border-[#F0D9B9] bg-[#FFF4E2] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#B8641A]">
                  Delivering
                </div>
              ) : startableDelivery?.id ? (
                <button
                  type="button"
                  onClick={handleMarkOutForDelivery}
                  disabled={startingDelivery || !agentLocation}
                  className="inline-flex items-center gap-1 rounded-full border border-[#F0D9B9] bg-[#FFF4E2] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#B8641A] transition hover:bg-[#FFF1E4] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Truck size={12} />
                  {startingDelivery ? "Starting..." : "Out for Delivery"}
                </button>
              ) : (
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
                  No Delivery
                </div>
              )}
            </div>
          </div>
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-[#F2D9B8]/20 blur-2xl" />
        </section>

        {startDeliveryMessage ? (
          <div className="rounded-[20px] border border-[#E7DAC6] bg-[#FFF8EF] px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[#8B5E34] shadow-sm">
            {startDeliveryMessage}
          </div>
        ) : null}

        {!isOnline || pendingSyncCount > 0 ? (
          <div className="rounded-[20px] border border-[#E7DAC6] bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[#8B5E34] shadow-sm">
            {!isOnline
              ? `Offline mode active${pendingSyncCount > 0 ? ` • ${pendingSyncCount} updates waiting to sync` : ""}`
              : `${pendingSyncCount} updates waiting to sync`}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Package />}
            label="Assigned"
            value={stats.totalAssigned}
            accent="text-[#B8641A]"
            tint="border-[#F0D9B9] bg-[#FFF4E2]"
          />
          <StatCard
            icon={<CheckCircle />}
            label="Completed"
            value={stats.completed}
            accent="text-[#4A7C2F]"
            tint="border-[#DDE8D1] bg-[#EEF5E7]"
          />
          <StatCard
            icon={<Clock />}
            label="Pending"
            value={stats.pending}
            accent="text-[#C86A2B]"
            tint="border-[#F0D1B2] bg-[#FFF1E4]"
          />
          <StatCard
            icon={<XCircle />}
            label="Failed"
            value={stats.failed}
            accent="text-[#C0392B]"
            tint="border-[#F2D0C8] bg-[#FDECEA]"
          />
        </div>

        <section className="rounded-[28px] border border-[#EDE8DF] bg-white px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Shift Progress</p>
              <p className="mt-0.5 text-sm font-semibold leading-tight text-[#6B5B3E]">
                {stats.completed} of {stats.totalAssigned} deliveries completed
              </p>
            </div>
            <p className="text-lg font-black text-[#B8641A]">{completionPercentage}%</p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#F3E7D6]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#B8641A_0%,#D9903D_100%)] transition-all duration-1000"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-[#EDE8DF] bg-white px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapIcon size={16} className="text-[#B8641A]" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Live Route Map</p>
                <p className="text-xs font-medium text-[#6B5B3E]">Customer pins and your current position</p>
              </div>
            </div>
            <button
              onClick={() => {
                setMapView(agentLocation);
                setZoomLevel(15);
                setRecenterTrigger((prev) => prev + 1);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-[#E7DAC6] bg-[#FFF8EF] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#B8641A] transition hover:bg-[#FFF1E4]"
            >
              <LocateFixed size={13} />
              GPS
            </button>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-[#E7DAC6]">
            <div className="relative z-0 flex h-[320px] w-full items-center justify-center bg-[#F8F1E7]">
              {agentLocation ? (
                <MapContainer center={agentLocation} zoom={15} scrollWheelZoom className="h-full w-full">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    maxNativeZoom={19}
                    maxZoom={19}
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapController center={mapView} zoom={zoomLevel} trigger={recenterTrigger} />
                  <MapBoundsController points={routeCoordinates} />

                  <CircleMarker
                    center={agentLocation}
                    radius={10}
                    pathOptions={{
                      color: "#2563EB",
                      fillColor: "#60A5FA",
                      fillOpacity: 0.7,
                      weight: 2,
                    }}
                  >
                    <Popup className="font-bold text-xs">Your Location</Popup>
                  </CircleMarker>

                  {deliveriesWithCoordinates.map((delivery) => {
                    const coordinates = getDeliveryCoordinates(delivery);
                    if (!coordinates) return null;

                    const isNextDestination = String(delivery.id) === String(nextTask?.id);
                    const markerColor =
                      delivery.status === "COMPLETED"
                        ? "#4A7C2F"
                        : isNextDestination
                          ? "#B8641A"
                          : "#C86A2B";

                    return (
                      <Marker
                        key={delivery.id}
                        position={coordinates}
                        icon={L.divIcon({
                          className: "custom-div-icon",
                          html: `<div style="background-color: ${markerColor}; width: ${
                            isNextDestination ? 18 : 14
                          }px; height: ${isNextDestination ? 18 : 14}px; border-radius: 999px; box-shadow: 0 4px 10px rgba(44,26,14,0.16);"></div>`,
                          iconSize: [isNextDestination ? 18 : 14, isNextDestination ? 18 : 14],
                          iconAnchor: [isNextDestination ? 9 : 7, isNextDestination ? 9 : 7],
                        })}
                      >
                        <Popup>
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold text-[#2C1A0E]">{delivery.customerName}</p>
                            <p className="text-[10px] text-[#6B5B3E]">{delivery.address}</p>
                            <p className="text-[10px] font-semibold text-[#B8641A]">
                              {isNextDestination ? "Next delivery destination" : "Customer delivery pin"}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {routeCoordinates.length >= 2 && (
                    <Polyline
                      positions={routeCoordinates}
                      pathOptions={{ color: "#B8641A", weight: 4, opacity: 0.85 }}
                    />
                  )}
                </MapContainer>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B8641A] border-t-transparent" />
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">
                    Initializing GPS...
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="mt-2 text-xs font-medium text-[#8B7355]">
            {isDeliveryRunActive
              ? "Follow the highlighted route to your next stop."
              : "Route path will appear after you mark the delivery out for delivery."}
          </p>
        </section>

        <section className="rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF1E4_100%)] p-5 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A88763]">Next Delivery</p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[24px] font-black leading-tight text-[#2C1A0E]" style={headingFont}>
                {nextTask?.customerName || "No active tasks"}
              </h2>
              <p className="mt-2 text-sm font-semibold text-[#6B5B3E]">
                {nextTask?.address || "Wait for your next assignment"}
              </p>
              {nextTask?.date ? (
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#A88763]">
                  {nextTask.date}
                  {nextTask?.slot
                    ? ` • ${nextTask.slot}${nextTask?.slotWindow ? ` (${nextTask.slotWindow})` : ""}`
                    : ""}
                </p>
              ) : null}
              {nextTaskSchedule?.helperText ? (
                <p className="mt-2 text-xs font-semibold text-[#8B7355]">
                  {isDeliveryRunActive
                    ? "Delivery run is active. Keep updating each stop as delivered or failed."
                    : nextTaskSchedule.helperText}
                </p>
              ) : null}
              {nextTask && (
                <p
                  className={`mt-3 text-[10px] font-black uppercase tracking-[0.18em] ${
                    nextTaskCoordinates ? "text-[#B8641A]" : "text-[#A88763]"
                  }`}
                >
                  {nextTaskCoordinates ? "Customer pin is ready on map" : "Customer pin not saved yet"}
                </p>
              )}
            </div>
            {nextTask && (
              <div className="rounded-[20px] border border-[#F0D9B9] bg-white px-4 py-3 text-center shadow-sm">
                <p className="text-lg font-black text-[#B8641A]">
                  {isDeliveryRunActive
                    ? "Delivering"
                    : startableDelivery?.id && String(startableDelivery.id) === String(nextTask.id)
                    ? "Ready"
                    : nextTask?.date && String(nextTask.date) > todayKey
                    ? "Tomorrow"
                    : "Queued"}
                </p>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#A88763]">Status</p>
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => {
                if (nextTaskCoordinates) {
                  setMapView(nextTaskCoordinates);
                  setZoomLevel(17);
                  setRecenterTrigger((prev) => prev + 1);
                }
              }}
              disabled={!nextTaskCoordinates}
              className="flex flex-1 items-center justify-center gap-2 rounded-[18px] bg-[#B8641A] py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-[#F2D9B8] transition hover:bg-[#9E5415] active:scale-[0.99] disabled:bg-[#CDB8A0]"
            >
              <Navigation size={18} fill="currentColor" />
              {nextTaskCoordinates ? "Focus Customer Pin" : "No Customer Pin"}
            </button>
          </div>
        </section>

        <div className="fixed bottom-6 left-1/2 z-50 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
          <NavTab icon={<Home size={18} />} label="Home" active onClick={() => navigate("/agent/dashboard")} />
          <NavTab icon={<List size={18} />} label="Tasks" onClick={() => navigate("/agent/working")} />
          <NavTab icon={<History size={18} />} label="History" onClick={() => navigate("/agent/history")} />
          <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;
