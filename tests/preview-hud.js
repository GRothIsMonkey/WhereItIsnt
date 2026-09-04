/* PHASE 27 — HUD PREVIEW. REAL BROWSER SCREENSHOTS OF THE REAL GAME.

   Every other preview in this suite is a re-emission: preview-settings.js lifts the real
   markup into a static page, preview-compass.js replays the real draw calls onto an SVG,
   render-journey.js rasterises real geometry with its own rasteriser. None of them is a
   browser, and all of them say so.

   THIS ONE IS A BROWSER. It boots game.html in Chromium exactly as browser-save.js does,
   plays far enough to have something in the hotbar and a compass on screen, and captures
   the HUD over live terrain at three states of the body and the mind. It exists because
   the HUD is the one system in this project whose defects are invisible to assertions: a
   caption can be present, laid out, non-zero and the right colour, and still be unreadable
   against sunlit grass — which is exactly what the first capture of this phase showed, and
   how the caption ink, the trace's dark underlay and the unlit tick were chosen.

   It proves nothing. It is for looking at. Assertions live in hud.js and browser-save.js.

   Writes into tests/renders/:
     hud-day.png        the whole frame, full health, full perception, daylight
     hud-day-vitals.png the vitals and the hotbar, cropped, over bright ground
     hud-mid.png        54 health, 58 perception
     hud-critical.png   11 health, 9 perception — the loudest the HUD ever gets
     hud-objective.png  the objective and status line, cropped

   Needs Playwright and Chromium, like browser-save.js; skips cleanly without them. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_PREVIEW_PORT || 8209);

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; }
}
if (!chromium) {
  console.log('SKIP  playwright is not installed — no HUD screenshots taken.');
  process.exit(0);
}

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'game.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      res.writeHead(200, { 'Content-Type': path.extname(file) === '.js' ? 'application/javascript' : 'text/html' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  if (fs.existsSync(VENDOR_THREE)) {
    await page.route('**/three.min.js', (r) =>
      r.fulfill({ body: fs.readFileSync(VENDOR_THREE, 'utf8'), contentType: 'application/javascript' }));
  }
  await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('!!window.game', null, { timeout: 90000 });
  await page.click('#skipTutorialLink');
  await page.keyboard.press('Space');
  await page.waitForFunction('window.game && window.game.running === true', null, { timeout: 60000 });
  await page.waitForTimeout(1500);

  // A hotbar worth looking at, and the compass the player would have earned by now.
  await page.evaluate(() => {
    const g = window.game, p = g.player;
    p.inventory.addItem(ITEM.TORCH, 12);
    p.inventory.addItem(ITEM.WOOD_PLANK, 34);
    p.inventory.addItem(ITEM.OAK_LOG, 1);
    p.inventory.addItem(ITEM.STONE_PICKAXE, 1);
    p.inventory.addItem(ITEM.COAL, 7);
    p.selectedSlot = 1;
    g.grantCompass();
    g.ui.updateHotbarSelection();
  });
  await page.waitForTimeout(900);

  const VITALS = { x: 0, y: 560, width: 700, height: 160 };
  const TOPLEFT = { x: 0, y: 0, width: 520, height: 130 };

  await page.screenshot({ path: path.join(OUT, 'hud-day.png') });
  await page.screenshot({ path: path.join(OUT, 'hud-day-vitals.png'), clip: VITALS });
  await page.screenshot({ path: path.join(OUT, 'hud-objective.png'), clip: TOPLEFT });

  const setState = (hp, sanity) => page.evaluate(([h, s]) => {
    const g = window.game;
    g.player.hp = h; g.ui.updateVitals(g.player);
    g.sanity.value = s; g.ui._traceAt = 0; g.ui.setSanity(s);
  }, [hp, sanity]);

  await setState(54, 58);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'hud-mid.png'), clip: VITALS });

  await setState(11, 9);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'hud-critical.png'), clip: VITALS });

  await browser.close();
  srv.close();
  console.log('wrote hud-day.png, hud-day-vitals.png, hud-objective.png, hud-mid.png, hud-critical.png into tests/renders/');
  console.log('These are for LOOKING AT. Nothing here is an assertion — see hud.js and browser-save.js.');
})();
