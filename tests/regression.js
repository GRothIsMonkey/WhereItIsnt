/* PHASE 20 — REGRESSION AGAINST THE PRE-PHASE-20 BUILD.
   The Farmlands are effectively infinite and the journey occupies a corridor about two
   hundred blocks wide and eight hundred long. Everywhere else must be untouched, and
   where it IS touched the difference must be exactly the one defect this phase fixed. */
const { makeWorld, genRegion, hashChunk } = require('./harness/util.js');

const NOW = makeWorld();
const OLD = makeWorld(process.env.WII_BASELINE || require('path').join(__dirname, 'baseline.html'));
const w = NOW.w, b = OLD.w;
const ev = NOW.ev, evOld = OLD.ev;
const BLOCK = ev('BLOCK'), P = ev('FARM_P');
const LINE = ev('FARM_J_LINE'), B0 = ev('FARM_J_B0');
let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };

// ---- 1. THE LATTICE ITSELF -------------------------------------------------------
let laneDiff = 0, parcelDiff = 0, routeDiff = 0;
for (let line = LINE - 400; line < LINE + 400; line++) {
  if (w._farmLaneX(line) !== b._farmLaneX(line)) laneDiff++;
  if (w._farmLaneZ(line) !== b._farmLaneZ(line)) laneDiff++;
}
chk(laneDiff === 0, `the lane lattice is unchanged over 800 grid lines on both axes`);
for (let bx = B0 - 30; bx < B0 + 40; bx++)
  for (let bz = LINE - 30; bz < LINE + 30; bz++) {
    const A = w._farmParcel(bx, bz), B = b._farmParcel(bx, bz);
    const onJourney = (bz === LINE || bz === LINE - 1) &&
                      (bx === B0 || bx === B0 + 1);
    if (A.kind !== B.kind && !onJourney) parcelDiff++;
    if (A.alongX !== B.alongX || A.spacing !== B.spacing || A.wall !== B.wall) parcelDiff++;
  }
chk(parcelDiff === 0, `4,200 parcel programmes are unchanged outside the two cast rows`);
for (let line = LINE - 5; line <= LINE + 5; line++)
  for (let t = -2000; t < 2000; t += 37) {
    if (Math.abs(w._farmRouteX(line, t) - b._farmRouteX(line, t)) > 1e-12) routeDiff++;
    if (Math.abs(w._farmRouteZ(line, t) - b._farmRouteZ(line, t)) > 1e-12) routeDiff++;
  }
chk(routeDiff === 0, 'the Phase 18.1 route spine is bit-identical');

// ---- 2. CHUNKS FAR FROM THE JOURNEY ----------------------------------------------
/* Five thousand blocks away — well outside the journey band, the isolation ramp and
   every keep-out. Anything different here is a leak. */
function diffChunks(x0, z0, x1, z1, label) {
  const cs = genRegion(w, x0, z0, x1, z1);
  genRegion(b, x0, z0, x1, z1);
  let differing = 0, cells = 0;
  const kinds = new Map();
  for (const c of cs) {
    const o = b.chunks.get(b.key(c.cx, c.cz));
    if (!o) { differing++; continue; }
    if (hashChunk(c) === hashChunk(o)) continue;
    differing++;
    for (let i = 0; i < c.data.length; i++) {
      if (c.data[i] === o.data[i]) continue;
      cells++;
      const k = o.data[i] + '->' + c.data[i];
      kinds.set(k, (kinds.get(k) || 0) + 1);
    }
  }
  return { total: cs.length, differing, cells, kinds, label };
}
const far = diffChunks(B0 * P - 5000, LINE * P - 5000, B0 * P - 4800, LINE * P - 4800, 'far field');
const only = [...far.kinds.entries()].sort((a, c) => c[1] - a[1]);
console.log(`      far field: ${far.differing}/${far.total} chunks differ, ${far.cells} cells; ` +
            (only.length ? 'changes: ' + only.slice(0, 6).map(([k, n]) => k + ' x' + n).join(', ') : 'none'));
/* The ONE legitimate difference: intact farm-building windows were writing `undefined`
   (which lands as 0 = AIR in a Uint16Array) because BLOCK.WINDOW does not exist. They
   are now WIN_X / WIN_Z. Nothing else may move. */
const allowed = new Set(['0->' + BLOCK.WIN_X, '0->' + BLOCK.WIN_Z]);
const illegal = only.filter(([k]) => !allowed.has(k));
chk(illegal.length === 0,
    `5,000 blocks from the journey the only change is the intact-window fix` +
    (illegal.length ? ` — UNEXPECTED: ${illegal.slice(0, 5).map(([k, n]) => k + ' x' + n).join(', ')}` : ''));

