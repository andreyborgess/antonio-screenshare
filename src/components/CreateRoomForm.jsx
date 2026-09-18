import React, { useState } from 'react';
import { getApiBase } from '../utils/discord';

export default function CreateRoomForm({ onRoomCreated }) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() || undefined })
      });

      if (!res.ok) {
        throw new Error('Falha ao criar sala.');
      }

      const data = await res.json();
      onRoomCreated(data.code);
    } catch {
      setError('Não foi possível criar a sala. Tente de novo.');
      setIsLoading(false);
    }
  }

  return (
    <div className="bezel-shell" style={{ height: '100%' }}>
      <form onSubmit={handleSubmit} className="bezel-core" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--orchid)', fontWeight: 700 }}>
            Nova Sessão
          </span>
          <h2 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--paper)', marginTop: '0.25rem' }}>
            Criar sala
          </h2>
          <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--fog)', lineHeight: 1.5 }}>
            Gera um código exclusivo e temporário na hora.
          </p>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--fog)', margin: '1rem 0' }}>
          Senha de acesso (opcional)
          <input
            type="password"
            className="field"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-nested-cta"
          >
            <span>{isLoading ? 'Criando sala...' : 'Criar sala agora'}</span>
            <span className="btn-nested-circle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </button>

          {error && <p className="error-text" role="alert" style={{ marginTop: '0.5rem' }}>{error}</p>}
        </div>
      </form>
    </div>
  );
}
