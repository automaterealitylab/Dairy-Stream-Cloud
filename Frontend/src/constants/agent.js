const headingFont = { fontFamily: "'Lora', serif" };
const DELIVERY_RUN_STORAGE_KEY = "agent-dashboard-delivery-run";
const SPEECH_MUTED_STORAGE_KEY = "agent-dashboard-speech-muted";
const MAP_DELIVERED_PATH_VISIBLE_KEY = "agent-map-show-delivered-path";
const MAP_DAIRY_PATH_VISIBLE_KEY = "agent-map-show-dairy-path";
const SLOT_META = {
  MORNING: {
    label: "Morning",
    startHour: 6,
    startMinute: 0,
    endHour: 9,
    endMinute: 0,
  },
  EVENING: {
    label: "Evening",
    startHour: 17,
    startMinute: 0,
    endHour: 20,
    endMinute: 0,
  },
};

const ROAD_ROUTE_PRECISION = 5;
const MAX_ROUTE_PREVIEW_DISTANCE_METERS = 50000;

const ActiveNavLabel = {
  HOME: "HOME",
  MAP: "MAP",
};

export {
  headingFont,
  DELIVERY_RUN_STORAGE_KEY,
  SPEECH_MUTED_STORAGE_KEY,
  MAP_DELIVERED_PATH_VISIBLE_KEY,
  MAP_DAIRY_PATH_VISIBLE_KEY,
  SLOT_META,
  ROAD_ROUTE_PRECISION,
  MAX_ROUTE_PREVIEW_DISTANCE_METERS,
  ActiveNavLabel,
};
