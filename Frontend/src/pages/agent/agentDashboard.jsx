import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Undo2,
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
const MAX_ROUTE_PREVIEW_DISTANCE_METERS = 50000;
const roadRouteCache = new Map();

const formatInstructionDistance = (distanceInMeters) => {
  if (!Number.isFinite(distanceInMeters)) return "";
  if (distanceInMeters < 1000) return `${Math.max(10, Math.round(distanceInMeters / 10) * 10)} m`;
  return `${(distanceInMeters / 1000).toFixed(distanceInMeters >= 10000 ? 0 : 1)} km`;
};

const formatManeuverText = (step) => {
  const type = String(step?.maneuver?.type || "").toLowerCase();
  const modifier = String(step?.maneuver?.modifier || "").toLowerCase();
  const roadName = String(step?.name || "").trim();
  const roadSuffix = roadName ? ` onto ${roadName}` : "";

  if (type === "depart") return roadName ? `Head on ${roadName}` : "Start and continue ahead";
  if (type === "arrive") return "Arrive at destination";
  if (type === "roundabout") return roadName ? `Take the roundabout to ${roadName}` : "Take the roundabout";
  if (type === "merge") return roadName ? `Merge onto ${roadName}` : "Merge ahead";
  if (type === "fork") return modifier ? `Keep ${modifier}${roadSuffix}` : `Keep ahead${roadSuffix}`;
  if (modifier === "uturn") return "Make a U-turn";
  if (modifier) return `Turn ${modifier}${roadSuffix}`;
  if (type === "continue") return roadName ? `Continue on ${roadName}` : "Continue ahead";
  return roadName ? `Continue on ${roadName}` : "Continue ahead";
};

const getUpcomingInstructionSummary = (route) => {
  const steps = route?.legs?.flatMap((leg) => (Array.isArray(leg?.steps) ? leg.steps : [])) || [];
  const meaningfulSteps = steps.filter((step) => String(step?.maneuver?.type || "").toLowerCase() !== "depart");
  const [primaryStep, secondaryStep] = meaningfulSteps;

  return {
    primary: primaryStep
      ? {
          distanceMeters: Number.isFinite(Number(primaryStep.distance)) ? Number(primaryStep.distance) : null,
          distanceLabel: formatInstructionDistance(primaryStep.distance),
          text: formatManeuverText(primaryStep),
        }
      : null,
    secondary: secondaryStep
      ? {
          distanceMeters: Number.isFinite(Number(secondaryStep.distance)) ? Number(secondaryStep.distance) : null,
          distanceLabel: formatInstructionDistance(secondaryStep.distance),
          text: formatManeuverText(secondaryStep),
        }
      : null,
  };
};

const buildSpokenInstruction = (instruction, distanceMeters) => {
  if (!instruction?.text) return "";
  if (!Number.isFinite(distanceMeters)) return instruction.text;
  if (distanceMeters <= 120) return `Now ${instruction.text.toLowerCase()}.`;
  if (distanceMeters <= 600) {
    return `In ${formatInstructionDistance(distanceMeters)}, ${instruction.text.toLowerCase()}.`;
  }
  return `After ${formatInstructionDistance(distanceMeters)}, ${instruction.text.toLowerCase()}.`;
};

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
    return { points: [], distanceMeters: null, durationSeconds: null };
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
    `?overview=simplified&geometries=geojson&steps=true`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Road route request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  const geometry = route?.geometry?.coordinates;
  const routePoints = Array.isArray(geometry)
    ? geometry
        .map((point) => {
          const lng = Number(point?.[0]);
          const lat = Number(point?.[1]);
          return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
        })
        .filter(Boolean)
    : [];
  const routeData = {
    points: routePoints,
    distanceMeters: Number.isFinite(Number(route?.distance)) ? Number(route.distance) : null,
    durationSeconds: Number.isFinite(Number(route?.duration)) ? Number(route.duration) : null,
    instructions: getUpcomingInstructionSummary(route),
  };

  if (cacheKey) {
    roadRouteCache.set(cacheKey, routeData);
  }

  return routeData;
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

