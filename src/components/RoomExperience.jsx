import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC, getAvatarColor, getInitials } from '../hooks/useWebRTC';
import { getApiBase, isDiscordActivity } from '../utils/discord';
import BackgroundRipples from './BackgroundRipples';
import DisplayNameModal, { getStoredDisplayName } from './DisplayNameModal';
import ScreenSettingsModal from './ScreenSettingsModal';
import DiscordStreamModal from './DiscordStreamModal';
import SidebarChat from './SidebarChat';
import ControlBar from './ControlBar';
import VideoTile from './VideoTile';
import ReactionBar from './ReactionBar';
import ReactionOverlay from './ReactionOverlay';
import GeekStatsModal from './GeekStatsModal';

function RemoteAudio({ stream, volume = 1 }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch((err) => {
        console.warn('Audio play autoplay policy warning:', err);
      });
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, typeof volume === 'number' ? volume : 1));
    }
  }, [volume]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}

export default function RoomExperience({ code, onLeave }) {
  const [authStatus, setAuthStatus] = useState('checking'); // checking | connected | need-password | not-found | error
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [displayName, setDisplayName] = useState(() => getStoredDisplayName() || 'Anônimo');
  const [showNameModal, setShowNameModal] = useState(false);
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [pinnedStreamId, setPinnedStreamId] = useState(null);
  const isDiscord = isDiscordActivity();

  // Keyboard shortcut: 'S' toggles Geek Stats HUD
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key.toLowerCase() === 's' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        setShowStatsModal((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mixer de volume individual por participante salvo localmente
  const [peerVolumes, setPeerVolumes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('antonio:peerVolumes') || '{}');
    } catch {
      return {};
    }
  });

  const handleSetPeerVolume = (peerId, vol) => {
    setPeerVolumes((prev) => {
      const updated = { ...prev, [peerId]: vol };
      try {
        localStorage.setItem('antonio:peerVolumes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // WebRTC Hook
  const {
    connectionStatus,
    participants,
    chatMessages,
    localScreenStream,
    localCameraStream,
    localMicStream,
    isMicMuted,
    isSpeaking,
    peerSpeakingMap,
    peerMicMutedMap,
    activeReactions,
    remoteStreams,
    networkStats,
    audioLevels,
    isScreenSharing,
    isCameraOn,
    toggleMicrophone,
    startScreenShare,
    stopScreenShare,
    toggleCamera,
    sendChatMessage,
    sendReaction,
    updateDisplayName
  } = useWebRTC({
    roomCode: authStatus === 'connected' ? code : null,
    displayName
  });

  // Verify room access on mount
  useEffect(() => {
    async function verify() {
      try {
        const storedName = getStoredDisplayName();
        const apiBase = getApiBase();
        const autoCreate = isDiscord || code.startsWith('DC');
        const res = await fetch(`${apiBase}/api/rooms/${code}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: storedName || 'Anônimo', autoCreate })
        });

        if (res.status === 401) {
          setAuthStatus('need-password');
        } else if (res.status === 404) {
          setAuthStatus('not-found');
        } else if (res.ok) {
          setAuthStatus('connected');
          if (!storedName) {
            setShowNameModal(true);
          }
          if (!isDiscord && new URLSearchParams(window.location.search).get('stream') === '1') {
            setShowScreenModal(true);
          }
        } else {
          setAuthStatus('error');
        }
      } catch (err) {
        setAuthStatus('error');
      }
    }
    verify();
  }, [code, isDiscord]);

  // Submit Password Form
  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setIsVerifying(true);
    setPasswordError(false);

    try {
      const storedName = getStoredDisplayName();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: storedName || 'Anônimo', password: passwordInput })
      });

      if (res.status === 401) {
        setPasswordError(true);
        setIsVerifying(false);
      } else if (res.status === 404) {
        setAuthStatus('not-found');
      } else if (res.ok) {
        setAuthStatus('connected');
        if (!storedName) {
          setShowNameModal(true);
        }
      } else {
        setAuthStatus('error');
      }
    } catch {
      setAuthStatus('error');
    }
  }

  // Copy Invite Link
  async function copyInviteLink() {
    const origin = isDiscord ? 'https://screen-flax.vercel.app' : window.location.origin;
    const inviteUrl = `${origin}/room/${code}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      window.prompt('Copie o link da sala:', inviteUrl);
    }
  }

  // Find local socket ID
  const localParticipant = participants.find((p) => p.isLocal);
  const localSocketId = localParticipant?.socketId;

  // Build combined speaking and muted maps (including local participant)
  const combinedSpeakingMap = {
    ...peerSpeakingMap,
    ...(localSocketId ? { [localSocketId]: isSpeaking } : {})
  };

  const combinedMutedMap = {
    ...peerMicMutedMap,
    ...(localSocketId ? { [localSocketId]: isMicMuted } : {})
  };

  // Collect all active video streams
  const allStreams = [];
  if (localScreenStream) {
    allStreams.push({
      id: 'local-screen',
      stream: localScreenStream,
      name: displayName,
      source: 'screen',
      isLocal: true,
      isSpeaking,
      isMicMuted
    });
  }
  if (localCameraStream) {
    allStreams.push({
      id: 'local-camera',
      stream: localCameraStream,
      name: displayName,
      source: 'camera',
      isLocal: true,
      isSpeaking,
      isMicMuted
    });
  }

  Object.entries(remoteStreams).forEach(([peerId, data]) => {
    const peerParticipant = participants.find((p) => p.socketId === peerId);
    const pName = peerParticipant?.name || data.name || 'Participante';
    const peerIsSpeaking = !!peerSpeakingMap[peerId];
    const peerIsMuted = !!peerMicMutedMap[peerId];

    if (data.screenStream) {
      allStreams.push({
        id: `${peerId}-screen`,
        stream: data.screenStream,
        name: pName,
        participantId: peerId,
        source: 'screen',
        isLocal: false,
        isSpeaking: peerIsSpeaking,
        isMicMuted: peerIsMuted
      });
    }
    if (data.cameraStream) {
      allStreams.push({
        id: `${peerId}-camera`,
        stream: data.cameraStream,
        name: pName,
        participantId: peerId,
        source: 'camera',
        isLocal: false,
        isSpeaking: peerIsSpeaking,
        isMicMuted: peerIsMuted
      });
    }
  });

  const pinnedStream = allStreams.find((s) => s.id === pinnedStreamId);

  // --------------------------------------------------------------------------
  // Checking / Error / Password Required States
  // --------------------------------------------------------------------------
  if (authStatus !== 'connected') {
    return (
      <main style={{ position: 'relative', display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '1.5rem' }}>
        <BackgroundRipples />

        <div className="bezel-shell rise-in" style={{ width: '100%', maxWidth: '24rem', zIndex: 10 }}>
          <div className="bezel-core" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: '0.5rem', borderRadius: '9999px', border: '1px solid var(--hairline)', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '0.3rem 0.8rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.15em', color: 'var(--fog)' }}>
              <span className="live-dot" />
              {code}
            </span>

            {authStatus === 'checking' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h1 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--paper)' }}>
                  Acessando sala...
                </h1>
                <p style={{ fontSize: '0.875rem', color: 'var(--fog)' }}>
                  Estabelecendo conexão segura WebRTC com Antonio Screenshare.
                </p>
              </div>
            )}

            {authStatus === 'not-found' && (
              <>
                <div>
                  <h1 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--paper)' }}>
                    Sala não encontrada
                  </h1>
                  <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--fog)', lineHeight: 1.5 }}>
                    O código informado não existe ou foi encerrado pelos participantes.
                  </p>
                </div>
                <button type="button" onClick={onLeave} className="btn btn-ghost" style={{ marginTop: '0.5rem' }}>
                  Voltar para o início
                </button>
              </>
            )}

            {authStatus === 'error' && (
              <>
                <div>
                  <h1 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--paper)' }}>
                    Algo deu errado
                  </h1>
                  <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--fog)', lineHeight: 1.5 }}>
                    Não foi possível validar o acesso à sala. Tente novamente em instantes.
                  </p>
                </div>
                <button type="button" onClick={onLeave} className="btn btn-ghost" style={{ marginTop: '0.5rem' }}>
                  Voltar para o início
                </button>
              </>
            )}

            {authStatus === 'need-password' && (
              <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h1 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--paper)' }}>
                    Sala protegida por senha
                  </h1>
                  <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--fog)', lineHeight: 1.5 }}>
                    Esta sala requer autenticação. Digite a senha definida pelo anfitrião.
                  </p>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--fog)' }}>
                  Senha de acesso
                  <input
                    autoFocus
                    type="password"
                    className="field"
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
                </label>

                <button type="submit" disabled={isVerifying} className="btn-nested-cta">
                  <span>{isVerifying ? 'Verificando...' : 'Entrar na Sala'}</span>
                  <span className="btn-nested-circle">↵</span>
                </button>

                {passwordError && (
                  <p className="error-text" role="alert">Senha incorreta. Verifique com o anfitrião.</p>
                )}
              </form>
            )}
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // Active Room Screen
  // --------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100vw', flexDirection: 'column', backgroundColor: 'var(--abyss)', overflow: 'hidden' }}>
      {/* Invisible audio elements for playing remote participants' voices */}
      {Object.entries(remoteStreams).map(([peerId, data]) => {
        if (data.audioStream) {
          const vol = typeof peerVolumes[peerId] === 'number' ? peerVolumes[peerId] : 1;
          return <RemoteAudio key={`audio-${peerId}`} stream={data.audioStream} volume={vol} />;
        }
        return null;
      })}

      {/* Room Header */}
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid var(--hairline)',
          backgroundColor: 'rgba(10, 13, 20, 0.85)',
          backdropFilter: 'blur(16px)',
          zIndex: 20
        }}
      >
        {/* Brand identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
              border: '1px solid var(--hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: 'var(--paper)',
              letterSpacing: '-0.03em'
            }}
          >
            AS
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--paper)', letterSpacing: '-0.01em' }}>
            Antonio <span style={{ color: 'var(--fog)', fontWeight: 400 }}>Screenshare</span>
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '1.25rem', backgroundColor: 'var(--hairline)' }} />

        {/* Room Code Badge (Click to copy) */}
        <button
          type="button"
          onClick={copyInviteLink}
          title="Clique para copiar o link da sala"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--hairline)',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '0.25rem 0.65rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            color: 'var(--paper)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--hairline)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
          }}
        >
          <span className="live-dot" />
          <span>{code}</span>
        </button>

        {/* Change Name Button */}
        <button
          type="button"
          onClick={() => setShowNameModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderRadius: '9999px',
            padding: '0.25rem 0.75rem 0.25rem 0.35rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--hairline)',
            color: 'var(--paper)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
        >
          <span
            className="avatar"
            data-speaking={isSpeaking ? 'true' : 'false'}
            style={{ width: '1.4rem', height: '1.4rem', fontSize: '0.7rem', background: getAvatarColor(displayName) }}
          >
            {getInitials(displayName)}
          </span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{displayName}</span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--fog)' }}>✎</span>
        </button>

        {/* Connection Status & WebRTC Telemetry Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--fog)' }}>
            <span
              style={{
                width: '0.45rem',
                height: '0.45rem',
                borderRadius: '9999px',
                backgroundColor: connectionStatus === 'connected' ? 'var(--signal)' : 'var(--fog)',
                boxShadow: connectionStatus === 'connected' ? '0 0 8px var(--signal)' : 'none'
              }}
            />
            {connectionStatus === 'connected' ? 'ao vivo' : connectionStatus}
          </span>

          {connectionStatus === 'connected' && networkStats?.ping !== null && (
            <button
              type="button"
              onClick={() => setShowStatsModal(true)}
              title={`Latência: ${networkStats.ping}ms. Clique para abrir diagnóstico de rede (HUD / Tecla S)`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                padding: '0.2rem 0.55rem',
                borderRadius: '0.375rem',
                backgroundColor: showStatsModal ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: showStatsModal ? '1px solid var(--orchid)' : '1px solid var(--hairline)',
                color: networkStats.quality === 'good' ? 'var(--signal)' : networkStats.quality === 'fair' ? '#fbbf24' : 'var(--danger)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{networkStats.ping}ms</span>
              {networkStats.fps ? <span style={{ color: 'var(--fog)' }}>• {networkStats.fps} fps</span> : null}
              {networkStats.connectionType === 'relay' && (
                <span title="Conexão protegida via túnel TURN" style={{ color: '#38bdf8', fontSize: '0.65rem' }}>🛡️ TURN</span>
              )}
            </button>
          )}
          {isDiscord && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.2rem 0.55rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(88, 101, 242, 0.15)',
                border: '1px solid rgba(88, 101, 242, 0.35)',
                color: '#5865F2'
              }}
            >
              <span>🎮 Discord Activity</span>
            </span>
          )}
        </div>

        {/* Copy Invite Link Button */}
        <div style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={copyInviteLink}
            className="btn btn-ghost"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.8125rem',
              borderColor: copiedInvite ? 'var(--signal)' : isDiscord ? 'rgba(88, 101, 242, 0.4)' : 'var(--hairline)',
              color: copiedInvite ? 'var(--signal)' : isDiscord ? '#5865F2' : 'var(--paper)'
            }}
          >
            {copiedInvite ? 'Link copiado! ✓' : isDiscord ? 'Copiar link (Navegador)' : 'Copiar link'}
          </button>
        </div>
      </header>

      {/* Main Room Stage */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Video / Screen Share Area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
          {/* Real-time Floating Reactions Overlay */}
          <ReactionOverlay reactions={activeReactions} />

          <div style={{ flex: 1, padding: '1rem', minHeight: 0, overflowY: 'auto' }}>
            {/* Pinned Focus Mode */}
            {pinnedStream ? (
              <div className="focus-stage">
                <div className="focus-main">
                  <VideoTile
                    stream={pinnedStream.stream}
                    participantName={pinnedStream.name}
                    participantId={pinnedStream.participantId || pinnedStream.id}
                    source={pinnedStream.source}
                    isLocal={pinnedStream.isLocal}
                    isSpeaking={pinnedStream.isSpeaking}
                    isMicMuted={pinnedStream.isMicMuted}
                  />
                  <button
                    type="button"
                    onClick={() => setPinnedStreamId(null)}
                    className="btn btn-ghost"
                    style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 15, padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    Sair da tela cheia
                  </button>
                </div>

                {/* Carousel of other streams */}
                {allStreams.length > 1 && (
                  <div className="focus-carousel">
                    {allStreams
                      .filter((s) => s.id !== pinnedStreamId)
                      .map((s) => (
                        <VideoTile
                          key={s.id}
                          stream={s.stream}
                          participantName={s.name}
                          participantId={s.participantId || s.id}
                          source={s.source}
                          isLocal={s.isLocal}
                          isSpeaking={s.isSpeaking}
                          isMicMuted={s.isMicMuted}
                          onPin={() => setPinnedStreamId(s.id)}
                        />
                      ))}
                  </div>
                )}
              </div>
            ) : allStreams.length > 0 ? (
              /* Grid Layout */
              <div className="video-grid">
                {allStreams.map((s) => (
                  <VideoTile
                    key={s.id}
                    stream={s.stream}
                    participantName={s.name}
                    participantId={s.participantId || s.id}
                    source={s.source}
                    isLocal={s.isLocal}
                    isSpeaking={s.isSpeaking}
                    isMicMuted={s.isMicMuted}
                    onPin={() => setPinnedStreamId(s.id)}
                  />
                ))}
              </div>
            ) : (
              /* Empty Stage Placeholder - High-End Double Bezel Ambient Card */
              <div
                style={{
                  display: 'flex',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem'
                }}
              >
                <div className="bezel-shell" style={{ width: '100%', maxWidth: '32rem' }}>
                  <div
                    className="bezel-core"
                    style={{
                      padding: '3rem 2rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '1rem'
                    }}
                  >
                    {/* Ambient pulse visual */}
                    <div
                      style={{
                        width: '3.5rem',
                        height: '3.5rem',
                        borderRadius: '9999px',
                        background: 'radial-gradient(circle, rgba(0, 245, 160, 0.15) 0%, rgba(0, 245, 160, 0) 70%)',
                        border: '1px solid rgba(0, 245, 160, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <span className="live-dot" style={{ width: '0.75rem', height: '0.75rem' }} />
                    </div>

                    <div>
                      <h2 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--paper)', letterSpacing: '-0.02em' }}>
                        Pronto para transmitir
                      </h2>
                      <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--fog)', lineHeight: 1.5 }}>
                        Olá, <strong style={{ color: 'var(--paper)' }}>{displayName}</strong>! Compartilhe sua tela em até 1080p 60fps ou abra sua câmera com os botões abaixo.
                      </p>
                    </div>

                    {/* Quick action buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {isDiscord ? (
                        <button
                          type="button"
                          onClick={() => setShowDiscordModal(true)}
                          className="btn-nested-cta"
                          style={{ padding: '0.55rem 1.2rem', borderColor: 'rgba(88, 101, 242, 0.6)', background: 'rgba(88, 101, 242, 0.12)' }}
                        >
                          <span style={{ color: '#ffffff', fontWeight: 600 }}>🚀 Transmitir pelo PC (1 Clique)</span>
                          <span className="btn-nested-circle" style={{ backgroundColor: '#5865F2' }}>🖥️</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowScreenModal(true)}
                          className="btn-nested-cta"
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          <span>Compartilhar Tela</span>
                          <span className="btn-nested-circle">🖥️</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={toggleCamera}
                        className="btn btn-ghost"
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        {isCameraOn ? 'Desligar Câmera' : 'Abrir Câmera'}
                      </button>
                    </div>

                    {/* Audio Status pill */}
                    <div style={{ marginTop: '0.75rem' }}>
                      {isMicMuted ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--danger)' }}>
                          <span style={{ width: '0.4rem', height: '0.4rem', borderRadius: '9999px', backgroundColor: 'var(--danger)' }} />
                          Microfone mutado
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--signal)' }}>
                          <span style={{ width: '0.4rem', height: '0.4rem', borderRadius: '9999px', backgroundColor: 'var(--signal)' }} />
                          Voz ativa com cancelamento de ruído
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating Reaction Bar */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.4rem 0', zIndex: 25 }}>
            <ReactionBar onSendReaction={sendReaction} />
          </div>

          {/* Bottom Control Bar */}
          <ControlBar
            isScreenSharing={isScreenSharing}
            isCameraOn={isCameraOn}
            isMicMuted={isMicMuted}
            audioLevels={audioLevels}
            onToggleMicrophone={toggleMicrophone}
            onToggleScreenShare={() => {
              if (isScreenSharing) {
                stopScreenShare();
              } else {
                setShowScreenModal(true);
              }
            }}
            onToggleCamera={toggleCamera}
            onLeaveRoom={onLeave}
          />
        </div>

        {/* Sidebar: Participants & Chat */}
        <SidebarChat
          participants={participants}
          chatMessages={chatMessages}
          peerSpeakingMap={combinedSpeakingMap}
          peerMicMutedMap={combinedMutedMap}
          peerVolumes={peerVolumes}
          onSetPeerVolume={handleSetPeerVolume}
          onSendMessage={sendChatMessage}
        />
      </div>

      {/* Screen Sharing Resolution/FPS Settings Modal */}
      {showScreenModal && (
        <ScreenSettingsModal
          onConfirm={(settings) => {
            setShowScreenModal(false);
            startScreenShare(settings).catch((err) => {
              console.warn('Erro ao compartilhar tela:', err);
              if (isDiscord) {
                setShowDiscordModal(true);
              }
            });
          }}
          onCancel={() => setShowScreenModal(false)}
        />
      )}

      {/* Display Name Modal */}
      {showNameModal && (
        <DisplayNameModal
          onSave={(name) => {
            setDisplayName(name);
            updateDisplayName(name);
            setShowNameModal(false);
          }}
          onCancel={() => setShowNameModal(false)}
        />
      )}

      {/* Discord Stream Info Modal */}
      {showDiscordModal && (
        <DiscordStreamModal
          roomCode={code}
          onClose={() => setShowDiscordModal(false)}
        />
      )}

      {/* Geek Stats / Network Diagnostics HUD Modal */}
      <GeekStatsModal
        stats={networkStats}
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
      />
    </div>
  );
}
