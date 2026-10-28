import { useState, useEffect, useRef, useCallback } from 'react';
import { playMuteSound, playJoinSound, playLeaveSound } from '../utils/sounds';
import { getApiBase, getWsUrl } from '../utils/discord';

const AVATAR_COLORS = ['#a78bfa', '#4fe7c4', '#f472b6', '#fb923c', '#60a5fa', '#facc15'];

export function getAvatarColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (31 * hash + str.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getInitials(name = '') {
  return name.trim().charAt(0).toUpperCase() || '?';
}

// Usado apenas se o backend não responder /api/ice-servers (TURN configurado via env no servidor)
const FALLBACK_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

let iceServersPromise = null;

// Busca STUN/TURN no backend (credenciais TURN nunca ficam no bundle do frontend)
function loadIceServers({ refresh = false } = {}) {
  if (iceServersPromise && !refresh) return iceServersPromise;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const token = localStorage.getItem('antonio_token') || '';

  iceServersPromise = fetch(`${getApiBase()}/api/ice-servers`, {
    cache: 'no-store',
    signal: controller.signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (Array.isArray(data?.iceServers) && data.iceServers.length > 0 ? data.iceServers : FALLBACK_ICE_SERVERS))
    .catch(() => FALLBACK_ICE_SERVERS)
    .finally(() => clearTimeout(timeout));

  return iceServersPromise;
}

// Configura parâmetros de codificação e degradação no RTCRtpSender para evitar queda drástica de FPS
async function applySenderParameters(sender, track, settings = {}) {
  if (!sender || !track) return;
  try {
    if (track.kind === 'video') {
      const hint = settings?.contentHint || (settings?.mode === 'detail' ? 'detail' : 'motion');
      try {
        track.contentHint = hint;
      } catch {}
    }

    const params = sender.getParameters();
    if (!params) return;

    // degradationPreference: 'maintain-framerate' instrui o navegador a manter a fluidez (60fps)
    // sem descartar quadros desnecessariamente em caso de oscilação
    const degPref = settings?.degradationPreference || (settings?.mode === 'detail' ? 'maintain-resolution' : 'maintain-framerate');
    if ('degradationPreference' in params || typeof params.degradationPreference !== 'undefined') {
      params.degradationPreference = degPref;
    }

    const maxBitrate = settings?.maxBitrate || 3500000;
    const maxFramerate = settings?.frameRate || 60;

    // Antes da negociação alguns navegadores retornam encodings vazio; reaplicamos após a negociação
    if (!params.encodings || params.encodings.length === 0) return;

    params.encodings[0].maxBitrate = maxBitrate;
    params.encodings[0].maxFramerate = maxFramerate;
    params.encodings[0].priority = 'high';
    params.encodings[0].networkPriority = 'high';

    await sender.setParameters(params);
  } catch (err) {
    console.warn('Unable to apply video sender parameters:', err);
  }
}

async function applyAudioSenderParameters(sender) {
  try {
    const params = sender.getParameters();
    if (!params?.encodings?.length) return;
    params.encodings[0].maxBitrate = 196000;
    params.encodings[0].priority = 'high';
    await sender.setParameters(params);
  } catch (err) {
    console.warn('Unable to apply audio sender parameters:', err);
  }
}

// Prioriza codec H.264 com aceleração por hardware (GPU NVENC/QuickSync/AMF)
function preferH264Codec(pc) {
  try {
    if (!pc.getTransceivers || !window.RTCRtpReceiver?.getCapabilities) return;
    const transceivers = pc.getTransceivers();
    transceivers.forEach((t) => {
      const isVideo = t.sender?.track?.kind === 'video' || t.receiver?.track?.kind === 'video';
      if (isVideo && t.setCodecPreferences) {
        const capabilities = window.RTCRtpReceiver.getCapabilities('video');
        if (capabilities && capabilities.codecs) {
          const h264 = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/h264');
          const others = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() !== 'video/h264');
          if (h264.length > 0) {
            t.setCodecPreferences([...h264, ...others]);
          }
        }
      }
    });
  } catch (e) {
    console.warn('Could not set H264 preference:', e);
  }
}

// Injeta parâmetros estéreo e alta taxa de amostragem Opus (196 kbps estéreo) no SDP
function enrichSdpWithStereoOpus(sdp) {
  if (!sdp || typeof sdp !== 'string') return sdp;
  return sdp.replace(/a=fmtp:(\d+)\s+([\s\S]*?)(?=\r?\n|$)/g, (fullMatch, pt, params) => {
    const opusRegex = new RegExp(`a=rtpmap:${pt}\\s+opus\\/48000`, 'i');
    if (opusRegex.test(sdp)) {
      let updatedParams = params;
      if (!updatedParams.includes('stereo=')) updatedParams += ';stereo=1';
      if (!updatedParams.includes('sprop-stereo=')) updatedParams += ';sprop-stereo=1';
      if (!updatedParams.includes('maxaveragebitrate=')) updatedParams += ';maxaveragebitrate=196000';
      return `a=fmtp:${pt} ${updatedParams}`;
    }
    return fullMatch;
  });
}

export function useWebRTC({ roomCode, displayName }) {
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | connected | disconnected | error
  const [participants, setParticipants] = useState([]); // [{ socketId, name, identity, isLocal }]
  const [chatMessages, setChatMessages] = useState([]);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [localCameraStream, setLocalCameraStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: { screenStream, cameraStream, audioStream, name } }
  const [networkStats, setNetworkStats] = useState({
    ping: null,
    fps: null,
    bitrateKbps: null,
    packetLossPct: 0,
    resolution: null,
    codec: null,
    connectionType: 'direct', // 'direct' (P2P) | 'relay' (TURN)
    jitter: null,
    quality: 'good'
  });
  const prevStatsRef = useRef({
    timestamp: Date.now(),
    bytesTotal: 0,
    packetsLost: 0,
    packetsTotal: 0
  });
  const [audioLevels, setAudioLevels] = useState({ mic: 0, screen: 0 });

  // Microphone & Speaking States
  const [localMicStream, setLocalMicStream] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [peerSpeakingMap, setPeerSpeakingMap] = useState({}); // { [socketId]: boolean }
  const [peerMicMutedMap, setPeerMicMutedMap] = useState({}); // { [socketId]: boolean }
  const [activeReactions, setActiveReactions] = useState([]); // [{ id, emoji, senderName, offsetX }]

  const wsRef = useRef(null);
  const localSocketIdRef = useRef(null);
  const peersRef = useRef(new Map()); // peerSocketId -> { pc, polite, makingOffer, streams, ... }
  const iceServersRef = useRef(null);
  const screenSettingsRef = useRef(null);
  const screenAnalyserRef = useRef(null);
  const localScreenRef = useRef(null);
  const localCameraRef = useRef(null);
  const localMicRef = useRef(null);
  const isMicMutedRef = useRef(false);
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;

  // Web Audio Context for Voice Activity Detection
  const audioContextRef = useRef(null);
  const vadIntervalRef = useRef(null);

  // Helper to send message via WebSocket
  const sendWs = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Mapa streamId -> tipo ('screen' | 'camera' | 'mic') enviado junto de cada offer/answer,
  // para o outro lado saber qual stream remoto é tela, câmera ou microfone
  const getLocalMediaMap = useCallback(() => {
    const map = {};
    if (localScreenRef.current) map[localScreenRef.current.id] = 'screen';
    if (localCameraRef.current) map[localCameraRef.current.id] = 'camera';
    if (localMicRef.current) map[localMicRef.current.id] = 'mic';
    return map;
  }, []);

  // Recalcula screen/camera/audio de um peer a partir dos streams recebidos
  const publishRemoteMedia = useCallback((peerId) => {
    const peer = peersRef.current.get(peerId);
    if (!peer) return;

    let screenStream = null;
    let cameraStream = null;
    let audioStream = null;
    const unknownVideo = [];

    peer.streams.forEach((stream, streamId) => {
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      const kind = peer.remoteMediaMap[streamId];

      if (kind === 'screen') {
        if (hasVideo) screenStream = stream;
      } else if (kind === 'camera') {
        if (hasVideo) cameraStream = stream;
      } else if (kind === 'mic') {
        if (hasAudio) audioStream = stream;
      } else if (hasVideo) {
        unknownVideo.push(stream);
      } else if (hasAudio && !audioStream) {
        audioStream = stream;
      }
    });

    // Peer sem mediaMap (versão antiga): primeiro vídeo é a tela, o segundo a câmera
    unknownVideo.forEach((stream) => {
      if (!screenStream) screenStream = stream;
      else if (!cameraStream) cameraStream = stream;
    });

    setRemoteStreams((prev) => ({
      ...prev,
      [peerId]: { ...prev[peerId], screenStream, cameraStream, audioStream }
    }));
  }, []);

  // Aplica bitrate/FPS/prioridade nos senders da tela compartilhada
  const tuneScreenSenders = useCallback((pc) => {
    const screen = localScreenRef.current;
    if (!screen) return;
    const screenTracks = screen.getTracks();
    pc.getSenders().forEach((sender) => {
      if (!sender.track || !screenTracks.includes(sender.track)) return;
      if (sender.track.kind === 'video') {
        applySenderParameters(sender, sender.track, screenSettingsRef.current || {});
      } else {
        applyAudioSenderParameters(sender);
      }
    });
  }, []);

  const flushPendingCandidates = useCallback(async (peer) => {
    const queued = peer.pendingCandidates;
    peer.pendingCandidates = [];
    for (const cand of queued) {
      try {
        await peer.pc.addIceCandidate(cand);
      } catch (err) {
        if (!peer.ignoreOffer) console.warn('Error adding queued ICE candidate:', err);
      }
    }
  }, []);

  const closePeer = useCallback((peerId) => {
    const peer = peersRef.current.get(peerId);
    if (!peer) return;
    clearTimeout(peer.disconnectTimer);
    try {
      peer.pc.close();
    } catch {}
    peersRef.current.delete(peerId);
    setRemoteStreams((prev) => {
      if (!prev[peerId]) return prev;
      const updated = { ...prev };
      delete updated[peerId];
      return updated;
    });
  }, []);

  // Update track for all peer connections
  const addTrackToAllPeers = useCallback((track, stream) => {
    peersRef.current.forEach(({ pc }) => {
      try {
        const senders = pc.getSenders();
        const alreadyAdded = senders.some((s) => s.track && s.track.id === track.id);
        if (!alreadyAdded) {
          pc.addTrack(track, stream);
        }
      } catch (e) {
        console.error('Error adding track to peer:', e);
      }
    });
  }, []);

  const removeTrackFromAllPeers = useCallback((track) => {
    peersRef.current.forEach(({ pc }) => {
      try {
        const senders = pc.getSenders();
        const sender = senders.find((s) => s.track && s.track.id === track.id);
        if (sender) {
          pc.removeTrack(sender);
        }
      } catch (e) {
        console.error('Error removing track from peer:', e);
      }
    });
  }, []);

  // Cria (ou reutiliza) a conexão com um peer usando o padrão "perfect negotiation":
  // os dois lados podem renegociar (ligar tela/câmera/mic) e colisões de offer são resolvidas
  // pelo lado "polite", que descarta a própria offer e aceita a do outro.
  const getOrCreatePeer = useCallback((targetId, { initiator = false } = {}) => {
    const existing = peersRef.current.get(targetId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current || FALLBACK_ICE_SERVERS,
      iceCandidatePoolSize: 2
    });

    const peer = {
      pc,
      polite: (localSocketIdRef.current || '') < targetId,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
      remoteMediaMap: {},
      streams: new Map(),
      disconnectTimer: null
    };
    peersRef.current.set(targetId, peer);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendWs({ type: 'ice-candidate', targetId, candidate: candidate.toJSON() });
      }
    };

    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] || new MediaStream([track]);
      if (!peer.streams.has(stream.id)) {
        peer.streams.set(stream.id, stream);
        stream.addEventListener('addtrack', () => publishRemoteMedia(targetId));
        stream.addEventListener('removetrack', () => {
          if (stream.getTracks().length === 0) peer.streams.delete(stream.id);
          publishRemoteMedia(targetId);
        });
      }
      publishRemoteMedia(targetId);
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        preferH264Codec(pc);
        const offer = await pc.createOffer();
        // Uma offer remota pode ter chegado enquanto criávamos a nossa
        if (pc.signalingState !== 'stable') return;
        if (offer.sdp) offer.sdp = enrichSdpWithStereoOpus(offer.sdp);
        await pc.setLocalDescription(offer);
        sendWs({
          type: 'offer',
          targetId,
          offer: pc.localDescription,
          mediaMap: getLocalMediaMap()
        });
      } catch (err) {
        console.error('Negotiation error:', err);
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable') tuneScreenSenders(pc);
    };

    // Recupera a conexão automaticamente se a rota de rede cair (troca de Wi-Fi/4G, NAT expirado)
    pc.onconnectionstatechange = () => {
      clearTimeout(peer.disconnectTimer);
      if (pc.connectionState === 'failed') {
        pc.restartIce();
      } else if (pc.connectionState === 'disconnected') {
        peer.disconnectTimer = setTimeout(() => {
          if (pc.connectionState === 'disconnected') pc.restartIce();
        }, 4000);
      }
    };

    // Canal de dados garante que a conexão seja negociada mesmo sem nenhuma mídia local
    if (initiator) {
      pc.createDataChannel('control');
    }

    // Add existing local tracks to the new peer connection
    [localMicRef.current, localScreenRef.current, localCameraRef.current].forEach((stream) => {
      if (!stream) return;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    });
    tuneScreenSenders(pc);

    return peer;
  }, [sendWs, getLocalMediaMap, publishRemoteMedia, tuneScreenSenders]);

  // Processa offer/answer recebidos (perfect negotiation)
  const handleRemoteDescription = useCallback(async (senderId, description, mediaMap) => {
    const peer = getOrCreatePeer(senderId);
    const { pc } = peer;
    if (mediaMap) peer.remoteMediaMap = mediaMap;

    if (description.type === 'offer') {
      const offerCollision = peer.makingOffer || pc.signalingState !== 'stable';
      peer.ignoreOffer = !peer.polite && offerCollision;
      if (peer.ignoreOffer) return;

      await pc.setRemoteDescription(description);
      await flushPendingCandidates(peer);

      preferH264Codec(pc);
      const answer = await pc.createAnswer();
      if (answer.sdp) answer.sdp = enrichSdpWithStereoOpus(answer.sdp);
      await pc.setLocalDescription(answer);
      sendWs({
        type: 'answer',
        targetId: senderId,
        answer: pc.localDescription,
        mediaMap: getLocalMediaMap()
      });
    } else {
      if (pc.signalingState !== 'have-local-offer') return;
      await pc.setRemoteDescription(description);
      await flushPendingCandidates(peer);
    }

    publishRemoteMedia(senderId);
  }, [getOrCreatePeer, flushPendingCandidates, sendWs, getLocalMediaMap, publishRemoteMedia]);

  const handleRemoteCandidate = useCallback(async (senderId, candidate) => {
    const peer = peersRef.current.get(senderId);
    if (!peer || !candidate) return;
    if (!peer.pc.remoteDescription) {
      peer.pendingCandidates.push(candidate);
      return;
    }
    try {
      await peer.pc.addIceCandidate(candidate);
    } catch (err) {
      if (!peer.ignoreOffer) console.warn('Error adding ICE candidate:', err);
    }
  }, []);

  // Setup Local Microphone and Voice Activity Detection (VAD)
  useEffect(() => {
    let isCancelled = false;

    async function initMicrophone() {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });

        if (isCancelled) {
          micStream.getTracks().forEach((t) => t.stop());
          return;
        }

        localMicRef.current = micStream;
        setLocalMicStream(micStream);
        setIsMicMuted(false);
        isMicMutedRef.current = false;

        // Add mic track to all active peer connections
        micStream.getTracks().forEach((t) => {
          addTrackToAllPeers(t, micStream);
        });

        // Setup Web Audio VAD
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(micStream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            let currentlySpeaking = false;
            let silenceCount = 0;

            vadIntervalRef.current = setInterval(() => {
              let micAvg = 0;
              if (isMicMutedRef.current) {
                if (currentlySpeaking) {
                  currentlySpeaking = false;
                  setIsSpeaking(false);
                  sendWs({ type: 'speaking-state', isSpeaking: false });
                }
              } else {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                  sum += dataArray[i];
                }
                micAvg = sum / bufferLength;

                // Threshold for speech detection
                if (micAvg > 18) {
                  silenceCount = 0;
                  if (!currentlySpeaking) {
                    currentlySpeaking = true;
                    setIsSpeaking(true);
                    sendWs({ type: 'speaking-state', isSpeaking: true });
                  }
                } else {
                  silenceCount++;
                  if (silenceCount > 4 && currentlySpeaking) {
                    currentlySpeaking = false;
                    setIsSpeaking(false);
                    sendWs({ type: 'speaking-state', isSpeaking: false });
                  }
                }
              }

              // Mede o volume de áudio do sistema caso compartilhado
              let screenAvg = 0;
              if (screenAnalyserRef.current) {
                try {
                  const sBuffer = new Uint8Array(screenAnalyserRef.current.frequencyBinCount);
                  screenAnalyserRef.current.getByteFrequencyData(sBuffer);
                  let sSum = 0;
                  for (let i = 0; i < sBuffer.length; i++) sSum += sBuffer[i];
                  screenAvg = sSum / sBuffer.length;
                } catch {}
              }

              const micLevel = isMicMutedRef.current ? 0 : Math.min(100, Math.round((micAvg / 85) * 100));
              const screenLevel = Math.min(100, Math.round((screenAvg / 85) * 100));
              setAudioLevels({ mic: micLevel, screen: screenLevel });
            }, 100);
          }
        } catch (audioErr) {
          console.warn('Web Audio VAD initialization warning:', audioErr);
        }
      } catch (err) {
        console.warn('Microphone permission denied or unavailable:', err);
        setIsMicMuted(true);
        isMicMutedRef.current = true;
      }
    }

    if (roomCode) {
      initMicrophone();
    }

    return () => {
      isCancelled = true;
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (localMicRef.current) {
        localMicRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [roomCode, addTrackToAllPeers, sendWs]);

  // Connect WebSocket & Join Room (com reconexão automática)
  useEffect(() => {
    if (!roomCode) return;

    let disposed = false;
    let reconnectTimer = null;
    let keepAliveTimer = null;
    let attempts = 0;
    let ws = null;

    function resetPeers() {
      Array.from(peersRef.current.keys()).forEach((peerId) => closePeer(peerId));
      setRemoteStreams({});
      setPeerSpeakingMap({});
      setPeerMicMutedMap({});
    }

    async function handleMessage(msg) {
      switch (msg.type) {
        case 'joined-room': {
          localSocketIdRef.current = msg.socketId;
          attempts = 0;

          setParticipants([
            {
              socketId: msg.socketId,
              name: displayNameRef.current || 'Anônimo',
              identity: msg.socketId,
              isLocal: true
            },
            ...msg.peers.map((p) => ({ ...p, isLocal: false }))
          ]);

          // Quem entra inicia a conexão com todos que já estão na sala
          msg.peers.forEach((peer) => {
            getOrCreatePeer(peer.socketId, { initiator: true });
          });
          break;
        }

        case 'peer-joined': {
          playJoinSound();
          setParticipants((prev) => {
            if (prev.some((p) => p.socketId === msg.peer.socketId)) return prev;
            return [...prev, { ...msg.peer, isLocal: false }];
          });

          // Announce in chat
          setChatMessages((prev) => [
            ...prev,
            {
              id: `sys_join_${Date.now()}_${msg.peer.socketId}`,
              kind: 'system',
              text: `${msg.peer.name || 'Alguém'} entrou na sala`,
              timestamp: Date.now()
            }
          ]);
          break;
        }

        case 'peer-left': {
          playLeaveSound();
          setParticipants((prev) => prev.filter((p) => p.socketId !== msg.socketId));
          closePeer(msg.socketId);

          setPeerSpeakingMap((prev) => {
            const updated = { ...prev };
            delete updated[msg.socketId];
            return updated;
          });

          setPeerMicMutedMap((prev) => {
            const updated = { ...prev };
            delete updated[msg.socketId];
            return updated;
          });

          // Announce in chat
          const leftName = msg.participant?.name || 'Alguém';
          setChatMessages((prev) => [
            ...prev,
            {
              id: `sys_leave_${Date.now()}_${msg.socketId}`,
              kind: 'system',
              text: `${leftName} saiu da sala`,
              timestamp: Date.now()
            }
          ]);
          break;
        }

        case 'peer-name-updated': {
          setParticipants((prev) =>
            prev.map((p) => (p.socketId === msg.socketId ? { ...p, name: msg.name } : p))
          );
          break;
        }

        case 'speaking-state': {
          setPeerSpeakingMap((prev) => ({
            ...prev,
            [msg.senderId]: !!msg.isSpeaking
          }));
          break;
        }

        case 'mic-state': {
          setPeerMicMutedMap((prev) => ({
            ...prev,
            [msg.senderId]: !!msg.isMicMuted
          }));
          break;
        }

        case 'reaction': {
          const reactionItem = {
            id: msg.id || `react_${Date.now()}_${Math.random()}`,
            emoji: msg.emoji,
            senderName: msg.senderName,
            offsetX: (Math.random() - 0.5) * 70
          };
          setActiveReactions((prev) => [...prev, reactionItem]);

          // Auto-remove after animation completes
          setTimeout(() => {
            setActiveReactions((prev) => prev.filter((r) => r.id !== reactionItem.id));
          }, 3200);
          break;
        }

        case 'offer': {
          await handleRemoteDescription(msg.senderId, msg.offer, msg.mediaMap);
          break;
        }

        case 'answer': {
          await handleRemoteDescription(msg.senderId, msg.answer, msg.mediaMap);
          break;
        }

        case 'ice-candidate': {
          await handleRemoteCandidate(msg.senderId, msg.candidate);
          break;
        }

        case 'chat-message': {
          setChatMessages((prev) => [
            ...prev,
            {
              id: msg.id,
              kind: 'chat',
              from: msg.senderName,
              message: msg.message,
              timestamp: msg.timestamp,
              isLocal: msg.senderId === localSocketIdRef.current
            }
          ]);
          break;
        }

        case 'error': {
          console.error('[WebRTC Server Error]', msg.message);
          if (msg.code === 'UNAUTHORIZED') {
            disposed = true;
            setConnectionStatus('unauthorized');
          }
          break;
        }
      }
    }

    async function connect() {
      // Credenciais TURN são renovadas a cada (re)conexão
      iceServersRef.current = await loadIceServers({ refresh: true });
      if (disposed) return;

      ws = new WebSocket(getWsUrl());
      wsRef.current = ws;
      // Mensagens de sinalização precisam ser processadas em ordem (offer antes dos candidates)
      let messageChain = Promise.resolve();

      ws.onopen = () => {
        setConnectionStatus('connected');
        const token = localStorage.getItem('antonio_token') || '';
        let savedUser = {};
        try {
          savedUser = JSON.parse(localStorage.getItem('antonio_user') || '{}');
        } catch {}

        ws.send(
          JSON.stringify({
            type: 'join-room',
            roomCode,
            name: displayNameRef.current || savedUser.globalName || savedUser.username || 'Membro',
            avatar: savedUser.avatarUrl || '',
            token,
            identity: savedUser.id || `user_${Math.random().toString(36).slice(2, 8)}`
          })
        );

        // Evita que proxies (Render/Discord) derrubem o WebSocket ocioso
        clearInterval(keepAliveTimer);
        keepAliveTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 25000);
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (err) {
          console.error('WebSocket message parsing error:', err);
          return;
        }
        messageChain = messageChain
          .then(() => handleMessage(msg))
          .catch((err) => console.error(`Error handling "${msg.type}":`, err));
      };

      ws.onclose = () => {
        clearInterval(keepAliveTimer);
        if (wsRef.current === ws) wsRef.current = null;
        if (disposed) return;

        // O servidor gera um novo socketId a cada conexão, então as conexões P2P antigas são descartadas
        resetPeers();
        setParticipants((prev) => prev.filter((p) => p.isLocal));
        setConnectionStatus('reconnecting');
        const delay = Math.min(10000, 1000 * 2 ** attempts);
        attempts++;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        console.warn('WebSocket error, aguardando reconexão...');
      };
    }

    setConnectionStatus('connecting');
    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      clearInterval(keepAliveTimer);
      // Cleanup connections
      if (localScreenRef.current) {
        localScreenRef.current.getTracks().forEach((t) => t.stop());
      }
      if (localCameraRef.current) {
        localCameraRef.current.getTracks().forEach((t) => t.stop());
      }
      if (localMicRef.current) {
        localMicRef.current.getTracks().forEach((t) => t.stop());
      }
      resetPeers();
      if (ws) ws.close();
    };
  }, [roomCode, getOrCreatePeer, closePeer, handleRemoteDescription, handleRemoteCandidate]);

  // Periodically collect WebRTC connection statistics (RTT / Ping and FPS)
  useEffect(() => {
    if (!roomCode) return;

    const statsInterval = setInterval(async () => {
      if (peersRef.current.size === 0) {
        setNetworkStats({
          ping: null,
          fps: null,
          bitrateKbps: null,
          packetLossPct: 0,
          resolution: null,
          codec: null,
          connectionType: 'direct',
          jitter: null,
          quality: 'good'
        });
        return;
      }

      let bestRtt = null;
      let latestFps = null;
      let currentBytes = 0;
      let currentPacketsLost = 0;
      let currentPacketsTotal = 0;
      let currentResolution = null;
      let detectedCodec = null;
      let connectionType = 'direct';
      let latestJitter = null;

      const now = Date.now();

      for (const { pc } of peersRef.current.values()) {
        if (pc.connectionState !== 'connected') continue;
        try {
          const stats = await pc.getStats();
          const candidateMap = new Map();
          const codecMap = new Map();

          stats.forEach((report) => {
            if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
              candidateMap.set(report.id, report);
            } else if (report.type === 'codec') {
              codecMap.set(report.id, report);
            }
          });

          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
              const rtt = typeof report.currentRoundTripTime === 'number'
                ? report.currentRoundTripTime * 1000
                : null;
              if (rtt !== null && (bestRtt === null || rtt < bestRtt)) {
                bestRtt = Math.round(rtt);
              }

              const localCandidate = candidateMap.get(report.localCandidateId);
              const remoteCandidate = candidateMap.get(report.remoteCandidateId);
              if (
                (localCandidate && localCandidate.candidateType === 'relay') ||
                (remoteCandidate && remoteCandidate.candidateType === 'relay')
              ) {
                connectionType = 'relay';
              }
            }

            if (report.type === 'inbound-rtp' || report.type === 'outbound-rtp') {
              if (typeof report.bytesReceived === 'number') currentBytes += report.bytesReceived;
              if (typeof report.bytesSent === 'number') currentBytes += report.bytesSent;
              if (typeof report.packetsLost === 'number') currentPacketsLost += report.packetsLost;
              if (typeof report.packetsReceived === 'number') currentPacketsTotal += report.packetsReceived;
              if (typeof report.packetsSent === 'number') currentPacketsTotal += report.packetsSent;

              if (report.kind === 'video') {
                if (typeof report.framesPerSecond === 'number' && report.framesPerSecond > 0) {
                  latestFps = Math.round(report.framesPerSecond);
                }
                if (report.frameWidth && report.frameHeight) {
                  currentResolution = `${report.frameWidth}×${report.frameHeight}`;
                }
                if (report.codecId && codecMap.has(report.codecId)) {
                  const c = codecMap.get(report.codecId);
                  if (c.mimeType) {
                    detectedCodec = c.mimeType.replace(/^video\//i, '').toUpperCase();
                  }
                }
              }

              if (typeof report.jitter === 'number') {
                latestJitter = Math.round(report.jitter * 1000);
              }
            }
          });
        } catch {}
      }

      setNetworkStats((prev) => {
        const prevData = prevStatsRef.current;
        const deltaTime = (now - prevData.timestamp) / 1000;
        let bitrateKbps = prev.bitrateKbps;

        if (deltaTime > 0 && currentBytes >= prevData.bytesTotal && prevData.bytesTotal > 0) {
          const deltaBits = (currentBytes - prevData.bytesTotal) * 8;
          bitrateKbps = Math.round(deltaBits / (deltaTime * 1000));
        }

        let packetLossPct = prev.packetLossPct;
        const deltaPackets = currentPacketsTotal - prevData.packetsTotal;
        const deltaLost = currentPacketsLost - prevData.packetsLost;
        if (deltaPackets > 0 && deltaLost >= 0) {
          packetLossPct = Math.min(100, Math.round((deltaLost / (deltaPackets + deltaLost)) * 1000) / 10);
        }

        prevStatsRef.current = {
          timestamp: now,
          bytesTotal: currentBytes,
          packetsLost: currentPacketsLost,
          packetsTotal: currentPacketsTotal
        };

        const ping = bestRtt !== null ? bestRtt : prev.ping;
        const fps = latestFps !== null ? latestFps : prev.fps;
        let quality = 'good';
        if (ping !== null && ping > 150) quality = 'poor';
        else if (ping !== null && ping > 80) quality = 'fair';

        return {
          ping,
          fps,
          bitrateKbps,
          packetLossPct,
          resolution: currentResolution || prev.resolution,
          codec: detectedCodec || prev.codec,
          connectionType,
          jitter: latestJitter !== null ? latestJitter : prev.jitter,
          quality
        };
      });
    }, 2000);

    return () => clearInterval(statsInterval);
  }, [roomCode]);

  // Toggle Microphone Mute
  const toggleMicrophone = useCallback(() => {
    if (localMicRef.current) {
      const audioTrack = localMicRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMuted = !isMicMutedRef.current;
        audioTrack.enabled = !newMuted;
        isMicMutedRef.current = newMuted;
        setIsMicMuted(newMuted);
        playMuteSound(newMuted);

        if (newMuted) {
          setIsSpeaking(false);
          sendWs({ type: 'speaking-state', isSpeaking: false });
        }

        sendWs({
          type: 'mic-state',
          isMicMuted: newMuted
        });
      }
    }
  }, [sendWs]);

  // Stop Screen Sharing
  const stopScreenShare = useCallback(() => {
    screenSettingsRef.current = null;
    screenAnalyserRef.current = null;
    setAudioLevels((prev) => ({ ...prev, screen: 0 }));

    if (localScreenRef.current) {
      const stream = localScreenRef.current;
      // Limpa a ref antes do removeTrack para que a renegociação já envie o mediaMap sem a tela
      localScreenRef.current = null;
      setLocalScreenStream(null);
      stream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
        removeTrackFromAllPeers(track);
      });
    }
  }, [removeTrackFromAllPeers]);

  // Start Screen Sharing with specific constraints
  const startScreenShare = useCallback(async (settings = {}) => {
    try {
      const constraints = {
        video: {
          width: { ideal: settings.width || 1920 },
          height: { ideal: settings.height || 1080 },
          frameRate: { ideal: settings.frameRate || 60, max: settings.frameRate || 60 }
        },
        audio: settings.audio ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } : false,
        // Chrome: permite capturar o áudio do sistema ao compartilhar a tela inteira
        ...(settings.audio ? { systemAudio: 'include' } : {}),
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include'
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      // Trocar de tela sem parar antes deixaria senders órfãos nas conexões
      if (localScreenRef.current) stopScreenShare();

      screenSettingsRef.current = settings;
      setLocalScreenStream(stream);
      localScreenRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const hint = settings.contentHint || (settings.mode === 'detail' ? 'detail' : 'motion');
        try {
          videoTrack.contentHint = hint;
        } catch {}

        videoTrack.onended = () => {
          if (localScreenRef.current === stream) stopScreenShare();
        };
      }

      // Se houver áudio do sistema, configurar fidelidade de música estéreo e VU meter
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        try {
          audioTrack.contentHint = 'music';
        } catch {}

        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            if (!audioContextRef.current) {
              audioContextRef.current = new AudioCtx();
            }
            const ctx = audioContextRef.current;
            const screenSource = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
            const screenAnalyser = ctx.createAnalyser();
            screenAnalyser.fftSize = 256;
            screenSource.connect(screenAnalyser);
            screenAnalyserRef.current = screenAnalyser;
          }
        } catch (audioErr) {
          console.warn('Screen audio analyser setup warning:', audioErr);
        }
      }

      // Add tracks to all peer connections (a renegociação dispara sozinha via onnegotiationneeded)
      stream.getTracks().forEach((track) => {
        addTrackToAllPeers(track, stream);
      });
      peersRef.current.forEach(({ pc }) => tuneScreenSenders(pc));

      return stream;
    } catch (err) {
      console.warn('Screen share cancelled or failed:', err);
      throw err;
    }
  }, [addTrackToAllPeers, stopScreenShare, tuneScreenSenders]);

  // Toggle Camera
  const toggleCamera = useCallback(async () => {
    if (localCameraRef.current) {
      // Turn off
      const stream = localCameraRef.current;
      localCameraRef.current = null;
      setLocalCameraStream(null);
      stream.getTracks().forEach((track) => {
        track.stop();
        removeTrackFromAllPeers(track);
      });
      return false;
    } else {
      // Turn on
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false
        });

        setLocalCameraStream(stream);
        localCameraRef.current = stream;

        stream.getTracks().forEach((track) => {
          addTrackToAllPeers(track, stream);
        });
        return true;
      } catch (err) {
        console.error('Camera access denied or unavailable:', err);
        return false;
      }
    }
  }, [addTrackToAllPeers, removeTrackFromAllPeers]);

  // Send Chat Message
  const sendChatMessage = useCallback((text) => {
    if (!text || !text.trim()) return;
    sendWs({
      type: 'chat-message',
      message: text.trim(),
      senderName: displayNameRef.current || 'Anônimo',
      timestamp: Date.now()
    });
  }, [sendWs]);

  // Update Display Name
  const updateDisplayName = useCallback((newName) => {
    displayNameRef.current = newName;
    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, name: newName } : p))
    );
    sendWs({
      type: 'update-name',
      name: newName
    });
  }, [sendWs]);

  // Send Real-time Emoji Reaction
  const sendReaction = useCallback((emoji) => {
    if (!emoji) return;
    sendWs({
      type: 'reaction',
      emoji,
      senderName: displayNameRef.current || 'Anônimo'
    });
  }, [sendWs]);

  return {
    connectionStatus,
    participants,
    chatMessages,
    localScreenStream,
    localCameraStream,
    localMicStream,
    isMicMuted,
    isSpeaking,
    peerSpeakingMap,
    peerMicMutedMap,
    activeReactions,
    remoteStreams,
    networkStats,
    audioLevels,
    isScreenSharing: !!localScreenStream,
    isCameraOn: !!localCameraStream,
    toggleMicrophone,
    startScreenShare,
    stopScreenShare,
    toggleCamera,
    sendChatMessage,
    sendReaction,
    updateDisplayName
  };
}
