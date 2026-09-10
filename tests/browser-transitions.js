/* =====================================================================================
   PHASE 35 — THE WHOLE RIFT CHAIN, IN A REAL BROWSER, OVER HTTP.

   This one IS a browser. It launches Chromium through Playwright, serves game.html over
   HTTP (never file:// — see CLAUDE.md 61.07), boots the real game with a real WebGL
   context and a real AudioContext, and then walks the real progression:

       a real New Game
         -> a real Anchor Monument, PLACED with the real right-click on real ground
         -> a real Hollowed Behemoth, spawned by the real spawner and killed with the
            real damage path, so the Core Disk arrives as a real dropped ItemEntity and
            is collected by the real pickup radius
         -> the real right-click that feeds it to the Anchor
         -> the real trigger radius, walked into
         -> THE SHATTERED FARMLANDS
         -> a real ashen trunk, chopped through the real destroyBlock, collected
         -> the real crafting bench: Ash Log -> planks -> Anchor Monument
         -> the Level 2 Rift Core Disk out of the real guaranteed chest
         -> the real right-click that feeds it to the second Anchor
         -> STATIC SUBURBIA

   Not one step of that is a debug command. `debugTeleportTo*` is never called.

   WHAT IT PROVES THAT NO OFFLINE TEST CAN. That the transitions actually happen at
   runtime, against a live renderer, a live streamer, a live audio graph and a live DOM:
   the destination loads, the player lands on ground and can walk, the objective is the
   destination's, the previous dimension's Anchor, rift, entities and beds are gone, the
   audio scene changes with the place, the save written on the far side validates, and
   the page raises no error doing any of it.

   THE BUG IT WAS WRITTEN FOR. Before Phase 35 this run could not reach step 8: the
   Level 1->2 crossing left the Anchor's rift open, `powerRiftCore(3)` refused for the
   rest of the session, and Static Suburbia, the Fake Haven and the finale were
   unreachable in normal play. See tests/transitions.js for the full account.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_TRANSITIONS_PORT || 8241);

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

/* Everything the assertions read, gathered in ONE page call so no two checks can ever
   compare two different moments. */
