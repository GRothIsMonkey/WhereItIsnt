/* D1 IMPLEMENTATION PHASE 1 — THE COMPOSITE PHYSICAL WORLD, OFFLINE.

   WHAT THIS PROVES. That one gameplay-facing physical world composes TERRAIN with
   MESH/ARCHITECTURE COLLISION; that it implements the whole E2.1 contract; that each query
   resolves by its own documented policy (union for solidity, maximum for ground, base-only
   for water and everything the providers cannot express); that the composition is
   deterministic and independent of the order providers were added; that provider lifecycle
   is idempotent and leaks nothing; and — the A/B gate — that the answers a caller gets
   through `D1TerrainWorld.physical` are IDENTICAL to what the pre-phase build returned.

   WHAT IT CANNOT PROVE. That anything renders, or that walking into a building feels
   right. That is tests/browser-terrain.js and, ultimately, a person.

   THE PROVIDER UNDER TEST IS THE REAL `AssetCollisionSet`, not a stand-in — the point is
   that the real proxy set composes, and a hand-written double could agree with a contract
   the shipped class does not actually honour. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TDIR = path.join(ROOT, 'src', 'world', 'terrain');
const TFILES = ['terrain-config.js', 'terrain-roads.js', 'terrain-authoring.js',
                'terrain-heightfield.js', 'terrain-materials.js', 'terrain-mesh.js',
                'terrain-scatter.js', 'terrain-regions.js', 'terrain-physical-world.js',
                'terrain-world.js'];

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (m) => console.log('      ' + m);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

/* ---------------------------------------------------------------------------------------
   THE ENVIRONMENT. Terrain maths + the real asset collision set + the composite, with the
   smallest THREE that `AssetCollisionSet.add` genuinely uses: a Vector3 that can be pushed
   through a Matrix4. Nothing here reimplements a query under test.
   ------------------------------------------------------------------------------------- */
function makeThreeStub() {
  return `
    var THREE = {
      Vector3: function (x, y, z) {
        this.x = x||0; this.y = y||0; this.z = z||0;
        this.applyMatrix4 = function (m) {
          var e = m.elements, X = this.x, Y = this.y, Z = this.z;
          var w = e[3]*X + e[7]*Y + e[11]*Z + e[15]; w = w || 1;
          this.x = (e[0]*X + e[4]*Y + e[8]*Z  + e[12]) / w;
          this.y = (e[1]*X + e[5]*Y + e[9]*Z  + e[13]) / w;
          this.z = (e[2]*X + e[6]*Y + e[10]*Z + e[14]) / w;
          return this;
        };
        this.distanceTo = function (o) {
          var a = this.x-o.x, b = this.y-o.y, c = this.z-o.z;
          return Math.sqrt(a*a + b*b + c*c);
        };
      },
      BufferGeometry: function () { this.attributes = {}; this.userData = {};
        this.setAttribute = function (n, a) { this.attributes[n] = a; };
        this.setIndex = function (a) { this.index = a; };
        this.dispose = function () { this.disposed = true; }; },
      BufferAttribute: function (arr, n) { this.array = arr; this.itemSize = n; this.count = arr.length / n; },
      Box3: function (a, b) { this.min = a; this.max = b; },
      Sphere: function (c, r) { this.center = c; this.radius = r; },
      Mesh: function (g, m) { this.geometry = g; this.material = m; this.name = ''; this.userData = {}; },
      PlaneGeometry: function () { this.userData = {};
        this.rotateX = function () { return this; }; this.translate = function () { return this; };
        this.dispose = function () { this.disposed = true; }; },
      MeshStandardMaterial: function (o) { Object.assign(this, o || {}); this.uuid = 'm' + (THREE.__uid = (THREE.__uid||0) + 1);
        this.dispose = function () { this.disposed = true; }; },
    };
    /* The registry rows AssetCollisionSet reads. Test geometry only — no production asset
       is referenced, loaded or added by this suite. */
    var ASSET_COLLISION = { NONE: 'none', BOX: 'box', BOXES: 'boxes' };
    var MODEL_ASSETS = {
      'test.slab':  { collision: 'boxes', boxes: [[-2, 0, -2, 2, 1, 2]] },
      'test.tower': { collision: 'boxes', boxes: [[-1, 0, -1, 1, 8, 1]] },
      'test.deck':  { collision: 'boxes', boxes: [[-3, 0, -3, 3, 6, 3]] },
      'test.none':  { collision: 'none' },
    };
  `;
}

