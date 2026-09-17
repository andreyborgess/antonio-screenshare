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

export default function App() {
  const [currentRoomCode, setCurrentRoomCode] = useState(getRoomCodeFromPath);

  useEffect(() => {
    function handleLocationChange() {
      setCurrentRoomCode(getRoomCodeFromPath());
    }

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  function navigateToRoom(code) {
    const uppercaseCode = code.toUpperCase();
    window.history.pushState({}, '', `/room/${uppercaseCode}`);
    setCurrentRoomCode(uppercaseCode);
  }

  function handleLeaveRoom() {
    window.history.pushState({}, '', '/');
    setCurrentRoomCode(null);
  }

  // Active Room Screen
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
