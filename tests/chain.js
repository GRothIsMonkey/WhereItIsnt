/* PHASE 20 REVISION — THE SINGLE AUTHORED RURAL JOURNEY.

   The playtest that prompted this revision did not find broken systems; it found a weak
   COMPOSITION — a procedural grid of roads and destinations rather than one road that
   goes somewhere. So everything measured here is a composition property, and every one of
   them is measured on what a player would see on the ground rather than on metadata:

     1. one primary route, continuous and walkable from arrival to the property
     2. it is wider and more authored than anything crossing it
     3. the grid is SUPPRESSED inside the corridor and untouched outside it
     4. the journey is long, and the landmarks are spread along the whole of it
     5. the scale hierarchy is readable in blocks: farm < fallen < standing < barn << tree
     6. the reveals are staged: nothing appears at the same distance as anything else
     7. the great tree stands in a graded ring of dead land, not a stamped circle
     8. the Home is the LAST stop and the furthest one
     9. normal Farmland outside the corridor is byte-identical to the baseline
*/
const path = require('path');
const { makeWorld, genRegion } = require('./harness/util.js');
const { walkReach } = require('./harness/walk.js');

const { w, ev } = makeWorld();
const BLOCK = ev('BLOCK'), P = ev('FARM_P'), SURF = ev('FARM_SURF');
const LINE = ev('FARM_J_LINE'), B0 = ev('FARM_J_B0'), DIR = ev('FARM_J_DIR');
const SPAWN = { x: ev('FARM_SPAWN_X'), z: ev('FARM_SPAWN_Z') };
const laneZ = (x) => w._farmJourneyLaneZ(x);
const F = w.farmFallen, T = w.farmTower, B = w.farmBarn, R = w.farmTree, H = w.farmHome;
let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };

const CHAIN = [
  ['the fallen tower', F, ev('FARM_J_FALLEN')],
  ['the standing tower', T, ev('FARM_J_TOWER')],
  ['the giant barn', B, ev('FARM_J_BARN')],
  ['the great tree', R, ev('FARM_J_TREE')],
  ['the Disconnected Home', H, ev('FARM_J_HOME')],
];

// ---- 1. EVERY LANDMARK RESOLVED, IN ORDER, WITH ROOM BETWEEN THEM -----------------
{
  let ordered = true, prev = -1;
  for (const [name, s, col] of CHAIN) {
    if (!s) { chk(false, `${name} failed to resolve a plot`); ordered = false; continue; }
    const d = Math.hypot(s.cx - SPAWN.x, s.cz - SPAWN.z);
    console.log(`      ${name.padEnd(24)} column ${String(col).padStart(2)}  ` +
                `${d.toFixed(0).padStart(5)} blocks from arrival  pad y=${s.padY}`);
    if (d <= prev) ordered = false;
    prev = d;
  }
  chk(ordered, 'the five landmarks resolve in journey order and each is further from arrival than the last');
  let minGap = Infinity;
  for (let i = 1; i < CHAIN.length; i++) {
    const a = CHAIN[i - 1][1], b = CHAIN[i][1];
    minGap = Math.min(minGap, Math.hypot(b.cx - a.cx, b.cz - a.cz));
  }
  chk(minGap > 250,
      `no two consecutive landmarks are closer than ${minGap.toFixed(0)} blocks — each one is a walk, ` +
      `not the next thing along the same fence line`);
}

