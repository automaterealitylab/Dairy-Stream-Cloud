import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { ensureSocketConnection } from "../socket";

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

const TrackAgentMap = ({ orderId, initialPosition = null, canTrack = true }) => {
  const initialCoordinates =
    Number.isFinite(Number(initialPosition?.lat)) && Number.isFinite(Number(initialPosition?.lng))
      ? [Number(initialPosition.lat), Number(initialPosition.lng)]
      : null;

  const [position, setPosition] = useState(initialCoordinates);
  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    if (!orderId) return undefined;

    const connectedSocket = ensureSocketConnection();
    connectedSocket.emit("customer:trackOrder", { orderId });

    const handleLocation = ({ orderId: incomingOrderId, lat, lng, timestamp, isOnline } = {}) => {
      if (String(incomingOrderId) !== String(orderId)) return;
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      setPosition([latitude, longitude]);
      setLastUpdatedAt(Number(timestamp) || Date.now());
      setIsOffline(isOnline === false ? true : false);
    };

    const handleOffline = ({ orderId: incomingOrderId, timestamp } = {}) => {
      if (String(incomingOrderId) !== String(orderId)) return;
      setIsOffline(true);
      setLastUpdatedAt(Number(timestamp) || Date.now());
    };

    connectedSocket.on("agent:location", handleLocation);
    connectedSocket.on("agent:offline", handleOffline);

    return () => {
      connectedSocket.emit("customer:untrackOrder", { orderId });
      connectedSocket.off("agent:location", handleLocation);
      connectedSocket.off("agent:offline", handleOffline);
    };
  }, [orderId]);

  const mapCenter = useMemo(() => position || DEFAULT_CENTER, [position]);

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
        {position ? <Marker position={position} /> : null}
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
