// motion-graphics engine — load after opentype.js, before the score.
// Everything is a pure function of time: the score's seek(t) recomputes the whole frame from t.
'use strict';
let W = 1920, H = 1080, BEAT = 0.5, DUR = 15;
// INK: default shape colour. WALLS: extrusion side colours — `lit` and `dark` faces; a wall whose cap already
// matches that colour fades to `light` so a cap never merges with its own walls. All palette colours, no shading.
let INK = [243, 242, 238], WALLS = { lit: [43, 63, 255], dark: [255, 74, 28], light: [243, 242, 238] };
function configure(o) { if (o.ink) INK = o.ink; if (o.walls) WALLS = o.walls; if (o.width) W = o.width; if (o.height) H = o.height; if (o.bpm) BEAT = 60 / o.bpm; if (o.duration) DUR = o.duration; }
const T = b => (b - 1) * BEAT;               // beat number (1-based) -> seconds
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const lerp = (a, b, u) => a + (b - a) * u;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const DEG = Math.PI / 180;

// ---------- easing (all functions of elapsed time, no state) ----------
const E = {
  exo: p => p <= 0 ? 0 : p >= 1 ? 1 : (1 - Math.pow(2, -10 * p)) / (1 - Math.pow(2, -10)),
  exio: p => p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2,
  // critically damped spring (no overshoot): x(τ) = 1 − (1 + ωτ)e^{−ωτ}, normalised to land at p = 1
  sp: p => { if (p <= 0) return 0; if (p >= 1) return 1; const w = 9; return (1 - (1 + w * p) * Math.exp(-w * p)) / (1 - 10 * Math.exp(-9)); },
  step: p => p >= 0 ? 1 : 0,
  mid: p => { const u = clamp((p - 0.4) / 0.2); return u * u * (3 - 2 * u); },
};
// transient envelopes (start and end at 0 → continuous)
const PULSE = {
  punch: (tau, a) => tau <= 0 ? 0 : (tau / a) * Math.exp(1 - tau / a),               // peak 1 at τ = a
  whip: (tau, a) => tau <= 0 ? 0 : (1 - Math.exp(-tau / 0.018)) * Math.exp(-tau / a),
  bump: (tau, a) => tau <= 0 || tau >= a ? 0 : Math.sin(Math.PI * tau / a),
};

// ---------- font / geometry ----------
let font, UPM;
const NO = 256, NH = 96, NE = 64;
const SLOT = [[0, NO], [NO, NH], [NO + NH, NH], [NO + 2 * NH, NE]];
const NP = NO + 2 * NH + NE;

function sarea(p) { let a = 0; for (let i = 0, n = p.length; i < n; i++) { const q = p[i], r = p[(i + 1) % n]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; }
function centroid(p) { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; }

// corner-preserving arc-length resample of a closed polygon to n points
function resample(poly, n) {
  const m = poly.length;
  const corner = [];
  for (let i = 0; i < m; i++) {
    const a = poly[(i - 1 + m) % m], b = poly[i], c = poly[(i + 1) % m];
    const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu < 1e-9 || lv < 1e-9) continue;
    const cos = (ux * vx + uy * vy) / (lu * lv);
    if (cos < Math.cos(28 * DEG)) corner.push(i);
  }
  if (corner.length === 0 || corner.length > n / 3) corner.length = 0, corner.push(0);
  // runs between corners
  const runs = [];
  for (let k = 0; k < corner.length; k++) {
    const s = corner[k], e = corner[(k + 1) % corner.length];
    const pts = []; let i = s;
    do { pts.push(poly[i]); i = (i + 1) % m; } while (i !== e);
    pts.push(poly[e]);
    let L = 0; for (let j = 1; j < pts.length; j++) L += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
    runs.push({ pts, L });
  }
  const tot = runs.reduce((a, r) => a + r.L, 0);
  let budget = n - runs.length;
  const alloc = runs.map(r => Math.floor(r.L / tot * budget));
  let rem = budget - alloc.reduce((a, b) => a + b, 0);
  const order = runs.map((r, i) => [r.L / tot * budget - alloc[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < rem; k++) alloc[order[k % order.length][1]]++;
  const out = [];
  runs.forEach((r, ri) => {
    out.push(r.pts[0].slice());
    const cnt = alloc[ri]; if (cnt <= 0) return;
    const step = r.L / (cnt + 1); let target = step, acc = 0, j = 1;
    for (let q = 0; q < cnt; q++) {
      while (j < r.pts.length) {
        const a = r.pts[j - 1], b = r.pts[j], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (acc + l >= target) { const u = (target - acc) / l; out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]); break; }
        acc += l; j++;
      }
      if (j >= r.pts.length) out.push(r.pts[r.pts.length - 1].slice());
      target += step;
    }
  });
  while (out.length < n) out.push(out[out.length - 1].slice());
  return out.slice(0, n);
}

