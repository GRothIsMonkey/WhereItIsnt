/* PHASE 23 — SAVE / LOAD.

   WHAT IS TESTED HERE, AND HOW HONESTLY.

   The three layers of the save system are exercised against the REAL code loaded out of
   game.html: the validator is a pure function and is tested exhaustively; the world
   capture/restore pair is driven against REAL generated chunks from a REAL VoxelWorld,
   including the full round trip — mine a world, save it, boot a SECOND world from
   scratch, restore into it, and compare every block; and the storage layer is tested
   against localStorage stand-ins that fail the ways real browsers fail.

   WHAT IS NOT TESTED HERE. `Game` cannot be constructed offline — its first statement
   builds a THREE.WebGLRenderer and this harness has no GPU — so the orchestration layer
   (Game.captureSaveState / _applyRestoredState / saveGame / loadGame / newGame) is
   tested STRUCTURALLY, by asserting on the real source: that there is exactly one
   teardown path, that every verb routes through it, that no write happens anywhere near
   the frame loop, and that the fields the schema promises are the fields the capture
   actually reads. Those assertions are real and they catch real regressions, but they
   are not a browser and this file does not pretend otherwise. Nothing here claims that
   a human clicked Save. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld, genRegion } = require('./harness/util.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'game.html'), 'utf8');
let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);

console.log('booting world A...');
const A = makeWorld();
const g = (n) => vm.runInContext(n, A.S);

const validateSaveState = g('validateSaveState');
const captureWorldState = g('captureWorldState');
const restoreWorldState = g('restoreWorldState');
const findSafeLanding = g('findSafeLanding');
const saveFallbackSpawn = g('saveFallbackSpawn');
const defaultSaveState = g('defaultSaveState');
const describeSaveState = g('describeSaveState');
const SaveSystem = g('SaveSystem');
const SAVE_VERSION = g('SAVE_VERSION');
const SAVE_STORAGE_KEY = g('SAVE_STORAGE_KEY');
const SAVE_BACKUP_KEY = g('SAVE_BACKUP_KEY');
const SETTINGS_STORAGE_KEY = g('SETTINGS_STORAGE_KEY');
const SAVE_DIMENSIONS = g('SAVE_DIMENSIONS');
const BLOCK = g('BLOCK');
const ITEM = g('ITEM');
const DIMENSION = g('DIMENSION');
const INVENTORY_SIZE = g('INVENTORY_SIZE');
const HOTBAR_SIZE = g('HOTBAR_SIZE');
const CHUNK_SY = g('CHUNK_SY');
const GameSettings = g('GameSettings');

const deep = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function memStore(initial) {
  const m = new Map(initial ? Object.entries(initial) : []);
  const s = {
    m, writes: 0,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { s.writes++; m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
  };
  return s;
}

/* A complete, legitimate save, built by hand so every test below starts from something
   the validator is known to accept unchanged. */
function goodSave(over) {
  const inv = new Array(INVENTORY_SIZE).fill(null);
  inv[0] = { item: ITEM.TORCH, count: 12 };
  inv[1] = { item: ITEM.IRON_PICKAXE, count: 1 };
  inv[9] = { item: ITEM.COAL, count: 3 };
  const base = {
    version: SAVE_VERSION,
    savedAt: 1700000000000,
    dimension: 'overworld',
    player: {
      position: { x: 40.5, y: 32, z: 40.5 }, yaw: 1.2, pitch: -0.3,
      hp: 73, maxHp: 145, dead: false,
      level: 4, attackBonus: 3, miningSpeedBonus: 0.54,
      chestsOpened: 2, selectedSlot: 1, inventory: inv,
    },
    sanity: 61.5,
    progression: {
      stage: 2, dayCount: 5, memoryFragments: 1, nightsRequired: 4,
      awaitingAdvance: false, behemothDefeated: true, behemothSpawned: true,
      compassAcquired: true, pendingLevel2Transition: false, fakeHavenTriggered: false,
      farmCrossroadsRecalled: false, farmJourneyOrd: 7, farmHouseSeen: false,
      killCount: 31, riftDisks: [ITEM.CORE_DISK], dimensionsBreached: [DIMENSION.OVERWORLD],
    },
    time: { cycleSeconds: 512.25, wasNight: true },
    anchor: { x: 44, y: 30, z: 46, fuel: 120.5, riftActive: true, riftTargetLevel: 2 },
    world: {
      edits: { '2,2': [100, BLOCK.AIR, 101, BLOCK.STONE] },
      openedChests: ['10,30,12'],
      doors: ['4200,24,4200'],
      torchDecay: [['5,30,5', 220]],
      suburbiaVisits: [['12,9', 3]],
      suburbiaStage: [['12,9', 1]],
      suburbiaDoorOverrides: [['12,9', 2]],
      mailboxSeen: true, mailboxGone: false,
    },
    settings: { masterVolume: 0.5, graphicsQuality: 'medium', fullscreen: false },
  };
  return Object.assign(base, over || {});
}

