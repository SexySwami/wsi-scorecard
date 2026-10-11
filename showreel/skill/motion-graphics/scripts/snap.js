// Review frames before the full render.
//   node snap.js <reel.html> <outdir> --beats [offset=0.32]   one frame per beat (settled state) + contact sheet
//   node snap.js <reel.html> <outdir> --mid                   one frame per beat at +0.12 s (catches mid-morph glitches)
//   node snap.js <reel.html> <outdir> 2.5 7.25 ...            specific times
// Writes t<time>.png per frame and sheet.png (numbered grid, 480px tiles). Prints page errors.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path'), fs = require('fs');
(async () => {
  const [html, out, ...rest] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (/^t.*\.png$/.test(f)) fs.unlinkSync(path.join(out, f));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(html) + '?render=1');
  await p.waitForFunction(() => window.ready === true, null, { timeout: 60000 }).catch(e => { console.log(errs.join('\n')); throw e; });
  const R = await p.evaluate(() => window.REEL);
  await p.setViewportSize({ width: R.W, height: R.H });
  let ts = rest;
  if (rest[0] === '--beats' || rest[0] === '--mid') {
    const off = rest[1] ? parseFloat(rest[1]) : rest[0] === '--mid' ? 0.12 : 0.32;
    const n = Math.round(R.DUR / R.BEAT); ts = Array.from({ length: n }, (_, i) => (i * R.BEAT + off).toFixed(3));
  }
  for (const t of ts) {
    await p.evaluate(t => seek(t), parseFloat(t));
    await p.screenshot({ path: path.join(out, `t${parseFloat(t).toFixed(2).padStart(6, '0')}.png`) });
  }
  await b.close();
  const cols = Math.min(5, ts.length);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(out, 't*.png'), '-vf',
    `scale=480:-1,drawtext=text='%{n}':x=8:y=8:fontcolor=yellow:fontsize=22,tile=${cols}x${Math.ceil(ts.length / cols)}:padding=4`, '-frames:v', '1', path.join(out, 'sheet.png')]);
  console.log(`${ts.length} frames -> ${out}/sheet.png (tile n = beat n+1)`);
  if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
})();
