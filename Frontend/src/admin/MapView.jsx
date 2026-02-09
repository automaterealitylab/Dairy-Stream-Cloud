import { MapContainer, TileLayer } from "react-leaflet";

const MapView = () => (
  <MapContainer center={[18.5204, 73.8567]} zoom={13}>
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  </MapContainer>
);

export default MapView;