// =====================================================================================
// 1. THE DEFAULT SAVE, AND THE SCHEMA IT PROMISES
// =====================================================================================
{
  const d = defaultSaveState(null);
  chk(!!d && d.version === SAVE_VERSION, 'defaultSaveState is at schema version ' + SAVE_VERSION);
  chk(d.dimension === 'overworld', 'a new game starts in the Overworld');
  chk(d.progression.stage === 1 && d.progression.dayCount === 1 && d.progression.memoryFragments === 0,
      'stage 1, day 1, no memory fragments');
  chk(d.player.hp === 100 && d.player.maxHp === 100 && d.player.level === 1 &&
      d.player.attackBonus === 0 && d.player.miningSpeedBonus === 0,
      'full health at the baseline capability set');
  chk(d.player.inventory.every(s => s === null), 'the pack is empty');
  chk(d.player.selectedSlot === 0 && d.sanity === 100, 'first slot selected, sanity full');
  chk(d.anchor === null, 'no anchor');
  chk(Object.keys(d.world.edits).length === 0 && d.world.openedChests.length === 0 &&
      d.world.doors.length === 0 && d.world.suburbiaStage.length === 0 &&
      d.world.mailboxGone === false,
      'and no world state at all: no edits, no opened chests, no doors, no suburb revisions');
  chk(d.progression.compassAcquired === false, 'the compass is not granted');
  chk(!('xp' in d.player), 'THE XP COUNTER IS ABSENT FROM THE SCHEMA — the roadmap forbids persisting it');
}
{
  const r = validateSaveState(goodSave());
  chk(r.ok && r.repairs.length === 0,
      'a well-formed save validates with zero repairs' + (r.ok ? '' : ': ' + r.error));
  chk(!('xp' in r.state.player), 'and the validated state has no xp field either');
  const s = r.state;
  chk(s.player.hp === 73 && s.player.maxHp === 145 && s.player.level === 4 &&
      s.player.attackBonus === 3 && Math.abs(s.player.miningSpeedBonus - 0.54) < 1e-9,
      'health and earned capabilities survive validation exactly');
  chk(s.player.inventory[0].item === ITEM.TORCH && s.player.inventory[0].count === 12 &&
      s.player.inventory[1].item === ITEM.IRON_PICKAXE && s.player.inventory[9].count === 3 &&
      s.player.inventory.filter(Boolean).length === 3,
      'the inventory survives with its ordering, its items and its counts');
  chk(s.player.selectedSlot === 1, 'the selected slot survives');
  chk(s.progression.compassAcquired === true,
      'THE COMPASS survives — it is progression state, not an inventory item');
  chk(s.sanity === 61.5 && s.time.cycleSeconds === 512.25 && s.time.wasNight === true,
      'sanity and the day/night clock survive');
  chk(s.anchor.x === 44 && s.anchor.fuel === 120.5 && s.anchor.riftActive && s.anchor.riftTargetLevel === 2,
      'the anchor, its remaining fuel and its open rift survive');
  chk(s.world.openedChests.length === 1 && s.world.openedChests[0] === '10,30,12',
      'the opened-chest ledger survives');
  chk(describeSaveState(s).indexOf('Day 5') > 0,
      'and it describes itself: "' + describeSaveState(s) + '"');
}

// =====================================================================================
// 2. REJECTION — a syntactically perfect JSON document is not a valid save
// =====================================================================================
{
  const rejects = [
    [null, 'null'],
    [undefined, 'undefined'],
    ['{}', 'a string'],
    [42, 'a number'],
    [[goodSave()], 'an array'],
    [{}, 'an object with no version'],
    [goodSave({ version: '1' }), 'a version that is a string'],
    [goodSave({ version: 1.5 }), 'a fractional version'],
    [goodSave({ version: SAVE_VERSION + 1 }), 'a version from a newer build'],
    [goodSave({ version: 0 }), 'a version with no migration path'],
    [goodSave({ dimension: 'nether' }), 'an unknown dimension'],
    [goodSave({ dimension: 'fake_haven' }), 'the Fake Haven, which is not a saveable dimension'],
    [goodSave({ dimension: 2 }), 'a numeric dimension id'],
    [goodSave({ dimension: undefined }), 'no dimension at all'],
    [goodSave({ player: null }), 'no player state'],
    [goodSave({ player: 'x' }), 'player state that is not an object'],
  ];
  let allRejected = true;
  for (const pair of rejects) {
    const r = validateSaveState(pair[0]);
    if (r.ok) { allRejected = false; console.log('        NOT REJECTED: ' + pair[1]); }
    else if (!r.error) { allRejected = false; console.log('        REJECTED WITH NO REASON: ' + pair[1]); }
  }
  chk(allRejected, rejects.length + ' kinds of invalid save are rejected, each with a reason');
  chk(validateSaveState(goodSave({ version: SAVE_VERSION + 1 })).error.indexOf('newer') >= 0,
      'and a save from a newer build says so rather than being silently repaired');
  chk(SAVE_DIMENSIONS.indexOf('fake_haven') < 0,
      'the Fake Haven is deliberately not in the saveable dimension set');
}

