// src/utils/api.js

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? 'https://antonio-screenshare.onrender.com' : '');

/**
 * Returns the API base URL for REST calls (empty in dev, where Vite proxies /api).
 */
export function getApiBase() {
  return BACKEND_URL ? BACKEND_URL.replace(/\/$/, '') : '';
}

/**
 * Returns the signaling WebSocket URL.
 */
export function getWsUrl() {
  if (BACKEND_URL) {
    const wsProto = BACKEND_URL.startsWith('https') ? 'wss:' : 'ws:';
    const cleanHost = BACKEND_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `${wsProto}//${cleanHost}/ws`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}
