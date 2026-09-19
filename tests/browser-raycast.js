/* D1 IMPLEMENTATION PHASE 2 — THE NORMALIZED RAYCAST, IN A REAL BROWSER.

   Launches Chromium through Playwright, serves the build over HTTP, boots the real game
   with a real WebGL context, and then asks the LIVE physical world what is along a ray —
   over the shipped voxel Overworld, over the real streamed D1 terrain, and against a real
   GLB loaded through the real asset library.

   WHAT THIS PROVES that the offline suite cannot: that the Phase 2 modules actually LOAD in
   the shipped page as classic scripts; that `raycast` is reachable on the physical world the
   running game holds; that the voxel adapter agrees with the DDA the game still uses for
   mining; that a real asset's declared proxy is what gets hit, at the real streamed terrain's
   real height; and that adding an interaction vocabulary added NOTHING to the document.

   WHAT IT DOES NOT PROVE. That aiming at anything feels right, or that any of this is fun.
   No interaction target, no prompt, no verb and no D1 content exists yet — this phase
   deliberately authors none. A person still has to play it (PLAYTEST.md).

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const PORT = Number(process.env.WII_RAYCAST_PORT || 8275);

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

    /* THE DOCUMENT AS IT STANDS BEFORE ANY OF THIS PHASE'S WORK IS EXERCISED. Section 6
       compares against it: an interaction VOCABULARY must add no interaction UI. */
    const domBefore = await page.evaluate(() => ({
      nodes: document.querySelectorAll('*').length,
      ids: Array.from(document.querySelectorAll('[id]')).map((e) => e.id).sort().join(','),
    }));

    await page.evaluate(() => document.getElementById('clickPlay').click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (window.game.film && window.game.film.active) window.game.film.skip(); });
    await page.waitForFunction(() => window.game.running === true, null, { timeout: 120000 });

    // -------------------------------------------------------------------------------
    head('1. THE PHASE 2 MODULES LOADED INTO THE SHIPPED PAGE');

    const present = await page.evaluate(() => ({
      miss: typeof RAYCAST_MISS,
      categories: typeof RAYCAST_CATEGORY === 'object' ? Object.keys(RAYCAST_CATEGORY).length : -1,
      rank: typeof RAYCAST_CATEGORY_RANK === 'object',
      make: typeof makeRayHit === 'function',
      slab: typeof rayAabbDistance === 'function',
      beats: typeof rayHitBeats === 'function',
      normalized: typeof rayIsNormalized === 'function',
      affordances: typeof INTERACTION_AFFORDANCES !== 'undefined' ? INTERACTION_AFFORDANCES.slice() : null,
      registry: typeof InteractionRegistry === 'function',
      resolve: typeof resolveInteraction === 'function',
      onComposite: typeof CompositePhysicalWorld.prototype.raycast === 'function',
      onVoxel: typeof VoxelPhysicalWorld.prototype.raycast === 'function',
      onTerrain: typeof TerrainPhysicalWorld.prototype.raycast === 'function',
      onAssets: typeof AssetCollisionSet.prototype.raycast === 'function',
    }));
    chk(present.miss === 'object' && present.categories === 2 && present.rank && present.make &&
        present.slab && present.beats && present.normalized,
        'src/world/raycast.js loaded as a classic script — the hit vocabulary is live');
    chk(present.registry && present.resolve &&
        present.affordances && present.affordances.join(',') === 'none,inspect,use',
        'src/gameplay/interaction.js loaded, with exactly three affordances');
    chk(present.onComposite && present.onVoxel && present.onTerrain && present.onAssets,
        'all four backends implement the SAME normalized raycast in the live build');
    chk(errors.length === 0, 'and loading two more scripts raised no page error');

    // -------------------------------------------------------------------------------
    head('2. THE SHIPPED VOXEL WORLD ANSWERS IT — AND STILL MINES THE OLD WAY');

    /* THE CLAIM THIS PHASE STANDS ON. The voxel adapter and `voxelRaycast` are asked the
       SAME question, live, in the running game, and must agree about what was struck. If
       they disagree, gameplay and the new query are looking at two different worlds. */
    const vox = await page.evaluate(() => {
      const g = window.game;
      const eye = { x: g.camera.position.x, y: g.camera.position.y, z: g.camera.position.z };
      const dir = { x: 0, y: -1, z: 0 };
      const dda = voxelRaycast(g.world, eye, dir, 20);
      const norm = g.physical.raycast(eye, dir, 20);
      if (!dda || !norm) return { dda, norm };
      return {
        dda: { bx: dda.bx, by: dda.by, bz: dda.bz, face: dda.face },
        norm: { distance: norm.distance, point: norm.point, normal: norm.normal,
                category: norm.category, ref: norm.ref },
        insideCell: Math.floor(norm.point.x) === dda.bx && Math.floor(norm.point.z) === dda.bz &&
                    norm.point.y >= dda.by - 1e-4 && norm.point.y <= dda.by + 1 + 1e-4,
        pointIsPlain: norm.point && !norm.point.isVector3 && Object.keys(norm.point).length === 3,
      };
    });
    chk(vox.dda && typeof vox.dda.bx === 'number' && Array.isArray(vox.dda.face),
        'voxelRaycast still returns { bx, by, bz, face } in the live game — its type was NOT changed');
    chk(!!vox.norm && typeof vox.norm.distance === 'number',
        'and game.physical.raycast answers the same ray with a normalized hit');
    chk(vox.insideCell === true,
        'the normalized point lands inside the very cell the DDA reported — the two agree');
    chk(vox.norm && vox.norm.category === 'terrain' && vox.norm.normal && vox.norm.normal.y === 1,
        'categorised as terrain, with the exact block face the DDA resolved');
    chk(vox.pointIsPlain === true,
        'the hit point is a plain {x,y,z} — no THREE.Vector3 crossed the seam');
    note('ground under the player: cell (' + vox.dda.bx + ',' + vox.dda.by + ',' + vox.dda.bz +
         ') at ' + vox.norm.distance.toFixed(3) + ' m');

    /* A MISS IS null IN THE LIVE BUILD TOO — not a falsy-trap object. */
    const upMiss = await page.evaluate(() => {
      const g = window.game;
      const eye = { x: g.camera.position.x, y: g.camera.position.y + 40, z: g.camera.position.z };
      return g.physical.raycast(eye, { x: 0, y: 1, z: 0 }, 30);
    });
    chk(upMiss === null, 'a ray into open sky returns the contract miss — null, live');

    // -------------------------------------------------------------------------------
    head('3. THE REAL D1 TERRAIN, STREAMED, RAYCAST');

    const terr = await page.evaluate(() => {
      const g = window.game;
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xffffff, 1.1);
      sun.position.set(-180, 260, 120); scene.add(sun);
      window.__d1scene = scene;
      const w = new D1TerrainWorld(scene, g.assets, new AssetCollisionSet());
      w.begin(0, 0);
      window.__d1 = w;

      const X = 18.5, Z = -11.25;
      const ground = w.terrain.groundHeightAt(X, Z);
      const hit = w.physical.raycast({ x: X, y: ground + 60, z: Z }, { x: 0, y: -1, z: 0 }, 200);
      /* An oblique ray, because a vertical one cannot catch a march that is wrong about
         the horizontal step. */
      const k = 1 / Math.sqrt(3);
      const obl = w.physical.raycast({ x: X - 40, y: ground + 45, z: Z - 40 },
                                     { x: k, y: -k, z: k }, 200);
      const oblGround = obl ? w.terrain.groundHeightAt(obl.point.x, obl.point.z) : null;
      return {
        ground, hit, obl, oblGround,
        resident: w.debugReport().streaming.resident,
        composite: w.physical instanceof CompositePhysicalWorld,
      };
    });
    chk(terr.composite, 'the D1 world gameplay sees is the composite, and it answers rays');
    note(terr.resident + ' regions resident; ground at the probe column ' + terr.ground.toFixed(3) + ' m');
    chk(!!terr.hit && terr.hit.category === 'terrain', 'a ray dropped on the streamed terrain hits it');
    chk(!!terr.hit && Math.abs((terr.hit.point.y) - terr.ground) < 0.05,
        'and lands on the surface groundHeightAt reports (' +
        (terr.hit ? terr.hit.point.y.toFixed(3) : '-') + ' vs ' + terr.ground.toFixed(3) + ')');
    chk(!!terr.hit && terr.hit.normal && terr.hit.normal.y > 0.5,
        'with an upward surface normal from the analytic gradient');
    chk(!!terr.obl && terr.oblGround !== null && Math.abs(terr.obl.point.y - terr.oblGround) < 0.1,
        'an OBLIQUE ray lands on the surface too (' +
        (terr.obl ? terr.obl.point.y.toFixed(3) : '-') + ' vs ' +
        (terr.oblGround === null ? '-' : terr.oblGround.toFixed(3)) + ') — the march steps in 3D, not down a column');

    // -------------------------------------------------------------------------------
    head('4. A REAL GLB, THROUGH ITS DECLARED PROXY');

    const asset = await page.evaluate(async () => {
      const g = window.game, w = window.__d1;
      const src = await g.assets.load('prop.road-signs');
      if (!src) return null;
      const inst = await g.assets.acquire('prop.road-signs');
      if (!inst) return null;

      const X = 18.5, Z = -11.25;
      const ground = w.terrain.groundHeightAt(X, Z);
      /* SIT IT ON THE GROUND. This validation asset's origin is inside its own volume and
         E2.0a normalises nothing — `normalize: null`, native scale REPORTED rather than
         guessed at — so placing it at `y = ground` buries most of it and the picture in
         section 6 showed markers hovering over an invisible object. Offsetting by the
         asset's own measured minimum is what a placement system will do, and it costs this
         test nothing. */
      inst.position.set(X, ground - src.bounds.min[1], Z);
      inst.updateMatrixWorld(true);
      window.__d1scene.add(inst);
      window.__inst = inst;

      const boxes = w.assetCollision.add(inst, src);
      const e = w.assetCollision.entries[0];
      const b = e ? e.boxes[0] : null;

      const O = { x: X, y: ground + 60, z: Z }, DOWN = { x: 0, y: -1, z: 0 };
      const hit = w.physical.raycast(O, DOWN, 200);

      /* A REAL three.js raycaster over the instance's TRIANGLES, for comparison only. The
         physical answer must come from the DECLARED BOX, never from this.

         THE COMPARISON RAY IS SEARCHED FOR RATHER THAN ASSUMED. The first version of this
         check fired straight down the instance origin, where this asset has no geometry at
         all: three.js reported no triangle, the comparison had nothing to compare, and the
         assertion passed while proving nothing. A box-bounds-its-mesh claim needs a ray that
         actually meets the mesh, so the footprint is sampled until one does. */
      let tri = [], probe = null;
      for (let i = 0; i <= 8 && !tri.length; i++) {
        for (let j = 0; j <= 8 && !tri.length; j++) {
          const px = b.minX + (b.maxX - b.minX) * (i / 8);
          const pz = b.minZ + (b.maxZ - b.minZ) * (j / 8);
          const rc = new THREE.Raycaster(new THREE.Vector3(px, O.y, pz), new THREE.Vector3(0, -1, 0), 0, 200);
          const got = rc.intersectObject(inst, true);
          if (got.length) { tri = got; probe = { x: px, y: O.y, z: pz }; }
        }
      }
      const probeHit = probe ? w.physical.raycast(probe, DOWN, 200) : null;
      /* The provider ALONE, because the box-bounds-its-mesh claim is about the proxy and the
         mesh — nothing to do with what the terrain does at that column. */
      const probeProxy = probe ? w.assetCollision.raycast(probe, DOWN, 200) : null;

      return { boxes, entryId: e ? e.id : null, top: b ? b.maxY : null, ground, hit,
               box: b ? { w: b.maxX - b.minX, h: b.maxY - b.minY, d: b.maxZ - b.minZ, minY: b.minY } : null,
               triDistance: tri.length ? tri[0].distance : null,
               probeDistance: probeProxy ? probeProxy.distance : null,
               probeCategory: probeHit ? probeHit.category : null,
               /* A column CLEAR of the 140 m proxy footprint, for the composition claim. */
               beyond: w.physical.raycast({ x: b.maxX + 60, y: O.y, z: b.maxZ + 60 }, DOWN, 300),
               proxyIsNearerOrEqual: (tri.length && probeProxy) ? (probeProxy.distance <= tri[0].distance + 1e-6) : null };
    });
    if (!asset) { chk(false, 'the validation asset could not be loaded — nothing else in this section can run'); }
    else {
      chk(asset.boxes > 0, 'the declared proxy produced ' + asset.boxes + ' world-space box(es)');
      note('proxy extent: ' + asset.box.w.toFixed(2) + ' x ' + asset.box.h.toFixed(2) + ' x ' +
           asset.box.d.toFixed(2) + ' m, base at ' + asset.box.minY.toFixed(2));
      chk(!!asset.hit && asset.hit.category === 'asset',
          'the ray now strikes the ASSET, not the ground underneath it');
      chk(!!asset.hit && Math.abs(asset.hit.point.y - asset.top) < 1e-6,
          'exactly at the declared box top (' + (asset.hit ? asset.hit.point.y.toFixed(4) : '-') +
          ' vs ' + asset.top.toFixed(4) + ') — the PROXY is what was hit');
      chk(asset.hit && asset.hit.ref === asset.entryId,
          'and the hit carries the proxy\'s stable id as its ref — not the instance, not the mesh');
      chk(asset.hit && asset.hit.normal && asset.hit.normal.y === 1,
          'with the box face normal, on a surface a mesh raycaster would have given a triangle normal for');
      note('on a ray that DOES meet the mesh — three.js triangles at ' +
           (asset.triDistance === null ? 'nothing found' : asset.triDistance.toFixed(3) + ' m') +
           ', declared proxy at ' + (asset.probeDistance === null ? '-' : asset.probeDistance.toFixed(3) + ' m'));
      chk(asset.triDistance !== null,
          'a ray that strikes the real triangles was found — the comparison is real, not vacuous');
      chk(asset.proxyIsNearerOrEqual === true,
          'and the proxy is at or above the triangle surface it stands for — a box bounds its mesh');
      /* AND THE COMPOSITION. A provider does not shadow the world: one column inside the
         proxy answers `asset`, one clear of it answers `terrain`, from the same composite.
         Worth stating plainly because this validation asset's proxy is its NATIVE bounding
         box — 139.75 x 23.36 x 18.82 m, since E2.0a normalises nothing and REPORTS the
         native scale rather than guessing at it — so "clear of it" is sixty metres away. */
      chk(asset.beyond && asset.beyond.category === 'terrain',
          'and a column clear of the proxy footprint answers the GROUND — a provider does not shadow the world');
    }

    const removed = await page.evaluate(() => {
      const w = window.__d1;
      const X = 18.5, Z = -11.25;
      const ground = w.terrain.groundHeightAt(X, Z);
      w.assetCollision.remove(window.__inst);
      const after = w.physical.raycast({ x: X, y: ground + 60, z: Z }, { x: 0, y: -1, z: 0 }, 200);
      return { category: after ? after.category : null, size: w.assetCollision.size };
    });
    chk(removed.size === 0 && removed.category === 'terrain',
        'removing the proxy drops the ray straight back to the ground — no stale hit, immediately');

    // -------------------------------------------------------------------------------
    head('5. THE INTERACTION VOCABULARY RESOLVES AGAINST A REAL HIT');

    const inter = await page.evaluate(() => {
      const g = window.game, w = window.__d1;
      const src = g.assets.sources.get('prop.road-signs');
      w.assetCollision.add(window.__inst, src);
      const e = w.assetCollision.entries[0];

      const X = 18.5, Z = -11.25;
      const ground = w.terrain.groundHeightAt(X, Z);
      const hit = w.physical.raycast({ x: X, y: ground + 60, z: Z }, { x: 0, y: -1, z: 0 }, 200);

      const reg = new InteractionRegistry();
      const beforeReg = resolveInteraction(reg, hit, INTERACTION_AFFORDANCE.INSPECT);
      /* A generic test id. This is NOT a D1 target and nothing in the build declares one. */
      reg.register(e.id, makeInteractable('probe.subject', [INTERACTION_AFFORDANCE.INSPECT]));
      const inspect = resolveInteraction(reg, hit, INTERACTION_AFFORDANCE.INSPECT);
      const use = resolveInteraction(reg, hit, INTERACTION_AFFORDANCE.USE);
      const nonsense = resolveInteraction(reg, hit, 'detonate');
      reg.unregister(e.id);
      const afterUnreg = resolveInteraction(reg, hit, INTERACTION_AFFORDANCE.INSPECT);
      return { beforeReg, inspect, use, nonsense, afterUnreg, hitRef: hit ? hit.ref : null };
    });
    chk(inter.beforeReg && inter.beforeReg.ok === false && inter.beforeReg.refused === 'no-target',
        'a physical hit with nothing registered is NOT an interaction — geometry is not a target');
    chk(inter.inspect && inter.inspect.ok === true && inter.inspect.target &&
        inter.inspect.target.id === 'probe.subject',
        'registered against the proxy id, the same live hit resolves to that target');
    chk(inter.use && inter.use.ok === false && inter.use.refused === 'not-afforded',
        'a verb the target does not afford is refused cleanly, with a reason');
    chk(inter.nonsense && inter.nonsense.ok === false && inter.nonsense.refused === 'unknown-verb',
        'and a verb outside the three-word vocabulary is refused as unknown');
    chk(inter.afterUnreg && inter.afterUnreg.ok === false,
        'unregistering removes it immediately — the same lifecycle rule as a collision proxy');

    const domAfter = await page.evaluate(() => ({
      nodes: document.querySelectorAll('*').length,
      ids: Array.from(document.querySelectorAll('[id]')).map((e) => e.id).sort().join(','),
    }));
    chk(domAfter.ids === domBefore.ids,
        'AND NOT ONE ELEMENT WAS ADDED TO THE DOCUMENT — a vocabulary is not a prompt');
    note('document ids before ' + domBefore.ids.split(',').length +
         ', after ' + domAfter.ids.split(',').length + ' (node count ' +
         domBefore.nodes + ' -> ' + domAfter.nodes + ')');

    // -------------------------------------------------------------------------------
    head('6. A PICTURE OF WHERE THE RAY LANDED');

    /* TEST INSTRUMENTATION, BUILT HERE AND NOWHERE ELSE. A marker is placed at the point
       the composite reported so a person can see that the answer is where the geometry is.
       Nothing in `src/` draws this and nothing in the build knows it exists. */
    const shot = await page.evaluate(() => {
      const g = window.game, w = window.__d1;
      const X = 18.5, Z = -11.25;
      const ground = w.terrain.groundHeightAt(X, Z);
      /* FAR ENOUGH BACK TO SEE WHAT WAS HIT. The validation asset is 140 m across and 23 m
         tall at its native scale, so a viewpoint a few metres away frames nothing. */
      const cam = new THREE.PerspectiveCamera(60, 1100 / 700, 0.1, 3000);
      cam.position.set(X - 150, ground + 55, Z - 150);
      cam.lookAt(X, ground + 8, Z);
      cam.updateMatrixWorld(true);

      const marks = [];
      const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
      /* WIDE ENOUGH TO LEAVE THE ASSET. A narrow fan struck only the sign's proxy, so the
         picture carried one colour and the caption under it was not true of it. */
      for (let i = -6; i <= 6; i++) {
        const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.17).normalize();
        const h = w.physical.raycast({ x: cam.position.x, y: cam.position.y, z: cam.position.z },
                                     { x: d.x, y: d.y, z: d.z }, 600);
        if (!h) continue;
        const m = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10),
                                 new THREE.MeshBasicMaterial({ color: h.category === 'asset' ? 0xff4422 : 0x33ddff }));
        m.position.set(h.point.x, h.point.y, h.point.z);
        window.__d1scene.add(m); marks.push(h.category);
      }
      window.__orig = { scene: g.scene, cam: g.camera,
                       pScene: g.postfx && g.postfx.scene, pCam: g.postfx && g.postfx.camera };
      g.scene = window.__d1scene; g.camera = cam;
      if (g.postfx) { g.postfx.scene = window.__d1scene; g.postfx.camera = cam; }
      return { marks, postfxRepointed: !g.postfx || g.postfx.scene === window.__d1scene };
    });
    chk(shot.marks.length > 0, 'a fan of ' + shot.marks.length + ' rays from a real camera all found a surface');
    chk(new Set(shot.marks).size === 2,
        'and the fan struck BOTH categories — the same query answers for ground and for structure');
    chk(shot.postfxRepointed, 'the screenshot renders the TERRAIN scene — postfx was repointed too');
    note('categories struck across the fan: ' + Array.from(new Set(shot.marks)).join(', '));
    await page.waitForTimeout(1500);
    try {
      await page.screenshot({ path: path.join(OUT, 'raycast-d1-hits.png'), timeout: 60000 });
      note('screenshot: tests/renders/raycast-d1-hits.png — cyan marks are terrain hits, red an asset proxy');
      note('the red marks sit on ONE horizontal plane above signs of different heights. That is the');
      note('declared BOX proxy being visible: one AABB over the whole cluster, which is what');
      note('ASSET_COLLISION.BOX means. It is the proxy answering, not the triangles — the point.');
    } catch (e) { note('screenshot failed: ' + e.name); }

    // -------------------------------------------------------------------------------
    head('7. THE SHIPPED GAME IS WHERE IT WAS');

    const after = await page.evaluate(() => {
      const g = window.game;
      if (window.__orig) {
        g.scene = window.__orig.scene; g.camera = window.__orig.cam;
        if (g.postfx) { g.postfx.scene = window.__orig.pScene; g.postfx.camera = window.__orig.pCam; }
      }
      const inst = window.__inst;
      if (inst && inst.parent) inst.parent.remove(inst);
      window.__d1.assetCollision.clear();
      g.assets.release(inst);
      window.__d1.dispose(false);
      const eye = { x: g.camera.position.x, y: g.camera.position.y, z: g.camera.position.z };
      return {
        running: g.running === true,
        voxelStillAnswers: !!voxelRaycast(g.world, eye, { x: 0, y: -1, z: 0 }, 20),
        physicalIsVoxel: g.physical instanceof VoxelPhysicalWorld,
        dimension: g.player.dimension,
      };
    });
    chk(after.running, 'the voxel game is still running after all of that');
    chk(after.voxelStillAnswers, 'and voxelRaycast still answers for it — the legacy path is untouched');
    chk(after.physicalIsVoxel,
        'the shipped game\'s physical world is still VoxelPhysicalWorld — Phase 2 replaced nothing');
    chk(errors.length === 0, 'no page error in the whole run' + (errors.length ? ': ' + errors[0] : ''));

  } catch (e) {
    chk(false, 'RUN FAILED: ' + (e && e.message ? e.message : String(e)));
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail === 0) {
    console.log('ALL BROWSER RAYCAST CHECKS PASS');
    note('Live, over HTTP, in a real browser. This proves the query exists and answers');
    note('correctly. It proves nothing about how interaction FEELS — there is nothing to');
    note('interact with yet, by design.');
  } else {
    console.log(fail + ' BROWSER RAYCAST FAILURES');
  }
  process.exit(fail === 0 ? 0 : 1);
})();
