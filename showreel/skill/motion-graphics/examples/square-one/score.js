// SQUARE ONE — 15 s, 120 BPM, 1920x1080. Score file for the motion-graphics engine.
// One white square becomes language, form, data and architecture, then returns to square one.
const PAL = {
  k: [10, 10, 10], w: [243, 242, 238], v: [255, 74, 28], c: [43, 63, 255],
};
configure({ width: 1920, height: 1080, bpm: 120, duration: 15, ink: PAL.w, walls: { lit: PAL.c, dark: PAL.v, light: PAL.w } });
const NA = 9;
let DROSTE = null; // {P:[x,y], F}
postFn = t => {
  if (!DROSTE || t < T(27) || t >= T(28)) return null;
  const u = E.exio((t - T(27)) / 0.5);
  return { Z: Math.pow(DROSTE.F, u), s: u, P: DROSTE.P };
};

// ---------- the score: scene targets ----------
const PAT_HOOK = ['v', 'w', 'c', 'w', 'w', 'w', 'c', 'w', 'v'];
const PAT_PIL = ['w', 'v', 'w', 'c', 'w', 'v', 'w', 'c', 'w'];
const PAT_3 = ['w', 'v', 'c', 'w', 'v', 'c', 'w', 'v', 'c'];
const PAT_GRID = ['c', 'w', 'v', 'w', 'w', 'w', 'v', 'w', 'c'];
const DATA_A = [210, 300, 250, 390, 330, 460, 410, 540, 480];
const DATA_B = [340, 220, 410, 280, 520, 300, 450, 360, 240];
const RANK_B = (() => { const idx = DATA_B.map((v, i) => i).sort((a, b) => DATA_B[a] - DATA_B[b]); const r = []; idx.forEach((ag, k) => r[ag] = k); return r; })();
const PEAK = RANK_B.indexOf(8);
const BASE = 290, BW = 110, BP = 150;
const CELL_OF_RANK = [6, 7, 8, 3, 5, 0, 1, 2, 4];
const DATA_C = [300, 420, 520, 260, 640, 380, 460, 340, 560];
const H_G1 = [160, 240, 200, 280, 220, 180, 300, 220, 260];
const H_G2 = [240, 160, 280, 200, 300, 220, 200, 280, 180];
let TITLE2, TITLE1, CARD;

