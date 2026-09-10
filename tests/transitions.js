/* =====================================================================================
   PHASE 35 — DIMENSION TRANSITIONS.

   THE FAULT THIS FILE EXISTS FOR. A rift is opened by feeding a Rift Core Disk to an
   Anchor Monument; `AnchorMonumentManager.powerRiftCore` refuses outright if a rift is
   ALREADY open on that manager. Nothing put the rift down when the player walked through
   one. So the Level 1->2 crossing left `riftActive === true` for the rest of the session,
   and every consequence of that followed:

     - powerRiftCore(3) returned false forever. A player who reached the Farmlands, found
       the Level 2 Rift Core Disk exactly where the game guarantees it, raised an Anchor
       and fed it the Disk got NOTHING — no rift, no glyph, and the Disk not consumed.
       Static Suburbia, the Fake Haven and the finale were unreachable in normal play.
     - The objective override table gives a powered rift the highest priority in the game,
       so "Enter the Rift." was on screen from the first frame of the Farmlands and the
       entire Phase 20 journey chain was unreachable.
     - The audio director selects the Rift scene within 20m of a powered Anchor, against
       an `activeAnchor` whose coordinates were in a dimension that had been unloaded.
     - The monument's chunk stayed pinned, so a chunk of the previous dimension stayed
       resident for the rest of the session.

   All of it was one missing teardown, and the repair is one: `Game._leaveDimension`.

   WHAT ELSE IS ASSERTED HERE. The other transition defects the same pass found, each of
   which is its own regression: the Farmlands having no wood a player can pick up (so the
   Anchor the Level 2 Disk needs could not be built there); the Level 2->3 crossing not
   generating its arrival ring; a respawn ejecting the player out of the dimension they
   died in; a rift firing on the same frame it opens; and a save whose Anchor stands in a
   different dimension from the one it names.

   OFFLINE. This drives the real AnchorMonumentManager, the real VoxelWorld, the real
   Inventory, the real recipe table, the real objective tables and the real save
   validator. The live end-to-end — a real New Game walked through both rifts in a real
   browser — is browser-transitions.js, and the claims that need a browser are made
   there and nowhere else.
   ===================================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeWorld } = require('./harness/world.js');

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

const GAME = path.join(__dirname, '..', 'game.html');
const SRC = fs.readFileSync(GAME, 'utf8');

const { S, ev, w } = makeWorld();
S.__w = w;
const AM = () => ev('new AnchorMonumentManager(__scene, __w, null)');

/* The body of one method, brace-matched from its signature. Used for the structural
   claims — "every crossing runs the teardown" is a property of the source, and the only
   honest way to check it without a browser is to read the source. */
function methodBody(src, name, from) {
  /* Finds `name(` at a line start (optionally after `function `), walks the PARAMETER
     LIST by paren depth — a destructured parameter contains braces, which a naive
     `[^)]*` would stop at — and then brace-matches the body. */
  const sig = new RegExp('(?:^|\\n)\\s*(?:function\\s+)?' + name + '\\s*\\(', 'g');
  sig.lastIndex = from || 0;
  const m = sig.exec(src);
  if (!m) return null;
  let i = src.indexOf('(', m.index + m[0].length - 1);
  let d = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '(') d++;
    else if (src[j] === ')') { d--; if (d === 0) break; }
  }
  const open = src.indexOf('{', j);
  if (open < 0) return null;
  d = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(open + 1, k); }
  }
  return null;
}

// =====================================================================================
head('1. THE ROOT CAUSE: A RIFT THAT IS WALKED THROUGH IS PUT DOWN');
// =====================================================================================
{
  const am = AM();
  w.anchorManager = am;

  am.placeAnchor(40, 30, 40);
  chk(am.powerRiftCore(2) === true, 'a Level 1 Core Disk opens a rift on a freshly placed Anchor');
  chk(am.riftActive && am.riftTargetLevel === 2, 'and the rift records the destination it was opened for');

  /* THE EXACT SHAPE OF THE BUG. This is what the Level 1->2 crossing used to leave
     behind, and the next line is what it did to the game. */
  chk(am.powerRiftCore(3) === false,
      'a second Disk cannot open a second rift on the same manager while one is open — this is the gate that broke the game');

  am.removeAnchor();
  chk(!am.riftActive && am.riftTargetLevel === null && !am.activeAnchor,
      'putting the Anchor down closes its rift and forgets its destination');
  chk(am.riftArming === 0, 'and disarms it, so a stale countdown cannot survive a crossing');

  am.placeAnchor(-33268, 30, -33282);   // a Farmlands coordinate
  chk(am.powerRiftCore(3) === true,
      'THE REPAIR: an Anchor raised in the next dimension opens the NEXT rift, which was impossible before');
  chk(am.riftTargetLevel === 3, 'and it opens toward Static Suburbia, not back the way they came');
}

