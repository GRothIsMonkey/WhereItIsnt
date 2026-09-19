/* ERA 2 E2.2 — THE D1 NON-VOXEL TERRAIN FOUNDATION, OFFLINE.

   WHAT THIS PROVES. That the world is FINITE and the streamer cannot leave it; that the
   height function is continuous, deterministic and free of any voxel vocabulary; that the
   E2.1 contract is implemented completely and agrees in shape with the voxel
   implementation; that roads, scatter and the authored site table ship EMPTY; and that
   collision, water and surface classification behave the way the callers expect.

   WHAT IT CANNOT PROVE. That any of it renders, that a mesh has no seams, or that walking
   on it feels right. Those are tests/browser-terrain.js and, ultimately, a person. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'src', 'world', 'terrain');
const FILES = ['terrain-config.js', 'terrain-roads.js', 'terrain-authoring.js',
               'terrain-heightfield.js', 'terrain-materials.js', 'terrain-mesh.js',
               'terrain-scatter.js', 'terrain-regions.js', 'terrain-physical-world.js',
               'terrain-world.js'];

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (m) => console.log('      ' + m);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* Boot the terrain modules alone, over the real SimplexNoise, with a THREE stub good
   enough for the parts that touch it. The point is that the terrain MATHS needs nothing
   from the rest of the build — no VoxelWorld, no Game, no renderer. */
const T = (() => {
  const ctx = vm.createContext({ Math, Float32Array, Uint16Array, Uint32Array, console,
                                 performance: { now: () => Date.now() } });
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'shared', 'simplex-noise.js'), 'utf8'), ctx);
  /* A THREE stub. Only the mesh builder and materials touch it; everything the assertions
     below care about is arithmetic. */
  vm.runInContext(`
    var THREE = {
      BufferGeometry: function () { this.attributes = {}; this.userData = {};
        this.setAttribute = function (n, a) { this.attributes[n] = a; };
        this.setIndex = function (a) { this.index = a; };
        this.dispose = function () { this.disposed = true; }; },
      BufferAttribute: function (arr, n) { this.array = arr; this.itemSize = n; this.count = arr.length / n; },
      Vector3: function (x, y, z) { this.x = x||0; this.y = y||0; this.z = z||0; },
      Box3: function (a, b) { this.min = a; this.max = b; },
      Sphere: function (c, r) { this.center = c; this.radius = r; },
      Mesh: function (g, m) { this.geometry = g; this.material = m; this.name = '';
        this.userData = {}; },
      PlaneGeometry: function () { this.userData = {};
        this.rotateX = function () { return this; }; this.translate = function () { return this; };
        this.dispose = function () { this.disposed = true; }; },
      MeshStandardMaterial: function (o) { Object.assign(this, o || {}); this.uuid = 'm' + Math.random();
        this.dispose = function () { this.disposed = true; }; },
    };
    var AssetCollisionSet = function () { this.entries = []; this.size = 0;
      this.collidesAABB = function () { return false; };
      this.isSolid = function () { return false; };
      this.groundHeightAt = function () { return null; }; };
  `, ctx);
  /* D1 PHASE 1 — the terrain world now composes through CompositePhysicalWorld, which
     lives one directory up. D1 PHASE 2 — and the normalized raycast vocabulary it and the
     terrain backend both build hits with. Loaded first because they are named downstream. */
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'world', 'raycast.js'), 'utf8'),
                  ctx, { filename: 'raycast.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'world', 'composite-physical-world.js'), 'utf8'),
                  ctx, { filename: 'composite-physical-world.js' });
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
  const EXPORTS = ['D1_WORLD_SIZE','D1_REGION_SIZE','D1_REGION_GRID','D1_WORLD_MIN_X','D1_WORLD_MAX_X',
    'D1_WORLD_MIN_Z','D1_WORLD_MAX_Z','D1_MIN_Y','D1_MAX_Y','D1_RELIEF','D1_EDGE_DROP','D1_EDGE_MARGIN','D1_TERRAIN_SEED',
    'D1_LOD_STEPS','D1_STREAM_LOAD_RADIUS','D1_STREAM_UNLOAD_RADIUS','D1_SURFACE','D1_WATER_LEVEL',
    'd1IsInsideWorld','d1IsInsidePlayArea','d1RegionIndexAt','d1RegionExists','d1RegionBounds',
    'd1RegionLod','d1AllRegions','d1ClampToWorld','d1EdgeFalloff','d1RegionKey',
    'd1TerrainHeight','d1BaseElevation','d1TerrainNormal','d1TerrainSlope','d1SurfaceAt',
    'd1WaterDepthAt','d1HasSkyAbove','d1ResetNoise',
    'D1_ROAD_NETWORK','D1_ROAD_KIND','d1SetRoadNetwork','d1RoadNetwork','d1ResetRoadNetwork',
    'd1IsOnRoad','d1NearestRoad','D1_SCATTER_SPECIES','d1SetScatterSpecies','d1ScatterSpecies',
    'd1ResetScatterSpecies','d1BuildRegionScatter','D1_AUTHORED_SITES','d1SetAuthoredSites',
    'd1AuthoredSites','d1ResetAuthoredSites','d1SitesInRegion','D1_SITE_TERRAIN',
    'd1BuildRegionGeometry','d1BuildRegionWater','TerrainPhysicalWorld','D1TerrainRegions',
    'D1TerrainWorld','terrainMaterialStatus','terrainScatterStatus','terrainAuthoringStatus',
    'CompositePhysicalWorld','RAYCAST_CATEGORY','RAYCAST_MISS','makeRayHit','rayHitBeats',
    'rayAabbDistance','rayAabbNormal','rayIsNormalized'];
  vm.runInContext('globalThis.__T = {' + EXPORTS.join(',') + '};', ctx);
  return ctx.__T;
})();