// shape = { p: Float64Array(2*NP), real:[4 bools], cen:[4 centroids] }
function makeShape(contours /* [{pts, role:'outer'|'hole'|'extra'}] */) {
  const p = new Float64Array(2 * NP); const real = [false, false, false, false]; const cen = [[0, 0], [0, 0], [0, 0], [0, 0]];
  const put = (slot, poly, sign) => {
    let r = resample(poly, SLOT[slot][1]);
    if (Math.sign(sarea(r)) !== sign) r.reverse();
    // canonical start: point closest to straight-up ray from the contour centroid
    const c = centroid(r); let best = 0, bv = Infinity;
    r.forEach((q, i) => { const a = Math.atan2(q[1] - c[1], q[0] - c[0]); const d = Math.abs(((a + Math.PI / 2) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); const v = d * 1000 - Math.hypot(q[0] - c[0], q[1] - c[1]); if (v < bv) { bv = v; best = i; } });
    r = r.slice(best).concat(r.slice(0, best));
    const o = SLOT[slot][0];
    r.forEach((q, i) => { p[2 * (o + i)] = q[0]; p[2 * (o + i) + 1] = q[1]; });
    real[slot] = true; cen[slot] = c;
  };
  const outer = contours.find(c => c.role === 'outer');
  put(0, outer.pts, 1);
  contours.filter(c => c.role === 'hole').slice(0, 2).forEach((c, k) => put(1 + k, c.pts, -1));
  const ex = contours.find(c => c.role === 'extra'); if (ex) put(3, ex.pts, 1);
  return { p, real, cen };
}
function collapseSlot(sh, slot, at) { const [o, n] = SLOT[slot]; for (let i = 0; i < n; i++) { sh.p[2 * (o + i)] = at[0]; sh.p[2 * (o + i) + 1] = at[1]; } }
function cloneShape(s) { return { p: s.p.slice(), real: s.real.slice(), cen: s.cen.map(c => c.slice()) }; }

const poly = {
  rect: (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]],
  circle: (r, n = 256) => Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + i / n * 2 * Math.PI; return [r * Math.cos(a), r * Math.sin(a)]; }),
  tri: R => [0, 1, 2].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; return [R * Math.cos(a), R * Math.sin(a)]; }),
  sector: (r0, r1, a0, a1, n = 64) => {
    const o = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([r1 * Math.cos(a), r1 * Math.sin(a)]); }
    for (let i = n; i >= 0; i--) { const a = lerp(a0, a1, i / n); o.push([r0 * Math.cos(a), r0 * Math.sin(a)]); }
    return o;
  },
};
const simple = pts => makeShape([{ pts, role: 'outer' }]);

// glyph outlines from Inter Black
const glyphCache = new Map();
function glyphShape(ch, size) {
  const key = ch + size; if (glyphCache.has(key)) return glyphCache.get(key);
  const path = font.getPath(ch, 0, 0, size);
  const cs = []; let cur = null, px = 0, py = 0;
  for (const c of path.commands) {
    if (c.type === 'M') { cur = [[c.x, c.y]]; cs.push(cur); px = c.x; py = c.y; }
    else if (c.type === 'L') { cur.push([c.x, c.y]); px = c.x; py = c.y; }
    else if (c.type === 'Q') { for (let k = 1; k <= 12; k++) { const u = k / 12, a = (1 - u) ** 2, b = 2 * u * (1 - u), d = u * u; cur.push([a * px + b * c.x1 + d * c.x, a * py + b * c.y1 + d * c.y]); } px = c.x; py = c.y; }
    else if (c.type === 'C') { for (let k = 1; k <= 12; k++) { const u = k / 12, a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, d = 3 * u * u * (1 - u), e = u ** 3; cur.push([a * px + b * c.x1 + d * c.x2 + e * c.x, a * py + b * c.y1 + d * c.y2 + e * c.y]); } px = c.x; py = c.y; }
  }
  const polys = cs.map(c => { const q = c.filter((pt, i) => i === 0 || Math.hypot(pt[0] - c[i - 1][0], pt[1] - c[i - 1][1]) > 1e-6); if (Math.hypot(q[0][0] - q[q.length - 1][0], q[0][1] - q[q.length - 1][1]) < 1e-6) q.pop(); return q; });
  let xmin = Infinity, xmax = -Infinity; polys.forEach(pp => pp.forEach(q => { xmin = Math.min(xmin, q[0]); xmax = Math.max(xmax, q[0]); }));
  const capH = font.tables.os2.sCapHeight / UPM * size;
  const cx = (xmin + xmax) / 2, cy = -capH / 2;
  const local = polys.map(pp => pp.map(q => [q[0] - cx, q[1] - cy]));
  const areas = local.map(sarea);
  let mi = 0; areas.forEach((a, i) => { if (Math.abs(a) > Math.abs(areas[mi])) mi = i; });
  const contours = local.map((pts, i) => ({ pts, role: i === mi ? 'outer' : Math.sign(areas[i]) === Math.sign(areas[mi]) ? 'extra' : 'hole', A: Math.abs(areas[i]) }));
  contours.sort((a, b) => b.A - a.A);
  const res = { shape: makeShape(contours), cx, capH, xmin, xmax };
  glyphCache.set(key, res); return res;
}

