import { io } from 'socket.io-client';

let socket = null;

export function getSocketBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API;
  const raw = (envUrl || 'http://localhost:5000').trim().replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw.slice(0, -4) : raw;
}

export function getSocket() {
  if (!socket) {
    const serverUrl = getSocketBaseUrl();
    const token = localStorage.getItem('cz_token');

    socket = io(serverUrl, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}

export function connectSocket(token) {
  const s = getSocket();
  if (token) {
    s.auth = { token };
  }
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}