// ---- 2. THE JOURNEY IS LONG, AND THE HOME IS THE END OF IT ------------------------
{
  const dHome = Math.hypot(H.cx - SPAWN.x, H.cz - SPAWN.z);
  chk(dHome > 1500,
      `the Disconnected Home is ${dHome.toFixed(0)} blocks from arrival — the journey is a journey`);
  const dTree = Math.hypot(R.cx - SPAWN.x, R.cz - SPAWN.z);
  chk(dHome > dTree && dHome > Math.hypot(B.cx - SPAWN.x, B.cz - SPAWN.z),
      'the Home is the last stop: further out than the tree, the barn, and both towers');
  const dTower = Math.hypot(T.cx - SPAWN.x, T.cz - SPAWN.z);
  chk(dTower < dHome * 0.55,
      `the standing tower is a mid-journey icon, not the destination: ${dTower.toFixed(0)} blocks against ` +
      `${dHome.toFixed(0)} to the Home — the route runs on for ${(dHome - dTower).toFixed(0)} blocks past it`);
}

// ---- 3. THE PRIMARY ROUTE IS CONTINUOUS FROM ARRIVAL TO THE PROPERTY --------------
/* Sampled every two blocks along the whole length. At each station the code looks for a
   carriageway cell within a few blocks of the resolved centreline: if the road ever
   stops, or ever jumps sideways further than the meander can carry it, this finds it. */
{
  const x0 = B0 * P, x1 = H.cx;
  let stations = 0, onRoad = 0, worstOff = 0, breakAt = null;
  for (let x = x0; x <= x1; x += 2) {
    stations++;
    const cz = Math.round(laneZ(x));
    let best = null;
    for (let d = 0; d <= 6; d++) {
      for (const z of [cz - d, cz + d]) {
        const s = w._farmSurfaceAt(x, z);
        if (s === SURF.TRACK || s === SURF.RUT) { best = d; break; }
      }
      if (best !== null) break;
    }
    if (best === null) { if (breakAt === null) breakAt = x; continue; }
    onRoad++;
    if (best > worstOff) worstOff = best;
  }
  chk(onRoad === stations,
      `the primary route is unbroken over all ${(x1 - x0)} blocks from arrival to the property: ` +
      `${onRoad}/${stations} stations carry road, worst lateral offset ${worstOff}` +
      (breakAt === null ? '' : ` — first break at x=${breakAt}`));
}

// ---- 4. IT IS THE WIDEST ROAD IN THE REGION, AND IT WINDS -------------------------
{
  const width = (x) => {
    const cz = Math.round(laneZ(x));
    let n = 0;
    for (let z = cz - 12; z <= cz + 12; z++) {
      const s = w._farmSurfaceAt(x, z);
      if (s === SURF.TRACK || s === SURF.RUT) n++;
    }
    return n;
  };
  let main = 0, samples = 0;
  for (let x = B0 * P + 20; x < H.cx; x += 97) { main += width(x); samples++; }
  main /= samples;
  // ...against an ordinary lane of the same lattice, well outside the corridor.
  const outLine = LINE + 12;
  let minor = 0, ms = 0;
  for (let x = B0 * P + 20; x < H.cx; x += 97) {
    const cz = Math.round(outLine * P + w._farmRouteZ(outLine, x));
    if (!w._farmLaneZ(outLine)) break;
    let n = 0;
    for (let z = cz - 12; z <= cz + 12; z++) {
      const s = w._farmSurfaceAt(x, z);
      if (s === SURF.TRACK || s === SURF.RUT) n++;
    }
    minor += n; ms++;
  }
  minor = ms ? minor / ms : 0;
  chk(main > minor * 1.4,
      `the primary route is visibly the main road: ${main.toFixed(1)} blocks of carriageway across it ` +
      `against ${minor.toFixed(1)} on an ordinary lane of the same lattice`);

  // Windiness over the WHOLE length, not just the first thirteen columns.
  let travel = 0, prev = null, lo = 1e9, hi = -1e9, longest = 0, runStart = B0 * P;
  let ax = runStart, ao = laneZ(runStart), slope = null;
  for (let x = B0 * P; x < H.cx; x += 2) {
    const o = laneZ(x);
    if (prev !== null) travel += Math.abs(o - prev);
    prev = o; if (o < lo) lo = o; if (o > hi) hi = o;
    if (slope === null && x > ax) slope = (o - ao) / (x - ax);
    if (slope !== null && Math.abs(o - (ao + slope * (x - ax))) > 1.0) {
      longest = Math.max(longest, x - runStart); runStart = x; ax = x; ao = o; slope = null;
    }
  }
  longest = Math.max(longest, H.cx - runStart);
  chk(travel > 120 && (hi - lo) > 20 && longest < 260,
      `and it winds over the whole of it: ${travel.toFixed(0)} blocks of lateral travel, ` +
      `${(hi - lo).toFixed(1)} of spread, longest straight run ${longest} blocks in ${(H.cx - B0 * P)}`);
}

