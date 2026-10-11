// node render.js <reel.html> <outdir> [workers=4] [fps=60] [sub=3]
// Renders every frame as `sub` subframes (spread 1/240 s), blends them with ffmpeg tmix (motion blur),
// renders the soundtrack via window.renderAudio(), and muxes <outdir>/<name>.mp4 (limiter on the audio).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
const [html, outArg, nw = '4', fpsArg = '60', subArg = '3'] = process.argv.slice(2);
const out = path.resolve(outArg), NW = +nw, FPS = +fpsArg, SUB = +subArg, SPREAD = 1 / 240;
const name = path.basename(html, '.html');
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.resolve(html) + '?render=1';
const run = (args) => new Promise((res, rej) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));

async function openPage(browser) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('pageerror', e));
  await p.goto(url); await p.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  const R = await p.evaluate(() => window.REEL); await p.setViewportSize({ width: R.W, height: R.H });
  return { p, R };
}
async function worker(w, f0, f1) {
  const browser = await chromium.launch(); const { p } = await openPage(browser);
  const seg = path.join(out, `seg${w}.mkv`);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-i', '-',
    '-vf', `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB`,
    '-r', String(FPS), '-c:v', 'libx264rgb', '-crf', '0', '-preset', 'ultrafast', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    for (let s = 0; s < SUB; s++) {
      await p.evaluate(t => seek(t), f / FPS + (s - (SUB - 1) / 2) * SPREAD);
      const buf = await p.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    if ((f - f0) % 60 === 0) console.log(`w${w} frame ${f}/${f1} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  await browser.close(); return seg;
}
(async () => {
  const b = await chromium.launch(); const { p, R } = await openPage(b);
  const wav = path.join(out, 'audio.wav');
  const b64 = await p.evaluate(() => window.renderAudio ? window.renderAudio() : null);
  if (b64) fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  await b.close();
  const FRAMES = Math.round(R.DUR * FPS), per = Math.ceil(FRAMES / NW), jobs = [];
  for (let w = 0; w < NW; w++) jobs.push(worker(w, w * per, Math.min(FRAMES, (w + 1) * per)));
  const segs = await Promise.all(jobs);
  fs.writeFileSync(path.join(out, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
  const mp4 = path.join(out, name + '.mp4');
  await run(['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(out, 'list.txt'),
    ...(b64 ? ['-i', wav, '-map', '0:v', '-map', '1:a', '-af', 'alimiter=limit=0.89:level=false', '-c:a', 'aac', '-b:a', '320k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', mp4]);
  segs.forEach(s => fs.unlinkSync(s));
  console.log('done', mp4);
})();
