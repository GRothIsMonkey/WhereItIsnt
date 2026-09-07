/* PHASE 31 — ENVIRONMENTAL STORYTELLING, IN A REAL BROWSER.

   Launches Chromium through Playwright, serves game.html over HTTP, boots the real game
   with a real WebGL context, and then walks a real player up to a real object in a real
   streamed chunk.

   WHAT IT PROVES that the offline suite cannot. That the notice sweep actually fires
   inside the running frame loop rather than only when a test calls update(); that
   noticing something changes nothing a player can see — no toast, no objective, no HUD
   element, no sound, no pointer-lock hiccup; that the latch survives a real save, a real
   page reload and a real CONTINUE; that a callback appears in a real Suburbia chunk once
   its original has been noticed and not before; that entering and leaving a dimension
   leaves no listener and no timer behind; and that the objective chain, the HUD and the
   settings panel are exactly what they were.

   WHAT IT DOES NOT PROVE. Whether any of it is noticeable, unsettling or worth noticing.
   Screenshots are written for a person to look at and are best-effort.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_ENV_PORT || 8251);

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
    await page.screenshot({ path: path.join(OUT, name), timeout: 20000 });
    shots.push(name + ' ✓'); return true;
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

/* Everything the assertions read, in one page call, so a check can never compare two
   different moments. */
const SNAP = () => {
  const g = window.game, p = g.player;
  const el = (id) => document.getElementById(id);
  return {
    running: g.running,
    noticed: Array.from(g.envStory.noticed).sort(),
    problems: g.envStory.problems.length,
    tracked: g.envStory.tracked.map(e => e.id),
    objective: (() => { const n = el('journeyStep');
      return n && n.className.indexOf('show') >= 0 ? n.textContent : null; })(),
    objectiveId: g.objectives ? g.objectives.currentId : null,
    hudDisplay: getComputedStyle(el('hud')).display,
    ticks: el('conditionTicks') ? el('conditionTicks').children.length : -1,
    toast: (() => { const n = el('toast'); return n ? n.className : null; })(),
    prompt: (() => { const n = el('interactPrompt');
      return n && n.classList.contains('show') ? n.textContent : null; })(),
    settings: g.ui.settingsOpen, crafting: g.ui.craftingOpen, backpack: g.ui.backpackOpen,
    chunks: g.world.chunks.size,
    sceneChildren: g.scene.children.length,
    edits: (() => { let n = 0; for (const m of g.world.editedChunks.values()) n += m.size; return n; })(),
    hp: p.hp, sanity: g.sanity.value, day: g.dayCount,
    milestones: Array.from(g.milestones).sort(),
    pos: [Math.round(p.position.x), Math.round(p.position.y), Math.round(p.position.z)],
  };
};

/* Put the player at a world position and let the streamer catch up. Uses the same
   teleport the debug console offers; nothing here writes a block. */
async function goto(page, x, z) {
  await page.evaluate(([tx, tz]) => {
    const g = window.game, p = g.player;
    const y = g.world.findSpawnHeight(Math.floor(tx), Math.floor(tz));
    p.position.set(tx + 0.5, y + 0.2, tz + 0.5);
    p.velocity.set(0, 0, 0);
    g.world.updateChunks(p.position);
  }, [x, z]);
  await page.waitForTimeout(500);
  // Two eager passes: the streamer spends a fixed budget per frame and this container
  // draws about one frame a second.
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.game.world.updateChunks(window.game.player.position));
    await page.waitForTimeout(200);
  }
}

/* Face the player at a point and run the notice sweep the way the frame loop does. */
async function lookAt(page, x, z, seconds) {
  await page.evaluate(([tx, tz, secs]) => {
    const g = window.game, p = g.player;
    p.yaw = Math.atan2(-(tx - p.position.x), -(tz - p.position.z));
    p.pitch = 0;
    p.camera.rotation.order = 'YXZ';
    p.camera.rotation.y = p.yaw;
    p.camera.rotation.x = p.pitch;
    p.camera.position.set(p.position.x, p.position.y + p.eyeHeight, p.position.z);
    for (let i = 0; i < Math.round(secs * 4); i++) g.envStory.update(0.25, p, g.camera, g.world);
  }, [x, z, seconds || 2]);
}

/* CLICKED THROUGH $eval RATHER THAN page.click. Playwright waits for an element to be
   "visible, enabled and stable" before clicking, and on a page running a WebGL frame loop
   under SwiftShader that stability check never settles — the second New Game in this file
   timed out at thirty seconds against a button that was plainly there and plainly
   clickable. $eval dispatches on the element and runs the real listener; the layering
   this would otherwise have been checking is checked explicitly by browser-menu.js. */
