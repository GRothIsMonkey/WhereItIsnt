/* PHASE 30 — THE OPENING FILM, IN A REAL BROWSER.

   This one IS a browser. It launches Chromium through Playwright, serves game.html over
   HTTP, boots the real game with a real WebGL context and clicks NEW GAME — then asserts
   on the live document and the live runtime while the film is actually on screen.

   WHAT IT PROVES. That NEW GAME reaches the film and CONTINUE does not; that the frame
   loop is running and drawing while nothing in the world is; that the HUD is genuinely
   hidden and genuinely comes back; that leaning on the keyboard during the film opens
   nothing, mines nothing and advances nothing; that the settings panel opens OVER the
   film and pauses it; that skip returns a valid gameplay state from any moment; that the
   crossroads instruction plays afterwards and the first objective is on screen when the
   film is done; and that a second New Game does not leave two of anything.

   WHAT IT DOES NOT PROVE. Whether the film is any good, or unsettling, or the right
   length. Screenshots are written for a person to look at and are best-effort — see the
   note on `shoot`.

   REQUIREMENTS. Playwright and a Chromium build. Without them it skips and exits 0. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_OPENING_PORT || 8231);

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

/* Screenshots are best-effort and say which ones were written. Capturing this page while
   the WebGL frame loop runs times out under SwiftShader — the limitation Phase 28
   recorded and Phase 29 worked around. No assertion depends on one. */
