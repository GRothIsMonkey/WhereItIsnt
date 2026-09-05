/* PHASE 28 — ORGANIC ONBOARDING IN A REAL BROWSER.

   This one IS a browser. It launches Chromium through Playwright, serves game.html over
   HTTP, boots the real game with a real WebGL context and then drives the real DOM. What
   it asserts is what the player would see: that clicking BEGIN EXPEDITION leads to the
   world and not to a card; that no tutorial element is in the live document at all — not
   hidden, not empty, not present; that the first objective is on screen before the first
   frame; that a contextual cue really does appear over a real tree in a real generated
   chunk, and really does go away when the player looks at nothing; and that a page RELOAD
   followed by CONTINUE does not bring any of it back.

   REQUIREMENTS. Playwright and a Chromium build. Both are present in the development
   container; on a machine without them this file skips with a clear message rather than
   failing, and onboarding.js still covers everything that can be covered offline.

   three.js is loaded from a CDN by game.html. If tests/vendor/three.min.js exists it is
   served in place of the CDN request so the run is hermetic and offline. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_ONBOARDING_PORT || 8213);

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
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

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

/* Every id the deleted tutorial used, asked of the LIVE document. A hidden survivor is
   the failure mode this phase is most likely to leave behind, so this is the check that
   matters most in this file. */
const TUTORIAL_IDS = ['tutorialScreen', 'tutorialSkip', 'tutorialEyebrow', 'tutorialIcon',
                      'tutorialTitle', 'tutorialLines', 'tutorialDots', 'tutorialBack',
                      'tutorialNext', 'skipTutorialLink'];

const NO_TUTORIAL = `(() => {
  const ids = ${JSON.stringify(TUTORIAL_IDS)};
  const present = ids.filter(id => !!document.getElementById(id));
  /* Not just the known ids: anything anywhere in the document whose id or class says
     tutorial, however it got there. */
  const anyEl = Array.from(document.querySelectorAll('*')).filter(el =>
    /tutorial/i.test(el.id || '') || /tutorial/i.test(typeof el.className === 'string' ? el.className : ''));
  /* And anything currently PAINTING a full-screen opaque layer over the game. */
  const covering = Array.from(document.body.children).filter(el => {
    if (el.id === 'gameCanvas' || el.id === 'hud') return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width >= window.innerWidth * 0.8 && r.height >= window.innerHeight * 0.8;
  }).map(el => el.id || el.tagName);
  return { present: present, anyEl: anyEl.map(e => e.id || e.tagName), covering: covering };
})()`;

const VIEW = `(() => {
  const g = window.game, p = g.player;
  const promptEl = document.getElementById('interactPrompt');
  const shown = promptEl && promptEl.classList.contains('show');
  const objEl = document.getElementById('journeyStep');
  return {
    running: g.running,
    objective: objEl && objEl.className.indexOf('show') >= 0 ? objEl.textContent : null,
    objectiveId: g.objectives ? g.objectives.currentId : null,
    prompt: shown ? (document.getElementById('interactKey').textContent + ' · ' +
                     document.getElementById('interactVerb').textContent) : null,
    promptVisible: !!shown && promptEl.getBoundingClientRect().width > 10,
    onboarding: Array.from(g.onboarding).sort(),
    craftingOpen: g.ui.craftingOpen,
    locked: p.locked, dead: p.dead, menuOpen: g.ui.menuOpen,
    hp: p.hp, maxHp: p.maxHp,
    hudTicks: (() => { const t = document.getElementById('conditionTicks'); return t ? t.children.length : -1; })(),
    hasTrace: !!document.getElementById('perceptionTrace'),
  };
})()`;

/* Put a block of a chosen kind directly in front of the player's eyes, aim at it, run the
   REAL look-target update, and read the prompt back — all inside ONE page call. It has to
   be one call: the frame loop is live and re-resolves the target sixty times a second, so
   a prompt read a few milliseconds later would be describing wherever the player drifted
   to rather than the block this function placed. Nothing is faked but the mouse — the
   raycast, the world lookup, the cue resolution and the DOM write are shipped code.

   `kind` of null clears the corridor instead, so the crosshair genuinely finds nothing.
   `dist` moves the block further down the corridor: placement goes on the face the ray
   entered, so a target two blocks away would put the new block inside the player's own
   bounding box and the world would (correctly) refuse it. */
