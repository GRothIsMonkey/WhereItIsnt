/* PHASE 23 — SAVE / LOAD IN A REAL BROWSER.

   This one IS a browser. It launches Chromium through Playwright, serves game.html over
   HTTP, boots the real game with a real WebGL context, and then drives the real DOM:
   it clicks BEGIN, it presses O to open the pause panel, it clicks the SAVE button, it
   RELOADS THE PAGE — a genuinely fresh runtime, fresh renderer, fresh audio graph,
   fresh everything — and clicks CONTINUE. What it asserts afterwards is what the player
   would see.

   It also does the things a player does by accident: loading twice in a row, starting a
   new game, and opening a page whose stored save is corrupt.

   REQUIREMENTS. Playwright and a Chromium build. Both are present in the development
   container; on a machine without them this file skips with a clear message rather than
   failing, and the offline suite in save.js still covers the state machine.

   three.js is loaded from a CDN by game.html. If tests/vendor/three.min.js exists it is
   served in place of the CDN request so the run is hermetic and offline:

       mkdir -p tests/vendor
       curl -o tests/vendor/three.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

   Without it the test lets the request go to the network and says so. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_BROWSER_PORT || 8207);

let chromium = null;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; }
}
if (!chromium) {
  console.log('SKIP  playwright is not installed — browser validation not run.');
  console.log('      (npm i -D playwright, or run this in the development container)');
  process.exit(0);
}

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);

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

/* Everything the assertions read, gathered in one pass inside the page so a check can
   never compare two different moments. Deliberately reads the LIVE runtime objects, not
   the save file — the question is what was restored, not what was written. */
const SNAPSHOT = `(() => {
  const g = window.game, p = g.player;
  return {
    running: g.running,
    dimension: p.inFarmlands ? 'farmlands' : (p.inSuburbia ? 'suburbia' : 'overworld'),
    pos: { x: p.position.x, y: p.position.y, z: p.position.z },
    yaw: p.yaw, pitch: p.pitch,
    hp: p.hp, maxHp: p.maxHp, dead: p.dead,
    /* PHASE 26 — p.level is gone with the XP system; what is read here now is the
       milestone latch set and the bonuses a legacy save may still carry. */
    milestones: Array.from(g.milestones),
    attackBonus: p.attackBonus, miningSpeedBonus: p.miningSpeedBonus,
    xpBar: !!document.getElementById('xpBarInner'),
    levelLabel: !!document.getElementById('levelLabel'),
    selectedSlot: p.selectedSlot,
    inventory: p.inventory.slots.map(s => (s.item ? [s.item, s.count] : null)),
    sanity: g.sanity.value,
    stage: g.stage, dayCount: g.dayCount, memoryFragments: g.memoryFragments,
    cycleSeconds: g.env.cycleSeconds,
    compass: g.compassAcquired,
    compassShown: g.ui.compassShown,
    chestsOpened: p.chestsOpened || 0,
    openedChests: Array.from(g.world.openedChests),
    editedChunks: g.world.editedChunks.size,
    editCount: (() => { let n = 0; for (const m of g.world.editedChunks.values()) n += m.size; return n; })(),
    anchor: g.anchorManager.activeAnchor
      ? { x: g.anchorManager.activeAnchor.pos.x, fuel: g.anchorManager.activeAnchor.fuel,
          rift: g.anchorManager.riftActive } : null,
    chunks: g.world.chunks.size,
    sceneChildren: g.scene.children.length,
    mobs: g.mobs.mobs.length,
    items: g.itemManager.entities.length,
    torchLights: g.world.torchLights.size,
    /* PHASE 25 — what the objective line is ACTUALLY showing on screen, read from the
       DOM rather than from the system, so this is the player's view and not the model's. */
    objectiveId: g.objectives ? g.objectives.currentId : null,
    objectiveText: (() => { const n = document.getElementById('journeyStep');
      return n && n.className.indexOf('show') >= 0 ? n.textContent : null; })(),
    objectiveMarks: g.objectives ? Object.assign({}, g.objectives.progress) : null,
    /* PHASE 27 — the HUD as the player sees it, read from the live document. Layout
       numbers come from getBoundingClientRect, so an element that exists but is not on
       the screen cannot pass as one that is. */
    hudLit: (() => { const t = document.getElementById('conditionTicks');
      return t ? Array.from(t.children).filter(c => c.classList.contains('lit')).length : -1; })(),
    hudTicks: (() => { const t = document.getElementById('conditionTicks');
      return t ? t.children.length : -1; })(),
    hudVitalState: (() => { const v = document.getElementById('vitals');
      return v ? Array.from(v.classList).sort().join(' ') : null; })(),
    hudSlot: (() => { const h = document.getElementById('hotbar');
      return h ? Array.from(h.children).findIndex(c => c.classList.contains('active')) : -1; })(),
    hasSave: g.hasSave(),
    continueVisible: (() => { const b = document.getElementById('continuePlay');
      return !!b && b.style.display !== 'none' && b.offsetParent !== null; })(),
  };
})()`;

/* CLICKING A BUTTON INSIDE THE PAUSE PANEL.

   Two steps on purpose. First a REAL hit test — document.elementFromPoint at the
   button's own centre — which is the thing worth asserting: that the control is on top,
   inside the panel, and not covered by the overlay or a HUD layer. Then the click is
   dispatched on the element, which runs the real listener. Playwright's own synthetic
   mouse click is avoided here only because the page runs a WebGL frame loop that keeps
   the compositor busy enough for its actionability retry to time out; the layering it
   would be checking is checked explicitly above instead. */