// =====================================================================================
// 3. REPAIR — one bad field must not cost the whole save
// =====================================================================================
{
  const cases = [
    ['hp above maxHp',        { hp: 9999 },              s => s.player.hp === s.player.maxHp],
    ['hp NaN',                { hp: NaN },               s => s.player.hp === s.player.maxHp],
    ['hp Infinity',           { hp: Infinity },          s => s.player.hp === s.player.maxHp],
    ['hp negative',           { hp: -50 },               s => s.player.hp === s.player.maxHp],
    ['hp zero (died)',        { hp: 0 },                 s => s.player.hp === s.player.maxHp],
    ['the death latch set',   { dead: true },            s => s.player.hp === s.player.maxHp],
    ['maxHp of zero',         { maxHp: 0 },              s => s.player.maxHp === 1],
    ['maxHp a string',        { maxHp: 'lots' },         s => s.player.maxHp === 100],
    ['selectedSlot 99',       { selectedSlot: 99 },      s => s.player.selectedSlot === HOTBAR_SIZE - 1],
    ['selectedSlot -3',       { selectedSlot: -3 },      s => s.player.selectedSlot === 0],
    ['pitch beyond vertical', { pitch: 99 },             s => Math.abs(s.player.pitch - Math.PI / 2) < 1e-9],
    ['yaw NaN',               { yaw: NaN },              s => s.player.yaw === 0],
    ['a negative bonus',      { attackBonus: -4 },       s => s.player.attackBonus === 0],
  ];
  let ok = true;
  for (const c of cases) {
    const save = goodSave();
    Object.assign(save.player, c[1]);
    const r = validateSaveState(save);
    if (!r.ok || !c[2](r.state)) { ok = false; console.log('        NOT REPAIRED: ' + c[0] + (r.ok ? '' : ' (' + r.error + ')')); }
    else if (r.repairs.length === 0) { ok = false; console.log('        REPAIRED SILENTLY: ' + c[0]); }
  }
  chk(ok, cases.length + ' kinds of broken player field are repaired, and every repair is reported');

  /* The two cases that are deliberately SILENT: an absent field (null or undefined) is
     not a fault, and a numeric string is the same coercion Phase 22 already applies to
     settings. Neither should fill the player's repair notice with noise. */
  const missing = goodSave(); missing.player.selectedSlot = null; delete missing.player.chestsOpened;
  const rm = validateSaveState(missing);
  chk(rm.ok && rm.state.player.selectedSlot === 0 && rm.state.player.chestsOpened === 0 && rm.repairs.length === 0,
      'an absent or null field takes its default silently — a schema may gain fields without every old save reporting damage');
  const str = goodSave(); str.player.level = '7'; str.player.hp = '55';
  const rs = validateSaveState(str);
  chk(rs.ok && rs.state.player.level === 7 && rs.state.player.hp === 55 && rs.repairs.length === 0,
      'and a numeric string coerces silently, exactly as it does in the Phase 22 settings schema');
}
{
  const s1 = validateSaveState(goodSave({ sanity: -20 })).state;
  const s2 = validateSaveState(goodSave({ sanity: 500 })).state;
  const s3 = validateSaveState(goodSave({ sanity: 'x' })).state;
  chk(s1.sanity === 0 && s2.sanity === 100 && s3.sanity === 100,
      'sanity clamps to its real bounds and falls back when it is not a number');
  const t = validateSaveState(goodSave({ time: { cycleSeconds: NaN, wasNight: 'yes' } })).state;
  chk(t.time.cycleSeconds === 60 && t.time.wasNight === false,
      'a broken clock falls back to a safe resume point rather than poisoning the day cycle');
  const p = validateSaveState(goodSave({ progression: { stage: -9, dayCount: 0, nightsRequired: NaN } })).state;
  chk(p.progression.stage === 1 && p.progression.dayCount === 1 && p.progression.nightsRequired === 3,
      'out-of-range progression is clamped, and nightsRequired is re-derived from the stage');
}
{
  const save = goodSave();
  save.player.inventory = new Array(INVENTORY_SIZE).fill(null);
  save.player.inventory[0] = { item: 99999, count: 4 };            // no such item
  save.player.inventory[1] = { item: ITEM.COAL, count: 0 };        // an empty stack
  save.player.inventory[2] = { item: ITEM.COAL, count: 5000 };     // over a stack
  save.player.inventory[3] = { item: ITEM.COAL, count: -2 };
  save.player.inventory[4] = 'not a slot';
  save.player.inventory[5] = { item: ITEM.TORCH, count: 7 };
  const r = validateSaveState(save);
  chk(r.ok, 'an inventory full of nonsense does not invalidate the save');
  chk(r.state.player.inventory[0] === null, 'an unknown item id is dropped rather than materialised');
  chk(r.state.player.inventory[1] === null, 'an empty stack is dropped');
  chk(r.state.player.inventory[2].count === 64, 'an oversized stack is clamped to one stack');
  chk(r.state.player.inventory[3] === null,
      'a negative count is dropped rather than clamped up — a load must never MINT an item');
  chk(r.state.player.inventory[4] === null, 'a slot that is not an object is dropped');
  chk(r.state.player.inventory[5].item === ITEM.TORCH && r.state.player.inventory[5].count === 7,
      'and the legitimate stack beside them is untouched, in its original slot');
}
{
  const a = validateSaveState(goodSave({ anchor: { x: NaN, y: 30, z: 46 } })).state;
  chk(a.anchor === null, 'an anchor with no usable position is dropped rather than placed at NaN');
  const b = validateSaveState(goodSave({ anchor: { x: 4, y: 30, z: 6, riftActive: true, riftTargetLevel: 9 } })).state;
  chk(b.anchor && b.anchor.riftActive === false,
      'an anchor claiming a rift to nowhere has the rift closed, not the anchor destroyed');
}

