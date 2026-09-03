/* PHASE 20.2 — GUIDANCE: THE COMPASS, THE INSTRUCTION, AND THE CROSSROADS.

   Three things have to be true for the intended experience to work, and all three are
   measurable without a browser:

     1. the compass names the same EAST the authored journey runs along, at every
        heading, derived from the game's own convention rather than assumed;
     2. the compass is earned in the first dimension, not held from the start, and it
        survives every dimension crossing and the progression container a save will use;
     3. the instruction exists, says what it is meant to say, and is not a recurring
        prompt — and the four-way crossroads it refers to is still a four-way.

   Nothing here asserts on audio. The whisper is scheduled through the existing
   SoundEngine, which needs a real AudioContext; the harness has none, so the sequence is
   exercised with audio disabled and the ONLY claim made is that it does not throw and
   that the words and their timing are right. NO AUDIO WAS HEARD. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld } = require('./harness/util.js');
const { w, ev, S } = makeWorld();
const SRC = fs.readFileSync(path.join(__dirname, '..', 'game.html'), 'utf8');
let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const g = (n) => vm.runInContext(n, S);

// =====================================================================================
// 1. THE DIRECTION CONVENTION, DERIVED FROM THE IMPLEMENTATION
// =====================================================================================
const bearing = g('compassBearingFromYaw');
const cardinal = g('compassCardinal');
const DEG = 180 / Math.PI;
// The movement basis PlayerController actually builds, restated here so a change to it
// breaks this test rather than silently rotating the compass.
const forward = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

{
  const E = g('WORLD_DIR_EAST'), N = g('WORLD_DIR_NORTH');
  chk(E.x === 1 && E.z === 0, `EAST is +X (${E.x},${E.z})`);
  chk(N.x === 0 && N.z === -1, `NORTH is -Z (${N.x},${N.z})`);
  // Right-handed with Y up: east cross north must be +Y, or the compass is mirrored.
  const cross = E.z * N.x - E.x * N.z;
  chk(cross === 1, 'east × north = up — the frame is right-handed, not mirrored');
}
{
  const f = forward(w.farmlandsSpawnYaw);
  chk(Math.abs(f.x - 1) < 1e-9 && Math.abs(f.z) < 1e-9,
      `the Farmlands spawn yaw points at +X (forward ${f.x.toFixed(3)},${f.z.toFixed(3)})`);
  chk(cardinal(bearing(w.farmlandsSpawnYaw)) === 'E',
      'and the compass calls that heading EAST — instruction and world agree');
  chk(g('FARM_J_DIR') === 1 && w.farmHome.cx > ev('FARM_SPAWN_X'),
      `the journey advances in +X: the Home is at x=${w.farmHome.cx}, arrival at x=${ev('FARM_SPAWN_X')}`);
}
{
  let bad = [];
  for (const [name, yaw] of [['N', 0], ['E', -Math.PI / 2], ['S', Math.PI], ['W', Math.PI / 2]]) {
    if (cardinal(bearing(yaw)) !== name) bad.push(name);
  }
  chk(bad.length === 0, 'all four cardinal headings read correctly' + (bad.length ? ' — wrong: ' + bad : ''));
}
/* --- THE HEADING AGREES WITH THE MOVEMENT VECTOR AT EVERY ANGLE ---------------------
   The real test is not the four cardinals but everything between them: for every heading
   the bearing must equal the compass angle of the direction the player would WALK if
   they pressed W. That is the property a mirrored or offset compass fails. */
{
  let worst = 0, worstYaw = null;
  for (let d = -540; d <= 540; d += 1) {
    const yaw = d * Math.PI / 180;
    const f = forward(yaw);
    const want = Math.atan2(f.x, -f.z);              // clockwise from north (-Z)
    const got = bearing(yaw);
    const diff = Math.abs(((got - want) * DEG + 540) % 360 - 180);
    if (diff > worst) { worst = diff; worstYaw = d; }
  }
  chk(worst < 1e-9,
      `the bearing matches the actual walk direction at all 1081 headings tested, ` +
      `including past ±360° (worst error ${worst.toExponential(1)}° at yaw ${worstYaw}°)`);
}
{
  let out = 0;
  for (let d = -1080; d <= 1080; d += 7) {
    const b = bearing(d * Math.PI / 180);
    if (!(b >= 0 && b < Math.PI * 2)) out++;
  }
  chk(out === 0, 'the bearing is always normalised into [0, 2π) — no wrap artefacts at the seam');
}
{
  const cases = [[-45, 'N', 'E'], [-135, 'E', 'S'], [135, 'S', 'W'], [45, 'W', 'N']];
  let ok = true;
  for (const [deg, a, b] of cases) {
    const c = cardinal(bearing(deg * Math.PI / 180));
    if (c !== a && c !== b) ok = false;
  }
  chk(ok, 'the four intercardinal headings resolve to one of their two neighbours');
  chk(cardinal(bearing(-Math.PI / 2 + 0.2)) === 'E' && cardinal(bearing(-Math.PI / 2 - 0.2)) === 'E',
      'and a player wandering ±11° off east still reads EAST');
}

