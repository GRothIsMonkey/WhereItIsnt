/* D1 IMPLEMENTATION PHASE 4 — THE REPRESENTATIVE SCENE.

   ONE QUESTION: does a genuinely approved, non-voxel PRODUCTION asset work correctly in the
   live game renderer?

   Launches Chromium through Playwright, serves the build over HTTP, boots the real game,
   then builds the E2.2 D1 foundation terrain into its OWN scene (exactly as
   `browser-terrain.js` does — the voxel game keeps running beside it, untouched), stands a
   short line of `prop.rural-fence-post-01` instances on it through the real AssetLibrary,
   registers their declared proxies with the terrain world's COMPOSITE PhysicalWorld, and
   renders the result through the game's own renderer and its one post pass.

   WHAT IT PROVES. That the asset loads over HTTP and renders; that the fence adds two
   materials and five textures to a scene however many instances stand in it; that its
   projected size on screen is what a 1.2 m object at that distance must be; that the normal
   map visibly shades it; that the composite PhysicalWorld collides with the post and the
   rail, leaves the gap under the rail open, and answers the normalized raycast with the
   fence's stable ref; and that tearing the scene down returns the renderer to where it was.

   AND HOW IT LOOKS IN THE SHIPPED RENDERER (section 5). The first version of this suite
   found the fence at 21% of its colour-managed brightness — the renderer had no output
   encode — and its galvanised strap darker than the timber, because nothing gave a metal
   anything to reflect. The renderer / PBR correction pass fixed both at the root
   (src/rendering/color-pipeline.js, src/rendering/sky-environment.js). Every frame measured
   here goes through the game's own PostFX pass — there is NO diagnostic alternate output
   path any more — and section 5 grades the result against the approved art's own texels.

   WHAT IT DOES NOT PROVE. That the fence LOOKS right to a person. Six screenshots are
   written to tests/renders/ for a person to judge.

   THIS IS NOT D1 LAYOUT. The fence line is placed BY THIS TEST at a site this test picks by
   searching for flat ground; nothing here is a landmark, a road, a farm or a creative
   decision, nothing is written into `src/`, and the scene is disposed at the end. The
   lighting is a TEST RIG — a sun plus the shipped SkyEnvironment, in four presentations
   (overcast, daylight, evening, night) — not E2.5's D1 lighting, which does not exist yet.
   There is deliberately no ambient or hemisphere light: for a PBR material the sky
   environment IS the ambient term, and adding one would count the sky twice.

   RENDERER. The shipped r128. The version-agnostic pipeline claims are
   `browser-assets.js --r186`'s and `browser-color-pipeline.js --r186`'s to make.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const PORT = Number(process.env.WII_SCENE_PORT || 8291);
const KEY = 'prop.rural-fence-post-01';
const COUNT = 6;          // a short run: enough to see repetition, far from a layout
const SPACING = 2.0;      // rail end (x 1.914) meets the next post's face (x 1.918)

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

const savePng = (name, dataUrl) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  note('render: tests/renders/' + name);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  await page.addInitScript(() => {
    /* A WebGL canvas is empty after it presents unless the buffer is preserved, so a
       readback returns black. Only the test needs this; the game never sets it. */
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
    await page.goto('http://127.0.0.1:' + PORT + '/game.html', { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => !!window.game, null, { timeout: 90000 });
    await page.evaluate(() => document.getElementById('clickPlay').click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (window.game.film && window.game.film.active) window.game.film.skip(); });
    await page.waitForFunction(() => window.game.running === true, null, { timeout: 120000 });

    // -------------------------------------------------------------------------------
    head('1. THE SCENE: D1 FOUNDATION TERRAIN, A TEST LIGHTING RIG, AND A FLAT SITE');

    const built = await page.evaluate(() => {
      const g = window.game;
      /* The voxel streamer is the only other producer of GPU resources in the page; freeze
         it so every renderer.info delta below belongs to this scene. Restored at the end. */
      window.__origUpdate = g.world.updateChunks;
      g.world.updateChunks = function () {};

      const scene = new THREE.Scene();
      const sun = new THREE.DirectionalLight(0xfff1e0, 0.5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      scene.add(sun, sun.target);
      /* The shipped PBR ambient term: the sky as a prefiltered environment. */
      const sky = new SkyEnvironment(g.renderer);
      sky.attach(scene);
      const world = new D1TerrainWorld(scene, g.assets, null);
      world.begin(0, 0);

      /* A FLAT SITE, FOUND RATHER THAN CHOSEN. The fence line runs 12 m along +X; the site
         is the candidate near the map centre whose ground varies least along it and is not
         under water. A search, not a creative decision. */
      let best = null;
      for (let cx = -480; cx <= 480; cx += 12) {
        for (let cz = -480; cz <= 480; cz += 12) {
          let lo = Infinity, hi = -Infinity, wet = false;
          for (let t = -0.5; t <= 12.5; t += 0.5) {
            for (const dz of [-2, 0, 3]) {
              const h = world.terrain.groundHeightAt(cx + t, cz + dz);
              lo = Math.min(lo, h); hi = Math.max(hi, h);
              if (world.physical.waterLevelAt(cx + t, h + 0.1, cz + dz) > 0) wet = true;
            }
          }
          if (!wet && (!best || hi - lo < best.range)) best = { x: cx, z: cz, range: hi - lo };
        }
      }
      world.update(best.x, best.z, 5000);
      window.__s = { scene, sun, sky, world, site: best, fences: [] };
      return { site: best, regions: world.debugReport().streaming.resident };
    });
    note('site (' + built.site.x + ', ' + built.site.z + '): ground varies ' + built.site.range.toFixed(3) +
         ' m along the 12 m run; ' + built.regions + ' terrain regions resident');
    chk(built.site.range < 0.6, 'a dry site with under 0.6 m of relief was found for the run');

    // -------------------------------------------------------------------------------
    head('2. THE APPROVED ASSET, PLACED ' + COUNT + ' TIMES THROUGH THE REAL LIBRARY');

    const placed = await page.evaluate(async ({ KEY, COUNT, SPACING }) => {
      const g = window.game, S = window.__s, w = S.world;
      const before = measureSceneResources(S.scene, g.renderer).scene;
      const info0 = { geom: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures };
      const src = await g.assets.load(KEY);
      if (!src) return { error: Array.from(g.assets.failed.values()).join('; ') };
      let one = null;
      for (let i = 0; i < COUNT; i++) {
        const inst = await g.assets.acquire(KEY);
        const x = S.site.x + i * SPACING, z = S.site.z;
        /* Foot on the terrain at the post; a tiny deterministic yaw so six identical posts
           do not read as a stamp. Neither is authored D1 placement. */
        inst.position.set(x, w.terrain.groundHeightAt(x, z), z);
        inst.rotation.y = (((i * 37) % 7) - 3) * 0.004;
        S.scene.add(inst);
        const boxes = w.assetCollision.add(inst, src);
        S.fences.push({ inst, boxes });
        if (i === 0) one = measureSceneResources(S.scene, g.renderer).scene;
      }
      const after = measureSceneResources(S.scene, g.renderer).scene;
      return {
        before, one, after, refs: src.refs, bounds: src.bounds,
        boxes: S.fences.map((f) => f.boxes), entries: w.assetCollision.size,
        infoDelta: { geom: g.renderer.info.memory.geometries - info0.geom,
                     tex: g.renderer.info.memory.textures - info0.tex },
      };
    }, { KEY, COUNT, SPACING });
    if (placed.error) throw new Error('the production fence failed to load over HTTP: ' + placed.error);
    chk(true, 'the production fence loaded over HTTP through its registry key');
    note('scene before: ' + placed.before.meshes + ' meshes, ' + placed.before.materials + ' materials, ' +
         placed.before.textures + ' textures, ' + placed.before.triangles.toLocaleString() + ' triangles');
    note('with 1 fence: ' + placed.one.meshes + ' meshes, ' + placed.one.materials + ' materials, ' +
         placed.one.textures + ' textures');
    note('with ' + COUNT + ' fences: ' + placed.after.meshes + ' meshes, ' + placed.after.materials + ' materials, ' +
         placed.after.textures + ' textures, ' + placed.after.triangles.toLocaleString() + ' triangles');
    chk(placed.refs === COUNT, 'the source is referenced by exactly ' + COUNT + ' placed instances');
    chk(placed.one.materials - placed.before.materials === 2 && placed.one.textures - placed.before.textures === 5,
        'ONE fence adds two materials and five textures to the scene');
    chk(placed.after.materials === placed.one.materials && placed.after.textures === placed.one.textures &&
        placed.after.uniqueGeometries === placed.one.uniqueGeometries,
        COUNT + ' fences add NOTHING more — every instance shares them (CLAUDE.md section 72)');
    chk(placed.after.triangles - placed.before.triangles === 1296 * COUNT,
        'and the scene carries exactly ' + COUNT + ' x 1,296 triangles of fence');
    chk(placed.boxes.every((n) => n === 2) && placed.entries === COUNT,
        'every instance registered its two declared proxies with the terrain world\'s collision set');

    // -------------------------------------------------------------------------------
    head('3. THE COMPOSITE PHYSICAL WORLD SEES THE FENCE — AND ONLY WHERE IT IS');

    const phys = await page.evaluate(() => {
      const S = window.__s, pw = S.world.physical, t = S.world.terrain;
      const f = S.fences[1].inst, x = f.position.x, y = f.position.y, z = f.position.z;
      const box = (cx, by, cz, half, height) => ({ minX: cx - half, maxX: cx + half, minY: by,
                                                   maxY: by + height, minZ: cz - half, maxZ: cz + half });
      /* A body standing on the terrain under its whole footprint — sampled on the grid the
         terrain's own collision query uses — so any collision reported is the fence's. */
      const standY = (cx, cz, half) => {
        let h = -Infinity;
        for (const dx of [-half, -half + 0.5, half]) for (const dz of [-half, -half + 0.5, half]) {
          h = Math.max(h, t.groundHeightAt(cx + dx, cz + dz));
        }
        return h + 0.01;
      };
      const out = {};
      out.isComposite = pw instanceof CompositePhysicalWorld && pw.providers.indexOf(S.world.assetCollision) >= 0;
      out.postSolid = pw.isSolid(x + 0.03, y + 0.6, z);
      out.railSolid = pw.isSolid(x + 1.0, y + 0.81, z);
      out.underRail = pw.isSolid(x + 1.0, y + 0.4, z);
      out.groundOverPost = pw.groundHeightAt(x, z) - (y + 1.2);
      out.groundBeside = pw.groundHeightAt(x + 1.0, z + 1.5) - t.groundHeightAt(x + 1.0, z + 1.5);

      /* WALK A PLAYER-SIZED BODY INTO THE RAIL, then a small one UNDER it. */
      const walk = (half, height) => {
        let cz = z + 2.5, stopped = null;
        for (let i = 0; i < 200; i++) {
          const nz = cz - 0.02;
          if (pw.collidesAABB(box(x + 1.0, standY(x + 1.0, nz, half), nz, half, height))) { stopped = cz; break; }
          cz = nz;
        }
        return { stopped, end: cz };
      };
      out.player = walk(0.3, 1.8);
      out.small = walk(0.15, 0.4);

      /* THE NORMALIZED RAYCAST, from an eye 1.6 m up and 4 m back. */
      const eye = { x: x + 1.0, y: t.groundHeightAt(x + 1.0, z + 4) + 1.6, z: z + 4 };
      const aim = (px, py, pz) => { const dx = px - eye.x, dy = py - eye.y, dz = pz - eye.z;
                                     const L = Math.hypot(dx, dy, dz); return { x: dx / L, y: dy / L, z: dz / L }; };
      const hRail = pw.raycast(eye, aim(x + 1.0, y + 0.81, z), 20);
      const hGap = pw.raycast(eye, aim(x + 1.0, y + 0.35, z), 20);
      const entry = S.world.assetCollision.entries.find((e) => e.instance === f);
      out.rail = hRail && { cat: hRail.category, ref: hRail.ref, d: hRail.distance, nz: hRail.normal && hRail.normal.z };
      out.gap = hGap && { cat: hGap.category, d: hGap.distance };
      out.entryId = entry ? entry.id : null;
      out.assetCat = RAYCAST_CATEGORY.ASSET; out.terrainCat = RAYCAST_CATEGORY.TERRAIN;
      out.normalized = rayIsNormalized(aim(x, y, z).x, aim(x, y, z).y, aim(x, y, z).z);
      out.railZ = z + 0.036;
      return out;
    });
    chk(phys.isComposite, 'the terrain world\'s physical service IS the composite, with the fence set as a provider');
    chk(phys.postSolid && phys.railSolid, 'the post and the rail are solid in the live composite');
    chk(phys.underRail === false, 'the air under the rail is NOT — no invisible wall');
    chk(Math.abs(phys.groundOverPost) < 1e-6,
        'groundHeightAt over a post is its crown, the maximum of terrain and proxy');
    chk(Math.abs(phys.groundBeside) < 1e-9,
        'and 1.5 m off the fence line it is exactly the terrain again');
    chk(phys.player.stopped !== null && Math.abs(phys.player.stopped - 0.3 - phys.railZ) < 0.03,
        'a 0.6 m x 1.8 m body walking at the rail STOPS at its face (' +
        (phys.player.stopped !== null ? (phys.player.stopped - 0.3 - phys.railZ).toFixed(3) : '-') + ' m off)');
    chk(phys.small.stopped === null,
        'a 0.3 m x 0.4 m body walks straight UNDER the rail — the gap is open to something that fits it');
    chk(phys.normalized, 'the ray directions are normalized, per the one raycast convention');
    chk(!!phys.rail && phys.rail.cat === phys.assetCat && phys.rail.ref === phys.entryId && phys.rail.nz === 1,
        'an eye-height ray at the rail hits category ASSET, the fence\'s stable ref, on the +Z face (' +
        (phys.rail ? phys.rail.d.toFixed(3) + ' m' : 'miss') + ')');
    chk(!phys.gap || phys.gap.cat === phys.terrainCat,
        'the same ray aimed into the gap under the rail passes through it to the ' +
        (phys.gap ? 'terrain beyond (' + phys.gap.d.toFixed(2) + ' m)' : 'open field'));

    // -------------------------------------------------------------------------------
    head('4. IT RENDERS THROUGH THE GAME\'S OWN PATH — CLOSE, GAMEPLAY, MEDIUM');

    /* Page-side tools, installed once. EVERY frame measured or saved here is rendered by
       `frame()` — the game's own PostFX pass, the one path the shipped game draws through,
       at full sanity so no grain or vignette is in the numbers. There is no second path. */
    await page.evaluate(() => {
      const g = window.game, S = window.__s;
      const W = g.renderer.domElement.width, H = g.renderer.domElement.height;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const grab = () => { cx.clearRect(0, 0, W, H); cx.drawImage(g.renderer.domElement, 0, 0); return cx.getImageData(0, 0, W, H).data; };
      const setFences = (v, only) => S.fences.forEach((f, i) => { f.inst.visible = v && (only === undefined || only === i); });
      S.W = W; S.H = H;
      S.cam = new THREE.PerspectiveCamera(70, W / H, 0.05, 1500);
      S.pose = (px, py, pz, lx, ly, lz) => { S.cam.position.set(px, py, pz); S.cam.lookAt(lx, ly, lz); S.cam.updateMatrixWorld(true); };
      S.render = () => {
        const p = g.postfx, o = { scene: p.scene, camera: p.camera };
        p.scene = S.scene; p.camera = S.cam;
        try { p.render(0, 1.0); } finally { p.scene = o.scene; p.camera = o.camera; }
      };
      S.frame = () => { S.render(); return grab(); };
      S.live = () => { S.render(); return g.renderer.domElement.toDataURL('image/png'); };
      /* Mask = pixels that change when the fence is hidden, taken with the sun's shadow OFF
         so the fence's shadow on the ground is not counted as fence. Colour statistics are
         then read from the fully lit, shadowed frame at those pixels. `sub` optionally hides
         one material's meshes, so the timber and the steel can be measured apart. */
      S.measure = (only, sub) => {
        const hidden = [];
        if (sub) S.fences.forEach((f) => f.inst.traverse((n) => {
          if (n.isMesh && !sub.test(n.material.name)) { n.visible = false; hidden.push(n); }
        }));
        const sh = S.sun.castShadow;
        S.sun.castShadow = false;
        setFences(true, only); const m1 = S.frame();
        setFences(false); const m0 = S.frame();
        S.sun.castShadow = sh;
        setFences(true, only); const a = S.frame();
        setFences(true);
        hidden.forEach((n) => { n.visible = true; });
        let n = 0, r = 0, gg = 0, bl = 0, l2 = 0, minX = W, maxX = -1, minY = H, maxY = -1;
        for (let i = 0, p = 0; i < a.length; i += 4, p++) {
          const d = Math.abs(m1[i] - m0[i]) + Math.abs(m1[i + 1] - m0[i + 1]) + Math.abs(m1[i + 2] - m0[i + 2]);
          if (d <= 12) continue;
          const L = (0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]) / 255;
          n++; r += a[i]; gg += a[i + 1]; bl += a[i + 2]; l2 += L * L;
          const x = p % W, y = (p / W) | 0;
          if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        const rgb = n ? [r / n / 255, gg / n / 255, bl / n / 255] : [0, 0, 0];
        const luma = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
        return { pixels: n, frac: n / (W * H), rgb, luma,
                 sd: n ? Math.sqrt(Math.max(0, l2 / n - luma * luma)) : 0,
                 bbox: n ? { minX, maxX, minY, maxY, h: maxY - minY + 1, w: maxX - minX + 1 } : null };
      };
      /* FOUR PRESENTATIONS, one rig: a sun and the sky environment, set together because a
         sky and the light it casts are one thing. Colours are hex (sRGB, as a person would
         pick them); intensities are linear. The sky's brightness per presentation follows
         the ordinary photographic ladder — a lit dusk about a third of day, night a few per
         cent — and the sun is what distinguishes the two days.

         OVERCAST IS EXPOSED FOR A VERTICAL SUBJECT, the way a photographer exposes flat
         light for the thing in front of them. A fence face sees half the sky and half the
         dark ground, so at a sky of 1.0 it receives about 0.6 of the light a horizontal
         surface does; the first run of this suite measured the timber at x0.72 of its
         albedo there, a hair under one stop. 1.35 puts the fence's own irradiance near one.
         This is the test rig's exposure, not a game lighting decision — there is no D1
         lighting yet, and E2.5 owns it. */
      S.present = (mode) => {
        const P = {
          overcast: { bg: 0xa3aaae, zen: 0xb4bcc2, hor: 0xc4c8c6, gnd: 0x4b4a3c, sky: 1.35,
                      sun: 0xfff1e0, sunI: 0.6, sunY: 60, fogNear: 45, fogFar: 340 },
          daylight: { bg: 0x8fb1cf, zen: 0x5d8ec4, hor: 0xb8cde0, gnd: 0x5a5238, sky: 0.9,
                      sun: 0xfff3dc, sunI: 2.6, sunY: 45, fogNear: 90, fogFar: 600 },
          evening:  { bg: 0x3a3440, zen: 0x283049, hor: 0x7a5a52, gnd: 0x1c1a16, sky: 0.3,
                      sun: 0xff9a5a, sunI: 0.35, sunY: 8, fogNear: 30, fogFar: 260 },
          night:    { bg: 0x05060b, zen: 0x05070d, hor: 0x0b0a14, gnd: 0x020202, sky: 0.08,
                      sun: 0x8090c0, sunI: 0.0, sunY: 60, fogNear: 20, fogFar: 160 },
        }[mode];
        S.scene.background = new THREE.Color(P.bg);
        S.scene.fog = new THREE.Fog(P.hor, P.fogNear, P.fogFar);
        S.sun.color.setHex(P.sun);
        S.sun.intensity = P.sunI;
        const c = S.fences[2].inst.position;
        S.sun.position.set(c.x - 30, c.y + P.sunY, c.z + 40);
        S.sun.target.position.copy(c); S.sun.target.updateMatrixWorld();
        const sc = S.sun.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18;
        sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
        S.sky.request(P.zen, P.hor, P.gnd, P.sky);
        S.sky.buildNow();
      };
      const f0 = S.fences[0].inst.position, f2 = S.fences[2].inst.position;
      const g0 = (x, z) => S.world.terrain.groundHeightAt(x, z);
      S.poses = {
        /* close: 1.2 m from the joint, a little above it — the bolts, the checks, the decay */
        close: () => S.pose(f0.x + 0.55, f0.y + 1.15, f0.z + 1.2, f0.x + 0.2, f0.y + 0.8, f0.z),
        /* gameplay: a standing eye (1.6 m) 4 m back, looking along the run */
        gameplay: () => S.pose(f2.x - 1.5, g0(f2.x - 1.5, f2.z + 4) + 1.6, f2.z + 4, f2.x + 1.0, f2.y + 0.7, f2.z),
        /* medium: 15 m off, three-quarter, the whole run in frame */
        medium: () => S.pose(f2.x - 6, g0(f2.x - 6, f2.z + 14) + 1.6, f2.z + 14, f2.x + 1.5, f2.y + 0.6, f2.z),
      };
    });

    /* THE RANGES AND THE PRESENTATIONS. Every pose looks at the fence from its +Z side,
       where the strap is. */
    const SHOTS = [['close', 'overcast'], ['gameplay', 'overcast'], ['medium', 'overcast'],
                   ['gameplay', 'daylight'], ['gameplay', 'evening'], ['gameplay', 'night']];
    const shots = { out: {} };
    for (const [pose, mode] of SHOTS) {
      const r = await page.evaluate(([pose, mode]) => {
        const S = window.__s;
        S.present(mode); S.poses[pose]();
        return { m: S.measure(), img: S.live() };
      }, [pose, mode]);
      const key = pose === 'gameplay' && mode !== 'overcast' ? mode : pose;
      shots.out[key] = r.m;
      savePng('fence-scene-' + pose + '-' + mode + '.png', r.img);
    }
    for (const k of ['close', 'gameplay', 'medium', 'daylight', 'evening', 'night']) {
      const m = shots.out[k];
      note(k.padEnd(9) + (100 * m.frac).toFixed(2).padStart(6) + '% of the frame is fence, bbox ' +
           (m.bbox ? m.bbox.w + ' x ' + m.bbox.h + ' px' : '-') + ', mean RGB ' +
           m.rgb.map((v) => v.toFixed(3)).join('/') + ', luma ' + m.luma.toFixed(3));
    }
    chk(['close', 'gameplay', 'medium', 'daylight', 'evening'].every((k) => shots.out[k].pixels > 500),
        'the fence reaches the screen at every range and in every lit presentation');
    chk(shots.out.close.frac > shots.out.gameplay.frac && shots.out.gameplay.frac > shots.out.medium.frac * 0.5,
        'it occupies less of the frame as the camera backs off — close > gameplay, and medium is still visible');
    chk(['close', 'gameplay', 'medium', 'daylight'].every((k) => shots.out[k].luma < 0.9),
        'no range and no presentation blows it out (luma ' +
        ['close', 'gameplay', 'medium', 'daylight'].map((k) => shots.out[k].luma.toFixed(3)).join(' / ') + ')');
    chk(shots.out.daylight.luma > shots.out.gameplay.luma,
        'and it responds to the light: brighter under the daylight sun than under overcast');

    /* SCALE, AS THE SCREEN SEES IT. One post, straight on, 5 m away: a 1.2 m object at that
       depth must project to 1.2 * f / depth pixels, where f comes from the camera's own FOV.
       The expected number is computed from the NOMINAL 1.2 m, not from the model's bounds,
       so a scale error anywhere in the load/clone/render chain shows up here. */
    const scale = await page.evaluate(() => {
      const S = window.__s, p = S.fences[3].inst.position, D = 5;
      S.present('overcast');
      S.pose(p.x, p.y + 0.6, p.z + D, p.x, p.y + 0.6, p.z);
      const m = S.measure(3);
      const f = (S.H / 2) / Math.tan((S.cam.fov / 2) * Math.PI / 180);
      return { measured: m.bbox ? m.bbox.h : 0, expected: 1.2 * f / D };
    });
    note('one post at 5.000 m: ' + scale.measured + ' px tall on screen, a 1.2 m object should be ' +
         scale.expected.toFixed(1) + ' px');
    chk(Math.abs(scale.measured - scale.expected) / scale.expected < 0.06,
        'the rendered post is 1.2 m tall to within 6% of the camera\'s own projection — the scale survived the renderer');

    // -------------------------------------------------------------------------------
    head('5. MATERIAL RESPONSE IN THE SHIPPED RENDERER, GRADED AGAINST THE APPROVED TEXELS');

    /* THE REFERENCE IS THE ART ITSELF. Each material's base-colour map is decoded in the page
       and its mean display luma taken. Under overcast daylight at a sane exposure a diffuse
       surface shows at about its own albedo; that is the photographic meaning of "correctly
       exposed", and it is what the approved Blender renders show. The first version of this
       suite measured the timber at ~15% of its albedo. The gates below are one stop either
       way — a factor the eye reads as "the same surface in different light", not a
       tolerance tuned to a number. */
    const mat = await page.evaluate(() => {
      const S = window.__s;
      const mapLuma = (tex) => {
        const img = tex && tex.image;
        if (!img || !img.width) return null;
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, img.width, img.height).data;
        let s = 0; for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        return s / (d.length / 4);
      };
      let wood = null, steel = null;
      S.fences[0].inst.traverse((n) => {
        if (!n.isMesh) return;
        if (/timber/.test(n.material.name)) wood = n.material;
        if (/steel/.test(n.material.name)) steel = n.material;
      });
      S.present('overcast');
      S.poses.gameplay();
      const gameTimber = S.measure(undefined, /timber/);
      S.poses.close();
      const closeTimber = S.measure(0, /timber/), closeSteel = S.measure(0, /steel/);

      /* The normal map, on and off, at close range, under the DAYLIGHT sun: relief is read
         under directional light, and flat overcast light is exactly the light that hides it
         (the approved review set judged it under a grazing light for the same reason). */
      S.present('daylight');
      S.poses.close();
      const on = S.frame().slice();
      const sdOn = S.measure(0, /timber/);
      const keep = wood.normalMap; wood.normalMap = null; wood.needsUpdate = true;
      const off = S.frame();
      const sdOff = S.measure(0, /timber/);
      wood.normalMap = keep; wood.needsUpdate = true;
      let changed = 0, sum = 0;
      for (let i = 0; i < on.length; i += 4) {
        const d = Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]);
        if (d > 3) { changed++; sum += d; }
      }
      /* What the map itself contains: its mean tilt away from flat, in degrees. A subtle map
         produces a subtle response, and the number says which this one is. */
      let tilt = 0;
      { const img = keep.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, img.width, img.height).data; let t = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const nx = d[i] / 127.5 - 1, ny = d[i + 1] / 127.5 - 1, nz = d[i + 2] / 127.5 - 1;
          t += Math.atan2(Math.hypot(nx, ny), Math.max(1e-6, nz)); n++;
        }
        tilt = (t / n) * 180 / Math.PI; }
      return { woodAlbedo: mapLuma(wood.map), steelAlbedo: mapLuma(steel.map),
               gameTimber, closeTimber, closeSteel,
               normal: { changed, mean: changed ? sum / changed / 3 : 0, restored: wood.normalMap === keep,
                         sdOn: sdOn.sd, sdOff: sdOff.sd, luma: sdOn.luma, tilt, scale: wood.normalScale.x },
               env: !!S.scene.environment, sky: S.sky.debugReport() };
    });
    const rel = (m, a) => a ? m.luma / a : 0;
    note('approved base maps (display luma): timber ' + mat.woodAlbedo.toFixed(3) + ', steel ' + mat.steelAlbedo.toFixed(3));
    note('overcast, gameplay range: timber ' + mat.gameTimber.luma.toFixed(3) + ' (x' +
         rel(mat.gameTimber, mat.woodAlbedo).toFixed(2) + ' of its albedo)');
    note('overcast, close range:    timber ' + mat.closeTimber.luma.toFixed(3) + ' (sd ' + mat.closeTimber.sd.toFixed(3) +
         '), steel ' + mat.closeSteel.luma.toFixed(3) + ' over ' + mat.closeSteel.pixels + ' px');
    note('normal map on vs off at close range, daylight: ' + mat.normal.changed + ' pixels differ by more than 1/255, mean ' +
         mat.normal.mean.toFixed(1) + '/255; timber luma sd ' + mat.normal.sdOff.toFixed(4) + ' -> ' +
         mat.normal.sdOn.toFixed(4) + ' (the map\'s mean tilt ' + mat.normal.tilt.toFixed(1) + ' deg at scale ' +
         mat.normal.scale.toFixed(2) + ')');
    note('sky environment: ' + (mat.env ? 'attached' : 'MISSING') + ', ' + mat.sky.builds + ' builds, last ' +
         mat.sky.lastMs.toFixed(1) + ' ms');
    chk(mat.env, 'the scene\'s PBR ambient term is the shipped SkyEnvironment, attached as scene.environment');
    const r1 = rel(mat.gameTimber, mat.woodAlbedo);
    chk(r1 >= 0.73 && r1 <= 1.37,
        'the timber shows within one stop of its own albedo in overcast daylight — not near-black (x' + r1.toFixed(2) + ')');
    chk(mat.closeTimber.sd >= 0.03,
        'and it shows its surface: the timber\'s luma varies across the post (sd ' + mat.closeTimber.sd.toFixed(3) + ')');
    chk(mat.closeSteel.pixels > 50 && mat.closeSteel.luma >= mat.closeTimber.luma * 1.15,
        'the galvanised strap reads LIGHTER than the timber it is bolted to, as authored (steel ' +
        mat.closeSteel.luma.toFixed(3) + ' vs timber ' + mat.closeTimber.luma.toFixed(3) + ')');
    /* THE NORMAL MAP IS ACTIVE, AND IT RESPONDS AS MUCH AS IT SHOULD — NO MORE, NO LESS.
       The approved map is authored SUBTLE: its mean tilt is under three degrees, less at its
       0.7 scale, and that is the art, not this pass's to change. So the claim is not "big",
       it is "right": to first order a surface tilted by t changes its shading by about
       luma x tan(t), and the measured mean change must sit within a factor of 2.5 of that.
       A dropped map would read ~0; a mis-scaled or doubled one would read far over. (Its
       orientation — the flip — is browser-assets.js 9b's check, against the loader.) */
    const tiltRad = mat.normal.tilt * mat.normal.scale * Math.PI / 180;
    const predicted = 255 * mat.normal.luma * Math.tan(tiltRad);   // the daylight frame it was measured in
    note('first-order prediction for that tilt at this luma: ' + predicted.toFixed(1) + '/255');
    chk(mat.normal.changed > 2000 && mat.normal.restored,
        'the timber normal map shades the surface under directional light (' + mat.normal.changed +
        ' px change), and was put back');
    chk(mat.normal.mean >= predicted / 2.5 && mat.normal.mean <= predicted * 2.5,
        'and its response (' + mat.normal.mean.toFixed(1) + '/255) matches what the map contains (' +
        predicted.toFixed(1) + '/255 predicted) — the renderer neither drops nor exaggerates it');

    /* BLACK IS INTENTIONALLY BLACK. Correct colour management may not flatten the dark: the
       same fence at dusk is well below its overcast value, and at night — no sun, a sky at a
       few per cent — it is nearly invisible, which is what a flashlight game needs. */
    chk(shots.out.evening.luma < shots.out.gameplay.luma * 0.6,
        'at evening the fence is well below its overcast brightness (' + shots.out.evening.luma.toFixed(3) + ')');
    chk(shots.out.night.luma < 0.04,
        'and at night, with no sun and a dim sky, it is close to black (' + shots.out.night.luma.toFixed(3) +
        ') — nothing in the pipeline lifts the dark');

    // -------------------------------------------------------------------------------
    head('6. TEARDOWN RETURNS THE RENDERER TO WHERE IT WAS');

    const torn = await page.evaluate(async (KEY) => {
      const g = window.game, S = window.__s, w = S.world;
      const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      g.renderer.render(S.scene, S.cam); await settle();
      const withFences = { geom: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures };
      for (const f of S.fences) { w.assetCollision.remove(f.inst); g.assets.release(f.inst); }
      g.renderer.render(S.scene, S.cam); await settle();
      const without = { geom: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures };
      const out = { withFences, without, resident: g.assets.isLoaded(KEY), entries: w.assetCollision.size,
                    fenceNodes: 0 };
      S.scene.traverse((o) => { if (o.userData && o.userData.assetKey === KEY) out.fenceNodes++; });
      out.dispose = w.dispose(true);
      if (S.sun.shadow.map) S.sun.shadow.map.dispose();
      const texBefore = g.renderer.info.memory.textures;
      S.sky.dispose();
      out.skyFreed = texBefore - g.renderer.info.memory.textures;
      out.envCleared = S.scene.environment === null;
      g.world.updateChunks = window.__origUpdate;
      out.running = g.running === true;
      return out;
    }, KEY);
    note('renderer.info geometries/textures with the fence line ' + torn.withFences.geom + '/' + torn.withFences.tex +
         ', after releasing it ' + torn.without.geom + '/' + torn.without.tex);
    chk(torn.withFences.geom - torn.without.geom === 2 && torn.withFences.tex - torn.without.tex === 5,
        'releasing all ' + COUNT + ' instances freed exactly the two geometries and five textures they shared');
    chk(torn.resident === false && torn.entries === 0 && torn.fenceNodes === 0,
        'the source is disposed, no proxy remains in the composite, no fence node remains in the scene');
    chk(torn.envCleared && torn.skyFreed >= 1,
        'disposing the sky environment freed its texture (' + torn.skyFreed + ') and left the scene with no environment');
    chk(torn.running, 'the voxel game kept running underneath the whole time, and its streamer is restored');
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