function build() {
  const sq160 = simple(poly.rect(160, 160));
  const ONE = layout('ONE', 560), SHAPE = layout('SHAPE', 400), CANBE = layout('CAN BE', 400), ANY = layout('ANYTHING', 250);
  TITLE2 = layout('SQUARE', 330, -165).concat(layout('ONE', 330, 165));
  TITLE1 = layout('SQUARE ONE', 200, 0);
  const T1UP = TITLE1.map(o => Object.assign({}, o, { y: -36 }));

  for (let i = 0; i < NA; i++) {
    const r = Math.floor(i / 3) - 1, c = i % 3 - 1;
    const keys = [], pulses = [];
    // BAR 1 — hook
    keys.push(K(0, { shape: sq160, x: 0, y: 0, col: PAL.w }));
    pulses.push({ prop: 'sx', amt: 0.16, t: 0, kind: 'punch', a: 0.07 }, { prop: 'sy', amt: -0.14, t: 0, kind: 'punch', a: 0.07 });
    keys.push(K(T(2), { shape: simple(poly.rect(150, 150)), x: c * 172, y: r * 172, col: PAL[PAT_HOOK[i]], ease: 'sp', d: 0.36 }));
    const dx = c * 290, dy = r * 290, a45 = 45 * DEG;
    keys.push(K(T(3), { shape: simple(poly.rect(150, 150)), x: dx * Math.cos(a45) - dy * Math.sin(a45), y: dx * Math.sin(a45) + dy * Math.cos(a45), rot: 45, col: PAL[PAT_HOOK[i]], ease: 'exo', d: 0.34, dl: i * 0.008 }));
    keys.push(K(T(4), { shape: simple(poly.rect(86, 600)), x: (i - 4) * 124, y: 0, rot: 0, col: PAL[PAT_PIL[i]], ease: 'exo', d: 0.34, dl: Math.abs(i - 4) * 0.012 }));
    // BAR 2 — kinetic type
    const one = ONE[Math.floor(i / 3)];
    keys.push(K(T(5), { shape: one.shape, x: one.x, y: one.y, col: PAL.w, ease: 'exo', d: 0.3, me: 'exio' }));
    pulses.push({ prop: 'sy', amt: 0.1, t: T(5) + 0.06, kind: 'punch', a: 0.06 });
    const shp = spread(SHAPE, i, NA);
    keys.push(K(T(6), { shape: shp.shape, x: shp.x, y: shp.y, col: PAL.w, ease: 'exo', d: 0.3, dl: i * 0.01, me: 'exio' }));
    const cb = spread(CANBE, i, NA);
    keys.push(K(T(7), { shape: cb.shape, x: cb.x, y: cb.y, col: cb.x > 0 ? PAL.c : PAL.w, ease: 'exio', d: 0.26, dl: i * 0.012, me: 'mid' }));
    pulses.push({ prop: 'sy', amt: -1, t: T(7) + i * 0.012, kind: 'bump', a: 0.26 });
    const an = spread(ANY, i, NA);
    keys.push(K(T(8), { shape: an.shape, x: an.x, y: an.y, col: PAL.v, ease: 'exo', d: 0.36, me: 'exio' }));
    pulses.push({ prop: 'x', amt: an.x * 1.25, t: T(8), kind: 'whip', a: 0.085 });
    // BAR 3 — shape morph
    keys.push(K(T(9), { shape: simple(poly.circle(70)), x: (i - 4) * 168, y: 0, col: PAL[PAT_3[i]], ease: 'exio', d: 0.36, dl: i * 0.006 }));
    const ang = -90 + i * 40;
    keys.push(K(T(10), { shape: simple(poly.tri(86)), x: 330 * Math.cos(ang * DEG), y: 330 * Math.sin(ang * DEG), rot: ang + 90, col: PAL[PAT_3[i]], ease: 'exio', d: 0.38 }));
    keys.push(K(T(11), { shape: simple(poly.rect(164, 164)), x: c * 188, y: r * 188, rot: 180, col: PAL[PAT_GRID[i]], ease: 'exio', d: 0.36, dl: (Math.abs(r) + Math.abs(c)) * 0.015 }));
    {
      const a0 = (-90 + i * 40 + 1.6) * DEG, a1 = (-90 + (i + 1) * 40 - 1.6) * DEG, pg = poly.sector(176, 344, a0, a1);
      const cen = centroid(resample(pg, 128)); const loc = pg.map(q => [q[0] - cen[0], q[1] - cen[1]]);
      keys.push(K(T(12), { shape: simple(loc), x: cen[0], y: cen[1], rot: 180, col: PAL[PAT_3[i]], ease: 'exio', d: 0.36 }));
      pulses.push({ prop: 'orbit', amt: -80, t: T(12), kind: 'whip', a: 0.14 });
    }
    // BAR 4 — data / UI
    const bx = (i - 4) * BP;
    keys.push(K(T(13), { shape: simple(poly.rect(BW, DATA_A[i])), x: bx, y: BASE - DATA_A[i] / 2, rot: 0, col: PAL.w, ease: 'exio', d: 0.36, dl: i * 0.008 }));
    keys.push(K(T(14), { shape: simple(poly.rect(BW, DATA_B[i])), x: bx, y: BASE - DATA_B[i] / 2, col: PAL.w, ease: 'sp', d: 0.34, dl: i * 0.012 }));
    const sx_ = (RANK_B[i] - 4) * BP;
    keys.push(K(T(15), { shape: simple(poly.rect(BW, DATA_B[i])), x: sx_, y: BASE - DATA_B[i] / 2, col: PAL.w, ease: 'exio', d: 0.36 }));
    keys.push(K(T(16), { shape: simple(poly.rect(BW, DATA_B[i] * (i === PEAK ? 1.06 : 1))), x: sx_, y: BASE - DATA_B[i] * (i === PEAK ? 1.06 : 1) / 2, col: i === PEAK ? PAL.v : PAL.w, ease: 'sp', d: 0.36 }));
    // BAR 5 — 2D → 3D
    const hB = DATA_B[i] * (i === PEAK ? 1.06 : 1);
    keys.push(K(T(17), { shape: simple(poly.rect(BW, BW)), x: sx_, y: BASE - BW / 2, h: hB, col: i === PEAK ? PAL.v : PAL.w, ease: 'exio', d: 0.5 }));
    const cell = CELL_OF_RANK[RANK_B[i]], gr = Math.floor(cell / 3) - 1, gc = cell % 3 - 1;
    const gx = gc * 190, gy = gr * 190;
    keys.push(K(T(18), { shape: simple(poly.rect(130, 130)), x: gx, y: gy, h: hB, col: i === PEAK ? PAL.v : PAL.w, ease: 'exio', d: 0.38, dl: RANK_B[i] * 0.008 }));
    keys.push(K(T(19), { shape: simple(poly.rect(130, 130)), x: gx, y: gy, h: DATA_C[cell], col: i === PEAK ? PAL.v : PAL.w, ease: 'sp', d: 0.34, dl: cell * 0.012 }));
    keys.push(K(T(20), { shape: simple(poly.circle(70)), x: gx, y: gy, h: DATA_C[cell] * 0.8, col: PAL.w, ease: 'exio', d: 0.36, dl: (gr + gc + 2) * 0.015 }));
    // BAR 6 — riser: the city becomes type
    const tg = TITLE2[i];
    keys.push(K(T(21), { shape: tg.shape, x: tg.x, y: tg.y, h: H_G1[i], col: i >= 6 ? PAL.v : PAL.w, ease: 'exio', d: 0.4, dl: i * 0.006 }));
    keys.push(K(T(22), { shape: tg.shape, x: tg.x, y: tg.y, h: H_G2[i], col: i >= 6 ? PAL.v : PAL.w, ease: 'sp', d: 0.34, dl: i * 0.015 }));
    keys.push(K(T(23), { shape: tg.shape, x: tg.x, y: tg.y, h: 90, col: PAL.w, ease: 'exio', d: 0.34, dl: i * 0.008 }));
    keys.push(K(T(24), { shape: tg.shape, x: tg.x, y: tg.y, h: 340, col: PAL.w, ease: 'exio', d: 0.42 }));
    // BAR 7 — strongest: crush flat, slide, push through the O
    keys.push(K(T(25), { shape: tg.shape, x: tg.x, y: tg.y, h: 0, col: PAL.w, ease: 'exo', d: 0.32 }));
    const off_ = i < 6 ? -150 : 330;
    keys.push(K(T(26), { shape: tg.shape, x: tg.x + off_, y: tg.y, col: i >= 6 ? PAL.v : PAL.w, ease: 'exo', d: 0.38, dl: (i < 6 ? 5 - i : i - 6) * 0.015 }));
    keys.push(K(T(28), { shape: tg.shape, x: tg.x, y: tg.y, col: PAL.w, ease: 'step', d: 1 }));       // Droste hand-off
    const t1 = TITLE1[i];
    keys.push(K(T(28), { shape: t1.shape, x: t1.x, y: t1.y, col: PAL.w, ease: 'exo', d: 0.34, dl: (i < 6 ? 0 : 0.02) }));
    // END TITLE
    keys.push(K(T(29), { shape: t1.shape, x: t1.x, y: T1UP[i].y, col: PAL.w, ease: 'exo', d: 0.32, dl: i * 0.008 }));
    keys.push(K(T(30), { shape: sq160, x: 0, y: 0, col: PAL.w, ease: 'exio', d: 0.42, dl: Math.abs(i - 4) * 0.008 }));
    buildAgent(keys, pulses);
  }

  // camera keys
  const C = (t, o) => Object.assign({ t, ease: 'exio', d: 0.5, tilt: 0, spin: 0, zoom: 1, cx: 0, cy: 0, py: 0 }, o);
  camKeys.push(C(0, {}));
  camKeys.push(C(T(17), { tilt: 58, spin: -22, zoom: 0.9, cx: 0, cy: 150, py: 120, d: 0.55 }));
  camKeys.push(C(T(18), { tilt: 58, spin: -38, zoom: 0.92, cx: 0, cy: 0, py: 150, d: 0.45 }));
  camKeys.push(C(T(19), { tilt: 60, spin: -50, zoom: 1.0, py: 170, d: 0.45 }));
  camKeys.push(C(T(20), { tilt: 62, spin: -64, zoom: 0.98, py: 150, d: 0.45 }));
  camKeys.push(C(T(21), { tilt: 52, spin: -22, zoom: 0.72, py: 70, d: 0.46 }));
  camKeys.push(C(T(22), { tilt: 48, spin: 14, zoom: 0.72, py: 60, d: 0.44 }));
  camKeys.push(C(T(23), { tilt: 44, spin: 24, zoom: 0.78, py: 50, d: 0.44 }));
  camKeys.push(C(T(24), { tilt: 56, spin: 8, zoom: 0.8, py: 110, d: 0.46 }));
  camKeys.push(C(T(25), { tilt: 0, spin: 0, zoom: 1, cy: 0, py: 0, ease: 'exo', d: 0.3 }));

  // Droste: push through the counter of the O (agent 6)
  const o6 = agents[6].keys.find(k => k.t === T(26));
  const hc = o6.shape.cen[1];
  let hx0 = Infinity, hx1 = -Infinity, hy0 = Infinity, hy1 = -Infinity;
  { const [o, n] = SLOT[1]; for (let k = 0; k < n; k++) { const x = o6.shape.p[2 * (o + k)], y = o6.shape.p[2 * (o + k) + 1]; hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x); hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y); } }
  const ax = (hx1 - hx0) / 2, ay = (hy1 - hy0) / 2;
  const F = Math.sqrt((960 / ax) ** 2 + (540 / ay) ** 2) * 1.08;
  DROSTE = { P: [o6.x + hc[0], o6.y + hc[1]], F, hc, ax, ay };
}


