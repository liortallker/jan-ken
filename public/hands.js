/* Jan-Ken hands: large anime-style hand illustrations for the reveal cut-in and the choice cards.
   Canonical frame: wrist at (0,0), fingers point up (-y), palm/front faces the viewer, thumb on +x. */
(function () {
  const JK = (window.JK = window.JK || {});
  const mix = JK.mix;
  const LIGHT = [-0.5, -0.86];

  function smooth(pts, closed = true) {
    const path = new Path2D(), n = pts.length;
    const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    path.moveTo(pts[0][0], pts[0][1]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = p2[2] ? p2 : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
    }
    if (closed) path.closePath();
    return path;
  }
  function seg(a, b, wa, wm, wb) {
    const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]) || 1, u = [d[0] / l, d[1] / l], n = [-u[1], u[0]];
    const m = [a[0] + d[0] * 0.45, a[1] + d[1] * 0.45];
    const P = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];
    return smooth([P(a, n, wa), P(m, n, wm), P(b, n, wb), P(b, u, wb * 0.95), P(b, n, -wb), P(m, n, -wm), P(a, n, -wa), P(a, u, -wa * 0.6)]);
  }
  const ell = (x, y, rx, ry, r = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, r, 0, Math.PI * 2); return p; };
  const shade = (c) => mix(c, '#3a1f3c', 0.38);
  const lite = (c) => mix(c, '#fffaf2', 0.5);

  function cel(ctx, pt, ink) {
    ctx.save(); ctx.clip(pt.p);
    ctx.fillStyle = shade(pt.c); ctx.fill(pt.p);
    const k = pt.k || 7;
    ctx.translate(LIGHT[0] * k, LIGHT[1] * k);
    const g = ctx.createLinearGradient(0, -200, 0, 60);
    g.addColorStop(0, mix(pt.c, '#fffaf2', 0.1)); g.addColorStop(1, mix(pt.c, '#2a1a30', 0.1));
    ctx.fillStyle = g; ctx.fill(pt.p);
    ctx.translate(-LIGHT[0] * (k + 3), -LIGHT[1] * (k + 3));
    ctx.globalAlpha = 0.5; ctx.lineWidth = 3.2; ctx.strokeStyle = lite(pt.c); ctx.stroke(pt.p);
    ctx.restore();
    if (pt.line) { ctx.lineWidth = pt.line; ctx.strokeStyle = ink; ctx.stroke(pt.p); }
  }
  function render(ctx, parts, ink) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = ink; ctx.lineWidth = 5.2;
    parts.forEach((pt) => pt.p && !pt.noInk && ctx.stroke(pt.p));
    ctx.save(); ctx.translate(-LIGHT[0] * 1.6, -LIGHT[1] * 1.6); parts.forEach((pt) => pt.p && !pt.noInk && ctx.stroke(pt.p)); ctx.restore();
    parts.forEach((pt) => { if (pt.fn) { ctx.save(); pt.fn(ctx); ctx.restore(); } else cel(ctx, pt, ink); });
  }
  const crease = (ctx, ink, pts, a = 0.5, w = 1.6) => { ctx.save(); ctx.strokeStyle = ink; ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke(smooth(pts, false)); ctx.restore(); };

  /* per-fighter hand styling */
  JK.HAND_STYLE = {
    hikari: { skin: '#f7dccb', ink: '#3a1c1c', nail: '#f6c6c0', sleeve: '#f8f5ef', kind: 'wide', cuff: '#c8341f', extra: 'cord' },
    kagero: { skin: '#eccdb8', ink: '#0c0910', glove: '#231c2b', sleeve: '#1d1823', kind: 'guard', guard: '#6b2f86', trim: '#d4a54e' },
    tetsuo: { skin: '#c98f68', ink: '#24170f', nail: '#e2b08f', kind: 'wrap', wrap: '#efe9dc', pad: '#a8161f', extra: 'scar' },
    hayato: { skin: '#f0cdb2', ink: '#0d1220', nail: '#f7d6cc', sleeve: '#22304f', kind: 'cuff', cuff: '#e9e6df' },
    shin: { skin: '#c99572', ink: '#141018', nail: '#e0b49a', sleeve: '#6b4a2e', kind: 'cuff', cuff: '#2e2116', extra: 'rough' },
    gonta: { skin: '#e2b48e', ink: '#26170f', nail: '#f1cdb4', kind: 'none', scale: 1.16, thick: 1.18 },
    daigo: { skin: '#d8ab88', ink: '#231a12', nail: '#e9c7ac', sleeve: '#f1ece0', kind: 'cuff', cuff: '#b9ad8c', extra: 'beads' },
    yuki: { skin: '#fbeef0', ink: '#2a3a52', nail: '#cfeaf8', sleeve: '#f2f7fb', kind: 'wide', cuff: '#9fd3f0', extra: 'frost' },
    akane: { skin: '#efc3a4', ink: '#2a1210', nail: '#f4cdb8', kind: 'wrap', wrap: '#f4efe6' },
    koharu: { skin: '#f7dccb', ink: '#2a1020', nail: '#f3a6c0', sleeve: '#7a2a5c', kind: 'wide', cuff: '#f0c060' },
    kenji: { skin: '#e6b896', ink: '#0e1020', glove: '#1d2546', sleeve: '#26305a', kind: 'cuff', cuff: '#7a1f1a' },
    matsu: { skin: '#dba889', ink: '#141020', nail: '#efc6ad', sleeve: '#2a5aa8', kind: 'cuff', cuff: '#f4efe6' },
    tsumuji: { skin: '#f2dccd', ink: '#0c2a28', nail: '#bfe6dc', sleeve: '#1f6f6a', kind: 'wide', cuff: '#e0f4ef', extra: 'frost' },
  };

  function sleeveParts(L, st, th) {
    const ink = st.ink;
    if (st.kind === 'wide') {
      L.push({ p: smooth([[-46 * th, 46], [50 * th, 46], [96, 130], [112, 260], [-120, 260], [-92, 130]]), c: st.sleeve, k: 10 });
      L.push({ fn: (c) => { c.strokeStyle = st.cuff; c.lineWidth = 7; c.beginPath(); c.moveTo(-44 * th, 52); c.quadraticCurveTo(4, 60, 48 * th, 52); c.stroke(); crease(c, ink, [[-60, 110], [-40, 170], [-56, 240]], 0.35, 1.8); crease(c, ink, [[44, 100], [56, 170], [40, 240]], 0.35, 1.8); } });
    } else if (st.kind === 'cuff') {
      L.push({ p: smooth([[-46 * th, 58], [48 * th, 58], [60, 260], [-58, 260]]), c: st.sleeve, k: 9 });
      L.push({ p: smooth([[-48 * th, 54], [50 * th, 54], [52 * th, 70], [-50 * th, 70]]), c: st.cuff, k: 3, line: 1.4 });
      L.push({ fn: (c) => { crease(c, ink, [[-20, 90], [-30, 160], [-18, 240]], 0.3, 1.8); if (st.sleeve === '#f1ece0') { c.save(); c.strokeStyle = '#9c8a64'; c.globalAlpha = 0.35; c.lineWidth = 1.2; for (let y = 80; y < 260; y += 14) { c.beginPath(); c.moveTo(-60, y); c.lineTo(60, y); c.stroke(); } for (let x = -50; x < 60; x += 14) { c.beginPath(); c.moveTo(x, 70); c.lineTo(x, 260); c.stroke(); } c.restore(); } } });
    } else if (st.kind === 'guard') {
      L.push({ p: seg([0, 20], [0, 260], 36, 40, 44), c: st.sleeve, k: 8 });
      L.push({ p: smooth([[-38, 34], [40, 34], [48, 160], [-44, 160]]), c: st.guard, k: 8, line: 1.6 });
      L.push({ fn: (c) => { c.strokeStyle = st.trim; c.lineWidth = 3; c.beginPath(); c.moveTo(-36, 44); c.lineTo(38, 44); c.moveTo(-40, 150); c.lineTo(44, 150); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-16, 56); c.lineTo(-20, 138); c.stroke(); } });
    } else if (st.kind === 'wrap') {
      L.push({ p: seg([0, 14], [0, 120], 37, 39, 41), c: st.wrap, k: 6, line: 1.4 });
      L.push({ fn: (c) => { c.strokeStyle = st.ink; c.globalAlpha = 0.4; c.lineWidth = 1.4; for (let y = 22; y < 118; y += 13) { c.beginPath(); c.moveTo(-38, y + 8); c.lineTo(40, y - 4); c.stroke(); } } });
    }
  }

  function handParts(L, gesture, st, th) {
    const skin = st.glove || st.skin, nail = st.glove ? mix(st.glove, '#6b2f86', 0.25) : st.nail, ink = st.ink;
    const F = (a, b, wa, wb, o) => Object.assign({ p: seg(a, b, wa * th, ((wa + wb) / 2) * th * 1.04, wb * th), c: skin, k: 5 }, o || {});
    const palm = smooth([[-33 * th, 6], [-41 * th, -36], [-40 * th, -72], [-33 * th, -86], [-14, -98], [8, -102], [31 * th, -94], [40 * th, -74], [42 * th, -46], [45 * th, -26], [36 * th, 6]]);
    // forearm
    L.push({ p: seg([0, 0], [0, 240], 34 * th, 37 * th, 41 * th), c: st.kind === 'guard' ? st.sleeve : st.skin, k: 9 });
    const fingerCreases = (pairs) => L.push({ fn: (c) => pairs.forEach(([a, b, w]) => [0.36, 0.66].forEach((t) => {
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]), n = [-d[1] / l, d[0] / l];
      crease(c, ink, [[x + n[0] * w * 0.6, y + n[1] * w * 0.6], [x + d[0] / l * 2, y + d[1] / l * 2], [x - n[0] * w * 0.6, y - n[1] * w * 0.6]], 0.45, 1.5);
    })) });
    if (gesture === 'paper' || gesture === 'scissors') {
      const fingers = gesture === 'paper'
        ? [[[28, -88], [46, -176], 12.5, 10], [[7, -96], [9, -194], 13, 10.5], [[-14, -92], [-27, -180], 12, 9.8], [[-33, -80], [-58, -148], 10.5, 8.5]]
        : [[[28, -88], [64, -180], 12.5, 10], [[7, -96], [-10, -190], 13, 10.5]];
      fingers.forEach(([a, b, wa, wb]) => L.push(F(a, b, wa, wb)));
      L.push({ p: palm, c: skin, k: 9 });
      if (gesture === 'paper') { L.push(F([36, -26], [64, -60], 15, 13)); L.push(F([62, -58], [84, -98], 13, 11)); }
      else {
        L.push(F([-14 * th, -92], [-12 * th, -54], 12, 11.5, { line: 1.6 }));
        L.push(F([-33 * th, -80], [-30 * th, -48], 10.5, 10, { line: 1.6 }));
        L.push(F([40 * th, -24], [-2, -52], 15, 12, { line: 1.8 }));
        if (!st.glove) L.push({ p: ell(2, -52, 7, 5, -0.5), c: nail, k: 2, line: 1.1 });
      }
      L.push({ fn: (c) => {
        crease(c, ink, [[-36, -68], [-12, -76], [14, -80], [30, -86]], 0.5, 1.8);
        crease(c, ink, [[-30, -50], [-4, -58], [22, -66]], 0.45, 1.6);
        crease(c, ink, [[34, -76], [18, -56], [13, -30], [18, -4]], 0.5, 1.8);
        if (gesture === 'paper') crease(c, ink, [[40, -30], [52, -46], [62, -58]], 0.35, 1.5);
        crease(c, ink, [[-24, 2], [0, 6], [24, 2]], 0.3, 1.4);
      } });
      fingerCreases(fingers.map(([a, b, w]) => [a, b, w]).concat(gesture === 'paper' ? [[[62, -58], [84, -98], 13]] : []));
    } else {
      // rock: curled fist seen from the front, thumb wrapped across the fingers
      L.push({ p: smooth([[-34 * th, 8], [-40 * th, -34], [-46 * th, -70], [-44 * th, -104], [-30 * th, -122], [-6, -128], [18, -126], [38 * th, -118], [50 * th, -98], [52 * th, -62], [46 * th, -30], [36 * th, 8]]), c: skin, k: 9 });
      [[31, -118, -66, 11], [9, -126, -68, 11.5], [-13, -122, -70, 11], [-32, -110, -72, 9.5]].forEach(([x, top, bot, w]) => {
        L.push(F([x * th, top], [x * th, bot], w, w * 0.95, { line: 1.6, k: 4 }));
        if (!st.glove) L.push({ p: ell(x * th, bot - 1, w * 0.62 * th, 4.2), c: nail, k: 2, line: 1.1 });
      });
      L.push(F([52 * th, -40], [6, -64], 14.5, 11.5, { line: 1.8 }));
      if (!st.glove) L.push({ p: ell(10, -64, 7, 5, -0.4), c: nail, k: 2, line: 1.1 });
      L.push({ fn: (c) => {
        [31, 9, -13, -32].forEach((x, i) => crease(c, ink, [[x * th - 8, -96 + (i === 3 ? 8 : 0)], [x * th, -92 + (i === 3 ? 8 : 0)], [x * th + 8, -96 + (i === 3 ? 8 : 0)]], 0.45, 1.5));
        crease(c, ink, [[46, -26], [30, -18], [14, -24]], 0.4, 1.5);
        crease(c, ink, [[-24, 2], [0, 6], [24, 2]], 0.3, 1.4);
      } });
    }
  }

  function extras(L, gesture, st, th, t) {
    const ink = st.ink;
    if (st.pad) L.push({ fn: (c) => {
      const band = gesture === 'rock' ? smooth([[-48, -130], [56, -130], [56, -78], [-48, -78]]) : smooth([[-46, -40], [48, -40], [48, -6], [-46, -6]]);
      c.save(); c.globalAlpha = 0.96;
      c.strokeStyle = ink; c.lineWidth = 2;
      const clip = gesture === 'rock' ? smooth([[-34, 8], [-40, -34], [-46, -70], [-44, -104], [-30, -122], [-6, -128], [18, -126], [38, -118], [50, -98], [52, -62], [46, -30], [36, 8]]) : smooth([[-33, 6], [-41, -36], [-40, -72], [-33, -86], [-14, -98], [8, -102], [31, -94], [40, -74], [42, -46], [45, -26], [36, 6]]);
      c.clip(clip); c.fillStyle = st.pad; c.fill(band); c.stroke(band);
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-40, gesture === 'rock' ? -126 : -36, 80, 5);
      c.restore();
    } });
    if (st.extra === 'cord') L.push({ fn: (c) => { c.strokeStyle = '#c8341f'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(-36, 18); c.quadraticCurveTo(0, 26, 38, 18); c.moveTo(-36, 26); c.quadraticCurveTo(0, 34, 38, 26); c.stroke(); c.fillStyle = '#c8341f'; c.beginPath(); c.arc(30, 24, 5, 0, 7); c.fill(); c.lineWidth = 2.4; c.beginPath(); c.moveTo(30, 28); c.lineTo(36, 52); c.moveTo(30, 28); c.lineTo(26, 54); c.stroke(); } });
    if (st.extra === 'beads') L.push({ fn: (c) => { for (let i = 0; i < 9; i++) { const x = -40 + i * 10, y = 22 + Math.sin(i * 0.4) * 2; c.fillStyle = i === 4 ? '#7a1f1a' : '#6b4226'; c.strokeStyle = ink; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, 5.6, 0, 7); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,230,190,.5)'; c.beginPath(); c.arc(x - 1.6, y - 1.8, 1.6, 0, 7); c.fill(); } } });
    if (st.extra === 'scar') L.push({ fn: (c) => { c.strokeStyle = 'rgba(120,40,40,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-28, -40); c.lineTo(-6, -16); c.stroke(); } });
    if (st.extra === 'rough') L.push({ fn: (c) => { c.strokeStyle = 'rgba(80,40,30,.45)'; c.lineWidth = 1.4; [[-20, 40, -6, 70], [10, 60, 22, 96]].forEach(([a, b, cc, d]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(cc, d); c.stroke(); }); } });
    if (st.extra === 'frost') L.push({ fn: (c) => {
      const g = c.createLinearGradient(0, -200, 0, -100); g.addColorStop(0, 'rgba(160,215,245,.6)'); g.addColorStop(1, 'rgba(160,215,245,0)');
      c.fillStyle = g; L.forEach((pt) => { if (pt.p && pt.c !== st.sleeve) { c.save(); c.clip(pt.p); c.fillRect(-120, -220, 260, 130); c.restore(); } });
      for (let i = 0; i < 9; i++) { const a = t * 0.8 + i * 0.7, x = Math.cos(a) * (70 + (i % 3) * 20), y = -120 + Math.sin(a * 1.3) * 70; c.fillStyle = 'rgba(235,248,255,.9)'; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 2.4, y); c.lineTo(x, y + 6); c.lineTo(x - 2.4, y); c.fill(); }
    } });
    if (st.glove) L.push({ fn: (c) => { c.strokeStyle = 'rgba(190,150,230,.45)'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-26, -40); c.quadraticCurveTo(-30, -80, -18, -96); c.stroke(); } });
  }

  /* o: { x, y, s, rot, flip, t, glow, dim } */
  JK.drawHand = function (ctx, fid, gesture, o) {
    const st = JK.HAND_STYLE[fid] || JK.HAND_STYLE.hikari, th = st.thick || 1, k = st.scale || 1;
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.scale(o.s * k * (o.flip ? -1 : 1) * (o.sx || 1), o.s * k * (o.sy || 1));
    if (o.glow) {
      const g = ctx.createRadialGradient(0, -110, 10, 0, -110, 190);
      g.addColorStop(0, `rgba(${o.glow},.55)`); g.addColorStop(1, `rgba(${o.glow},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -110, 190, 0, 7); ctx.fill();
    }
    const L = [];
    handParts(L, gesture, st, th);
    sleeveParts(L, st, th);
    extras(L, gesture, st, th, o.t || 0);
    render(ctx, L, st.ink);
    if (o.dim) { ctx.fillStyle = `rgba(20,14,30,${o.dim})`; L.forEach((pt) => pt.p && ctx.fill(pt.p)); }
    ctx.restore();
  };
})();