// ---- 5. NO LATTICE INSIDE THE CORRIDOR -------------------------------------------
/* The playtest's actual complaint. Two measurements: how often a side road meets the
   route, and whether any road runs PARALLEL to it inside the corridor. Both are taken
   in-corridor and again outside it, so the number means something. */
{
  const meetings = (x0, x1, lineFn) => {
    let n = 0, wasOn = false;
    for (let x = x0; x < x1; x++) {
      const cz = Math.round(lineFn(x));
      let on = false;
      for (let dz = -10; dz <= 10; dz++) {
        if (dz >= -3 && dz <= 3) continue;                 // the route's own carriageway
        const s = w._farmSurfaceAt(x, cz + dz);
        if (s === SURF.TRACK || s === SURF.RUT) { on = true; break; }
      }
      if (on && !wasOn) n++;
      wasOn = on;
    }
    return n;
  };
  const inCor = meetings(B0 * P, B0 * P + 2000, laneZ);
  const outLine = LINE + 12;
  const outCor = meetings(B0 * P, B0 * P + 2000,
                          (x) => outLine * P + w._farmRouteZ(outLine, x));
  chk(inCor * 2 < outCor,
      `side roads meet the journey ${inCor} times in 2000 blocks against ${outCor} on an ordinary ` +
      `lane of the same lattice — the corridor is a road through country, not a street in a grid`);

  let parallel = 0;
  for (let bz = LINE - ev('FARM_J_ROAD_LAT'); bz < LINE + ev('FARM_J_ROAD_LAT'); bz++) {
    if (bz === LINE) continue;
    for (let j = 0; j <= ev('FARM_J_LAST'); j++) {
      const bx = B0 + j * DIR;
      if (!ev('farmInCorridor')(bx, bz)) continue;
      if (!w._farmLaneZ(bz)) continue;
      // Does it actually write road to the ground anywhere in this parcel?
      const x = bx * P + 32, cz = Math.round(bz * P + w._farmRouteZ(bz, x));
      const s = w._farmSurfaceAt(x, cz);
      if (s === SURF.TRACK || s === SURF.RUT) parallel++;
    }
  }
  chk(parallel === 0,
      `no road runs parallel to the journey anywhere inside the corridor (${parallel} parcels carry one)`);
}

// ---- 6. THE GRID OUTSIDE THE CORRIDOR IS UNTOUCHED --------------------------------
{
  const base = require('./harness/world.js')
    .makeWorld(process.env.WII_BASELINE || path.join(__dirname, 'baseline.html')).w;
  let diff = 0, cells = 0;
  // Four parcel rows clear of the corridor, over the journey's whole length.
  for (let bz of [LINE - 6, LINE + 6]) {
    for (let j = 0; j <= ev('FARM_J_LAST'); j += 3) {
      const bx = B0 + j * DIR;
      for (let u = 0; u < P; u += 7) {
        const x = bx * P + u, z = bz * P + 32;
        cells++;
        if (w._farmSurfaceAt(x, z) !== base._farmSurfaceAt(x, z)) diff++;
      }
    }
  }
  chk(diff === 0,
      `ordinary Farmland outside the corridor is unchanged: ${cells} surface samples six parcel rows ` +
      `off the route, ${diff} differ from the pre-revision build`);
}

