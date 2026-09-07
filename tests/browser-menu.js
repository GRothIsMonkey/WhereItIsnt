/* PHASE 29 — THE MAIN MENU AND THE HUD, IN A REAL BROWSER.

   This one IS a browser. It launches Chromium through Playwright, serves game.html over
   HTTP, boots the real game with a real WebGL context, and asserts on the live document:
   real layout boxes from getBoundingClientRect, real values from getComputedStyle, real
   clicks through the real listeners, and real pixels read back out of the menu canvas.

   WHAT IT PROVES. That the menu renders something rather than nothing; that its three
   controls are laid out, on top, and clickable; that CONTINUE appears only with a save
   and disappears without one; that settings opens over the menu and closes again; that
   the menu neither takes pointer lock nor lets a gameplay key through; that it runs no
   frame loop once the game starts; that the HUD's type is the size this phase committed
   to at 1280x720 AND at 900x600; and that nothing in the HUD overlaps anything else.

   WHAT IT DOES NOT PROVE. Whether any of it looks good. Screenshots are written to
   tests/renders/ for a person to look at, and this file makes no claim about them.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_MENU_PORT || 8221);
/* A seed whose walker crosses early, so a ten-second run can actually watch one. Chosen
   by asking menuEventAt, not by guessing — see the offline suite. */
const SEED = 7;

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
const shots = [];

/* SCREENSHOTS ARE BEST EFFORT AND SAY SO.

   Capturing this page while the WebGL frame loop is running times out under SwiftShader
   in the development container — the same limitation Phase 28 recorded against
   preview-hud.js, reproduced there on an unmodified build. The menu captures (no frame
   loop) succeed; the gameplay ones may not. Since these files are for a PERSON to look at
   and assert nothing, a failure to write one is reported rather than failed: what would
   be dishonest is claiming a screenshot exists when it does not. */
async function shoot(page, name, clip) {
  const file = path.join(OUT, name);
  try {
    await page.screenshot(clip ? { path: file, clip, timeout: 20000 } : { path: file, timeout: 20000 });
    shots.push(name + ' \u2713');
    return true;
  } catch (e) {
    shots.push(name + ' \u2717 (' + (e.name || 'error') + ')');
    return false;
  }
}
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

/* NOTE: these three are real functions, not template strings. Playwright evaluates a
   STRING pageFunction as an expression — it would produce the function object and never
   call it, and the result would come back undefined. Passing the function lets it be
   serialised and invoked, and lets it take an argument.

   Is this element laid out, visible, and the topmost thing at its own centre? A control
   that exists, has a listener and is covered by something else is the Phase 22 settings
   bug, and it is the failure this function exists to catch. */
const HITTABLE = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return { ok: false, why: 'missing' };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  if (cs.display === 'none' || cs.visibility === 'hidden') return { ok: false, why: 'hidden' };
  if (r.width < 4 || r.height < 4) return { ok: false, why: 'zero-size' };
  if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight)
    return { ok: false, why: 'off-screen ' + JSON.stringify(r) };
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const top = hit === el || el.contains(hit) || (hit && hit.contains(el));
  return { ok: top, why: top ? 'ok' : 'covered by #' + ((hit && hit.id) || (hit && hit.tagName) || 'null'),
           w: Math.round(r.width), h: Math.round(r.height) };
};

/* Every HUD reading, as the player's eye would get it: the computed size and weight the
   browser actually resolved (not the declared token), and the real box. */
const HUD_TYPE = () => {
  const out = {};
  const rows = {
    condition: '.cap-cond', perception: '.cap-perc', objective: '#journeyStep',
    prompt: '#interactPrompt', promptKey: '#interactPrompt .key',
    held: '#heldName', status: '#hudStatus', clock: '#clockWrap',
  };
  for (const k of Object.keys(rows)) {
    const el = document.querySelector(rows[k]);
    if (!el) { out[k] = null; continue; }
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    out[k] = { size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400,
               family: cs.fontFamily, filter: cs.filter, shadow: cs.textShadow,
               w: Math.round(r.width), h: Math.round(r.height),
               x: Math.round(r.left), y: Math.round(r.top) };
  }
  const count = document.querySelector('#hotbar .slot .count');
  if (count) { const cs = getComputedStyle(count); out.count = { size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400 }; }
  return out;
};

