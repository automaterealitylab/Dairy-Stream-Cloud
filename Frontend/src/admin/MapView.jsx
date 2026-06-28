import { MapContainer, TileLayer } from "react-leaflet";

const MapView = () => (
  <div className="relative"><MapContainer center={[18.5204, 73.8567]} zoom={13}>
    <TileLayer
      
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  </MapContainer><div className="absolute bottom-[18px] right-[55px] z-[1000] bg-white/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-[#8B7355] pointer-events-none select-none rounded border border-[#EDE8DF]/40">
      DairyVision Maps
    </div></div>
);

export default MapView;
