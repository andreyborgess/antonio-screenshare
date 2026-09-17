import React from 'react';

export default function ReactionOverlay({ reactions = [] }) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="floating-reactions-layer" aria-hidden="true">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="floating-reaction-item"
          style={{
            right: `calc(2.5rem + ${r.offsetX || 0}px)`
          }}
        >
          <span className="floating-reaction-emoji">{r.emoji}</span>
          {r.senderName && (
            <span className="floating-reaction-sender">{r.senderName}</span>
          )}
        </div>
      ))}
    </div>
  );
}
