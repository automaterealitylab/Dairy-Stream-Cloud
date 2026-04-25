import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { ensureSocketConnection } from "../socket";
import { getDeliveryETA } from "../api/customer/notification";

const DEFAULT_CENTER = [20.5937, 78.9629];

const DefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

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
        if (etaAgentCoordinates) {
          setPosition(etaAgentCoordinates);
        }

        const etaCustomerCoordinates = toCoordinates(eta?.customerLocation);
        if (etaCustomerCoordinates) {
          setCustomerCoordinates(etaCustomerCoordinates);
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
    if (!position || !customerCoordinates) {
      setRouteCoordinates([]);
      return undefined;
    }

    const controller = new AbortController();
    fetchRoadRoute(position, customerCoordinates, controller.signal)
      .then((points) => {
        if (Array.isArray(points) && points.length >= 2) {
          setRouteCoordinates(points);
        } else {
          setRouteCoordinates([position, customerCoordinates]);
        }
      })
      .catch(() => {
        setRouteCoordinates([position, customerCoordinates]);
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
      <div className="rounded-[18px] border border-[#EDE8DF] bg-[#FBF7F0] px-4 py-6 text-center text-sm text-[#8B7355]">
        Tracking becomes available once this order is out for delivery.
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className="rounded-[18px] border border-[#DDE8D1] bg-[#EEF5E7] px-4 py-6 text-center">
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
    <div className="overflow-hidden rounded-[18px] border border-[#EDE8DF]">
      {!position ? (
        <div className="bg-[#FBF7F0] px-4 py-6 text-center text-sm text-[#8B7355]">
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
          <>
            <CircleMarker
              center={position}
              radius={20}
              pathOptions={{
                color: "#1D4ED8",
                fillColor: "#60A5FA",
                fillOpacity: 0.35,
              }}
            />
            <Marker position={position} />
          </>
        ) : null}
        {customerCoordinates ? (
          <>
            <CircleMarker
              center={customerCoordinates}
              radius={16}
              pathOptions={{
                color: "#4A7C2F",
                fillColor: "#DDE8D1",
                fillOpacity: 0.75,
              }}
            />
            <Marker position={customerCoordinates} />
          </>
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

      {lastUpdatedAt ? (
        <div className="border-t border-[#EDE8DF] bg-white px-4 py-2 text-xs text-[#8B7355]">
          Live update: {new Date(lastUpdatedAt).toLocaleTimeString()}
        </div>
      ) : null}
    </div>
  );
};

export default TrackAgentMap;
