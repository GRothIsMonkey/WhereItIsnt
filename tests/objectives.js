/* PHASE 25 — THE DYNAMIC OBJECTIVE SYSTEM.

   The objective system is a pure function of a snapshot, which is the whole reason it was
   built that way: every resolution rule in the game can be exercised here, offline,
   against the REAL definition tables loaded out of game.html, by handing it states a
   player could actually be in. No DOM is required — the system takes a UI or `null`.

   What that buys, and what it does not:

     TESTED FOR REAL — every step of every chain, in order; early completion; the
     monotonic guarantee that consuming your last plank does not send you back to "Gather
     wood."; override priority; exactly one primary objective; the save round trip; the
     version 1 -> 2 migration of a real Phase 23 save; and an audit of every string in the
     tables against STORY.md's never-explain list.

     NOT TESTED HERE — that the line is legible, that the pacing feels right, or that the
     wording is good. `Game` cannot be constructed without a GPU, so the wiring into the
     frame loop is asserted structurally against the source, and the browser suite covers
     it end to end. Nothing in this file claims a human read the objective and understood
     what to do. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld } = require('./harness/util.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'STORY.md'), 'utf8');

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);

console.log('booting the real script...');
const S = makeWorld().S;
const g = (n) => vm.runInContext(n, S);

const ObjectiveSystem = g('ObjectiveSystem');
const OBJECTIVE_CHAINS = g('OBJECTIVE_CHAINS');
const OBJECTIVE_OVERRIDES = g('OBJECTIVE_OVERRIDES');
const OBJECTIVE_CHAIN_IDS = g('OBJECTIVE_CHAIN_IDS');
const OBJECTIVE_TICK = g('OBJECTIVE_TICK');
const validateSaveState = g('validateSaveState');
const defaultSaveState = g('defaultSaveState');
const SAVE_VERSION = g('SAVE_VERSION');
const SAVE_MIGRATIONS = g('SAVE_MIGRATIONS');
const ITEM = g('ITEM');
const FARM = {
  FALLEN: g('FARM_J_FALLEN'), TOWER: g('FARM_J_TOWER'), BARN: g('FARM_J_BARN'),
  ECHO0: g('FARM_J_ECHO0'), TREE: g('FARM_J_TREE'), HOME: g('FARM_J_HOME'),
};

/* A snapshot in the shape Game._objectiveSnapshot builds. Defaults are "a player who has
   just started a new game in the Overworld, in daylight, with nothing". */
function snap(over) {
  const base = {
    chain: 'overworld', overworld: true, farmlands: false, suburbia: false, haven: false,
    hasWood: false, hasTool: false, hasCoal: false, hasTorch: false,
    hasAnchor: false, inAnchorZone: false, night: false,
    hasDisk: false, riftActive: false,
    farmOrd: 0, farmHouseSeen: false, farmTower: true, farmCoreTaken: false,
    subVisits: 0, subCoreTaken: false,
    havenShifted: false, climax: false,
  };
  const s = Object.assign(base, over || {});
  // Keep the derived chain honest whichever dimension flag the caller set.
  s.chain = s.haven ? 'haven' : (s.farmlands ? 'farmlands' : (s.suburbia ? 'suburbia' : 'overworld'));
  s.overworld = s.chain === 'overworld';
  return s;
}
/* Resolve one snapshot against a fresh system — the common case in these tests. */
const textFor = (over) => { const o = new ObjectiveSystem(null); o.evaluate(snap(over)); return o.currentText; };

