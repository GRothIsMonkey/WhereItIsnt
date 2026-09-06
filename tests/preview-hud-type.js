/* PHASE 29 — LOOKING AT THE HUD'S TYPE, WITHOUT WEBGL IN THE WAY.

   WHY THIS FILE EXISTS. The readability problem this phase fixed was found in a
   screenshot, and the only honest way to check it is fixed is to look at another one. But
   capturing game.html while its WebGL frame loop is running times out under SwiftShader in
   this container — the limitation Phase 28 recorded, reproduced there on an unmodified
   build — and the one capture that does come back is a stale frame.

   So this takes the same approach preview-settings.js takes for the settings panel: it
   lifts the REAL HUD markup and the REAL stylesheet out of game.html, populates them the
   way UIManager would, and puts them over the two backgrounds that actually matter — a
   bright sunlit ground and a dark interior. No renderer, no game, no WebGL, so Chromium
   captures it instantly.

   WHAT IT PROVES: nothing. It asserts nothing and gates nothing. It writes two PNGs for a
   person to look at, which is the only way this particular question gets answered. The
   measurements are in browser-menu.js. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const PORT = Number(process.env.WII_TYPE_PORT || 8223);

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; }
}
if (!chromium) { console.log('SKIP  playwright is not installed — no HUD type preview taken.'); process.exit(0); }

const SRC = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
const css = SRC.slice(SRC.indexOf('<style>') + 7, SRC.indexOf('</style>'));
const hud = SRC.slice(SRC.indexOf('<div id="hud">'), SRC.indexOf('<div id="dimensionBanner">'));

/* The HUD as UIManager would have left it mid-game: seven ticks lit of ten, an objective
   showing, a status line, a hotbar with a selected cell and a count, an interaction
   prompt, the held item's name and the clock. Built by hand here rather than by booting
   the game, because booting the game is the thing that cannot be captured. */
const ticks = Array.from({ length: 10 }, (_, i) =>
  `<div class="tick${i % 5 === 4 && i !== 9 ? ' g' : ''}${i < 7 ? ' lit' : ''}" style="--f:${i < 6 ? 1 : (i === 6 ? 0.3 : 0)}"></div>`).join('');
const slots = Array.from({ length: 9 }, (_, i) => {
  const on = i === 1;
  const swatch = ['#6b4a2a', '#c8a24a', '#7a7a7a', '#3f6b3a', '#8a5a3a', '', '', '', ''][i];
  return `<div class="slot${on ? ' active' : ''}"><span class="num">${i + 1}</span>` +
         (swatch ? `<div class="swatch" style="background:${swatch}"></div><span class="count">${[3, 12, 41, 7, 2][i]}</span>` : '') +
         `</div>`;
});

function page(bg, label) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}
  body { margin:0; width:1280px; height:720px; overflow:hidden; background:${bg}; }
  #hud { position:fixed; inset:0; }
  .stamp { position:fixed; top:8px; left:50%; transform:translateX(-50%); z-index:99;
           font-family:var(--ui-face); font-size:10px; letter-spacing:2px; color:#fff8; }
  </style></head><body>
  <div class="stamp">${label}</div>
  ${hud
    .replace('<div id="conditionTicks"></div>', `<div id="conditionTicks">${ticks}</div>`)
    .replace('<div id="hotbar"></div>', `<div id="hotbar">${slots.join('')}</div>`)
    .replace('<div id="heldName"></div>', '<div id="heldName" class="show">STONE PICKAXE</div>')
    .replace('<div id="journeyStep"></div>', '<div id="journeyStep" class="show">Prepare for night.</div>')
    .replace('<span id="objStatus"></span>', '<span id="objStatus">ANCHOR 42S</span>')
    .replace('<span id="memStatus"></span>', '<span id="memStatus">FRAGMENTS 1/3</span>')
    .replace('<span id="stageStatus"></span>', '<span id="stageStatus">STAGE 2</span>')
    .replace('<span id="interactVerb"></span>', '<span id="interactVerb">FEED THE ANCHOR</span>')
    .replace('<div id="interactPrompt">', '<div id="interactPrompt" class="show">')
    .replace('<span id="dayLabel">1</span>', '<span id="dayLabel">4</span>')}
  <script>
    // The perception trace, drawn by hand at a mid value so the picture has a signal in it.
    const c = document.getElementById('perceptionTrace'), g = c.getContext('2d');
    const W = c.width, H = c.height, mid = H / 2;
    g.strokeStyle = 'rgba(128,120,98,0.34)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, mid + 0.5); g.lineTo(W, mid + 0.5); g.stroke();
    g.beginPath();
    for (let x = 0; x <= W; x += 2) {
      const u = x / W;
      const y = mid + (Math.sin(u * 21.7) * 0.55 + Math.sin(u * 47.3) * 0.30 + Math.sin(u * 8.1) * 0.15) * 4.2;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.lineWidth = 2.6; g.strokeStyle = 'rgba(0,0,0,0.60)'; g.stroke();
    g.lineWidth = 1;   g.strokeStyle = 'rgba(206,214,202,0.74)'; g.stroke();
    document.getElementById('vitals').className = 'hp-steady p-drifting';
  <\/script></body></html>`;
}

/* Sunlit grass and a night interior: the two conditions the brief names, and the two the
   Phase 28 capture showed the old captions failing against. */
const BRIGHT = 'linear-gradient(160deg,#8fbf5a 0%,#a8cf6e 38%,#c9d98a 62%,#6f9a48 100%)';
const DARK = 'linear-gradient(160deg,#0a0b0d 0%,#131519 45%,#1c1f24 70%,#08090b 100%)';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pages = { 'hud-type-bright.html': page(BRIGHT, 'HUD OVER SUNLIT GROUND'),
                  'hud-type-dark.html': page(DARK, 'HUD OVER A DARK INTERIOR') };
  const srv = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.replace(/^\/+/, '')) || 'hud-type-bright.html';
    if (!pages[name]) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pages[name]);
  });
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));

  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const written = [];
  for (const name of Object.keys(pages)) {
    await p.goto(`http://127.0.0.1:${PORT}/${name}`, { waitUntil: 'load' });
    await p.waitForTimeout(250);
    const png = name.replace('.html', '.png');
    await p.screenshot({ path: path.join(OUT, png) });
    written.push(png);
    /* And a 3x zoom on the two corners the readability complaint was actually about, so
       the instrument detail can be judged rather than squinted at. */
    for (const [tag, clip] of [['vitals', { x: 14, y: 636, width: 330, height: 74 }],
                               ['hotbar', { x: 440, y: 596, width: 400, height: 112 }]]) {
      const zoom = png.replace('.png', '-' + tag + '.png');
      await p.setViewportSize({ width: 1280, height: 720 });
      await p.evaluate(() => { document.body.style.zoom = ''; });
      await p.screenshot({ path: path.join(OUT, zoom), clip });
      written.push(zoom);
    }
  }
  await browser.close();
  srv.close();
  console.log('wrote ' + written.map(w => 'renders/' + w).join(' and '));
  console.log('Real markup + real stylesheet, rendered in real Chromium with no WebGL.');
  console.log('It proves nothing and asserts nothing; it is for looking at.');
})().catch((e) => { console.error(e); process.exit(1); });
