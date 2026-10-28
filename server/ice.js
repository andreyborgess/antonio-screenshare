// server/ice.js
// Monta a lista de servidores STUN/TURN entregue ao navegador.
// Sem TURN, conexões entre redes com CGNAT (4G/5G e muitas operadoras de fibra) não fecham P2P.
//
// Configure UMA das opções via variáveis de ambiente:
//   Cloudflare Realtime TURN: CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
//   Metered.ca:               METERED_DOMAIN (ex: meuapp.metered.live) + METERED_API_KEY
//   TURN próprio (coturn):    TURN_URLS (separadas por vírgula) + TURN_USERNAME + TURN_CREDENTIAL

const STUN_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

let cache = { servers: null, expiresAt: 0 };

async function fetchCloudflareTurn() {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !apiToken) return null;

  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ttl: 86400 })
  });
  if (!res.ok) throw new Error(`Cloudflare TURN respondeu ${res.status}`);

  const data = await res.json();
  const list = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
  // Navegadores bloqueiam a porta 53, a própria Cloudflare recomenda remover essas URLs
  return list
    .map((server) => ({
      ...server,
      urls: [].concat(server.urls).filter((url) => !/:53(\?|$)/.test(url))
    }))
    .filter((server) => server.urls.length > 0);
}

async function fetchMeteredTurn() {
  const domain = process.env.METERED_DOMAIN;
  const apiKey = process.env.METERED_API_KEY;
  if (!domain || !apiKey) return null;

  const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new Error(`Metered TURN respondeu ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : null;
}

function staticTurn() {
  const urls = (process.env.TURN_URLS || '').split(',').map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) return null;
  return [{ urls, username: process.env.TURN_USERNAME || '', credential: process.env.TURN_CREDENTIAL || '' }];
}

export function isTurnConfigured() {
  return !!(
    (process.env.CLOUDFLARE_TURN_KEY_ID && process.env.CLOUDFLARE_TURN_API_TOKEN) ||
    (process.env.METERED_DOMAIN && process.env.METERED_API_KEY) ||
    process.env.TURN_URLS
  );
}

export async function getIceServers({ includeTurn = true } = {}) {
  if (!includeTurn) return STUN_SERVERS;
  if (cache.servers && Date.now() < cache.expiresAt) return cache.servers;

  let turn = null;
  try {
    turn = (await fetchCloudflareTurn()) || (await fetchMeteredTurn()) || staticTurn();
  } catch (err) {
    console.error('[ICE] Falha ao obter credenciais TURN:', err.message);
    turn = staticTurn();
  }

  if (!turn) {
    return STUN_SERVERS;
  }

  const servers = [...STUN_SERVERS, ...turn];
  // Credenciais da Cloudflare valem 24h; renovamos bem antes disso
  cache = { servers, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return servers;
}
