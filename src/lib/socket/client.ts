"use client";

import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

/**
 * Get or create the Socket.io client singleton
 */
export function getSocket(): TypedSocket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["websocket", "polling"],
    }) as TypedSocket;
  }
  return socket;
}

/**
 * Connect the socket (call from useEffect)
 */
export function connectSocket(): TypedSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/**
 * Disconnect the socket (call from cleanup)
 */
export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
