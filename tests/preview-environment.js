/* PHASE 31 — LOOKING AT THE ENVIRONMENTAL STORYTELLING.

   Boots the real game in real Chromium, teleports to each object this phase puts in the
   world, and captures it. It asserts nothing and gates nothing; it writes PNGs so a
   person can judge the one thing no test can — whether any of this reads as anything.

   It also writes a magnified crop of the two family photographs side by side, taken from
   the real texture atlas, because the difference between them is eleven pixels and is
   invisible in a screenshot of a room.

   WHY IT TAKES THE FRAME LOOP OFF THE GAME. This container renders the world at roughly
   one frame a second under SwiftShader, so a screenshot of a live WebGL page times out
   more often than it succeeds and each attempt costs ten to fifteen seconds of wall time
   during which the world keeps moving. `_animate` re-arms itself by reading the property
   off the game each frame, so replacing it stops the chain after one more frame; every
   capture below then draws exactly one frame by hand, of exactly the state it just set. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_PREVIEW_ENV_PORT || 8253);

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; }
}
if (!chromium) { console.log('SKIP  playwright is not installed — no preview taken.'); process.exit(0); }

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

/* Each shot: a label, the site to stand near, how far back and at what bearing, and how
   high to put the eye. Bearings are in the game's own convention (radians, +z at 0). */