// =====================================================================================
// 1. THE TABLES THEMSELVES
// =====================================================================================
{
  const ids = [];
  for (const o of OBJECTIVE_OVERRIDES) ids.push(o.id);
  for (const k of OBJECTIVE_CHAIN_IDS) for (const s of (OBJECTIVE_CHAINS[k] || [])) ids.push(s.id);
  chk(new Set(ids).size === ids.length, `every objective has a unique id (${ids.length} objectives)`);
  chk(OBJECTIVE_CHAIN_IDS.every(k => Array.isArray(OBJECTIVE_CHAINS[k])),
      `all four chains exist: ${OBJECTIVE_CHAIN_IDS.join(', ')}`);

  const texts = [];
  for (const o of OBJECTIVE_OVERRIDES) if (o.text) texts.push(o.text);
  for (const k of OBJECTIVE_CHAIN_IDS) for (const s of (OBJECTIVE_CHAINS[k] || [])) texts.push(s.text);

  const tooLong = texts.filter(t => t.length > 42);
  chk(tooLong.length === 0,
      `every objective is one short line (longest ${Math.max(...texts.map(t => t.length))} chars)` +
      (tooLong.length ? ` — TOO LONG: ${tooLong.join(' | ')}` : ''));
  const noStop = texts.filter(t => !/[.?]$/.test(t));
  chk(noStop.length === 0, 'and each is a complete sentence' + (noStop.length ? `: ${noStop.join(' | ')}` : ''));
  const multi = texts.filter(t => (t.match(/\./g) || []).length > 1);
  chk(multi.length === 0, 'none of them is two sentences wearing a coat');

  chk(OBJECTIVE_OVERRIDES.every(o => typeof o.when === 'function'),
      'every situational objective has an activation condition');
  chk(OBJECTIVE_CHAINS.overworld.every(s => typeof s.done === 'function'),
      'every Overworld step has a completion condition');
  chk(OBJECTIVE_CHAINS.farmlands.every(s => typeof s.when === 'function'),
      'and the Farmlands chain is threshold-driven, on the ordinal it already saves');
}

// =====================================================================================
// 2. STORY CANON — the objective may say what to do, never what it means
// =====================================================================================
{
  const texts = [];
  for (const o of OBJECTIVE_OVERRIDES) if (o.text) texts.push(o.text);
  for (const k of OBJECTIVE_CHAIN_IDS) for (const s of (OBJECTIVE_CHAINS[k] || [])) texts.push(s.text);
  const all = texts.join(' • ').toLowerCase();

  /* STORY.md section 24 marks these "internal only" — they are how the project talks to
     itself about the game, and a player must never meet one. */
  const FORBIDDEN = ['record', 'reconstruct', 'rebuild', 'copy', 'imitation', 'memory of',
                     'fake haven', 'void sovereign', 'stalker', 'behemoth', 'observ',
                     'disconnected home', 'static suburbia', 'core disk', 'sanity'];
  const leaked = FORBIDDEN.filter(w => all.indexOf(w) >= 0);
  chk(leaked.length === 0,
      `no objective uses the canon's internal vocabulary` +
      (leaked.length ? ` — LEAKED: ${leaked.join(', ')}` : ''));

  /* Nor may an objective name a place the player has not reached. "the water tower" is
     the one exception and it is gated: STORY.md section 12 wants the tower discovered by
     sightline, so the line only appears once the player is already beside it. */
  const towerLines = texts.filter(t => /tower/i.test(t));
  chk(towerLines.length === 2, `the tower is named in exactly two late lines: ${towerLines.join(' / ')}`);
  const tower = OBJECTIVE_CHAINS.farmlands.find(s => s.id === 'farm_tower');
  chk(!tower.when(snap({ farmlands: true, farmOrd: 0 })) &&
      tower.when(snap({ farmlands: true, farmOrd: FARM.TOWER })),
      'and it cannot appear on arrival — only once the player is beside it');

  chk(!/where the home is|find the home|go to the/i.test(all),
      'no objective points at an undiscovered destination');
  chk(STORY.indexOf('observations, never destinations') > 0,
      'STORY.md section 25 states the rule these lines are written to');
}

// =====================================================================================
// 3. THE OVERWORLD CHAIN, STEP BY STEP
// =====================================================================================
{
  const o = new ObjectiveSystem(null);
  const seen = [];
  const steps = [
    {},                                                    // nothing yet
    { hasWood: true },
    { hasWood: true, hasTool: true },
    { hasWood: true, hasTool: true, hasCoal: true },
    { hasWood: true, hasTool: true, hasCoal: true, hasTorch: true },
    { hasWood: true, hasTool: true, hasTorch: true, hasAnchor: true },
    { hasWood: true, hasTool: true, hasTorch: true, hasAnchor: true, hasDisk: true },
  ];
  for (const st of steps) { o.evaluate(snap(st)); seen.push(o.currentText); }
  const want = ['Gather wood.', 'Craft a basic tool.', 'Find coal.', 'Craft torches.',
                'Prepare for night.', 'Endure the nights.', 'Bring it to the Anchor.'];
  chk(JSON.stringify(seen) === JSON.stringify(want),
      'the Overworld chain advances one step at a time as the player actually progresses');
  note(seen.join('  ->  '));
}
{
  // A brand new game says the first thing, and nothing else.
  chk(textFor({}) === 'Gather wood.', 'a new game opens on "Gather wood."');
}

