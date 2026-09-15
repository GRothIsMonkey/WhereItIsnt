/* ERA 2 E2.0a — THE ASSET PIPELINE, IN A REAL BROWSER.

   Launches Chromium through Playwright, serves the build over HTTP, boots the real game
   with a real WebGL context and a real renderer, and drives the real AssetLibrary against
   the real road_signs.glb.

   WHAT THIS PROVES that the offline suite cannot: that a real GLB is located and decoded;
   that the loader produces a real three.js scene graph; that materials and textures come
   out with the colour spaces the policy asks for; what the asset's real scale is and that
   the pipeline can normalise it; that an instance enters the scene through the intended
   abstraction; that a missing and a malformed asset both fail safely and latch; that
   disposal actually returns resources to the renderer; that the collision proxy answers
   without a voxel anywhere in it; and that repeated load/unload does not leak
   engine-managed resources.

   WHAT IT DOES NOT PROVE. Whether the model LOOKS right. `renderer.info.memory` counts
   three.js objects the renderer holds — it is not VRAM, no browser API exposes VRAM, and
   nothing here pretends otherwise. A screenshot is written for a person to look at.

   RUN IT TWICE, ON BOTH RENDERERS:
       node browser-assets.js              the shipped r128
       node browser-assets.js --r186       the prepared upgrade bundle
       node browser-assets.js --drift      re-measure the r128 -> r186 visual drift

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const PORT = Number(process.env.WII_ASSET_PORT || 8263);
const WANT_R186 = process.argv.indexOf('--r186') >= 0;
const WANT_DRIFT = process.argv.indexOf('--drift') >= 0;

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
               '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json' };

/* The server also serves two DELIBERATE FAULTS, so failure handling is exercised against
   a real transport rather than a stubbed one:
       /assets/models/props/__missing.glb   404
       /assets/models/props/__broken.glb    200 with bytes that are not a GLB           */
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'game.html';
      if (rel.endsWith('__missing.glb')) { res.writeHead(404); res.end('no'); return; }
      if (rel.endsWith('__broken.glb')) {
        res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
        res.end(Buffer.from('this is definitively not a glTF binary'));
        return;
      }
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      if (rel === 'game.html') {
        let html = fs.readFileSync(file, 'utf8');
        const want = u.searchParams.get('three');
        if (want === 'r186') html = html.replace(R128, R186);
        res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

async function boot(browser, variant) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  await page.addInitScript(() => {
    /* A WebGL canvas is empty after it presents unless the buffer is preserved, so a
       framebuffer read returns black. Only the test needs this; the game never sets it. */
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
  const q = variant === 'r186' ? '?three=r186' : '';
  await page.goto('http://127.0.0.1:' + PORT + '/game.html' + q, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.game, null, { timeout: 90000 });
  await page.evaluate(() => document.getElementById('clickPlay').click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => { if (window.game.film && window.game.film.active) window.game.film.skip(); });
  await page.waitForFunction(() => window.game.running === true, null, { timeout: 120000 });
  return { page, errors };
}

/* ------------------------------------------------------------------ the drift re-measure */
async function drift(browser) {
  head('THREE VERSION DRIFT — re-measuring what vendor/three/README.md records');
  const grab = () => {
    const g = window.game, W = 160, H = 100;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(g.renderer.domElement, 0, 0, W, H);
    const d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const px = []; let sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < d.length; i += 4) { px.push(d[i], d[i + 1], d[i + 2]); sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; }
    const n = d.length / 4;
    return { px, mean: [sr / n, sg / n, sb / n], rev: THREE.REVISION };
  };
  const pose = async (page) => {
    await page.evaluate(() => {
      const g = window.game, p = g.player;
      g.daySeconds = 200;
      p.position.set(8.5, g.world.findSpawnHeight(8, 8) + 1.7, 8.5);
      p.velocity.set(0, 0, 0); p.yaw = 0.7; p.pitch = -0.12;
      g.world.updateChunks(p.position);
    });
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.game.world.updateChunks(window.game.player.position));
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(2500);
  };
  const a = await boot(browser, 'r128'); await pose(a.page);
  const A = await a.page.evaluate(grab); await a.page.close();
  const b = await boot(browser, 'r186'); await pose(b.page);
  const B = await b.page.evaluate(grab); await b.page.close();
  let diff = 0, max = 0, sum = 0;
  for (let i = 0; i < A.px.length; i++) { const d = Math.abs(A.px[i] - B.px[i]); if (d) diff++; if (d > max) max = d; sum += d; }
  note('r128 mean RGB ' + A.mean.map((v) => v.toFixed(1)).join(', '));
  note('r186 mean RGB ' + B.mean.map((v) => v.toFixed(1)).join(', '));
  note('changed ' + (100 * diff / A.px.length).toFixed(2) + '% of subpixels, mean delta ' +
       (sum / A.px.length).toFixed(2) + '/255, max delta ' + max);
  note('The upgrade is DEFERRED on this evidence. See vendor/three/README.md.');
}

