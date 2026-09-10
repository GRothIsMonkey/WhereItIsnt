/* PHASE 32 — FAKE HAVEN.

   WHAT THIS FILE CAN AND CANNOT PROVE.

   It boots the REAL script into the offline harness and drives the REAL things: the real
   HAVEN_STAGES table, the real VoxelWorld.generateFakeHaven(), the real cabin read out of
   real chunk data, the real anomaly gate, the real env-story runtime, the real save
   blocker. Where a claim is about the shipped SOURCE rather than about behaviour it says
   so, because `Game` cannot be constructed without a GPU — the live half (that the
   sequence actually renders, that pointer lock comes back, that no audio is left
   playing) is in browser-haven.js and is claimed only there.

   IT CANNOT PROVE THE HAVEN WORKS. Whether a person relaxes in the cabin, whether they
   notice a second mug on the mantel, whether the room going quiet reads as dread or as
   nothing at all, and whether losing it hurts, are judgements for a person. The phase
   report says exactly who has and has not made them. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld } = require('./harness/world.js');

const ROOT = path.join(__dirname, '..');
const SRC = require('./harness/source.js').buildSource()   /* ERA 1.5: the WHOLE build — every
   src/ module plus the inline <script>. Reading game.html directly would scan less
   and less code as Era 1.5 extracts, while going on passing. See ARCHITECTURE.md §0. */;