/* An identity-translation matrix, which is all a placed test proxy needs. */
function placedAt(ctx, key, x, y, z) {
  const inst = {
    userData: { assetKey: key },
    updateMatrixWorld() {},
    matrixWorld: { elements: [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1] },
  };
  return inst;
}

function boot(terrainPhysicalSource) {
  const ctx = vm.createContext({ Math, Float32Array, Uint16Array, Uint32Array, console, Infinity,
                                 performance: { now: () => Date.now() } });
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'shared', 'simplex-noise.js'), 'utf8'), ctx);
  vm.runInContext(makeThreeStub(), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'assets', 'asset-collision.js'), 'utf8'),
                  ctx, { filename: 'asset-collision.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'world', 'composite-physical-world.js'), 'utf8'),
                  ctx, { filename: 'composite-physical-world.js' });
  for (const f of TFILES) {
    const src = (f === 'terrain-physical-world.js' && terrainPhysicalSource)
      ? terrainPhysicalSource
      : fs.readFileSync(path.join(TDIR, f), 'utf8');
    vm.runInContext(src, ctx, { filename: f });
  }
  return ctx;
}

const NOW = boot(null);
const G = (name) => vm.runInContext(name, NOW);

/* ======================================================================================
   1. THE COMPOSITE IMPLEMENTS THE WHOLE CONTRACT
   ==================================================================================== */
head('1. THE COMPOSITE SATISFIES THE E2.1 PHYSICALWORLD CONTRACT');

const CONTRACT = ['collidesAABB', 'isSolid', 'groundHeightAt', 'waterLevelAt',
                  'isResidentAround', 'editEpoch', 'hasOpenSkyAbove', 'lightLevelAt',
                  'nearestLightSourceDistance', 'isInsideSafeZone', 'isInsideSoulAnchorZone'];

const compProto = vm.runInContext('Object.getOwnPropertyNames(CompositePhysicalWorld.prototype)', NOW);
const terrProto = vm.runInContext('Object.getOwnPropertyNames(TerrainPhysicalWorld.prototype)', NOW);

const missing = CONTRACT.filter((m) => compProto.indexOf(m) === -1);
chk(missing.length === 0,
    `the composite implements all ${CONTRACT.length} contract queries` +
    (missing.length ? ' — missing ' + missing.join(', ') : ''));

const terrOnly = terrProto.filter((m) => m !== 'constructor' && compProto.indexOf(m) === -1);
chk(terrOnly.length === 0,
    'the composite exposes every query the terrain backend does' +
    (terrOnly.length ? ' — missing ' + terrOnly.join(', ') : ''));

chk(vm.runInContext('typeof CompositePhysicalWorld', NOW) === 'function',
    'CompositePhysicalWorld is a declared class in the shared scope');

let threw = false;
try { vm.runInContext('new CompositePhysicalWorld(null)', NOW); } catch (e) { threw = true; }
chk(threw, 'a composite REFUSES to be built without a base — it has no answers of its own');

/* ======================================================================================
   2. THE A/B GATE — TERRAIN-ONLY ANSWERS ARE UNCHANGED
   ==================================================================================== */
head('2. A/B AGAINST THE PRE-PHASE BUILD — TERRAIN BEHAVIOUR IS UNCHANGED');

/* The OLD terrain physical world composed assets inline. Booted here from git, unmodified,
   so the comparison is against what actually shipped rather than a memory of it. */
