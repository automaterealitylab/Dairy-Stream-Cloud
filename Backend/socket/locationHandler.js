const liveOrderLocationState = new Map();
const liveAgentLocationState = new Map();
const socketTrackedOrders = new Map();
const socketTrackedAgents = new Map();

const normalizeOrderId = (value) => {
  const orderId = String(value || "").trim();
  return orderId || null;
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const orderRoom = (orderId) => `order:${orderId}`;
const agentRoom = (agentId) => `agent:${agentId}`;

const normalizeAgentId = (value) => {
  const agentId = String(value || "").trim();
  return agentId || null;
};

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

const rememberSocketAgent = (socketId, agentId) => {
  const tracked = socketTrackedAgents.get(socketId) || new Set();
  tracked.add(agentId);
  socketTrackedAgents.set(socketId, tracked);
};

const forgetSocketAgent = (socketId, agentId) => {
  const tracked = socketTrackedAgents.get(socketId);
  if (!tracked) return;
  tracked.delete(agentId);
  if (tracked.size === 0) {
    socketTrackedAgents.delete(socketId);
  }
};

export const getOrderLiveLocation = (orderIdInput) => {
  const orderId = normalizeOrderId(orderIdInput);
  if (!orderId) return null;
  return liveOrderLocationState.get(orderId) || null;
};

export const registerLocationSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    socket.on("agent:joinRoom", ({ agentId: rawAgentId } = {}) => {
      const agentId = normalizeAgentId(rawAgentId);
      if (!agentId) return;
      socket.join(agentRoom(agentId));
      rememberSocketAgent(socket.id, agentId);
    });

    socket.on("agent:leaveRoom", ({ agentId: rawAgentId } = {}) => {
      const agentId = normalizeAgentId(rawAgentId);
      if (!agentId) return;
      socket.leave(agentRoom(agentId));
      forgetSocketAgent(socket.id, agentId);
    });

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
      ({ orderId: rawOrderId, agentId: rawAgentId, lat, lng, timestamp: rawTimestamp } = {}) => {
        const orderId = normalizeOrderId(rawOrderId);
        const agentId = normalizeAgentId(rawAgentId);
        const latitude = toFiniteNumber(lat);
        const longitude = toFiniteNumber(lng);
        if ((!orderId && !agentId) || latitude === null || longitude === null) return;

        const payload = {
          orderId,
          agentId,
          lat: latitude,
          lng: longitude,
          timestamp: Number(rawTimestamp) || Date.now(),
          isOnline: true,
        };

        if (orderId) {
          liveOrderLocationState.set(orderId, payload);
          io.to(orderRoom(orderId)).emit("agent:location", payload);
        }
        if (agentId) {
          liveAgentLocationState.set(agentId, payload);
          io.to(agentRoom(agentId)).emit("agent:location", payload);
        }
      }
    );

    socket.on("agent:stopped", ({ orderId: rawOrderId, agentId: rawAgentId, timestamp: rawTimestamp } = {}) => {
      const orderId = normalizeOrderId(rawOrderId);
      const agentId = normalizeAgentId(rawAgentId);
      if (!orderId && !agentId) return;

      const previous = liveOrderLocationState.get(orderId) || {};
      const payload = {
        ...previous,
        orderId,
        agentId,
        isOnline: false,
        timestamp: Number(rawTimestamp) || Date.now(),
      };

      if (orderId) {
        liveOrderLocationState.set(orderId, payload);
        io.to(orderRoom(orderId)).emit("agent:offline", payload);
        forgetSocketOrder(socket.id, orderId);
      }
      if (agentId) {
        liveAgentLocationState.set(agentId, payload);
        io.to(agentRoom(agentId)).emit("agent:offline", payload);
        forgetSocketAgent(socket.id, agentId);
      }
    });

    socket.on("customer:watchAgent", ({ agentId: rawAgentId } = {}) => {
      const agentId = normalizeAgentId(rawAgentId);
      if (!agentId) return;

      socket.join(agentRoom(agentId));
      const latest = liveAgentLocationState.get(agentId);
      if (!latest) return;

      if (latest.isOnline === false) {
        socket.emit("agent:offline", latest);
        return;
      }

      socket.emit("agent:location", latest);
    });

    socket.on("customer:unwatchAgent", ({ agentId: rawAgentId } = {}) => {
      const agentId = normalizeAgentId(rawAgentId);
      if (!agentId) return;
      socket.leave(agentRoom(agentId));
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

      const trackedAgents = socketTrackedAgents.get(socket.id);
      trackedAgents?.forEach((agentId) => {
        const previous = liveAgentLocationState.get(agentId) || {};
        const payload = {
          ...previous,
          agentId,
          isOnline: false,
          timestamp: Date.now(),
        };
        liveAgentLocationState.set(agentId, payload);
        io.to(agentRoom(agentId)).emit("agent:offline", payload);
      });

      socketTrackedOrders.delete(socket.id);
      socketTrackedAgents.delete(socket.id);
    });
  });
};