function drawChartUI(ctx, t, proj) {
  // baseline: draws on at b13, becomes a floor line, retracts at b25
  const bl = E.exo((t - T(13)) / 0.4) * (1 - E.exo((t - T(25)) / 0.3));
  if (bl > 0) lineWorld(ctx, proj, -720 * bl, BASE, 720 * bl, BASE, 4, rgb(PAL.w));
  // gridlines (b14 → retract b17)
  for (let k = 1; k <= 3; k++) {
    const g = E.exo((t - T(14) - k * 0.04) / 0.36) * (1 - E.exio((t - T(17)) / 0.2));
    if (g > 0) lineWorld(ctx, proj, -720, BASE - 150 * k, -720 + 1440 * g, BASE - 150 * k, 2, 'rgba(243,242,238,0.22)');
  }
  if (t >= T(14) && t < T(17) + 0.25) {
    const inn = E.exo((t - T(14)) / 0.34), out = E.exio((t - T(17)) / 0.22), vis = inn * (1 - out);
    // counter (mask reveal from the baseline of the numerals)
    const val = Math.round(248 * E.exo((t - T(14)) / 0.45) + 64 * E.exo((t - T(15)) / 0.45));
    ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - 760, H / 2 - 520, 700, 210 * vis); ctx.clip();
    txt(ctx, 'YOY GROWTH', W / 2 - 752, H / 2 - 455 + (1 - vis) * 40, 26, 'rgba(243,242,238,0.6)', 'left', 6);
    txt(ctx, '+' + val + '%', W / 2 - 760, H / 2 - 330 + (1 - vis) * 120, 150, rgb(PAL.w));
    ctx.restore();
    // segmented toggle 2025 | 2026
    const tw = 300 * E.exo((t - T(14) - 0.05) / 0.36) * (1 - out), th = 72, tx = W / 2 + 460, ty = H / 2 - 450;
    if (tw > 2) {
      ctx.save(); rrect(ctx, tx + (300 - tw) / 2, ty, tw, th, 36); ctx.clip();
      rrect(ctx, tx + 1.5, ty + 1.5, 297, th - 3, 34.5); ctx.lineWidth = 3; ctx.strokeStyle = rgb(PAL.w); ctx.stroke();
      const kx = lerp(tx + 7, tx + 150, E.exio((t - T(15)) / 0.32));
      rrect(ctx, kx, ty + 7, 143, th - 14, 29); ctx.fillStyle = rgb(PAL.c); ctx.fill();
      txt(ctx, '2025', tx + 78, ty + 47, 28, rgb(PAL.w), 'center', 1);
      txt(ctx, '2026', tx + 222, ty + 47, 28, rgb(PAL.w), 'center', 1);
      ctx.restore();
    }
    // peak value (b16)
    const pk = E.exo((t - T(16)) / 0.3) * (1 - out);
    if (pk > 0) {
      const top = BASE - DATA_B[PEAK] * 1.06, x = (8 - 4) * BP;
      ctx.save(); ctx.beginPath(); ctx.rect(W / 2 + x - 120, H / 2 + top - 26 - 70 * pk, 240, 70 * pk); ctx.clip();
      txt(ctx, '552', W / 2 + x, H / 2 + top - 26, 60, rgb(PAL.v), 'center', -1);
      ctx.restore();
    }
  }
}
function drawFloor(ctx, t, proj) {
  const g = E.exio((t - T(17) - 0.1) / 0.6) * (1 - E.exo((t - T(25)) / 0.25));
  if (g <= 0) return;
  const L = 1250 * g;
  for (let k = -6; k <= 6; k++) {
    const p = k * 190 + 95; if (Math.abs(p) > L) continue;
    lineWorld(ctx, proj, -L, p, L, p, 2, 'rgba(243,242,238,0.2)');
    lineWorld(ctx, proj, p, -L, p, L, 2, 'rgba(243,242,238,0.2)');
  }
}

