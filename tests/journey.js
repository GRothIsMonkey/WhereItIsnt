/* PHASE 20 — THE JOURNEY ITSELF: the beats, the spine, the tower and the freedom to
   leave it. Everything here is measured against what a PLAYER meets, not against
   metadata: crop density in the field they walk through, animals within sight of the
   road, structures per parcel column, sightline to the tower from the ground. */
const { makeWorld, genRegion } = require('./harness/util.js');
const { walkReach } = require('./harness/walk.js');

const { w, ev } = makeWorld();
const BLOCK = ev('BLOCK'), P = ev('FARM_P'), SURF = ev('FARM_SURF'), FF = ev('FARM_FIELD');
const LINE = ev('FARM_J_LINE'), B0 = ev('FARM_J_B0');
const SPAWN = { x: ev('FARM_SPAWN_X'), z: ev('FARM_SPAWN_Z') };
const H = w.farmHome, T = w.farmTower, A = w.farmApproach;
const laneZ = (x) => w._farmJourneyLaneZ(x);
let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };

// ---- 1. ARRIVAL ------------------------------------------------------------------
genRegion(w, SPAWN.x - 40, SPAWN.z - 40, SPAWN.x + 40, SPAWN.z + 40);
const sp = w.farmlandsSpawn;
const surf = w._farmSurfaceAt(Math.floor(sp.x), Math.floor(sp.z));
chk(surf === SURF.TRACK || surf === SURF.RUT,
    `the player spawns ON the cart track (surface code ${surf}: track=${SURF.TRACK}, rut=${SURF.RUT})`);
chk(Math.abs(w.farmlandsSpawnYaw + Math.PI / 2) < 1e-9, 'the player arrives facing east, down the journey');

// ---- 2. THE OPENING WHEAT FIELD --------------------------------------------------
function cropDensity(bx, bz) {
  const x0 = bx * P, z0 = bz * P;
  let crop = 0, cells = 0;
  for (let x = x0 + 12; x < x0 + P - 12; x++)
    for (let z = z0 + 12; z < z0 + P - 12; z++) {
      if (w._farmSurfaceAt(x, z) !== SURF.FIELD) continue;
      cells++;
      const id = w.getBlockWorld(x, w._farmHeightAt(x, z), z);
      if (id === BLOCK.CROP_TALL || id === BLOCK.WITHERED_CROP) crop++;
    }
  return cells ? crop / cells : 0;
}
genRegion(w, B0 * P, (LINE - 1) * P, (B0 + 3) * P, (LINE + 1) * P);
chk(w._farmParcel(B0, LINE).kind === FF.CROP && w._farmParcel(B0, LINE - 1).kind === FF.CROP,
    'both parcels flanking the arrival crossroads are a standing crop');
chk(w._farmFieldState(B0, LINE) === 0 && w._farmFieldState(B0, LINE - 1) === 0,
    'the opening field is in the healthiest state the vocabulary has (0)');
const dS = cropDensity(B0, LINE), dN = cropDensity(B0, LINE - 1);
chk(dS > 0.20 && dN > 0.20,
    `the opening field is dense: ${(dS * 100).toFixed(0)}% / ${(dN * 100).toFixed(0)}% of field cells carry a stalk (drilled rows cap this at 1/pitch)`);

// ---- 3. LIVESTOCK AND THE FARMSTEAD ----------------------------------------------
chk(w._farmParcel(B0 + 1, LINE - 1).kind === FF.PASTURE,
    'the parcel north of the lane one column on is pasture');
let herd = 0, animals = 0;
const AP = ev('FARM_ANIM_P');
for (let ax = Math.floor((B0 * P) / AP); ax <= Math.floor(((B0 + 3) * P) / AP); ax++)
  for (let az = Math.floor(((LINE - 1) * P) / AP); az <= Math.floor(((LINE + 1) * P) / AP); az++) {
    const c = w._farmAnimalCell(ax, az);
    if (c) { herd++; animals += c.animals.length; }
  }
chk(herd > 0, `livestock is met within the first three parcel columns: ${herd} groups, ${animals} animals`);
/* THE BARN/FARMSTEAD BEAT, and then the open ground the tower has to land against.
   Both matter and they are the same measurement: a working property beside the road
   early, and nothing built beside it for the two columns before the tower. */
