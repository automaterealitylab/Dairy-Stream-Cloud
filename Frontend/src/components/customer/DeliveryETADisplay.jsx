import React, { useEffect, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  getCachedDeliveryETA,
  getDeliveryETA,
} from "../../api/customer/notification";
import { CheckCircle2, Clock3, MapPinned, Truck, XCircle } from "lucide-react";

const DefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const normalizeEtaStatus = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "IN_TRANSIT" || normalized === "OUT_FOR_DELIVERY") {
    return "OUT_FOR_DELIVERY";
  }
  if (normalized === "COMPLETED" || normalized === "DELIVERED") {
    return "DELIVERED";
  }
  return normalized;
};

const MapUpdater = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    if (Array.isArray(center) && center.length === 2) {
      map.flyTo(center, map.getZoom(), {
        animate: true,
        duration: 0.8,
      });
    }
  }, [center, map]);

  return null;
};

const MapBoundsUpdater = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(points) || points.length < 2) return;
    map.fitBounds(points, { padding: [36, 36] });
  }, [map, points]);

  return null;
};

const ROAD_ROUTE_PRECISION = 5;

const buildRouteCacheKey = (agentCoordinates, customerCoordinates) => {
  if (!Array.isArray(agentCoordinates) || !Array.isArray(customerCoordinates)) return null;

  return [
    agentCoordinates[0].toFixed(ROAD_ROUTE_PRECISION),
    agentCoordinates[1].toFixed(ROAD_ROUTE_PRECISION),
    customerCoordinates[0].toFixed(ROAD_ROUTE_PRECISION),
    customerCoordinates[1].toFixed(ROAD_ROUTE_PRECISION),
  ].join(":");
};

const roadRouteCache = new Map();

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

