import React from 'react';

export default function ControlBar({
  isScreenSharing,
  isCameraOn,
  isMicMuted,
  onToggleScreenShare,
  onToggleCamera,
  onToggleMicrophone,
  onLeaveRoom
}) {
  return (
    <nav
      aria-label="Controles da Chamada"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderTop: '1px solid var(--hairline)',
        backgroundColor: 'var(--panel)',
        backdropFilter: 'blur(16px)',
        zIndex: 20
      }}
    >
      {/* Microphone Toggle Button */}
      <button
        type="button"
        onClick={onToggleMicrophone}
        className="control-btn"
        aria-label={isMicMuted ? 'Desmutar microfone' : 'Mutar microfone'}
        title={isMicMuted ? 'Desmutar microfone' : 'Mutar microfone'}
        data-active={!isMicMuted ? 'true' : 'false'}
        style={{
          color: isMicMuted ? 'var(--danger)' : undefined,
          borderColor: isMicMuted ? 'rgba(255, 82, 102, 0.4)' : undefined
        }}
      >
        {isMicMuted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
        <span>{isMicMuted ? 'Desmutar' : 'Mutar microfone'}</span>
      </button>

      {/* Screen Share Button */}
      <button
        type="button"
        onClick={onToggleScreenShare}
        className="control-btn"
        aria-label={isScreenSharing ? 'Parar transmissão de tela' : 'Compartilhar tela'}
        title={isScreenSharing ? 'Parar transmissão de tela' : 'Compartilhar tela'}
        data-active={isScreenSharing ? 'true' : 'false'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span>{isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}</span>
      </button>

      {/* Camera Toggle Button */}
      <button
        type="button"
        onClick={onToggleCamera}
        className="control-btn"
        aria-label={isCameraOn ? 'Fechar câmera' : 'Abrir câmera'}
        title={isCameraOn ? 'Fechar câmera' : 'Abrir câmera'}
        data-active={isCameraOn ? 'true' : 'false'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        <span>{isCameraOn ? 'Fechar câmera' : 'Abrir câmera'}</span>
      </button>

      {/* Leave Room Button */}
      <button
        type="button"
        onClick={onLeaveRoom}
        className="control-btn control-btn-danger"
        aria-label="Sair da sala"
        title="Sair da sala"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>Sair</span>
      </button>
    </nav>
  );
}
