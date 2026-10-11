---
name: motion-graphics
description: Design and render code-built motion graphics as finished MP4s, such as showreels, title sequences, kinetic typography, logo stings, animated explainers, product or data animations, looping social videos, synced to a generated soundtrack. Concept and beat-by-beat storyboard first, then one HTML file where every frame is a pure function of time, a frame-per-beat visual review, Playwright rendering with subframe motion blur, and audio muxed with ffmpeg. Use this whenever someone asks for a motion design piece, a reel, an animated video, an intro, an animated logo, type in motion, "make it move", a video synced to a beat or BPM, or wants an HTML/canvas animation turned into a video. Use it even if they don't say "motion graphics" or name a tool; if the deliverable is an animated video Claude has to design and render, this skill applies.
---

# Motion graphics

You are the motion designer and the render farm. The output is a finished, watchable MP4 that looks
designed by a senior motion designer, not a template. The bar: **every shot is made out of the previous
one.** Shapes, type and colour transform into the next scene; nothing cuts or crossfades.

This skill bundles a working engine (`scripts/engine.js`). It handles glyph-outline morphing between any
letter and any shape, keyframes that never jump, a perspective camera with extrusion, directional motion
blur, and WAV export. It also bundles a full 15-second reel built on it (`examples/square-one/score.js`).
Write a new *score* on top of the engine rather than starting from zero.

## House defaults (use unless the user's brief says otherwise)

These came from a demanding brief and produced a strong result. Treat them as the starting point and let
the user's own constraints override any of them.

