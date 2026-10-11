# Engine reference (`scripts/engine.js`)

Plain globals, loaded after opentype.js and before your score (build.js does this). Coordinates are
**world pixels with the origin at frame centre**, x right, y down; `z` is up out of the floor (extrusion).

## Contents
1. Config and time
2. Easing and pulses
3. Shapes (geometry, glyphs, layout)
4. Agents and keyframes, the core model
5. Camera, projection, 3D
6. Drawing and motion blur
7. Audio
8. Boot and the score skeleton

## 1. Config and time
- `configure({ width, height, bpm, duration, ink, walls })`: call first in the score. `ink` is the
  default shape colour; `walls = { lit, dark, light }` are extrusion side colours (RGB arrays).
- `W, H, BEAT, DUR`: current values. `T(b)` gives the start time of beat `b` (1-based). Use `T()`
  everywhere so the piece stays on the grid.
- `rgb(c)`, `lerp`, `clamp`, `DEG`.

## 2. Easing and pulses
`E[name](p)` maps normalized progress `p = (t − start) / duration` to 0..1, exactly 1 at p ≥ 1:
`exo` (exponential out, the workhorse), `exio` (exponential in-out, morphs and camera), `sp` (critically
damped spring with no overshoot, good for settles), `step` (instant), `mid` (snaps around p = 0.5, used to
switch shape at the hidden midpoint of a flip).

`PULSE[kind](τ, a)`: transients that start and end at 0, so they can't cause a jump:
`punch` (peak 1 at τ = a; squash on a kick), `whip` (instant rise, exponential decay `a`; tracking slams
and spin-ins), `bump` (sin over duration `a`; flips via `sy: −1`).

## 3. Shapes
A shape is a fixed-size point set: slot 0 is the outer contour (256 pts), slots 1–2 are holes (96 pts each),
and slot 3 is an extra outer part such as the tail of a Q (64 pts). Every shape therefore morphs into every
other. Missing slots collapse to a point where the neighbouring key's contour is, so counters grow and
shrink in place.
- `poly.rect(w,h)`, `poly.circle(r)`, `poly.tri(R)`, `poly.sector(r0,r1,a0,a1)`: raw polygons in
  local coordinates (centre at 0,0). `simple(poly)` turns one into a shape. Corners are preserved when resampling.
- `glyphShape(ch, size)` → `{ shape, cx, capH, xmin, xmax }`: the real font outline, centred on its
  bbox x and mid cap-height (the pivot for flips and scales).
- `layout(str, size, y, track)` → `[{ ch, shape, x, y }]`: the word kerned and centred at `(0, y)`;
  spaces are skipped.
- `spread(items, i, n)`: maps agent `i` of `n` onto `items`. Extra agents stack on a neighbour
  (invisible) and split out on the next word. That's how 3 letters become 9 cells.
- Glyphs with more than 2 holes or several separate outers (`%`, `i`, `j`, accents) don't fit the slots.
  Draw them with `txt()` instead of making them agents.

## 4. Agents and keyframes
An **agent** is one shape that lives for the whole piece (a typical count is 5–12). It is the reason
nothing cuts: every scene is a new arrangement of the same agents.

```js
buildAgent(keys, pulses)
K(t, { shape, x, y, sx, sy, rot, h, orbit, col, ease, me, d, dl })
```
- `t`: start time, usually `T(beat)`. `d`: duration. `dl`: per-agent delay (stagger). `ease`: easing
  for transforms and colour. `me`: easing for the shape morph (defaults to `ease`).
- `x, y`: position. `sx, sy`: scale. `rot`: degrees. `orbit`: degrees of rotation of the position
  about the origin (rings and donuts). `h`: extrusion height (0 = flat). `col`: RGB.
- **Superposition model:** value(t) = key0 + Σ (keyₖ − keyₖ₋₁) · easeₖ(t). Overlapping transitions
  add, so an interrupted move never jumps. Keys must be in time order. A `step` key re-bases
  instantly (used for the Droste hand-off).
- `buildAgent` aligns each contour's start point to the previous key's (minimum distance cyclic shift),
  so morphs don't twist.
- Pulses: `{ prop, amt, t, kind, a }` adds `amt · PULSE[kind](t − t0, a)` to `prop`.
  Examples: `{prop:'sy', amt:-0.14, t:0, kind:'punch', a:0.07}` for a kick squash;
  `{prop:'x', amt:x*1.25, t, kind:'whip', a:0.085}` for a tracking slam from wide to tight;
  `{prop:'sy', amt:-1, t, kind:'bump', a:0.26}` with `me:'mid'` for a split-flap flip.
