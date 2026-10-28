// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getApiBase } from '../utils/api';

const AuthContext = createContext(null);

export const ALLOWED_GUILD_ID = '1415573356698140674';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('antonio_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('antonio_token') || null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const processedCodeRef = useRef(null);

  // Initialize and handle Discord OAuth callback or token validation
  useEffect(() => {
    let isMounted = true;

    async function handleAuthFlow() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const isCallbackPath = window.location.pathname.startsWith('/auth/callback');

      // 1. Handling Discord OAuth Callback
      if (code && isCallbackPath) {
        if (processedCodeRef.current === code) return;
        processedCodeRef.current = code;

        setLoading(true);
        setAuthError(null);
        try {
          const redirectUri = getRedirectUri();
          const apiBase = getApiBase();
          const res = await fetch(`${apiBase}/api/auth/discord`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirectUri })
          });

          const data = await res.json();

          if (!res.ok) {
            if (data.error === 'not_in_guild') {
              if (isMounted) {
                setAuthError({
                  type: 'not_in_guild',
                  message: data.message || 'Você não é membro do servidor autorizado.',
                  user: data.user,
                  guildId: data.guildId || ALLOWED_GUILD_ID
                });
                setUser(null);
                setToken(null);
                localStorage.removeItem('antonio_token');
                localStorage.removeItem('antonio_user');
              }
            } else {
              throw new Error(data.error || 'Falha ao autenticar.');
            }
          } else {
            if (isMounted) {
              setToken(data.token);
              setUser(data.user);
              localStorage.setItem('antonio_token', data.token);
              localStorage.setItem('antonio_user', JSON.stringify(data.user));
              setAuthError(null);
            }
          }
        } catch (err) {
          console.error('[Auth Error]', err);
          if (isMounted) {
            setAuthError({
              type: 'error',
              message: err.message || 'Erro inesperado na autenticação.'
            });
          }
        } finally {
          // Clean the URL without reloading
          window.history.replaceState({}, '', '/');
          if (isMounted) setLoading(false);
        }
        return;
      }

      // 2. Validate existing token with /api/auth/me
      const storedToken = localStorage.getItem('antonio_token');
      if (storedToken) {
        try {
          const apiBase = getApiBase();
          const res = await fetch(`${apiBase}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`
            }
          });

          if (res.ok) {
            const data = await res.json();
            if (isMounted) {
              setUser(data.user);
              setToken(storedToken);
              localStorage.setItem('antonio_user', JSON.stringify(data.user));
            }
          } else {
            // Token expired or invalid
            if (isMounted) {
              setUser(null);
              setToken(null);
              localStorage.removeItem('antonio_token');
              localStorage.removeItem('antonio_user');
            }
          }
        } catch (err) {
          console.warn('[Auth Me Check Error]', err);
        }
      }

      if (isMounted) setLoading(false);
    }

    handleAuthFlow();

    return () => {
      isMounted = false;
    };
  }, []);

  function getRedirectUri() {
    let origin = window.location.origin;
    if (origin.includes('127.0.0.1')) {
      origin = origin.replace('127.0.0.1', 'localhost');
    }
    return `${origin}/auth/callback`;
  }

  function login() {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '1494510437763514408';
    const redirectUri = getRedirectUri();
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=identify%20guilds`;

    window.location.href = discordAuthUrl;
  }

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '1494510437763514408';
  const redirectUri = getRedirectUri();
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=identify%20guilds`;

  function logout() {
    setUser(null);
    setToken(null);
    setAuthError(null);
    localStorage.removeItem('antonio_token');
    localStorage.removeItem('antonio_user');
    window.location.href = '/';
  }

  function clearError() {
    setAuthError(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authError,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        clearError,
        discordAuthUrl,
        clientId,
        redirectUri
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