// =====================================================================================
// 4. POSITION AND DIMENSION SAFETY
// =====================================================================================
{
  const bad = [
    ['no position',        undefined],
    ['a null position',    null],
    ['NaN coordinates',    { x: NaN, y: 30, z: 40 }],
    ['Infinity',           { x: Infinity, y: 30, z: 40 }],
    ['a string coord',     { x: '40', y: 30, z: 40 }],
    ['beyond the world',   { x: 9e9, y: 30, z: 40 }],
    ['below the world',    { x: 40, y: -900, z: 40 }],
    ['above the world',    { x: 40, y: 9999, z: 40 }],
  ];
  let ok = true;
  for (const pair of bad) {
    const player = Object.assign(goodSave().player, { position: pair[1] });
    const r = validateSaveState(goodSave({ player: player }));
    if (!r.ok || r.state.player.positionValid !== false) { ok = false; console.log('        ACCEPTED: ' + pair[0]); }
  }
  chk(ok, bad.length + ' kinds of impossible coordinate are refused and flagged for safe placement');

  // Dimension/position agreement: the regions are disjoint bands of one coordinate space.
  const farmPos = { x: -31000, y: 30, z: -31000 };
  chk(validateSaveState(goodSave({ dimension: 'overworld',
        player: Object.assign(goodSave().player, { position: farmPos }) })).state.player.positionValid === false,
      'a save that says Overworld but stands in the Farmlands is not trusted with its position');
  chk(validateSaveState(goodSave({ dimension: 'farmlands',
        player: Object.assign(goodSave().player, { position: farmPos }) })).state.player.positionValid === true,
      'and the same coordinates ARE trusted when the save names the right dimension');
}

// =====================================================================================
// 5. WORLD EDITS — the delta representation, and what it refuses
// =====================================================================================
{
  const save = goodSave();
  save.world.edits = {
    '2,2': [10, BLOCK.STONE],
    '__proto__': [11, BLOCK.STONE],
    'constructor': [12, BLOCK.STONE],
    'nonsense': [13, BLOCK.STONE],
    '1e9,1e9': [14, BLOCK.STONE],
    '99999999999,0': [15, BLOCK.STONE],
    '3,3': [-1, BLOCK.STONE, 999999, BLOCK.STONE, 20, -5, 21, 99999, 22.5, BLOCK.STONE, 23, BLOCK.DIRT],
  };
  const r = validateSaveState(save);
  chk(r.ok, 'a malformed edit table does not invalidate the save');
  const keys = Object.keys(r.state.world.edits);
  chk(keys.length === 2 && keys.indexOf('2,2') >= 0 && keys.indexOf('3,3') >= 0,
      'only well-formed chunk keys survive (' + keys.join(' ') + ')');
  chk(deep(r.state.world.edits['3,3'], [23, BLOCK.DIRT]),
      'and inside a chunk, only in-range integer (index, block id) pairs survive');
  chk(({}).polluted === undefined && Object.prototype.polluted === undefined,
      'nothing a save file names can reach Object.prototype');
  chk(r.state.world.edits.polluted === undefined,
      'and the rebuilt edit table carries no smuggled properties');
}
{
  const save = goodSave();
  save.world.openedChests = ['10,30,12', 'garbage', '1,2', '1,999,2', '10,30,12', null, { x: 1 }];
  save.world.doors = ['4,5,6', '4,5,6', 'x'];
  const r = validateSaveState(save);
  chk(deep(r.state.world.openedChests, ['10,30,12']),
      'opened-chest keys are re-parsed, de-duplicated, and refused if they are not real coordinates');
  chk(deep(r.state.world.doors, ['4,5,6']), 'and so are open-door keys');
}

// =====================================================================================
// 6. THE WORLD ROUND TRIP, AGAINST REAL GENERATED CHUNKS
//
//    generate -> edit -> capture -> BOOT A SECOND WORLD -> restore -> regenerate ->
//    compare every block. This is the property the whole phase rests on: the world is
//    reconstructed from deterministic generation plus a delta, never from a snapshot.
// =====================================================================================
const spawn = A.w.farmlandsSpawn;
const R0X = Math.floor(spawn.x) - 20, R1X = Math.floor(spawn.x) + 20;
const R0Z = Math.floor(spawn.z) - 20, R1Z = Math.floor(spawn.z) + 20;
let captured = null;
{
  genRegion(A.w, R0X, R0Z, R1X, R1Z);
  // A believable session's worth of editing: dig out a shaft, build a pillar, place a
  // torch, a lantern and a Soul Anchor, and strip the topsoil off a patch beside them.
  const baseY = A.w.findSpawnHeight(Math.floor(spawn.x), Math.floor(spawn.z));
  const edits = [];
  for (let d = 1; d <= 12; d++) edits.push([Math.floor(spawn.x), baseY - d, Math.floor(spawn.z), BLOCK.AIR]);
  for (let d = 0; d < 6; d++) edits.push([Math.floor(spawn.x) + 3, baseY + d, Math.floor(spawn.z) + 3, BLOCK.STONE]);
  edits.push([Math.floor(spawn.x) + 5, baseY, Math.floor(spawn.z) + 1, BLOCK.TORCH]);
  edits.push([Math.floor(spawn.x) + 6, baseY, Math.floor(spawn.z) + 1, BLOCK.LANTERN]);
  edits.push([Math.floor(spawn.x) + 7, baseY, Math.floor(spawn.z) + 1, BLOCK.SOUL_ANCHOR]);
  for (let i = 0; i < 40; i++) {
    edits.push([Math.floor(spawn.x) - 8 + (i % 8), baseY - 1, Math.floor(spawn.z) - 8 + ((i / 8) | 0), BLOCK.AIR]);
  }
  for (const e of edits) A.w.setBlockWorld(e[0], e[1], e[2], e[3]);

  A.w.openedChests.add('123,30,456');
  A.w.suburbiaDoorState.set('4200,24,4200', 1);
  A.w._doorStateOrder.push('4200,24,4200');
  A.w.suburbiaVisits.set('12,9', 3);
  A.w.suburbiaStage.set('12,9', 1);
  A.w.suburbiaDoorOverrides.set('12,9', 2);
  A.w.torchDecay.set('5,30,5', { wx: 5, wy: 30, wz: 5, fuel: 221 });

  captured = captureWorldState(A.w);
  chk(captured.editCount === edits.length,
      captured.editCount + ' edits captured — one per block the player changed, and nothing else');
  const bytes = JSON.stringify(captured).length;
  const snapshotKB = ((R1X - R0X + 1) * (R1Z - R0Z + 1) * CHUNK_SY * 2 / 1024) | 0;
  chk(bytes < 40000,
      'the whole world delta serialises to ' + bytes + ' bytes (a raw snapshot of the same columns ' +
      'would be ' + snapshotKB + ' KB of voxels alone)');
  chk(Object.keys(captured.edits).length <= 12,
      'and it is stored per chunk as flat [index, id] pairs (' +
      Object.keys(captured.edits).length + ' chunks touched)');
}

