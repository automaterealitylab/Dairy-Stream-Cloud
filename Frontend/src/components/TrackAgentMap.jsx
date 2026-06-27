import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ensureSocketConnection } from "../socket";
import { getDeliveryETA } from "../api/customer/notification";

const DEFAULT_CENTER = [20.5937, 78.9629];

const MapPanner = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(center) || center.length !== 2) return;
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
};

const MapBoundsUpdater = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(points) || points.length < 2) return;
    map.fitBounds(points, { padding: [28, 28] });
  }, [map, points]);

  return null;
};

const toCoordinates = (value) => {
  const lat = Number(value?.lat ?? value?.latitude);
  const lng = Number(value?.lng ?? value?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

const toTimestamp = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const fetchRoadRoute = async (agentCoordinates, customerCoordinates, signal) => {
  if (!Array.isArray(agentCoordinates) || !Array.isArray(customerCoordinates)) {
    return [];
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

  return routePoints;
};

const TrackAgentMap = ({
  orderId,
  agentId = null,
  initialPosition = null,
  customerPosition = null,
  canTrack = true,
}) => {
  const initialCoordinates =
    Number.isFinite(Number(initialPosition?.lat)) && Number.isFinite(Number(initialPosition?.lng))
      ? [Number(initialPosition.lat), Number(initialPosition.lng)]
      : null;
  const initialCustomerCoordinates = toCoordinates(customerPosition);

  const [position, setPosition] = useState(initialCoordinates);
  const [customerCoordinates, setCustomerCoordinates] = useState(initialCustomerCoordinates);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const hydratedDeliveryRef = useRef(false);

  useEffect(() => {
    if (!orderId) return undefined;
    if (hydratedDeliveryRef.current) return undefined;

    let cancelled = false;

    const hydrateFromEta = async () => {
      try {
        const eta = await getDeliveryETA(orderId, { force: true });
        if (cancelled || !eta) return;

        const etaAgentCoordinates = toCoordinates(eta?.agentLocation);
        const etaTimestamp = toTimestamp(eta?.lastUpdated);
        if (etaAgentCoordinates) {
          setPosition(etaAgentCoordinates);
          setIsOffline(false);
          setLastUpdatedAt((current) => {
            const fallback = Date.now();
            const next = etaTimestamp ?? fallback;
            if (!Number.isFinite(current)) return next;
            return Math.max(current, next);
          });
        }

        const etaCustomerCoordinates = toCoordinates(eta?.customerLocation);
        if (etaCustomerCoordinates) {
          setCustomerCoordinates(etaCustomerCoordinates);
        }

        if (!etaAgentCoordinates && etaTimestamp) {
          setLastUpdatedAt((current) => {
            if (!Number.isFinite(current)) return etaTimestamp;
            return Math.max(current, etaTimestamp);
          });
        }
      } catch {
        // Keep map functional from sockets/initial props even if ETA fetch fails.
      } finally {
        hydratedDeliveryRef.current = true;
      }
    };

    hydrateFromEta();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (!orderId && !agentId) return undefined;

    const connectedSocket = ensureSocketConnection();
    if (orderId) {
      connectedSocket.emit("customer:trackOrder", { orderId });
    }
    if (agentId) {
      connectedSocket.emit("customer:watchAgent", { agentId });
    }

    const handleLocation = ({
      orderId: incomingOrderId,
      agentId: incomingAgentId,
      lat,
      lng,
      timestamp,
      isOnline,
    } = {}) => {
      const matchesOrder = orderId ? String(incomingOrderId) === String(orderId) : true;
      const matchesAgent = agentId ? String(incomingAgentId) === String(agentId) : true;
      if (!matchesOrder && !matchesAgent) return;
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      setPosition([latitude, longitude]);
      setLastUpdatedAt(Number(timestamp) || Date.now());
      setIsOffline(isOnline === false ? true : false);
    };

    const handleOffline = ({ orderId: incomingOrderId, agentId: incomingAgentId, timestamp } = {}) => {
      const matchesOrder = orderId ? String(incomingOrderId) === String(orderId) : true;
      const matchesAgent = agentId ? String(incomingAgentId) === String(agentId) : true;
      if (!matchesOrder && !matchesAgent) return;
      setIsOffline(true);
      setLastUpdatedAt(Number(timestamp) || Date.now());
    };

    connectedSocket.on("agent:location", handleLocation);
    connectedSocket.on("agent:offline", handleOffline);

    return () => {
      if (orderId) {
        connectedSocket.emit("customer:untrackOrder", { orderId });
      }
      if (agentId) {
        connectedSocket.emit("customer:unwatchAgent", { agentId });
      }
      connectedSocket.off("agent:location", handleLocation);
      connectedSocket.off("agent:offline", handleOffline);
    };
  }, [agentId, orderId]);

  useEffect(() => {
    if (!position || !customerCoordinates) return undefined;

    const controller = new AbortController();
    fetchRoadRoute(position, customerCoordinates, controller.signal)
      .then((points) => {
        if (Array.isArray(points) && points.length >= 2) {
          setRouteCoordinates(points);
        }
      })
      .catch(() => {
        // Keep the last successful road route to avoid showing straight-line fallback.
      });

    return () => controller.abort();
  }, [customerCoordinates, position]);

  const mapCenter = useMemo(() => position || DEFAULT_CENTER, [position]);
  const mapBoundsPoints = useMemo(
    () => [position, customerCoordinates].filter(Boolean),
    [customerCoordinates, position]
  );

  if (!canTrack) {
    return (
      <div className="rounded-[18px] border border-[#EDE8DF] bg-[#FBF7F0] px-4 py-4 text-center text-sm text-[#8B7355]">
        Tracking becomes available once this order is out for delivery.
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className="rounded-[18px] border border-[#DDE8D1] bg-[#EEF5E7] px-4 py-4 text-center">
        <p className="text-sm font-bold text-[#4A7C2F]">Agent is offline or delivery is completed.</p>
        {lastUpdatedAt ? (
          <p className="mt-1 text-xs text-[#4A7C2F]">
            Last update: {new Date(lastUpdatedAt).toLocaleTimeString()}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-[#EDE8DF]">
      {!position ? (
        <div className="bg-[#FBF7F0] px-4 py-4 text-center text-sm text-[#8B7355]">
          Waiting for agent location...
        </div>
      ) : null}

      <MapContainer center={mapCenter} zoom={15} scrollWheelZoom={false} className="h-[340px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapPanner center={mapCenter} />
        <MapBoundsUpdater points={mapBoundsPoints} />
        {position ? (
          <CircleMarker
            center={position}
            radius={10}
            pathOptions={{
              color: "#2563EB",
              fillColor: "#60A5FA",
              fillOpacity: 0.7,
              weight: 2,
            }}
          />
        ) : null}
        {customerCoordinates ? (
          <Marker
            position={customerCoordinates}
            icon={L.divIcon({
              className: "custom-div-icon",
              html: '<div style="background-color: #6BB071; width: 14px; height: 14px; border-radius: 999px; box-shadow: 0 4px 10px rgba(44,26,14,0.16);"></div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          />
        ) : null}
        {routeCoordinates.length >= 2 ? (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: "#B8641A",
              weight: 4,
              opacity: 0.85,
            }}
          />
        ) : null}
      </MapContainer>
          <div className="absolute bottom-[18px] right-[55px] z-[1000] bg-white/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-[#8B7355] pointer-events-none select-none rounded border border-[#EDE8DF]/40">
      DairyVision Maps
    </div>

      {lastUpdatedAt ? (
        <div className="border-t border-[#EDE8DF] bg-white px-4 py-2 text-xs text-[#8B7355]">
          Live update: {new Date(lastUpdatedAt).toLocaleTimeString()}
        </div>
      ) : null}
    </div>
  );
};

export default TrackAgentMap;
