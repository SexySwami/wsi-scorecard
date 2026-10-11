// node render.js outdir [workers]
// 60 fps, 3 subframes per frame (blended with ffmpeg tmix), audio rendered with OfflineAudioContext.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
const FPS = 60, SUB = 3, SPREAD = 1 / 240, FRAMES = 15 * FPS;
const out = path.resolve(process.argv[2] || 'out'), NW = +(process.argv[3] || 4);
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(__dirname, 'reel.html') + '?render=1';

async function openPage(browser) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('pageerror', e));
  await p.goto(url); await p.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  return p;
}
async function worker(w, f0, f1) {
  const browser = await chromium.launch(); const p = await openPage(browser);
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
    if ((f - f0) % 60 === 0) console.log(`w${w} frame ${f} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  await browser.close(); return seg;
}
(async () => {
  // audio
  { const b = await chromium.launch(); const p = await openPage(b);
    const b64 = await p.evaluate(() => renderAudio()); fs.writeFileSync(path.join(out, 'audio.wav'), Buffer.from(b64, 'base64')); await b.close(); console.log('audio.wav written'); }
  const per = Math.ceil(FRAMES / NW), jobs = [];
  for (let w = 0; w < NW; w++) jobs.push(worker(w, w * per, Math.min(FRAMES, (w + 1) * per)));
  const segs = await Promise.all(jobs);
  fs.writeFileSync(path.join(out, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(out, 'list.txt'), '-i', path.join(out, 'audio.wav'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '320k', '-shortest', path.join(out, 'square-one.mp4')], { stdio: 'inherit' }).on('close', c => c ? rej(c) : res()));
  console.log('done', path.join(out, 'square-one.mp4'));
})();
