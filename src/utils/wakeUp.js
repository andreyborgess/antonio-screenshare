// src/utils/wakeUp.js
import { useState, useEffect } from 'react';
import { getApiBase } from './discord';

let globalStatus = 'checking'; // 'checking' | 'waking' | 'awake' | 'error'
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn(globalStatus);
    } catch {}
  });
}

let pingPromise = null;

/**
 * Dispatches a silent background ping to the backend to wake up sleeping instances (e.g. on Render free tier).
 */
export function pingBackend() {
  if (pingPromise && globalStatus === 'awake') return pingPromise;

  const apiBase = getApiBase();
  const url = `${apiBase}/api/health`;

  // Start a timer: if request takes more than 1.8 seconds, it's likely cold-starting from sleep
  const wakingTimer = setTimeout(() => {
    if (globalStatus === 'checking') {
      globalStatus = 'waking';
      notifyListeners();
    }
  }, 1800);

  pingPromise = fetch(url, { method: 'GET', cache: 'no-store' })
    .then((res) => {
      clearTimeout(wakingTimer);
      globalStatus = 'awake';
      notifyListeners();
      return true;
    })
    .catch(() => {
      clearTimeout(wakingTimer);
      // Fallback in case /health is still routing
      return fetch(`${apiBase}/api/rooms/TEST`, { method: 'GET', cache: 'no-store' })
        .then(() => {
          globalStatus = 'awake';
          notifyListeners();
          return true;
        })
        .catch(() => {
          globalStatus = 'error';
          notifyListeners();
          return false;
        });
    });

  return pingPromise;
}

/**
 * React hook to observe the backend readiness / wake-up state.
 */
export function useBackendStatus() {
  const [status, setStatus] = useState(globalStatus);

  useEffect(() => {
    setStatus(globalStatus);
    listeners.add(setStatus);

    if (globalStatus === 'checking') {
      pingBackend();
    }

    return () => {
      listeners.delete(setStatus);
    };
  }, []);

  return status;
}