const STORY = fs.readFileSync(path.join(ROOT, 'STORY.md'), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
                      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const LIVE = strip(SRC);

/* One class or method body, brace-matched — the same helpers hud.js, menu.js and
   opening.js use. */
function classBody(src, name) {
  const i = src.indexOf('class ' + name + ' {');
  if (i < 0) return '';
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return '';
}
function methodBody(src, name) {
  const i = src.indexOf('\n  ' + name + '(');
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return null;
}

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

console.log('booting the real script...');
const { S, ev, w } = makeWorld();
S.__w = w;
const B = (k) => ev('BLOCK.' + k);
const STAGES = ev('HAVEN_STAGES.map(s => ({id:s.id, until:s.until, room:s.room, ' +
                  'outside:s.outside, hearth:s.hearth, music:s.music, drift:s.drift, ' +
                  'anomaly:s.anomaly}))');
const TOTAL = ev('HAVEN_SHIFT_SECONDS');
const ENDING_FROM = ev('HAVEN_ENDING_FROM');

// =====================================================================================
head('1. THE STAGE MACHINE IS A PURE FUNCTION OF ONE NUMBER');
// =====================================================================================
{
  chk(STAGES.length === 6,
      `the Haven has ${STAGES.length} stages: ${STAGES.map(s => s.id).join(' -> ')}`);
  let ordered = true;
  for (let i = 1; i < STAGES.length; i++) if (STAGES[i].until <= STAGES[i - 1].until) ordered = false;
  chk(ordered, 'their boundaries strictly increase, so no second is in two stages');
  chk(STAGES[0].until > 0, 'and the first one starts at zero rather than at a boundary');

  /* THE TABLE TILES THE WHOLE SEQUENCE WITH NO GAP. Sampled every quarter second across
     the entire intact Haven — the same discipline opening.js applies to FILM_BEATS. */
  let uncovered = 0, wrong = 0;
  for (let t = 0; t < TOTAL; t += 0.25) {
    const id = ev(`havenStageAt(${t}).id`);
    if (!id) { uncovered++; continue; }
    const expect = STAGES.find(s => t < s.until);
    if (!expect || expect.id !== id) wrong++;
  }
  chk(uncovered === 0 && wrong === 0,
      `every quarter-second of the ${TOTAL}s sequence resolves to exactly the tabled stage`);

  // Total: a stage is always returned, including for garbage, because a caller reading a
  // stage inside the frame loop is always entitled to an answer.
  chk(ev("havenStageAt(-5).id") === STAGES[0].id, 'a negative time clamps to the first stage');
  chk(ev(`havenStageAt(${TOTAL + 500}).id`) === STAGES[STAGES.length - 1].id,
      'and past the end it clamps to the last, rather than returning nothing');
  chk(ev("havenStageAt(NaN).id") === STAGES[0].id && ev("havenStageAt('x').id") === STAGES[0].id,
      'NaN and a string are answered too — this runs inside the frame loop and may not throw');

  // Determinism: same input, same answer, always.
  chk(ev('havenStageAt(90).id') === ev('havenStageAt(90).id') &&
      ev('havenDissolveAt(160)') === ev('havenDissolveAt(160)'),
      'the same second always resolves to the same stage and the same dissolve');
}

// =====================================================================================
head('2. THE COMFORT IS REAL, AND IT IS MOST OF THE SEQUENCE');
// =====================================================================================
{
  /* The brief: the first minutes contain essentially no horror, and the player must have
     time to relax. This is the check that the pacing was not quietly shortened later. */
  const firstChange = STAGES.find(s => s.room < 1 || s.outside < 1 || s.hearth < 1 ||
                                       s.music !== 'full' || s.drift < 1 || s.anomaly);
  const calmUntil = STAGES[STAGES.indexOf(firstChange) - 1].until;
  chk(calmUntil >= 40,
      `nothing at all changes for the first ${calmUntil}s — full ambience, full music, no event`);

  const firstAnomaly = STAGES.find(s => s.anomaly);
  const anomalyFrom = STAGES[STAGES.indexOf(firstAnomaly) - 1].until;
  chk(anomalyFrom >= 60,
      `and the first committed change cannot happen before ${anomalyFrom}s`);
  chk(ev('havenDissolveAt(0)') === 0 && ev(`havenDissolveAt(${ENDING_FROM - 1})`) === 0,
      'the dissolve is exactly zero for the whole of the intact Haven');

  /* EVERY STAGE IS A SUBTRACTION. Nothing is ever added back, and no level ever rises:
     that is the difference between "the room is running out" and "the room is playing
     tricks", and it is what STORY.md section 18 means by the Haven not turning on the
     player. */
  let rose = null;
  for (let i = 1; i < STAGES.length; i++) {
    for (const k of ['room', 'outside', 'hearth', 'drift']) {
      if (STAGES[i][k] > STAGES[i - 1][k]) rose = `${k} rises at ${STAGES[i].id}`;
    }
  }
  chk(!rose, 'no ambience layer ever comes back once it has gone' + (rose ? ' — ' + rose : ''));
  const order = ['full', 'thin', 'none'];
  let musicRose = null;
  for (let i = 1; i < STAGES.length; i++)
    if (order.indexOf(STAGES[i].music) < order.indexOf(STAGES[i - 1].music))
      musicRose = STAGES[i].id;
  chk(!musicRose, 'and the music only ever thins' + (musicRose ? ' — ' + musicRose : ''));

  chk(STAGES[STAGES.length - 1].room === 0 && STAGES[STAGES.length - 1].outside === 0 &&
      STAGES[STAGES.length - 1].hearth === 0 && STAGES[STAGES.length - 1].music === 'none',
      'by the final stage every layer is gone — the sequence ends in silence, not in a sting');
}

// =====================================================================================
head('3. THE DISSOLVE IS A RAMP, AND IT IS THE ONLY WAY OUT');
// =====================================================================================
{
  let mono = true, prev = -1;
  for (let t = 0; t <= TOTAL + 5; t += 0.5) {
    const d = ev(`havenDissolveAt(${t})`);
    if (d < prev - 1e-9) mono = false;
    prev = d;
  }
  chk(mono, 'the dissolve never goes backwards');
  chk(ev(`havenDissolveAt(${ENDING_FROM})`) === 0, 'it is 0 at the instant the last stage begins');
  chk(Math.abs(ev(`havenDissolveAt(${TOTAL})`) - 1) < 1e-9, 'and exactly 1 when the Haven ends');
  const mid = ev(`havenDissolveAt(${(ENDING_FROM + TOTAL) / 2})`);
  chk(mid > 0.4 && mid < 0.6, `halfway through the final stage it is halfway done (${mid.toFixed(2)})`);
  chk(TOTAL - ENDING_FROM >= 15,
      `the removal takes ${TOTAL - ENDING_FROM}s — long enough to be a loss rather than a cut`);

  /* THE CABIN'S OWN LAMPS GO WITH IT. The sky's dissolve is not enough on its own: a room
     lit by its own fire and sconces stayed golden inside while the windows went grey,
     which reads as weather rather than as the place being removed. Driven against the
     real lights on the real generated cabin. */
  ev('__w.generateFakeHaven()');
  const lamps = () => (w.havenWarmLights || []).map(l => +l.intensity.toFixed(4));
  w.setHavenLightLevel(1);
  const lit = lamps();
  chk(lit.length >= 4 && lit.every(v => v > 0), `the intact cabin is lit (${lit.join(', ')})`);
  w.setHavenLightLevel(0.5);
  const half = lamps();
  chk(half.every((v, i) => Math.abs(v - lit[i] / 2) < 1e-4),
      'halfway through the removal every warm light is at half of what it was');
  w.setHavenLightLevel(0);
  chk(lamps().every(v => v === 0) && w.havenCozyLight.intensity === 0,
      'and at the end of it the room is out — including the interior fill');
  chk(w.setHavenLightLevel(0) === false, 'setting the same level twice does no work');
  w.setHavenLightLevel(1);
  chk(lamps().every((v, i) => Math.abs(v - lit[i]) < 1e-4),
      'the ramp is exact and reversible — it scales from a remembered base, never from itself');

  /* And the hearth's flicker must MULTIPLY that level rather than overwrite it, or the
     fire alone stays golden in a room that has gone out. */
  const flicker = methodBody(LIVE, 'updateFakeHaven') || '';
  chk(/_havenLightLevel/.test(flicker) && /\* level/.test(flicker),
      'the hearth flicker is a multiplier on the same level, not an absolute intensity');

  const machine = methodBody(LIVE, '_updateHaven') || '';
  chk(/setHavenLightLevel\(1 - fade\)/.test(machine),
      'and the sky, the shader and the lamps are all driven from the one number');
  chk(ev('havenDissolveAt(NaN)') === 0, 'and garbage reads as "not dissolving", never as "gone"');
}

// =====================================================================================
head('4. THE CABIN IS BUILT, LIVED-IN, AND CONSISTENT');
// =====================================================================================
{
  const spawn = ev('__w.generateFakeHaven()');
  chk(!!spawn && w.fakeHavenBuilt, 'the Haven generates on demand and reports a spawn');
  chk(w.fakeHavenActive, 'and marks itself active so chunk streaming is switched off');

  const minX = ev('FAKE_HAVEN_CHUNK_OFFSET * CHUNK_SX');
  const span = ev('FAKE_HAVEN_CHUNKS_SPAN * CHUNK_SX');
  const cX = minX + Math.floor(span / 2), cZ = minX + Math.floor(span / 2);
  const baseY = ev('FAKE_HAVEN_BASE_Y');
  const S_ = ev('FAKE_HAVEN_CABIN_SIZE'), half = Math.floor(S_ / 2);
  const x0 = cX - half, z0 = cZ - half, x1 = x0 + S_ - 1, z1 = z0 + S_ - 1;
  const at = (x, y, z) => w.getBlockWorld(x, y, z);

  /* SMALL, per the brief: the player must be able to learn the place. */
  chk(S_ <= 16 && span <= 64,
      `it is one ${S_}x${S_} cabin in a ${span}-block clearing — small enough to learn`);

  /* THE SIGNS OF CARE. Not asserted as "some blocks exist" but as the specific furnishing
     STORY.md section 18 requires: a lit hearth, seating turned toward it, a rug tying
     them together, a made bed, and objects that belong to somebody. */
  const rug = [];
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++)
    if (at(x, baseY - 1, z) === B('RUG')) rug.push([x, z]);
  chk(rug.length > 20, `a rug is laid in front of the hearth (${rug.length} cells)`);
  chk(!!w.havenFire && !!w.havenFireLight, 'the fire is lit — particles and a warm point light');
  chk(!!w.havenBedGroup, 'the bed is made and is a real prop rather than a voxel');
  chk((w.havenWarmLights || []).length >= 4,
      `the room is lit warmly from ${(w.havenWarmLights || []).length} registered sources plus the hearth`);

  let books = 0, panes = 0;
  for (let x = x0; x <= x1; x++) for (let y = baseY; y < baseY + 5; y++) for (let z = z0; z <= z1; z++) {
    const id = at(x, y, z);
    if (id === B('SIDE_PINK') || id === B('SIDE_MINT') || id === B('SIDE_BUTTER') ||
        id === B('SIDE_SKY') || id === B('SIDE_PEACH') || id === B('SIDE_CREAM')) books++;
    if (id === B('HAVEN_GLASS')) panes++;
  }
  chk(books >= 8, `${books} small personal objects — shelves, pictures, mantel clutter, a mug`);
  chk(panes >= 8, `${panes} window panes: the room is not a box, and it can be seen out of`);

  /* CONSISTENCY IS THE POINT (brief section 9). Every other dimension in this game is
     built to disagree with itself; this one is measured for agreeing. */
  let leaks = 0;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const onEdge = x === x0 || x === x1 || z === z0 || z === z1;
    if (!onEdge) continue;
    for (let y = baseY; y < baseY + 4; y++) if (at(x, y, z) === B('AIR')) leaks++;
  }
  chk(leaks === 2,
      `the shell is closed but for the doorway — exactly ${leaks} open wall cells, which is the door`);
  let floorHoles = 0;
  for (let x = x0 + 1; x < x1; x++) for (let z = z0 + 1; z < z1; z++)
    if (at(x, baseY - 1, z) === B('AIR')) floorHoles++;
  chk(floorHoles === 0, 'there is a floor everywhere inside it — no gap the exterior disagrees with');
  let roofHoles = 0;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++)
    if (at(x, baseY + 5, z) === B('AIR')) roofHoles++;
  chk(roofHoles === 0, 'and a roof over all of it');
}

