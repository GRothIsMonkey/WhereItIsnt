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

   D1 PHASE 4 ADDED section 9b: the same claims for the first PRODUCTION asset,
   `prop.rural-fence-post-01` — colour spaces, the packed metallic/roughness map, the normal
   map and its scale in the running loader's convention, the shadow policy — and its cache,
   clone, reference-count and disposal lifecycle measured against `renderer.info.memory`.
   Its placement in a representative D1 scene is `tests/browser-asset-scene.js`.

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
    head('9b. D1 PHASE 4 — THE FIRST PRODUCTION ASSET THROUGH THE SAME PIPELINE');

    const FENCE = 'prop.rural-fence-post-01';
    const fm = await page.evaluate(async (KEY) => {
      const g = window.game;
      const req0 = g.assets.stats.requested;
      /* Two concurrent calls must share ONE fetch, and a third after it lands must be a cache
         hit that returns the very same source record. */
      const [a, b] = await Promise.all([g.assets.load(KEY), g.assets.load(KEY)]);
      const c = await g.assets.load(KEY);
      if (!a) return { error: Array.from(g.assets.failed.entries()).map((e) => e.join(': ')).join('; ') };
      const src = a;
      /* Read a texture's channels back through a 2D canvas, so "the timber is not metal" is a
         measurement of the decoded pixels rather than an assumption about the author. */
      const channelMeans = (tex) => {
        const img = tex && tex.image;
        if (!img || !img.width) return null;
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        const d = cx.getImageData(0, 0, img.width, img.height).data;
        let r = 0, gg = 0, bb = 0; const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
        return [r / n / 255, gg / n / 255, bb / n / 255];
      };
      const cs = (t) => t ? String(t.colorSpace !== undefined ? t.colorSpace : t.encoding) : null;
      const mats = [];
      src.root.traverse((n) => {
        if (!n.isMesh) return;
        const m = n.material;
        mats.push({
          node: n.name, type: m.type, name: m.name,
          cast: n.castShadow, receive: n.receiveShadow,
          side: m.side, doubleSide: m.side === THREE.DoubleSide,
          metalness: m.metalness, roughness: m.roughness,
          map: cs(m.map), normal: cs(m.normalMap), rough: cs(m.roughnessMap), metal: cs(m.metalnessMap),
          packedMR: !!m.roughnessMap && m.roughnessMap === m.metalnessMap,
          normalScale: m.normalMap ? [m.normalScale.x, m.normalScale.y] : null,
          hasTangents: !!(n.geometry && n.geometry.attributes && n.geometry.attributes.tangent),
          aniso: [m.map, m.normalMap, m.roughnessMap].filter(Boolean).map((t) => t.anisotropy),
          flipY: [m.map, m.normalMap, m.roughnessMap].filter(Boolean).map((t) => t.flipY),
          mr: channelMeans(m.roughnessMap),
          base: channelMeans(m.map),
        });
      });
      return { same: a === b && b === c, requested: g.assets.stats.requested - req0,
               report: src.report, mats, rev: Number(THREE.REVISION),
               srgb: String(THREE.SRGBColorSpace !== undefined ? THREE.SRGBColorSpace : THREE.sRGBEncoding),
               linear: String(THREE.LinearSRGBColorSpace !== undefined ? THREE.LinearSRGBColorSpace : THREE.LinearEncoding),
               policyAniso: ASSET_MATERIAL_POLICY.anisotropy };
    }, FENCE);
    if (fm.error) { chk(false, 'the production fence failed to load: ' + fm.error); }
    else {
      chk(fm.same && fm.requested === 1,
          'two concurrent loads and one later load returned ONE source for ONE request (' + fm.requested + ')');
      chk(fm.mats.length === 2 && fm.mats.every((m) => m.type === 'MeshStandardMaterial'),
          'two meshes, both MeshStandardMaterial — glTF metallic-roughness PBR, as authored');
      chk(fm.report.materialsBefore === 2 && fm.report.materialsAfter === 2 && fm.report.deduped === 0,
          'normalisation kept both materials — two genuinely different surfaces, nothing to collapse');
      const wood = fm.mats.find((m) => /timber/.test(m.name)), steel = fm.mats.find((m) => /steel/.test(m.name));
      chk(!!wood && !!steel, 'the materials are the authored MAT_weathered_timber and MAT_galvanized_steel');
      if (wood && steel) {
        for (const m of [wood, steel]) {
          note(m.name + ': base ' + (m.base ? m.base.map((v) => v.toFixed(3)).join('/') : '-') +
               ', MR map mean R/G/B ' + (m.mr ? m.mr.map((v) => v.toFixed(3)).join('/') : '-') +
               ', metalness x' + m.metalness + ', roughness x' + m.roughness +
               (m.normalScale ? ', normalScale ' + m.normalScale.map((v) => v.toFixed(3)).join(',') : ''));
        }
        chk([wood, steel].every((m) => m.map === fm.srgb),
            'both base-colour maps are sRGB — authored colour ("' + fm.srgb + '")');
        /* r128 labels a data map LinearEncoding; r152+ labels it NoColorSpace (''). Both mean
           "not decoded as colour", which is the claim; neither may be sRGB. */
        const isData = (v) => v !== null && v !== fm.srgb && (v === fm.linear || v === '');
        chk([wood, steel].every((m) => isData(m.rough) && isData(m.metal)) && isData(wood.normal),
            'the metallic-roughness maps and the normal map are DATA, never sRGB-decoded (' +
            JSON.stringify(wood.rough) + ', normal ' + JSON.stringify(wood.normal) + ')');
        chk([wood, steel].every((m) => m.packedMR),
            'metalness and roughness read ONE packed map (glTF: G = roughness, B = metalness), not two');
        chk(wood.mr && wood.mr[2] < 0.02 && steel.mr && steel.mr[2] > 0.3,
            'decoded metal channel: timber ' + (wood.mr ? wood.mr[2].toFixed(3) : '?') + ' (not metal), steel ' +
            (steel.mr ? steel.mr[2].toFixed(3) : '?') + ' (metal) — the map drives it, the factor is 1');
        chk(wood.normal !== null && steel.normal === null,
            'the timber keeps its normal map through the pipeline; the steel was authored without one');
        /* THE Y SIGN IS THE LOADER'S, AND IT DEPENDS ON TANGENTS, NOT ON THE VERSION. glTF
           normal maps are +Y-up in a UV space whose V runs the other way to three.js's; with
           no TANGENT attribute three builds the tangent frame from screen derivatives, and
           both r128 and r186 compensate by storing normalScale.y NEGATED (r128 starts at
           (1,-1); r186 starts at (1,1) and flips it for derivative tangents). The export has
           no tangents, so the correct value is (0.7, -0.7) on both — anything else would be a
           flipped normal map. */
        const ns = wood.normalScale || [0, 0];
        const want = wood.hasTangents ? 1 : -1;
        chk(Math.abs(Math.abs(ns[0]) - 0.7) < 1e-6 && Math.abs(ns[1] - want * Math.abs(ns[0])) < 1e-6 && ns[0] > 0,
            'normalScale is the authored 0.7 with the Y sign the loader requires for ' +
            (wood.hasTangents ? 'vertex' : 'derivative') + ' tangents (r' + fm.rev + ': ' +
            ns.map((v) => v.toFixed(3)).join(', ') + ') — not flipped, not rescaled');
        chk([wood, steel].every((m) => m.flipY.every((f) => f === false)),
            'every map keeps glTF\'s flipY = false — no texture was re-oriented on the way in');
        chk([wood, steel].every((m) => m.aniso.every((a) => a === fm.policyAniso)),
            'anisotropy is the asset policy\'s ' + fm.policyAniso + ' on every map');
        chk([wood, steel].every((m) => m.cast && m.receive),
            'both meshes cast and receive shadows, per ASSET_MATERIAL_POLICY');
        chk([wood, steel].every((m) => m.doubleSide),
            'both are double-sided, as the approved export declares — nothing culled a thin strap face');
      }
    }

    const life = await page.evaluate(async (KEY) => {
      const g = window.game;
      const read = () => ({ geom: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures });
      const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const origUpdate = g.world.updateChunks;
      const out = {};
      try {
        /* Same control as section 9: freeze the only other producer of geometries. */
        g.world.updateChunks = function () {};
        await settle();
        out.base = read();
        const src = g.assets.sources.get(KEY);
        const insts = [];
        for (let i = 0; i < 3; i++) {
          const inst = await g.assets.acquire(KEY);
          inst.position.set(g.player.position.x + 2 + i * 2, g.player.position.y, g.player.position.z + 3);
          inst.rotation.y = i * 0.7;
          g.scene.add(inst); insts.push(inst);
        }
        await settle();
        out.peak = read();
        out.refs3 = src.refs;
        const srcRes = collectAssetResources(src.root);
        out.shared = insts.every((inst) => {
          const r = collectAssetResources(inst);
          return [...r.geometries].every((x) => srcRes.geometries.has(x)) &&
                 [...r.materials].every((x) => srcRes.materials.has(x)) &&
                 [...r.textures].every((x) => srcRes.textures.has(x));
        });
        out.distinctNodes = insts[0] !== insts[1] && insts[0].children[0] !== insts[1].children[0];
        out.ownTransforms = Math.abs(insts[1].rotation.y - 0.7) < 1e-9 && src.root.rotation.y === 0;
        out.srcCounts = { g: srcRes.geometries.size, m: srcRes.materials.size, t: srcRes.textures.size };

        g.assets.release(insts[0]);
        out.refs2 = src.refs; out.resident2 = g.assets.isLoaded(KEY);
        out.survivorDrawable = insts[1].children.every((n) => !n.isMesh || !!n.geometry.attributes.position);
        out.releasedTwice = g.assets.release(insts[0]);
        out.refsAfterDouble = src.refs;
        g.assets.release(insts[1]); g.assets.release(insts[2]);
        await settle();
        out.after = read();
        out.resident0 = g.assets.isLoaded(KEY);
        out.inScene = insts.filter((i) => i.parent).length;

        /* A disposed asset is not failed: the next acquire is a fresh load, and it works. */
        const again = await g.assets.acquire(KEY);
        out.reloaded = !!again && g.assets.isLoaded(KEY) && !g.assets.isFailed(KEY);
        g.assets.release(again);
        await settle();
        out.end = read();
      } finally {
        g.world.updateChunks = origUpdate;
      }
      return out;
    }, FENCE);
    note('fence source owns ' + life.srcCounts.g + ' geometries, ' + life.srcCounts.m + ' materials, ' +
         life.srcCounts.t + ' textures');
    note('renderer.info geometries/textures: ' + life.base.geom + '/' + life.base.tex + ' -> three instances ' +
         life.peak.geom + '/' + life.peak.tex + ' -> released ' + life.after.geom + '/' + life.after.tex +
         ' -> reload+release ' + life.end.geom + '/' + life.end.tex);
    chk(life.refs3 === 3 && life.shared,
        'three placed clones -> refcount 3, and every clone SHARES the source geometry, materials and textures');
    chk(life.peak.geom - life.base.geom === life.srcCounts.g && life.peak.tex - life.base.tex === life.srcCounts.t,
        'three instances cost ONE upload: +' + (life.peak.geom - life.base.geom) + ' geometries, +' +
        (life.peak.tex - life.base.tex) + ' textures, not three times that');
    chk(life.distinctNodes && life.ownTransforms,
        'yet each clone is its own node with its own transform — the source itself never moved');
    chk(life.refs2 === 2 && life.resident2 && life.survivorDrawable,
        'releasing one leaves refcount 2, the source resident and the survivors drawable');
    chk(life.releasedTwice === false && life.refsAfterDouble === 2,
        'releasing the same instance twice is a no-op — no double decrement into an early disposal');
    chk(life.resident0 === false && life.inScene === 0,
        'the last release disposed the source and detached every instance from the scene');
    chk(life.after.geom === life.base.geom && life.after.tex === life.base.tex,
        'and renderer.info is back EXACTLY where it began — no residual geometry or texture');
    chk(life.reloaded && life.end.geom === life.base.geom && life.end.tex === life.base.tex,
        'a disposed asset reloads cleanly on the next acquire, and that cycle leaves no residue either');

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
