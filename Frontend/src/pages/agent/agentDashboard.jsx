import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  Package,
  CheckCircle,
  CheckCircle2,
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
  Building2,
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
import {
  buildBuildingTaskGroups,
  separateBuildingTaskGroups,
  calculateDetailedDeliverySummary,
  formatQuantity,
} from "../../utils/agentTaskGrouping.js";
import {
  buildSpokenInstruction,
  fetchRoadRoute,
  fetchRoadDistanceTable,
  formatDistanceLabel,
  formatDurationLabel,
  getDeliveryCoordinates,
  getDairyCoordinates,
  getDistanceInMeters,
  getTurnInstructionLabel,
  getTurnInstructionIcon,
  getAutoZoomLevel,
} from "../../utils/agentRouting";

import {
  getLocalDateKey,
  compareScheduledDeliveries,
  getDeliveryScheduleState,
} from "../../utils/agentSchedule";
import {
  ActiveNavLabel,
  DELIVERY_RUN_STORAGE_KEY,
  SPEECH_MUTED_STORAGE_KEY,
  MAP_DELIVERED_PATH_VISIBLE_KEY,
  MAP_DAIRY_PATH_VISIBLE_KEY,
  MAX_ROUTE_PREVIEW_DISTANCE_METERS,
  headingFont,
} from "../../constants/agent";
import { MapController } from "../../components/agent/MapController";
import { StatCard } from "../../components/agent/dashboard/StatCard";
import { NavTab } from "../../components/agent/dashboard/NavTab";
import { GoogleMapsBadgeIcon } from "../../components/agent/dashboard/GoogleMapsBadgeIcon";

const DefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const isUnauthorizedError = (error) => Number(error?.response?.status) === 401;

const formatSizeLabel = (label) => {
  if (!label) return "Standard";
  return String(label).replace(/^(\d+(?:\.\d+)?)(L|ml|kg|g)$/i, "$1 $2").trim();
};

const AgentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

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
  const [dairyRoadRoute, setDairyRoadRoute] = useState([]);
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
  const gpsRetryTimeoutRef = useRef(null);

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
        // Clear any scheduled retry timeout upon successful location acquisition
        if (gpsRetryTimeoutRef.current !== null) {
          clearTimeout(gpsRetryTimeoutRef.current);
          gpsRetryTimeoutRef.current = null;
        }

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
      (err) => {
        console.error("GPS Error:", err.message);
        // Clear current failed watch
        if (locationWatcherIdRef.current !== null) {
          navigator.geolocation.clearWatch(locationWatcherIdRef.current);
          locationWatcherIdRef.current = null;
        }
        // Retry connection in 0.5 seconds
        if (gpsRetryTimeoutRef.current !== null) {
          clearTimeout(gpsRetryTimeoutRef.current);
        }
        gpsRetryTimeoutRef.current = setTimeout(() => {
          startAgentLocationWatcher();
        }, 500);
      },
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
      } catch {
        /* ignore */
      }
    }

    loadDashboard();

    startAgentLocationWatcher();

    return () => {
      if (locationWatcherIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatcherIdRef.current);
        locationWatcherIdRef.current = null;
      }

      if (gpsRetryTimeoutRef.current !== null) {
        clearTimeout(gpsRetryTimeoutRef.current);
        gpsRetryTimeoutRef.current = null;
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
    } catch {
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
  const _nextTaskSchedule = useMemo(
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
  const carrySummary = useMemo(() => {
    const sourceDeliveries = todayDeliveries.length > 0 ? todayDeliveries : todayOpenDeliveries;
    return calculateDetailedDeliverySummary(sourceDeliveries);
  }, [todayDeliveries, todayOpenDeliveries]);

  const milkCarryRows = useMemo(() => {
    if (!carrySummary?.milkTypes) return [];
    const rows = [];
    carrySummary.milkTypes.forEach((item) => {
      if (item.breakdown && item.breakdown.length > 0) {
        item.breakdown.forEach((b) => {
          rows.push({
            productName: item.name,
            size: b.sizeLabel || "Standard",
            packets: b.packets,
          });
        });
      } else {
        rows.push({
          productName: item.name,
          size: "Standard",
          packets: item.totalPackets,
        });
      }
    });
    return rows;
  }, [carrySummary]);

  useEffect(() => {
    setStats(statsForToday);
  }, [statsForToday]);


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

  // Group today's deliveries by building
  const todayBuildingGroups = useMemo(
    () => buildBuildingTaskGroups(todayDeliveries),
    [todayDeliveries]
  );
  const { active: activeBuildings, completed: completedBuildings } = useMemo(
    () => separateBuildingTaskGroups(todayBuildingGroups),
    [todayBuildingGroups]
  );

  const [buildingRoadDistanceMap, setBuildingRoadDistanceMap] = useState({});

  const activeBuildingsWithCoords = useMemo(
    () => activeBuildings.filter((b) => Array.isArray(b.coordinates)),
    [activeBuildings]
  );

  const buildingRoadRankingKey = useMemo(
    () =>
      activeBuildingsWithCoords
        .map((b) => `${b.buildingName}:${b.coordinates[0]?.toFixed?.(4)}:${b.coordinates[1]?.toFixed?.(4)}`)
        .join("|"),
    [activeBuildingsWithCoords]
  );

  const roadOrigin = useMemo(
    () =>
      Array.isArray(agentLocation)
        ? [Number(agentLocation[0].toFixed(4)), Number(agentLocation[1].toFixed(4))]
        : null,
    [agentLocation?.[0], agentLocation?.[1]]
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
        console.error("Active building road distance ranking failed:", err);
      });

    return () => controller.abort();
  }, [buildingRoadRankingKey, roadOrigin]);

  const orderedActiveBuildings = useMemo(() => {
    if (activeBuildings.length === 0) return [];
    return [...activeBuildings].sort((a, b) => {
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
  }, [activeBuildings, agentLocation, buildingRoadDistanceMap]);

  const currentDestinationBuilding = orderedActiveBuildings[0] || null;
  const currentDestinationCoordinates = currentDestinationBuilding?.coordinates || null;

  const distanceToDestination = useMemo(() => {
    if (primaryRouteStats.distanceMeters !== null) return primaryRouteStats.distanceMeters;
    if (agentLocation && currentDestinationCoordinates) {
      return getDistanceInMeters(agentLocation, currentDestinationCoordinates);
    }
    return null;
  }, [agentLocation, currentDestinationCoordinates, primaryRouteStats.distanceMeters]);

  // Arrival detection with GPS stability (2 consecutive readings <= 55m) and idempotency
  const consecutiveArrivalReadingsRef = useRef(0);
  const hasTriggeredArrivalForBuildingRef = useRef(null);
  const lastDestinationBuildingRef = useRef(null);
  const [isArrivedAtDestination, setIsArrivedAtDestination] = useState(false);

  useEffect(() => {
    if (!agentLocation || !currentDestinationCoordinates || !currentDestinationBuilding) {
      consecutiveArrivalReadingsRef.current = 0;
      setIsArrivedAtDestination(false);
      return;
    }

    const buildingName = currentDestinationBuilding.buildingName;
    if (lastDestinationBuildingRef.current !== buildingName) {
      lastDestinationBuildingRef.current = buildingName;
      hasTriggeredArrivalForBuildingRef.current = null;
      consecutiveArrivalReadingsRef.current = 0;
      setIsArrivedAtDestination(false);
    }

    const distance = getDistanceInMeters(agentLocation, currentDestinationCoordinates);
    if (!Number.isFinite(distance)) return;

    if (distance <= 55) {
      consecutiveArrivalReadingsRef.current += 1;
      if (consecutiveArrivalReadingsRef.current >= 2) {
        setIsArrivedAtDestination(true);
        if (hasTriggeredArrivalForBuildingRef.current !== buildingName) {
          hasTriggeredArrivalForBuildingRef.current = buildingName;
          navigate(`/agent/working/building/${encodeURIComponent(buildingName)}`);
        }
      }
    } else if (distance > 75) {
      consecutiveArrivalReadingsRef.current = 0;
      setIsArrivedAtDestination(false);
    }
  }, [agentLocation, currentDestinationBuilding, currentDestinationCoordinates, navigate]);

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

  const nextDirectionLabel = useMemo(
    () => getTurnInstructionLabel(primaryRouteStats.instructions?.primary),
    [primaryRouteStats.instructions]
  );
  const NextDirectionIcon = useMemo(
    () => getTurnInstructionIcon(primaryRouteStats.instructions?.primary),
    [primaryRouteStats.instructions]
  );

  const routeCoordinates = useMemo(() => {
    if (!agentLocation || !currentDestinationCoordinates) return [];
    if (primaryRoadRoute.length >= 2) return primaryRoadRoute;
    return [agentLocation, currentDestinationCoordinates].filter(Boolean);
  }, [agentLocation, currentDestinationCoordinates, primaryRoadRoute]);

  const secondaryRouteSegments = useMemo(() => {
    if (orderedActiveBuildings.length < 2) return [];
    return orderedActiveBuildings
      .slice(0, -1)
      .map((building, index) => {
        const nextB = orderedActiveBuildings[index + 1];
        if (!building.coordinates || !nextB?.coordinates) return null;
        return {
          id: `${building.buildingName}-${nextB.buildingName}`,
          points: [building.coordinates, nextB.coordinates],
        };
      })
      .filter(Boolean);
  }, [orderedActiveBuildings]);

  useEffect(() => {
    if (hasAutoFocusedDestination) return;

    if (currentDestinationCoordinates) {
      setMapView(currentDestinationCoordinates);
      setZoomLevel(17);
      setHasAutoFocusedDestination(true);
      return;
    }

    if (!mapView && agentLocation) {
      setMapView(agentLocation);
      setZoomLevel(15);
    }
  }, [agentLocation, currentDestinationCoordinates, hasAutoFocusedDestination, mapView]);

  useEffect(() => {
    if (!currentDestinationCoordinates || !agentLocation) return;
    setZoomLevel(getAutoZoomLevel(distanceToDestination));
  }, [agentLocation, currentDestinationCoordinates, distanceToDestination]);

  useEffect(() => {
    if (!agentLocation || !currentDestinationCoordinates) {
      setPrimaryRoadRoute([]);
      setPrimaryRouteStats({ distanceMeters: null, durationSeconds: null, instructions: null });
      return undefined;
    }

    const controller = new AbortController();

    fetchRoadRoute(agentLocation, currentDestinationCoordinates, controller.signal)
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
        console.error("Agent destination road route fetch failed:", err);
        setPrimaryRoadRoute([]);
        setPrimaryRouteStats({ distanceMeters: null, durationSeconds: null, instructions: null });
      });

    return () => controller.abort();
  }, [
    agentLocation?.[0],
    agentLocation?.[1],
    currentDestinationCoordinates?.[0],
    currentDestinationCoordinates?.[1],
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
    if (!currentDestinationBuilding?.buildingName || !primaryInstruction?.text) return;

    const routeKey = `${currentDestinationBuilding.buildingName}:${primaryInstruction.text}`;
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
  }, [isDeliveryRunActive, isSpeechMuted, currentDestinationBuilding?.buildingName, primaryRouteStats.instructions]);

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

  const handleOpenBuildingTask = useCallback(
    (buildingName) => {
      const target = buildingName || currentDestinationBuilding?.buildingName;
      if (!target) return;
      navigate(`/agent/working/building/${encodeURIComponent(target)}`);
    },
    [currentDestinationBuilding?.buildingName, navigate]
  );

  const handleOpenGoogleMapsRoute = useCallback(
    (target) => {
      const destination =
        target?.coordinates ||
        (Array.isArray(target) ? target : null) ||
        getDeliveryCoordinates(target) ||
        currentDestinationCoordinates;
      if (!destination) return;

      const [destinationLat, destinationLng] = destination;
      const hasAgentLocation =
        Array.isArray(agentLocation) &&
        Number.isFinite(Number(agentLocation[0])) &&
        Number.isFinite(Number(agentLocation[1]));

      const directionsBaseUrl = "https://www.google.com/maps/dir/?api=1";
      const destinationParam = `destination=${destinationLat},${destinationLng}`;
      const travelModeParam = "travelmode=driving";
      const originParam = hasAgentLocation
        ? `&origin=${agentLocation[0]},${agentLocation[1]}`
        : "";
      const googleMapsUrl = `${directionsBaseUrl}&${destinationParam}${originParam}&${travelModeParam}`;

      window.open(googleMapsUrl, "_blank", "noopener,noreferrer");
    },
    [agentLocation, currentDestinationCoordinates]
  );

  const handleOpenGoogleMapsAllCustomers = useCallback(() => {
    const buildingCoordinates = (activeBuildings || [])
      .map((b) => b?.coordinates)
      .filter((coordinates) => Array.isArray(coordinates));

    if (buildingCoordinates.length === 0) return;

    const hasAgentLocation =
      Array.isArray(agentLocation) &&
      Number.isFinite(Number(agentLocation[0])) &&
      Number.isFinite(Number(agentLocation[1]));
    const toCoordinateParam = (coordinates) => `${coordinates[0]},${coordinates[1]}`;

    if (buildingCoordinates.length === 1) {
      const singleDestinationUrl =
        `https://www.google.com/maps/dir/?api=1&destination=${toCoordinateParam(buildingCoordinates[0])}` +
        `${hasAgentLocation ? `&origin=${toCoordinateParam(agentLocation)}` : ""}&travelmode=driving`;
      window.open(singleDestinationUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const maxStops = 10;
    const selectedStops = buildingCoordinates.slice(0, maxStops);
    const destination = selectedStops[selectedStops.length - 1];
    const waypoints = selectedStops.slice(0, -1);
    const waypointsParam =
      waypoints.length > 0
        ? `&waypoints=${encodeURIComponent(waypoints.map(toCoordinateParam).join("|"))}`
        : "";
    const allCustomersUrl =
      `https://www.google.com/maps/dir/?api=1&destination=${toCoordinateParam(destination)}` +
      `${hasAgentLocation ? `&origin=${toCoordinateParam(agentLocation)}` : ""}` +
      `${waypointsParam}&travelmode=driving`;

    window.open(allCustomersUrl, "_blank", "noopener,noreferrer");
  }, [activeBuildings, agentLocation]);

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
    <section className="flex min-h-0 flex-1 flex-col gap-2.5 px-0 py-0">
      <div className="flex items-center justify-between gap-2 rounded-[18px] border border-[#EDE8DF] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(92,61,30,0.07)]">
        <div className="flex items-center gap-2">
          <MapIcon size={16} className="text-[#B8641A]" />
          <div>
            <p className="text-[10px] font-black uppercase text-[#A88763]">Delivery Navigation</p>
            <p className="text-xs font-medium text-[#6B5B3E]">
              {currentDestinationBuilding
                ? `Active building: ${currentDestinationBuilding.buildingName}`
                : "All today's deliveries completed."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (agentLocation) {
                setMapView(agentLocation);
                setZoomLevel(16);
                setRecenterTrigger((prev) => prev + 1);
              }
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
          {/* FLOATING TOP DESTINATION / ARRIVAL BANNER */}
          {currentDestinationBuilding ? (
            <div className="pointer-events-auto absolute left-3 right-3 top-3 z-[500] max-w-md mx-auto rounded-[20px] border border-white/80 bg-white/95 px-3.5 py-2.5 shadow-[0_12px_28px_rgba(44,26,14,0.14)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#F0D9B9] bg-[#FFF4E2] text-[#B8641A]">
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-[#2C1A0E]">
                      {currentDestinationBuilding.buildingName}
                    </p>
                    <p className="text-[10px] font-bold text-[#8B7355]">
                      {formatDistanceLabel(distanceToDestination)} • {formatDurationLabel(primaryRouteStats.durationSeconds)} • {currentDestinationBuilding.pendingCount} drops
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenBuildingTask(currentDestinationBuilding.buildingName)}
                  className="shrink-0 rounded-[14px] bg-[#B8641A] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-md transition hover:bg-[#9E5415]"
                >
                  {isArrivedAtDestination ? "Arrived - Open" : "Open Task"}
                </button>
              </div>
              {isArrivedAtDestination && (
                <div className="mt-2 rounded-[12px] bg-[#EEF5E7] px-2.5 py-1 text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#4A7C2F]">
                  ✓ You've arrived at {currentDestinationBuilding.buildingName}
                </div>
              )}
              {primaryRouteStats.instructions?.primary && (
                <div className="mt-1.5 border-t border-[#F0E6D8] pt-1 text-[10px] font-medium text-[#6B5B3E]">
                  {nextDirectionLabel}: {primaryRouteStats.instructions.primary.text}
                </div>
              )}
            </div>
          ) : (
            <div className="pointer-events-auto absolute left-3 right-3 top-3 z-[500] max-w-md mx-auto rounded-[18px] border border-white/80 bg-white/95 px-3 py-2 shadow-md text-center text-xs font-bold text-[#4A7C2F]">
              ✓ All deliveries completed for today!
            </div>
          )}

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
                
                {/* Agent location circle */}
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

                {/* Dairy marker */}
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

                {/* Primary Destination Building Marker */}
                {currentDestinationBuilding && currentDestinationCoordinates && (
                  <Marker
                    position={currentDestinationCoordinates}
                    icon={L.divIcon({
                      className: "custom-div-icon",
                      html: `<div style="background-color: #B8641A; width: 22px; height: 22px; border-radius: 999px; border: 3px solid #ffffff; box-shadow: 0 0 0 3px #B8641A, 0 6px 16px rgba(44,26,14,0.3); display: flex; align-items: center; justify-content: center;"><div style="width: 6px; height: 6px; border-radius: 999px; background: white;"></div></div>`,
                      iconSize: [22, 22],
                      iconAnchor: [11, 11],
                    })}
                  >
                    <Popup className="[&_.leaflet-popup-content]:mb-1.5 [&_.leaflet-popup-content]:mt-0.5 [&_.leaflet-popup-content]:mx-2">
                      <div className="space-y-1.5 text-left leading-tight">
                        <p className="m-0 text-xs font-black text-[#2C1A0E]">
                          {currentDestinationBuilding.buildingName}
                        </p>
                        <p className="text-[10px] font-bold text-[#B8641A]">
                          ● Current Active Destination
                        </p>
                        <p className="text-[10px] font-semibold text-[#6B5B3E]">
                          {currentDestinationBuilding.pendingCount} {currentDestinationBuilding.pendingCount === 1 ? "delivery" : "deliveries"} remaining
                        </p>
                        <p className="text-[10px] font-semibold text-[#8B7355]">
                          {formatDistanceLabel(distanceToDestination)} • {formatDurationLabel(primaryRouteStats.durationSeconds)}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenBuildingTask(currentDestinationBuilding.buildingName)}
                            className="inline-flex items-center justify-center rounded-[10px] bg-[#B8641A] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#9E5415]"
                          >
                            Open Building Task
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenGoogleMapsRoute(currentDestinationCoordinates)}
                            className="inline-flex items-center justify-center rounded-[10px] border border-[#D9E7C8] bg-[#EEF5E7] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#4A7C2F] transition hover:bg-[#E6F2DB]"
                          >
                            Google Maps
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Secondary Active Buildings */}
                {orderedActiveBuildings.slice(1).map((building) => {
                  if (!building.coordinates) return null;
                  return (
                    <Marker
                      key={`building-${building.buildingName}`}
                      position={building.coordinates}
                      icon={L.divIcon({
                        className: "custom-div-icon",
                        html: `<div style="background-color: #4A7C2F; width: 14px; height: 14px; border-radius: 999px; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(44,26,14,0.16);"></div>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7],
                      })}
                    >
                      <Popup className="[&_.leaflet-popup-content]:mb-1.5 [&_.leaflet-popup-content]:mt-0.5 [&_.leaflet-popup-content]:mx-2">
                        <div className="space-y-1.5 text-left leading-tight">
                          <p className="m-0 text-xs font-black text-[#2C1A0E]">{building.buildingName}</p>
                          <p className="text-[10px] font-semibold text-[#4A7C2F]">{building.pendingCount} pending deliveries</p>
                          <button
                            type="button"
                            onClick={() => handleOpenBuildingTask(building.buildingName)}
                            className="inline-flex items-center justify-center rounded-[10px] border border-[#E7DAC6] bg-[#FFF8EF] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#8B5E34] transition hover:bg-[#FFF1E4]"
                          >
                            Open Building Task
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Completed Buildings (Greyed) */}
                {completedBuildings.map((building) => {
                  if (!building.coordinates) return null;
                  return (
                    <Marker
                      key={`completed-bld-${building.buildingName}`}
                      position={building.coordinates}
                      icon={L.divIcon({
                        className: "custom-div-icon",
                        html: `<div style="background-color: #9CA3AF; width: 12px; height: 12px; border-radius: 999px; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.15);"></div>`,
                        iconSize: [12, 12],
                        iconAnchor: [6, 6],
                      })}
                    >
                      <Popup className="[&_.leaflet-popup-content]:mb-1.5 [&_.leaflet-popup-content]:mt-0.5 [&_.leaflet-popup-content]:mx-2">
                        <div className="space-y-1 text-left leading-tight">
                          <p className="m-0 text-xs font-bold text-[#6B7280]">{building.buildingName}</p>
                          <p className="text-[10px] font-semibold text-[#6B7280]">✓ All deliveries completed</p>
                          <button
                            type="button"
                            onClick={() => handleOpenBuildingTask(building.buildingName)}
                            className="inline-flex items-center justify-center rounded-[10px] border border-[#EDE8DF] bg-[#F9F7F3] px-2 py-0.5 text-[9px] font-bold text-[#8B7355]"
                          >
                            View Details
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Route polyline to current destination */}
                {routeCoordinates.length >= 2 && (
                  <Polyline
                    positions={routeCoordinates}
                    pathOptions={{ color: "#5c87ea", weight: 5, opacity: 0.9 }}
                  />
                )}

                {/* Dairy route path */}
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

                {/* Secondary route connecting active buildings */}
                {(secondaryRoadRoutes.length > 0 ? secondaryRoadRoutes : secondaryRouteSegments).map((segment, index) => (
                  <Polyline
                    key={segment.id || `secondary-route-${index}`}
                    positions={segment.points}
                    pathOptions={{
                      color: "#191970",
                      weight: 3,
                      opacity: 0.7,
                      dashArray: "8 10",
                    }}
                  />
                ))}
              </MapContainer>

              <div className="absolute bottom-[18px] right-[55px] z-[1000] bg-white/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-[#8B7355] pointer-events-none select-none rounded border border-[#EDE8DF]/40">
                DairyVision Maps
              </div>

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

              <button
                type="button"
                onClick={handleOpenGoogleMapsAllCustomers}
                disabled={activeBuildingsWithCoords.length === 0}
                className="absolute left-[10px] top-[150px] z-[600] flex h-[30px] w-[30px] items-center justify-center rounded-[4px] border border-[#D9E7C8] bg-[#EEF5E7] text-[#3D6F25] shadow-[0_4px_10px_rgba(44,26,14,0.16)] transition hover:bg-[#E6F2DB] disabled:cursor-not-allowed disabled:opacity-60"
                title="Open all buildings in Google Maps"
                aria-label="Open all buildings in Google Maps"
              >
                <GoogleMapsBadgeIcon size={18} />
              </button>
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
      className={`agent-safe-top bg-[#FFFDF7] px-4 text-[#2C1A0E] ${
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
            {/* DEDICATED DELIVERY RUN SECTION */}
            <section className="overflow-hidden rounded-[26px] border border-[#E7DAC6] bg-white p-4 shadow-[0_14px_35px_rgba(92,61,30,0.07)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-[#B8641A]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A88763]">
                    Delivery Run
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${
                    todayDeliveries.length > 0 && todayOpenDeliveries.length === 0
                      ? "border-[#DDE8D1] bg-[#EEF5E7] text-[#4A7C2F]"
                      : isDeliveryRunActive
                      ? "border-[#F0D9B9] bg-[#FFF4E2] text-[#B8641A]"
                      : "border-[#E7DAC6] bg-[#FAF8F5] text-[#8B7355]"
                  }`}
                >
                  {todayDeliveries.length > 0 && todayOpenDeliveries.length === 0
                    ? "Completed"
                    : isDeliveryRunActive
                    ? "Active • Delivering"
                    : "Not Started"}
                </span>
              </div>

              {todayDeliveries.length > 0 && todayOpenDeliveries.length === 0 ? (
                <div className="mt-3 text-left">
                  <h3 className="text-lg font-black text-[#2C1A0E]" style={headingFont}>
                    All Deliveries Completed
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-[#6B5B3E]">
                    Great work! All {stats.totalAssigned} assigned deliveries for today have been completed.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/agent/working")}
                    className="mt-3.5 inline-flex items-center gap-2 rounded-[18px] border border-[#E7DAC6] bg-[#FFF8EF] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#B8641A] transition hover:bg-[#FFF1E4]"
                  >
                    <List size={14} />
                    View Building Tasks
                  </button>
                </div>
              ) : isDeliveryRunActive ? (
                <div className="mt-3 text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A88763]">
                    Next Destination
                  </p>
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-black text-[#2C1A0E]" style={headingFont}>
                        {currentDestinationBuilding?.buildingName || "Calculating next building..."}
                      </h3>
                      <p className="mt-0.5 text-xs font-semibold text-[#6B5B3E]">
                        {currentDestinationBuilding?.pendingCount || 0}{" "}
                        {currentDestinationBuilding?.pendingCount === 1 ? "delivery" : "deliveries"} remaining in this building
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#B8641A]">
                        {formatDistanceLabel(distanceToDestination)} • {formatDurationLabel(primaryRouteStats.durationSeconds)}
                      </p>
                    </div>
                  </div>

                  {isArrivedAtDestination && (
                    <div className="mt-3 rounded-[16px] border border-[#DDE8D1] bg-[#EEF5E7] p-2.5 text-center text-xs font-black uppercase tracking-[0.12em] text-[#4A7C2F]">
                      ✓ You have arrived at {currentDestinationBuilding?.buildingName}!
                    </div>
                  )}

                  <div className="mt-3.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentDestinationCoordinates) {
                          handleOpenMapSection();
                          setMapView(currentDestinationCoordinates);
                          setZoomLevel(17);
                          setRecenterTrigger((prev) => prev + 1);
                        }
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-md shadow-[#F2D9B8] transition hover:bg-[#9E5415]"
                    >
                      <Navigation size={14} />
                      Navigate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenBuildingTask(currentDestinationBuilding?.buildingName)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-[16px] border border-[#E7DAC6] bg-[#FFF8EF] py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#B8641A] transition hover:bg-[#FFF1E4]"
                    >
                      <Building2 size={14} />
                      Open Task
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-left">
                  <h3 className="text-lg font-black text-[#2C1A0E]" style={headingFont}>
                    Ready to Deliver
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-[#6B5B3E]">
                    {todayOpenDeliveries.length} {todayOpenDeliveries.length === 1 ? "delivery" : "deliveries"} assigned for today across {activeBuildings.length} {activeBuildings.length === 1 ? "building" : "buildings"}.
                  </p>
                  <div className="mt-3.5">
                    <button
                      type="button"
                      onClick={handleMarkOutForDelivery}
                      disabled={startingDelivery || !agentLocation || todayOpenDeliveries.length === 0}
                      className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#B8641A] py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-[#F2D9B8] transition hover:bg-[#9E5415] disabled:cursor-not-allowed disabled:bg-[#D4C3B2]"
                    >
                      <Truck size={16} />
                      {startingDelivery
                        ? "Starting Run..."
                        : !agentLocation
                        ? "Waiting for GPS..."
                        : todayOpenDeliveries.length === 0
                        ? "No Deliveries Pending"
                        : "Start Delivery Run"}
                    </button>
                  </div>
                </div>
              )}
            </section>

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

            <section className="rounded-[22px] border border-[#E7DAC6] bg-white p-3.5 shadow-[0_10px_28px_rgba(92,61,30,0.05)]">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#F0E6D8]">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A88763]">Today's Delivery Quantity</p>
                  <p className="text-xs font-bold text-[#6B5B3E] mt-0.5">Aggregated items to carry today</p>
                </div>
                {carrySummary.totalItemsToCarry > 0 ? (
                  <span className="rounded-full border border-[#DDE8D1] bg-[#EEF5E7] px-2.5 py-1 text-[11px] font-black text-[#4A7C2F] shadow-sm">
                    {carrySummary.totalItemsToCarry} {carrySummary.totalItemsToCarry === 1 ? "Packet / Unit" : "Packets / Units"}
                  </span>
                ) : null}
              </div>

              {/* Subscription Delivery Milk */}
              <div className="pt-2.5">
                <div className="flex items-center justify-between pb-1 px-0.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B8641A]">
                    Subscription Delivery Milk
                  </p>
                  {carrySummary.totalMilkLiters > 0 ? (
                    <span className="text-xs font-black text-[#8B5E34]">
                      {formatQuantity(carrySummary.totalMilkLiters)} L • {carrySummary.totalMilkPackets} {carrySummary.totalMilkPackets === 1 ? "packet" : "packets"}
                    </span>
                  ) : null}
                </div>

                {milkCarryRows.length > 0 ? (
                  <div className="rounded-[14px] border border-[#E7DAC6] bg-white overflow-hidden shadow-xs">
                    {/* Table Header */}
                    <div className="grid grid-cols-[42%_22%_36%] bg-[#FAF6F0] px-3.5 py-2 border-b border-[#EAE2D5] text-[10.5px] font-black uppercase tracking-[0.1em] text-[#9E7B54]">
                      <span>Product</span>
                      <span>Size</span>
                      <span className="text-right">Packets to Carry</span>
                    </div>

                    {/* Table Rows: Each packet size has its own separate row */}
                    <div className="divide-y divide-[#F4EDE2]">
                      {milkCarryRows.map((row, idx) => (
                        <div
                          key={`${row.productName}-${row.size}-${idx}`}
                          className="grid grid-cols-[42%_22%_36%] items-center px-3.5 py-2.5 hover:bg-[#FFFDF9] transition-colors"
                        >
                          {/* Product Column */}
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#B8641A] shrink-0" />
                            <span className="text-[13.5px] font-bold text-[#2C1A0E] leading-snug break-words">
                              {row.productName}
                            </span>
                          </div>

                          {/* Size Column */}
                          <div className="text-[13px] font-bold text-[#6B5B3E] pr-1">
                            {formatSizeLabel(row.size)}
                          </div>

                          {/* Packets to Carry Column */}
                          <div className="text-right pr-0.5">
                            <span className="text-[14px] font-black text-[#7A4515]">
                              {row.packets} {row.packets === 1 ? "packet" : "packets"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Table Footer / Summary */}
                    <div className="flex items-center justify-between bg-[#FAF6F0] px-3.5 py-2.5 border-t border-[#EAE2D5]">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8B5E34]">
                        Total to Carry
                      </span>
                      <span className="text-[13.5px] font-black text-[#2C1A0E]">
                        {carrySummary.totalMilkPackets} {carrySummary.totalMilkPackets === 1 ? "PACKET" : "PACKETS"}
                        {carrySummary.totalMilkLiters > 0 ? ` • ${formatQuantity(carrySummary.totalMilkLiters)} L` : ""}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="py-2 text-xs font-semibold text-[#8B7355]">No milk items scheduled for today</p>
                )}
              </div>

              {/* Extra Products (if any) */}
              {carrySummary.extraProducts.length > 0 && (
                <div className="pt-3">
                  <div className="flex items-center justify-between pb-1.5 px-0.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B8641A]">
                      Extra Products
                    </p>
                    <span className="text-xs font-black text-[#8B5E34]">
                      {carrySummary.totalExtraPackets} {carrySummary.totalExtraPackets === 1 ? "Unit" : "Units"}
                    </span>
                  </div>

                  <div className="rounded-[14px] border border-[#E7DAC6] bg-white overflow-hidden shadow-xs">
                    {/* Table Header */}
                    <div className="grid grid-cols-[42%_22%_36%] bg-[#FAF6F0] px-3.5 py-2 border-b border-[#EAE2D5] text-[10.5px] font-black uppercase tracking-[0.1em] text-[#9E7B54]">
                      <span>Product</span>
                      <span>Size</span>
                      <span className="text-right">Packets to Carry</span>
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y divide-[#F4EDE2]">
                      {carrySummary.extraProducts.map((item, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-[42%_22%_36%] items-center px-3.5 py-2.5 hover:bg-[#FFFDF9] transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#B8641A] shrink-0" />
                            <span className="text-[13.5px] font-bold text-[#2C1A0E] leading-snug break-words">
                              {item.name}
                            </span>
                          </div>
                          <div className="text-[13px] font-bold text-[#6B5B3E] pr-1 truncate">
                            {formatSizeLabel(item.sizeLabel)}
                          </div>
                          <div className="text-right pr-0.5">
                            <span className="text-[14px] font-black text-[#7A4515]">
                              {item.packets} {item.packets === 1 ? "unit" : "units"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Table Footer / Summary */}
                    <div className="flex items-center justify-between bg-[#FAF6F0] px-3.5 py-2.5 border-t border-[#EAE2D5]">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8B5E34]">
                        Total Extra to Carry
                      </span>
                      <span className="text-[13.5px] font-black text-[#2C1A0E]">
                        {carrySummary.totalExtraPackets} {carrySummary.totalExtraPackets === 1 ? "UNIT" : "UNITS"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : null}

        {activeSection === ActiveNavLabel.MAP ? mapContent : null}

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

