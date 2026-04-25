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
  Volume2,
  VolumeX,
  Settings2,
} from "lucide-react";

import {
  fetchAssignedAgentDeliveries,
  fetchAgentProfile,
  flushAgentOfflineQueue,
} from "../../api/agent/agent.api";
import { ensureSocketConnection } from "../../socket";
import {
  getCachedAgentLocation,
  getCachedAssignedAgentDeliveries,
  getPendingAgentSyncCount,
  storeAgentLocation,
  subscribeToAgentOfflineState,
} from "../../api/agent/offlineSync";
import { startDelivery, updateAgentLocation } from "../../api/agent/location.js";
import { useGeolocationAutoRetry } from "../../hooks/useGeolocationAutoRetry.js";

const headingFont = { fontFamily: "'Lora', serif" };
const DELIVERY_RUN_STORAGE_KEY = "agent-dashboard-delivery-run";
const SPEECH_MUTED_STORAGE_KEY = "agent-dashboard-speech-muted";
const MAP_DELIVERED_PATH_VISIBLE_KEY = "agent-map-show-delivered-path";
const MAP_DAIRY_PATH_VISIBLE_KEY = "agent-map-show-dairy-path";
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
const roadDistanceTableCache = new Map();

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

const fetchRoadDistanceTable = async (originCoordinates, deliveries, signal) => {
  if (!Array.isArray(originCoordinates) || !Array.isArray(deliveries) || deliveries.length === 0) {
    return {};
  }

  const validDeliveries = deliveries.filter((delivery) => Array.isArray(delivery?.coordinates));
  if (validDeliveries.length === 0) return {};

  const cacheKey = [
    originCoordinates[0].toFixed(4),
    originCoordinates[1].toFixed(4),
    validDeliveries
      .map(
        (delivery) =>
          `${delivery.id}:${delivery.coordinates[0].toFixed(4)}:${delivery.coordinates[1].toFixed(4)}`
      )
      .join("|"),
  ].join("::");

  if (roadDistanceTableCache.has(cacheKey)) {
    return roadDistanceTableCache.get(cacheKey);
  }

  const [originLat, originLng] = originCoordinates;
  const coordinatesParam = [
    `${originLng},${originLat}`,
    ...validDeliveries.map((delivery) => `${delivery.coordinates[1]},${delivery.coordinates[0]}`),
  ].join(";");

  const destinationsParam = validDeliveries.map((_, index) => index + 1).join(";");
  const url =
    `https://router.project-osrm.org/table/v1/driving/${coordinatesParam}` +
    `?sources=0&destinations=${destinationsParam}&annotations=distance`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Road distance table request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const distanceRow = Array.isArray(payload?.distances?.[0]) ? payload.distances[0] : [];

  const result = validDeliveries.reduce((accumulator, delivery, index) => {
    const distanceMeters = Number(distanceRow[index]);
    accumulator[String(delivery.id)] = Number.isFinite(distanceMeters) ? distanceMeters : null;
    return accumulator;
  }, {});

  roadDistanceTableCache.set(cacheKey, result);
  return result;
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

const getDairyCoordinates = (source) => {
  const lat = Number(
    source?.dairyLat ??
      source?.dairyLatitude ??
      source?.dairyFarmLat ??
      source?.dairyFarmLatitude ??
      source?.dairy?.latitude ??
      source?.dairy?.lat
  );
  const lng = Number(
    source?.dairyLng ??
      source?.dairyLongitude ??
      source?.dairyFarmLng ??
      source?.dairyFarmLongitude ??
      source?.dairy?.longitude ??
      source?.dairy?.lng
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

const getTurnInstructionIcon = (instruction) => {
  const text = String(instruction?.text || "").trim();
  if (/u-turn/i.test(text)) return Undo2;
  if (/turn right|keep right/i.test(text)) return CornerUpRight;
  if (/turn left|keep left/i.test(text)) return CornerUpLeft;
  return ArrowUp;
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

const isUnauthorizedError = (error) => Number(error?.response?.status) === 401;

const AgentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [stats, setStats] = useState({ totalAssigned: 0, completed: 0, pending: 0, failed: 0 });
  const [deliveries, setDeliveries] = useState(() => getCachedAssignedAgentDeliveries());
  const [agentProfile, setAgentProfile] = useState({ name: "", dairyName: "", dairyCoordinates: null });
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
  const [completedRoadRoutes, setCompletedRoadRoutes] = useState([]);
  const [dairyRoadRoute, setDairyRoadRoute] = useState([]);
  const [nearestByRoadDeliveryId, setNearestByRoadDeliveryId] = useState(null);
  const [deliveryRunStartedAt, setDeliveryRunStartedAt] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingAgentSyncCount());
  const [isSpeechMuted, setIsSpeechMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SPEECH_MUTED_STORAGE_KEY) === "true";
  });
  const [showMapSettings, setShowMapSettings] = useState(false);
  const [showDeliveredPath, setShowDeliveredPath] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(MAP_DELIVERED_PATH_VISIBLE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [showDairyPath, setShowDairyPath] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(MAP_DAIRY_PATH_VISIBLE_KEY);
    return stored === null ? true : stored === "true";
  });
  const lastLocationSyncAtRef = useRef(0);
  const spokenInstructionRef = useRef({ key: "", threshold: null });
  const authRedirectTriggeredRef = useRef(false);
  const locationWatcherIdRef = useRef(null);
  const joinedOrderIdsRef = useRef(new Set());
  const liveOrderIdsRef = useRef([]);
  const liveAgentIdRef = useRef(null);

  const agentSocketId = useMemo(() => {
    const directUser = user || {};
    const directId =
      directUser?.id ??
      directUser?._id ??
      directUser?.agentId ??
      directUser?.agent_id ??
      null;
    if (directId != null && String(directId).trim()) {
      return String(directId).trim();
    }

    try {
      const parsed = JSON.parse(localStorage.getItem("user") || "{}");
      const fallbackId =
        parsed?.id ??
        parsed?._id ??
        parsed?.agentId ??
        parsed?.agent_id ??
        parsed?.user?.id ??
        parsed?.user?._id ??
        parsed?.user?.agentId ??
        parsed?.user?.agent_id ??
        null;
      return fallbackId != null && String(fallbackId).trim() ? String(fallbackId).trim() : null;
    } catch {
      return null;
    }
  }, [user]);

  const handleAgentAuthFailure = useCallback(
    (error) => {
      if (!isUnauthorizedError(error) || authRedirectTriggeredRef.current) {
        return false;
      }

      authRedirectTriggeredRef.current = true;
      console.warn(
        "Agent request returned 401 during dashboard refresh. Preserving local session and current page."
      );
      return true;
    },
    []
  );

  const loadDashboard = useCallback(async () => {
    try {
      const assigned = await fetchAssignedAgentDeliveries();
      const resolved = assigned || [];
      setDeliveries(resolved);
    } catch (error) {
      if (handleAgentAuthFailure(error)) return;
      setDeliveries([]);
    }
  }, [handleAgentAuthFailure]);

  const startAgentLocationWatcher = useCallback(() => {
    if (!navigator.geolocation || locationWatcherIdRef.current !== null) {
      return;
    }

    locationWatcherIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setAgentLocation(coords);
        storeAgentLocation({ lat: coords[0], lng: coords[1] });

        const connectedSocket = ensureSocketConnection();
        const currentAgentId = liveAgentIdRef.current;
        const currentOrderIds = Array.isArray(liveOrderIdsRef.current) ? liveOrderIdsRef.current : [];
        const basePayload = {
          lat: coords[0],
          lng: coords[1],
          timestamp: Date.now(),
        };

        if (currentAgentId) {
          connectedSocket.emit("agent:locationUpdate", {
            ...basePayload,
            agentId: currentAgentId,
          });
        }

        currentOrderIds.forEach((orderId) => {
          connectedSocket.emit("agent:locationUpdate", {
            ...basePayload,
            orderId,
            agentId: currentAgentId || undefined,
          });
        });
      },
      (err) => console.error("GPS Error:", err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
          dairyCoordinates:
            getDairyCoordinates(parsed) ||
            getDairyCoordinates(parsed?.user) ||
            getDairyCoordinates(parsed?.dairy) ||
            getDairyCoordinates(parsed?.user?.dairy) ||
            prev.dairyCoordinates,
        }));
      } catch (_err) {}
    }

    loadDashboard();

    startAgentLocationWatcher();

    return () => {
      if (locationWatcherIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatcherIdRef.current);
        locationWatcherIdRef.current = null;
      }

      if (joinedOrderIdsRef.current.size > 0 || liveAgentIdRef.current) {
        const connectedSocket = ensureSocketConnection();
        joinedOrderIdsRef.current.forEach((orderId) => {
          connectedSocket.emit("agent:stopped", {
            orderId,
            agentId: liveAgentIdRef.current || undefined,
            isOnline: false,
            timestamp: Date.now(),
          });
          connectedSocket.emit("agent:leaveOrder", { orderId });
        });
        if (liveAgentIdRef.current) {
          connectedSocket.emit("agent:stopped", {
            agentId: liveAgentIdRef.current,
            isOnline: false,
            timestamp: Date.now(),
          });
          connectedSocket.emit("agent:leaveRoom", { agentId: liveAgentIdRef.current });
        }
      }
    };
  }, [loadDashboard, startAgentLocationWatcher]);

  useGeolocationAutoRetry({
    enabled: !agentLocation,
    onRetry: startAgentLocationWatcher,
  });

  useEffect(() => {
    const loadAgentProfile = async () => {
      try {
        const profile = await fetchAgentProfile();
        if (!profile) return;
        setAgentProfile((prev) => ({
          ...prev,
          name: profile?.name || prev.name,
          dairyName: profile?.dairyName || prev.dairyName,
          dairyCoordinates: getDairyCoordinates(profile) || prev.dairyCoordinates,
        }));
      } catch (error) {
        handleAgentAuthFailure(error);
      }
    };

    loadAgentProfile();
  }, [handleAgentAuthFailure]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      try {
        await flushAgentOfflineQueue();
      } catch (error) {
        if (handleAgentAuthFailure(error)) return;
      }
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
  }, [handleAgentAuthFailure, loadDashboard]);

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
  const liveTrackedOrderIds = useMemo(
    () =>
      deliveries
        .filter((delivery) => {
          const status = String(delivery?.status || "").toUpperCase();
          return status === "OUT_FOR_DELIVERY" || status === "IN_TRANSIT";
        })
        .map((delivery) => String(delivery?.id || "").trim())
        .filter(Boolean),
    [deliveries]
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

  useEffect(() => {
    liveOrderIdsRef.current = liveTrackedOrderIds;
  }, [liveTrackedOrderIds]);

  useEffect(() => {
    liveAgentIdRef.current = agentSocketId || null;
  }, [agentSocketId]);

  useEffect(() => {
    if (!agentSocketId) return undefined;
    const connectedSocket = ensureSocketConnection();
    connectedSocket.emit("agent:joinRoom", { agentId: agentSocketId });

    return () => {
      connectedSocket.emit("agent:leaveRoom", { agentId: agentSocketId });
    };
  }, [agentSocketId]);

  useEffect(() => {
    const connectedSocket = ensureSocketConnection();
    const currentSet = new Set(liveTrackedOrderIds);

    liveTrackedOrderIds.forEach((orderId) => {
      if (!joinedOrderIdsRef.current.has(orderId)) {
        connectedSocket.emit("agent:joinOrder", { orderId });
      }
    });

    joinedOrderIdsRef.current.forEach((orderId) => {
      if (!currentSet.has(orderId)) {
        connectedSocket.emit("agent:stopped", {
          orderId,
          agentId: liveAgentIdRef.current || undefined,
          isOnline: false,
          timestamp: Date.now(),
        });
        connectedSocket.emit("agent:leaveOrder", { orderId });
      }
    });

    joinedOrderIdsRef.current = currentSet;
  }, [liveTrackedOrderIds]);

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
  const routeSourceDeliveries = useMemo(() => {
    const sourceItems = isDeliveryRunActive ? todayOpenDeliveries : mapCandidateDeliveries;

    return sourceItems
      .map((delivery) => ({
        ...delivery,
        coordinates: getDeliveryCoordinates(delivery),
      }))
      .filter((delivery) => Array.isArray(delivery.coordinates));
  }, [isDeliveryRunActive, mapCandidateDeliveries, todayOpenDeliveries]);
  const completedMapDeliveries = useMemo(
    () =>
      todayDeliveries
        .filter((delivery) => String(delivery?.status || "").toUpperCase() === "COMPLETED")
        .map((delivery) => ({
          ...delivery,
          coordinates: getDeliveryCoordinates(delivery),
        }))
        .filter((delivery) => Array.isArray(delivery.coordinates)),
    [todayDeliveries]
  );

  const routeDeliveries = useMemo(() => {
    const mappedDeliveries = routeSourceDeliveries;

    const orderedDeliveries = agentLocation
      ? [...mappedDeliveries].sort((left, right) => {
          const leftDistance = getDistanceInMeters(agentLocation, left.coordinates);
          const rightDistance = getDistanceInMeters(agentLocation, right.coordinates);

          if (Number.isFinite(leftDistance) && Number.isFinite(rightDistance) && leftDistance !== rightDistance) {
            return leftDistance - rightDistance;
          }

          return compareScheduledDeliveries(left, right);
        })
      : mappedDeliveries.sort(compareScheduledDeliveries);

    return orderedDeliveries.filter((delivery, index, items) => {
        if (!agentLocation) return true;

        const distanceFromAgent = getDistanceInMeters(agentLocation, delivery.coordinates);
        if (!Number.isFinite(distanceFromAgent)) return false;
        if (distanceFromAgent <= MAX_ROUTE_PREVIEW_DISTANCE_METERS) return true;

        const nearestDistance = getDistanceInMeters(agentLocation, items[0]?.coordinates);
        return index === 0 && Number.isFinite(nearestDistance);
      });
  }, [agentLocation, routeSourceDeliveries]);
  const roadRankingOrigin = useMemo(
    () =>
      Array.isArray(agentLocation)
        ? [Number(agentLocation[0].toFixed(4)), Number(agentLocation[1].toFixed(4))]
        : null,
    [agentLocation?.[0], agentLocation?.[1]]
  );
  const roadRankingKey = useMemo(
    () =>
      routeDeliveries
        .map(
          (delivery) =>
            `${delivery.id}:${delivery.coordinates?.[0]?.toFixed?.(4)}:${delivery.coordinates?.[1]?.toFixed?.(4)}`
        )
        .join("|"),
    [routeDeliveries]
  );
  const roadRankingDeliveries = useMemo(
    () =>
      routeDeliveries.map((delivery) => ({
        id: delivery.id,
        coordinates: delivery.coordinates,
      })),
    [roadRankingKey, routeDeliveries]
  );
  const visibleMapDeliveries = useMemo(() => {
    const merged = [...routeDeliveries, ...completedMapDeliveries];
    const unique = new Map();
    merged.forEach((delivery) => {
      unique.set(String(delivery.id), delivery);
    });
    return [...unique.values()];
  }, [completedMapDeliveries, routeDeliveries]);
  const nearestRouteDelivery = useMemo(() => {
    if (!Array.isArray(routeDeliveries) || routeDeliveries.length === 0) return null;
    if (!nearestByRoadDeliveryId) return routeDeliveries[0] || null;
    return routeDeliveries.find((delivery) => String(delivery.id) === String(nearestByRoadDeliveryId)) || routeDeliveries[0] || null;
  }, [nearestByRoadDeliveryId, routeDeliveries]);
  const nearestRouteCoordinates = nearestRouteDelivery?.coordinates || null;
  const nextDirectionLabel = useMemo(
    () => getTurnInstructionLabel(primaryRouteStats.instructions?.primary),
    [primaryRouteStats.instructions]
  );
  const NextDirectionIcon = useMemo(
    () => getTurnInstructionIcon(primaryRouteStats.instructions?.primary),
    [primaryRouteStats.instructions]
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
  const dairyCoordinates = useMemo(
    () =>
      agentProfile.dairyCoordinates ||
      getDairyCoordinates(deliveries.find((delivery) => getDairyCoordinates(delivery))) ||
      null,
    [agentProfile.dairyCoordinates, deliveries]
  );
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
    const completedPoints = completedRoadRoutes.flatMap((segment) => segment.points);
    const dairyRoutePoints = Array.isArray(dairyRoadRoute) ? dairyRoadRoute : [];
    const deliveryPoints = visibleMapDeliveries.map((delivery) => delivery.coordinates).filter(Boolean);
    return [...primaryPoints, ...extraPoints, ...completedPoints, ...dairyRoutePoints, ...deliveryPoints, dairyCoordinates, agentLocation].filter(Boolean);
  }, [agentLocation, completedRoadRoutes, dairyCoordinates, dairyRoadRoute, routeCoordinates, secondaryRoadRoutes, secondaryRouteSegments, visibleMapDeliveries]);

  useEffect(() => {
    if (!roadRankingOrigin || roadRankingDeliveries.length === 0) {
      setNearestByRoadDeliveryId(null);
      return undefined;
    }

    if (roadRankingDeliveries.length === 1) {
      setNearestByRoadDeliveryId(String(roadRankingDeliveries[0].id));
      return undefined;
    }

    const controller = new AbortController();

    fetchRoadDistanceTable(roadRankingOrigin, roadRankingDeliveries, controller.signal)
      .then((distanceMap) => {
        let nearestId = null;
        let nearestDistance = Number.POSITIVE_INFINITY;

        roadRankingDeliveries.forEach((delivery) => {
          const distance = distanceMap[String(delivery.id)];
          if (!Number.isFinite(distance)) return;
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestId = String(delivery.id);
          }
        });

        setNearestByRoadDeliveryId(nearestId || String(roadRankingDeliveries[0].id));
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Nearest-by-road selection failed:", err);
        setNearestByRoadDeliveryId(String(roadRankingDeliveries[0].id));
      });

    return () => controller.abort();
  }, [roadRankingDeliveries, roadRankingKey, roadRankingOrigin]);

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
    if (activeSection !== ActiveNavLabel.MAP || !agentLocation || completedMapDeliveries.length === 0) {
      setCompletedRoadRoutes([]);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      Promise.all(
        completedMapDeliveries.map(async (delivery) => {
          const roadRoute = await fetchRoadRoute(agentLocation, delivery.coordinates, controller.signal);
          return {
            id: `completed-${delivery.id}`,
            points:
              Array.isArray(roadRoute?.points) && roadRoute.points.length >= 2
                ? roadRoute.points
                : [agentLocation, delivery.coordinates].filter(Boolean),
          };
        })
      )
        .then((segments) => {
          setCompletedRoadRoutes(Array.isArray(segments) ? segments : []);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          console.error("Completed road route fetch failed:", err);
          setCompletedRoadRoutes(
            completedMapDeliveries.map((delivery) => ({
              id: `completed-${delivery.id}`,
              points: [agentLocation, delivery.coordinates].filter(Boolean),
            }))
          );
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeSection, agentLocation?.[0], agentLocation?.[1], completedMapDeliveries]);

  useEffect(() => {
    if (activeSection !== ActiveNavLabel.MAP || !agentLocation || !dairyCoordinates) {
      setDairyRoadRoute([]);
      return undefined;
    }

    const controller = new AbortController();

    fetchRoadRoute(agentLocation, dairyCoordinates, controller.signal)
      .then((routeData) => {
        if (Array.isArray(routeData?.points) && routeData.points.length >= 2) {
          setDairyRoadRoute(routeData.points);
          return;
        }
        setDairyRoadRoute([agentLocation, dairyCoordinates].filter(Boolean));
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Dairy road route fetch failed:", err);
        setDairyRoadRoute([agentLocation, dairyCoordinates].filter(Boolean));
      });

    return () => controller.abort();
  }, [activeSection, agentLocation?.[0], agentLocation?.[1], dairyCoordinates?.[0], dairyCoordinates?.[1]]);

  useEffect(() => {
    if (!isDeliveryRunActive || !nextTask?.id || !agentLocation) return;

    const nowTs = Date.now();
    if (nowTs - lastLocationSyncAtRef.current < 15000) return;
    lastLocationSyncAtRef.current = nowTs;

    updateAgentLocation(nextTask.id, agentLocation[0], agentLocation[1]).catch((error) => {
      if (handleAgentAuthFailure(error)) return;
      console.error("Agent location sync failed:", error);
    });
  }, [agentLocation, handleAgentAuthFailure, isDeliveryRunActive, nextTask?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SPEECH_MUTED_STORAGE_KEY, String(isSpeechMuted));

    if (isSpeechMuted && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [isSpeechMuted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MAP_DELIVERED_PATH_VISIBLE_KEY, String(showDeliveredPath));
  }, [showDeliveredPath]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MAP_DAIRY_PATH_VISIBLE_KEY, String(showDairyPath));
  }, [showDairyPath]);

  useEffect(() => {
    if (!isDeliveryRunActive || typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      spokenInstructionRef.current = { key: "", threshold: null };
      return;
    }

    if (isSpeechMuted) {
      window.speechSynthesis.cancel();
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
  }, [isDeliveryRunActive, isSpeechMuted, nearestRouteDelivery?.id, primaryRouteStats.instructions]);

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
      const connectedSocket = ensureSocketConnection();
      const orderId = String(startableDelivery.id);
      connectedSocket.emit("agent:joinOrder", { orderId });
      connectedSocket.emit("agent:locationUpdate", {
        orderId,
        agentId: liveAgentIdRef.current || undefined,
        lat: agentLocation[0],
        lng: agentLocation[1],
        timestamp: Date.now(),
      });
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

  const handleOpenDeliveryTask = useCallback(
    (delivery) => {
      if (!delivery?.id) return;
      const buildingName = String(delivery.buildingName || delivery.building_name || "").trim();
      if (!buildingName) return;

      navigate(`/agent/working/building/${encodeURIComponent(buildingName)}`, {
        state: { selectedDeliveryId: String(delivery.id) },
      });
    },
    [navigate]
  );

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
            activeSection === ActiveNavLabel.MAP ? "h-full min-h-0" : "h-[360px]"
          }`}
        >
            {isDeliveryRunActive && primaryRouteStats.instructions?.primary ? (
              <div className="pointer-events-none absolute left-[58px] top-3 z-[500] w-[255px] max-w-[255px] rounded-[16px] border border-white/75 bg-white/90 px-3 py-1 shadow-[0_10px_24px_rgba(44,26,14,0.12)] backdrop-blur-sm">
                <div className="flex items-start gap-1.5">
                  <div className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#F0D9B9] bg-[#FFF4E2] text-[#B8641A]">
                    <NextDirectionIcon size={14} strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 space-y-0">
                    <p className="m-0 text-[9px] font-black uppercase leading-none text-[#A88763]">
                      {nextDirectionLabel ? `Next ${nextDirectionLabel}` : "Next Turn"}
                    </p>
                  <p className="m-0 text-[11px] font-black leading-[1.15] text-[#2C1A0E]">
                      {primaryRouteStats.instructions?.primary?.distanceLabel
                        ? `After ${primaryRouteStats.instructions.primary.distanceLabel}, ${primaryRouteStats.instructions.primary.text}`
                        : "Follow the highlighted route"}
                    </p>
                    {primaryRouteStats.instructions?.secondary ? (
                      <p className="m-0 text-[10px] font-semibold leading-[1.15] text-[#8B7355]">
                        Then after {primaryRouteStats.instructions.secondary.distanceLabel},{" "}
                        {primaryRouteStats.instructions.secondary.text.toLowerCase()}
                      </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

            {agentLocation ? (
              <div className="relative h-full w-full">
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

              {dairyCoordinates ? (
                <Marker
                  position={dairyCoordinates}
                  icon={L.divIcon({
                    className: "custom-div-icon",
                    html:
                      '<div style="background-color: #D93025; width: 16px; height: 16px; border-radius: 999px; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(44,26,14,0.2);"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                  })}
                >
                  <Popup className="[&_.leaflet-popup-content]:mb-1.5 [&_.leaflet-popup-content]:mt-0.5 [&_.leaflet-popup-content]:mx-2">
                    <div className="space-y-0.5 leading-tight">
                      <p className="m-0 text-[11px] font-bold text-[#2C1A0E]">{dairyName}</p>
                      <p className="m-0 text-[10px] font-semibold text-[#D93025]">Dairy location</p>
                    </div>
                  </Popup>
                </Marker>
              ) : null}

              {visibleMapDeliveries.map((delivery) => {
                const coordinates = delivery.coordinates || getDeliveryCoordinates(delivery);
                if (!coordinates) return null;

                const isCompleted = String(delivery?.status || "").toUpperCase() === "COMPLETED";
                const isNearestDestination = String(delivery.id) === String(nearestRouteDelivery?.id);
                const isNextDestination = String(delivery.id) === String(nextTask?.id);
                const markerColor =
                  isCompleted
                    ? "#9CA3AF"
                    : isNearestDestination
                      ? "#6BB071"
                      : "#6BB071";

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
                      <Popup className="[&_.leaflet-popup-content]:mb-1.5 [&_.leaflet-popup-content]:mt-0.5 [&_.leaflet-popup-content]:mx-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDeliveryTask(delivery)}
                          className="space-y-0.5 text-left leading-tight"
                        >
                          <p className="m-0 text-[11px] font-bold text-[#2C1A0E]">{delivery.customerName}</p>
                          <p className="text-[10px] text-[#6B5B3E]">{delivery.address}</p>
                          <p className={`text-[10px] font-semibold ${isCompleted ? "text-[#6B7280]" : "text-[#6BB071]"}`}>
                            {isCompleted
                              ? "Delivered customer"
                              : isNearestDestination
                              ? "Nearest customer on your route"
                              : isNextDestination
                                ? "Next scheduled delivery"
                                : "Customer delivery pin"}
                          </p>
                          <p className="pt-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#8B7355]">
                            Tap to open task
                          </p>
                        </button>
                      </Popup>
                    </Marker>
                );
              })}

              {routeCoordinates.length >= 2 && (
                <Polyline
                  positions={routeCoordinates}
                  pathOptions={{ color: "#5c87ea", weight: 5, opacity: 0.9 }}
                />
              )}

              {showDairyPath && dairyRoadRoute.length >= 2 && (
                <Polyline
                  positions={dairyRoadRoute}
                  pathOptions={{
                    color: "#FCA5A5",
                    weight: 4,
                    opacity: 0.95,
                    dashArray: "8 8",
                  }}
                />
              )}

              {showDeliveredPath &&
                completedRoadRoutes.map((segment, index) => (
                <Polyline
                  key={segment.id || `completed-route-${index}`}
                  positions={segment.points}
                  pathOptions={{
                    color: "#9CA3AF",
                    weight: 3,
                    opacity: 0.85,
                    dashArray: "7 9",
                  }}
                />
              ))}

                {(secondaryRoadRoutes.length > 0 ? secondaryRoadRoutes : secondaryRouteSegments).map(
                (segment, index) => (
                  <Polyline
                    key={segment.id || `secondary-route-${index}`}
                    positions={segment.points}
                    pathOptions={{
                      color: "#191970",
                      weight: 3,
                      opacity: 0.8,
                      dashArray: "8 10",
                    }}
                  />
                )
              )}
                </MapContainer>
                <button
                  type="button"
                  onClick={() => setIsSpeechMuted((value) => !value)}
                  className="absolute left-[10px] top-[78px] z-[600] flex h-[30px] w-[30px] items-center justify-center rounded-[4px] border border-[#D4B896] bg-white text-[#5F4426] shadow-[0_4px_10px_rgba(44,26,14,0.16)] transition hover:bg-[#FFF8EF]"
                  title={isSpeechMuted ? "Unmute voice directions" : "Mute voice directions"}
                  aria-label={isSpeechMuted ? "Unmute voice directions" : "Mute voice directions"}
                >
                  {isSpeechMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMapSettings((value) => !value)}
                  className="absolute left-[10px] top-[114px] z-[600] flex h-[30px] w-[30px] items-center justify-center rounded-[4px] border border-[#D4B896] bg-white text-[#5F4426] shadow-[0_4px_10px_rgba(44,26,14,0.16)] transition hover:bg-[#FFF8EF]"
                  title="Map path settings"
                  aria-label="Map path settings"
                >
                  <Settings2 size={16} />
                </button>
                {showMapSettings ? (
                  <div className="absolute left-[46px] top-[114px] z-[610] w-[200px] rounded-[12px] border border-[#E7DAC6] bg-white/95 p-3 shadow-[0_10px_24px_rgba(44,26,14,0.16)] backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8B7355]">Path Settings</p>
                    <label className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#5F4426]">
                      Delivered customer path
                      <input
                        type="checkbox"
                        checked={showDeliveredPath}
                        onChange={(event) => setShowDeliveredPath(event.target.checked)}
                        className="h-4 w-4 accent-[#B8641A]"
                      />
                    </label>
                    <label className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#5F4426]">
                      Dairy location path
                      <input
                        type="checkbox"
                        checked={showDairyPath}
                        onChange={(event) => setShowDairyPath(event.target.checked)}
                        className="h-4 w-4 accent-[#B8641A]"
                      />
                    </label>
                  </div>
                ) : null}
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[600] rounded-[16px] border border-white/70 bg-white/88 px-3 py-2 shadow-[0_10px_24px_rgba(44,26,14,0.12)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold leading-snug text-[#6B5B3E]">
                    {isDeliveryRunActive
                      ? "Solid line shows the nearest customer. Dotted lines show the remaining customers on your route."
                      : "The map highlights the nearest customer and previews the rest of the route."}
                  </p>
                </div>
              </div>
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

    </section>
  );

  return (
    <div
      className={`bg-[#FFFDF7] px-4 text-[#2C1A0E] ${
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
