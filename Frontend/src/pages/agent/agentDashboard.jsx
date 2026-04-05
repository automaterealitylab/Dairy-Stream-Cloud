import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  CircleMarker, 
  Polyline,
  useMap 
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Navigation,
  Map as MapIcon,
  Home,
  List,
  User,
  History,
} from "lucide-react";

import { fetchAssignedAgentDeliveries } from "../../api/agent/agent.api";

// --- HELPERS & STYLES ---

// Fix for Leaflet default icon issues in React
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/**
 * Helper component that moves the map view smoothly 
 * when the coordinates or zoom trigger change.
 */
const MapController = ({ center, zoom, trigger }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 15, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [center, zoom, trigger, map]);
  return null;
};

// --- MAIN COMPONENT ---

const AgentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 1. STATE MANAGEMENT
  const [stats, setStats] = useState({ totalAssigned: 0, completed: 0, pending: 0, failed: 0 });
  const [deliveries, setDeliveries] = useState([]);
  const [agentLocation, setAgentLocation] = useState(null); // Real GPS coords
  const [mapView, setMapView] = useState(null); // Current focus of the map
  const [zoomLevel, setZoomLevel] = useState(15);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // 2. FETCH DATA FROM BACKEND
  const loadDashboard = useCallback(async () => {
    try {
      const assigned = await fetchAssignedAgentDeliveries();
      const resolved = assigned || [];
      setDeliveries(resolved);
      setStats({
        totalAssigned: resolved.length,
        completed: resolved.filter((d) => d.status === "COMPLETED").length,
        pending: resolved.filter((d) => d.status === "PENDING").length,
        failed: resolved.filter((d) => d.status === "FAILED").length,
      });
    } catch (_err) {
      setDeliveries([]);
    }
  }, []);

  // 3. GEOLOCATION WATCHER
  useEffect(() => {
    loadDashboard();

    if (navigator.geolocation) {
      const watcher = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setAgentLocation(coords);
          // Only set initial map view once we get the first GPS hit
          if (!mapView) setMapView(coords);
        },
        (err) => console.error("GPS Error:", err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watcher);
    }
  }, [loadDashboard]);

  // 4. LOGIC CALCULATIONS
  const completionPercentage = stats.totalAssigned > 0 
    ? Math.round((stats.completed / stats.totalAssigned) * 100) : 0;

  const nextTask = deliveries.find(d => d.status === 'PENDING');

  // UI Mini Stat Helper
  const MiniStat = ({ color, label, val, icon }) => (
    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className={`p-2 rounded-xl ${color.split(' ')[1]} bg-opacity-10`}>
        {React.cloneElement(icon, { size: 14, className: color.split(' ')[0] })}
      </div>
      <div>
        <p className="text-sm font-black text-gray-900 leading-none">{val}</p>
        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter mt-1">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-32 px-4 pt-4 font-sans">
      <div className="max-w-md mx-auto space-y-4">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-black tracking-tight">Agent Portal</h2>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${isOnline ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-[9px] font-bold uppercase">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        {/* STEP 1: CARDS */}
        <div className="grid grid-cols-2 gap-2">
          <MiniStat color="text-blue-600 bg-blue-50" label="Assigned" val={stats.totalAssigned} icon={<Package />} />
          <MiniStat color="text-emerald-600 bg-emerald-50" label="Completed" val={stats.completed} icon={<CheckCircle />} />
          <MiniStat color="text-orange-600 bg-orange-50" label="Pending" val={stats.pending} icon={<Clock />} />
          <MiniStat color="text-red-600 bg-red-50" label="Failed" val={stats.failed} icon={<XCircle />} />
        </div>

        {/* STEP 2: PROGRESS BAR */}
        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Shift Progress</span>
            <span className="text-[10px] font-black text-blue-600">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${completionPercentage}%` }} />
          </div>
        </div>

        {/* STEP 3: THE MAP AREA */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <MapIcon size={14} className="text-blue-600" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Internal Routing</span>
            </div>
            <button 
              onClick={() => {
                setMapView(agentLocation);
                setZoomLevel(15);
                setRecenterTrigger(prev => prev + 1);
              }} 
              className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 active:scale-90 transition-all"
            >
              Recenter GPS
            </button>
          </div>

          <div className="w-full h-[300px] rounded-[32px] overflow-hidden border-2 border-white shadow-md relative bg-gray-100 flex items-center justify-center z-0">
            {agentLocation ? (
              <MapContainer center={agentLocation} zoom={15} className="h-full w-full" zoomControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                <MapController center={mapView} zoom={zoomLevel} trigger={recenterTrigger} />

                {/* Agent Marker */}
                <CircleMarker center={agentLocation} radius={10} pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.8, color: '#fff', weight: 3 }}>
                  <Popup className="font-bold text-xs">Your Location</Popup>
                </CircleMarker>

                {/* Delivery Markers & Routing Line */}
                {deliveries.map((delivery) => (
                  delivery.lat && delivery.lng && (
                    <React.Fragment key={delivery.id}>
                      <Marker 
                        position={[delivery.lat, delivery.lng]}
                        icon={L.divIcon({
                          className: 'custom-div-icon',
                          html: `<div style="background-color: ${delivery.status === 'COMPLETED' ? '#10b981' : '#f97316'}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                          iconSize: [12, 12],
                          iconAnchor: [6, 6]
                        })}
                      >
                        <Popup><p className="text-[10px] font-bold">{delivery.customerName}</p></Popup>
                      </Marker>

                      {/* Line to Next Pending Task */}
                      {delivery.status === 'PENDING' && (
                        <Polyline 
                          positions={[agentLocation, [delivery.lat, delivery.lng]]}
                          pathOptions={{ color: '#3b82f6', dashArray: '8, 8', weight: 2, opacity: 0.5 }}
                        />
                      )}
                    </React.Fragment>
                  )
                ))}
              </MapContainer>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Initializing GPS...</p>
              </div>
            )}
          </div>
        </div>

        {/* STEP 4: NAVIGATION CARD (2 ROWS) */}
        <div className="bg-gray-900 p-5 rounded-[30px] shadow-xl space-y-4 text-white">
          <div className="flex justify-between items-center">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Target Address</p>
              <h3 className="text-sm font-black truncate">{nextTask?.customerName || "No active tasks"}</h3>
              <p className="text-[10px] font-bold text-gray-400 truncate mt-0.5">{nextTask?.address || "Wait for assignment"}</p>
            </div>
            {nextTask && (
              <div className="bg-blue-600/20 px-3 py-2 rounded-2xl border border-blue-500/20 text-center">
                <p className="text-xs font-black text-blue-400">₹{nextTask.amount || '0'}</p>
                <p className="text-[8px] font-bold text-blue-300 uppercase">Val</p>
              </div>
            )}
          </div>

          <button 
            onClick={() => {
              if (nextTask?.lat && nextTask?.lng) {
                setMapView([nextTask.lat, nextTask.lng]);
                setZoomLevel(17); // Closer zoom for the target
                setRecenterTrigger(prev => prev + 1);
              }
            }} 
            disabled={!nextTask}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/20"
          >
            <Navigation size={18} fill="currentColor" />
            <span className="text-[11px] font-black uppercase tracking-[0.1em]">Focus Destination</span>
          </button>
        </div>

        {/* FOOTER NAV */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white/90 backdrop-blur-md border border-gray-200 p-2 rounded-full flex justify-around items-center z-50 shadow-2xl">
          <NavTab icon={<Home size={18} />} label="Home" active onClick={() => navigate("/agent/dashboard")} />
          <NavTab icon={<List size={18} />} label="Tasks" onClick={() => navigate("/agent/working")} />
          <NavTab icon={<History size={18} />} label="History" onClick={() => navigate("/agent/history")} />
          <NavTab icon={<User size={18} />} label="Profile" onClick={() => navigate("/agent/profile")} />
        </div>
      </div>
    </div>
  );
};

const NavTab = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 p-2 rounded-2xl min-w-[65px] transition-colors ${active ? "text-blue-600" : "text-gray-400"}`}>
    {icon}
    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
    {active && <div className="w-1 h-1 bg-blue-600 rounded-full mt-0.5" />}
  </button>
);

export default AgentDashboard;