// =====================================================================================
// 2. ACQUISITION, PERSISTENCE AND THE PROGRESSION CONTAINER
// =====================================================================================
chk(vm.runInContext('typeof Game.prototype.grantCompass', S) === 'function',
    'Game.grantCompass exists');
chk(vm.runInContext('typeof Game.prototype._syncProgressionHUD', S) === 'function',
    'Game._syncProgressionHUD exists');
chk(vm.runInContext('typeof UIManager.prototype.setCompassVisible', S) === 'function' &&
    vm.runInContext('typeof UIManager.prototype.updateCompass', S) === 'function',
    'UIManager.setCompassVisible / updateCompass exist');

/* A stand-in for the Game's progression, running the REAL methods off Game.prototype
   against a real UIManager. Constructing the whole Game needs a WebGL context; the two
   methods under test touch only `compassAcquired` and the UI, so this exercises the
   shipped code rather than a copy of it. */
function fakeGame() {
  const ui = vm.runInContext('new UIManager()', S);
  const G = vm.runInContext('Game.prototype', S);
  const o = { compassAcquired: false, ui, toasts: [],
              grantCompass: G.grantCompass, _syncProgressionHUD: G._syncProgressionHUD };
  const realToast = ui.showToast.bind(ui);
  ui.showToast = (t, d) => { o.toasts.push(t); realToast(t, d); };
  return o;
}
{
  const o = fakeGame();
  chk(o.compassAcquired === false && o.ui.compassShown === false,
      'a fresh game has no compass and the HUD element is hidden');
  const first = o.grantCompass();
  chk(first === true && o.compassAcquired === true && o.ui.compassShown === true,
      'opening the first Overworld chest grants it and shows the tape');
  chk(o.toasts.length === 1 && /compass/i.test(o.toasts[0]),
      `and says so once, quietly: "${o.toasts[0]}"`);
  const second = o.grantCompass();
  chk(second === false && o.toasts.length === 1,
      'a second chest changes nothing — the latch is one-shot, with no repeat toast');
  o.ui.setCompassVisible(false);              // simulate a HUD teardown mid-transition
  o._syncProgressionHUD();
  chk(o.ui.compassShown === true, 'and it is restored by _syncProgressionHUD after a crossing');
  const fresh = fakeGame();
  fresh._syncProgressionHUD();
  chk(fresh.ui.compassShown === false,
      'while a player who has not earned it still has no compass after a crossing');
}
{
  const syncs = (SRC.match(/_syncProgressionHUD\(\)/g) || []).length;
  chk(syncs >= 5,
      `every dimension crossing re-applies it: ${syncs} call sites (Levels 2, 3 and 4, the ` +
      `dev teleports, and the definition)`);
  chk(/this\.compassAcquired = false;/.test(SRC) &&
      /this\.behemothSpawned = false;[\s\S]{0,1200}this\.compassAcquired = false;/.test(SRC),
      'the flag lives in the Game progression block beside the other one-shot latches, ' +
      'not in an isolated container');
  chk(/this\.progression\.grantCompass\(\)/.test(SRC) &&
      /!this\.inFarmlands && !this\.inSuburbia && !this\.inFakeHaven/.test(SRC),
      'and it is granted from the chest branch, gated to the first dimension');
}
{
  const ITEM = ev('ITEM');
  chk(!Object.keys(ITEM).some(k => /COMPASS/i.test(k)),
      'the compass is progression state, not a droppable inventory item');
}
{
  // Requirement 8: orientation only. Nothing in the renderer may reach for a landmark.
  const tape = SRC.slice(SRC.indexOf('  updateCompass(yaw) {'),
                         SRC.indexOf('  triggerWinScreen(stage) {'));
  chk(!/farmTower|farmHome|farmTree|farmBarn|farmFallen|position|distance|Math\.hypot/.test(tape),
      'the tape reads ONLY the yaw — no landmark, no player position, no distance');
}