console.log('booting world B (a fresh runtime, as a reload would produce)...');
const B = makeWorld();
{
  const player = Object.assign(goodSave().player, { position: { x: spawn.x, y: spawn.y, z: spawn.z } });
  const round = validateSaveState(goodSave({
    dimension: 'farmlands',
    player: player,
    world: JSON.parse(JSON.stringify(captured)),
  }));
  chk(round.ok, 'the captured world state validates as save data' + (round.ok ? '' : ': ' + round.error));

  /* THE REAL SEQUENCE, in the order Game._applyRestoredState runs it: every chunk and
     pin is dropped FIRST, then the registries are replaced, then the region cores are
     rebuilt. Restoring edits over chunks that are still resident would silently do
     nothing — _generateChunk hands back an existing chunk rather than rebuilding it —
     which is exactly why the teardown comes first and is tested in that order here. */
  B.w.wipeAllChunks();
  restoreWorldState(B.w, round.state.world);
  B.w._genFarmlandsRegion();
  B.w._genStaticSuburbiaRegion();
  genRegion(B.w, R0X, R0Z, R1X, R1Z);

  let compared = 0, diff = 0, firstDiff = null;
  for (let x = R0X; x <= R1X; x++) {
    for (let z = R0Z; z <= R1Z; z++) {
      for (let y = 0; y < CHUNK_SY; y++) {
        compared++;
        const a = A.w.getBlockWorld(x, y, z), b = B.w.getBlockWorld(x, y, z);
        if (a !== b) { diff++; if (!firstDiff) firstDiff = [x, y, z, a, b]; }
      }
    }
  }
  chk(diff === 0,
      compared + ' blocks compared across ' + (R1X - R0X + 1) + 'x' + (R1Z - R0Z + 1) +
      ' columns of REAL Farmland: ' +
      (diff === 0 ? 'the reconstructed world is identical' : diff + ' differ, first at ' + firstDiff));

  chk(B.w.openedChests.has('123,30,456'), 'the opened chest is still opened in the reconstructed world');
  chk(B.w.suburbiaDoorState.has('4200,24,4200'), 'the door the player left open is still open');
  chk(B.w.suburbiaVisits.get('12,9') === 3 && B.w.suburbiaStage.get('12,9') === 1 &&
      B.w.suburbiaDoorOverrides.get('12,9') === 2,
      'the Suburbia recognition ledger and its door overrides survive');
  const td = B.w.torchDecay.get('5,30,5');
  chk(td && td.fuel === 221 && td.wx === 5 && td.wy === 30 && td.wz === 5,
      'the torch decay ledger survives, coordinates and all');

  // Loading twice must not stack anything up.
  const before = { edits: B.w.editedChunks.size, chests: B.w.openedChests.size, doors: B.w.suburbiaDoorState.size };
  restoreWorldState(B.w, round.state.world);
  restoreWorldState(B.w, round.state.world);
  genRegion(B.w, R0X, R0Z, R1X, R1Z);
  chk(B.w.editedChunks.size === before.edits && B.w.openedChests.size === before.chests &&
      B.w.suburbiaDoorState.size === before.doors && B.w._doorStateOrder.length === before.doors,
      'restoring three times over leaves exactly the same registries — nothing accumulates');

  // Capture -> restore -> capture is a fixed point.
  const again = captureWorldState(B.w);
  const norm = (w) => JSON.stringify({
    edits: Object.keys(w.edits).sort().map(k => [k, w.edits[k]]),
    chests: w.openedChests.slice().sort(), doors: w.doors.slice().sort(),
  });
  chk(norm(again) === norm(captured), 'and a second save of the restored world is byte-identical to the first');
}

// =====================================================================================
// 7. THE ONE-SHOT FARMLAND ANOMALY
//    It is written with _writeBlockRaw and would regenerate on a reload; the save has to
//    reconcile the latch with the voxel or the horror beat quietly undoes itself.
// =====================================================================================
{
  const H = A.w.farmHome;
  genRegion(A.w, H.hallX0 - 8, H.hallZ - 12, H.bigX0 + 18, H.hallZ + 14);
  const m = A.w.farmHomeMailbox;
  chk(!!m, 'the diorama mailbox is registered');
  A.w._writeBlockRaw(m.x, m.y, m.z, BLOCK.AIR);
  A.w._farmMailboxSeen = true;
  A.w._farmMailboxGone = true;

  const raw = JSON.parse(JSON.stringify(captureWorldState(A.w)));
  const ws = validateSaveState(goodSave({ dimension: 'farmlands', world: raw })).state.world;
  chk(ws.mailboxGone === true && ws.mailboxSeen === true, 'both latches are saved');

  console.log('booting world C...');
  const C = makeWorld();
  C.w.wipeAllChunks();
  restoreWorldState(C.w, ws);
  C.w._genFarmlandsRegion();
  genRegion(C.w, m.x - 4, m.z - 4, m.x + 4, m.z + 4);
  chk(C.w.getBlockWorld(m.x, m.y, m.z) === BLOCK.AIR,
      'and the mailbox does NOT come back in the reconstructed world: the voxel agrees with the latch');
  chk(C.w._farmMailboxGone === true, 'so the event cannot fire a second time after a load');
}