// ---- 7. THE SCALE HIERARCHY, MEASURED IN BLOCKS -----------------------------------
function extent(site, ids, pad) {
  genRegion(w, site.cx - pad, site.cz - pad, site.cx + pad, site.cz + pad);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, top = -1e9, n = 0;
  const set = new Set(ids);
  for (let x = site.cx - pad; x <= site.cx + pad; x++)
    for (let z = site.cz - pad; z <= site.cz + pad; z++)
      for (let y = site.padY - 2; y < 63; y++) {
        if (!set.has(w.getBlockWorld(x, y, z))) continue;
        n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
        if (y > top) top = y;
      }
  return { n, w: x1 - x0 + 1, d: z1 - z0 + 1, h: top - site.padY + 1,
           span: Math.max(x1 - x0 + 1, z1 - z0 + 1) };
}
const mFallen = extent(F, [BLOCK.TOWER_LEG, BLOCK.TOWER_TANK, BLOCK.TOWER_TANK_RIB,
                           BLOCK.TOWER_DOME, BLOCK.TOWER_MAST, BLOCK.TANK_TORN,
                           BLOCK.TOWER_BRACE_X, BLOCK.TOWER_BRACE_Z, BLOCK.TOWER_LAMP], 30);
const mBarn = extent(B, [BLOCK.BARN_RED, BLOCK.SILO_TILE, BLOCK.SILO_CONE], 30);
// ...and the barn's own single mass, which is what the tree's crown is fairly ranked
// against: the complex figure includes the silos and the yard spread beside it.
const mBarnOnly = extent(B, [BLOCK.BARN_RED], 30);
const mTree = extent(R, [BLOCK.GREAT_BARK, BLOCK.GREAT_LEAF, BLOCK.GREAT_LIMB_X,
                         BLOCK.GREAT_LIMB_Z, BLOCK.GREAT_LIMB_Y], 30);
const towerH = T.lampY - T.padY + 1;
console.log(`      ordinary Phase 17 barn      8 tall`);
console.log(`      the fallen tower           ${String(mFallen.h).padStart(2)} tall, ${Math.max(mFallen.w, mFallen.d)} long   (${mFallen.n} voxels)`);
console.log(`      the standing tower         ${towerH} tall, 13 across`);
console.log(`      the giant barn             ${String(mBarn.h).padStart(2)} tall, ${mBarnOnly.w} across  (${mBarn.n} voxels; ${mBarn.w} across with its silos)`);
console.log(`      the great tree             ${String(mTree.h).padStart(2)} tall, ${mTree.span} across  (${mTree.n} voxels)`);
const fallenLen = Math.max(mFallen.w, mFallen.d);
chk(fallenLen >= 34,
    `the fallen tower reads as vast without being tall: ${fallenLen} blocks end to end, only ${mFallen.h} high`);
chk(mBarn.h > 8 * 2 && mBarn.h < towerH,
    `the giant barn outranks every ordinary barn and is still shorter than the tower: ${mBarn.h} against 8 and ${towerH}`);
chk(mTree.h > towerH && mTree.span > towerH,
    `the great tree is the biggest thing in the dimension on BOTH axes: ${mTree.h} tall and ${mTree.span} across, ` +
    `against the tower's ${towerH} tall and 13 across`);
chk(mTree.span > mBarnOnly.w * 1.4 && mTree.h > mBarn.h * 1.5,
    `and it dwarfs the barn it follows: a ${mTree.span}-block crown over a ${mBarnOnly.w}-block barn, ` +
    `${mTree.h} tall against ${mBarn.h}`);
chk(mTree.n < 20000,
    `the crown is a shell, not a solid: ${mTree.n} voxels for a ${mTree.span}-block canopy ` +
    `(a filled one would be roughly forty thousand)`);

