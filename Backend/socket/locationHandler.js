const liveOrderLocationState = new Map();
const socketTrackedOrders = new Map();

const normalizeOrderId = (value) => {
  const orderId = String(value || "").trim();
  return orderId || null;
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const orderRoom = (orderId) => `order:${orderId}`;

const rememberSocketOrder = (socketId, orderId) => {
  const tracked = socketTrackedOrders.get(socketId) || new Set();
  tracked.add(orderId);
  socketTrackedOrders.set(socketId, tracked);
};

const forgetSocketOrder = (socketId, orderId) => {
  const tracked = socketTrackedOrders.get(socketId);
  if (!tracked) return;
  tracked.delete(orderId);
  if (tracked.size === 0) {
    socketTrackedOrders.delete(socketId);
  }
};

export const getOrderLiveLocation = (orderIdInput) => {
  const orderId = normalizeOrderId(orderIdInput);
  if (!orderId) return null;
  return liveOrderLocationState.get(orderId) || null;
};

export const registerLocationSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    socket.on("agent:joinOrder", ({ orderId: rawOrderId } = {}) => {
      const orderId = normalizeOrderId(rawOrderId);
      if (!orderId) return;
      socket.join(orderRoom(orderId));
      rememberSocketOrder(socket.id, orderId);
    });

    socket.on("agent:leaveOrder", ({ orderId: rawOrderId } = {}) => {
      const orderId = normalizeOrderId(rawOrderId);
      if (!orderId) return;
      socket.leave(orderRoom(orderId));
      forgetSocketOrder(socket.id, orderId);
    });

    socket.on(
      "agent:locationUpdate",
      ({ orderId: rawOrderId, lat, lng, timestamp: rawTimestamp } = {}) => {
        const orderId = normalizeOrderId(rawOrderId);
        const latitude = toFiniteNumber(lat);
        const longitude = toFiniteNumber(lng);
        if (!orderId || latitude === null || longitude === null) return;

        const payload = {
          orderId,
          lat: latitude,
          lng: longitude,
          timestamp: Number(rawTimestamp) || Date.now(),
          isOnline: true,
        };

        liveOrderLocationState.set(orderId, payload);
        io.to(orderRoom(orderId)).emit("agent:location", payload);
      }
    );

    socket.on("agent:stopped", ({ orderId: rawOrderId, timestamp: rawTimestamp } = {}) => {
      const orderId = normalizeOrderId(rawOrderId);
      if (!orderId) return;

      const previous = liveOrderLocationState.get(orderId) || {};
      const payload = {
        ...previous,
        orderId,
        isOnline: false,
        timestamp: Number(rawTimestamp) || Date.now(),
      };

      liveOrderLocationState.set(orderId, payload);
      io.to(orderRoom(orderId)).emit("agent:offline", payload);
      forgetSocketOrder(socket.id, orderId);
    });

    socket.on("customer:trackOrder", ({ orderId: rawOrderId } = {}) => {
      const orderId = normalizeOrderId(rawOrderId);
      if (!orderId) return;
      socket.join(orderRoom(orderId));

      const latest = liveOrderLocationState.get(orderId);
      if (!latest) return;

      if (latest.isOnline === false) {
        socket.emit("agent:offline", latest);
        return;
      }

      socket.emit("agent:location", latest);
    });

    socket.on("customer:untrackOrder", ({ orderId: rawOrderId } = {}) => {
      const orderId = normalizeOrderId(rawOrderId);
      if (!orderId) return;
      socket.leave(orderRoom(orderId));
    });

    socket.on("disconnect", () => {
      const trackedOrders = socketTrackedOrders.get(socket.id);
      if (!trackedOrders?.size) return;

      trackedOrders.forEach((orderId) => {
        const previous = liveOrderLocationState.get(orderId) || {};
        const payload = {
          ...previous,
          orderId,
          isOnline: false,
          timestamp: Date.now(),
        };
        liveOrderLocationState.set(orderId, payload);
        io.to(orderRoom(orderId)).emit("agent:offline", payload);
      });

      socketTrackedOrders.delete(socket.id);
    });
  });
};