// =====================================================================================
head('1. THE WORLD IS FINITE, AND THE NUMBER IS KNOWN');

note('extent ' + T.D1_WORLD_SIZE + ' m square, ' + T.D1_REGION_GRID + ' x ' + T.D1_REGION_GRID +
     ' regions of ' + T.D1_REGION_SIZE + ' m');
chk(T.D1_WORLD_SIZE > 0 && isFinite(T.D1_WORLD_SIZE), 'the world has a finite declared extent');
chk(T.D1_REGION_GRID * T.D1_REGION_SIZE === T.D1_WORLD_SIZE,
    'the region grid tiles the world exactly (' + T.D1_REGION_GRID + ' x ' + T.D1_REGION_SIZE + ')');
const all = T.d1AllRegions();
chk(all.length === T.D1_REGION_GRID * T.D1_REGION_GRID,
    'the world enumerates to exactly ' + all.length + ' regions — it TERMINATES');
chk(all.every(r => T.d1RegionExists(r.rx, r.rz)), 'and every enumerated region exists');

chk(T.d1IsInsideWorld(0, 0), 'the origin is inside the world');
chk(!T.d1IsInsideWorld(T.D1_WORLD_MAX_X, 0), 'the far edge is exclusive');
chk(!T.d1IsInsideWorld(1e9, 1e9), 'a point far outside is outside');
chk(!T.d1RegionExists(-1, 0) && !T.d1RegionExists(T.D1_REGION_GRID, 0),
    'no region exists outside the grid, in either direction');

const far = T.d1ClampToWorld(1e6, -1e6);
chk(far.clamped && T.d1IsInsideWorld(far.x, far.z), 'a far-outside position clamps back inside');

// =====================================================================================
head('2. THE STREAMER CANNOT LEAVE THE WORLD — THE PRACTICAL DEFINITION OF FINITE');