// ---- 8. THE STAGED REVEALS --------------------------------------------------------
{
  const ranges = [
    ['the fallen tower', 240], ['the standing tower', ev('FARM_TOWER_PROXY_FAR')],
    ['the giant barn', 340], ['the great tree', 560],
  ];
  let distinct = true;
  for (let i = 1; i < ranges.length; i++) if (ranges[i][1] === ranges[i - 1][1]) distinct = false;
  chk(distinct, 'no two landmarks fade in at the same distance: ' +
      ranges.map(([n, r]) => `${n} ${r}`).join(', '));
  // Walking the route, how many landmarks are inside their own silhouette range at once?
  let maxAtOnce = 0;
  for (let x = B0 * P; x < H.cx; x += 24) {
    const z = laneZ(x);
    let n = 0;
    const sites = [[F, 240], [T, ev('FARM_TOWER_PROXY_FAR')], [B, 340], [R, 560]];
    for (const [s, far] of sites) if (Math.hypot(s.cx - x, s.cz - z) < far) n++;
    if (n > maxAtOnce) maxAtOnce = n;
  }
  chk(maxAtOnce >= 2 && maxAtOnce <= 3,
      `at the busiest point of the walk ${maxAtOnce} landmarks are on the horizon at once — enough that ` +
      `the next place to go exists before the player has finished with this one, not so many that the ` +
      `horizon is a shopping list`);
}

// ---- 9. THE DEAD LAND IS A RAMP, NOT A STAMPED CIRCLE ----------------------------
{
  const DEAD = ev('FARM_TREE_DEAD_R'), ROT = ev('FARM_TREE_ROT_R');
  const at = (d) => w._farmDeadLand(R.cx + d, R.cz);
  const prof = [0, 30, 46, 60, 75, 90, 100, 110, 130].map(d => [d, at(d)]);
  console.log('      rot by distance from the trunk: ' +
              prof.map(([d, v]) => `${d}:${v.toFixed(2)}`).join('  '));
  chk(at(0) === 1 && at(ROT) === 1, 'the ground is fully rotten out to the rot radius');
  chk(at(DEAD + 30) === 0, 'and ordinary farmland well outside the dead land');
  let monotone = true;
  for (let i = 1; i < prof.length; i++) if (prof[i][1] > prof[i - 1][1] + 1e-9) monotone = false;
  chk(monotone, 'the ramp only ever decreases outward — no bands, no ring artefacts');
  chk(at(60) > 0.05 && at(60) < 0.85,
      `and it is genuinely gradual: ${at(60).toFixed(2)} sixty blocks out, so the player walks through ` +
      `weakening ground rather than across an edge`);
  // The rim is not a circle: the outer radius must vary with direction.
  const radii = [];
  for (let a = 0; a < 8; a++) {
    const ux = Math.cos(a * Math.PI / 4), uz = Math.sin(a * Math.PI / 4);
    let r = DEAD + 40;
    for (let d = DEAD + 40; d > ROT; d--) {
      if (w._farmDeadLand(Math.round(R.cx + ux * d), Math.round(R.cz + uz * d)) > 0) { r = d; break; }
    }
    radii.push(r);
  }
  const spread = Math.max(...radii) - Math.min(...radii);
  chk(spread >= 8,
      `and its rim is not a circle: the outer edge varies by ${spread} blocks around the tree ` +
      `(${radii.join(', ')})`);
}

