/* PHASE 31 — ENVIRONMENTAL STORYTELLING.

   WHAT THIS FILE CAN AND CANNOT PROVE.

   It boots the REAL script and drives the REAL generator: real chunks, real farmsteads,
   real Suburbia lots, the real Haven cabin. Where it asserts that an object is there, it
   has read the object out of chunk data at a coordinate the shipped site table resolved.
   Where it asserts an object is NOT there, it has generated the same ground twice with
   two different runtime states and compared.

   IT CANNOT PROVE ANY OF IT WORKS. Whether a player notices the same chair beside a third
   farm gate, whether the photograph landing one figure short is unsettling or invisible,
   and whether a lapsed anchor in a suburban back yard reads as recognition or as clutter,
   are questions for a person. The phase report says who has and has not answered them. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld, genRegion, blockAt } = require('./harness/util.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
                      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const LIVE = strip(SRC);

/* One class body, brace-matched — the same helper hud.js, menu.js and opening.js use. */
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

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

console.log('booting the real script...');
const A = makeWorld();
const w = A.w, ev = A.ev;
const BLOCK = ev('BLOCK');
const SITES = ev('ENV_SITES');
const EVENTS = ev('ENVIRONMENT_STORY_EVENTS');
const IDS = ev('ENV_STORY_IDS');
const READS = ev('ENV_READS');
const PERSIST = ev('ENV_PERSIST');
const DIMENSIONS = ev('ENV_DIMENSIONS');
const ESS = ev('EnvironmentStorySystem');
const validate = ev('validateEnvStoryEvents');
const MILESTONES = ev('PROGRESSION_MILESTONE_IDS');
const YARD = ev('ENV_FARM_YARD');
const SYSTEM_BODY = classBody(LIVE, 'EnvironmentStorySystem');

/* A world with a runtime in a chosen state. Every "is it there / is it not there" check
   below builds one of these rather than mutating a shared world, because a chunk that has
   already generated does not re-stamp — which is the mechanic, not a limitation. */
function worldWith({ noticed = [], milestones = [] } = {}) {
  const B = makeWorld();
  const sys = new (B.ev('EnvironmentStorySystem'))({ milestones: new Set(milestones) });
  for (const id of noticed) sys.notice(id);
  B.w.envStory = sys;
  return B;
}
const OW_SURF = (world, x, z) => world._overworldSurfaceY(x, z);

// =====================================================================================
// 1. THE VOCABULARY
// =====================================================================================
head('1. THE VOCABULARY, NOT THE CONTENT');
{
  chk(Object.isFrozen(EVENTS) && EVENTS.length >= 8,
      `the event table is a frozen list of ${EVENTS.length} events`);
  chk(new Set(IDS).size === IDS.length, 'every event has a unique id');
  note('events: ' + IDS.join(', '));

  chk(validate(EVENTS, MILESTONES).length === 0,
      'the shipped table passes its own audit with no problems');

  /* THE CATEGORIES ARE CLOSED. The value of a vocabulary is that it can be exhausted;
     an event whose `reads` is a free-form string is an event nobody has classified. */
  const readValues = new Set(Object.keys(READS).map(k => READS[k]));
  chk(EVENTS.every(e => readValues.has(e.reads)),
      `every event names one of the ${readValues.size} closed storytelling categories`);
  const used = new Set(EVENTS.map(e => e.reads));
  chk(used.size >= 5, `and the content exercises ${used.size} of them: ${[...used].sort().join(', ')}`);

  const persistValues = new Set(Object.keys(PERSIST).map(k => PERSIST[k]));
  chk(EVENTS.every(e => persistValues.has(e.persist)), 'every event declares a persistence class');
  chk(EVENTS.every(e => DIMENSIONS.indexOf(e.dimension) >= 0), 'and a dimension by name, never by id');
  for (const d of ['overworld', 'farmlands', 'suburbia', 'haven']) {
    chk(EVENTS.some(e => e.dimension === d), `${d} has at least one`);
  }

  /* THE SITE INDIRECTION IS THE ERA 2 SEAM, so it has to actually be one: no event may
     carry a coordinate of its own. */
  chk(EVENTS.every(e => e.site === null || typeof e.site === 'string'),
      'an event names a PLACE, never a coordinate — every site is a key into ENV_SITES');
  const keys = Object.keys(SITES);
  chk(keys.every(k => typeof SITES[k] === 'function'), `and all ${keys.length} sites are functions`);
  chk(keys.every(k => { const r = SITES[k](w); return r === null || (typeof r.x === 'number' && typeof r.z === 'number'); }),
      'each of which returns {x, z} or null, and never throws');

  /* THE RARITY IS THE DESIGN. STORY.md section 23 lists roughly thirty opportunities and
     the brief says quality over volume; a table that had grown to fifty would mean the
     world was full of wrong things, which is the opposite of the intended effect. */
  chk(EVENTS.length <= 16, `and there are ${EVENTS.length} of them, not fifty — rarity is the mechanic`);
}

