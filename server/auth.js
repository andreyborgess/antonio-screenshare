// server/auth.js
import jwt from 'jsonwebtoken';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1494510437763514408';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const ALLOWED_GUILD_ID = process.env.ALLOWED_GUILD_ID || '1415573356698140674';
const JWT_SECRET = process.env.JWT_SECRET || 'antonio_screen_jwt_secret_super_secure_key_2026';

/**
 * Exchanges the OAuth2 authorization code for Discord access token
 */
export async function exchangeDiscordCode(code, redirectUri) {
  if (!DISCORD_CLIENT_SECRET) {
    throw new Error('DISCORD_CLIENT_SECRET não configurado no servidor.');
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[Discord OAuth Error]', data);
    throw new Error(data.error_description || data.message || 'Falha ao autenticar com o Discord.');
  }

  return data;
}

/**
 * Fetches user profile from Discord
 */
export async function fetchDiscordUser(accessToken) {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Falha ao obter perfil do usuário no Discord.');
  }

  const user = await response.json();
  
  // Build Discord CDN avatar URL
  let avatarUrl = '';
  if (user.avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  } else {
    // Default avatar based on user ID or discriminator
    const defaultIdx = Number((BigInt(user.id) >> 22n) % 6n);
    avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIdx}.png`;
  }

  return {
    id: user.id,
    username: user.username,
    globalName: user.global_name || user.username,
    avatar: user.avatar,
    avatarUrl
  };
}

/**
 * Checks if the user is a member of the allowed Discord Guild
 */
export async function checkGuildMembership(accessToken, targetGuildId = ALLOWED_GUILD_ID) {
  const response = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    console.error('[Discord Guilds Error]', await response.text());
    throw new Error('Falha ao verificar servidores do usuário no Discord.');
  }

  const guilds = await response.json();
  const isMember = Array.isArray(guilds) && guilds.some((g) => String(g.id) === String(targetGuildId));

  return {
    isMember,
    targetGuildId
  };
}

/**
 * Generates a signed session token
 */
export function createSessionToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      globalName: user.globalName,
      avatarUrl: user.avatarUrl,
      guildId: ALLOWED_GUILD_ID
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verifies a session token
 */
export function verifySessionToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}