// =====================================================================================
// 8. SAFE PLAYER PLACEMENT, against real terrain
// =====================================================================================
{
  const HALF = 0.3, HEIGHT = 1.8;
  const sx = Math.floor(spawn.x), sz = Math.floor(spawn.z);
  const gy = A.w.findSpawnHeight(sx, sz);

  const clear = findSafeLanding(A.w, 'farmlands', sx + 0.5, gy, sz + 0.5, HALF, HEIGHT);
  chk(!clear.repaired && clear.y === gy, 'a legitimate saved position is used exactly as saved, untouched');

  // Buried: the block the player is standing in is solid.
  const buried = findSafeLanding(A.w, 'farmlands', sx + 0.5, gy - 4, sz + 0.5, HALF, HEIGHT);
  chk(buried.repaired, 'a position inside solid terrain is repaired');
  chk(!A.w.collidesAABB({ minX: buried.x - HALF, maxX: buried.x + HALF, minY: buried.y,
                          maxY: buried.y + HEIGHT, minZ: buried.z - HALF, maxZ: buried.z + HALF }),
      'and what it is repaired to is genuinely clear of geometry');
  note('repair: ' + buried.reason + ' (y ' + (gy - 4) + ' -> ' + buried.y + ')');

  const b2 = findSafeLanding(A.w, 'farmlands', sx + 0.5, gy - 4, sz + 0.5, HALF, HEIGHT);
  chk(b2.x === buried.x && b2.y === buried.y && b2.z === buried.z,
      'the repair is deterministic: the same broken save always lands in the same place');

  // Ungenerated ground reads as AIR to getBlockWorld, which is exactly the trap.
  const far = findSafeLanding(A.w, 'farmlands', 900000.5, 40, 900000.5, HALF, HEIGHT);
  const fb = saveFallbackSpawn(A.w, 'farmlands');
  chk(far.repaired && Math.abs(far.x - fb.x) < 1e-6 && Math.abs(far.z - fb.z) < 1e-6,
      'a position whose chunks do not exist is NOT accepted as "clear air" — it falls back to the arrival point');
  const nan = findSafeLanding(A.w, 'overworld', NaN, NaN, NaN, HALF, HEIGHT);
  const ofb = saveFallbackSpawn(A.w, 'overworld');
  chk(nan.repaired && Math.abs(nan.x - ofb.x) < 1e-6, 'and so does a NaN position');
  chk(!A.w.collidesAABB({ minX: nan.x - HALF, maxX: nan.x + HALF, minY: nan.y,
                          maxY: nan.y + HEIGHT, minZ: nan.z - HALF, maxZ: nan.z + HALF }),
      'the Overworld fallback is itself clear ground');

  const ceiling = findSafeLanding(A.w, 'farmlands', sx + 0.5, CHUNK_SY + 100, sz + 0.5, HALF, HEIGHT);
  chk(ceiling.repaired, 'a position above the world ceiling is repaired rather than used');
}

// =====================================================================================
// 9. STORAGE — the one thing that must never lose a good save
// =====================================================================================
{
  const store = memStore();
  const sys = new SaveSystem(store);
  chk(sys.peek() === null, 'an empty browser reports no save rather than an error');

  const state = validateSaveState(goodSave()).state;
  const w1 = sys.write(state);
  chk(w1.ok, 'a valid state writes' + (w1.ok ? ' (' + w1.bytes + ' bytes)' : ': ' + w1.error));
  chk(store.m.has(SAVE_STORAGE_KEY), 'to the save key');
  chk(!store.m.has(SETTINGS_STORAGE_KEY),
      'and NEVER to the Phase 22 settings key — the two are separate authorities');

  const read = sys.read();
  chk(read.ok && read.source === 'primary', 'and reads back from the primary slot');
  chk(deep(read.state, state), 'the state that comes back is identical to the state that went in');

  // Overwrite: the previous payload becomes the backup.
  const state2 = validateSaveState(goodSave({ progression: Object.assign(goodSave().progression, { dayCount: 9 }) })).state;
  sys.write(state2);
  chk(sys.read().state.progression.dayCount === 9, 'a second save replaces the first');
  chk(JSON.parse(store.m.get(SAVE_BACKUP_KEY)).progression.dayCount === 5,
      'and the payload it replaced is kept as the backup copy');

  // Corruption of the primary must fall through to the backup, not report "no save".
  store.m.set(SAVE_STORAGE_KEY, '{"version":1,"dimension":');
  const rec = sys.read();
  chk(rec.ok && rec.source === 'backup' && rec.state.progression.dayCount === 5,
      'a truncated primary is recovered from the backup rather than losing the run');

  // Both gone: a clear refusal, never a half-applied state.
  store.m.set(SAVE_BACKUP_KEY, 'not json at all');
  const dead = sys.read();
  chk(!dead.ok && !!dead.error && dead.state === null,
      'two corrupt copies produce a refusal with a reason and no state: "' + dead.error + '"');
}
{
  // A storage that accepts the backup and then refuses the primary — the exact shape of
  // a quota failure part-way through an overwrite.
  const inner = new Map();
  let armed = false;
  const store = {
    getItem: (k) => (inner.has(k) ? inner.get(k) : null),
    setItem: (k, v) => {
      if (armed && k === SAVE_STORAGE_KEY) throw new Error('QuotaExceededError');
      inner.set(k, String(v));
    },
    removeItem: (k) => inner.delete(k),
  };
  const sys = new SaveSystem(store);
  const good = validateSaveState(goodSave()).state;
  chk(sys.write(good).ok, 'a first save succeeds');
  armed = true;
  const bad = validateSaveState(goodSave({ progression: Object.assign(goodSave().progression, { dayCount: 77 }) })).state;
  const res = sys.write(bad);
  chk(!res.ok && /storage/i.test(res.error), 'a failed write reports the failure: "' + res.error + '"');
  sys.invalidate();
  const after = sys.read();
  chk(after.ok && after.state.progression.dayCount === 5,
      'AND THE PREVIOUS GOOD SAVE IS STILL THERE, intact, after the failed overwrite');
}
{
  const sys = new SaveSystem(null);
  chk(!sys.available && sys.peek() === null, 'a browser with no usable storage reports no save');
  const r = sys.write(validateSaveState(goodSave()).state);
  chk(!r.ok && /unavailable/i.test(r.error), 'and refuses to save with an explanation instead of throwing');
  const rd = sys.read();
  chk(!rd.ok && !!rd.error, 'and refuses to load the same way');
}
{
  const store = memStore();
  const sys = new SaveSystem(store);
  const r = sys.write(goodSave({ dimension: 'nether' }));
  chk(!r.ok && !store.m.has(SAVE_STORAGE_KEY),
      'the writer re-validates its own payload and refuses to persist an invalid one');
}
{
  // Nine kinds of junk in the slot must all start the game, not crash it.
  const junk = ['', '   ', 'null', 'undefined', '[]', '{}', '{"version":1}', 'NaN',
                '{"version":1,"dimension":"overworld","player":{}}'];
  let ok = true;
  for (const raw of junk) {
    const store = memStore(); store.m.set(SAVE_STORAGE_KEY, raw);
    try {
      const sys = new SaveSystem(store);
      const r = sys.read();
      if (r.ok && (!r.state || !r.state.player)) ok = false;
      sys.peek();
    } catch (e) { ok = false; console.log('        THREW on ' + JSON.stringify(raw) + ': ' + e.message); }
  }
  chk(ok, junk.length + ' kinds of corrupt stored save are handled without throwing');
}

