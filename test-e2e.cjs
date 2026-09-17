const http = require('http');
const WebSocket = require('ws');

async function runTests() {
  console.log('--- TEST 1: Create Open Room ---');
  const openRoom = await fetchJson('http://localhost:3001/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Antonio Host' })
  });
  console.log('Created room:', openRoom);
  if (!openRoom.code || openRoom.code.length !== 6) throw new Error('Invalid room code');

  console.log('\n--- TEST 2: Join Open Room ---');
  const joinOpen = await fetchJson(`http://localhost:3001/api/rooms/${openRoom.code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Guest 1' })
  });
  console.log('Join open room result:', joinOpen);
  if (!joinOpen.ok) throw new Error('Failed to join open room');

  console.log('\n--- TEST 3: Create Protected Room & Verify Password Auth ---');
  const protRoom = await fetchJson('http://localhost:3001/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Antonio Host', password: 'antonio-secret' })
  });
  console.log('Created protected room:', protRoom);

  // Try join without password
  const joinNoPassRes = await fetch(`http://localhost:3001/api/rooms/${protRoom.code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauthorized Guest' })
  });
  console.log('Join without password HTTP Status:', joinNoPassRes.status);
  if (joinNoPassRes.status !== 401) throw new Error('Expected 401 status for missing password');

  // Try join with correct password
  const joinWithPass = await fetchJson(`http://localhost:3001/api/rooms/${protRoom.code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Authorized Guest', password: 'antonio-secret' })
  });
  console.log('Join with password result:', joinWithPass);
  if (!joinWithPass.ok) throw new Error('Failed to join with valid password');

  console.log('\n--- TEST 4: WebSocket Real-time Signaling & Events ---');
  await new Promise((resolve, reject) => {
    const ws1 = new WebSocket('ws://localhost:3001/ws');
    const ws2 = new WebSocket('ws://localhost:3001/ws');
    let ws1Joined = false;
    let ws2Joined = false;
    let reactionReceived = false;
    let speakingReceived = false;

    ws1.on('open', () => {
      ws1.send(JSON.stringify({
        type: 'join-room',
        roomCode: openRoom.code,
        displayName: 'Host Antonio'
      }));
    });

    ws2.on('open', () => {
      ws2.send(JSON.stringify({
        type: 'join-room',
        roomCode: openRoom.code,
        displayName: 'Peer 2'
      }));
    });

    ws2.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'reaction' && msg.emoji === '🔥') {
        console.log('Peer 2 received reaction:', msg);
        reactionReceived = true;
      }
      if (msg.type === 'speaking-state' && msg.isSpeaking === true) {
        console.log('Peer 2 received speaking-state:', msg);
        speakingReceived = true;
      }
      if (reactionReceived && speakingReceived) {
        ws1.close();
        ws2.close();
        resolve();
      }
    });

    ws1.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-joined') {
        ws1Joined = true;
      }
      if (msg.type === 'peer-joined') {
        // ws2 joined, let ws1 send speaking state and floating reaction
        setTimeout(() => {
          ws1.send(JSON.stringify({
            type: 'speaking-state',
            isSpeaking: true
          }));
          ws1.send(JSON.stringify({
            type: 'reaction',
            emoji: '🔥'
          }));
        }, 100);
      }
    });

    setTimeout(() => {
      if (!reactionReceived || !speakingReceived) {
        ws1.close();
        ws2.close();
        reject(new Error(`Timeout waiting for WebSocket events (reaction: ${reactionReceived}, speaking: ${speakingReceived})`));
      }
    }, 4000);
  });

  console.log('\n>>> ALL REAL-TIME & WEBSOCKET TESTS PASSED! <<<');
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
