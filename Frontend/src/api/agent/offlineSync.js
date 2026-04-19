import client from "../client";

const STORAGE_PREFIX = "agent-offline";
const DELIVERIES_CACHE_KEY = "deliveries";
const LOCATION_CACHE_KEY = "location";
const ACTION_QUEUE_KEY = "queue";
const CHANGE_EVENT = "agent-offline-state-change";

let syncPromise = null;
let onlineListenerAttached = false;

const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_err) {
    return fallback;
  }
};

const buildUnauthorizedError = () => {
  const error = new Error("Unauthorized");
  error.response = { status: 401, data: { message: "Unauthorized" } };
  return error;
};

const isUnauthorizedError = (error) => Number(error?.response?.status) === 401;

const hasAgentAuth = () => {
  const storedUser = safeJsonParse(localStorage.getItem("user"), null);
  const fallbackRole = String(storedUser?.role || localStorage.getItem("userRole") || "").toUpperCase();
  return Boolean(
    localStorage.getItem("agentToken") ||
      ((fallbackRole === "AGENT" || fallbackRole === "STAFF") && storedUser?.token)
  );
};

const getStoredAgentIdentity = () => {
  const storedUser = safeJsonParse(localStorage.getItem("user"), null);
  return (
    storedUser?.id ||
    storedUser?.user?.id ||
    storedUser?.agent?.id ||
    storedUser?.phone ||
    storedUser?.user?.phone ||
    localStorage.getItem("agentToken") ||
    "default"
  );
};

const getScopedKey = (suffix) => `${STORAGE_PREFIX}:${getStoredAgentIdentity()}:${suffix}`;

const emitOfflineStateChange = () => {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

const readScopedJson = (suffix, fallback) =>
  safeJsonParse(localStorage.getItem(getScopedKey(suffix)), fallback);

const writeScopedJson = (suffix, value) => {
  localStorage.setItem(getScopedKey(suffix), JSON.stringify(value));
  emitOfflineStateChange();
};

const removeScopedItem = (suffix) => {
  localStorage.removeItem(getScopedKey(suffix));
  emitOfflineStateChange();
};

const getTodayKey = (value = new Date()) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isNetworkError = (error) =>
  !error?.response ||
  error?.code === "ERR_NETWORK" ||
  error?.message === "Network Error";

const getDeliveryCachePayload = () =>
  readScopedJson(DELIVERIES_CACHE_KEY, {
    items: [],
    updatedAt: null,
  });

const setDeliveryCachePayload = (payload) => {
  writeScopedJson(DELIVERIES_CACHE_KEY, payload);
};

const getActionQueue = () => readScopedJson(ACTION_QUEUE_KEY, []);

const setActionQueue = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    removeScopedItem(ACTION_QUEUE_KEY);
    return;
  }
  writeScopedJson(ACTION_QUEUE_KEY, items);
};

const normalizeCollectionMethod = (collectionMethod = "") =>
  String(collectionMethod || "").trim().toUpperCase();

const applyStartDelivery = (delivery, action) => {
  if (String(delivery?.id) !== String(action?.deliveryId)) return delivery;
  return {
    ...delivery,
    status: "OUT_FOR_DELIVERY",
    agentLocation:
      Number.isFinite(Number(action?.latitude)) && Number.isFinite(Number(action?.longitude))
        ? { lat: Number(action.latitude), lng: Number(action.longitude) }
        : delivery?.agentLocation || null,
  };
};

const applyStatusUpdate = (delivery, action) => {
  if (String(delivery?.id) !== String(action?.deliveryId)) return delivery;

  const nextStatus = String(action?.status || "").toUpperCase();
  const patch = {
    ...delivery,
    status: nextStatus,
  };

  if (nextStatus === "FAILED") {
    patch.failedReason = action?.reason || delivery?.failedReason || "";
  }

  if (nextStatus === "COMPLETED") {
    patch.deliveryProofType = action?.proofType || delivery?.deliveryProofType || "";
    patch.deliveryProofOtp = action?.proofOtp || delivery?.deliveryProofOtp || "";
    patch.deliveryProofImage = action?.proofImage || delivery?.deliveryProofImage || "";
    patch.paymentCollectionMethod =
      normalizeCollectionMethod(action?.collectionMethod) || delivery?.paymentCollectionMethod || "";
  }

  return patch;
};

const applyLocationUpdate = (delivery, action) => {
  if (String(delivery?.id) !== String(action?.deliveryId)) return delivery;
  if (!Number.isFinite(Number(action?.latitude)) || !Number.isFinite(Number(action?.longitude))) {
    return delivery;
  }

  return {
    ...delivery,
    agentLocation: {
      lat: Number(action.latitude),
      lng: Number(action.longitude),
    },
  };
};