// =====================================================================================
// 2. INVALID DATA FAILS SAFE
// =====================================================================================
head('2. MALFORMED DEFINITIONS FAIL SAFE');
{
  const good = EVENTS[0];
  const bad = (over) => [Object.assign({}, good, over)];
  const cases = [
    ['not a list at all', 'nope'],
    ['an entry that is not an object', [42]],
    ['an entry with no id', bad({ id: undefined })],
    ['an unknown dimension', bad({ dimension: 'atlantis' })],
    ['an unknown storytelling category', bad({ reads: 'vibes' })],
    ['an unknown persistence class', bad({ persist: 'forever' })],
    ['a site that is not in the table', bad({ site: 'nowhere' })],
    ['a negative notice radius', bad({ notice: -3 })],
    ['a tracked event with no site', bad({ site: null, notice: 8 })],
    ['a tracked event whose latch is not saved', bad({ persist: 'generated', notice: 8 })],
    ['requires that is not a list', bad({ requires: 'ow_holding' })],
    ['a prerequisite that does not exist', bad({ requires: ['ow_atlantis'] })],
    ['an event that requires itself', bad({ requires: [good.id] })],
    ['a milestone gate this build does not have', bad({ after: 'notAMilestone' })],
    ['a sound that is not a method name', bad({ sound: 7 })],
  ];
  let caught = 0;
  for (const [label, table] of cases) {
    let problems = null, threw = false;
    try { problems = validate(table, MILESTONES); } catch (e) { threw = true; }
    if (!threw && problems.length > 0) caught++;
    else chk(false, `the audit rejects ${label}` + (threw ? ' (it THREW instead)' : ' (it passed)'));
  }
  chk(caught === cases.length, `the audit rejects all ${cases.length} kinds of malformed definition, and throws on none of them`);

  const dup = validate([good, good], MILESTONES);
  chk(dup.some(p => /duplicate/.test(p)), 'and a duplicate id is a problem rather than a silent overwrite');

  /* A DEAD PREREQUISITE. An event gated on something the runtime never tracks can never
     appear, which is content nobody would ever notice was missing. */
  const dead = validate([
    Object.assign({}, good, { id: 'a', notice: 0, site: null, persist: 'generated', requires: [] }),
    Object.assign({}, good, { id: 'b', requires: ['a'] }),
  ], MILESTONES);
  chk(dead.some(p => /never tracked/.test(p)),
      'and a callback whose original is never tracked is caught — it could never have appeared');

  /* THE RUNTIME DROPS BAD ENTRIES rather than repairing or throwing, so a typo in a
     future event cannot take chunk generation down with it. */
  const sys = new ESS(null);
  chk(Array.isArray(sys.problems) && sys.problems.length === 0, 'the live runtime reports no problems with the shipped table');
  chk(sys.events.length === EVENTS.length, 'and keeps every one of its events');
  chk(/this.problems = validateEnvStoryEvents/.test(SYSTEM_BODY) && /filter\(e => e && e\.id && !broken\.has/.test(SYSTEM_BODY),
      'the constructor audits the table and DROPS what fails rather than repairing it');
}

// =====================================================================================
// 3. DETERMINISM
// =====================================================================================
head('3. SAME SEED, SAME STATE, SAME RESULT');
{
  const all = IDS.slice();
  const P = worldWith({ noticed: all, milestones: MILESTONES });
  const Q = worldWith({ noticed: all, milestones: MILESTONES });
  const site = SITES.owHolding();
  const x0 = site.x - 24, z0 = site.z - 24, x1 = site.x + 24, z1 = site.z + 24;
  const ca = genRegion(P.w, x0, z0, x1, z1);
  /* World Q generates the SAME chunks in the reverse order — the seam test. A stamper
     that read a neighbour it happened to have generated first would diverge here. */
  const cb = [];
  {
    const c0 = Math.floor(x0 / 16), c1 = Math.floor(x1 / 16);
    const d0 = Math.floor(z0 / 16), d1 = Math.floor(z1 / 16);
    for (let cx = c1; cx >= c0; cx--) for (let cz = d1; cz >= d0; cz--) cb.push(Q.w._generateChunk(cx, cz));
  }
  const mb = new Map(cb.map(c => [c.cx + ',' + c.cz, c]));
  let bad = 0;
  for (const c of ca) {
    const o = mb.get(c.cx + ',' + c.cz);
    if (!o) { bad++; continue; }
    for (let i = 0; i < c.data.length; i++) if (c.data[i] !== o.data[i]) { bad++; break; }
  }
  chk(bad === 0, `${ca.length} chunks around a story site are byte-identical across two worlds generating in opposite orders`);

  /* AND RELOADING IS THE SAME AS LOADING. A chunk that streams out and back must come
     back the same, which is what makes the whole thing GENERATED rather than state. */
  const key = P.w.key(Math.floor(site.x / 16), Math.floor(site.z / 16));
  const before = Array.from(P.w.chunks.get(key).data);
  P.w.chunks.delete(key);
  const after = P.w._generateChunk(Math.floor(site.x / 16), Math.floor(site.z / 16)).data;
  let same = before.length === after.length;
  for (let i = 0; same && i < after.length; i++) if (before[i] !== after[i]) same = false;
  chk(same, 'and a story chunk unloaded and regenerated comes back identical — none of this is state');
}

// =====================================================================================
// 4. THE OBJECTS ARE ACTUALLY THERE
// =====================================================================================
head('4. FIRST VISIT — THE OBJECTS ARE IN THE WORLD');
{
  const P = worldWith({ noticed: IDS.slice(), milestones: MILESTONES });
  const W = P.w;

  // --- the held place
  const h = SITES.owHolding();
  genRegion(W, h.x - 12, h.z - 12, h.x + 12, h.z + 12);
  const base = Math.max(OW_SURF(W, h.x, h.z), ev('SEA_LEVEL') + 2);
  let pad = 0;
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    if (blockAt(W, h.x + dx, base - 1, h.z + dz) === BLOCK.DIRT) pad++;
  }
  chk(pad >= 44, `the held place is a levelled square of bare earth (${pad}/49 cells, the centre being scorched)`);
  chk(blockAt(W, h.x, base - 1, h.z) === BLOCK.ASH_GROUND, 'with a scorched centre where something stood');
  const planks = [[-2, 0], [2, 0], [0, -2], [0, 2]].filter(([dx, dz]) => blockAt(W, h.x + dx, base, h.z + dz) === BLOCK.OAK_LOG).length;
  chk(planks === 4, 'four planks laid flat at the cardinal points — the Anchor recipe, unlit');
  const spent = [[-3, -3], [3, -3], [-3, 3], [3, 3]].filter(([dx, dz]) => blockAt(W, h.x + dx, base, h.z + dz) === BLOCK.STICKS).length;
  chk(spent === 4, 'and four spent sticks at the corners, where the light was');
  /* IT IS NOT AN ANCHOR. A found working anchor would hand the player the authority
     STORY.md section 7 says they have to assert for themselves. */
  let anchors = 0;
  for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) for (let dy = -1; dy <= 4; dy++)
    if (blockAt(W, h.x + dx, base + dy, h.z + dz) === BLOCK.SAFEHOUSE_ANCHOR) anchors++;
  chk(anchors === 0, 'and NOT one Safehouse Anchor block anywhere in it — it cannot be lit, fed or used');

  // --- the released one: the same square, and nothing on it
  const r = SITES.owReleased();
  genRegion(W, r.x - 12, r.z - 12, r.x + 12, r.z + 12);
  const rbase = Math.max(OW_SURF(W, r.x, r.z), ev('SEA_LEVEL') + 2);
  let rpad = 0, robj = 0;
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    if (blockAt(W, r.x + dx, rbase - 1, r.z + dz) === BLOCK.DIRT) rpad++;
    if (blockAt(W, r.x + dx, rbase, r.z + dz) !== BLOCK.AIR) robj++;
  }
  chk(rpad >= 44 && blockAt(W, r.x, rbase - 1, r.z) === BLOCK.ASH_GROUND,
      `the released place is the SAME square with the same scorch (${rpad}/49)`);
  chk(robj === 0, 'and nothing standing on it at all — that absence is the whole object');

  // --- the crossing
  const c = SITES.owCrossing();
  genRegion(W, c.x - 8, c.z - 12, c.x + 34, c.z + 12);
  let pressed = 0;
  for (let i = 0; i < 26; i++) {
    const x = c.x + i, z = c.z + Math.round(Math.sin(i * 0.23) * 2);
    if (blockAt(W, x, OW_SURF(W, x, z), z) === BLOCK.LEAF_LITTER) pressed++;
  }
  chk(pressed >= 24, `the crossing is ${pressed} cells of pressed ground in a line`);

  // --- the farm yard vocabulary
  const P2 = ev('FARM_P'), FSX = ev('FARM_SPAWN_X'), FSZ = ev('FARM_SPAWN_Z');
  let steads = 0, carried = 0, stamped = 0;
  const seen = new Map();
  for (let bx = Math.floor(FSX / P2) - 2; bx <= Math.floor(FSX / P2) + 8; bx++)
    for (let bz = Math.floor(FSZ / P2) - 4; bz <= Math.floor(FSZ / P2) + 4; bz++) {
      const st = W._farmSteadAt(bx, bz);
      if (!st) continue;
      steads++;
      if (W._farmHash(st.bx, st.bz, 771) >= ev('ENV_FARM_YARD_CHANCE')) continue;
      carried++;
      genRegion(W, st.ox - 4, st.oz - 4, st.ox + 6, st.oz + 8);
      let worn = 0;
      for (let dx = 0; dx <= 1; dx++) for (let dz = 0; dz <= 2; dz++)
        if (blockAt(W, st.ox + dx, st.padY - 1, st.oz + 1 + dz) === BLOCK.SOIL_TRAMPLED) worn++;
      if (worn === 6) stamped++;
      const idx = Math.floor(W._farmHash(st.bx * 3 + 1, st.bz * 5 + 2, 773) * YARD.length) % YARD.length;
      const sig = [];
      for (let dx = 0; dx <= 1; dx++) for (let dz = 0; dz <= 2; dz++)
        sig.push(blockAt(W, st.ox + dx, st.padY, st.oz + 1 + dz));
      const k = YARD[idx].id;
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k).push(sig.join(','));
    }
  chk(carried > 0 && stamped === carried,
      `${carried} of ${steads} farmsteads carry a yard arrangement, and every one of them is stamped`);
  /* THE RATE IS THE AUTHORED CONSTANT, NOT THIS SAMPLE. Fifteen farmsteads is far too
     few to measure a probability from, and a test that asserted on the observed share
     would fail on a different stretch of an infinite region for no reason at all. */
  chk(ev('ENV_FARM_YARD_CHANCE') < 0.4,
      `and it is a minority by construction — ${(100 * ev('ENV_FARM_YARD_CHANCE')).toFixed(0)}% of farmsteads carry one`);
  note(`  the sample above happened to be ${carried}/${steads} (${(100 * carried / steads).toFixed(0)}%)`);

  /* THE REPETITION IS LITERAL. Not "a similar chair": the same cells, the same ids, in
     the same place relative to the yard. STORY.md section 13's whole point. */
  let repeated = 0, identical = 0;
  for (const [k, sigs] of seen) {
    if (sigs.length < 2) continue;
    repeated++;
    if (sigs.every(s => s === sigs[0])) identical++;
    else note('  ' + k + ' differs between farms: ' + sigs.join(' | '));
  }
  chk(repeated > 0 && identical === repeated,
      `${repeated} arrangement(s) appear on more than one unrelated farm, and every repeat is byte-identical`);

  // --- the Haven chair, which is a callback and is covered again in section 7
  const hv = SITES.havenChair();
  W.generateFakeHaven();
  chk(blockAt(W, hv.x, ev('FAKE_HAVEN_BASE_Y') - 1, hv.z) === BLOCK.POLISHED_OAK,
      'the Haven site is a cell of the cabin floor, not a wall or a hearth');
}