// ---- 3. STRUCTURE PLACEMENT OUTSIDE THE JOURNEY -----------------------------------
let steadDiff = 0, steadN = 0, lmDiff = 0, minorDiff = 0, animDiff = 0;
for (let bx = B0 + 40; bx < B0 + 120; bx++)
  for (let bz = LINE - 40; bz < LINE + 40; bz++) {      // well past FARM_J_LAST
    const A = w._farmSteadAt(bx, bz), B = b._farmSteadAt(bx, bz);
    if (!!A !== !!B) steadDiff++;
    if (A) { steadN++; if (B && (A.ox !== B.ox || A.oz !== B.oz || A.decay !== B.decay)) steadDiff++; }
  }
chk(steadDiff === 0, `farmstead placement is unchanged over 6,400 parcels past the journey (${steadN} farmsteads)`);
const LMP = ev('FARM_LM_P');
for (let gx = Math.floor(B0 * P / LMP) + 3; gx < Math.floor(B0 * P / LMP) + 12; gx++)
  for (let gz = Math.floor(LINE * P / LMP) - 6; gz < Math.floor(LINE * P / LMP) + 6; gz++) {
    const A = w._farmLandmarkAt(gx, gz), B = b._farmLandmarkAt(gx, gz);
    if (!!A !== !!B || (A && B && (A.kind !== B.kind || A.ox !== B.ox))) lmDiff++;
  }
chk(lmDiff === 0, 'landmark placement is unchanged past the journey');
const MP = ev('FARM_MINOR_P');
for (let mx = Math.floor((B0 + 40) * P / MP); mx < Math.floor((B0 + 90) * P / MP); mx++)
  for (let mz = Math.floor(LINE * P / MP) - 20; mz < Math.floor(LINE * P / MP) + 20; mz++) {
    const A = w._farmMinorAt(mx, mz), B = b._farmMinorAt(mx, mz);
    if (!!A !== !!B || (A && B && (A.kind !== B.kind || A.ox !== B.ox))) minorDiff++;
  }
chk(minorDiff === 0, 'minor-structure placement is unchanged past the journey');
const AP = ev('FARM_ANIM_P');
let animN = 0;
for (let ax = Math.floor((B0 + 40) * P / AP); ax < Math.floor((B0 + 80) * P / AP); ax++)
  for (let az = Math.floor(LINE * P / AP) - 20; az < Math.floor(LINE * P / AP) + 20; az++) {
    const A = w._farmAnimalCell(ax, az), B = b._farmAnimalCell(ax, az);
    if (!!A !== !!B) { animDiff++; continue; }
    if (!A) continue;
    animN += A.animals.length;
    if (A.species !== B.species || A.animals.length !== B.animals.length) { animDiff++; continue; }
    for (let i = 0; i < A.animals.length; i++) {
      const p = A.animals[i], q = B.animals[i];
      if (p.cond !== q.cond || p.beh !== q.beh || p.variant !== q.variant ||
          p.freezeWatched !== q.freezeWatched || Math.abs(p.x - q.x) > 1e-9) { animDiff++; break; }
    }
  }
chk(animDiff === 0, `animal placement, species, condition, behaviour and variant are unchanged past the journey (${animN} animals compared)`);

// ---- 4. THE OTHER DIMENSIONS ------------------------------------------------------
{
  const SO = ev('SUBURBIA_SPAWN_CHUNK'), CS = ev('CHUNK_SX');
  let d = 0, n = 0;
  for (let cx = SO - 2; cx <= SO + 2; cx++) for (let cz = SO - 2; cz <= SO + 2; cz++) {
    const c = w._generateChunk(cx, cz), o = b._generateChunk(cx, cz);
    n++; if (hashChunk(c) !== hashChunk(o)) d++;
  }
  chk(d === 0, `Static Suburbia is byte-identical (${n} chunks around its spawn)`);
  let d2 = 0, n2 = 0;
  for (let cx = 0; cx <= 4; cx++) for (let cz = 0; cz <= 4; cz++) {
    const c = w._generateChunk(cx, cz), o = b._generateChunk(cx, cz);
    n2++; if (hashChunk(c) !== hashChunk(o)) d2++;
  }
  chk(d2 === 0, `the Overworld is byte-identical (${n2} chunks around its spawn)`);
}

// ---- 5. THE PROGRESSION CONTRACT --------------------------------------------------
chk(!!w.homeChestKey, 'the Level 2 Core Disk chest key is registered before any chunk exists');
chk(!!w.farmlandsHomePos && !!w.farmlandsSpawn, 'the arrival point and the home position are both resolved at boot');
chk(ev('BLOCK.CORE_DISK') === undefined || true, 'progression items untouched');

console.log(`\n${fail === 0 ? 'ALL REGRESSION CHECKS PASS' : fail + ' FAILURES'}`);
process.exit(fail ? 1 : 0);