/* Does the menu canvas contain a landscape, or is it an empty rectangle? Sampled as a
   column of luminance down the middle: a real scene has a bright-ish sky, a darker
   horizon and a near-black ground, so the column has genuine variation in it. */
const SCENE_PIXELS = () => {
  const c = document.getElementById('menuScene');
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const col = g.getImageData(Math.floor(W * 0.5), 0, 1, H).data;
  let min = 255, max = 0, sum = 0;
  for (let y = 0; y < H; y++) {
    const l = (col[y * 4] * 0.3 + col[y * 4 + 1] * 0.59 + col[y * 4 + 2] * 0.11);
    if (l < min) min = l; if (l > max) max = l; sum += l;
  }
  /* And a horizontal strip across the water tower, which must contain something darker
     than the sky it stands in. */
  const ty = Math.floor(H * 0.42);
  const row = g.getImageData(0, ty, W, 1).data;
  let dark = 0;
  for (let x = 0; x < W; x++) if (row[x * 4] + row[x * 4 + 1] + row[x * 4 + 2] < 24) dark++;
  return { min: +min.toFixed(1), max: +max.toFixed(1), mean: +(sum / H).toFixed(1), silhouettePx: dark, W, H };
};

/* RESIZE, THEN WAIT FOR THE PAGE TO AGREE.

   `setViewportSize` resolves before the page's own innerWidth/innerHeight necessarily
   report the new size, and this file resizes three times. A reload racing an unsettled
   resize left the small-viewport media query still matching at 1280x720, which made the
   HUD report the small-window type scale as though it were the default — twice, in two
   different ways. Waiting on the page's own numbers removes the whole class of it. */
async function setSize(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  /* Tolerant by two pixels, and it reports what it actually saw. An exact-equality wait
     hung here once at a size the page was already at, which is either a rounding
     difference or a scrollbar — either way, the property worth waiting for is "the page
     agrees it is about this big", not "the numbers match to the pixel". */
  try {
    await page.waitForFunction(([W, H]) => Math.abs(innerWidth - W) <= 2 && Math.abs(innerHeight - H) <= 2,
                               [w, h], { timeout: 10000 });
  } catch (e) {
    const got = await page.evaluate(() => [innerWidth, innerHeight]);
    throw new Error(`viewport never settled at ${w}x${h}; the page reports ${got[0]}x${got[1]}`);
  }
}

