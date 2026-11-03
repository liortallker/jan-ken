/* Jan-Ken duel server: serves the game and runs online rooms over WebSocket.
   Picks are held on the server and only revealed to both players when the 5-second timer ends. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const wsLite = require('./ws-lite.js');
const Referee = require('./public/referee.js');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const FIGHTERS = ['hikari', 'kagero', 'tetsuo', 'hayato', 'shin', 'gonta', 'daigo', 'yuki'];
const ARENAS = ['temple', 'bamboo', 'torii', 'pagoda', 'dojo', 'zen', 'castle', 'snow'];

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

const rooms = new Map();

const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
function cleanProfile(p) {
  p = p || {};
  const face = typeof p.face === 'string' && p.face.startsWith('data:image/') && p.face.length < 120000 ? p.face : null;
  return { fighter: FIGHTERS.includes(p.fighter) ? p.fighter : 'hikari', face, purse: Number.isFinite(p.purse) ? Math.max(0, Math.floor(p.purse)) : null };
}
function newCode() {
  for (let i = 0; i < 200; i++) {
    const c = 'JK-' + String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(c)) return c;
  }
  return 'JK-' + String(Date.now() % 10000).padStart(4, '0');
}
function startMatch(room) {
  if (room.ref) room.ref.stop();
  room.rematch = new Set();
  const a = room.players.a, b = room.players.b;
  for (const side of ['a', 'b']) send(room.players[side].ws, { t: 'start', you: side, arena: room.arena, a: a.profile, b: b.profile });
  room.ref = new Referee((ev, data) => {
    for (const side of ['a', 'b']) send(room.players[side] && room.players[side].ws, { t: 'ev', ev, data });
  });
  setTimeout(() => room.ref && !room.ref.stopped && room.ref.start(), 400);
}
function leave(ws) {
  const room = rooms.get(ws.room);
  if (!room) return;
  const side = ws.side, other = room.players[side === 'a' ? 'b' : 'a'];
  if (room.ref && !room.ref.over) room.ref.forfeit(side);
  if (room.ref) room.ref.stop();
  if (other) { send(other.ws, { t: 'opponentLeft' }); other.ws.room = null; }
  rooms.delete(room.code);
  ws.room = null;
}

wsLite.attach(server, '/ws', (ws) => {
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    const room = rooms.get(ws.room);
    switch (m.t) {
      case 'create': {
        if (ws.room) leave(ws);
        const code = newCode();
        rooms.set(code, { code, arena: ARENAS.includes(m.arena) ? m.arena : 'temple', players: { a: { ws, profile: cleanProfile(m.profile) }, b: null }, ref: null, rematch: new Set(), created: Date.now() });
        ws.room = code; ws.side = 'a';
        send(ws, { t: 'created', code });
        break;
      }
      case 'check': {
        const r = rooms.get(String(m.code || '').toUpperCase());
        send(ws, { t: 'checked', code: m.code, ok: !!r && !r.players.b, reason: !r ? 'Room not found. Check the code with your rival.' : r.players.b ? 'That duel is already full.' : '' });
        break;
      }
      case 'join': {
        const r = rooms.get(String(m.code || '').toUpperCase());
        if (!r) return send(ws, { t: 'error', msg: 'Room not found. It may have been cancelled.' });
        if (r.players.b) return send(ws, { t: 'error', msg: 'That duel is already full.' });
        if (r.players.a.ws === ws) return send(ws, { t: 'error', msg: 'You cannot join your own duel.' });
        if (ws.room) leave(ws);
        r.players.b = { ws, profile: cleanProfile(m.profile) };
        ws.room = r.code; ws.side = 'b';
        startMatch(r);
        break;
      }
      case 'pick':
        if (room && room.ref) room.ref.pick(ws.side, m.choice);
        break;
      case 'rematch': {
        if (!room || !room.ref || !room.ref.over || !room.players.a || !room.players.b) return;
        room.players[ws.side].profile.purse = Number.isFinite(m.purse) ? m.purse : null;
        room.rematch.add(ws.side);
        if (room.rematch.size === 2) startMatch(room);
        else send(room.players[ws.side === 'a' ? 'b' : 'a'].ws, { t: 'rematchReq' });
        break;
      }
      case 'leave':
        leave(ws);
        break;
    }
  });
  ws.on('close', () => leave(ws));
});

// sweep abandoned rooms (no guest after 2 hours)
setInterval(() => {
  for (const [code, r] of rooms) if (!r.players.b && Date.now() - r.created > 2 * 3600 * 1000) rooms.delete(code);
}, 60 * 1000).unref();

server.listen(PORT, () => console.log(`Jan-Ken running at http://localhost:${PORT}`));
