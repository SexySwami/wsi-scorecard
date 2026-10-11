// STARTER — 4 s, 120 BPM (8 beats). Minimal score showing every engine feature once:
// square → word (glyph morph, staggered) → circles → bars → 3D towers (camera tilt) → flat → square (loop).
// Copy this file, then rewrite the scene list. Times come from T(beat), never hard-coded seconds.
const PAL = { k: [10, 10, 10], w: [243, 242, 238], a: [255, 74, 28], b: [43, 63, 255] };
configure({ width: 1920, height: 1080, bpm: 120, duration: 4, ink: PAL.w, walls: { lit: PAL.b, dark: PAL.a, light: PAL.w } });
const NA = 5;                        // number of agents (shapes) carried through the whole piece

function build() {
  const sq = simple(poly.rect(160, 160));
  const WORD = layout('MOVE', 420);  // [{ch, shape, x, y}] centred on (0, y)
  const H3 = [220, 360, 280, 420, 300];
  for (let i = 0; i < NA; i++) {
    const w = spread(WORD, i, NA), x = (i - 2) * 190;
    const keys = [
      K(T(1), { shape: sq, x: 0, y: 0 }),                                                       // loop frame
      K(T(2), { shape: w.shape, x: w.x, y: w.y, ease: 'exo', me: 'exio', d: 0.32, dl: i * 0.02 }),
      K(T(3), { shape: simple(poly.circle(80)), x, y: 0, col: i % 2 ? PAL.a : PAL.w, ease: 'exio', d: 0.36 }),
      K(T(4), { shape: simple(poly.rect(120, H3[i])), x, y: 200 - H3[i] / 2, col: PAL.w, ease: 'sp', d: 0.34, dl: i * 0.015 }),
      K(T(5), { shape: simple(poly.rect(120, 120)), x, y: 140, h: H3[i], col: i === 3 ? PAL.a : PAL.w, ease: 'exio', d: 0.45 }),
      K(T(6), { shape: simple(poly.rect(120, 120)), x, y: 140, h: H3[(i + 2) % NA], col: PAL.w, ease: 'sp', d: 0.34, dl: i * 0.02 }),
      K(T(7), { shape: simple(poly.rect(120, 120)), x, y: 0, h: 0, col: PAL.b, ease: 'exo', d: 0.3 }),
      K(T(8), { shape: sq, x: 0, y: 0, col: PAL.w, ease: 'exio', d: 0.42 }),                   // lands back on the loop frame
    ];
    const pulses = [{ prop: 'sy', amt: -0.12, t: T(1), kind: 'punch', a: 0.07 }];            // kick squash on beat 1
    buildAgent(keys, pulses);
  }
  const C = (t, o) => Object.assign({ t, ease: 'exio', d: 0.5, tilt: 0, spin: 0, zoom: 1, cx: 0, cy: 0, py: 0 }, o);
  camKeys.push(C(0, {}), C(T(5), { tilt: 58, spin: -24, zoom: 0.9, py: 120, d: 0.5 }), C(T(6), { tilt: 60, spin: -40, py: 140, d: 0.45 }),
    C(T(7), { ease: 'exo', d: 0.3 }));
}

function seek(t) {
  t = ((t % DUR) + DUR) % DUR;                 // pure function of t — no state between frames
  const proj = makeProj(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = rgb(PAL.k); ctx.fillRect(0, 0, W, H);
  const order = agents.map((a, i) => ({ a, d: geom(agentState(a, t), proj).depth })).sort((p, q) => p.d - q.d);
  for (const { a } of order) blurred(ctx, t, tt => geom(agentState(a, tt), makeProj(tt)), drawGeom);
}

const renderAudio = () => renderWav((ac, out, { noise, env }) => {
  for (let b = 1; b <= Math.round(DUR / BEAT); b++) {           // kick on every beat
    const t = T(b), o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    env(g, t, 0.002, 0.9, 0.38); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.5);
  }
  [T(2), T(5)].forEach(t => {                                   // hit on each scene change
    const n = noise(t, 0.5), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass';
    f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.4); env(g, t, 0.002, 0.4, 0.4);
    n.connect(f); f.connect(g); g.connect(out);
  });
});

bootReel({ fontB64: FONT_B64, build, seek, audio: renderAudio });
