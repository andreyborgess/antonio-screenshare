// server/rooms.js
import crypto from 'crypto';

const rooms = new Map();

// Helper to generate a 6-character uppercase room code
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid O, 0, I, 1 for readability
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }
  return code;
}

export function createRoom(password = null) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const room = {
    code,
    password: password ? String(password).trim() : null,
    createdAt: Date.now(),
    participants: new Map(), // socketId -> { id, name, isScreenSharing, isCameraOn }
    cleanupTimer: null
  };

  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  if (!code) return null;
  return rooms.get(code.toUpperCase()) || null;
}

export function verifyRoomPassword(code, password) {
  const room = getRoom(code);
  if (!room) return { ok: false, reason: 'not_found' };
  if (!room.password) return { ok: true, room };
  if (room.password === String(password || '').trim()) {
    return { ok: true, room };
  }
  return { ok: false, reason: 'invalid_password' };
}

export function addParticipant(code, socketId, participantData) {
  const room = getRoom(code);
  if (!room) return null;

  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }

  room.participants.set(socketId, {
    socketId,
    identity: participantData.identity || socketId,
    name: participantData.name || 'Anônimo',
    joinedAt: Date.now()
  });

  return room;
}

export function removeParticipant(socketId) {
  for (const [code, room] of rooms.entries()) {
    if (room.participants.has(socketId)) {
      const removed = room.participants.get(socketId);
      room.participants.delete(socketId);

      // If room is empty, schedule cleanup after 15 minutes
      if (room.participants.size === 0) {
        room.cleanupTimer = setTimeout(() => {
          rooms.delete(code);
        }, 15 * 60 * 1000);
      }

      return { room, participant: removed };
    }
  }
  return null;
}