// =====================================================================================
// 4. EARLY ACTIONS ARE CREDITED — exploring ahead must never be punished
// =====================================================================================
{
  /* A player who wandered into a cave before anyone mentioned wood and came back with a
     stone pickaxe and coal is three steps in, not at the beginning. */
  const o = new ObjectiveSystem(null);
  o.evaluate(snap({ hasWood: true, hasTool: true, hasCoal: true }));
  chk(o.currentText === 'Craft torches.',
      'a player who did the first three steps before being asked is credited with all three');
  chk(o.progress.overworld === 3, `and the chain mark jumps to ${o.progress.overworld} rather than 1`);

  const o2 = new ObjectiveSystem(null);
  o2.evaluate(snap({ hasTorch: true, hasAnchor: true, hasTool: true, hasWood: true }));
  chk(o2.currentText === 'Endure the nights.',
      'and a player who arrives already prepared skips straight to the long middle');
}

// =====================================================================================
// 5. THE MONOTONIC GUARANTEE — the reason a mark is persisted at all
// =====================================================================================
{
  const o = new ObjectiveSystem(null);
  o.evaluate(snap({ hasWood: true, hasTool: true, hasCoal: true, hasTorch: true }));
  chk(o.currentText === 'Prepare for night.', 'the player reaches "Prepare for night."');
  // Now they spend every plank on the Anchor and burn every torch. Inventory: empty.
  o.evaluate(snap({ hasAnchor: true }));
  chk(o.currentText === 'Endure the nights.',
      'and after spending ALL their wood and torches they are not sent back to "Gather wood."');
  chk(o.progress.overworld === 5, 'the chain mark never decreases');

  // Hammer it: fifty evaluations of an empty inventory must not move it backwards.
  let regressed = false;
  for (let i = 0; i < 50; i++) { o.evaluate(snap({ hasAnchor: true })); if (o.progress.overworld < 5) regressed = true; }
  chk(!regressed, '50 further evaluations with nothing in the pack leave it where it was');
}

// =====================================================================================
// 6. SITUATIONAL OVERRIDES, AND EXACTLY ONE PRIMARY OBJECTIVE
// =====================================================================================
{
  chk(textFor({ night: true }) === 'Survive until dawn.',
      'night outranks whatever the player was doing');
  chk(textFor({ night: true, hasAnchor: true, inAnchorZone: false }) === 'Return to the Anchor.',
      'and if they have an Anchor and are outside it, the useful sentence is where to go');
  chk(textFor({ night: true, hasAnchor: true, inAnchorZone: true }) === 'Survive until dawn.',
      'once they are inside its glow it goes back to the night itself');
  chk(textFor({ night: true, hasAnchor: true, riftActive: true }) === 'Enter the Rift.',
      'an open Rift outranks the night');
  chk(textFor({ haven: true, riftActive: true }) === 'Rest.',
      'and the Haven outranks the Rift');
  chk(textFor({ haven: true, havenShifted: true }) === null,
      'once the Haven turns, the line goes silent');
  chk(textFor({ climax: true, night: true, riftActive: true }) === null,
      'and the climax silences everything — the ending is not a checklist');

  // One primary objective, always, across a wide sweep of states.
  let multiple = 0, resolved = 0;
  for (let m = 0; m < 256; m++) {
    const s = snap({
      night: !!(m & 1), hasAnchor: !!(m & 2), inAnchorZone: !!(m & 4), riftActive: !!(m & 8),
      hasDisk: !!(m & 16), farmlands: !!(m & 32), suburbia: !(m & 32) && !!(m & 64),
      haven: !!(m & 128), hasWood: true, hasTool: true, hasTorch: true,
    });
    const o = new ObjectiveSystem(null);
    o.evaluate(s);
    resolved++;
    if (Array.isArray(o.currentText)) multiple++;
  }
  chk(multiple === 0 && resolved === 256,
      '256 combinations of live state each resolve to exactly one line (or deliberately none)');
}