function aim(page, kind, dist) {
  return page.evaluate(({ k, d0 }) => {
    const g = window.game, p = g.player;
    p.locked = true; p.dead = false;
    p.yaw = 0; p.pitch = 0;                       // facing -Z
    const bx = Math.floor(p.position.x);
    const bz = Math.floor(p.position.z) - d0;
    const by = Math.floor(p.position.y + p.eyeHeight);
    for (let d = 1; d <= 8; d++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          g.world.setBlockWorld(bx + dx, by + dy, Math.floor(p.position.z) - d, 0);
    if (k !== null) g.world.setBlockWorld(bx, by, bz, k);
    p._updateTargetHighlight();
    const hit = p._getLookTarget();
    const el = document.getElementById('interactPrompt');
    const shown = el.classList.contains('show');
    return {
      placed: g.world.getBlockWorld(bx, by, bz),
      target: hit ? g.world.getBlockWorld(hit.bx, hit.by, hit.bz) : null,
      prompt: shown ? (document.getElementById('interactKey').textContent + ' · ' +
                       document.getElementById('interactVerb').textContent) : null,
      visible: shown && el.getBoundingClientRect().width > 10,
      onboarding: Array.from(g.onboarding).sort(),
    };
  }, { k: kind, d0: dist || 2 });
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
    if (/pointer ?lock/i.test(t)) return;   // headless pages are not granted it
    errors.push('console: ' + t);
  });
  if (hermetic) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction('!!window.game', null, { timeout: 90000 });

    // =================================================================================
    head('1. THE START SCREEN');
    // =================================================================================
    {
      const before = await page.evaluate(NO_TUTORIAL);
      chk(before.present.length === 0,
          'not one of the ten tutorial elements exists in the live document before the game starts');
      chk(before.anyEl.length === 0,
          'and nothing anywhere in the document carries a tutorial id or class');
      chk(await page.evaluate(() => !!document.getElementById('clickPlay')) &&
          await page.evaluate(() => !document.getElementById('skipTutorialLink')),
          'the start screen offers BEGIN EXPEDITION and no "skip the tutorial" escape hatch beside it');
      const legend = await page.evaluate(() => {
        const el = document.querySelector('.controls');
        return el ? el.innerText.trim() : null;
      });
      chk(legend && legend.split('\n').length <= 2 && !/LEFT CLICK|RIGHT CLICK|CRAFTING/i.test(legend),
          `and the control legend is two short lines, none of them a verb the world now teaches`);
      note('legend: ' + String(legend).replace(/\n/g, ' / '));
    }

    // =================================================================================
    head('2. BEGIN EXPEDITION GOES STRAIGHT TO THE GAME');
    // =================================================================================
    await page.click('#clickPlay');
    {
      /* The opening instruction is the one thing between the click and the world, and it
         is Phase 20.2's, not a tutorial: black, one line, skippable by any key. */
      await page.waitForTimeout(300);
      const mid = await page.evaluate(NO_TUTORIAL);
      chk(mid.present.length === 0 && mid.anyEl.length === 0,
          'clicking BEGIN opens no tutorial — there is still no such element in the document');
      chk(mid.covering.length <= 1 && (mid.covering[0] === 'openingInstruction' || mid.covering.length === 0),
          `the only thing covering the screen is the opening instruction (${mid.covering.join(', ') || 'nothing'})`);
    }
    await page.keyboard.press('Space');
    await page.waitForFunction('window.game && window.game.running === true', null, { timeout: 60000 });
    await page.waitForTimeout(500);
    {
      const v = await page.evaluate(VIEW);
      chk(v.running === true, 'a keypress ends the instruction and the frame loop is running');
      chk(v.objective === 'Gather wood.',
          `and the first thing on screen is one objective: "${v.objective}"`);
      chk(await page.evaluate(() => {
            const n = document.getElementById('journeyStep');
            const r = n.getBoundingClientRect();
            return r.width > 40 && r.height > 6 && getComputedStyle(n).display !== 'none';
          }), 'genuinely laid out and visible, not merely present in the DOM');
      const after = await page.evaluate(NO_TUTORIAL);
      chk(after.covering.length === 0,
          'nothing is covering the world: the first gameplay frame IS the first frame');
      chk(v.onboarding.length === 0,
          'and a new game owes all three contextual cues — none has been answered');
      chk(v.hudTicks === 10 && v.hasTrace,
          'the Phase 27 HUD is the HUD: ten condition ticks and the perception trace');
    }

    // =================================================================================
    head('3. THE CUES, OVER REAL WORLD GEOMETRY');
    // =================================================================================
    {
      const ID = await page.evaluate(() => ({ log: BLOCK.OAK_LOG, stone: BLOCK.STONE, dirt: BLOCK.DIRT }));

      let a = await aim(page, ID.log);
      chk(a.placed === ID.log && a.target === ID.log,
          'a log is placed in the real world two blocks ahead, and the crosshair finds it');
      chk(a.prompt === 'LMB · CHOP' && a.visible,
          `the prompt above the hotbar reads "${a.prompt}" — on screen, laid out, visible`);

      a = await aim(page, ID.stone);
      chk(a.prompt === 'LMB · MINE', `looking at stone instead: the same key, a different verb — "${a.prompt}"`);
      a = await aim(page, ID.dirt);
      chk(a.prompt === 'LMB · BREAK', `and over plain ground, "${a.prompt}"`);

      a = await aim(page, null);
      chk(a.target === null && a.prompt === null,
          'and with nothing under the crosshair the prompt goes away entirely');

      /* THE LATCH, through the real code path: break a block for real. */
      await aim(page, ID.log);
      await page.evaluate(() => {
        const g = window.game, p = g.player;
        const hit = p._getLookTarget();
        p._finishMining(hit, g.world.getBlockWorld(hit.bx, hit.by, hit.bz), true);
      });
      a = await aim(page, ID.log);
      chk(a.onboarding.indexOf('break') >= 0, 'felling one block answers that cue for good');
      chk(a.prompt === null, 'and the next tree is not explained again');

      /* CRAFT — the one key nothing in the world can show. */
      await page.evaluate(() => window.game.player.inventory.addItem(ITEM.OAK_LOG, 2));
      a = await aim(page, null);
      chk(a.prompt === 'E · CRAFT',
          `picking up a log raises the only key a player could not guess: "${a.prompt}"`);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(120);
      let v = await page.evaluate(VIEW);
      chk(v.craftingOpen === true, 'pressing it opens the crafting bench — crafting is still reachable');
      chk(v.onboarding.indexOf('craft') >= 0, 'and answers that cue permanently');
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(120);
      chk((await page.evaluate(VIEW)).craftingOpen === false, 'and pressing it again closes it');

      /* PLACE — and then the whole set is answered and the line falls silent. */
      await page.evaluate(() => {
        const p = window.game.player;
        p.inventory.addItem(ITEM.WOOD_PLANK, 8);
        for (let i = 0; i < p.inventory.slots.length; i++) {
          if (p.inventory.slots[i].item === ITEM.WOOD_PLANK) { p.selectedSlot = i; break; }
        }
      });
      a = await aim(page, ID.dirt, 4);
      chk(a.prompt === 'RMB · PLACE', `a placeable block in hand and ground ahead: "${a.prompt}"`);
      await page.evaluate(() => window.game.player._placeBlockOrInteract());
      a = await aim(page, ID.log);
      chk(a.onboarding.length === 3,
          `all three cues are answered after ${a.onboarding.join(', ')} — the onboarding is over`);
      chk(a.prompt === null, 'and from here the game never explains a key again');

      /* THE WORLD STILL WINS THE LINE. An affordance is not a cue and did not go away. */
      const chest = await page.evaluate(() => {
        const g = window.game, p = g.player;
        const bx = Math.floor(p.position.x), bz = Math.floor(p.position.z) - 2;
        const by = Math.floor(p.position.y + p.eyeHeight);
        g.world.setBlockWorld(bx, by, bz, BLOCK.TREASURE_CHEST);
        p._updateTargetHighlight();
        const out = document.getElementById('interactKey').textContent + ' · ' +
                    document.getElementById('interactVerb').textContent;
        g.world.setBlockWorld(bx, by, bz, 0);
        return out;
      });
      chk(chest === 'RMB · OPEN',
          `and a real affordance still speaks after the cues are done: "${chest}"`);
    }

    // =================================================================================
    head('4. INPUT IS NORMAL GAMEPLAY INPUT');
    // =================================================================================
    {
      /* A menu must still take the prompt down — a cue that survived an open panel would
         be offering a key the player cannot press. */
      await aim(page, 3);
      await page.keyboard.press('KeyO');
      await page.waitForTimeout(150);
      let v = await page.evaluate(VIEW);
      chk(v.menuOpen === true, 'O opens the settings panel from inside gameplay');
      await page.evaluate(() => window.game.player.update(0.016));
      v = await page.evaluate(VIEW);
      chk(v.prompt === null, 'and the prompt clears while it is up — no key is offered that cannot be pressed');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      chk((await page.evaluate(VIEW)).menuOpen === false, 'Escape closes it again and hands control back');
      chk((await page.evaluate(VIEW)).running === true, 'gameplay is still running — no stuck input state');
    }

    // =================================================================================
    head('5. SAVE, RELOAD, CONTINUE');
    // =================================================================================
    {
      await page.evaluate(() => window.game.saveGame('manual'));
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('whereitisnt.save.v1')));
      chk(saved.version === 4 && Array.isArray(saved.progression.onboarding) &&
          saved.progression.onboarding.length === 3,
          `the save carries the answered cues (v${saved.version}: ${saved.progression.onboarding.join(', ')})`);
      chk(!JSON.stringify(saved).toLowerCase().includes('tutorial'),
          'and the word "tutorial" appears nowhere in the file');

      await page.reload({ waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction('!!window.game', null, { timeout: 90000 });
      await page.click('#continuePlay');
      await page.waitForFunction('window.game && window.game.running === true', null, { timeout: 60000 });
      await page.waitForTimeout(400);

      const after = await page.evaluate(NO_TUTORIAL);
      chk(after.present.length === 0 && after.anyEl.length === 0 && after.covering.length === 0,
          'CONTINUE on a fresh runtime brings back no tutorial, hidden or otherwise');
      let v = await page.evaluate(VIEW);
      chk(v.running === true && v.objective !== null,
          `and resumes with the objective restored: "${v.objective}"`);
      chk(v.onboarding.length === 3,
          'with the cues still answered — a returning player is not taught to chop wood again');
      chk((await aim(page, 4)).prompt === null, 'and no cue appears over a tree after the load');

      /* A PRE-PHASE-28 SAVE. Written by somebody the tutorial was shown to. */
      await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('whereitisnt.save.v1'));
        raw.version = 3;
        delete raw.progression.onboarding;
        localStorage.setItem('whereitisnt.save.v1', JSON.stringify(raw));
      });
      await page.reload({ waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction('!!window.game', null, { timeout: 90000 });
      chk(await page.evaluate(() => {
            const b = document.getElementById('continuePlay');
            return !!b && b.style.display !== 'none';
          }), 'a schema-3 save still offers CONTINUE rather than being refused');
      await page.click('#continuePlay');
      await page.waitForFunction('window.game && window.game.running === true', null, { timeout: 60000 });
      await page.waitForTimeout(400);
      v = await page.evaluate(VIEW);
      chk(v.onboarding.length === 3,
          'and loads fully onboarded — the 3 -> 4 migration ran against a real stored file');
      chk((await aim(page, 4)).prompt === null,
          'so an old player looking at a tree is told nothing they already know');
      chk((await page.evaluate(NO_TUTORIAL)).present.length === 0,
          'and an old save cannot resurrect the tutorial, because there is nothing to resurrect');
    }

    // =================================================================================
    head('6. NEW GAME RESETS THE ONBOARDING');
    // =================================================================================
    {
      await page.evaluate(() => window.game.newGame());
      await page.waitForTimeout(300);
      const v = await page.evaluate(VIEW);
      chk(v.onboarding.length === 0,
          'a New Game owes all three cues again — a new player may be a different person');
      chk(v.objective === 'Gather wood.',
          `and is back on the first objective: "${v.objective}"`);
      chk((await page.evaluate(NO_TUTORIAL)).covering.length === 0,
          'with nothing covering the world');
      chk((await aim(page, 4)).prompt === 'LMB · CHOP',
          'and the first tree explains its key once more');
    }

    // =================================================================================
    head('7. COST');
    // =================================================================================
    {
      const cost = await page.evaluate(() => {
        const p = window.game.player;
        const run = () => {
          const t0 = performance.now();
          for (let i = 0; i < 4000; i++) p._onboardingCue(3);
          return (performance.now() - t0) / 4000;
        };
        window.game.onboarding = new Set(ONBOARDING_CUE_IDS);
        const done = run();
        window.game.onboarding = new Set();
        const owing = run();
        return { done: done, owing: owing };
      });
      chk(cost.done < 0.002,
          `a fully-onboarded save resolves a cue in ${(cost.done * 1000).toFixed(2)} µs — ` +
          `${(cost.done / 16.67 * 100).toFixed(4)}% of a 60fps frame`);
      chk(cost.owing < 0.02,
          `and even with all three still owed it costs ${(cost.owing * 1000).toFixed(2)} µs`);
      note('measured under SwiftShader, which is slower than any real GPU would be');
    }

    chk(errors.length === 0, 'no uncaught page errors across the whole run');
    if (errors.length) for (const e of errors.slice(0, 8)) note(e);
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail) { console.log(`${fail} BROWSER ONBOARDING CHECK(S) FAILED`); process.exit(1); }
  console.log('ALL BROWSER ONBOARDING CHECKS PASS');
  note('A REAL Chromium, a real WebGL context, the real document. What is NOT claimed here:');
  note('that a person understood any of it. No human played this build.');
})().catch((e) => { console.error(e); process.exit(1); });