async function clickPanel(page, sel) {
  const top = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return 'missing';
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return 'zero-size';
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit === el || el.contains(hit) ? 'ok' : (hit ? '#' + (hit.id || hit.tagName) : 'null');
  }, sel);
  if (top !== 'ok') throw new Error(sel + ' is not the topmost element at its own centre: ' + top);
  await page.$eval(sel, (el) => el.click());
  await page.waitForTimeout(150);
  return true;
}

async function boot(page, { fresh }) {
  await page.waitForFunction('!!window.game', null, { timeout: 90000 });
  if (fresh) {
    // PHASE 28 — BEGIN EXPEDITION goes straight into the game; there is no skip link.
    await page.click('#clickPlay');
    await page.keyboard.press('Space');            // skip the opening instruction
  } else {
    /* Record the orientation at the instant the restore finishes — BEFORE the frame loop
       starts and before any mouse event can reach the mouse-look handler. A headless
       Chromium may or may not grant pointer lock, and Playwright's own click moves a real
       cursor, so a yaw read a few hundred milliseconds later is measuring the mouse, not
       the loader. */
    await page.evaluate(() => {
      const g = window.game, orig = g._beginPlay.bind(g);
      g._beginPlay = function () { window.__orientationAtLoad = [g.player.yaw, g.player.pitch]; return orig(); };
    });
    await page.click('#continuePlay');
  }
  await page.waitForFunction('window.game && window.game.running === true', null, { timeout: 60000 });
  await page.waitForTimeout(400);                  // a few real frames
}