// =====================================================================================
// 5. DIMENSION ISOLATION
// =====================================================================================
head('5. DIMENSION ISOLATION');
{
  const P = worldWith({ noticed: IDS.slice(), milestones: MILESTONES });
  const calls = [];
  const realStamp = P.w._envStoryStamp.bind(P.w);
  P.w._envStoryStamp = function (chunk, dim) { calls.push(dim); return realStamp(chunk, dim); };

  /* Ground the world constructor has NOT already eagerly loaded, or _generateChunk
     returns the cached chunk and the stamper is never reached. */
  genRegion(P.w, 900, 900, 932, 932);                               // Overworld
  const fx = ev('FARM_SPAWN_X'), fz = ev('FARM_SPAWN_Z');
  genRegion(P.w, fx, fz, fx + 32, fz + 32);                         // Farmlands
  const sx = ev('SUBURBIA_SPAWN_CHUNK') * 16, sz = sx;
  genRegion(P.w, sx, sz, sx + 32, sz + 32);                         // Suburbia
  const asked = new Set(calls);
  chk(asked.size === 3 && asked.has('overworld') && asked.has('farmlands') && asked.has('suburbia'),
      `each generator asks only about its own dimension (${[...asked].join(', ')})`);

  /* AND THE STAMPER REFUSES THE REST. Feeding a Farmlands chunk the Overworld dimension
     would be the bug this guards: the events are filtered by dimension before anything
     resolves a site or writes a block. */
  const stampers = ev('ENV_STAMPERS');
  const byDim = {};
  for (const e of EVENTS) { (byDim[e.dimension] = byDim[e.dimension] || []).push(e.id); }
  chk(Object.keys(stampers).every(id => EVENTS.some(e => e.id === id)),
      'every stamper belongs to a declared event');
  chk(/if \(evt\.dimension !== dimension\) continue;/.test(strip(SRC)),
      'and the stamper loop rejects an event from another dimension before it can touch a block');

  /* AND NO OVERWORLD OBJECT REACHES THE FARMLANDS. The scorched centre of the held place
     is a block this dimension never otherwise writes at ground level, which makes it a
     clean tracer: generate a slab of Farmlands with everything noticed and every
     milestone reached, and count it. */
  const P2 = worldWith({ noticed: IDS.slice(), milestones: MILESTONES });
  const farm = genRegion(P2.w, fx - 64, fz - 64, fx + 64, fz + 64);
  let scorch = 0;
  for (const ch of farm) for (let i = 0; i < ch.data.length; i++) if (ch.data[i] === BLOCK.ASH_GROUND) scorch++;
  chk(scorch === 0, `not one scorched centre was written into ${farm.length} chunks of Farmlands`);

  /* ...and no Farmlands object reaches the Overworld. The tracer here is the yard
     vocabulary's PROPS rather than its worn ground, because the Overworld crossing writes
     the same worn ground and would make that reading ambiguous — the four things below
     are produced by nothing else in the build. */
  const P3 = worldWith({ noticed: IDS.slice(), milestones: MILESTONES });
  const over = genRegion(P3.w, 1200, 1200, 1320, 1320);
  const farmProps = new Set([BLOCK.CRATE, BLOCK.HAND_TOOLS, BLOCK.MAILBOX, BLOCK.FENCE_BROKEN_Z,
                             BLOCK.FENCE_OLD_Z, BLOCK.POST_BROKEN]);
  let props = 0;
  for (const ch of over) for (let i = 0; i < ch.data.length; i++) if (farmProps.has(ch.data[i])) props++;
  chk(props === 0, `and not one farmyard prop into ${over.length} chunks of Overworld`);
}