const getBearingInDegrees = (from, to) => {
  if (!from || !to) return null;

  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const toRadians = (value) => (value * Math.PI) / 180;
  const toDegrees = (value) => (value * 180) / Math.PI;
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const deltaLng = toRadians(toLng - fromLng);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  const bearing = toDegrees(Math.atan2(y, x));

  return (bearing + 360) % 360;
};

const getCompassDirectionLabel = (bearing) => {
  if (!Number.isFinite(bearing)) return "";
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return labels[Math.round(bearing / 45) % labels.length];
};

const getTurnInstructionLabel = (instruction) => {
  const text = String(instruction?.text || "").trim();
  if (!text) return "Follow route";

  if (/u-turn/i.test(text)) return "Make a U-turn";
  if (/turn right/i.test(text)) return "Take right";
  if (/turn left/i.test(text)) return "Take left";
  if (/keep right/i.test(text)) return "Keep right";
  if (/keep left/i.test(text)) return "Keep left";
  if (/continue|head|straight/i.test(text)) return "Go straight";
  if (/arrive/i.test(text)) return "Reach destination";

  return text;
};

const getTurnInstructionDetail = (instruction, fallbackDelivery) => {
  const text = String(instruction?.text || "").trim();
  const towardMatch = text.match(/\b(?:onto|on|to)\s+(.+)$/i);
  if (towardMatch?.[1]) return towardMatch[1];
  return fallbackDelivery?.customerName || fallbackDelivery?.address || "next location";
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

const formatDistanceLabel = (distanceInMeters) => {
  if (!Number.isFinite(distanceInMeters)) return "Distance unavailable";
  if (distanceInMeters < 1000) return `${Math.round(distanceInMeters)} m`;
  return `${(distanceInMeters / 1000).toFixed(distanceInMeters >= 10000 ? 0 : 1)} km`;
};

const formatDurationLabel = (durationSeconds) => {
  if (!Number.isFinite(durationSeconds)) return "ETA unavailable";
  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
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
      helperText: "",
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

const ActiveNavLabel = {
  HOME: "HOME",
  MAP: "MAP",
};

const AgentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [activeSection, setActiveSection] = useState(ActiveNavLabel.HOME);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [hasAutoFocusedDestination, setHasAutoFocusedDestination] = useState(false);
  const [startingDelivery, setStartingDelivery] = useState(false);
  const [startDeliveryMessage, setStartDeliveryMessage] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [primaryRoadRoute, setPrimaryRoadRoute] = useState([]);
  const [primaryRouteStats, setPrimaryRouteStats] = useState({
    distanceMeters: null,
    durationSeconds: null,
    instructions: null,
  });
  const [secondaryRoadRoutes, setSecondaryRoadRoutes] = useState([]);
  const [deliveryRunStartedAt, setDeliveryRunStartedAt] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingAgentSyncCount());
  const lastLocationSyncAtRef = useRef(0);
  const spokenInstructionRef = useRef({ key: "", threshold: null });

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
  const mapCandidateDeliveries = useMemo(() => {
    const todayCandidates = todayDeliveries.filter((delivery) =>
      ["PENDING", "OUT_FOR_DELIVERY"].includes(String(delivery?.status || "").toUpperCase())
    );

    if (todayCandidates.length > 0) {
      return todayCandidates;
    }

    return nextTask ? [nextTask] : [];
  }, [nextTask, todayDeliveries]);
  const routeDeliveries = useMemo(() => {
    const sourceItems = isDeliveryRunActive ? todayOpenDeliveries : mapCandidateDeliveries;

    return sourceItems
      .map((delivery) => ({
        ...delivery,
        coordinates: getDeliveryCoordinates(delivery),
      }))
      .filter((delivery) => Array.isArray(delivery.coordinates))
      .sort((left, right) => {
        const leftDistance = getDistanceInMeters(agentLocation, left.coordinates);
        const rightDistance = getDistanceInMeters(agentLocation, right.coordinates);

        if (Number.isFinite(leftDistance) && Number.isFinite(rightDistance) && leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        return compareScheduledDeliveries(left, right);
      })
      .filter((delivery, index, items) => {
        if (!agentLocation) return true;

        const distanceFromAgent = getDistanceInMeters(agentLocation, delivery.coordinates);
        if (!Number.isFinite(distanceFromAgent)) return false;
        if (distanceFromAgent <= MAX_ROUTE_PREVIEW_DISTANCE_METERS) return true;

        const nearestDistance = getDistanceInMeters(agentLocation, items[0]?.coordinates);
        return index === 0 && Number.isFinite(nearestDistance);
      });
  }, [agentLocation, isDeliveryRunActive, mapCandidateDeliveries, todayOpenDeliveries]);
  const visibleMapDeliveries = routeDeliveries.length > 0 ? routeDeliveries : deliveriesWithCoordinates;
  const nearestRouteDelivery = routeDeliveries[0] || null;
  const nearestRouteCoordinates = nearestRouteDelivery?.coordinates || null;
  const nextDirectionBearing = useMemo(
    () => getBearingInDegrees(agentLocation, nearestRouteCoordinates),
    [agentLocation, nearestRouteCoordinates]
  );
  const nextDirectionLabel = useMemo(
    () => getCompassDirectionLabel(nextDirectionBearing),
    [nextDirectionBearing]
  );
  const nextDisplayTask = nearestRouteDelivery || nextTask || null;
  const nextDisplayTaskCoordinates = nextDisplayTask?.coordinates || getDeliveryCoordinates(nextDisplayTask);
  const nextDisplayTaskSchedule = useMemo(
    () => (nextDisplayTask ? getDeliveryScheduleState(nextDisplayTask, now) : null),
    [nextDisplayTask, now]
  );
  const dairyName =
    agentProfile.dairyName ||
    deliveries.find((delivery) => delivery?.dairyFarmName)?.dairyFarmName ||
    "No dairy assigned";
  const distanceToNextTask = useMemo(
    () => getDistanceInMeters(agentLocation, nearestRouteCoordinates || nextTaskCoordinates),
    [agentLocation, nearestRouteCoordinates, nextTaskCoordinates]
  );
  const routeCoordinates = useMemo(() => {
    if (!agentLocation || routeDeliveries.length === 0) return [];

    if (primaryRoadRoute.length >= 2) return primaryRoadRoute;

    return [agentLocation, nearestRouteCoordinates].filter(Boolean);
  }, [agentLocation, nearestRouteCoordinates, primaryRoadRoute, routeDeliveries.length]);
  const secondaryRouteSegments = useMemo(() => {
    if (routeDeliveries.length < 2) return [];

    return routeDeliveries
      .slice(0, -1)
      .map((delivery, index) => ({
        id: `${delivery.id}-${routeDeliveries[index + 1]?.id ?? index}`,
        points: [delivery.coordinates, routeDeliveries[index + 1]?.coordinates].filter(Boolean),
      }))
      .filter((segment) => segment.points.length >= 2);
  }, [routeDeliveries]);
  const mapBoundsPoints = useMemo(() => {
    const primaryPoints = Array.isArray(routeCoordinates) ? routeCoordinates : [];
    const extraPoints =
      secondaryRoadRoutes.length > 0
        ? secondaryRoadRoutes.flatMap((segment) => segment.points)
        : secondaryRouteSegments.flatMap((segment) => segment.points);
    const deliveryPoints = routeDeliveries.map((delivery) => delivery.coordinates).filter(Boolean);
    return [...primaryPoints, ...extraPoints, ...deliveryPoints, agentLocation].filter(Boolean);
  }, [agentLocation, routeCoordinates, routeDeliveries, secondaryRoadRoutes, secondaryRouteSegments]);

  useEffect(() => {
    if (hasAutoFocusedDestination) return;

    if (nearestRouteCoordinates || nextTaskCoordinates) {
      setMapView(nearestRouteCoordinates || nextTaskCoordinates);
      setZoomLevel(17);
      setHasAutoFocusedDestination(true);
      return;
    }

    const firstPinnedCoordinates =
      visibleMapDeliveries[0]?.coordinates || getDeliveryCoordinates(deliveriesWithCoordinates[0]);
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
    nearestRouteCoordinates,
    nextTaskCoordinates,
    visibleMapDeliveries,
  ]);

  useEffect(() => {
    if (!(nearestRouteCoordinates || nextTaskCoordinates) || !agentLocation) return;
    setZoomLevel(getAutoZoomLevel(distanceToNextTask));
  }, [agentLocation, distanceToNextTask, nearestRouteCoordinates, nextTaskCoordinates]);

  useEffect(() => {
    if (!agentLocation || !nearestRouteCoordinates) {
      setPrimaryRoadRoute([]);
      setPrimaryRouteStats({ distanceMeters: null, durationSeconds: null, instructions: null });
      return undefined;
    }

    const controller = new AbortController();

    fetchRoadRoute(agentLocation, nearestRouteCoordinates, controller.signal)
      .then((routeData) => {
        setPrimaryRoadRoute(Array.isArray(routeData?.points) ? routeData.points : []);
        setPrimaryRouteStats({
          distanceMeters: routeData?.distanceMeters ?? null,
          durationSeconds: routeData?.durationSeconds ?? null,
          instructions: routeData?.instructions ?? null,
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Agent road route fetch failed:", err);
        setPrimaryRoadRoute([]);
        setPrimaryRouteStats({ distanceMeters: null, durationSeconds: null, instructions: null });
      });

    return () => controller.abort();
  }, [
    agentLocation?.[0],
    agentLocation?.[1],
    nearestRouteCoordinates?.[0],
    nearestRouteCoordinates?.[1],
  ]);

  useEffect(() => {
    if (activeSection !== ActiveNavLabel.MAP || secondaryRouteSegments.length === 0) {
      setSecondaryRoadRoutes([]);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      Promise.all(
        secondaryRouteSegments.map(async (segment) => {
          const [fromCoordinates, toCoordinates] = segment.points;
          const roadRoute = await fetchRoadRoute(fromCoordinates, toCoordinates, controller.signal);

          return {
            id: segment.id,
            points:
              Array.isArray(roadRoute?.points) && roadRoute.points.length >= 2
                ? roadRoute.points
                : segment.points,
          };
        })
      )
        .then((segments) => {
          setSecondaryRoadRoutes(Array.isArray(segments) ? segments : []);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          console.error("Secondary road route fetch failed:", err);
          setSecondaryRoadRoutes(
            secondaryRouteSegments.map((segment) => ({
              id: segment.id,
              points: segment.points,
            }))
          );
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeSection, secondaryRouteSegments]);

  useEffect(() => {
    if (!isDeliveryRunActive || !nextTask?.id || !agentLocation) return;

    const nowTs = Date.now();
    if (nowTs - lastLocationSyncAtRef.current < 15000) return;
    lastLocationSyncAtRef.current = nowTs;

    updateAgentLocation(nextTask.id, agentLocation[0], agentLocation[1]).catch((err) => {
      console.error("Agent location sync failed:", err);
    });
  }, [agentLocation, isDeliveryRunActive, nextTask?.id]);

  useEffect(() => {
    if (!isDeliveryRunActive || typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      spokenInstructionRef.current = { key: "", threshold: null };
      return;
    }

    const primaryInstruction = primaryRouteStats.instructions?.primary;
    if (!nearestRouteDelivery?.id || !primaryInstruction?.text) return;

    const routeKey = `${nearestRouteDelivery.id}:${primaryInstruction.text}`;
    const distanceMeters = primaryInstruction.distanceMeters;
    const thresholds = [1500, 500, 150];
    const matchedThreshold =
      Number.isFinite(distanceMeters) ? thresholds.find((threshold) => distanceMeters <= threshold) ?? null : null;
    const previousState = spokenInstructionRef.current;
    const isNewInstruction = previousState.key !== routeKey;
    const shouldSpeak =
      isNewInstruction ||
      (matchedThreshold !== null &&
        (previousState.key !== routeKey ||
          previousState.threshold === null ||
          matchedThreshold < previousState.threshold));

    if (!shouldSpeak) return;

    const utteranceText = buildSpokenInstruction(primaryInstruction, distanceMeters);
    if (!utteranceText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(utteranceText);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);

    spokenInstructionRef.current = {
      key: routeKey,
      threshold: matchedThreshold,
    };
  }, [isDeliveryRunActive, nearestRouteDelivery?.id, primaryRouteStats.instructions]);

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

  const handleOpenMapSection = useCallback(() => {
    setActiveSection(ActiveNavLabel.MAP);
    if (agentLocation) {
      setMapView(agentLocation);
      setZoomLevel(15);
      setRecenterTrigger((prev) => prev + 1);
    }
  }, [agentLocation]);

  const handleOpenHomeSection = useCallback(() => {
    setActiveSection(ActiveNavLabel.HOME);
  }, []);

  useEffect(() => {
    if (location.state?.section === ActiveNavLabel.MAP) {
      setActiveSection(ActiveNavLabel.MAP);
      if (agentLocation) {
        setMapView(agentLocation);
        setZoomLevel(15);
        setRecenterTrigger((prev) => prev + 1);
      }
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    if (location.state?.section === ActiveNavLabel.HOME) {
      setActiveSection(ActiveNavLabel.HOME);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [agentLocation, location.pathname, location.state, navigate]);

  const mapContent = (
    <section className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-[#EDE8DF] bg-white px-4 py-3 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapIcon size={16} className="text-[#B8641A]" />
          <div>
            <p className="text-[10px] font-black uppercase text-[#A88763]">Live Route Map</p>
            <p className="text-xs font-medium text-[#6B5B3E]">Customer pins and your current position</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMapView(agentLocation);
              setZoomLevel(15);
              setRecenterTrigger((prev) => prev + 1);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-[#E7DAC6] bg-[#FFF8EF] px-3 py-1.5 text-[10px] font-black uppercase text-[#B8641A] transition hover:bg-[#FFF1E4]"
          >
            <LocateFixed size={13} />
            GPS
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border border-[#E7DAC6]">
        <div
          className={`relative z-0 flex w-full items-center justify-center bg-[#F8F1E7] ${
            activeSection === ActiveNavLabel.MAP ? "h-full min-h-0" : "h-[320px]"
          }`}
        >
          {isDeliveryRunActive &&
          (primaryRouteStats.instructions?.primary || Number.isFinite(nextDirectionBearing)) ? (
            <div className="pointer-events-none absolute left-[58px] top-3 z-[500] w-[255px] max-w-[255px] rounded-[16px] border border-[#E7DAC6] bg-white/95 px-3 py-1.5 shadow-[0_10px_24px_rgba(92,61,30,0.14)] backdrop-blur-sm">
              <div className="flex items-start gap-2">
                <div className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#F0D9B9] bg-[#FFF4E2]">
                  <div
                    className="h-0 w-0 border-l-[6px] border-r-[6px] border-b-[14px] border-l-transparent border-r-transparent border-b-[#B8641A]"
                    style={{ transform: `rotate(${nextDirectionBearing || 0}deg)` }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase text-[#A88763]">
                    {nextDirectionLabel ? `Next ${nextDirectionLabel}` : "Next Turn"}
                  </p>
                  <p className="mt-0.5 text-[11px] font-black leading-tight text-[#2C1A0E]">
                    {primaryRouteStats.instructions?.primary?.distanceLabel
                      ? `After ${primaryRouteStats.instructions.primary.distanceLabel}, ${primaryRouteStats.instructions.primary.text}`
                      : "Follow the highlighted route"}
                  </p>
                  {primaryRouteStats.instructions?.secondary ? (
                    <p className="mt-0.5 text-[10px] font-semibold leading-tight text-[#8B7355]">
                      Then after {primaryRouteStats.instructions.secondary.distanceLabel},{" "}
                      {primaryRouteStats.instructions.secondary.text.toLowerCase()}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {agentLocation ? (
            <MapContainer center={agentLocation} zoom={15} scrollWheelZoom className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxNativeZoom={19}
                maxZoom={19}
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapController center={mapView} zoom={zoomLevel} trigger={recenterTrigger} />
              <MapBoundsController points={mapBoundsPoints} />

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

              {visibleMapDeliveries.map((delivery) => {
                const coordinates = delivery.coordinates || getDeliveryCoordinates(delivery);
                if (!coordinates) return null;

                const isNearestDestination = String(delivery.id) === String(nearestRouteDelivery?.id);
                const isNextDestination = String(delivery.id) === String(nextTask?.id);
                const markerColor =
                  delivery.status === "COMPLETED"
                    ? "#4A7C2F"
                    : isNearestDestination
                      ? "#B8641A"
                      : "#C86A2B";

                return (
                  <Marker
                    key={delivery.id}
                    position={coordinates}
                    icon={L.divIcon({
                      className: "custom-div-icon",
                      html: `<div style="background-color: ${markerColor}; width: ${
                        isNearestDestination ? 18 : 14
                      }px; height: ${isNearestDestination ? 18 : 14}px; border-radius: 999px; box-shadow: 0 4px 10px rgba(44,26,14,0.16);"></div>`,
                      iconSize: [isNearestDestination ? 18 : 14, isNearestDestination ? 18 : 14],
                      iconAnchor: [isNearestDestination ? 9 : 7, isNearestDestination ? 9 : 7],
                    })}
                  >
                    <Popup>
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-[#2C1A0E]">{delivery.customerName}</p>
                        <p className="text-[10px] text-[#6B5B3E]">{delivery.address}</p>
                        <p className="text-[10px] font-semibold text-[#B8641A]">
                          {isNearestDestination
                            ? "Nearest customer on your route"
                            : isNextDestination
                              ? "Next scheduled delivery"
                              : "Customer delivery pin"}
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

              {(secondaryRoadRoutes.length > 0 ? secondaryRoadRoutes : secondaryRouteSegments).map(
                (segment, index) => (
                  <Polyline
                    key={segment.id || `secondary-route-${index}`}
                    positions={segment.points}
                    pathOptions={{
                      color: "#D9903D",
                      weight: 3,
                      opacity: 0.75,
                      dashArray: "8 10",
                    }}
                  />
                )
              )}
            </MapContainer>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B8641A] border-t-transparent" />
              <p className="text-[10px] font-black uppercase text-[#A88763]">
                Initializing GPS...
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs font-medium text-[#8B7355]">
        {isDeliveryRunActive
          ? "Solid line shows the nearest customer. Dotted lines show the remaining customers on your route."
          : "The map highlights the nearest customer and previews the rest of the route."}
      </p>
    </section>
  );

  return (
    <div
      className={`bg-[#FFFDF7] px-4 pt-5 text-[#2C1A0E] ${
        activeSection === ActiveNavLabel.MAP ? "h-screen overflow-hidden pb-24" : "min-h-screen pb-32"
      }`}
    >
      <div
        className={`mx-auto max-w-md ${
          activeSection === ActiveNavLabel.MAP ? "flex h-full flex-col gap-4 overflow-hidden" : "space-y-5"
        }`}
      >
        {activeSection !== ActiveNavLabel.MAP ? (
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
        ) : null}

        {activeSection !== ActiveNavLabel.MAP && startDeliveryMessage ? (
          <div className="rounded-[20px] border border-[#E7DAC6] bg-[#FFF8EF] px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[#8B5E34] shadow-sm">
            {startDeliveryMessage}
          </div>
        ) : null}

        {activeSection !== ActiveNavLabel.MAP && (!isOnline || pendingSyncCount > 0) ? (
          <div className="rounded-[20px] border border-[#E7DAC6] bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[#8B5E34] shadow-sm">
            {!isOnline
              ? `Offline mode active${pendingSyncCount > 0 ? ` • ${pendingSyncCount} updates waiting to sync` : ""}`
              : `${pendingSyncCount} updates waiting to sync`}
          </div>
        ) : null}

        {activeSection === ActiveNavLabel.HOME ? (
          <>
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

        </>
        ) : null}

        {activeSection === ActiveNavLabel.MAP ? mapContent : null}

        {activeSection === ActiveNavLabel.HOME ? (
        <section className="rounded-[28px] border border-[#E7DAC6] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFF1E4_100%)] p-5 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
          <p className="text-[10px] font-black uppercase text-[#A88763]">Next Delivery</p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[24px] font-black leading-tight text-[#2C1A0E]" style={headingFont}>
                {nextDisplayTask?.customerName || "No active tasks"}
              </h2>
              <p className="mt-2 text-sm font-semibold text-[#6B5B3E]">
                {nextDisplayTask?.address || "Wait for your next assignment"}
              </p>
              {nextDisplayTask?.date ? (
                <p className="mt-2 text-[10px] font-black uppercase text-[#A88763]">
                  {nextDisplayTask.date}
                  {nextDisplayTask?.slot
                    ? ` • ${nextDisplayTask.slot}${nextDisplayTask?.slotWindow ? ` (${nextDisplayTask.slotWindow})` : ""}`
                    : ""}
                </p>
              ) : null}
              {nextDisplayTaskSchedule?.helperText ? (
                <p className="mt-2 text-xs font-semibold text-[#8B7355]">
                  {nextDisplayTaskSchedule.helperText}
                </p>
              ) : null}
              {nextDisplayTask && (
                <p
                  className={`mt-3 text-[10px] font-black uppercase ${
                    nextDisplayTaskCoordinates ? "text-[#B8641A]" : "text-[#A88763]"
                  }`}
                >
                  {nextDisplayTaskCoordinates ? "Customer pin is ready on map" : "Customer pin not saved yet"}
                </p>
              )}
            </div>
            {nextDisplayTask && (
              <div className="rounded-[20px] border border-[#F0D9B9] bg-white px-4 py-3 text-center shadow-sm">
                <p className="text-lg font-black text-[#B8641A]">
                  {isDeliveryRunActive
                    ? "Delivering"
                    : startableDelivery?.id && String(startableDelivery.id) === String(nextDisplayTask.id)
                    ? "Ready"
                    : nextDisplayTask?.date && String(nextDisplayTask.date) > todayKey
                    ? "Tomorrow"
                    : "Queued"}
                </p>
                <p className="text-[9px] font-black uppercase text-[#A88763]">Status</p>
              </div>
            )}
          </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => {
                    if (nextDisplayTaskCoordinates) {
                      handleOpenMapSection();
                      setMapView(nextDisplayTaskCoordinates);
                      setZoomLevel(17);
                      setRecenterTrigger((prev) => prev + 1);
                    }
                  }}
                  disabled={!nextDisplayTaskCoordinates}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[18px] bg-[#B8641A] py-3.5 text-[11px] font-black uppercase text-white shadow-xl shadow-[#F2D9B8] transition hover:bg-[#9E5415] active:scale-[0.99] disabled:bg-[#CDB8A0]"
                >
                  <Navigation size={18} fill="currentColor" />
                  {nextDisplayTaskCoordinates ? "Open Map" : "No Customer Pin"}
                </button>
              </div>
            </section>
        ) : null}

        <div className="fixed bottom-6 left-1/2 z-50 flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-[#E7DAC6] bg-[#FFFDF7]/95 p-2 shadow-[0_18px_40px_rgba(92,61,30,0.14)] backdrop-blur-md">
          <NavTab
            icon={<Home size={18} />}
            label="Home"
            active={activeSection === ActiveNavLabel.HOME}
            onClick={handleOpenHomeSection}
          />
          <NavTab
            icon={<MapIcon size={18} />}
            label="Map"
            active={activeSection === ActiveNavLabel.MAP}
            onClick={handleOpenMapSection}
          />
          <NavTab icon={<List size={18} />} label="Tasks" onClick={() => navigate("/agent/working")} />
          <NavTab icon={<History size={18} />} label="History" onClick={() => navigate("/agent/history")} />
          <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;
