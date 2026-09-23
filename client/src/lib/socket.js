import { io } from "socket.io-client";
import { API_BASE } from "./api.js";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_BASE, { transports: ["websocket", "polling"] });
  }
  return socket;
}
