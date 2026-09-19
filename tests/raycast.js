/* D1 IMPLEMENTATION PHASE 2 — NORMALIZED RAYCAST + INTERACTION VOCABULARY, OFFLINE.

   WHAT THIS PROVES. That a gameplay caller can ask the physical world what is along a ray
   and get a representation-neutral answer; that the mesh provider raycasts DECLARED
   COLLISION PROXIES and not decorative geometry; that the composite selects the nearest hit
   deterministically, with a tie-break that does not depend on registration order; that
   lifecycle changes are reflected immediately; that the voxel path still answers through an
   adapter over the DDA it already had; and that the interaction vocabulary is exactly three
   words with no D1 content in it.

   WHAT IT CANNOT PROVE. That aiming at something feels right, or that any of it renders.
   That is tests/browser-raycast.js and, ultimately, a person. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

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
const near = (a, b, eps) => Math.abs(a - b) < (eps === undefined ? 1e-6 : eps);

const ctx = vm.createContext({ Math, Float32Array, Uint16Array, Uint32Array, console, Infinity, Map,
                               Object, Array, Set, performance: { now: () => Date.now() } });
ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'shared', 'simplex-noise.js'), 'utf8'), ctx);
vm.runInContext(`
  var THREE = {
    Vector3: function (x, y, z) {
      this.x = x||0; this.y = y||0; this.z = z||0;
      this.applyMatrix4 = function (m) {
        var e = m.elements, X = this.x, Y = this.y, Z = this.z;
        var w = e[3]*X + e[7]*Y + e[11]*Z + e[15]; w = w || 1;
        this.x = (e[0]*X + e[4]*Y + e[8]*Z  + e[12]) / w;
        this.y = (e[1]*X + e[5]*Y + e[9]*Z  + e[13]) / w;
        this.z = (e[2]*X + e[6]*Y + e[10]*Z + e[14]) / w;
        return this; };
    },
    BufferGeometry: function () { this.attributes = {}; this.userData = {};
      this.setAttribute = function (n,a) { this.attributes[n]=a; };
      this.setIndex = function (a) { this.index=a; };
      this.dispose = function () { this.disposed = true; }; },
    BufferAttribute: function (arr,n) { this.array=arr; this.itemSize=n; this.count=arr.length/n; },
    Box3: function (a,b) { this.min=a; this.max=b; },
    Sphere: function (c,r) { this.center=c; this.radius=r; },
    Mesh: function (g,m) { this.geometry=g; this.material=m; this.name=''; this.userData={}; },
    PlaneGeometry: function () { this.userData={};
      this.rotateX=function(){return this;}; this.translate=function(){return this;};
      this.dispose=function(){this.disposed=true;}; },
    MeshStandardMaterial: function (o) { Object.assign(this,o||{});
      this.uuid='m'+(THREE.__u=(THREE.__u||0)+1); this.dispose=function(){this.disposed=true;}; },
  };
  var ASSET_COLLISION = { NONE: 'none', BOX: 'box', BOXES: 'boxes' };
  /* TEST FIXTURES ONLY. No production asset is referenced, loaded or placed by this suite,
     and none of these is D1 content. 'test.decor' exists specifically to prove that a
     decorative asset with no declared collision is NOT raycastable. */
  var MODEL_ASSETS = {
    'test.wall':  { collision: 'boxes', boxes: [[-0.5, 0, -5, 0.5, 4, 5]] },
    'test.block': { collision: 'boxes', boxes: [[-1, -1, -1, 1, 1, 1]] },
    'test.decor': { collision: 'none' },
  };
