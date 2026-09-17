// server/signaling.js
import { getRoom, addParticipant, removeParticipant } from './rooms.js';

export function setupSignaling(wss) {
  // Store socket mapping: ws -> socketId
  const socketMap = new Map();
  let idCounter = 1;

  wss.on('connection', (ws) => {
    const socketId = `peer_${Date.now().toString(36)}_${idCounter++}`;
    socketMap.set(ws, socketId);
    let currentRoomCode = null;

    function send(data) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      }
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'join-room': {
            const { roomCode, name, identity } = msg;
            const room = getRoom(roomCode);
            if (!room) {
              send({ type: 'error', message: 'Sala não encontrada.' });
              return;
            }

            currentRoomCode = room.code;
            addParticipant(room.code, socketId, { name, identity });

            // Prepare list of existing participants for this new peer
            const existingPeers = [];
            for (const [sId, p] of room.participants.entries()) {
              if (sId !== socketId) {
                existingPeers.push(p);
              }
            }

            // Send confirmation and current peers to the newly joined peer
            send({
              type: 'joined-room',
              socketId,
              peers: existingPeers,
              roomCode: room.code
            });

            // Notify everyone else in this room that a new peer joined
            broadcastToRoom(wss, socketMap, room.code, socketId, {
              type: 'peer-joined',
              peer: { socketId, name, identity }
            });
            break;
          }

          // Relay WebRTC Offer
          case 'offer': {
            const { targetId, offer, streamType } = msg;
            sendToSocket(wss, socketMap, targetId, {
              type: 'offer',
              senderId: socketId,
              offer,
              streamType
            });
            break;
          }

          // Relay WebRTC Answer
          case 'answer': {
            const { targetId, answer, streamType } = msg;
            sendToSocket(wss, socketMap, targetId, {
              type: 'answer',
              senderId: socketId,
              answer,
              streamType
            });
            break;
          }

          // Relay ICE candidate
          case 'ice-candidate': {
            const { targetId, candidate, streamType } = msg;
            sendToSocket(wss, socketMap, targetId, {
              type: 'ice-candidate',
              senderId: socketId,
              candidate,
              streamType
            });
            break;
          }

          // Real-time Chat message
          case 'chat-message': {
            if (!currentRoomCode) return;
            const { message, senderName, timestamp } = msg;
            const chatPayload = {
              type: 'chat-message',
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              senderId: socketId,
              senderName: senderName || 'Anônimo',
              message,
              timestamp: timestamp || Date.now()
            };

            // Broadcast to everyone in the room (including sender)
            broadcastToRoom(wss, socketMap, currentRoomCode, null, chatPayload);
            break;
          }

          // Update participant name in real time
          case 'update-name': {
            if (!currentRoomCode) return;
            const { name } = msg;
            const room = getRoom(currentRoomCode);
            if (room && room.participants.has(socketId)) {
              const p = room.participants.get(socketId);
              p.name = name;
              broadcastToRoom(wss, socketMap, currentRoomCode, null, {
                type: 'peer-name-updated',
                socketId,
                name
              });
            }
            break;
          }

          // Track state updates (e.g. screen sharing started/stopped, camera toggled)
          case 'track-state': {
            if (!currentRoomCode) return;
            broadcastToRoom(wss, socketMap, currentRoomCode, socketId, {
              type: 'track-state',
              senderId: socketId,
              isScreenSharing: msg.isScreenSharing,
              isCameraOn: msg.isCameraOn,
              isMicMuted: msg.isMicMuted,
              isSpeaking: msg.isSpeaking
            });
            break;
          }

          // Real-time voice activity detection state (speaking / silent)
          case 'speaking-state': {
            if (!currentRoomCode) return;
            broadcastToRoom(wss, socketMap, currentRoomCode, socketId, {
              type: 'speaking-state',
              senderId: socketId,
              isSpeaking: !!msg.isSpeaking
            });
            break;
          }

          // Microphone muted / unmuted toggle state
          case 'mic-state': {
            if (!currentRoomCode) return;
            broadcastToRoom(wss, socketMap, currentRoomCode, socketId, {
              type: 'mic-state',
              senderId: socketId,
              isMicMuted: !!msg.isMicMuted
            });
            break;
          }

          // Real-time floating emoji reactions
          case 'reaction': {
            if (!currentRoomCode) return;
            broadcastToRoom(wss, socketMap, currentRoomCode, null, {
              type: 'reaction',
              id: `react_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              emoji: msg.emoji,
              senderId: socketId,
              senderName: msg.senderName || 'Anônimo',
              timestamp: Date.now()
            });
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      socketMap.delete(ws);
      const result = removeParticipant(socketId);
      if (result && result.room) {
        broadcastToRoom(wss, socketMap, result.room.code, socketId, {
          type: 'peer-left',
          socketId,
          participant: result.participant
        });
      }
    });
  });
}

function sendToSocket(wss, socketMap, targetSocketId, payload) {
  for (const [ws, sId] of socketMap.entries()) {
    if (sId === targetSocketId && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
      break;
    }
  }
}

function broadcastToRoom(wss, socketMap, roomCode, excludeSocketId, payload) {
  const room = getRoom(roomCode);
  if (!room) return;

  for (const [ws, sId] of socketMap.entries()) {
    if (room.participants.has(sId) && (!excludeSocketId || sId !== excludeSocketId)) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    }
  }
}
