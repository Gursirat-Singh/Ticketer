import { io } from 'socket.io-client';

let socket;

/** One shared connection. With no URL, socket.io connects to the page's own origin (proxied by Vite in dev). */
export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || undefined, { withCredentials: true });
  }
  return socket;
}
