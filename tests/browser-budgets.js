/* D1 IMPLEMENTATION PHASE 3 — THE VISUAL BUDGET SYSTEM, IN A REAL BROWSER.

   WHAT THIS PROVES that the offline suite cannot. That both new modules LOAD in the shipped
   page as classic scripts; that the measurement functions work on a REAL decoded GLB rather
   than on a synthetic fixture — real geometry, real materials, real textures with real
   dimensions; that the one counting definition really is one, because the pipeline's own
   report and the budget measurement are taken from the live asset and must agree; that
   resource statistics can be gathered from the live runtime with a real renderer; that
   nothing in the running game calls any of it on its own; and that the production bootstrap
   is exactly where it was.

   WHAT IT DOES NOT PROVE. That the budgets are the right budgets — that is
   `VISUAL_RULE_BIBLE.md`'s job and a person's. **No production asset is created, loaded or
   placed by this suite.** `prop.road-signs` is the E2.0a pipeline VALIDATION asset, the
   registry marks it so, and the budget model deliberately returns no production budget for
   it.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.WII_BUDGET_PORT || 8281);

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
    head('1. THE GUARDRAIL LOADED INTO THE SHIPPED PAGE');

    const present = await page.evaluate(() => ({
      classes: typeof ASSET_BUDGET_CLASSES === 'object' ? Object.keys(ASSET_BUDGET_CLASSES) : null,
      frozen: typeof ASSET_BUDGET_CLASSES === 'object' && Object.isFrozen(ASSET_BUDGET_CLASSES),
      statuses: typeof ASSET_BUDGET_STATUS === 'object' ? Object.keys(ASSET_BUDGET_STATUS).length : -1,
      bands: typeof ASSET_BUDGET_BAND === 'object' ? Object.keys(ASSET_BUDGET_BAND).length : -1,
      count: typeof countNodeTriangles === 'function',
      geo: typeof measureAssetGeometry === 'function',
      mats: typeof measureAssetMaterials === 'function',
      texel: typeof measureAssetTexelDensity === 'function',
      asset: typeof measureAsset === 'function',
      sceneFn: typeof measureSceneResources === 'function',
      compare: typeof compareResourceMeasurements === 'function',
      validate: typeof validateAssetBudget === 'function',
      specOf: typeof assetBudgetSpecOf === 'function',
    }));
    chk(!!present.classes && present.classes.length === 6,
        'asset-budgets.js loaded — six asset classes live in the page');
    chk(present.frozen, 'and the table is frozen at runtime');
    chk(present.statuses === 5 && present.bands === 4,
        'five statuses and four bands — the advisory/blocking distinction survived the load');
    chk(present.count && present.geo && present.mats && present.texel && present.asset,
        'asset-measure.js loaded — every measurement entry point is callable');
    chk(present.sceneFn && present.compare && present.validate && present.specOf,
        'as are the runtime statistics, the baseline comparison and the validator');
    chk(errors.length === 0, 'and loading two more scripts raised no page error');

    // -------------------------------------------------------------------------------
    head('2. A REAL GLB, MEASURED — WHAT NO OFFLINE SUITE CAN DO');

    const measured = await page.evaluate(async () => {
      const g = window.game;
      const src = await g.assets.load('prop.road-signs');
      if (!src) return null;
      const m = measureAsset(src.root);
      return {
        report: src.report,
        triangles: m.triangles,
        meshes: m.geometry.meshes,
        vertices: m.geometry.vertices,
        uniqueGeometries: m.geometry.uniqueGeometries,
        drawGroups: m.geometry.drawGroups,
        hidden: m.geometry.hidden,
        materialSlots: m.materials.materialSlots,
        uniqueMaterials: m.materials.uniqueMaterials,
        signatures: m.materials.materialSignatures,
        duplicates: m.materials.duplicateMaterials,
        sharedUses: m.materials.sharedMaterialUses,
        textures: m.materials.textures,
        textureDims: m.materials.textureDims,
        maxTextureDim: m.maxTextureDim,
        missing: m.materials.missingTextureData,
        unknownSize: m.materials.unknownTextureSize,
        texelStatus: m.texelStatus,
        texelWhy: m.texelWhy,
        texel: m.texelDensity,
        texelSamples: m.texel.samples || 0,
        worldArea: m.texel.worldArea || 0,
        size: src.bounds.size,
      };
    });
    if (!measured) { chk(false, 'the validation asset could not be loaded — nothing else can be measured'); }
    else {
      note('road_signs.glb: ' + measured.triangles.toLocaleString() + ' triangles over ' +
           measured.meshes + ' meshes, ' + measured.vertices.toLocaleString() + ' vertices');
      note('native size ' + measured.size.map((n) => n.toFixed(2)).join(' x ') + ' m');
      chk(measured.triangles > 0 && measured.meshes > 0,
          'the measurement read real geometry out of a real decoded GLB');
      chk(measured.vertices > 0 && measured.uniqueGeometries > 0,
          'with real vertex and unique-geometry counts');

      /* THE ONE COUNTING DEFINITION, PROVED LIVE. The pipeline's own report and this
         phase's measurement are two call paths into the same function; if they ever
         disagree, one of them has grown a second definition. */
      chk(measured.report.triangles === measured.triangles,
          'the PIPELINE report and the BUDGET measurement agree exactly (' +
          measured.report.triangles + ' = ' + measured.triangles + ')');
      chk(measured.report.meshes === measured.meshes,
          'and so do their mesh counts — one counting definition, two call paths');

      note('materials: ' + measured.materialSlots + ' slots, ' + measured.uniqueMaterials +
           ' unique, ' + measured.signatures + ' distinct signatures (' +
           measured.duplicates + ' duplicate, ' + measured.sharedUses + ' shared uses)');
      chk(measured.uniqueMaterials > 0, 'real materials were counted');
      chk(measured.signatures !== null && measured.signatures <= measured.uniqueMaterials,
          'and equivalent-material detection ran against the real material set');

      note('textures: ' + measured.textures + ', dimensions [' + measured.textureDims.join(', ') +
           '], largest ' + measured.maxTextureDim);
      chk(measured.textures > 0 && measured.maxTextureDim > 0,
          'REAL TEXTURE DIMENSIONS were read from decoded images — the claim offline cannot make');
      chk(measured.missing === 0 && measured.unknownSize === 0,
          'every texture on the asset resolved to a size (no missing, no unknown)');

      note('texel density: ' + measured.texelStatus +
           (measured.texel ? ' — ' + measured.texel.toFixed(1) + ' px/m over ' +
            measured.worldArea.toFixed(1) + ' m² from ' + measured.texelSamples + ' triangles'
            : ' — ' + measured.texelWhy));
      chk(['measured', 'unavailable', 'invalid'].indexOf(measured.texelStatus) >= 0,
          'texel density returned one of its three declared states, never a bare number');
      if (measured.texelStatus === 'measured') {
        chk(measured.texel > 0 && isFinite(measured.texel) && measured.texelSamples > 0,
            'and where it measured, it did so from real UVs against real world area');
      }
    }

    // -------------------------------------------------------------------------------
    head('3. THE VALIDATOR, AGAINST THE REAL MEASUREMENT');

    const verdicts = await page.evaluate(async () => {
      const g = window.game;
      const src = await g.assets.load('prop.road-signs');
      const m = measureAsset(src.root);
      const out = { spec: assetBudgetSpecOf('prop.road-signs'), byClass: {} };
      for (const k of Object.keys(ASSET_BUDGET_CLASSES)) {
        const v = validateAssetBudget(m, k);
        out.byClass[k] = { status: v.status, tri: v.metrics.triangles.status,
                           triBand: v.metrics.triangles.band, tex: v.metrics.texture.status,
                           texel: v.metrics.texel.status };
      }
      out.undeclared = validateAssetBudget(m, null).status;
      out.excepted = validateAssetBudget(m, 'small-prop',
        [{ metric: 'triangles', allow: m.triangles,
           reason: 'fixture exception, proving the path in a real browser' }]).metrics.triangles.status;
      return out;
    });
    chk(verdicts.spec === null,
        'assetBudgetSpecOf returns NULL for the validation asset — a pipeline probe is not production content');
    chk(verdicts.undeclared === 'unavailable',
        'and with no declared class the verdict is UNAVAILABLE, not a pass');
    for (const k of Object.keys(verdicts.byClass)) {
      const v = verdicts.byClass[k];
      note('  as ' + k.padEnd(22) + v.status.padEnd(12) + 'tri ' + v.tri + '/' + v.triBand +
           ', texture ' + v.tex + ', texel ' + v.texel);
    }
    chk(Object.keys(verdicts.byClass).every((k) => ['pass', 'advisory', 'fail', 'unavailable', 'exception']
        .indexOf(verdicts.byClass[k].status) >= 0),
        'every class produced one of the five declared statuses against the real asset');
    chk(verdicts.excepted === 'exception',
        'and a stated exception reads as EXCEPTION on real data, never as pass');

    // -------------------------------------------------------------------------------
    head('4. LIVE RUNTIME RESOURCE STATISTICS');

    const live = await page.evaluate(() => {
      const g = window.game;
      const a = measureSceneResources(g.scene, g.renderer);
      const b = measureSceneResources(g.scene, g.renderer);
      /* `renderer.info.render` DESCRIBES THE LAST RENDER CALL, NOT THE LAST FRAME OF THE
         GAME, and this build's frame ends with the PostFX full-screen quad. So reading it
         cold reports the post pass — one draw call and two triangles — which looks like a
         broken measurement and is in fact the correct answer to a differently-phrased
         question. Rendering the world explicitly and reading it immediately after is how
         you ask about the world. Both are reported below, because the difference is the
         kind of thing that costs a later phase a day. */
      g.renderer.render(g.scene, g.camera);
      const worldFrame = measureSceneResources(g.scene, g.renderer).renderer;
      return { a, b, worldFrame, same: JSON.stringify(a.scene) === JSON.stringify(b.scene) };
    });
    note('live Overworld scene: ' + live.a.scene.meshes + ' meshes, ' +
         live.a.scene.triangles.toLocaleString() + ' triangles, ' +
         live.a.scene.uniqueGeometries + ' geometries, ' + live.a.scene.materials + ' materials, ' +
         live.a.scene.textures + ' textures');
    note('renderer, read cold: ' + live.a.renderer.drawCalls + ' draw calls, ' +
         Number(live.a.renderer.drawnTriangles).toLocaleString() + ' triangles — this is the');
    note('  PostFX quad, because info.render describes the LAST RENDER CALL and the frame');
    note('  ends with the post pass. Not a broken number; a differently-phrased question.');
    note('renderer, after an explicit world render: ' + live.worldFrame.drawCalls +
         ' draw calls, ' + Number(live.worldFrame.drawnTriangles).toLocaleString() + ' triangles drawn');
    note('resident: ' + live.a.renderer.geometriesResident + ' geometries / ' +
         live.a.renderer.texturesResident + ' textures, ' + live.a.renderer.programs + ' programs');
    chk(live.a.scene.meshes > 0 && live.a.scene.triangles > 0,
        'the real streamed voxel world was measured through the real scene graph');
    chk(live.a.renderer.available === true && live.a.renderer.geometriesResident > 0,
        'and renderer.info supplied real residency numbers');
    chk(live.worldFrame.drawCalls > 1 && live.worldFrame.drawnTriangles > 1000,
        'a world render reports the world: ' + live.worldFrame.drawCalls + ' draw calls, ' +
        live.worldFrame.drawnTriangles.toLocaleString() + ' triangles');
    chk(live.worldFrame.drawnTriangles <= live.a.scene.triangles,
        'and it drew no more than is RESIDENT — the two numbers mean different things and ' +
        'are reported separately (drawn ' + live.worldFrame.drawnTriangles.toLocaleString() +
        ' of ' + live.a.scene.triangles.toLocaleString() + ' resident)');
    chk(live.same, 'two consecutive measurements of the same live scene are identical');

    /* IT MUTATES NOTHING. A measurement tool that writes to what it measures is not one. */
    const untouched = await page.evaluate(() => {
      const g = window.game;
      const before = { x: g.player.position.x, y: g.player.position.y, z: g.player.position.z,
                       hp: g.player.hp, day: g.dayCount, running: g.running,
                       children: g.scene.children.length };
      for (let i = 0; i < 25; i++) measureSceneResources(g.scene, g.renderer);
      const after = { x: g.player.position.x, y: g.player.position.y, z: g.player.position.z,
                      hp: g.player.hp, day: g.dayCount, running: g.running,
                      children: g.scene.children.length };
      return { before, after, equal: JSON.stringify(before) === JSON.stringify(after) };
    });
    chk(untouched.equal,
        'twenty-five measurements of the LIVE scene changed no player, world or scene value');

    // -------------------------------------------------------------------------------
    head('5. NOTHING AUDITS ON ITS OWN — THERE IS NO FRAME-BY-FRAME LOOP');

    /* CLAUDE.md section 14: a per-frame global scan is exactly the cost this project
       refuses. The offline suite proves there is no call site in the source; this proves
       it about the RUNNING GAME, by counting calls while the game plays. */
    const audit = await page.evaluate(async () => {
      const realCount = window.countNodeTriangles;
      const realScene = window.measureSceneResources;
      let triCalls = 0, sceneCalls = 0;
      window.countNodeTriangles = function () { triCalls++; return realCount.apply(this, arguments); };
      window.measureSceneResources = function () { sceneCalls++; return realScene.apply(this, arguments); };
      /* three.js keeps its own frame counter on renderer.info, so "the game really was
         rendering during those three seconds" is a measured fact rather than an assumption
         — otherwise a zero call count could just mean the loop had stopped. */
      const frames0 = window.game.renderer.info.render.frame;
      await new Promise((r) => setTimeout(r, 3000));
      const out = { triCalls, sceneCalls, patchable: typeof realCount === 'function',
                    framesAdvanced: window.game.renderer.info.render.frame - frames0 };
      window.countNodeTriangles = realCount;
      window.measureSceneResources = realScene;
      return out;
    });
    chk(audit.patchable, 'the measurement functions are reachable on the global, so this can be counted');
    chk(audit.framesAdvanced > 0,
        'the game really was rendering throughout — ' + audit.framesAdvanced + ' frames drawn');
    chk(audit.sceneCalls === 0,
        'THREE SECONDS of real gameplay called measureSceneResources exactly ' +
        audit.sceneCalls + ' times');
    chk(audit.triCalls === 0,
        'and countNodeTriangles ' + audit.triCalls + ' times — the guardrail costs the player nothing');

    // -------------------------------------------------------------------------------
    head('6. BASELINE COMPARISON AGAINST A REAL, STREAMING WORLD');

    const compared = await page.evaluate(async () => {
      const g = window.game;
      const base = measureSceneResources(g.scene, g.renderer);
      /* Walk, so the real streamer really does change the scene. No teleport, no debug
         command: this is the world doing what it does while somebody plays. */
      g.player.keys['KeyW'] = true;
      await new Promise((r) => setTimeout(r, 4000));
      g.player.keys['KeyW'] = false;
      await new Promise((r) => setTimeout(r, 600));
      const now = measureSceneResources(g.scene, g.renderer);
      const cmp = compareResourceMeasurements(base, now);
      const self = compareResourceMeasurements(base, base);
      return { base: base.scene, now: now.scene, cmp, selfChanged: self.changed.length };
    });
    note('before ' + compared.base.triangles.toLocaleString() + ' triangles / ' +
         compared.base.meshes + ' meshes; after ' + compared.now.triangles.toLocaleString() +
         ' / ' + compared.now.meshes + ' meshes');
    note('fields that moved: ' + (compared.cmp.changed.join(', ') || '(none)'));
    chk(compared.selfChanged === 0,
        'a live measurement compared with itself reports no change at all');
    chk(typeof compared.cmp.fields.triangles.delta === 'number',
        'and a real before/after produces a structured delta (' +
        compared.cmp.fields.triangles.delta + ' triangles)');
    chk(compared.cmp.tolerance > 0,
        'with an explicit tolerance rather than an invented threshold (' + compared.cmp.tolerance + ')');
    note('no pass/fail is asserted on these numbers: CLAUDE.md section 79 forbids claiming');
    note('a performance budget from one machine. The comparison exists so a future phase');
    note('can say "this added N triangles" instead of "this feels heavier".');

    // -------------------------------------------------------------------------------
    head('7. THE PRODUCTION BOOTSTRAP IS WHERE IT WAS');

    const after = await page.evaluate(() => {
      const g = window.game;
      return {
        running: g.running === true,
        alive: g.player.dead === false,
        dimension: g.player.dimension,
        hudVisible: (() => { const h = document.getElementById('hud');
                             return !h || h.style.display !== 'none'; })(),
        physicalIsVoxel: g.physical instanceof VoxelPhysicalWorld,
        assetsLoaded: g.assets.stats.loaded,
        productionAssets: modelAssetKeys().filter((k) => isProductionAsset(k)).length,
        sceneChildren: g.scene.children.length,
      };
    });
    chk(after.running && after.alive, 'the game is still running and the player is still alive');
    chk(after.physicalIsVoxel, 'the shipped physical world is untouched — Phase 3 replaced nothing');
    chk(after.hudVisible, 'and the HUD is where it was');
    chk(after.productionAssets === 0,
        'the registry still ships ZERO production assets — nothing was authored by this phase');
    chk(errors.length === 0, 'no page error in the whole run' + (errors.length ? ': ' + errors[0] : ''));

  } catch (e) {
    chk(false, 'RUN FAILED: ' + (e && e.message ? e.message : String(e)));
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail === 0) {
    console.log('ALL BROWSER VISUAL BUDGET CHECKS PASS');
    note('Live, over HTTP, in a real browser, against a real decoded GLB and the real');
    note('streamed world. This proves the measurements are real. It proves nothing about');
    note('whether the budgets are the right budgets — that is a human judgement.');
  } else {
    console.log(fail + ' BROWSER VISUAL BUDGET FAILURES');
  }
  process.exit(fail === 0 ? 0 : 1);
})();
