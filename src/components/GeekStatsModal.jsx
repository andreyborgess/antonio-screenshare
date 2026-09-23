import React, { useEffect } from 'react';

export default function GeekStatsModal({ stats = {}, isOpen, onClose }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' || (e.key.toLowerCase() === 's' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName))) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const {
    ping,
    fps,
    bitrateKbps,
    packetLossPct = 0,
    resolution,
    codec,
    connectionType = 'direct',
    jitter,
    quality = 'good'
  } = stats;

  const formatBitrate = (kbps) => {
    if (!kbps || kbps <= 0) return 'Calculando...';
    if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`;
    return `${kbps} kbps`;
  };

  const getPingColor = () => {
    if (ping === null) return 'var(--fog)';
    if (ping <= 50) return 'var(--signal)';
    if (ping <= 100) return '#fbbf24';
    return 'var(--danger)';
  };

  const getLossColor = () => {
    if (packetLossPct <= 0.5) return 'var(--signal)';
    if (packetLossPct <= 2.5) return '#fbbf24';
    return 'var(--danger)';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="geek-stats-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(7, 8, 11, 0.75)',
        backdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={onClose}
    >
      <div
        className="bezel-shell"
        style={{
          width: '100%',
          maxWidth: '36rem',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(167, 139, 250, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bezel-core"
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)', paddingBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span
                style={{
                  width: '0.6rem',
                  height: '0.6rem',
                  borderRadius: '9999px',
                  backgroundColor: getPingColor(),
                  boxShadow: `0 0 10px ${getPingColor()}`
                }}
              />
              <div>
                <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--orchid)', fontWeight: 700 }}>
                  Telemetria WebRTC
                </span>
                <h3 id="geek-stats-title" className="font-display" style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--paper)', margin: 0 }}>
                  Diagnóstico de Rede em Tempo Real
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="control-btn"
              style={{
                width: '2rem',
                height: '2rem',
                padding: 0,
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--hairline)'
              }}
              title="Fechar (Esc ou tecla S)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Grid of Telemetry Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem'
            }}
          >
            {/* Ping / RTT */}
            <div className="stat-card" style={{ padding: '0.875rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--fog)', display: 'block', marginBottom: '0.25rem' }}>
                Latência (RTT / Ping)
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span className="font-mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: getPingColor() }}>
                  {ping !== null ? ping : '--'}
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--fog)' }}>ms</span>
              </div>
              <span style={{ fontSize: '0.6875rem', color: getPingColor(), marginTop: '0.2rem', display: 'block' }}>
                {ping !== null ? (ping <= 50 ? '● Conexão excelente' : ping <= 100 ? '▲ Aceitável' : '▼ Latência alta') : 'Aguardando fluxo...'}
              </span>
            </div>

            {/* FPS */}
            <div className="stat-card" style={{ padding: '0.875rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--fog)', display: 'block', marginBottom: '0.25rem' }}>
                Taxa de Quadros
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span className="font-mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: fps && fps >= 55 ? 'var(--signal)' : 'var(--paper)' }}>
                  {fps !== null ? fps : '--'}
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--fog)' }}>FPS</span>
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--fog)', marginTop: '0.2rem', display: 'block' }}>
                {fps ? `${fps} quadros por segundo` : 'Sem vídeo ativo'}
              </span>
            </div>

            {/* Bitrate */}
            <div className="stat-card" style={{ padding: '0.875rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--fog)', display: 'block', marginBottom: '0.25rem' }}>
                Taxa de Transferência
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span className="font-mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--paper)' }}>
                  {formatBitrate(bitrateKbps)}
                </span>
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--fog)', marginTop: '0.2rem', display: 'block' }}>
                Largura de banda de vídeo + áudio
              </span>
            </div>

            {/* Packet Loss */}
            <div className="stat-card" style={{ padding: '0.875rem', borderRadius: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--fog)', display: 'block', marginBottom: '0.25rem' }}>
                Perda de Pacotes
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span className="font-mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: getLossColor() }}>
                  {packetLossPct}%
                </span>
              </div>
              <span style={{ fontSize: '0.6875rem', color: getLossColor(), marginTop: '0.2rem', display: 'block' }}>
                {packetLossPct === 0 ? '✓ Zero perda de dados' : packetLossPct <= 2 ? '▲ Oscilação leve' : '▼ Pacotes sendo descartados'}
              </span>
            </div>
          </div>

          {/* Technical Specs Banner */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(167, 139, 250, 0.04)',
              border: '1px solid rgba(167, 139, 250, 0.15)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--fog)' }}>Roteamento ICE / NAT:</span>
              <span style={{ fontWeight: 600, color: connectionType === 'relay' ? '#38bdf8' : 'var(--signal)' }}>
                {connectionType === 'relay' ? '🛡️ Túnel TURN Relay (Firewall Traversal)' : '⚡ P2P Direto (Host / STUN)'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--fog)' }}>Resolução do Vídeo:</span>
              <span className="font-mono" style={{ color: 'var(--paper)' }}>
                {resolution || 'Detectando fluxo...'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--fog)' }}>Codec Ativo:</span>
              <span className="font-mono" style={{ color: 'var(--orchid)', fontWeight: 600 }}>
                {codec ? `${codec} (Hardware Accel)` : 'WebRTC Padrão (VP8/H264)'}
              </span>
            </div>

            {jitter !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--fog)' }}>Variação de Atraso (Jitter):</span>
                <span className="font-mono" style={{ color: 'var(--paper)' }}>
                  {jitter} ms
                </span>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--fog)', opacity: 0.8 }}>
            <span>Pressione <kbd style={{ padding: '0.1rem 0.35rem', borderRadius: '0.25rem', backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--paper)' }}>S</kbd> ou <kbd style={{ padding: '0.1rem 0.35rem', borderRadius: '0.25rem', backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--paper)' }}>Esc</kbd> para fechar</span>
            <span>Atualizado a cada 2s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