const applyQueuedActionsToDeliveries = (deliveries = [], actions = getActionQueue()) => {
  if (!Array.isArray(deliveries) || deliveries.length === 0 || !Array.isArray(actions) || actions.length === 0) {
    return Array.isArray(deliveries) ? deliveries : [];
  }

  return actions.reduce((items, action) => {
    if (action?.type === "START_DELIVERY") {
      return items.map((delivery) => applyStartDelivery(delivery, action));
    }
    if (action?.type === "UPDATE_DELIVERY_STATUS") {
      return items.map((delivery) => applyStatusUpdate(delivery, action));
    }
    if (action?.type === "UPDATE_LOCATION") {
      return items.map((delivery) => applyLocationUpdate(delivery, action));
    }
    return items;
  }, deliveries);
};

const updateCachedDeliveries = (updater) => {
  const currentPayload = getDeliveryCachePayload();
  const nextItems = updater(Array.isArray(currentPayload.items) ? currentPayload.items : []);
  setDeliveryCachePayload({
    items: nextItems,
    updatedAt: new Date().toISOString(),
  });
  return nextItems;
};

const mergeDeliveriesById = (existingItems = [], incomingItems = []) => {
  const incomingMap = new Map(incomingItems.map((item) => [String(item.id), item]));
  const merged = existingItems.map((item) => incomingMap.get(String(item.id)) || item);
  const existingIds = new Set(existingItems.map((item) => String(item.id)));

  incomingItems.forEach((item) => {
    if (!existingIds.has(String(item.id))) {
      merged.push(item);
    }
  });

  return merged;
};

const queueAction = (action) => {
  const actionQueue = getActionQueue();

  if (action.type === "UPDATE_LOCATION") {
    const filtered = actionQueue.filter(
      (item) => !(item.type === "UPDATE_LOCATION" && String(item.deliveryId) === String(action.deliveryId))
    );
    setActionQueue([...filtered, action]);
    return;
  }

  setActionQueue([...actionQueue, action]);
};

