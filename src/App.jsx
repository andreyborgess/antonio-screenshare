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

import { pingBackend } from './utils/wakeUp';
import { useAuth } from './context/AuthContext';
import LoginScreen from './components/LoginScreen';
import UserHeader from './components/UserHeader';

export default function App() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Dispara wake-up preventivo silencioso para o Render assim que a página abre
  useEffect(() => {
    pingBackend();
  }, []);
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

  // Require Discord login and Guild membership
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Active Room Screen
  if (currentRoomCode) {
    return (
      <>
        <UserHeader />
        <RoomExperience code={currentRoomCode} onLeave={handleLeaveRoom} />
      </>
    );
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
      <UserHeader />
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
        <span className="eyebrow-tag" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', color: '#FCD34D' }}>
          <span className="live-dot" style={{ backgroundColor: '#F59E0B', boxShadow: '0 0 10px #F59E0B' }} />
          👑 Servidor Oficial · Suprema Brasil · P2P 60 FPS
        </span>

        {/* Hero Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.75rem' }}>
          <img
            src="/logo.png"
            alt="Suprema Brasil"
            style={{
              width: '3.75rem',
              height: '3.75rem',
              borderRadius: '50%',
              padding: '2px',
              background: 'linear-gradient(135deg, #FFE082 0%, #F59E0B 50%, #D97706 100%)',
              boxShadow: '0 0 24px rgba(245, 158, 11, 0.4)'
            }}
          />
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 4.25rem)',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              color: 'var(--paper)',
              lineHeight: 1.08
            }}
          >
            Suprema <span className="text-gold-gradient">Screenshare</span>
          </h1>
        </div>

        {/* Hero Subtitle */}
        <p
          className="text-pretty"
          style={{
            marginTop: '1.25rem',
            maxWidth: '38rem',
            fontSize: '1.125rem',
            color: 'var(--fog)',
            lineHeight: 1.65,
            fontWeight: 400
          }}
        >
          Transmissão de tela ultrarrápida a 60 FPS com áudio estéreo imersivo em salas privadas.
          Exclusivo para membros autorizados da Suprema Brasil.
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
          <p style={{ fontSize: '0.8125rem', color: 'var(--fog)', opacity: 0.85 }}>
            Suprema Screenshare · Exclusivo Suprema Brasil · Alta fidelidade P2P 60 FPS
          </p>
        </footer>
      </div>
    </main>
  );
}
