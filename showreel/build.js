// Inlines the font, opentype.js and the reel script into one self-contained HTML file.
const fs = require('fs'), path = require('path');
const here = p => path.join(__dirname, p);
const font = fs.readFileSync(here('vendor/inter900.ttf')).toString('base64');
const ot = fs.readFileSync(here('vendor/opentype.min.js'), 'utf8');
const js = fs.readFileSync(here('src/reel.js'), 'utf8');
const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Square One</title>
<meta name="viewport" content="width=1920">
<style>
@font-face{font-family:'InterX';font-weight:900;src:url(data:font/ttf;base64,${font}) format('truetype');}
html,body{margin:0;background:#0a0a0a;overflow:hidden}
canvas{display:block;width:1920px;height:1080px}
</style></head><body><canvas id="c" width="1920" height="1080"></canvas>
<script>${ot}</script>
<script>const FONT_B64="${font}";\n${js}</script>
</body></html>`;
fs.writeFileSync(here('reel.html'), html);
console.log('reel.html', (html.length / 1024).toFixed(0) + ' KB');