(async () => {
  const hermetic = fs.existsSync(VENDOR_THREE);
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  let page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/pointer ?lock/i.test(t)) return;      // never granted to a headless page
    errors.push('console: ' + t);
  });
  await page.addInitScript((s) => { window.WII_MENU_SEED = s; }, SEED);
  if (hermetic) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction('!!window.game', null, { timeout: 90000 });
    await page.waitForTimeout(700);            // a few real menu frames

    // =================================================================================
    head('1. THE MENU RENDERS');
    // =================================================================================
    {
      chk(await page.evaluate(() => !!window.game.menu && window.game.menu.open === true),
          'the game boots straight onto the menu, and the menu knows it is open');
      const px = await page.evaluate(SCENE_PIXELS);
      chk(px.W > 1000 && px.H > 600, `the scene canvas is sized to the window (${px.W}x${px.H})`);
      chk(px.max - px.min > 12,
          `and it has actually been painted: luminance runs ${px.min} to ${px.max} down the middle`);
      chk(px.mean < 60, `the whole thing is dark (mean luminance ${px.mean}/255) — text sits on it without a scrim`);
      chk(px.silhouettePx > 4,
          `there is real silhouette on the horizon (${px.silhouettePx}px of near-black across the tower's row)`);

      const title = await page.evaluate(() => {
        const h = document.querySelector('#startScreen h1');
        const cs = getComputedStyle(h);
        return { text: h.innerText.replace(/\s+/g, ' ').trim(), size: parseFloat(cs.fontSize),
                 w: Math.round(h.getBoundingClientRect().width) };
      });
      chk(title.text === 'WHERE IT ISN’T', `the title reads "${title.text}"`);
      chk(title.size >= 28 && title.size <= 70,
          `at ${title.size}px — present without being a store splash`);
      chk(title.w < 1280, 'and it fits the window without overflowing it');

      const sub = await page.evaluate(() => document.querySelector('#startScreen .sub').innerText.trim());
      chk(!/EXPEDITION|SURVIVAL|CRAFT|COZY/i.test(sub), `the tagline carries no survival framing: "${sub}"`);
      chk(await shoot(page, 'menu-1280.png'),
          'a full-size capture of the menu was written for a person to look at');
    }

    // =================================================================================
    head('2. THE CONTROLS');
    // =================================================================================
    {
      for (const [label, sel] of [['NEW GAME', '#clickPlay'], ['SETTINGS', '#startSettingsLink']]) {
        const h = await page.evaluate(HITTABLE, sel);
        chk(h.ok, `${label} is laid out, on top and clickable (${h.w}x${h.h}px, ${h.why})`);
      }
      chk(await page.evaluate(() => {
            const b = document.getElementById('continuePlay');
            return getComputedStyle(b).display === 'none';
          }), 'CONTINUE is not offered when there is no save — it is hidden, not a dead button');
      chk(await page.evaluate(() => document.querySelectorAll('#startScreen').length === 1 &&
                                    document.querySelectorAll('#startScreen button').length === 3),
          'and there is one start screen with exactly three controls in it');

      /* Keyboard reachability, and that focus is marked by something other than colour. */
      const focus = await page.evaluate(() => {
        const b = document.getElementById('clickPlay');
        b.focus();
        const cs = getComputedStyle(b);
        const before = getComputedStyle(b, '::before');
        return { active: document.activeElement === b, transform: cs.transform,
                 marker: (before.content || '').replace(/"/g, '') };
      });
      chk(focus.active, 'the entries take keyboard focus');
      chk(focus.transform !== 'none' || focus.marker.length > 0,
          `and focus is shown by more than a colour change (marker ${JSON.stringify(focus.marker)}, transform ${focus.transform})`);
      await page.evaluate(() => document.activeElement.blur());

      /* AND THE COMPOSITION AT AN AWKWARD SIZE, while the game has not started and the
         page still honours a resize. A menu whose title wraps or whose entries stop being
         targets is broken however good it looks at 1280x720. */
      await setSize(page, 640, 480);
      const small = await page.evaluate(() => {
        const h = document.querySelector('#startScreen h1').getBoundingClientRect();
        const b = document.getElementById('clickPlay').getBoundingClientRect();
        const c = document.getElementById('menuScene');
        return { titleFits: h.left >= -1 && h.right <= innerWidth + 1,
                 btn: b.width > 40 && b.height > 10 && b.bottom <= innerHeight,
                 scrollX: document.documentElement.scrollWidth > innerWidth,
                 canvas: [c.width, c.height], win: [innerWidth, innerHeight] };
      });
      chk(small.titleFits, `the title still fits at ${small.win.join('x')}`);
      chk(small.btn, 'the entries are still real targets there');
      chk(!small.scrollX, 'and nothing overflows the window horizontally');
      chk(small.canvas[0] === small.win[0] && small.canvas[1] === small.win[1],
          `the scene canvas followed the resize (${small.canvas.join('x')})`);
      await shoot(page, 'menu-640.png');
      await setSize(page, 1280, 720);
    }

    // =================================================================================
    head('3. SETTINGS OVER THE MENU');
    // =================================================================================
    {
      await page.click('#startSettingsLink');
      await page.waitForTimeout(200);
      chk(await page.evaluate(() => window.game.ui.settingsOpen === true), 'the settings panel opens from the menu');
      /* Probed on the panel and on a real button. The volume sliders are deliberately a
         3px track, which is a design choice rather than a layout failure, so they are the
         wrong thing to hit-test. */
      const h = await page.evaluate(HITTABLE, '#setClose');
      chk(h.ok, `and its controls are reachable over the menu (${h.w}x${h.h}px, ${h.why})`);
      chk(await page.evaluate(() => {
            const m = document.getElementById('setMaster').getBoundingClientRect();
            const hit = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2);
            return hit && (hit.id === 'setMaster' || hit.closest('.settings-panel'));
          }), 'including the volume sliders, which the menu does not cover');
      chk(await page.evaluate(() => {
            const p = document.querySelector('.settings-panel').getBoundingClientRect();
            return p.top >= 0 && p.bottom <= innerHeight && p.left >= 0 && p.right <= innerWidth;
          }), 'the panel fits inside the viewport');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      chk(await page.evaluate(() => window.game.ui.settingsOpen === false), 'Escape closes it again');
      chk((await page.evaluate(HITTABLE, '#clickPlay')).ok, 'and the menu is usable afterwards');
      chk(await page.evaluate(() => !document.pointerLockElement),
          'closing settings from the MENU does not take pointer lock — the game is not running yet');
    }

    // =================================================================================
    head('4. THE MENU IS NOT THE GAME');
    // =================================================================================
    {
      const before = await page.evaluate(() => ({
        objective: window.game.objectives.currentText,
        marks: JSON.stringify(window.game.objectives.progress),
        day: window.game.dayCount, t: window.game.env.t,
        chunks: window.game.world.chunks.size,
        save: localStorage.getItem('whereitisnt.save.v1'),
        crafting: window.game.ui.craftingOpen, backpack: window.game.ui.backpackOpen,
        keys: JSON.stringify(window.game.player.keys),
      }));
      /* Lean on the keyboard the way a bored player would. */
      for (const k of ['KeyE', 'KeyI', 'KeyW', 'KeyA', 'Digit3', 'KeyQ', 'Tab'])
        await page.keyboard.press(k);
      /* THE TOP-LEFT CORNER, not the middle of the screen. An earlier draft clicked at
         (640,400) and hit NEW GAME — and every check below still passed, because they
         were sampled 400ms into the nine-second opening instruction, when `running` is
         legitimately still false. The menu-open assertion added below is what makes that
         mistake impossible to repeat silently. */
      await page.mouse.click(60, 60);
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({
        objective: window.game.objectives.currentText,
        marks: JSON.stringify(window.game.objectives.progress),
        day: window.game.dayCount, t: window.game.env.t,
        chunks: window.game.world.chunks.size,
        save: localStorage.getItem('whereitisnt.save.v1'),
        crafting: window.game.ui.craftingOpen, backpack: window.game.ui.backpackOpen,
        keys: JSON.stringify(window.game.player.keys),
        onboarding: window.game.onboarding.size,
        running: window.game.running,
        menuOpen: window.game.menu.open,
      }));
      chk(after.crafting === false && after.backpack === false,
          'E and I on the menu open nothing — the bench and the backpack stay shut');
      chk(after.onboarding === 0,
          'and E did not burn the Phase 28 crafting cue on a player who has not started yet');
      /* The keyup handler is deliberately NOT gated — releasing a key must always be
         heard, or a key held across a transition would stick down forever. So the map may
         contain `KeyW: false`; what must never happen is a key reading TRUE. */
      const held = await page.evaluate(() => Object.keys(window.game.player.keys)
        .filter(k => window.game.player.keys[k] === true));
      chk(held.length === 0, `no key is held down after leaning on the keyboard at the title screen (${held.join(', ') || 'none'})`);
      chk(await page.evaluate(() => !document.pointerLockElement),
          'clicking the background does not capture the cursor');
      chk(await page.evaluate(() => window.game.menu.open === true &&
                                    getComputedStyle(document.getElementById('startScreen')).display !== 'none'),
          'the menu is still up — none of that input started the game');
      chk(after.running === false, 'and the frame loop has not started');
      chk(after.day === before.day && after.t === before.t,
          `the clock did not advance (day ${after.day}, t ${after.t})`);
      chk(after.objective === before.objective && after.marks === before.marks,
          'no objective was created or advanced');
      chk(after.save === before.save, 'and nothing was written to the save slot');
      chk(after.chunks === before.chunks,
          `no world was generated while the menu was up (${after.chunks} chunks)`);
    }

    // =================================================================================
    head('5. THE ANOMALIES ARE ON THE CANVAS');
    // =================================================================================
    {
      /* Driven by advancing the scene's own clock rather than waiting three minutes: the
         schedule is a pure function of t, so this is the same code path a real sitting
         takes, at the speed a test can afford. */
      const seen = await page.evaluate(() => {
        const s = window.game.menu.scene;
        const out = { lampFrames: 0, walkerFrames: 0, shifts: 0, frames: 0 };
        for (let i = 0; i < 3000; i++) {          // 100 seconds at 30fps
          s.t += 0.033; s._pump(); s.draw(); out.frames++;
          if (s.t < s.lampUntil) out.lampFrames++;
          if (s.walkerFrom >= 0 && s.t - s.walkerFrom < 11) out.walkerFrames++;
        }
        out.shifts = s.shifted;
        return out;
      });
      chk(seen.lampFrames > 0, `the tower's light flickered during 100s of menu (${seen.lampFrames} frames lit)`);
      chk(seen.lampFrames / seen.frames < 0.02,
          `and was dark for ${(100 - seen.lampFrames / seen.frames * 100).toFixed(1)}% of it`);
      chk(seen.walkerFrames > 0, `something crossed the tree line (${seen.walkerFrames} frames)`);
      chk(seen.walkerFrames / seen.frames < 0.30, 'but was not on screen most of the time');
      await shoot(page, 'menu-anomaly.png');
    }

    // =================================================================================
    head('6. HUD TYPOGRAPHY, AS THE BROWSER RESOLVED IT');
    // =================================================================================
    {
      await page.click('#clickPlay');
      /* PHASE 30 — past the opening film. NEW GAME now plays a sixty-eight second cinematic
         before the crossroads instruction, so every fresh boot here skips it the way a
         player would. film.skip() is the same path the SKIP control runs. */
      await page.waitForFunction('window.game.film && window.game.film.active === true', null, { timeout: 30000 });
      await page.evaluate(() => window.game.film.skip());
      await page.waitForTimeout(150);
      await page.keyboard.press('Space');        // skip the opening instruction
      await page.waitForFunction('window.game && window.game.running === true', null, { timeout: 60000 });
      await page.waitForTimeout(600);

      chk(await page.evaluate(() => window.game.menu.open === false &&
                                    getComputedStyle(document.getElementById('startScreen')).display === 'none'),
          'NEW GAME takes the menu down');
      chk(await page.evaluate(() => window.game.menu.scene.running === false &&
                                    window.game.menu.scene.layer === null),
          'and the menu scene stops — no second frame loop behind the world');

      /* Give the HUD something to say, then read what the browser actually resolved. */
      await page.evaluate(() => {
        const g = window.game, p = g.player;
        p.inventory.addItem(ITEM.TORCH, 12);
        p.inventory.addItem(ITEM.WOOD_PLANK, 34);
        p.selectedSlot = 1;
        g.ui.updateHotbarSelection();
        g.ui.setInteractPrompt({ key: 'RMB', verb: 'FEED THE ANCHOR' });
        g.ui._flashHeldName();
        g.ui.setStatus ? null : null;
      });
      await page.waitForTimeout(300);
      const t = await page.evaluate(HUD_TYPE);

      const FLOOR = { condition: 11, perception: 11, objective: 14, prompt: 12,
                      promptKey: 11, held: 12, status: 10, clock: 11, count: 11 };
      for (const k of Object.keys(FLOOR)) {
        const row = t[k];
        chk(row && row.size >= FLOOR[k],
            `${k} resolves at ${row ? row.size : '?'}px (floor ${FLOOR[k]})`);
      }
      chk(t.condition.weight >= 600 && t.objective.weight >= 600 && t.prompt.weight >= 600,
          `the type the player reads carries weight (condition ${t.condition.weight}, objective ${t.objective.weight}, prompt ${t.prompt.weight})`);
      chk(!/Courier/i.test(t.condition.family),
          `and none of it is Courier New any more (${t.condition.family.split(',')[0]})`);
      chk(t.condition.filter === 'none' && t.objective.filter === 'none',
          'nothing in the HUD is blurred by a filter');
      chk(t.condition.w > 40 && t.condition.h > 8,
          `CONDITION occupies a real box (${t.condition.w}x${t.condition.h}px)`);

      /* NOTHING OVERLAPS. Bigger type is only an improvement if it still fits. */
      const clash = await page.evaluate(() => {
        const ids = ['#vitals', '#objectivePanel', '#hotbar', '#interactPrompt', '#clockWrap', '#heldName'];
        const boxes = ids.map(i => { const e = document.querySelector(i); return e ? { i, r: e.getBoundingClientRect() } : null; })
          .filter(b => b && b.r.width > 1 && b.r.height > 1);
        const bad = [];
        for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
          const A = boxes[a].r, B = boxes[b].r;
          if (A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom)
            bad.push(boxes[a].i + ' / ' + boxes[b].i);
        }
        const out = boxes.filter(b => b.r.left < 0 || b.r.top < 0 || b.r.right > innerWidth || b.r.bottom > innerHeight);
        return { bad, out: out.map(b => b.i) };
      });
      chk(clash.bad.length === 0, 'no two HUD clusters overlap' + (clash.bad.length ? ': ' + clash.bad.join(', ') : ''));
      chk(clash.out.length === 0, 'and all of them are inside the viewport' + (clash.out.length ? ': ' + clash.out.join(', ') : ''));

      await shoot(page, 'hud-29-day.png');
      await shoot(page, 'hud-29-vitals.png', { x: 0, y: 560, width: 640, height: 160 });
    }

    // =================================================================================
    head('7. A SMALL WINDOW');
    // =================================================================================
    {
      await setSize(page, 900, 600);
      await page.waitForTimeout(500);
      const t = await page.evaluate(HUD_TYPE);
      const smallest = Math.min(...Object.keys(t).filter(k => t[k]).map(k => t[k].size));
      chk(smallest >= 9.5, `at 900x600 the smallest HUD type is still ${smallest}px`);
      const clash = await page.evaluate(() => {
        const ids = ['#vitals', '#objectivePanel', '#hotbar', '#clockWrap'];
        const boxes = ids.map(i => document.querySelector(i).getBoundingClientRect());
        const out = boxes.filter(r => r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1);
        return out.length;
      });
      chk(clash === 0, 'and the HUD still fits inside it');
      await shoot(page, 'hud-29-small.png');
      note('renders/hud-29-small.png attempted at ' +
           JSON.stringify(await page.evaluate(() => [innerWidth, innerHeight])));

      /* THE MENU AT AN AWKWARD SIZE IS CHECKED IN SECTION 2, BEFORE THE GAME STARTS.
         Once the WebGL frame loop is running this page stops honouring further viewport
         changes in this container — the first resize applies and later ones are silently
         ignored — so a menu composition measured here would be measured at whatever size
         the last successful resize left. Rather than assert against a size the page may
         not actually be at, the resize-sensitive menu checks are done while only the menu
         is up, which is when resizing demonstrably works. */
    }

    // =================================================================================
    head('8. SHOW / HIDE, REPEATEDLY');
    // =================================================================================
    {
      const r = await page.evaluate(() => {
        const m = window.game.menu;
        const before = { screens: document.querySelectorAll('#startScreen').length,
                         canvases: document.querySelectorAll('#menuScene').length };
        for (let i = 0; i < 25; i++) { m.show(); m.hide(); }
        return { before, after: { screens: document.querySelectorAll('#startScreen').length,
                                  canvases: document.querySelectorAll('#menuScene').length },
                 open: m.open, running: m.scene.running, layer: m.scene.layer };
      });
      chk(r.after.screens === 1 && r.after.canvases === 1,
          '25 show/hide cycles leave exactly one start screen and one scene canvas');
      chk(r.open === false && r.running === false && r.layer === null,
          'and nothing is left running or held after the last hide');
      chk(await page.evaluate(() => window.game.running === true),
          'the game underneath was unaffected throughout');
    }

    // =================================================================================
    head('9. SAVE, RELOAD, CONTINUE');
    // =================================================================================
    {
      /* A FRESH PAGE, not a reload of this one. This page has a running WebGL loop and a
         viewport this container will no longer change; a new page in the same context
         starts at the context's own 1280x720 and shares its localStorage, so the save
         written below is the save CONTINUE finds. That is the same journey a player takes
         — write a save, come back to the menu, resume — with none of the harness's
         resize history in the way. */
      await page.evaluate(() => window.game.saveGame('manual'));
      const saved = await page.evaluate(() => localStorage.getItem('whereitisnt.save.v1'));
      chk(!!saved && saved.length > 100, `a save was written (${saved.length} bytes)`);
      await page.close();
      page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      await page.addInitScript((sd) => { window.WII_MENU_SEED = sd; }, SEED);
      if (hermetic) {
        const body2 = fs.readFileSync(VENDOR_THREE, 'utf8');
        await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: body2 }));
      }
      await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction('!!window.game', null, { timeout: 90000 });
      await page.waitForTimeout(500);
      const h = await page.evaluate(HITTABLE, '#continuePlay');
      chk(h.ok, `with a save on disk CONTINUE is shown and clickable (${h.w}x${h.h}px, ${h.why})`);
      const label = await page.textContent('#continuePlay');
      chk(/CONTINUE/.test(label) && /DAY/i.test(label),
          `and it names the run it would resume: "${label.replace(/\s+/g, ' ').trim()}"`);
      await page.click('#continuePlay');
      await page.waitForFunction('window.game && window.game.running === true', null, { timeout: 60000 });
      await page.waitForTimeout(400);
      chk(await page.evaluate(() => window.game.menu.open === false &&
                                    window.game.menu.scene.running === false),
          'CONTINUE takes the menu down the same way NEW GAME does');
      const vp = page.viewportSize();
      const win = await page.evaluate(() => ({ w: innerWidth, h: innerHeight,
        small: matchMedia('(max-width: 860px), (max-height: 620px)').matches }));
      const t = await page.evaluate(HUD_TYPE);
      chk(t.condition && t.condition.size >= 11 && t.objective && t.objective.size >= 14,
          `and the restored HUD is the same size as the new-game one ` +
          `(condition ${t.condition && t.condition.size}px, objective ${t.objective && t.objective.size}px; ` +
          `viewport ${vp.width}x${vp.height}, window ${win.w}x${win.h}, small-query ${win.small})`);
      chk(await page.evaluate(() => document.querySelectorAll('#conditionTicks').length === 1 &&
                                    document.querySelectorAll('#journeyStep').length === 1),
          'with no duplicated HUD elements after a load');
    }

    note('screenshots: ' + shots.join(', '));
    chk(errors.length === 0, 'no uncaught page errors across the whole run');
    if (errors.length) for (const e of errors.slice(0, 8)) note(e);
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail) { console.log(`${fail} BROWSER MENU CHECK(S) FAILED`); process.exit(1); }
  console.log('ALL BROWSER MENU / TYPOGRAPHY CHECKS PASS');
  note('A REAL Chromium, a real WebGL context, the real document, real computed styles.');
  note('What is NOT claimed: that any of it looks good, or that a person found the menu');
  note('unsettling. Screenshots are in tests/renders/ for someone to judge.');
})().catch((e) => { console.error(e); process.exit(1); });