// =====================================================================================
// 6. A MILESTONE CHANGES WHAT EXISTS
// =====================================================================================
head('6. MILESTONE TRANSITION');
{
  const gate = EVENTS.find(e => e.after);
  chk(!!gate && MILESTONES.indexOf(gate.after) >= 0,
      `one event is gated on a real progression milestone (${gate.id} after "${gate.after}")`);

  const before = worldWith({ milestones: [] });
  const after = worldWith({ milestones: [gate.after] });
  const c = SITES[gate.site]();
  const count = (W) => {
    genRegion(W, c.x - 8, c.z - 12, c.x + 34, c.z + 12);
    let n = 0;
    for (let i = 0; i < 26; i++) {
      const x = c.x + i, z = c.z + Math.round(Math.sin(i * 0.23) * 2);
      if (blockAt(W, x, OW_SURF(W, x, z), z) === BLOCK.LEAF_LITTER) n++;
    }
    return n;
  };
  const n0 = count(before.w), n1 = count(after.w);
  chk(n0 === 0, `before the milestone the ground is untouched (${n0} cells)`);
  chk(n1 >= 24, `after it the trace is there (${n1} cells) — the world changed because the player survived a night`);

  /* AND THE CANOPY IS OPENED RATHER THAN FILLED. A trace that ADDED anything overhead
     would be a structure; this one is an absence in the trees. */
  let opened = 0, added = 0;
  for (let i = 0; i < 26; i++) {
    const x = c.x + i, z = c.z + Math.round(Math.sin(i * 0.23) * 2), y = OW_SURF(after.w, x, z);
    for (let dy = 3; dy <= 6; dy++) {
      const was = blockAt(before.w, x, y + dy, z), now = blockAt(after.w, x, y + dy, z);
      if (was === BLOCK.LEAVES && now === BLOCK.AIR) opened++;
      if (was === BLOCK.AIR && now !== BLOCK.AIR) added++;
    }
  }
  chk(opened > 0 && added === 0,
      `${opened} cells of canopy were REMOVED along it and nothing was added — the trace is an absence`);

  /* NOTHING ELSE MOVED. The milestone must change this event and no other. */
  const hh = SITES.owHolding();
  genRegion(before.w, hh.x - 8, hh.z - 8, hh.x + 8, hh.z + 8);
  genRegion(after.w, hh.x - 8, hh.z - 8, hh.x + 8, hh.z + 8);
  let diff = 0;
  const bb = Math.max(OW_SURF(after.w, hh.x, hh.z), ev('SEA_LEVEL') + 2);
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = -1; dy <= 2; dy++)
    if (blockAt(before.w, hh.x + dx, bb + dy, hh.z + dz) !== blockAt(after.w, hh.x + dx, bb + dy, hh.z + dz)) diff++;
  chk(diff === 0, 'and the other Overworld event is byte-identical either side of the milestone');
}

