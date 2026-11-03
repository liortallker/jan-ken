/* Jan-Ken fighters: anime-style procedural characters.
   Ink outlines that merge per body layer, two-tone cel shading, rim light tinted by the arena,
   expressive faces, and secondary motion for hair, scarves, sleeves and belt tails. */
(function () {
  const JK = (window.JK = window.JK || {});
  const D2R = Math.PI / 180;
  const LEN = { torso: 52, neck: 8, ua: 29, fa: 27, th: 42, sh: 40 };
  const LIGHT = [0.55, -0.83];
  let RIM = null;

  /* ---------- color + vector helpers */
  function rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  const shade = (c) => mix(c, '#2b1a3c', 0.4);
  const lite = (c) => mix(c, '#fffaf0', 0.5);
  JK.mix = mix;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const dir = (deg) => [Math.sin(deg * D2R), Math.cos(deg * D2R)];
  const sharp = (p) => [p[0], p[1], 1];

  /* Catmull-Rom closed/open path; points with a 3rd element are sharp corners */
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
  function limbPath(a, b, wa, wm, wb, at = 0.42, bias = 0) {
    const d = sub(b, a), l = Math.hypot(d[0], d[1]) || 1, u = [d[0] / l, d[1] / l], n = [-u[1], u[0]];
    const m = lerp(a, b, at);
    return smooth([
      add(a, mul(n, wa)), add(m, mul(n, wm * (1 + bias))), add(b, mul(n, wb)), add(b, mul(u, wb * 0.92)),
      add(b, mul(n, -wb)), add(m, mul(n, -wm * (1 - bias))), add(a, mul(n, -wa)), add(a, mul(u, -wa * 0.92)),
    ]);
  }
  const circle = (c, r) => { const p = new Path2D(); p.arc(c[0], c[1], r, 0, Math.PI * 2); return p; };
  const ellipse = (c, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(c[0], c[1], rx, ry, rot, 0, Math.PI * 2); return p; };
  const polyPath = (pts) => { const p = new Path2D(); pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); return p; };
  const P = (p, c, o) => Object.assign({ p, c }, o || {});
  function xform(path, J) { const out = new Path2D(); out.addPath(path, new DOMMatrix().translate(J.head[0], J.head[1]).rotate(J.ha / D2R)); return out; }

  /* two-tone cel fill + rim highlight */
  function cel(ctx, pt) {
    const base = pt.c;
    ctx.save();
    ctx.clip(pt.p);
    ctx.fillStyle = pt.s || shade(base);
    ctx.fill(pt.p);
    const k = pt.k == null ? 3 : pt.k;
    ctx.translate(LIGHT[0] * k, LIGHT[1] * k);
    ctx.fillStyle = base;
    ctx.fill(pt.p);
    if (pt.hi === false) { ctx.restore(); return; }
    ctx.translate(-LIGHT[0] * (k + 1.2), -LIGHT[1] * (k + 1.2));
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = RIM ? mix(lite(base), RIM, 0.5) : lite(base);
    ctx.stroke(pt.p);
    ctx.restore();
  }
  /* a layer: outer ink first (so overlapping parts merge into one silhouette), then fills */
  function group(ctx, parts, ink, lw = 3.2) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = ink; ctx.lineWidth = lw;
    for (const pt of parts) if (pt.p && !pt.noInk) ctx.stroke(pt.p);
    for (const pt of parts) {
      if (pt.fn) { ctx.save(); pt.fn(ctx); ctx.restore(); continue; }
      if (pt.flat) { ctx.fillStyle = pt.c; ctx.fill(pt.p); } else cel(ctx, pt);
      if (pt.line) { ctx.lineWidth = pt.line; ctx.strokeStyle = ink; ctx.stroke(pt.p); }
    }
  }
  function brush(ctx, a, b, color, w) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.9 - i * 0.25; ctx.lineWidth = w - i * 1.5;
      const m = lerp(a, b, 0.5);
      ctx.beginPath(); ctx.moveTo(a[0] + i, a[1] - i * 1.5); ctx.quadraticCurveTo(m[0] + 5 - i * 2, m[1] - 3, b[0] - i, b[1] + i); ctx.stroke();
    }
    ctx.restore();
  }
  function flakes(ctx, pts, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    pts.forEach((p) => { for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(p[0] - Math.cos(a) * 3, p[1] - Math.sin(a) * 3); ctx.lineTo(p[0] + Math.cos(a) * 3, p[1] + Math.sin(a) * 3); ctx.stroke(); } });
    ctx.restore();
  }

  /* ---------- roster */
  const BODY = {
    male: { sh: 40, ch: 34, wa: 27, hip: 30, ua: [6.6, 7.4, 5.4], fa: [5.6, 6, 3.9], th: [9.6, 9.8, 6.4], shn: [6.6, 7, 4.1], hand: 1, foot: 1, leg: 1, tl: 1, neck: 1, face: 'male' },
    fem: { sh: 32, ch: 29, wa: 21.5, hip: 30, ua: [5, 5.4, 4.1], fa: [4.2, 4.4, 3.1], th: [8.6, 8.4, 5.4], shn: [5.6, 5.8, 3.4], hand: 0.88, foot: 0.9, leg: 1.03, tl: 0.96, neck: 0.85, face: 'fem' },
    muscle: { sh: 46, ch: 40, wa: 29, hip: 32, ua: [7.8, 9, 6.4], fa: [6.6, 7.2, 4.6], th: [10.4, 10.8, 7], shn: [7.2, 7.8, 4.6], hand: 1.08, foot: 1.05, leg: 0.98, tl: 1, neck: 1.2, face: 'square' },
    lean: { sh: 37, ch: 31, wa: 24.5, hip: 28, ua: [5.8, 6.4, 4.8], fa: [5, 5.3, 3.6], th: [8.8, 9, 5.9], shn: [6, 6.4, 3.8], hand: 0.96, foot: 0.98, leg: 1.08, tl: 1.04, neck: 0.95, face: 'angular' },
    heavy: { sh: 52, ch: 48, wa: 48, hip: 46, ua: [9.5, 10.5, 8], fa: [7.6, 8.2, 5.6], th: [14, 14.5, 10], shn: [9.4, 9.8, 6.6], hand: 1.2, foot: 1.2, leg: 0.9, tl: 1.02, neck: 1.5, face: 'heavy' },
  };
  JK.FIGHTERS = [
    { id: 'hikari', name: 'HIKARI', style: 'Shrine Ceremonial Arts', stance: 'Upright crane stance', idle: 'crane', stats: { speed: 3, poise: 5, weight: 2 },
      desc: 'Ceremonial white robes over vermilion hakama, a broad gold obi and braided cords. Patient, precise, untouchable.',
      c: { skin: '#f7dccb', hair: '#1c1519', eye: '#8a2b2b', top: '#f8f5ef', top2: '#c8341f', pants: '#c8341f', belt: '#dca935', cord: '#c8341f', accent: '#c8341f', trim: '#dca935', feet: '#f8f5ef', ink: '#2a1418' },
      b: { body: 'fem', top: 'miko', sleeve: 'wide', legs: 'hakama', feet: 'zori', hair: 'miko', belt: 'obi', fem: true, scale: 0.95, eye: 'round', eyeK: 1.12 } },
    { id: 'kagero', name: 'KAGERO', style: 'Shadow Kunoichi', stance: 'Low-centered combat crouch', idle: 'crouch', stats: { speed: 5, poise: 3, weight: 2 },
      desc: 'Lacquered plum-and-black armor plates, a crescent-moon crest, forearm guards and a trailing ochre scarf.',
      c: { skin: '#eccdb8', hair: '#d2cde0', eye: '#8f45b0', top: '#1e1824', pants: '#1e1824', accent: '#6b2f86', trim: '#d4a54e', feet: '#17131b', hands: '#17131b', ink: '#0c0910' },
      b: { body: 'fem', top: 'armor', sleeve: 'tight', legs: 'tight', feet: 'tabi', hair: 'kagero', mask: true, scarf: true, fem: true, scale: 0.9, eye: 'sharp', eyeK: 1.05 } },
    { id: 'tetsuo', name: 'TETSUO', style: 'Brushstroke Karate', stance: 'Grounded orthodox guard', idle: 'guard', stats: { speed: 3, poise: 4, weight: 4 },
      desc: 'A sleeveless white gi swept with crimson brushstrokes, bandaged forearms and red hand guards. Built like a stone wall.',
      c: { skin: '#c98f68', hair: '#21160f', eye: '#3a2416', top: '#f5f3ef', pants: '#f5f3ef', belt: '#141414', accent: '#a8161f', hands: '#a8161f', ink: '#24170f' },
      b: { body: 'muscle', top: 'gi', sleeve: 'none', legs: 'gi', feet: 'bare', hair: 'tetsuo', belt: 'belt', pattern: 'brush', wraps: true, scale: 1.02, eye: 'sharp', eyeK: 0.9, brow: 2.6, mark: 'scar' } },
    { id: 'hayato', name: 'HAYATO', style: 'Jujutsu Arts', stance: 'Upright ready stance', idle: 'ready', stats: { speed: 4, poise: 4, weight: 3 },
      desc: 'Tall and lean in a deep navy uniform with crisp white lapels, a long fringe falling over one eye. Every motion measured and clean.',
      c: { skin: '#f0cdb2', hair: '#14161f', eye: '#2c3550', top: '#22304f', lapel: '#e9e6df', pants: '#22304f', belt: '#0d0d0d', ink: '#0d1220' },
      b: { body: 'lean', top: 'gi', sleeve: 'gi', legs: 'gi', feet: 'bare', hair: 'hayato', belt: 'belt', scale: 1.07, eye: 'narrow', eyeK: 0.95 } },
    { id: 'shin', name: 'SHIN', style: 'Wandering Ronin', stance: 'Relaxed drifter guard', idle: 'drifter', unlock: 1, stats: { speed: 4, poise: 5, weight: 3 },
      desc: 'A weathered brown kimono worn loose over striped hakama, a straw hat slung across the back. Calm until the very last instant.',
      c: { skin: '#c99572', hair: '#1a1414', eye: '#4a3328', top: '#6b4a2e', top2: '#d9d2c2', pants: '#7d7f86', belt: '#2a2020', accent: '#6b4a2e', feet: '#e8e2d4', ink: '#141018' },
      b: { body: 'male', top: 'kimono', sleeve: 'kimono', legs: 'hakama', feet: 'zori', hair: 'shin', belt: 'belt', hat: true, stubble: true, pattern: 'stripes', scale: 1.03, eye: 'narrow', eyeK: 0.92, mark: 'scarEye' } },
    { id: 'gonta', name: 'GONTA', style: 'Mountain Wrestler', stance: 'Wide planted squat', idle: 'shiko', unlock: 2, stats: { speed: 2, poise: 4, weight: 5 },
      desc: 'Topknot, braided ceremonial rope and a deep-blue belt wrap. When he plants his feet, the mountain moves first.',
      c: { skin: '#e2b48e', hair: '#16110e', eye: '#3a2416', top: '#e2b48e', pants: '#e2b48e', ink: '#26170f' },
      b: { body: 'heavy', top: 'bare', sleeve: 'none', legs: 'bare', feet: 'bare', hair: 'gonta', scale: 1.08, eye: 'kind', eyeK: 0.82, brow: 2.4 } },
    { id: 'daigo', name: 'DAIGO', style: 'Mountain Ascetic', stance: 'Single-hand prayer stance', idle: 'prayer', unlock: 3, stats: { speed: 3, poise: 5, weight: 3 },
      desc: 'Checkered pilgrim robes, a tiny black cap and a sash of bright orange pom-poms. Fights with the stillness of the peaks.',
      c: { skin: '#d8ab88', hair: '#b9b4ab', eye: '#3a3026', top: '#f1ece0', pants: '#e4ddcc', belt: '#ece6d6', feet: '#f1ece0', ink: '#231a12' },
      b: { body: 'male', top: 'yamabushi', sleeve: 'gi', legs: 'gi', feet: 'tabi', hair: 'daigo', belt: 'belt', beard: true, pattern: 'checker', scale: 0.97, eye: 'kind', eyeK: 0.85, brow: 2.8, mark: 'wrinkles' } },
    { id: 'yuki', name: 'YUKI', style: 'Snowfall Spirit', stance: 'Floating drift stance', idle: 'drift', unlock: 4, stats: { speed: 5, poise: 4, weight: 1 },
      desc: 'A pale kimono patterned with ice crystals, an ice-blue obi and a river of white hair. The air turns cold before she moves.',
      c: { skin: '#fbeef0', hair: '#eef3fb', eye: '#3f9fd6', top: '#f2f7fb', top2: '#9fd3f0', lapel: '#cfe8f6', pants: '#f2f7fb', belt: '#7cc3e8', cord: '#ffffff', accent: '#9fd3f0', feet: '#ffffff', ink: '#2a3a52' },
      b: { body: 'fem', top: 'kimono', sleeve: 'wide', legs: 'robe', feet: 'tabi', hair: 'yuki', belt: 'obi', fem: true, pattern: 'snow', aura: true, scale: 0.96, eye: 'round', eyeK: 1.22 } },
  ];
  JK.FIGHTERS.forEach((f) => (f.B = Object.assign({}, BODY[f.b.body])));
  JK.FIGHTER = Object.fromEntries(JK.FIGHTERS.map((f) => [f.id, f]));

  /* ---------- poses (degrees; 0 = hanging down, + = toward the facing side) */
  const PO = (o) => Object.assign({ lean: 6, head: 0, sa1: 40, ea1: 80, sa2: 20, ea2: 100, hl1: 18, kl1: -10, hl2: -20, kl2: -8, h1: 'fist', h2: 'fist', bob: 1, ex: 'calm' }, o);
  JK.POSES = {
    guard: PO({ lean: 9, head: -6, sa1: 55, ea1: 85, sa2: 28, ea2: 112, hl1: 24, kl1: -14, hl2: -26, kl2: -8 }),
    ready: PO({ lean: 2, head: -2, sa1: 34, ea1: 80, sa2: 8, ea2: 118, hl1: 14, kl1: -6, hl2: -16, kl2: -4 }),
    crane: PO({ lean: 2, head: -4, sa1: 112, ea1: 38, sa2: -38, ea2: 24, hl1: 76, kl1: -100, hl2: -3, kl2: 0, h1: 'open', h2: 'open' }),
    crouch: PO({ lean: 30, head: -24, sa1: 72, ea1: 52, sa2: -24, ea2: 95, hl1: 62, kl1: -88, hl2: -40, kl2: -12, h1: 'spear', h2: 'open' }),
    drifter: PO({ lean: 4, head: 2, sa1: 30, ea1: 72, sa2: -6, ea2: 40, hl1: 15, kl1: -7, hl2: -15, kl2: -5, h1: 'open', h2: 'relax' }),
    shiko: PO({ lean: 12, head: -10, sa1: 62, ea1: 34, sa2: 42, ea2: 48, hl1: 52, kl1: -56, hl2: -50, kl2: 54, h1: 'palm', h2: 'open', bob: 0.6 }),
    prayer: PO({ lean: 3, head: 4, sa1: 22, ea1: 128, sa2: 8, ea2: 96, hl1: 16, kl1: -7, hl2: -16, kl2: -4, h1: 'palm', h2: 'relax' }),
    drift: PO({ lean: -2, head: -4, sa1: 72, ea1: 28, sa2: -62, ea2: 38, hl1: 10, kl1: -16, hl2: -12, kl2: -12, h1: 'open', h2: 'open', bob: 1.4 }),
    windup: PO({ lean: -6, head: 6, sa1: -38, ea1: 118, sa2: 52, ea2: 60, hl1: 34, kl1: -38, hl2: -32, kl2: -4, bob: 0, ex: 'fierce' }),
    rock: PO({ lean: 20, head: -10, sa1: 89, ea1: 2, sa2: -16, ea2: 128, hl1: 50, kl1: -36, hl2: -44, kl2: 0, h1: 'fist', h2: 'fist', bob: 0, ex: 'fierce' }),
    paper: PO({ lean: 15, head: -8, sa1: 84, ea1: 10, sa2: 30, ea2: 96, hl1: 46, kl1: -32, hl2: -40, kl2: -2, h1: 'palm', h2: 'fist', bob: 0, ex: 'fierce' }),
    scissors: PO({ lean: 23, head: -14, sa1: 98, ea1: 0, sa2: -22, ea2: 120, hl1: 52, kl1: -42, hl2: -46, kl2: 0, h1: 'spear', h2: 'fist', bob: 0, ex: 'fierce' }),
    hesitate: PO({ lean: -2, head: 10, sa1: 18, ea1: 40, sa2: 4, ea2: 30, hl1: 10, kl1: -2, hl2: -10, kl2: -2, h1: 'relax', h2: 'relax', ex: 'hurt' }),
    stumble: PO({ lean: -24, head: -22, sa1: 32, ea1: 40, sa2: -46, ea2: 20, hl1: 34, kl1: -6, hl2: -8, kl2: -34, h1: 'relax', h2: 'open', bob: 0, ex: 'hurt' }),
    offbalance: PO({ lean: -32, head: -16, sa1: 150, ea1: 24, sa2: -140, ea2: -20, hl1: 40, kl1: 0, hl2: -22, kl2: -44, h1: 'open', h2: 'open', bob: 0, ex: 'hurt' }),
    flinch: PO({ lean: -12, head: -28, sa1: 42, ea1: 122, sa2: -22, ea2: 40, hl1: 12, kl1: -32, hl2: -30, kl2: -22, h1: 'open', h2: 'relax', bob: 0, ex: 'hurt' }),
    kneel: PO({ lean: 22, head: 32, sa1: 12, ea1: 12, sa2: -4, ea2: 10, hl1: 82, kl1: -82, hl2: 6, kl2: -86, h1: 'relax', h2: 'relax', bob: 0.4, ex: 'ko' }),
    victory: PO({ lean: -4, head: -12, sa1: 28, ea1: 104, sa2: 162, ea2: 14, hl1: 12, kl1: 0, hl2: -14, kl2: 0, h1: 'fist', h2: 'fist', ex: 'win' }),
    bow: PO({ lean: 34, head: 10, sa1: 8, ea1: 6, sa2: -4, ea2: 6, hl1: 4, kl1: 0, hl2: -4, kl2: 0, h1: 'relax', h2: 'relax', bob: 0.3 }),
  };
  JK.REACT = { rock: 'stumble', paper: 'offbalance', scissors: 'flinch' };
  const NUM = ['lean', 'head', 'sa1', 'ea1', 'sa2', 'ea2', 'hl1', 'kl1', 'hl2', 'kl2', 'bob'];
  JK.lerpPose = (a, b, t) => {
    const o = {};
    NUM.forEach((k) => (o[k] = a[k] + (b[k] - a[k]) * t));
    o.h1 = t < 0.4 ? a.h1 : b.h1; o.h2 = t < 0.4 ? a.h2 : b.h2; o.ex = t < 0.3 ? a.ex : b.ex;
    return o;
  };

  /* ---------- skeleton */
  function limb(base, a1, a2, l1, l2) {
    const d1 = dir(a1), d2 = dir(a1 + a2);
    const b = [base[0] + d1[0] * l1, base[1] + d1[1] * l1];
    return { a: base, b, c: [b[0] + d2[0] * l2, b[1] + d2[1] * l2], a1, a2: a1 + a2 };
  }
  function solve(p, f) {
    const b = f.B, T = LEN.torso * b.tl, lg = b.leg;
    const td = [Math.sin(p.lean * D2R), -Math.cos(p.lean * D2R)], pp = [-td[1], td[0]];
    const At = (s, w) => [td[0] * s + pp[0] * w, td[1] * s + pp[1] * w];
    const shF = At(T - 7, b.sh * 0.1), shB = At(T - 7.5, -b.sh * 0.24);
    const neckTop = At(T + LEN.neck, 1.5);
    const hd = p.lean + p.head, hu = [Math.sin(hd * D2R), -Math.cos(hd * D2R)], hf = [-hu[1], hu[0]];
    const head = [neckTop[0] + hu[0] * 9.5 - hf[0] * 0.5, neckTop[1] + hu[1] * 9.5 - hf[1] * 0.5];
    const armF = limb(shF, p.sa1, p.ea1, LEN.ua, LEN.fa);
    const armB = limb(shB, p.sa2, p.ea2, LEN.ua, LEN.fa);
    const legF = limb(At(-3, b.hip * 0.16), p.hl1, p.kl1, LEN.th * lg, LEN.sh * lg);
    const legB = limb(At(-3, -b.hip * 0.16), p.hl2, p.kl2, LEN.th * lg, LEN.sh * lg);
    const ground = Math.max(legF.c[1], legB.c[1], legF.b[1] + b.th[2] + 1, legB.b[1] + b.th[2] + 1) + 4.6 * b.foot;
    return { td, pp, At, T, shF, shB, neckTop, head, ha: hd * D2R, lean: p.lean, armF, armB, legF, legB, ground };
  }

  /* ---------- parts */
  function hand(L, arm, type, f, dk) {
    const c = f.c, col = dk(c.hands || c.skin), k = f.B.hand;
    const X = dir(arm.a2), N = [-X[1], X[0]], o = arm.c;
    const T = (x, y) => [o[0] + (X[0] * x + N[0] * y) * k, o[1] + (X[1] * x + N[1] * y) * k];
    const S = (arr) => smooth(arr.map(([x, y, s]) => (s ? sharp(T(x, y)) : T(x, y))));
    const finger = (a, z, w) => L.push(P(limbPath(T(a[0], a[1]), T(z[0], z[1]), w * k, w * k * 1.04, w * k * 0.82), col, { k: 0.8, line: 0.8 }));
    const ink = c.ink;
    if (type === 'fist') {
      L.push(P(S([[-1, -4.6], [3, -5.8], [9.2, -5.4], [11.8, -2.6], [12, 2], [9.8, 5.2], [3, 5.6], [-1, 4]]), col, { k: 1.6 }));
      L.push({ fn: (ctx) => { ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6; ctx.stroke(smooth([T(9.4, -4.6), T(10.4, -1.4), T(10.4, 1.8), T(9.4, 4.4)], false)); ctx.globalAlpha = 1; ctx.stroke(S([[3, 1.2], [8.4, 0.8], [10.4, 3], [8, 5.2], [3, 4.6]])); } });
    } else if (type === 'palm') {
      L.push(P(S([[-1, -4], [4, -5.8], [8.6, -5], [9.8, 0], [9, 4.8], [3, 5], [-1, 3.6]]), col, { k: 1.4 }));
      [[5, -15], [6.8, -16], [8.4, -15.4], [9.6, -13.4]].forEach(([x, y], i) => finger([4.4 + i * 1.6, -4.6], [x, y], 1.45 - i * 0.08));
      finger([3, -2], [7.4, -7.6], 1.55);
    } else if (type === 'open') {
      L.push(P(S([[-1, -4], [5, -5], [9, -3.6], [9.6, 2], [8.4, 4.6], [2, 4.8], [-1, 3.6]]), col, { k: 1.4 }));
      [-3.2, -1, 1.2, 3.2].forEach((y, i) => finger([8.4, y * 0.95], [15.8 - Math.abs(i - 1.5) * 0.9, y * 1.15], 1.35));
      finger([4.6, -3.6], [9.4, -7.2], 1.5);
    } else if (type === 'spear') {
      L.push(P(S([[-1, -4.4], [4, -5.2], [9, -4], [10.6, 0.6], [9.6, 4.8], [3, 5], [-1, 3.6]]), col, { k: 1.4 }));
      finger([8.4, -2.6], [19.4, -2.4], 1.45); finger([8.6, -0.2], [18.8, 0.6], 1.45);
      L.push({ fn: (ctx) => { ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.stroke(smooth([T(9.4, 2), T(10.8, 3.4), T(9.6, 4.6)], false)); } });
    } else {
      L.push(P(S([[-1, -4], [5, -5], [10, -3], [11.6, 1], [9.4, 4.8], [2, 4.8], [-1, 3.6]]), col, { k: 1.4 }));
      L.push({ fn: (ctx) => { ctx.strokeStyle = ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.7; ctx.stroke(smooth([T(10.6, -2), T(11.2, 1.4)], false)); } });
    }
  }
  function foot(L, leg, f, dk) {
    const c = f.c, k = f.B.foot, kind = f.b.feet, ink = c.ink;
    const X = dir(leg.a2 + 90), Y = dir(leg.a2), o = leg.c;
    const T = (x, y) => [o[0] + (X[0] * x + Y[0] * y) * k, o[1] + (X[1] * x + Y[1] * y) * k];
    if (kind === 'zori') L.push(P(polyPath([T(-4.5, 3.2), T(15.5, 3.2), T(15.5, 5.4), T(-4.5, 5.4)]), dk('#5a3c24'), { k: 0.8 }));
    L.push(P(smooth([T(-3.6, -1.4), T(-1.2, -4), T(5, -2.6), T(11, -0.2), sharp(T(14.8, 1.8)), T(14.2, 3.6), T(6, 3.8), sharp(T(-3.6, 3.6))]), dk(kind === 'bare' ? c.skin : c.feet), { k: 1.4 }));
    if (kind !== 'bare') L.push({ fn: (ctx) => { ctx.strokeStyle = ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 0.8; ctx.stroke(smooth([T(10.6, 0.4), T(12.6, 3.2)], false)); if (kind === 'zori') { ctx.globalAlpha = 1; ctx.strokeStyle = '#7a1f1a'; ctx.lineWidth = 1.4; ctx.stroke(smooth([T(1, 3), T(6, -1.6), T(11, 3)], false)); } } });
  }
  function legParts(L, J, leg, f, back) {
    const b = f.B, c = f.c, kind = f.b.legs;
    const dk = back ? (x) => mix(x, '#140b1c', 0.24) : (x) => x;
    foot(L, leg, f, dk);
    const ank = lerp(leg.b, leg.c, 0.94);
    let k1 = 1, k2 = 1, k3 = 1, col = c.pants, bias = 0;
    if (kind === 'gi') { k1 = 1.36; k2 = 1.45; k3 = 1.85; }
    else if (kind === 'hakama') { k1 = 1.65; k2 = 1.85; k3 = 2.5; }
    else if (kind === 'robe') { k1 = 1.1; k2 = 1.1; k3 = 1.15; }
    else if (kind === 'bare') { col = c.skin; bias = 0.12; }
    col = dk(col);
    L.push(P(limbPath(leg.a, leg.b, b.th[0] * k1, b.th[1] * k1, b.th[2] * k1, 0.4, bias), col));
    L.push(P(circle(leg.b, b.th[2] * k1), col, { k: 2, hi: false, noInk: true }));
    L.push(P(limbPath(leg.b, ank, b.th[2] * k1, b.shn[1] * k2, b.shn[2] * k3, 0.32, bias), col));
    if (kind === 'tight') {
      L.push(P(limbPath(lerp(leg.b, leg.c, 0.14), lerp(leg.b, leg.c, 0.86), b.shn[1] * 1.22, b.shn[1] * 1.3, b.shn[2] * 1.2), dk(c.accent), { line: 0.9 }));
      L.push(P(circle(leg.b, 3.4), dk(c.trim), { k: 1, line: 0.9 }));
    }
    if (!back && (kind === 'gi' || kind === 'hakama')) L.push({ fn: (ctx) => {
      ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.9;
      ctx.stroke(smooth([lerp(leg.a, leg.b, 0.55), add(leg.b, [-3, 2]), lerp(leg.b, leg.c, 0.35)], false));
      ctx.stroke(smooth([lerp(leg.b, leg.c, 0.5), add(lerp(leg.b, leg.c, 0.7), [3, 0]), lerp(leg.b, leg.c, 0.9)], false));
    } });
    if (!back && kind === 'bare') L.push({ fn: (ctx) => { ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.stroke(smooth([lerp(leg.a, leg.b, 0.3), add(lerp(leg.a, leg.b, 0.7), [3, 0]), leg.b], false)); } });
    if (!back && f.b.pattern === 'brush') L.push({ fn: (ctx) => brush(ctx, lerp(leg.a, leg.b, 0.25), lerp(leg.b, leg.c, 0.7), c.accent, 5.5) });
  }
  function armParts(L, J, arm, f, back, handType, sw) {
    const b = f.B, c = f.c, kind = f.b.sleeve;
    const dk = back ? (x) => mix(x, '#140b1c', 0.24) : (x) => x;
    const top = dk(c.top), skin = dk(c.skin), ua = b.ua, fa = b.fa;
    if (kind === 'none') {
      L.push(P(limbPath(arm.b, arm.c, fa[0], fa[1], fa[2], 0.35, 0.1), skin));
      hand(L, arm, handType, f, dk);
      L.push(P(limbPath(arm.a, arm.b, ua[0], ua[1], ua[2], 0.45, 0.15), skin));
      L.push(P(circle(arm.a, ua[0] * 1.15), skin, { k: 2, hi: false }));
      if (f.b.wraps) {
        L.push(P(limbPath(lerp(arm.b, arm.c, 0.45), lerp(arm.b, arm.c, 0.95), fa[1] * 1.1, fa[1] * 1.08, fa[2] * 1.2), dk('#efe9dc'), { k: 1.5, line: 0.8 }));
        L.push({ fn: (ctx) => { ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.4; ctx.lineWidth = 0.7; for (let i = 0; i < 4; i++) { const m = lerp(arm.b, arm.c, 0.5 + i * 0.11), d = [arm.c[0] - arm.b[0], arm.c[1] - arm.b[1]], l = Math.hypot(d[0], d[1]), n = [-d[1] / l, d[0] / l]; ctx.beginPath(); ctx.moveTo(m[0] + n[0] * 6, m[1] + n[1] * 6); ctx.lineTo(m[0] - n[0] * 6 + d[0] * 0.05, m[1] - n[1] * 6 + d[1] * 0.05); ctx.stroke(); } } });
      }
      return;
    }
    if (kind === 'tight') {
      L.push(P(limbPath(arm.b, arm.c, fa[0], fa[1], fa[2]), top));
      hand(L, arm, handType, f, dk);
      L.push(P(limbPath(arm.a, arm.b, ua[0], ua[1], ua[2]), top));
      L.push(P(limbPath(lerp(arm.b, arm.c, 0.12), lerp(arm.b, arm.c, 0.88), fa[1] * 1.3, fa[1] * 1.38, fa[2] * 1.35), dk(c.accent), { line: 0.9 }));
      L.push(P(ellipse(add(arm.a, [0, 1.5]), ua[0] * 1.6, ua[0] * 1.3), dk(c.accent), { line: 0.9 }));
      return;
    }
    const cuffT = kind === 'gi' ? 0.55 : 0.68;
    L.push(P(limbPath(lerp(arm.b, arm.c, cuffT - 0.06), arm.c, fa[1] * 0.96, fa[1], fa[2]), skin));
    hand(L, arm, handType, f, dk);
    const cuff = lerp(arm.b, arm.c, cuffT);
    if (kind === 'wide' || kind === 'kimono') {
      const drop = kind === 'wide' ? 26 : 18;
      const hang = add(lerp(arm.b, cuff, 0.55), [sw[0] * 0.6, drop + sw[1] * 0.4]);
      L.push(P(smooth([lerp(arm.a, arm.b, 0.55), arm.b, cuff, add(cuff, [1.5, 6]), sharp([hang[0] + 4, hang[1]]), sharp([hang[0] - 6, hang[1] - 1]), add(lerp(arm.a, arm.b, 0.7), [-3, 14])]), top, { k: 3 }));
      L.push({ fn: (ctx) => { ctx.strokeStyle = dk(c.top2 || c.accent || c.top); ctx.lineWidth = 2; ctx.stroke(smooth([add(cuff, [1.5, 6]), [hang[0] + 4, hang[1]]], false)); } });
    }
    const k = kind === 'gi' ? 1.55 : 1.65;
    L.push(P(limbPath(arm.a, arm.b, ua[0] * k, ua[1] * k * 1.04, ua[2] * k), top));
    L.push(P(circle(arm.b, ua[2] * k), top, { k: 2, hi: false, noInk: true }));
    L.push(P(limbPath(arm.b, cuff, ua[2] * k, fa[1] * k * 1.1, fa[1] * k * 1.28, 0.5), top));
    if (!back) L.push({ fn: (ctx) => {
      ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.9;
      ctx.stroke(smooth([lerp(arm.a, arm.b, 0.5), add(arm.b, [-2, 1]), lerp(arm.b, cuff, 0.5)], false));
      ctx.globalAlpha = 1;
      if (f.b.pattern === 'brush') brush(ctx, lerp(arm.a, arm.b, 0.2), lerp(arm.b, cuff, 0.6), c.accent, 4.5);
      if (f.b.pattern === 'snow') flakes(ctx, [lerp(arm.a, arm.b, 0.5), lerp(arm.b, cuff, 0.6)], '#9fd3f0');
    } });
  }
  function torsoPts(J, b, e = 0, down = 0) {
    const A = J.At, T = J.T, bw = down ? b.hip * 0.64 : b.hip * 0.3;
    return [A(-7 - down, bw + e), A(4, b.hip * 0.5 + e), A(17, b.wa * 0.5 + e), A(T - 19, b.ch * 0.55 + e), A(T - 6, b.sh * 0.34 + e), A(T, 6 + e * 0.5),
      A(T + 0.5, -5 - e * 0.5), A(T - 5, -b.sh * 0.42 - e), A(T - 18, -b.ch * 0.48 - e), A(17, -b.wa * 0.46 - e), A(3, -b.hip * 0.52 - e), A(-7 - down, -bw - e)];
  }
  function skirtPath(J, f) {
    const b = f.B, A = J.At, F = J.legF, B = J.legB, robe = f.b.legs === 'robe', fl = robe ? 7 : 13;
    if (robe) return smooth([A(8, b.hip * 0.56 + 2), add(F.b, [fl * 0.8, 2]), sharp([F.c[0] + fl, F.c[1] - 1]), sharp([B.c[0] - fl, B.c[1] - 1]), add(B.b, [-fl * 0.8, 2]), A(8, -b.hip * 0.56 - 2)]);
    const m = lerp(F.c, B.c, 0.5);
    return smooth([A(8, b.hip * 0.56 + 2), add(F.b, [fl * 0.7, 2]), sharp([F.c[0] + fl, F.c[1] - 2]), sharp([F.c[0] - 3, F.c[1] - 1]), [m[0], m[1] - 10], sharp([B.c[0] + 3, B.c[1] - 1]), sharp([B.c[0] - fl, B.c[1] - 2]), add(B.b, [-fl * 0.7, 2]), A(8, -b.hip * 0.56 - 2)]);
  }
  function skirtDetail(ctx, J, f, sk) {
    const b = f.B, c = f.c, A = J.At, F = J.legF, B = J.legB;
    ctx.clip(sk);
    const t0 = A(8, -b.hip * 0.5), t1 = A(8, b.hip * 0.5), h0 = [B.c[0] - 10, B.c[1]], h1 = [F.c[0] + 10, F.c[1]];
    const line = (k) => { const a = lerp(t0, t1, k), z = lerp(h0, h1, k); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(z[0], z[1]); ctx.stroke(); };
    if (f.b.pattern === 'stripes') { ctx.strokeStyle = mix(c.pants, '#000000', 0.35); ctx.lineWidth = 1.6; for (let i = 0; i <= 12; i++) line(i / 12); }
    if (f.b.pattern === 'snow') flakes(ctx, [[0.3, 0.4], [0.7, 0.6], [0.5, 0.85], [0.2, 0.8], [0.85, 0.3]].map(([u, v]) => lerp(lerp(t0, t1, u), lerp(h0, h1, u), v)), '#9fd3f0');
    ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.38; ctx.lineWidth = 0.9;
    [0.22, 0.45, 0.68, 0.88].forEach(line);
  }
  function collar(L, J, f) {
    const b = f.B, c = f.c, A = J.At, T = J.T, top = f.b.top;
    const deep = f.b.fem ? 0 : top === 'kimono' ? 26 : 16;
    if (deep) L.push(P(polyPath([A(T + 0.5, 0), A(T - 1.5, 5.2), A(T - deep, b.ch * 0.36 + 1)]), c.skin, { k: 1.5 }));
    if (c.top2) L.push(P(polyPath([A(T + 1, -1), A(T - 0.5, 5.6), A(14, b.wa * 0.5 + 3), A(17, b.wa * 0.5 - 1)]), c.top2, { k: 1, line: 0.8 }));
    const lap = c.lapel || mix(c.top, c.ink, 0.1);
    L.push(P(polyPath([A(T + 1, -2), A(T - 1.5, 4.4), A(12, b.wa * 0.5 + 2.4), A(16, b.wa * 0.5 - 2.6)]), lap, { k: 1.2, line: 0.8 }));
  }
  function jacketDetail(ctx, J, f, jk) {
    const b = f.B, c = f.c, A = J.At, T = J.T;
    ctx.clip(jk);
    if (f.b.pattern === 'brush') { brush(ctx, A(T - 8, -b.ch * 0.4), A(14, b.wa * 0.5), c.accent, 6); brush(ctx, A(T - 26, -b.wa * 0.5), A(-6, b.hip * 0.3), c.accent, 4); }
    if (f.b.pattern === 'snow') flakes(ctx, [A(T - 10, -b.ch * 0.2), A(T - 24, b.ch * 0.25), A(22, -b.wa * 0.2), A(T - 14, b.ch * 0.42)], '#9fd3f0');
    if (f.b.pattern === 'checker') {
      ctx.strokeStyle = '#9c8a64'; ctx.globalAlpha = 0.3; ctx.lineWidth = 0.8;
      for (let s = -14; s < T + 4; s += 5) { const a = A(s, -40), z = A(s, 40); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(z[0], z[1]); ctx.stroke(); }
      for (let w = -30; w < 30; w += 5) { const a = A(-14, w), z = A(T + 4, w); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(z[0], z[1]); ctx.stroke(); }
    }
    ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.32; ctx.lineWidth = 0.9;
    ctx.stroke(smooth([A(T - 10, b.ch * 0.15), A(T - 22, b.wa * 0.3), A(18, b.wa * 0.42)], false));
    ctx.stroke(smooth([A(T - 8, -b.ch * 0.3), A(T - 24, -b.wa * 0.2), A(19, -b.wa * 0.3)], false));
  }
  function armor(L, J, f) {
    const b = f.B, c = f.c, A = J.At, T = J.T;
    L.push(P(smooth([A(T - 5, b.sh * 0.3), A(T - 19, b.ch * 0.57 + 1), A(22, b.wa * 0.53 + 0.5), sharp(A(20, -b.wa * 0.2)), A(T - 20, -b.ch * 0.42), A(T - 5, -b.sh * 0.24)]), c.accent, { k: 3, line: 0.9 }));
    for (let i = 0; i < 3; i++) { const s = 8 + i * 5; L.push(P(limbPath(A(s, -b.wa * 0.5 - 0.5), A(s, b.wa * 0.5 + 0.5), 2.5, 2.6, 2.5), i % 2 ? mix(c.accent, '#000000', 0.35) : '#2c2433', { k: 1, line: 0.8 })); }
    L.push(P(limbPath(A(J.T - 1, -6), A(J.T + 1, 6), 4.4, 4.8, 4.4), c.trim, { k: 1.5, line: 0.8 }));
    L.push({ fn: (ctx) => {
      const cc = A(T - 15, b.ch * 0.3);
      ctx.fillStyle = c.trim; ctx.beginPath(); ctx.arc(cc[0], cc[1], 4.2, 0, 7); ctx.fill();
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(cc[0] + 1.9, cc[1] - 1, 3.6, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.1; const a = A(T - 8, b.sh * 0.1), z = A(T - 22, b.ch * 0.4); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(z[0], z[1]); ctx.stroke();
    } });
  }
  function mawashi(L, J, f) {
    const b = f.B, A = J.At, col = '#1f2f63';
    L.push(P(limbPath(A(-2, b.hip * 0.46), A(-17, b.hip * 0.28), 5.5, 6, 4.5), col, { k: 2, line: 0.9 }));
    L.push(P(polyPath([A(-7, b.hip * 0.5 + 1.5), A(9, b.wa * 0.5 + 2.5), A(9, -b.wa * 0.5 - 2.5), A(-7, -b.hip * 0.5 - 1.5)]), col, { k: 3, line: 0.9 }));
    L.push({ fn: (ctx) => {
      ctx.lineCap = 'round'; const a = A(9.5, b.wa * 0.5 + 3), z = A(9.5, -b.wa * 0.5 - 3);
      ctx.strokeStyle = '#f3efe4'; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(z[0], z[1]); ctx.stroke();
      ctx.strokeStyle = '#a99f88'; ctx.lineWidth = 0.9;
      for (let i = 0; i <= 14; i++) { const p = lerp(a, z, i / 14); ctx.beginPath(); ctx.moveTo(p[0] - 1.4, p[1] - 1.8); ctx.lineTo(p[0] + 1.4, p[1] + 1.8); ctx.stroke(); }
    } });
  }
  function muscles(ctx, J, f) {
    const b = f.B, c = f.c, A = J.At, T = J.T;
    ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.4; ctx.lineWidth = 1.1;
    ctx.stroke(smooth([A(T - 7, -4), A(T - 16, b.ch * 0.22), A(T - 19, b.ch * 0.5)], false));
    ctx.stroke(smooth([A(T - 24, b.ch * 0.55), A(18, b.wa * 0.56), A(8, b.hip * 0.5)], false));
    const nv = A(14, b.wa * 0.42); ctx.beginPath(); ctx.arc(nv[0], nv[1], 1, 0, 7); ctx.stroke();
  }
  function belt(L, J, f, sw, t) {
    const kind = f.b.belt; if (!kind) return;
    const b = f.B, c = f.c, A = J.At, obi = kind === 'obi';
    const h0 = obi ? 5 : 9, h1 = obi ? 18 : 14.5, wF = b.wa * 0.5 + 3, wB = -b.wa * 0.48 - 3;
    if (obi) {
      const k = A((h0 + h1) / 2, wB - 1), bc = mix(c.belt, '#000000', 0.12);
      L.push(P(ellipse(add(k, [-5 + sw[0] * 0.2, -5]), 6.5, 4, -0.5), bc, { k: 1.5, line: 0.9 }));
      L.push(P(ellipse(add(k, [-5 + sw[0] * 0.3, 5]), 6.5, 4, 0.5), bc, { k: 1.5, line: 0.9 }));
    }
    L.push(P(polyPath([A(h0, wF + 0.6), A(h1, wF), A(h1, wB), A(h0, wB - 0.6)]), c.belt, { k: 2, line: 0.9 }));
    if (obi) {
      L.push({ fn: (ctx) => { ctx.strokeStyle = c.cord || c.accent; ctx.lineWidth = 1.6; const a = A((h0 + h1) / 2 + 1, wF), z = A((h0 + h1) / 2 + 1, wB); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(z[0], z[1]); ctx.stroke(); } });
      return;
    }
    const kn = A(11.5, wF + 0.4);
    const tail = (dx, dy) => limbPath(kn, [kn[0] + dx + sw[0] * 0.5 + Math.sin(t * 3) * 1.2, kn[1] + dy + sw[1] * 0.3], 2.1, 2.2, 1.7);
    L.push(P(tail(4, 15), c.belt, { k: 1 }));
    L.push(P(tail(-1, 17), c.belt, { k: 1, line: 0.8 }));
    L.push(P(circle(kn, 3.2), c.belt, { k: 1, line: 0.8 }));
  }
  function pompoms(L, J, f) {
    const b = f.B, A = J.At, T = J.T, col = '#f07a22';
    L.push({ fn: (ctx) => { ctx.strokeStyle = '#e9e2d0'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke(smooth([A(T - 2, -b.sh * 0.2), A(T - 14, b.ch * 0.35), A(14, b.wa * 0.5)], false)); } });
    for (let i = 0; i < 3; i++) L.push(P(circle(A(T - 12 - i * 8, b.ch * 0.25 + 1), 3.4), mix(col, '#000000', 0.2), { k: 1.5, line: 0.8 }));
    for (let i = 0; i < 3; i++) L.push(P(circle(A(T - 9 - i * 8, b.ch * 0.55 + 2), 3.8), col, { k: 1.6, line: 0.8 }));
  }
  function bodyParts(L, J, f, t, sw) {
    const b = f.B, c = f.c, A = J.At, T = J.T, top = f.b.top, legs = f.b.legs;
    L.push(P(limbPath(A(T - 4, 0.5), J.neckTop, 4.4 * b.neck, 4.2 * b.neck, 4 * b.neck), c.skin, { k: 2 }));
    const robe = legs === 'robe', skirted = legs === 'hakama' || robe;
    if (robe) legParts(L, J, J.legF, f, false);
    if (skirted) { const sk = skirtPath(J, f); L.push(P(sk, c.pants, { k: 4 })); L.push({ fn: (ctx) => skirtDetail(ctx, J, f, sk) }); }
    L.push(P(smooth(torsoPts(J, b)), top === 'bare' ? c.skin : c.top, { k: 4 }));
    if (top === 'bare') L.push({ fn: (ctx) => muscles(ctx, J, f) });
    if (!robe) legParts(L, J, J.legF, f, false);
    if (['gi', 'miko', 'kimono', 'yamabushi'].includes(top)) {
      const jk = smooth(torsoPts(J, b, 2.2, legs === 'hakama' ? 3 : robe ? 0 : 11));
      L.push(P(jk, c.top, { k: 4 }));
      collar(L, J, f);
      L.push({ fn: (ctx) => jacketDetail(ctx, J, f, jk) });
    }
    if (top === 'armor') armor(L, J, f);
    if (top === 'bare') mawashi(L, J, f);
    belt(L, J, f, sw, t);
    if (top === 'yamabushi') pompoms(L, J, f);
  }

  /* ---------- hair (head-local coords, facing right; s = sway) */
  const HAIR = {
    miko: {
      back: (s) => [[-5, -14], [-12, -9], [-14.5, 1], [-16, 16], sharp([-17 + s[0], 31 + s[1]]), [-12 + s[0] * 0.8, 30 + s[1]], [-8, 18], [-6, 6], [-1, -6]],
      backParts: () => [[limbPath([-14.4, 7], [-15.8, 11.5], 2.6, 2.8, 2.6), '#f4f1ea']],
      front: (s) => [[[-10.5, -1], [-11.5, -10], [-4.5, -15.6], [4.5, -15.6], [10.4, -11], sharp([12.3, -5]), [9.6, -7.2], sharp([8.4, -3.8]), [6.6, -8.2], sharp([4, -4.4]), [2, -8.4], [-1.5, -4.5], sharp([-4.2, 2.5]), [-6, -2], sharp([-8, 5])],
        [[-3.2, -6], [-0.5, 5], sharp([-1.5 + s[0] * 0.3, 14 + s[1] * 0.3]), [-4.6, 6]]],
    },
    kagero: {
      front: (s) => [[sharp([-7, 3]), [-10, -2], sharp([-17 + s[0], -5 + s[1]]), [-11, -8], sharp([-16 + s[0], -14 + s[1]]), [-8, -13], sharp([-6, -20 + s[1] * 0.5]), [-1, -15], sharp([5, -18]), [6, -13], sharp([12, -12]), [10, -8], sharp([13, -4]), [8, -6.4], sharp([6.6, -3]), [3.6, -6.4], sharp([1, -2.2]), [-1.6, -6], [-4, 1]]],
    },
    tetsuo: {
      backParts: (s) => [[limbPath([-10, -5.6], [-23 + s[0] * 1.4, -3 + s[1] * 1.2], 1.9, 2.1, 1.5), '#161616'], [limbPath([-10, -5.6], [-21 + s[0] * 1.2, 5 + s[1] * 1.4], 1.8, 2, 1.4), '#161616']],
      front: (s) => [[sharp([-8, 3]), [-11, -3], sharp([-18 + s[0], -7 + s[1]]), [-12, -10], sharp([-15 + s[0], -18 + s[1]]), [-6, -14.5], sharp([-4, -23 + s[1] * 0.5]), [1, -15.5], sharp([7, -21 + s[1] * 0.5]), [7.5, -13.5], sharp([13.5, -13]), [10.5, -8.5], sharp([12.5, -3.8]), [7.4, -6.6], sharp([4, -3.6]), [1.4, -7], [-2, -3], sharp([-4.5, 2])]],
      top: (ctx, s, c) => {
        const band = polyPath([[-11, -7.6], [11.8, -9.8], [12.1, -6.4], [-10.8, -3.8]]);
        ctx.fillStyle = '#171717'; ctx.fill(band); ctx.strokeStyle = c.ink; ctx.lineWidth = 0.9; ctx.stroke(band);
        ctx.strokeStyle = '#3a3a3a'; ctx.beginPath(); ctx.moveTo(-10, -6.4); ctx.lineTo(11, -8.6); ctx.stroke();
        ctx.fillStyle = '#171717'; ctx.beginPath(); ctx.arc(-10.4, -5.6, 2.4, 0, 7); ctx.fill();
      },
    },
    hayato: {
      front: (s) => [[sharp([-9, 2]), [-11, -6], [-7, -13.5], [0, -16.4], [8, -15.4], [13.6, -10.4], sharp([15 + s[0] * 0.2, -1 + s[1] * 0.2]), [11, -5.6], sharp([10.2 + s[0] * 0.2, 1.8 + s[1] * 0.2]), [7.4, -6.4], [2, -8.8], [-3, -7.2], sharp([-5, 1])]],
    },
    shin: {
      back: (s) => [[-6, -14], [-13 + s[0] * 0.4, -14 + s[1] * 0.3], [-23 + s[0] * 1.5, -9 + s[1] * 1.3], sharp([-31 + s[0] * 2, 0 + s[1] * 2]), [-24 + s[0] * 1.4, -3 + s[1] * 1.2], sharp([-26 + s[0] * 1.6, 6 + s[1] * 1.8]), [-17 + s[0], -3 + s[1] * 0.8], [-9, -7]],
      backParts: () => [[limbPath([-9, -11.5], [-12.5, -12.4], 2.2, 2.5, 2.2), '#7a1f1a']],
      front: () => [[sharp([-8.5, 3]), [-11, -4], [-9, -12], [-2, -15.6], [6, -14.6], [11, -10], sharp([12.6, -4]), [9.4, -6.8], sharp([8.6, -1.6]), [6.8, -7.2], sharp([4.6, -2.6]), [2.6, -7.6], [-0.8, -4], sharp([-3.6, 2.6]), [-5.6, -2.4], sharp([-6.8, 4.4])]],
    },
    gonta: {
      front: () => [[sharp([-9.6, 3]), [-11, -6], [-6, -13.4], [2, -14.6], [8.4, -12], sharp([10.8, -7.6]), [5.2, -9.4], [-1, -8.6], [-5.6, -4], sharp([-6.6, 2.4])]],
      top: (ctx, s, c) => {
        const k = ellipse([-0.5, -16.4], 5.8, 2.7, -0.15);
        ctx.strokeStyle = c.ink; ctx.lineWidth = 2.4; ctx.stroke(k); cel(ctx, { p: k, c: c.hair, k: 1.4 });
        ctx.strokeStyle = '#d9d2c2'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-3.6, -17.8); ctx.lineTo(-3, -14.6); ctx.stroke();
      },
    },
    daigo: {
      back: (s) => [[-5, -14], [-11, -10], [-13, -1], [-14 + s[0] * 0.6, 9 + s[1] * 0.6], sharp([-16 + s[0], 18 + s[1]]), [-10 + s[0] * 0.5, 12 + s[1] * 0.5], [-6, 2], [-1, -7]],
      front: () => [[sharp([-9, 3]), [-11, -6], [-6, -13.6], [2, -15], [8.6, -12.6], sharp([11.6, -7.4]), [7, -9.4], [2, -10], [-2.6, -8], sharp([-5, 0])]],
      top: (ctx, s, c) => {
        const cap = polyPath([[0.6, -14.4], [1.6, -19], [5.6, -20.8], [9.2, -18.2], [8.8, -13.8], [4.6, -12.6]]);
        ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.stroke(cap); cel(ctx, { p: cap, c: '#1a1a1a', k: 1.2 });
      },
    },
    yuki: {
      back: (s) => [[-4, -14.6], [-12, -10.6], [-16, -1], [-18 + s[0] * 0.6, 13 + s[1] * 0.6], sharp([-23 + s[0] * 1.4, 29 + s[1] * 1.5]), [-16 + s[0], 26 + s[1]], sharp([-14 + s[0] * 0.9, 38 + s[1] * 1.6]), [-9 + s[0] * 0.4, 22 + s[1] * 0.6], [-6, 7], [0, -6]],
      front: () => [[[-10.5, -1], [-11.4, -10], [-4.4, -15.6], [4.6, -15.6], [10.8, -11.2], sharp([12.4, -4.4]), sharp([1.6, -4.6]), [-2.2, -4.4], sharp([-4.4, 3.4]), sharp([-7.2, 4])],
        [[-3, -5], [0.6, 5], sharp([0.8, 12.6]), sharp([-4, 11]), [-5, 1]]],
    },
  };

  /* ---------- face */
  const FACES = {
    male: [[-10.5, -3], [-8, -11.2], [-1, -14.6], [6.6, -12.6], [10.6, -6], [11.2, -1.4], sharp([12.8, 2.4]), [11, 3.8], [11.2, 6], [10.2, 7.8], [9.6, 10.4], [6, 12.8], [0.6, 11.4], [-4, 7.6], [-8, 4]],
    fem: [[-10.4, -3], [-8, -11], [-1, -14.4], [6.4, -12.4], [10.2, -6], [10.7, -1.5], sharp([12, 2.2]), [10.6, 3.5], [10.6, 5.6], [9.7, 7.4], [8.4, 10], sharp([5.2, 12]), [0.6, 10.2], [-4, 7], [-8, 3.6]],
    square: [[-10.8, -3], [-8.4, -11.2], [-1, -14.6], [6.6, -12.6], [10.8, -6], [11.4, -1.4], sharp([13, 2.4]), [11.2, 3.8], [11.6, 6], [10.8, 8], sharp([10.6, 11]), [6.4, 13.4], [-0.4, 12.8], [-5.6, 9.4], [-8.6, 4.6]],
    angular: [[-10.2, -3], [-7.8, -11.4], [-1, -14.8], [6.6, -12.8], [10.4, -6], [11, -1.4], sharp([12.8, 2.6]), [10.8, 3.8], [10.8, 5.8], [9.8, 7.6], [8.8, 10], sharp([6.2, 12.8]), [0.4, 10.6], [-4.2, 7], [-8, 3.6]],
    heavy: [[-11, -3], [-8.6, -11.4], [-1, -14.8], [6.8, -12.8], [10.8, -6.2], [11.6, -1.4], sharp([13, 2.6]), [11.4, 4], [11.8, 6.4], [11, 8.4], [10.6, 11.2], [6.4, 14], [-0.6, 13], [-6, 9.2], [-9.4, 4.4]],
  };
  function features(ctx, f, ex) {
    const c = f.c, ink = c.ink, fem = !!f.b.fem;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const browCol = mix(c.hair, ink, 0.45);
    const line = (pts, w, col) => { ctx.strokeStyle = col || ink; ctx.lineWidth = w; ctx.stroke(smooth(pts, false)); };
    if (ex === 'hurt' || ex === 'ko') {
      if (ex === 'hurt') { line([[3.6, -4.6], [8.6, -1.9], [3.9, 0.8]], 1.6); line([[3, -8.6], [6.5, -9.8], [9.8, -8.2]], fem ? 1.1 : 1.7, browCol); }
      else { line([[3.6, -1.8], [6.3, 0.2], [9.2, -1.6]], 1.5); line([[3, -6.8], [9.6, -8.4]], fem ? 1.1 : 1.6, browCol); }
      ctx.fillStyle = '#5a1a1a'; ctx.beginPath(); ctx.ellipse(9.6, 7.6, ex === 'hurt' ? 1.5 : 0.9, ex === 'hurt' ? 2 : 0.7, 0, 0, 7); ctx.fill();
    } else {
      const shape = f.b.eye || 'round', ek = f.b.eyeK || 1;
      const vy = { round: 1.08, sharp: 0.8, narrow: 0.62, kind: 0.9 }[shape] * (ex === 'fierce' ? 0.74 : 1);
      const rot = { round: 0, sharp: -0.2, narrow: -0.1, kind: 0.12 }[shape];
      ctx.save(); ctx.translate(6.3, -1.6); ctx.rotate(rot); ctx.scale(ek, ek * vy); ctx.translate(-6.3, 1.6);
      const white = smooth([sharp([3, -3.4]), [6.1, -5.2], sharp([9.4, -4.2]), [9.2, -1], [7.8, 1.3], [4.6, 0.6]]);
      ctx.fillStyle = '#fffaf4'; ctx.fill(white);
      ctx.save(); ctx.clip(white);
      const ig = ctx.createLinearGradient(0, -5, 0, 1.5);
      ig.addColorStop(0, mix(c.eye, '#000000', 0.55)); ig.addColorStop(0.6, c.eye); ig.addColorStop(1, lite(c.eye));
      ctx.fillStyle = ig; ctx.beginPath(); ctx.ellipse(7, -1.6, 2.4, 3.1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#120a0a'; ctx.beginPath(); ctx.ellipse(7.2, -1.6, 1.1, 1.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(60,30,60,.28)'; ctx.fillRect(2, -6, 9, 1.9);
      ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(7.9, -3, 0.85, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(6.3, -0.4, 0.45, 0, 7); ctx.fill();
      line([[2.6, -3.2], [5.8, -5.5], [9.6, -4.4]], fem ? 1.9 : 1.6);
      if (fem) { ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(2.8, -3.3); ctx.lineTo(1.4, -4.6); ctx.moveTo(9.4, -4.3); ctx.lineTo(10.6, -4.9); ctx.stroke(); }
      ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(5, 1.1); ctx.quadraticCurveTo(7, 1.8, 8.8, 0.8); ctx.stroke();
      ctx.restore();
      const bw = f.b.brow || (fem ? 1.1 : 1.8), bc = f.b.mark === 'wrinkles' ? '#e8e4dc' : browCol;
      if (ex === 'fierce') line([[3, -6.6], [6.5, -6.6], [10, -4.9]], bw * 1.15, bc);
      else line([[3.2, -7.4], [6.5, -8.4], [9.8, -7.4]], bw, bc);
      if (ex === 'fierce') { const m = smooth([[8.3, 6.6], [10.7, 6.4], [10.3, 8.6], [8.5, 8.3]]); ctx.fillStyle = '#3a1414'; ctx.fill(m); ctx.fillStyle = '#ffffff'; ctx.fillRect(8.5, 6.5, 2, 0.8); }
      else if (ex === 'win') line([[8, 6.5], [9.4, 8.4], [10.8, 6.3]], 1);
      else line([[8.6, 7.3], [10.4, 7.1]], 0.9);
    }
    line([[11, 0.5], [12, 2.1], [10.8, 2.9]], 0.9, mix(c.skin, ink, 0.45));
    if (fem) { ctx.strokeStyle = 'rgba(240,110,120,.55)'; ctx.lineWidth = 0.7; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(6 + i * 1.3, 4.4); ctx.lineTo(6.8 + i * 1.3, 3.2); ctx.stroke(); } }
  }
  function drawHead(ctx, J, f, ex, t, s) {
    const c = f.c, ink = c.ink, H = HAIR[f.b.hair];
    ctx.save(); ctx.translate(J.head[0], J.head[1]); ctx.rotate(J.ha);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const face = smooth(FACES[f.b.faceShape || f.B.face]);
    ctx.strokeStyle = ink; ctx.lineWidth = 3.2; ctx.stroke(face);
    cel(ctx, { p: face, c: c.skin, k: 2.6 });
    const ear = ellipse([-2.2, 1.4], 2.5, 3.5, 0.15);
    ctx.fillStyle = mix(c.skin, '#c0606a', 0.12); ctx.fill(ear); ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke(ear);
    ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(-2, 1.4, 1.3, -1.2, 1.6); ctx.stroke();
    const fronts = H.front(s).map((pts) => smooth(pts));
    ctx.save(); ctx.clip(face);
    ctx.fillStyle = shade(c.skin); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(-1, 11.5, 9, 4, 0.3, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; ctx.translate(0.8, 2.2); fronts.forEach((p) => ctx.fill(p));
    ctx.restore();
    features(ctx, f, ex);
    if (f.b.mark) {
      ctx.save(); ctx.lineCap = 'round';
      if (f.b.mark === 'scar') { ctx.strokeStyle = 'rgba(120,40,40,.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4.2, 2.2); ctx.lineTo(9.6, 4.8); ctx.stroke(); ctx.lineWidth = 0.6; [5.6, 7.2, 8.6].forEach((x) => { ctx.beginPath(); ctx.moveTo(x - 0.4, 2.4 + (x - 4.2) * 0.48); ctx.lineTo(x + 0.4, 4 + (x - 4.2) * 0.48); ctx.stroke(); }); }
      if (f.b.mark === 'scarEye') { ctx.strokeStyle = 'rgba(110,45,40,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4.6, -9); ctx.lineTo(6.2, 3.6); ctx.stroke(); }
      if (f.b.mark === 'wrinkles') { ctx.strokeStyle = mix(c.skin, ink, 0.5); ctx.lineWidth = 0.7; [[9.6, -3.6, 11.2, -4.6], [9.8, -2.2, 11.4, -2.4], [3, -9.6, 9, -10]].forEach(([a, b2, cc, d]) => { ctx.beginPath(); ctx.moveTo(a, b2); ctx.lineTo(cc, d); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(10.4, 3.8); ctx.quadraticCurveTo(9, 6, 9.2, 8.2); ctx.stroke(); }
      ctx.restore();
    }
    if (f.b.stubble) { ctx.save(); ctx.clip(face); ctx.fillStyle = mix(c.skin, c.hair, 0.3); ctx.globalAlpha = 0.45; ctx.fill(smooth([[1, 5.6], [6, 8.4], [9.4, 9.6], [8.6, 12.4], [3, 12], [-2.4, 8.4]])); ctx.restore(); }
    if (f.b.beard) {
      const bp = smooth([[-3, 5], [2, 9], [7, 11.5], [10.4, 9.6], [10.2, 12.6], sharp([7, 18]), [2, 15], [-3, 10]]);
      ctx.strokeStyle = ink; ctx.lineWidth = 2.4; ctx.stroke(bp); cel(ctx, { p: bp, c: c.hair, k: 1.6 });
      const mu = smooth([[7.6, 5.6], [11, 5.8], sharp([11.8, 7.6]), [8.8, 7]]);
      ctx.lineWidth = 1.6; ctx.stroke(mu); cel(ctx, { p: mu, c: c.hair, k: 0.8 });
    }
    if (f.b.mask) {
      const mp = smooth([[-6.5, 0.8], [12.9, 1.2], [12.5, 4.5], [10.6, 9], [6.5, 12.6], [0.5, 10.8], [-5.5, 6.6]]);
      ctx.strokeStyle = ink; ctx.lineWidth = 2.6; ctx.stroke(mp); cel(ctx, { p: mp, c: '#2c1438', k: 2 });
      ctx.strokeStyle = c.trim; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-6, 1.2); ctx.lineTo(12.8, 1.6); ctx.stroke();
    }
    fronts.forEach((p) => {
      ctx.strokeStyle = ink; ctx.lineWidth = 2.8; ctx.stroke(p);
      cel(ctx, { p, c: c.hair, k: 2.4 });
      ctx.save(); ctx.clip(p); ctx.strokeStyle = lite(c.hair); ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.setLineDash([3, 2.2]); ctx.beginPath(); ctx.arc(-1, -6, 10.5, -2.7, -0.5); ctx.stroke(); ctx.restore();
    });
    if (H.top) H.top(ctx, s, c, t);
    ctx.restore();
  }
  function backExtras(L, J, f, t, s, sw) {
    const c = f.c, H = HAIR[f.b.hair], A = J.At, b = f.B;
    if (f.b.hat) {
      const hc = A(J.T - 14, -b.ch * 0.5 - 7), ang = (J.lean + 76) * D2R, ax = [Math.cos(ang), Math.sin(ang)], up = [-ax[1], ax[0]];
      const tip = add(hc, mul(up, -9));
      L.push(P(smooth([add(hc, mul(ax, 18)), sharp(tip), add(hc, mul(ax, -18)), add(add(hc, mul(ax, -10)), mul(up, 3)), add(add(hc, mul(ax, 10)), mul(up, 3))]), '#c9a35b', { k: 2.5 }));
      L.push({ fn: (ctx) => { ctx.strokeStyle = '#8a6a32'; ctx.lineWidth = 0.8; for (let i = -2; i <= 2; i++) { const e = add(hc, mul(ax, i * 7)); ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); } ctx.strokeStyle = '#5a2a1a'; ctx.lineWidth = 1; const n = A(J.T + 1, 2); ctx.beginPath(); ctx.moveTo(n[0], n[1]); ctx.lineTo(tip[0], tip[1]); ctx.stroke(); } });
    }
    if (f.b.scarf) {
      const base = A(J.T + 1, -4), tp = [], bt = [];
      for (let i = 0; i <= 6; i++) {
        const x = base[0] - 4 - i * 7.5 + sw[0] * i * 0.6, y = base[1] + 2 + i * 1.8 + Math.sin(t * 6 - i * 0.9) * (0.6 + i * 0.5) + sw[1] * i * 0.3, w = 4.2 - i * 0.35;
        tp.push([x, y - w]); bt.push([x, y + w]);
      }
      L.push(P(smooth(tp.concat(bt.reverse())), c.trim, { k: 2 }));
    }
    if (H.backParts) H.backParts(s).forEach(([path, col]) => L.push(P(xform(path, J), col, { k: 1, line: 0.8 })));
    if (H.back) L.push(P(xform(smooth(H.back(s)), J), c.hair, { k: 3 }));
  }

  /* ---------- public draw */
  JK.drawFighter = function (ctx, fid, pose, o) {
    const f = JK.FIGHTER[fid], c = f.c, t = o.t || 0;
    const p = Object.assign({}, pose);
    const breath = Math.sin(t * 2.4) * (p.bob || 0);
    p.lean += breath * 1.1; p.sa1 += breath * 1.8; p.sa2 -= breath * 1.4; p.head -= breath * 0.8;
    const J = solve(p, f);
    const sw0 = o.sway || [0, 0];
    const sw = [sw0[0] + Math.sin(t * 1.7) * 1.2, sw0[1] + Math.sin(t * 2.3) * 0.6];
    const ca = Math.cos(-J.ha), sa = Math.sin(-J.ha), s = [sw[0] * ca - sw[1] * sa, sw[0] * sa + sw[1] * ca];
    ctx.save();
    ctx.translate(o.x, o.y);
    if (!o.noShadow) {
      const sg = ctx.createRadialGradient(0, 0, 4, 0, 0, 62 * o.s);
      sg.addColorStop(0, 'rgba(0,0,0,.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, 0, 60 * o.s, 12 * o.s, 0, 0, 7); ctx.fill();
    }
    const sc = o.s * (f.b.scale || 1);
    ctx.scale(sc * o.facing, sc);
    const lift = -J.ground - breath * 0.5 - (f.b.aura ? 3 + Math.sin(t * 2) * 1.5 : 0);
    ctx.translate(0, lift);
    RIM = o.rim || null;
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (f.b.aura) {
      const cc = J.At(30, 0), g = ctx.createRadialGradient(cc[0], cc[1], 5, cc[0], cc[1], 95);
      g.addColorStop(0, 'rgba(190,230,255,.35)'); g.addColorStop(1, 'rgba(190,230,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cc[0], cc[1], 95, 0, 7); ctx.fill();
      for (let i = 0; i < 12; i++) {
        const a = t * 0.6 + i * 0.53, r = 36 + ((i * 37) % 34), x = cc[0] + Math.cos(a) * r, y = cc[1] + 40 - ((t * 22 + i * 23) % 130);
        ctx.fillStyle = 'rgba(235,248,255,.85)'; ctx.beginPath(); ctx.moveTo(x, y - 2.8); ctx.lineTo(x + 1.2, y); ctx.lineTo(x, y + 2.8); ctx.lineTo(x - 1.2, y); ctx.fill();
      }
    }
    const back = [];
    backExtras(back, J, f, t, s, sw);
    legParts(back, J, J.legB, f, true);
    armParts(back, J, J.armB, f, true, p.h2, sw);
    group(ctx, back, c.ink);
    const body = [];
    bodyParts(body, J, f, t, sw);
    group(ctx, body, c.ink);
    drawHead(ctx, J, f, p.ex || 'calm', t, s);
    const front = [];
    armParts(front, J, J.armF, f, false, p.h1, sw);
    group(ctx, front, c.ink);
    ctx.restore();
    RIM = null;
    const W = (q) => [o.x + q[0] * sc * o.facing, o.y + (q[1] + lift) * sc];
    return { hand: W(J.armF.c), head: W(J.head), chest: W(J.At(J.T - 15, 0)) };
  };
})();