// lay out a string centred at (0, y); returns [{ch, shape, x, y}]
function layout(str, size, y = 0, track = 0) {
  const sc = size / UPM; const gl = font.stringToGlyphs(str); let x = 0; const it = [];
  for (let i = 0; i < gl.length; i++) {
    const ch = str[i];
    if (ch !== ' ') { const g = glyphShape(ch, size); it.push({ ch, shape: g.shape, pen: x, g }); }
    x += gl[i].advanceWidth * sc + track;
    if (i < gl.length - 1) x += font.getKerningValue(gl[i], gl[i + 1]) * sc;
  }
  const L = it[0].pen + it[0].g.xmin, R = it[it.length - 1].pen + it[it.length - 1].g.xmax, mid = (L + R) / 2;
  return it.map(o => ({ ch: o.ch, shape: o.shape, x: o.pen + o.g.cx - mid, y }));
}
// distribute n agents over the letters/items of a layout (extra agents stack on a neighbour, then split out later)
const spread = (items, i, n) => items[Math.floor(i * items.length / n)];

// ---------- agents: keyframed by superposition of eased deltas ----------
const PROPS = ['x', 'y', 'sx', 'sy', 'rot', 'h', 'orbit', 'cr', 'cg', 'cb'];
const agents = [];   // [{keys:[...], pulses:[...]}]

function K(t, o) { return Object.assign({ t, d: 0.4, dl: 0, ease: 'exo', me: null, sx: 1, sy: 1, rot: 0, h: 0, orbit: 0 }, o); }
function setCol(k, c) { k.cr = c[0]; k.cg = c[1]; k.cb = c[2]; return k; }

function buildAgent(keys, pulses) {
  keys.forEach(k => { if (!k.col) k.col = INK; setCol(k, k.col); k.shape = cloneShape(k.shape); });
  // align each contour of key k to key k-1 (cyclic shift minimising distance)
  for (let k = 1; k < keys.length; k++) {
    const A = keys[k - 1].shape, B = keys[k].shape;
    for (let s = 0; s < 4; s++) {
      if (!A.real[s] || !B.real[s]) continue;
      const [o, n] = SLOT[s]; let best = 0, bv = Infinity; const stride = Math.max(1, n >> 5);
      for (let sh = 0; sh < n; sh++) {
        let v = 0; for (let i = 0; i < n; i += stride) { const j = (i + sh) % n; const dx = A.p[2 * (o + i)] - B.p[2 * (o + j)], dy = A.p[2 * (o + i) + 1] - B.p[2 * (o + j) + 1]; v += dx * dx + dy * dy; }
        if (v < bv) { bv = v; best = sh; }
      }
      if (best) { const tmp = B.p.slice(2 * o, 2 * (o + n)); for (let i = 0; i < n; i++) { const j = (i + best) % n; B.p[2 * (o + i)] = tmp[2 * j]; B.p[2 * (o + i) + 1] = tmp[2 * j + 1]; } }
    }
  }
  // collapsed slots sit where the neighbouring key's contour is
  keys.forEach((k, i) => {
    for (let s = 1; s < 4; s++) if (!k.shape.real[s]) {
      const nx = keys[i + 1], pv = keys[i - 1];
      const at = nx && nx.shape.real[s] ? nx.shape.cen[s] : pv && pv.shape.real[s] ? pv.shape.cen[s] : (s === 3 ? [0, 0] : [0, 0]);
      collapseSlot(k.shape, s, at);
    }
  });
  agents.push({ keys, pulses: pulses || [] });
}