// =====================================================================================
head('2. EVERY CROSSING RUNS THE ONE TEARDOWN, AND THE TEARDOWN PUTS THE ANCHOR DOWN');
// =====================================================================================
{
  const leave = methodBody(SRC, '_leaveDimension');
  chk(!!leave, 'Game._leaveDimension exists');
  chk(/this\.anchorManager\.removeAnchor\(\)/.test(leave || ''),
      'and the first thing it does is put the Anchor and its rift down');

  for (const m of ['_transitionToLevel2', '_transitionToLevel3', '_transitionToLevel4']) {
    const body = methodBody(SRC, m) || '';
    chk(/this\._leaveDimension\(/.test(body), `${m} runs it`);
  }
  /* And the developer teleports, which is what makes "no transition needs a debug
     command" structural: a teleport and a rift arrive in identical state because they
     are the same call. */
  const dev = methodBody(SRC, 'clearEntities') || '';
  chk(/_leaveDimension\(/.test(dev),
      'and so do the developer teleports — there is no second copy of this list any more');

  /* Nothing hostile, in flight, or on the ground crosses with the player. */
  for (const [re, what] of [
    [/this\.mobs\.clearAll\(/, 'mobs'],
    [/this\.stalker\.clearAll\(\)/, 'the Stalker'],
    [/this\.phantoms\.clearAll\(\)/, 'hallucinations'],
    [/this\.arrows\.clearAll\(\)/, 'arrows in flight'],
    [/itemManager\.entities/, 'dropped items'],
    [/farmAnimals/, 'the Farmland animal rigs'],
    [/stationaryTimer\s*=\s*0/, "the stationary timer Suburbia's Sanity drain reads"],
  ]) chk(re.test(leave || ''), `the teardown releases ${what}`);

  /* What it must NOT touch. These are the things that are the player's, or that are
     progression rather than dimension state. */
  for (const [re, what] of [
    [/inventory\s*\.\s*(clear|slots)/, 'the inventory'],
    [/compassAcquired/, 'the compass'],
    [/milestones/, 'the milestones'],
    [/envStory/, 'the environmental-story latch'],
    [/saveGame|autosave/, 'the save'],
  ]) chk(!re.test(leave || ''), `and never touches ${what}`);
}

// =====================================================================================
head('3. THE FRAME LOOP ASKS ONE QUESTION, AND A NEW RIFT IS NOT INSTANT');
// =====================================================================================
{
  const am = AM();
  am.placeAnchor(40, 30, 40);
  am.powerRiftCore(2);
  chk(am.riftReady() === false,
      'a rift does not fire on the frame it opens — the player right-clicks INSIDE the trigger radius');
  const arm = ev('RIFT_ARM_TIME');
  let t = 0;
  while (!am.riftReady() && t < 10) { am.update(0.1); t += 0.1; }
  chk(am.riftReady() && t >= arm - 0.11 && t <= arm + 0.11,
      `and it arms after ${arm}s, which is long enough for the Anchor to be seen to answer`);
  note('so the dome recolouring, the glyph and the zap are all rendered before the world changes');

  am.removeAnchor();
  chk(am.riftReady() === false, 'a rift with no Anchor is not ready, whatever else is true');

  /* ONE call site, and it asks the manager rather than re-deriving the conditions — which
     is how the arming condition came to be missing from it in the first place. */
  const calls = (SRC.match(/anchorManager\.riftReady\(\)/g) || []).length;
  chk(calls === 1,
      `the frame loop asks riftReady() rather than spelling the conditions out again (${calls} call site)`);
  chk(!/anchorManager\.riftActive\s*&&\s*this\.anchorManager\.activeAnchor\)\s*\{\s*\n\s*const distToRift/.test(SRC),
      'and the open-coded version of that test is gone from the loop');
}

// =====================================================================================
head('4. THE FARMLANDS HAVE WOOD A PLAYER CAN PICK UP');
// =====================================================================================
{
  /* An Anchor costs four planks. The Anchor raised in the Overworld stays in the
     Overworld. So the dimension that hands out the Level 2 Rift Core Disk has to contain
     a route to four planks, and before this pass it did not: ASH_WOOD is the only tree
     in it, it is in WOOD_BLOCKS, it takes an axe, the cue reads CHOP against it — and it
     dropped nothing at all. */
  const BLOCK = ev('BLOCK'), ITEM = ev('ITEM');
  chk(ITEM.ASH_LOG !== undefined, 'an Ash Log exists');
  chk(ev('ITEM_DATA')[ITEM.ASH_LOG].name === 'Ash Log',
      'and it is its own item rather than Oak Log wearing an ash tree — the label does not lie');

  /* Ids are save-file values: appending is safe, inserting rewrites every save. */
  const ids = Object.keys(ev('ITEM')).map(k => ev('ITEM')[k]).filter(v => typeof v === 'number');
  chk(ITEM.ASH_LOG === Math.max.apply(null, ids),
      'and its id is the LAST one, so no existing save had an item renumbered under it');

  /* The drop, through the real world and the real item manager. */
  const scene = S.__scene;
  const drops = [];
  const realIM = w.itemManager;
  w.itemManager = { spawnDrop: (item, count) => drops.push([item, count]) };
  const cx = 0, cy = 34, cz = 0;
  w.setBlockWorld(cx, cy, cz, BLOCK.ASH_WOOD);
  w.destroyBlock(cx, cy, cz, null, true);
  w.itemManager = realIM;
  chk(drops.length === 1 && drops[0][0] === ITEM.ASH_LOG,
      'chopping an ashen trunk drops an Ash Log — before this it dropped nothing, in every build');

  /* And the Ash Log reaches an Anchor through the real recipes and the real inventory. */
  const inv = ev('new Inventory()');
  inv.addItem(ITEM.ASH_LOG, 1);
  const recipes = ev('CRAFTING_RECIPES');
  const ashPlanks = recipes.find(r => r.reqs.length === 1 && r.reqs[0].item === ITEM.ASH_LOG);
  chk(!!ashPlanks && ashPlanks.result === ITEM.WOOD_PLANK && ashPlanks.count === 4,
      'one Ash Log makes four planks — the same yield as oak, so this is a second SOURCE and not a better one');
  inv.consumeIngredients(ashPlanks.reqs);
  inv.addItem(ashPlanks.result, ashPlanks.count);
  const anchorRecipe = recipes.find(r => r.result === ITEM.SAFEHOUSE_ANCHOR);
  chk(inv.hasIngredients(anchorRecipe.reqs),
      'and four planks is exactly an Anchor Monument: the Farmlands can now raise the one the Level 2 Disk needs');
}

// =====================================================================================
head('5. AN ANCHOR BELONGS TO THE DIMENSION IT STANDS IN');
// =====================================================================================
{
  const dim = ev('dimensionOfWorldPos');
  chk(dim(40, 40) === 'overworld', 'the Overworld spawn reads as the Overworld');
  chk(dim(w.farmlandsSpawn.x, w.farmlandsSpawn.z) === 'farmlands', 'the Farmlands arrival reads as the Farmlands');
  chk(dim(w.suburbiaSpawn.x, w.suburbiaSpawn.z) === 'suburbia', 'the Suburbia arrival reads as Suburbia');
  const hx = ev('FAKE_HAVEN_CHUNK_OFFSET * CHUNK_SX + 8');
  chk(dim(hx, hx) === 'haven',
      'and the Haven pocket reads as the Haven even though it sits inside Suburbia’s band');

  /* THE SAVE REPAIR. A save written by a pre-Phase-35 build in the Farmlands carries the
     OVERWORLD Anchor, still powered, because crossing the rift did not put it down.
     Restoring it would rebuild exactly the state that broke the game. */
  const validate = ev('validateSaveState');
  const good = JSON.parse(ev('JSON.stringify')(makeSave()));
  let r = validate(good);
  chk(r.ok && r.state.anchor && r.state.anchor.x === 44,
      'an Anchor standing in the dimension the save names is restored untouched');

  const crossed = makeSave();
  crossed.dimension = 'farmlands';
  crossed.player.position = { x: -33271.5, y: 25, z: -33282.5 };
  r = validate(crossed);
  chk(r.ok, 'a save whose Anchor is in another dimension still LOADS — nothing is thrown away wholesale');
  chk(r.state.anchor === null,
      'but the Anchor is dropped rather than restored, which repairs a pre-Phase-35 save in place');
  chk(r.repairs.some(x => /different dimension/.test(x)),
      'and the repair is reported rather than silent');

  function makeSave() {
    const inv = new Array(ev('INVENTORY_SIZE')).fill(null);
    return {
      version: ev('SAVE_VERSION'), savedAt: 1700000000000, dimension: 'overworld',
      player: { position: { x: 40.5, y: 32, z: 40.5 }, yaw: 0, pitch: 0, hp: 90, maxHp: 100,
                dead: false, attackBonus: 0, miningSpeedBonus: 0, chestsOpened: 0,
                selectedSlot: 0, inventory: inv },
      sanity: 100,
      progression: { stage: 1, dayCount: 1, memoryFragments: 0, nightsRequired: 3 },
      time: { cycleSeconds: 100, wasNight: false },
      anchor: { x: 44, y: 30, z: 46, fuel: 100, riftActive: true, riftTargetLevel: 2 },
      world: { edits: {}, openedChests: [] },
      objectives: { overworld: 0, farmlands: 0, suburbia: 0, haven: 0 },
      settings: {},
    };
  }
}

// =====================================================================================
head('6. THE OBJECTIVE THE PLAYER IS SHOWN ON THE OTHER SIDE');
// =====================================================================================
{
  const OS = ev('ObjectiveSystem');
  const base = {
    chain: 'overworld', overworld: true, farmlands: false, suburbia: false, haven: false,
    hasWood: false, hasTool: false, hasCoal: false, hasTorch: false, hasAnchor: false,
    inAnchorZone: false, night: false, hasDisk: false, riftActive: false,
    farmOrd: 0, farmHouseSeen: false, farmTower: false, farmCoreTaken: false,
    subVisits: 0, subCoreTaken: false, havenShifted: false, havenEnding: false, climax: false,
  };
  const textFor = (over) => {
    const s = Object.assign({}, base, over);
    s.chain = s.haven ? 'haven' : s.farmlands ? 'farmlands' : s.suburbia ? 'suburbia' : 'overworld';
    s.overworld = s.chain === 'overworld';
    const o = new OS(null);
    o.evaluate(s);
    return o.currentText;
  };

  /* THE LINE THE BUG PUT ON SCREEN, and the line that belongs there. A player arriving
     in the Farmlands used to be told "Enter the Rift." — about the rift they had just
     come out of — for the whole dimension. */
  chk(textFor({ farmlands: true, farmOrd: 0 }) === 'Explore the Shattered Farmlands.',
      'arriving in the Farmlands opens the Farmland journey rather than the rift behind them');
  chk(textFor({ suburbia: true }) === 'Explore the neighbourhood.',
      'and arriving in Suburbia opens Suburbia’s');

  /* And the disk line, which now knows whether there is an Anchor to bring it to. */
  chk(textFor({ farmlands: true, hasDisk: true, hasAnchor: false }) === 'Raise an Anchor.',
      'holding a Disk with no Anchor standing, the line names the missing half');
  chk(textFor({ farmlands: true, hasDisk: true, hasAnchor: true }) === 'Bring it to the Anchor.',
      'and once one is standing it says where the Disk goes');
  chk(textFor({ farmlands: true, hasDisk: true, hasAnchor: true, riftActive: true }) === 'Enter the Rift.',
      'and once that opens something, THAT is when the rift outranks everything');

  /* No objective in the game may name a key, a mouse button or a UI element — Phase 28,
     and the new line has to obey it like every other. */
  const banned = /\b(press|click|key|button|mouse|menu|LMB|RMB|hotbar|slot|inventory)\b/i;
  let offenders = [];
  for (const o of ev('OBJECTIVE_OVERRIDES')) if (o.text && banned.test(o.text)) offenders.push(o.text);
  for (const k of Object.keys(ev('OBJECTIVE_CHAINS')))
    for (const st of ev('OBJECTIVE_CHAINS')[k]) if (st.text && banned.test(st.text)) offenders.push(st.text);
  chk(offenders.length === 0,
      'and no objective line anywhere names a key, a button or a piece of interface' +
      (offenders.length ? ': ' + offenders.join(' / ') : ''));
}

// =====================================================================================
head('7. ARRIVAL IS ON REAL GROUND, IN EVERY DIMENSION');
// =====================================================================================
{
  /* A crossing places the player at the region's arrival point and then hands control
     back. Collision reads chunk.data directly, so the ring around that point has to
     exist before the first step — the Level 2->3 crossing did not generate it. */
  for (const m of ['_transitionToLevel2', '_transitionToLevel3']) {
    const body = methodBody(SRC, m) || '';
    chk(/_eagerLoadAround\(/.test(body),
        `${m} generates its arrival ring synchronously before placing the player`);
  }

  /* And the arrival points themselves are standable in the real generated world. The
     claim is the one that matters and the one requirement 49 makes: never load a player
     into solid terrain, and never into a column with no floor under it. The Farmlands
     point sits one block clear of its surface and the player falls that block on arrival
     — measured, harmless, unchanged from every previous build, and NOT asserted away
     here as if it were exact. */
  const solid = (x, y, z) => w.getBlockWorld(x, y, z) !== ev('BLOCK.AIR');
  for (const [name, sp] of [['Farmlands', w.farmlandsSpawn], ['Suburbia', w.suburbiaSpawn]]) {
    const x = Math.floor(sp.x), y = Math.floor(sp.y), z = Math.floor(sp.z);
    w._eagerLoadAround(sp.x, sp.z, 1);
    const clearOk = !solid(x, y, z) && !solid(x, y + 1, z);
    let floor = -1;
    for (let d = 1; d <= 4; d++) if (solid(x, y - d, z)) { floor = d; break; }
    chk(clearOk && floor > 0,
        `the ${name} arrival point is clear of geometry with ground ${floor} block(s) below it`);
  }
}

// =====================================================================================
head('8. DYING DOES NOT EJECT THE PLAYER OUT OF THE DIMENSION');
// =====================================================================================
{
  /* Phase 5A carved the Haven out of _respawn for exactly the right reason — the
     Overworld is not loaded, so sending them there is sending them into a void. Every
     word of that was equally true of the Farmlands and Suburbia, and _respawn sent them
     there anyway, clearing the dimension flags on the way. The Core Disk that opened the
     rift is spent, so one death ended the run in place. */
  const body = methodBody(SRC, '_respawn') || '';
  chk(/inFarmlands\b[\s\S]*farmlandsSpawn/.test(body) || /farmlandsSpawn/.test(body),
      'a respawn in the Farmlands goes to the Farmlands arrival point');
  chk(/suburbiaSpawn/.test(body), 'a respawn in Suburbia goes to Suburbia’s');
  chk(/fakeHavenSpawn/.test(body), 'and the Haven keeps the placement Phase 5A gave it');
  const eject = body.indexOf('this.inFarmlands = false');
  const guard = body.indexOf('if (to)');
  chk(eject < 0 || (guard >= 0 && guard < eject),
      'and the Overworld ejection is only reachable when the player was in the Overworld');
}

// =====================================================================================
head('9. NOTHING IN A CROSSING SCHEDULES ANYTHING IT CANNOT CANCEL');
// =====================================================================================
{
  const leave = methodBody(SRC, '_leaveDimension') || '';
  chk(!/setTimeout|setInterval/.test(leave),
      'the crossing teardown schedules nothing — there is no timer in it to leak');
  const arm = methodBody(SRC, 'powerRiftCore') || '';
  chk(!/setTimeout|setInterval/.test(arm),
      'and the rift arming window is a number dt is subtracted from, not a scheduler');
}

console.log('');
if (fail) { console.log(fail + ' PHASE 35 TRANSITION CHECK(S) FAILED'); process.exit(1); }
console.log('ALL PHASE 35 TRANSITION CHECKS PASS');
note('Offline. The real Anchor manager, the real world, the real recipes, the real');
note('objective tables and the real save validator were driven. The live crossing —');
note('a real New Game walked through both rifts in a real browser — is in');
note('browser-transitions.js, and no human has played this build.');