`, ctx);
for (const f of ['src/world/raycast.js', 'src/gameplay/interaction.js',
                 'src/assets/asset-collision.js', 'src/world/composite-physical-world.js',
                 'src/world/physical-world.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
for (const f of TFILES) vm.runInContext(fs.readFileSync(path.join(TDIR, f), 'utf8'), ctx, { filename: f });

const G = (n) => vm.runInContext(n, ctx);
const NEW = (expr) => vm.runInContext(expr, ctx);

function placed(key, x, y, z) {
  return { userData: { assetKey: key }, updateMatrixWorld() {},
           matrixWorld: { elements: [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1] } };
}
const V = (x, y, z) => ({ x, y, z });
/* Every direction in this suite is unit length — the contract requires it of the caller. */
const DOWN = V(0, -1, 0), UP = V(0, 1, 0), EAST = V(1, 0, 0), WEST = V(-1, 0, 0);

/* ======================================================================================
   1. THE CONTRACT
   ==================================================================================== */
head('1. THE NORMALIZED HIT CONTRACT');

chk(G('RAYCAST_MISS') === null, 'a MISS is null — not a falsy-trap object with hit:false');
chk(typeof G('RAYCAST_CATEGORY.TERRAIN') === 'string' && typeof G('RAYCAST_CATEGORY.ASSET') === 'string',
    'RAYCAST_CATEGORY names the two kinds of thing that can answer');
chk(G('Object.keys(RAYCAST_CATEGORY).length') === 2,
    'and there are exactly two — no D1 interaction category has been invented here');

const src = fs.readFileSync(path.join(ROOT, 'src', 'world', 'raycast.js'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
chk(!/THREE\./.test(code), 'src/world/raycast.js names no THREE — a hit carries no renderer object');
chk(!/Math\.random|Date\.now|performance\.now/.test(code), 'and nothing random or time-dependent');

const h = NEW("makeRayHit(3, {x:1,y:2,z:3}, {x:0,y:1,z:0}, RAYCAST_CATEGORY.ASSET, 7, 7)");
chk(['distance','point','normal','category','ref','providerId'].every(k => k in h),
    'a hit carries distance, point, normal, category, ref and providerId');
/* A THREE.Vector3 would carry `set`, `copy`, `distanceTo` and forty more on its
   prototype. A plain literal carries exactly three own number keys and nothing else,
   which is what a representation-neutral hit is allowed to hand a caller. */
const pointKeys = NEW("Object.keys(makeRayHit(3,{x:1,y:2,z:3},null,'terrain',null,null).point)");
chk(typeof h.point.x === 'number' && pointKeys.length === 3 &&
    !Object.getOwnPropertyNames(Object.getPrototypeOf(h.point) || {}).includes('distanceTo'),
    'and the point is a plain object, not a THREE.Vector3');

chk(G('rayIsNormalized(0,-1,0)') === true && G('rayIsNormalized(0,-2,0)') === false,
    'rayIsNormalized is the one direction convention, testable rather than silently applied');

/* ======================================================================================
   2. THE SLAB TEST AND THE BOTH-SIDES RULE
   ==================================================================================== */
head('2. RAY / BOX PRIMITIVE');

const box = { minX: -1, minY: -1, minZ: -1, maxX: 1, maxY: 1, maxZ: 1 };
ctx.__box = box;
chk(near(G('rayAabbDistance(0, 10, 0, 0, -1, 0, __box, 100)'), 9),
    'a ray from 10 m above enters the unit box at exactly 9 m');
chk(G('rayAabbDistance(0, 10, 0, 0, 1, 0, __box, 100)') === null,
    'the same ray pointing away misses');
chk(G('rayAabbDistance(0, 10, 0, 0, -1, 0, __box, 5)') === null,
    'and it misses when maxDistance stops short of the box');
chk(G('rayAabbDistance(0, 0, 0, 0, -1, 0, __box, 100)') === 0,
    'a ray STARTING INSIDE reports 0 — proxies are volumes and are solid from both sides');
chk(G('rayAabbDistance(5, 10, 0, 0, -1, 0, __box, 100)') === null,
    'a parallel ray outside the slab misses');

const n = NEW('rayAabbNormal(0, 10, 0, 0, -1, 0, __box, 9)');
chk(n && n.x === 0 && n.y === 1 && n.z === 0, 'the entry normal on the top face is +Y');
chk(NEW('rayAabbNormal(0, 0, 0, 0, -1, 0, __box, 0)') === null,
    'and a ray that began inside has no entry face — null, not a guess');

/* ======================================================================================
   3. THE MESH / ARCHITECTURE PROVIDER
   ==================================================================================== */
head('3. THE MESH PROVIDER RAYCASTS DECLARED PROXIES');

const set = NEW('new AssetCollisionSet()');
ctx.__set = set;
set.add(placed('test.block', 0, 0, 0), null);

let hit = set.raycast(V(0, 20, 0), DOWN, 100);
chk(!!hit, 'a ray down the column hits the placed proxy');
chk(near(hit.distance, 19), `at the right distance (${hit && hit.distance})`);
chk(hit && near(hit.point.y, 1), 'and the hit point is on the box top surface');
chk(hit && hit.normal && hit.normal.y === 1, 'with the correct outward normal');
chk(hit && hit.category === G('RAYCAST_CATEGORY.ASSET'), 'and it is categorised as an asset hit');
chk(hit && typeof hit.ref === 'number', 'carrying a stable ref — an id, not a mesh');

chk(set.raycast(V(50, 20, 50), DOWN, 100) === null, 'a ray down an empty column misses');
chk(set.raycast(V(0, 20, 0), DOWN, 5) === null, 'and maxDistance is honoured');
chk(set.raycast(V(0, 20, 0), UP, 100) === null, 'a ray pointing away misses');

/* DECORATIVE GEOMETRY IS NOT RAYCASTABLE. */
const decorSet = NEW('new AssetCollisionSet()');
const added = decorSet.add(placed('test.decor', 0, 0, 0), null);
chk(added === 0 && decorSet.size === 0,
    'an asset declaring ASSET_COLLISION.NONE registers no proxy at all');
chk(decorSet.raycast(V(0, 20, 0), DOWN, 100) === null,
    'so a decorative mesh is NOT hittable — collision geometry and visual geometry stay apart');

/* NEAREST WITHIN ONE PROVIDER. */
const two = NEW('new AssetCollisionSet()');
two.add(placed('test.block', 0, 0, 0), null);       // top at y=1
two.add(placed('test.block', 0, 6, 0), null);       // top at y=7 — nearer from above
const nearest = two.raycast(V(0, 20, 0), DOWN, 100);
chk(nearest && near(nearest.distance, 13),
    `with two proxies stacked, the NEARER one wins (${nearest && nearest.distance})`);

/* ======================================================================================
   4. THE TERRAIN PROVIDER
   ==================================================================================== */
head('4. THE TERRAIN PROVIDER');

const terrain = NEW('new TerrainPhysicalWorld(null)');
const gy = terrain.groundHeightAt(40, -40);
const th = terrain.raycast(V(40, gy + 30, -40), DOWN, 200);
chk(!!th, 'a ray dropped on the terrain hits it');
chk(th && near(th.point.y, gy, 0.01),
    `and lands on the surface groundHeightAt reports (${th && th.point.y.toFixed(4)} vs ${gy.toFixed(4)})`);
chk(th && near(th.distance, 30, 0.01), 'at the expected distance');
chk(th && th.category === G('RAYCAST_CATEGORY.TERRAIN'), 'categorised as terrain');
chk(th && th.normal && th.normal.y > 0, 'with an upward surface normal from the analytic gradient');
chk(terrain.raycast(V(40, gy + 30, -40), UP, 200) === null, 'a ray fired upward misses the ground');
chk(terrain.raycast(V(40, gy + 30, -40), DOWN, 5) === null, 'and maxDistance is honoured');
const inside = terrain.raycast(V(40, gy - 5, -40), DOWN, 100);
chk(inside && inside.distance === 0, 'a ray starting below the surface reports 0 — solid from both sides');

/* ======================================================================================
   5. COMPOSITE — NEAREST HIT ACROSS PROVIDERS
   ==================================================================================== */
head('5. COMPOSITE RAYCAST');

const W = NEW('new D1TerrainWorld(null, null, null)');
const P = W.physical, SET = W.assetCollision;
const CX = 300, CZ = -300;
const cg = W.terrain.groundHeightAt(CX, CZ);

const baseOnly = P.raycast(V(CX, cg + 20, CZ), DOWN, 100);
chk(baseOnly && baseOnly.category === G('RAYCAST_CATEGORY.TERRAIN'),
    'with no providers, the base answers and the composite returns its hit');

/* A proxy ABOVE the ground: the provider must now win. */
const highInst = placed('test.block', CX, cg + 10, CZ);
SET.add(highInst, null);
const overAsset = P.raycast(V(CX, cg + 20, CZ), DOWN, 100);
chk(overAsset && overAsset.category === G('RAYCAST_CATEGORY.ASSET'),
    'a proxy between the eye and the ground wins — the NEARER hit, not the base');
chk(overAsset && near(overAsset.point.y, cg + 11),
    'and the hit is on the proxy surface');

/* A proxy BELOW the ground must NOT override the nearer terrain. */
SET.clear();
SET.add(placed('test.block', CX, cg - 30, CZ), null);
const underAsset = P.raycast(V(CX, cg + 20, CZ), DOWN, 200);
chk(underAsset && underAsset.category === G('RAYCAST_CATEGORY.TERRAIN'),
    'a proxy BELOW the ground does not override the nearer terrain hit');

/* No hit at all. */
SET.clear();
chk(P.raycast(V(CX, cg + 20, CZ), UP, 100) === null,
    'nothing along the ray returns the contract miss');

/* A provider with no raycast method is skipped rather than crashing. */
const partial = NEW('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))');
partial.addProvider({ collidesAABB: () => false });
let skipOk = true;
try { partial.raycast(V(0, 100, 0), DOWN, 400); } catch (e) { skipOk = false; }
chk(skipOk, 'a provider that cannot raycast is skipped, not called');

/* ======================================================================================
   6. TIE-BREAK AND DETERMINISM
   ==================================================================================== */
head('6. DETERMINISM AND THE TIE-BREAK');

/* Two providers whose proxies sit at exactly the same distance. */
const sA = NEW('new AssetCollisionSet()'), sB = NEW('new AssetCollisionSet()');
sA.add(placed('test.block', 0, 0, 0), null);
sB.add(placed('test.block', 0, 0, 0), null);
const fwd = NEW('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))');
const rev = NEW('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))');
fwd.addProvider(sA); fwd.addProvider(sB);
rev.addProvider(sB); rev.addProvider(sA);
const hf = fwd.raycast(V(0, 60, 0), DOWN, 200), hr = rev.raycast(V(0, 60, 0), DOWN, 200);
/* THE DISCRIMINATING HALF, AND IT IS THE POINT OF THIS CHECK. With a PER-SET id counter the
   two entries both minted id 1, so `hf.ref === hr.ref` was true while the two composites had
   in fact chosen DIFFERENT PROXIES — the assertion passed and proved nothing. Asserting the
   two ids DIFFER first is what makes the equality afterwards mean something. */
chk(sA.entries[0].id !== sB.entries[0].id,
    'two proxies in two different sets have different ids — the tie-break can tell them apart');
chk(hf && hr && hf.distance === hr.distance && hf.ref === hr.ref && hf.providerId === hr.providerId,
    'two providers tied at the same distance resolve IDENTICALLY in either registration order');
note('tie-break is the declared category rank then the stable proxy id — never array position');

/* Category rank: an asset flush with the terrain beats the ground it stands on. */
chk(G('RAYCAST_CATEGORY_RANK.asset') < G('RAYCAST_CATEGORY_RANK.terrain'),
    'the declared rank puts an authored structure above the ground at equal distance');

/* Repeatability. */
const rep = NEW('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))');
rep.addProvider(sA);
const first = rep.raycast(V(0, 60, 0), DOWN, 200);
let stable = true;
for (let i = 0; i < 400; i++) {
  const r = rep.raycast(V(0, 60, 0), DOWN, 200);
  if (!r || r.distance !== first.distance || r.ref !== first.ref) stable = false;
}
chk(stable, '400 repeats of the same ray give the same hit');

/* Removal order must not matter either. */
const shuffleSet = NEW('new AssetCollisionSet()');
const i1 = placed('test.block', 0, 0, 0), i2 = placed('test.block', 0, 20, 0), i3 = placed('test.block', 0, 40, 0);
shuffleSet.add(i1, null); shuffleSet.add(i2, null); shuffleSet.add(i3, null);
const beforeRemove = shuffleSet.raycast(V(0, 100, 0), DOWN, 400);   // the highest block, i3
shuffleSet.remove(i2);                                              // splice out the MIDDLE one
const afterSplice = shuffleSet.raycast(V(0, 100, 0), DOWN, 400);
chk(beforeRemove && afterSplice && beforeRemove.ref === afterSplice.ref &&
    beforeRemove.distance === afterSplice.distance,
    'splicing a middle entry does not renumber the rest — a ref is a stable id, not an index');
shuffleSet.remove(i3);
const afterRemove = shuffleSet.raycast(V(0, 100, 0), DOWN, 400);
chk(afterRemove && afterRemove.ref !== beforeRemove.ref &&
    afterRemove.distance > beforeRemove.distance,
    'and removing the NEAREST proxy promotes the next one behind it');

/* ======================================================================================
   7. LIFECYCLE
   ==================================================================================== */
head('7. LIFECYCLE — NO STALE HITS');

const lifeSet = NEW('new AssetCollisionSet()');
const lifeComp = NEW('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))');
lifeComp.addProvider(lifeSet);
const inst = placed('test.block', 1000, 400, 1000);
const ORIGIN = V(1000, 460, 1000);

chk(lifeComp.raycast(ORIGIN, DOWN, 100) === null, 'before registration the ray misses');
lifeSet.add(inst, null);
chk(!!lifeComp.raycast(ORIGIN, DOWN, 100), 'after registration it hits');
lifeSet.remove(inst);
chk(lifeComp.raycast(ORIGIN, DOWN, 100) === null,
    'after removal it misses IMMEDIATELY — a disposed proxy is never raycastable');
lifeSet.add(inst, null);
chk(!!lifeComp.raycast(ORIGIN, DOWN, 100), 'and a reload makes it hittable again');
lifeSet.clear();
chk(lifeComp.raycast(ORIGIN, DOWN, 100) === null, 'clear() removes every contribution');
lifeComp.addProvider(lifeSet);
lifeSet.add(inst, null);
chk(!!lifeComp.raycast(ORIGIN, DOWN, 100), 're-adding the provider restores its contribution');
lifeComp.removeProvider(lifeSet);
chk(lifeComp.raycast(ORIGIN, DOWN, 100) === null,
    'and removing the PROVIDER removes its raycast contribution too');

/* ======================================================================================
   8. THE VOXEL PATH
   ==================================================================================== */
head('8. VOXEL COMPATIBILITY');

const pwSrc = fs.readFileSync(path.join(ROOT, 'src', 'world', 'physical-world.js'), 'utf8');
chk(/\braycast\s*\(origin, direction, maxDistance\)/.test(pwSrc),
    'VoxelPhysicalWorld implements the same normalized raycast — the two backends do not drift');
chk(/voxelRaycast\(this\.world/.test(pwSrc),
    'and it ADAPTS the existing DDA rather than reimplementing one');

/* voxelRaycast and its gameplay callers are untouched — the reason the contract could
   exclude raycast in the first place. */
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
chk(/function voxelRaycast\(world, origin, dir, maxDist\)/.test(gameSrc),
    'voxelRaycast is still defined in game.html, with its original signature');
/* ONE call site, and it is `_getLookTarget`. Four gameplay paths consume its RESULT —
   mining, the break, placement and the interaction prompt — which is what the E2.1 header
   meant by "four gameplay callers" and why changing the return type was expensive. */
chk(/_getLookTarget\(\) \{\s*return voxelRaycast\(this\.world, this\._eyePosition\(\), this\._forwardVector\(\), this\.reach\);/.test(gameSrc),
    'and _getLookTarget still calls it, unchanged — the voxel interaction path is untouched');
const consumers = (gameSrc.match(/this\._getLookTarget\(\)/g) || []).length;
chk(consumers === 4, `its four gameplay consumers are all still there (${consumers})`);
chk(/return \{ bx: x, by: y, bz: z, face: lastFace \};/.test(gameSrc),
    'and it still returns block coordinates and a face — its type was NOT changed');

/* A stub voxel world proves the adapter shape without the monolith. */
vm.runInContext(`
  var __voxHit = { bx: 3, by: 5, bz: 7, face: [0, 1, 0] };
  var voxelRaycast = function () { return __voxHit; };
  var __vox = new VoxelPhysicalWorld({});