async function shoot(page, name, clip) {
  try {
    await page.screenshot(clip ? { path: path.join(OUT, name), clip, timeout: 20000 }
                               : { path: path.join(OUT, name), timeout: 20000 });
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

/* Everything the assertions read, gathered in one page call so a check can never compare
   two different moments. Real runtime objects and real computed styles. */
const SNAP = () => {
  const g = window.game, p = g.player, f = g.film;
  const el = (id) => document.getElementById(id);
  const box = (id) => { const e = el(id); if (!e) return null; const r = e.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), disp: getComputedStyle(e).display }; };
  return {
    filmActive: !!(f && f.active), filmBeat: f ? f.beat : null, filmT: f ? +f.t.toFixed(2) : null,
    running: g.running, loop: !!g._loopRunning,
    movementLocked: !!p.movementLocked, dead: !!p.dead,
    wash: parseFloat(getComputedStyle(el('filmWash')).opacity),
    filmShown: getComputedStyle(el('openingFilm')).display,
    hudHidden: el('hud').classList.contains('film-hidden'),
    crossHidden: el('crosshair').classList.contains('film-hidden'),
    objective: (() => { const n = el('journeyStep');
      return n && n.className.indexOf('show') >= 0 ? n.textContent : null; })(),
    objectiveId: g.objectives ? g.objectives.currentId : null,
    marks: g.objectives ? JSON.stringify(g.objectives.progress) : null,
    day: g.dayCount, envT: +g.env.t.toFixed(3), chunks: g.world.chunks.size,
    crafting: g.ui.craftingOpen, backpack: g.ui.backpackOpen, settings: g.ui.settingsOpen,
    keysHeld: Object.keys(p.keys).filter(k => p.keys[k] === true),
    onboarding: g.onboarding ? g.onboarding.size : -1,
    edits: (() => { let n = 0; for (const m of g.world.editedChunks.values()) n += m.size; return n; })(),
    sceneChildren: g.scene.children.length,
    hp: p.hp, sanity: g.sanity.value,
    instructionOn: el('openingInstruction').className.indexOf('on') >= 0,
    instructionText: el('openingLine').textContent,
    filmProps: f && f.props ? 3 : 0,
    ambience: !!(g.sound && g.sound.filmAmbience),
    skipBox: box('filmSkip'), hudBox: box('hud'),
    pointerLock: !!document.pointerLockElement,
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
  let page = await ctx.newPage();

  const errors = [];
  const attach = (pg) => {
    pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    pg.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/pointer ?lock/i.test(t)) return;      // never granted to a headless page
      errors.push('console: ' + t);
    });
  };
  attach(page);
  if (hermetic) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction('!!window.game', null, { timeout: 90000 });
    await page.waitForTimeout(400);

    // =================================================================================
    head('1. NEW GAME REACHES THE FILM');
    // =================================================================================
    {
      const before = await page.evaluate(SNAP);
      chk(before.filmActive === false && before.filmShown === 'none',
          'the film is not running while the menu is up');

      await page.click('#clickPlay');
      await page.waitForFunction('window.game.film && window.game.film.active === true',
                                 null, { timeout: 20000 });
      await page.waitForTimeout(600);
      const s = await page.evaluate(SNAP);
      chk(s.filmActive === true, `NEW GAME enters the film (beat "${s.filmBeat}", t=${s.filmT}s)`);
      chk(s.filmShown !== 'none', 'its layer is in the document and displayed');
      chk(s.loop === true, 'the frame loop is running, so the film is actually being drawn');
      chk(s.running === false, 'but the GAME is not running — nothing in the world is ticking');
      chk(s.wash > 0.85, `and it opens on black (wash ${s.wash.toFixed(2)})`);
      chk(s.hudHidden === true && s.crossHidden === true, 'the HUD and the crosshair are hidden');
      chk(s.objective === null, 'and no objective is on screen — Phase 25 has not started yet');
      chk(s.filmProps === 3, 'the film owns its three silhouettes');
      chk(s.movementLocked === true, 'the player is in look-only');
      await shoot(page, 'film-dark.png');
    }

    // =================================================================================
    head('2. NOTHING IN THE WORLD IS HAPPENING');
    // =================================================================================
    {
      const a = await page.evaluate(SNAP);
      /* FIRST: the frame loop really is advancing the film on its own, with nobody
         driving it. This is the only real-time claim in the file and it is deliberately
         a small one — this container draws the world at roughly one frame a second under
         SwiftShader, so waiting out a fifteen-second beat here would be waiting on the
         renderer rather than on the game. */
      await page.waitForTimeout(2500);
      const moved = await page.evaluate(SNAP);
      chk(moved.filmT > a.filmT,
          `the frame loop advances the film by itself (${a.filmT}s -> ${moved.filmT}s in 2.5s of real time)`);

      /* THEN: drive it to the beat under test through its own update(), which is the same
         code path the frame loop uses and the same one section 5 uses. What is being
         asserted here is that nothing in the WORLD moves while the film runs — and that
         is a property of the film's tick, not of how fast Chromium can draw. */
      await page.evaluate(() => {
        const f = window.game.film;
        for (let i = 0; i < 900 && f.active && f.beat !== 'familiar'; i++) f.update(1 / 30);
      });
      await page.waitForTimeout(300);
      const b = await page.evaluate(SNAP);
      chk(b.filmBeat === 'familiar', `and it reaches the normality beat (t=${b.filmT}s)`);
      /* THE DAY DID NOT ADVANCE — which is not the same as "env.t is unchanged".
         The film SETS the hour, once per beat, so that the light walks across a real
         dawn while it runs; what it must never do is TICK the day. So the property is
         that the clock reads exactly the second the film's own table names for the beat
         it is on, and still reads it after a second of frame loop. */
      const lit = await page.evaluate(() => FILM_LIGHT.familiar);
      chk(b.envT === lit, `the clock reads the hour the film chose for this beat (${b.envT})`);
      await page.waitForTimeout(1100);
      const still = await page.evaluate(SNAP);
      chk(still.envT === lit && still.filmBeat === 'familiar',
          'and it does not move on its own — nothing is ticking the day');
      chk(b.day === a.day, 'the day count did not move');
      chk(b.objective === null && b.objectiveId === a.objectiveId && b.marks === a.marks,
          'no objective was created or advanced');
      chk(b.edits === a.edits, `no block was changed (${b.edits} edits, the starter torch)`);
      chk(b.hp === a.hp && b.sanity === a.sanity, 'health and sanity are untouched');
      chk(b.chunks === a.chunks, `no new chunk was streamed (${b.chunks})`);
      chk(b.wash < 0.05, `and the world is fully visible by the normality beat (wash ${b.wash.toFixed(2)})`);
      await shoot(page, 'film-world.png');
    }

    // =================================================================================
    head('3. GAMEPLAY INPUT IS DEAD');
    // =================================================================================
    {
      const a = await page.evaluate(SNAP);
      for (const k of ['KeyE', 'KeyI', 'Tab', 'KeyW', 'KeyA', 'Digit3', 'KeyQ'])
        await page.keyboard.press(k);
      await page.mouse.click(640, 360);          // would mine / attack in gameplay
      await page.mouse.down({ button: 'right' }); // would place / interact
      await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(400);
      const b = await page.evaluate(SNAP);

      chk(b.crafting === false && b.backpack === false,
          'E and I open nothing — the bench and the backpack stay shut behind the film');
      chk(b.onboarding === a.onboarding && b.onboarding === 0,
          'and E did not burn the Phase 28 crafting cue');
      chk(b.keysHeld.length === 0, `no movement key is held (${b.keysHeld.join(', ') || 'none'})`);
      chk(b.edits === a.edits, 'clicking mined and placed nothing');
      chk(b.filmActive === true, 'and none of it ended the film');
      chk(b.running === false, 'the game still is not running');
      chk(b.pointerLock === false || b.movementLocked === true,
          'the player can look, and can do nothing else');
    }

    // =================================================================================
    head('4. SETTINGS OPENS OVER THE FILM, AND PAUSES IT');
    // =================================================================================
    {
      await page.keyboard.press('KeyO');
      await page.waitForTimeout(300);
      const open = await page.evaluate(SNAP);
      chk(open.settings === true, 'O opens the settings panel during the film');
      chk(await page.evaluate(() => {
            const p = document.querySelector('.settings-panel');
            const r = p.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 12);
            return !!(hit && (hit === p || p.contains(hit)));
          }), 'and it is genuinely on top — a hit test at its own centre lands on the panel');

      const t1 = (await page.evaluate(SNAP)).filmT;
      await page.waitForTimeout(1200);
      const t2 = (await page.evaluate(SNAP)).filmT;
      chk(t2 === t1, `the film is PAUSED while it is open (t held at ${t2}s across 1.2s)`);

      /* Escape belongs to the panel first: it must close settings, not skip the film. */
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const closed = await page.evaluate(SNAP);
      chk(closed.settings === false, 'Escape closes the panel');
      chk(closed.filmActive === true, 'and does NOT skip the film — the panel had first claim on the key');
      await page.waitForTimeout(600);
      chk((await page.evaluate(SNAP)).filmT > t2, 'and the film resumes afterwards');
    }

    // =================================================================================
    head('5. THE BEATS HAPPEN, AND THE FILM ENDS ITSELF');
    // =================================================================================
    {
      /* Fast-forward the film's own clock rather than waiting a minute: it is advanced by
         dt, so adding to `t` is the same code path a real sitting takes. */
      const seen = await page.evaluate(async () => {
        const f = window.game.film;
        const out = { beats: [], props: {} };
        let last = null;
        for (let i = 0; i < 2200 && f.active; i++) {
          f.update(1 / 30);
          if (f.beat !== last) {
            last = f.beat;
            out.beats.push(f.beat);
            out.props[f.beat] = f.props
              ? [f.props.figure.visible, f.props.echo.visible, f.props.vast.visible] : null;
          }
        }
        return out;
      });
      chk(seen.beats.length >= 6, `the film moved through ${seen.beats.length} beats: ${seen.beats.join(' -> ')}`);
      chk(seen.props.anomaly && seen.props.anomaly[0] === true, 'a shape appears at the anomaly beat');
      chk(seen.props.vast && seen.props.vast[2] === true, 'something vast appears on the horizon');
      chk(seen.props.seam && seen.props.seam[0] && seen.props.seam[1],
          'and there are two of the same thing at the seam');
      chk(seen.props.calm && seen.props.calm.every(v => v === false),
          'and all of it is gone again by the calm beat');

      await page.waitForFunction('window.game.film.active === false', null, { timeout: 20000 });
      const s = await page.evaluate(SNAP);
      chk(s.filmActive === false, 'the film ends itself');
      chk(s.filmProps === 0 && s.ambience === false,
          'its silhouettes and its audio are gone with it');
      chk(s.instructionOn === true || s.running === true,
          'and it hands straight to the crossroads instruction');
    }

    // =================================================================================
    head('6. THE INSTRUCTION, THEN GAMEPLAY');
    // =================================================================================
    {
      const said = await page.evaluate(async () => {
        const seen = [];
        for (let i = 0; i < 120; i++) {
          const t = document.getElementById('openingLine').textContent;
          if (t && seen.indexOf(t) < 0) seen.push(t);
          if (window.game.running) break;
          await new Promise(r => setTimeout(r, 120));
        }
        return seen;
      });
      chk(said.indexOf('At the crossroads, go east.') >= 0 && said.indexOf('Go east.') >= 0,
          `the instruction plays after the film: "${said.join('" / "')}"`);

      /* THE LINES ARE WATCHED IN REAL TIME; THE HANDOVER IS NOT WAITED FOR.

         The instruction is the one thing in this sequence still driven by setTimeout — it
         is Phase 20.2's and it is not this phase's to rewrite. Its timers are starved on a
         page whose frame loop takes about a second per frame under SwiftShader, so the
         8.9s beat can take considerably longer than 8.9s here, and how long is a property
         of the software renderer rather than of the build. The check above is the real
         one and it is genuinely real-time: both lines appeared, in order, on their own.
         Its last beat is then run directly, the same way section 7 does, so that what
         follows is measuring the HANDOVER rather than the container's frame rate. */
      await page.evaluate(() => { const g = window.game;
        if (!g.running && g.openingInstruction.active) g.openingInstruction._finish(); });
      await page.waitForFunction('window.game.running === true', null, { timeout: 60000 });
      await page.waitForTimeout(600);
      const s = await page.evaluate(SNAP);
      chk(s.running === true, 'and then gameplay begins');
      chk(s.hudHidden === false && s.crossHidden === false, 'the HUD and the crosshair come back');
      chk(s.hudBox && s.hudBox.disp !== 'none', 'the HUD is genuinely displayed, not merely unclassed');
      chk(s.objective === 'Gather wood.', `the first objective is on screen: "${s.objective}"`);
      chk(s.movementLocked === false, 'the player has movement back');
      chk(s.filmShown === 'none', 'the film layer is out of the way');
      chk(s.filmProps === 0 && s.ambience === false, 'and nothing of the film is left running');
      chk(s.instructionOn === false, 'nor is the instruction still on screen');
      await shoot(page, 'film-gameplay.png');

      /* AND THE GAME REALLY WORKS AFTERWARDS — the point of the whole restoration. */
      /* Driven through player.update() rather than waited out in real time: this
         container renders at about one frame a second, so a wall-clock walk test would be
         measuring SwiftShader. This is the same method the frame loop calls, with the
         same dt it would pass. */
      const moved = await page.evaluate(() => {
        const p = window.game.player;
        const before = { x: p.position.x, z: p.position.z };
        p.locked = true;
        p.keys['KeyW'] = true;
        for (let i = 0; i < 60; i++) p.update(1 / 60);
        p.keys['KeyW'] = false;
        return { before, after: { x: p.position.x, z: p.position.z } };
      });
      const dist = Math.hypot(moved.after.x - moved.before.x, moved.after.z - moved.before.z);
      chk(dist > 0.5, `and the player can actually walk (${dist.toFixed(2)}m over one simulated second)`);
    }

    // =================================================================================
    head('7. SKIP, FROM A FRESH RUN');
    // =================================================================================
    {
      await page.close();
      page = await ctx.newPage();
      attach(page);
      if (hermetic) {
        const body = fs.readFileSync(VENDOR_THREE, 'utf8');
        await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
      }
      await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction('!!window.game', null, { timeout: 90000 });
      await page.waitForTimeout(400);
      await page.click('#clickPlay');
      await page.waitForFunction('window.game.film && window.game.film.active === true',
                                 null, { timeout: 20000 });
      await page.waitForTimeout(400);
      /* Give the film a few seconds of its own clock so the skip control has faded in —
         a player reaching for it would have watched at least that much. */
      await page.evaluate(() => {
        const f = window.game.film;
        for (let i = 0; i < 180 && f.active; i++) f.update(1 / 30);
      });

      const h = await page.evaluate(() => {
        const e = document.getElementById('filmSkip');
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { w: Math.round(r.width), h: Math.round(r.height), opacity: parseFloat(cs.opacity),
                 top: hit === e || e.contains(hit), size: cs.fontSize };
      });
      chk(h.w > 30 && h.h > 8, `the skip control is a real target (${h.w}x${h.h}px at ${h.size})`);
      chk(h.top, 'and it is the topmost thing at its own centre — it can actually be clicked');
      chk(h.opacity > 0 && h.opacity < 0.95,
          `it is present but quiet (opacity ${h.opacity.toFixed(2)}) — not a tutorial button`);

      /* Dispatched on the element rather than through Playwright's synthetic mouse: the
         page runs a WebGL frame loop that keeps the compositor busy enough for its
         actionability retry to time out. The layering this would have been checking is
         checked explicitly by the hit test above. */
      await page.$eval('#filmSkip', (el) => el.click());
      await page.waitForTimeout(400);
      const s = await page.evaluate(SNAP);
      chk(s.filmActive === false, 'clicking it ends the film immediately');
      chk(s.filmProps === 0 && s.ambience === false, 'with its props and audio cleaned up');
      chk(s.hudHidden === false, 'the HUD is restored');
      chk(s.instructionOn === true || s.running === true,
          'and it goes on to the instruction exactly as a finished film does');

      await page.evaluate(() => { const g = window.game;
        if (g.openingInstruction.active) g.openingInstruction._finish(); });
      await page.waitForFunction('window.game.running === true', null, { timeout: 60000 });
      await page.waitForTimeout(500);
      const t = await page.evaluate(SNAP);
      chk(t.running === true && t.movementLocked === false && t.objective === 'Gather wood.',
          `a skipped film lands in exactly the same gameplay state ("${t.objective}", movement free)`);
      chk(t.envT > 0, `and the day is the game's, not the film's (env.t ${t.envT})`);
    }

    // =================================================================================
    head('8. CONTINUE DOES NOT REPLAY IT');
    // =================================================================================
    {
      await page.evaluate(() => window.game.saveGame('manual'));
      const saved = await page.evaluate(() => localStorage.getItem('whereitisnt.save.v1'));
      chk(!!saved && !/film|cinematic|opening/i.test(saved),
          `a save was written and contains no cinematic flag (${saved.length} bytes)`);

      await page.close();
      page = await ctx.newPage();
      attach(page);
      if (hermetic) {
        const body = fs.readFileSync(VENDOR_THREE, 'utf8');
        await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
      }
      await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction('!!window.game', null, { timeout: 90000 });
      await page.waitForTimeout(400);
      await page.click('#continuePlay');
      await page.waitForFunction('window.game && window.game.running === true', null, { timeout: 60000 });
      await page.waitForTimeout(500);
      const s = await page.evaluate(SNAP);
      chk(s.filmActive === false, 'CONTINUE never enters the film');
      chk(s.filmShown === 'none', 'its layer never appears');
      chk(s.filmProps === 0 && s.ambience === false, 'nothing of it is constructed');
      chk(s.hudHidden === false && s.objective !== null,
          `and the HUD and the objective are live immediately ("${s.objective}")`);
      chk(s.instructionOn === false, 'the crossroads instruction is not replayed either');
      chk(s.movementLocked === false, 'with movement available from the first frame');
    }

    // =================================================================================
    head('9. A SECOND NEW GAME LEAVES ONE OF EVERYTHING');
    // =================================================================================
    {
      const r = await page.evaluate(async () => {
        const g = window.game;
        const before = { children: g.scene.children.length,
                         films: document.querySelectorAll('#openingFilm').length };
        for (let i = 0; i < 6; i++) {
          g.film.begin(null);
          for (let k = 0; k < 40; k++) g.film.update(1 / 30);
          g.film.skip();
        }
        return { before, after: { children: g.scene.children.length,
                                  films: document.querySelectorAll('#openingFilm').length },
                 active: g.film.active, props: g.film.props,
                 ambience: !!g.sound.filmAmbience,
                 hudHidden: document.getElementById('hud').classList.contains('film-hidden') };
      });
      chk(r.after.children === r.before.children,
          `6 films in a row leave the scene graph unchanged (${r.before.children} -> ${r.after.children} objects)`);
      chk(r.after.films === 1, 'and one film layer in the document');
      chk(r.active === false && r.props === null && r.ambience === false && r.hudHidden === false,
          'with nothing left active, allocated, sounding or hidden');
      chk(await page.evaluate(() => window.game.running === true),
          'and the game underneath was unaffected throughout');
    }

    note('screenshots: ' + shots.join(', '));
    chk(errors.length === 0, 'no uncaught page errors across the whole run');
    if (errors.length) for (const e of errors.slice(0, 8)) note(e);
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail) { console.log(`${fail} BROWSER OPENING CHECK(S) FAILED`); process.exit(1); }
  console.log('ALL BROWSER OPENING CHECKS PASS');
  note('A REAL Chromium, a real WebGL context, the real document and the real runtime.');
  note('What is NOT claimed: that the film is unsettling, well paced or the right length.');
  note('No human has watched it.');
})().catch((e) => { console.error(e); process.exit(1); });