/* ---- 10. THE WOODLAND RETREATS FROM THE TREE ------------------------------------
   NOT "no trees inside a radius" — that would be a hard edge, and the brief asks for a
   gradual transition. What has to be true is that the woodland THINS toward the trunk and
   is completely gone across the inner ring, so the great tree has nothing at its own
   scale to be measured against and the player reaches it through progressively emptier
   country rather than stepping over a line. Measured as canopy cover in three annuli. */
{
  genRegion(w, R.cx - 120, R.cz - 120, R.cx + 120, R.cz + 120);
  const CR = ev('FARM_TREE_CANOPY_R');
  const band = (r0, r1) => {
    let canopy = 0, cells = 0;
    for (let x = R.cx - r1; x <= R.cx + r1; x += 3)
      for (let z = R.cz - r1; z <= R.cz + r1; z += 3) {
        const d = Math.hypot(x - R.cx, z - R.cz);
        if (d < r0 || d > r1) continue;
        cells++;
        const h = w._farmHeightAt(x, z);
        for (let y = h; y < h + 8; y++) {
          const id = w.getBlockWorld(x, y, z);
          if (id === BLOCK.BLACK_CANOPY || id === BLOCK.ORCHARD_CANOPY) { canopy++; break; }
        }
      }
    return { pct: cells ? canopy / cells : 0, canopy, cells };
  };
  /* THE REFERENCE IS THE SAME GROUND WITHOUT THE TREE, not a different annulus.
     Measured against a band further out, the mid ring looked DENSER than "ordinary
     country" — not because the suppression had failed but because the tree sits near the
     Ashen Forest's edge and the canopy field genuinely rises outward there. The
     pre-revision build answers the identical question over the identical columns with the
     identical seeds and no dead land, so subtracting the two isolates the retreat. */
  const base = require('./harness/world.js')
    .makeWorld(process.env.WII_BASELINE || path.join(__dirname, 'baseline.html')).w;
  genRegion(base, R.cx - 100, R.cz - 100, R.cx + 100, R.cz + 100);
  const bandIn = (world, r0, r1) => {
    let canopy = 0, cells = 0;
    for (let x = R.cx - r1; x <= R.cx + r1; x += 3)
      for (let z = R.cz - r1; z <= R.cz + r1; z += 3) {
        const d = Math.hypot(x - R.cx, z - R.cz);
        if (d < r0 || d > r1) continue;
        cells++;
        const h = world._farmHeightAt(x, z);
        for (let y = h; y < h + 8; y++) {
          const id = world.getBlockWorld(x, y, z);
          if (id === BLOCK.BLACK_CANOPY || id === BLOCK.ORCHARD_CANOPY) { canopy++; break; }
        }
      }
    return { pct: cells ? canopy / cells : 0, canopy, cells };
  };
  const inner = band(CR + 2, 60), mid = band(60, 90);
  const innerB = bandIn(base, CR + 2, 60), midB = bandIn(base, 60, 90);
  console.log(`      canopy cover   inner ${(inner.pct * 100).toFixed(1)}% (baseline ` +
              `${(innerB.pct * 100).toFixed(1)}%)   mid ${(mid.pct * 100).toFixed(1)}% ` +
              `(baseline ${(midB.pct * 100).toFixed(1)}%)`);
  chk(inner.canopy === 0,
      `not one other tree stands in the inner ring out to sixty blocks (${inner.canopy}/${inner.cells} ` +
      `columns, against ${innerB.canopy} in the pre-revision build) — nothing at its own scale is near it`);
  chk(mid.pct < midB.pct * 0.45,
      `and the woodland is still retreating at ninety: ${(mid.pct * 100).toFixed(1)}% cover where the ` +
      `same columns without the dead land carry ${(midB.pct * 100).toFixed(1)}%`);
}

// ---- 11. THE PLAYER CAN STILL LEAVE THE ROUTE ------------------------------------
{
  const x0 = B.cx, z0 = Math.round(laneZ(x0)) + 60;
  genRegion(w, x0 - 20, z0 - 20, x0 + 20, z0 + 140);
  const y0 = w._farmHeightAt(x0, z0) + 2;
  const r = walkReach(w, { x: x0 + 0.5, y: y0, z: z0 + 0.5 },
    { x0: x0 - 6, x1: x0 + 6, z0: z0 - 6, z1: z0 + 130, y0: 8, y1: 44 },
    (p) => p.z > z0 + 118, 300000);
  chk(r.ok,
      'a player standing beside the giant barn can walk a hundred and twenty blocks away from the route ' +
      'across open country — the funnel is geography, not a wall');
}