const adjacent = [];
for (let j = 0; j <= 4; j++) for (const bz of [LINE, LINE - 1, LINE + 1]) {
  const st = w._farmSteadAt(B0 + j, bz);
  if (st) adjacent.push({ j, bz, named: st.hasSign, decay: st.decay });
}
chk(adjacent.some(a => a.j <= 2),
    `the lane passes a real farmstead before the tower, unforced: ` +
    adjacent.map(a => `column ${a.j} (row ${a.bz - LINE >= 0 ? '+' : ''}${a.bz - LINE}, decay ${a.decay})`).join(', '));
chk(!adjacent.some(a => (a.j === 3 || a.j === 4) && (a.bz === LINE || a.bz === LINE - 1)),
    'columns 3 and 4 have nothing built against the road itself — the open farmland the tower is measured against');
const roth = w._farmSteadAt(ev('FARM_ROTH_BX'), ev('FARM_ROTH_BZ'));
chk(!!roth && roth.isRoth, 'Roth Farm survives Phase 20 unchanged and is still forced');

// ---- 4. THE SPINE IS STILL A PHASE 18.1 ROUTE ------------------------------------
let travel = 0, maxOff = -1e9, minOff = 1e9, longest = 0, runStart = B0 * P, prev = null;
let anchorX = runStart, anchorO = laneZ(runStart), anchorSlope = null;
for (let x = B0 * P; x < (B0 + 13) * P; x += 2) {
  const o = laneZ(x);
  if (prev !== null) travel += Math.abs(o - prev);
  prev = o;
  if (o > maxOff) maxOff = o;
  if (o < minOff) minOff = o;
  if (anchorSlope === null && x > anchorX) anchorSlope = (o - anchorO) / (x - anchorX);
  if (anchorSlope !== null && Math.abs(o - (anchorO + anchorSlope * (x - anchorX))) > 1.0) {
    longest = Math.max(longest, x - runStart);
    runStart = x; anchorX = x; anchorO = o; anchorSlope = null;
  }
}
longest = Math.max(longest, (B0 + 13) * P - runStart);
chk(travel > 40 && longest < 250 && (maxOff - minOff) > 15,
    `the journey lane still bends: ${travel.toFixed(0)} blocks of lateral travel, ${(maxOff - minOff).toFixed(1)} blocks of spread, longest unbroken straight ${longest} blocks over 832`);

// ---- 5. THE WATER TOWER ----------------------------------------------------------
genRegion(w, T.ox - 24, T.oz - 24, T.x1 + 24, T.z1 + 24);
chk(w.getBlockWorld(T.cx, T.lampY, T.cz) === BLOCK.TOWER_LAMP, 'the lamp housing stands at the top of the mast');
chk(T.lampY < 63, `the tower fits inside the chunk column with headroom: lamp at y=${T.lampY}, ceiling 63`);
let legs = 0, tank = 0;
for (const [lx, lz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]])
  if (w.getBlockWorld(T.cx + lx, T.padY + 10, T.cz + lz) === BLOCK.TOWER_LEG) legs++;
for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
  const id = w.getBlockWorld(T.cx + dx, T.padY + 26, T.cz + dz);
  if (id === BLOCK.TOWER_TANK || id === BLOCK.TOWER_TANK_RIB) tank++;
}
chk(legs === 4, `all four stanchions run the full height (${legs}/4 at +10)`);
chk(tank > 120, `the tank is a real drum: ${tank} plate cells in one course`);
chk(T.lampY - T.padY === ev('FARM_TOWER_LAMP_DY') && T.lampY - T.padY > 30,
    `the tower is ${T.lampY - T.padY} blocks tall — ${((T.lampY - T.padY) / 8).toFixed(1)}x the tallest Phase 17 barn`);
