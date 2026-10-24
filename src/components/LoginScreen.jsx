// src/components/LoginScreen.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import BackgroundRipples from './BackgroundRipples';

export default function LoginScreen() {
  const { login, loading, authError, clearError, discordAuthUrl, clientId, redirectUri } = useAuth();

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: 'var(--abyss)',
        overflow: 'hidden'
      }}
    >
      <BackgroundRipples />

      <div
        className="bezel-shell"
        style={{
          width: '100%',
          maxWidth: '31rem',
          backgroundColor: 'rgba(12, 14, 20, 0.92)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(245, 158, 11, 0.28)',
          borderRadius: '1.75rem',
          padding: '2.5rem 2.25rem',
          boxShadow: '0 2rem 5rem -1.5rem rgba(0, 0, 0, 0.95), 0 0 50px -10px rgba(245, 158, 11, 0.22)',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10
        }}
      >
        {loading ? (
          <div style={{ padding: '2rem 1rem' }}>
            <div
              style={{
                width: '3.5rem',
                height: '3.5rem',
                margin: '0 auto 1.5rem',
                border: '3px solid rgba(245, 158, 11, 0.2)',
                borderTopColor: '#F59E0B',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}
            />
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--paper)',
                marginBottom: '0.5rem'
              }}
            >
              Verificando autenticação...
            </h2>
            <p style={{ color: 'var(--fog)', fontSize: '0.875rem' }}>
              Validando sua conta no servidor da Suprema Brasil.
            </p>
          </div>
        ) : authError?.type === 'not_in_guild' ? (
          /* NOT IN GUILD BLOCK SCREEN */
          <div>
            {authError.user?.avatarUrl && (
              <div style={{ marginBottom: '1.25rem', position: 'relative', display: 'inline-block' }}>
                <img
                  src={authError.user.avatarUrl}
                  alt={authError.user.username}
                  style={{
                    width: '4.5rem',
                    height: '4.5rem',
                    borderRadius: '50%',
                    border: '2px solid rgba(255, 82, 102, 0.6)',
                    boxShadow: '0 0 20px rgba(255, 82, 102, 0.3)'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    backgroundColor: '#ff5266',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '1.5rem',
                    height: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    border: '2px solid var(--panel)'
                  }}
                >
                  ✕
                </span>
              </div>
            )}

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(255, 82, 102, 0.12)',
                border: '1px solid rgba(255, 82, 102, 0.3)',
                color: '#ff8a94',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: '1.25rem'
              }}
            >
              <span>⛔ Servidor Privado</span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--paper)',
                marginBottom: '0.75rem',
                letterSpacing: '-0.02em'
              }}
            >
              Acesso Exclusivo Suprema Brasil
            </h2>

            <p
              style={{
                color: 'var(--fog)',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                marginBottom: '1.75rem'
              }}
            >
              Olá, <strong style={{ color: 'var(--paper)' }}>{authError.user?.globalName || authError.user?.username || 'Usuário'}</strong>.
              Sua conta do Discord foi autenticada, mas esta plataforma é estritamente privada para membros do servidor oficial da <strong>Suprema Brasil</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a
                href={discordAuthUrl}
                style={{
                  width: '100%',
                  padding: '0.9rem 1.5rem',
                  borderRadius: 'var(--radius-btn)',
                  background: 'linear-gradient(135deg, #FFE082 0%, #F59E0B 50%, #D97706 100%)',
                  color: '#07080b',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  boxShadow: '0 8px 24px -4px rgba(245, 158, 11, 0.45)',
                  cursor: 'pointer'
                }}
              >
                <span>Tentar Novamente</span>
              </a>

              <button
                type="button"
                onClick={clearError}
                style={{
                  width: '100%',
                  padding: '0.75rem 1.25rem',
                  borderRadius: 'var(--radius-btn)',
                  backgroundColor: 'transparent',
                  color: 'var(--fog)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  border: '1px solid var(--hairline)',
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
              >
                Voltar à tela de login
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD LOGIN SCREEN WITH SUPREMA BRASIL BRANDING */
          <div>
            {/* Official Suprema Brasil Logo Badge */}
            <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  width: '5.25rem',
                  height: '5.25rem',
                  borderRadius: '50%',
                  padding: '3px',
                  background: 'linear-gradient(135deg, #FFE082 0%, #F59E0B 50%, #D97706 100%)',
                  boxShadow: '0 0 32px rgba(245, 158, 11, 0.4), inset 0 0 12px rgba(245, 158, 11, 0.3)'
                }}
              >
                <img
                  src="/logo.png"
                  alt="Suprema Brasil"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    backgroundColor: '#07080b',
                    display: 'block'
                  }}
                />
              </div>
            </div>

            {/* Noble Tag */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.95rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#FCD34D',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '1.25rem'
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#F59E0B',
                  boxShadow: '0 0 8px #F59E0B'
                }}
              />
              <span>👑 Acesso Exclusivo · Suprema Brasil</span>
            </div>

            {/* App Branding */}
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.95rem',
                fontWeight: 800,
                color: 'var(--paper)',
                marginBottom: '0.65rem',
                letterSpacing: '-0.03em',
                lineHeight: 1.15
              }}
            >
              Suprema <span className="text-gold-gradient">Screenshare</span>
            </h1>

            <p
              style={{
                color: 'var(--fog)',
                fontSize: '0.925rem',
                lineHeight: 1.6,
                marginBottom: '1.75rem'
              }}
            >
              Compartilhamento de tela P2P a 60 FPS com áudio estéreo imersivo de alta fidelidade.
              Conecte com sua conta do Discord autorizada.
            </p>

            {authError?.type === 'error' && (
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(255, 82, 102, 0.12)',
                  border: '1px solid rgba(255, 82, 102, 0.3)',
                  color: '#ff8a94',
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                  textAlign: 'left'
                }}
              >
                ⚠️ {authError.message}
              </div>
            )}

            {/* Discord Login Button with Gold Accents */}
            <a
              href={discordAuthUrl}
              id="discord-login-btn"
              style={{
                width: '100%',
                padding: '1rem 1.5rem',
                borderRadius: 'var(--radius-btn)',
                background: 'linear-gradient(135deg, #FFE082 0%, #F59E0B 50%, #D97706 100%)',
                color: '#07080b',
                fontSize: '1rem',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                boxShadow: '0 8px 30px -4px rgba(245, 158, 11, 0.55)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                e.currentTarget.style.boxShadow = '0 12px 36px -4px rgba(245, 158, 11, 0.75)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 30px -4px rgba(245, 158, 11, 0.55)';
              }}
            >
              {/* Discord SVG Logo in Dark Contrast */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#07080b">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span>Entrar com Discord</span>
            </a>

            {/* Sub-note */}
            <p
              style={{
                marginTop: '1.25rem',
                fontSize: '0.75rem',
                color: 'var(--fog)',
                opacity: 0.85
              }}
            >
              🔒 Acesso reservado exclusivamente para membros do servidor Suprema Brasil.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