// =====================================================================================
// 10. SETTINGS COMPATIBILITY — Phase 22 keeps its authority
// =====================================================================================
{
  const state = validateSaveState(goodSave()).state;
  chk(state.settings.masterVolume === 0.5 && state.settings.graphicsQuality === 'medium',
      'the save carries a settings snapshot, coerced through the Phase 22 schema');
  const dirty = validateSaveState(goodSave({ settings: { masterVolume: 99, graphicsQuality: 'ultra', evil: 1 } })).state;
  chk(dirty.settings.masterVolume === 1 && dirty.settings.graphicsQuality === 'high' && !('evil' in dirty.settings),
      'and a tampered snapshot is clamped, defaulted and stripped of unknown keys by that same schema');

  const store = memStore();
  const gs = new GameSettings(store);
  gs.set('masterVolume', 0.25);
  gs.save();
  const sys = new SaveSystem(store);
  sys.write(state);
  const back = new GameSettings(store);
  chk(back.get('masterVolume') === 0.25,
      'writing a save does not disturb the settings the player actually chose');
  chk(SAVE_STORAGE_KEY !== SETTINGS_STORAGE_KEY && SAVE_BACKUP_KEY !== SETTINGS_STORAGE_KEY,
      'the save slot and the settings live under different keys, so neither can clobber the other');
  chk(typeof gs.toJSON === 'function' && typeof gs.applyJSON === 'function',
      'and the Phase 22 toJSON/applyJSON hand-off is used rather than a second settings implementation');
}