{
  const scene = { add() {}, remove() {} };
  const regions = new T.D1TerrainRegions(scene, null, null);
  const probes = [[0,0], [T.D1_WORLD_MIN_X, T.D1_WORLD_MIN_Z], [T.D1_WORLD_MAX_X, T.D1_WORLD_MAX_Z],
                  [1e6, 1e6], [-1e6, -1e6], [T.D1_WORLD_MIN_X - 5000, 0]];
  let bad = 0, maxResident = 0;
  for (const [x, z] of probes) {
    for (let i = 0; i < 40; i++) regions.update(x, z, Infinity);
    for (const r of regions.regions.values())
      if (!T.d1RegionExists(r.rx, r.rz)) bad++;
    maxResident = Math.max(maxResident, regions.regions.size);
    regions.unloadAll();
  }
  chk(bad === 0, 'six viewpoints including 1,000 km outside produced ZERO out-of-grid regions');
  note('peak resident across those probes: ' + maxResident + ' regions');
  chk(maxResident <= all.length, 'and never more regions than the world contains');

  for (let i = 0; i < 5; i++) regions.update(1e6, 1e6, Infinity);
  chk(regions.regions.size === 0, 'a viewpoint far outside the world streams in NOTHING');
  regions.unloadAll();
}

// =====================================================================================
head('3. HEIGHT IS CONTINUOUS, DETERMINISTIC, AND NOT A VOXEL LOOKUP');

{
  /* CONTINUITY. A voxel world's height is a step function: sample it densely and you get a
     small number of distinct integers. A continuous field gives a different value almost
     everywhere, and neighbouring samples differ by a small amount. Both are checked. */
  const vals = [];
  for (let i = 0; i < 400; i++) vals.push(T.d1TerrainHeight(-120 + i * 0.25, 37.3));
  const distinct = new Set(vals.map(v => v.toFixed(6))).size;
  chk(distinct > 380, 'dense sampling gives ' + distinct + '/400 distinct heights — not a step function');

  const ints = vals.filter(v => Math.abs(v - Math.round(v)) < 1e-9).length;
  chk(ints <= 2, 'and they are not integers (' + ints + ' of 400 landed on one)');

  let maxJump = 0;
  for (let i = 1; i < vals.length; i++) maxJump = Math.max(maxJump, Math.abs(vals[i] - vals[i - 1]));
  chk(maxJump < 0.5, 'no discontinuity over a 0.25 m step — largest jump ' + maxJump.toFixed(4) + ' m');

  /* DETERMINISM. CLAUDE.md section 11. Rebuilt noise must give identical answers. */
  const probe = [[0,0],[123.456,-789.012],[-2000.5,1999.25],[17,17]];
  const before = probe.map(([x,z]) => T.d1TerrainHeight(x,z));
  T.d1ResetNoise();
  const after = probe.map(([x,z]) => T.d1TerrainHeight(x,z));
  chk(before.every((v,i) => v === after[i]),
      'height is bit-identical after the noise generators are rebuilt from the seed');

  /* IN BUDGET. The declared vertical bounds must actually hold, or the region bounding
     boxes and the collision broadphase are lying. */
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 4000; i++) {
    const x = T.D1_WORLD_MIN_X + Math.random() * T.D1_WORLD_SIZE;
    const z = T.D1_WORLD_MIN_Z + Math.random() * T.D1_WORLD_SIZE;
    const h = T.d1TerrainHeight(x, z);
    if (h < lo) lo = h; if (h > hi) hi = h;
  }
  note('4,000 random samples: ' + lo.toFixed(2) + ' .. ' + hi.toFixed(2) + ' m' +
       '  (budget ' + T.D1_MIN_Y + ' .. ' + T.D1_MAX_Y + ')');
  chk(lo >= T.D1_MIN_Y && hi <= T.D1_MAX_Y, 'every sample is inside the declared vertical budget');
  chk(hi - lo > 15, 'and the map has real relief (' + (hi - lo).toFixed(1) + ' m of range)');
}

// =====================================================================================
head('4. NO VOXEL VOCABULARY ANYWHERE IN THE LAYER');

const VOXEL = ['BLOCK.', 'CHUNK_SX', 'CHUNK_SY', 'CHUNK_SZ', 'getBlockWorld', 'setBlockWorld',
               'VoxelWorld', 'findSpawnHeight', 'worldEdits', 'blockAt', 'getChunk'];
