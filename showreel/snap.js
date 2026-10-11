// node snap.js outdir t1 t2 ...  — renders single frames for review
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const [out, ...ts] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, 'reel.html') + '?render=1');
  await p.waitForFunction(() => window.ready === true || false, null, { timeout: 60000 }).catch(e => { console.log(errs); throw e; });
  for (const t of ts) {
    const ms = await p.evaluate(t => { const a = performance.now(); seek(t); return performance.now() - a; }, parseFloat(t));
    await p.screenshot({ path: path.join(out, `t${parseFloat(t).toFixed(2).padStart(5, '0')}.png`) });
    process.stdout.write(`${t}:${ms.toFixed(0)}ms `);
  }
  console.log('\n', errs.join('\n'));
  await b.close();
})();