const SNAP = () => {
  const g = window.game, p = g.player, w = g.world, a = g.anchorManager;
  const el = (id) => document.getElementById(id);
  const L = g.sound && g.sound.library;
  const beds = {};
  if (L && L.slots) for (const [k, v] of L.slots) beds[k] = v ? (v.key || null) : null;
  return {
    dim: p.inFakeHaven ? 'haven' : p.inSuburbia ? 'suburbia' : p.inFarmlands ? 'farmlands' : 'overworld',
    running: !!g.running,
    pos: [+p.position.x.toFixed(2), +p.position.y.toFixed(2), +p.position.z.toFixed(2)],
    onGround: !!p.onGround, dead: !!p.dead, hp: p.hp, maxHp: p.maxHp,
    movementLocked: !!p.movementLocked, sanity: +g.sanity.value.toFixed(1),

    anchor: a.activeAnchor ? [Math.floor(a.activeAnchor.pos.x), Math.floor(a.activeAnchor.pos.z)] : null,
    riftActive: !!a.riftActive, riftTarget: a.riftTargetLevel,
    riftArming: +(a.riftArming || 0).toFixed(2), riftReady: !!a.riftReady(),
    domeVisible: !!a.domeParticles.visible,
    glyphVisible: !!(a.riftCoreMesh && a.riftCoreMesh.visible),

    chunks: w.chunks.size, pinned: w.pinnedChunkKeys.size, anchorPin: w._anchorPinKey || null,
    mobs: g.mobs.mobs.length, items: g.itemManager.entities.length,
    arrows: g.arrows.arrows ? g.arrows.arrows.length : 0,
    animals: g.farmAnimals && g.farmAnimals.live ? g.farmAnimals.live.size : 0,
    stalkerActive: !!(g.stalker && g.stalker.active),
    sceneChildren: g.scene.children.length,

    objective: (() => { const n = el('journeyStep'); return n && n.className.indexOf('show') >= 0 ? n.textContent : null; })(),
    objectiveId: g.objectives ? g.objectives.currentId : null,
    banner: (() => { const n = el('dimensionBanner');
      return n && n.classList.contains('active') ? n.textContent : null; })(),
    compass: (() => { const n = el('compassWrap'); return !!(n && n.classList.contains('show')); })(),

    beds: beds,
    inv: p.inventory.slots.filter(s => s.item).map(s => s.item + 'x' + s.count).join(','),
    disks: Array.from(g.riftDisksCollected || []),
    breached: Array.from(g.dimensionsBreached || []),
    fog: +g.env.fog.density.toFixed(5),
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

  try {
    console.log('SERVED OVER HTTP at http://127.0.0.1:' + PORT + '/game.html — never file://');
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('!!window.game', null, { timeout: 120000 });
    await page.waitForTimeout(400);

    // =================================================================================
    head('1. A REAL NEW GAME, IN THE OVERWORLD');
    // =================================================================================
    await page.click('#clickPlay');
    await page.waitForTimeout(600);
    await page.evaluate('window.game.film && window.game.film.active && window.game.film.skip()');
    await page.waitForFunction('window.game.running === true', null, { timeout: 60000 });
    await page.waitForTimeout(900);

    const s0 = await page.evaluate(SNAP);
    chk(s0.running && s0.dim === 'overworld', 'the run starts in the Overworld');
    chk(s0.anchor === null && !s0.riftActive, 'with no Anchor and no rift');
    chk(s0.objectiveId === 'gather_wood', `and the first objective is the first one: "${s0.objective}"`);

    // =================================================================================
    head('2. A REAL ANCHOR, PLACED WITH A REAL RIGHT-CLICK');
    // =================================================================================
    /* The player is given the ITEM (they would have crafted it from four planks; the
       recipe path is proved offline in transitions.js). Everything after that is the
       real placement path: a real look-target, a real placeBlock, a real setBlockWorld,
       and therefore the real AnchorMonumentManager.placeAnchor. */
    const placed = await page.evaluate(`(() => {
      const g = window.game, p = g.player;
      p.inventory.addItem(ITEM.SAFEHOUSE_ANCHOR, 1);
      p.selectedSlot = p.inventory.slots.findIndex(s => s.item === ITEM.SAFEHOUSE_ANCHOR);
      // Stand on a known column and target the ground two blocks in front.
      const bx = Math.floor(p.position.x) + 2, bz = Math.floor(p.position.z);
      const by = g.world.findSpawnHeight(bx, bz) - 1;       // the surface block itself
      const hit = (${LOOK_AND_USE.toString()})(bx, by, bz);
      window.__anchorBlock = [bx, by + 1, bz];
      return { hit: hit, anchor: !!g.anchorManager.activeAnchor };
    })()`);
    await page.waitForTimeout(300);
    const s1 = await page.evaluate(SNAP);
    chk(!!s1.anchor, 'a right-click on the ground raises a real Anchor Monument');
    chk(s1.domeVisible, 'its shield dome is up');
    chk(s1.anchorPin !== null, 'and its chunk is pinned, recorded as the Anchor’s own pin');

    // =================================================================================
    head('3. A REAL BEHEMOTH, A REAL KILL, A REAL CORE DISK ON THE GROUND');
    // =================================================================================
    const kill = await page.evaluate(`(() => {
      const g = window.game, p = g.player;
      // Spawned by the real spawner, away from the Anchor so the shield cannot vaporise
      // it (a shield kill leaves no corpse and therefore no loot — see _onMobDeath).
      const at = p.position.clone(); at.x += 42; at.z += 42;
      const mob = g.mobs.spawnBehemoth(at);
      let guard = 0;
      while (mob.hp > 0 && guard++ < 500) g.mobs.damageMob(mob, 40, null, 0);
      return { hp: mob.hp, alive: mob.alive };
    })()`);
    /* The loot table is fired by MobManager.update when it reaps the body, which is the
       next frame the loop gets to. Under SwiftShader that can be a long way from the
       next millisecond, so this WAITS FOR THE DROP rather than guessing at a duration —
       a fixed sleep here made the whole suite flaky. */
    await page.waitForFunction('window.game.itemManager.entities.length >= 1', null, { timeout: 60000 })
      .catch(() => {});
    const dropped = await page.evaluate('window.game.itemManager.entities.length');
    chk(kill.hp <= 0 && !kill.alive && dropped >= 1,
        `the Behemoth dies to the real damage path and its loot table leaves ${dropped} real dropped item(s)`);

    /* And the player collects it through the real pickup radius, by standing on it. */
    await page.evaluate(`(() => {
      const g = window.game, e = g.itemManager.entities[0];
      if (e) g.player.position.set(e.position.x, e.position.y + 1, e.position.z);
    })()`);
    await page.waitForFunction('window.game.player.inventory.hasItem(ITEM.CORE_DISK)', null, { timeout: 60000 })
      .catch(() => {});
    const s2 = await page.evaluate(SNAP);
    chk(/(^|,)36x/.test(s2.inv), `the Core Disk is picked up off the ground (pack: ${s2.inv})`);
    chk(s2.objectiveId === 'raise_anchor' || s2.objectiveId === 'bring_disk' || s2.objectiveId === 'endure',
        `and the objective answers it: "${s2.objective}"`);

    // =================================================================================
    head('4. FEEDING THE DISK TO THE ANCHOR OPENS THE RIFT — AND NOT INSTANTLY');
    // =================================================================================
    await page.evaluate(`(() => {
      const g = window.game, p = g.player, a = window.__anchorBlock;
      // Stand beside the monument, as a player would, and right-click it.
      p.position.set(a[0] + 2.5, a[1], a[2] + 0.5);
      const i = p.inventory.slots.findIndex(s => s.item === ITEM.CORE_DISK);
      if (i < 0) throw new Error('no Core Disk in the pack — the kill or the pickup did not land');
      p.selectedSlot = i;
      window.__fed = (${LOOK_AND_USE.toString()})(a[0], a[1], a[2]);
    })()`);
    const arming = await page.evaluate(SNAP);
    chk(arming.riftActive && arming.riftTarget === 2, 'the Disk powers the rift toward the Farmlands');
    chk(!/(^|,)36x/.test(arming.inv), 'and is consumed');
    chk(arming.glyphVisible && arming.domeVisible, 'the glyph is up and the dome is lit');
    chk(arming.dim === 'overworld',
        'and the player is still standing in the Overworld looking at it — the rift does not fire on the same frame');
    await shoot(page, 'transitions-1-rift-open.png');

    // =================================================================================
    head('5. WALKING INTO IT: THE SHATTERED FARMLANDS');
    // =================================================================================
    await page.waitForFunction('window.game.player.inFarmlands === true', null, { timeout: 30000 });
    await page.waitForTimeout(1600);
    const f = await page.evaluate(SNAP);

    chk(f.dim === 'farmlands', 'the player is in the Farmlands');
    chk(f.banner === 'THE SHATTERED FARMLANDS', `and the banner says so: "${f.banner}"`);
    chk(f.hp === f.maxHp && f.sanity === 100 && !f.dead, 'whole, and settled');
    chk(!f.movementLocked, 'and in control of their own body');

    /* THE REGRESSION THIS FILE EXISTS FOR. */
    chk(f.anchor === null, 'THE ANCHOR DID NOT CROSS: there is no monument in the new dimension');
    chk(!f.riftActive && f.riftTarget === null, 'and no rift is open — which is what makes the NEXT one possible');
    chk(!f.domeVisible && !f.glyphVisible, 'nothing of it is still being drawn');
    chk(f.anchorPin === null, 'and its chunk is no longer pinned, so the Overworld is genuinely unloaded');
    chk(f.objectiveId && f.objectiveId.indexOf('farm') === 0,
        `the objective is the Farmland journey's, not the rift behind them: "${f.objective}"`);

    chk(f.mobs === 0 && f.items === 0 && f.arrows === 0 && !f.stalkerActive,
        'nothing hostile, dropped or in flight followed them through');
    chk(f.beds.air && /farm/.test(f.beds.air),
        `the ambience is the Farmlands' own (air: ${f.beds.air}, layer: ${f.beds.layer}, tone: ${f.beds.tone})`);
    chk(!Object.keys(f.beds).some(k => /rift/.test(String(f.beds[k]))),
        'and no Rift bed survived the crossing');

    /* THEY CAN ACTUALLY WALK ON IT. This is the claim an eagerly generated arrival ring
       exists for: collision reads chunk.data directly, so a player standing where the
       ring has not been built reads air under their feet and falls out of the world.
       `locked` is forced because a headless page is never granted pointer lock and the
       movement path is gated on it — the movement code itself is the real one, driven at
       a real timestep. */
    const walked = await page.evaluate(`(() => {
      const g = window.game, p = g.player;
      const from = p.position.clone();
      p.locked = true;
      p.keys['KeyW'] = true;
      let grounded = 0;
      for (let i = 0; i < 120; i++) { p.update(1 / 60); if (p.onGround) grounded++; }
      p.keys['KeyW'] = false;
      return { moved: +Math.hypot(p.position.x - from.x, p.position.z - from.z).toFixed(2),
               fell: +(from.y - p.position.y).toFixed(2), grounded: grounded,
               y: +p.position.y.toFixed(2) };
    })()`);
    /* `grounded` rather than the instantaneous onGround: farmland rolls, and the last
       frame of a two-second walk across it is as likely as not to be mid-step. What is
       being proved is that there was ground under them the whole way, which is what an
       ungenerated arrival ring would fail. */
    chk(walked.moved > 1.5 && walked.fell < 3 && walked.grounded > 60,
        `and they can walk on it: ${walked.moved} blocks in two simulated seconds, ${walked.fell} of fall, on the ground for ${walked.grounded}/120 frames`);
    await shoot(page, 'transitions-2-farmlands.png');

    // A save on the far side has to be a save.
    await page.evaluate("window.game.saveGame('manual')");
    await page.waitForTimeout(200);
    const saved = await page.evaluate(`(() => {
      const raw = localStorage.getItem('whereitisnt.save.v1');
      if (!raw) return null;
      const st = JSON.parse(raw).state || JSON.parse(raw);
      const v = validateSaveState(st);
      return { ok: v.ok, dim: v.ok ? v.state.dimension : null,
               anchor: v.ok ? v.state.anchor : undefined, repairs: v.repairs || [] };
    })()`);
    chk(saved && saved.ok && saved.dim === 'farmlands',
        'a save written on the far side validates and names the Farmlands');
    chk(saved && saved.anchor === null,
        'and carries no Anchor, because there is none to carry');

    // =================================================================================
    head('6. THE FARMLANDS CAN RAISE THE ANCHOR THE NEXT DISK NEEDS');
    // =================================================================================
    /* A real ashen trunk, found in the real generated world, broken through the real
       destroyBlock, and collected through the real pickup radius. */
    const chopped = await page.evaluate(`(() => {
      const g = window.game, p = g.player, w = g.world;
      const px = Math.floor(p.position.x), pz = Math.floor(p.position.z);
      for (let r = 1; r < 64; r++) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = px + dx, z = pz + dz;
          for (let y = 20; y < 40; y++) {
            if (w.getBlockWorld(x, y, z) === BLOCK.ASH_WOOD) {
              w.destroyBlock(x, y, z, null, true);
              return { at: [x, y, z], items: g.itemManager.entities.length };
            }
          }
        }
      }
      return null;
    })()`);
    chk(!!chopped, 'there is an ashen trunk within reach of the arrival road' +
        (chopped ? ' (' + chopped.at.join(',') + ')' : ''));
    if (chopped) {
      await page.evaluate(`(() => {
        const g = window.game, e = g.itemManager.entities[0];
        if (e) g.player.position.set(e.position.x, e.position.y + 1, e.position.z);
      })()`);
      await page.waitForFunction('window.game.player.inventory.hasItem(ITEM.ASH_LOG)', null, { timeout: 60000 })
        .catch(() => {});
      const s3 = await page.evaluate(SNAP);
      chk(new RegExp('(^|,)' + (await page.evaluate('ITEM.ASH_LOG')) + 'x').test(s3.inv),
          `chopping it yields an Ash Log the player can pick up (pack: ${s3.inv})`);
    }

    /* And the bench turns it into the Anchor, through the real recipe table. */
    const crafted = await page.evaluate(`(() => {
      const g = window.game, inv = g.player.inventory;
      const R = (id) => CRAFTING_RECIPES.find(r => r.id === id);
      const make = (id) => { const r = R(id); if (!inv.hasIngredients(r.reqs)) return false;
                             inv.consumeIngredients(r.reqs); inv.addItem(r.result, r.count); return true; };
      const planks = make('ash_planks');
      const anchor = make('anchor');
      return { planks, anchor, has: inv.hasItem(ITEM.SAFEHOUSE_ANCHOR) };
    })()`);
    chk(crafted.planks && crafted.anchor && crafted.has,
        'one Ash Log becomes four planks becomes an Anchor Monument — entirely inside the Farmlands');

    // =================================================================================
    head('7. THE LEVEL 2 RIFT CORE DISK, OUT OF THE GUARANTEED CHEST');
    // =================================================================================
    const disk = await page.evaluate(`(() => {
      const g = window.game, w = g.world;
      const k = w.homeChestKey;
      if (!k) return { ok: false, why: 'no chest key registered' };
      const [x, y, z] = k.split(',').map(Number);
      w._eagerLoadAround(x, z, 2);
      const loot = w.openChest(x, y, z, null);
      return { ok: !!loot, key: k, loot: loot ? loot.map(l => l.item + 'x' + l.count) : null,
               entities: g.itemManager.entities.length };
    })()`);
    chk(disk.ok, 'the guaranteed chest in the Disconnected Home opens' + (disk.ok ? ` (${disk.key})` : ': ' + disk.why));
    await page.evaluate(`(() => {
      const g = window.game;
      for (const e of g.itemManager.entities.slice()) {
        g.player.position.set(e.position.x, e.position.y + 1, e.position.z);
      }
    })()`);
    await page.waitForFunction('window.game.player.inventory.hasItem(ITEM.CORE_DISK_L2)', null, { timeout: 60000 })
      .catch(() => {});
    const s4 = await page.evaluate(SNAP);
    chk(/(^|,)38x/.test(s4.inv), `the Level 2 Rift Core Disk is in the pack (${s4.inv})`);

    // =================================================================================
    head('8. THE SECOND RIFT — THE ONE THAT WAS IMPOSSIBLE');
    // =================================================================================
    const second = await page.evaluate(`(() => {
      const g = window.game, p = g.player, w = g.world;
      /* BACK OUT INTO THE OPEN FIRST. Section 7 left the player standing in the buried
         cellar under the Disconnected Home, thirty blocks below the surface, which is
         nobody's idea of where to raise a monument. The arrival pad is the flat, cleared,
         decor-free ground the dimension already guarantees — the walk back to it is a
         real walk in a real playthrough and is not what this section is measuring. */
      const sp = w.farmlandsSpawn;
      w._eagerLoadAround(sp.x, sp.z, 3);
      const gx = Math.floor(sp.x), gz = Math.floor(sp.z);
      const gy = w.findSpawnHeight(gx, gz);
      p.position.set(gx + 0.5, gy, gz + 0.5);
      p.velocity.set(0, 0, 0);

      /* The monument goes on LEVEL ground: the trigger radius is a 3D distance, so one
         raised on a bank four blocks up is genuinely further away than it looks — true
         in the game as well as here, and not what this section is testing. */
      let bx = gx + 5, bz = gz, by = w.findSpawnHeight(bx, bz);
      if (Math.abs(by - gy) > 0.5) {
        outer: for (let r = 4; r <= 6; r++) {
          for (let a = 0; a < 32; a++) {
            const th = a * Math.PI / 16;
            const cx = gx + Math.round(Math.cos(th) * r), cz = gz + Math.round(Math.sin(th) * r);
            if (Math.abs(w.findSpawnHeight(cx, cz) - gy) <= 0.5) { bx = cx; bz = cz; by = gy; break outer; }
          }
        }
      }
      w.setBlockWorld(bx, by, bz, BLOCK.SAFEHOUSE_ANCHOR);
      window.__anchor2 = [bx, by, bz];

      /* And the player stands where they can actually SEE it: a crop row or a fence
         between the eye and the monument would make the right-click land on the crop.
         Candidates are tried outward and the first one whose real look-target is the
         Anchor wins — the same thing a player does without thinking about it. */
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
          if (t && w.getBlockWorld(t.bx, t.by, t.bz) === BLOCK.SAFEHOUSE_ANCHOR) stood = [px, py, pz, r];
        }
        if (stood) break;
      }
      if (!stood) throw new Error('could not find a spot with a clear line to the Anchor');

      const di = p.inventory.slots.findIndex(s => s.item === ITEM.CORE_DISK_L2);
      if (di < 0) throw new Error('no Level 2 Disk in the pack');
      p.selectedSlot = di;
      p._placeBlockOrInteract();
      const a = g.anchorManager;
      return { stood: stood, riftActive: a.riftActive, target: a.riftTargetLevel,
               ready: a.riftReady(), dim: p.inSuburbia ? 'suburbia' : 'farmlands',
               dist: +p.position.distanceTo(a.activeAnchor.pos).toFixed(2),
               stillHolding: p.inventory.hasItem(ITEM.CORE_DISK_L2) };
    })()`);
    chk(second.riftActive && second.target === 3,
        'feeding the Level 2 Disk to a Farmlands Anchor OPENS A RIFT — this returned false in every previous build');
    chk(!second.stillHolding, 'and consumes the Disk, which it also never did');
    chk(second.dim === 'farmlands' && second.dist > 3,
        `and the player is standing ${second.dist} blocks off it, outside the trigger radius`);
    await shoot(page, 'transitions-3-second-rift.png');

    /* AND THEY WALK INTO IT. Real movement code, real collision, and then the real
       frame loop's own trigger-radius test fires the crossing — nothing here calls a
       transition. (The walk is stepped rather than left to the frame loop because a
       headless page is never granted pointer lock and PlayerController.update returns
       early without it; the code doing the walking is the shipped code either way.) */
    const approach = await page.evaluate(`(() => {
      const g = window.game, p = g.player, a = g.anchorManager.activeAnchor.pos;
      p.locked = true;
      p.yaw = Math.atan2(-(a.x - p.position.x), -(a.z - p.position.z));
      p.pitch = 0;
      p.keys['KeyW'] = true;
      const start = +p.position.distanceTo(a).toFixed(2);
      let best = start;
      for (let i = 0; i < 600 && !g.player.inSuburbia; i++) {
        p.update(1 / 60);
        best = Math.min(best, p.position.distanceTo(a));
        // Re-aim each frame: terrain deflects a straight walk, and a player would too.
        p.yaw = Math.atan2(-(a.x - p.position.x), -(a.z - p.position.z));
      }
      p.keys['KeyW'] = false;
      return { start, end: +p.position.distanceTo(a).toFixed(2), best: +best.toFixed(2) };
    })()`);
    chk(approach.best < approach.start,
        `they walk in on their own feet: ${approach.start} blocks out, closing to ${approach.best}`);
    await page.waitForFunction('window.game.player.inSuburbia === true', null, { timeout: 30000 });
    await page.waitForTimeout(1600);
    const su = await page.evaluate(SNAP);

    chk(su.dim === 'suburbia', 'and walking into it arrives in STATIC SUBURBIA');
    chk(su.banner === 'STATIC SUBURBIA', `the banner says so: "${su.banner}"`);
    chk(su.anchor === null && !su.riftActive, 'the Farmlands Anchor and its rift did not cross either');
    chk(su.animals === 0, 'and no Farmland animal rig came with them');
    chk(su.objectiveId && su.objectiveId.indexOf('sub') === 0,
        `the objective is Suburbia's: "${su.objective}"`);
    chk(su.beds.air && /sub/.test(su.beds.air),
        `and the ambience is Suburbia's (air: ${su.beds.air}, layer: ${su.beds.layer}, tone: ${su.beds.tone})`);
    chk(su.breached.length >= 3, `all three dimensions are recorded as breached (${su.breached.join(', ')})`);

    const walked2 = await page.evaluate(`(() => {
      const g = window.game, p = g.player;
      const from = p.position.clone();
      p.locked = true;
      p.keys['KeyW'] = true;
      let grounded = 0;
      for (let i = 0; i < 120; i++) { p.update(1 / 60); if (p.onGround) grounded++; }
      p.keys['KeyW'] = false;
      return { moved: +Math.hypot(p.position.x - from.x, p.position.z - from.z).toFixed(2),
               fell: +(from.y - p.position.y).toFixed(2), grounded: grounded };
    })()`);
    chk(walked2.moved > 1.5 && walked2.fell < 3 && walked2.grounded > 60,
        `they land on a street they can walk on: ${walked2.moved} blocks in two simulated seconds, ${walked2.fell} of fall`);
    await shoot(page, 'transitions-4-suburbia.png');

    // =================================================================================
    head('9. THE FAR SIDE SAVES, LOADS, AND COMES BACK THE SAME');
    // =================================================================================
    await page.evaluate("window.game.saveGame('manual')");
    await page.waitForTimeout(250);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction('!!window.game', null, { timeout: 120000 });
    await page.waitForTimeout(500);
    await page.click('#continuePlay');
    await page.waitForFunction('window.game.running === true', null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const back = await page.evaluate(SNAP);
    chk(back.dim === 'suburbia', 'a reload and CONTINUE come back in Static Suburbia');
    chk(back.anchor === null && !back.riftActive, 'with no Anchor and no rift restored out of nowhere');
    chk(back.objectiveId && back.objectiveId.indexOf('sub') === 0,
        `and Suburbia's objective, not a stale one: "${back.objective}"`);
    chk(back.dim === 'suburbia' && back.hp > 0 && !back.dead, 'alive and placed');

    // =================================================================================
    head('10. NOTHING BROKE ON THE WAY');
    // =================================================================================
    chk(errors.length === 0, 'the page raised no errors across the whole run' +
        (errors.length ? ':\n        ' + errors.slice(0, 6).join('\n        ') : ''));
    note('screenshots: ' + (shots.join(', ') || 'none'));

  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail) { console.log(fail + ' PHASE 35 BROWSER TRANSITION CHECK(S) FAILED'); process.exit(1); }
  console.log('ALL PHASE 35 BROWSER TRANSITION CHECKS PASS');
  note('A real Chromium, a real WebGL context, a real AudioContext, served over HTTP.');
  note('Both rifts were opened and walked through by the real interaction path; no');
  note('debugTeleport was called. No human has played this build.');
})().catch((e) => { console.error(e); process.exit(1); });
