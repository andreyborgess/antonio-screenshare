// server/index.js
import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createRoom, getRoom, verifyRoomPassword } from './rooms.js';
import { setupSignaling } from './signaling.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API: Health / Ping (Used for preventing/detecting Render cold starts)
app.get(['/api/health', '/health'], (req, res) => {
  return res.status(200).json({ ok: true, status: 'awake', timestamp: Date.now() });
});

// API: Create a room (or get/create with custom code)
app.post(['/api/rooms', '/rooms'], (req, res) => {
  const { password, customCode } = req.body || {};
  try {
    const room = createRoom(password, customCode);
    console.log(`[ROOM CREATED/SYNCED] Code: ${room.code}, Protected: ${!!room.password}`);
    return res.status(200).json({ code: room.code });
  } catch (err) {
    console.error('Error creating room:', err);
    return res.status(500).json({ error: 'Erro ao criar sala.' });
  }
});

// API: Check room & verify password for joining
app.post(['/api/rooms/:code/join', '/rooms/:code/join'], (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const { password, autoCreate } = req.body || {};

  let room = getRoom(code);
  if (!room && autoCreate) {
    room = createRoom(null, code);
  }

  if (!room) {
    return res.status(404).json({ error: 'Sala não encontrada.' });
  }

  // If room has password, verify it
  if (room.password) {
    if (!password) {
      return res.status(401).json({ error: 'Senha necessária.', needPassword: true });
    }
    const check = verifyRoomPassword(code, password);
    if (!check.ok) {
      return res.status(401).json({ error: 'Senha incorreta.', needPassword: true });
    }
  }

  return res.status(200).json({
    ok: true,
    code: room.code,
    hasPassword: !!room.password
  });
});

// API: Get room basic status
app.get(['/api/rooms/:code', '/rooms/:code'], (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const room = getRoom(code);
  if (!room) {
    return res.status(404).json({ error: 'Sala não encontrada.' });
  }
  return res.status(200).json({
    code: room.code,
    hasPassword: !!room.password,
    participantsCount: room.participants.size
  });
});

// Serve static frontend build if dist exists
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/rooms') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = http.createServer(app);
// Accept WebSocket connection on any path (/ws, /.proxy/ws, /, etc.)
const wss = new WebSocketServer({ server });

setupSignaling(wss);

server.listen(PORT, () => {
  console.log(`🚀 Antonio Screenshare backend running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket signaling active at ws://localhost:${PORT}/ws`);
});

