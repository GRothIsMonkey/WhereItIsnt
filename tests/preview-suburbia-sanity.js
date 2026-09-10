/* =====================================================================================
   PHASE 36 — WHAT STATIC SUBURBIA LOOKS LIKE AT EACH SANITY VALUE.

   NOT A TEST. It asserts nothing and proves nothing. It writes
   `renders/sanity-suburbia-<v>.png` for a handful of Sanity values so that a claim about
   the post-FX ramp can be LOOKED AT rather than reasoned about, which is what CLAUDE.md
   section 78 asks for and what the Phase 27 and Phase 29 previews exist for.

   WHY IT EXISTS. Before Phase 36, `SanitySystem.updateSuburbia` had two negative rates and
   no floor: arrival sets Sanity to 100, the slower rate is 1.5 a second, and a player
   therefore reached ZERO in about sixty-seven seconds and stayed there for the rest of the
   dimension. The shader reads Sanity directly. Nothing in the source says what that looks
   like, and no assertion could: the two pictures are the argument.

       100   clean. The bypass at 0.8 disables every horror term.
        60   vignette only.
        34   THE WALKING FLOOR. Aberration and grain are in, the street is legible.
        30   for comparison with the value that was chosen.
         8   THE STANDING-STILL FLOOR. The edge mirage is running. Still legible.
         0   where the dimension used to pin the player. A grey rectangle.

   The value is HELD against the frame loop's own drain for the duration of the capture,
   because the point is to see each step of the ramp, not to watch it slide.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0.
   Screenshots of a live WebGL frame loop are unreliable under SwiftShader (see the note in
   README.md); each capture is best-effort and the run says which ones were written.

       node preview-suburbia-sanity.js
       WII_SANITY_VALUES=100,34,8 node preview-suburbia-sanity.js
   ===================================================================================== */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_SANITY_PORT || 8261);
const VALUES = (process.env.WII_SANITY_VALUES || '100,60,34,30,8,0')
  .split(',').map(Number).filter((v) => Number.isFinite(v));

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; }
}
if (!chromium) { console.log('SKIP  playwright is not installed — nothing rendered.'); process.exit(0); }

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'game.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  if (fs.existsSync(VENDOR_THREE)) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('!!window.game', null, { timeout: 120000 });
    await page.click('#clickPlay');
    await page.waitForTimeout(500);
    await page.evaluate('window.game.film && window.game.film.active && window.game.film.skip()');
    await page.waitForFunction('window.game.running === true', null, { timeout: 90000 });
    await page.waitForTimeout(800);

    /* A developer teleport, deliberately — this file is a camera, not a playthrough, and
       walking the whole chain to reach a street is browser-playability.js's job. */
    await page.evaluate('window.debugTeleportToSuburbia()');
    await page.waitForFunction('window.game.player.inSuburbia === true', null, { timeout: 60000 });
    await page.waitForTimeout(2500);

    for (const v of VALUES) {
      await page.evaluate(`(() => { const g = window.game;
        g.sanity.value = ${v}; g.ui.setSanity(${v});
        g.__pin = setInterval(() => { g.sanity.value = ${v}; }, 16); })()`);
      await page.waitForTimeout(1800);
      const name = `sanity-suburbia-${v}.png`;
      try {
        await page.screenshot({ path: path.join(OUT, name), timeout: 25000 });
        console.log('wrote  renders/' + name);
      } catch (e) {
        console.log('SKIP   renders/' + name + '  (' + (e.name || 'error') + ' — SwiftShader capture)');
      }
      await page.evaluate('clearInterval(window.game.__pin)');
    }

    const live = await page.evaluate(`({ uSanity: window.game.postfx.uniforms.uSanity.value,
                                         uHorror: window.game.postfx.uniforms.uHorror.value })`);
    console.log(`\nlive shader uniforms at the end of the run: uSanity ${live.uSanity.toFixed(3)}, uHorror ${live.uHorror}`);
  } finally {
    await browser.close();
    srv.close();
  }
  console.log('It proves nothing and asserts nothing; it is for looking at.');
})().catch((e) => { console.error(e); process.exit(1); });