`, ctx);
const vh = NEW('__vox.raycast({x:3.5,y:20,z:7.5},{x:0,y:-1,z:0},100)');
chk(vh && near(vh.distance, 14), `the voxel adapter returns a normalized hit at the cell face (${vh && vh.distance})`);
chk(vh && vh.normal && vh.normal.y === 1, 'with the exact face normal voxelRaycast resolved');
chk(vh && vh.category === G('RAYCAST_CATEGORY.TERRAIN'), 'categorised as terrain');
vm.runInContext('__voxHit = null;', ctx);
chk(NEW('__vox.raycast({x:0,y:0,z:0},{x:0,y:-1,z:0},100)') === null,
    'and a voxel miss becomes the contract miss');

/* ======================================================================================
   9. THE INTERACTION VOCABULARY
   ==================================================================================== */
head('9. INTERACTION VOCABULARY');

chk(G('INTERACTION_AFFORDANCES.length') === 3, 'there are exactly THREE affordances');
chk(G("INTERACTION_AFFORDANCES.join(',')") === 'none,inspect,use', 'and they are none, inspect, use');

/* No D1 content may leak into the generic layer. */
const iSrc = fs.readFileSync(path.join(ROOT, 'src', 'gameplay', 'interaction.js'), 'utf8');
const iCode = iSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const FORBIDDEN = ['door', 'key', 'note', 'photo', 'tower', 'barn', 'flashlight', 'elevator',
                   'church', 'motel', 'school', 'creature', 'stitcher', 'disk', 'core'];
const leaked = FORBIDDEN.filter(w => new RegExp(w, 'i').test(iCode));
chk(leaked.length === 0,
    'no D1 noun appears in the generic layer' + (leaked.length ? ' — found ' + leaked.join(', ') : ''));
chk(!/THREE\./.test(iCode), 'and it names no THREE — gameplay is not bound to a render mesh');

const reg = NEW('new InteractionRegistry()');
const target = NEW("makeInteractable('t-1', ['inspect'], { note: 'fixture' })");
chk(target.id === 't-1' && target.affordances.length === 1, 'an interactable has a stable id and its affordances');
chk(NEW("makeInteractable('t-2', ['inspect','inspect','use']).affordances.length") === 2,
    'duplicates are collapsed');
chk(NEW("makeInteractable('t-3', ['open_door','use']).affordances.join(',')") === 'use',
    'and an unknown word is DROPPED rather than silently accepted');
chk(NEW("makeInteractable('t-4', ['none']).affordances.length") === 0,
    "'none' is the absence of an affordance, not a member of the set");

/* A PHYSICAL HIT IS NOT AN INTERACTION. This is the distinction the whole file exists for. */
const physHit = NEW("makeRayHit(5, {x:0,y:0,z:0}, null, RAYCAST_CATEGORY.TERRAIN, null, null)");
chk(reg.resolve(physHit) === null,
    'a physical hit with nothing registered resolves to NO interaction target');
const assetHit = NEW("makeRayHit(5, {x:0,y:0,z:0}, null, RAYCAST_CATEGORY.ASSET, 42, 42)");
chk(reg.resolve(assetHit) === null, 'and an asset hit is not interactive merely by being an asset');
reg.register(42, target);
chk(reg.resolve(assetHit) === target, 'once registered against that ref, the hit resolves to the target');

ctx.__reg = reg; ctx.__assetHit = assetHit;
const r = vm.runInContext("resolveInteraction(__reg, __assetHit, 'inspect')", ctx);
chk(r.ok === true && r.target.id === 't-1', 'an afforded verb is accepted');
const rUse = vm.runInContext("resolveInteraction(__reg, __assetHit, 'use')", ctx);
chk(rUse.ok === false && rUse.refused === G('INTERACTION_REFUSED.NOT_AFFORDED'),
    'an unafforded verb is refused CLEANLY, with a reason');
ctx.__physHit = physHit;
const rNo = vm.runInContext("resolveInteraction(__reg, __physHit, 'inspect')", ctx);
chk(rNo.ok === false && rNo.refused === G('INTERACTION_REFUSED.NO_TARGET'),
    'a hit with no target is refused with NO_TARGET');
const rBad = vm.runInContext("resolveInteraction(__reg, __assetHit, 'open_door')", ctx);
chk(rBad.ok === false && rBad.refused === G('INTERACTION_REFUSED.UNKNOWN_VERB'),
    'and a verb outside the vocabulary is refused with UNKNOWN_VERB');

const both = NEW("makeInteractable('t-5', ['inspect','use'])");
reg.register(99, both);
ctx.__bothHit = NEW("makeRayHit(1, {x:0,y:0,z:0}, null, RAYCAST_CATEGORY.ASSET, 99, 99)");
chk(vm.runInContext("resolveInteraction(__reg, __bothHit, 'inspect')", ctx).ok === true &&
    vm.runInContext("resolveInteraction(__reg, __bothHit, 'use')", ctx).ok === true,
    'a target may expose both inspect and use');

reg.unregister(99);
chk(vm.runInContext("resolveInteraction(__reg, __bothHit, 'use')", ctx).ok === false,
    'and unregistering removes it immediately — the same lifecycle rule as a collision proxy');

/* Nothing in this layer CALLS anything. */
chk(!/\bfunction\s+dispatch|handlers?\s*\[|\.call\(|\.apply\(/.test(iCode),
    'the layer resolves and refuses — it dispatches nothing and holds no handlers');

/* ======================================================================================
   10. COST
   ==================================================================================== */
head('10. COST — BOUNDED WORK PER RAY');

/* THE ABSOLUTE MICROSECOND NUMBER ON THIS CONTAINER MEANS NOTHING, AND AN ASSERTION ON IT
   WOULD BE MEASURING THE CONTAINER. A 200,000-iteration empty arithmetic loop costs 245 ms
   in this vm — about three orders of magnitude off a normal machine — so "under 50 us per
   ray" would fail here and pass on a laptop while the code was identical. CLAUDE.md section
   62.11 is explicit that the answer to a drifty threshold is not to raise it.

   WHAT IS A PROPERTY OF THE CODE, and what actually makes a per-frame crosshair query
   affordable, is that a ray costs a BOUNDED, PREDICTABLE NUMBER OF HEIGHTFIELD SAMPLES.
   That is COUNTED, not timed, and it is the same number on every machine. The wall clock is
   still reported — as a note, calibrated against the cost of one raw sample — because a
   relative figure survives a slow container and an absolute one does not. */
vm.runInContext(`
  var __hReal = d1TerrainHeight, __hCount = 0;
  d1TerrainHeight = function (x, z) { __hCount++; return __hReal(x, z); };
