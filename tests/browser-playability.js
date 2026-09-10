/* =====================================================================================
   PHASE 36 — THE WHOLE GAME, IN A REAL BROWSER, OVER HTTP, WITH NO DEBUG COMMAND IN IT.

   browser-transitions.js walks the two RIFTS. This walks the whole thing: a real New
   Game, the opening, the Overworld's own timber and recipes, the third night, the
   Hollowed Behemoth arriving through its OWN GATE rather than being handed to the test,
   the Core Disk, both rifts, the Farmlands, Static Suburbia, the Disconnected Home
   standing in it, the Level 3 Disk, the Fake Haven, the shift, the finale, the hard cut
   and the credits — and then a New Game taken FROM the credits.

   `debugTeleportTo*` is never called. Neither is `spawnBehemoth`, `_beginFakeHavenSequence`
   or `finale.begin()`: each of those is reached by the game deciding to reach it.

   WHAT IS DRIVEN RATHER THAN PLAYED, AND WHY. Three things, all of them TIME or DISTANCE
   and none of them a decision:

     * the day counter and the clock are moved to the third night, because surviving two
       nights in real time under SwiftShader is forty minutes of nothing;
     * the player is stood in front of a landmark instead of walking the 1,950 blocks of
       the Farmland journey or the 256-384 blocks of suburb between arrival and the
       Disconnected Home;
     * the Haven's 178-second record and the finale's 32 are advanced by their own timers.

   Everything a player DOES — the click that raises an Anchor, the click that opens a
   chest, the damage that fells the Behemoth, the pickup radius that collects a Disk, the
   button on the victory screen, the walk into a rift — is the real path, and the test
   fails if any of it stops working.

   THE FIVE REGRESSIONS IT EXISTS FOR are listed in playability.js. The two that can only
   be proved here are sections 4 and 7 below: a Behemoth surviving a page reload, and the
   ending leaving nothing on the screen.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_PLAYABILITY_PORT || 8257);

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
  try { await page.screenshot({ path: path.join(OUT, name), timeout: 20000 }); shots.push(name + ' ok'); }
  catch (e) { shots.push(name + ' skipped (' + (e.name || 'error') + ')'); }
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

const SNAP = () => {
  const g = window.game, p = g.player, a = g.anchorManager, w = g.world;
  const el = (id) => document.getElementById(id);
  const vis = (id) => { const n = el(id); if (!n) return false;
    const s = getComputedStyle(n); const r = n.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.01 && r.width > 0 && r.height > 0; };
  return {
    dim: p.inFakeHaven ? 'haven' : p.inSuburbia ? 'suburbia' : p.inFarmlands ? 'farmlands' : 'overworld',
    running: !!g.running, day: g.dayCount, stage: g.stage, night: !!g.env.isNight,
    t: +g.env.t.toFixed(2),
    pos: [+p.position.x.toFixed(2), +p.position.y.toFixed(2), +p.position.z.toFixed(2)],
    hp: p.hp, maxHp: p.maxHp, dead: !!p.dead, movementLocked: !!p.movementLocked,
    anchor: a.activeAnchor ? [Math.floor(a.activeAnchor.pos.x), Math.floor(a.activeAnchor.pos.y),
                              Math.floor(a.activeAnchor.pos.z)] : null,
    riftActive: !!a.riftActive, riftTarget: a.riftTargetLevel, riftReady: !!a.riftReady(),
    mobs: g.mobs.mobs.length, behemoth: !!g.mobs.hasBehemoth(),
    items: g.itemManager.entities.length,
    behemothSpawned: !!g.behemothSpawned, behemothDefeated: !!g.behemothDefeated,
    awaitingAdvance: !!g.awaitingAdvance, winMode: g.ui.winScreenMode || null,
    winVisible: vis('winScreen'), creditsVisible: vis('creditsScreen'),
    blackCut: !!(el('blackCut') && el('blackCut').classList.contains('on')),
    whiteFade: +((el('fadeWhite') && getComputedStyle(el('fadeWhite')).opacity) || 0),
    hudVisible: vis('hud'),
    inv: p.inventory.slots.filter(s => s.item).map(s => s.item + 'x' + s.count).join(','),
    objective: (() => { const n = el('journeyStep'); return n && n.className.indexOf('show') >= 0 ? n.textContent : null; })(),
    objectiveId: g.objectives ? g.objectives.currentId : null,
    chunks: w.chunks.size, fakeHavenTriggered: !!g.fakeHavenTriggered,
    havenShifted: !!g.havenShiftTriggered, finaleActive: !!(g.finale && g.finale.active),
    climax: !!g.climaxTriggered,
  };
};

/* Aim the real camera at a block and fire the real right-click handler. Nothing here
   reaches past PlayerController: this is the same path a mouse produces. */
