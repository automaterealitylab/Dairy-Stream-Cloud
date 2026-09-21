import { ArrowUp, CornerUpLeft, CornerUpRight, Undo2 } from "lucide-react";
import { ROAD_ROUTE_PRECISION } from "../constants/agent";

const roadRouteCache = new Map();
const roadDistanceTableCache = new Map();

export const formatInstructionDistance = (distanceInMeters) => {
  if (!Number.isFinite(distanceInMeters)) return "";
  if (distanceInMeters < 1000) return `${Math.max(10, Math.round(distanceInMeters / 10) * 10)} m`;
  return `${(distanceInMeters / 1000).toFixed(distanceInMeters >= 10000 ? 0 : 1)} km`;
};

export const formatManeuverText = (step) => {
  const type = String(step?.maneuver?.type || "").toLowerCase();
  const modifier = String(step?.maneuver?.modifier || "").toLowerCase();
  const roadName = String(step?.name || "").trim();
  const roadSuffix = roadName ? ` onto ${roadName}` : "";

  if (type === "depart") return roadName ? `Head on ${roadName}` : "Start and continue ahead";
  if (type === "arrive") return "Arrive at destination";
  if (type === "roundabout") return roadName ? `Take the roundabout to ${roadName}` : "Take the roundabout";
  if (type === "merge") return roadName ? `Merge onto ${roadName}` : "Merge ahead";
  if (type === "fork") return modifier ? `Keep ${modifier}${roadSuffix}` : `Keep ahead${roadSuffix}`;
  if (modifier === "uturn") return "Make a U-turn";
  if (modifier) return `Turn ${modifier}${roadSuffix}`;
  if (type === "continue") return roadName ? `Continue on ${roadName}` : "Continue ahead";
  return roadName ? `Continue on ${roadName}` : "Continue ahead";
};

export const getUpcomingInstructionSummary = (route) => {
  const steps = route?.legs?.flatMap((leg) => (Array.isArray(leg?.steps) ? leg.steps : [])) || [];
  const meaningfulSteps = steps.filter((step) => String(step?.maneuver?.type || "").toLowerCase() !== "depart");
  const [primaryStep, secondaryStep] = meaningfulSteps;

  return {
    primary: primaryStep
      ? {
        distanceMeters: Number.isFinite(Number(primaryStep.distance)) ? Number(primaryStep.distance) : null,
        distanceLabel: formatInstructionDistance(primaryStep.distance),
        text: formatManeuverText(primaryStep),
      }
      : null,
    secondary: secondaryStep
      ? {
        distanceMeters: Number.isFinite(Number(secondaryStep.distance)) ? Number(secondaryStep.distance) : null,
        distanceLabel: formatInstructionDistance(secondaryStep.distance),
        text: formatManeuverText(secondaryStep),
      }
      : null,
  };
};

export const buildSpokenInstruction = (instruction, distanceMeters) => {
  if (!instruction?.text) return "";
  if (!Number.isFinite(distanceMeters)) return instruction.text;
  if (distanceMeters <= 120) return `Now ${instruction.text.toLowerCase()}.`;
  if (distanceMeters <= 600) {
    return `In ${formatInstructionDistance(distanceMeters)}, ${instruction.text.toLowerCase()}.`;
  }
  return `After ${formatInstructionDistance(distanceMeters)}, ${instruction.text.toLowerCase()}.`;
};

export const buildRouteCacheKey = (agentCoordinates, customerCoordinates) => {
  if (!Array.isArray(agentCoordinates) || !Array.isArray(customerCoordinates)) return null;

  return [
    agentCoordinates[0].toFixed(ROAD_ROUTE_PRECISION),
    agentCoordinates[1].toFixed(ROAD_ROUTE_PRECISION),
    customerCoordinates[0].toFixed(ROAD_ROUTE_PRECISION),
    customerCoordinates[1].toFixed(ROAD_ROUTE_PRECISION),
  ].join(":");
};