function agentState(a, t) {
  const k0 = a.keys[0];
  const st = {}; PROPS.forEach(p => st[p] = k0[p]);
  const pts = k0.shape.p.slice();
  for (let k = 1; k < a.keys.length; k++) {
    const K1 = a.keys[k], K0 = a.keys[k - 1];
    const ts = K1.t + K1.dl; if (t < ts) break;
    const p = (t - ts) / K1.d;
    const e = E[K1.ease](p), em = E[K1.me || K1.ease](p);
    for (const pr of PROPS) st[pr] += (K1[pr] - K0[pr]) * e;
    if (em > 0) { const A = K0.shape.p, B = K1.shape.p; if (em >= 1) for (let i = 0; i < pts.length; i++) pts[i] += B[i] - A[i]; else for (let i = 0; i < pts.length; i++) pts[i] += (B[i] - A[i]) * em; }
  }
  for (const pu of a.pulses) { const tau = t - pu.t; if (tau > 0) st[pu.prop] += pu.amt * PULSE[pu.kind](tau, pu.a); }
  st.pts = pts; st.col = [st.cr, st.cg, st.cb];
  return st;
}

// ---------- camera (also superposed keys) ----------
const CAMP = ['tilt', 'spin', 'zoom', 'cx', 'cy', 'py'];
const camKeys = [];
function camState(t) {
  const st = {}; CAMP.forEach(p => st[p] = camKeys[0][p]);
  for (let k = 1; k < camKeys.length; k++) {
    const c = camKeys[k]; if (t < c.t) break;
    const e = E[c.ease]((t - c.t) / c.d);
    for (const p of CAMP) st[p] += (c[p] - camKeys[k - 1][p]) * e;
  }
  return st;
}
// optional screen-space post transform (e.g. a Droste push), set by the score: postFn = t => null | {Z, s, P:[x,y]}
let postFn = null;
const post = t => postFn ? postFn(t) : null;
const FOCAL = 2300;
function makeProj(t) {
  const c = camState(t), pp = post(t);
  const ct = Math.cos(c.tilt * DEG), st_ = Math.sin(c.tilt * DEG), cs = Math.cos(c.spin * DEG), ss = Math.sin(c.spin * DEG);
  return (x, y, z, out) => {
    x -= c.cx; y -= c.cy;
    const x1 = x * cs - y * ss, y1 = x * ss + y * cs;
    const y2 = y1 * ct - z * st_, z2 = y1 * st_ + z * ct;
    const k = FOCAL / (FOCAL - z2) * c.zoom;
    let X = x1 * k, Y = y2 * k;
    if (pp) { X = (X - pp.P[0]) * pp.Z + pp.P[0] * (1 - pp.s); Y = (Y - pp.P[1]) * pp.Z + pp.P[1] * (1 - pp.s); }
    out[0] = X + W / 2; out[1] = Y + H / 2 + c.py; out[2] = z2;
    return out;
  };
}