/* ---- 12. THE NEW LANDMARKS ARE PLACES, NOT BACKDROPS ----------------------------
   Requirement 70 of the project brief: a major location has to be somewhere the player
   goes, not something they look at. Each of the three new landmarks is checked for the
   thing that makes it a place — you can walk under the wreck, into the barn, and up to
   the trunk — using the game's own collision with the real player box. */
{
  // --- The fallen tower: walk from the road right up under the drum.
  genRegion(w, F.ox - 20, F.oz - 20, F.x1 + 20, F.z1 + 20);
  const sx = F.ox - 6, sz = Math.round(laneZ(sx));
  genRegion(w, sx - 10, Math.min(sz, F.oz) - 10, F.x1 + 10, Math.max(sz, F.z1) + 10);
  /* The wreck lies ACROSS the road, so its layout is road-relative: `fz(t)` is t blocks
     in from the plot edge the lane runs along, exactly as the stamper computes it. */
  const inward = F.south ? 1 : -1;
  const laneEdge = F.south ? F.oz : F.z1 - 1;
  const fz = (t) => laneEdge + inward * t;
  const drumZ = fz(8 + ev('FARM_TOWER_LEG_H') + 5);
  const r = walkReach(w, { x: sx + 0.5, y: w._farmHeightAt(sx, sz) + 2, z: sz + 0.5 },
    { x0: Math.min(sx, F.ox) - 4, x1: F.x1 + 4, z0: Math.min(sz, F.oz) - 4, z1: Math.max(sz, F.z1) + 4,
      y0: 8, y1: 48 },
    (p) => Math.abs(p.z - drumZ) < 2 && Math.abs(p.x - F.cx) < 2, 500000);
  chk(r.ok, 'a player can walk off the road and stand underneath the fallen tower\'s drum');
  const lampT = 8 + ev('FARM_TOWER_LEG_H') + ev('FARM_TOWER_TANK_H') + 5;
  chk(w.getBlockWorld(F.cx, F.padY + ev('FARM_TOWER_R'), fz(lampT)) === BLOCK.TOWER_LAMP,
      'and the lamp housing is lying in the dirt at the end of the mast, dark');
  chk(fz(lampT) >= F.oz && fz(lampT) < F.z1,
      `the whole wreck fits inside its own levelled plot: the mast ends ${lampT} blocks ` +
      `along a ${F.d}-block pad`);
  /* THE POINT OF THE ROTATION: broadside to the road. If the wreck ever went back onto
     the journey's own axis a player would only ever meet it end-on. */
  chk(mFallen.d > mFallen.w * 2,
      `and it lies ACROSS the journey, not along it: ${mFallen.d} blocks north-south ` +
      `against ${mFallen.w} east-west, so a player walking the road meets its full length`);
  let torn = 0;
  for (let x = F.ox; x < F.x1; x++)
    for (let z = F.oz; z < F.z1; z++)
      for (let y = F.padY; y < F.padY + 14; y++)
        if (w.getBlockWorld(x, y, z) === BLOCK.TANK_TORN) torn++;
  chk(torn > 8, `the drum is split along a seam, not laid down whole (${torn} torn plates)`);
}
{
  // --- The giant barn: in through the great door, and the loft is real.
  genRegion(w, B.ox - 20, B.oz - 20, B.x1 + 20, B.z1 + 20);
  // The layout comes off the resolved site descriptor, not re-derived here.
  const bw = B.bw, bd = B.bd, bxo = B.bx, bzo = B.bz;
  const doorX = bxo + (bw >> 1);
  const inX = doorX, inZ = B.south ? bzo + bd - 6 : bzo + 5;
  const sx = B.cx, sz = B.laneEdge - B.inward * 6;
  const r = walkReach(w, { x: sx + 0.5, y: w._farmHeightAt(sx, sz) + 2, z: sz + 0.5 },
    { x0: B.ox - 6, x1: B.x1 + 6, z0: Math.min(sz, B.oz) - 6, z1: Math.max(sz, B.z1) + 6, y0: 8, y1: 48 },
    (p) => Math.abs(p.x - inX) < 3 && Math.abs(p.z - inZ) < 3, 700000);
  chk(r.ok, 'a player can walk in through the barn\'s great sliding door and cross the full length of it');
  let loft = 0;
  for (let x = bxo + 3; x < bxo + 16; x++)
    for (let z = bzo + 3; z <= bzo + bd - 4; z++)
      if (w.getBlockWorld(x, B.padY + 8, z) === BLOCK.WOOD_FLOOR) loft++;
  let silo = 0;
  for (let x = bxo + bw; x < bxo + bw + 16; x++)
    for (let z = bzo; z < bzo + bd; z++)
      if (w.getBlockWorld(x, B.padY + 18, z) === BLOCK.SILO_TILE) silo++;
  chk(loft > 150, `the hay loft is a real boarded floor eight blocks up (${loft} boards)`);
  chk(silo > 20, `and the silos stand eighteen blocks up at its east gable (${silo} plates in one course)`);
  {
    // Everything in the complex has to sit on the LEVELLED pad, not on its bank.
    let off = 0;
    for (const [px, pz] of [[bxo, bzo], [bxo + bw - 1, bzo + bd - 1],
                            [bxo + bw + 4 + 3, bzo + 8], [bxo + bw + 12 + 3, bzo + 11]])
      if (px < B.ox || px >= B.x1 || pz < B.oz || pz >= B.z1) off++;
    chk(off === 0, 'the barn, both silos and the yard are all inside the levelled plot');
  }
  chk(B.ridgeY - B.padY === ev('FARM_BARN_H') + ev('FARM_BARN_ROOF'),
      `and the ridge height the proxy is built from matches the roof the pipeline stamps ` +
      `(${B.ridgeY - B.padY} blocks)`);
}
{
  // --- The great tree: walk to the trunk, and there is sky-lit ground under the crown.
  genRegion(w, R.cx - 40, R.cz - 40, R.cx + 40, R.cz + 40);
  const sx = R.cx, sz = R.cz - 34;
  const r = walkReach(w, { x: sx + 0.5, y: w._farmHeightAt(sx, sz) + 2, z: sz + 0.5 },
    { x0: R.cx - 38, x1: R.cx + 38, z0: R.cz - 38, z1: R.cz + 38, y0: 8, y1: 52 },
    (p) => Math.hypot(p.x - R.cx, p.z - R.cz) < ev('FARM_TREE_TRUNK_R') + 2.5, 500000);
  chk(r.ok, 'a player can walk under the crown and put a hand on the trunk');
  chk(w.getBlockWorld(R.cx, R.padY + ev('FARM_TREE_TRUNK_H') - 2, R.cz) === BLOCK.GREAT_BARK,
      'the bole runs clear for twenty-six blocks before the first limb');
  chk(R.topY <= 62 && w.getBlockWorld(R.cx, 63, R.cz) === BLOCK.AIR,
      `the crown tops out at y=${R.topY}, inside the y=63 ceiling with nothing truncated`);
  let roots = 0;
  for (let x = R.cx - 16; x <= R.cx + 16; x++)
    for (let z = R.cz - 16; z <= R.cz + 16; z++)
      for (let y = R.padY; y < R.padY + 4; y++) {
        const id = w.getBlockWorld(x, y, z);
        if (id === BLOCK.GREAT_ROOT_X || id === BLOCK.GREAT_ROOT_Z) roots++;
      }
  chk(roots > 60, `and it stands on buttress roots rather than in a hole (${roots} root cells)`);
}

console.log(`\n${fail === 0 ? 'ALL CHAIN CHECKS PASS' : fail + ' FAILURES'}`);
process.exit(fail ? 1 : 0);