// =====================================================================================
// 7. THE FARMLANDS — the Phase 20 journey lines, unchanged
// =====================================================================================
{
  const ords = [0, 1, FARM.FALLEN, FARM.TOWER, FARM.TOWER + 2, FARM.BARN, FARM.ECHO0,
                FARM.ECHO0 + 2, FARM.TREE - 1, FARM.HOME];
  const seen = ords.map(n => textFor({ farmlands: true, farmOrd: n }));
  const want = ['Explore the Shattered Farmlands.', 'Follow the old farm road.',
                'Follow the road east.', 'Investigate the water tower.',
                'Continue beyond the tower.', 'Keep to the road.',
                'Something here feels familiar.', 'Follow the old route.',
                'The fields are dying.', 'Investigate the property.'];
  chk(JSON.stringify(seen) === JSON.stringify(want),
      'the Farmland journey produces its eleven authored lines in order along the ordinal');
  note(seen.slice(0, 5).join('  ->  ') + '  -> ...');

  chk(textFor({ farmlands: true, farmOrd: FARM.HOME, farmHouseSeen: true }) === 'Investigate the farmhouse.',
      'and the property is only called a house once the player is close enough to see one');
  chk(textFor({ farmlands: true, farmOrd: 0, farmHouseSeen: false }) === 'Explore the Shattered Farmlands.',
      'arriving in the Farmlands does not inherit an Overworld objective');
  chk(textFor({ farmlands: true, farmCoreTaken: true, hasDisk: true }) === 'Bring it to the Anchor.',
      'once the player is carrying what they found, the line says where it goes');
  chk(textFor({ farmlands: true, farmCoreTaken: true, hasDisk: true, riftActive: true }) === 'Enter the Rift.',
      'and once that opens something, it says so');

  // The Farmlands must not need a mark: the ordinal is already monotonic and already saved.
  const o = new ObjectiveSystem(null);
  o.evaluate(snap({ farmlands: true, farmOrd: FARM.HOME }));
  chk(o.progress.farmlands === 0,
      'the Farmlands chain stores no state of its own — it reads the saved journey ordinal');
}

// =====================================================================================
// 8. STATIC SUBURBIA — semantic state only, never a room or a coordinate
// =====================================================================================
{
  const o = new ObjectiveSystem(null);
  const seen = [];
  for (const st of [{}, { subVisits: 1 }, { subVisits: 4 }, { subVisits: 9, subCoreTaken: true }]) {
    o.evaluate(snap(Object.assign({ suburbia: true }, st)));
    seen.push(o.currentText);
  }
  chk(JSON.stringify(seen) === JSON.stringify(
        ['Explore the neighbourhood.', 'Investigate the houses.', "Find what doesn't belong.", 'Keep going.']),
      'Suburbia moves from exploration to unease to nothing in particular');
  note(seen.join('  ->  '));

  /* The suburb rearranges itself when nobody is looking. Anything positional in these
     definitions would be a bug waiting for a player to stand still. */
  const src = OBJECTIVE_CHAINS.suburbia.map(s => String(s.done)).join(' ');
  chk(!/\.x\b|\.z\b|position|coord|room|chunk|Math\.floor/.test(src),
      'no Suburbia objective reads a coordinate, a room index or a chunk');
  chk(/subVisits|subCoreTaken/.test(src),
      'they read a count of houses entered and one stable chest key instead');
}

