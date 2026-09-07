/* PHASE 32 — FAKE HAVEN, IN A REAL BROWSER.

   This one IS a browser. It launches Chromium through Playwright, serves game.html over
   HTTP, boots the real game with a real WebGL context, starts a real New Game and then
   enters the Haven through the real entry point — `_beginFakeHavenSequence()`, which is
   the function the Level 3 Core Disk pickup calls and the only one that exists.

   WHAT IT PROVES. That the entry really flushes the world and builds the cabin; that
   control and pointer lock really come back; that the first minutes really contain no
   horror state of any kind; that the stage machine really advances through all six
   stages against a live renderer; that the anomaly really appears on the mantel only
   once the player has looked away; that the dissolution really changes the fog and the
   shader; that saving and loading are really refused; that nothing hostile is anywhere
   in the scene while the Haven is intact; and that entering it twice leaves no duplicate
   audio, no duplicate scene objects and no orphaned timer.

   WHAT IT DOES NOT PROVE. Whether any of it feels like anything. Screenshots are written
   for a person to look at and are best-effort — see the note on `shoot`.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_HAVEN_PORT || 8237);

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; }
}
if (!chromium) {
  console.log('SKIP  playwright is not installed — browser validation not run.');
  process.exit(0);
}

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));
const shots = [];

/* Best-effort, and says which ones were written: capturing this page while the WebGL
   loop runs times out under SwiftShader. No assertion depends on one. */
async function shoot(page, name) {
  try {
    await page.screenshot({ path: path.join(OUT, name), timeout: 20000 });
    shots.push(name + ' ✓');
    return true;
  } catch (e) { shots.push(name + ' ✗ (' + (e.name || 'error') + ')'); return false; }
}

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

/* Everything the assertions read, gathered in ONE page call so no check can ever compare
   two different moments. Real runtime objects, real uniforms, real computed styles. */
const SNAP = () => {
  const g = window.game, p = g.player, w = g.world, s = g.sound;
  const el = (id) => document.getElementById(id);
  return {
    // --- where we are ---------------------------------------------------------------
    inHaven: !!p.inFakeHaven, running: !!g.running, loop: !!g._loopRunning,
    havenBuilt: !!w.fakeHavenBuilt, havenActive: !!w.fakeHavenActive,
    havenCorrupted: !!w.havenCorrupted,
    t: +(g.havenTimer || 0).toFixed(2), stage: g.havenStageId,
    shifted: !!g.havenShiftTriggered, climax: !!g.climaxTriggered,
    bedEnding: !!g.havenBedEnding,

    // --- the body -------------------------------------------------------------------
    movementLocked: !!p.movementLocked, dead: !!p.dead, hp: p.hp, maxHp: p.maxHp,
    sanity: g.sanity.value, pos: [Math.round(p.position.x), Math.round(p.position.y), Math.round(p.position.z)],
    keysHeld: Object.keys(p.keys).filter(k => p.keys[k] === true),

    // --- what is in the world -------------------------------------------------------
    chunks: w.chunks.size,
    mobs: g.mobs.mobs ? g.mobs.mobs.length : -1,
    stalkerAlive: !!(g.stalker && g.stalker.active),
    phantoms: g.phantoms && g.phantoms.list ? g.phantoms.list.length : 0,
    items: g.itemManager.entities.length,
    /* PHASE 33 — `voidSovereign` is gone from the build; what "the finale entity has
       arrived" means now is that the finale scene, which contains the creature, has been
       built. Same claim, current mechanism. */
    sovereign: !!(w.finale && w.finale.creature),
    spawningDisabled: !!g.mobs.spawningDisabled,
    behemothGate: !!g.behemothSpawned,
    sceneChildren: g.scene.children.length,
    warmLights: w.havenWarmLights ? w.havenWarmLights.length : -1,
    fire: !!w.havenFire, bed: !!w.havenBedGroup, chest: !!w.havenChestGroup,

    // --- the anomaly ----------------------------------------------------------------
    armed: w.havenAnomalyArmed,
    anomalyDone: w.havenAnomalyDone ? Array.from(w.havenAnomalyDone) : [],
    mantel: (() => {
      const st = window.__mantel; if (!st) return null;
      return w.getBlockWorld(st.x, st.y, st.z);
    })(),

    // --- the renderer ---------------------------------------------------------------
    havenFade: g.postfx.uniforms.uHavenFade.value,
    voidGlitch: g.postfx.uniforms.uVoidGlitch.value,
    shake: g.shakeTime,
    horror: g.postfx.uniforms.uHorror.value,
    envDissolve: g.env.havenDissolve,
    fogDensity: +g.env.fog.density.toFixed(5),
    fogColor: g.env.fog.color.getHexString(),
    ambient: +g.env.ambient.intensity.toFixed(3),
    sunIntensity: +g.env.sun.intensity.toFixed(3),

    // --- audio ----------------------------------------------------------------------
    havenMode: !!s.fakeHavenMode, ambience: !!s.havenAmbience,
    musicThin: !!s.havenMusicThin, musicSilent: !!s.havenMusicSilent,
    nightmare: !!s.nightmareMode,
    havenVoices: s.havenVoices ? s.havenVoices.length : -1,
    activeMusic: s.activeMusicIds ? Array.from(s.activeMusicIds) : [],
    suburbiaMode: !!s.suburbiaMode,

    // --- the interface --------------------------------------------------------------
    banner: (() => { const n = el('dimensionBanner');
      return n && n.classList.contains('active') ? n.textContent : null; })(),
    bannerHaven: (() => { const n = el('dimensionBanner');
      return !!(n && n.classList.contains('haven')); })(),
    objective: (() => { const n = el('journeyStep');
      return n && n.className.indexOf('show') >= 0 ? n.textContent : null; })(),
    objectiveId: g.objectives ? g.objectives.currentId : null,
    saveBlocked: g.saveBlockedReason(),
    pointerLock: !!document.pointerLockElement,
    hudHidden: el('hud').classList.contains('film-hidden'),
  };
};