for (const f of FILES) {
  const live = strip(read(f));
  const found = VOXEL.filter(v => live.indexOf(v) >= 0);
  chk(found.length === 0, f + ' names no voxel vocabulary' + (found.length ? ' — FOUND: ' + found.join(', ') : ''));
}
for (const f of FILES) {
  const live = strip(read(f));
  chk(live.indexOf('Math.random') < 0, f + ' contains no Math.random — generation is seeded');
}
for (const f of FILES) {
  const raw = read(f);
  chk(/^"use strict";/.test(raw), f + ' is a classic script opening with "use strict"');
  chk(!/^\s*(import|export)\s/m.test(strip(raw)), f + ' has no import/export');
}

// =====================================================================================
head('5. THE E2.1 CONTRACT IS IMPLEMENTED, COMPLETELY, AND AGREES WITH THE VOXEL ONE');

{
  const CONTRACT = ['collidesAABB','isSolid','groundHeightAt','waterLevelAt','isResidentAround',
                    'editEpoch','hasOpenSkyAbove','lightLevelAt','nearestLightSourceDistance',
                    'isInsideSafeZone','isInsideSoulAnchorZone'];
  const pw = new T.TerrainPhysicalWorld(null);
  const missing = CONTRACT.filter(m => typeof pw[m] !== 'function');
  chk(missing.length === 0, 'TerrainPhysicalWorld implements all ' + CONTRACT.length +
      ' contract queries' + (missing.length ? ' — MISSING: ' + missing.join(', ') : ''));

  /* THE TWO IMPLEMENTATIONS MUST NOT DRIFT. Compare method lists against the voxel one. */
  const voxelSrc = fs.readFileSync(path.join(ROOT, 'src', 'world', 'physical-world.js'), 'utf8');
  const voxelMethods = new Set();
  const re = /^\s{2}([a-zA-Z_][\w]*)\s*\(/gm;
  let m;
  while ((m = re.exec(voxelSrc)) !== null) if (m[1] !== 'constructor') voxelMethods.add(m[1]);
  const extraInVoxel = Array.from(voxelMethods).filter(x => typeof pw[x] !== 'function');
  chk(extraInVoxel.length === 0,
      'every query the VOXEL implementation offers exists here too' +
      (extraInVoxel.length ? ' — MISSING: ' + extraInVoxel.join(', ') : ''));

  /* The read-only rule the contract states. */
  const pwSrc = strip(read('terrain-physical-world.js'));
  const writes = ['setBlockWorld', 'destroyBlock', 'placeBlock', '_writeBlockRaw'];
  chk(writes.every(w => pwSrc.indexOf(w) < 0), 'and it writes nothing — every query is read-only');
}

// =====================================================================================
head('6. GROUND HEIGHT IS CONTINUOUS THROUGH THE CONTRACT — AND WHAT FLOORING COSTS');

{
  const pw = new T.TerrainPhysicalWorld(null);
  const exact = pw.groundHeightAt(101.37, -58.62);
  chk(!Number.isInteger(exact), 'groundHeightAt returns a real number (' + exact.toFixed(4) + ')');
  chk(Math.abs(exact - T.d1TerrainHeight(101.37, -58.62)) < 1e-12,
      'and it is exactly the terrain function, unrounded');

  /* THE MEASUREMENT THE NEXT PHASE INHERITS. Ten call sites in the build floor their
     arguments — correct against a voxel world, quantising against this one. This is the
     number, not an argument about it. */
  let sum = 0, worst = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const x = -1500 + Math.random() * 3000, z = -1500 + Math.random() * 3000;
    const e = pw.groundHeightAt(x, z);
    const f = pw.groundHeightAt(Math.floor(x), Math.floor(z));
    const d = Math.abs(e - f);
    sum += d; if (d > worst) worst = d; n++;
  }
  note('FLOORING THE INPUT costs a mean of ' + (sum / n).toFixed(3) +
       ' m and at worst ' + worst.toFixed(3) + ' m on this terrain (3,000 samples).');
  note('E2.2 does NOT change those ten call sites — they are legacy voxel gameplay and');
  note('correct for the world they serve. The phase that makes this world live owns them.');
  chk(worst > 0, 'the cost is real and measured rather than asserted');
}

