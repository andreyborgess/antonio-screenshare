import React, { useState } from 'react';

const RESOLUTIONS = [
  { id: '1080p', label: '1080p', width: 1920, height: 1080 },
  { id: '720p', label: '720p', width: 1280, height: 720 },
  { id: '480p', label: '480p', width: 854, height: 480 }
];

const FRAMERATES = [15, 30, 60];
const STORAGE_KEY = 'antonio:screenShareSettings';

const MODES = [
  {
    id: 'motion',
    label: 'Fluidez (Jogos/Vídeos)',
    description: 'Prioriza 60 FPS estáveis e baixa latência sem travar.',
    hint: 'motion',
    degradation: 'maintain-framerate'
  },
  {
    id: 'detail',
    label: 'Nitidez (Texto/Leitura)',
    description: 'Prioriza nitidez máxima de fontes e linhas finas.',
    hint: 'detail',
    degradation: 'maintain-resolution'
  }
];

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { resolution: '1080p', frameRate: 60, mode: 'motion', audio: true };
}

export default function ScreenSettingsModal({ onConfirm, onCancel }) {
  const initial = getStoredSettings();
  const [resolution, setResolution] = useState(initial.resolution || '1080p');
  const [frameRate, setFrameRate] = useState(initial.frameRate || 60);
  const [mode, setMode] = useState(initial.mode || 'motion');
  const [audio, setAudio] = useState(initial.audio !== false);
  const [showAudioGuide, setShowAudioGuide] = useState(false);

  function handleConfirm() {
    const selectedRes = RESOLUTIONS.find((r) => r.id === resolution) || RESOLUTIONS[0];
    const selectedMode = MODES.find((m) => m.id === mode) || MODES[0];

    const bitrateMap = {
      '1080p': 4000000,
      '720p': 2500000,
      '480p': 1200000
    };

    const settings = {
      resolution: selectedRes.id,
      width: selectedRes.width,
      height: selectedRes.height,
      frameRate,
      audio,
      mode: selectedMode.id,
      contentHint: selectedMode.hint,
      degradationPreference: selectedMode.degradation,
      maxBitrate: bitrateMap[selectedRes.id] || 3000000
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ resolution, frameRate, mode, audio }));
    } catch {}

    onConfirm(settings);
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
    >
      <div className="bezel-shell rise-in" style={{ width: '100%', maxWidth: '25rem' }}>
        <div
          className="bezel-core"
          style={{
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}
        >
          <div>
            <h2 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--paper)' }}>
              Configurar Transmissão
            </h2>
            <p style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--fog)' }}>
              Qualidade e taxa de atualização do seu stream
            </p>
          </div>

          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fog)', marginBottom: '0.5rem' }}>
              Modo de Transmissão
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {MODES.map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMode(m.id);
                      if (m.id === 'motion') setFrameRate(60);
                      if (m.id === 'detail' && frameRate === 60) setFrameRate(30);
                    }}
                    className="btn btn-ghost"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '0.6rem 0.8rem',
                      textAlign: 'left',
                      borderColor: active ? 'var(--signal)' : 'var(--hairline)',
                      backgroundColor: active ? 'rgba(0, 245, 160, 0.08)' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: active ? 'var(--paper)' : 'var(--fog)' }}>
                        {m.label}
                      </span>
                      {active && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--signal)', fontWeight: 600 }}>Ativo ✓</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--fog)', marginTop: '0.2rem', lineHeight: 1.3 }}>
                      {m.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fog)', marginBottom: '0.5rem' }}>
              Resolução
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setResolution(r.id)}
                  className="btn btn-ghost"
                  data-active={resolution === r.id ? 'true' : 'false'}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.875rem',
                    borderColor: resolution === r.id ? 'var(--signal)' : 'var(--hairline)',
                    backgroundColor: resolution === r.id ? 'rgba(0, 245, 160, 0.08)' : 'transparent',
                    color: resolution === r.id ? 'var(--paper)' : 'var(--fog)'
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fog)', marginBottom: '0.5rem' }}>
              Taxa de quadros
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {FRAMERATES.map((fps) => (
                <button
                  key={fps}
                  type="button"
                  onClick={() => setFrameRate(fps)}
                  className="btn btn-ghost"
                  data-active={frameRate === fps ? 'true' : 'false'}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.875rem',
                    borderColor: frameRate === fps ? 'var(--signal)' : 'var(--hairline)',
                    backgroundColor: frameRate === fps ? 'rgba(0, 245, 160, 0.08)' : 'transparent',
                    color: frameRate === fps ? 'var(--paper)' : 'var(--fog)'
                  }}
                >
                  {fps} fps
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', color: 'var(--paper)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={audio}
                  onChange={(e) => setAudio(e.target.checked)}
                  style={{ accentColor: 'var(--signal)', width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                />
                Compartilhar áudio do sistema
              </label>

              <button
                type="button"
                onClick={() => setShowAudioGuide(!showAudioGuide)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: showAudioGuide ? 'var(--signal)' : 'var(--fog)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {showAudioGuide ? 'Ocultar guia' : 'Dica de áudio 💡'}
              </button>
            </div>

            {/* Smart Audio Capture Guide */}
            {showAudioGuide ? (
              <div
                className="rise-in"
                style={{
                  marginTop: '0.625rem',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(0, 245, 160, 0.05)',
                  border: '1px solid rgba(0, 245, 160, 0.3)',
                  fontSize: '0.75rem',
                  lineHeight: 1.45
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--signal)', marginBottom: '0.35rem' }}>
                  ✓ Para o som do seu jogo/vídeo sair perfeito:
                </div>
                <ul style={{ paddingLeft: '1.1rem', color: 'var(--paper)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <li>
                    No diálogo do Chrome, selecione <strong>&quot;Tela Inteira&quot;</strong> (para jogos/apps) ou <strong>&quot;Aba&quot;</strong> (para YouTube/filmes).
                  </li>
                  <li>
                    <span style={{ color: 'var(--signal)', fontWeight: 600 }}>IMPORTANTE:</span> marque a caixa <strong>&quot;Compartilhar áudio do sistema&quot;</strong> no canto inferior esquerdo do pop-up do navegador.
                  </li>
                  <li style={{ color: 'var(--fog)' }}>
                    <em>Obs: O Windows/Chrome não permite capturar áudio se você selecionar uma &quot;Janela&quot; individual.</em>
                  </li>
                </ul>
              </div>
            ) : (
              <p style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--fog)', lineHeight: 1.4 }}>
                Selecione &quot;Aba&quot; ou &quot;Tela Inteira&quot; e marque a caixinha de áudio no diálogo do navegador.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-ghost"
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="btn-nested-cta"
              style={{ flex: 1.2, padding: '0.5rem 0.875rem' }}
            >
              <span>Transmitir</span>
              <span className="btn-nested-circle" style={{ width: '1.75rem', height: '1.75rem' }}>
                →
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