(async () => {
  const hermetic = fs.existsSync(VENDOR_THREE);
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/pointer ?lock/i.test(t)) return;      // never granted to a headless page
    if (/AudioContext|user gesture/i.test(t)) return;
    errors.push('console: ' + t);
  });
  if (hermetic) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('!!window.game', null, { timeout: 120000 });
    await page.waitForTimeout(400);

    // Start a real run and get past the opening film through its own skip.
    await page.click('#clickPlay');
    await page.waitForTimeout(600);
    await page.evaluate('window.game.film && window.game.film.active && window.game.film.skip()');
    await page.waitForFunction('window.game.running === true', null, { timeout: 60000 });
    await page.waitForTimeout(600);

    const before = await page.evaluate(SNAP);

    // =================================================================================
    head('1. THE ENTRY');
    // =================================================================================
    chk(before.running && !before.inHaven, 'a real run is going and the player is not in the Haven yet');
    chk(!before.havenBuilt,
        'and the Haven does not exist at all until the player is taken to it');

    /* A REAL SAVE, WRITTEN BEFORE THE DOOR CLOSES. The autosave is event-based and fires
       on the two dimension crossings, so a run taken straight from the Overworld into the
       Haven has never written one — and "the Haven did not corrupt a save" is a vacuous
       claim if there was no save. This writes one explicitly, from the Overworld, where
       saving is allowed, and section 3 checks that not one byte of it moves afterwards. */
    await page.evaluate("window.game.saveGame('manual')");
    await page.waitForTimeout(200);
    const savedBefore = await page.evaluate("localStorage.getItem('whereitisnt.save.v1')");
    chk(!!savedBefore && savedBefore.length > 100,
        `a real save was written from the Overworld first (${savedBefore ? savedBefore.length : 0} bytes)`);

    /* The real entry point — the one the Level 3 Core Disk pickup calls. */
    await page.evaluate('window.game._beginFakeHavenSequence()');
    const washing = await page.evaluate(SNAP);
    chk(washing.movementLocked, 'the entry locks the body immediately, before anything is shown');

    // Beat 2 lands at ~1.5s and beat 3 hands control back ~0.4s later.
    await page.waitForFunction('window.game.player.inFakeHaven === true', null, { timeout: 20000 });
    await page.waitForTimeout(1400);
    await page.evaluate(`window.__mantel = (function(){ return ENV_SITES.havenMantel(); })()`);
    const arrived = await page.evaluate(SNAP);

    chk(arrived.inHaven && arrived.havenBuilt && arrived.havenActive,
        'the player arrives in a built, active Haven');
    chk(!arrived.movementLocked, 'control is handed back — the body is not left locked');
    chk(arrived.loop && arrived.running, 'the frame loop is still running');
    chk(arrived.chunks === 9,
        `the world behind them is genuinely gone: ${arrived.chunks} chunks resident, which is the pocket`);
    chk(arrived.fire && arrived.bed && arrived.chest && arrived.warmLights >= 4,
        `the cabin is furnished and lit (${arrived.warmLights} warm lights, a fire, a bed, a chest)`);
    chk(arrived.hp === arrived.maxHp && arrived.sanity === 100,
        'and the player arrives whole — full health, settled mind');
    chk(arrived.banner === 'THE HAVEN' && arrived.bannerHaven,
        `the banner reads "${arrived.banner}" and never the word "fake"`);
    chk(!arrived.hudHidden, 'the HUD is present');
    await shoot(page, 'haven-1-arrival.png');

    // =================================================================================
    head('2. THE FIRST MINUTES CONTAIN NO HORROR AT ALL');
    // =================================================================================
    chk(arrived.horror === 0, 'the horror grading is switched off at the shader');
    chk(arrived.voidGlitch === 0, 'the void glitch is at zero');
    chk(arrived.havenFade === 0 && arrived.envDissolve === 0, 'and nothing is dissolving');
    chk(arrived.mobs === 0 && !arrived.stalkerAlive && arrived.phantoms === 0,
        'there is not one mob, Stalker or hallucination in the world');
    chk(!arrived.sovereign, 'and the finale entity does not exist');
    chk(arrived.spawningDisabled || arrived.behemothGate,
        'spawning is latched off, so nothing can arrive later either');
    chk(arrived.havenMode && arrived.ambience,
        'the warm ambience rig is running and the horror beds are gated off');
    chk(!arrived.nightmare && !arrived.suburbiaMode,
        'neither the collapse nor the previous dimension is sounding');
    chk(!arrived.musicThin && !arrived.musicSilent, 'the music is at full');
    chk(arrived.objective === 'Rest.', `the objective is one word: "${arrived.objective}"`);
    chk(arrived.stage === 'arrival', `and the sequence is in its first stage (${arrived.stage})`);
    chk(arrived.fogDensity < 0.01 && arrived.fogColor === '7ec0ee',
        `the sky is the bright Haven blue at high visibility (#${arrived.fogColor}, density ${arrived.fogDensity})`);

    // =================================================================================
    head('2b. THE CABIN SURVIVES BEING ATTACKED');
    // =================================================================================
    /* Driven for real: face a wall, hold the left button down for several seconds of
       actual frames, and count the blocks afterwards. Before Phase 32 this took the wall
       apart. */
    const attack = await page.evaluate(`(async () => {
      const g = window.game, w = g.world, p = g.player;
      const minX = FAKE_HAVEN_CHUNK_OFFSET * CHUNK_SX, span = FAKE_HAVEN_CHUNKS_SPAN * CHUNK_SX;
      const cX = minX + Math.floor(span / 2), cZ = minX + Math.floor(span / 2);
      const baseY = FAKE_HAVEN_BASE_Y, half = Math.floor(FAKE_HAVEN_CABIN_SIZE / 2);
      const count = () => { let n = 0;
        for (let x = cX - half; x <= cX + half; x++)
          for (let y = baseY - 1; y < baseY + 6; y++)
            for (let z = cZ - half; z <= cZ + half; z++)
              if (w.getBlockWorld(x, y, z) !== BLOCK.AIR) n++;
        return n; };
      const before = count();
      // Stand inside, one block off the north wall, facing it.
      p.position.set(cX, baseY, cZ - half + 3);
      g.camera.position.set(cX, baseY + 1.6, cZ - half + 3);
      p.yaw = Math.atan2(0, 1);            // facing -z, into the hearth wall
      p.mining = true; p._startMining();
      await new Promise(r => { let n = 0;
        const tick = () => { p._startMining(); if (++n >= 40) r(); else requestAnimationFrame(tick); };
        requestAnimationFrame(tick); });
      const after = count();
      const promptEl = document.getElementById('interactPrompt');
      return { before, after, mining: !!p.mining, progress: p.breakProgress,
               prompt: promptEl ? promptEl.textContent : '' };
    })()`);
    chk(attack.after === attack.before,
        `holding the break button at a cabin wall for forty frames removed nothing ` +
        `(${attack.before} blocks before, ${attack.after} after)`);
    chk(!attack.mining && attack.progress === 0,
        'no mining state or break progress accumulates at all');
    chk(!/CHOP|MINE|BREAK|PLACE/i.test(attack.prompt),
        `and the prompt never offers a verb the dimension refuses (showed "${attack.prompt.trim() || 'nothing'}")`);

    // =================================================================================
    head('3. THE SAVE CANNOT BE TOUCHED FROM IN HERE');
    // =================================================================================
    chk(!!arrived.saveBlocked, `saving is refused: "${arrived.saveBlocked}"`);
    const saveAttempt = await page.evaluate(`(() => {
      const g = window.game;
      const before = localStorage.getItem('whereitisnt.save.v1');
      g.saveGame('manual');
      g.autosave();
      const after = localStorage.getItem('whereitisnt.save.v1');
      const load = g.loadGame();
      return { before: before, after: after, loadOk: !!load.ok,
               stillHaven: !!g.player.inFakeHaven };
    })()`);
    chk(saveAttempt.before === savedBefore,
        'the Overworld save is still exactly as it was written');
    chk(saveAttempt.after === savedBefore,
        'and neither an explicit save nor an autosave from inside the Haven changed one byte of it');
    chk(!saveAttempt.loadOk && saveAttempt.stillHaven,
        'loading from inside the Haven is refused and leaves the player where they were');

    // =================================================================================
    head('4. THE STAGES ADVANCE AGAINST A LIVE RENDERER');
    // =================================================================================
    /* Driven by moving the Haven's one number and letting the REAL frame loop resolve it,
       rather than by calling the stage machine directly — so what is asserted is what a
       player would actually be standing in. */
    /* SwiftShader runs this page at a few frames a second, and every value below is
       written by a FRAME rather than by the assignment above it. So each sample waits for
       the renderer to actually catch up with the clock it was given, instead of for a
       wall-clock interval that may contain no frame at all. Getting this wrong is what
       made the first draft of this file report a dissolve that never deepened. */
    const settle = async (target) => {
      await page.evaluate(`window.game.havenTimer = ${target};`);
      await page.waitForFunction(
        `Math.abs(window.game.postfx.uniforms.uHavenFade.value -
                  havenDissolveAt(window.game.havenTimer)) < 0.02 &&
         window.game.havenStageId === havenStageAt(window.game.havenTimer).id`,
        null, { timeout: 30000 });
      /* THE FOG NEEDS ITS OWN WAIT, and the reason is a real (and deliberately unfixed)
         property of the build: EnvironmentSystem.update() runs EARLIER in the frame loop
         than the Haven block that writes the dissolve, so the sky and fog always render
         the previous frame's value while the shader renders this one's. At sixty frames a
         second that is sixteen milliseconds on a twenty-six second ramp and nobody will
         ever see it; on this page, which renders at a few frames a second, it is most of
         a second and it made the first draft of this file report a fog that never closed
         in. Measuring it correctly is the test's job — reordering the frame loop around
         every other dimension's update would be a far riskier change than the defect. */
      await page.waitForFunction(
        `Math.abs(window.game.env.fog.density -
                  (0.006 + havenDissolveAt(window.game.havenTimer) * 0.069)) < 0.004`,
        null, { timeout: 30000 });
      return page.evaluate(SNAP);
    };
    /* THE LAST SAMPLE STOPS SHORT OF THE END ON PURPOSE. `settle` waits for the renderer
       to catch up, and the clock keeps running while it does — so a sample at 177 of a
       178-second Haven can tip past the end mid-wait and fire the shift. That used to be
       survivable; since Phase 33 the shift calls `clearHavenForFinale()`, which disposes
       the pocket's chunks, and section 5 below then has no cabin left to put a mug in.
       172 is deep inside the dissolution (77% of the way through it) with six seconds of
       headroom. */
    const seen = [];
    for (const target of [20, 50, 90, 130, 160, 172]) seen.push(await settle(target));
    const [settled, perfect, noticing, thinning, ending, late] = seen;

    chk(settled.stage === 'settled' && perfect.stage === 'perfect' &&
        noticing.stage === 'noticing' && thinning.stage === 'thinning' &&
        ending.stage === 'ending',
        'the live game walks through settled -> perfect -> noticing -> thinning -> ending');
    chk(!settled.shifted && !perfect.shifted && !noticing.shifted && !thinning.shifted,
        'and nothing has ended before the final stage');
    chk(noticing.armed === 'haven_second_mug' || noticing.anomalyDone.length > 0,
        'the noticing stage arms the one committed change');
    chk(thinning.musicThin && !thinning.musicSilent,
        'the thinning stage takes the bass out of the music but leaves the tune');
    chk(ending.musicSilent, 'and the final stage stops queueing bars at all');
    chk(!noticing.sovereign && !thinning.sovereign && !ending.sovereign,
        'the finale entity has still not appeared at any point in the intact sequence');
    chk(noticing.horror === 0 && thinning.horror === 0,
        'and the horror grading is still off through all of it');

    // THE DISSOLUTION — measured, not asserted from the table.
    chk(thinning.havenFade === 0 && thinning.envDissolve === 0,
        'nothing is fading before the final stage');
    chk(ending.havenFade > 0 && ending.envDissolve > 0,
        `the final stage really is dissolving (fade ${ending.havenFade.toFixed(2)})`);
    chk(late.havenFade > ending.havenFade,
        `and it deepens as it runs (${ending.havenFade.toFixed(2)} -> ${late.havenFade.toFixed(2)})`);
    chk(late.fogDensity > ending.fogDensity && late.fogDensity > arrived.fogDensity * 5,
        `the fog closes in (${arrived.fogDensity} -> ${late.fogDensity})`);
    chk(late.fogColor !== arrived.fogColor,
        `the sky drains (#${arrived.fogColor} -> #${late.fogColor})`);
    chk(late.ambient < arrived.ambient && late.sunIntensity < arrived.sunIntensity,
        `and the light collapses (ambient ${arrived.ambient} -> ${late.ambient})`);
    chk(late.objective === null,
        'the objective line is gone before the shift, not at it');
    chk(!late.shifted && !late.sovereign,
        'and the finale has still not started while the Haven is merely fading');
    await shoot(page, 'haven-2-dissolving.png');

    // =================================================================================
    head('5. THE ONE COMMITTED CHANGE, IN A LIVE WORLD');
    // =================================================================================
    const notEnded = await page.evaluate('!window.game.havenShiftTriggered');
    chk(notEnded,
        'the Haven has not ended yet — this section rewinds its clock and needs a cabin to rewind into');
    const mugRun = await page.evaluate(`(async () => {
      const g = window.game, w = g.world, st = window.__mantel;
      // Rewind to the noticing stage and re-arm, so this is driven from a clean state.
      w.havenAnomalyDone.clear();
      w._writeBlockRaw(st.x, st.y, st.z, BLOCK.BRICK);
      g.havenTimer = 90; g.havenStageId = null;
      /* The player re-derives camera.rotation.y from its own yaw every frame, so setting
         the camera directly is overwritten before the anomaly sweep ever reads it. Set the
         yaw the player actually uses: forward is (-sin yaw, 0, -cos yaw). */
      const face = (fx, fz) => { g.player.yaw = Math.atan2(-fx, -fz); };
      const put = (x, z) => { g.player.position.set(x, FAKE_HAVEN_BASE_Y, z); g.camera.position.set(x, FAKE_HAVEN_BASE_Y + 1.6, z); };
      /* THE SWEEP RUNS AT 2Hz OFF ACCUMULATED dt, so what it needs is SIMULATED TIME, and
         waiting for a fixed number of frames gets that wrong in both directions: eight
         frames is 1.3 seconds on a starved SwiftShader page and 0.13 seconds on a fast
         one — under half a single sweep. This waits for real elapsed time AND for frames
         to have actually run, which is the only formulation that holds at both ends. */
      const wait = () => new Promise(r => {
        const t0 = performance.now();
        let n = 0;
        const tick = () => {
          n++;
          if (performance.now() - t0 >= 2200 && n >= 4) r();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const out = {};
      // Standing at the hearth, looking straight at it.
      put(st.x, st.z + 2); face(0, -1); await wait(); await wait();
      out.closeLooking = w.getBlockWorld(st.x, st.y, st.z);
      // Across the room, still looking at it.
      put(st.x, st.z + 9); face(0, -1); await wait(); await wait();
      out.farLooking = w.getBlockWorld(st.x, st.y, st.z);
      // Away from it and looking the other way.
      put(st.x, st.z + 9); face(0, 1); await wait(); await wait();
      out.farAway = w.getBlockWorld(st.x, st.y, st.z);
      out.cream = BLOCK.SIDE_CREAM; out.brick = BLOCK.BRICK;
      out.done = Array.from(w.havenAnomalyDone);
      return out;
    })()`);
    chk(mugRun.closeLooking === mugRun.brick,
        'standing at the hearth looking at it, nothing appears');
    chk(mugRun.farLooking === mugRun.brick,
        'across the room still looking at it, nothing appears');
    chk(mugRun.farAway === mugRun.cream,
        'and only once the player is away from it and facing the other way does it appear');
    chk(mugRun.done.indexOf('haven_second_mug') >= 0, 'the change is latched as done');

    // =================================================================================
    head('6. THE HANDOFF, AND WHAT IT HANDS OVER');
    // =================================================================================
    await page.evaluate('window.game.havenTimer = HAVEN_SHIFT_SECONDS + 1;');
    /* CATCH IT ON THE FRAME IT HAPPENS. A fixed delay here is wrong at both ends: the
       shift needs one frame to fire, and the climax follows it only CLIMAX_SECONDS of
       SIMULATED time later — so on a page that stalls, a single frame carrying a
       multi-second dt can take the sequence straight past the collapse into the credits,
       where the void glitch is legitimately back to zero. Waiting on the condition itself
       cannot overshoot. */
    await page.waitForFunction('window.game.havenShiftTriggered === true',
                               null, { timeout: 30000, polling: 'raf' });
    /* NOTE: `settle` in this file is the stage-driving helper above, not a wait — it takes
       a Haven second and assigns it. Waiting is done with waitForFunction directly. */
    await page.waitForFunction('window.game.finale && window.game.finale.active === true',
                               null, { timeout: 30000, polling: 'raf' });
    const shifted = await page.evaluate(SNAP);
    chk(shifted.shifted, 'running out of Haven fires the shift');
    chk(shifted.havenCorrupted, 'the cabin decays');
    chk(shifted.sovereign,
        'and the finale creature arrives — for the first time in the run');
    chk(shifted.havenFade === 0 && shifted.envDissolve === 0,
        'the dissolve is handed back at the boundary, so the two sequences never overlap by a frame');
    /* PHASE 33 INVERTED THIS ASSERTION, DELIBERATELY. Phase 32 handed the renderer to a
       collapse: horror grading back on and the void glitch driven to full. Phase 33's
       finale needs the opposite — a legible frame, because the whole of it is a judgement
       about the SIZE of something three hundred metres away, and nobody can judge the
       size of anything through datamosh. The handoff now hands the renderer back CLEAN,
       and this is the check that it stays that way. */
    chk(shifted.voidGlitch === 0 && shifted.horror === 0,
        'the finale takes the renderer CLEAN — no glitch, no grading');
    chk(shifted.shake === 0 || shifted.shake === undefined,
        'and no camera shake');
    chk(shifted.nightmare && !shifted.ambience,
        'and the warm ambience rig is stopped rather than left playing under the static');
    chk(shifted.objective === null, 'nothing is asked of the player from here');
    await shoot(page, 'haven-3-handoff.png');

    // =================================================================================
    head('7. RE-ENTRY LEAVES NOTHING BEHIND');
    // =================================================================================
    /* A New Game is the same teardown a Load runs. Everything the Haven touched must be
       back where it started, and a second visit must not double anything. */
    await page.evaluate('window.game.newGame()');
    await page.waitForTimeout(700);
    const reset = await page.evaluate(SNAP);
    chk(!reset.inHaven && !reset.shifted && !reset.climax,
        'a New Game leaves the Haven entirely');
    chk(reset.t === 0 && reset.stage === null && !reset.bedEnding,
        'with the stage machine back at zero');
    chk(reset.havenFade === 0 && reset.envDissolve === 0 && reset.voidGlitch === 0,
        'and a clean screen — no fade, no glitch');
    chk(!reset.havenMode && !reset.ambience,
        'the Haven audio mode and its ambience rig are both off');
    chk(reset.keysHeld.length === 0, 'no key is left held down');
    chk(!reset.movementLocked, 'and the body is not left locked');

    const first = reset.sceneChildren;
    await page.evaluate('window.game._beginFakeHavenSequence()');
    await page.waitForFunction('window.game.player.inFakeHaven === true', null, { timeout: 20000 });
    await page.waitForTimeout(1400);
    const second = await page.evaluate(SNAP);
    chk(second.inHaven && second.havenBuilt, 'and the Haven can be entered again');
    chk(second.warmLights === arrived.warmLights,
        `with the same ${second.warmLights} warm lights as the first visit, not twice as many`);
    chk(second.ambience && second.havenMode,
        'the ambience rig is running once');
    chk(second.activeMusic.filter(id => id === 'haven_chiptune').length <= 1,
        `and the theme is playing at most once (${second.activeMusic.join(', ') || 'none'})`);
    chk(second.chunks === 9, `the pocket is still ${second.chunks} chunks, not eighteen`);
    chk(Math.abs(second.sceneChildren - first) < 400,
        `the scene has not accumulated (${first} -> ${second.sceneChildren} children)`);

    // No orphaned timer: after everything above, nothing may still be firing into a
    // dimension that is gone.
    await page.evaluate('window.game.newGame()');
    await page.waitForTimeout(1600);
    const settled2 = await page.evaluate(SNAP);
    chk(!settled2.inHaven && !settled2.havenMode && !settled2.ambience,
        'and a second New Game a moment later finds nothing still running');

    console.log('');
    note('screenshots: ' + (shots.length ? shots.join(', ') : 'none'));
    chk(errors.length === 0,
        'no uncaught page errors across the whole run' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
  } catch (e) {
    console.log('FAIL  the browser run threw: ' + (e && e.message ? e.message : e));
    fail++;
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail) { console.log(`${fail} BROWSER HAVEN CHECK(S) FAILED`); process.exit(1); }
  console.log('ALL BROWSER HAVEN CHECKS PASS');
  note('A real Chromium, a real WebGL context, a real New Game and the real entry point.');
  note('What is NOT claimed: that the cabin is comforting, that losing it costs anything,');
  note('or that a person notices a second mug. Those are judgements for a person and the');
  note('phase report says who has and has not made them.');
})();
