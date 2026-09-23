/* D1 IMPLEMENTATION PHASE 4 — THE COLOUR PIPELINE AND THE SKY ENVIRONMENT, IN A REAL BROWSER.

   The renderer / PBR correction pass made three claims. This suite checks each in the live
   game, through the game's own PostFX pass — the one path a player's frame takes.

     ONE ENCODE      A hex colour on an unlit material reaches the screen as that hex — through
                     PostFX AND through a direct render — so the linear scene is encoded
                     exactly once. A missing encode shows 0x808080 as 55; a double one as 188.
                     The scene target is wide enough that 0x040404 survives as 4, not 0.
     INPUTS DECODED  Hex, CSS and named colours become linear once and read back as the same
                     hex; a colour texture must be MARKED sRGB to display as painted, and every
                     legacy canvas texture is.
     THE SKY         The game's SkyEnvironment is never put on the Lambert voxel scene (r152+
                     would light Lambert with it), builds nothing until a PBR scene attaches
                     it, then follows the day into the dark, inside its cap, leaking nothing.

   And one claim about the old world, made as absolute properties rather than against a
   remembered number: night in the Overworld is still NIGHT. The measured before/after table
   for every legacy scene is `tests/tools/color-ab.js`'s to produce.

   RUN IT ON BOTH RENDERERS:
       node browser-color-pipeline.js              the shipped r128
       node browser-color-pipeline.js --r186       the prepared upgrade bundle

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const PORT = Number(process.env.WII_COLOR_PORT || 8301);
const WANT_R186 = process.argv.indexOf('--r186') >= 0;

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; }
}
if (!chromium) { console.log('SKIP  playwright is not installed — browser validation not run.'); process.exit(0); }

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (m) => console.log('      ' + m);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

const R128 = '<script src="vendor/three/three.min.js"></script>\n<script src="vendor/three/GLTFLoader.js"></script>';
const R186 = '<script src="vendor/three/three.global.js"></script>';
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
               '.glb': 'model/gltf-binary' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'game.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      if (rel === 'game.html') {
        let html = fs.readFileSync(file, 'utf8');
        if (u.searchParams.get('three') === 'r186') html = html.replace(R128, R186);
        res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return;
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
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, a) {
      if (t === 'webgl' || t === 'webgl2' || t === 'experimental-webgl') {
        a = Object.assign({}, a || {}, { preserveDrawingBuffer: true });
      }
      return orig.call(this, t, a);
    };
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 200)));

  try {
    await page.goto('http://127.0.0.1:' + PORT + '/game.html' + (WANT_R186 ? '?three=r186' : ''),
                    { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => !!window.game, null, { timeout: 90000 });
    await page.evaluate(() => document.getElementById('clickPlay').click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (window.game.film && window.game.film.active) window.game.film.skip(); });
    await page.waitForFunction(() => window.game.running === true, null, { timeout: 120000 });

    // -------------------------------------------------------------------------------
    head('1. WHAT THE PIPELINE IS ON THIS RENDERER');

    const rep = await page.evaluate(() => colorPipelineReport(window.game.renderer, window.game.postfx.target));
    console.log('\nRENDERER: three r' + rep.revision + (WANT_R186 ? '  (prepared upgrade bundle)' : '  (shipped)'));
    note(JSON.stringify(rep));
    chk(rep.colorManagement === (WANT_R186 ? 'native' : 'shim'),
        'colour management is on — ' + rep.colorManagement + (WANT_R186 ? ' (r152+ ColorManagement)' : ' (the r128 backport)'));
    chk(rep.rendererOutput === rep.srgbName,
        'the renderer\'s own output is sRGB, so a built-in material drawn straight to the canvas is encoded too');
    chk(rep.targetColor !== rep.srgbName,
        'the PostFX scene target is LINEAR — nothing encodes on the way INTO it (' + rep.targetColor + ')');
    note('scene target: ' + (rep.targetHalfFloat ? 'half float' : '8-bit (the device cannot render to half float)'));

    // -------------------------------------------------------------------------------
    head('2. ONE ENCODE — A HEX COLOUR COMES BACK AS THAT HEX');

    /* A full-screen unlit quad in its own scene, read back from the canvas centre. Through
       PostFX (what the game does) and straight to the canvas (what anything else would do).
       0x040404 is the precision probe: an 8-bit LINEAR target stores it as 0 and shows black. */
    const probe = await page.evaluate(() => {
      const g = window.game, r = g.renderer;
      const scene = new THREE.Scene();
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      quad.position.z = -1; scene.add(quad);
      const W = r.domElement.width, H = r.domElement.height;
      const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
      const cx = cv.getContext('2d');
      const read = () => { cx.drawImage(r.domElement, W >> 1, H >> 1, 1, 1, 0, 0, 1, 1); return Array.from(cx.getImageData(0, 0, 1, 1).data.slice(0, 3)); };
      const viaPost = () => {
        const p = g.postfx, o = { scene: p.scene, camera: p.camera };
        p.scene = scene; p.camera = cam;
        try { p.render(0, 1.0); } finally { p.scene = o.scene; p.camera = o.camera; }
        return read();
      };
      const direct = () => { r.setRenderTarget(null); r.render(scene, cam); return read(); };
      const out = {};
      for (const hex of [0x808080, 0xc0c0c0, 0x404040, 0x101010, 0x040404, 0x7ec0ee]) {
        mat.color.setHex(hex);
        out[hex.toString(16).padStart(6, '0')] = { post: viaPost(), direct: direct() };
      }
      /* A painted canvas texture — CSS colours — marked and unmarked. */
      const c2 = document.createElement('canvas'); c2.width = c2.height = 4;
      const x2 = c2.getContext('2d'); x2.fillStyle = '#808080'; x2.fillRect(0, 0, 4, 4);
      mat.color.setHex(0xffffff);
      const raw = new THREE.CanvasTexture(c2);
      mat.map = raw; mat.needsUpdate = true;
      const unmarked = viaPost();
      const marked = new THREE.CanvasTexture(c2); markColorTexture(marked);
      mat.map = marked; mat.needsUpdate = true;
      const markedPx = viaPost();
      raw.dispose(); marked.dispose(); mat.dispose(); quad.geometry.dispose();
      return { out, unmarked, marked: markedPx };
    });
    const hexOf = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    const within = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
    for (const h of Object.keys(probe.out)) {
      const want = hexOf(h), got = probe.out[h];
      note('#' + h + ' -> PostFX ' + got.post.join(',') + '   direct ' + got.direct.join(','));
    }
    chk(within(probe.out['808080'].post, [128, 128, 128], 1),
        '#808080 through PostFX reads back as 128 — encoded once (missing: ~55, doubled: ~188)');
    chk(Object.keys(probe.out).every((h) => within(probe.out[h].post, hexOf(h), 2)),
        'every probe colour, dark to light and one sky blue, reads back as its own hex through PostFX');
    chk(Object.keys(probe.out).every((h) => within(probe.out[h].direct, hexOf(h), 2)),
        'and straight to the canvas as well — the renderer output setting and the post pass agree');
    chk(within(probe.out['040404'].post, [4, 4, 4], 1),
        '#040404 survives as 4 — the scene target keeps the dark end (an 8-bit linear target shows 0)');
    note('a painted #808080 canvas texture: unmarked ' + probe.unmarked.join(',') + ', marked ' + probe.marked.join(','));
    chk(within(probe.marked, [128, 128, 128], 1),
        'a canvas texture marked as colour displays as painted');
    chk(!within(probe.unmarked, [128, 128, 128], 20),
        'and an UNMARKED one does not — which is why every legacy canvas texture is marked');

    // -------------------------------------------------------------------------------
    head('3. INPUTS ARE DECODED ONCE, AND EVERY LEGACY COLOUR TEXTURE IS MARKED');

    const cm = await page.evaluate(() => {
      const a = new THREE.Color(0x808080), b = new THREE.Color('#808080'), c = new THREE.Color('gray');
      const d = new THREE.Color(); d.setRGB(0.5, 0.5, 0.5);
      const srgb = (typeof _assetUsesColorSpaceApi === 'function' && _assetUsesColorSpaceApi())
        ? String(THREE.SRGBColorSpace) : String(THREE.sRGBEncoding);
      const cs = (t) => t ? String(t.colorSpace !== undefined ? t.colorSpace : t.encoding) : null;
      const g = window.game;
      const legacy = { atlas: cs(g.world.material.map),
                       clouds: g.env.cloudTextures.map(cs),
                       glow: cs(g.env.sunSprite.material.map) };
      return { hexR: a.r, hexBack: a.getHexString(), style: b.r, named: c.r, rgb: d.r, legacy, srgb };
    });
    note('0x808080 -> r ' + cm.hexR.toFixed(4) + ', back to #' + cm.hexBack + '; setRGB(0.5) stays ' + cm.rgb);
    chk(Math.abs(cm.hexR - 0.2158605) < 1e-4 && cm.hexBack === '808080',
        'a hex colour is stored linear (0.2159) and reads back as the same hex');
    chk(Math.abs(cm.style - cm.hexR) < 1e-9 && Math.abs(cm.named - cm.hexR) < 1e-9,
        'CSS and named colours are decoded exactly once too — no double conversion through setStyle');
    chk(cm.rgb === 0.5, 'setRGB is linear and untouched, exactly as in r152+');
    chk(cm.legacy.atlas === cm.srgb && cm.legacy.clouds.every((v) => v === cm.srgb) && cm.legacy.glow === cm.srgb,
        'the voxel atlas, the clouds and the sun glow are all marked as colour textures');

    // -------------------------------------------------------------------------------
    head('4. THE SKY ENVIRONMENT');

    const sky = await page.evaluate(async () => {
      const g = window.game, se = g.env.skyEnvironment;
      const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      const out = {};

      /* THE VOXEL SCENE CARRIES NO ENVIRONMENT. It is Lambert, and r152+ hands
         scene.environment to Lambert too — so on the prepared upgrade an environment here
         would add a second ambient term to the whole Era 1 world. */
      out.voxelEnv = g.scene.environment ? 'SET' : 'none';
      let std = 0; g.scene.traverse((o) => { if (o.material && o.material.isMeshStandardMaterial) std++; });
      out.standardInScene = std;

      /* NOTHING TO LIGHT, NOTHING BUILT. With no PBR scene attached, a whole day of sky
         changes costs no rebuild at all. */
      const t0 = g.env.t;
      const bIdle = se.stats.builds, sIdle = se.stats.skippedNoConsumer;
      for (let s = 0, k = 0; s < 720; s += 0.5, k++) {
        if (k % 20 === 0) await frame();
        g.env.t = s; g.env.update(0.5);
      }
      out.idleBuilds = se.stats.builds - bIdle;
      out.skipped = se.stats.skippedNoConsumer - sIdle;

      /* A PBR SCENE ATTACHES IT, AND IT FOLLOWS THE DAY INTO THE DARK. One small Standard
         object in its own scene, attached to the game's SkyEnvironment, then the real
         EnvironmentSystem driven through a whole 720-second day at 4 Hz.
         A frame is let through every ten simulated seconds — at most five rebuilds queued
         between presents. Without it a whole day of prefilter passes stacks up on the GPU with
         nothing presented, which no player can produce; every simulated second is too many
         frames for r186 under a software rasteriser. */
      const pbr = new THREE.Scene();
      const probe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial());
      pbr.add(probe);
      const hadTexture = !!se.texture;
      const tex0 = g.renderer.info.memory.textures;
      se.attach(pbr);
      let maxMs = 0, noonSky = 0, nightSky = Infinity;
      const b0 = se.stats.builds;
      let texFirst = -1;
      for (let s = 0, k = 0; s < 720; s += 0.25, k++) {
        if (k % 40 === 0) await frame();
        g.env.t = s;
        g.env.update(0.25);
        if (texFirst < 0 && se.stats.builds > b0) texFirst = g.renderer.info.memory.textures;
        const sky9 = se._built || [0];
        const lum = Math.max.apply(null, sky9.slice(0, 3));
        if (Math.abs(s - 200) < 0.13) noonSky = lum;
        if (s > 500 && s < 650) nightSky = Math.min(nightSky, lum);
        if (se.stats.lastMs > maxMs) maxMs = se.stats.lastMs;
      }
      g.env.t = t0;
      out.pbrLit = !!pbr.environment && pbr.environment === se.texture;
      se.detach(pbr);
      out.detached = pbr.environment === null;
      probe.geometry.dispose(); probe.material.dispose();
      await settle();
      out.dayBuilds = se.stats.builds - b0;
      out.cap = Math.floor(720 / se.minInterval) + 1;
      out.maxMs = maxMs;
      out.noonSky = noonSky; out.nightSky = nightSky;
      /* The environment is ONE texture. r186's PMREMGenerator also keeps its blur scratch
         target alive between builds (r128 disposed it after each one), so a live
         SkyEnvironment holds one or two — bounded, and freed by dispose(), which the
         standalone check below proves. What must never happen is GROWTH: the count after the
         first build of the day and after the last must be the same. */
      out.texDelta = g.renderer.info.memory.textures - tex0;
      out.texGrowth = g.renderer.info.memory.textures - texFirst;
      out.expectedDelta = hadTexture ? 0 : 1;

      /* AND A STANDALONE ONE DISPOSES EVERYTHING IT MADE. */
      const texA = g.renderer.info.memory.textures;
      const extra = new SkyEnvironment(g.renderer);
      const sc = new THREE.Scene(); extra.attach(sc);
      extra.request(0x8fb1cf, 0xb8cde0, 0x5a5238, 1); extra.buildNow();
      extra.request(0x101418, 0x202428, 0x080808, 0.1); extra.buildNow();
      await settle();
      const texB = g.renderer.info.memory.textures;
      extra.dispose();
      await settle();
      out.standalone = { during: texB - texA, after: g.renderer.info.memory.textures - texA,
                         cleared: sc.environment === null };
      return out;
    });
    note('voxel scene environment: ' + sky.voxelEnv + '; Standard materials in the live voxel scene: ' + sky.standardInScene);
    note('no PBR scene attached, a 720-second day: ' + sky.idleBuilds + ' rebuilds, ' + sky.skipped + ' stood down');
    note('a PBR scene attached, a 720-second day at 4 Hz: ' + sky.dayBuilds + ' rebuilds, the slowest ' + sky.maxMs.toFixed(1) +
         ' ms; sky brightness noon ' + sky.noonSky.toFixed(4) + ', night ' + sky.nightSky.toFixed(5));
    chk(sky.voxelEnv === 'none',
        'the Lambert voxel scene carries NO environment — r152+ would light Lambert with it and double Era 1\'s ambient');
    chk(sky.idleBuilds === 0 && sky.skipped > 0,
        'with no PBR scene attached a whole day of sky changes costs ZERO rebuilds (' + sky.skipped +
        ' stood down) — no GPU work nobody sees');
    chk(sky.pbrLit && sky.detached,
        'a PBR scene that attaches the game\'s SkyEnvironment is lit by it, and detaching clears it');
    chk(sky.dayBuilds > 0 && sky.dayBuilds <= sky.cap,
        'it follows the sky through a full day with ' + sky.dayBuilds + ' rebuilds — inside its own cap of one per ' +
        'minInterval (' + sky.cap + ' a day), and only when the sky actually moved');
    chk(sky.nightSky < sky.noonSky * 0.05,
        'and at night it is DARK — under 5% of its noon brightness — so nothing PBR is lit by a sky that is not there');
    chk(sky.texGrowth === 0 && sky.texDelta >= sky.expectedDelta && sky.texDelta <= sky.expectedDelta + 1,
        'a whole day of rebuilds does not grow the texture count (' + sky.texGrowth + ' after the first build; ' +
        sky.texDelta + ' held in all: the environment' + (sky.texDelta > sky.expectedDelta ? ' + PMREM\'s reused scratch target' : '') +
        ') — none leaked');
    chk(sky.standalone.during >= 1 && sky.standalone.after === 0 && sky.standalone.cleared,
        'a standalone SkyEnvironment disposes every texture it made and detaches from its scene (' +
        sky.standalone.during + ' while alive, ' + sky.standalone.after + ' after)');

    // -------------------------------------------------------------------------------
    head('5. THE OLD WORLD KEEPS ITS NIGHT');

    /* ABSOLUTE PROPERTIES, not a remembered number: the Overworld is bright at noon, clearly
       darker at dusk, and at night most of the frame is near black. The before/after table
       these were checked against is tests/tools/color-ab.js's. */
    const ow = await page.evaluate(async () => {
      const g = window.game, pl = g.player;
      pl.position.set(8.5, g.world.findSpawnHeight(8, 8) + 1.7, 8.5); pl.velocity.set(0, 0, 0);
      pl.yaw = 0.7; pl.pitch = -0.12;
      for (let i = 0; i < 6; i++) { g.world.updateChunks(pl.position); await new Promise((r) => setTimeout(r, 600)); }
      await new Promise((r) => setTimeout(r, 1500));
      const W = 220, H = 140;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d');
      const at = (t) => {
        g.camera.rotation.set(pl.pitch, pl.yaw, 0, 'YXZ');
        g.env.t = t; g.env.cloudGroup.visible = false; g.env.update(0);
        g.postfx.render(0, 1.0);
        cx.drawImage(g.renderer.domElement, 0, 0, W, H);
        const d = cx.getImageData(0, 0, W, H).data, L = [];
        let s = 0;
        for (let i = 0; i < d.length; i += 4) { const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; L.push(l); s += l; }
        L.sort((a, b) => a - b);
        return { mean: s / L.length, p50: L[L.length >> 1], p90: L[Math.floor(L.length * 0.9)] };
      };
      const r = { noon: at(200), dusk: at(410), night: at(560) };
      r.png = g.renderer.domElement.toDataURL('image/png');
      r.noonPng = (at(200), g.renderer.domElement.toDataURL('image/png'));
      return r;
    });
    fs.writeFileSync(path.join(OUT, 'color-pipeline-voxel-night' + (WANT_R186 ? '-r186' : '') + '.png'),
                     Buffer.from(ow.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, 'color-pipeline-voxel-noon' + (WANT_R186 ? '-r186' : '') + '.png'),
                     Buffer.from(ow.noonPng.split(',')[1], 'base64'));
    for (const k of ['noon', 'dusk', 'night']) {
      note(k.padEnd(6) + 'mean ' + ow[k].mean.toFixed(3) + '  p50 ' + ow[k].p50.toFixed(3) + '  p90 ' + ow[k].p90.toFixed(3));
    }
    chk(ow.noon.mean > 0.25, 'the Overworld at noon is a daylight frame (mean luma ' + ow.noon.mean.toFixed(3) + ')');
    chk(ow.dusk.mean < ow.noon.mean * 0.7, 'dusk is clearly darker than noon');
    chk(ow.night.mean < 0.08 && ow.night.p50 < 0.05,
        'and night is NIGHT — mean ' + ow.night.mean.toFixed(3) + ', median ' + ow.night.p50.toFixed(3) +
        ' (the correction without the legacy transfer measured 0.137 here)');

    // -------------------------------------------------------------------------------
    head('6. THE GAME IS STILL THE GAME');

    const post = await page.evaluate(() => ({ running: window.game.running === true,
      hud: getComputedStyle(document.getElementById('hud')).display }));
    chk(post.running && post.hud !== 'none', 'the game is still running with its HUD up');
    chk(errors.length === 0, 'the page raised no errors across the whole run');
    if (errors.length) errors.slice(0, 6).forEach((e) => note('ERROR ' + e));

    await page.close();
  } catch (e) {
    chk(false, 'the suite threw: ' + (e && e.message));
  } finally {
    await browser.close(); srv.close();
  }

  console.log('\n' + (fail ? 'FAILED — ' + fail + ' check(s)' : 'ALL CHECKS PASSED') +
              '   [renderer: ' + (WANT_R186 ? 'r186 prepared' : 'r128 shipped') + ']');
  process.exit(fail ? 1 : 0);
})();