chk(w.getBlockWorld(T.cx - 5, T.padY + 12, T.cz - 6) === BLOCK.LADDER_S, 'the service ladder runs up a leg');
chk(w.getBlockWorld(T.cx, T.padY + ev('FARM_TOWER_LEG_H') - 1, T.cz - 7) === BLOCK.CATWALK_X, 'the catwalk gallery rings the tank');
chk(ev('farmlandsBiomeAt')(T.cx, T.cz) === 'rotting',
    `the tower stands in open Rotting Fields, not inside the Ashen Forest (biome value ${ev('farmlandsBiomeValue')(T.cx, T.cz).toFixed(3)} against a ${ev('FARM_BIOME_T')} threshold)`);
{
  /* How much canopy is there to hide it? Measured as the fraction of columns within
     seventy blocks that have Black Canopy over them. */
  genRegion(w, T.cx - 84, T.cz - 84, T.cx + 84, T.cz + 84);
  const ring = (R) => {
    let canopy = 0, cells = 0;
    for (let x = T.cx - R; x <= T.cx + R; x += 2)
      for (let z = T.cz - R; z <= T.cz + R; z += 2) {
        cells++;
        const h = w._farmHeightAt(x, z);
        for (let y = h; y < h + 8; y++) if (w.getBlockWorld(x, y, z) === BLOCK.BLACK_CANOPY) { canopy++; break; }
      }
    return canopy / cells;
  };
  const r40 = ring(40), r80 = ring(80);
  chk(r40 < 0.05,
      `the ground the tower stands on is open: ${(r40 * 100).toFixed(1)}% canopy within forty blocks, ` +
      `${(r80 * 100).toFixed(1)}% within eighty — the forest edge is out there, which is the tree line the silhouette rises above`);
}

// ---- 6. SIGHTLINE ----------------------------------------------------------------
function sightline(fromX, fromZ) {
  const eyeY = w._farmHeightAt(fromX, fromZ) + 1.7;
  const dx = T.cx - fromX, dy = T.lampY - eyeY, dz = T.cz - fromZ;
  const n = Math.ceil(Math.hypot(dx, dy, dz) * 2);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = Math.floor(fromX + dx * t), y = Math.floor(eyeY + dy * t), z = Math.floor(fromZ + dz * t);
    if (y <= w._farmHeightAt(x, z) - 1) return false;
  }
  return true;
}
let seen = 0, tried = 0;
for (let j = 0; j <= 4; j++) {
  const x = (B0 + j) * P + 32, z = Math.round(laneZ(x));
  tried++;
  const ok = sightline(x, z);
  if (ok) seen++;
  console.log(`      column ${j}: ${Math.hypot(T.cx - x, T.cz - z).toFixed(0)} blocks from the tower, terrain sightline to the lamp ${ok ? 'CLEAR' : 'blocked'}`);
}
chk(seen === tried, `the lamp is above the terrain profile from every journey column between arrival and the tower (${seen}/${tried})`);
const dArrival = Math.hypot(T.cx - SPAWN.x, T.cz - SPAWN.z);
chk(dArrival < ev('FARM_TOWER_PROXY_FAR'),
    `the tower is inside proxy range from the arrival point itself: ${dArrival.toFixed(0)} blocks < ${ev('FARM_TOWER_PROXY_FAR')}`);

// ---- 7. ISOLATION RAMP -----------------------------------------------------------
function builtPerColumn(j) {
  let n = 0;
  const bx = B0 + j;
  for (let bz = LINE - 2; bz <= LINE + 1; bz++) if (w._farmSteadAt(bx, bz)) n++;
  const MP = ev('FARM_MINOR_P');
  for (let mz = Math.floor(((LINE - 2) * P) / MP); mz < Math.floor(((LINE + 2) * P) / MP); mz++)
    for (let mx = Math.floor((bx * P) / MP); mx < Math.floor(((bx + 1) * P) / MP); mx++)
      if (w._farmMinorAt(mx, mz)) n++;
  return n;
}
/* MEASURED AGAINST THE SAME HASHES WITHOUT THE RAMP, not against a neighbouring stretch
   of the same map. Sixteen parcels and a couple of dozen minor cells is far too small a
   sample to read a 60% thinning out of directly — measured that way the ramp looked like
   it was doing nothing (nine structures against nine) purely because two low-probability
   cells happened to accept. The pre-Phase-20 build answers the identical question with
   the identical seeds and no ramp, so subtracting the two isolates the ramp exactly. */
