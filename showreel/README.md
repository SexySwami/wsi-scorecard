# SQUARE ONE — 15 s motion showreel

One white square becomes language, form, data and architecture, then returns to square one (seamless loop).

- `square-one.mp4` — final render, 1920×1080, 60 fps, AAC audio.
- `reel.html` — self-contained source (built). Open it in a browser to preview; `?t=12.8` shows a single frame. All drawing is a pure function of time via `window.seek(t)`.
- `src/reel.js` — the reel: glyph-outline morph engine (Inter Black via opentype.js), extrusion/projection, motion blur, score and soundtrack (OfflineAudioContext).
- `build.js` → inlines font + opentype.js + script into `reel.html`.
- `snap.js outdir t...` — render single frames for review.
- `render.js outdir [workers]` — 900 frames × 3 subframes, ffmpeg `tmix` blend, audio mux.

```
node build.js
NODE_PATH=$(npm root -g) node render.js out 4
```