export const fetchRoadRoute = async (agentCoordinates, customerCoordinates, signal) => {
  if (!Array.isArray(agentCoordinates) || !Array.isArray(customerCoordinates)) {
    return { points: [], distanceMeters: null, durationSeconds: null };
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
    `?overview=simplified&geometries=geojson&steps=true`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Road route request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  const geometry = route?.geometry?.coordinates;
  const routePoints = Array.isArray(geometry)
    ? geometry
      .map((point) => {
        const lng = Number(point?.[0]);
        const lat = Number(point?.[1]);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      })
      .filter(Boolean)
    : [];
  const routeData = {
    points: routePoints,
    distanceMeters: Number.isFinite(Number(route?.distance)) ? Number(route.distance) : null,
    durationSeconds: Number.isFinite(Number(route?.duration)) ? Number(route.duration) : null,
    instructions: getUpcomingInstructionSummary(route),
  };

  if (cacheKey) {
    roadRouteCache.set(cacheKey, routeData);
  }

  return routeData;
};

export const fetchRoadDistanceTable = async (originCoordinates, deliveries, signal) => {
  if (!Array.isArray(originCoordinates) || !Array.isArray(deliveries) || deliveries.length === 0) {
    return {};
  }

  const validDeliveries = deliveries.filter((delivery) => Array.isArray(delivery?.coordinates));
  if (validDeliveries.length === 0) return {};

  const cacheKey = [
    originCoordinates[0].toFixed(4),
    originCoordinates[1].toFixed(4),
    validDeliveries
      .map(
        (delivery) =>
          `${delivery.id}:${delivery.coordinates[0].toFixed(4)}:${delivery.coordinates[1].toFixed(4)}`
      )
      .join("|"),
  ].join("::");

  if (roadDistanceTableCache.has(cacheKey)) {
    return roadDistanceTableCache.get(cacheKey);
  }

  const [originLat, originLng] = originCoordinates;
  const coordinatesParam = [
    `${originLng},${originLat}`,
    ...validDeliveries.map((delivery) => `${delivery.coordinates[1]},${delivery.coordinates[0]}`),
  ].join(";");

  const destinationsParam = validDeliveries.map((_, index) => index + 1).join(";");
  const url =
    `https://router.project-osrm.org/table/v1/driving/${coordinatesParam}` +
    `?sources=0&destinations=${destinationsParam}&annotations=distance`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Road distance table request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const distanceRow = Array.isArray(payload?.distances?.[0]) ? payload.distances[0] : [];

  const result = validDeliveries.reduce((accumulator, delivery, index) => {
    const distanceMeters = Number(distanceRow[index]);
    accumulator[String(delivery.id)] = Number.isFinite(distanceMeters) ? distanceMeters : null;
    return accumulator;
  }, {});

  roadDistanceTableCache.set(cacheKey, result);
  return result;
};

export const getDeliveryCoordinates = (delivery) => {
  const lat = Number(
    delivery?.lat ??
    delivery?.latitude ??
    delivery?.customerLat ??
    delivery?.customerLatitude ??
    delivery?.location?.lat ??
    delivery?.location?.latitude
  );
  const lng = Number(
    delivery?.lng ??
    delivery?.longitude ??
    delivery?.customerLng ??
    delivery?.customerLongitude ??
    delivery?.location?.lng ??
    delivery?.location?.longitude
  );

  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

export const getDairyCoordinates = (source) => {
  const lat = Number(
    source?.dairyLat ??
    source?.dairyLatitude ??
    source?.dairyFarmLat ??
    source?.dairyFarmLatitude ??
    source?.dairy?.latitude ??
    source?.dairy?.lat
  );
  const lng = Number(
    source?.dairyLng ??
    source?.dairyLongitude ??
    source?.dairyFarmLng ??
    source?.dairyFarmLongitude ??
    source?.dairy?.longitude ??
    source?.dairy?.lng
  );

  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

export const getDistanceInMeters = (from, to) => {
  if (!from || !to) return null;

  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
    Math.cos(toRadians(toLat)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getTurnInstructionLabel = (instruction) => {
  const text = String(instruction?.text || "").trim();
  if (!text) return "Follow route";

  if (/u-turn/i.test(text)) return "Make a U-turn";
  if (/turn right/i.test(text)) return "Take right";
  if (/turn left/i.test(text)) return "Take left";
  if (/keep right/i.test(text)) return "Keep right";
  if (/keep left/i.test(text)) return "Keep left";
  if (/continue|head|straight/i.test(text)) return "Go straight";
  if (/arrive/i.test(text)) return "Reach destination";

  return text;
};

export const getTurnInstructionIcon = (instruction) => {
  const text = String(instruction?.text || "").trim();
  if (/u-turn/i.test(text)) return Undo2;
  if (/turn right|keep right/i.test(text)) return CornerUpRight;
  if (/turn left|keep left/i.test(text)) return CornerUpLeft;
  return ArrowUp;
};

export const _getTurnInstructionDetail = (instruction, fallbackDelivery) => {
  const text = String(instruction?.text || "").trim();
  const towardMatch = text.match(/\b(?:onto|on|to)\s+(.+)$/i);
  if (towardMatch?.[1]) return towardMatch[1];
  return fallbackDelivery?.customerName || fallbackDelivery?.address || "next location";
};

export const getAutoZoomLevel = (distanceInMeters) => {
  if (!Number.isFinite(distanceInMeters)) return 15;
  if (distanceInMeters <= 75) return 18;
  if (distanceInMeters <= 150) return 18;
  if (distanceInMeters <= 300) return 17;
  if (distanceInMeters <= 700) return 16;
  if (distanceInMeters <= 1500) return 15;
  return 14;
};

export const formatDistanceLabel = (distanceInMeters) => {
  if (!Number.isFinite(distanceInMeters)) return "Distance unavailable";
  if (distanceInMeters < 1000) return `${Math.round(distanceInMeters)} m`;
  return `${(distanceInMeters / 1000).toFixed(distanceInMeters >= 10000 ? 0 : 1)} km`;
};

export const _formatDistanceLabel = formatDistanceLabel;

export const formatDurationLabel = (durationSeconds) => {
  if (!Number.isFinite(durationSeconds)) return "ETA unavailable";
  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
};

export const _formatDurationLabel = formatDurationLabel;