// =====================================================================================
// 3. THE OPENING INSTRUCTION
// =====================================================================================
{
  const lines = g('OPENING_INSTRUCTION_LINES');
  chk(Array.isArray(lines) && lines.length === 2, 'the instruction is exactly two lines');
  chk(/^at the crossroads,\s*go east\.?$/i.test(lines[0]),
      `line 1 is the instruction: "${lines[0]}"`);
  chk(/^go east\.?$/i.test(lines[1]), `line 2 is the repetition after the pause: "${lines[1]}"`);
  const joined = lines.join(' ').toLowerCase();
  chk(!/(tower|tree|barn|farmhouse|home|disconnected|objective|marker|compass|press|key)/.test(joined),
      'and it names nothing — no landmark, no destination, no mechanic, no explanation');
}
{
  chk(vm.runInContext('typeof OpeningInstruction', S) === 'function', 'OpeningInstruction exists');
  chk(vm.runInContext('typeof Game.prototype._beginPlay', S) === 'function',
      'Game._beginPlay exists — the world only starts after the instruction resolves');
  const start = SRC.slice(SRC.indexOf('  _start() {'), SRC.indexOf('  _beginPlay() {'));
  chk(/openingInstruction\.play\(/.test(start),
      'the last thing _start() does is play the instruction');
  chk(!/requestAnimationFrame\(this\._animate\)/.test(start),
      'and gameplay does not begin until it is finished — the frame loop moved to _beginPlay');
  chk(/skipTutorialLink[\s\S]{0,140}_start\(\)/.test(SRC) &&
      /new TutorialController\(\(\) => this\._start\(\)\)/.test(SRC),
      'both routes in — finishing the tutorial and skipping it — pass through _start()');
}
{
  /* The sequence runs to completion with audio unavailable, calls back exactly once,
     and can be skipped. NO AUDIO WAS HEARD — see this file's header. */
  const OI = vm.runInContext('OpeningInstruction', S);
  const silent = { playWhisper() { throw new Error('audio disabled in harness'); } };
  const oi = new OI(silent);
  let calls = 0, threw = null;
  try { oi.play(() => calls++); } catch (e) { threw = e; }
  chk(!threw, 'the sequence starts without throwing when audio is unavailable' +
              (threw ? ': ' + threw.message : ''));
  /* Seven timers, and the shape matters more than the count: line 1 in, line 1 visible,
     line 1 out, line 2 in, line 2 visible, line 2 out, hand-off. The two whispers fire
     inside the line-in callbacks rather than as cues of their own. */
  chk(oi.active === true && oi.timers.length === 7,
      `it schedules the full beat: ${oi.timers.length} cues — line, pause, line, hand-off`);
  oi._finish();
  chk(calls === 1 && oi.active === false, 'skipping ends it immediately and calls back once');
  oi._finish();
  chk(calls === 1, 'and the callback can never fire twice');

  const oi2 = new OI(silent);
  let done = 0;
  oi2.play(() => done++);
  chk(typeof oi2.recall === 'function', 'the recall variant exists');
  oi2.recall();
  chk(done === 0, 'and recall cannot interrupt the opening beat');
  oi2._finish();
}
{
  chk(/farmCrossroadsRecalled = false/.test(SRC) &&
      /if \(!this\.farmCrossroadsRecalled\) \{[\s\S]{0,80}this\.farmCrossroadsRecalled = true;/.test(SRC),
      'the Farmlands recall is latched — it can fire at most once per session');
  const oStart = SRC.indexOf('_updateFarmJourneyObjective() {');
  const obj = SRC.slice(oStart, oStart + 3200);
  chk(!/go east/i.test(obj),
      'and the journey objective line never says "go east" — no competing instruction');
  const hudStart = SRC.indexOf('<div id="objectiveHUD">');
  const hud = SRC.slice(hudStart, SRC.indexOf('</div>', SRC.indexOf('<div id="journeyStep">')));
  chk(!/east/i.test(hud), 'nor does any static HUD directive');
}

// =====================================================================================
// 4. THE CROSSROADS IS STILL A FOUR-WAY
// =====================================================================================
{
  const P = ev('FARM_P'), SURF = ev('FARM_SURF');
  const BX = ev('FARM_ARRIVAL_BX'), BZ = ev('FARM_ARRIVAL_BZ');
  const SX = ev('FARM_SPAWN_X'), SZ = ev('FARM_SPAWN_Z');
  const road = (s) => s === SURF.TRACK || s === SURF.RUT;
  chk(w._farmLaneX(BX) && w._farmLaneZ(BZ),
      'both arrival lanes are still forced — the crossroads exists by construction');
  chk(ev('farmCrossKept')(BX),
      'and the Phase 20.1 corridor suppression KEEPS the arrival crossing: the ' +
      'north-south road is not faded out at the junction');
  /* Each arm is followed along its OWN meandering centreline, because the Phase 18.1
     routes wander up to fourteen blocks and a straight probe would walk off the road and
     report a gap that is not there. */
  const arm = (label, follow) => {
    let on = 0, total = 0, firstMiss = null;
    for (let d = 4; d <= 400; d++) {
      total++;
      const [x, z] = follow(d);
      if (road(w._farmSurfaceAt(x, z))) on++;
      else if (firstMiss === null) firstMiss = d;
    }
    chk(on === total,
        `${label} is unbroken road for 400 blocks off the crossroads (${on}/${total})` +
        (firstMiss ? `, first gap at ${firstMiss}` : ''));
  };
  arm('NORTH (-Z)', (d) => { const z = SZ - d; return [Math.round(BX * P + w._farmRouteX(BX, z)), z]; });
  arm('SOUTH (+Z)', (d) => { const z = SZ + d; return [Math.round(BX * P + w._farmRouteX(BX, z)), z]; });
  arm('EAST  (+X)', (d) => { const x = SX + d; return [x, Math.round(BZ * P + w._farmRouteZ(BZ, x))]; });
  arm('WEST  (-X)', (d) => { const x = SX - d; return [x, Math.round(BZ * P + w._farmRouteZ(BZ, x))]; });
}
{
  /* EAST must be the only authored chain. The other three directions stay ordinary
     procedural Farmland, which is checked by asking whether any authored journey site
     lies in them at all. */
  const SX = ev('FARM_SPAWN_X'), SZ = ev('FARM_SPAWN_Z');
  const sites = [['fallen', w.farmFallen], ['tower', w.farmTower], ['barn', w.farmBarn],
                 ['tree', w.farmTree], ['home', w.farmHome]];
  let east = 0, elsewhere = [];
  for (const [name, s] of sites) {
    const dx = s.cx - SX, dz = s.cz - SZ;
    if (dx > 0 && Math.abs(dx) > Math.abs(dz)) east++; else elsewhere.push(name);
  }
  chk(east === 5 && elsewhere.length === 0,
      `all five authored landmarks lie EAST of arrival (${east}/5)` +
      (elsewhere.length ? ' — stray: ' + elsewhere.join(', ') : ''));
  const order = sites.map(([n, s]) => [n, Math.hypot(s.cx - SX, s.cz - SZ)]);
  let ordered = true;
  for (let i = 1; i < order.length; i++) if (order[i][1] <= order[i - 1][1]) ordered = false;
  chk(ordered, 'and in the Phase 20.1 order: ' +
      order.map(([n, d]) => `${n} ${d.toFixed(0)}`).join(' → '));
  chk(order[4][1] > 1500 && order[4][0] === 'home',
      `the Home is still last and still far: ${order[4][1].toFixed(0)} blocks`);
  const targets = { fallen: 410, tower: 793, barn: 1179, tree: 1625, home: 1944 };
  let moved = [];
  for (const [n, d] of order) if (Math.abs(d - targets[n]) > 40) moved.push(`${n} ${d.toFixed(0)}≠${targets[n]}`);
  chk(moved.length === 0,
      'and every landmark is within 40 blocks of its Phase 20.1 distance' +
      (moved.length ? ' — moved: ' + moved.join(', ') : ''));
}

// =====================================================================================
// 5. THE TAPE'S LAYOUT — IS EAST ACTUALLY ON THE RIGHT?
// =====================================================================================
/* The arithmetic being right does not prove the STRIP is right. A tape that slides the
   wrong way, or places its letters mirrored, passes every bearing test above and is
   still useless: the player turns right and the letters march the wrong way. This
   captures the real fillText calls and checks where each cardinal actually lands. */
{
  const ui = vm.runInContext('new UIManager()', S);
  const ctx = ui.compassCtx;
  let marks = [];
  const realText = ctx.fillText.bind(ctx);
  ctx.fillText = (t, x, y) => { marks.push([t, x]); return realText(t, x, y); };
  ui.setCompassVisible(true);
  const layout = (yaw) => { marks = []; ui._compassBearing = null; ui.updateCompass(yaw); 
                            const m = {}; for (const [t, x] of marks) m[t] = x; return m; };
  const W = ui.compassTape.width, C = W / 2;
  chk(W === 252 && ui.compassTape.height === 26,
      `the tape under test is the real element's geometry (${W}x${ui.compassTape.height})`);

  {
    const m = layout(0);                                  // facing NORTH
    chk(Math.abs(m.N - C) < 0.51, `facing north, N sits dead centre (x=${m.N.toFixed(1)}, centre ${C})`);
    chk(m.E > C && m.W < C,
        `and EAST is on the RIGHT (x=${m.E.toFixed(1)}), WEST on the left (x=${m.W.toFixed(1)}) ` +
        `— the tape is not mirrored`);
    chk(m.NE > C && m.NE < m.E && m.NW < C && m.NW > m.W,
        'with NE between N and E, and NW between W and N');
  }
  {
    const m = layout(-Math.PI / 2);                        // facing EAST, as at the arrival
    chk(Math.abs(m.E - C) < 0.51,
        `facing east — the heading the instruction names — E sits dead centre (x=${m.E.toFixed(1)})`);
    chk(m.S > C && m.N < C, 'with S to the right and N to the left, which is what a real tape does');
  }
  {
    // Turning RIGHT must move the letters LEFT. Get this backwards and the instrument lies.
    const a = layout(0).N, b = layout(-0.20).N;           // yaw decreases = turning right
    chk(b < a,
        `turning right slides the tape left (N moves ${a.toFixed(1)} → ${b.toFixed(1)}) — ` +
        `the strip tracks the world, not the player`);
  }
  {
    // Nothing may be drawn that is not a heading mark: no landmark labels, ever.
    const allowed = new Set(['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW']);
    let stray = [];
    for (let d = 0; d < 360; d += 11) {
      for (const [t] of (layout(d * Math.PI / 180), marks)) if (!allowed.has(t)) stray.push(t);
    }
    chk(stray.length === 0,
        'across 33 headings the tape draws nothing but the eight compass points' +
        (stray.length ? ' — stray: ' + [...new Set(stray)].join(', ') : ''));
  }
}

// =====================================================================================
// 6. COST — REQUIREMENT 21 ASKS FOR A MEASUREMENT, NOT AN ASSURANCE
// =====================================================================================
{
  const ui = vm.runInContext('new UIManager()', S);
  // Count real draw calls through the harness canvas stub, so "it repaints" is observed
  // rather than assumed.
  let strokes = 0, fills = 0;
  const ctx = ui.compassCtx;
  const wrap = (name, counter) => { const f = ctx[name].bind(ctx); ctx[name] = (...a) => { counter(); return f(...a); }; };
  wrap('stroke', () => strokes++); wrap('fill', () => fills++); wrap('fillText', () => fills++);

  ui.setCompassVisible(true);
  ui.updateCompass(0);
  const firstStrokes = strokes, firstFills = fills;
  chk(firstStrokes > 0 && firstFills > 0,
      `a repaint draws the tape: ${firstStrokes} stroke passes, ${firstFills} fills/labels`);

  // THE GATE: standing perfectly still must repaint nothing at all.
  for (let i = 0; i < 600; i++) ui.updateCompass(0);
  chk(strokes === firstStrokes && fills === firstFills,
      'and 600 further frames at an unchanged heading repaint NOTHING — the gate holds');

  /* A sub-pixel twitch is ignored; a real turn is not. Both are taken ACROSS THE
     0/360 SEAM — yaw 0 is due north, so bearing 0 and bearing 2π-0.003 are 0.17°
     apart in the world and 359.8 apart as plain numbers. A gate that subtracts
     without wrapping repaints forever right where a player is most likely to stand. */
  ui.updateCompass(0.003);          // 0.17° west of north, across the seam
  chk(strokes === firstStrokes,
      'a 0.17° twitch ACROSS THE NORTH SEAM is below the half-pixel threshold and is ignored');
  for (let i = 0; i < 300; i++) ui.updateCompass((i % 2) ? 0.002 : -0.002);
  chk(strokes === firstStrokes,
      'and 300 frames of jitter either side of due north repaint nothing');
  ui.updateCompass(0.05);
  chk(strokes > firstStrokes, 'while a 2.9° turn does repaint');

  // Hidden: no work at all, whatever the heading does.
  ui.setCompassVisible(false);
  const before = strokes + fills;
  for (let i = 0; i < 600; i++) ui.updateCompass(Math.random() * 6.28);
  chk(strokes + fills === before,
      'and with the compass unearned, 600 frames of arbitrary heading cost nothing');

  // Wall-clock, for the record. A repaint is forced every frame here (worst case).
  ui.setCompassVisible(true);
  const N = 20000;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) ui.updateCompass(i * 0.01);
  const per = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  console.log(`      worst-case cost: ${(per * 1000).toFixed(1)} µs per FORCED repaint ` +
              `(${(per / 16.7 * 100).toFixed(3)}% of a 60fps frame); a still player pays a ` +
              `single float compare`);
  chk(per < 0.35,
      `the compass is cheap even when repainting every frame (${per.toFixed(4)} ms/frame)`);
}

console.log(`\n${fail === 0 ? 'ALL COMPASS / GUIDANCE CHECKS PASS' : fail + ' FAILURES'}`);
process.exit(fail ? 1 : 0);
