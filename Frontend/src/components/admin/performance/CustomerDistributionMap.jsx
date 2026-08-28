import React, { useMemo } from 'react';
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export const CustomerDistributionMap = ({ customers, dairy }) => {
  const dairyCoords = useMemo(() => {
    const lat = Number(dairy?.latitude || dairy?.lat);
    const lng = Number(dairy?.longitude || dairy?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 ? [lat, lng] : null;
  }, [dairy]);

  const mapCenter = useMemo(() => {
    if (dairyCoords) return dairyCoords;
    const valid = customers.find(c => {
      const lat = Number(c?.latitude);
      const lng = Number(c?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    });
    if (valid) {
      return [Number(valid.latitude), Number(valid.longitude)];
    }
    return [18.5204, 73.8567]; // Pune default center
  }, [customers, dairyCoords]);

  const getCoordinates = (customer, index) => {
    const lat = Number(customer?.latitude);
    const lng = Number(customer?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      return [lat, lng];
    }
    // Deterministic circular offsets around Pune default center
    const baseLat = 18.5204;
    const baseLng = 73.8567;
    const seed = customer?.id
      ? String(customer.id).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : index;
    const angle = (seed * 17) % 360;
    const radius = 0.01 + ((seed * 11) % 4) * 0.01;
    const radians = (angle * Math.PI) / 180;
    return [baseLat + Math.sin(radians) * radius, baseLng + Math.cos(radians) * radius];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-full bg-[#EF4444] border-2 border-white shadow-sm"></span> Dairy Source
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 border border-dashed border-[#EF4444] rounded-full bg-[#EF4444]/10"></span> Delivery Radius ({dairy?.service_radius || 10}km)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#10B981]"></span> Active Subscriptions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#F59E0B]"></span> Pending Approval
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#9CA3AF]"></span> Inactive/Closed
          </span>
        </div>
        <div className="text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
          Total Mapped Customers: {customers.length}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800/80">
        <div className="relative w-full h-[450px]">
        <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="h-full w-full z-0">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Render Dairy Source Marker */}
          {dairyCoords && (
            <>
              <Marker
                position={dairyCoords}
                icon={L.divIcon({
                  className: "custom-div-icon",
                  html: '<div style="background-color: #EF4444; width: 20px; height: 20px; border-radius: 999px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                })}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-[#2C1A0E]">
                    <p className="text-xs font-black m-0 leading-tight">{dairy?.dairy_name || "Our Dairy"}</p>
                    <p className="text-[10px] text-slate-500 m-0">{dairy?.address || "Source Facility"}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-widest mt-1">
                      Dairy Source
                    </span>
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={dairyCoords}
                radius={Number(dairy?.service_radius || 10) * 1000}
                pathOptions={{
                  color: "#EF4444",
                  fillColor: "#EF4444",
                  fillOpacity: 0.05,
                  weight: 2,
                  dashArray: "5, 10",
                }}
              />
            </>
          )}

          {/* Render Customer Markers */}
          {customers.map((c, i) => {
            const coords = getCoordinates(c, i);
            const isActive = c.subscriptionStatus === "ACTIVE" && c.subscriptionApprovalStatus === "APPROVED";
            const isPending = c.subscriptionApprovalStatus === "PENDING" || c.hasPendingSubscriptionApproval;
            const markerColor = isActive ? "#10B981" : isPending ? "#F59E0B" : "#9CA3AF";
            const building = c.building_name || c.buildingName || "Unknown Building";
            const room = c.room_no || c.roomNo || "";
            const wingStr = c.wing ? `, Wing ${c.wing}` : "";

            return (
              <Marker
                key={c.id || i}
                position={coords}
                icon={L.divIcon({
                  className: "custom-div-icon",
                  html: `<div style="background-color: ${markerColor}; width: 16px; height: 16px; border-radius: 999px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25);"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8],
                })}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-[#2C1A0E]">
                    <p className="text-xs font-black m-0 leading-tight">{c.customer_name || c.customerName || "Customer"}</p>
                    <p className="text-[10px] font-bold text-slate-500 m-0">{c.phone_number || c.phone || "No phone"}</p>
                    <p className="text-[10px] text-slate-500 m-0 leading-snug">
                      {building}{wingStr}{room ? `, Apt ${room}` : ""}
                    </p>
                    <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                      <span className="text-slate-400">Status:</span>
                      <span style={{ color: markerColor }}>
                        {isActive ? "Active" : isPending ? "Pending" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        <div className="absolute bottom-[18px] right-[55px] z-[1000] bg-white/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-[#8B7355] pointer-events-none select-none rounded border border-[#EDE8DF]/40">
          DairyVision Maps
        </div>
      </div>

      </div>
    </div>
  );
};
