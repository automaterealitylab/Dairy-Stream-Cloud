import React, { useEffect } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const customerPinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const MapViewUpdater = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    if (Array.isArray(center) && center.length === 2) {
      map.flyTo(center, map.getZoom(), {
        animate: true,
        duration: 1,
      });
    }
  }, [center, map]);

  return null;
};

const MapPinSelector = ({ onSelect }) => {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
};

export default function LazyCustomerProfileMap({
  mapCenter,
  setPinnedLocation,
  gpsLocation,
  formDataLatitude,
  formDataLongitude,
  getCoordinatePair,
}) {
  return (
    <MapContainer
      center={mapCenter}
      zoom={17}
      scrollWheelZoom
      dragging={!L.Browser?.mobile}
      tap={!L.Browser?.mobile}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewUpdater center={mapCenter} />
      <MapPinSelector onSelect={setPinnedLocation} />

      {gpsLocation && (
        <CircleMarker
          center={[gpsLocation.lat, gpsLocation.lng]}
          radius={10}
          pathOptions={{
            color: "#2563EB",
            fillColor: "#60A5FA",
            fillOpacity: 0.6,
            weight: 2,
          }}
        />
      )}

      {getCoordinatePair(formDataLatitude, formDataLongitude) && (
        <Marker
          position={[Number(formDataLatitude), Number(formDataLongitude)]}
          icon={customerPinIcon}
        />
      )}
    </MapContainer>
  );
}
