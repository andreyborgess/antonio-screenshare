import { useState, useEffect, useRef, useCallback } from 'react';
import { playMuteSound, playJoinSound, playLeaveSound } from '../utils/sounds';

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

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

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

    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }

    params.encodings[0].maxBitrate = maxBitrate;
    params.encodings[0].maxFramerate = maxFramerate;
    params.encodings[0].priority = 'high';
    params.encodings[0].networkPriority = 'high';

    await sender.setParameters(params);
  } catch (err) {
    console.warn('Unable to apply video sender parameters:', err);
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
  const [networkStats, setNetworkStats] = useState({ ping: null, fps: null, quality: 'good' });
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
  const peerConnectionsRef = useRef(new Map()); // peerSocketId -> RTCPeerConnection
  const candidateQueueRef = useRef(new Map()); // peerSocketId -> RTCIceCandidate[]
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

  // Update track for all peer connections
  const addTrackToAllPeers = useCallback((track, stream) => {
    peerConnectionsRef.current.forEach((pc) => {
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
    peerConnectionsRef.current.forEach((pc) => {
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

  // Initialize or retrieve RTCPeerConnection
  const getOrCreatePeerConnection = useCallback((targetId, isInitiator = false) => {
    if (peerConnectionsRef.current.has(targetId)) {
      return peerConnectionsRef.current.get(targetId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(targetId, pc);

    // Add existing local tracks to the new peer connection
    if (localMicRef.current) {
      localMicRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localMicRef.current);
      });
    }
    if (localScreenRef.current) {
      localScreenRef.current.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localScreenRef.current);
        if (track.kind === 'video' && screenSettingsRef.current) {
          applySenderParameters(sender, track, screenSettingsRef.current);
        }
      });
    }
    if (localCameraRef.current) {
      localCameraRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localCameraRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWs({
          type: 'ice-candidate',
          targetId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const track = event.track;

      setRemoteStreams((prev) => {
        const peerData = prev[targetId] || { name: 'Participante' };

        if (track.kind === 'audio') {
          // Play remote audio automatically
          return {
            ...prev,
            [targetId]: {
              ...peerData,
              audioStream: remoteStream
            }
          };
        }

        // If track is video, check if it's likely a screenshare or camera
        const isScreen = track.kind === 'video' && !peerData.cameraStream;
        return {
          ...prev,
          [targetId]: {
            ...peerData,
            screenStream: isScreen ? remoteStream : peerData.screenStream,
            cameraStream: !isScreen && track.kind === 'video' ? remoteStream : peerData.cameraStream
          }
        };
      });
    };

    pc.onnegotiationneeded = async () => {
      if (!isInitiator) return;
      try {
        preferH264Codec(pc);
        const offer = await pc.createOffer();
        if (offer.sdp) {
          offer.sdp = enrichSdpWithStereoOpus(offer.sdp);
        }
        await pc.setLocalDescription(offer);
        sendWs({
          type: 'offer',
          targetId,
          offer
        });
      } catch (err) {
        console.error('Negotiation error:', err);
      }
    };

    return pc;
  }, [sendWs]);

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

  // Connect WebSocket & Join Room
  useEffect(() => {
    if (!roomCode) return;

    const envBackend = import.meta.env.VITE_BACKEND_URL;
    let wsUrl;
    if (envBackend) {
      const wsProto = envBackend.startsWith('https') ? 'wss:' : 'ws:';
      const cleanHost = envBackend.replace(/^https?:\/\//, '').replace(/\/$/, '');
      wsUrl = `${wsProto}//${cleanHost}/ws`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      ws.send(
        JSON.stringify({
          type: 'join-room',
          roomCode,
          name: displayNameRef.current || 'Anônimo',
          identity: `user_${Math.random().toString(36).slice(2, 8)}`
        })
      );
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'joined-room': {
            localSocketIdRef.current = msg.socketId;

            const currentParticipants = [
              {
                socketId: msg.socketId,
                name: displayNameRef.current || 'Anônimo',
                identity: msg.socketId,
                isLocal: true
              },
              ...msg.peers.map((p) => ({ ...p, isLocal: false }))
            ];
            setParticipants(currentParticipants);

            // Initiate WebRTC connection to all existing peers
            msg.peers.forEach((peer) => {
              const pc = getOrCreatePeerConnection(peer.socketId, true);
              preferH264Codec(pc);
              pc.createOffer()
                .then((offer) => {
                  if (offer.sdp) offer.sdp = enrichSdpWithStereoOpus(offer.sdp);
                  return pc.setLocalDescription(offer);
                })
                .then(() => {
                  sendWs({
                    type: 'offer',
                    targetId: peer.socketId,
                    offer: pc.localDescription
                  });
                })
                .catch((e) => console.error('Error creating offer for peer:', e));
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

            // Close WebRTC connection
            if (peerConnectionsRef.current.has(msg.socketId)) {
              peerConnectionsRef.current.get(msg.socketId).close();
              peerConnectionsRef.current.delete(msg.socketId);
            }

            setRemoteStreams((prev) => {
              const updated = { ...prev };
              delete updated[msg.socketId];
              return updated;
            });

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
            const pc = getOrCreatePeerConnection(msg.senderId, false);
            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));

            // Process queued ICE candidates
            const queued = candidateQueueRef.current.get(msg.senderId) || [];
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            candidateQueueRef.current.delete(msg.senderId);

            preferH264Codec(pc);
            const answer = await pc.createAnswer();
            if (answer.sdp) {
              answer.sdp = enrichSdpWithStereoOpus(answer.sdp);
            }
            await pc.setLocalDescription(answer);

            sendWs({
              type: 'answer',
              targetId: msg.senderId,
              answer
            });
            break;
          }

          case 'answer': {
            const pc = peerConnectionsRef.current.get(msg.senderId);
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));

              const queued = candidateQueueRef.current.get(msg.senderId) || [];
              for (const cand of queued) {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
              candidateQueueRef.current.delete(msg.senderId);
            }
            break;
          }

          case 'ice-candidate': {
            const pc = peerConnectionsRef.current.get(msg.senderId);
            if (pc && pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } else {
              // Queue candidate until remote description is set
              const q = candidateQueueRef.current.get(msg.senderId) || [];
              q.push(msg.candidate);
              candidateQueueRef.current.set(msg.senderId, q);
            }
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
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    ws.onerror = () => {
      setConnectionStatus('error');
    };

    return () => {
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
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      ws.close();
    };
  }, [roomCode, getOrCreatePeerConnection, sendWs]);

  // Periodically collect WebRTC connection statistics (RTT / Ping and FPS)
  useEffect(() => {
    if (!roomCode) return;

    const statsInterval = setInterval(async () => {
      if (peerConnectionsRef.current.size === 0) {
        setNetworkStats({ ping: null, fps: null, quality: 'good' });
        return;
      }

      let bestRtt = null;
      let latestFps = null;

      for (const pc of peerConnectionsRef.current.values()) {
        if (pc.connectionState !== 'connected') continue;
        try {
          const stats = await pc.getStats();
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
              const rtt = typeof report.currentRoundTripTime === 'number'
                ? report.currentRoundTripTime * 1000
                : null;
              if (rtt !== null && (bestRtt === null || rtt < bestRtt)) {
                bestRtt = Math.round(rtt);
              }
            }
            if ((report.type === 'inbound-rtp' || report.type === 'outbound-rtp') && report.kind === 'video') {
              if (typeof report.framesPerSecond === 'number' && report.framesPerSecond > 0) {
                latestFps = Math.round(report.framesPerSecond);
              }
            }
          });
        } catch {}
      }

      setNetworkStats((prev) => {
        const ping = bestRtt !== null ? bestRtt : prev.ping;
        const fps = latestFps !== null ? latestFps : prev.fps;
        let quality = 'good';
        if (ping !== null && ping > 150) quality = 'poor';
        else if (ping !== null && ping > 80) quality = 'fair';
        return { ping, fps, quality };
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

  // Start Screen Sharing with specific constraints
  const startScreenShare = useCallback(async (settings = {}) => {
    try {
      screenSettingsRef.current = settings;

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
        } : false
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      setLocalScreenStream(stream);
      localScreenRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const hint = settings.contentHint || (settings.mode === 'detail' ? 'detail' : 'motion');
        try {
          videoTrack.contentHint = hint;
        } catch {}

        videoTrack.onended = () => {
          stopScreenShare();
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

      // Add tracks to all peer connections
      stream.getTracks().forEach((track) => {
        addTrackToAllPeers(track, stream);
      });

      // Apply sender optimization (FPS preservation & bitrate capping) to all active connections
      peerConnectionsRef.current.forEach(async (pc) => {
        try {
          const senders = pc.getSenders();
          if (videoTrack) {
            const vSender = senders.find((s) => s.track && s.track.id === videoTrack.id);
            if (vSender) {
              await applySenderParameters(vSender, videoTrack, settings);
            }
          }
          if (audioTrack) {
            const aSender = senders.find((s) => s.track && s.track.id === audioTrack.id);
            if (aSender) {
              const p = aSender.getParameters();
              if (p && p.encodings && p.encodings.length > 0) {
                p.encodings[0].maxBitrate = 196000;
                p.encodings[0].priority = 'high';
                aSender.setParameters(p);
              }
            }
          }
        } catch (e) {
          console.warn('Error configuring sender params for peer:', e);
        }
      });

      sendWs({
        type: 'track-state',
        isScreenSharing: true
      });

      return stream;
    } catch (err) {
      console.warn('Screen share cancelled or failed:', err);
      throw err;
    }
  }, [addTrackToAllPeers, sendWs]);

  // Stop Screen Sharing
  const stopScreenShare = useCallback(() => {
    screenSettingsRef.current = null;
    screenAnalyserRef.current = null;
    setAudioLevels((prev) => ({ ...prev, screen: 0 }));

    if (localScreenRef.current) {
      localScreenRef.current.getTracks().forEach((track) => {
        track.stop();
        removeTrackFromAllPeers(track);
      });
      localScreenRef.current = null;
      setLocalScreenStream(null);

      sendWs({
        type: 'track-state',
        isScreenSharing: false
      });
    }
  }, [removeTrackFromAllPeers, sendWs]);

  // Toggle Camera
  const toggleCamera = useCallback(async () => {
    if (localCameraRef.current) {
      // Turn off
      localCameraRef.current.getTracks().forEach((track) => {
        track.stop();
        removeTrackFromAllPeers(track);
      });
      localCameraRef.current = null;
      setLocalCameraStream(null);

      sendWs({
        type: 'track-state',
        isCameraOn: false
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

        sendWs({
          type: 'track-state',
          isCameraOn: true
        });
        return true;
      } catch (err) {
        console.error('Camera access denied or unavailable:', err);
        return false;
      }
    }
  }, [addTrackToAllPeers, removeTrackFromAllPeers, sendWs]);

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