- `agentState(agent, t)` → `{ x, y, ..., pts, col }`.

## 5. Camera and 3D
- `camKeys.push({ t, ease, d, tilt, spin, zoom, cx, cy, py })`, also superposed. `tilt` (degrees) lays
  the picture plane back into a floor; `spin` orbits about the vertical axis; `cx, cy` is the world point at
  the centre; `py` is a screen-space vertical offset (keeps tall extrusions in frame); `zoom`. The first key
  is the rest state, with every field given.
- `makeProj(t)` → `proj(x, y, z, out)` giving screen `[X, Y, depth]`. At tilt = 0 and h = 0 it's
  the identity, so flat scenes are pixel-exact.
- `postFn = t => null | { Z, s, P:[x,y] }`: optional screen-space push applied after projection.
  It zooms by `Z` about `P` while sliding `P` to the centre by `s`. Used for the Droste push through a letter
  counter; see `square-one/score.js` (`DROSTE`, `F` computed from the counter's size so it covers the frame).
- Extrusion: give an agent `h > 0`. Walls are culled by screen winding, depth-sorted and coloured `lit`/`dark`
  by world normal, caps are drawn last. Agents are sorted by `geom(...).depth` (back to front) in `seek`.

## 6. Drawing and blur
- `geom(state, proj, xf?)` → projected geometry with bbox and probe points. `xf = {ox, oy, k}` draws a
  scaled copy (e.g. a 1/F title waiting inside a counter).
- `drawGeom(ctx, g)` draws walls and cap (nonzero fill, so overlapping outers union correctly).
- `blurred(ctx, t, evalFn, drawFn)` is **directional motion blur**. It measures how far the probe points move
  across the shutter (1/240 s), redraws the element at up to 16 sub-times and averages them with a running
  alpha (copy j drawn at 1/(j+1) gives the true mean over the background). Blur follows real motion,
  including rotation, morph and zoom. Use it for agents and for any moving non-agent layer (cards, floods):
  `evalFn(tt)` must return `{ bbox, probe:[x0,y0,x1,y1,...], ... }`.
- `render.js` also blends 3 subframes per frame, so the two stack into a ~270° shutter.
- 2D helpers for UI/labels: `txt(ctx, s, x, y, size, col, align, letterSpacing)` (font family
  `ReelFont`, weight 900), `lineWorld(ctx, proj, x0,y0,x1,y1, width, col)` (lines on the floor plane that
  tilt with the camera), `rrect`. Reveal UI with clip rects that grow, and dismiss it with clips that collapse.
  Don't fade it.

## 7. Audio
`renderWav((ac, out, { nb, noise, env, pan }) => { ... })` → Promise<base64 WAV> of length `DUR`.
`out` goes through a gentle compressor. `noise(t, dur)` is a deterministic noise source; `env(gainNode, t,
attack, peak, decay)`; `pan(node, p)` returns a panner to connect onward. Expose it as the score's `audio`.

## 8. Boot and score skeleton
```js
const PAL = { k:[10,10,10], w:[243,242,238], a:[...], b:[...] };
configure({ width:1920, height:1080, bpm:120, duration:15, ink:PAL.w, walls:{ lit:PAL.b, dark:PAL.a, light:PAL.w } });
const NA = 9;
function build() {                     // once, after the font loads: all keys, camera, precomputed layouts
  for (let i = 0; i < NA; i++) buildAgent([K(0, {...}), K(T(2), {...}), ...], [/* pulses */]);
  camKeys.push({ t:0, ease:'exio', d:.5, tilt:0, spin:0, zoom:1, cx:0, cy:0, py:0 }, ...);
}
function seek(t) {                      // pure: background → layers behind → agents (depth-sorted, blurred) → layers in front
  t = ((t % DUR) + DUR) % DUR; const proj = makeProj(t);
  ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; ctx.fillStyle = rgb(PAL.k); ctx.fillRect(0,0,W,H);
  const order = agents.map(a => ({ a, d: geom(agentState(a, t), proj).depth })).sort((p, q) => p.d - q.d);
  for (const { a } of order) blurred(ctx, t, tt => geom(agentState(a, tt), makeProj(tt)), drawGeom);
}
const renderAudio = () => renderWav((ac, out, u) => { /* kick every T(b), hits, riser */ });
bootReel({ fontB64: FONT_B64, build, seek, audio: renderAudio });
```
`bootReel` exposes `window.seek`, `window.renderAudio`, `window.REEL = {W,H,DUR,BEAT}`, and sets
`window.ready = true`. `?t=` renders a still, `?render=1` disables the live preview loop, and anything else
plays it live in the browser.
