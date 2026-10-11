# Craft cookbook

Patterns that worked, why they work, and what to reach for instead of the banned shortcuts.
`examples/square-one/score.js` implements almost all of them; search it for the beat numbers below.

## Contents
1. The one rule: continuity of matter
2. Technique patterns (hook, kinetic type, morph, data/UI, 2D→3D, climax, end title, loop)
3. Replacing banned effects
4. Rhythm and timing
5. Colour, type, camera
6. Sound design
7. Pitfalls seen in practice

## 1. Continuity of matter
Decide the **agents** (say 9) before the storyboard, and design every scene as a new arrangement of
them. 9 works well: a 3×3 grid, a 9-letter title ("SQUARE ONE"), 9 bars, a 9-segment donut, a ring of 9.
Words with fewer letters use `spread()`, where duplicates stack and then split like cells. The audience reads
"the same stuff keeps transforming", which is what makes a reel feel authored.

Storyboard test: for every beat, name what each thing on screen *was* one beat ago.

## 2. Technique patterns

**Hook (bar 1).** Start from the simplest possible frame, which is also the loop frame (one square). Escalate
on every beat: squash on the kick, then split into cells, rotate to a lattice and expand, then collapse into
pillars, which become the strokes of the first word. Four beats, four ideas, all from one shape.

**Kinetic type.** Vary the *kind* of move on each beat, not only the word:
- slam: pillars morph into a huge word (`exo` 0.3 s plus a small `sy` punch);
- cell split: letter count changes, duplicates fly out with a 10 ms stagger;
- split-flap flip: `sy` bump to 0, shape switches at the midpoint (`me:'mid'`), staggered;
- tracking slam: a `whip` pulse on `x` proportional to each letter's x, which goes wider than the frame and snaps tight;
- colour on one word only (e.g. vermilion for the payoff word).

**Shape morph.** Letters to primitives, one family per beat: circles in a row, then triangles bent into a ring
(rotation = angle + 90°), then squares in a grid (the motif returns), then annular sectors forming a donut
(`orbit` whip spin-in). Exponential in-out with a tiny stagger. Real glyph counters shrinking to nothing reads as craft.

**Data / UI.** The donut unrolls into a bar chart (data shape to data shape). Then on each beat: heights
re-flow, gridlines draw on and a counter ticks (eased number), a segmented toggle knob slides and the bars
physically re-sort, and a highlight colour plus value label lands on the peak. UI chrome reveals through
growing clip rects and leaves by collapsing them.

**2D → 3D.** Tilt the camera about 58° so the chart *becomes the floor*, while each bar's footprint morphs
from w×h to w×w and `h` grows to the bar height, so the bars stand up out of the page. Floor grid lines
(`lineWorld`) draw on from the centre. Then rearrange towers into a city block, shuffle heights, morph
footprints into circles (cylinders) and then into **glyph footprints** (type as architecture).

**Climax (last full bar).** Stack the strongest moves: an exponential whip back to flat (camera to rest,
`h` to 0) that crushes 3D letters into the flat title; lines sliding in opposite directions; a letter's
counter filling with an accent colour; then a **Droste push**: zoom about 30× into the counter, which
becomes the whole background, and a 1/F copy of the title waiting inside lands at full size (hand off
with a `step` key the instant the zoom completes).

**End title (final half bar).** The background field contracts into a card around the lock-up and a subtitle
reveals by clip. On the last beat, letters and card collapse into the opening shape (exio, done ~50 ms
before the end).

**Loop.** The last state must equal key 0 exactly, with pulses at t = 0 starting from 0. Verify with PSNR on the
first and last frames.

## 3. Replacing banned effects
- crossfade → morph, or one element becoming the next background (counter flood, card contraction);
- particle burst → split into a fixed number of cells that rearrange;
- glow/flare → a colour flip on a single element on the beat;
- camera shake → a punch/squash pulse on the element hit by the kick;
- gradient → flat colour fields, two-tone flat walls on extrusions;
- bounce → critically damped spring or exponential out (overshoot reads cheap at speed);
- holds → a slow continuous camera drift is not enough; change something on every beat.

## 4. Rhythm and timing
- Beat = 60/BPM. Moves start **on** the beat (`t = T(b)`) and finish by about 0.85 of it. Check with
  `dl·(n−1) + d`.
- Typical durations at 120 BPM: snaps 0.26–0.34 s, morphs 0.36–0.42 s, camera 0.45–0.55 s, staggers 6–20 ms.
- Scene changes fall on bar downbeats, and so do the hits. The riser lives in the bar before the climax and
  cuts dead on its downbeat.

## 5. Colour, type, camera
- One heavy weight. Large sizes (cap height 25–40% of frame height for single words). Kerned layout.
- Palette: black/white plus 2–3 accents, assigned by role (structure, highlight, field). Use the accent
  sparingly so it lands.
- Camera: define it in one sentence and only break flatness in the 3D section. Use `py`/`zoom` to frame
  tall 3D content. Extrusion heights should stay under the line spacing when the content is type.

## 6. Sound design (Web Audio, offline)
Kick: sine from 160 to 46 Hz in 0.11 s, 0.38 s decay, plus a 2.5 kHz click. Hats: highpass noise at 8 kHz,
45 ms, on offbeats. Bass: saw + sub-square through a 900→140 Hz lowpass on offbeats, following a bar root
pattern. Hit: sine boom 95→32 Hz plus a lowpassed noise burst plus 4 detuned squares through bandpasses
(a metallic stab). Riser: bandpass noise 300→9 kHz plus a saw 110→880 Hz, exponential gain. Whoosh: bandpass
noise sweep on big camera moves. Mux with `alimiter` (render.js does this).

## 7. Pitfalls seen in practice
- Staggers that overrun the beat leave duplicates mid-morph (a broken-looking letter). Shorten `d` and `dl`.
- Tall towers crop at the top after the tilt; use camera `py` and `zoom`.
- Extruded type taller than its line spacing becomes unreadable walls.
- Pulses on `y` during a data re-sort lift bars off the baseline; keep data marks anchored.
- `spread()` needs `n` passed explicitly (agents are still being built when it's called).
- JS CDNs may be blocked; opentype.js is vendored, and fonts come from fonts.gstatic.com via `fetch_font.sh`.
- Wait for `document.fonts.load` before drawing text (bootReel does).
- Review the **mid-beat** sheet too: morph artefacts (holes growing outside a shape) only show mid-transition.