const base = require('./harness/world.js').makeWorld(process.env.WII_BASELINE || require('path').join(__dirname, 'baseline.html')).w;
function builtBaseline(j) {
  let n = 0;
  const bx = B0 + j;
  for (let bz = LINE - 2; bz <= LINE + 1; bz++) if (base._farmSteadAt(bx, bz)) n++;
  const MP = ev('FARM_MINOR_P');
  for (let mz = Math.floor(((LINE - 2) * P) / MP); mz < Math.floor(((LINE + 2) * P) / MP); mz++)
    for (let mx = Math.floor((bx * P) / MP); mx < Math.floor(((bx + 1) * P) / MP); mx++)
      if (base._farmMinorAt(mx, mz)) n++;
  return n;
}
let mineIso = 0, baseIso = 0, mineOpen = 0, baseOpen = 0, mineBeyond = 0, baseBeyond = 0;
for (let j = ev('FARM_J_ISO0'); j <= ev('FARM_J_HOME'); j++) { mineIso += builtPerColumn(j); baseIso += builtBaseline(j); }
/* Columns 0-2 only: the tower's own keep-out legitimately clears ground in columns 3-5,
   which is a different mechanism and is measured on its own below. */
for (let j = 0; j <= 2; j++) { mineOpen += builtPerColumn(j); baseOpen += builtBaseline(j); }
for (let j = ev('FARM_J_LAST') + 1; j <= ev('FARM_J_LAST') + 20; j++) { mineBeyond += builtPerColumn(j); baseBeyond += builtBaseline(j); }
{
  /* The tower's keep-out, measured on its own: how much the lattice would have built
     inside it. The brief asks that the landmark stand alone, and this is that in blocks. */
  let cleared = 0;
  for (let j = 3; j <= 5; j++) cleared += builtBaseline(j) - builtPerColumn(j);
  console.log(`      the tower's 74-block keep-out clears ${cleared} structures the lattice would have put beside it`);
}
chk(mineIso < baseIso * 0.75,
    `the isolation ramp removes ${baseIso - mineIso} of the ${baseIso} structures the lattice would otherwise put along columns ` +
    `${ev('FARM_J_ISO0')}-${ev('FARM_J_HOME')} (${(mineIso / baseIso * 100).toFixed(0)}% left)`);
chk(mineOpen === baseOpen,
    `and touches nothing at the start of the journey: ${mineOpen} structures in columns 0-2, identical to the baseline`);
chk(mineBeyond === baseBeyond,
    `and nothing beyond the journey either: ${mineBeyond} structures over the next twenty columns, identical to the baseline`);

// ---- 8. THE MARKS ----------------------------------------------------------------
const ECHO0 = ev('FARM_J_ECHO0');
genRegion(w, (B0 + ECHO0) * P, (LINE - 1) * P, (B0 + ECHO0 + 4) * P, (LINE + 1) * P);
function motifAt(j) {
  const ax = (B0 + j) * P + 26;
  const az = Math.round(laneZ(ax)) + 19;
  return w.getBlockWorld(ax, w._farmHeightAt(ax, az), az) === BLOCK.BURNT_STUMP &&
         w.getBlockWorld(ax, w._farmHeightAt(ax, az + 4), az + 4) === BLOCK.FIELD_GATE_Z;
}
const reps = [ECHO0, ECHO0 + 2, ECHO0 + 3].filter(motifAt).length;
chk(reps === 3, `the same arrangement stands three times, ${reps}/3 stamped identically`);
{
  const ax = (B0 + ECHO0 + 1) * P + 40, az = Math.round(laneZ(ax)) - 17;
  const hh = w._farmHeightAt(ax + 1, az);
  chk(w.getBlockWorld(ax + 1, hh, az + 2) === BLOCK.MAILBOX_Z &&
      w.getBlockWorld(ax + 1, hh - 1, az) === BLOCK.SIDEWALK,
      'a suburban mailbox stands on a fragment of poured sidewalk in a Farmlands field');
}
{
  const ax = (B0 + ECHO0 + 2) * P + 12, az = Math.round(laneZ(ax)) + 9;
  const base = Math.max(w._farmHeightAt(ax, az), w._farmHeightAt(ax, az + 1));
  const want = BLOCK.SIGN_TEXT_BASE + ev('FARM_SIGN_IDX_OF').ROTH * 4 + 2;
  chk(w.getBlockWorld(ax, base + 2, az) === want,
      'the ROTH FARM board stands again, seven hundred blocks from Roth Farm, with no farm behind it');
}

