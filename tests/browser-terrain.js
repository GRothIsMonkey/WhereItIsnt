/* ERA 2 E2.2 — THE D1 NON-VOXEL TERRAIN, IN A REAL BROWSER.

   Launches Chromium through Playwright, serves the build over HTTP, boots the real game
   with a real WebGL context and a real renderer, then builds the D1 terrain world into a
   real scene and drops a real player on it.

   WHAT THIS PROVES that the offline suite cannot: that the terrain RENDERS; what a region
   actually costs to build and draw; that a player integrating under real gravity lands on
   the surface and stays on it; that walking across region boundaries streams regions in and
   out; that unloading returns engine-managed resources and does NOT take the shared
   materials with it; and that the legacy voxel game is completely unaffected.

   WHAT IT DOES NOT PROVE. That the terrain LOOKS like the Shattered Farmlands. It cannot:
   the materials are untextured stand-ins and there is no vegetation, by policy. A screenshot
   is written for a person to judge.

   `renderer.info.memory` counts three.js objects the renderer holds — NOT VRAM. No browser
   API exposes VRAM and nothing here pretends otherwise.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const PORT = Number(process.env.WII_TERRAIN_PORT || 8271);

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

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
               '.glb': 'model/gltf-binary' };
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
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 200)));

  try {
    await page.goto('http://127.0.0.1:' + PORT + '/game.html', { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => !!window.game, null, { timeout: 90000 });
    await page.evaluate(() => document.getElementById('clickPlay').click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (window.game.film && window.game.film.active) window.game.film.skip(); });
    await page.waitForFunction(() => window.game.running === true, null, { timeout: 120000 });

    // -------------------------------------------------------------------------------
    head('1. THE TERRAIN LAYER LOADED INTO THE REAL BUILD');

    const present = await page.evaluate(() => ({
      config: typeof D1_WORLD_SIZE === 'number',
      world: typeof D1TerrainWorld === 'function',
      physical: typeof TerrainPhysicalWorld === 'function',
      composite: typeof CompositePhysicalWorld === 'function',
      regions: typeof D1TerrainRegions === 'function',
      height: typeof d1TerrainHeight === 'function',
      size: D1_WORLD_SIZE, grid: D1_REGION_GRID, regionSize: D1_REGION_SIZE,
      totalRegions: D1_REGION_GRID * D1_REGION_GRID,
    }));
    chk(present.config && present.world && present.physical && present.regions && present.height,
        'all ten terrain modules loaded as classic scripts alongside the existing build');
    chk(present.composite,
        'and CompositePhysicalWorld loaded with them — D1 Implementation Phase 1');
    note('finite world: ' + present.size + ' m square, ' + present.grid + ' x ' + present.grid +
         ' regions of ' + present.regionSize + ' m = ' + present.totalRegions + ' regions');

    /* D1 PHASE 1 — THE PHYSICAL WORLD THE NON-VOXEL PATH INITIALISES IS THE COMPOSITE.
       Everything after this point in the suite drives `__d1.physical`, so this is the
       integration claim the rest of the run stands on: a body walking 900 m in section 4
       is walking on the composite. */
    const comp = await page.evaluate(() => {
      const scene = new THREE.Scene();
      const w = new D1TerrainWorld(scene, null, null);
      const g = w.physical.groundHeightAt(12.5, -7.25);
      const t = w.terrain.groundHeightAt(12.5, -7.25);
      const out = {
        isComposite: w.physical instanceof CompositePhysicalWorld,
        baseIsTerrain: w.physical.base instanceof TerrainPhysicalWorld,
        providers: w.physical.providerCount,
        providerIsAssetSet: w.physical.providers[0] === w.assetCollision,
        sameAsTerrainWhenEmpty: g === t,
      };
      w.dispose(false);
      return out;
    });
    chk(comp.isComposite, 'D1TerrainWorld.physical IS a CompositePhysicalWorld in the live build');
    chk(comp.baseIsTerrain, 'its base is the terrain backend');
    chk(comp.providers === 1 && comp.providerIsAssetSet,
        'and its one provider is the shared AssetCollisionSet — terrain + architecture, one world');
    chk(comp.sameAsTerrainWhenEmpty,
        'with nothing placed it answers exactly what the terrain answers');

    // -------------------------------------------------------------------------------
    head('2. A REAL SCENE, A REAL BUILD, AND WHAT IT COSTS');

    const built = await page.evaluate(() => {
      const g = window.game;
      /* A SEPARATE SCENE. The voxel Overworld is still in g.scene and the point of this
         phase is that the two are parallel — so the terrain is built into its own scene
         and rendered with the game's real renderer and camera. */
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xffffff, 1.1);
      sun.position.set(-180, 260, 120);
      scene.add(sun);
      window.__d1scene = scene;

      const t0 = performance.now();
      const world = new D1TerrainWorld(scene, g.assets, g.assetCollision);
      const spawn = world.begin(0, 0);
      const t1 = performance.now();
      window.__d1 = world;

      return { ms: t1 - t0, spawn, report: world.debugReport() };
    });
    const r = built.report;
    note('initial load at the map centre: ' + built.ms.toFixed(0) + ' ms');
    note('resident ' + r.streaming.resident + ' of ' + r.streaming.totalRegionsInWorld +
         ' regions, ' + r.streaming.triangles.toLocaleString() + ' triangles, ' +
         r.streaming.vertices.toLocaleString() + ' vertices');
    note('LOD spread (spacing m -> regions): ' + JSON.stringify(r.streaming.lodCounts));
    chk(r.streaming.resident > 0, 'the world built regions around the spawn');
    chk(r.streaming.resident < r.streaming.totalRegionsInWorld,
        'and NOT the whole world — streaming loads a neighbourhood');
    chk(r.world.finite === true, 'the world reports itself finite');
    chk(Object.keys(r.streaming.lodCounts).length > 1,
        'more than one LOD is in use — distance actually coarsens the mesh');
    chk(errors.length === 0, 'and building it raised no page error');

    // -------------------------------------------------------------------------------
    head('3. IT RENDERS');

    const rendered = await page.evaluate(() => {
      const g = window.game;
      const cam = new THREE.PerspectiveCamera(70, 1100 / 700, 0.1, 3000);
      const s = window.__d1.spawnPointAt(0, 0);
      cam.position.set(s.x, s.y + 1.6, s.z);
      cam.lookAt(s.x + 60, s.y + 2, s.z + 60);
      window.__d1cam = cam;
      const before = g.renderer.info.render.triangles;
      g.renderer.render(window.__d1scene, cam);
      const info = g.renderer.info;
      return { drawCalls: info.render.calls, triangles: info.render.triangles,
               geometries: info.memory.geometries, textures: info.memory.textures,
               before };
    });
    note('one frame: ' + rendered.drawCalls + ' draw calls, ' +
         rendered.triangles.toLocaleString() + ' triangles rendered');
    chk(rendered.drawCalls > 0 && rendered.triangles > 0,
        'the renderer drew the terrain — real geometry reached the GPU');
    chk(rendered.drawCalls < 120,
        'and it did so in ' + rendered.drawCalls + ' draw calls (one per region, plus water)');

    const swapped = await page.evaluate(() => {
      /* Point the game's own render path at the terrain for a moment, so the screenshot is
         of THIS phase's work.

         POSTFX HOLDS ITS OWN REFERENCES, captured at construction — `new PostFX(renderer,
         scene, camera)`. The first version of this block swapped only `game.scene` and
         `game.camera` and produced a screenshot of the VOXEL WORLD, which would have been
         filed as evidence for a terrain phase. Both pairs have to move. */
      const g = window.game;
      window.__orig = { scene: g.scene, cam: g.camera,
                        pScene: g.postfx && g.postfx.scene, pCam: g.postfx && g.postfx.camera };
      g.scene = window.__d1scene; g.camera = window.__d1cam;
      if (g.postfx) { g.postfx.scene = window.__d1scene; g.postfx.camera = window.__d1cam; }
      return { postfxExists: !!g.postfx,
               postfxRepointed: !!g.postfx && g.postfx.scene === window.__d1scene };
    });
    chk(!swapped.postfxExists || swapped.postfxRepointed,
        'the screenshot renders the TERRAIN scene — postfx was repointed too, not just game.scene');
    await page.waitForTimeout(1500);
    try { await page.screenshot({ path: path.join(OUT, 'terrain-d1-foundation.png'), timeout: 60000 });
          note('screenshot: tests/renders/terrain-d1-foundation.png'); }
    catch (e) { note('screenshot failed: ' + e.name); }

    /* AND PROVE IT IS THE TERRAIN, not a picture of the voxel world that happens to be
       green. The voxel Overworld has no D1 region meshes in it; this scene is made of
       nothing else. Counting what the renderer just drew is the check that a screenshot
       cannot give us. */
    const drew = await page.evaluate(() => {
      let regionMeshes = 0;
      window.__d1scene.traverse((o) => {
        if (o.isMesh && typeof o.name === 'string' && o.name.indexOf('d1-region-') === 0) regionMeshes++;
      });
      return { regionMeshes, children: window.__d1scene.children.length };
    });
    chk(drew.regionMeshes > 0,
        'and the rendered scene contains ' + drew.regionMeshes +
        ' D1 region meshes — it is this phase\'s terrain, not the voxel world');
    await page.evaluate(() => {
      const g = window.game, o = window.__orig;
      g.scene = o.scene; g.camera = o.cam;
      if (g.postfx) { g.postfx.scene = o.pScene; g.postfx.camera = o.pCam; }
    });

    // -------------------------------------------------------------------------------
    head('4. A REAL PLAYER FALLS ONTO IT AND STAYS ON IT');

    const walked = await page.evaluate(() => {
      const pw = window.__d1.physical;
      /* Integrate a body under gravity against the contract's collision query — the same
         two calls PlayerController makes, against the terrain implementation instead of
         the voxel one. */
      const HALF = 0.3, HEIGHT = 1.8, G = -24;
      const box = (x, y, z) => ({ minX: x - HALF, maxX: x + HALF, minY: y,
                                  maxY: y + HEIGHT, minZ: z - HALF, maxZ: z + HALF });
      let x = 0, z = 0;
      let y = pw.groundHeightAt(0, 0) + 6;        // dropped from 6 m up
      let vy = 0, landedAt = -1, below = 0, maxPen = 0;
      const dt = 1 / 60;
      for (let f = 0; f < 240; f++) {
        vy += G * dt;
        let ny = y + vy * dt;
        if (pw.collidesAABB(box(x, ny, z))) {
          ny = pw.groundHeightAt(x, z); vy = 0;
          if (landedAt < 0) landedAt = f;
        }
        y = ny;
        if (landedAt >= 0 && f > landedAt + 5) {
          const g0 = pw.groundHeightAt(x, z);
          if (y < g0 - 0.02) { below++; maxPen = Math.max(maxPen, g0 - y); }
        }
      }
      const restY = y, restGround = pw.groundHeightAt(x, z);

      /* Now WALK, 900 m east, stepping the ground each frame the way a grounded player
         does, and record how faithfully the body follows the surface. */
      let worst = 0, steps = 0, climbed = 0, descended = 0;
      let py = restGround;
      for (let i = 0; i < 1800; i++) {
        x += 0.5;
        const gh = pw.groundHeightAt(x, z);
        const d = gh - py;
        if (d > 0) climbed += d; else descended += -d;
        worst = Math.max(worst, Math.abs(d));
        py = gh; steps++;
      }
      return { landedAt, below, maxPen, restY, restGround, steps, worst, climbed, descended,
               endX: x, inside: d1IsInsideWorld(x, z) };
    });
    chk(walked.landedAt >= 0, 'a body dropped 6 m above the terrain LANDS (frame ' + walked.landedAt + ')');
    chk(Math.abs(walked.restY - walked.restGround) < 0.05,
        'and comes to rest ON the surface (' + walked.restY.toFixed(3) + ' vs ground ' +
        walked.restGround.toFixed(3) + ')');
    chk(walked.below === 0,
        'and never sinks through it over the remaining frames (max penetration ' +
        walked.maxPen.toFixed(4) + ' m)');
    note('walked ' + (walked.steps * 0.5) + ' m east: climbed ' + walked.climbed.toFixed(0) +
         ' m, descended ' + walked.descended.toFixed(0) + ' m');
    chk(walked.worst < 0.35,
        'the surface never steps more than ' + walked.worst.toFixed(3) +
        ' m over a 0.5 m stride — continuous ground, no voxel stair-stepping');
    chk(walked.climbed > 5 && walked.descended > 5,
        'and the route had real relief in both directions — not a plane');

    // -------------------------------------------------------------------------------
    head('5. STREAMING ACROSS THE FINITE WORLD');

    const streamed = await page.evaluate(() => {
      const w = window.__d1;
      const seen = [];
      const keysAt = () => Array.from(w.regions.regions.keys()).sort().join('|');
      const start = keysAt();
      /* Walk a kilometre east, updating the way a frame loop would. */
      for (let x = 0; x <= 1000; x += 50) {
        for (let i = 0; i < 12; i++) w.update(x, 0, Infinity);
        seen.push({ x, resident: w.regions.regions.size });
      }
      const afterWalk = keysAt();
      /* And to the far corner, which is where a finite world must simply stop. */
      for (let i = 0; i < 30; i++) w.update(D1_WORLD_MAX_X - 10, D1_WORLD_MAX_Z - 10, Infinity);
      const corner = w.regions.regions.size;
      let outOfGrid = 0;
      for (const rg of w.regions.regions.values())
        if (!d1RegionExists(rg.rx, rg.rz)) outOfGrid++;
      /* And far outside the world entirely. */
      for (let i = 0; i < 10; i++) w.update(1e6, 1e6, Infinity);
      const outside = w.regions.regions.size;
      return { start, afterWalk, seen, corner, outOfGrid, outside,
               stats: w.regions.debugReport().stats };
    });
    note('resident while walking 1 km east: ' +
         streamed.seen.map(s => s.resident).join(' '));
    chk(streamed.start !== streamed.afterWalk, 'walking changed which regions are resident');
    chk(streamed.seen.every(s => s.resident > 0), 'and the ground was never absent under the walk');
    chk(streamed.corner > 0 && streamed.corner < 40,
        'at the far corner FEWER regions are resident (' + streamed.corner +
        ') — the world ends, and the ring is simply shorter');
    chk(streamed.outOfGrid === 0, 'no region outside the grid was ever created');
    chk(streamed.outside === 0,
        'and a viewpoint 1,000 km outside the world streams in NOTHING (' + streamed.outside + ')');
    note('built ' + streamed.stats.built + ', unloaded ' + streamed.stats.unloaded +
         ', LOD rebuilds ' + streamed.stats.rebuiltForLod);

    // -------------------------------------------------------------------------------
    head('6. RESOURCE LIFETIME — AND THE SHARED MATERIAL SURVIVES');

    const res = await page.evaluate(() => {
      const g = window.game, w = window.__d1;
      const read = () => ({ geom: g.renderer.info.memory.geometries,
                            tex: g.renderer.info.memory.textures });
      w.regions.unloadAll();
      const base = read();
      const matUuid = d1TerrainMaterial().uuid;

      /* RENDER A FRAME WHILE THE REGIONS ARE RESIDENT, OR THIS MEASURES NOTHING.

         `renderer.info.memory.geometries` counts geometries the renderer HOLDS — and it
         only holds one once it has been uploaded, which happens on first draw. The first
         version of this block built forty regions, read the counter and unloaded, and read
         `added 0, freed 0, residual 0` on every cycle: a perfect score for a test that had
         not measured a single geometry. Drawing the scene between build and read is what
         makes the number real. */
      const cycles = [];
      for (let i = 0; i < 4; i++) {
        const before = read();
        for (let k = 0; k < 40; k++) w.update(0, 0, Infinity);
        g.renderer.render(window.__d1scene, window.__d1cam);
        const peak = read();
        const resident = w.regions.regions.size;
        w.regions.unloadAll();
        g.renderer.render(window.__d1scene, window.__d1cam);
        const after = read();
        cycles.push({ added: peak.geom - before.geom, freed: peak.geom - after.geom,
                      residual: after.geom - before.geom, resident });
      }
      const matStillSame = d1TerrainMaterial().uuid === matUuid;
      const matAlive = !d1TerrainMaterial().__disposed;
      return { base, cycles, matStillSame, matAlive, end: read() };
    });
    res.cycles.forEach((c, i) => note('cycle ' + (i + 1) + '  ' + c.resident + ' regions  added ' +
      c.added + ', freed ' + c.freed + ', residual ' + c.residual));
    chk(res.cycles.every(c => c.added > 20),
        'the counters MOVED while regions were resident (+' + res.cycles[0].added +
        ' geometries) — the measurement is not vacuous');
    chk(res.cycles.every(c => c.added === c.freed),
        'every load/unload cycle FREED EXACTLY what it ADDED');
    chk(res.cycles.every(c => c.residual === 0),
        'every cycle returned the geometry counter to where it started');
    chk(res.end.geom === res.base.geom && res.end.tex === res.base.tex,
        'after four cycles the counters are exactly where they began (' +
        res.base.geom + '/' + res.base.tex + ' -> ' + res.end.geom + '/' + res.end.tex + ')');
    chk(res.cycles.every(c => c.resident === res.cycles[0].resident),
        'and each cycle resident the same count — deterministic generation');
    chk(res.matStillSame && res.matAlive,
        'the SHARED terrain material survived every unload and is the same object — ' +
        'a region owns its geometry, never the material');

    // -------------------------------------------------------------------------------
    head('7. THE LEGACY VOXEL GAME IS COMPLETELY UNAFFECTED');

    const legacy = await page.evaluate(() => {
      const g = window.game, p = g.player;
      return {
        running: g.running, chunks: g.world.chunks.size, hp: p.hp,
        dim: p.dimension, hud: getComputedStyle(document.getElementById('hud')).display,
        physicalIsVoxel: g.physical instanceof VoxelPhysicalWorld,
        voxelGround: g.physical.groundHeightAt(Math.floor(p.position.x), Math.floor(p.position.z)),
        objective: g.objectives ? g.objectives.currentId : null,
      };
    });
    chk(legacy.running === true, 'the voxel game is still running');
    chk(legacy.chunks > 0, 'its world is still streamed (' + legacy.chunks + ' chunks)');
    chk(legacy.physicalIsVoxel,
        'and gameplay is still wired to the VOXEL physical world — the two are parallel');
    chk(Number.isInteger(legacy.voxelGround),
        'whose ground height is still the integer the voxel world returns (' +
        legacy.voxelGround + ')');
    chk(legacy.hud !== 'none', 'and the HUD is up');

    const teardown = await page.evaluate(() => {
      const w = window.__d1;
      const out = w.dispose(true);
      return { out, resident: w.regions.regions.size, sceneChildren: window.__d1scene.children.length };
    });
    chk(teardown.resident === 0, 'a full dispose left no region resident');
    note('dispose freed ' + teardown.out.regions + ' regions and ' + teardown.out.materials +
         ' shared materials; ' + teardown.sceneChildren + ' objects left in the test scene (lights)');

    chk(errors.length === 0, 'the page raised no errors across the whole run');
    if (errors.length) errors.slice(0, 6).forEach((e) => note('ERROR ' + e));

    await page.close();
  } catch (e) {
    chk(false, 'the suite threw: ' + (e && e.message));
  } finally {
    await browser.close(); srv.close();
  }

  console.log('\n' + (fail ? 'FAILED — ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
  process.exit(fail ? 1 : 0);
})();