// ---------- frame ----------
function seek(t) {
  t = ((t % DUR) + DUR) % DUR;
  const proj = makeProj(t);
  // background
  let bg = PAL.k;
  if (t >= T(28) && t < T(29)) bg = PAL.c;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = rgb(bg); ctx.fillRect(0, 0, W, H);

  // end card (cobalt field contracts into a card, then into the square)
  if (t >= T(29)) {
    blurred(ctx, t, tt => {
      const a = E.exo((tt - T(29)) / 0.36), b = E.exio((tt - T(30) - 0.02) / 0.42);
      const w = lerp(lerp(2140, 1600, a), 160, b), h = lerp(lerp(1300, 420, a), 160, b), y = lerp(lerp(0, 24, a), 0, b);
      const col = PAL.c.map((c, i) => lerp(c, PAL.w[i], b));
      const x0 = W / 2 - w / 2, y0 = H / 2 + y - h / 2;
      return { w, h, y, col, bbox: [x0, y0, x0 + w, y0 + h], probe: [x0, y0, x0 + w, y0 + h] };
    }, (c2, g) => { c2.fillStyle = rgb(g.col); c2.fillRect(g.bbox[0], g.bbox[1], g.w, g.h); });
  }

  if (t >= T(13) && t < T(26)) { drawFloor(ctx, t, proj); drawChartUI(ctx, t, proj); }

  // agents, back to front
  const order = agents.map((a, i) => ({ i, d: geom(agentState(a, t), proj).depth })).sort((p, q) => p.d - q.d);
  for (const o of order) {
    const a = agents[o.i];
    blurred(ctx, t, tt => geom(agentState(a, tt), makeProj(tt)), drawGeom);
  }

  // O counter floods cobalt, with the title waiting inside it (Droste)
  if (t >= T(26) && t < T(28)) {
    const a6 = agents[6];
    blurred(ctx, t, tt => {
      const st = agentState(a6, tt), pj = makeProj(tt), g = E.exo((tt - T(26) - 0.08) / 0.3);
      const [o, n] = SLOT[1]; const hc = DROSTE.hc; const pts = []; const tmp = [0, 0, 0];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < n; k++) {
        const lx = hc[0] + (st.pts[2 * (o + k)] - hc[0]) * g, ly = hc[1] + (st.pts[2 * (o + k) + 1] - hc[1]) * g;
        pj(st.x + lx, st.y + ly, 0, tmp); pts.push(tmp[0], tmp[1]);
        x0 = Math.min(x0, tmp[0]); x1 = Math.max(x1, tmp[0]); y0 = Math.min(y0, tmp[1]); y1 = Math.max(y1, tmp[1]);
      }
      return { pts, bbox: [x0, y0, x1, y1], probe: [pts[0], pts[1], pts[n], pts[n + 1]] };
    }, (c2, g) => { c2.beginPath(); c2.moveTo(g.pts[0], g.pts[1]); for (let k = 2; k < g.pts.length; k += 2) c2.lineTo(g.pts[k], g.pts[k + 1]); c2.closePath(); c2.fillStyle = rgb(PAL.c); c2.fill(); });
    // the copy, at 1/F scale, sits inside the counter
    const ins = E.exo((t - T(26) - 0.2) / 0.3);
    if (ins > 0) {
      ctx.save();
      for (let i = 0; i < NA; i++) {
        const kk = agents[i].keys.find(k => k.ease === 'step');
        const st = { x: kk.x, y: kk.y, sx: ins, sy: ins, rot: 0, h: 0, orbit: 0, pts: kk.shape.p, col: PAL.w };
        blurred(ctx, t, tt => geom(st, makeProj(tt), { ox: DROSTE.P[0], oy: DROSTE.P[1], k: DROSTE.F }), drawGeom);
      }
      ctx.restore();
    }
  }

  // subtitle
  if (t >= T(29) && t < T(30) + 0.3) {
    const a = E.exo((t - T(29) - 0.06) / 0.34), b = E.exio((t - T(30)) / 0.2);
    const w = 1300 * a * (1 - b), y = H / 2 + 128;
    if (w > 1) { ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - w / 2, y - 44, w, 60 * (1 - b)); ctx.clip(); txt(ctx, 'MOTION REEL — 2026', W / 2 + 7, y, 34, rgb(PAL.w), 'center', 14); ctx.restore(); }
  }
}