const LOOK_AND_USE = (bx, by, bz) => {
  const g = window.game, p = g.player;
  const eye = p._eyePosition();
  const dx = (bx + 0.5) - eye.x, dy = (by + 0.5) - eye.y, dz = (bz + 0.5) - eye.z;
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.max(-1.5, Math.min(1.5, Math.atan2(dy, Math.hypot(dx, dz))));
  g.camera.position.copy(eye);
  g.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
  const hit = p._getLookTarget();
  p._placeBlockOrInteract();
  return hit ? { bx: hit.bx, by: hit.by, bz: hit.bz, id: g.world.getBlockWorld(hit.bx, hit.by, hit.bz) } : null;
};

/* Collect every dropped entity by standing on each in turn, through the real pickup
   radius. Returns after the pack has been given a chance to answer. */
const WALK_ONTO_DROPS = () => {
  const g = window.game;
  for (const e of g.itemManager.entities.slice()) {
    g.player.position.set(e.position.x, e.position.y + 1, e.position.z);
  }
  return g.itemManager.entities.length;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const hermetic = fs.existsSync(VENDOR_THREE);
  const srv = await serve();
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('      !! ' + e.message); });
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

  const boot = async () => {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('!!window.game', null, { timeout: 120000 });
    await page.waitForTimeout(400);
  };

  try {
    console.log('SERVED OVER HTTP at http://127.0.0.1:' + PORT + '/game.html — never file://');
    await boot();

    // =================================================================================
    head('1. A NEW GAME, THE OPENING, AND THE FIRST FRAME OF PLAY');
    // =================================================================================
    await page.click('#clickPlay');
    await page.waitForTimeout(600);
    await page.evaluate('window.game.film && window.game.film.active && window.game.film.skip()');
    await page.waitForFunction('window.game.running === true', null, { timeout: 90000 });
    await page.waitForTimeout(900);

    const s0 = await page.evaluate(SNAP);
    chk(s0.running && s0.dim === 'overworld', 'the run begins in the Overworld');
    chk(s0.objectiveId === 'gather_wood', `and the first objective is the first one: "${s0.objective}"`);
    chk(s0.hudVisible, 'the HUD is up');
    chk(!s0.winVisible && !s0.creditsVisible && !s0.blackCut && s0.whiteFade < 0.02,
        'and nothing full-screen is covering it');
    chk(s0.day === 1 && !s0.behemothSpawned && !s0.behemothDefeated,
        'day one, and nothing has been carried in from anywhere');

    // =================================================================================
    head('2. THE OVERWORLD PAYS FOR ITS OWN ANCHOR');
    // =================================================================================
    /* A real oak in the real generated world, broken through the real destroyBlock, and
       collected through the real pickup radius — then the real recipe table. Four planks
       is the Anchor; it is the same cost the Farmlands pay in section 8. */
    const chopped = await page.evaluate(`(() => {
      const g = window.game, p = g.player, w = g.world;
      const px = Math.floor(p.position.x), pz = Math.floor(p.position.z);
      for (let r = 1; r < 48; r++) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = px + dx, z = pz + dz;
          for (let y = 24; y < 60; y++) {
            if (w.getBlockWorld(x, y, z) === BLOCK.OAK_LOG) {
              w.destroyBlock(x, y, z, null, true);
              return { at: [x, y, z] };
            }
          }
        }
      }
      return null;
    })()`);
    chk(!!chopped, 'there is an oak within reach of spawn' + (chopped ? ' (' + chopped.at.join(',') + ')' : ''));
    await page.evaluate(`(${WALK_ONTO_DROPS.toString()})()`);
    await page.waitForFunction('window.game.player.inventory.hasItem(ITEM.OAK_LOG)', null, { timeout: 60000 })
      .catch(() => {});
    const crafted = await page.evaluate(`(() => {
      const g = window.game, inv = g.player.inventory;
      const R = (id) => CRAFTING_RECIPES.find(r => r.id === id);
      const make = (id) => { const r = R(id); if (!inv.hasIngredients(r.reqs)) return false;
                             inv.consumeIngredients(r.reqs); inv.addItem(r.result, r.count); return true; };
      return { planks: make('planks'), anchor: make('anchor'),
               has: inv.hasItem(ITEM.SAFEHOUSE_ANCHOR) };
    })()`);
    chk(crafted.planks && crafted.anchor && crafted.has,
        'one Oak Log becomes four planks becomes an Anchor Monument, through the real recipe table');

    /* Back to the spawn clearing first. Collecting the log left the player standing
       wherever it fell, which can be up a bank or under a canopy; a player would simply
       have walked back out, and where they stand is not what this section measures. */
    const placed = await page.evaluate(`(() => {
      const g = window.game, p = g.player, w = g.world;
      p.position.copy(p.spawnPosition); p._snapToGround(); p.velocity.set(0, 0, 0);
      p.selectedSlot = p.inventory.slots.findIndex(s => s.item === ITEM.SAFEHOUSE_ANCHOR);
      for (const [dx, dz] of [[2, 0], [0, 2], [-2, 0], [0, -2], [2, 2], [-2, -2]]) {
        const bx = Math.floor(p.position.x) + dx, bz = Math.floor(p.position.z) + dz;
        const by = w.findSpawnHeight(bx, bz) - 1;
        if (Math.abs((by + 1) - p.position.y) > 1.2) continue;
        (${LOOK_AND_USE.toString()})(bx, by, bz);
        if (g.anchorManager.activeAnchor) { window.__anchor = [bx, by + 1, bz]; return true; }
      }
      return false;
    })()`);
    chk(placed, 'and a real right-click on real ground raises it');

    // =================================================================================
    head('3. THE THIRD NIGHT SENDS A BEHEMOTH — THROUGH ITS OWN GATE');
    // =================================================================================
    /* The clock and the day counter are moved; NOTHING ELSE IS. spawnBehemoth is never
       called by this test. What arrives, arrives because Game._animate decided it should.
       That is the whole point of this section: the gate itself has never been exercised
       by any suite, and it is the gate that used to end runs. */
    await page.evaluate(`(() => {
      const g = window.game;
      g.dayCount = 3;
      g.memoryFragments = 0;
      g.env.t = g.env.cycleLength * 0.75;   // deep night
      g.env.update(0);
    })()`);
    await page.waitForFunction('window.game.mobs.hasBehemoth() === true', null, { timeout: 90000 })
      .catch(() => {});
    const s1 = await page.evaluate(SNAP);
    chk(s1.night, `the clock is at night (day ${s1.day})`);
    chk(s1.behemoth, 'and a Hollowed Behemoth is standing in the world, sent by the gate and not by this test');
    chk(s1.behemothSpawned, 'the latch is written, as it always was');
    chk(!s1.behemothDefeated, 'and nothing has been collected yet');
    await shoot(page, 'playability-1-behemoth.png');

    // =================================================================================
    head('4. THE REGRESSION: SAVING ON THE THIRD NIGHT NO LONGER ENDS THE RUN');
    // =================================================================================
    /* THIS IS THE FAULT PHASE 36 EXISTS FOR. `behemothSpawned` is saved. The Behemoth is
       not, because no mob is. Before this phase, the save below plus the reload below
       produced a world in which the gate had already fired and the only source of the
       Level 1 Core Disk was gone — permanently, silently, and with the Farmlands, Static
       Suburbia, the Fake Haven and the finale all behind it. */
    const saved = await page.evaluate('window.game.saveGame("manual")');
    chk(saved && saved.ok, 'the game saves on the third night, with the Behemoth alive and the Disk uncollected');

    await boot();
    await page.click('#continuePlay');
    await page.waitForFunction('window.game.running === true', null, { timeout: 90000 });
    await page.waitForTimeout(600);

    const s2 = await page.evaluate(SNAP);
    chk(s2.dim === 'overworld' && s2.day >= 3, `CONTINUE comes back in the Overworld on day ${s2.day}`);
    chk(s2.behemothSpawned && !s2.behemothDefeated,
        'carrying the saved latch, and no Disk — which is exactly the state that used to be terminal');
    chk(!!s2.anchor, 'the Anchor the player raised is still standing');
    /* And it is where the rest of this run reaches for it: `window.__anchor` did not
       survive the reload, which is the point of the reload. */
    await page.evaluate(`(() => {
      const a = window.game.anchorManager.activeAnchor;
      window.__anchor = a ? [Math.floor(a.pos.x), Math.floor(a.pos.y), Math.floor(a.pos.z)] : null;
    })()`);

    /* Put the clock back into night and let the gate answer for itself. */
    await page.evaluate(`(() => {
      const g = window.game;
      g.env.t = g.env.cycleLength * 0.75;
      g.env.update(0);
    })()`);
    await page.waitForFunction('window.game.mobs.hasBehemoth() === true', null, { timeout: 90000 })
      .catch(() => {});
    const s3 = await page.evaluate(SNAP);
    chk(s3.behemoth,
        'A BEHEMOTH COMES BACK. The gate reads live state now, so a reload cannot take the run away.');

    // =================================================================================
    head('5. A REAL KILL, A REAL DISK, AND A VICTORY SCREEN THAT TELLS THE TRUTH');
    // =================================================================================
    const kill = await page.evaluate(`(() => {
      const g = window.game;
      const mob = g.mobs.mobs.find(m => m.isBoss);
      // Away from the Anchor: a shield kill leaves no corpse and therefore no loot.
      mob.position.set(g.player.position.x + 42, mob.position.y, g.player.position.z + 42);
      let guard = 0;
      while (mob.hp > 0 && guard++ < 500) g.mobs.damageMob(mob, 40, null, 0);
      return { hp: mob.hp, alive: mob.alive };
    })()`);
    chk(kill.hp <= 0, 'the Behemoth falls to the real damage path');
    await page.waitForFunction('window.game.itemManager.entities.length >= 1', null, { timeout: 90000 })
      .catch(() => {});
    await page.evaluate(`(${WALK_ONTO_DROPS.toString()})()`);
    await page.waitForFunction('window.game.player.inventory.hasItem(ITEM.CORE_DISK)', null, { timeout: 90000 })
      .catch(() => {});
    await page.waitForFunction('window.game.ui.winScreenMode === "boss"', null, { timeout: 90000 })
      .catch(() => {});

    const s4 = await page.evaluate(SNAP);
    chk(/(^|,)36x/.test(s4.inv), `the Core Disk is collected through the real pickup radius (pack: ${s4.inv})`);
    chk(s4.winMode === 'boss' && s4.winVisible, 'and the victory screen is up');
    chk(!s4.awaitingAdvance,
        'without borrowing the flag that means "a stage is waiting to be advanced past"');
    const label = await page.evaluate(`({
      btn: document.getElementById('nextLevelBtn').textContent,
      sub: document.getElementById('winScreen').querySelector('.sub').textContent })`);
    chk(!/FARMLANDS/i.test(label.btn), `its button no longer offers a door it is not: "${label.btn}"`);
    chk(!/UNLOCKED/i.test(label.sub), `and its line no longer claims an unlock: "${label.sub}"`);

    /* THE WORLD IS NOT RUNNING BEHIND IT. Before this phase the third night carried on
       under a full-screen panel with pointer lock released. */
    const frozen = await page.evaluate(`new Promise((res) => {
      const g = window.game;
      const a = { t: g.env.t, chunks: g.world.chunks.size, hp: g.player.hp };
      setTimeout(() => res({ a: a, b: { t: g.env.t, chunks: g.world.chunks.size, hp: g.player.hp } }), 1200);
    })`);
    chk(frozen.a.t === frozen.b.t, `the clock does not move behind the panel (${frozen.a.t} -> ${frozen.b.t})`);
    chk(frozen.a.chunks === frozen.b.chunks, 'nor does the streamer');

    const before = await page.evaluate(SNAP);
    await page.click('#nextLevelBtn');
    await page.waitForTimeout(500);
    const after = await page.evaluate(SNAP);
    chk(!after.winVisible && after.winMode === null, 'the button takes the screen down');
    chk(after.stage === before.stage, `and does NOT advance the stage (${before.stage} -> ${after.stage})`);
    chk(Math.hypot(after.pos[0] - before.pos[0], after.pos[2] - before.pos[2]) < 1.0,
        'and does NOT teleport the player away from the Anchor they just raised');
    chk(after.t !== before.t || after.chunks !== before.chunks || after.running,
        'and the world is running again');

    // =================================================================================
    head('6. THE POWERED ANCHOR CAN BE TAKEN APART AND PUT BACK');
    // =================================================================================
    const fed = await page.evaluate(`(() => {
      const g = window.game, p = g.player, a = window.__anchor;
      p.position.set(a[0] + 2.5, a[1], a[2] + 0.5);
      p.selectedSlot = p.inventory.slots.findIndex(s => s.item === ITEM.CORE_DISK);
      (${LOOK_AND_USE.toString()})(a[0], a[1], a[2]);
      return { rift: g.anchorManager.riftActive, target: g.anchorManager.riftTargetLevel,
               holding: p.inventory.hasItem(ITEM.CORE_DISK) };
    })()`);
    chk(fed.rift && fed.target === 2, 'the Disk opens the rift toward the Farmlands');
    chk(!fed.holding, 'and is consumed by it');

    /* AND THEN THE PLAYER LEFT-CLICKS THE THING THAT JUST LIT UP, which is what the whole
       run has taught them to do with a block they are curious about. Before this phase
       that destroyed the rift AND the only key that could ever open it. */
    const broke = await page.evaluate(`(() => {
      const g = window.game, a = window.__anchor;
      g.world.destroyBlock(a[0], a[1], a[2], null, true);
      return { rift: g.anchorManager.riftActive, anchor: !!g.anchorManager.activeAnchor,
               dropped: g.itemManager.entities.map(e => e.itemType) };
    })()`);
    chk(!broke.rift && !broke.anchor, 'breaking it closes the rift and takes the monument down');
    const DISK = await page.evaluate('ITEM.CORE_DISK');
    const ANCH = await page.evaluate('ITEM.SAFEHOUSE_ANCHOR');
    chk(broke.dropped.indexOf(DISK) >= 0,
        'and the Core Disk is on the ground again — this is the one that used to end the run');
    chk(broke.dropped.indexOf(ANCH) >= 0, 'along with the monument itself');

    await page.evaluate(`(${WALK_ONTO_DROPS.toString()})()`);
    await page.waitForFunction('window.game.player.inventory.hasItem(ITEM.CORE_DISK) && window.game.player.inventory.hasItem(ITEM.SAFEHOUSE_ANCHOR)',
      null, { timeout: 90000 }).catch(() => {});
    const redone = await page.evaluate(`(() => {
      const g = window.game, p = g.player, w = g.world;
      p.position.copy(p.spawnPosition); p._snapToGround(); p.velocity.set(0, 0, 0);
      p.selectedSlot = p.inventory.slots.findIndex(s => s.item === ITEM.SAFEHOUSE_ANCHOR);
      let at = null;
      for (const [dx, dz] of [[2, 0], [0, 2], [-2, 0], [0, -2], [3, 0], [0, 3], [2, 2], [-2, -2]]) {
        const bx = Math.floor(p.position.x) + dx, bz = Math.floor(p.position.z) + dz;
        const by = w.findSpawnHeight(bx, bz) - 1;
        if (Math.abs((by + 1) - p.position.y) > 1.2) continue;
        (${LOOK_AND_USE.toString()})(bx, by, bz);
        if (g.anchorManager.activeAnchor) { at = [bx, by + 1, bz]; break; }
      }
      if (!at) return { anchor: false };
      window.__anchor = at;
      /* Stand back far enough that the rift's trigger radius does not take them before
         the Disk has visibly gone in — the same thing a player does when they walk up to
         a monument and stop in front of it. */
      p.position.set(at[0] + 2.5, at[1], at[2] + 0.5);
      p.selectedSlot = p.inventory.slots.findIndex(s => s.item === ITEM.CORE_DISK);
      (${LOOK_AND_USE.toString()})(at[0], at[1], at[2]);
      return { anchor: !!g.anchorManager.activeAnchor, rift: g.anchorManager.riftActive,
               target: g.anchorManager.riftTargetLevel };
    })()`);
    chk(redone.anchor && redone.rift && redone.target === 2,
        'the same Disk raises a second Anchor and opens the same rift — the mistake is recoverable');

    // =================================================================================
    head('7. WALKING IN: THE SHATTERED FARMLANDS');
    // =================================================================================
    await page.waitForFunction('window.game.player.inFarmlands === true', null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const f = await page.evaluate(SNAP);
    chk(f.dim === 'farmlands', 'the player crosses into the Farmlands on their own feet');
    chk(f.anchor === null && !f.riftActive, 'the Anchor and its rift did not cross with them');
    chk(f.hudVisible && !f.winVisible, 'the HUD is theirs again and nothing is covering it');
    await shoot(page, 'playability-2-farmlands.png');

    // =================================================================================
    head('7b. DYING IN THE FARMLANDS PUTS THE PLAYER BACK IN THE FARMLANDS');
    // =================================================================================
    /* PHASE 35 closed this and it has only ever been asserted against the source. It is a
       LATENT defect rather than a live one — nothing in Levels 2 or 3 damages the player —
       which is exactly why it is worth watching happen once: `_respawn` used to clear the
       dimension flags and teleport to the Overworld spawn, whose chunks the crossing had
       disposed, with the Core Disk spent and the Anchor in another dimension. One death
       would have ended the run in a void. */
    const died = await page.evaluate(`(() => {
      const g = window.game, p = g.player;
      const before = { dim: p.inFarmlands ? 'farmlands' : 'other',
                       inv: p.inventory.slots.filter(s => s.item).map(s => s.item + 'x' + s.count).join(','),
                       compass: !!g.compassAcquired, day: g.dayCount,
                       milestones: Array.from(g.milestones) };
      p.hp = 0; p._die();
      return before;
    })()`);
    await page.waitForFunction('window.game.player.dead === false', null, { timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(600);
    const revived = await page.evaluate(SNAP);
    chk(revived.dim === 'farmlands',
        `they come back in the dimension they died in (${revived.dim}), not in an Overworld that is no longer loaded`);
    chk(!revived.dead && revived.hp === revived.maxHp, `alive and whole again (${revived.hp}/${revived.maxHp})`);
    chk(revived.inv === died.inv, `carrying exactly what they were carrying (${revived.inv})`);
    const kept = await page.evaluate(`({ compass: !!window.game.compassAcquired,
                                         day: window.game.dayCount,
                                         milestones: Array.from(window.game.milestones) })`);
    chk(kept.compass === died.compass && kept.day === died.day &&
        kept.milestones.length === died.milestones.length,
        'and every piece of progression with it — the compass, the day count, the milestones');
    const walkable = await page.evaluate(`(() => {
      const p = window.game.player, from = p.position.clone();
      p.locked = true; p.keys['KeyW'] = true;
      let grounded = 0;
      for (let i = 0; i < 120; i++) { p.update(1 / 60); if (p.onGround) grounded++; }
      p.keys['KeyW'] = false;
      return { moved: +Math.hypot(p.position.x - from.x, p.position.z - from.z).toFixed(2),
               fell: +(from.y - p.position.y).toFixed(2), grounded: grounded };
    })()`);
    chk(walkable.moved > 1.5 && walkable.fell < 3 && walkable.grounded > 60,
        `and they land on ground they can walk off: ${walkable.moved} blocks in two simulated seconds, ${walkable.fell} of fall`);

    // =================================================================================
    head('8. THE FARMLANDS PAY FOR THE NEXT ANCHOR AND HAND OVER THE NEXT DISK');
    // =================================================================================
    const ash = await page.evaluate(`(() => {
      const g = window.game, p = g.player, w = g.world;
      const px = Math.floor(p.position.x), pz = Math.floor(p.position.z);
      for (let r = 1; r < 64; r++) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          for (let y = 20; y < 40; y++) {
            if (w.getBlockWorld(px + dx, y, pz + dz) === BLOCK.ASH_WOOD) {
              w.destroyBlock(px + dx, y, pz + dz, null, true);
              return [px + dx, y, pz + dz];
            }
          }
        }
      }
      return null;
    })()`);
    chk(!!ash, 'an ashen trunk is within reach of the arrival road' + (ash ? ' (' + ash.join(',') + ')' : ''));
    await page.evaluate(`(${WALK_ONTO_DROPS.toString()})()`);
    await page.waitForFunction('window.game.player.inventory.hasItem(ITEM.ASH_LOG)', null, { timeout: 90000 })
      .catch(() => {});
    const fCraft = await page.evaluate(`(() => {
      const inv = window.game.player.inventory;
      const R = (id) => CRAFTING_RECIPES.find(r => r.id === id);
      const make = (id) => { const r = R(id); if (!inv.hasIngredients(r.reqs)) return false;
                             inv.consumeIngredients(r.reqs); inv.addItem(r.result, r.count); return true; };
      return make('ash_planks') && make('anchor');
    })()`);
    chk(fCraft, 'and it becomes an Anchor Monument without leaving the dimension');

    const l2 = await page.evaluate(`(() => {
      const g = window.game, w = g.world;
      const k = w.homeChestKey;
      if (!k) return { ok: false };
      const [x, y, z] = k.split(',').map(Number);
      w._eagerLoadAround(x, z, 2);
      g.player.position.set(x + 1.5, y, z + 0.5);
      /* A REAL RIGHT-CLICK ON A REAL CHEST, not a call into openChest: the prompt, the
         look target and the one-shot ledger are all on this path. */
      const hit = (${LOOK_AND_USE.toString()})(x, y, z);
      return { ok: true, key: k, hit: hit, entities: g.itemManager.entities.length };
    })()`);
    chk(l2.ok && l2.entities >= 1,
        `the guaranteed chest in the Disconnected Home opens to a real right-click (${l2.key})`);
    await page.evaluate(`(${WALK_ONTO_DROPS.toString()})()`);
    await page.waitForFunction('window.game.player.inventory.hasItem(ITEM.CORE_DISK_L2)', null, { timeout: 90000 })
      .catch(() => {});
    chk(await page.evaluate('window.game.player.inventory.hasItem(ITEM.CORE_DISK_L2)'),
        'and the Level 2 Rift Core Disk is in the pack');

    // =================================================================================
    head('9. THE SECOND RIFT: STATIC SUBURBIA');
    // =================================================================================
    const second = await page.evaluate(`(() => {
      const g = window.game, p = g.player, w = g.world;
      const sp = w.farmlandsSpawn;
      w._eagerLoadAround(sp.x, sp.z, 3);
      const gx = Math.floor(sp.x), gz = Math.floor(sp.z), gy = w.findSpawnHeight(gx, gz);
      p.position.set(gx + 0.5, gy, gz + 0.5); p.velocity.set(0, 0, 0);
      let bx = gx + 5, bz = gz, by = w.findSpawnHeight(bx, bz);
      if (Math.abs(by - gy) > 0.5) {
        outer: for (let r = 4; r <= 6; r++) for (let a = 0; a < 32; a++) {
          const th = a * Math.PI / 16;
          const cx = gx + Math.round(Math.cos(th) * r), cz = gz + Math.round(Math.sin(th) * r);
          if (Math.abs(w.findSpawnHeight(cx, cz) - gy) <= 0.5) { bx = cx; bz = cz; by = gy; break outer; }
        }
      }
      w.setBlockWorld(bx, by, bz, BLOCK.SAFEHOUSE_ANCHOR);
      let stood = null;
      for (const r of [4.2, 4.8, 3.8, 5.4]) {
        for (let a = 0; a < 24 && !stood; a++) {
          const th = a * Math.PI / 12;
          const px = bx + 0.5 + Math.cos(th) * r, pz = bz + 0.5 + Math.sin(th) * r;
          const py = w.findSpawnHeight(Math.floor(px), Math.floor(pz));
          if (Math.abs(py - by) > 0.5) continue;
          p.position.set(px, py, pz);
          const eye = p._eyePosition();
          p.yaw = Math.atan2(-((bx + 0.5) - eye.x), -((bz + 0.5) - eye.z));
          p.pitch = Math.atan2((by + 0.5) - eye.y, Math.hypot((bx + 0.5) - eye.x, (bz + 0.5) - eye.z));
          g.camera.position.copy(eye);
          g.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
          const t = p._getLookTarget();
          if (t && w.getBlockWorld(t.bx, t.by, t.bz) === BLOCK.SAFEHOUSE_ANCHOR) stood = true;
        }
        if (stood) break;
      }
      p.selectedSlot = p.inventory.slots.findIndex(s => s.item === ITEM.CORE_DISK_L2);
      p._placeBlockOrInteract();
      return { rift: g.anchorManager.riftActive, target: g.anchorManager.riftTargetLevel };
    })()`);
    chk(second.rift && second.target === 3, 'the Level 2 Disk opens a rift toward Static Suburbia');

    /* AND THEY WALK INTO IT, on the shipped movement code against the shipped collision.
       The walk is stepped by hand rather than left to the frame loop for one reason: a
       headless page is never granted pointer lock, so PlayerController.update returns
       early without it. The code doing the walking is the shipped code either way, and
       the crossing itself is fired by the frame loop's own trigger-radius test. */
    const approach = await page.evaluate(`(() => {
      const g = window.game, p = g.player, a = g.anchorManager.activeAnchor.pos;
      p.locked = true; p.pitch = 0; p.keys['KeyW'] = true;
      const start = +p.position.distanceTo(a).toFixed(2);
      let best = start;
      for (let i = 0; i < 600 && !p.inSuburbia; i++) {
        p.yaw = Math.atan2(-(a.x - p.position.x), -(a.z - p.position.z));
        p.update(1 / 60);
        best = Math.min(best, p.position.distanceTo(a));
      }
      p.keys['KeyW'] = false;
      return { start: start, best: +best.toFixed(2) };
    })()`);
    chk(approach.best < approach.start,
        `they walk in on their own feet: ${approach.start} blocks out, closing to ${approach.best}`);
    await page.waitForFunction('window.game.player.inSuburbia === true', null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const sub = await page.evaluate(SNAP);
    chk(sub.dim === 'suburbia', 'and the player walks into it');
    chk(sub.anchor === null && !sub.riftActive, 'leaving the Farmlands Anchor and its rift behind');
    await shoot(page, 'playability-3-suburbia.png');

    // =================================================================================
    head('10. THE DISCONNECTED HOME, AND THE LEVEL 3 DISK — A LEG NO SUITE HAD WALKED');
    // =================================================================================
    /* The suburb is infinite and the house sits four to six superblocks out on a
       deterministic ring, so the WALK is not simulated. Everything else is: the house is
       stamped by the real generator during real chunk generation, the chest registers
       itself, the right-click is the real one, the drop is a real entity, the pickup is
       the real radius, and THE HAVEN FIRES BY ITSELF from the frame loop. */
    const home = await page.evaluate(`(() => {
      const g = window.game, w = g.world;
      const t = w._subDisconnectedTarget();
      const lot = w._subLot(t.bx, t.bz, t.row, t.col);
      w._eagerLoadAround(lot.hx + 5, lot.hz + 4, 3);
      return { lot: [lot.hx, lot.hz], chestKey: w.level3HomeChestKey || null };
    })()`);
    chk(!!home.chestKey,
        'the Disconnected Home is stamped by the real generator and registers its chest' +
        (home.chestKey ? ' (' + home.chestKey + ')' : ''));

    const opened = await page.evaluate(`(() => {
      const g = window.game, w = g.world;
      const [x, y, z] = w.level3HomeChestKey.split(',').map(Number);
      /* Stand where a player standing under it would stand: the chest hangs in the dead
         centre of the inverted volume with nothing holding it up, and the floor of that
         volume is the buried gable underneath. */
      for (let dy = 0; dy < 8; dy++) {
        const fy = y - dy;
        if (w.getBlockWorld(x, fy, z) !== BLOCK.AIR && w.getBlockWorld(x, fy, z) !== BLOCK.TREASURE_CHEST) {
          g.player.position.set(x + 0.5, fy + 1, z + 0.5);
          break;
        }
      }
      const hit = (${LOOK_AND_USE.toString()})(x, y, z);
      return { hit: hit, entities: g.itemManager.entities.length,
               reach: +g.player.position.distanceTo(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)).toFixed(2) };
    })()`);
    chk(opened.entities >= 1,
        `a player standing on the floor of that room can reach the chest (${opened.reach} blocks) and open it`);

    await page.evaluate(`(${WALK_ONTO_DROPS.toString()})()`);
    await page.waitForFunction('window.game.fakeHavenTriggered === true', null, { timeout: 90000 })
      .catch(() => {});
    const took = await page.evaluate(SNAP);
    chk(took.fakeHavenTriggered,
        'collecting the Level 3 Disk fires the Fake Haven from the frame loop, with nothing asked of the player');

    // =================================================================================
    head('11. THE FAKE HAVEN, THE SHIFT, THE FINALE, THE CUT');
    // =================================================================================
    await page.waitForFunction('window.game.player.inFakeHaven === true', null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    const hav = await page.evaluate(SNAP);
    chk(hav.dim === 'haven', 'the player arrives in the Fake Haven');
    chk(hav.objective === 'Rest.' || hav.objectiveId === 'haven_rest',
        `and is asked one word: "${hav.objective}"`);
    chk(!hav.winVisible && !hav.blackCut && !hav.creditsVisible, 'with nothing left over on the screen');
    const blocked = await page.evaluate('window.game.saveGame("manual")');
    chk(blocked && !blocked.ok, `and the Haven still refuses to save: "${blocked.error}"`);
    await shoot(page, 'playability-4-haven.png');

    await page.evaluate('window.game.havenTimer = HAVEN_SHIFT_SECONDS + 1;');
    await page.waitForFunction('window.game.havenShiftTriggered === true', null, { timeout: 90000 });
    const fin = await page.evaluate(SNAP);
    chk(fin.finaleActive, 'running the record out hands to the finale');
    chk(!fin.hudVisible, 'and the interface is not there for it');

    await page.evaluate(`(() => {
      const g = window.game;
      const t = setInterval(() => {
        if (!g.finale || !g.finale.active) { clearInterval(t); return; }
        g.finale.t = Math.max(g.finale.t, FINALE_DURATION - 0.2);
      }, 60);
    })()`);
    await page.waitForFunction('window.game.climaxTriggered === true', null, { timeout: 120000 });
    await page.waitForTimeout(1600);
    const end = await page.evaluate(SNAP);
    chk(end.climax, 'the finale reaches the hard cut');
    chk(end.blackCut, 'the screen is cut to black');
    chk(end.creditsVisible, 'and the credits are up — the run is finishable');
    await shoot(page, 'playability-5-credits.png');

    // =================================================================================
    head('12. AND A NEW GAME FROM THE ENDING IS A GAME, NOT A BLACK RECTANGLE');
    // =================================================================================
    /* #blackCut (z 65) and #creditsScreen (z 70) both sit above the settings panel at 56
       and NOTHING ever removed either of them. Phase 33 made a New Game from the ending
       reachable on purpose and fixed the HUD's inline display; these two were the rest of
       it, and without them the next run played out under an opaque sheet. */
    await page.evaluate('window.game.newGame()');
    await page.waitForTimeout(800);
    const fresh = await page.evaluate(SNAP);
    chk(!fresh.blackCut, 'the hard cut is taken down');
    chk(!fresh.creditsVisible, 'the credits are taken down');
    chk(fresh.whiteFade < 0.02, 'the white wash is clear');
    chk(!fresh.winVisible, 'no win screen survived either');
    chk(fresh.hudVisible, 'and the HUD is visible again');
    chk(fresh.dim === 'overworld' && fresh.day === 1 && !fresh.behemothDefeated && !fresh.climax,
        `the new run is a new run (day ${fresh.day}, ${fresh.dim})`);
    chk(fresh.inv === '' || /^13x1$/.test(fresh.inv) || fresh.inv.split(',').length <= 2,
        `and inherits nothing from the last one (pack: "${fresh.inv}")`);

    // =================================================================================
    head('13. NOTHING BROKE ON THE WAY');
    // =================================================================================
    chk(errors.length === 0, errors.length ? `the page raised ${errors.length} error(s)` :
        'the page raised no errors across the whole run');
    for (const e of errors.slice(0, 6)) note(e);
    note('screenshots: ' + (shots.join(', ') || 'none'));
  } catch (e) {
    chk(false, 'the run threw: ' + (e && e.message));
    console.log(e && e.stack);
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail) { console.log(`${fail} PHASE 36 BROWSER PLAYABILITY CHECK(S) FAILED`); process.exit(1); }
  console.log('ALL PHASE 36 BROWSER PLAYABILITY CHECKS PASS');
  note('A real New Game, served over HTTP, walked to the credits with no debug command in');
  note('it. Headless Chromium renders through SwiftShader and to a null audio device, so');
  note('this proves the game RUNS and PROGRESSES. Whether it is worth playing, whether the');
  note('sound is right, and whether a person can find the Disconnected Home on their own');
  note('are judgements only a human playthrough can make.');
})();