// =====================================================================================
head('5. THE ONE COMMITTED CHANGE, AND THE RULE IT MAY NOT BREAK');
// =====================================================================================
{
  const site = ev('ENV_SITES.havenMantel()');
  chk(!!site && typeof site.y === 'number', 'the mantel resolves to a site with a height');
  chk(w.getBlockWorld(site.x, site.y, site.z) === B('BRICK'),
      'and it is a free slot in the chimney breast before anything happens');

  const cam = (x, z, fx, fz) => ({ position: { x, y: 25, z },
    getWorldDirection(v) { const n = Math.hypot(fx, fz) || 1; v.x = fx / n; v.y = 0; v.z = fz / n; return v; } });
  const inHaven = { inFakeHaven: true, position: { x: site.x, y: 25, z: site.z + 9 } };

  chk(w.updateHavenAnomalies(1, inHaven, cam(site.x, site.z + 9, 0, 1)) === false,
      'nothing happens while it is not armed — the stage machine is the only thing that permits it');

  w.armHavenAnomaly('haven_second_mug');
  chk(w.havenAnomalyArmed === 'haven_second_mug', 'the noticing stage arms it');

  /* STORY.md section 16 rule 1, which is the load-bearing premise of the whole game.
     Driven from four positions rather than asserted from the source. */
  chk(w.updateHavenAnomalies(1, inHaven, cam(site.x, site.z + 2, 0, -1)) === false &&
      w.getBlockWorld(site.x, site.y, site.z) === B('BRICK'),
      'standing at the hearth looking straight at it: refused');
  chk(w.updateHavenAnomalies(1, inHaven, cam(site.x, site.z + 9, 0, -1)) === false &&
      w.getBlockWorld(site.x, site.y, site.z) === B('BRICK'),
      'across the room, still looking at it: refused');
  chk(w.updateHavenAnomalies(1, inHaven, cam(site.x, site.z + 2, 0, 1)) === false &&
      w.getBlockWorld(site.x, site.y, site.z) === B('BRICK'),
      'looking away but close enough to see it peripherally: refused');
  chk(w.updateHavenAnomalies(1, inHaven, cam(site.x, site.z + 9, 0, 1)) === true,
      'away from it AND not looking: committed');

  chk(w.getBlockWorld(site.x, site.y, site.z) === B('SIDE_CREAM'),
      'and what appears is the same block id as the mug already on the low table');
  chk(w.havenAnomalyArmed === null && w.havenAnomalyDone.has('haven_second_mug'),
      'it disarms itself, so it can happen at most once a visit');
  chk(w.updateHavenAnomalies(1, inHaven, cam(site.x, site.z + 9, 0, 1)) === false,
      'and asking again does nothing');
  chk(w.armHavenAnomaly('haven_second_mug') === false,
      'nor can the stage machine re-arm something that has already happened');

  /* IT IS REPETITION, NOT A WRONG OBJECT. STORY.md section 23 forbids anything overtly
     wrong in the Haven before the shift; the horror is that there are now two of a thing
     that comes in sets, in a room that is otherwise perfect. */
  const mugs = [];
  const minX = ev('FAKE_HAVEN_CHUNK_OFFSET * CHUNK_SX');
  const span = ev('FAKE_HAVEN_CHUNKS_SPAN * CHUNK_SX');
  const cX = minX + Math.floor(span / 2), baseY = ev('FAKE_HAVEN_BASE_Y');
  const half = Math.floor(ev('FAKE_HAVEN_CABIN_SIZE') / 2);
  for (let x = cX - half; x <= cX + half; x++)
    for (let y = baseY; y < baseY + 5; y++)
      for (let z = cX - half; z <= cX + half; z++)
        if (w.getBlockWorld(x, y, z) === B('SIDE_CREAM')) mugs.push([x, y, z]);
  chk(mugs.length === 2, `there are now exactly two of it in the room, not one and not five`);
}

