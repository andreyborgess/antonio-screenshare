import React, { useState, useRef, useEffect } from 'react';
import { getAvatarColor, getInitials } from '../hooks/useWebRTC';

export default function SidebarChat({
  participants = [],
  chatMessages = [],
  peerSpeakingMap = {},
  peerMicMutedMap = {},
  onSendMessage
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  }

  return (
    <aside
      aria-label="Participantes e Chat da Sala"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '22rem',
        height: '100%',
        backgroundColor: 'var(--panel)',
        borderLeft: '1px solid var(--hairline)'
      }}
    >
      {/* Participants Section */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'var(--fog)'
            }}
          >
            Na sala
          </h2>
          <span
            className="font-mono"
            style={{
              fontSize: '0.75rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--hairline)',
              color: 'var(--paper)'
            }}
          >
            {participants.length}
          </span>
        </div>

        <ul style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', listStyle: 'none' }}>
          {participants.map((p) => {
            const isSpeaking = !!peerSpeakingMap[p.socketId];
            const isMuted = !!peerMicMutedMap[p.socketId];

            return (
              <li
                key={p.socketId}
                style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}
              >
                <span
                  className="avatar"
                  data-speaking={isSpeaking ? 'true' : 'false'}
                  style={{ background: getAvatarColor(p.socketId || p.name) }}
                >
                  {getInitials(p.name)}
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--paper)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                  {p.isLocal && <span style={{ color: 'var(--fog)', fontSize: '0.75rem' }}> (você)</span>}
                </span>

                {/* Mic & Voice Activity Indicator */}
                {isMuted ? (
                  <span title="Mutado" style={{ color: 'var(--danger)', display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
                    </svg>
                  </span>
                ) : isSpeaking ? (
                  <span title="Falando" style={{ color: 'var(--signal)', display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  </span>
                ) : (
                  <span title="Microfone aberto" style={{ color: 'var(--fog)', opacity: 0.6, display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Chat Section */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <h2
          style={{
            padding: '1rem 1rem 0.5rem 1rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'var(--fog)'
          }}
        >
          Chat em tempo real
        </h2>

        {/* Message Container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}
        >
          {chatMessages.length === 0 ? (
            /* Composed Empty State */
            <div className="chat-empty-state">
              <div className="chat-empty-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--paper)', fontWeight: 500 }}>
                Nenhuma mensagem ainda
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--fog)', lineHeight: 1.4 }}>
                Envie notas, links ou tire dúvidas com quem está na transmissão.
              </p>
            </div>
          ) : (
            chatMessages.map((msg) => {
              if (msg.kind === 'system') {
                return (
                  <p
                    key={msg.id}
                    style={{
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      fontStyle: 'italic',
                      color: 'var(--fog)',
                      margin: '0.25rem 0'
                    }}
                  >
                    {msg.text}
                  </p>
                );
              }

              return (
                <div key={msg.id} style={{ fontSize: '0.875rem', wordBreak: 'break-word', lineHeight: 1.4 }}>
                  <span
                    style={{
                      fontWeight: 600,
                      color: msg.isLocal ? 'var(--orchid)' : 'var(--signal)',
                      marginRight: '0.375rem'
                    }}
                  >
                    {msg.from}:
                  </span>
                  <span style={{ color: 'var(--paper)' }}>{msg.message}</span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.75rem',
            borderTop: '1px solid var(--hairline)'
          }}
        >
          <input
            className="field"
            placeholder="Mensagem para a sala..."
            aria-label="Mensagem do chat"
            autoComplete="off"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{ padding: '0.55rem 0.85rem', fontSize: '0.875rem' }}
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="btn btn-primary"
            style={{ padding: '0.55rem 1rem', fontSize: '0.875rem' }}
          >
            Enviar
          </button>
        </form>
      </div>
    </aside>
  );
}