let OLD = null;
try {
  const oldSrc = execFileSync('git', ['show', 'HEAD:src/world/terrain/terrain-physical-world.js'],
                              { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 });
  OLD = boot(oldSrc);
  note('pre-phase terrain-physical-world.js loaded from git HEAD');
} catch (e) {
  note('could not load the pre-phase file from git: ' + e.message);
}

if (OLD) {
  /* Deterministic sample points spread across the whole map, including the edge margin. */
  const pts = [];
  let seed = 20260918;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 1200; i++) pts.push([(rnd() - 0.5) * 4300, (rnd() - 0.5) * 4300]);

  const oldW = vm.runInContext('new D1TerrainWorld(null, null, null)', OLD);
  const newW = vm.runInContext('new D1TerrainWorld(null, null, null)', NOW);

  let gDiff = 0, wDiff = 0, sDiff = 0, cDiff = 0, worst = 0;
  for (const [x, z] of pts) {
    const og = oldW.physical.groundHeightAt(x, z);
    const ng = newW.physical.groundHeightAt(x, z);
    if (og !== ng) { gDiff++; worst = Math.max(worst, Math.abs(og - ng)); }

    for (const dy of [-3, 0, 2]) {
      const y = og + dy;
      if (oldW.physical.waterLevelAt(x, y, z) !== newW.physical.waterLevelAt(x, y, z)) wDiff++;
      if (oldW.physical.isSolid(x, y, z) !== newW.physical.isSolid(x, y, z)) sDiff++;
      const box = { minX: x - 0.4, maxX: x + 0.4, minY: y, maxY: y + 1.8, minZ: z - 0.4, maxZ: z + 0.4 };
      if (oldW.physical.collidesAABB(box) !== newW.physical.collidesAABB(box)) cDiff++;
    }
  }
  note(`${pts.length} points x {ground, 3 x water, 3 x isSolid, 3 x collidesAABB} = ${pts.length * 10} comparisons`);
  chk(gDiff === 0, `ground height is IDENTICAL at every sample (${gDiff} differences, worst ${worst})`);
  chk(wDiff === 0, `water level is IDENTICAL at every sample (${wDiff} differences)`);
  chk(sDiff === 0, `isSolid is IDENTICAL at every sample (${sDiff} differences)`);
  chk(cDiff === 0, `collidesAABB is IDENTICAL at every sample (${cDiff} differences)`);

  /* And with a proxy placed, the old inline composition and the new explicit one must
     still agree — that is the part a refactor could silently change. */
  const oldSet = oldW.assetCollision, newSet = newW.assetCollision;
  const gy = oldW.physical.groundHeightAt(100, 100);
  oldSet.add(placedAt(OLD, 'test.slab', 100, gy + 2, 100), null);
  newSet.add(placedAt(NOW, 'test.slab', 100, gy + 2, 100), null);

  let pDiff = 0;
  for (let i = 0; i < 400; i++) {
    const x = 100 + (rnd() - 0.5) * 12, z = 100 + (rnd() - 0.5) * 12;
    if (oldW.physical.groundHeightAt(x, z) !== newW.physical.groundHeightAt(x, z)) pDiff++;
    const y = gy + (rnd() * 6 - 1);
    if (oldW.physical.isSolid(x, y, z) !== newW.physical.isSolid(x, y, z)) pDiff++;
    const box = { minX: x - 0.4, maxX: x + 0.4, minY: y, maxY: y + 1.8, minZ: z - 0.4, maxZ: z + 0.4 };
    if (oldW.physical.collidesAABB(box) !== newW.physical.collidesAABB(box)) pDiff++;
  }
  chk(pDiff === 0, `with an authored proxy placed, old inline and new composite agree on all 1200 answers (${pDiff} differences)`);
} else {
  chk(false, 'the A/B comparison could not run — see the note above');
}

/* ======================================================================================
   3. COLLISION COMPOSITION — THE EIGHT CASES
   ==================================================================================== */
