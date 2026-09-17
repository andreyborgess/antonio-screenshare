import React, { useState } from 'react';

const STORAGE_KEY = 'antonio:displayName';

export function getStoredDisplayName() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export default function DisplayNameModal({ onSave, onCancel }) {
  const [name, setName] = useState(getStoredDisplayName() || '');
  const [isSaving, setIsSaving] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const cleanName = name.trim();
    if (cleanName) {
      setIsSaving(true);
      try {
        localStorage.setItem(STORAGE_KEY, cleanName);
      } catch {}
      onSave(cleanName);
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
    >
      <div className="bezel-shell rise-in" style={{ width: '100%', maxWidth: '24rem' }}>
        <form
          onSubmit={handleSubmit}
          className="bezel-core"
          style={{
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          <div>
            <h2 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--paper)' }}>
              Como querem te chamar?
            </h2>
            <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--fog)', lineHeight: 1.5 }}>
              Você entrou na sala. Personalize seu nome de exibição para todos te reconhecerem.
            </p>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--fog)' }}>
            Nome de exibição
            <input
              autoFocus
              className="field"
              placeholder="Ex: Antonio, Pedro, Ana..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ fontSize: '0.9375rem' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-ghost"
              style={{ flex: 1 }}
            >
              Ficar anônimo
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="btn-nested-cta"
              style={{ flex: 1, padding: '0.5rem 0.875rem' }}
            >
              <span>{isSaving ? 'Salvando...' : 'Confirmar'}</span>
              <span className="btn-nested-circle" style={{ width: '1.75rem', height: '1.75rem' }}>
                ✓
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