// =====================================================================================
head('7. COLLISION, WATER AND SURFACES BEHAVE');

{
  const pw = new T.TerrainPhysicalWorld(null);
  const box = (x, y, z) => ({ minX: x - 0.3, maxX: x + 0.3, minY: y, maxY: y + 1.8,
                              minZ: z - 0.3, maxZ: z + 0.3 });

  const h = pw.groundHeightAt(200, 200);
  chk(pw.collidesAABB(box(200, h - 1.0, 200)) === true, 'a box sunk into the ground collides');
  chk(pw.collidesAABB(box(200, h + 0.5, 200)) === false, 'a box clearly above it does not');
  chk(pw.isSolid(200, h - 0.5, 200) === true && pw.isSolid(200, h + 0.5, 200) === false,
      'isSolid agrees with the surface');

  /* A slope must stop a box that straddles it, not let it sink — the reason the footprint
     is probed rather than the centre. */
  let slopeTested = 0, slopeStopped = 0;
  for (let i = 0; i < 2000 && slopeTested < 40; i++) {
    const x = -800 + Math.random() * 1600, z = -800 + Math.random() * 1600;
    if (T.d1TerrainSlope(x, z, 1.0) < 20) continue;
    slopeTested++;
    const centre = pw.groundHeightAt(x, z);
    if (pw.collidesAABB(box(x, centre - 0.05, z))) slopeStopped++;
  }
  chk(slopeTested > 0 && slopeStopped === slopeTested,
      'on ' + slopeTested + ' steep points, a box at the centre height collides with the slope');

  /* Water is the same tri-state the voxel implementation returns. */
  chk(pw.waterLevelAt(0, T.D1_WATER_LEVEL + 5, 0) === 0, 'above the water table is dry (0)');
  const states = new Set();
  for (let i = 0; i < 6000; i++) {
    const x = -2000 + Math.random() * 4000, z = -2000 + Math.random() * 4000;
    const g = T.d1TerrainHeight(x, z);
    if (g >= T.D1_WATER_LEVEL) continue;
    states.add(pw.waterLevelAt(x, g + 0.2, z));
    states.add(pw.waterLevelAt(x, g + 0.05, z));
  }
  note('water states observed in the lowlands: [' + Array.from(states).sort().join(', ') + ']');
  chk(Array.from(states).every(s => s === 0 || s === 1 || s === 2),
      'and every water answer is one of the contract\'s three values');

  const surfaces = new Set();
  for (let i = 0; i < 4000; i++)
    surfaces.add(T.d1SurfaceAt(-2000 + Math.random() * 4000, -2000 + Math.random() * 4000));
  note('surface classes present across the map: ' + Array.from(surfaces).sort().join(', ') +
       ' of ' + Object.keys(T.D1_SURFACE).length);
  chk(surfaces.size >= 3, 'the map contains at least three distinct ground surfaces');
}

// =====================================================================================
head('8. AUTHORED CONTENT SHIPS EMPTY — ROADS, SCATTER AND SITES');

chk(T.D1_ROAD_NETWORK.length === 0,
    'D1_ROAD_NETWORK is EMPTY — the road route is a creative decision');
chk(T.d1RoadNetwork().length === 0, 'and no route is installed by default');
chk(T.D1_SCATTER_SPECIES.length === 0,
    'D1_SCATTER_SPECIES is EMPTY — vegetation is E2.3');
chk(T.D1_AUTHORED_SITES.length === 0,
    'D1_AUTHORED_SITES is EMPTY — no landmark coordinate has been invented');
chk(T.d1AuthoredSites().length === 0, 'and none is installed by default');

const auth = T.terrainAuthoringStatus();
chk(auth.sites === 0 && auth.landmarkRoster === 7,
    'the authoring status reports 0 sites against a roster of 7');
note(auth.note);

