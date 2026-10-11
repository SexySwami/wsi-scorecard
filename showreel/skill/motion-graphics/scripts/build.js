// node build.js <score.js> <font.ttf> <out.html>
// Inlines font + opentype.js + engine + score into ONE self-contained HTML file.
const fs = require('fs'), path = require('path');
const [score, fontPath, out] = process.argv.slice(2);
if (!score || !fontPath || !out) { console.error('usage: node build.js score.js font.ttf out.html'); process.exit(1); }
const font = fs.readFileSync(fontPath).toString('base64');
const ot = fs.readFileSync(path.join(__dirname, 'vendor/opentype.min.js'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const js = fs.readFileSync(score, 'utf8');
const title = path.basename(path.dirname(path.resolve(score)));
const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
@font-face{font-family:'ReelFont';font-weight:900;src:url(data:font/ttf;base64,${font}) format('truetype');}
html,body{margin:0;background:#000;overflow:hidden}
canvas{display:block}
</style></head><body><canvas id="c"></canvas>
<script>${ot}</script>
<script>const FONT_B64="${font}";\n${engine}\n${js}</script>
</body></html>`;
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + ' KB');