head('3. COLLISION COMPOSITION');

const W = vm.runInContext('new D1TerrainWorld(null, null, null)', NOW);
const P = W.physical;
const SET = W.assetCollision;
const boxAt = (x, y, z, r, h) => ({ minX: x - r, maxX: x + r, minY: y, maxY: y + (h || 1.8),
                                    minZ: z - r, maxZ: z + r });

/* A column of open air high above the ground, far from anything placed. */
const AIRX = -900, AIRZ = -900;
const airGround = P.groundHeightAt(AIRX, AIRZ);

chk(P.collidesAABB(boxAt(AIRX, airGround - 2, AIRZ, 0.4)) === true,
    'A. terrain only — a box below the surface collides');
chk(P.collidesAABB(boxAt(AIRX, airGround + 40, AIRZ, 0.4)) === false,
    'D. empty space — a box far above the ground with nothing placed does not collide');

/* B. asset only — placed high above the terrain so terrain cannot be the reason. */
const HIX = 400, HIZ = 400;
const hiGround = P.groundHeightAt(HIX, HIZ);
const towerInst = placedAt(NOW, 'test.tower', HIX, hiGround + 30, HIZ);
SET.add(towerInst, null);
chk(P.collidesAABB(boxAt(HIX, hiGround + 32, HIZ, 0.4)) === true,
    'B. asset only — a box inside a proxy 30 m above the terrain collides');
chk(SET.collidesAABB(boxAt(HIX, hiGround + 32, HIZ, 0.4)) === true &&
    W.terrain.collidesAABB(boxAt(HIX, hiGround + 32, HIZ, 0.4)) === false,
    '   and it is the PROVIDER answering, not the terrain — terrain alone says no');

/* C. overlap — a proxy sunk into the ground; both would answer true. */
const OVX = -300, OVZ = 250;
const ovGround = P.groundHeightAt(OVX, OVZ);
SET.add(placedAt(NOW, 'test.slab', OVX, ovGround - 0.5, OVZ), null);
chk(P.collidesAABB(boxAt(OVX, ovGround - 1, OVZ, 0.4)) === true,
    'C. terrain + asset overlap — collides, and the union does not double-count into a wrong answer');

/* E. boundary — just outside the proxy footprint and above the terrain. */
chk(P.collidesAABB(boxAt(HIX + 4, hiGround + 32, HIZ, 0.3)) === false,
    'E. asset boundary — 4 m outside the proxy, above the terrain, is open air');
chk(P.collidesAABB(boxAt(HIX + 0.5, hiGround + 32, HIZ, 0.3)) === true,
    '   and just inside the footprint still collides');

/* F. multiple overlapping proxies. */
const MUX = 700, MUZ = -700;
const muGround = P.groundHeightAt(MUX, MUZ);
const mA = placedAt(NOW, 'test.slab', MUX, muGround + 20, MUZ);
const mB = placedAt(NOW, 'test.slab', MUX + 1, muGround + 20, MUZ + 1);
SET.add(mA, null); SET.add(mB, null);
chk(P.collidesAABB(boxAt(MUX + 0.5, muGround + 20.4, MUZ + 0.5, 0.2)) === true,
    'F. two overlapping proxies — the shared volume collides exactly once and answers true');
chk(P.groundHeightAt(MUX + 0.5, MUZ + 0.5) === muGround + 21,
    '   and the ground over both is the single highest surface, not a sum');

/* G/H. disposal and reload. */
SET.remove(mA); SET.remove(mB);
chk(P.collidesAABB(boxAt(MUX + 0.5, muGround + 20.4, MUZ + 0.5, 0.2)) === false,
    'G. disposed proxies stop colliding immediately');
chk(P.groundHeightAt(MUX + 0.5, MUZ + 0.5) === W.terrain.groundHeightAt(MUX + 0.5, MUZ + 0.5),
    '   and the ground falls back to the terrain at that exact column, with nothing cached');