// =====================================================================================
// 7. CROSS-DIMENSION CALLBACKS
// =====================================================================================
head('7. CROSS-DIMENSION CALLBACKS');
{
  const callbacks = EVENTS.filter(e => e.requires && e.requires.length);
  chk(callbacks.length >= 3, `${callbacks.length} events exist only once their original has been noticed`);
  for (const e of callbacks) {
    const src = EVENTS.find(x => x.id === e.requires[0]);
    chk(!!src && src.dimension !== e.dimension,
        `${e.id} (${e.dimension}) calls back to ${e.requires[0]} (${src ? src.dimension : '?'}) — a DIFFERENT dimension`);
  }

  const BY = ev('SUBURBIA_BASE_Y');
  const readSub = (W) => {
    const hh = SITES.subHolding(W), nb = SITES.subNameBoard(W);
    genRegion(W, hh.x - 10, hh.z - 10, hh.x + 10, hh.z + 10);
    genRegion(W, nb.x - 10, nb.z - 10, nb.x + 10, nb.z + 10);
    return {
      scorch: blockAt(W, hh.x, BY - 1, hh.z) === BLOCK.ASH_GROUND,
      plank: blockAt(W, hh.x + 2, BY, hh.z) === BLOCK.OAK_LOG,
      post: blockAt(W, nb.x, BY, nb.z) === BLOCK.SIGN_POST,
      board: blockAt(W, nb.x, BY + 2, nb.z) >= BLOCK.SIGN_TEXT_BASE,
    };
  };
  const cold = readSub(worldWith({}).w);
  chk(!cold.scorch && !cold.plank, 'with nothing noticed, the suburban back yard is an ordinary lawn');
  chk(!cold.post && !cold.board, 'and the front lawn has no farm board on it');

  const warm = readSub(worldWith({ noticed: ['ow_holding', 'farm_name_board'] }).w);
  chk(warm.scorch && warm.plank, 'once the Overworld one has been stood in front of, the same square is in the back yard');
  chk(warm.post && warm.board, 'and once the board that lies has been, the same board is on the front lawn');

  /* PARTIAL PREREQUISITES. Noticing one original must bring back exactly one callback. */
  const half = readSub(worldWith({ noticed: ['ow_holding'] }).w);
  chk(half.scorch && !half.post,
      'noticing ONE original brings back exactly one callback and not the other');

  // The Haven chair.
  const havenAt = SITES.havenChair();
  const HBY = ev('FAKE_HAVEN_BASE_Y');
  const havenFurniture = (W) => {
    W.generateFakeHaven();
    let n = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy < 2; dy++) {
      const id = blockAt(W, havenAt.x + dx, HBY + dy, havenAt.z + dz);
      if (id >= 256 && id < 1200) n++;
    }
    return n;
  };
  chk(havenFurniture(worldWith({}).w) === 0, 'the Haven has no armchair for a player who never saw the one in the field');
  chk(havenFurniture(worldWith({ noticed: ['farm_field_chair'] }).w) > 0,
      'and it has one for a player who did — the same model, by the fire');

  /* THE HAVEN CALLBACK CHANGES NOTHING ELSE IN THE CABIN. Section 18 forbids putting a
     warning in it, and a callback that rearranged the room would be one. */
  const cabinA = worldWith({}).w, cabinB = worldWith({ noticed: ['farm_field_chair'] }).w;
  cabinA.generateFakeHaven(); cabinB.generateFakeHaven();
  let cabinDiff = 0;
  for (let x = havenAt.x - 9; x <= havenAt.x + 9; x++)
    for (let z = havenAt.z - 11; z <= havenAt.z + 7; z++)
      for (let y = HBY - 1; y <= HBY + 6; y++) {
        if (Math.abs(x - havenAt.x) <= 1 && Math.abs(z - havenAt.z) <= 1) continue;
        if (blockAt(cabinA, x, y, z) !== blockAt(cabinB, x, y, z)) cabinDiff++;
      }
  chk(cabinDiff === 0, 'and not one other cell of the cabin differs — nothing warns, nothing rearranges');
}