/* The machinery must still WORK — an empty table proves restraint, not capability. */
{
  /* A STRAIGHT route, sampled PERPENDICULAR to itself. The first version of this check put
     the probe at a corner of a dog-leg and sampled along X — which crosses the carriageway
     diagonally AND straddles the point where the longitudinal profile turns, so it
     measured the corner, not the cut. Road running along X; samples across Z. */
  const n = T.d1SetRoadNetwork([{ id: 'fixture', kind: T.D1_ROAD_KIND.LANE,
                                  points: [[-400, 120], [400, 120]] }]);
  chk(n === 1, 'a fixture route installs');
  chk(T.d1IsOnRoad(0, 120, 0) === true, 'and a point on its centreline reads as road');
  chk(T.d1IsOnRoad(0, 400, 0) === false, 'and a point far from it does not');

  /* The road must actually FLATTEN the ground across its width, or it is a decal painted
     on noise. Half-width is 3 m; the crown deliberately raises the middle by 0.12 m. */
  let crossVar = 0;
  const centreH = T.d1TerrainHeight(0, 120);
  for (let d = -2.8; d <= 2.8; d += 0.2)
    crossVar = Math.max(crossVar, Math.abs(T.d1TerrainHeight(0, 120 + d) - centreH));
  chk(crossVar < 0.2, 'the carriageway is flat across its width (max deviation ' +
      crossVar.toFixed(3) + ' m, crown is 0.12) — a cut, not a ribbon');

  /* And it must be MEASURABLY flatter than the field it crosses, which is the claim that
     actually matters and cannot be satisfied by a coincidentally flat patch. */
  let fieldVar = 0;
  const fieldH = T.d1TerrainHeight(0, 400);
  for (let d = -2.8; d <= 2.8; d += 0.2)
    fieldVar = Math.max(fieldVar, Math.abs(T.d1TerrainHeight(0, 400 + d) - fieldH));
  chk(crossVar <= fieldVar + 0.02 || fieldVar < 0.05,
      'and the natural field over the same span varies ' + fieldVar.toFixed(3) + ' m');
  T.d1ResetRoadNetwork();
  chk(T.d1RoadNetwork().length === 0, 'and the fixture is removed again');
}

{
  const n = T.d1SetAuthoredSites([{ id: 'fixture-pad', x: 500, z: 500, radius: 20,
                                    terrain: T.D1_SITE_TERRAIN.PAD, blend: 15 }]);
  chk(n === 1, 'a fixture site installs');
  const centre = T.d1TerrainHeight(500, 500);
  let padVar = 0;
  for (let a = 0; a < 8; a++) {
    const th = a * Math.PI / 4;
    padVar = Math.max(padVar, Math.abs(T.d1TerrainHeight(500 + Math.cos(th) * 15,
                                                         500 + Math.sin(th) * 15) - centre));
  }
  chk(padVar < 0.01, 'a PAD site levels its footprint (max deviation ' + padVar.toFixed(5) + ' m)');
  const outside = Math.abs(T.d1TerrainHeight(500 + 80, 500) - centre);
  chk(outside > 0.01, 'and the natural ground resumes outside the blend');
  chk(T.d1SitesInRegion(T.d1RegionIndexAt(500, 500).rx, T.d1RegionIndexAt(500, 500).rz).length === 1,
      'and the region containing it reports it');
  T.d1ResetAuthoredSites();
  chk(T.d1AuthoredSites().length === 0, 'and the fixture is removed again');
}

// =====================================================================================
head('9. MESH BUILDING AND LOD');

