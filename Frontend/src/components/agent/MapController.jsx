import { useEffect } from "react";
import { useMap } from "react-leaflet";

export const MapController = ({ center, zoom, trigger }) => {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    map.flyTo(center, zoom || 15, {
      animate: true,
      duration: 1.2,
    });
  }, [center, zoom, trigger, map]);

  return null;
};
