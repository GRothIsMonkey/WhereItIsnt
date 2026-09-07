/* PHASE 33 — THE FINAL CREATURE, IN A REAL BROWSER.

   This one IS a browser. It launches Chromium through Playwright, serves game.html over
   HTTP, boots the real game with a real WebGL context, plays a real New Game, enters the
   Haven through the real entry point, runs the Haven out, and watches the finale happen.

   WHAT IT PROVES. That the Haven really hands off; that the sequence really begins in
   silence with nothing rendered in it; that the world behind the player is really gone and
   the finale's own ground is really there; that the creature is really a hundred and fifty
   metres of unlit silhouette and really the only thing spawned; that all seven beats really
   run against a live renderer in the right order; that the fog really opens and the eye
   really lifts; that the camera is a drift a player can really fight; that gameplay input
   really does nothing; that the hard cut really reaches the credits exactly once; that
   pointer lock is really released and no audio survives; and that a New Game afterwards
   really leaves nothing behind.

   WHAT IT DOES NOT PROVE. Whether any of it is frightening. The full human Era 1
   playthrough is intentionally deferred until Phase 36 and no claim here depends on one.
   Screenshots are written for a person to look at and are best-effort — see `shoot`.

   RUN IT ALONE. Two Chromium instances starve each other's frame loop and this file waits
   on rendered state; see the note in tests/README.md.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_FINALE_PORT || 8241);

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

async function shoot(page, name) {
  try {
    await page.screenshot({ path: path.join(OUT, name), timeout: 25000 });
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

/* Everything the assertions read, in ONE page call, so no check can compare two moments. */
const SNAP = () => {
  const g = window.game, p = g.player, w = g.world, s = g.sound, f = g.finale;
  const el = (id) => document.getElementById(id);
  const shown = (id) => { const e = el(id); return !!e && getComputedStyle(e).display !== 'none'; };
  return {
    // --- the sequence -----------------------------------------------------------------
    shifted: !!g.havenShiftTriggered, climax: !!g.climaxTriggered,
    active: !!(f && f.active), done: !!(f && f.done),
    t: f ? +f.t.toFixed(2) : null, beat: f ? f.beat : null,
    built: !!w.finale,
    // --- what is in the world ---------------------------------------------------------
    chunks: w.chunks.size,
    mobs: g.mobs.mobs ? g.mobs.mobs.length : -1,
    stalker: !!(g.stalker && g.stalker.active),
    phantoms: g.phantoms && g.phantoms.list ? g.phantoms.list.length : 0,
    sceneChildren: g.scene.children.length,
    creature: (() => {
      if (!w.finale || !w.finale.creature) return null;
      const c = w.finale.creature;
      const b = new THREE.Box3().setFromObject(c.group);
      const sz = b.getSize(new THREE.Vector3());
      let meshes = 0, lights = 0, lit = 0;
      c.group.traverse(o => {
        if (o.isMesh) { meshes++; if (o.material && o.material.type !== 'MeshBasicMaterial') lit++; }
        if (o.isLight) lights++;
      });
      return { h: +sz.y.toFixed(1), w: +Math.max(sz.x, sz.z).toFixed(1), meshes, lights, lit,
               headY: +c.head.rotation.y.toFixed(3), headZ: +c.head.rotation.z.toFixed(3),
               armZ: +c.arms[0].pivot.rotation.z.toFixed(3),
               dist: +Math.abs(c.group.position.z).toFixed(0) };
    })(),
    landmarks: w.finale ? w.finale.scene.parts.length : 0,
    // --- the body ---------------------------------------------------------------------
    movementLocked: !!p.movementLocked, mining: !!p.mining,
    yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3),
    keysHeld: Object.keys(p.keys).filter(k => p.keys[k] === true),
    pos: [Math.round(p.position.x), Math.round(p.position.y), Math.round(p.position.z)],
    edits: (() => { let n = 0; for (const m of w.editedChunks.values()) n += m.size; return n; })(),
    // --- the renderer -----------------------------------------------------------------
    fog: +g.env.fog.density.toFixed(5), fogColor: g.env.fog.color.getHexString(),
    voidGlitch: g.postfx.uniforms.uVoidGlitch.value,
    horror: g.postfx.uniforms.uHorror.value,
    havenFade: g.postfx.uniforms.uHavenFade.value,
    shake: g.shakeTime,
    // --- audio ------------------------------------------------------------------------
    finaleAudio: !!s.finaleAudio, havenAmbience: !!s.havenAmbience,
    activeMusic: s.activeMusicIds ? Array.from(s.activeMusicIds) : [],
    masterGain: s.master ? +s.master.gain.value.toFixed(3) : null,
    // --- the interface ----------------------------------------------------------------
    hudShown: shown('hud'), crossShown: shown('crosshair'),
    creditsOn: !!(el('creditsScreen') && el('creditsScreen').classList.contains('active')),
    blackCut: !!(el('blackCut') && el('blackCut').classList.contains('on')),
    banner: (() => { const n = el('dimensionBanner');
      return n && n.classList.contains('active') ? n.textContent : null; })(),
    objective: (() => { const n = el('journeyStep');
      return n && n.className.indexOf('show') >= 0 ? n.textContent : null; })(),
    pointerLock: !!document.pointerLockElement,
    saveBlocked: g.saveBlockedReason(),
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
    if (/pointer ?lock/i.test(t)) return;
    if (/AudioContext|user gesture/i.test(t)) return;
    errors.push('console: ' + t);
  });
  if (hermetic) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }

  /* Wait for a RENDERED condition rather than a wall-clock interval. This page runs at a
     few frames a second under SwiftShader and every value below is written by a frame; a
     fixed delay is wrong at both ends and produced two false failures while this file was
     being written. */
  const settle = (expr, ms) => page.waitForFunction(expr, null, { timeout: ms || 40000, polling: 'raf' });

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('!!window.game', null, { timeout: 120000 });
    await page.waitForTimeout(400);
    await page.click('#clickPlay');
    await page.waitForTimeout(600);
    await page.evaluate('window.game.film && window.game.film.active && window.game.film.skip()');
    await settle('window.game.running === true', 60000);
    await page.waitForTimeout(600);

    // A real save, from the Overworld, before anything terminal happens.
    await page.evaluate("window.game.saveGame('manual')");
    await page.waitForTimeout(200);
    const savedBefore = await page.evaluate("localStorage.getItem('whereitisnt.save.v1')");

    // =================================================================================
    head('1. THE HAVEN HANDS OFF');
    // =================================================================================
    const beforeFinale = await page.evaluate(SNAP);
    chk(!beforeFinale.built && !beforeFinale.shifted,
        'before the Haven ends there is no finale and no creature anywhere');

    await page.evaluate('window.game._beginFakeHavenSequence()');
    await settle('window.game.player.inFakeHaven === true', 30000);
    await page.waitForTimeout(1400);
    const inHaven = await page.evaluate(SNAP);
    chk(inHaven.built === false, 'and none while the player is standing in the Haven');
    chk(inHaven.creature === null, 'the creature does not exist');

    // Run the Haven out through its own clock.
    await page.evaluate('window.game.havenTimer = HAVEN_SHIFT_SECONDS + 1;');
    await settle('window.game.havenShiftTriggered === true');
    await settle('window.game.finale && window.game.finale.active === true');
    const begun = await page.evaluate(SNAP);
    chk(begun.shifted && begun.active, 'running the Haven out begins the final sequence');
    chk(begun.built, 'and builds the finale');

    // =================================================================================
    head('2. THE RENDERER IS HANDED BACK CLEAN');
    // =================================================================================
    chk(begun.voidGlitch === 0, 'no void glitch — the frame is legible');
    chk(begun.horror === 0, 'no horror grading');
    chk(begun.havenFade === 0, 'no leftover Haven dissolve');
    chk(begun.shake === 0, 'and no camera shake');
    chk(begun.fogColor !== '4a0000', `the sky is not the blood red of the old ending (#${begun.fogColor})`);
    chk(!begun.hudShown && !begun.crossShown, 'the HUD and crosshair are gone for the sequence');
    chk(begun.objective === null, 'nothing is asked of the player');
    chk(begun.banner === null, 'and no dimension banner is up');

    // =================================================================================
    head('3. IT BEGINS IN SILENCE, WITH NOTHING IN IT');
    // =================================================================================
    chk(begun.beat === 'silence', `the first beat is ${begun.beat}`);
    chk(begun.finaleAudio, 'the audio rig is running');
    chk(!begun.havenAmbience, 'and the Haven ambience is stopped, not left playing underneath');
    chk(begun.fog >= 0.007,
        `the fog is at its thickest (${begun.fog}) — the creature is not visible in this beat`);
    chk(begun.mobs === 0 && !begun.stalker && begun.phantoms === 0,
        'there is not one mob, Stalker or hallucination anywhere');
    await shoot(page, 'finale-1-silence.png');

    // =================================================================================
    head('4. THE CREATURE IS WHAT IT SAYS IT IS');
    // =================================================================================
    const c = begun.creature;
    chk(!!c, 'the creature is in the scene');
    chk(c.h > 130, `it is ${c.h} metres tall in world units`);
    /* A human is about 4:1. The offline suite holds the floor at 5.5 and explains why;
       this is the same claim measured on the live object. */
    chk(c.h / c.w > 5.5, `and ${(c.h / c.w).toFixed(1)}x taller than wide — a human is about 4:1`);
    chk(c.dist >= 300, `standing ${c.dist} metres away`);
    chk(c.lights === 0, 'it carries no light of its own');
    chk(c.lit === 0, `and not one of its ${c.meshes} meshes uses a lit material`);
    chk(begun.landmarks > 20,
        `${begun.landmarks} silhouettes stand between the player and it, to read its size against`);
    chk(begun.chunks === 0,
        `the voxel world behind the player is gone entirely (${begun.chunks} chunks) — ` +
        "this ground is the finale's own, and nothing of the cabin is left in the way");

    // =================================================================================
    head('5. GAMEPLAY INPUT CANNOT TOUCH IT');
    // =================================================================================
    chk(begun.movementLocked, 'the body is locked');
    const before = await page.evaluate(SNAP);
    await page.keyboard.down('w');
    await page.keyboard.press('e');
    await page.keyboard.press('i');
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.keyboard.up('w');
    const after = await page.evaluate(SNAP);
    chk(after.pos[0] === before.pos[0] && after.pos[2] === before.pos[2],
        'leaning on the movement keys moves the player nowhere');
    chk(after.edits === before.edits, `and holding the mouse button breaks nothing (${after.edits} edits)`);
    chk(!after.mining, 'no mining state is entered');
    chk(await page.evaluate('window.game.ui.craftingOpen || window.game.ui.backpackOpen') === false,
        'and no overlay opens');

    // =================================================================================
    head('6. ALL SEVEN BEATS RUN AGAINST A LIVE RENDERER');
    // =================================================================================
    const seen = {};
    const order = [];
    for (const id of ['impression', 'scale', 'movement', 'face', 'impossible']) {
      await settle(`window.game.finale.beat === '${id}'`, 60000);
      seen[id] = await page.evaluate(SNAP);
      order.push(id);
      if (id === 'scale') await shoot(page, 'finale-2-scale.png');
      if (id === 'face') await shoot(page, 'finale-3-face.png');
      if (id === 'impossible') await shoot(page, 'finale-4-impossible.png');
    }
    chk(order.join(',') === 'impression,scale,movement,face,impossible',
        'the live game walks the beats in order: silence -> ' + order.join(' -> ') + ' -> cut');

    // THE FOG OPENS.
    chk(seen.scale.fog < begun.fog && seen.impossible.fog < seen.scale.fog,
        `the fog opens all the way through (${begun.fog} -> ${seen.scale.fog} -> ${seen.impossible.fog})`);
    // THE EYE LIFTS, AND LIFTS LAST.
    chk(seen.impossible.pitch > seen.scale.pitch && seen.scale.pitch >= 0,
        `the eye is walked upward (${seen.scale.pitch} -> ${seen.impossible.pitch} rad)`);
    chk(seen.impossible.pitch > seen.face.pitch,
        'and the biggest lift is saved for the last composition');
    /* THE MOVEMENT IS THE ARM, AND IT HAPPENS ONCE.

       Sampled on the beat AFTER the one that drives it, not on the first frame of it.
       Both motions are smoothstepped from zero across their own beat and are then HELD
       for the rest of the sequence — so the first frame of `movement` legitimately still
       reads the rest pose, and asserting there measures nothing but the sampling instant.
       The held value is the real claim: it moved, and it stayed moved. */
    chk(seen.impossible.creature.armZ !== begun.creature.armZ,
        `the arm really repositions (${begun.creature.armZ} -> ${seen.impossible.creature.armZ} rad)`);
    chk(Math.abs(seen.impossible.creature.armZ - begun.creature.armZ) > 0.5,
        'through most of a radian — an angle no shoulder has');
    chk(seen.impossible.creature.headY > 0.1,
        `the head really turns to the player and stays turned (${seen.impossible.creature.headY} rad)`);
    chk(begun.creature.headY === 0 && seen.scale.creature.headY === 0,
        'and had not turned at any point before the face beat');
    chk(seen.impossible.creature.headZ !== 0,
        `the head is left tilted (${seen.impossible.creature.headZ} rad) and never straightens`);
    // NOTHING ELSE HAPPENED.
    chk(['impression', 'scale', 'movement', 'face', 'impossible'].every(k => seen[k].voidGlitch === 0),
        'the void glitch stays at zero for the whole sequence');
    chk(['impression', 'scale', 'movement', 'face', 'impossible'].every(k => seen[k].shake === 0),
        'and the camera never shakes');
    chk(['impression', 'scale', 'movement', 'face', 'impossible'].every(k => seen[k].mobs === 0),
        'and nothing hostile is ever spawned');
    chk(seen.impossible.creditsOn === false, 'the credits have not appeared early');

    // =================================================================================
    head('7. THE CAMERA IS A DRIFT THE PLAYER CAN FIGHT');
    // =================================================================================
    const fought = await page.evaluate(`(() => {
      const g = window.game, p = g.player;
      const was = p.yaw;
      p.yaw = 1.2;                              // the player looks away, hard
      return { was: +was.toFixed(3), set: 1.2 };
    })()`);
    await page.waitForTimeout(120);
    const oneFrame = await page.evaluate(SNAP);
    chk(oneFrame.yaw > 1.0,
        `a frame after looking away the view is still there (${oneFrame.yaw}) — it is never snapped back`);
    await page.waitForTimeout(2500);
    const drifted = await page.evaluate(SNAP);
    chk(drifted.yaw < oneFrame.yaw,
        `but the drift carries it back toward the creature (${oneFrame.yaw} -> ${drifted.yaw})`);

    // =================================================================================
    head('8. THE HARD CUT, AND THE CREDITS');
    // =================================================================================
    await settle('window.game.climaxTriggered === true', 60000);
    const cut = await page.evaluate(SNAP);
    chk(cut.climax, 'the sequence reaches the climax');
    chk(cut.done && !cut.active, 'and marks itself finished');
    chk(!cut.built, 'the finale scene is disposed at the cut, not left in the scene graph');
    chk(!cut.finaleAudio, 'and its audio rig is stopped');
    chk(cut.blackCut, 'the screen is hard-cut to black');
    chk(!cut.hudShown && !cut.crossShown, 'with no HUD and no crosshair');
    chk(!cut.pointerLock, 'and pointer lock released');
    /* silenceAll() ramps the master down with a 0.1s time constant rather than cutting it
       to zero, which is correct — a hard zero on a bus with voices on it clicks. So this
       waits for the ramp to land instead of sampling it on the frame the cut fired, where
       it is legitimately still around half. */
    await settle('window.game.sound.master && window.game.sound.master.gain.value < 0.05', 20000);
    const silenced = await page.evaluate(SNAP);
    chk(silenced.masterGain !== null && silenced.masterGain < 0.05,
        `every audio source is silenced (master at ${silenced.masterGain})`);

    await settle("document.getElementById('creditsScreen').classList.contains('active')", 30000);
    const credits = await page.evaluate(SNAP);
    chk(credits.creditsOn, 'and the credits appear');
    await shoot(page, 'finale-5-credits.png');
    await page.waitForTimeout(1200);
    const stillOne = await page.evaluate(`(() => {
      const n = document.querySelectorAll('#creditsScreen').length;
      return { n: n, active: document.getElementById('creditsScreen').classList.contains('active') };
    })()`);
    chk(stillOne.n === 1, `there is exactly ${stillOne.n} credits overlay in the document`);

    // =================================================================================
    head('9. THE SAVE SURVIVED IT');
    // =================================================================================
    const savedAfter = await page.evaluate("localStorage.getItem('whereitisnt.save.v1')");
    chk(!!savedBefore && savedAfter === savedBefore,
        `the save written before the Haven is byte-for-byte unchanged (${savedBefore ? savedBefore.length : 0} bytes)`);
    chk(cut.saveBlocked !== null, `and saving was refused throughout ("${cut.saveBlocked}")`);

    // =================================================================================
    head('10. A NEW GAME LEAVES NOTHING BEHIND');
    // =================================================================================
    await page.evaluate('window.game.newGame()');
    await page.waitForTimeout(900);
    const reset = await page.evaluate(SNAP);
    chk(!reset.built && reset.creature === null, 'no creature survives into the new run');
    chk(!reset.active && !reset.done && reset.t === 0, 'the sequence is fully reset');
    chk(!reset.climax && !reset.shifted, 'and so are the end-state latches');
    chk(reset.voidGlitch === 0 && reset.havenFade === 0, 'the renderer is clean');
    chk(!reset.finaleAudio, 'no finale audio is left running');
    chk(reset.keysHeld.length === 0, 'no key is left held');
    chk(!reset.movementLocked, 'the body is not left locked');
    chk(reset.hudShown, 'and the HUD is back');

    /* REPLAY: reaching the ending a second time must build the same thing, not twice it.
       The comparison is between two FINALE-ACTIVE scenes. Comparing a finale scene against
       a freshly-restored Overworld one measures the difference between two dimensions, not
       an accumulation — the first draft of this file did exactly that and reported a leak
       of minus a hundred objects. */
    const sceneFirstRun = begun.sceneChildren;
    await page.evaluate('window.game._beginFakeHavenSequence()');
    await settle('window.game.player.inFakeHaven === true', 30000);
    await page.evaluate('window.game.havenTimer = HAVEN_SHIFT_SECONDS + 1;');
    await settle('window.game.finale && window.game.finale.active === true', 40000);
    const second = await page.evaluate(SNAP);
    chk(second.built && second.creature, 'the ending can be reached a second time');
    chk(second.creature.meshes === c.meshes,
        `with the same ${second.creature.meshes} creature meshes as the first run, not twice as many`);
    chk(second.landmarks === begun.landmarks,
        `and the same ${second.landmarks} landmarks`);
    chk(second.sceneChildren <= sceneFirstRun,
        `the second run's finale scene is no larger than the first's ` +
        `(${sceneFirstRun} -> ${second.sceneChildren} children)`);
    await page.evaluate('window.game.newGame()');
    await page.waitForTimeout(900);
    const clean = await page.evaluate(SNAP);
    chk(!clean.built && !clean.finaleAudio, 'and a second New Game finds nothing still running');

    console.log('');
    note('screenshots: ' + (shots.length ? shots.join(', ') : 'none'));
    chk(errors.length === 0,
        'no uncaught page errors across the whole run' +
        (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
  } catch (e) {
    console.log('FAIL  the browser run threw: ' + (e && e.message ? e.message : e));
    fail++;
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail) { console.log(`${fail} BROWSER FINALE CHECK(S) FAILED`); process.exit(1); }
  console.log('ALL BROWSER FINALE CHECKS PASS');
  note('A real Chromium, a real WebGL context, a real New Game, the real Haven and the real');
  note('finale, measured on a live renderer. What is NOT claimed: that any of it frightens');
  note('anyone. The full human Era 1 playthrough is intentionally deferred until Phase 36.');
})();
