import { useState, useEffect, useRef, useCallback } from 'react';

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

export function useWebRTC({ roomCode, displayName }) {
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | connected | disconnected | error
  const [participants, setParticipants] = useState([]); // [{ socketId, name, identity, isLocal }]
  const [chatMessages, setChatMessages] = useState([]);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [localCameraStream, setLocalCameraStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: { screenStream, cameraStream, audioStream, name } }

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
        pc.addTrack(track, localScreenRef.current);
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
        const offer = await pc.createOffer();
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
              if (isMicMutedRef.current) {
                if (currentlySpeaking) {
                  currentlySpeaking = false;
                  setIsSpeaking(false);
                  sendWs({ type: 'speaking-state', isSpeaking: false });
                }
                return;
              }

              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
              }
              const average = sum / bufferLength;

              // Threshold for speech detection
              if (average > 18) {
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
              pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer))
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

            const answer = await pc.createAnswer();
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

  // Toggle Microphone Mute
  const toggleMicrophone = useCallback(() => {
    if (localMicRef.current) {
      const audioTrack = localMicRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMuted = !isMicMutedRef.current;
        audioTrack.enabled = !newMuted;
        isMicMutedRef.current = newMuted;
        setIsMicMuted(newMuted);

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
  const startScreenShare = useCallback(async (settings) => {
    try {
      const constraints = {
        video: {
          width: { ideal: settings.width },
          height: { ideal: settings.height },
          frameRate: { ideal: settings.frameRate, max: settings.frameRate }
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

      // When browser's native "Stop Sharing" is pressed
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      stream.getTracks().forEach((track) => {
        addTrackToAllPeers(track, stream);
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