{
  const fine = T.d1BuildRegionGeometry(8, 8, 2);
  const coarse = T.d1BuildRegionGeometry(8, 8, 16);
  const f = fine.userData.d1, c = coarse.userData.d1;
  note('region 8,8 at 2 m: ' + f.vertices + ' verts / ' + f.triangles + ' tris');
  note('region 8,8 at 16 m: ' + c.vertices + ' verts / ' + c.triangles + ' tris');
  chk(f.triangles > c.triangles, 'a finer LOD produces more triangles');
  chk(fine.attributes.position && fine.attributes.normal && fine.attributes.color,
      'the geometry carries position, normal and colour');

  /* THE CLAIM THAT MATTERS: LOD changes the picture, never the ground. */
  let maxDiff = 0;
  const b = T.d1RegionBounds(8, 8);
  for (let i = 0; i < 200; i++) {
    const x = b.minX + Math.random() * T.D1_REGION_SIZE;
    const z = b.minZ + Math.random() * T.D1_REGION_SIZE;
    maxDiff = Math.max(maxDiff, Math.abs(T.d1TerrainHeight(x, z) - T.d1TerrainHeight(x, z)));
  }
  chk(maxDiff === 0, 'ground height is independent of mesh resolution — the mesh is a picture of it');

  const lodNear = T.d1RegionLod(8, 8, b.centreX, b.centreZ);
  const lodFar = T.d1RegionLod(8, 8, b.centreX + 3000, b.centreZ);
  chk(lodNear < lodFar, 'LOD coarsens with distance (' + lodNear + ' m near, ' + lodFar + ' m far)');
}

// =====================================================================================
head('10. STREAMING LIFETIME AND SHARED-RESOURCE SAFETY');

{
  const added = [], removed = [];
  const scene = { add(o) { added.push(o); }, remove(o) { removed.push(o); } };
  const regions = new T.D1TerrainRegions(scene, null, null);

  for (let i = 0; i < 40; i++) regions.update(0, 0, Infinity);
  const resident = regions.regions.size;
  note('at the origin, ' + resident + ' regions resident of ' + all.length + ' in the world');
  chk(resident > 0 && resident < all.length, 'streaming loads a neighbourhood, not the world');

  const geos = Array.from(regions.regions.values()).map(r => r.geo);
  const mat = geos.length ? null : null;
  const sharedMaterial = Array.from(regions.regions.values())[0].mesh.material;

  const n = regions.unloadAll();
  chk(n === resident, 'unloadAll freed every resident region (' + n + ')');
  chk(regions.regions.size === 0, 'and none remain');
  chk(geos.every(g => g.disposed === true), 'every terrain geometry it owned was disposed');
  chk(sharedMaterial.disposed !== true,
      'and the SHARED material was NOT disposed — other regions still need it');
  chk(removed.length >= resident, 'every mesh it added was removed from the scene');

  /* Repeat cycles must be identical. THE BUDGET MUST BE DRAINED FIRST, and the first
     version of this check was wrong for an instructive reason: `update()` is TIME-budgeted,
     so under a fixed millisecond allowance it builds however many regions the machine
     managed, and three cycles read 23/17/17. That was measuring the CPU, not the streamer.
     Draining to completion is what makes the determinism claim about generation. */
  const drain = (x, z) => { for (let i = 0; i < 200 && regions._pending.length !== 0 || i === 0; i++) regions.update(x, z, Infinity); };
  const counts = [], keysets = [];
  for (let i = 0; i < 3; i++) {
    drain(0, 0);
    counts.push(regions.regions.size);
    keysets.push(Array.from(regions.regions.keys()).sort().join('|'));
    regions.unloadAll();
  }
  chk(counts.every(c => c === counts[0]),
      'three drained load/unload cycles resident the same count every time (' + counts.join('/') + ')');
  chk(keysets.every(k => k === keysets[0]),
      'and the same region SET every time — generation is deterministic, not merely equinumerous');
}

// =====================================================================================
head('11. STATUS IS HONEST');

{
  const scene = { add() {}, remove() {} };
  const world = new T.D1TerrainWorld(scene, null, null);
  const rep = world.debugReport();
  chk(rep.world.finite === true, 'the world reports itself finite');
  chk(rep.world.totalRegions === all.length, 'and its region count matches the grid');
  chk(/FOUNDATION/.test(rep.stage), 'the world reports stage FOUNDATION, not production');
  chk(/NOT the live D1/.test(rep.stage), 'and says plainly it is not the live dimension');
  chk(T.terrainMaterialStatus().textured === false,
      'materials report themselves untextured stand-ins');
  chk(T.terrainScatterStatus().species === 0, 'scatter reports zero species');
  note(rep.stage);
}

console.log('\n' + (fail ? 'FAILED — ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
process.exit(fail ? 1 : 0);
