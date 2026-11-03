/* Jan-Ken game controller: screens, wallet, unlock progression, CPU practice, online duels,
   and anime-style combat presentation (anticipation, hit-stop, camera punch, speed lines, smears). */
(function () {
  const JK = window.JK;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const rnow = () => performance.now();
  let GC = 0; // game clock (slows during hit-stop / slow motion)
  const now = () => GC;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const easeBack = (k) => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  const ENTRY = 100, POOL = 200, START_PURSE = 400;
  const HAND = { rock: 'fist', paper: 'palm', scissors: 'spear' };

  /* ---------------------------------------------------------------- storage */
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); if (v !== null) return JSON.parse(v); } catch (e) {} return k in mem ? mem[k] : d; },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const Wallet = {
    get() { const v = store.get('jk.purse', START_PURSE); return Number.isFinite(v) ? v : START_PURSE; },
    set(v) { store.set('jk.purse', v); refreshLobby(); },
  };
  const Progress = {
    get() { return Object.assign({ duels: 0, rounds: 0 }, store.get('jk.progress', {})); },
    add(k) { const p = this.get(); p[k]++; store.set('jk.progress', p); },
    fighterOpen(f) { return !f.unlock || this.get().duels >= f.unlock; },
    arenaOpen(a) { return !a.unlock || this.get().rounds >= a.unlock; },
    openSets() { return { f: JK.FIGHTERS.filter((f) => this.fighterOpen(f)).map((f) => f.id), a: JK.ARENAS.filter((a) => this.arenaOpen(a)).map((a) => a.id) }; },
  };
  function refreshLobby() {
    const p = Wallet.get(), pr = Progress.get(), o = Progress.openSets();
    $('#lobbyPurse').textContent = p + ' COINS';
    $('#bRefill').hidden = p >= ENTRY;
    $('#bCreate').disabled = p < ENTRY;
    const nextF = JK.FIGHTERS.find((f) => !Progress.fighterOpen(f)), nextA = JK.ARENAS.find((a) => !Progress.arenaOpen(a));
    $('#lobbyProg').innerHTML = `<span>FIGHTERS <b>${o.f.length}/${JK.FIGHTERS.length}</b></span><span>ARENAS <b>${o.a.length}/${JK.ARENAS.length}</b></span>` +
      (nextF ? `<em>Next fighter: win ${nextF.unlock - pr.duels} more online duel${nextF.unlock - pr.duels > 1 ? 's' : ''}</em>` : '') +
      (nextA ? `<em>Next arena: win ${nextA.unlock - pr.rounds} more round${nextA.unlock - pr.rounds > 1 ? 's' : ''}</em>` : '');
  }

  /* ---------------------------------------------------------------- audio */
  let AC = null;
  function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
  function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  function noise(dur, vol = 0.25, hp = 800) {
    const a = audio(); if (!a) return;
    const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const SFX = {
    click: () => tone(660, 0.06, 'triangle', 0.08),
    tick: () => tone(1200, 0.05, 'square', 0.04),
    whoosh: () => noise(0.22, 0.2, 1800),
    hit: () => { noise(0.18, 0.5, 250); tone(110, 0.3, 'sine', 0.4, 0.4); },
    clash: () => { tone(880, 0.3, 'triangle', 0.12, 0.6); noise(0.2, 0.3, 2000); },
    gong: () => { tone(110, 1.6, 'sine', 0.3, 0.98); tone(220, 1.2, 'triangle', 0.08, 0.99); },
    coin: () => { tone(988, 0.08, 'square', 0.06); setTimeout(() => tone(1319, 0.2, 'square', 0.06), 80); },
    unlock: () => { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.09), i * 110)); },
  };

  /* ---------------------------------------------------------------- state + loop */
  const S = { flow: null, fighter: 'hikari', arena: 'temple', room: null };
  let M = null;
  const loops = {};
  let current = 'lobby', lastT = 0;
  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
    current = id;
    if (id === 'lobby') refreshLobby();
  }
  function fit(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; return true; }
    return false;
  }
  function timeScale() {
    if (!M) return 1;
    const r = rnow();
    if (r < M.hitstop) return 0.04;
    if (r < M.slowmo) return 0.3;
    return 1;
  }
  function frame(t) {
    const dt = Math.min(50, t - (lastT || t)); lastT = t;
    GC += dt * timeScale();
    const fn = loops[current];
    if (fn) fn(GC);
    requestAnimationFrame(frame);
  }
  function toast(msg, ms = 2600) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), ms);
  }
  function message(title, body) { $('#msgTitle').textContent = title; $('#msgBody').textContent = body; $('#msgModal').classList.add('on'); }
  $('#msgOk').onclick = () => $('#msgModal').classList.remove('on');

  /* ---------------------------------------------------------------- network */
  const Net = {
    ws: null, ok: false, retry: 0,
    connect() {
      if (!/^https?:$/.test(location.protocol)) return;
      let ws;
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return; }
      this.ws = ws;
      ws.onopen = () => { this.ok = true; this.retry = 0; netChip(); };
      ws.onclose = () => { const was = this.ok; this.ok = false; netChip(); if (was) onNet({ t: 'disconnected' }); if (this.retry++ < 20) setTimeout(() => this.connect(), 2500); };
      ws.onerror = () => {};
      ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onNet(m); };
    },
    send(o) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(o)); return true; } return false; },
  };
  function netChip() {
    const el = $('#netState'); el.classList.toggle('ok', Net.ok);
    el.querySelector('span').textContent = Net.ok ? 'DUEL SERVER ONLINE' : 'OFFLINE · PRACTICE ONLY';
  }
  function needServer() {
    if (Net.ok) return false;
    message('DUEL SERVER OFFLINE', 'Online duels need the Jan-Ken server. Start it with "npm start" (see the README) or open the game from the address where it is deployed. Practice vs CPU works anywhere.');
    return true;
  }
  function onNet(m) {
    switch (m.t) {
      case 'created': S.room = m.code; enterWaiting(); break;
      case 'checked': if (m.ok) { S.room = m.code; S.flow = 'join'; openSelect(); } else toast(m.reason || 'Room not found.'); break;
      case 'start': { const my = m.you, op = my === 'a' ? 'b' : 'a'; startMatch({ mode: 'online', mySide: my, arena: m.arena, me: m[my], opp: m[op] }); break; }
      case 'ev': if (M && M.mode === 'online') onEvent(m.ev, m.data); break;
      case 'rematchReq': if (current === 'victory') $('#vicNote').textContent = 'YOUR RIVAL WANTS A REMATCH!'; break;
      case 'opponentLeft':
        if (current === 'victory') { $('#vicNote').textContent = 'YOUR RIVAL HAS LEFT THE ROOM.'; $('#bRematch').disabled = true; }
        else if (M && M.mode === 'online' && !M.over) toast('Your rival disconnected — victory by forfeit.', 4000);
        break;
      case 'error': toast(m.msg || 'Something went wrong.'); break;
      case 'disconnected':
        if (M && M.mode === 'online' && !M.over) { toast('Connection to the duel server lost.', 4000); endToLobby(); }
        else if (current === 'waiting') { toast('Connection lost — the room was closed.'); show('lobby'); }
        break;
    }
  }

  /* ---------------------------------------------------------------- shared drawing */
  const rimOf = (arena) => (JK.ARENA_RIM || {})[arena] || null;
  function drawSilhouette(c, fid, w, h, t, s) {
    c.save();
    JK.drawFighter(c, fid, JK.POSES[JK.FIGHTER[fid].idle], { x: w * 0.47, y: h * 0.95, s, facing: 1, t, noShadow: true });
    c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#3a2d46'; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    c.restore();
  }
  function lockIcon(c, x, y, r) {
    c.save(); c.translate(x, y);
    c.strokeStyle = '#e3b54a'; c.lineWidth = r * 0.22; c.beginPath(); c.arc(0, -r * 0.35, r * 0.55, Math.PI, 0); c.stroke();
    c.fillStyle = '#e3b54a'; c.beginPath(); c.roundRect(-r * 0.85, -r * 0.35, r * 1.7, r * 1.3, r * 0.2); c.fill();
    c.fillStyle = '#2a1a08'; c.beginPath(); c.arc(0, r * 0.2, r * 0.18, 0, 7); c.fill(); c.fillRect(-r * 0.06, r * 0.2, r * 0.12, r * 0.4);
    c.restore();
  }

  /* ---------------------------------------------------------------- lobby */
  const lobbyFx = {};
  loops.lobby = (t) => {
    const cv = $('#lobbyBg'); fit(cv); const c = cv.getContext('2d'); const w = cv.width, h = cv.height;
    const open = Progress.openSets();
    const idx = Math.floor(t / 7000);
    const id = open.a[idx % open.a.length];
    if (lobbyFx.id !== id) { lobbyFx.id = id; lobbyFx.fx = JK.makeArenaFx(id); }
    JK.drawArena(c, id, w, h, t / 1000, lobbyFx.fx);
    const s = h * 0.0027, y = h * 0.95, fa = open.f[idx % open.f.length], fb = open.f[(idx + 1) % open.f.length];
    JK.drawFighter(c, fa, JK.POSES[JK.FIGHTER[fa].idle], { x: w * 0.15, y, s, facing: 1, t: t / 1000, rim: rimOf(id) });
    JK.drawFighter(c, fb, JK.POSES[JK.FIGHTER[fb].idle], { x: w * 0.85, y, s, facing: -1, t: t / 1000 + 1, rim: rimOf(id) });
    const k = (t % 7000) / 7000, fade = k < 0.08 ? 1 - k / 0.08 : k > 0.93 ? (k - 0.93) / 0.07 : 0;
    if (fade) { c.fillStyle = `rgba(8,5,5,${fade})`; c.fillRect(0, 0, w, h); }
  };
  $('#bPractice').onclick = () => { SFX.click(); S.flow = 'practice'; openSelect(); };
  $('#bCreate').onclick = () => {
    SFX.click();
    if (Wallet.get() < ENTRY) return toast('You need 100 coins to enter a duel.');
    if (needServer()) return;
    S.flow = 'create'; openSelect();
  };
  $('#bRefill').onclick = () => { Wallet.set(START_PURSE); SFX.coin(); toast('Purse refilled to 400 coins.'); };
  $('#roomInput').addEventListener('input', (e) => {
    let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    v = v.startsWith('JK') ? 'JK-' + v.slice(2, 6) : v.slice(0, 6);
    e.target.value = v;
  });
  $('#joinForm').onsubmit = (e) => {
    e.preventDefault(); SFX.click();
    const m = $('#roomInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^JK(\d{4})$/);
    if (!m) return toast('Enter a room code like JK-8821.');
    if (Wallet.get() < ENTRY) return toast('You need 100 coins to accept a duel.');
    if (needServer()) return;
    Net.send({ t: 'check', code: 'JK-' + m[1] });
  };

  /* ---------------------------------------------------------------- fighter select */
  function openSelect() {
    $('#selKicker').textContent = S.flow === 'join' ? `ACCEPTING DUEL ${S.room} · STEP 1 OF 1` : S.flow === 'practice' ? 'PRACTICE · STEP 1 OF 2' : 'CREATE DUEL · STEP 1 OF 2';
    if (!Progress.fighterOpen(JK.FIGHTER[S.fighter])) S.fighter = 'hikari';
    buildFighterGrid();
    show('select');
  }
  function buildFighterGrid() {
    const g = $('#fighterGrid'); g.innerHTML = '';
    const pr = Progress.get();
    JK.FIGHTERS.forEach((f) => {
      const open = Progress.fighterOpen(f);
      const b = document.createElement('button');
      b.className = 'fcard' + (f.id === S.fighter ? ' sel' : '') + (open ? '' : ' locked'); b.dataset.id = f.id;
      const pip = (n) => Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
      if (open) {
        b.innerHTML = `<div class="tag">${f.stance.toUpperCase()}</div><canvas></canvas><div class="nm">${f.name}</div><div class="st">${f.style}</div><div class="ds">${f.desc}</div>
          <div class="stats"><div class="stat">SPEED<div class="pips">${pip(f.stats.speed)}</div></div><div class="stat">POISE<div class="pips">${pip(f.stats.poise)}</div></div><div class="stat">WEIGHT<div class="pips">${pip(f.stats.weight)}</div></div></div>`;
      } else {
        b.innerHTML = `<div class="tag lk">LOCKED</div><canvas></canvas><div class="nm">${f.name}</div><div class="st">${f.style}</div>
          <div class="ds">Win <b>${f.unlock}</b> online duel${f.unlock > 1 ? 's' : ''} against a real player to unlock.</div>
          <div class="lockbar"><i style="width:${Math.min(100, (pr.duels / f.unlock) * 100)}%"></i><span>${Math.min(pr.duels, f.unlock)} / ${f.unlock} DUEL WINS</span></div>`;
      }
      b.onclick = () => {
        if (!open) { toast(`${f.name} unlocks after ${f.unlock} online duel win${f.unlock > 1 ? 's' : ''}.`); return; }
        SFX.click(); S.fighter = f.id; $$('.fcard').forEach((x) => x.classList.toggle('sel', x === b));
      };
      g.appendChild(b);
    });
  }
  loops.select = (t) => {
    const bg = $('#selectBg'); fit(bg); JK.drawArena(bg.getContext('2d'), 'dojo', bg.width, bg.height, t / 1000, null);
    $$('.fcard').forEach((card, i) => {
      const cv = card.querySelector('canvas'); fit(cv); const c = cv.getContext('2d'); const w = cv.width, h = cv.height;
      c.clearRect(0, 0, w, h);
      const f = JK.FIGHTER[card.dataset.id], sel = f.id === S.fighter, s = h * (f.b.body === 'heavy' ? 0.0046 : 0.0049);
      if (card.classList.contains('locked')) {
        drawSilhouette(c, f.id, w, h, t / 1000 + i, s);
        lockIcon(c, w * 0.5, h * 0.45, h * 0.09);
        return;
      }
      const gl = c.createRadialGradient(w / 2, h * 0.8, 4, w / 2, h * 0.8, w * 0.7);
      gl.addColorStop(0, sel ? 'rgba(227,181,74,.4)' : 'rgba(210,58,34,.15)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gl; c.fillRect(0, 0, w, h);
      JK.drawFighter(c, f.id, JK.POSES[f.idle], { x: w * 0.47, y: h * 0.95, s, facing: 1, t: t / 1000 + i, rim: sel ? '#ffd98a' : null });
    });
  };
  $('#selBack').onclick = () => { SFX.click(); show('lobby'); };
  $('#bConfirmFighter').onclick = () => {
    SFX.gong();
    if (S.flow === 'join') {
      if (!Net.send({ t: 'join', code: S.room, profile: profile() })) return needServer();
      toast('Joining duel ' + S.room + '...');
    } else openArena();
  };
  function profile() { return { fighter: S.fighter, purse: Wallet.get() }; }

  /* ---------------------------------------------------------------- arena select */
  const arenaFx = {};
  function openArena() { if (!Progress.arenaOpen(JK.ARENA[S.arena])) S.arena = 'temple'; buildArenaGrid(); show('arenaSel'); }
  function buildArenaGrid() {
    const g = $('#arenaGrid'); g.innerHTML = '';
    const pr = Progress.get();
    JK.ARENAS.forEach((a) => {
      const open = Progress.arenaOpen(a);
      const b = document.createElement('button'); b.className = 'acard' + (a.id === S.arena ? ' sel' : '') + (open ? '' : ' locked'); b.dataset.id = a.id;
      b.innerHTML = `<canvas></canvas><div class="nm">${a.name}</div><div class="ds">${open ? a.desc : `Win <b>${a.unlock}</b> rounds to unlock · ${Math.min(pr.rounds, a.unlock)}/${a.unlock}`}</div>`;
      b.onclick = () => {
        if (!open) { toast(`${a.name} unlocks after ${a.unlock} round wins.`); return; }
        SFX.click(); S.arena = a.id; $$('.acard').forEach((x) => x.classList.toggle('sel', x === b));
      };
      g.appendChild(b);
    });
  }
  loops.arenaSel = (t) => {
    $$('.acard').forEach((card) => {
      const cv = card.querySelector('canvas'); fit(cv);
      const id = card.dataset.id; arenaFx[id] = arenaFx[id] || JK.makeArenaFx(id);
      const c = cv.getContext('2d'); const w = cv.width, h = cv.height, W = h * 1.6;
      c.save(); c.translate(-(W - w) / 2, 0); JK.drawArena(c, id, W, h, t / 1000, arenaFx[id]); c.restore();
      if (card.classList.contains('locked')) { c.fillStyle = 'rgba(10,6,12,.72)'; c.fillRect(0, 0, w, h); lockIcon(c, w / 2, h / 2, h * 0.09); }
    });
    const hero = $('#arenaHero'); fit(hero); const c = hero.getContext('2d');
    const w = hero.width, h = hero.height, W = Math.max(w, h * 1.78), H = W / 1.78;
    c.save(); c.translate(0, -(H - h) * 0.62); JK.drawArena(c, S.arena, W, H, t / 1000, arenaFx[S.arena]); c.restore();
    JK.drawFighter(c, S.fighter, JK.POSES[JK.FIGHTER[S.fighter].idle], { x: w * 0.8, y: h * 0.98, s: h * 0.0042, facing: -1, t: t / 1000, rim: rimOf(S.arena) });
    $('#arenaCap').textContent = JK.ARENA[S.arena].name;
  };
  $('#arenaBack').onclick = () => { SFX.click(); show('select'); };
  $('#bConfirmArena').onclick = () => {
    SFX.gong();
    if (S.flow === 'practice') {
      const others = JK.FIGHTERS.filter((f) => f.id !== S.fighter);
      const cpu = others[Math.floor(Math.random() * others.length)].id;
      startMatch({ mode: 'cpu', mySide: 'a', arena: S.arena, me: profile(), opp: { fighter: cpu } });
    } else if (!Net.send({ t: 'create', arena: S.arena, profile: profile() })) needServer();
  };

  /* ---------------------------------------------------------------- waiting */
  function inviteUrl() { return location.origin + location.pathname.replace(/index\.html$/, '') + '?room=' + S.room; }
  function enterWaiting() {
    $('#roomCode').textContent = S.room;
    const url = inviteUrl();
    $('#inviteUrl').textContent = url;
    $('#waLink').href = 'https://wa.me/?text=' + encodeURIComponent(`I challenge you to a Jan-Ken duel! 100-coin entry, winner takes the 200-coin prize pool. Room ${S.room}: ${url}`);
    show('waiting');
  }
  const waitFx = {};
  loops.waiting = (t) => {
    const cv = $('#waitBg'); fit(cv); const c = cv.getContext('2d'); const w = cv.width, h = cv.height;
    waitFx[S.arena] = waitFx[S.arena] || JK.makeArenaFx(S.arena);
    JK.drawArena(c, S.arena, w, h, t / 1000, waitFx[S.arena]);
    JK.drawFighter(c, S.fighter, JK.POSES[JK.FIGHTER[S.fighter].idle], { x: w * 0.18, y: h * 0.95, s: h * 0.0029, facing: 1, t: t / 1000, rim: rimOf(S.arena) });
  };
  $('#copyLink').onclick = async () => { try { await navigator.clipboard.writeText(inviteUrl()); toast('Invite link copied.'); } catch (e) { toast('Copy failed — select the link and copy it manually.'); } };
  $('#cancelRoom').onclick = () => { Net.send({ t: 'leave' }); S.room = null; show('lobby'); };

  /* ---------------------------------------------------------------- combat: actors */
  class Actor {
    constructor(fid, facing, x) {
      this.fid = fid; this.f = JK.FIGHTER[fid]; this.facing = facing;
      const p = JK.POSES[this.f.idle];
      this.from = p; this.to = p; this.t0 = 0; this.dur = 1; this.ease = easeOut;
      this.xf = x; this.xt = x; this.x0 = 0; this.xdur = 1; this.xease = easeOut;
      this.sway = [0, 0]; this.prev = null; this.trail = []; this.trailOn = false;
    }
    pose(name, dur = 260, ease = easeOut, over) { this.from = this.cur(); this.to = Object.assign({}, JK.POSES[name], over || {}); this.t0 = now(); this.dur = dur; this.ease = ease; }
    idle(dur = 420) { this.pose(this.f.idle, dur); }
    move(x, dur = 300, ease = easeOut) { this.xf = this.x(); this.xt = x; this.x0 = now(); this.xdur = dur; this.xease = ease; }
    cur() { return JK.lerpPose(this.from, this.to, this.ease(clamp((now() - this.t0) / this.dur))); }
    x() { return this.xf + (this.xt - this.xf) * this.xease(clamp((now() - this.x0) / this.xdur)); }
    snap(x) { this.xf = this.xt = x; const p = JK.POSES[this.f.idle]; this.from = this.to = p; this.trail = []; this.sway = [0, 0]; }
    draw(c, w, y, s, t, rim) {
      const out = JK.drawFighter(c, this.fid, this.cur(), { x: this.x() * w, y, s, facing: this.facing, t, sway: this.sway, rim });
      // secondary motion: hair / cloth lag behind head velocity
      if (this.prev) {
        const vx = (out.head[0] - this.prev[0]) / s, vy = (out.head[1] - this.prev[1]) / s;
        const tx = clamp(-vx * 1.6 * this.facing, -12, 12), ty = clamp(-vy * 1.2, -10, 10);
        this.sway[0] += (tx - this.sway[0]) * 0.18; this.sway[1] += (ty - this.sway[1]) * 0.18;
      }
      this.prev = out.head;
      if (this.trailOn) this.trail.push({ p: out.hand, t: now() });
      this.trail = this.trail.filter((q) => now() - q.t < 140);
      this.out = out;
      return out;
    }
  }

  /* ---------------------------------------------------------------- combat: lifecycle */
  function startMatch(cfg) {
    if (M) cleanupMatch();
    const purseBefore = Wallet.get(), staked = cfg.mode === 'online';
    if (staked) Wallet.set(purseBefore - ENTRY);
    M = {
      mode: cfg.mode, mySide: cfg.mySide, oppSide: cfg.mySide === 'a' ? 'b' : 'a', arena: cfg.arena,
      me: cfg.me, opp: cfg.opp, staked, purseBefore, oppPurse: cfg.opp.purse, openBefore: Progress.openSets(),
      actors: { me: new Actor(cfg.me.fighter, 1, 0.3), opp: new Actor(cfg.opp.fighter, -1, 0.7) },
      fx: JK.makeArenaFx(cfg.arena), rim: rimOf(cfg.arena), effects: [], bursts: [], shake: 0, hitstop: 0, slowmo: 0,
      cam: { z: 1, x: 0.5, y: 0.55, tz: 1, tx: 0.5, ty: 0.55 },
      deadline: 0, timerOn: false, picked: null, over: false, token: {}, history: [],
    };
    $('#nameL').innerHTML = `${JK.FIGHTER[cfg.me.fighter].name}<small>YOU</small>`;
    $('#nameR').innerHTML = `<small>${cfg.mode === 'cpu' ? 'CPU' : 'RIVAL'}</small>${JK.FIGHTER[cfg.opp.fighter].name}`;
    $('#stakes').textContent = staked ? `PRIZE POOL: ${POOL} COINS` : 'PRACTICE · NO STAKES';
    setJewels({ a: 0, b: 0 }); setDots({ a: 0, b: 0 }); setHP('me', 100, true); setHP('opp', 100, true);
    $('#choices').classList.add('off'); $('#timer').textContent = '05';
    $('#quitBtn').textContent = 'Leave match'; $('#quitBtn').dataset.armed = '';
    show('fight');
    if (cfg.mode === 'cpu') { M.ref = new window.Referee((ev, d) => onEvent(ev, d)); setTimeout(() => M && M.ref && M.ref.start(), 300); }
  }
  function cleanupMatch() { if (!M) return; if (M.ref) M.ref.stop(); clearTimeout(M.cpuTimer); M.token.dead = true; M = null; }
  function endToLobby() { cleanupMatch(); show('lobby'); }
  const who = (side) => (side === M.mySide ? 'me' : 'opp');
  const sideObj = (o) => ({ me: o[M.mySide], opp: o[M.oppSide] });

  function setHP(w, v, instant) {
    const el = w === 'me' ? ['#hpL', '#trailL'] : ['#hpR', '#trailR'];
    const fill = $(el[0]), trail = $(el[1]);
    if (instant) [fill, trail].forEach((x) => { x.style.transition = 'none'; x.style.width = v + '%'; void x.offsetWidth; x.style.transition = ''; });
    else { fill.style.width = v + '%'; trail.style.width = v + '%'; }
  }
  function setJewels(rw) { const o = sideObj(rw); $('#jewL').innerHTML = [0, 1].map((i) => `<div class="jewel ${i < o.me ? 'on' : ''}"></div>`).join(''); $('#jewR').innerHTML = [0, 1].map((i) => `<div class="jewel ${i < o.opp ? 'on' : ''}"></div>`).join(''); }
  function setDots(cw) { const o = sideObj(cw); $('#dotsL').innerHTML = [0, 1].map((i) => `<div class="dot ${i < o.me ? 'on' : ''}"></div>`).join(''); $('#dotsR').innerHTML = [0, 1].map((i) => `<div class="dot ${i < o.opp ? 'on' : ''}"></div>`).join(''); }
  function banner(text, cls = 'std') { const b = $('#banner'); b.className = 'banner'; void b.offsetWidth; b.innerHTML = `<div class="stripe"></div>${text}`; b.className = 'banner show ' + cls; }

  const ICON = {
    rock: '<g fill="none" stroke="#f7dc8a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M14 30c0-5 3-8 7-8h20c5 0 9 3 9 8v10c0 9-7 15-16 15h-4c-9 0-16-6-16-15z" fill="rgba(227,181,74,.15)"/><path d="M22 22v8M30 22v8M38 22v8M14 34c5 0 8-2 10-6"/><path d="M42 42h8"/></g>',
    paper: '<g fill="none" stroke="#f7dc8a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M18 34V16a3 3 0 0 1 6 0v14V10a3 3 0 0 1 6 0v20V12a3 3 0 0 1 6 0v18-12a3 3 0 0 1 6 0v22c0 9-6 15-14 15s-11-4-15-11l-5-8a3 3 0 0 1 5-3l5 5" fill="rgba(227,181,74,.15)"/></g>',
    scissors: '<g fill="none" stroke="#f7dc8a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M20 40l-2-28a3 3 0 0 1 6-1l4 22 6-23a3 3 0 0 1 6 2l-5 26c4 0 9 2 9 8 0 7-6 11-13 11h-3c-7 0-12-5-12-12z" fill="rgba(227,181,74,.15)"/><path d="M24 44h12"/></g>',
  };
  $$('.card').forEach((c) => (c.querySelector('svg').innerHTML = ICON[c.dataset.c]));
  ['#revL', '#revR'].forEach((s) => ($(s + ' .badge').innerHTML = '<svg viewBox="0 0 64 64"></svg>'));

  function pick(choice) {
    if (!M || !M.timerOn || M.picked) return;
    M.picked = choice; M.history.push(choice); SFX.click();
    $$('.card').forEach((c) => c.classList.toggle('picked', c.dataset.c === choice));
    $('#choices').classList.add('locked');
    if (M.mode === 'cpu') M.ref.pick(M.mySide, choice); else Net.send({ t: 'pick', choice });
  }
  $$('.card').forEach((c) => (c.onclick = () => pick(c.dataset.c)));
  document.addEventListener('keydown', (e) => {
    if (current !== 'fight') return;
    const k = { 1: 'rock', 2: 'paper', 3: 'scissors', r: 'rock', p: 'paper', s: 'scissors' }[e.key.toLowerCase()];
    if (k) pick(k);
  });
  function cpuChoice() {
    const h = M.history;
    if (h.length >= 2 && Math.random() < 0.4) {
      const counts = { rock: 0, paper: 0, scissors: 0 }; h.slice(-5).forEach((x) => counts[x]++);
      const fav = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      return { rock: 'paper', paper: 'scissors', scissors: 'rock' }[fav];
    }
    return ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
  }

  function impact(xFrac, yFrac, kind, zoom) {
    const r = rnow();
    M.hitstop = r + (kind === 'ko' ? 160 : 120);
    if (kind === 'ko') M.slowmo = r + 1000;
    M.effects.push({ x: xFrac, y: yFrac, t0: now(), kind });
    M.bursts.push({ x: xFrac, y: yFrac, t0: rnow(), dur: kind === 'ko' ? 700 : 380, seed: Math.random() * 1000, kind });
    M.shake = kind === 'ko' ? 22 : kind === 'clash' ? 9 : 15;
    M.cam.tz = zoom; M.cam.tx = xFrac; M.cam.ty = yFrac;
    clearTimeout(M.camT); M.camT = setTimeout(() => { if (M) { M.cam.tz = 1; M.cam.tx = 0.5; M.cam.ty = 0.55; } }, kind === 'ko' ? 1300 : 520);
  }

  function onEvent(ev, d) {
    if (!M) return;
    const tok = M.token, A = M.actors;
    if (ev === 'round') {
      $('#roundLbl').textContent = d.round === 3 ? 'FINAL ROUND' : 'ROUND ' + d.round;
      setJewels(d.roundWins); setDots({ a: 0, b: 0 }); setHP('me', 100, true); setHP('opp', 100, true);
      A.me.snap(0.3); A.opp.snap(0.7);
      $('#timer').textContent = '05'; $('#timer').classList.remove('hot');
      banner(d.round === 3 ? 'FINAL ROUND' : 'ROUND ' + d.round); SFX.gong();
      setTimeout(() => { if (!tok.dead) banner('READY?'); }, 1050);
      setTimeout(() => { if (!tok.dead) { banner('FIGHT!'); SFX.clash(); } }, 1950);
    }
    if (ev === 'clash') {
      M.picked = null; M.timerOn = true; M.deadline = rnow() + d.duration; M.lastTick = 6;
      setDots(d.clashWins);
      $$('.card').forEach((c) => c.classList.remove('picked'));
      $('#choices').classList.remove('off', 'locked');
      $('#lockL').classList.remove('show'); $('#lockR').classList.remove('show');
      $('#revL').className = 'reveal l'; $('#revR').className = 'reveal r';
      if (M.mode === 'cpu') M.cpuTimer = setTimeout(() => M && M.ref && M.ref.pick(M.oppSide, cpuChoice()), 700 + Math.random() * 3300);
    }
    if (ev === 'locked') $(who(d.side) === 'me' ? '#lockL' : '#lockR').classList.add('show');
    if (ev === 'reveal') {
      M.timerOn = false; $('#timer').textContent = '00'; $('#timer').classList.remove('hot');
      $('#choices').classList.add('off'); $('#lockL').classList.remove('show'); $('#lockR').classList.remove('show');
      playClash(d, tok);
    }
    if (ev === 'roundEnd') {
      const w = who(d.winner), l = w === 'me' ? 'opp' : 'me';
      if (w === 'me') Progress.add('rounds');
      banner('K.O.', 'ko'); SFX.hit(); SFX.gong();
      const lo = A[l].out;
      impact(lo ? lo.chest[0] / $('#stage').width : 0.5, lo ? lo.chest[1] / $('#stage').height : 0.55, 'ko', 1.18);
      A[l].pose('kneel', 700); A[w].pose('victory', 600, easeBack);
      setJewels(d.roundWins);
    }
    if (ev === 'matchEnd') {
      M.over = true;
      const won = who(d.winner) === 'me';
      if (d.forfeit) banner(won ? 'FORFEIT' : 'DEFEAT', won ? 'std' : 'ko');
      setJewels(d.roundWins);
      let after = Wallet.get();
      if (M.staked && won) { after += POOL; Wallet.set(after); }
      if (M.mode === 'online' && won) Progress.add('duels');
      const openAfter = Progress.openSets();
      const result = {
        won, forfeit: !!d.forfeit, before: M.purseBefore, after, staked: M.staked, oppPurse: M.oppPurse, mode: M.mode,
        winner: won ? M.me : M.opp, arena: M.arena, roundWins: sideObj(d.roundWins),
        newF: openAfter.f.filter((x) => !M.openBefore.f.includes(x)), newA: openAfter.a.filter((x) => !M.openBefore.a.includes(x)),
      };
      setTimeout(() => { if (!tok.dead) showVictory(result); }, d.forfeit ? 1600 : 1100);
    }
  }

  async function playClash(d, tok) {
    const A = M.actors, mine = d[M.mySide], theirs = d[M.oppSide];
    const res = d.winner === 'draw' ? 'draw' : who(d.winner);
    const setRev = (sel, c, cls) => {
      const el = $(sel); el.className = 'reveal ' + (sel === '#revL' ? 'l' : 'r') + ' show ' + cls;
      el.querySelector('svg').innerHTML = c ? ICON[c] : '<text x="32" y="42" text-anchor="middle" font-size="28" fill="#f7dc8a" font-family="Bebas Neue">?</text>';
      el.querySelector('b').textContent = c ? c.toUpperCase() : 'NO MOVE';
    };
    setRev('#revL', mine, res === 'me' ? 'win' : res === 'opp' ? 'lose' : '');
    setRev('#revR', theirs, res === 'opp' ? 'win' : res === 'me' ? 'lose' : '');
    SFX.tick();
    await sleep(430); if (tok.dead) return;
    // anticipation: load the strike
    if (mine) { A.me.pose('windup', 170, easeOut, { h1: HAND[mine] }); A.me.move(0.27, 170); } else A.me.pose('hesitate', 300);
    if (theirs) { A.opp.pose('windup', 170, easeOut, { h1: HAND[theirs] }); A.opp.move(0.73, 170); } else A.opp.pose('hesitate', 300);
    await sleep(190); if (tok.dead) return;
    // release
    SFX.whoosh();
    if (mine) { A.me.pose(mine, 120, easeBack); A.me.move(0.43, 130); A.me.trailOn = true; }
    if (theirs) { A.opp.pose(theirs, 120, easeBack); A.opp.move(0.57, 130); A.opp.trailOn = true; }
    await sleep(130); if (tok.dead) return;
    const ys = (a) => (a.out ? a.out.hand[1] / $('#stage').height : 0.5);
    const hitX = res === 'me' ? 0.56 : res === 'opp' ? 0.44 : 0.5;
    if (res === 'draw') {
      SFX.clash(); impact(0.5, (ys(A.me) + ys(A.opp)) / 2, 'clash', 1.06);
      await sleep(140); if (tok.dead) return;
      A.me.trailOn = A.opp.trailOn = false;
      A.me.move(0.35, 380); A.opp.move(0.65, 380);
      banner('DRAW', 'draw');
    } else {
      const loser = res === 'me' ? 'opp' : 'me', winChoice = res === 'me' ? mine : theirs;
      SFX.hit(); impact(hitX, ys(A[res]), 'hit', 1.1);
      await sleep(140); if (tok.dead) return;
      A.me.trailOn = A.opp.trailOn = false;
      A[loser].pose(JK.REACT[winChoice], 170, easeBack);
      A[loser].move(loser === 'me' ? 0.19 : 0.81, 480);
      const cw = sideObj(d.clashWins);
      setHP(loser, 100 - (loser === 'me' ? cw.opp : cw.me) * 50);
      setDots(d.clashWins);
    }
    await sleep(820); if (tok.dead) return;
    const cw = sideObj(d.clashWins), finished = cw.me >= 2 || cw.opp >= 2;
    if (!finished) { A.me.idle(); A.opp.idle(); A.me.move(0.3, 500); A.opp.move(0.7, 500); }
    else { const w = cw.me >= 2 ? 'me' : 'opp'; A[w].idle(); A[w].move(w === 'me' ? 0.34 : 0.66, 500); }
  }

  function drawBursts(c, w, h) {
    M.bursts = M.bursts.filter((b) => rnow() - b.t0 < b.dur);
    M.bursts.forEach((b) => {
      const k = (rnow() - b.t0) / b.dur, cx = b.x * w, cy = b.y * h;
      let sd = b.seed; const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
      c.save(); c.globalAlpha = (1 - k) * (b.kind === 'clash' ? 0.5 : 0.75);
      const n = b.kind === 'ko' ? 90 : 60, r0 = h * (0.16 + k * 0.08), R = Math.hypot(w, h);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, wd = 0.004 + rnd() * 0.012, rs = r0 * (0.8 + rnd() * 0.7);
        c.fillStyle = i % 3 ? (b.kind === 'clash' ? '#bff8ff' : '#120a0a') : '#ffffff';
        c.beginPath(); c.moveTo(cx + Math.cos(a) * rs, cy + Math.sin(a) * rs);
        c.lineTo(cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R); c.lineTo(cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R); c.fill();
      }
      c.restore();
    });
  }
  function drawTrail(c, a, h) {
    if (a.trail.length < 2) return;
    const col = a === M.actors.me ? '255,240,200' : '200,240,255';
    for (let i = 1; i < a.trail.length; i++) {
      const p0 = a.trail[i - 1].p, p1 = a.trail[i].p, k = i / a.trail.length;
      c.strokeStyle = `rgba(${col},${0.65 * k})`; c.lineWidth = h * 0.03 * k; c.lineCap = 'round';
      c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
    }
  }
  loops.fight = (t) => {
    if (!M) return;
    const cv = $('#stage'); fit(cv); const c = cv.getContext('2d'); const w = cv.width, h = cv.height;
    const cam = M.cam;
    cam.z += (cam.tz - cam.z) * 0.16; cam.x += (cam.tx - cam.x) * 0.16; cam.y += (cam.ty - cam.y) * 0.16;
    const fx = clamp(cam.x * w, w / (2 * cam.z), w - w / (2 * cam.z)), fy = clamp(cam.y * h, h * 0.55 / cam.z, h - h * 0.45 / cam.z);
    c.save();
    if (M.shake > 0.3) { c.translate((Math.random() - 0.5) * M.shake, (Math.random() - 0.5) * M.shake); M.shake *= 0.85; }
    c.translate(w / 2, h * 0.55); c.scale(cam.z, cam.z); c.translate(-fx, -fy);
    JK.drawArena(c, M.arena, w, h, t / 1000, M.fx);
    const s = h * 0.0031, y = h * 0.93, A = M.actors;
    A.opp.draw(c, w, y, s, t / 1000 + 1.7, M.rim);
    A.me.draw(c, w, y, s, t / 1000, M.rim);
    drawTrail(c, A.me, h); drawTrail(c, A.opp, h);
    M.effects = M.effects.filter((e) => now() - e.t0 < 600);
    M.effects.forEach((e) => {
      const k = (now() - e.t0) / 600, ex = e.x * w, ey = e.y * h, r = (24 + k * 170) * (h / 900);
      c.save(); c.globalAlpha = 1 - k;
      c.strokeStyle = e.kind === 'clash' ? '#3ef0ff' : '#ffe08a'; c.lineWidth = 9 * (1 - k) + 1;
      c.beginPath(); c.arc(ex, ey, r, 0, 7); c.stroke();
      const g = c.createRadialGradient(ex, ey, 0, ex, ey, r); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,220,140,0)');
      c.fillStyle = g; c.beginPath(); c.arc(ex, ey, r * 0.75, 0, 7); c.fill();
      c.restore();
    });
    c.restore();
    // screen-space: speed lines, flash, vignette
    drawBursts(c, w, h);
    const fl = M.effects.find((e) => now() - e.t0 < 70);
    if (fl) { c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(0, 0, w, h); }
    if (rnow() < M.slowmo) { c.fillStyle = 'rgba(40,0,10,.18)'; c.fillRect(0, 0, w, h); }
    const vg = c.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, w * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
    if (M.timerOn) {
      const sec = Math.ceil(Math.max(0, M.deadline - rnow()) / 1000);
      $('#timer').textContent = String(Math.min(5, sec)).padStart(2, '0');
      $('#timer').classList.toggle('hot', sec <= 2);
      if (sec < M.lastTick) { M.lastTick = sec; if (sec <= 3 && sec > 0) SFX.tick(); }
    }
  };
  $('#quitBtn').onclick = () => {
    const b = $('#quitBtn');
    if (M && M.staked && !M.over && !b.dataset.armed) {
      b.dataset.armed = '1'; b.textContent = 'Click again to forfeit 100 coins';
      setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Leave match'; }, 3000);
      return;
    }
    if (M && M.mode === 'online') Net.send({ t: 'leave' });
    endToLobby();
  };

  /* ---------------------------------------------------------------- victory */
  let V = null;
  function showVictory(r) {
    V = Object.assign({ fx: JK.makeArenaFx(r.arena), t0: now() }, r);
    const name = JK.FIGHTER[r.winner.fighter].name;
    $('#vicWho').innerHTML = r.won ? `${name} <span style="color:var(--gold2)">(YOU)</span> CLAIMS THE PURSE` : `${name} <span style="color:#ff6a50">(${r.mode === 'cpu' ? 'CPU' : 'RIVAL'})</span> CLAIMS THE PURSE`;
    let html = `<div class="row"><span>ROUNDS</span><span>${r.roundWins.me} – ${r.roundWins.opp}${r.forfeit ? ' · FORFEIT' : ''}</span></div>`;
    if (r.staked) {
      html += `<div class="row"><span>ENTRY FEE</span><span class="neg">−${ENTRY}</span></div>`;
      html += `<div class="row"><span>PRIZE POOL (${POOL})</span><span class="${r.won ? 'pos' : 'neg'}">${r.won ? '+' + POOL : '+0'}</span></div>`;
      html += `<div class="row"><span>NET RESULT</span><span class="big ${r.won ? 'pos' : 'neg'}">${r.won ? '+100' : '−100'} COINS</span></div>`;
      html += `<div class="row"><span>YOUR PURSE</span><span>${r.before} → <b style="color:var(--gold2)">${r.after}</b></span></div>`;
      if (typeof r.oppPurse === 'number') html += `<div class="row"><span>RIVAL PURSE</span><span>${r.oppPurse} → ${r.oppPurse - ENTRY + (r.won ? 0 : POOL)}</span></div>`;
    } else {
      html += `<div class="row"><span>PRACTICE MATCH</span><span>NO COINS WAGERED</span></div><div class="row"><span>YOUR PURSE</span><span>${r.after}</span></div>`;
    }
    $('#payout').innerHTML = html;
    const ub = $('#unlockBox');
    const items = r.newF.map((id) => `<div class="ul"><i>NEW FIGHTER UNLOCKED</i><b>${JK.FIGHTER[id].name}</b><span>${JK.FIGHTER[id].style}</span></div>`)
      .concat(r.newA.map((id) => `<div class="ul"><i>NEW ARENA UNLOCKED</i><b>${JK.ARENA[id].name}</b></div>`));
    ub.innerHTML = items.join('');
    ub.hidden = !items.length;
    if (items.length) setTimeout(() => SFX.unlock(), 700);
    $('#vicNote').textContent = '';
    $('#bRematch').disabled = r.staked && Wallet.get() < ENTRY;
    if (r.won) SFX.coin();
    show('victory');
  }
  loops.victory = (t) => {
    if (!V) return;
    const cv = $('#vicBg'); fit(cv); const c = cv.getContext('2d'); const w = cv.width, h = cv.height;
    JK.drawArena(c, V.arena, w, h, t / 1000, V.fx);
    const glow = c.createRadialGradient(w * 0.2, h * 0.6, 10, w * 0.2, h * 0.6, h * 0.6);
    glow.addColorStop(0, 'rgba(255,214,120,.45)'); glow.addColorStop(1, 'rgba(255,214,120,0)');
    c.fillStyle = glow; c.fillRect(0, 0, w, h);
    const k = easeBack(clamp((now() - V.t0) / 700));
    JK.drawFighter(c, V.winner.fighter, JK.lerpPose(JK.POSES.bow, JK.POSES.victory, k), { x: w * 0.2, y: h * 0.95, s: h * 0.0036, facing: 1, t: t / 1000, rim: '#ffd98a' });
    for (let i = 0; i < 26; i++) {
      const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * w * 0.6, y = ((t / 1000 * (0.1 + (i % 5) * 0.03) + i * 0.137) % 1) * h;
      c.fillStyle = i % 3 ? '#f7dc8a' : '#d23a22'; c.save(); c.translate(x, y); c.rotate(t / 400 + i); c.fillRect(-4, -2, 8, 4); c.restore();
    }
  };
  $('#bMenu').onclick = () => { SFX.click(); if (M && M.mode === 'online') Net.send({ t: 'leave' }); cleanupMatch(); V = null; show('lobby'); };
  $('#bRematch').onclick = () => {
    SFX.click();
    if (!M) return show('lobby');
    if (M.mode === 'cpu') startMatch({ mode: 'cpu', mySide: 'a', arena: M.arena, me: M.me, opp: M.opp });
    else {
      if (Wallet.get() < ENTRY) return toast('You need 100 coins for a rematch.');
      Net.send({ t: 'rematch', purse: Wallet.get() });
      $('#vicNote').textContent = 'WAITING FOR YOUR RIVAL TO ACCEPT...';
      $('#bRematch').disabled = true;
    }
  };

  /* ---------------------------------------------------------------- boot */
  refreshLobby(); netChip(); Net.connect();
  try {
    const room = new URLSearchParams(location.search).get('room');
    const m = room && room.toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^JK(\d{4})$/);
    if (m) { $('#roomInput').value = 'JK-' + m[1]; setTimeout(() => toast('You have been challenged! Press JOIN to accept duel JK-' + m[1] + '.', 5000), 600); }
  } catch (e) {}
  requestAnimationFrame(frame);
  window.addEventListener('pointerdown', () => audio(), { once: true });
  window.__jk = { S, get M() { return M; }, Wallet, Progress, onEvent, show, store };
})();
