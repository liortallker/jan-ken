/* Jan-Ken arenas: painted Japanese battlegrounds with animated particles. */
(function () {
  const JK = (window.JK = window.JK || {});
  function shadeHex(hex, amt) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  JK.shadeHex = shadeHex;

  /* ------------------------------------------------------------------ arenas */
  JK.ARENAS = [
    { id: 'temple', name: 'HONMARU TEMPLE', desc: 'Weathered stone courtyard, massive wooden pillars, stone lanterns and manicured pines.' },
    { id: 'bamboo', name: 'KYOTO BAMBOO GROVE', desc: 'Dense bamboo stalks, a soft earthen path and misty emerald light.' },
    { id: 'torii', name: 'TORII GATE TRAIL', desc: 'Descending stone steps beneath vermilion gates and drifting autumn leaves.' },
    { id: 'pagoda', name: 'CHERRY BLOSSOM PAGODA', desc: 'A moonlit wooden pavilion facing a tiered pagoda in a storm of sakura.' },
    { id: 'dojo', name: 'LANTERN HALL DOJO', desc: 'Polished parquet glowing with lantern light, shoji screens and hanging scrolls.' },
    { id: 'zen', name: 'RAKED STONE GARDEN', desc: 'Raked white gravel rippling around mossy rocks, behind a tiled clay wall and a blazing maple.', unlock: 3 },
    { id: 'castle', name: 'MOONLIT CASTLE KEEP', desc: 'A torch-lit courtyard beneath a towering white castle keep and a cold silver moon.', unlock: 6 },
    { id: 'snow', name: 'SNOWFALL MOUNTAIN SHRINE', desc: 'A hushed snowy shrine at dusk, a vermilion gate and a great white peak beyond.', unlock: 10 },
  ];
  JK.ARENA_RIM = { temple: '#ffb36b', bamboo: '#c4f5b0', torii: '#ffb070', pagoda: '#b9c4ff', dojo: '#ffc27a', zen: '#fff1d6', castle: '#9fc0ff', snow: '#d8f0ff' };
  JK.ARENA = Object.fromEntries(JK.ARENAS.map((a) => [a.id, a]));

  function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
  const lg = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };

  function pine(ctx, x, y, s, flip, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * flip, s);
    ctx.strokeStyle = '#2b1d14'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(60, 20, 140, 10); ctx.moveTo(60, 14); ctx.quadraticCurveTo(90, 40, 120, 50); ctx.stroke();
    ctx.fillStyle = col;
    [[40, 0, 34, 12], [100, 0, 40, 14], [150, 8, 30, 11], [118, 46, 30, 11], [80, 30, 26, 9]].forEach(([cx, cy, rx, ry]) => {
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    [[40, -4, 26, 6], [100, -5, 30, 6]].forEach(([cx, cy, rx, ry]) => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill(); });
    ctx.restore();
  }
  function lantern(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const st = (c) => { ctx.fillStyle = c; };
    st('#6f6a62'); ctx.fillRect(-14, -8, 28, 8);
    st('#7e786e'); ctx.fillRect(-5, -60, 10, 52);
    st('#8a847a'); ctx.fillRect(-16, -72, 32, 12);
    st('#ffcf73'); ctx.fillRect(-11, -94, 22, 22);
    st('#6f6a62'); ctx.fillRect(-11, -94, 4, 22); ctx.fillRect(7, -94, 4, 22);
    st('#5e5951'); ctx.beginPath(); ctx.moveTo(-26, -94); ctx.lineTo(26, -94); ctx.lineTo(10, -110); ctx.lineTo(-10, -110); ctx.closePath(); ctx.fill();
    st('#7e786e'); ctx.beginPath(); ctx.arc(0, -114, 6, 0, 7); ctx.fill();
    const glow = ctx.createRadialGradient(0, -83, 2, 0, -83, 60);
    glow.addColorStop(0, 'rgba(255,200,110,.45)'); glow.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = glow; ctx.fillRect(-60, -143, 120, 120);
    ctx.restore();
  }
  function torii(ctx, cx, base, w, h, col) {
    const pw = w * 0.07;
    ctx.fillStyle = lg(ctx, cx - w / 2, 0, cx + w / 2, 0, [[0, shadeHex(col, -0.35)], [0.5, col], [1, shadeHex(col, -0.25)]]);
    ctx.fillRect(cx - w * 0.36 - pw / 2, base - h, pw, h);
    ctx.fillRect(cx + w * 0.36 - pw / 2, base - h, pw, h);
    ctx.fillRect(cx - w * 0.45, base - h * 0.8, w * 0.9, h * 0.06);
    ctx.fillStyle = '#1b1210';
    ctx.beginPath(); ctx.moveTo(cx - w * 0.56, base - h * 1.02); ctx.quadraticCurveTo(cx, base - h * 0.94, cx + w * 0.56, base - h * 1.02); ctx.lineTo(cx + w * 0.52, base - h * 0.93); ctx.quadraticCurveTo(cx, base - h * 0.88, cx - w * 0.52, base - h * 0.93); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(cx - w * 0.5, base - h * 0.92, w, h * 0.06);
    ctx.fillStyle = '#111'; ctx.fillRect(cx - w * 0.36 - pw / 2, base - h * 0.08, pw, h * 0.08); ctx.fillRect(cx + w * 0.36 - pw / 2, base - h * 0.08, pw, h * 0.08);
  }
  function roofTier(ctx, cx, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(cx - w / 2 - w * 0.12, y - h * 0.15); ctx.quadraticCurveTo(cx - w * 0.35, y + h * 0.2, cx - w * 0.2, y); ctx.lineTo(cx, y - h); ctx.lineTo(cx + w * 0.2, y); ctx.quadraticCurveTo(cx + w * 0.35, y + h * 0.2, cx + w / 2 + w * 0.12, y - h * 0.15); ctx.lineTo(cx + w / 2, y - h * 0.4); ctx.lineTo(cx - w / 2, y - h * 0.4); ctx.closePath(); ctx.fill();
  }

  const statics = {};
  function paintStatic(id, w, h) {
    const key = id + w + 'x' + h;
    if (statics[key]) return statics[key];
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const hz = h * 0.6; // horizon
    const R = rng(7 + id.length);
    if (id === 'temple') {
      ctx.fillStyle = lg(ctx, 0, 0, 0, hz, [[0, '#2c2a4a'], [0.45, '#b4605a'], [0.8, '#f2a65e'], [1, '#f7d08a']]); ctx.fillRect(0, 0, w, hz);
      const sun = ctx.createRadialGradient(w * 0.5, hz * 0.85, 4, w * 0.5, hz * 0.85, w * 0.35);
      sun.addColorStop(0, 'rgba(255,236,170,.9)'); sun.addColorStop(1, 'rgba(255,236,170,0)'); ctx.fillStyle = sun; ctx.fillRect(0, 0, w, hz);
      // hills
      ctx.fillStyle = '#5a3c4a'; ctx.beginPath(); ctx.moveTo(0, hz); for (let x = 0; x <= w; x += w / 12) ctx.lineTo(x, hz - h * 0.06 - Math.sin(x / w * 7) * h * 0.03); ctx.lineTo(w, hz); ctx.fill();
      // main hall
      const cx = w * 0.5, hw = w * 0.5;
      ctx.fillStyle = '#3a221a'; ctx.fillRect(cx - hw * 0.42, hz - h * 0.2, hw * 0.84, h * 0.2);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#5b2c1d' : '#2b1711'; ctx.fillRect(cx - hw * 0.42 + i * hw * 0.84 / 9, hz - h * 0.2, hw * 0.84 / 9, h * 0.2); }
      ctx.fillStyle = 'rgba(255,190,110,.35)'; ctx.fillRect(cx - hw * 0.12, hz - h * 0.15, hw * 0.24, h * 0.15);
      roofTier(ctx, cx, hz - h * 0.2, hw, h * 0.16, '#241c22');
      roofTier(ctx, cx, hz - h * 0.31, hw * 0.55, h * 0.09, '#2c2228');
      // stone floor
      ctx.fillStyle = lg(ctx, 0, hz, 0, h, [[0, '#8c8478'], [1, '#4a453f']]); ctx.fillRect(0, hz, w, h - hz);
      ctx.strokeStyle = 'rgba(30,25,20,.35)'; ctx.lineWidth = 1;
      for (let i = 1; i < 14; i++) { const y = hz + (h - hz) * Math.pow(i / 14, 1.8); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.03, hz); ctx.lineTo(w / 2 + i * w * 0.16, h); ctx.stroke(); }
      for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(${R() > 0.5 ? '255,255,255' : '0,0,0'},${R() * 0.06})`; ctx.fillRect(R() * w, hz + R() * (h - hz), 3 + R() * 18, 2 + R() * 5); }
      lantern(ctx, w * 0.2, hz + h * 0.05, h * 0.0028); lantern(ctx, w * 0.8, hz + h * 0.05, h * 0.0028);
      // pillars
      [[w * 0.03, 1], [w * 0.97, 1]].forEach(([x]) => {
        const pw = w * 0.07;
        ctx.fillStyle = lg(ctx, x - pw / 2, 0, x + pw / 2, 0, [[0, '#1d0f0a'], [0.4, '#6e3a24'], [0.7, '#4a2416'], [1, '#170b07']]);
        ctx.fillRect(x - pw / 2, 0, pw, h);
        ctx.fillStyle = '#2a2420'; ctx.fillRect(x - pw * 0.65, h * 0.9, pw * 1.3, h * 0.1);
      });
      pine(ctx, w * 0.02, h * 0.08, h * 0.0042, 1, '#24402c');
      pine(ctx, w * 0.98, h * 0.12, h * 0.0036, -1, '#2a4a32');
    }
    if (id === 'bamboo') {
      ctx.fillStyle = lg(ctx, 0, 0, 0, h, [[0, '#0d2a1c'], [0.5, '#3f7a4c'], [1, '#13281a']]); ctx.fillRect(0, 0, w, h);
      for (let layer = 0; layer < 4; layer++) {
        const n = 26 - layer * 4, depth = layer / 3;
        for (let i = 0; i < n; i++) {
          const x = R() * w, bw = (4 + depth * 16) * (w / 900);
          const col = shadeHex(['#2f6a3c', '#3f8a48', '#5aa556', '#7cc06a'][layer], -0.55 + depth * 0.45);
          ctx.fillStyle = lg(ctx, x - bw, 0, x + bw, 0, [[0, shadeHex(col, -0.4)], [0.4, shadeHex(col, 0.2)], [1, shadeHex(col, -0.5)]]);
          ctx.fillRect(x - bw / 2, 0, bw, hz + (h - hz) * (0.1 + depth * 0.25));
          ctx.fillStyle = shadeHex(col, -0.5);
          for (let y = R() * 60; y < hz + 40; y += 50 + depth * 40) ctx.fillRect(x - bw / 2 - 1, y, bw + 2, 2 + depth * 2);
        }
        ctx.fillStyle = `rgba(190,235,200,${0.16 - layer * 0.03})`; ctx.fillRect(0, 0, w, h);
      }
      ctx.fillStyle = lg(ctx, 0, hz, 0, h, [[0, '#5a4a32'], [1, '#2b2117']]);
      ctx.beginPath(); ctx.moveTo(w * 0.42, hz); ctx.lineTo(w * 0.58, hz); ctx.lineTo(w * 1.1, h); ctx.lineTo(-w * 0.1, h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lg(ctx, 0, hz, 0, h, [[0, 'rgba(20,40,24,.9)'], [1, 'rgba(10,22,12,1)']]);
      ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(w * 0.42, hz); ctx.lineTo(-w * 0.1, h); ctx.lineTo(0, h); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w, hz); ctx.lineTo(w * 0.58, hz); ctx.lineTo(w * 1.1, h); ctx.lineTo(w, h); ctx.fill();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(220,255,210,.05)'; ctx.beginPath(); const x = w * (0.15 + i * 0.18); ctx.moveTo(x, 0); ctx.lineTo(x + w * 0.05, 0); ctx.lineTo(x + w * 0.2, h); ctx.lineTo(x + w * 0.1, h); ctx.fill(); }
      ctx.fillStyle = lg(ctx, 0, hz - h * 0.15, 0, hz + h * 0.1, [[0, 'rgba(210,240,215,0)'], [0.5, 'rgba(210,240,215,.35)'], [1, 'rgba(210,240,215,0)']]); ctx.fillRect(0, hz - h * 0.15, w, h * 0.25);
    }
    if (id === 'torii') {
      ctx.fillStyle = lg(ctx, 0, 0, 0, hz, [[0, '#f0c27a'], [0.6, '#f4a259'], [1, '#e9844a']]); ctx.fillRect(0, 0, w, h);
      // autumn forest
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < 40; i++) {
          const x = R() * w, y = hz * (0.35 + layer * 0.18) + R() * h * 0.12, r = (30 + R() * 50) * (w / 1000) * (1 + layer * 0.5);
          ctx.fillStyle = ['#b2452a', '#d0612e', '#e58a2f', '#8e2f21', '#c99a3a'][Math.floor(R() * 5)];
          ctx.globalAlpha = 0.5 + layer * 0.25; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // descending steps
      const steps = 16;
      for (let i = steps; i >= 0; i--) {
        const k = i / steps, y = hz + (h - hz) * Math.pow(k, 1.5), y2 = hz + (h - hz) * Math.pow((i + 1) / steps, 1.5);
        const half = w * (0.08 + k * 0.6);
        ctx.fillStyle = shadeHex('#8b8279', -0.3 + k * 0.25);
        ctx.fillRect(w / 2 - half, y, half * 2, y2 - y + 1);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(w / 2 - half, y2 - (y2 - y) * 0.3, half * 2, (y2 - y) * 0.3);
      }
      ctx.fillStyle = '#3d2a1a'; ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(w * 0.42, hz); ctx.lineTo(w * 0.02, h); ctx.lineTo(0, h); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w, hz); ctx.lineTo(w * 0.58, hz); ctx.lineTo(w * 0.98, h); ctx.lineTo(w, h); ctx.fill();
      // gates in perspective
      for (let i = 9; i >= 0; i--) {
        const k = Math.pow((i + 0.2) / 10, 1.6);
        const base = hz + (h - hz) * k * 0.8 + 2, gw = w * (0.18 + k * 1.1), gh = gw * 0.85;
        torii(ctx, w / 2, base, gw, gh, '#d1361f');
      }
    }
    if (id === 'pagoda') {
      ctx.fillStyle = lg(ctx, 0, 0, 0, hz, [[0, '#070b22'], [0.6, '#1b2350'], [1, '#3a3a6a']]); ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,255,255,${R() * 0.8})`; ctx.fillRect(R() * w, R() * hz * 0.8, 1.4, 1.4); }
      const mx = w * 0.74, my = h * 0.2, mr = h * 0.1;
      const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4); mg.addColorStop(0, 'rgba(220,225,255,.5)'); mg.addColorStop(1, 'rgba(220,225,255,0)');
      ctx.fillStyle = mg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f4f1e2'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(180,175,160,.35)'; [[-.3, -.2, .25], [.3, .2, .18], [.1, -.4, .12]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(mx + a * mr, my + b * mr, r * mr, 0, 7); ctx.fill(); });
      // distant hills + pagoda
      ctx.fillStyle = '#141a3a'; ctx.beginPath(); ctx.moveTo(0, hz); for (let x = 0; x <= w; x += w / 10) ctx.lineTo(x, hz - h * 0.05 - Math.sin(x / w * 5 + 1) * h * 0.04); ctx.lineTo(w, hz); ctx.fill();
      const px = w * 0.32, pb = hz - h * 0.02;
      ctx.fillStyle = '#10142e'; ctx.fillRect(px - w * 0.03, pb - h * 0.42, w * 0.06, h * 0.42);
      for (let i = 0; i < 5; i++) roofTier(ctx, px, pb - i * h * 0.08, w * (0.16 - i * 0.018), h * 0.05, '#0c0f24');
      ctx.strokeStyle = '#0c0f24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, pb - h * 0.4); ctx.lineTo(px, pb - h * 0.5); ctx.stroke();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(255,200,120,.7)'; ctx.fillRect(px - 3, pb - i * h * 0.08 - h * 0.03, 6, 5); }
      // sakura trees
      [[w * 0.05, h * 0.18], [w * 0.95, h * 0.12], [w * 0.12, h * 0.05]].forEach(([x, y], j) => {
        for (let i = 0; i < 70; i++) {
          ctx.fillStyle = ['#f7c6d9', '#f2a7c3', '#ffdbe8', '#e88fb1'][Math.floor(R() * 4)];
          ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x + (R() - 0.5) * w * 0.25, y + (R() - 0.3) * h * 0.22, 8 + R() * 26, 0, 7); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      // pavilion floor (planks)
      ctx.fillStyle = lg(ctx, 0, hz, 0, h, [[0, '#4a2e22'], [1, '#22140e']]); ctx.fillRect(0, hz, w, h - hz);
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1;
      for (let i = -20; i <= 20; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.025, hz); ctx.lineTo(w / 2 + i * w * 0.12, h); ctx.stroke(); }
      ctx.fillStyle = 'rgba(200,210,255,.12)'; ctx.beginPath(); ctx.ellipse(mx * 0.9, hz + (h - hz) * 0.4, w * 0.25, (h - hz) * 0.2, 0, 0, 7); ctx.fill();
      // railing
      ctx.fillStyle = '#5a1f17'; ctx.fillRect(0, hz - h * 0.05, w, h * 0.012); ctx.fillRect(0, hz - h * 0.015, w, h * 0.015);
      for (let x = 0; x < w; x += w / 16) ctx.fillRect(x, hz - h * 0.05, w * 0.008, h * 0.05);
    }
    if (id === 'dojo') {
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(0, 0, w, h);
      // shoji wall
      const wallTop = h * 0.08;
      for (let i = 0; i < 8; i++) {
        const x = i * w / 8, pw = w / 8;
        ctx.fillStyle = lg(ctx, 0, wallTop, 0, hz, [[0, '#f3e2b8'], [1, '#e6c98e']]);
        ctx.fillRect(x + 4, wallTop, pw - 8, hz - wallTop);
        ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 2;
        for (let gx = 1; gx < 4; gx++) { ctx.beginPath(); ctx.moveTo(x + 4 + gx * (pw - 8) / 4, wallTop); ctx.lineTo(x + 4 + gx * (pw - 8) / 4, hz); ctx.stroke(); }
        for (let gy = 1; gy < 6; gy++) { ctx.beginPath(); ctx.moveTo(x + 4, wallTop + gy * (hz - wallTop) / 6); ctx.lineTo(x + pw - 4, wallTop + gy * (hz - wallTop) / 6); ctx.stroke(); }
        ctx.fillStyle = '#3a2416'; ctx.fillRect(x, wallTop, 6, hz - wallTop);
      }
      ctx.fillStyle = '#24140c'; ctx.fillRect(0, 0, w, wallTop); ctx.fillRect(0, hz - h * 0.02, w, h * 0.02);
      // scrolls with abstract brushwork
      [w * 0.3, w * 0.7].forEach((x, j) => {
        const sw = w * 0.07, sh = h * 0.32, y = wallTop + h * 0.03;
        ctx.fillStyle = '#5a2a1a'; ctx.fillRect(x - sw / 2 - 4, y - 4, sw + 8, sh + 8);
        ctx.fillStyle = '#efe6d0'; ctx.fillRect(x - sw / 2, y, sw, sh);
        ctx.strokeStyle = '#141010'; ctx.lineCap = 'round';
        // ensō circle + a single falling brush stroke (abstract, no lettering)
        const ex = x, ey = y + sh * 0.3, er = sw * 0.32;
        for (let k = 0; k < 3; k++) { ctx.lineWidth = sw * (0.09 - k * 0.02); ctx.beginPath(); ctx.arc(ex + k, ey, er - k, 0.5 + j, 0.5 + j + 5.6); ctx.stroke(); }
        ctx.lineWidth = sw * 0.07; ctx.beginPath(); ctx.moveTo(x - sw * 0.05, y + sh * 0.55); ctx.quadraticCurveTo(x + sw * 0.08, y + sh * 0.68, x - sw * 0.02, y + sh * 0.82); ctx.stroke();
        ctx.fillStyle = '#b3261e'; ctx.fillRect(x + sw * 0.18, y + sh * 0.86, sw * 0.16, sw * 0.16);
      });
      // parquet floor with reflection
      ctx.fillStyle = lg(ctx, 0, hz, 0, h, [[0, '#8a5a32'], [0.5, '#6b4022'], [1, '#3a2010']]); ctx.fillRect(0, hz, w, h - hz);
      for (let i = 1; i < 12; i++) { const y = hz + (h - hz) * Math.pow(i / 12, 1.7); ctx.strokeStyle = 'rgba(40,20,8,.45)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let i = -24; i <= 24; i++) { ctx.strokeStyle = 'rgba(40,20,8,.3)'; ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.022, hz); ctx.lineTo(w / 2 + i * w * 0.1, h); ctx.stroke(); }
      ctx.save(); ctx.globalAlpha = 0.18; ctx.scale(1, -0.5); ctx.drawImage(cv, 0, 0, w, hz, 0, -hz * 2 - (h - hz) * 1.1, w, hz); ctx.restore();
    }
    if (id === 'zen') {
      ctx.fillStyle = lg(ctx, 0, 0, 0, hz, [[0, '#a9cde0'], [0.7, '#e8e4d2'], [1, '#f2ead6']]); ctx.fillRect(0, 0, w, hz);
      // maple + pine behind the wall
      for (let i = 0; i < 90; i++) { ctx.fillStyle = ['#c8321f', '#e0582a', '#a8231a', '#f08a3a'][Math.floor(R() * 4)]; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(w * 0.72 + (R() - 0.5) * w * 0.4, hz * 0.35 + (R() - 0.5) * hz * 0.45, 10 + R() * 26, 0, 7); ctx.fill(); }
      for (let i = 0; i < 50; i++) { ctx.fillStyle = ['#2f5a3a', '#3d6e44', '#264a30'][Math.floor(R() * 3)]; ctx.beginPath(); ctx.arc(w * 0.18 + (R() - 0.5) * w * 0.3, hz * 0.45 + (R() - 0.5) * hz * 0.4, 10 + R() * 24, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#4a2c1c'; ctx.fillRect(w * 0.715, hz * 0.45, w * 0.02, hz * 0.5);
      // clay wall with tiled cap
      ctx.fillStyle = lg(ctx, 0, hz - h * 0.17, 0, hz, [[0, '#d9b98a'], [1, '#b8915e']]); ctx.fillRect(0, hz - h * 0.15, w, h * 0.15);
      for (let i = 0; i < 6; i++) { ctx.strokeStyle = 'rgba(120,80,40,.25)'; ctx.beginPath(); ctx.moveTo(0, hz - h * 0.15 + i * h * 0.025); ctx.lineTo(w, hz - h * 0.15 + i * h * 0.025); ctx.stroke(); }
      ctx.fillStyle = '#3a3f48'; ctx.beginPath(); ctx.moveTo(-10, hz - h * 0.15); ctx.lineTo(w + 10, hz - h * 0.15); ctx.lineTo(w + 10, hz - h * 0.19); ctx.lineTo(-10, hz - h * 0.19); ctx.fill();
      ctx.fillStyle = '#4f5560'; for (let x = 0; x < w; x += w / 40) ctx.fillRect(x, hz - h * 0.2, w / 48, h * 0.012);
      // raked gravel
      ctx.fillStyle = lg(ctx, 0, hz, 0, h, [[0, '#d8d4c8'], [1, '#bdb7a8']]); ctx.fillRect(0, hz, w, h - hz);
      ctx.strokeStyle = 'rgba(120,112,95,.45)'; ctx.lineWidth = 1.2;
      for (let i = 1; i < 26; i++) { const y = hz + (h - hz) * Math.pow(i / 26, 1.5); ctx.beginPath(); for (let x = 0; x <= w; x += 12) ctx.lineTo(x, y + Math.sin(x / w * 18 + i) * 1.5 * (y - hz) / (h - hz)); ctx.stroke(); }
      [[0.12, 0.22, 0.09], [0.86, 0.3, 0.11], [0.5, 0.06, 0.05]].forEach(([x, yk, r]) => {
        const cx = w * x, cy = hz + (h - hz) * yk, rx = w * r, ry = rx * 0.32;
        ctx.fillStyle = '#d6d1c4'; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.9, ry * 1.9, 0, 0, 7); ctx.fill();
        for (let k = 1; k < 5; k++) { ctx.strokeStyle = 'rgba(120,112,95,.5)'; ctx.beginPath(); ctx.ellipse(cx, cy, rx * (1 + k * 0.22), ry * (1 + k * 0.22), 0, 0, 7); ctx.stroke(); }
        ctx.fillStyle = '#5d8a44'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
        ctx.fillStyle = lg(ctx, cx - rx, 0, cx + rx, 0, [[0, '#4a4a4c'], [0.4, '#8a8682'], [1, '#3a3a3c']]);
        ctx.beginPath(); ctx.moveTo(cx - rx * 0.6, cy); ctx.quadraticCurveTo(cx - rx * 0.5, cy - ry * 3.2, cx, cy - ry * 3.6); ctx.quadraticCurveTo(cx + rx * 0.55, cy - ry * 2.6, cx + rx * 0.65, cy); ctx.closePath(); ctx.fill();
      });
    }
    if (id === 'castle') {
      ctx.fillStyle = lg(ctx, 0, 0, 0, hz, [[0, '#060a1c'], [0.7, '#16204a'], [1, '#2a3060']]); ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) { ctx.fillStyle = `rgba(255,255,255,${R() * 0.7})`; ctx.fillRect(R() * w, R() * hz * 0.7, 1.3, 1.3); }
      const mx = w * 0.16, my = h * 0.16, mr = h * 0.07;
      const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 5); mg.addColorStop(0, 'rgba(210,220,255,.45)'); mg.addColorStop(1, 'rgba(210,220,255,0)');
      ctx.fillStyle = mg; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#eef0f8'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(140,150,190,.25)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(w * (0.1 + i * 0.22), h * (0.1 + (i % 2) * 0.08), w * 0.12, h * 0.018, 0, 0, 7); ctx.fill(); }
      // castle keep
      const cx = w * 0.58, base = hz - h * 0.02, bw = w * 0.34;
      ctx.fillStyle = lg(ctx, 0, base - h * 0.14, 0, base, [[0, '#4c4f5c'], [1, '#2c2e38']]);
      ctx.beginPath(); ctx.moveTo(cx - bw * 0.5, base); ctx.quadraticCurveTo(cx - bw * 0.42, base - h * 0.08, cx - bw * 0.36, base - h * 0.14); ctx.lineTo(cx + bw * 0.36, base - h * 0.14); ctx.quadraticCurveTo(cx + bw * 0.42, base - h * 0.08, cx + bw * 0.5, base); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - bw * 0.5 + i * 2, base - i * h * 0.023); ctx.lineTo(cx + bw * 0.5 - i * 2, base - i * h * 0.023); ctx.stroke(); }
      let y = base - h * 0.14, tw = bw * 0.62;
      for (let k = 0; k < 4; k++) {
        const th = h * (0.075 - k * 0.008);
        ctx.fillStyle = lg(ctx, cx - tw / 2, 0, cx + tw / 2, 0, [[0, '#b9bccb'], [0.5, '#e9ebf2'], [1, '#a4a8ba']]); ctx.fillRect(cx - tw / 2, y - th, tw, th);
        ctx.fillStyle = '#20222c'; for (let j = 0; j < 3 + (k < 2 ? 2 : 0); j++) ctx.fillRect(cx - tw / 2 + tw * (0.15 + j * 0.7 / (2 + (k < 2 ? 2 : 0))), y - th * 0.7, tw * 0.06, th * 0.35);
        ctx.fillStyle = 'rgba(255,190,110,.75)'; ctx.fillRect(cx - tw * 0.03, y - th * 0.68, tw * 0.06, th * 0.3);
        roofTier(ctx, cx, y - th, tw * 1.25, h * 0.045, '#1c2030');
        y -= th + h * 0.022; tw *= 0.78;
      }
      ctx.fillStyle = '#d4a842'; ctx.beginPath(); ctx.arc(cx - tw * 0.55, y + h * 0.012, 3, 0, 7); ctx.arc(cx + tw * 0.55, y + h * 0.012, 3, 0, 7); ctx.fill();
      // courtyard
      ctx.fillStyle = lg(ctx, 0, hz, 0, h, [[0, '#4a4440'], [1, '#1e1a18']]); ctx.fillRect(0, hz, w, h - hz);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < 12; i++) { const yy = hz + (h - hz) * Math.pow(i / 12, 1.7); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
      for (let i = -16; i <= 16; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.03, hz); ctx.lineTo(w / 2 + i * w * 0.13, h); ctx.stroke(); }
      [0.08, 0.92].forEach((x) => { ctx.fillStyle = '#2a1a10'; const bx = w * x; ctx.fillRect(bx - 3, hz + h * 0.02, 6, h * 0.16); ctx.beginPath(); ctx.moveTo(bx - 18, hz + h * 0.02); ctx.lineTo(bx + 18, hz + h * 0.02); ctx.lineTo(bx + 12, hz - h * 0.02); ctx.lineTo(bx - 12, hz - h * 0.02); ctx.fill(); });
    }
    if (id === 'snow') {
      ctx.fillStyle = lg(ctx, 0, 0, 0, hz, [[0, '#2b3a6a'], [0.55, '#8a8fbf'], [1, '#e9c7cf']]); ctx.fillRect(0, 0, w, h);
      // great peak
      ctx.fillStyle = lg(ctx, 0, hz * 0.2, 0, hz, [[0, '#7c86b0'], [1, '#4d5684']]);
      ctx.beginPath(); ctx.moveTo(w * 0.2, hz); ctx.lineTo(w * 0.47, hz * 0.22); ctx.lineTo(w * 0.53, hz * 0.22); ctx.lineTo(w * 0.85, hz); ctx.fill();
      ctx.fillStyle = '#f4f6ff'; ctx.beginPath(); ctx.moveTo(w * 0.38, hz * 0.45); ctx.lineTo(w * 0.47, hz * 0.22); ctx.lineTo(w * 0.53, hz * 0.22); ctx.lineTo(w * 0.63, hz * 0.45);
      for (let i = 0; i <= 8; i++) ctx.lineTo(w * (0.63 - i * 0.03125), hz * (0.45 + (i % 2 ? 0.06 : 0)));
      ctx.fill();
      // snowy pines
      for (let i = 0; i < 16; i++) { const x = R() * w, s2 = h * (0.06 + R() * 0.06), yb = hz + h * 0.01; ctx.fillStyle = '#20384a'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x, yb - s2 * (1.1 + k * 0.5)); ctx.lineTo(x + s2 * (0.6 - k * 0.12), yb - s2 * k * 0.45); ctx.lineTo(x - s2 * (0.6 - k * 0.12), yb - s2 * k * 0.45); ctx.fill(); } ctx.fillStyle = '#eef3ff'; ctx.beginPath(); ctx.moveTo(x, yb - s2 * 2.1); ctx.lineTo(x + s2 * 0.18, yb - s2 * 1.75); ctx.lineTo(x - s2 * 0.18, yb - s2 * 1.75); ctx.fill(); }
      // shrine hall
      const sx = w * 0.62, sb = hz + h * 0.02, sw2 = w * 0.22;
      ctx.fillStyle = '#5a2a1c'; ctx.fillRect(sx - sw2 / 2, sb - h * 0.1, sw2, h * 0.1);
      ctx.fillStyle = 'rgba(255,200,130,.55)'; ctx.fillRect(sx - sw2 * 0.15, sb - h * 0.08, sw2 * 0.3, h * 0.08);
      roofTier(ctx, sx, sb - h * 0.1, sw2 * 1.1, h * 0.09, '#2a2830');
      ctx.fillStyle = '#f3f6ff'; ctx.beginPath(); ctx.moveTo(sx - sw2 * 0.62, sb - h * 0.12); ctx.quadraticCurveTo(sx, sb - h * 0.215, sx + sw2 * 0.62, sb - h * 0.12); ctx.lineTo(sx + sw2 * 0.5, sb - h * 0.135); ctx.quadraticCurveTo(sx, sb - h * 0.2, sx - sw2 * 0.5, sb - h * 0.135); ctx.fill();
      torii(ctx, w * 0.22, hz + h * 0.06, w * 0.2, h * 0.24, '#c8321f');
      ctx.fillStyle = '#f3f6ff'; ctx.fillRect(w * 0.22 - w * 0.115, hz + h * 0.06 - h * 0.25, w * 0.23, h * 0.012);
      ctx.fillStyle = lg(ctx, 0, hz, 0, h, [[0, '#e8eefc'], [1, '#b9c4e4']]); ctx.fillRect(0, hz + h * 0.02, w, h - hz);
      ctx.fillStyle = 'rgba(150,165,210,.35)'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(R() * w, hz + h * 0.05 + R() * (h - hz) * 0.8, w * (0.05 + R() * 0.08), h * 0.01, 0, 0, 7); ctx.fill(); }
      lantern(ctx, w * 0.08, hz + h * 0.1, h * 0.0024); lantern(ctx, w * 0.92, hz + h * 0.1, h * 0.0024);
    }
    statics[key] = cv;
    return cv;
  }

  /* particle systems per arena */
  JK.makeArenaFx = function (id) {
    const parts = [];
    const n = { temple: 14, bamboo: 22, torii: 34, pagoda: 60, dojo: 10, zen: 16, castle: 40, snow: 110 }[id] || 0;
    for (let i = 0; i < n; i++) parts.push({ x: Math.random(), y: Math.random(), v: 0.3 + Math.random(), r: Math.random() * 6.28, s: 0.6 + Math.random() * 0.8 });
    return parts;
  };

  JK.drawArena = function (ctx, id, w, h, t, fx) {
    ctx.drawImage(paintStatic(id, Math.round(w), Math.round(h)), 0, 0, w, h);
    const hz = h * 0.6;
    if (id === 'dojo') {
      // hanging lanterns with flicker
      [0.15, 0.5, 0.85].forEach((x, i) => {
        const fl = 0.85 + Math.sin(t * 9 + i * 2) * 0.05 + Math.sin(t * 23 + i) * 0.03;
        const lx = w * x, ly = h * 0.2;
        const gl = ctx.createRadialGradient(lx, ly, 4, lx, ly, h * 0.35);
        gl.addColorStop(0, `rgba(255,190,100,${0.35 * fl})`); gl.addColorStop(1, 'rgba(255,190,100,0)');
        ctx.fillStyle = gl; ctx.fillRect(lx - h * 0.35, ly - h * 0.35, h * 0.7, h * 0.7);
        ctx.strokeStyle = '#1a0f08'; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly - h * 0.05); ctx.stroke();
        ctx.fillStyle = `rgba(230,${Math.round(90 + 40 * fl)},50,1)`; ctx.beginPath(); ctx.ellipse(lx, ly, h * 0.03, h * 0.045, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a0f08'; ctx.fillRect(lx - h * 0.02, ly - h * 0.05, h * 0.04, h * 0.008); ctx.fillRect(lx - h * 0.02, ly + h * 0.043, h * 0.04, h * 0.008);
        const fg = ctx.createRadialGradient(lx, hz + (h - hz) * 0.35, 2, lx, hz + (h - hz) * 0.35, h * 0.15);
        fg.addColorStop(0, `rgba(255,200,120,${0.22 * fl})`); fg.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = fg; ctx.fillRect(lx - h * 0.2, hz, h * 0.4, h - hz);
      });
    }
    if (id === 'castle') {
      [0.08, 0.92].forEach((x, i) => {
        const fl = 0.8 + Math.sin(t * 11 + i * 3) * 0.12 + Math.sin(t * 27 + i) * 0.06, bx = w * x, by = hz - h * 0.03;
        const gl = ctx.createRadialGradient(bx, by, 2, bx, by, h * 0.3);
        gl.addColorStop(0, `rgba(255,170,80,${0.45 * fl})`); gl.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = gl; ctx.fillRect(bx - h * 0.3, by - h * 0.3, h * 0.6, h * 0.6);
        ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(bx - 12, by); ctx.quadraticCurveTo(bx - 6, by - h * 0.05 * fl, bx, by - h * 0.07 * fl); ctx.quadraticCurveTo(bx + 6, by - h * 0.05 * fl, bx + 12, by); ctx.fill();
        ctx.fillStyle = '#fff1c2'; ctx.beginPath(); ctx.moveTo(bx - 5, by); ctx.quadraticCurveTo(bx, by - h * 0.035 * fl, bx + 5, by); ctx.fill();
      });
    }
    if (!fx) return;
    fx.forEach((p) => {
      let x, y;
      if (id === 'snow') {
        y = ((p.y + t * 0.035 * p.v) % 1.02) * h; x = ((p.x + Math.sin(t * 0.8 + p.r) * 0.02) % 1) * w;
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x, y, 1.6 * p.s * (h / 700), 0, 7); ctx.fill();
      } else if (id === 'castle') {
        y = (1 - ((p.y + t * 0.04 * p.v) % 1)) * h; x = (p.x + Math.sin(t + p.r) * 0.01) * w;
        ctx.fillStyle = `rgba(255,${150 + Math.round(p.s * 60)},80,${0.5 + 0.4 * Math.sin(t * 5 + p.r)})`; ctx.beginPath(); ctx.arc(x, y, 1.4 * p.s, 0, 7); ctx.fill();
      } else if (id === 'pagoda' || id === 'torii' || id === 'bamboo' || id === 'temple' || id === 'zen') {
        y = ((p.y + t * 0.05 * p.v) % 1.05) * h;
        x = ((p.x + Math.sin(t * 0.7 + p.r) * 0.03 + t * 0.02 * p.v) % 1) * w;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * p.v + p.r);
        if (id === 'pagoda') { ctx.fillStyle = 'rgba(255,200,220,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 4 * p.s, 2.4 * p.s, 0, 0, 7); ctx.fill(); }
        else if (id === 'torii' || id === 'zen') { ctx.fillStyle = ['#d24a1f', '#e7832a', '#b3261e'][Math.floor(p.r) % 3]; ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = k * 1.2566; ctx.lineTo(Math.cos(a) * 6 * p.s, Math.sin(a) * 6 * p.s); ctx.lineTo(Math.cos(a + 0.63) * 2.5 * p.s, Math.sin(a + 0.63) * 2.5 * p.s); } ctx.fill(); }
        else if (id === 'bamboo') { ctx.fillStyle = 'rgba(150,200,120,.8)'; ctx.beginPath(); ctx.ellipse(0, 0, 7 * p.s, 1.6 * p.s, 0, 0, 7); ctx.fill(); }
        else { ctx.fillStyle = 'rgba(255,220,160,.6)'; ctx.beginPath(); ctx.arc(0, 0, 1.4 * p.s, 0, 7); ctx.fill(); }
        ctx.restore();
      } else {
        x = p.x * w; y = h * 0.3 + Math.sin(t * p.v + p.r) * h * 0.2;
        ctx.fillStyle = 'rgba(255,210,140,.35)'; ctx.beginPath(); ctx.arc(x, y, 1.5 * p.s, 0, 7); ctx.fill();
      }
    });
    if (id === 'bamboo') {
      ctx.fillStyle = `rgba(200,240,210,${0.08 + Math.sin(t * 0.5) * 0.03})`; ctx.fillRect(0, hz - h * 0.1, w, h * 0.3);
    }
  };

})();
