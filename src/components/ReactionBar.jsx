import React from 'react';

const EMOJIS = ['❤️', '🔥', '👏', '😂', '👍', '🎉'];

export default function ReactionBar({ onSendReaction }) {
  return (
    <div
      className="reaction-bar"
      role="toolbar"
      aria-label="Reações rápidas"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-pill"
          onClick={() => onSendReaction(emoji)}
          title={`Reagir com ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
