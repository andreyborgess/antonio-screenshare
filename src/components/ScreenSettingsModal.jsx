import React, { useState } from 'react';

const RESOLUTIONS = [
  { id: '1080p', label: '1080p', width: 1920, height: 1080 },
  { id: '720p', label: '720p', width: 1280, height: 720 },
  { id: '480p', label: '480p', width: 854, height: 480 }
];

const FRAMERATES = [15, 30, 60];
const STORAGE_KEY = 'antonio:screenShareSettings';

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { resolution: '1080p', frameRate: 30, audio: true };
}

export default function ScreenSettingsModal({ onConfirm, onCancel }) {
  const initial = getStoredSettings();
  const [resolution, setResolution] = useState(initial.resolution || '1080p');
  const [frameRate, setFrameRate] = useState(initial.frameRate || 30);
  const [audio, setAudio] = useState(initial.audio !== false);

  function handleConfirm() {
    const selectedRes = RESOLUTIONS.find((r) => r.id === resolution) || RESOLUTIONS[0];
    const settings = {
      resolution: selectedRes.id,
      width: selectedRes.width,
      height: selectedRes.height,
      frameRate,
      audio
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ resolution, frameRate, audio }));
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', color: 'var(--paper)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={audio}
                onChange={(e) => setAudio(e.target.checked)}
                style={{ accentColor: 'var(--signal)', width: '1.1rem', height: '1.1rem' }}
              />
              Compartilhar áudio do sistema
            </label>
            <p style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--fog)', lineHeight: 1.4 }}>
              Dica: selecione &quot;Aba&quot; ou &quot;Tela Inteira&quot; no diálogo do navegador para capturar áudio perfeitamente.
            </p>
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