SET.add(mA, null);
chk(P.collidesAABB(boxAt(MUX + 0.5, muGround + 20.4, MUZ + 0.5, 0.2)) === true,
    'H. re-registered collision is live again');
SET.remove(mA);

/* ======================================================================================
   4. GROUND HEIGHT RESOLUTION — MAXIMUM, WITH null MEANING "NO OPINION"
   ==================================================================================== */
head('4. GROUND HEIGHT RESOLUTION');

const GX = -1500, GZ = 800;
const gTerrain = P.groundHeightAt(GX, GZ);
chk(gTerrain === W.terrain.groundHeightAt(GX, GZ),
    'with nothing placed the composite returns the terrain height exactly');
chk(SET.groundHeightAt(GX, GZ) === null,
    'and the provider says null — "no opinion", which is not a height of zero');

const deck = placedAt(NOW, 'test.deck', GX, gTerrain + 4, GZ);
SET.add(deck, null);
chk(P.groundHeightAt(GX, GZ) === gTerrain + 10,
    'a deck above the terrain becomes the ground — a floor is what you stand on');
chk(W.terrain.groundHeightAt(GX, GZ) === gTerrain,
    'and the terrain backend is unaffected — it still answers for the heightfield alone');

/* A proxy BELOW the terrain must not lower the ground. */
const buried = placedAt(NOW, 'test.slab', GX, gTerrain - 50, GZ);
SET.add(buried, null);
chk(P.groundHeightAt(GX, GZ) === gTerrain + 10,
    'a buried proxy does not lower the ground — MAXIMUM, never "last one wins"');
SET.remove(buried);
SET.remove(deck);
chk(P.groundHeightAt(GX, GZ) === gTerrain,
    'and removing the deck returns the ground to the terrain');

/* Negative terrain must survive a null provider — the null-is-not-zero case with teeth. */
let lowest = Infinity, lowPt = null;
for (let i = 0; i < 4000; i++) {
  const x = ((i * 37) % 4000) - 2000, z = ((i * 91) % 4000) - 2000;
  const h = P.groundHeightAt(x, z);
  if (h < lowest) { lowest = h; lowPt = [x, z]; }
}
chk(lowest < 0, `the map has ground below y=0 (lowest sampled ${lowest.toFixed(2)} m) — so null-as-zero would be visible`);
chk(P.groundHeightAt(lowPt[0], lowPt[1]) === W.terrain.groundHeightAt(lowPt[0], lowPt[1]),
    'and at that point the composite still returns the negative terrain height, not 0');

/* ======================================================================================
   5. WATER — BASE ONLY, AND ARCHITECTURE DOES NOT DRAIN IT
   ==================================================================================== */
head('5. WATER DEPTH RESOLUTION');

/* Find a genuinely wet column. */
let wet = null;
for (let i = 0; i < 20000 && !wet; i++) {
  const x = ((i * 53) % 4000) - 2000, z = ((i * 149) % 4000) - 2000;
  const g = W.terrain.groundHeightAt(x, z);
  if (g < vm.runInContext('D1_WATER_LEVEL', NOW) - 2) wet = [x, z, g];
}
if (wet) {
  const [wx, wz, wg] = wet;
  const before = P.waterLevelAt(wx, wg + 0.2, wz);
  chk(before > 0, `a submerged point reads wet (level ${before}) before anything is placed`);
  const bridge = placedAt(NOW, 'test.deck', wx, wg + 8, wz);
  SET.add(bridge, null);
  chk(P.waterLevelAt(wx, wg + 0.2, wz) === before,
      'architecture standing above the water does NOT drain it — water is the base\'s answer');
  chk(P.groundHeightAt(wx, wz) > wg,
      'though the same structure DOES provide a walkable surface above it');
  chk(P.waterLevelAt(wx, wg + 40, wz) === 0,
      'and a point above the water surface is dry, as it was');
  SET.remove(bridge);
  chk(P.waterLevelAt(wx, wg + 0.2, wz) === before, 'removing it changes nothing about the water');
} else {
  chk(false, 'could not find a submerged column to test water against');
}