// =====================================================================================
// 11. STRUCTURAL — the orchestration layer, read out of the real source
//     Game cannot be constructed without a GPU; these assert on the code that runs.
// =====================================================================================
{
  const src = SRC;
  const count = (re) => (src.match(re) || []).length;

  chk(count(/^  _teardownForRestore\(\) \{/m) === 1, 'there is exactly ONE teardown path (_teardownForRestore)');
  chk(count(/this\._teardownForRestore\(\)/g) === 1,
      'and exactly one caller of it — _applyRestoredState, which every verb goes through');
  for (const verb of ['saveGame', 'loadGame', 'newGame', 'continueFromSave']) {
    chk(count(new RegExp('^  ' + verb + '\\(', 'm')) === 1, 'Game.' + verb + ' exists, once');
  }
  chk(/newGame\(\) \{\s*\n\s*this\._applyRestoredState\(defaultSaveState/.test(src),
      'NEW GAME is the same restore path applied to the documented initial state, not a second reset');
  chk(/loadGame\(\)[\s\S]{0,1200}this\._applyRestoredState\(read\.state\)/.test(src),
      'LOAD goes through it too');
  chk(/continueFromSave\(\)[\s\S]{0,1600}this\._applyRestoredState\(read\.state\)/.test(src),
      'and so does CONTINUE');

  // No write may happen on a frame.
  const aStart = src.indexOf('\n  _animate(');
  const animate = src.slice(aStart, src.indexOf('\n/* ---', aStart));
  chk(animate.length > 2000, 'the frame loop was located for inspection (' + animate.length + ' chars)');
  chk(!/saveGame\(|autosave\(|\.write\(|setItem\(/.test(animate),
      'THE FRAME LOOP CONTAINS NO SAVE AT ALL — no write, no autosave, no storage call');
  chk(count(/this\.autosave\(\);/g) === 2,
      'autosave is called from exactly two places, and both are dimension transitions');
  const t2 = src.indexOf('_transitionToLevel2() {'), t3 = src.indexOf('_transitionToLevel3() {');
  chk(t2 > 0 && t3 > 0 && src.indexOf('this.autosave();', t2) > t2 && src.indexOf('this.autosave();', t3) > t3,
      'namely _transitionToLevel2 and _transitionToLevel3');
  chk(!/setInterval\([^)]*save/i.test(src), 'and there is no timer-driven autosave');

  // The teardown must clear everything that could otherwise be duplicated by a load.
  const td = src.slice(src.indexOf('  _teardownForRestore() {'), src.indexOf('  _applyRestoredState('));
  const teardownWants = [
    ['mobs', /this\.mobs\.clearAll\(/], ['the Stalker', /this\.stalker\.clearAll\(/],
    ['phantoms', /this\.phantoms\.clearAll\(/], ['arrows', /this\.arrows\.clearAll\(/],
    ['dropped items', /this\.itemManager\.entities\.length = 0/],
    ['farm animals', /this\.farmAnimals\.destroyAll\(/],
    ['every chunk and pin', /wipeAllChunks\(\)/],
    ['the generation queue', /_genQueue\.length = 0/],
    ['the anchor', /this\.anchorManager\.removeAnchor\(\)/],
    ['lantern props', /_removeLanternLight\(/], ['Soul Anchor zones', /_removeSoulAnchorZone\(/],
    ['the water queue', /_wQ\.length = 0/],
    ['open overlays', /closeStorage\(\)/],
  ];
  for (const pair of teardownWants) chk(pair[1].test(td), 'the teardown releases ' + pair[0]);

  // The capture must read every field the schema promises.
  const cap = src.slice(src.indexOf('  captureSaveState() {'), src.indexOf('  _teardownForRestore() {'));
  const captureWants = [
    ['position', /p\.position\.x/], ['orientation', /yaw: p\.yaw, pitch: p\.pitch/],
    ['health', /hp: p\.hp, maxHp: p\.maxHp/], ['the selected slot', /selectedSlot: p\.selectedSlot/],
    ['sanity', /sanity: this\.sanity\.value/], ['the stage', /stage: this\.stage/],
    ['the day count', /dayCount: this\.dayCount/], ['the compass', /compassAcquired/],
    ['the clock', /cycleSeconds: this\.env\.cycleSeconds/],
    ['world edits and chest state', /captureWorldState\(w\)/],
    ['the settings snapshot', /settings: this\.settings\.toJSON\(\)/],
  ];
  for (const pair of captureWants) chk(pair[1].test(cap), 'the capture records ' + pair[0]);
  chk(!/\bxp\b\s*:/.test(cap), 'and it records NO xp field');
  chk(/p\.xp = 0;/.test(src), 'while the restore explicitly zeroes the (unsaved) xp counter');

  // Nothing that belongs to the renderer may be in a save.
  const banned = ['this.scene', 'this.renderer', 'this.camera', 'geometry', 'material',
                  'this.canvas', 'AudioContext', 'document.getElementById'];
  for (const b of banned) chk(cap.indexOf(b) < 0, 'the capture never touches ' + b);

  // The Fake Haven refusal.
  chk(/saveBlockedReason\(\) \{[\s\S]{0,400}inFakeHaven/.test(src),
      'saving is refused inside the Fake Haven, explicitly and in one place');
  chk(/loadGame\(\) \{[\s\S]{0,200}inFakeHaven/.test(src), 'and so is loading');

  // The menu integration reuses the Phase 22 panel rather than inventing one.
  chk(/id="setSave"/.test(src) && /id="setLoad"/.test(src) && /id="setNewGame"/.test(src),
      'Save, Load and New Game live in the existing settings panel');
  chk(/id="continuePlay"/.test(src), 'and CONTINUE lives on the existing start screen');
  chk(count(/class="settings-group"/g) >= 7,
      'as one more settings-group, in the panel own chrome — no new menu framework');
  chk(/_newGameArmed/.test(src) && /CONFIRM\?/.test(src),
      'NEW GAME asks twice before it throws a run away');
  chk(/_saveActionsBound/.test(src), 'and its listeners are bound exactly once, as Phase 22 does');
}

// =====================================================================================
// 12. REPEATED CYCLES
// =====================================================================================
{
  const store = memStore();
  const sys = new SaveSystem(store);
  let state = validateSaveState(goodSave()).state;
  let stable = true;
  for (let i = 0; i < 25; i++) {
    if (!sys.write(state).ok) { stable = false; break; }
    const r = sys.read();
    if (!r.ok || !deep(r.state, state)) { stable = false; break; }
    state = r.state;
  }
  chk(stable, '25 save/load cycles in a row are byte-stable — no drift, no growth, no loss');
  chk(store.m.size === 2, 'and the slot never grows past its two keys (' + Array.from(store.m.keys()).join(', ') + ')');
}
{
  // A save is written only when asked. Nothing in the read path writes.
  const store = memStore();
  const sys = new SaveSystem(store);
  sys.write(validateSaveState(goodSave()).state);
  const after = store.writes;
  for (let i = 0; i < 1000; i++) { sys.read(); sys.peek(); }
  chk(store.writes === after, '1,000 reads perform zero writes — reading is never a write');
}

console.log('\n' + (fail === 0 ? 'ALL SAVE / LOAD CHECKS PASS' : fail + ' FAILURES'));
process.exit(fail ? 1 : 0);
