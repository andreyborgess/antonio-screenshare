import React, { useState } from 'react';

export default function JoinRoomForm({ onJoinRoom }) {
  const [code, setCode] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length >= 4) {
      onJoinRoom(cleanCode);
    }
  }

  return (
    <div className="bezel-shell" style={{ height: '100%' }}>
      <form onSubmit={handleSubmit} className="bezel-core" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--signal)', fontWeight: 700 }}>
            Conexão Rápida
          </span>
          <h2 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--paper)', marginTop: '0.25rem' }}>
            Entrar em uma sala
          </h2>
          <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--fog)', lineHeight: 1.5 }}>
            Cole o código de 6 dígitos que te enviaram.
          </p>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--fog)', margin: '1rem 0' }}>
          Código da sala
          <input
            className="field field-code"
            placeholder="4A3SA7"
            maxLength={6}
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </label>

        <div>
          <button
            type="submit"
            disabled={code.trim().length < 4}
            className="btn-nested-cta btn-nested-ghost"
          >
            <span>Entrar na sala</span>
            <span className="btn-nested-circle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 10 4 15 9 20" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
