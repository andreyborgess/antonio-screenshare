import React, { useState } from 'react';

export default function DiscordStreamModal({ roomCode, onClose }) {
  const [copied, setCopied] = useState(false);
  const streamUrl = `https://screen-flax.vercel.app/room/${roomCode}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(streamUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copie o link abaixo para abrir no navegador:', streamUrl);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(7, 8, 11, 0.85)',
        backdropFilter: 'blur(12px)',
        padding: '1.5rem'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bezel-shell"
        style={{
          width: '100%',
          maxWidth: '32rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(88, 101, 242, 0.15)'
        }}
      >
        <div
          className="bezel-core"
          style={{
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(88, 101, 242, 0.15)',
                border: '1px solid rgba(88, 101, 242, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5865F2'
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--paper)' }}>
                Transmitir para esta chamada
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--fog)' }}>
                Drible de bloqueio nativo do Discord
              </p>
            </div>
          </div>

          {/* Explanation */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--hairline)',
              fontSize: '0.85rem',
              lineHeight: 1.55,
              color: 'var(--paper)'
            }}
          >
            <p style={{ margin: 0 }}>
              Por segurança, o Discord <strong>bloqueia a captura de tela direta de dentro de Atividades</strong>.
            </p>
            <p style={{ margin: '0.65rem 0 0 0', color: 'var(--fog)' }}>
              Para transmitir sua tela em <strong style={{ color: 'var(--signal)' }}>1080p 60 FPS com áudio do Windows</strong>, basta abrir o link abaixo no seu <strong>Chrome ou Edge</strong> no PC.
            </p>
          </div>

          {/* URL Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: '#0c0e14',
              border: '1px solid var(--hairline)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              color: 'var(--paper)'
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {streamUrl}
            </span>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(88, 101, 242, 0.2)', color: '#5865F2' }}>
              {roomCode}
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-primary"
              style={{
                flex: 1,
                backgroundColor: copied ? 'var(--signal)' : '#5865F2',
                borderColor: copied ? 'var(--signal)' : '#5865F2',
                color: copied ? '#07080b' : '#ffffff'
              }}
            >
              {copied ? '✓ Link copiado! Abra no Chrome' : 'Copiar Link de Transmissão'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '0 1.25rem' }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
