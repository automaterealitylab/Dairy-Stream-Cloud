import { io } from "socket.io-client";
import { BASE_URL } from "./api/client";

const socket = io(BASE_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
  withCredentials: false,
});

export const ensureSocketConnection = () => {
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
};

export default socket;