// =====================================================================================
// 8. EVENT ISOLATION
// =====================================================================================
head('8. ONE EVENT DOES NOT REACH ANOTHER');
{
  const sys = new ESS({ milestones: new Set() });
  sys.notice('ow_holding');
  chk(sys.has('ow_holding') && !sys.has('farm_name_board') && !sys.has('farm_field_chair'),
      'noticing one event latches exactly one');
  chk(sys.eligibleById('sub_holding') && !sys.eligibleById('sub_name_board'),
      'and satisfies exactly the callback that named it');
  chk(sys.notice('ow_holding') === false, 'noticing it twice is a no-op — the latch cannot double-fire');
  chk(sys.notice('not_an_event') === false, 'and an unknown id cannot be latched at all');

  /* Every site is far enough from every other that one stamper's clearing can never
     reach another's object.

     PHASE 32 NARROWED THIS TO THE THING IT IS ACTUALLY ABOUT, which is clearings. The
     two Haven sites are eight blocks apart because they are in the same 12x12 room —
     a chair by the fire and the mantel above it — and neither of them clears so much as
     one cell of ground: havenChair drops a furniture model onto an existing floor and
     havenMantel writes a single voxel onto an existing shelf. The separation rule still
     holds in full for every site that stamps terrain, and it still holds BETWEEN the
     Haven and everywhere else; it is only two interior sites in one authored room that
     are allowed to share it. If a future Haven site ever clears ground, it does not
     belong in this exemption. */
  const HAVEN_INTERIOR_SITES = new Set(['havenChair', 'havenMantel']);
  const pts = [];
  for (const k of Object.keys(SITES)) { const p = SITES[k](w); if (p) pts.push([k, p]); }
  let tooClose = null;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      if (HAVEN_INTERIOR_SITES.has(pts[i][0]) && HAVEN_INTERIOR_SITES.has(pts[j][0])) continue;
      const d = Math.hypot(pts[i][1].x - pts[j][1].x, pts[i][1].z - pts[j][1].z);
      if (d < 40) tooClose = `${pts[i][0]} and ${pts[j][0]} are ${d.toFixed(0)} blocks apart`;
    }
  chk(!tooClose, 'no two ground-clearing sites are within forty blocks of each other'
      + (tooClose ? ' — ' + tooClose : ''));
  /* ...and the exemption is not a hole: the Haven's own sites are still required to be a
     dimension away from every site that does clear ground. */
  let havenReach = null;
  for (const [ka, pa] of pts) {
    if (!HAVEN_INTERIOR_SITES.has(ka)) continue;
    for (const [kb, pb] of pts) {
      if (HAVEN_INTERIOR_SITES.has(kb)) continue;
      const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
      if (d < 40) havenReach = `${ka} and ${kb} are ${d.toFixed(0)} blocks apart`;
    }
  }
  chk(!havenReach, 'and no Haven site is within forty blocks of a stamping site'
      + (havenReach ? ' — ' + havenReach : ''));
}

// =====================================================================================
// 9. NOTICING
// =====================================================================================
head('9. NOTICING IS PROXIMITY AND FACING, AND NOTHING ELSE');
{
  const tracked = EVENTS.filter(e => e.notice > 0);
  chk(tracked.length === 3, `exactly ${tracked.length} events are tracked at run time: ${tracked.map(e => e.id).join(', ')}`);
  chk(tracked.every(e => e.persist === PERSIST.NOTICED), 'and every one of them saves its latch');
  const gating = new Set();
  for (const e of EVENTS) for (const r of (e.requires || [])) gating.add(r);
  chk(tracked.every(e => gating.has(e.id)),
      'nothing is tracked that does not gate something — the runtime cost is exactly the mechanic');

  const site = SITES.owHolding();
  const player = (x, z) => ({ position: { x, y: 30, z }, stationaryTimer: 0,
                              inFarmlands: false, inSuburbia: false, inFakeHaven: false });
  const cam = (dx, dz) => ({ getWorldDirection(v) { const n = Math.hypot(dx, dz) || 1; v.x = dx / n; v.y = 0; v.z = dz / n; return v; } });

  const near = new ESS({ milestones: new Set() });
  near.update(1, player(site.x + 3, site.z), cam(-1, 0), w);
  chk(near.has('ow_holding'), 'standing beside it and looking at it latches it');

  const far = new ESS({ milestones: new Set() });
  far.update(1, player(site.x + 40, site.z), cam(-1, 0), w);
  chk(!far.has('ow_holding'), 'forty blocks away it does not, however hard you look');

  const away = new ESS({ milestones: new Set() });
  away.update(1, player(site.x + 8, site.z), cam(1, 0), w);
  chk(!away.has('ow_holding'), 'and standing beside it with your back to it does not either');

  const wrong = new ESS({ milestones: new Set() });
  const p = player(site.x + 3, site.z); p.inFarmlands = true;
  wrong.update(1, p, cam(-1, 0), w);
  chk(!wrong.has('ow_holding'), 'an Overworld event cannot be noticed from inside the Farmlands');

  /* THE SWEEP IS 2Hz, NOT PER FRAME. */
  const slow = new ESS({ milestones: new Set() });
  slow.update(0.1, player(site.x + 3, site.z), cam(-1, 0), w);
  chk(!slow.has('ow_holding'), 'a tenth of a second does not trigger the sweep');
  slow.update(0.5, player(site.x + 3, site.z), cam(-1, 0), w);
  chk(slow.has('ow_holding'), '...and half a second does — it runs at 2Hz, like the water tower');

  chk(ev('EnvironmentStorySystem').dimensionOf({ inFakeHaven: true }) === 'haven' &&
      ev('EnvironmentStorySystem').dimensionOf({ inSuburbia: true }) === 'suburbia' &&
      ev('EnvironmentStorySystem').dimensionOf({ inFarmlands: true }) === 'farmlands' &&
      ev('EnvironmentStorySystem').dimensionOf({}) === 'overworld',
      'and the dimension it is looking in is read from the player, not tracked separately');
}

