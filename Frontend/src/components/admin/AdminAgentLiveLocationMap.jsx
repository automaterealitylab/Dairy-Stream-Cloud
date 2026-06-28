import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ensureSocketConnection } from "../../socket";
import { fetchAdminDeliveries } from "../../api/admin.api";

const DEFAULT_CENTER = [20.5937, 78.9629];
const LIVE_STALE_MS = 60 * 1000;
const getTodayDateInput = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const MapPanner = ({ center, followTrigger }) => {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(center) || center.length !== 2) return;
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, followTrigger, map]);

  return null;
};

const normalizeStatus = (value) => String(value || "").trim().toUpperCase();
const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const isDeliveredStatus = (status) => {
  const normalized = normalizeStatus(status);
  return normalized === "COMPLETED" || normalized === "DELIVERED";
};

const getDeliveryCoordinates = (delivery) => {
  const directCustomerLocation = delivery?.customerLocation || delivery?.customer_location || null;
  const nestedCustomer = delivery?.customer || delivery?.customerDetails || null;
  const geoCoordinates = delivery?.location?.coordinates || nestedCustomer?.location?.coordinates || null;

  const lat = Number(
    delivery?.lat ??
      delivery?.latitude ??
      delivery?.customerLat ??
      delivery?.customerLatitude ??
      delivery?.customer_lat ??
      directCustomerLocation?.lat ??
      directCustomerLocation?.latitude ??
      nestedCustomer?.lat ??
      nestedCustomer?.latitude ??
      delivery?.location?.lat ??
      delivery?.location?.latitude ??
      (Array.isArray(geoCoordinates) ? geoCoordinates?.[1] : undefined)
  );
  const lng = Number(
    delivery?.lng ??
      delivery?.longitude ??
      delivery?.customerLng ??
      delivery?.customerLongitude ??
      delivery?.customer_lng ??
      directCustomerLocation?.lng ??
      directCustomerLocation?.longitude ??
      nestedCustomer?.lng ??
      nestedCustomer?.longitude ??
      delivery?.location?.lng ??
      delivery?.location?.longitude ??
      (Array.isArray(geoCoordinates) ? geoCoordinates?.[0] : undefined)
  );

  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

const getDairyCoordinates = (source) => {
  const lat = Number(
    source?.dairyLat ??
      source?.dairyLatitude ??
      source?.dairyFarmLat ??
      source?.dairyFarmLatitude ??
      source?.dairy?.lat ??
      source?.dairy?.latitude
  );
  const lng = Number(
    source?.dairyLng ??
      source?.dairyLongitude ??
      source?.dairyFarmLng ??
      source?.dairyFarmLongitude ??
      source?.dairy?.lng ??
      source?.dairy?.longitude
  );

  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

const getDistanceInMeters = (from, to) => {
  if (!from || !to) return Number.POSITIVE_INFINITY;
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

const fetchRoadRoute = async (fromCoordinates, toCoordinates, signal) => {
  if (!Array.isArray(fromCoordinates) || !Array.isArray(toCoordinates)) return [];

  const [fromLat, fromLng] = fromCoordinates;
  const [toLat, toLng] = toCoordinates;
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=simplified&geometries=geojson`;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Route request failed ${response.status}`);

  const payload = await response.json();
  const geometry = payload?.routes?.[0]?.geometry?.coordinates;
  return Array.isArray(geometry)
    ? geometry
        .map((point) => {
          const lng = Number(point?.[0]);
          const lat = Number(point?.[1]);
          return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
        })
        .filter(Boolean)
    : [];
};

const fetchRoadDistanceTable = async (originCoordinates, deliveries, signal) => {
  if (!Array.isArray(originCoordinates) || !Array.isArray(deliveries) || deliveries.length === 0) {
    return {};
  }

  const validDeliveries = deliveries.filter((delivery) => Array.isArray(delivery?.coordinates));
  if (validDeliveries.length === 0) return {};

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

  return validDeliveries.reduce((accumulator, delivery, index) => {
    const distanceMeters = Number(distanceRow[index]);
    accumulator[String(delivery.id)] = Number.isFinite(distanceMeters) ? distanceMeters : null;
    return accumulator;
  }, {});
};

const AdminAgentLiveLocationMap = ({ agentId, agentName = "" }) => {
  const [agentPosition, setAgentPosition] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [primaryRoadRoute, setPrimaryRoadRoute] = useState([]);
  const [secondaryRouteSegments, setSecondaryRouteSegments] = useState([]);
  const [secondaryRoadRoutes, setSecondaryRoadRoutes] = useState([]);
  const [completedRoadRoutes, setCompletedRoadRoutes] = useState([]);
  const [dairyRoadRoute, setDairyRoadRoute] = useState([]);
  const [nearestByRoadDeliveryId, setNearestByRoadDeliveryId] = useState(null);
  const [followTrigger, setFollowTrigger] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const filteredDeliveries = useMemo(() => {
    const normalizedAgentId = String(agentId || "").trim();
    const normalizedAgentName = normalizeName(agentName);
    if (!normalizedAgentId && !normalizedAgentName) return [];

    return (deliveries || []).filter((delivery) => {
      const candidateIds = [
        delivery?.agentID,
        delivery?.agentId,
        delivery?.agent_id,
        delivery?.assignedToAgentId,
        delivery?.assigned_to_agent_id,
        delivery?.assignedAgentId,
        delivery?.assigned_agent_id,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      const candidateNames = [
        delivery?.agentName,
        delivery?.agent_name,
        delivery?.assignedAgentName,
        delivery?.assigned_agent_name,
        delivery?.agent?.name,
        delivery?.agent?.full_name,
      ]
        .map((value) => normalizeName(value))
        .filter(Boolean);

      const byId = normalizedAgentId ? candidateIds.includes(normalizedAgentId) : false;
      const byName = normalizedAgentName
        ? candidateNames.some(
            (name) =>
              name === normalizedAgentName ||
              name.includes(normalizedAgentName) ||
              normalizedAgentName.includes(name)
          )
        : false;
      return byId || byName;
    });
  }, [agentId, agentName, deliveries]);

  const mappedDeliveries = useMemo(
    () =>
      filteredDeliveries
        .map((delivery) => ({
          ...delivery,
          coordinates: getDeliveryCoordinates(delivery),
          normalizedStatus: normalizeStatus(delivery?.status),
        }))
        .filter((delivery) => Array.isArray(delivery.coordinates)),
    [filteredDeliveries]
  );

  const pendingDeliveries = useMemo(
    () => mappedDeliveries.filter((delivery) => !isDeliveredStatus(delivery.normalizedStatus)),
    [mappedDeliveries]
  );

  const deliveredDeliveries = useMemo(
    () => mappedDeliveries.filter((delivery) => isDeliveredStatus(delivery.normalizedStatus)),
    [mappedDeliveries]
  );
  const dairyCoordinates = useMemo(() => {
    for (const item of filteredDeliveries) {
      const coordinates = getDairyCoordinates(item);
      if (coordinates) return coordinates;
    }
    return null;
  }, [filteredDeliveries]);

  const nearestPendingDelivery = useMemo(() => {
    if (!Array.isArray(pendingDeliveries) || pendingDeliveries.length === 0) return null;
    if (!nearestByRoadDeliveryId) {
      if (!agentPosition) return pendingDeliveries[0] || null;
      let nearest = pendingDeliveries[0];
      let nearestDistance = getDistanceInMeters(agentPosition, nearest.coordinates);
      pendingDeliveries.slice(1).forEach((delivery) => {
        const distance = getDistanceInMeters(agentPosition, delivery.coordinates);
        if (distance < nearestDistance) {
          nearest = delivery;
          nearestDistance = distance;
        }
      });
      return nearest;
    }
    return (
      pendingDeliveries.find((delivery) => String(delivery.id) === String(nearestByRoadDeliveryId)) ||
      pendingDeliveries[0] ||
      null
    );
  }, [agentPosition, nearestByRoadDeliveryId, pendingDeliveries]);

  const orderedPendingDeliveries = useMemo(() => {
    if (!nearestPendingDelivery) return pendingDeliveries;
    const nearestId = String(nearestPendingDelivery.id);
    const remaining = pendingDeliveries.filter((delivery) => String(delivery.id) !== nearestId);
    return [nearestPendingDelivery, ...remaining];
  }, [nearestPendingDelivery, pendingDeliveries]);

  const roadRankingOrigin = useMemo(
    () =>
      Array.isArray(agentPosition)
        ? [Number(agentPosition[0].toFixed(4)), Number(agentPosition[1].toFixed(4))]
        : null,
    [agentPosition?.[0], agentPosition?.[1]]
  );
  const roadRankingDeliveries = useMemo(
    () =>
      pendingDeliveries.map((delivery) => ({
        id: delivery.id,
        coordinates: delivery.coordinates,
      })),
    [pendingDeliveries]
  );
  const roadRankingKey = useMemo(
    () =>
      roadRankingDeliveries
        .map(
          (delivery) =>
            `${delivery.id}:${delivery.coordinates?.[0]?.toFixed?.(4)}:${delivery.coordinates?.[1]?.toFixed?.(4)}`
        )
        .join("|"),
    [roadRankingDeliveries]
  );

  useEffect(() => {
    let active = true;

    const loadDeliveries = async () => {
      try {
        const response = await fetchAdminDeliveries({
          limit: 1000,
          date: getTodayDateInput(),
        });
        const items = Array.isArray(response?.deliveries)
          ? response.deliveries
          : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
          ? response
          : [];
        if (active) {
          setDeliveries(items);
        }
      } catch (error) {
        if (active) {
          setDeliveries([]);
        }
        console.error("Failed to load admin deliveries for live tracking:", error);
      }
    };

    loadDeliveries();
    const intervalId = window.setInterval(loadDeliveries, 30000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTick(Date.now()), 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!agentId) return undefined;

    const connectedSocket = ensureSocketConnection();
    connectedSocket.emit("customer:watchAgent", { agentId });

    const handleLocation = ({ agentId: incomingAgentId, lat, lng, timestamp, isOnline } = {}) => {
      if (String(incomingAgentId || "") !== String(agentId)) return;
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      setAgentPosition([latitude, longitude]);
      setLastUpdatedAt(Number(timestamp) || Date.now());
      setIsOffline(isOnline === false);
      setFollowTrigger((value) => value + 1);
    };

    const handleOffline = ({ agentId: incomingAgentId, timestamp } = {}) => {
      if (String(incomingAgentId || "") !== String(agentId)) return;
      setIsOffline(true);
      setLastUpdatedAt(Number(timestamp) || Date.now());
    };

    connectedSocket.on("agent:location", handleLocation);
    connectedSocket.on("agent:offline", handleOffline);

    return () => {
      connectedSocket.emit("customer:unwatchAgent", { agentId });
      connectedSocket.off("agent:location", handleLocation);
      connectedSocket.off("agent:offline", handleOffline);
    };
  }, [agentId]);

  const isLive = useMemo(() => {
    if (isOffline) return false;
    if (!Array.isArray(agentPosition)) return false;
    if (!Number.isFinite(Number(lastUpdatedAt))) return false;
    return nowTick - Number(lastUpdatedAt) <= LIVE_STALE_MS;
  }, [agentPosition, isOffline, lastUpdatedAt, nowTick]);

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
        setNearestByRoadDeliveryId(String(roadRankingDeliveries[0].id));
      });

    return () => controller.abort();
  }, [roadRankingDeliveries, roadRankingKey, roadRankingOrigin]);

  useEffect(() => {
    if (!agentPosition || !nearestPendingDelivery?.coordinates) {
      setPrimaryRoadRoute([]);
      return undefined;
    }

    const controller = new AbortController();

    fetchRoadRoute(agentPosition, nearestPendingDelivery.coordinates, controller.signal)
      .then((points) => {
        setPrimaryRoadRoute(Array.isArray(points) ? points : []);
      })
      .catch(() => {
        // Keep last successful road route to avoid straight-line fallback.
      });

    return () => controller.abort();
  }, [agentPosition, nearestPendingDelivery]);

  useEffect(() => {
    if (orderedPendingDeliveries.length < 2) {
      setSecondaryRouteSegments([]);
      return;
    }

    const segments = orderedPendingDeliveries
      .slice(0, -1)
      .map((delivery, index) => ({
        id: `${delivery.id}-${orderedPendingDeliveries[index + 1]?.id ?? index}`,
        points: [delivery.coordinates, orderedPendingDeliveries[index + 1]?.coordinates].filter(Boolean),
      }))
      .filter((segment) => segment.points.length >= 2);
    setSecondaryRouteSegments(segments);
  }, [orderedPendingDeliveries]);

  useEffect(() => {
    if (secondaryRouteSegments.length === 0) {
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
              Array.isArray(roadRoute) && roadRoute.length >= 2
                ? roadRoute
                : [],
          };
        })
      )
        .then((segments) =>
          setSecondaryRoadRoutes(
            Array.isArray(segments) ? segments.filter((segment) => segment.points.length >= 2) : []
          )
        )
        .catch((err) => {
          if (err?.name === "AbortError") return;
          // Keep last successful road routes to avoid straight-line fallback.
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [secondaryRouteSegments]);

  useEffect(() => {
    if (!agentPosition || deliveredDeliveries.length === 0) {
      setCompletedRoadRoutes([]);
      return undefined;
    }

    const controller = new AbortController();

    Promise.all(
      deliveredDeliveries.map(async (delivery) => {
        try {
          const points = await fetchRoadRoute(agentPosition, delivery.coordinates, controller.signal);
          return {
            id: String(delivery.id),
            points: Array.isArray(points) && points.length >= 2 ? points : [],
          };
        } catch {
          return {
            id: String(delivery.id),
            points: [],
          };
        }
      })
    )
      .then((segments) => {
        setCompletedRoadRoutes(segments.filter((segment) => segment.points.length >= 2));
      })
      .catch(() => {
        setCompletedRoadRoutes([]);
      });

    return () => controller.abort();
  }, [agentPosition, deliveredDeliveries]);

  useEffect(() => {
    if (!agentPosition || !dairyCoordinates) {
      setDairyRoadRoute([]);
      return undefined;
    }

    const controller = new AbortController();
    fetchRoadRoute(agentPosition, dairyCoordinates, controller.signal)
      .then((points) => {
        setDairyRoadRoute(Array.isArray(points) ? points : []);
      })
      .catch(() => {
        // Keep last successful road route to avoid straight-line fallback.
      });

    return () => controller.abort();
  }, [agentPosition, dairyCoordinates]);

  const mapCenter = agentPosition || nearestPendingDelivery?.coordinates || DEFAULT_CENTER;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-[#EDE8DF] bg-[#FBF7F0] px-3 py-2 text-xs font-semibold text-[#6B5B3E]">
        <span>Pending: {pendingDeliveries.length}</span>
        <span>Delivered: {deliveredDeliveries.length}</span>
        <span>Total Mapped Pins: {mappedDeliveries.length}</span>
        {isLive ? <span className="text-[#4A7C2F]">Live</span> : <span className="text-[#A85734]">Agent offline</span>}
        {lastUpdatedAt ? <span>Updated {new Date(lastUpdatedAt).toLocaleTimeString()}</span> : null}
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[#EDE8DF]">
        <div className="relative w-full h-[420px]">
        <MapContainer center={mapCenter} zoom={15} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapPanner center={mapCenter} followTrigger={followTrigger} />

          {agentPosition ? (
            <CircleMarker
              center={agentPosition}
              radius={10}
              pathOptions={{
                color: "#2563EB",
                fillColor: "#60A5FA",
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Popup>Agent live location</Popup>
            </CircleMarker>
          ) : null}

          {mappedDeliveries.map((delivery) => {
            const delivered = isDeliveredStatus(delivery.normalizedStatus);
            const markerColor = delivered ? "#9CA3AF" : "#6BB071";
            return (
              <Marker
                key={delivery.id}
                position={delivery.coordinates}
                icon={L.divIcon({
                  className: "custom-div-icon",
                  html: `<div style="background-color: ${markerColor}; width: 14px; height: 14px; border-radius: 999px; box-shadow: 0 4px 10px rgba(44,26,14,0.16);"></div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                })}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-[#2C1A0E]">
                      {delivery.customerName || delivery.customer_name || "Customer"}
                    </p>
                    <p className="text-[10px] text-[#6B5B3E]">
                      {delivery.address || delivery.customerAddress || "-"}
                    </p>
                    <p className={`text-[10px] font-semibold ${delivered ? "text-[#6B7280]" : "text-[#4A7C2F]"}`}>
                      {delivered ? "Delivered customer" : "Pending delivery customer"}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {dairyCoordinates ? (
            <Marker
              position={dairyCoordinates}
              icon={L.divIcon({
                className: "custom-div-icon",
                html: '<div style="background-color: #D93025; width: 16px; height: 16px; border-radius: 999px; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(44,26,14,0.2);"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-[#2C1A0E]">Dairy location</p>
                  <p className="text-[10px] font-semibold text-[#D93025]">Source dairy</p>
                </div>
              </Popup>
            </Marker>
          ) : null}

          {primaryRoadRoute.length >= 2 ? (
            <Polyline
              positions={primaryRoadRoute}
              pathOptions={{ color: "#5c87ea", weight: 5, opacity: 0.9 }}
            />
          ) : null}

          {completedRoadRoutes.map((segment, index) => (
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

          {(secondaryRoadRoutes.length > 0 ? secondaryRoadRoutes : secondaryRouteSegments).map((segment) => (
            <Polyline
              key={segment.id}
              positions={segment.points}
              pathOptions={{
                color: "#191970",
                weight: 3,
                opacity: 0.8,
                dashArray: "8 10",
              }}
            />
          ))}

          {dairyRoadRoute.length >= 2 ? (
            <Polyline
              positions={dairyRoadRoute}
              pathOptions={{
                color: "#FCA5A5",
                weight: 4,
                opacity: 0.95,
                dashArray: "8 8",
              }}
            />
          ) : null}
        </MapContainer>
        <div className="absolute bottom-[18px] right-[55px] z-[1000] bg-white/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-[#8B7355] pointer-events-none select-none rounded border border-[#EDE8DF]/40">
          DairyVision Maps
        </div>
      </div>
          
      </div>
    </div>
  );
};

export default AdminAgentLiveLocationMap;