/* Outside the terrain, water must still answer without throwing. */
let outOk = true;
try { P.waterLevelAt(99999, 10, 99999); } catch (e) { outOk = false; }
chk(outOk, 'a water query far outside the world answers rather than throwing');

/* ======================================================================================
   6. PROVIDER LIFECYCLE
   ==================================================================================== */
head('6. PROVIDER LIFECYCLE');

const bare = vm.runInContext('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))', NOW);
const p1 = vm.runInContext('new AssetCollisionSet()', NOW);
const p2 = vm.runInContext('new AssetCollisionSet()', NOW);

chk(bare.providerCount === 0, 'a composite starts with no providers');
chk(bare.addProvider(p1) === true && bare.providerCount === 1, 'adding a provider registers it');
chk(bare.addProvider(p1) === false && bare.providerCount === 1,
    'adding the SAME provider twice does not duplicate it — a region that streams in twice is safe');
chk(bare.addProvider(p2) === true && bare.providerCount === 2, 'a second, different provider is added');
chk(bare.removeProvider(p1) === true && bare.providerCount === 1, 'removing a provider unregisters it');
chk(bare.removeProvider(p1) === false && bare.providerCount === 1,
    'removing it AGAIN is a safe no-op — a disposed region may unregister sloppily');
chk(bare.removeProvider({}) === false, 'removing something never added is a safe no-op');
chk(bare.clearProviders() === 1 && bare.providerCount === 0, 'clearProviders drops the rest');
chk(bare.clearProviders() === 0, 'and clearing an empty composite is a no-op');
chk(bare.base !== null && typeof bare.groundHeightAt(0, 0) === 'number',
    'clearing providers does NOT tear down the base — the ground is still there');

/* No dead references left behind. */
bare.addProvider(p1); bare.removeProvider(p1);
chk(bare.providers.indexOf(p1) === -1 && bare.providers.length === 0,
    'a removed provider leaves no dead entry in the list');

/* A provider that implements only some queries must not break the others. */
const partial = { groundHeightAt: () => 999 };
bare.addProvider(partial);
chk(bare.groundHeightAt(0, 0) === 999, 'a provider may implement groundHeightAt alone');
let partialOk = true;
try { bare.collidesAABB(boxAt(0, 0, 0, 1)); bare.isSolid(0, 0, 0); } catch (e) { partialOk = false; }
chk(partialOk, 'and the queries it does NOT implement are simply skipped, not called');
bare.clearProviders();

/* editEpoch moves on a provider mutation, because the shape of the world changed. */
const e0 = bare.editEpoch();
bare.addProvider(p1);
const e1 = bare.editEpoch();
bare.removeProvider(p1);
const e2 = bare.editEpoch();
chk(e1 !== e0 && e2 !== e1, `editEpoch moves when providers change (${e0} -> ${e1} -> ${e2})`);

const undef = vm.runInContext(`new CompositePhysicalWorld({
  collidesAABB: () => false, isSolid: () => false, groundHeightAt: () => 0,
  waterLevelAt: () => 0, isResidentAround: () => true, editEpoch: () => undefined,
  hasOpenSkyAbove: () => true, lightLevelAt: () => 0,
  nearestLightSourceDistance: () => Infinity,
  isInsideSafeZone: () => false, isInsideSoulAnchorZone: () => false })`, NOW);
undef.addProvider(p1);
chk(undef.editEpoch() === undefined,
    'a base that answers "cannot tell" still answers undefined — the composite does not invent a number');

/* ======================================================================================
   7. DETERMINISM AND ORDER INDEPENDENCE
   ==================================================================================== */
head('7. DETERMINISM');