// =====================================================================================
// 10. PERSISTENCE
// =====================================================================================
head('10. PERSISTENCE, AND WHAT IS DELIBERATELY NOT SAVED');
{
  const SAVE_VERSION = ev('SAVE_VERSION');
  const MIG = ev('SAVE_MIGRATIONS');
  const validateSave = ev('validateSaveState');
  const defaults = ev('defaultSaveState');

  chk(SAVE_VERSION === 5, `the save schema is at version ${SAVE_VERSION}`);
  chk(typeof MIG[4] === 'function', 'and there is a real 4 -> 5 migration');
  const fresh = defaults(null);
  chk(Array.isArray(fresh.progression.noticed) && fresh.progression.noticed.length === 0,
      'a new game has noticed nothing');

  /* THE MIGRATION DERIVES NOTHING, AND THAT IS THE CORRECT ANSWER. Every earlier
     migration in this ladder had to work out what an old save had already lived; this one
     must not, because the objects it tracks did not exist in any build that wrote a
     version-4 file. */
  const old = Object.assign(defaults(null), { version: 4 });
  delete old.progression.noticed;
  const climbed = MIG[4](old);
  chk(climbed.version === 5 && Array.isArray(climbed.progression.noticed) && climbed.progression.noticed.length === 0,
      'a version-4 save climbs to 5 with an EMPTY notice set — nobody has seen objects that did not exist');
  const body = strip(SRC);
  const migBody = body.slice(body.indexOf('const SAVE_MIGRATIONS'), body.indexOf('const SAVE_MIGRATIONS') + 2600);
  chk(!/noticed = ENV_STORY_IDS|noticed = IDS/.test(migBody),
      'and it does NOT mark them noticed, which would hand a returning player three callbacks they never earned');

  // Round trip through the real validator.
  const withSome = defaults(null);
  withSome.progression.noticed = ['farm_field_chair', 'ow_holding'];
  const okRes = validateSave(withSome);
  chk(okRes.ok && okRes.state.progression.noticed.length === 2, 'a save carrying two noticed ids validates');
  chk(okRes.state.progression.noticed.join(',') === IDS.filter(id => ['farm_field_chair', 'ow_holding'].indexOf(id) >= 0).join(','),
      'and comes back in the table\'s order, not the file\'s');

  const junk = defaults(null);
  junk.progression.noticed = ['ow_holding', 'ow_holding', 'made_up', 42, null];
  const jr = validateSave(junk);
  chk(jr.ok && jr.state.progression.noticed.length === 1 && jr.state.progression.noticed[0] === 'ow_holding',
      'duplicates, invented ids and non-strings are all dropped rather than trusted');
  chk(jr.repairs.some(r => /noticed/.test(r)), 'and the repair is reported rather than done silently');

  const wrongType = defaults(null);
  wrongType.progression.noticed = 'ow_holding';
  const wr = validateSave(wrongType);
  chk(wr.ok && wr.state.progression.noticed.length === 0, 'a notice set that is not a list is repaired to empty, not rejected');

  // The runtime's own round trip.
  const sys = new ESS(null);
  sys.notice('ow_holding'); sys.notice('farm_name_board');
  const captured = sys.capture();
  chk(captured.length === 2 && captured.join(',') === IDS.filter(i => captured.indexOf(i) >= 0).join(','),
      'capture() emits the ids in the authored order');
  const back = new ESS(null);
  back.restore(captured);
  chk(back.has('ow_holding') && back.has('farm_name_board') && !back.has('farm_field_chair'),
      'restore() puts back exactly what was captured');
  back.restore(['made_up', 'ow_holding']);
  chk(back.has('ow_holding') && back.noticed.size === 1, 'and filters an invented id on the way in as well as out');
  back.reset();
  chk(back.noticed.size === 0, 'reset() clears it — a New Game owes every original again');

  /* WHAT IS NOT SAVED. Nothing this phase writes into the world is in the save file: it
     is all re-derived. The only exception is the Suburbia photograph, which rides on the
     Phase 15 stage counter that was already saved. */
  const generated = EVENTS.filter(e => e.persist === PERSIST.GENERATED);
  chk(generated.length >= 5, `${generated.length} of ${EVENTS.length} events are GENERATED and therefore not in the save at all`);
  const cap = JSON.stringify(defaults(null));
  chk(!/holding|crossing|vocabulary|chair/.test(cap),
      'and the default save contains none of their names — this phase added one field, not a ledger');
}

