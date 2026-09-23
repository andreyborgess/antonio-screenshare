import React, { useState, useEffect } from 'react';
import BackgroundRipples from './components/BackgroundRipples';
import CreateRoomForm from './components/CreateRoomForm';
import JoinRoomForm from './components/JoinRoomForm';
import RoomExperience from './components/RoomExperience';

function getRoomCodeFromPath() {
  const path = window.location.pathname;
  const match = path.match(/^\/room\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return match[1].toUpperCase();
  }
  // Also check hash #/room/CODE or #CODE for compatibility
  const hash = window.location.hash;
  const hashMatch = hash.match(/^#\/?(?:room\/)?([a-zA-Z0-9_-]+)/);
  if (hashMatch) {
    return hashMatch[1].toUpperCase();
  }
  return null;
}

import { isDiscordActivity, initDiscordSdk, getDiscordRoomCode } from './utils/discord';
import { pingBackend } from './utils/wakeUp';

export default function App() {
  // Dispara wake-up preventivo silencioso para o Render assim que a página abre
  useEffect(() => {
    pingBackend();
  }, []);
  const isDiscord = isDiscordActivity();
  const [currentRoomCode, setCurrentRoomCode] = useState(() => {
    // If inside Discord, check query params immediately
    if (isDiscordActivity()) {
      const params = new URLSearchParams(window.location.search);
      const qChannel = params.get('channel_id');
      if (qChannel) {
        return getDiscordRoomCode(qChannel);
      }
    }
    return getRoomCodeFromPath();
  });

  const [isDiscordInitializing, setIsDiscordInitializing] = useState(isDiscord && !currentRoomCode);

  // Initialize Discord Embedded App SDK when running inside Discord
  useEffect(() => {
    if (!isDiscord) return;

    let isMounted = true;
    async function setupDiscord() {
      try {
        const sdk = await initDiscordSdk();
        if (isMounted && sdk && sdk.channelId) {
          const roomCode = getDiscordRoomCode(sdk.channelId);
          setCurrentRoomCode(roomCode);
        }
      } catch (err) {
        console.warn('[Discord] Setup warning:', err);
      } finally {
        if (isMounted) {
          setIsDiscordInitializing(false);
        }
      }
    }

    setupDiscord();

    return () => {
      isMounted = false;
    };
  }, [isDiscord]);

  useEffect(() => {
    function handleLocationChange() {
      if (!isDiscord) {
        setCurrentRoomCode(getRoomCodeFromPath());
      }
    }

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [isDiscord]);

  function navigateToRoom(code) {
    const uppercaseCode = code.toUpperCase();
    window.history.pushState({}, '', `/room/${uppercaseCode}`);
    setCurrentRoomCode(uppercaseCode);
  }

  function handleLeaveRoom() {
    window.history.pushState({}, '', '/');
    setCurrentRoomCode(null);
  }

  // Discord Activity Loading Screen
  if (isDiscord && isDiscordInitializing) {
    return (
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          backgroundColor: '#0c0e14',
          color: '#ffffff',
          gap: '1.25rem',
          padding: '2rem'
        }}
      >
        <BackgroundRipples />
        <div
          style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '1.25rem',
            backgroundColor: 'rgba(88, 101, 242, 0.15)',
            border: '1px solid rgba(88, 101, 242, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#5865F2',
            boxShadow: '0 0 30px rgba(88, 101, 242, 0.2)'
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff' }}>
            Sincronizando com o Discord...
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--fog)', marginTop: '0.35rem' }}>
            Identificando canal de voz e conectando à sala
          </p>
        </div>
      </main>
    );
  }

  // Active Room Screen (Discord or Web)
  if (currentRoomCode) {
    return <RoomExperience code={currentRoomCode} onLeave={handleLeaveRoom} />;
  }

  // Home / Landing Page
  return (
    <main
      id="main-content"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '5rem 1.5rem 3rem',
        minHeight: '100dvh'
      }}
    >
      <BackgroundRipples />

      <div
        className="rise-in"
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          width: '100%',
          maxWidth: '64rem',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        {/* Eyebrow Pill Tag */}
        <span className="eyebrow-tag">
          <span className="live-dot" />
          sem conta · tela e voz em tempo real · sem rastro
        </span>

        {/* Hero Title */}
        <h1
          className="font-display"
          style={{
            marginTop: '2rem',
            fontSize: 'clamp(2.75rem, 6.5vw, 4.75rem)',
            fontWeight: 700,
            letterSpacing: '-0.035em',
            color: 'var(--paper)',
            lineHeight: 1.08
          }}
        >
          Antonio <span className="text-orchid">Screenshare</span>
        </h1>

        {/* Hero Subtitle */}
        <p
          className="text-pretty"
          style={{
            marginTop: '1.5rem',
            maxWidth: '38rem',
            fontSize: '1.125rem',
            color: 'var(--fog)',
            lineHeight: 1.65,
            fontWeight: 400
          }}
        >
          Crie uma sala privada, envie o código para quem precisa assistir e compartilhe sua tela em alta fidelidade.
          Zero login, zero downloads, sem rastros.
        </p>

        {/* Double-Bezel Form Grid */}
        <div
          style={{
            marginTop: '3.5rem',
            display: 'grid',
            width: '100%',
            maxWidth: '52rem',
            gap: '2rem',
            textAlign: 'left',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            alignItems: 'stretch'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <CreateRoomForm onRoomCreated={navigateToRoom} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <JoinRoomForm onJoinRoom={navigateToRoom} />
          </div>
        </div>

        {/* Minimalist Agency Footer: Privacy & P2P Architecture Guarantees */}
        <footer className="app-footer">
          <div className="footer-badges">
            <span className="footer-pill">
              <span className="dot" />
              P2P WebRTC Direto
            </span>
            <span className="footer-pill">
              <span className="dot" />
              Zero Armazenamento em Disco
            </span>
            <span className="footer-pill">
              <span className="dot" />
              Sem Rastreamento ou Cookies
            </span>
            <span className="footer-pill">
              <span className="dot" />
              Criptografia DTLS-SRTP
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--fog)', opacity: 0.75 }}>
            Antonio Screenshare · Desenvolvido com WebRTC nativo e áudio de alta fidelidade
          </p>
        </footer>
      </div>
    </main>
  );
}