const src = fs.readFileSync(path.join(ROOT, 'src', 'world', 'composite-physical-world.js'), 'utf8');
/* COMMENTS ARE STRIPPED FIRST, and that is not a loophole — the header of that file
   explains, in prose, that it uses no Math.random and no clock. A grep over the raw text
   would fail on the sentence that documents the property it is checking. */
const srcCode = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
chk(!/Math\.random/.test(srcCode), 'the composite contains no Math.random in executable code');
chk(!/Date\.now|performance\.now|new Date/.test(srcCode), 'and nothing time-dependent');

/* Same query, repeated, with several proxies placed. */
const DX = 1200, DZ = -1200;
const dG = P.groundHeightAt(DX, DZ);
const three = [placedAt(NOW, 'test.slab', DX, dG + 3, DZ),
               placedAt(NOW, 'test.tower', DX + 1, dG + 1, DZ),
               placedAt(NOW, 'test.deck', DX - 1, dG + 5, DZ)];
for (const t of three) SET.add(t, null);

const first = P.groundHeightAt(DX, DZ);
let stable = true;
for (let i = 0; i < 500; i++) if (P.groundHeightAt(DX, DZ) !== first) stable = false;
chk(stable, `500 repeats of the same query give the same answer (${first})`);

/* Order independence: build composites with the providers in both orders. */
const sA = vm.runInContext('new AssetCollisionSet()', NOW);
const sB = vm.runInContext('new AssetCollisionSet()', NOW);
sA.add(placedAt(NOW, 'test.slab', DX, dG + 3, DZ), null);
sB.add(placedAt(NOW, 'test.deck', DX, dG + 5, DZ), null);
const fwd = vm.runInContext('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))', NOW);
const rev = vm.runInContext('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))', NOW);
fwd.addProvider(sA); fwd.addProvider(sB);
rev.addProvider(sB); rev.addProvider(sA);

let orderDiff = 0;
for (let i = 0; i < 600; i++) {
  const x = DX + ((i * 7) % 20) - 10, z = DZ + ((i * 11) % 20) - 10;
  if (fwd.groundHeightAt(x, z) !== rev.groundHeightAt(x, z)) orderDiff++;
  const y = dG + (i % 9) - 2;
  if (fwd.isSolid(x, y, z) !== rev.isSolid(x, y, z)) orderDiff++;
  const b = boxAt(x, y, z, 0.4);
  if (fwd.collidesAABB(b) !== rev.collidesAABB(b)) orderDiff++;
}
chk(orderDiff === 0,
    `provider ORDER does not change any of 1800 answers (${orderDiff} differences) — union and maximum are commutative`);

for (const t of three) SET.remove(t);

/* ======================================================================================
   8. BASE-ONLY QUERIES ARE FORWARDED UNCHANGED
   ==================================================================================== */
head('8. BASE-ONLY QUERIES');

const fwdChecks = [
  ['waterLevelAt', () => P.waterLevelAt(10, 5, 10) === W.terrain.waterLevelAt(10, 5, 10)],
  ['isResidentAround', () => P.isResidentAround(0, 0, 10, 10) === W.terrain.isResidentAround(0, 0, 10, 10)],
  ['hasOpenSkyAbove', () => P.hasOpenSkyAbove(10, 50, 10) === W.terrain.hasOpenSkyAbove(10, 50, 10)],
  ['lightLevelAt', () => P.lightLevelAt(10, 50, 10) === W.terrain.lightLevelAt(10, 50, 10)],
  ['nearestLightSourceDistance', () => P.nearestLightSourceDistance({ x: 0, y: 0, z: 0 }) ===
      W.terrain.nearestLightSourceDistance({ x: 0, y: 0, z: 0 })],
  ['isInsideSafeZone', () => P.isInsideSafeZone({ x: 0, y: 0, z: 0 }) === W.terrain.isInsideSafeZone({ x: 0, y: 0, z: 0 })],
  ['isInsideSoulAnchorZone', () => P.isInsideSoulAnchorZone({ x: 0, y: 0, z: 0 }) ===
      W.terrain.isInsideSoulAnchorZone({ x: 0, y: 0, z: 0 })],
];
for (const [name, f] of fwdChecks) chk(f() === true, `${name} forwards to the base unchanged`);