const createQueuedAction = (type, payload = {}) => ({
  id: `${type}:${payload.deliveryId || "global"}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
  type,
  createdAt: new Date().toISOString(),
  ...payload,
});

const syncQueuedAction = async (action) => {
  if (action.type === "START_DELIVERY") {
    const response = await client.post("/agent/deliveries/start", {
      deliveryId: action.deliveryId,
      latitude: action.latitude,
      longitude: action.longitude,
    });
    return response.data;
  }

  if (action.type === "UPDATE_DELIVERY_STATUS") {
    const response = await client.patch(`/agent/deliveries/${action.deliveryId}/status`, {
      status: action.status,
      reason: action.reason || "",
      proofType: action.proofType || "",
      proofOtp: action.proofOtp || "",
      proofImage: action.proofImage || "",
      collectionMethod: action.collectionMethod || "",
    });
    return response.data;
  }

  if (action.type === "UPDATE_LOCATION") {
    const response = await client.post("/agent/deliveries/location/update", {
      deliveryId: action.deliveryId,
      latitude: action.latitude,
      longitude: action.longitude,
    });
    return response.data;
  }

  return null;
};

export const getCachedAssignedAgentDeliveries = ({ today = false } = {}) => {
  const payload = getDeliveryCachePayload();
  const hydrated = applyQueuedActionsToDeliveries(Array.isArray(payload.items) ? payload.items : []);
  if (!today) return hydrated;
  const todayKey = getTodayKey();
  return hydrated.filter((delivery) => String(delivery?.date || "") === todayKey);
};

export const storeAssignedAgentDeliveries = (deliveries = [], { todayOnly = false } = {}) => {
  const hydrated = applyQueuedActionsToDeliveries(Array.isArray(deliveries) ? deliveries : []);
  const payload = getDeliveryCachePayload();
  const items = todayOnly
    ? mergeDeliveriesById(
        Array.isArray(payload.items) ? payload.items : [],
        hydrated
      )
    : hydrated;
  setDeliveryCachePayload({
    items,
    updatedAt: new Date().toISOString(),
  });
  return items;
};

export const getCachedAgentLocation = () => readScopedJson(LOCATION_CACHE_KEY, null);

export const storeAgentLocation = ({ lat, lng, recordedAt = new Date().toISOString() } = {}) => {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  const location = {
    lat: Number(lat),
    lng: Number(lng),
    recordedAt,
  };
  writeScopedJson(LOCATION_CACHE_KEY, location);
  return location;
};

export const getPendingAgentSyncCount = () => getActionQueue().length;

export const subscribeToAgentOfflineState = (listener) => {
  if (typeof listener !== "function") return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
};

export const primeAgentOfflineSync = (onOnline) => {
  if (!onlineListenerAttached) {
    onlineListenerAttached = true;

    window.addEventListener("online", async () => {
      if (!hasAgentAuth()) return;
      try {
        await flushAgentOfflineQueue();
      } finally {
        if (typeof onOnline === "function") {
          onOnline();
        }
      }
    });
  }

  if (!hasAgentAuth()) return;

  if (navigator.onLine && getPendingAgentSyncCount() > 0) {
    flushAgentOfflineQueue().catch((error) => {
      if (isUnauthorizedError(error)) return;
      console.error("Agent offline sync bootstrap failed:", error);
    });
  }
};

export const fetchAssignedAgentDeliveriesWithOffline = async ({ today = false } = {}) => {
  if (!hasAgentAuth()) {
    throw buildUnauthorizedError();
  }

  try {
    const { data } = await client.get("/agent/deliveries/assigned", {
      params: { today },
    });
    const deliveries = storeAssignedAgentDeliveries(data?.deliveries || [], { todayOnly: today });
    return today ? deliveries.filter((delivery) => String(delivery?.date || "") === getTodayKey()) : deliveries;
  } catch (error) {
    const cachedDeliveries = getCachedAssignedAgentDeliveries({ today });
    if (cachedDeliveries.length > 0) {
      return cachedDeliveries;
    }
    throw error;
  }
};

export const startDeliveryWithOffline = async (deliveryId, latitude, longitude) => {
  if (!deliveryId) throw new Error("deliveryId is required");
  if (!hasAgentAuth()) throw buildUnauthorizedError();

  const action = createQueuedAction("START_DELIVERY", {
    deliveryId,
    latitude,
    longitude,
  });

  updateCachedDeliveries((items) => items.map((delivery) => applyStartDelivery(delivery, action)));

  try {
    if (!navigator.onLine) throw new Error("Network Error");
    const response = await syncQueuedAction(action);
    return {
      ...response,
      queued: false,
    };
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }
    queueAction(action);
    return {
      success: true,
      queued: true,
      message: "Saved offline. Delivery will sync automatically when internet returns.",
    };
  }
};

export const updateAssignedAgentDeliveryStatusWithOffline = async ({
  deliveryId,
  status,
  reason = "",
  proofType = "",
  proofOtp = "",
  proofImage = "",
  collectionMethod = "",
} = {}) => {
  if (!deliveryId) throw new Error("deliveryId is required");
  if (!hasAgentAuth()) throw buildUnauthorizedError();

  const action = createQueuedAction("UPDATE_DELIVERY_STATUS", {
    deliveryId,
    status,
    reason,
    proofType,
    proofOtp,
    proofImage,
    collectionMethod,
  });

  updateCachedDeliveries((items) => items.map((delivery) => applyStatusUpdate(delivery, action)));

  try {
    if (!navigator.onLine) throw new Error("Network Error");
    const response = await syncQueuedAction(action);
    return {
      ...response,
      queued: false,
    };
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }
    queueAction(action);
    return {
      success: true,
      queued: true,
      message: "Saved offline. Status will sync automatically when internet returns.",
    };
  }
};

export const updateAgentLocationWithOffline = async (deliveryId, latitude, longitude) => {
  if (!deliveryId) throw new Error("deliveryId is required");
  if (!hasAgentAuth()) throw buildUnauthorizedError();

  storeAgentLocation({ lat: latitude, lng: longitude });

  const action = createQueuedAction("UPDATE_LOCATION", {
    deliveryId,
    latitude,
    longitude,
  });

  updateCachedDeliveries((items) => items.map((delivery) => applyLocationUpdate(delivery, action)));

  try {
    if (!navigator.onLine) throw new Error("Network Error");
    const response = await syncQueuedAction(action);
    return {
      ...response,
      queued: false,
    };
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }
    queueAction(action);
    return {
      success: true,
      queued: true,
      message: "Saved offline. Location will sync automatically when internet returns.",
    };
  }
};

export const flushAgentOfflineQueue = async () => {
  if (!hasAgentAuth()) {
    throw buildUnauthorizedError();
  }

  if (!navigator.onLine) {
    return { synced: false, pending: getPendingAgentSyncCount() };
  }

  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    let queue = getActionQueue();

    while (queue.length > 0) {
      const nextAction = queue[0];
      try {
        await syncQueuedAction(nextAction);
        queue = queue.slice(1);
        setActionQueue(queue);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          throw error;
        }
        if (isNetworkError(error)) {
          return { synced: false, pending: queue.length };
        }
        console.error("Agent offline sync failed:", error);
        queue = queue.slice(1);
        setActionQueue(queue);
      }
    }

    try {
      const { data } = await client.get("/agent/deliveries/assigned", {
        params: { today: false },
      });
      storeAssignedAgentDeliveries(data?.deliveries || []);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        throw error;
      }
      if (!isNetworkError(error)) {
        console.error("Agent delivery refresh after sync failed:", error);
      }
    }

    return { synced: true, pending: 0 };
  })();

  try {
    return await syncPromise;
  } finally {
    syncPromise = null;
  }
};