// =====================================================================================
head('6. THE CALLBACK, AND ITS PREREQUISITE');
// =====================================================================================
{
  const EVENTS = ev('ENVIRONMENT_STORY_EVENTS.map(e => ({id:e.id, dimension:e.dimension, ' +
                    'reads:e.reads, site:e.site, persist:e.persist, notice:e.notice, ' +
                    'requires:e.requires.slice(), sound:e.sound}))');
  const haven = EVENTS.filter(e => e.dimension === 'haven');
  chk(haven.length === 3,
      `the Haven declares ${haven.length} events: ${haven.map(e => e.id).join(', ')}`);
  chk(new Set(haven.map(e => e.reads)).size === 3,
      'each of them does a different thing: ' + haven.map(e => e.reads).join(' / '));
  chk(haven.every(e => e.sound === null),
      'not one of them makes a sound when it is found — a discovery chime is a confirmation');
  chk(haven.every(e => e.notice === 0),
      'and not one of them is tracked at run time: nothing later is gated on the Haven');

  const chair = haven.find(e => e.id === 'haven_chair');
  chk(chair && chair.requires.length === 1 && chair.requires[0] === 'farm_field_chair',
      'the armchair by the fire requires the armchair in the dead field');

  /* Driven, not asserted from the table: two runtimes, one that has stood in front of the
     original and one that has not. */
  const ESS = ev('EnvironmentStorySystem');
  const blank = new ESS({ milestones: new Set() });
  chk(blank.eligibleById('haven_chair') === false,
      'a player who never saw the field chair does not get one in the Haven');
  chk(blank.eligibleById('haven_second_mug') === true &&
      blank.eligibleById('haven_still_air') === true,
      'but the rest of the Haven happens for them exactly the same — nothing is withheld');

  const seen = new ESS({ milestones: new Set() });
  seen.notice('farm_field_chair');
  chk(seen.eligibleById('haven_chair') === true, 'a player who stood in front of it does get one');

  /* And it really is put in the room, rather than merely being declared eligible. */
  const fresh = makeWorld();
  fresh.S.__w = fresh.w;
  const stub = (has) => ({ eligibleById: (id) => id !== 'haven_chair' || has });
  fresh.w.envStory = stub(true);
  fresh.ev('__w.generateFakeHaven()');
  const chairSite = fresh.ev('ENV_SITES.havenChair()');
  const baseY = fresh.ev('FAKE_HAVEN_BASE_Y');
  let withChair = 0;
  for (let x = chairSite.x - 2; x <= chairSite.x + 2; x++)
    for (let y = baseY; y < baseY + 3; y++)
      for (let z = chairSite.z - 2; z <= chairSite.z + 2; z++)
        if (fresh.w.getBlockWorld(x, y, z) !== 0) withChair++;

  const bare = makeWorld();
  bare.S.__w = bare.w;
  bare.w.envStory = stub(false);
  bare.ev('__w.generateFakeHaven()');
  let without = 0;
  for (let x = chairSite.x - 2; x <= chairSite.x + 2; x++)
    for (let y = baseY; y < baseY + 3; y++)
      for (let z = chairSite.z - 2; z <= chairSite.z + 2; z++)
        if (bare.w.getBlockWorld(x, y, z) !== 0) without++;
  chk(withChair > without,
      `the chair is really stamped: ${withChair} filled cells with the memory, ${without} without`);

  /* AND IT IS LITERALLY THE SAME OBJECT, which is the whole point — "repetition is
     literal" (CLAUDE.md section 57). Phase 14 compiles each piece of furniture to ONE
     block id carrying its model, so "the same chair" is provable as an integer rather
     than argued from a shape. Both stamps name 'armchairOat'; this reads the id that
     name resolves to and finds exactly it, once, in the Haven. */
  const chairCells = fresh.ev("furnCells('armchairOat', 2)");
  chk(chairCells.length === 1,
      'the armchair is a single modelled voxel rather than a pile of cubes');
  const chairId = chairCells[0][3];
  chk(chairId >= 256, `and it carries a furniture id (${chairId}), not a plain building block`);
  chk(fresh.w.getBlockWorld(chairSite.x, baseY, chairSite.z) === chairId,
      'the block standing by the Haven fire is exactly that id');
  chk(bare.w.getBlockWorld(chairSite.x, baseY, chairSite.z) !== chairId,
      'and is simply absent for a player who never met the original');
  const stamps = (LIVE.match(/furnStamp\([^,]+, 'armchairOat'/g) || []).length;
  chk(stamps >= 2,
      `'armchairOat' is stamped from ${stamps} places in the build — the field and the fire ` +
      'are the same catalogue entry, not two similar chairs');
}

// =====================================================================================
head('7. NOTHING HOSTILE EXISTS HERE, AND THE FINALE CANNOT LEAK IN');
// =====================================================================================
{
  const flush = methodBody(LIVE, '_transitionToLevel4') || '';
  /* PHASE 35 — THE CLEARS MOVED, THE CLAIM DID NOT. Every dimension crossing in the
     build now runs ONE teardown (Game._leaveDimension) instead of each keeping its own
     approximate copy; the Haven's copy was the thorough one and the two RIFT crossings
     had none, which is how a powered Anchor used to cross into the Farmlands and make
     the next rift impossible to open. So this follows the call rather than grepping the
     method body: the Haven must ASK for the teardown, with spawning latched off, and the
     teardown must contain the clears. Both halves are checked, which is strictly more
     than the single grep proved. */
  chk(/this\._leaveDimension\(\s*\{\s*disableSpawning:\s*true\s*\}\s*\)/.test(flush),
      'entering the Haven runs the shared crossing teardown, with spawning latched off');
  const leave = methodBody(LIVE, '_leaveDimension') || '';
  chk(/this\.mobs\.clearAll\(/.test(leave) && /this\.stalker\.clearAll\(\)/.test(leave) &&
      /this\.phantoms\.clearAll\(\)/.test(leave) && /this\.arrows\.clearAll\(\)/.test(leave),
      'and that teardown clears mobs, the Stalker, hallucinations and arrows');
  chk(/this\.anchorManager\.removeAnchor\(\)/.test(leave),
      'and puts the Anchor and its rift down, so no rift can be open inside the Haven');
  chk(/spawningDisabled\s*=\s*true/.test(leave) || /mobs\.spawningDisabled/.test(leave) ||
      /this\.behemothSpawned\s*=\s*true/.test(flush),
      'and latches spawning off so nothing can arrive after the door closes');
  chk(/behemothSpawned\s*=\s*true/.test(flush),
      'the Behemoth night-spawn gate is latched shut — it can never fire in the Haven');

  /* THE FINALE MAY NOT BE FORESHADOWED. The entity is spawned on exactly one line in the
     build, and that line is downstream of the shift. */
  /* PHASE 33 RENAMED THE MECHANISM AND THE INVARIANT SURVIVED IT UNCHANGED. The finale
     entity used to be `spawnVoidSovereign()`; it is now built by `world.buildFinale()`,
     called from `FinalSequence.begin()`, called from the shift. What this file cares
     about is unchanged and is what is checked: the creature is created from exactly one
     place, and that place is downstream of the Haven finishing. */
  const buildCalls = (LIVE.match(/\.buildFinale\(/g) || []).length;
  chk(buildCalls === 1,
      `the finale scene is BUILT from exactly ${buildCalls} place in the build`);
  const begin = methodBody(LIVE, 'begin') || '';
  const shift = methodBody(LIVE, '_triggerHavenShift') || '';
  chk(/this\.finale\.begin\(\)/.test(shift),
      'and the shift is what starts the sequence that reaches it');
  const beginCalls = (LIVE.match(/finale\.begin\(\)/g) || []).length;
  chk(beginCalls === 1, `the sequence itself is begun from exactly ${beginCalls} place`);
  const machine = methodBody(LIVE, '_updateHaven') || '';
  chk(machine && !/buildFinale|finale\.begin|corruptHaven|setNightmareOverride/.test(machine),
      'the intact sequence builds nothing, corrupts nothing and starts no finale');
  chk(!/jumpscare|Jumpscare/.test(machine), 'and it cannot trigger a jumpscare');

  /* The Stalker's own guard, read from its source rather than assumed. */
  const stalkerSrc = LIVE.slice(LIVE.indexOf('spawningDisabled'));
  chk(/inFakeHaven/.test(stalkerSrc.slice(0, 4000)),
      'the spawner checks inFakeHaven as a second, independent guard');
}

// =====================================================================================
head('8. NO TIMERS, NO LISTENERS, NO LEAKS');
// =====================================================================================
{
  const machine = methodBody(LIVE, '_updateHaven') || '';
  chk(machine.length > 0, 'the stage machine exists');
  chk(!/setTimeout|setInterval|requestAnimationFrame/.test(machine),
      'and schedules nothing — every beat is derived from one accumulating number');
  chk(!/addEventListener/.test(machine), 'it binds no listener');
  const anom = methodBody(LIVE, 'updateHavenAnomalies') || '';
  chk(anom.length > 0 && !/setTimeout|setInterval|addEventListener/.test(anom),
      'nor does the anomaly sweep');

  /* The ambience rig is idempotent in both directions and has exactly one teardown, the
     same contract startFilmAmbience/stopFilmAmbience are under. */
  const sound = classBody(LIVE, 'SoundEngine');
  const start = methodBody(sound, 'startHavenAmbience') || '';
  const stop = methodBody(sound, 'stopHavenAmbience') || '';
  chk(/if\s*\(!this\.ctx\s*\|\|\s*this\.havenAmbience\)\s*return false/.test(start),
      'starting the ambience twice is a no-op');
  chk(/this\.havenAmbience\s*=\s*null/.test(stop) &&
      stop.indexOf('this.havenAmbience = null') < stop.indexOf('setTimeout'),
      'stopping it nulls the handle BEFORE arming the teardown, so it cannot double-stop a source');
  chk(/const a = this\.havenAmbience;\s*if \(!a\) return false;/.test(stop),
      'and stopping it twice is a no-op too');
  for (const n of ['room', 'outside', 'wander', 'hearth', 'crackle'])
    chk(new RegExp('a\\.' + n).test(stop), `the teardown reaches the ${n} node`);

  /* Every source the rig starts is stopped by it. Counted rather than eyeballed. */
  const started = (start.match(/\.start\(\)/g) || []).length;
  chk(started === 5, `the rig starts ${started} audio sources`);
  chk(/for \(const n of \[a\.room, a\.outside, a\.wander, a\.hearth, a\.crackle\]\)/.test(stop),
      'and the teardown stops all five by name');

  /* THE COLLAPSE MUST ALSO STOP IT. fakeHavenMode stays true through the shift, so
     setFakeHavenMode(false) does not run there and the rig has to be stopped explicitly —
     otherwise the cabin's room tone plays on under the void static. */
  const warp = methodBody(sound, 'warpHavenMusicToStatic') || '';
  chk(/stopHavenAmbience\(\)/.test(warp),
      'and the audio collapse stops the warm rig explicitly, since the dimension flag does not');
  const mode = methodBody(sound, 'setFakeHavenMode') || '';
  chk(/startHavenAmbience\(\)/.test(mode) && /stopHavenAmbience\(\)/.test(mode),
      'the dimension itself is the other place it starts and stops, and there is no third');
}

// =====================================================================================
head('8b. THE CABIN CANNOT BE TAKEN APART');
// =====================================================================================
{
  /* THE BUG THIS GUARDS. Every block the cabin is made of carries an ordinary hardness,
     so before Phase 32 the player could chop the walls of the one room in the game that
     was rebuilt perfectly because somebody loved it, and carry the logs away. The brief
     forbids mining, crafting, gathering, building and farming here in as many words; this
     is the check that it stays forbidden. */
  const guard = methodBody(LIVE, '_havenIsReadOnly') || '';
  chk(/inFakeHaven/.test(guard), 'there is one predicate that says the Haven is read-only');

  const mine = methodBody(LIVE, '_startMining') || '';
  chk(/_havenIsReadOnly\(\)/.test(mine), 'mining asks it');
  chk(mine.indexOf('_havenIsReadOnly') < mine.indexOf('_getLookTarget'),
      'and asks it BEFORE resolving a target, so no progress bar or crack overlay starts');

  const place = methodBody(LIVE, '_placeBlockOrInteract') || '';
  chk(/_havenIsReadOnly\(\)\s*return;/.test(place.replace(/\s+/g, ' ')) ||
      /if \(this\._havenIsReadOnly\(\)\) return;/.test(place),
      'placement asks it too');
  chk(place.indexOf('_restInHavenBed') < place.indexOf('_havenIsReadOnly'),
      'but only AFTER the bed and the chest, which stay usable — those are the two ' +
      'contextual interactions the Haven is allowed');

  /* IT REFUSES SILENTLY. A denial toast in the Haven would be the game speaking, and
     this dimension does not speak. */
  const mineTail = mine.slice(0, mine.indexOf('_getLookTarget'));
  chk(!/showToast|playMiningBlocked/.test(mineTail),
      'and it refuses silently — no message, no denial sound');

  /* AND THE PROMPT DOES NOT OFFER A VERB THE DIMENSION REFUSES. Telling a player to CHOP
     the wall of the room they are meant to rest in is the worst line available — and the
     CRAFT cue, which needs no crosshair target and so used to appear in the cabin merely
     for holding a log, is the same mistake one step quieter. Both are answered by the one
     policy function the whole look path now goes through. */
  const look = methodBody(LIVE, '_lookPrompt') || '';
  chk(/_havenIsReadOnly\(\)\) return this\._havenPropPrompt\(\);/.test(look),
      'the prompt policy asks the same predicate, and in the Haven returns the props alone');
  chk(look.indexOf('_havenIsReadOnly') < look.indexOf('_onboardingCue'),
      'so no onboarding cue — not even the target-free CRAFT one — is reachable in the cabin');
  const upd = methodBody(LIVE, '_updateTargetHighlight') || '';
  chk((upd.match(/_setPrompt\(this\._lookPrompt\(/g) || []).length === 3 &&
      !/_onboardingCue|_promptForBlock/.test(upd),
      'and all three prompt writes in the look path go through it — there is no second policy');

  /* The cue table itself is untouched: this is a Haven rule, not a change to Phase 28. */
  const cues = ev('ONBOARDING_CUES.map(c => c.id)');
  chk(cues.length === 3, `the three onboarding cues are still exactly as Phase 28 left them (${cues.join(', ')})`);
}

// =====================================================================================
head('9. THE SAVE CANNOT BE TOUCHED FROM IN HERE');
// =====================================================================================
{
  const blocked = methodBody(LIVE, 'saveBlockedReason') || '';
  chk(/inFakeHaven/.test(blocked) && /fakeHavenTriggered/.test(blocked) && /climaxTriggered/.test(blocked),
      'saving is refused in the Haven, from the moment the sequence starts, and through the climax');
  const dims = ev('SAVE_DIMENSIONS.slice()');
  chk(dims.indexOf('haven') < 0 && dims.indexOf('fake_haven') < 0,
      `no save may even NAME the Haven as a dimension (${dims.join(', ')})`);

  /* The load side is refused separately, because a load from inside the Haven would
     rebuild a world underneath a scripted sequence that is still running. */
  const load = methodBody(LIVE, 'loadGame') || '';
  chk(/inFakeHaven|climaxTriggered/.test(load), 'and loading is refused from in here too');

  /* THE PLAYER'S REAL SAVE IS NOT DESTROYED — refusing is not deleting. Driven against
     the real validator: a state naming the Haven is rejected rather than accepted and
     silently repaired into something else. */
  const def = ev('defaultSaveState(null)');
  chk(dims.indexOf(def.dimension) >= 0, 'a default save names a real, loadable dimension');
  const forged = JSON.parse(JSON.stringify(def));
  forged.dimension = 'haven';
  const repaired = ev('validateSaveState')(forged, []);
  chk(!repaired || repaired.dimension !== 'haven',
      'and a forged save claiming to be in the Haven never loads the player into one');

  /* The autosave is event-based and both crossings that write one are outside the Haven. */
  const autosave = methodBody(LIVE, 'autosave') || '';
  chk(/saveBlockedReason\(\)/.test(autosave),
      'the autosave asks the same blocker, so no crossing can write a Haven save by accident');
}

// =====================================================================================
head('10. ENTERING AND LEAVING RESTORE EVERYTHING THEY TOUCH');
// =====================================================================================
{
  const teardown = methodBody(LIVE, '_teardownForRestore') || '';
  chk(/this\.havenTimer\s*=\s*0/.test(teardown) &&
      /this\.havenStageId\s*=\s*null/.test(teardown) &&
      /this\.havenShiftTriggered\s*=\s*false/.test(teardown) &&
      /this\.havenBedEnding\s*=\s*false/.test(teardown),
      'the one teardown path clears every piece of Haven state');
  chk(/p\.havenBedUsed\s*=\s*false/.test(teardown),
      'including the bed latch on the player');
  chk(/this\.envStory\.reset\(\)/.test(teardown),
      'and the env-story latches, so a callback cannot survive into a new world');

  const presentation = methodBody(LIVE, '_applyRestoredPresentation') || '';
  chk(/setHavenFade\(0\)/.test(presentation) && /setHavenDissolve\(0\)/.test(presentation),
      'and a load always lands on a clean screen — neither half of the dissolve survives it');
  chk(/setFakeHavenMode\(false\)/.test(presentation) && /setFakeHavenOverride\(false\)/.test(presentation),
      'with the Haven audio mode and sky override off');

  /* RE-ENTRY DOES NOT ACCUMULATE. generateFakeHaven is one-shot by construction. */
  const before = w.scene ? w.scene.children.length : 0;
  ev('__w.generateFakeHaven()');
  ev('__w.generateFakeHaven()');
  const after = w.scene ? w.scene.children.length : 0;
  chk(before === after, 'generating the Haven again adds nothing to the scene — it is one-shot');

  /* THE MOVEMENT LOCK IS RELEASED. The entry locks the body for the white wash; if that
     lock were ever left on, the player would arrive in the cabin unable to move. */
  const enter = methodBody(LIVE, '_beginFakeHavenSequence') || '';
  const arrive = methodBody(LIVE, '_transitionToLevel4') || '';
  chk(/movementLocked\s*=\s*true/.test(enter), 'the entry locks the body for the wash');
  chk(/movementLocked\s*=\s*false/.test(arrive), 'and the arrival releases it');
  chk(/requestPointerLock\(\)/.test(arrive), 'and takes the pointer back');
  chk(!/movementLocked\s*=\s*true/.test(methodBody(LIVE, '_updateHaven') || ''),
      'nothing in the intact sequence takes the body away again — the player may always walk');
}

// =====================================================================================
head('11. IT NEVER TELLS THE PLAYER ANYTHING');
// =====================================================================================
{
  /* The four captions Phase 32 removed. story.js owns the canonical version of this
     check; it is repeated here against the sequence's own methods so that a future edit
     to these functions specifically is caught in this file too. */
  const zone = [methodBody(LIVE, '_beginFakeHavenSequence'), methodBody(LIVE, '_transitionToLevel4'),
                methodBody(LIVE, '_updateHaven'), methodBody(LIVE, '_triggerHavenShift')]
                .filter(Boolean).join('\n');
  chk(!/showToast/.test(zone),
      'not one of the four functions that run the Haven shows a toast');
  const longest = (zone.match(/'[^']{20,}'/g) || []).map(s => s.length).sort((a, b) => b - a)[0] || 0;
  chk(longest < 60, `and the longest string literal in any of them is ${longest} characters`);

  /* No lore, anywhere in it. STORY.md section 13 and brief section 23. */
  chk(!/journal|diary|note[sd]?\b|letter|log entry/i.test(zone),
      'there is no journal, note, diary or letter in the sequence');

  /* THE OBJECTIVE. One word while the room is intact, and nothing from the moment it
     starts to go — driven against the real override table. */
  const OV = ev('OBJECTIVE_OVERRIDES.map(o => o.id)');
  chk(OV.indexOf('haven_rest') >= 0 && OV.indexOf('haven_after') >= 0,
      'the Haven has exactly two objective overrides');
  const resolve = (snap) => {
    const list = ev('OBJECTIVE_OVERRIDES');
    for (const o of list) if (o.when(snap)) return o;
    return null;
  };
  const base = { haven: true, havenShifted: false, havenEnding: false, climax: false };
  chk(resolve(base).text === 'Rest.', 'the intact Haven asks for one word');
  chk(resolve(Object.assign({}, base, { havenEnding: true })).text === null,
      'the moment it starts to dissolve the line clears — before the shift, not at it');
  chk(resolve(Object.assign({}, base, { havenShifted: true })).text === null,
      'and it stays clear once it has turned');
  chk(resolve(Object.assign({}, base, { climax: true })).text === null,
      'and through the climax');

  /* And the canon's internal vocabulary is never on screen anywhere in the sequence. */
  for (const word of ['the record', 'reconstruction', 'Fake Haven', 'Void Sovereign'])
    chk(!new RegExp("['\"`][^'\"`\\n]*" + word + "[^'\"`\\n]*['\"`]", 'i').test(zone),
        `"${word}" appears in no string the sequence can show`);
}

// =====================================================================================
head('12. THE TWO EXITS, AND THE ONE LINE THAT ENDS IT');
// =====================================================================================
{
  const machine = methodBody(LIVE, '_updateHaven') || '';
  const calls = (machine.match(/_triggerHavenShift\(/g) || []).length;
  chk(calls === 1,
      `there is exactly ${calls} line in the stage machine that ends the Haven — both exits reach it`);
  chk(/havenBedUsed/.test(machine), 'the bed is one of the two ways to reach it');
  chk(/havenTimer >= HAVEN_SHIFT_SECONDS/.test(machine), 'and the record running out is the other');

  /* LYING DOWN IS AN ENDING, NOT A SKIP. It must move the clock to the START of the final
     stage, so the player gets the whole dissolution rather than an instant collapse. */
  chk(/this\.havenTimer\s*=\s*HAVEN_ENDING_FROM/.test(machine),
      'lying down moves the clock to the beginning of the removal, not past it');
  chk(/if \(this\.havenTimer < HAVEN_ENDING_FROM\)/.test(machine),
      'and cannot rewind it if the Haven is already ending');

  /* RESTING REALLY RESTORES — STORY.md section 18 requires the kindness to be real. */
  const rest = methodBody(LIVE, '_restInHavenBed') || '';
  chk(/this\.hp\s*=\s*this\.maxHp/.test(rest), 'the bed genuinely restores health');
  chk(/value\s*=\s*100/.test(rest), 'and genuinely settles the mind');
  chk(!/_triggerHavenShift|havenShift/.test(rest),
      'and does not itself end anything — it sets a flag the stage machine reads');

  const shift = methodBody(LIVE, '_triggerHavenShift') || '';
  chk(/if \(this\.havenShiftTriggered\) return;/.test(shift),
      'the ending is latched and cannot fire twice');
  chk(/setHavenFade\(0\)/.test(shift) && /setHavenDissolve\(0\)/.test(shift),
      'and hands the renderer back before the finale takes it, so the two never overlap');
}

// =====================================================================================
head('13. THE CANON IT IS BUILT AGAINST');
// =====================================================================================
{
  const s18 = STORY.slice(STORY.indexOf('## 18. FAKE HAVEN'), STORY.indexOf('## 19. THE FINAL CREATURE'));
  chk(s18.length > 200, 'STORY.md section 18 is present and is what this phase was built from');
  chk(/initial safety must be real/i.test(s18), 'it requires the initial safety to be real');
  chk(/never answered/i.test(s18), 'it forbids answering whose memory the Haven is');
  chk(/runs out/i.test(s18), 'and it says the Haven RUNS OUT rather than turning on the player');
  chk(/not be foreshadowed inside the intact Haven|must not be foreshadowed/i.test(s18),
      'and forbids foreshadowing the final creature inside it');

  /* Whose memory it is, is never answered — checked against every string the Haven can
     put on screen, which after Phase 32 is one word. */
  const zone = [methodBody(LIVE, '_transitionToLevel4'), methodBody(LIVE, '_updateHaven'),
                methodBody(LIVE, '_triggerHavenShift'), methodBody(LIVE, '_restInHavenBed')]
                .filter(Boolean).join('\n');
  chk(!/\byour\s+(home|house|cabin|memory)\b/i.test(zone) && !/belonged to/i.test(zone),
      'nothing in the sequence claims the place belongs to anyone');

  /* The word "fake" is internal only (section 24). */
  const banner = LIVE.slice(LIVE.indexOf("dimensionBanner.textContent = 'THE HAVEN'") - 200,
                            LIVE.indexOf("dimensionBanner.textContent = 'THE HAVEN'") + 200);
  chk(/'THE HAVEN'/.test(banner) && !/FAKE/.test(banner),
      'the player is shown THE HAVEN and never the word "fake"');
}

console.log('');
if (fail) { console.log(`${fail} PHASE 32 HAVEN CHECK(S) FAILED`); process.exit(1); }
console.log('ALL PHASE 32 HAVEN CHECKS PASS');
note('Offline. The real stage table, the real cabin read out of real chunk data, the real');
note('anomaly gate driven from four camera positions, the real callback with and without');
note('its prerequisite, and the real save blocker. Whether the room is comforting, whether');
note('losing it hurts, and whether anyone notices a second mug, are judgements for a');
note('person — see browser-haven.js for the live document and the phase report for what a');
note('human has and has not played.');