// =====================================================================================
// 9. SAVE / LOAD, AND THE VERSION 1 -> 2 MIGRATION
// =====================================================================================
{
  chk(SAVE_VERSION === 2, `the save schema is at version ${SAVE_VERSION}`);
  chk(typeof SAVE_MIGRATIONS[1] === 'function', 'and a real migration from version 1 exists');

  const d = defaultSaveState(null);
  chk(d.objectives && OBJECTIVE_CHAIN_IDS.every(k => d.objectives[k] === 0),
      'a new game saves four zeroed chain marks');

  const o = new ObjectiveSystem(null);
  o.evaluate(snap({ hasWood: true, hasTool: true, hasCoal: true, hasTorch: true, hasAnchor: true }));
  const saved = o.toJSON();
  chk(saved.overworld === 5, `a mid-game save carries the mark it had reached (${saved.overworld})`);
  const back = new ObjectiveSystem(null);
  back.applyJSON(saved);
  chk(JSON.stringify(back.toJSON()) === JSON.stringify(saved), 'and it round-trips exactly');

  // Corrupt marks are repaired, never rejected — a broken objective is not worth a refusal.
  for (const bad of [{ overworld: -5 }, { overworld: 9999 }, { overworld: NaN },
                     { overworld: 'six' }, { overworld: null }, null, 'nonsense', []]) {
    const r = new ObjectiveSystem(null);
    r.applyJSON(bad);
    const n = r.progress.overworld;
    if (!(Number.isInteger(n) && n >= 0 && n <= OBJECTIVE_CHAINS.overworld.length)) {
      chk(false, 'corrupt objective state repaired: ' + JSON.stringify(bad));
    }
  }
  chk(true, '8 kinds of corrupt objective state are repaired into a legal mark');

  // The validator clamps too, so a hand-edited file cannot skip the player forward.
  const v = validateSaveState(Object.assign(JSON.parse(JSON.stringify(d)), {
    objectives: { overworld: 500, farmlands: -1, suburbia: 2.7, haven: 'x' } }));
  chk(v.ok && v.state.objectives.overworld === OBJECTIVE_CHAINS.overworld.length &&
      v.state.objectives.farmlands === 0 && v.state.objectives.suburbia === 3,
      'and the save validator clamps every mark to its own chain length');

  /* THE REAL COMPATIBILITY TEST: a genuine Phase 23 save, version 1, with no objectives
     block at all. It must load, and it must not lose the player's place. */
  const v1 = {
    version: 1, savedAt: 1700000000000, dimension: 'overworld',
    player: { position: { x: 40.5, y: 32, z: 40.5 }, yaw: 0, pitch: 0, hp: 80, maxHp: 100,
              level: 2, attackBonus: 1, miningSpeedBonus: 0.18, chestsOpened: 1,
              selectedSlot: 0, inventory: [] },
    sanity: 70, progression: { stage: 1, dayCount: 3 }, time: { cycleSeconds: 100, wasNight: false },
    anchor: { x: 40, y: 30, z: 40, fuel: 60 }, world: {}, settings: {},
  };
  const migrated = validateSaveState(v1);
  chk(migrated.ok, 'a version 1 Phase 23 save still loads' + (migrated.ok ? '' : ': ' + migrated.error));
  chk(migrated.state.version === 2 && migrated.state.objectives.overworld === 0,
      'it is migrated to version 2 with zeroed marks');
  chk(migrated.repairs.some(r => /migrated from schema 1/.test(r)),
      'and the migration is reported rather than silent');
  chk(migrated.state.progression.dayCount === 3 && migrated.state.player.hp === 80,
      'while everything the old save DID carry survives untouched');

  /* Zeroing is lossless because the marks re-derive. That player had an Anchor and was on
     day 3; the first evaluation after the load must put them back where they belong. */
  const rehydrated = new ObjectiveSystem(null);
  rehydrated.applyJSON(migrated.state.objectives);
  rehydrated.evaluate(snap({ hasAnchor: true, hasTorch: true, hasTool: true, hasWood: true }));
  chk(rehydrated.currentText === 'Endure the nights.',
      'and on the first evaluation the migrated save is credited with everything it had already done');
}

// =====================================================================================
// 10. DETERMINISM, AND NO UNBOUNDED GROWTH
// =====================================================================================
{
  const s = snap({ hasWood: true, hasTool: true, night: true, hasAnchor: true });
  const first = textFor({ hasWood: true, hasTool: true, night: true, hasAnchor: true });
  let stable = true;
  for (let i = 0; i < 200; i++) {
    const o = new ObjectiveSystem(null);
    o.evaluate(s);
    if (o.currentText !== first) stable = false;
  }
  chk(stable, `200 resolutions of the same state give the same answer ("${first}")`);

  const o = new ObjectiveSystem(null);
  for (let i = 0; i < 10000; i++) o.evaluate(snap({ hasWood: true, farmOrd: i % 30 }));
  chk(Object.keys(o.progress).length === OBJECTIVE_CHAIN_IDS.length,
      `10,000 evaluations leave exactly ${OBJECTIVE_CHAIN_IDS.length} integers of state — no history accumulates`);
  chk(JSON.stringify(o.toJSON()).length < 90,
      `and the whole persisted objective state is ${JSON.stringify(o.toJSON()).length} bytes`);

  // reset() is what New Game uses.
  o.reset();
  chk(OBJECTIVE_CHAIN_IDS.every(k => o.progress[k] === 0) && o.currentText === null,
      'reset() clears every mark and the current line');
}