const SHOTS = [
  ['env-holding',    'owHolding',    12, 0.9,  4,  'the held place'],
  ['env-released',   'owReleased',   12, 0.9,  4,  'the same square, emptied'],
  ['env-crossing',   'owCrossing',   16, 2.4,  6,  'the crossing'],
  ['env-sub-holding', 'subHolding',  11, 0.9,  4,  'the held place, in a back yard'],
  ['env-sub-board',  'subNameBoard', 11, 0.6,  3,  'the board that lies, on a lawn'],
  ['env-farmyard',   null,           9,  0.9,  3,  'a farmstead yard arrangement'],
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
  await page.waitForFunction('window.game.film && window.game.film.active === true', null, { timeout: 30000 });
  await page.evaluate(() => window.game.film.skip());
  await page.evaluate(() => { const g = window.game;
    if (g.openingInstruction.active) g.openingInstruction._finish(); });
  await page.waitForFunction('window.game && window.game.running === true', null, { timeout: 60000 });
  await page.waitForTimeout(600);

  /* Everything visible: every original noticed, every milestone reached, midday. */
  await page.evaluate(() => {
    const g = window.game;
    for (const id of ENV_STORY_IDS) g.envStory.notice(id);
    for (const id of PROGRESSION_MILESTONE_IDS) g.milestones.add(id);
    g.env.t = 200; g.env.update(0);
    g.ui.setHudVisible ? g.ui.setHudVisible(false) : null;
  });
  await page.waitForTimeout(400);

  const written = [];
  for (const [name, siteKey, back, bearing, lift, label] of SHOTS) {
    const info = await page.evaluate(([k, d, b, up]) => {
      const g = window.game, p = g.player, W = g.world;
      /* A null site key means the yard vocabulary, which is distributed rather than
         placed: find the first farmstead near the Farmlands spawn that carries one. */
      let at = null;
      if (k) at = ENV_SITES[k](W);
      else {
        const P = FARM_P;
        outer:
        for (let bx = Math.floor(FARM_SPAWN_X / P) - 2; bx <= Math.floor(FARM_SPAWN_X / P) + 8; bx++)
          for (let bz = Math.floor(FARM_SPAWN_Z / P) - 4; bz <= Math.floor(FARM_SPAWN_Z / P) + 4; bz++) {
            const st = W._farmSteadAt(bx, bz);
            if (st && W._farmHash(st.bx, st.bz, 771) < ENV_FARM_YARD_CHANCE) {
              at = { x: st.ox + 1, z: st.oz + 2 };
              break outer;
            }
          }
      }
      if (!at) return null;
      /* THE EYE IS PLACED RELATIVE TO THE OBJECT, NOT TO THE GROUND UNDER THE CAMERA.
         The first version stood at `findSpawnHeight` of the vantage cell and pitched a
         fixed -0.22, which on a slope put the camera on top of a hill looking at empty
         sky with the object off the bottom of the frame. The target height is known, so
         the pitch is computed from it. */
      const sx = at.x - Math.sin(b) * d, sz = at.z - Math.cos(b) * d;
      /* GENERATE BEFORE MEASURING. findSpawnHeight reads the loaded world, and an
         ungenerated column reads as air all the way down and returns its fallback of 40 —
         which is what put every one of these cameras at y=44 over ground at y=25, staring
         at the sky. Both the object's column and the vantage's have to exist first. */
      for (const [ax, az] of [[at.x, at.z], [sx, sz]]) {
        const c0 = Math.floor(ax / 16), d0 = Math.floor(az / 16);
        for (let cx = c0 - 2; cx <= c0 + 2; cx++) for (let cz = d0 - 2; cz <= d0 + 2; cz++) W._generateChunk(cx, cz);
      }
      const targetY = W.findSpawnHeight(at.x, at.z);
      /* ...AND ABOVE WHATEVER THE VANTAGE ITSELF IS STANDING ON. The second version put
         the eye a fixed height above the TARGET, which on the far side of a rise buried
         the camera inside a hill and produced a frame of grass with the object peeking
         over the bottom edge. */
      const standY = W.findSpawnHeight(Math.floor(sx), Math.floor(sz));
      const eyeY = Math.max(targetY + up, standY + 3);
      p.position.set(sx + 0.5, eyeY - 1.65, sz + 0.5);
      p.velocity.set(0, 0, 0);
      p.movementLocked = true;
      p.eyeHeight = 1.65;
      p.yaw = Math.atan2(-(at.x - p.position.x), -(at.z - p.position.z));
      p.pitch = Math.atan2(targetY - eyeY, d);
      /* MESH THEM TOO. _generateChunk fills chunk.data and marks it dirty; updateChunks
         is what builds the geometry, and it spends a fixed four-millisecond budget per
         call. With the frame loop switched off, six calls left most of the view unmeshed
         and the capture showed a hillside made of holes. */
      /* THE REAL FRAME LOOP IS LEFT RUNNING for these captures, unlike the opening
         film's preview. Nothing here advances with time except chunk streaming, and
         chunk streaming is precisely what the shot needs: driving updateChunks by hand
         with the loop switched off meshed a fraction of the view and produced frames of
         unmeshed stone with the decor floating in it. The player is movement-locked so
         the only thing the loop does is stream, light and draw.

         BUT THE MESHING IS FORCED. updateChunks spends a fixed four-millisecond budget
         per frame and this container draws about one frame a second, so after a teleport
         the streamer recovers roughly four milliseconds of meshing per second of wall
         clock and never catches up — two of these captures came back as a grey mass of
         unmeshed stone with the decor floating in it. Every resident chunk near the
         vantage is meshed here directly instead, which is the same call the streamer
         would eventually make. */
      W.updateChunks(p.position);
      const pcx = Math.floor(p.position.x / 16), pcz = Math.floor(p.position.z / 16);
      for (const c of W.chunks.values()) {
        if (!c.dirty) continue;
        if (Math.abs(c.cx - pcx) > 10 || Math.abs(c.cz - pcz) > 10) continue;
        W.generateChunkMesh(c);
      }
      return { at, pos: [Math.round(p.position.x), Math.round(p.position.z)], eyeY: Math.round(eyeY),
               targetY, standY, pitch: +p.pitch.toFixed(3), yaw: +p.yaw.toFixed(3),
               cam: [Math.round(g.camera.position.x), Math.round(g.camera.position.y), Math.round(g.camera.position.z)],
               rot: [+g.camera.rotation.x.toFixed(2), +g.camera.rotation.y.toFixed(2), +g.camera.rotation.z.toFixed(2), g.camera.rotation.order] };
    }, [siteKey, back, bearing, lift]);
    if (!info) { written.push(name + '.png ✗ (no site)'); continue; }
    /* Give the streamer real time to mesh what it has just been asked for. This
       container draws about one frame a second, and a chunk is meshed inside a
       four-millisecond per-frame budget, so this is seconds rather than milliseconds. */
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const g = window.game, W = g.world, p = g.player;
      W.updateChunks(p.position);
      const pcx = Math.floor(p.position.x / 16), pcz = Math.floor(p.position.z / 16);
      for (const c of W.chunks.values()) {
        if (!c.dirty) continue;
        if (Math.abs(c.cx - pcx) > 10 || Math.abs(c.cz - pcz) > 10) continue;
        W.generateChunkMesh(c);
      }
    });
    await page.waitForTimeout(1500);
    /* ONE RETRY. Capturing a live WebGL page under SwiftShader times out often enough
       that a single attempt loses a shot or two per run, and a lost shot is silently the
       PREVIOUS run's file still sitting on disk — which is worse than no file, because it
       looks like a capture of the current build. */
    let done = false;
    for (let attempt = 0; attempt < 2 && !done; attempt++) {
      try {
        await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 25000 });
        written.push(`${name}.png (${label}, at ${info.at.x},${info.at.z}) ${JSON.stringify(info)}`);
        done = true;
      } catch (e) {
        if (attempt === 1) written.push(name + '.png ✗ ' + e.name + ' (twice)');
        else await page.waitForTimeout(3000);
      }
    }
  }

  /* THE TWO PHOTOGRAPHS, MAGNIFIED. Drawn straight out of the live atlas so what is on
     screen is exactly what the mesher samples. */
  try {
    const ok = await page.evaluate(() => {
      const img = window.game.world.atlas && window.game.world.atlas.texture
        ? window.game.world.atlas.texture.image : null;
      if (!img) return false;
      const S = 16, Z = 14, PAD = 18;
      const cv = document.createElement('canvas');
      cv.width = (S * Z) * 2 + PAD * 3; cv.height = S * Z + PAD * 2 + 26;
      cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.fillStyle = '#15130f'; c.fillRect(0, 0, cv.width, cv.height);
      const draw = (tileIndex, x) => c.drawImage(img, tileIndex * S, 0, S, S, x, PAD, S * Z, S * Z);
      draw(TILE.artFamily, PAD);
      draw(TILE.artFamilyLone, PAD * 2 + S * Z);
      c.fillStyle = '#cfc6b0'; c.font = '13px ui-monospace, monospace';
      c.fillText('artFamily', PAD, cv.height - 12);
      c.fillText('artFamilyLone', PAD * 2 + S * Z, cv.height - 12);
      document.body.appendChild(cv);
      window.__tileCard = cv;
      return true;
    });
    if (ok) {
      const el = await page.$('canvas[style*="99999"]');
      await el.screenshot({ path: path.join(OUT, 'env-photographs.png'), timeout: 20000 });
      written.push('env-photographs.png (the two family photographs, 14x)');
      await page.evaluate(() => { if (window.__tileCard) window.__tileCard.remove(); });
    } else written.push('env-photographs.png ✗ (no atlas)');
  } catch (e) { written.push('env-photographs.png ✗ ' + e.name); }

  await browser.close();
  srv.close();
  console.log('wrote:\n  ' + written.join('\n  '));
  console.log('\nReal game, real world, real renderer, no assertions. For looking at.');
})().catch((e) => { console.error(e); process.exit(1); });
