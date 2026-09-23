// Splatline — servidor da sala online.
// Serve o jogo (public/index.html) e repassa, via WebSocket, a posição de cada
// jogador (presence) e os eventos de tiro/eliminação entre todos na sala.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 8080;
const MAX_PEERS = Number(process.env.MAX_PEERS) || 24;
const MAX_PRESENCE_BYTES = 4096;
const MAX_EVENT_BYTES = 4096;
const TOPICS = new Set(['shot', 'out']);

const INDEX = path.join(__dirname, 'public', 'index.html');

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/' || url === '/index.html') {
    fs.readFile(INDEX, (err, buf) => {
      if (err) { res.writeHead(500); res.end('index.html não encontrado'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
  } else if (url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, players: peers.size }));
  } else {
    res.writeHead(404); res.end('não encontrado');
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
/** @type {Map<string, {ws: import('ws'), presence: object, tokens: number, last: number, alive: boolean}>} */
const peers = new Map();

function broadcast(msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const [id, p] of peers) if (id !== exceptId && p.ws.readyState === 1) p.ws.send(data);
}
const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

wss.on('connection', ws => {
  if (peers.size >= MAX_PEERS) { ws.send(JSON.stringify({ t: 'full' })); ws.close(1013, 'sala cheia'); return; }
  const id = crypto.randomBytes(6).toString('hex');
  const peer = { ws, presence: {}, tokens: 120, last: Date.now(), alive: true };
  peers.set(id, peer);
  ws.send(JSON.stringify({ t: 'welcome', me: id, peers: [...peers].filter(([pid]) => pid !== id).map(([pid, p]) => ({ peer: pid, presence: p.presence })) }));
  broadcast({ t: 'join', peer: id }, id);

  ws.on('pong', () => { peer.alive = true; });
  ws.on('message', raw => {
    // limite simples: ~60 mensagens/s por jogador, rajada de 120
    const now = Date.now();
    peer.tokens = Math.min(120, peer.tokens + (now - peer.last) * 0.06); peer.last = now;
    if (peer.tokens < 1) return;
    peer.tokens -= 1;

    let m; try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!isPlainObject(m)) return;
    if (m.t === 'presence' && isPlainObject(m.patch)) {
      const next = { ...peer.presence };
      for (const [k, v] of Object.entries(m.patch)) { if (v === null) delete next[k]; else next[k] = v; }
      if (Buffer.byteLength(JSON.stringify(next)) > MAX_PRESENCE_BYTES) return;
      peer.presence = next;
      broadcast({ t: 'presence', peer: id, presence: next }, id);
    } else if (m.t === 'event' && TOPICS.has(m.topic)) {
      if (Buffer.byteLength(JSON.stringify(m.data ?? null)) > MAX_EVENT_BYTES) return;
      broadcast({ t: 'event', topic: m.topic, data: m.data, peer: id }, id);
    }
  });
  ws.on('close', () => { peers.delete(id); broadcast({ t: 'leave', peer: id }); });
  ws.on('error', () => {});
});

// derruba conexões mortas
setInterval(() => {
  for (const [id, p] of peers) {
    if (!p.alive) { p.ws.terminate(); peers.delete(id); broadcast({ t: 'leave', peer: id }); continue; }
    p.alive = false; p.ws.ping();
  }
}, 15000);

server.listen(PORT, () => console.log(`Splatline rodando em http://localhost:${PORT}`));