// =====================================================================================
// 11. IT SAYS NOTHING
// =====================================================================================
head('11. IT NEVER SPEAKS, AND NEVER RESOLVES');
{
  /* NO UI. The runtime cannot reach the HUD, cannot raise an objective, and cannot show
     a toast. That is not an omission — it is what separates this from a collectible. */
  for (const [what, re] of [
    ['the HUD', /\bui\b|UIManager|showToast|setInteractPrompt|journeyStep/],
    ['an objective', /objective|Objective/],
    ['a marker or waypoint', /marker|waypoint|highlight/i],
  ]) {
    chk(!re.test(SYSTEM_BODY), `the runtime cannot reach ${what}`);
  }
  chk(!/setTimeout|setInterval|addEventListener/.test(SYSTEM_BODY),
      'and it has no timer and binds no listener — there is nothing in it to leak');

  /* NO TEXT. STORY.md section 13 forbids a readable human sentence anywhere in the
     Farmlands, and this phase is where that rule would be broken if it were going to be. */
  const stripped = strip(SRC);
  const i31 = stripped.indexOf('const ENV_READS');
  const j31 = stripped.indexOf('class VoxelWorld {');
  const p31 = (i31 >= 0 && j31 > i31) ? stripped.slice(i31, j31) : '';
  chk(p31.length > 2000, `the phase's own source is ${p31.length} characters, and is what the checks below read`);
  /* THE AUDIT'S OWN DIAGNOSTICS ARE EXEMPT, AND ONLY THOSE. validateEnvStoryEvents
     returns human-readable problems for a developer running the test suite; they cannot
     reach a player, because nothing in this phase can reach a player. Everything else is
     scanned. */
  const v0 = p31.indexOf('function validateEnvStoryEvents');
  const v1 = p31.indexOf('\n}', v0);
  const scanned = v0 < 0 ? p31 : p31.slice(0, v0) + p31.slice(v1);
  // No newlines inside the match: a quote that spans lines is two object keys, not a sentence.
  const literals = (scanned.match(/'[^'\n]{25,}'|"[^"\n]{25,}"/g) || [])
    .filter(s => !/^['"](https?:|[A-Za-z_$][\w$]*\.)/.test(s));
  chk(literals.length === 0,
      'not one string literal long enough to be a sentence exists in the whole phase' +
      (literals.length ? ' — ' + literals.slice(0, 3).join(' / ') : ''));

  /* NO CANON VOCABULARY. Section 24's "internal only" terms must never reach the player,
     and the surest way to guarantee that is for them not to be in any shipped string. */
  const forbidden = ['the record', 'reconstruction', 'rebuilt', 'anomaly found', 'clue', 'memory discovered'];
  const strings = (scanned.match(/'[^'\n]*'|"[^"\n]*"/g) || []).map(s => s.slice(1, -1).toLowerCase());
  const leaked = strings.filter(s => forbidden.some(f => s.includes(f)));
  chk(leaked.length === 0, 'and no shipped string uses the canon\'s internal vocabulary' +
      (leaked.length ? ' — ' + leaked.join(', ') : ''));

  /* NO NOTES. Section 13 is explicit: no journals, diaries, letters, audio logs. */
  chk(!/\bnote\b|journal|diary|letter|audiolog|readable/i.test(scanned.replace(/ENV_/g, '')),
      'and nothing in it is a note, a journal, a diary or a letter');
}

// =====================================================================================
// 12. PHASE 15 WAS EXTENDED, NOT DUPLICATED
// =====================================================================================
head('12. THE SUBURBIA RECOGNITION LAYER WAS EXTENDED, NOT SHADOWED');
{
  chk(ev('SUB_STAGE_EFFECTS') === 7, 'the Phase 15 revision table went from six effects to seven');
  chk(/artFamilyAlone/.test(LIVE) && /effLoneFigure/.test(LIVE),
      'and the seventh is the family photograph losing one of its two figures');
  chk(ev('FURN').artFamilyAlone && ev('FURN').artFamily,
      'both photographs exist as furniture models');
  const a = ev('FURN').artFamily, b = ev('FURN').artFamilyAlone;
  chk(a.w === b.w && a.d === b.d && a.rot.length === b.rot.length,
      'the same size, the same footprint and the same rotations — only the picture differs');
  chk(a.label === b.label, `and the same display name (${a.label}), so the block itself does not give it away`);

  /* IT IS THE SAME MECHANISM. A second revision system running beside Phase 15's would be
     exactly the duplication the brief forbids. */
  chk(/_subStageEffect|_subRecognitionPass/.test(LIVE) && !/class .*Recognition/.test(LIVE),
      'there is still exactly one Suburbia revision system, and this rides on it');
  chk(/SUB_STAGE_EXTERIOR_LO|isExterior/.test(LIVE),
      'the exterior effects are now identified by range rather than by "3 and above", so an interior effect can sit above them');
  chk(/const INTERIOR_AT = \{ 0: 0, 1: 1, 2: 2, 6: 3 \}/.test(LIVE),
      'and the interior effects map their ids explicitly rather than by array position');

  /* THE ID SPACE DID NOT MOVE. Registering a furniture model anywhere but last shifts
     every id after it and rewrites the whole suburb — this is the check that would have
     caught that in one line rather than in a regression diff. */
  const src = strip(SRC);
  const lastDef = src.lastIndexOf("defFurn('");
  const nameAt = src.slice(lastDef + 9, lastDef + 40);
  chk(nameAt.startsWith('artFamilyAlone'),
      'the new model is the LAST one registered, so no existing furniture id moved');
}

// =====================================================================================
// 13. COST
// =====================================================================================
head('13. WHAT IT COSTS');
{
  const sys = new ESS({ milestones: new Set() });
  const player = { position: { x: 0, y: 30, z: 0 }, stationaryTimer: 0,
                   inFarmlands: false, inSuburbia: false, inFakeHaven: false };
  const cam = { getWorldDirection(v) { v.x = 1; v.y = 0; v.z = 0; return v; } };
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 20000; i++) sys.update(1 / 60, player, cam, w);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  chk(ms < 300, `20,000 frames of the notice sweep cost ${ms.toFixed(1)}ms (${(ms / 20000 * 1000).toFixed(2)}us a frame)`);

  chk(/ENV_OCCUPANCY_CAP/.test(LIVE) && /_occOrder.shift\(\)/.test(SYSTEM_BODY),
      'the occupancy ledger is bounded and evicts oldest-first, like every other ledger in this build');
  chk(/const _envForward/.test(LIVE) && /const f = _envForward/.test(SYSTEM_BODY),
      'and the facing test reuses one vector rather than allocating per sweep');

  /* THE ONE PIECE OF AUDIO IS NOT A DISCOVERY CUE. */
  chk(EVENTS.every(e => e.sound === null),
      'not one event plays a sound when it is found — a discovery chime is a confirmation, and this phase confirms nothing');
  chk(/playFootstep/.test(SYSTEM_BODY) && /stationaryTimer/.test(SYSTEM_BODY),
      'the audio budget is spent on occupancy instead: a footfall in a house you have been in before, standing still');
  chk(/visits < 2/.test(SYSTEM_BODY), 'and never on a first visit, when there is nothing to misremember');
}

console.log('');
if (fail) { console.log(fail + ' PHASE 31 ENVIRONMENT CHECK(S) FAILED'); process.exit(1); }
console.log('ALL PHASE 31 ENVIRONMENT CHECKS PASS');
console.log('      The real generator, real chunks, real farmsteads, the real cabin.');
console.log('      What is NOT claimed: that any of it is noticeable, unsettling, or worth');
console.log('      noticing. No human has played this build.');
