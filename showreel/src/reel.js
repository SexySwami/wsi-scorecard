// SQUARE ONE — a 15 s showreel. Everything is a pure function of t inside window.seek(t).
'use strict';
const W = 1920, H = 1080, BEAT = 0.5, DUR = 15;
const T = b => (b - 1) * BEAT;               // beat number (1-based) -> seconds
const PAL = {
  k: [10, 10, 10], w: [243, 242, 238], v: [255, 74, 28], c: [43, 63, 255],
};
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
const spread = (items, i) => items[Math.floor(i * items.length / 9)];

// ---------- agents: keyframed by superposition of eased deltas ----------
const NA = 9;
const PROPS = ['x', 'y', 'sx', 'sy', 'rot', 'h', 'orbit', 'cr', 'cg', 'cb'];
const agents = [];   // [{keys:[...], pulses:[...]}]

function K(t, o) { return Object.assign({ t, d: 0.4, dl: 0, ease: 'exo', me: null, sx: 1, sy: 1, rot: 0, h: 0, orbit: 0 }, o); }
function setCol(k, c) { k.cr = c[0]; k.cg = c[1]; k.cb = c[2]; return k; }

function buildAgent(keys, pulses) {
  keys.forEach(k => { if (!k.col) k.col = PAL.w; setCol(k, k.col); k.shape = cloneShape(k.shape); });
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
let DROSTE = null; // {P:[x,y], F}
function post(t) {
  if (!DROSTE || t < T(27) || t >= T(28)) return null;
  const u = E.exio((t - T(27)) / 0.5);
  const Z = Math.pow(DROSTE.F, u); const s = u;
  return { Z, s, P: DROSTE.P };
}
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
  const dv = Math.hypot(col[0] - PAL.v[0], col[1] - PAL.v[1], col[2] - PAL.v[2]) / 300;
  const dc = Math.hypot(col[0] - PAL.c[0], col[1] - PAL.c[1], col[2] - PAL.c[2]) / 300;
  const wv = clamp(1 - dv), wc = clamp(1 - dc);
  const lit = PAL.c.map((c, i) => lerp(c, PAL.w[i], wc)), dark = PAL.v.map((c, i) => lerp(c, PAL.w[i], wv));
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
    const shp = spread(SHAPE, i);
    keys.push(K(T(6), { shape: shp.shape, x: shp.x, y: shp.y, col: PAL.w, ease: 'exo', d: 0.3, dl: i * 0.01, me: 'exio' }));
    const cb = spread(CANBE, i);
    keys.push(K(T(7), { shape: cb.shape, x: cb.x, y: cb.y, col: cb.x > 0 ? PAL.c : PAL.w, ease: 'exio', d: 0.26, dl: i * 0.012, me: 'mid' }));
    pulses.push({ prop: 'sy', amt: -1, t: T(7) + i * 0.012, kind: 'bump', a: 0.26 });
    const an = spread(ANY, i);
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

// ---------- layers that are not agents ----------
function txt(ctx, s, x, y, size, col, align = 'left', ls = 0) {
  ctx.font = `900 ${size}px InterX`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = ls + 'px'; ctx.fillText(s, x, y); ctx.letterSpacing = '0px';
}
function lineWorld(ctx, proj, x0, y0, x1, y1, w, col) {
  const a = proj(x0, y0, 0, [0, 0, 0]), b = proj(x1, y1, 0, [0, 0, 0]);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'butt'; ctx.stroke();
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

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
let cv, ctx;
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

// ---------- soundtrack (OfflineAudioContext) ----------
async function renderAudio() {
  const sr = 48000, ac = new OfflineAudioContext(2, sr * DUR, sr);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
  const master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
  const nb = ac.createBuffer(2, sr * 2, sr); for (let c = 0; c < 2; c++) { const d = nb.getChannelData(c); let s = 1234567 + c; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; } }
  const noise = (t, dur) => { const n = ac.createBufferSource(); n.buffer = nb; n.start(t, 0, dur); return n; };
  const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  const pan = (node, p) => { const pn = ac.createStereoPanner(); pn.pan.value = p; node.connect(pn); return pn; };

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
(async function boot() {
  cv = document.getElementById('c'); ctx = cv.getContext('2d');
  off = document.createElement('canvas'); off.width = W; off.height = H; offc = off.getContext('2d');
  const bin = atob(FONT_B64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  font = opentype.parse(u8.buffer); UPM = font.unitsPerEm;
  await document.fonts.load('900 100px InterX');
  build();
  window.seek = seek; window.renderAudio = renderAudio;
  const q = new URLSearchParams(location.search);
  if (q.has('t')) seek(parseFloat(q.get('t')));
  else if (!q.has('render')) { const t0 = performance.now(); const loop = () => { seek((performance.now() - t0) / 1000); requestAnimationFrame(loop); }; loop(); }
  window.ready = true;
})();
