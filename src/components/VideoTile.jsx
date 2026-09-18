import React, { useRef, useEffect, useState } from 'react';
import { getAvatarColor, getInitials } from '../hooks/useWebRTC';

const VOLUME_STORAGE_KEY = 'antonio:remoteAudioVolume';

function getStoredVolume(identity) {
  try {
    const data = JSON.parse(localStorage.getItem(VOLUME_STORAGE_KEY) || '{}');
    return typeof data[identity] === 'number' ? data[identity] : 1;
  } catch {
    return 1;
  }
}

function setStoredVolume(identity, vol) {
  try {
    const data = JSON.parse(localStorage.getItem(VOLUME_STORAGE_KEY) || '{}');
    data[identity] = vol;
    localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function VideoTile({
  stream,
  participantName = 'Participante',
  participantId = '',
  source = 'screen', // 'screen' | 'camera'
  isLocal = false,
  isSpeaking = false,
  isMicMuted = false,
  onPin
}) {
  const videoRef = useRef(null);
  const [volume, setVolume] = useState(() => getStoredVolume(participantId));
  const [isMuted, setIsMuted] = useState(false);
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const isPiPSupported = typeof document !== 'undefined' && !!document.pictureInPictureEnabled;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleEnterPiP = () => setIsPiP(true);
    const handleLeavePiP = () => setIsPiP(false);

    videoEl.addEventListener('enterpictureinpicture', handleEnterPiP);
    videoEl.addEventListener('leavepictureinpicture', handleLeavePiP);

    return () => {
      videoEl.removeEventListener('enterpictureinpicture', handleEnterPiP);
      videoEl.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, []);

  async function togglePictureInPicture(e) {
    e.stopPropagation();
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('Picture-in-Picture error:', err);
    }
  }

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      const audioTracks = stream.getAudioTracks();
      setHasAudioTrack(audioTracks.length > 0 && !isLocal);
    }
  }, [stream, isLocal]);

  useEffect(() => {
    if (videoRef.current && !isLocal) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, isLocal]);

  function handleVolumeChange(e) {
    e.stopPropagation();
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    setStoredVolume(participantId, newVol);
  }

  function toggleMute(e) {
    e.stopPropagation();
    if (isMuted) {
      setIsMuted(false);
      if (volume === 0) setVolume(1);
    } else {
      setIsMuted(true);
    }
  }

  return (
    <div
      className={`video-tile ${source === 'camera' ? 'camera-tile' : ''}`}
      data-speaking={isSpeaking ? 'true' : 'false'}
      onClick={onPin}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: onPin ? 'pointer' : 'default',
        backgroundColor: '#000'
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: '100%',
          height: '100%',
          objectFit: source === 'screen' ? 'contain' : 'cover'
        }}
      />

      {/* Picture-in-Picture Button */}
      {isPiPSupported && (
        <div
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            zIndex: 12
          }}
        >
          <button
            type="button"
            onClick={togglePictureInPicture}
            title={isPiP ? 'Sair do Picture-in-Picture' : 'Assistir em janela flutuante (Picture-in-Picture)'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2rem',
              height: '2rem',
              borderRadius: '0.5rem',
              backgroundColor: isPiP ? 'var(--signal)' : 'rgba(7, 8, 11, 0.75)',
              color: isPiP ? '#07080b' : 'var(--paper)',
              backdropFilter: 'blur(8px)',
              border: isPiP ? '1px solid var(--signal)' : '1px solid var(--hairline)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <rect x="12" y="10" width="8" height="6" rx="1" fill={isPiP ? '#07080b' : 'currentColor'} />
            </svg>
          </button>
        </div>
      )}

      {/* Participant Badge Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '0.75rem',
          left: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: 'rgba(7, 8, 11, 0.75)',
          backdropFilter: 'blur(8px)',
          padding: '0.35rem 0.65rem',
          borderRadius: '0.5rem',
          border: isSpeaking ? '1px solid var(--signal)' : '1px solid var(--hairline)',
          zIndex: 10,
          transition: 'border-color 0.2s ease'
        }}
      >
        <span
          className="avatar"
          data-speaking={isSpeaking ? 'true' : 'false'}
          style={{
            width: '1.4rem',
            height: '1.4rem',
            fontSize: '0.75rem',
            background: getAvatarColor(participantId || participantName)
          }}
        >
          {getInitials(participantName)}
        </span>

        <span style={{ fontSize: '0.8125rem', color: 'var(--paper)', fontWeight: 500 }}>
          {participantName} {isLocal && '(você)'}
        </span>

        {/* Mic Status Icon */}
        {isMicMuted ? (
          <span title="Microfone mutado" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
            </svg>
          </span>
        ) : isSpeaking ? (
          <span title="Falando agora" style={{ color: 'var(--signal)', display: 'flex', alignItems: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          </span>
        ) : null}

        <span
          style={{
            fontSize: '0.7rem',
            color: 'var(--fog)',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            padding: '0.1rem 0.35rem',
            borderRadius: '0.25rem'
          }}
        >
          {source === 'screen' ? 'Tela' : 'Câmera'}
        </span>
      </div>

      {/* Remote Audio Volume Slider (Screen Audio) */}
      {hasAudioTrack && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: '0.75rem',
            right: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(7, 8, 11, 0.75)',
            backdropFilter: 'blur(8px)',
            padding: '0.35rem 0.65rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--hairline)',
            zIndex: 10
          }}
        >
          <button
            type="button"
            onClick={toggleMute}
            style={{
              background: 'none',
              border: 'none',
              color: isMuted || volume === 0 ? 'var(--danger)' : 'var(--orchid)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {isMuted || volume === 0 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 9v6h4l5 5V4L8 9H4z" />
                <path d="M19.5 8.5 17 11l2.5 2.5-1 1L16 12l-2.5 2.5-1-1L15 11l-2.5-2.5 1-1L16 10l2.5-2.5z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 9v6h4l5 5V4L8 9H4z" />
                <path d="M16.5 12a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            style={{ width: '4rem', accentColor: 'var(--orchid)', cursor: 'pointer' }}
          />
        </div>
      )}
    </div>
  );
}

export default React.memo(VideoTile);