`, ctx);
const samples = (fn) => { vm.runInContext('__hCount = 0;', ctx); fn(); return G('__hCount'); };

const costComp = NEW('new CompositePhysicalWorld(new TerrainPhysicalWorld(null))');
const KX = 640.5, KZ = -220.5;
const groundHere = G(`__hReal(${KX}, ${KZ})`);

/* The real interaction case: a short ray from an eye about two metres above the ground.
   1 sample to reject "already underground", one per half-metre of march, 12 bisections,
   4 for the surface normal. */
const shortRay = samples(() => costComp.raycast(V(KX, groundHere + 2, KZ), DOWN, 5));
chk(shortRay <= 1 + Math.ceil(5 / 0.5) + 12 + 4,
    `a 5 m crosshair ray costs ${shortRay} heightfield samples — bounded, and the same count on any machine`);

/* The worst case is a long ray that hits NOTHING: march to the limit, no bisection, no
   normal. This is the number that bounds everything else. */
const longMiss = samples(() => costComp.raycast(V(KX, groundHere + 400, KZ), UP, 200));
chk(longMiss <= 1 + Math.ceil(200 / 0.5),
    `a 200 m ray that hits nothing costs ${longMiss} samples — exactly maxDistance / step, no more`);

/* And the bound is LINEAR in maxDistance, not quadratic or unbounded — the property that
   lets a caller price a ray by choosing its length. */
const miss50  = samples(() => costComp.raycast(V(KX, groundHere + 400, KZ), UP, 50));
const miss100 = samples(() => costComp.raycast(V(KX, groundHere + 400, KZ), UP, 100));
chk(Math.abs((miss100 - miss50) - (miss50 - 1)) <= 2,
    `doubling maxDistance doubles the work and nothing worse (${miss50} -> ${miss100} samples)`);

/* A ray that begins below the surface answers from ONE sample and never marches. */
chk(samples(() => costComp.raycast(V(KX, groundHere - 5, KZ), DOWN, 200)) <= 1 + 4,
    'a ray starting underground answers immediately — it does not march the whole distance');

vm.runInContext('d1TerrainHeight = __hReal;', ctx);   // uninstrument before timing

/* THE CLOCK, AS A RATIO. How much does the march itself add over the samples it must take
   anyway? Anything near 1 means the cost IS the heightfield, which is the honest answer:
   making rays cheaper means making the heightfield cheaper, not rewriting this loop. */
function bench(fn, n) { fn(); const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn(i); return Number(process.hrtime.bigint() - t0) / 1e6; }
const N = 4000;
const tRay = bench((i) => costComp.raycast(V(KX + (i % 200) * 0.7, groundHere + 2, KZ + (i % 137) * 0.9), DOWN, 5), N);
const rawMs = (() => { const t0 = process.hrtime.bigint();
  vm.runInContext(`for (var i = 0; i < ${N * shortRay}; i++) __hReal(i * 0.7, i * 0.9);`, ctx);
  return Number(process.hrtime.bigint() - t0) / 1e6; })();
note(`${N} crosshair rays: ${tRay.toFixed(0)} ms | the same ${N * shortRay} raw heightfield samples: ${rawMs.toFixed(0)} ms`);
chk(tRay < rawMs * 3 + 50,
    `the march costs about what its samples cost (${(tRay / Math.max(rawMs, 0.001)).toFixed(2)}x) — the heightfield is the cost, not the loop`);

/* And the provider walk, which is the part that grows with content. */
const costSet = NEW('new AssetCollisionSet()');
for (let i = 0; i < 20; i++) costSet.add(placed('test.block', KX + i * 5, groundHere + 40, KZ + i * 3), null);
costComp.addProvider(costSet);
const tWithProxies = bench((i) => costComp.raycast(V(KX + (i % 200) * 0.7, groundHere + 2, KZ + (i % 137) * 0.9), DOWN, 5), N);
chk(tWithProxies < tRay * 3 + 50,
    `and twenty collision proxies do not change its order of magnitude (${tWithProxies.toFixed(0)} ms)`);
note('the provider walk is linear in proxy count BY DESIGN. No spatial index until there is a');
note('real asset distribution to measure one against (CLAUDE.md section 14).');

/* ==================================================================================== */
console.log('');
if (fail === 0) {
  console.log('ALL RAYCAST / INTERACTION CHECKS PASS');
  note('Offline. This proves the query, the composition and the vocabulary — not that');
  note('aiming at anything feels right. No D1 target, asset or content exists.');
} else {
  console.log(fail + ' RAYCAST / INTERACTION FAILURES');
}
process.exit(fail === 0 ? 0 : 1);