- **Concept first.** Pick one, name it in one line ("one white square becomes language, form, data and
  architecture, then returns to square one"). Every scene must serve it.
- **Type:** one typeface, one heavy weight (Inter / Geist / a bold Google display face). Tight tracking.
- **Colour:** at most three colours plus black and white. Flat fills only.
- **Camera:** one consistent camera language, stated in a sentence (e.g. "locked centre axis; moves only
  by exponential push/tilt on downbeats; the single 3D orbit is the same camera tilting back").
- **Time:** a BPM grid. Something happens on **every beat**; no hold longer than half a second.
  Structure: first bar is the hook, then one technique per bar flowing out of the last, the strongest
  moment in the last full bar, an end title in the final half bar, and **the last frame equals the
  first** so it loops.
- **Range** (for reels): kinetic type, shape morphing, a 2D→3D moment, a data/UI moment, an end title.
  Roughly equal time each.
- **Easing:** exponential and critically damped springs written as functions of time. No bounce.
- **Banned:** particle bursts, glows, lens flares, camera shake, RGB split, crossfades, generic gradients,
  bouncy easing, long holds, anything that looks like a template. Why: they're the shortcuts that make
  motion read as stock. The ban forces the transitions to carry the piece.
- **Output:** 1920×1080, 60 fps, 3 subframes per frame blended (motion blur), soundtrack with a kick on
  every beat, a riser into the last full bar, a hit on every scene change.

When the brief's numbers conflict (e.g. 15 s at 120 BPM is 7.5 bars, which is one bar more than
"hook + five techniques + climax + half-bar title"), resolve it sensibly and **say how** in the final
message. Don't silently drop a requirement.

## Workflow

### 1. Concept + storyboard (show the user before building)

Do the beat math first: `beats = duration × BPM / 60`, `bar = 4 beats`. Then write:

- the one-line concept, palette (hex), typeface, camera sentence;
- a **beat-by-beat storyboard table**: bar | beat | time | what happens. Mark scene-change hits.
  For every row, say what the shapes on screen *become* in the next row. If a row starts with
  something that didn't come from the previous row, it's a cut. Redesign it.

Post this to the user. If they said "build it without asking", carry straight on. Otherwise wait for a go.

### 2. Environment

Check `ffmpeg`, Node and Playwright (`require('playwright')`; global installs may need
`NODE_PATH=$(npm root -g)`), and Chromium. Get the font as a static TTF with
`scripts/fetch_font.sh "Inter" 900 font.ttf`. Google Fonts is often reachable even when JS CDNs are
blocked, and the engine needs real outlines (opentype.js is bundled in `scripts/vendor/`). Work in a
project folder the user can open; keep big intermediates in scratch space.

### 3. Write the score

Read `references/engine.md` (API and score skeleton). Copy `examples/starter/score.js` (small, every
feature once) or adapt `examples/square-one/score.js` (the full reel: hook grid, kinetic type, morph
ring, donut→bar chart with UI, extruded city, type-as-architecture, Droste push through a letter, end
card, loop). Read `references/craft.md` for choreography patterns and how each banned shortcut is
replaced.

Build with `node scripts/build.js score.js font.ttf out/<name>.html`. That one self-contained HTML file
is the source of truth: open it to preview, `?t=4.25` for a still. `window.seek(t)` must stay a pure
function of `t`: no CSS animations, timers, or state carried between frames. That purity is what makes
the subframe blur, parallel rendering and seamless loop possible.

### 4. Review pass (do not skip; this is where quality comes from)

```bash
node scripts/snap.js out/<name>.html review/beats --beats   # one settled frame per beat + sheet.png
node scripts/snap.js out/<name>.html review/mid --mid       # beat + 0.12 s, catches mid-transition glitches
```

**Look at both `sheet.png` files** (Read the image), then full-size frames for anything suspicious. Fix
and re-snap until clean. The checklist that caught real bugs:

- Is the transition still running at beat + 0.32 s? Then `delay + duration` overruns the beat. Keep
  `dl × (agents−1) + d ≲ 0.42 × beat`. Half-finished duplicates (two agents mid-morph to one letter) look broken.
- Is anything cropped? 3D towers and big type leave the frame first. Use camera `zoom`/`py`.
- Can you read it? Extruded type taller than the line spacing turns into a wall. Keep heights moderate.
- Overlaps, clutter, too many simultaneous ideas, small text.
- Do elements that sit on a baseline stay on it (a stray pulse can lift bars off the axis)?
- Is every beat visibly different from the one before (no holds)?
- Does the last state equal the first?

### 5. Soundtrack

Write it in the score with `renderWav((ac, out, util) => {...})` (OfflineAudioContext → 16-bit WAV).
Minimum: kick on every beat, offbeat hats, a riser (filtered noise + rising saw) into the climax bar that
cuts dead on its downbeat, a hit (sub boom + noise burst + short metallic stab) on each scene change,
whooshes on big camera moves. Make sure tails end before the loop point. Check the waveform:
`ffmpeg -i audio.wav -filter_complex showwavespic=s=1800x300 -frames:v 1 wave.png`.

### 6. Render and verify

```bash
node scripts/render.js out/<name>.html render 4      # workers; ~4 min for 15 s at 60 fps × 3 subframes on 4 cores
```

It renders audio, renders frames in parallel segments (`tmix` blends the 3 subframes), concatenates,
muxes the audio with a limiter and writes `render/<name>.mp4`. Run it in the background and wait on the
log. Verify before delivering:

- `ffprobe` → expected frame count (duration × fps), resolution, an audio stream;
- loop: extract frame 0 and the last frame, `ffmpeg -i a.png -i b.png -lavfi psnr -f null -` (>40 dB ≈ identical);
- a few real frames from the MP4 (blur direction, the climax).

### 7. Deliver

Send the MP4 with the file-sending tool if there is one, otherwise give the path. If working in a repo, commit
the score, built HTML and MP4. In the reply: concept line, what the review pass caught and fixed, any
brief conflicts and how you resolved them, and how to re-render. Short; the video speaks for itself.

## Files

- `scripts/engine.js`: the engine (see `references/engine.md`).
- `scripts/build.js`: score + font + engine + opentype → one HTML file.
- `scripts/snap.js`: review frames and a numbered contact sheet.
- `scripts/render.js`: full render with subframe motion blur and audio mux.
- `scripts/fetch_font.sh`: Google Fonts family/weight → static TTF.
- `examples/starter/score.js`: a 4 s minimal score.
- `examples/square-one/score.js`: the 15 s reference reel.
- `references/engine.md`: engine API, keyframe model, score skeleton.
- `references/craft.md`: choreography cookbook, replacements for banned effects, pitfalls.