/* ======================================================================================
   9. THE TERRAIN BACKEND NO LONGER KNOWS ABOUT ASSETS
   ==================================================================================== */
head('9. THE SEAM — TERRAIN IS PURE TERRAIN AGAIN');

const tSrc = fs.readFileSync(path.join(TDIR, 'terrain-physical-world.js'), 'utf8');
const tCode = tSrc.replace(/\/\*[\s\S]*?\*\//g, '');
chk(!/assetCollision/.test(tCode),
    'terrain-physical-world.js names no asset collision in executable code — the composition moved out');
const wSrc = fs.readFileSync(path.join(TDIR, 'terrain-world.js'), 'utf8');
chk(/new CompositePhysicalWorld\(/.test(wSrc),
    'D1TerrainWorld builds the composite as the physical world gameplay sees');
chk(/this\.terrain\s*=\s*new TerrainPhysicalWorld/.test(wSrc),
    'and still exposes the bare terrain backend for anything that wants the ground alone');

const cSrc = srcCode;
chk(!/BLOCK\.|CHUNK_S[XYZ]|getBlockWorld/.test(cSrc),
    'the composite names no block id, chunk or voxel member — it is representation-neutral');
chk(!/THREE\./.test(cSrc), 'and it touches no THREE — it is physics, not rendering');

/* ======================================================================================
   10. COST
   ==================================================================================== */
head('10. COST OF COMPOSITION');

function bench(fn, n) {
  fn(); // warm
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn(i);
  return Number(process.hrtime.bigint() - t0) / 1e6;
}
const N = 200000;
const bareT = vm.runInContext('new TerrainPhysicalWorld(null)', NOW);
const comp0 = vm.runInContext('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))', NOW);
const set1 = vm.runInContext('new AssetCollisionSet()', NOW);
set1.add(placedAt(NOW, 'test.slab', 0, 40, 0), null);
const comp1 = vm.runInContext('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))', NOW);
comp1.addProvider(set1);
const setN = vm.runInContext('new AssetCollisionSet()', NOW);
for (let i = 0; i < 24; i++) setN.add(placedAt(NOW, 'test.slab', i * 9, 40, i * 7), null);
const compN = vm.runInContext('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))', NOW);
compN.addProvider(setN);

const q = (w) => (i) => w.groundHeightAt((i % 1000) - 500, ((i * 3) % 1000) - 500);
const tA = bench(q(bareT), N);
const tB = bench(q(comp0), N);
const tC = bench(q(comp1), N);
const tD = bench(q(compN), N);
note(`groundHeightAt x ${N}:  terrain-only ${tA.toFixed(0)} ms | composite+0 ${tB.toFixed(0)} ms | +1 proxy ${tC.toFixed(0)} ms | +24 proxies ${tD.toFixed(0)} ms`);
chk(tB < tA * 1.60 + 20,
    `composition with no providers costs little over the bare terrain (${((tB / tA - 1) * 100).toFixed(1)}%)`);
chk(tD < tA * 6 + 60, 'and with 24 proxies it stays within a small multiple of the terrain query');
note('the provider walk is linear in proxy count by design — AssetCollisionSet is a flat list');
note('until there is a real distribution to index against (CLAUDE.md section 14)');

/* ======================================================================================
   ==================================================================================== */
console.log('');
if (fail === 0) {
  console.log('ALL COMPOSITE PHYSICAL WORLD CHECKS PASS');
  note('Offline. This proves composition, policy, lifecycle and determinism — not that a');
  note('building is fun to walk into. No landmark, asset or interaction exists yet.');
} else {
  console.log(fail + ' COMPOSITE FAILURES');
}
process.exit(fail === 0 ? 0 : 1);