// ---- 9. MISSING-FARM EVIDENCE ----------------------------------------------------
genRegion(w, H.ox - 20, A.z0 - 20, H.x1 + 20, H.z1 + 10);
const into = A.south ? 1 : -1;
{
  const mx = H.cx - 12, mz = A.laneZ + into * (ev('FARM_VERGE_U') + 1);
  chk(w.getBlockWorld(mx, w._farmHeightAt(mx, mz), mz) === BLOCK.MAILBOX,
      'a mailbox stands on the verge with no property behind it');
  const gx = H.cx + 6, gz = A.laneZ + into * (ev('FARM_VERGE_U') + 2);
  chk(w.getBlockWorld(gx, w._farmHeightAt(gx, gz), gz) === BLOCK.FIELD_GATE_X,
      'a gateway opens onto open field');
  const rx = H.cx - 6;
  let last = -1;
  for (let k = 0; k < 30; k++) {
    const wz = A.laneZ + into * (ev('FARM_VERGE_U') + k);
    if (w.getBlockWorld(rx - 1, w._farmHeightAt(rx - 1, wz) - 1, wz) === BLOCK.TIRE_TRACK) last = k;
  }
  const endZ = A.laneZ + into * (ev('FARM_VERGE_U') + last);
  const gap = A.south ? H.oz - endZ : endZ - H.z1;
  chk(last >= 0 && gap >= 8, `the tyre ruts die ${gap} blocks short of the property boundary`);
  let lastF = null;
  for (let k = 0; k < 60; k++) {
    const wz = A.laneZ + into * k;
    const id = w.getBlockWorld(gx, w._farmHeightAt(gx, wz), wz);
    if (id === BLOCK.FENCE_OLD_Z || id === BLOCK.FENCE_LEAN_Z || id === BLOCK.FENCE_BROKEN_Z ||
        id === BLOCK.POST_BROKEN) lastF = wz;
  }
  const fgap = lastF === null ? -1 : (A.south ? H.oz - lastF : lastF - H.z1);
  chk(lastF !== null && fgap >= 8, `the fence line stops ${fgap} blocks short of the yard fence it should meet`);
}
const gapToLane = A.south ? H.oz - A.laneZ : A.laneZ - H.z1;
chk(gapToLane >= 25, `the property sits ${gapToLane} blocks off the road with nothing joining them`);

// ---- 10. THE PROPERTY IS NOT SERVED BY A ROAD -------------------------------------
{
  let onRoad = 0;
  for (let x = H.ox - 3; x <= H.x1 + 3; x++)
    for (let z = H.oz - 3; z <= H.z1 + 3; z++) {
      const s = w._farmSurfaceAt(x, z);
      if (s === SURF.TRACK || s === SURF.RUT) onRoad++;
    }
  chk(onRoad === 0, `no cart track touches the property or its margin (${onRoad} track cells)`);
}

// ---- 11. FREEDOM ------------------------------------------------------------------
{
  const x0 = (B0 + 2) * P + 20, z0 = Math.round(laneZ(x0));
  genRegion(w, x0 - 10, z0 - 10, x0 + 40, z0 + 130);
  const base = require('./harness/world.js').makeWorld(process.env.WII_BASELINE || require('path').join(__dirname, 'baseline.html')).w;
  let mine = 0, theirs = 0;
  for (let z = z0; z < z0 + 400; z++) {
    if (Math.abs(w._farmHeightAt(x0, z) - w._farmHeightAt(x0, z + 1)) > 1) mine++;
    if (Math.abs(base._farmHeightAt(x0, z) - base._farmHeightAt(x0, z + 1)) > 1) theirs++;
  }
  chk(mine <= theirs,
      `crossing 400 columns off the route, two-block steps: ${mine} against the pre-Phase-20 baseline's ${theirs} (a Phase 19 property, unchanged)`);
  const r = walkReach(w, { x: x0 + 0.5, y: w._farmHeightAt(x0, z0) + 2, z: z0 + 0.5 },
    { x0: x0 - 4, x1: x0 + 4, z0: z0 - 4, z1: z0 + 122, y0: 8, y1: 40 },
    (p) => p.z > z0 + 110, 300000);
  chk(r.ok, 'a player can actually walk 110 blocks straight off the road across open country');
}

console.log(`\n${fail === 0 ? 'ALL JOURNEY CHECKS PASS' : fail + ' FAILURES'}`);
process.exit(fail ? 1 : 0);