// agent → screen geometry
function slotArea(pts, s) { const [o, n] = SLOT[s]; let a = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += pts[2 * (o + i)] * pts[2 * (o + j) + 1] - pts[2 * (o + j)] * pts[2 * (o + i) + 1]; } return a / 2; }
function geom(st, proj, xf) {
  // xf: optional extra world transform {ox, oy, k} (used for the Droste copy)
  const sxx = st.sx, syy = st.sy, rr = (st.rot + st.orbit) * DEG, cr = Math.cos(rr), sr = Math.sin(rr);
  const oc = Math.cos(st.orbit * DEG), os = Math.sin(st.orbit * DEG);
  let ax = st.x * oc - st.y * os, ay = st.x * os + st.y * oc, kk = 1;
  if (xf) { ax = xf.ox + ax / xf.k; ay = xf.oy + ay / xf.k; kk = 1 / xf.k; }
  const n = NP, wx = new Float64Array(n), wy = new Float64Array(n);
  for (let i = 0; i < n; i++) { const lx = st.pts[2 * i] * sxx * kk, ly = st.pts[2 * i + 1] * syy * kk; wx[i] = ax + lx * cr - ly * sr; wy[i] = ay + lx * sr + ly * cr; }
  const h = st.h * kk;
  const top = new Float64Array(3 * n), bot = h > 0.5 ? new Float64Array(3 * n) : null; const tmp = [0, 0, 0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    proj(wx[i], wy[i], h, tmp); top[3 * i] = tmp[0]; top[3 * i + 1] = tmp[1]; top[3 * i + 2] = tmp[2];
    x0 = Math.min(x0, tmp[0]); x1 = Math.max(x1, tmp[0]); y0 = Math.min(y0, tmp[1]); y1 = Math.max(y1, tmp[1]);
    if (bot) { proj(wx[i], wy[i], 0, tmp); bot[3 * i] = tmp[0]; bot[3 * i + 1] = tmp[1]; bot[3 * i + 2] = tmp[2]; x0 = Math.min(x0, tmp[0]); x1 = Math.max(x1, tmp[0]); y0 = Math.min(y0, tmp[1]); y1 = Math.max(y1, tmp[1]); }
  }
  const live = [0, 1, 2, 3].map(s => s === 0 || Math.abs(slotArea(st.pts, s)) * sxx * syy > 3);
  proj(ax, ay, h / 2, tmp);
  return { top, bot, wx, wy, live, col: st.col, depth: tmp[2], bbox: [x0, y0, x1, y1], probe: [top[0], top[1], top[3 * 64], top[3 * 64 + 1], top[3 * 128], top[3 * 128 + 1], top[3 * 192], top[3 * 192 + 1]] };
}

function wallColors(col) {
  const L = WALLS.lit, D = WALLS.dark, Wl = WALLS.light;
  const dv = Math.hypot(col[0] - D[0], col[1] - D[1], col[2] - D[2]) / 300;
  const dc = Math.hypot(col[0] - L[0], col[1] - L[1], col[2] - L[2]) / 300;
  const wv = clamp(1 - dv), wc = clamp(1 - dc);
  const lit = L.map((c, i) => lerp(c, Wl[i], wc)), dark = D.map((c, i) => lerp(c, Wl[i], wv));
  return [rgb(lit), rgb(dark)];
}

function drawGeom(ctx, g) {
  if (g.bot) {
    const [cLit, cDark] = wallColors(g.col);
    const walls = [];
    for (let s = 0; s < 4; s++) {
      if (!g.live[s]) continue;
      const [o, n] = SLOT[s];
      for (let i = 0; i < n; i++) {
        const a = o + i, b = o + (i + 1) % n;
        const ax = g.bot[3 * a], ay = g.bot[3 * a + 1], bx = g.bot[3 * b], by = g.bot[3 * b + 1];
        const cx = g.top[3 * b], cy = g.top[3 * b + 1], dx = g.top[3 * a], dy = g.top[3 * a + 1];
        const ar = (ax * by - bx * ay) + (bx * cy - cx * by) + (cx * dy - dx * cy) + (dx * ay - ax * dy);
        if (ar <= 0.5) continue;
        const ex = g.wx[b] - g.wx[a], ey = g.wy[b] - g.wy[a];
        const lit = (ey * -0.55 + -ex * 0.83) > 0; // world-space normal (ey,−ex) · light
        walls.push({ z: (g.bot[3 * a + 2] + g.bot[3 * b + 2] + g.top[3 * a + 2] + g.top[3 * b + 2]) / 4, q: [ax, ay, bx, by, cx, cy, dx, dy], lit });
      }
    }
    walls.sort((p, q) => p.z - q.z);
    let i = 0;
    ctx.lineJoin = 'round'; ctx.lineWidth = 1.2;
    while (i < walls.length) {
      const lit = walls[i].lit; ctx.beginPath();
      while (i < walls.length && walls[i].lit === lit) { const q = walls[i].q; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); ctx.lineTo(q[4], q[5]); ctx.lineTo(q[6], q[7]); ctx.closePath(); i++; }
      ctx.fillStyle = ctx.strokeStyle = lit ? cLit : cDark; ctx.fill(); ctx.stroke();
    }
  }
  ctx.beginPath();
  for (let s = 0; s < 4; s++) {
    if (!g.live[s]) continue;
    const [o, n] = SLOT[s];
    ctx.moveTo(g.top[3 * o], g.top[3 * o + 1]);
    for (let i = 1; i < n; i++) ctx.lineTo(g.top[3 * (o + i)], g.top[3 * (o + i) + 1]);
    ctx.closePath();
  }
  ctx.fillStyle = rgb(g.col); ctx.fill('nonzero');
}