const DeliveryETADisplay = ({ deliveryId }) => {
  const cachedEta = getCachedDeliveryETA(deliveryId);
  const [etaData, setEtaData] = useState(cachedEta);
  const [loading, setLoading] = useState(() => !cachedEta);
  const [error, setError] = useState(null);
  const [roadRoute, setRoadRoute] = useState([]);

  useEffect(() => {
    if (!deliveryId) {
      setEtaData(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const initialCachedEta = getCachedDeliveryETA(deliveryId);
    if (initialCachedEta) {
      setEtaData(initialCachedEta);
      setLoading(false);
    }

    const fetchETA = async ({
      force = false,
      showSpinner = force || !getCachedDeliveryETA(deliveryId),
    } = {}) => {
      try {
        if (showSpinner) {
          setLoading(true);
        }

        const data = await getDeliveryETA(deliveryId, { force });
        setEtaData(data);
        setError(null);
      } catch (err) {
        setError("Unable to fetch delivery ETA");
        console.error("ETA Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchETA();

    const interval = setInterval(
      () => fetchETA({ force: true, showSpinner: false }),
      15000
    );

    return () => clearInterval(interval);
  }, [deliveryId]);

  const normalizedStatus = normalizeEtaStatus(etaData?.status);
  const agentCoordinates =
    Number.isFinite(Number(etaData?.agentLocation?.lat)) &&
    Number.isFinite(Number(etaData?.agentLocation?.lng))
      ? [Number(etaData.agentLocation.lat), Number(etaData.agentLocation.lng)]
      : null;
  const customerCoordinates =
    Number.isFinite(Number(etaData?.customerLocation?.lat)) &&
    Number.isFinite(Number(etaData?.customerLocation?.lng))
      ? [Number(etaData.customerLocation.lat), Number(etaData.customerLocation.lng)]
      : null;
  const routeCoordinates = Array.isArray(etaData?.routePath)
    ? etaData.routePath
        .map((point) => {
          const lat = Number(point?.lat);
          const lng = Number(point?.lng);
          return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
        })
        .filter(Boolean)
    : [agentCoordinates, customerCoordinates].filter(Boolean);
  const resolvedRouteCoordinates =
    roadRoute.length >= 2 ? roadRoute : routeCoordinates;
  const shouldShowLiveLocation = normalizedStatus === "OUT_FOR_DELIVERY";

  useEffect(() => {
    if (!shouldShowLiveLocation || !agentCoordinates || !customerCoordinates) {
      setRoadRoute([]);
      return undefined;
    }

    const controller = new AbortController();

    fetchRoadRoute(agentCoordinates, customerCoordinates, controller.signal)
      .then((points) => {
        setRoadRoute(Array.isArray(points) ? points : []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Road route fetch failed:", err);
        setRoadRoute([]);
      });

    return () => controller.abort();
  }, [
    shouldShowLiveLocation,
    agentCoordinates?.[0],
    agentCoordinates?.[1],
    customerCoordinates?.[0],
    customerCoordinates?.[1],
  ]);

  if (loading) {
    return (
      <div className="mt-6 rounded-[18px] border border-[#EFD7B3] bg-[#FFF8EC] p-4">
        <p className="text-center text-[#8B7355]">Loading ETA...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 rounded-[18px] border border-[#F2D0C8] bg-[#FDECEA] p-4">
        <p className="text-center text-sm text-[#C0392B]">{error}</p>
      </div>
    );
  }

  if (!etaData) return null;

  if (normalizedStatus === "DELIVERED") {
    return (
      <div className="mt-6 rounded-[18px] border border-[#DDE8D1] bg-[#EEF5E7] p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={22} className="text-[#4A7C2F]" />
          <div>
            <h3 className="font-bold text-[#4A7C2F]">Delivery Completed</h3>
            <p className="text-sm text-[#4A7C2F]">Your order has been delivered</p>
          </div>
        </div>
      </div>
    );
  }

  if (normalizedStatus === "FAILED") {
    return (
      <div className="mt-6 rounded-[18px] border border-[#F2D0C8] bg-[#FDECEA] p-4">
        <div className="flex items-center gap-2">
          <XCircle size={22} className="text-[#C0392B]" />
          <div>
            <h3 className="font-bold text-[#C0392B]">Delivery Failed</h3>
            <p className="text-sm text-[#C0392B]">{etaData.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const hasEta = shouldShowLiveLocation && Boolean(etaData.eta);
  const remainingMinutes = etaData.remainingMinutes || 0;
  const etaTime = hasEta
    ? new Date(etaData.eta).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  return (
    <div className="mt-6 rounded-[20px] border border-[#EFD7B3] bg-[linear-gradient(135deg,#FFF8EC_0%,#FFF1E4_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white/80 text-[#B8641A] shadow-sm">
            {shouldShowLiveLocation ? <Truck size={22} /> : <MapPinned size={22} />}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-[#2C1A0E]">
              {shouldShowLiveLocation ? "Delivery On The Way" : "Delivery Tracking Map"}
            </h3>

            {hasEta ? (
              <div className="mt-2">
                <p className="text-sm text-[#8B7355]">Estimated Arrival Time</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-3xl font-bold text-[#B8641A]">
                    {remainingMinutes}
                  </span>
                  <span className="text-[#8B7355]">minutes away</span>
                </div>
                <p className="text-xs text-[#A88763]">Around {etaTime}</p>
              </div>
            ) : (
              <div className="mt-2 rounded-[14px] border border-[#F0D1B2] bg-[#FFF6EA] px-3 py-2">
                <p className="text-sm font-semibold text-[#B8641A]">
                  {shouldShowLiveLocation
                    ? etaData.message || "Live location is active. ETA is updating."
                    : etaData.message || "Order is not out for delivery yet. The map is ready and live agent location will appear once delivery starts."}
                </p>
              </div>
            )}

            {shouldShowLiveLocation && etaData.remainingDistance !== null && (
              <div className="mt-3 border-t border-[#EFD7B3] pt-3">
                <p className="text-sm text-[#8B7355]">Distance</p>
                <div className="mt-1 flex items-center gap-2">
                  <MapPinned size={16} className="text-[#B8641A]" />
                  <p className="font-semibold text-[#B8641A]">
                    {etaData.remainingDistance} km away
                  </p>
                </div>
              </div>
            )}

            {etaData.lastUpdated && (
              <p className="mt-2 text-xs text-[#A88763]">
                Updated {new Date(etaData.lastUpdated).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="sm:ml-4">
          <span className="inline-block rounded bg-[#FDE9C9] px-2 py-1 text-xs font-bold text-[#B8641A]">
            {shouldShowLiveLocation ? "Live" : "Waiting"}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[18px] border border-[#EFD7B3] bg-white">
        <div className="border-b border-[#F2E6D7] px-4 py-3">
          <h4 className="text-sm font-bold text-[#2C1A0E]">Agent Current Location</h4>
          <p className="mt-1 text-xs text-[#8B7355]">
            {shouldShowLiveLocation && agentCoordinates
              ? `${agentCoordinates[0].toFixed(6)}, ${agentCoordinates[1].toFixed(6)}`
              : "Agent live location will appear here after the order goes out for delivery."}
          </p>
          {shouldShowLiveLocation && resolvedRouteCoordinates.length >= 2 ? (
            <p className="mt-2 text-xs font-semibold text-[#B8641A]">
              Showing the shortest road path from the agent&apos;s current location to your home.
            </p>
          ) : null}
        </div>

        {shouldShowLiveLocation && agentCoordinates ? (
          <MapContainer
            center={agentCoordinates}
            zoom={16}
            scrollWheelZoom={false}
            className="h-[240px] w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapUpdater center={agentCoordinates} />
            <MapBoundsUpdater points={resolvedRouteCoordinates} />
            <CircleMarker
              center={agentCoordinates}
              radius={28}
              pathOptions={{
                color: "#F2B46D",
                fillColor: "#FCE2BF",
                fillOpacity: 0.45,
              }}
            />
            <Marker position={agentCoordinates} />
            {customerCoordinates ? (
              <CircleMarker
                center={customerCoordinates}
                radius={20}
                pathOptions={{
                  color: "#4A7C2F",
                  fillColor: "#DDE8D1",
                  fillOpacity: 0.7,
                  weight: 2,
                }}
              />
            ) : null}
            {customerCoordinates ? <Marker position={customerCoordinates} /> : null}
            {resolvedRouteCoordinates.length >= 2 ? (
              <Polyline
                positions={resolvedRouteCoordinates}
                pathOptions={{
                  color: "#B8641A",
                  weight: 4,
                  opacity: 0.85,
                }}
              />
            ) : null}
          </MapContainer>
        ) : (
          <div className="flex h-[240px] items-center justify-center bg-[#FBF7F0] px-6 text-center text-sm font-medium text-[#8B7355]">
            <div className="flex max-w-sm flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#B8641A] shadow-sm">
                {shouldShowLiveLocation ? <Clock3 size={20} /> : <MapPinned size={20} />}
              </div>
              <p>
                {shouldShowLiveLocation
                  ? "Live map will appear here as soon as the agent's current location is received."
                  : "Map is ready. Live agent location will start showing here once the order is out for delivery."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryETADisplay;
