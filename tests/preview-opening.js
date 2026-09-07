/* PHASE 30 — LOOKING AT THE OPENING FILM.

   Boots the real game in real Chromium, clicks NEW GAME, and captures the film at each of
   its beats by driving the film's own clock. It asserts nothing and gates nothing; it
   writes PNGs so a person can judge the one thing no test can — whether any of it works.

   WHY IT DRIVES THE CLOCK INSTEAD OF WAITING. This container renders the Overworld at
   roughly one frame a second under SwiftShader, so watching the film in real time here
   would take about as long as it takes to render one frame of it. Advancing `film.t`
   through the film's own update() is the same code path the frame loop uses.

   Screenshots are best-effort: capturing a live WebGL page times out here more often
   than not (the Phase 28 limitation). The script reports which ones were written. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_PREVIEW_OPENING_PORT || 8233);

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; }
}
if (!chromium) { console.log('SKIP  playwright is not installed — no film preview taken.'); process.exit(0); }

const MIME = { '.html': 'text/html', '.js': 'application/javascript' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'game.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end('no'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

/* The beats worth looking at, and roughly where in each one. */
const SHOTS = [
  ['dark', 0.5], ['reveal', 0.55], ['familiar', 0.5],
  ['anomaly', 0.55], ['closer', 0.6], ['vast', 0.5],
  ['seam', 0.5], ['unresolved', 0.5], ['calm', 0.4],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  if (fs.existsSync(VENDOR_THREE)) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }
  page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
  await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('!!window.game', null, { timeout: 90000 });
  await page.waitForTimeout(400);
  await page.click('#clickPlay');
  await page.waitForFunction('window.game.film && window.game.film.active === true', null, { timeout: 20000 });

  /* TAKE THE FRAME LOOP OFF THE FILM.

     Two problems otherwise, both caused by this container drawing the world at about one
     frame a second. First, a screenshot of a live WebGL page times out here more often
     than it succeeds. Second — and worse — each attempt takes ten to fifteen seconds of
     wall time, during which the real loop advances the film by that much, so by the third
     capture the "seam" shot was of the calm beat.

     `_animate` re-arms itself by reading `this._animate` off the game each frame, so
     replacing that property stops the chain after one more frame. Everything below then
     draws exactly one frame by hand, of exactly the state it just set. */
  await page.evaluate(() => { window.game._animate = () => {}; });
  await page.waitForTimeout(400);

  const written = [];
  for (const [beat, into] of SHOTS) {
    const at = await page.evaluate(([b, frac]) => {
      const g = window.game, f = g.film;
      const spec = FILM_BEATS.find(x => x.id === b);
      const target = spec.at + spec.dur * frac;
      /* Wind the film's own clock forward through its own update(), then draw one frame
         by hand so the capture is of the state just set rather than of whatever the
         renderer last managed. */
      let guard = 0;
      while (f.active && f.t < target && guard++ < 8000) f.update(1 / 30);
      g.player.update(0.016);
      g.postfx.render(0.016, f.beat === 'unresolved' ? 0.14 : 1.0);
      return { beat: f.beat, t: +f.t.toFixed(1) };
    }, [beat, into]);
    const name = 'film-' + beat + '.png';
    try {
      await page.screenshot({ path: path.join(OUT, name), timeout: 15000 });
      written.push(`${name} (t=${at.t}s)`);
    } catch (e) { written.push(`${name} ✗ ${e.name}`); }
  }

  await browser.close();
  srv.close();
  console.log('wrote:\n  ' + written.join('\n  '));
  console.log('\nReal game, real world, real renderer, no assertions. For looking at.');
})().catch((e) => { console.error(e); process.exit(1); });