// =====================================================================================
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const variant = WANT_R186 ? 'r186' : 'r128';

  try {
    if (WANT_DRIFT) { await drift(browser); return; }

    const { page, errors } = await boot(browser, variant);
    const rev = await page.evaluate(() => THREE.REVISION);
    console.log('\nRENDERER: three r' + rev + (WANT_R186 ? '  (prepared upgrade bundle)' : '  (shipped)'));

    // -------------------------------------------------------------------------------
    head('1. THE ENGINE CAN LOCATE AND LOAD A REAL GLB');

    chk(await page.evaluate(() => !!window.game.assets), 'the game exposes an AssetLibrary');
    chk(await page.evaluate(() => typeof THREE.GLTFLoader === 'function'),
        'GLTFLoader is on the THREE global (the pipeline asks for it, never imports it)');
    chk(await page.evaluate(() => window.game.assets.transportDead() === false),
        'the transport is alive — the build is being served over HTTP');

    const t0 = Date.now();
    const loaded = await page.evaluate(async () => {
      const src = await window.game.assets.load('prop.road-signs');
      if (!src) return null;
      return { key: src.key, refs: src.refs, report: src.report,
               bounds: src.bounds, nativeBounds: src.nativeBounds, scale: src.scale };
    });
    const ms = Date.now() - t0;
    chk(!!loaded, 'road_signs.glb loaded through the registry key "prop.road-signs" (' + ms + ' ms)');
    if (!loaded) throw new Error('nothing else can be tested without the asset');
    note('meshes ' + loaded.report.meshes + ', triangles ' + loaded.report.triangles.toLocaleString());

    // -------------------------------------------------------------------------------
    head('2. THE LOADER PRODUCES A REAL three.js REPRESENTATION');

    const shape = await page.evaluate(() => {
      const src = window.game.assets.sources.get('prop.road-signs');
      let meshes = 0, geoms = 0, withPos = 0, nodes = 0;
      src.root.traverse((n) => {
        nodes++;
        if (n.isMesh) { meshes++; if (n.geometry) { geoms++; if (n.geometry.attributes.position) withPos++; } }
      });
      return { isObject3D: !!src.root.isObject3D, nodes, meshes, geoms, withPos,
               resGeom: src.resources.geometries.size,
               resMat: src.resources.materials.size,
               resTex: src.resources.textures.size };
    });
    chk(shape.isObject3D, 'the source is a real THREE.Object3D graph');
    chk(shape.nodes > 1 && shape.meshes > 0, 'it contains ' + shape.meshes + ' mesh(es) across ' + shape.nodes + ' nodes');
    chk(shape.withPos === shape.geoms && shape.geoms > 0, 'every mesh geometry has a real position attribute');
    note('owned resources — geometries ' + shape.resGeom + ', materials ' + shape.resMat + ', textures ' + shape.resTex);

    // -------------------------------------------------------------------------------
    head('3. MATERIALS AND TEXTURES ARE HANDLED, NOT ACCEPTED AS FOUND');

    const mats = await page.evaluate(() => {
      const src = window.game.assets.sources.get('prop.road-signs');
      const seen = new Set(); const out = [];
      src.root.traverse((n) => {
        if (!n.isMesh) return;
        const ms = Array.isArray(n.material) ? n.material : [n.material];
        for (const m of ms) {
          if (!m || seen.has(m.uuid)) continue;
          seen.add(m.uuid);
          const maps = [];
          for (const k of Object.keys(m)) if (m[k] && m[k].isTexture) maps.push(k);
          out.push({ type: m.type, maps,
                     colorSpaceOfMap: m.map ? String(m.map.colorSpace || m.map.encoding) : null,
                     normalLinear: m.normalMap ? String(m.normalMap.colorSpace || m.normalMap.encoding) : null,
                     aniso: m.map ? m.map.anisotropy : null });
        }
      });
      return { distinct: out.length, out, report: src.report,
               castsShadow: (() => { let n = 0; src.root.traverse((x) => { if (x.isMesh && x.castShadow) n++; }); return n; })() };
    });
    chk(mats.distinct > 0, 'the asset has ' + mats.distinct + ' distinct material(s) after normalisation');
    note('material types: ' + Array.from(new Set(mats.out.map((m) => m.type))).join(', '));
    note('texture slots in use: ' + Array.from(new Set(mats.out.flatMap((m) => m.maps))).join(', '));
    note('dedup: ' + mats.report.materialsBefore + ' -> ' + mats.report.materialsAfter +
         ' (' + mats.report.deduped + ' mesh slot(s) repointed)');

    const SRGB = await page.evaluate(() =>
      (THREE.SRGBColorSpace !== undefined) ? String(THREE.SRGBColorSpace) : String(THREE.sRGBEncoding));
    const LINEAR = await page.evaluate(() =>
      (THREE.LinearSRGBColorSpace !== undefined) ? String(THREE.LinearSRGBColorSpace) : String(THREE.LinearEncoding));
    const withBase = mats.out.filter((m) => m.colorSpaceOfMap !== null);
    chk(withBase.length === 0 || withBase.every((m) => m.colorSpaceOfMap === SRGB),
        'every base-colour map is in sRGB (' + withBase.length + ' checked, expected "' + SRGB + '")');
    const withNormal = mats.out.filter((m) => m.normalLinear !== null);
    chk(withNormal.length === 0 || withNormal.every((m) => m.normalLinear === LINEAR),
        'every normal map is LINEAR — data, not colour (' + withNormal.length + ' checked)');
    chk(mats.castsShadow === shape.meshes, 'the import policy set shadow casting on every mesh');

    // -------------------------------------------------------------------------------
    head('4. SCALE AND ORIENTATION ARE MEASURED, AND NORMALISATION WORKS');

    const nb = loaded.nativeBounds;
    note('native bounds  size ' + nb.size.map((v) => v.toFixed(2)).join(' x ') + ' m');
    note('               min  ' + nb.min.map((v) => v.toFixed(2)).join(', '));
    note('               max  ' + nb.max.map((v) => v.toFixed(2)).join(', '));
    chk(nb.size[0] > 0 && nb.size[1] > 0 && nb.size[2] > 0, 'the asset has real, non-degenerate bounds');
    chk(loaded.scale === 1, 'no silent rescale was applied — the registry row declares normalize: null');
    note('road_signs.glb is a VALIDATION asset; its native size is REPORTED, not corrected.');
    note('A production row states a targetHeight and the pipeline enforces it — proven next.');

    /* Prove the normalisation path itself, without inventing a "correct" size for an
       asset that is not production content: load it again under a synthetic registry
       row that asks for a known height, and check the pipeline delivered it. */
    const norm = await page.evaluate(async () => {
      /* Drive the REAL normalisation path by presenting one different registry row
         through the library's own `_spec` seam. MODEL_ASSETS is a lexical const and is
         frozen; nothing here mutates it, and the real library is untouched. */
      const lib = new AssetLibrary(window.game.renderer);
      const row = Object.assign({}, MODEL_ASSETS['prop.road-signs'], { normalize: { targetHeight: 2.5 } });
      lib._spec = (k) => (k === 'probe.normalised' ? row : MODEL_ASSETS[k]);
      const src = await lib.load('probe.normalised');
      if (!src) return { error: Array.from(lib.failed.values()).join('; ') };
      const out = { height: src.bounds.size[1], scale: src.scale,
                    nativeHeight: src.nativeBounds.size[1] };
      lib.disposeAll();
      return out;
    });
    if (norm && !norm.error) {
      chk(Math.abs(norm.height - 2.5) < 0.01,
          'normalize.targetHeight=2.5 produced a 2.5 m asset (got ' + norm.height.toFixed(3) + ' m, scale x' +
          norm.scale.toFixed(4) + ' from a native ' + norm.nativeHeight.toFixed(2) + ' m)');
    } else {
      chk(false, 'the normalisation probe could not run' + (norm && norm.error ? ': ' + norm.error : ''));
    }

    // -------------------------------------------------------------------------------
    head('5. AN INSTANCE ENTERS THE SCENE THROUGH THE INTENDED ABSTRACTION');

    const placed = await page.evaluate(async () => {
      const g = window.game;
      const inst = await g.assets.acquire('prop.road-signs');
      if (!inst) return null;
      const p = g.player.position;
      inst.position.set(p.x + 3, g.physical.groundHeightAt(Math.floor(p.x + 3), Math.floor(p.z)) + 1, p.z);
      g.scene.add(inst);
      window.__inst = inst;
      return { inScene: inst.parent === g.scene, key: inst.userData.assetKey,
               refs: g.assets.sources.get('prop.road-signs').refs,
               sceneChildren: g.scene.children.length,
               sharesGeometry: (() => {
                 let shared = true;
                 const srcGeoms = new Set();
                 g.assets.sources.get('prop.road-signs').root.traverse((n) => { if (n.geometry) srcGeoms.add(n.geometry); });
                 inst.traverse((n) => { if (n.geometry && !srcGeoms.has(n.geometry)) shared = false; });
                 return shared;
               })() };
    });
    chk(!!placed && placed.inScene, 'acquire() returned an instance and it was added to the real scene');
    chk(!!placed && placed.key === 'prop.road-signs', 'the instance carries its registry key');
    chk(!!placed && placed.refs === 1, 'the source reference count went to 1');
    chk(!!placed && placed.sharesGeometry,
        'the clone SHARES the source geometry — one upload, not a copy per instance');

    await page.waitForTimeout(1200);
    try { await page.screenshot({ path: path.join(OUT, 'assets-road-signs-' + variant + '.png'), timeout: 60000 }); note('screenshot: tests/renders/assets-road-signs-' + variant + '.png'); }
    catch (e) { note('screenshot failed: ' + e.name); }

    // -------------------------------------------------------------------------------
    head('6. COLLISION INTEGRATION, WITHOUT A VOXEL IN IT');

    const coll = await page.evaluate(() => {
      const g = window.game;
      const src = g.assets.sources.get('prop.road-signs');
      const n = g.assetCollision.add(window.__inst, src);
      const b = g.assetCollision.entries[0] ? g.assetCollision.entries[0].boxes[0] : null;
      if (!b) return { n, hit: null };
      const mid = { minX: (b.minX + b.maxX) / 2 - 0.1, maxX: (b.minX + b.maxX) / 2 + 0.1,
                    minY: (b.minY + b.maxY) / 2 - 0.1, maxY: (b.minY + b.maxY) / 2 + 0.1,
                    minZ: (b.minZ + b.maxZ) / 2 - 0.1, maxZ: (b.minZ + b.maxZ) / 2 + 0.1 };
      const away = { minX: b.maxX + 50, maxX: b.maxX + 51, minY: b.minY, maxY: b.maxY,
                     minZ: b.minZ, maxZ: b.maxZ };
      return { n, hit: g.assetCollision.collidesAABB(mid), miss: g.assetCollision.collidesAABB(away),
               ground: g.assetCollision.groundHeightAt((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2),
               nowhere: g.assetCollision.groundHeightAt(b.maxX + 500, b.maxZ + 500),
               top: b.maxY, size: g.assetCollision.size };
    });
    chk(coll.n > 0, 'the declared proxy produced ' + coll.n + ' world-space box(es)');
    chk(coll.hit === true, 'collidesAABB is TRUE inside the proxy');
    chk(coll.miss === false, 'and FALSE fifty metres away');
    chk(coll.ground !== null && Math.abs(coll.ground - coll.top) < 1e-6,
        'groundHeightAt returns the proxy top over the asset');
    chk(coll.nowhere === null,
        'and NULL where this set has nothing — "no opinion", not "the ground is at zero"');

    const contract = await page.evaluate(() => {
      const need = ['collidesAABB', 'groundHeightAt', 'isSolid'];
      const set = window.game.assetCollision, phys = window.game.physical;
      return need.map((m) => ({ m, onSet: typeof set[m] === 'function', onPhys: typeof phys[m] === 'function' }));
    });
    chk(contract.every((c) => c.onSet && c.onPhys),
        'all three queries exist on BOTH the asset set and VoxelPhysicalWorld — ' +
        'the E2.1 contract answered over meshes for the first time');

    // -------------------------------------------------------------------------------
    head('7. FAILURE HANDLING — A MISSING ASSET, A MALFORMED ONE, AND A DEAD TRANSPORT');

    const fails = await page.evaluate(async () => {
      const lib = new AssetLibrary(window.game.renderer);
      /* Present synthetic rows through the same `_spec` seam the normalisation probe
         uses, so failure is exercised through the real load path rather than around it. */
      lib._spec = (k) => ({ f: k === 'probe.broken' ? 'props/__broken.glb' : 'props/__missing.glb' });
      const missing = await lib.load('probe.missing');
      const broken = await lib.load('probe.broken');
      const again = await lib.load('probe.missing');
      /* ASSET_LIMITS.deadAfter consecutive failures with NO success is what declares the
         transport dead. Drive exactly that many — the threshold is not lowered to make
         the test convenient. */
      for (let i = 0; lib.stats.failed < ASSET_LIMITS.deadAfter; i++) await lib.load('probe.more' + i);
      return { missing, broken, again, deadAfter: ASSET_LIMITS.deadAfter, failures: lib.stats.failed,
               failedCount: lib.failed.size,
               reasons: Array.from(lib.failed.values()),
               pendingAfter: lib.isPending('probe.missing'),
               isFailed: lib.isFailed('probe.missing'),
               requested: lib.stats.requested,
               transportDead: lib.transportDead() };
    });
    chk(fails.missing === null, 'a 404 resolves to null and does not throw');
    chk(fails.broken === null, 'bytes that are not a GLB resolve to null and do not throw');
    chk(fails.again === null && fails.requested === fails.failures,
        'a failure is LATCHED — a repeat request costs no fetch (' + fails.requested +
        ' requests for ' + (fails.failures + 1) + ' calls)');
    chk(fails.isFailed === true && fails.pendingAfter === false,
        'a failed asset reports failed and NOT pending — nothing can wait on it forever');
    note('reasons: ' + fails.reasons.join(' | '));
    chk(fails.transportDead === true,
        fails.failures + ' failures with no success trips transportDead() (deadAfter=' +
        fails.deadAfter + ') — a missing SUBSYSTEM, not a missing asset');

    const alive = await page.evaluate(() => window.game.assets.transportDead());
    chk(alive === false, 'and the real library, which HAS loaded something, is not affected');

    const blocked = await page.evaluate(() => ASSET_TRANSPORT_BLOCKED);
    chk(blocked === false, 'ASSET_TRANSPORT_BLOCKED is false over HTTP (it latches true on file://)');

    // -------------------------------------------------------------------------------
    head('8. DISPOSAL RETURNS RESOURCES, AND SHARED ONES ARE NOT TAKEN EARLY');

    const early = await page.evaluate(async () => {
      const g = window.game;
      const second = await g.assets.acquire('prop.road-signs');
      g.scene.add(second);
      const refs2 = g.assets.sources.get('prop.road-signs').refs;
      g.assets.release(second);
      const refs1 = g.assets.sources.get('prop.road-signs').refs;
      const stillResident = g.assets.isLoaded('prop.road-signs');
      let firstStillDrawable = true;
      window.__inst.traverse((n) => {
        if (n.isMesh && (!n.geometry || !n.geometry.attributes || !n.geometry.attributes.position)) firstStillDrawable = false;
      });
      return { refs2, refs1, stillResident, firstStillDrawable };
    });
    chk(early.refs2 === 2 && early.refs1 === 1, 'a second instance took the count to 2, releasing it returned it to 1');
    chk(early.stillResident, 'the source was NOT disposed while an instance still held it');
    chk(early.firstStillDrawable, 'and the surviving instance still has its geometry — nothing shared was taken early');

    const last = await page.evaluate(() => {
      const g = window.game;
      const before = { geom: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures };
      g.assetCollision.remove(window.__inst);
      g.assets.release(window.__inst);
      window.__inst = null;
      return { before, resident: g.assets.isLoaded('prop.road-signs'),
               disposed: g.assets.stats.disposed, collision: g.assetCollision.size };
    });
    chk(last.resident === false, 'the last release disposed the source');
    chk(last.disposed >= 1, 'and the disposal was counted');
    chk(last.collision === 0, 'and its collision proxy came out of the set');

    // -------------------------------------------------------------------------------
    head('9. REPEATED LOAD/UNLOAD DOES NOT GROW ENGINE-MANAGED RESOURCE COUNTERS');

    note('renderer.info.memory counts three.js objects the renderer holds. It is NOT VRAM —');
    note('no browser API exposes VRAM — but it is exactly what a leak would move.');
    const cycles = await page.evaluate(async () => {
      const g = window.game;
      const read = () => ({ geom: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures });
      const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      /* FREEZE THE CHUNK STREAMER FOR THE MEASUREMENT.

         The first version of this test read a climb from 312 to 406 across five cycles
         and called it a leak. It was not: the streamer runs in the same frame loop and
         creates geometries of its own, so `peak - before` and `peak - after` are BOTH
         contaminated — in opposite directions — and the asset's real contribution is
         buried in the noise. Adding a control showed the residual sat inside the
         streamer's own drift, which is evidence but not proof.

         Silencing the one other producer makes it exact instead of statistical. The
         override is a local no-op restored in `finally`, so the game is untouched
         afterwards; nothing about the library changes for the measurement. */
      const origUpdate = g.world.updateChunks;
      const control = [];
      const series = [];
      let base, endState;
      try {
        g.world.updateChunks = function () { /* frozen for the measurement */ };

        /* The floor: same waits, no asset. With the streamer frozen this should be 0. */
        for (let i = 0; i < 3; i++) {
          const a = read(); await settle(); await settle();
          control.push(read().geom - a.geom);
        }

        base = read();
        for (let i = 0; i < 5; i++) {
          const before = read();
          const inst = await g.assets.acquire('prop.road-signs');
          g.scene.add(inst);
          await settle();
          const peak = read();
          g.assets.release(inst);
          await settle();
          const after = read();
          series.push({ before, peak, after,
                        added: peak.geom - before.geom,
                        freed: peak.geom - after.geom,
                        residual: after.geom - before.geom,
                        texAdded: peak.tex - before.tex,
                        texResidual: after.tex - before.tex });
        }
        endState = read();
      } finally {
        g.world.updateChunks = origUpdate;
      }
      const srcGeoms = 191;
      return { base, endState, series, control, srcGeoms,
               stats: Object.assign({}, g.assets.stats), report: g.assets.debugReport() };
    });

    const ctlDrift = cycles.control.reduce((a, b) => a + b, 0) / cycles.control.length;
    note('chunk streamer frozen for this measurement, restored after.');
    note('control (no asset): geometry drift per cycle ' + cycles.control.join(', ') +
         '  — mean ' + ctlDrift.toFixed(1));
    cycles.series.forEach((s2, i) => note('cycle ' + (i + 1) + '  added ' + s2.added +
      ', freed ' + s2.freed + ', residual ' + s2.residual +
      ', textures +' + s2.texAdded + '/' + s2.texResidual +
      '   (' + s2.before.geom + ' -> ' + s2.peak.geom + ' -> ' + s2.after.geom + ')'));

    chk(ctlDrift === 0,
        'with the streamer frozen, nothing else creates geometries — the floor is ' + ctlDrift);

    const added = cycles.series.map((s2) => s2.added);
    const freed = cycles.series.map((s2) => s2.freed);
    const residual = cycles.series.map((s2) => s2.residual);

    chk(cycles.series.every((s2) => s2.added === s2.freed),
        'every cycle FREED EXACTLY what it ADDED — added ' + added.join('/') +
        ', freed ' + freed.join('/'));
    chk(residual.every((r) => r === 0),
        'every cycle returned the geometry counter to where it started — residual ' +
        residual.join('/'));
    chk(cycles.series.every((s2) => s2.texResidual === 0),
        'and the texture counter too — residual ' +
        cycles.series.map((s2) => s2.texResidual).join('/'));
    chk(cycles.endState.geom === cycles.base.geom && cycles.endState.tex === cycles.base.tex,
        'after five load/unload cycles the counters are exactly where they began (' +
        cycles.base.geom + '/' + cycles.base.tex + ' -> ' + cycles.endState.geom + '/' +
        cycles.endState.tex + ')');
    chk(added.every((a) => a === added[0]) && added[0] > 100,
        'and each cycle cost the same ' + added[0] + ' geometries — no source is accumulating');

    chk(cycles.stats.instantiated === cycles.stats.released,
        'every instance the library handed out was released (' + cycles.stats.instantiated +
        ' acquired, ' + cycles.stats.released + ' released)');
    chk(cycles.report.resident === 0 && cycles.report.pending === 0,
        'and the library holds nothing at the end (resident ' + cycles.report.resident +
        ', pending ' + cycles.report.pending + ')');

    // -------------------------------------------------------------------------------
    head('10. THE GAME IS STILL THE GAME');

    const post = await page.evaluate(() => ({
      running: window.game.running, chunks: window.game.world.chunks.size,
      hp: window.game.player.hp, dim: window.game.player.dimension,
      hud: getComputedStyle(document.getElementById('hud')).display,
    }));
    chk(post.running === true, 'the game is still running after all of that');
    chk(post.chunks > 0, 'the world is still streamed (' + post.chunks + ' chunks)');
    chk(post.hud !== 'none', 'and the HUD is still up');
    chk(errors.length === 0, 'the page raised no errors across the whole run');
    if (errors.length) errors.slice(0, 6).forEach((e) => note('ERROR ' + e));

    await page.close();
  } catch (e) {
    chk(false, 'the suite threw: ' + (e && e.message));
  } finally {
    await browser.close(); srv.close();
  }

  console.log('\n' + (fail ? 'FAILED — ' + fail + ' check(s)' : 'ALL CHECKS PASSED') +
              (WANT_DRIFT ? '' : '   [renderer: ' + (WANT_R186 ? 'r186 prepared' : 'r128 shipped') + ']'));
  process.exit(fail ? 1 : 0);
})();