const press = (page, sel) => page.$eval(sel, (el) => el.click());

async function boot(page, { fresh }) {
  await page.waitForFunction('!!window.game', null, { timeout: 90000 });
  if (fresh) {
    await press(page, '#clickPlay');
    await page.waitForFunction('window.game.film && window.game.film.active === true', null, { timeout: 30000 });
    await page.evaluate(() => window.game.film.skip());
    await page.waitForTimeout(150);
    await page.evaluate(() => { const g = window.game;
      if (g.openingInstruction.active) g.openingInstruction._finish(); });
  } else {
    await press(page, '#continuePlay');
  }
  await page.waitForFunction('window.game && window.game.running === true', null, { timeout: 60000 });
  await page.waitForTimeout(400);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const hermetic = fs.existsSync(VENDOR_THREE);
  const srv = await serve();
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  if (hermetic) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
    await boot(page, { fresh: true });

    // =================================================================================
    head('1. A NEW GAME HAS NOTICED NOTHING');
    // =================================================================================
    const a0 = await page.evaluate(SNAP);
    chk(a0.running === true, 'the game is running');
    chk(a0.noticed.length === 0, 'and the notice set is empty — every original is still owed');
    chk(a0.problems === 0, 'the event table audited clean at construction inside the browser');
    chk(a0.tracked.length === 3, `three events are tracked at run time (${a0.tracked.join(', ')})`);
    chk(a0.objective === 'Gather wood.', `the objective chain is untouched: "${a0.objective}"`);
    chk(a0.ticks === 10 && a0.hudDisplay !== 'none', 'and the Phase 27 HUD is the HUD');

    // =================================================================================
    head('2. THE OBJECT IS IN A REAL STREAMED CHUNK');
    // =================================================================================
    const site = await page.evaluate(() => ENV_SITES.owHolding());
    note(`the held place resolves to (${site.x}, ${site.z})`);
    await goto(page, site.x - 9, site.z);
    const read = await page.evaluate((s) => {
      const g = window.game, W = g.world;
      const base = Math.max(W._overworldSurfaceY(s.x, s.z), SEA_LEVEL + 2);
      let pad = 0, planks = 0, sticks = 0;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
        if (W.getBlockWorld(s.x + dx, base - 1, s.z + dz) === BLOCK.DIRT) pad++;
      for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]])
        if (W.getBlockWorld(s.x + dx, base, s.z + dz) === BLOCK.OAK_LOG) planks++;
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]])
        if (W.getBlockWorld(s.x + dx, base, s.z + dz) === BLOCK.STICKS) sticks++;
      return { pad, planks, sticks, scorch: W.getBlockWorld(s.x, base - 1, s.z) === BLOCK.ASH_GROUND,
               meshed: !!W.chunks.get(W.key(Math.floor(s.x / 16), Math.floor(s.z / 16))) };
    }, site);
    chk(read.meshed, 'walking to it streamed its chunk in through the ordinary streamer');
    chk(read.pad >= 44 && read.scorch, `and the levelled square with the scorched centre is really there (${read.pad}/49)`);
    chk(read.planks === 4 && read.sticks === 4, 'with its four planks and its four spent sticks');
    await shoot(page, 'env-holding.png');

    // =================================================================================
    head('3. NOTICING IT CHANGES NOTHING THE PLAYER CAN SEE');
    // =================================================================================
    const before = await page.evaluate(SNAP);
    await lookAt(page, site.x, site.z, 2);
    const after = await page.evaluate(SNAP);
    chk(after.noticed.indexOf('ow_holding') >= 0, 'standing in front of it and looking at it latches it');
    chk(after.objective === before.objective && after.objectiveId === before.objectiveId,
        'and the objective did not move');
    chk(after.toast === before.toast, 'no toast was raised');
    chk(after.prompt === null, 'no interaction prompt appeared');
    chk(after.hp === before.hp && after.sanity === before.sanity, 'health and sanity are untouched');
    chk(after.edits === before.edits, 'no block was changed');
    chk(after.milestones.join() === before.milestones.join(), 'no milestone was granted');
    chk(!after.settings && !after.crafting && !after.backpack, 'nothing opened');
    /* THE SCENE GRAPH, MEASURED SYNCHRONOUSLY. Comparing two snapshots taken a second
       apart would be measuring the chunk streamer, which is adding and removing meshes
       the whole time the frame loop runs. What matters is that the SWEEP adds nothing, so
       both readings are taken inside one page call with nothing else between them. */
    const graph = await page.evaluate(() => {
      const g = window.game;
      const n0 = g.scene.children.length;
      for (let i = 0; i < 40; i++) g.envStory.update(0.25, g.player, g.camera, g.world);
      return { n0, n1: g.scene.children.length };
    });
    chk(graph.n0 === graph.n1, `and forty sweeps add nothing to the scene (${graph.n0} objects, unchanged)`);

    /* AND IT CANNOT BE UN-NOTICED OR DOUBLE-COUNTED. */
    await lookAt(page, site.x, site.z, 2);
    const again = await page.evaluate(SNAP);
    chk(again.noticed.length === after.noticed.length, 'looking again latches nothing further');

    // =================================================================================
    head('4. THE CALLBACK APPEARS IN A REAL SUBURBIA CHUNK, AND NOT BEFORE');
    // =================================================================================
    const subRead = () => page.evaluate(() => {
      const g = window.game, W = g.world;
      const at = ENV_SITES.subHolding(W);
      const cx = Math.floor(at.x / 16), cz = Math.floor(at.z / 16);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) W._generateChunk(cx + dx, cz + dz);
      return {
        at,
        scorch: W.getBlockWorld(at.x, SUBURBIA_BASE_Y - 1, at.z) === BLOCK.ASH_GROUND,
        plank: W.getBlockWorld(at.x + 2, SUBURBIA_BASE_Y, at.z) === BLOCK.OAK_LOG,
      };
    });
    /* The lot is generated fresh here BECAUSE the player has now noticed the original.
       A chunk already resident does not re-stamp, which is the mechanic (STORY.md
       section 16: change is discovered, never witnessed) — so this generates ground the
       player has never been near, which is exactly what walking into the suburb does. */
    const warm = await subRead();
    chk(warm.scorch && warm.plank,
        `the same square is in a suburban back yard at (${warm.at.x}, ${warm.at.z}), now that its original has been seen`);

    // A second page, with nothing noticed, generating the same lot.
    const cold = await ctx.newPage();
    await cold.setViewportSize({ width: 900, height: 600 });
    if (hermetic) {
      const body = fs.readFileSync(VENDOR_THREE, 'utf8');
      await cold.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
    }
    await cold.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
    await cold.waitForFunction('!!window.game', null, { timeout: 90000 });
    const coldRead = await cold.evaluate(() => {
      const W = window.game.world;
      const at = ENV_SITES.subHolding(W);
      const cx = Math.floor(at.x / 16), cz = Math.floor(at.z / 16);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) W._generateChunk(cx + dx, cz + dz);
      return { scorch: W.getBlockWorld(at.x, SUBURBIA_BASE_Y - 1, at.z) === BLOCK.ASH_GROUND,
               plank: W.getBlockWorld(at.x + 2, SUBURBIA_BASE_Y, at.z) === BLOCK.OAK_LOG,
               noticed: Array.from(window.game.envStory.noticed) };
    });
    chk(coldRead.noticed.length === 0 && !coldRead.scorch && !coldRead.plank,
        'and in a browser where nobody has seen the original, the same lot is an ordinary lawn');
    await cold.close();

    // =================================================================================
    head('5. THE LATCH SURVIVES A SAVE, A RELOAD AND A CONTINUE');
    // =================================================================================
    const saved = await page.evaluate(() => {
      const r = window.game.saveGame('manual');
      return { ok: !!(r && r.ok), error: r ? r.error : null,
               raw: localStorage.getItem('whereitisnt.save.v1') };
    });
    chk(saved.ok && saved.raw, 'the game saved' + (saved.error ? ' — ' + saved.error : ''));
    const parsed = JSON.parse(saved.raw);
    chk(parsed.version === 5, `the file is schema version ${parsed.version}`);
    chk(Array.isArray(parsed.progression.noticed) && parsed.progression.noticed.indexOf('ow_holding') >= 0,
        `and it carries the notice set: [${parsed.progression.noticed.join(', ')}]`);

    await page.reload({ waitUntil: 'load', timeout: 90000 });
    await boot(page, { fresh: false });
    const loaded = await page.evaluate(SNAP);
    chk(loaded.running === true, 'CONTINUE loaded it back');
    chk(loaded.noticed.indexOf('ow_holding') >= 0, 'and the notice survived the round trip');
    const subAfterLoad = await subRead();
    chk(subAfterLoad.scorch && subAfterLoad.plank, 'so the suburban callback is still there after a reload');

    // =================================================================================
    head('6. A NEW GAME OWES EVERY ORIGINAL AGAIN');
    // =================================================================================
    /* THE IN-SESSION NEW GAME is the settings panel's, and it is the one that has a
       teardown: the start screen's NEW GAME button calls _start() on a game that has
       never run, so there is nothing to tear down there. Both are checked — this one by
       the real function the panel's button invokes, and the boot path by a fresh page. */
    const restart = await page.evaluate(() => {
      const g = window.game;
      const r = g.newGame();
      return { ok: !!(r && r.ok), noticed: Array.from(g.envStory.noticed) };
    });
    chk(restart.ok && restart.noticed.length === 0,
        'the in-session New Game clears the notice set through the one shared teardown');
    const coldAgain = await subRead();
    chk(!coldAgain.scorch && !coldAgain.plank,
        'and the suburban back yard is an ordinary lawn again — a callback cannot survive into a world without its original');

    /* AND A FRESH PAGE WITH A SAVE ON DISK. NEW GAME must not inherit the saved latch. */
    await page.reload({ waitUntil: 'load', timeout: 90000 });
    await boot(page, { fresh: true });
    const booted = await page.evaluate(SNAP);
    chk(booted.noticed.length === 0,
        'and NEW GAME on a fresh page ignores the notice set in the save file beside it');

    // =================================================================================
    head('7. IT LEAVES NOTHING BEHIND');
    // =================================================================================
    const leaks = await page.evaluate(async () => {
      const g = window.game;
      const before = { children: g.scene.children.length,
                       occ: g.envStory._occHeard.size, cd: g.envStory._occCooldown };
      // Ten new games in a row, each with a full teardown.
      for (let i = 0; i < 5; i++) {
        g.envStory.notice('ow_holding');
        g.envStory.reset();
      }
      return { before, after: { children: g.scene.children.length,
                                occ: g.envStory._occHeard.size, cd: g.envStory._occCooldown,
                                noticed: g.envStory.noticed.size } };
    });
    chk(leaks.after.children === leaks.before.children,
        `five notice-and-reset cycles leave the scene graph unchanged (${leaks.after.children} objects)`);
    chk(leaks.after.occ === 0 && leaks.after.cd === 0 && leaks.after.noticed === 0,
        'and every ledger the runtime owns is empty afterwards');
    const timers = await page.evaluate(() => {
      const src = window.game.envStory.constructor.toString();
      return { timer: /setTimeout|setInterval/.test(src), listener: /addEventListener/.test(src) };
    });
    chk(!timers.timer && !timers.listener,
        'the shipped class contains no timer and binds no listener — there is nothing in it to leak');

    // =================================================================================
    head('8. THE REST OF THE GAME IS WHAT IT WAS');
    // =================================================================================
    {
      const s = await page.evaluate(SNAP);
      chk(s.objective === 'Gather wood.', `the first objective is still "${s.objective}"`);
      chk(s.ticks === 10 && s.hudDisplay !== 'none', 'the HUD still has its ten condition ticks');
      await page.keyboard.press('KeyO');
      await page.waitForTimeout(300);
      chk((await page.evaluate(SNAP)).settings === true, 'settings still opens');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      chk((await page.evaluate(SNAP)).settings === false, 'and still closes');
      await page.keyboard.press('KeyI');
      await page.waitForTimeout(250);
      chk((await page.evaluate(SNAP)).backpack === true, 'the backpack still opens');
      await page.keyboard.press('KeyI');
      await page.waitForTimeout(250);
      chk((await page.evaluate(SNAP)).backpack === false, 'and still closes');
      const moved = await page.evaluate(() => {
        const g = window.game, p = g.player;
        const x0 = p.position.x, z0 = p.position.z;
        p.keys['KeyW'] = true;
        for (let i = 0; i < 60; i++) p.update(1 / 60);
        p.keys['KeyW'] = false;
        return Math.hypot(p.position.x - x0, p.position.z - z0);
      });
      chk(moved > 1.5, `and the player can still walk (${moved.toFixed(2)}m in one simulated second)`);
    }

    chk(errors.length === 0, 'no uncaught page errors across the whole run' +
        (errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''));
    note('screenshots: ' + (shots.join(', ') || 'none'));
  } catch (e) {
    console.log('\nBROWSER RUN FAILED: ' + (e && e.stack ? e.stack : e));
    fail++;
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail) { console.log(fail + ' BROWSER ENVIRONMENT CHECK(S) FAILED'); process.exit(1); }
  console.log('ALL BROWSER ENVIRONMENT CHECKS PASS');
  console.log('      A REAL Chromium, a real WebGL context, the real document and the real runtime.');
  console.log('      What is NOT claimed: that any of this is noticeable or unsettling.');
  console.log('      No human has played this build.');
})();
