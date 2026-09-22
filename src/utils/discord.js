// src/utils/discord.js
import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';

let discordSdkInstance = null;
let isInitialized = false;

/**
 * Checks if the current page is being loaded inside a Discord Activity iframe.
 */
export function isDiscordActivity() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.has('frame_id') ||
    params.has('instance_id') ||
    window.location.hostname.includes('discordsays.com')
  );
}

// Automatically apply Discord URL mapping patches when running inside Discord
if (typeof window !== 'undefined' && isDiscordActivity()) {
  try {
    patchUrlMappings([
      { prefix: '/api', target: 'antonio-screenshare.onrender.com' },
      { prefix: '/ws', target: 'antonio-screenshare.onrender.com' }
    ]);
  } catch (err) {
    console.warn('[DiscordSDK] patchUrlMappings warning:', err);
  }
}

/**
 * Returns the appropriate API base URL for REST calls.
 * Inside Discord, Discord requires the `/.proxy` prefix to route requests through its proxy mappings.
 */
export function getApiBase() {
  if (isDiscordActivity()) {
    return '/.proxy';
  }
  const backend = import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? 'https://antonio-screenshare.onrender.com' : '');
  return backend ? backend.replace(/\/$/, '') : '';
}

/**
 * Returns the WebSocket URL.
 * Inside Discord, requests must be routed via `/.proxy/ws`.
 */
export function getWsUrl() {
  if (isDiscordActivity()) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/.proxy/ws`;
  }

  const backend = import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? 'https://antonio-screenshare.onrender.com' : '');
  if (backend) {
    const wsProto = backend.startsWith('https') ? 'wss:' : 'ws:';
    const cleanHost = backend.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `${wsProto}//${cleanHost}/ws`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

/**
 * Converts a Discord voice channel ID into a user-friendly room code.
 * E.g., channelId "1474274159105409257" -> "DC409257"
 */
export function getDiscordRoomCode(channelId) {
  if (!channelId) return 'DISCORD';
  const digits = String(channelId).replace(/\D/g, '');
  const suffix = digits.slice(-6);
  return `DC${suffix}`.toUpperCase();
}

/**
 * Initializes the Discord Embedded App SDK if running inside Discord.
 */
export async function initDiscordSdk() {
  if (!isDiscordActivity()) return null;
  if (discordSdkInstance && isInitialized) return discordSdkInstance;

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '1474274159105409257';

  try {
    discordSdkInstance = new DiscordSDK(clientId);
    await discordSdkInstance.ready();
    isInitialized = true;
    console.log('[DiscordSDK] Ready! Voice Channel ID:', discordSdkInstance.channelId);
    return discordSdkInstance;
  } catch (err) {
    console.warn('[DiscordSDK] Failed to initialize SDK (may be preview or non-RPC mode):', err);
    return null;
  }
}

export function getDiscordSdk() {
  return discordSdkInstance;
}