// ---------- soundtrack ----------
const renderAudio = () => renderWav((ac, master, { nb, noise, env, pan }) => {

  function kick(t, big) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(big ? 190 : 160, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    env(g, t, 0.002, big ? 1.0 : 0.9, 0.38); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.5);
    const n = noise(t, 0.02), f = ac.createBiquadFilter(), g2 = ac.createGain(); f.type = 'highpass'; f.frequency.value = 2500; env(g2, t, 0.001, 0.22, 0.012); n.connect(f); f.connect(g2); g2.connect(master);
  }
  function hat(t, v) { const n = noise(t, 0.08), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 8000; env(g, t, 0.001, v, 0.045); n.connect(f); f.connect(g); pan(g, 0.25).connect(master); }
  function bass(t, hz, len) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = hz; o2.frequency.value = hz / 2; f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(140, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + len + 0.05); o2.stop(t + len + 0.05);
  }
  function hit(t, big) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(big ? 120 : 95, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
    env(g, t, 0.003, big ? 0.9 : 0.6, big ? 1.1 : 0.7); o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.3);
    const n = noise(t, 0.6), f = ac.createBiquadFilter(), g2 = ac.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(big ? 9000 : 6000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.4); env(g2, t, 0.002, big ? 0.5 : 0.32, 0.4); n.connect(f); f.connect(g2); g2.connect(master);
    // metallic stab: detuned square partials through a resonant band
    [220, 330.6, 441.7, 587.3].forEach((hz, k) => {
      const s = ac.createOscillator(), bp = ac.createBiquadFilter(), gs = ac.createGain();
      s.type = 'square'; s.frequency.value = hz * (big ? 1 : 1); s.detune.value = (k - 1.5) * 9; bp.type = 'bandpass'; bp.frequency.value = 1800 + k * 700; bp.Q.value = 3;
      env(gs, t, 0.002, big ? 0.09 : 0.06, big ? 0.5 : 0.28); s.connect(bp); bp.connect(gs); pan(gs, (k - 1.5) * 0.4).connect(master); s.start(t); s.stop(t + 0.9);
    });
  }
  function whoosh(t, d, f0, f1, v) {
    const n = noise(t, d), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'bandpass'; f.Q.value = 1.5;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.connect(f); f.connect(g); g.connect(master);
  }
  // riser into the last full bar (bar 6 → beat 25)
  {
    const t0 = T(21), t1 = T(25);
    const n = ac.createBufferSource(); n.buffer = nb; n.loop = true; n.start(t0); n.stop(t1);
    const f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'bandpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(9000, t1);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.45, t1 - 0.01); g.gain.linearRampToValueAtTime(0, t1);
    n.connect(f); f.connect(g); g.connect(master);
    const o = ac.createOscillator(), go = ac.createGain(), lp = ac.createBiquadFilter(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(880, t1); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t0); lp.frequency.exponentialRampToValueAtTime(6000, t1);
    go.gain.setValueAtTime(0.0001, t0); go.gain.exponentialRampToValueAtTime(0.12, t1 - 0.01); go.gain.linearRampToValueAtTime(0, t1);
    o.connect(lp); lp.connect(go); go.connect(master); o.start(t0); o.stop(t1);
  }
  const ROOT = [55, 55, 43.65, 49, 41.2, 43.65, 55, 55];
  for (let b = 1; b <= 30; b++) {
    const t = T(b);
    kick(t, b === 25);
    hat(t + 0.25, b >= 21 && b <= 24 ? 0.32 : 0.22);
    if (b >= 5 && b < 29) bass(t + 0.25, ROOT[Math.floor((b - 1) / 4)] * 2, 0.22);
  }
  [T(5), T(9), T(13), T(17), T(21), T(29)].forEach(t => hit(t, false));
  hit(T(25), true);
  whoosh(T(27), 0.5, 200, 7000, 0.35);
  whoosh(T(30), 0.42, 5000, 300, 0.2);
});

bootReel({ fontB64: FONT_B64, build, seek, audio: renderAudio });