// ---------- motion blur: directional, follows actual motion ----------
const SHUTTER = 1 / 240;
let off, offc;
function blurred(ctx, t, evalFn, drawFn) {
  const a = evalFn(t - SHUTTER / 2), b = evalFn(t + SHUTTER / 2);
  let d = 0; for (let i = 0; i < a.probe.length; i += 2) d = Math.max(d, Math.hypot(a.probe[i] - b.probe[i], a.probe[i + 1] - b.probe[i + 1]));
  const n = Math.min(16, Math.max(1, Math.ceil(d / 4)));
  if (n === 1) { drawFn(ctx, evalFn(t)); return; }
  for (let j = 0; j < n; j++) {
    const g = evalFn(t - SHUTTER / 2 + SHUTTER * (j + 0.5) / n);
    drawFn(offc, g);
    const x0 = clamp(Math.floor(g.bbox[0]) - 4, 0, W), y0 = clamp(Math.floor(g.bbox[1]) - 4, 0, H), x1 = clamp(Math.ceil(g.bbox[2]) + 4, 0, W), y1 = clamp(Math.ceil(g.bbox[3]) + 4, 0, H);
    if (x1 > x0 && y1 > y0) { ctx.globalAlpha = 1 / (j + 1); ctx.drawImage(off, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); offc.clearRect(x0, y0, x1 - x0, y1 - y0); }
  }
  ctx.globalAlpha = 1;
}


// ---------- 2D helpers for non-agent layers ----------
function txt(ctx, s, x, y, size, col, align = 'left', ls = 0) {
  ctx.font = `900 ${size}px ReelFont`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = ls + 'px'; ctx.fillText(s, x, y); ctx.letterSpacing = '0px';
}
function lineWorld(ctx, proj, x0, y0, x1, y1, w, col) {
  const a = proj(x0, y0, 0, [0, 0, 0]), b = proj(x1, y1, 0, [0, 0, 0]);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'butt'; ctx.stroke();
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// ---------- audio: render an OfflineAudioContext graph to a base64 16-bit WAV ----------
// graph(ac, out, util) wires sources into `out`; util has noise(), env(), pan()
async function renderWav(graph, sr = 48000) {
  const ac = new OfflineAudioContext(2, Math.round(sr * DUR), sr);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
  const master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
  const nb = ac.createBuffer(2, sr * 2, sr); for (let c = 0; c < 2; c++) { const d = nb.getChannelData(c); let s = 1234567 + c; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; } }
  const util = {
    nb,
    noise: (t, dur) => { const n = ac.createBufferSource(); n.buffer = nb; n.start(t, 0, dur); return n; },
    env: (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); },
    pan: (node, p) => { const pn = ac.createStereoPanner(); pn.pan.value = p; node.connect(pn); return pn; },
  };
  graph(ac, master, util);
  const buf = await ac.startRendering();
  // 16-bit WAV
  const L = buf.getChannelData(0), R = buf.getChannelData(1), N = L.length;
  const ab = new ArrayBuffer(44 + N * 4), dv = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + N * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, N * 4, true);
  for (let i = 0; i < N; i++) { dv.setInt16(44 + i * 4, clamp(L[i], -1, 1) * 32767, true); dv.setInt16(46 + i * 4, clamp(R[i], -1, 1) * 32767, true); }
  let s = ''; const u8 = new Uint8Array(ab); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---------- boot ----------
// MG.boot({ fontB64, build, seek, audio }) — audio is an async () => base64 WAV
let cv, ctx;
async function bootReel(o) {
  cv = document.getElementById('c'); cv.width = W; cv.height = H; ctx = cv.getContext('2d');
  off = document.createElement('canvas'); off.width = W; off.height = H; offc = off.getContext('2d');
  const bin = atob(o.fontB64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  font = opentype.parse(u8.buffer); UPM = font.unitsPerEm;
  await document.fonts.load('900 100px ReelFont');
  o.build();
  window.seek = o.seek; window.renderAudio = o.audio; window.REEL = { W, H, DUR, BEAT };
  const q = new URLSearchParams(location.search);
  if (q.has('t')) o.seek(parseFloat(q.get('t')));
  else if (!q.has('render')) { const t0 = performance.now(); const loop = () => { o.seek(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); }
  window.ready = true;
}