(async () => {
  const hermetic = fs.existsSync(VENDOR_THREE);
  const srv = await serve();
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Pointer lock cannot be granted to a headless page without a user gesture chain.
    if (/pointer ?lock/i.test(t)) return;
    errors.push('console: ' + t);
  });
  if (hermetic) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
    await boot(page, { fresh: true });

    const renderer = await page.evaluate(() => {
      const gl = window.game.renderer.getContext();
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    chk(true, 'the game boots in Chromium with a live WebGL context');
    note('renderer: ' + renderer);
    note('three.js: ' + (hermetic ? 'served from tests/vendor (hermetic)' : 'fetched from the CDN'));

    const first = await page.evaluate(SNAPSHOT);
    chk(first.running === true, 'and reaches the frame loop');
    chk(first.continueVisible === false, 'with no CONTINUE button, because there is no save yet');
    chk(first.hasSave === false, 'and hasSave() agrees');

    // --- PHASE 25: the objective line, in a real browser --------------------------
    chk(first.objectiveText === 'Gather wood.',
        `a new game shows one objective on screen: "${first.objectiveText}"`);
    chk(await page.evaluate(() => {
          const n = document.getElementById('journeyStep');
          const r = n.getBoundingClientRect();
          return r.width > 40 && r.height > 6 && getComputedStyle(n).display !== 'none';
        }), 'and it is actually visible — laid out, non-zero, not display:none');
    chk(await page.evaluate(() => {
          const steps = ['step1','step2','step3','step4','step5','step6'];
          return steps.every(id => !document.getElementById(id));
        }), 'while the old six-line MISSION DIRECTIVES checklist is not in the live document at all');
    chk(await page.evaluate(() => {
          return document.querySelectorAll('#journeyStep').length === 1;
        }), 'and there is exactly one objective element in the document');

    // --- PHASE 26: XP is not on the screen, in a real browser ----------------------
    chk(first.xpBar === false && first.levelLabel === false,
        'THE XP BAR AND THE LEVEL LABEL ARE NOT IN THE LIVE DOCUMENT AT ALL');
    chk(await page.evaluate(() => {
          const hud = document.getElementById('hud');
          return !/\bLv\.|\bXP\b|LEVEL UP/.test(hud ? hud.innerText : '');
        }), 'and nothing rendered in the HUD reads Lv., XP or LEVEL UP');
    chk(first.milestones.length === 0 && first.attackBonus === 0 && first.miningSpeedBonus === 0,
        'a new game starts with no milestone reached and no earned bonuses');
    chk(await page.evaluate(() => {
          const g = window.game, p = g.player;
          const before = p.maxHp;
          g._reachMilestone('firstNight');
          const once = p.maxHp;
          for (let i = 0; i < 50; i++) g._reachMilestone('firstNight');
          return before === 100 && once === 120 && p.maxHp === 120 &&
                 g.milestones.size === 1 && p.hp <= p.maxHp;
        }), 'reaching a milestone in the live game grants once and only once (100 -> 120 max health)');
    chk(await page.evaluate(() => {
          const t = document.getElementById('hudToast');
          return !!t && t.classList.contains('show') && !/\d/.test(t.textContent);
        }), 'and the player is told, on the one transient HUD line, with no number in it');
    chk(await page.evaluate(() => {
          const g = window.game;
          g.milestones.delete('firstNight'); g.player.maxHp = 100; g.player.hp = 100;
          const t = document.getElementById('hudToast');
          if (t) t.classList.remove('show');
          return g.milestones.size === 0 && g.player.maxHp === 100;
        }), 'and the probe undoes itself, so the rest of this file tests an untouched player');

    /* =================================================================================
       PHASE 27 — THE HUD, IN A REAL BROWSER.

       Everything here is read from the LAID-OUT document: computed styles and rects, not
       the presence of a node. That is the part the offline suite cannot do — a HUD
       element can exist, carry the right class and still be zero pixels tall, behind
       something, or off the edge of the screen.
       ================================================================================= */
    chk(first.hudTicks === 10 && first.hudLit === 10,
        `the condition readout is on screen: ${first.hudTicks} ticks, all lit, at a fresh 100 health`);
    chk(await page.evaluate(() => {
          const t = document.getElementById('conditionTicks');
          const r = t.getBoundingClientRect();
          const one = t.children[0].getBoundingClientRect();
          return r.width > 50 && r.height > 6 && one.width > 1 && one.height > 6 &&
                 r.left >= 0 && r.bottom <= innerHeight + 1;
        }), 'and it is really laid out inside the viewport — not a zero-height row of nothing');
    chk(await page.evaluate(() => {
          const c = document.getElementById('perceptionTrace');
          const r = c.getBoundingClientRect();
          const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let ink = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 8) ink++;
          return r.width > 80 && r.height > 8 && ink > 100;
        }), 'the perception trace is laid out AND has actually been drawn into — real pixels, not an empty canvas');
    chk(await page.evaluate(() => {
          const v = document.getElementById('vitals');
          const c = document.getElementById('conditionTicks').getBoundingClientRect();
          const p = document.getElementById('perceptionTrace').getBoundingClientRect();
          const hb = document.getElementById('hotbar').getBoundingClientRect();
          const ob = document.getElementById('objectivePanel').getBoundingClientRect();
          const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          return getComputedStyle(v).position === 'fixed' &&
                 !overlaps(c, hb) && !overlaps(p, hb) && !overlaps(c, ob) && !overlaps(p, ob) &&
                 Math.abs(c.left - p.left) < 2;
        }), 'the two readings are aligned with each other and clear of the hotbar and the objective');
    chk(await page.evaluate(() => {
          // The heart, the brain and both vital bars are not in the live document.
          return !document.getElementById('healthBarInner') && !document.getElementById('sanityBarInner') &&
                 !document.getElementById('healthIcon') && !document.getElementById('sanityBrain') &&
                 !/[❤♥]|🧠/.test(document.getElementById('hud').innerText);
        }), 'NO HEART, NO BRAIN AND NO VITAL BAR IS ON THE SCREEN');
    chk(await page.evaluate(() => {
          const g = window.game, p = g.player;
          p.hp = 8; g.ui.updateVitals(p);
          const v = document.getElementById('vitals');
          const crit = v.classList.contains('hp-critical');
          const lit = Array.from(document.getElementById('conditionTicks').children)
                        .filter(c => c.classList.contains('lit')).length;
          p.hp = p.maxHp; g.ui.updateVitals(p);
          // 8/100 is no whole tick and four fifths of the first: exactly one tick lit.
          return crit && lit === 1;
        }), 'damage down to 8 health puts the live readout into its critical state, on one part-lit tick');
    chk(await page.evaluate(() => {
          const g = window.game;
          g.ui.setSanity(12);
          const lost = document.getElementById('vitals').classList.contains('p-lost');
          const c = document.getElementById('perceptionTrace');
          const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let rows = new Set();
          for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++)
            if (px[(y * c.width + x) * 4 + 3] > 8) { rows.add(y); break; }
          g.ui.setSanity(g.sanity.value);
          return lost && rows.size > 4;   // a calm trace occupies one or two rows
        }), 'and a low perception value visibly breaks the trace up across the canvas');
    chk(await page.evaluate(() => {
          const hb = document.getElementById('hotbar');
          const cells = Array.from(hb.children);
          const cs = getComputedStyle(cells[1]);
          const r0 = cells[0].getBoundingClientRect(), r1 = cells[1].getBoundingClientRect();
          // A continuous strip: cell 1 starts where cell 0 ends, and no cell is boxed.
          return Math.abs(r1.left - r0.right) < 1.5 &&
                 cs.borderTopWidth === '0px' && cs.borderRightWidth === '0px';
        }), 'the hotbar renders as one continuous strip, not nine separated boxes');
    chk(await page.evaluate(() => {
          const g = window.game;
          g.player.selectedSlot = 2; g.ui.updateHotbarSelection();
          const cells = Array.from(document.getElementById('hotbar').children);
          const on = cells.filter(c => c.classList.contains('active'));
          /* getComputedStyle returns a LIVE declaration — read the value out before
             putting the selection back, or this measures the unselected cell. */
          const rule = getComputedStyle(cells[2], '::after').height;
          const bg = getComputedStyle(cells[2], '::after').backgroundColor;
          g.player.selectedSlot = 0; g.ui.updateHotbarSelection();
          return on.length === 1 && on[0] === cells[2] && rule === '2px' && bg === 'rgb(200, 162, 74)';
        }), 'and the selected cell is marked exactly once, by a 2px rule underneath it');
    /* THE PROMPT IS DRIVEN THE WAY THE GAME DRIVES IT, not by calling the setter: an
       Ancient Chest is put under the player's crosshair and the FRAME LOOP is left to
       notice it. Calling ui.setInteractPrompt directly would prove nothing here — the
       loop clears the prompt on every frame the crosshair is on nothing, and would have
       erased it again before the fade finished. The prompt also fades over 140ms, so the
       transition is given time rather than being read mid-flight.

       Headless Chromium may not grant pointer lock, and the look-target path is gated on
       it, so `locked` is set explicitly for the length of this check and put back.

       THE 140ms FADE IS SUPPRESSED FOR THE MEASUREMENT. Under SwiftShader the animated
       opacity value read back on the main thread lagged the class by seconds, at random,
       which made "did it become visible" unanswerable from a poll. With the transition
       off, the computed opacity IS the rule's value the moment the class lands, so this
       measures whether the prompt becomes visible rather than how fast it got there.
       That the fade exists at all is asserted in the offline stylesheet audit. */
    const chestPlaced = await page.evaluate(() => {
      const g = window.game, p = g.player;
      document.getElementById('interactPrompt').style.transition = 'none';
      p.locked = true;
      /* Ask the game where the crosshair actually is rather than guessing a block: the
         answer depends on the player's yaw, pitch and reach, and guessing put the chest
         somewhere the ray never went. */
      let hit = p._getLookTarget();
      if (!hit) for (const pitch of [-0.3, -0.6, -0.9, 0.3]) { p.pitch = pitch; hit = p._getLookTarget(); if (hit) break; }
      if (!hit) return false;
      const was = g.world.getBlockWorld(hit.bx, hit.by, hit.bz);
      g.world.setBlockWorld(hit.bx, hit.by, hit.bz, BLOCK.TREASURE_CHEST);
      window.__chestProbe = { bx: hit.bx, by: hit.by, bz: hit.bz, was };
      return g.world.getBlockWorld(hit.bx, hit.by, hit.bz) === BLOCK.TREASURE_CHEST;
    });
    chk(chestPlaced, 'an Ancient Chest is put under the crosshair to drive the prompt through the real look-target path');
    /* WAITED FOR, NOT SAMPLED. The look-target ray is re-cast every frame from a live
       eye position, so a single sample 350ms later can land on a frame where the ray
       happens to be off the chest — which says nothing about whether the prompt works.
       This waits for the prompt to be RAISED, which is the actual claim, and still fails
       (after six seconds) if the loop never raises it at all.

       PHASE 28 NARROWED WHAT IT WAITS FOR, and had to. This used to wait for the prompt
       to be shown AT ALL, which was a sound proxy while the prompt was raised by
       affordances only: on a frame where the ray was off the chest, nothing was shown and
       the poll simply waited for the next one. Phase 28 added the onboarding cues, and on
       a brand new game the `break` cue is owed and reads `LMB · BREAK` over ordinary
       ground — so "something is shown" can now be satisfied by a frame the ray missed the
       chest on, and this check failed reading "LMB BREAK" while the chest prompt was
       working perfectly. It now waits for the CHEST's prompt, which is what it was always
       claiming, and a loop that never raises it still fails after six seconds. */
    const promptShown = await page.waitForFunction(() => {
      const p = document.getElementById('interactPrompt');
      if (!p.classList.contains('show') || getComputedStyle(p).opacity !== '1') return null;
      const text = p.innerText.replace(/\s+/g, ' ').trim();
      if (!/RMB/.test(text) || !/OPEN/.test(text)) return null;
      const r = p.getBoundingClientRect();
      const hb = document.getElementById('hotbar').getBoundingClientRect();
      return { w: r.width, h: r.height, clear: r.bottom <= hb.top + 1, text: text };
    }, null, { timeout: 6000, polling: 100 }).then(h => h.jsonValue()).catch(() => null);
    chk(!!promptShown && promptShown.w > 20 && promptShown.h > 6 && promptShown.clear,
        promptShown
          ? `the frame loop raised the prompt above the hotbar, reading "${promptShown.text}"`
          : 'the frame loop raised the CHEST prompt above the hotbar — IT NEVER DID');
    await page.evaluate(() => {
      const g = window.game, c = window.__chestProbe;
      g.world.setBlockWorld(c.bx, c.by, c.bz, c.was);
      g.player.locked = false;
    });
    const promptGone = await page.waitForFunction(() => {
      const e = document.getElementById('interactPrompt');
      return !e.classList.contains('show') && getComputedStyle(e).opacity === '0';
    }, null, { timeout: 6000, polling: 100 }).then(() => true).catch(() => false);
    await page.evaluate(() => { document.getElementById('interactPrompt').style.transition = ''; });
    chk(promptGone, 'and it goes away again once there is nothing under the crosshair to act on');
    chk(await page.evaluate(() => {
          // Nothing in the gameplay HUD may paint over the pause panel.
          const ids = ['hud','hotbar','vitals','objectivePanel','compassWrap','clockWrap','interactPrompt','heldName'];
          const hudMax = Math.max(...ids.map(i => {
            const e = document.getElementById(i); if (!e) return 0;
            const z = getComputedStyle(e).zIndex; return z === 'auto' ? 0 : Number(z);
          }));
          return hudMax < Number(getComputedStyle(document.getElementById('settingsOverlay')).zIndex);
        }), 'and every gameplay HUD layer computes below the settings panel');
    chk(await page.evaluate(() => {
          document.getElementById('settingsOverlay').classList.add('active');
          const panel = document.querySelector('.settings-panel').getBoundingClientRect();
          const hit = document.elementFromPoint(panel.left + panel.width / 2, panel.top + 20);
          const covered = !panel.width || !hit || !hit.closest('#settingsOverlay');
          document.getElementById('settingsOverlay').classList.remove('active');
          return !covered;
        }), 'proved by hit test: with the panel open, the point at the top of the panel belongs to the panel');
    chk(await page.evaluate(() => {
          // Narrow window: the HUD must not collide with itself.
          const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          const r = (id) => document.getElementById(id).getBoundingClientRect();
          const boxes = ['objectivePanel','vitals','hotbar','clockWrap'].map(r);
          for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
            if (overlaps(boxes[i], boxes[j])) return false;
          return boxes.every(b => b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1);
        }), 'no two HUD clusters overlap, and all of them are inside the viewport');

    // Crafting: no level gate in the live menu.
    chk(await page.evaluate(() => {
          const g = window.game;
          g.ui.openCrafting ? g.ui.openCrafting() : g.ui.renderCraftingMenu();
          const txt = document.getElementById('recipeList').innerText;
          const gated = /Requires Level|Unlocked at Lv/.test(txt);
          if (g.ui.craftingOpen) { g.ui.craftingOpen = false; g.ui.craftingOverlay.classList.remove('active'); }
          return !gated;
        }), 'and the live crafting menu shows no level requirement on any recipe');

    // ---------------------------------------------------------------------------------
    // BUILD A STATE WORTH SAVING — through the game's own methods, not by assignment.
    // ---------------------------------------------------------------------------------
    const built = await page.evaluate(() => {
      const g = window.game, p = g.player, w = g.world;
      // Move somewhere specific and legible.
      const bx = Math.floor(p.position.x) + 6, bz = Math.floor(p.position.z) + 6;
      const by = w.findSpawnHeight(bx, bz);
      p.position.set(bx + 0.5, by, bz + 0.5);
      p.yaw = 1.75; p.pitch = -0.4;

      // Real edits, through the real block API.
      const dug = [];
      for (let d = 1; d <= 10; d++) { w.destroyBlock(bx + 2, by - d, bz, null, true); dug.push([bx + 2, by - d, bz]); }
      for (let d = 0; d < 4; d++) w.setBlockWorld(bx - 2, by + d, bz, BLOCK.STONE);

      // Inventory, health, sanity, progression — all through what the game already has.
      p.inventory.addItem(ITEM.TORCH, 17);
      p.inventory.addItem(ITEM.WOOD_PLANK, 9);
      p.selectedSlot = 3;
      p.hp = 41;
      g.sanity.value = 55.5;
      g.dayCount = 4;
      g.stage = 2;
      g.memoryFragments = 1;
      g.env.t = 300;
      g.grantCompass();
      w.openedChests.add(bx + ',' + by + ',' + bz);
      p.chestsOpened = 3;

      // A placed Anchor Monument, exactly as placing the block does it: setBlockWorld is
      // the path that registers the monument and pins its chunk.
      w.setBlockWorld(bx + 4, by, bz + 4, BLOCK.SAFEHOUSE_ANCHOR);
      /* PHASE 25 — resolve once the state is FINAL, so the snapshot below is the objective
         the player would actually be looking at when they press Save. */
      g._refreshObjective();
      return { bx, by, bz, dug: dug.length, stone: BLOCK.STONE, hpSet: p.hp, maxHpSet: p.maxHp };
    });

    /* PHASE 26 — THE ANCHOR IS NOW PROGRESSION, IN THE LIVE GAME. The monument was placed
       through setBlockWorld above; the milestone latches on the next frame that sees it
       standing. Waited for explicitly rather than assumed, because everything after this
       (the save, the reload, the restore) has to carry the health it granted. */
    /* 5s was not enough on a cold SwiftShader boot: the Anchor latches on the first frame
       that SEES it standing, and the first frames after a fresh boot are slow enough that
       this raced about half the time. Fifteen seconds is still a failure if the latch is
       genuinely broken, and stops being a coin toss if it is not. */
    await page.waitForFunction("window.game.milestones.has('shelter')", null, { timeout: 15000 });
    const milestoned = await page.evaluate(() => ({ maxHp: window.game.player.maxHp, hp: window.game.player.hp }));
    chk(milestoned.maxHp === built.maxHpSet + 20 && milestoned.hp === built.hpSet + 20,
        `placing the first Anchor granted endurance in the running game ` +
        `(${built.hpSet}/${built.maxHpSet} -> ${milestoned.hp}/${milestoned.maxHp}) — no XP, no threshold, no bar`);

    const before = await page.evaluate(SNAPSHOT);
    chk(before.editCount >= 14, `the session made ${before.editCount} real world edits across ${before.editedChunks} chunks`);
    chk(before.compass === true && before.compassShown === true, 'the compass was earned and is on screen');
    chk(before.objectiveText && before.objectiveText !== 'Gather wood.',
        `the objective advanced as the player actually progressed: "${before.objectiveText}"`);
    chk(before.objectiveMarks.overworld > 0,
        `and the chain mark moved with it (${before.objectiveMarks.overworld})`);

    // ---------------------------------------------------------------------------------
    // SAVE — by clicking the button, in the panel, like a player.
    // ---------------------------------------------------------------------------------
    await page.keyboard.press('o');
    await page.waitForFunction('window.game.ui.settingsOpen === true', null, { timeout: 5000 });
    chk(await page.isVisible('#setSave'), 'the pause panel offers SAVE');
    chk(await page.isVisible('#setLoad'), 'LOAD');
    chk(await page.isVisible('#setNewGame'), 'and NEW GAME');
    await clickPanel(page, '#setSave');
    await page.waitForTimeout(200);
    const status = (await page.textContent('#setSaveStatus')) || '';
    chk(/^Saved\./.test(status), `the panel confirms the save: "${status}"`);
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('whereitisnt.save.v1');
      return { bytes: raw ? raw.length : 0, keys: Object.keys(localStorage).sort(),
               payload: raw ? JSON.parse(raw) : null };
    });
    chk(stored.bytes > 0, `the save is in localStorage (${stored.bytes} bytes)`);
    note('localStorage keys: ' + stored.keys.join(', '));
    await page.keyboard.press('Escape');

    // ---------------------------------------------------------------------------------
    // RELOAD — a genuinely fresh runtime — AND CONTINUE.
    // ---------------------------------------------------------------------------------
    await page.reload({ waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction('!!window.game', null, { timeout: 90000 });
    const atStart = await page.evaluate(SNAPSHOT);
    chk(atStart.continueVisible === true, 'after a reload the start screen offers CONTINUE');
    const label = await page.textContent('#continuePlay');
    chk(/CONTINUE/.test(label) && /DAY 4/i.test(label), `and names the run: "${label}"`);

    await boot(page, { fresh: false });
    const after = await page.evaluate(SNAPSHOT);

    chk(after.running === true, 'CONTINUE enters the frame loop');
    chk(after.dimension === before.dimension, 'the dimension is restored');
    /* Position and orientation are compared against what the SAVE FILE holds, not against
       the snapshot taken before the panel was opened: the page is a live game, and a
       headless Chromium may or may not grant pointer lock, so the head can turn between
       the two. The property under test is that the saved figures are the restored ones. */
    const sp = stored.payload.player;
    chk(Math.abs(after.pos.x - sp.position.x) < 1e-6 && Math.abs(after.pos.z - sp.position.z) < 1e-6,
        `the player is standing exactly where the save put them (${after.pos.x.toFixed(2)}, ${after.pos.z.toFixed(2)})`);
    chk(Math.abs(after.pos.y - sp.position.y) < 1.2,
        `at the saved height (${sp.position.y.toFixed(2)} -> ${after.pos.y.toFixed(2)})`);
    const orient = await page.evaluate(() => window.__orientationAtLoad || null);
    chk(!!orient && Math.abs(orient[0] - sp.yaw) < 1e-9 && Math.abs(orient[1] - sp.pitch) < 1e-9,
        `facing the saved way the instant the load finishes (yaw ${sp.yaw}, pitch ${sp.pitch})`);
    chk(after.hp === sp.hp && after.maxHp === sp.maxHp && after.dead === false,
        `health is restored exactly (${after.hp}/${after.maxHp}) and the player is alive`);
    /* PHASE 26 — and the milestone comes back REACHED, not re-granted. The anchor is
       standing again after the restore, which is exactly the condition that granted it
       the first time; if the latch had not survived the round trip the player would be
       paid twice for one monument. */
    chk(after.milestones.join(',') === 'shelter' && after.maxHp === milestoned.maxHp,
        `the milestone survived the reload as reached, and granted nothing a second time ` +
        `(${after.maxHp} max health, unchanged)`);
    chk(after.attackBonus === 0 && after.miningSpeedBonus === 0,
        'and no stat bonus appeared from anywhere — nothing in this run could grant one');
    /* Sanity is compared against the value the SAVE FILE actually carries rather than
       against the snapshot taken a second earlier: the player is standing inside their
       own Anchor Monument's safe zone, which regenerates 10/sec, so the live value moves
       between snapshot and save and again between load and assertion. What is being
       tested is that the number written is the number restored. */
    chk(Math.abs(after.sanity - stored.payload.sanity) < 8,
        `sanity is restored from the value actually written (${stored.payload.sanity.toFixed(1)} -> ${after.sanity.toFixed(1)}; the rest is live Anchor regen)`);
    chk(JSON.stringify(after.inventory) === JSON.stringify(before.inventory),
        'the inventory is identical — every stack, every count, in its own slot');
    chk(after.selectedSlot === before.selectedSlot, 'the selected hotbar slot is restored');
    /* PHASE 27 — and the HUD is SHOWING the restored state, not merely holding it. */
    /* A part-filled tick still counts as lit, so the expected number is the ceiling —
       and the body is regenerating inside the Anchor zone while this runs, so one tick
       of tolerance is allowed between the value read and the value last painted. */
    chk(after.hudTicks === Math.round(after.maxHp / 10) &&
        Math.abs(after.hudLit - Math.ceil(after.hp / 10)) <= 1,
        `THE CONDITION READOUT MATCHES THE RESTORED BODY: ${after.hp}/${after.maxHp} draws ` +
        `${after.hudLit} of ${after.hudTicks} ticks lit`);
    chk(after.hudSlot === after.selectedSlot,
        `and the hotbar is marking the restored slot (${after.hudSlot})`);
    chk(/p-(calm|drifting|breaking|lost)/.test(after.hudVitalState) &&
        /hp-(steady|worn|failing|critical|gone)/.test(after.hudVitalState),
        `and both readings came back in a real state after the reload (${after.hudVitalState})`);
    chk(await page.evaluate(() => {
          const one = (s) => document.querySelectorAll(s).length === 1;
          return ['#hud','#vitals','#conditionTicks','#perceptionTrace','#objectivePanel',
                  '#hotbar','#interactPrompt','#hudToast'].every(one) &&
                 document.getElementById('conditionTicks').children.length === Math.round(window.game.player.maxHp / 10);
        }), 'and a load left exactly one of every HUD element — no duplicate ticks, no second panel');
    chk(after.stage === before.stage && after.dayCount === before.dayCount &&
        after.memoryFragments === before.memoryFragments, 'stage, day count and memory fragments are restored');
    chk(Math.abs(after.cycleSeconds - before.cycleSeconds) < 30,
        `the day/night clock resumes where it stopped (${before.cycleSeconds.toFixed(0)}s -> ${after.cycleSeconds.toFixed(0)}s)`);
    chk(after.compass === true && after.compassShown === true,
        'THE COMPASS SURVIVES THE RELOAD, and is back on screen');
    chk(after.objectiveText === before.objectiveText,
        `THE OBJECTIVE SURVIVES THE RELOAD: "${after.objectiveText}"`);
    chk(after.objectiveMarks.overworld >= before.objectiveMarks.overworld,
        `and the chain mark did not regress (${before.objectiveMarks.overworld} -> ${after.objectiveMarks.overworld})`);
    chk(stored.payload.objectives && typeof stored.payload.objectives.overworld === 'number',
        'the save file carries the objective marks');
    /* PHASE 28 took the schema to 4 (progression.onboarding). The objective marks this
       block is about were added at 2 and have not moved since. */
    chk(stored.payload.version === 4, `and it is written at schema version ${stored.payload.version}`);
    chk(Array.isArray(stored.payload.progression.onboarding),
        'alongside the Phase 28 onboarding set, which is what stops a load re-teaching the keys');
    chk(await page.evaluate(() => typeof ITEM.COMPASS === 'undefined'),
        'and it is still not an inventory item at all — it cannot be dropped or lost');
    chk(after.chestsOpened === before.chestsOpened, 'the chest tally is restored');
    chk(JSON.stringify(after.openedChests.sort()) === JSON.stringify(before.openedChests.sort()),
        'the opened chest is still opened');
    chk(after.editCount === before.editCount && after.editedChunks === before.editedChunks,
        `every world edit came back (${after.editCount} edits, ${after.editedChunks} chunks)`);
    chk(!!after.anchor && Math.abs(after.anchor.x - before.anchor.x) < 1e-6,
        'the Anchor Monument is standing again where it was placed');
    chk(Math.abs(after.anchor.fuel - before.anchor.fuel) < 5,
        `with its remaining fuel (${before.anchor.fuel.toFixed(0)}s -> ${after.anchor.fuel.toFixed(0)}s)`);

    // The world itself, block by block, in the browser.
    const blocks = await page.evaluate((b) => {
      const w = window.game.world;
      let dug = 0, built = 0;
      for (let d = 1; d <= 10; d++) if (w.getBlockWorld(b.bx + 2, b.by - d, b.bz) === 0) dug++;
      for (let d = 0; d < 4; d++) if (w.getBlockWorld(b.bx - 2, b.by + d, b.bz) === b.stone) built++;
      return { dug, built };
    }, built);
    chk(blocks.dug === 10, `the ten-block shaft the player dug is still dug (${blocks.dug}/10 air)`);
    chk(blocks.built === 4, `and the pillar they built is still standing (${blocks.built}/4 stone)`);

    // ---------------------------------------------------------------------------------
    // LOADING TWICE IN A ROW MUST NOT DUPLICATE ANYTHING
    // ---------------------------------------------------------------------------------
    const l1 = await page.evaluate(() => { window.game.loadGame(); return null; }) === null
      ? await page.evaluate(SNAPSHOT) : null;
    await page.waitForTimeout(200);
    await page.evaluate(() => window.game.loadGame());
    await page.waitForTimeout(200);
    await page.evaluate(() => window.game.loadGame());
    await page.waitForTimeout(400);
    const l3 = await page.evaluate(SNAPSHOT);
    chk(l3.editCount === after.editCount && l3.openedChests.length === after.openedChests.length,
        'three loads in a row leave exactly one set of world state');
    chk(Math.abs(l3.sceneChildren - l1.sceneChildren) <= 2,
        `and the scene graph does not grow (${l1.sceneChildren} -> ${l3.sceneChildren} objects)`);
    chk(l3.mobs === 0 && l3.items === 0, 'with no orphaned mobs or dropped items left behind');
    chk(l3.inventory.filter(Boolean).length === after.inventory.filter(Boolean).length,
        'and no duplicated inventory');

    // ---------------------------------------------------------------------------------
    // NEW GAME — a clean state, from the same path.
    // ---------------------------------------------------------------------------------
    await page.keyboard.press('o');
    await page.waitForFunction('window.game.ui.settingsOpen === true', null, { timeout: 5000 });
    await clickPanel(page, '#setNewGame');
    chk((await page.textContent('#setNewGame')).indexOf('CONFIRM') >= 0,
        'NEW GAME asks for confirmation on the first click');
    await clickPanel(page, '#setNewGame');
    await page.waitForTimeout(500);
    const fresh = await page.evaluate(SNAPSHOT);
    chk(fresh.inventory.every(s => s === null), 'a new game inherits no inventory');
    chk(fresh.hp === 100 && fresh.maxHp === 100, 'no health or capability carry-over');
    chk(fresh.stage === 1 && fresh.dayCount === 1 && fresh.memoryFragments === 0,
        'no progression carry-over');
    chk(fresh.compass === false && fresh.compassShown === false, 'the compass is gone from the HUD');
    chk(fresh.openedChests.length === 0, 'no opened-chest ledger');
    chk(fresh.anchor === null, 'no anchor');
    chk(fresh.dimension === 'overworld', 'and it starts in the Overworld');
    chk(fresh.objectiveText === 'Gather wood.',
        'a new game is back on the first objective, with no memory of the last run');
    chk(fresh.objectiveMarks.overworld === 0 && fresh.objectiveMarks.suburbia === 0,
        'and every chain mark was reset');
    chk(fresh.editCount <= 1, `with a clean world (${fresh.editCount} edit — the starter torch)`);
    chk(fresh.hasSave === true, 'the stored save is NOT destroyed by starting a new game');
    const blocksAfterNew = await page.evaluate((b) => {
      const w = window.game.world;
      let dug = 0;
      for (let d = 1; d <= 10; d++) if (w.getBlockWorld(b.bx + 2, b.by - d, b.bz) === 0) dug++;
      return dug;
    }, built);
    chk(blocksAfterNew < 10, `and the previous run's excavation is gone from the world (${blocksAfterNew}/10)`);

    // The save is still loadable after all that.
    await page.evaluate(() => window.game.loadGame());
    await page.waitForTimeout(400);
    const reloaded = await page.evaluate(SNAPSHOT);
    chk(reloaded.dayCount === 4 && reloaded.compass === true && reloaded.editCount === after.editCount,
        'and the saved run can still be loaded back afterwards');

    // ---------------------------------------------------------------------------------
    // PHASE 25 — CROSSING A DIMENSION MUST REPLACE THE OBJECTIVE, NOT LEAVE A STALE ONE
    // ---------------------------------------------------------------------------------
    const crossed = await page.evaluate(async () => {
      const g = window.game;
      const before = g.objectives.currentText;
      g._transitionToLevel2();                    // the real Farmlands transition
      await new Promise(r => setTimeout(r, 600));
      const n = document.getElementById('journeyStep');
      return { before, after: g.objectives.currentText,
               shown: n && n.className.indexOf('show') >= 0 ? n.textContent : null,
               farmlands: g.player.inFarmlands };
    });
    chk(crossed.farmlands === true, 'the player crosses into the Farmlands');
    chk(crossed.after !== crossed.before,
        `and the objective changes with the dimension ("${crossed.before}" -> "${crossed.after}")`);
    chk(crossed.after === 'Explore the Shattered Farmlands.',
        'to the first line of the Farmland journey, not a leftover Overworld step');
    chk(crossed.shown === crossed.after, 'and the screen agrees with the system');

    // ---------------------------------------------------------------------------------
    // A CORRUPT SAVE MUST NOT STOP THE GAME STARTING
    // ---------------------------------------------------------------------------------
    await page.evaluate(() => {
      localStorage.setItem('whereitisnt.save.v1', '{"version":1,"dimension":"overworld","play');
      localStorage.setItem('whereitisnt.save.v1.backup', 'not json');
    });
    const errsBefore = errors.length;
    await page.reload({ waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction('!!window.game', null, { timeout: 90000 });
    const corrupt = await page.evaluate(SNAPSHOT);
    chk(corrupt.continueVisible === false, 'a corrupt save hides CONTINUE rather than offering a broken run');
    chk(errors.length === errsBefore, 'and throws nothing on the way to the start screen');
    await boot(page, { fresh: true });
    const afterCorrupt = await page.evaluate(SNAPSHOT);
    chk(afterCorrupt.running === true, 'the game still starts normally from a corrupt slot');
    const msg = await page.evaluate(() => { const r = window.game.loadGame(); return r.error || ''; });
    chk(/not readable|No save/i.test(msg), `and asking to load it says why: "${msg}"`);

    // ---------------------------------------------------------------------------------
    // NO PER-FRAME WRITES
    // ---------------------------------------------------------------------------------
    const writes = await page.evaluate(async () => {
      const real = Storage.prototype.setItem;
      let n = 0;
      Storage.prototype.setItem = function (k, v) { if (String(k).indexOf('save') >= 0) n++; return real.call(this, k, v); };
      await new Promise(r => setTimeout(r, 3000));
      Storage.prototype.setItem = real;
      return n;
    });
    chk(writes === 0, `three seconds of live gameplay perform ${writes} save writes`);

    // ---------------------------------------------------------------------------------
    // COST. Not a gate — a measurement, so the report can say a real number.
    // ---------------------------------------------------------------------------------
    await page.evaluate(() => window.game.loadGame());
    await page.waitForTimeout(300);
    const timing = await page.evaluate(() => {
      const g = window.game;
      const t0 = performance.now(); const st = g.captureSaveState(); const t1 = performance.now();
      const bytes = JSON.stringify(st).length;
      const t2 = performance.now(); g.saves.write(st); const t3 = performance.now();
      const t4 = performance.now(); g.loadGame(); const t5 = performance.now();
      return { capture: t1 - t0, write: t3 - t2, load: t5 - t4, bytes,
               edits: (() => { let n = 0; for (const m of g.world.editedChunks.values()) n += m.size; return n; })() };
    });
    note(`capture ${timing.capture.toFixed(1)} ms, validate+write ${timing.write.toFixed(1)} ms, ` +
         `full load (teardown + region rebuild + eager load + restore) ${timing.load.toFixed(0)} ms, ` +
         `${timing.bytes} bytes for ${timing.edits} edits`);
    chk(timing.capture + timing.write < 250,
        `saving costs ${(timing.capture + timing.write).toFixed(1)} ms in total — not a freeze`);

    chk(errors.length === 0, 'no uncaught page errors across the whole run' +
        (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('\n' + (fail === 0 ? 'ALL BROWSER SAVE / LOAD CHECKS PASS' : fail + ' FAILURES'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('BROWSER RUN FAILED: ' + (e && e.stack || e)); process.exit(1); });
