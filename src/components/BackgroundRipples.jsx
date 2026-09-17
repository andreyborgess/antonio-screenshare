import React from 'react';

export default function BackgroundRipples() {
  const delays = [0, 1.5, 3, 4.5];

  return (
    <div
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        zIndex: 0
      }}
    >
      <div
        style={{
          position: 'relative',
          height: '36rem',
          width: '36rem',
          maxWidth: '140vw'
        }}
      >
        {delays.map((delay) => (
          <span
            key={delay}
            className="ripple-ring"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(ellipse at center, transparent 0%, var(--abyss) 72%)'
        }}
      />
    </div>
  );
}
