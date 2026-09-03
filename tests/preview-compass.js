/* PHASE 20.2 — A PREVIEW OF THE COMPASS TAPE, BUILT FROM THE REAL DRAW CALLS.

   This is NOT a browser and NOT a screenshot, and it does not pretend to be. It runs the
   shipped UIManager.updateCompass against a recording canvas, captures every stroke,
   fill and label it actually issues, and re-emits them as SVG at the element's real
   252x26 geometry on the real HUD panel colours. What it shows is exactly what the code
   draws; what it cannot show is how that reads on a GPU over a live 3D scene.

   Writes tests/renders/compass-tape.svg. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld } = require('./harness/util.js');
const { S } = makeWorld();

const ui = vm.runInContext('new UIManager()', S);
const ctx = ui.compassCtx;
const W = ui.compassTape.width, H = ui.compassTape.height;

// --- record every operation the real renderer issues -------------------------------
let ops = [], state = { fill: '#000', stroke: '#000', font: '', lw: 1 };
let pathPts = [];
const rec = {
  set fillStyle(v) { state.fill = v; }, get fillStyle() { return state.fill; },
  set strokeStyle(v) { state.stroke = v; }, get strokeStyle() { return state.stroke; },
  set font(v) { state.font = v; }, get font() { return state.font; },
  set lineWidth(v) { state.lw = v; }, get lineWidth() { return state.lw; },
  set textAlign(v) {}, set textBaseline(v) {},
  clearRect() { ops = []; },
  beginPath() { pathPts = []; },
  moveTo(x, y) { pathPts.push(['M', x, y]); },
  lineTo(x, y) { pathPts.push(['L', x, y]); },
  closePath() { pathPts.push(['Z']); },
  stroke() { ops.push({ k: 'path', pts: pathPts.slice(), stroke: state.stroke, fill: 'none', lw: state.lw }); },
  fill() { ops.push({ k: 'path', pts: pathPts.slice(), stroke: 'none', fill: state.fill, lw: 0 }); },
  fillText(t, x, y) { ops.push({ k: 'text', t, x, y, fill: state.fill, font: state.font }); },
};
for (const k of Object.keys(ctx)) if (!(k in rec)) rec[k] = typeof ctx[k] === 'function' ? () => {} : ctx[k];
ui.compassCtx = rec;
ui.compassShown = true;

function draw(yaw) {
  ui._compassBearing = null;
  ui.updateCompass(yaw);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const out = [];
  for (const o of ops) {
    if (o.k === 'path') {
      const d = o.pts.map(p => p[0] === 'Z' ? 'Z' : `${p[0]}${p[1].toFixed(2)},${p[2].toFixed(2)}`).join(' ');
      out.push(`<path d="${d}" stroke="${o.stroke}" fill="${o.fill}" stroke-width="${o.lw}"/>`);
    } else {
      const m = /(bold )?(\d+)px/.exec(o.font) || [, '', '11'];
      out.push(`<text x="${o.x.toFixed(2)}" y="${o.y}" fill="${o.fill}" font-size="${m[2]}" ` +
               `font-family="monospace" font-weight="${m[1] ? 'bold' : 'normal'}" ` +
               `text-anchor="middle">${esc(o.t)}</text>`);
    }
  }
  return out.join('\n      ');
}

const HEADINGS = [
  ['facing NORTH  (yaw 0°)', 0],
  ['facing EAST   (yaw -90°) — the arrival heading, and the instruction', -Math.PI / 2],
  ['facing SOUTH  (yaw 180°)', Math.PI],
  ['facing WEST   (yaw 90°)', Math.PI / 2],
  ['facing NE     (yaw -45°)', -Math.PI / 4],
  ['22° off east  (yaw -68°)', -68 * Math.PI / 180],
];

const PAD = 8, ROW = 74, LABEL_W = 430;
const svgH = HEADINGS.length * ROW + 44;
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_W + W + PAD * 4}" height="${svgH}" ` +
  `viewBox="0 0 ${LABEL_W + W + PAD * 4} ${svgH}">`,
  `<rect width="100%" height="100%" fill="#171310"/>`,
  `<text x="${PAD}" y="24" fill="#8a7a58" font-size="13" font-family="monospace">` +
  `WHERE IT ISN'T — PHASE 20.2 COMPASS TAPE (drawn from the real updateCompass calls)</text>`,
];
HEADINGS.forEach(([label, yaw], i) => {
  const y = 44 + i * ROW;
  parts.push(`<text x="${PAD}" y="${y + 20}" fill="#b9ad8c" font-size="12" font-family="monospace">${label}</text>`);
  // the HUD panel, exactly as #compassWrap styles it
  parts.push(`<g transform="translate(${LABEL_W},${y})">`);
  parts.push(`  <rect x="0" y="0" width="${W + 16}" height="${H + 9}" rx="4" ` +
             `fill="#141310" fill-opacity="0.6" stroke="#6b5a3c" stroke-width="2"/>`);
  parts.push(`  <g transform="translate(8,5)">`);
  parts.push(`      ${draw(yaw)}`);
  parts.push(`  </g></g>`);
});
parts.push('</svg>');

const dir = path.join(__dirname, 'renders');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'compass-tape.svg');
fs.writeFileSync(file, parts.join('\n'));
console.log('wrote ' + file);
console.log('NOTE: derived from the real draw calls. This is not a browser render.');