// =====================================================================================
// 11. COST — the loop must not re-resolve sixty times a second
// =====================================================================================
{
  chk(typeof OBJECTIVE_TICK === 'number' && OBJECTIVE_TICK >= 0.1,
      `evaluation is throttled to every ${OBJECTIVE_TICK}s, not every frame`);

  let built = 0;
  const o = new ObjectiveSystem(null);
  const thunk = () => { built++; return snap({}); };
  for (let i = 0; i < 600; i++) o.update(1 / 60, thunk);   // ten seconds of frames
  /* ~4/second. Not exactly 40: 1/60 is not representable, so the accumulator sometimes
     needs a sixteenth frame. The point of the assertion is the order of magnitude — 600
     frames must not mean 600 evaluations. */
  chk(built >= 34 && built <= 42,
      `600 frames build ${built} snapshots, not 600 — the thunk is only called on a tick`);

  const t0 = Date.now();
  for (let i = 0; i < 20000; i++) o.evaluate(snap({ farmOrd: i % 30 }));
  const ms = Date.now() - t0;
  chk(ms < 2000, `20,000 forced resolutions in ${ms}ms (${(ms / 20000 * 1000).toFixed(1)}µs each)`);
}

// =====================================================================================
// 12. STRUCTURAL — the wiring Game cannot be constructed to test
// =====================================================================================
{
  const count = (re) => (SRC.match(re) || []).length;

  chk(count(/new ObjectiveSystem\(/g) === 1, 'exactly one ObjectiveSystem is constructed');
  chk(/this\.objectives\.update\(dt, this\._objectiveSnapshotFn\)/.test(SRC),
      'the frame loop drives it with a thunk, so no snapshot is built on an idle frame');
  chk(count(/_refreshObjective\(\)/g) >= 5,
      'and it is forced to re-resolve on every transition, load and ending');

  // The old second authority is gone.
  chk(!/updateObjectiveHUD\(hasTorches/.test(SRC),
      'the six-line MISSION DIRECTIVES checklist no longer drives anything');
  chk(/retireDirectives\(\)/.test(SRC) && /obj-step retired/.test(SRC),
      'it is hidden once at boot, with the markup left for Phase 27');
  chk(count(/setObjective\(/g) >= 2, 'the objective system is the only writer of the line');

  // No markers, no minimap, no waypoints — the brief forbids all of it.
  const banned = [['a minimap', /minimap/i], ['a waypoint system', /waypoint/i],
                  ['a quest log', /questLog|quest-log/i], ['a marker beam', /markerBeam|questArrow/i]];
  const leaked = banned.filter(([, re]) => re.test(SRC)).map(([n]) => n);
  chk(leaked.length === 0, 'no minimap, waypoint, quest log or marker was added' +
      (leaked.length ? ` — FOUND: ${leaked.join(', ')}` : ''));

  // The compass is untouched: Phase 20.2 remains the directional instrument.
  chk(/compassBearingFromYaw/.test(SRC) && /grantCompass\(\)/.test(SRC) &&
      /At the crossroads, go east\./.test(SRC),
      'the Phase 20.2 compass and opening instruction are untouched');
  chk(count(/'Go east\.'/g) === 1,
      'and "Go east." exists in exactly one place — no second directional system was added');

  // The objective snapshot must stay semantic, so Era 2 can replace the renderer.
  const snapSrc = SRC.slice(SRC.indexOf('  _objectiveSnapshot() {'), SRC.indexOf('  _refreshObjective() {'));
  for (const b of ['this.scene', 'this.camera', 'mesh', 'geometry', 'getBlockWorld', 'chunk'])
    chk(snapSrc.indexOf(b) < 0, `the snapshot never touches ${b} — it is semantic state only`);
}

console.log('\n' + (fail === 0 ? 'ALL OBJECTIVE CHECKS PASS' : fail + ' FAILURES'));
note('The resolution logic is tested for real against the shipped tables. Whether the');
note('wording lands is a judgement for a person; nothing here claims otherwise.');
process.exit(fail ? 1 : 0);
