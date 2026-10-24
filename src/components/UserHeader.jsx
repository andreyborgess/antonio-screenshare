// src/components/UserHeader.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function UserHeader() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header
      style={{
        position: 'absolute',
        top: '1.25rem',
        right: '1.5rem',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.4rem 0.85rem 0.4rem 0.5rem',
          borderRadius: '999px',
          backgroundColor: 'rgba(16, 18, 26, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(245, 158, 11, 0.15)'
        }}
      >
        <img
          src={user.avatarUrl}
          alt={user.username}
          style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1.5px solid #F59E0B'
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.2 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--paper)' }}>
            {user.globalName || user.username}
          </span>
          <span style={{ fontSize: '0.675rem', color: '#FCD34D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>👑</span> Membro Suprema Brasil
          </span>
        </div>

        <button
          type="button"
          onClick={logout}
          title="Desconectar da conta Discord"
          style={{
            marginLeft: '0.5rem',
            background: 'none',
            border: 'none',
            color: 'var(--fog)',
            cursor: 'pointer',
            padding: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ff8a94')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fog)')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </header>
  );
}
