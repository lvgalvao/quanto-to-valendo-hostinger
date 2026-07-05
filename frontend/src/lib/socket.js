import { io } from 'socket.io-client';
import { getToken } from './auth.js';

const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket = null;

export function conectarSocket() {
  if (socket) return socket;
  socket = io(url, {
    auth: { token: getToken() },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function getSocket() {
  return socket || conectarSocket();
}
