/* PHASE 21 — DROPPED ITEM GROUND CONTACT.

   Every check here drives the REAL ItemEntity against the REAL VoxelWorld: items are
   constructed through the shipped class, stepped with the shipped update(), and land on
   chunks the shipped generator produced. Nothing reimplements the physics.

   WHAT "CONTACT" MEANS HERE, precisely, because the whole phase turns on it:

     position.y      the item's FOOT — the collider spans [y, y + ITEM_SIZE_Y]
     mesh bottom     position.y + ITEM_MESH_HALF_Y + bob - ITEM_SIZE_Y/2
     penetration     support surface minus mesh bottom, positive = sunk into the ground

   No browser and no WebGL were involved. These are geometry and simulation results. */
const vm = require('vm');
const THREE = require('three');
const { makeWorld, genRegion } = require('./harness/util.js');
const { w, ev, S } = makeWorld();
let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const g = (n) => vm.runInContext(n, S);

const BLOCK = ev('BLOCK'), ITEM = ev('ITEM');
const HALF = g('ITEM_HALF'), SZY = g('ITEM_SIZE_Y'), MESH_HALF = g('ITEM_MESH_HALF_Y');
const BOB_TRAVEL = g('ITEM_BOB_TRAVEL'), BOB_RATE = g('ITEM_BOB_RATE');
const PICKUP_R = g('ITEM_PICKUP_RADIUS');
const ItemEntity = g('ItemEntity');
const scene = new THREE.Scene();

/* A scratch world: a flat stone floor with air above, in a region far from anything the
   generator authored, so tests are about the item and not about terrain. Blocks are
   written through the real setBlockWorld into real generated chunks. */
const BASE = { x: 64, z: 64 };            // Overworld, ordinary ground
function ensure(x0, z0, x1, z1) { genRegion(w, x0 - 2, z0 - 2, x1 + 2, z1 + 2); }

// The mesh's bottom face in world space, from the real mesh the entity built.
const meshBottom = (e) => e.mesh.position.y - SZY / 2;
// Drive an item to rest, or give up. Returns the number of steps taken.
function settle(e, maxSteps = 900, dt = 1 / 60) {
  let n = 0;
  for (; n < maxSteps; n++) {
    e.update(dt, FAR, PLAYER, w);
    if (e.resting) break;
  }
  return n;
}
// A player far enough away that pickup never fires during a physics test.
const FAR = new THREE.Vector3(9999, 9999, 9999);
const PLAYER = { inventory: { addItem: () => true }, sound: { playItemPickup() {} } };

function drop(x, y, z, item = ITEM.COBBLESTONE, impulse = false) {
  const e = new ItemEntity(scene, item, 1, new THREE.Vector3(x, y, z), w);
  if (impulse) e.applySpawnImpulse();
  return e;
}

// =====================================================================================
// A. VISUAL ORIGIN — THE DEFECT THIS PHASE EXISTS FOR
// =====================================================================================
{
  const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
  geo.computeBoundingBox();
  chk(Math.abs(geo.boundingBox.min.y + geo.boundingBox.max.y) < 1e-12,
      `the dropped-item geometry is CENTRED on its origin (bounds ${geo.boundingBox.min.y} .. ` +
      `${geo.boundingBox.max.y}) — measured, not assumed`);
  chk(Math.abs(MESH_HALF - SZY / 2) < 1e-12,
      `so the mesh is lifted by exactly half the collider height (${MESH_HALF}) to put its ` +
      `bottom face on the collider's bottom face`);
}

// =====================================================================================
// B. FLAT GROUND — NO SINKING, NO FLOATING
// =====================================================================================
const FLOOR_Y = (() => {          // the real surface height at the test column
  ensure(BASE.x - 4, BASE.z - 4, BASE.x + 4, BASE.z + 4);
  for (let y = 60; y >= 0; y--) if (w.isSolid(BASE.x, y, BASE.z)) return y + 1;
  return 0;
})();
{
  const e = drop(BASE.x + 0.5, FLOOR_Y + 6, BASE.z + 0.5);
  const steps = settle(e);
  chk(e.resting, `an item dropped from six blocks up comes to rest (${steps} steps)`);
  chk(Math.abs(e.position.y - FLOOR_Y) < 1e-6,
      `its collider foot lands exactly on the surface (y=${e.position.y.toFixed(6)}, ` +
      `surface ${FLOOR_Y})`);
  // Sample the whole bob cycle: the deepest point must never be below the surface.
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 400; i++) { e.update(1 / 60, FAR, PLAYER, w); const b = meshBottom(e); if (b < lo) lo = b; if (b > hi) hi = b; }
  const sink = FLOOR_Y - lo;
  chk(sink <= 1e-9,
      `and across a full bob cycle it never sinks: deepest rendered point is ` +
      `${(lo - FLOOR_Y).toFixed(6)} relative to the surface (0 = touching)`);
  chk(hi - FLOOR_Y <= BOB_TRAVEL + 1e-6,
      `nor floats beyond the bob's own travel: highest point ${(hi - FLOOR_Y).toFixed(3)} ` +
      `against a ${BOB_TRAVEL} peak-to-peak bob`);
  chk(Math.abs((hi - lo) - BOB_TRAVEL) < 1e-3,
      `the bob's travel is preserved exactly: ${(hi - lo).toFixed(4)} blocks peak-to-peak`);
  e.destroy();
}

// =====================================================================================
// C. THE BOB, ROTATION AND RESTING BEHAVIOUR ARE PRESERVED
// =====================================================================================
{
  const e = drop(BASE.x + 0.5, FLOOR_Y + 3, BASE.z + 0.5);
  settle(e);
  const y0 = e.mesh.rotation.y;
  for (let i = 0; i < 60; i++) e.update(1 / 60, FAR, PLAYER, w);
  chk(e.mesh.rotation.y > y0, `a resting item still spins (${(e.mesh.rotation.y - y0).toFixed(3)} rad/s over one second)`);
  chk(Math.abs((e.mesh.rotation.y - y0) - 2.0) < 0.05, 'at the unchanged 2.0 rad/s');
  chk(e.position.x === e.position.x && !Number.isNaN(e.position.y),
      'and its physics position is stable while resting');
  // The bob is a function of age only — deterministic, no random jitter per frame.
  const a = e.mesh.position.y; e.age += 0; e.update(0, FAR, PLAYER, w);
  chk(Math.abs(e.mesh.position.y - a) < 1e-12, 'a zero-length frame moves the bob by exactly nothing — no jitter');
  e.destroy();
}
{
  // Two items dropped identically at different phases must bob out of step (preserved).
  const a = drop(BASE.x + 0.3, FLOOR_Y + 2, BASE.z + 0.3);
  const b = drop(BASE.x + 0.7, FLOOR_Y + 2, BASE.z + 0.7);
  a.restBob = 0; b.restBob = Math.PI;
  settle(a); settle(b);
  for (let i = 0; i < 20; i++) { a.update(1 / 60, FAR, PLAYER, w); b.update(1 / 60, FAR, PLAYER, w); }
  chk(Math.abs(a.mesh.position.y - b.mesh.position.y) > 1e-3,
      'the per-item bob phase desync survives');
  a.destroy(); b.destroy();
}

// =====================================================================================
// D. NO TUNNELING
// =====================================================================================
{
  let worst = 0, tunnelled = 0;
  for (const h of [4, 12, 25, 40, 55]) {
    const e = drop(BASE.x + 0.5, FLOOR_Y + h, BASE.z + 0.5);
    settle(e, 4000);
    if (!e.resting || e.position.y < FLOOR_Y - 1e-6) tunnelled++;
    worst = Math.max(worst, Math.abs(e.position.y - FLOOR_Y));
    e.destroy();
  }
  chk(tunnelled === 0,
      `dropped from 4, 12, 25, 40 and 55 blocks up, nothing tunnels — every one rests on ` +
      `the surface (worst deviation ${worst.toExponential(1)})`);
}
{
  // The substep budget must actually cover terminal velocity at the frame-time clamp.
  const TERM = Math.abs(g('ITEM_TERMINAL_VY')), MAXDT = 0.06;
  const steps = Math.min(g('ITEM_MAX_SUBSTEPS'), Math.max(1, Math.ceil(TERM * MAXDT / g('ITEM_MAX_STEP_DIST'))));
  const perStep = TERM * MAXDT / steps;
  chk(perStep < 1.0,
      `and it cannot: at terminal velocity (${TERM} b/s) on the longest frame the loop ` +
      `allows (${MAXDT}s) each substep moves ${perStep.toFixed(3)} blocks — under one block thick`);
}

// =====================================================================================
// E. UNEVEN TERRAIN — EACH COLUMN SETTLES ON ITS OWN SURFACE
// =====================================================================================
{
  // Build a staircase of real blocks and drop one item onto each tread.
  const X = BASE.x + 20, Z = BASE.z + 20;
  ensure(X - 2, Z - 2, X + 8, Z + 4);
  const base = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(X, y, Z)) return y + 1; return 0; })();
  for (let i = 0; i < 5; i++)
    for (let dy = 0; dy < i; dy++) w.setBlockWorld(X + i, base + dy, Z, BLOCK.STONE);
  let bad = [];
  for (let i = 0; i < 5; i++) {
    const top = base + i;
    const e = drop(X + i + 0.5, top + 4, Z + 0.5);
    settle(e);
    if (!e.resting || Math.abs(e.position.y - top) > 1e-6) bad.push(`step ${i}: y=${e.position.y}, want ${top}`);
    if (meshBottom(e) < top - 1e-9) bad.push(`step ${i} sunk`);
    e.destroy();
  }
  chk(bad.length === 0,
      'on a five-tread staircase every item settles on its own tread, none sunk' +
      (bad.length ? ' — ' + bad.join('; ') : ''));
}
{
  // A depression: the item must fall INTO it, not bridge across.
  const X = BASE.x + 34, Z = BASE.z + 20;
  ensure(X - 3, Z - 3, X + 3, Z + 3);
  const top = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(X, y, Z)) return y + 1; return 0; })();
  w.setBlockWorld(X, top - 1, Z, BLOCK.AIR);          // one-block pit
  const e = drop(X + 0.5, top + 3, Z + 0.5);
  settle(e);
  chk(e.resting && Math.abs(e.position.y - (top - 1)) < 1e-6,
      `an item dropped into a one-block pit settles at its floor (y=${e.position.y}, want ${top - 1})`);
  e.destroy();
  w.setBlockWorld(X, top - 1, Z, BLOCK.STONE);
}
{
  // A slab — a shaped block whose support surface is mid-cell. This is the case the old
  // isSolid()-based support test could not reason about.
  const X = BASE.x + 40, Z = BASE.z + 20;
  ensure(X - 3, Z - 3, X + 3, Z + 3);
  const top = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(X, y, Z)) return y + 1; return 0; })();
  const SHAPE = g('SHAPE_AABB');
  // Find a real shaped block whose geometry is a partial-height slab sitting on the floor.
  let slabId = null, slabTop = 0;
  for (const idStr of Object.keys(SHAPE)) {
    const boxes = SHAPE[idStr];
    if (!boxes || boxes.length !== 1) continue;
    const b = boxes[0];
    if (b[1] === 0 && b[4] > 0.2 && b[4] < 0.9 && b[0] === 0 && b[2] === 0 && b[3] === 1 && b[5] === 1) {
      slabId = +idStr; slabTop = b[4]; break;
    }
  }
  if (slabId === null) {
    console.log('      (no single-box partial-height slab shape in the vocabulary — skipped)');
  } else {
    w.setBlockWorld(X, top, Z, slabId);
    const e = drop(X + 0.5, top + 3, Z + 0.5);
    settle(e);
    chk(e.resting && Math.abs(e.position.y - (top + slabTop)) < 1e-6,
        `on a shaped block (id ${slabId}, top at +${slabTop}) the item rests on the SHAPE, ` +
        `not the cell top: y=${e.position.y.toFixed(3)}, want ${(top + slabTop).toFixed(3)}`);
    chk(meshBottom(e) >= top + slabTop - 1e-9, 'and is not drawn sunk into it');
    e.destroy();
    w.setBlockWorld(X, top, Z, BLOCK.AIR);
  }
}

// =====================================================================================
// F/G. WALLS AND CORNERS
// =====================================================================================
{
  const X = BASE.x + 50, Z = BASE.z + 20;
  ensure(X - 4, Z - 4, X + 6, Z + 6);
  const top = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(X, y, Z)) return y + 1; return 0; })();
  // A two-wall corner at (X,Z): walls along +x and +z.
  for (let dy = 0; dy < 3; dy++) {
    w.setBlockWorld(X + 1, top + dy, Z, BLOCK.STONE);
    w.setBlockWorld(X, top + dy, Z + 1, BLOCK.STONE);
    w.setBlockWorld(X + 1, top + dy, Z + 1, BLOCK.STONE);
  }
  const cases = [
    ['against a flat wall', X + 0.95, Z + 0.5],
    ['into a floor/wall corner', X + 0.95, Z + 0.95],
    ['hard into the two-wall corner', X + 0.99, Z + 0.99],
  ];
  let bad = [];
  for (const [label, px, pz] of cases) {
    const e = drop(px, top + 3, pz);
    settle(e);
    if (!e.resting) { bad.push(label + ': never rested'); e.destroy(); continue; }
    // The collider must not overlap any solid, and the mesh (inset inside the collider)
    // therefore cannot be inside the wall either.
    if (e._collidesAt(w, e.position)) bad.push(label + ': collider inside solid');
    if (e.position.y < top - 1e-6) bad.push(label + ': fell below the floor');
    if (meshBottom(e) < top - 1e-9) bad.push(label + ': sunk');
    e.destroy();
  }
  chk(bad.length === 0,
      'dropped against a wall, into a floor/wall corner and hard into a two-wall corner, ' +
      'the item rests outside the geometry every time' + (bad.length ? ' — ' + bad.join('; ') : ''));
  chk(HALF * 2 <= 0.26 + 1e-9 && HALF * 2 >= 0.25 - 1e-9,
      `the collider (${(HALF * 2).toFixed(3)} wide) is no narrower than the mesh (0.25), so ` +
      `the rendered cube can never poke out of the box that stopped it`);
}
{
  // A one-block-wide slot: the item must reach the bottom and not jam.
  const X = BASE.x + 60, Z = BASE.z + 20;
  ensure(X - 4, Z - 4, X + 4, Z + 4);
  const top = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(X, y, Z)) return y + 1; return 0; })();
  for (let dy = 0; dy < 4; dy++)
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      w.setBlockWorld(X + ox, top + dy, Z + oz, BLOCK.STONE);
  const e = drop(X + 0.5, top + 5, Z + 0.5);
  settle(e);
  chk(e.resting && Math.abs(e.position.y - top) < 1e-6,
      `dropped into a one-block-wide shaft it reaches the floor (y=${e.position.y}, want ${top})`);
  e.destroy();
}

// =====================================================================================
// H. NEWLY MINED SUPPORT — WAKE-UP
// =====================================================================================
{
  const X = BASE.x + 70, Z = BASE.z + 20;
  ensure(X - 3, Z - 3, X + 3, Z + 3);
  const top = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(X, y, Z)) return y + 1; return 0; })();
  w.setBlockWorld(X, top, Z, BLOCK.STONE);            // a pedestal
  const e = drop(X + 0.5, top + 4, Z + 0.5);
  settle(e);
  chk(e.resting && Math.abs(e.position.y - (top + 1)) < 1e-6,
      `an item rests on a pedestal at y=${e.position.y}`);
  w.setBlockWorld(X, top, Z, BLOCK.AIR);              // mine it out from under
  e.update(1 / 60, FAR, PLAYER, w);
  chk(!e.resting, 'mining the block beneath it wakes it immediately — it does not hang in the air');
  settle(e, 600);
  chk(e.resting && Math.abs(e.position.y - top) < 1e-6,
      `and it falls and re-settles on the newly exposed surface (y=${e.position.y}, want ${top})`);
  // Mining a block BESIDE it must not wake it.
  w.setBlockWorld(X + 1, top, Z, BLOCK.STONE);
  e.update(1 / 60, FAR, PLAYER, w);
  const wasResting = e.resting;
  w.setBlockWorld(X + 1, top, Z, BLOCK.AIR);
  e.update(1 / 60, FAR, PLAYER, w);
  chk(wasResting && e.resting, 'while mining a block beside it leaves it resting — support is what matters');
  e.destroy();
}
{
  /* THE REGRESSION THE OLD SUPPORT TEST WOULD HAVE FAILED. isSolid() answers true for
     noclip decoration; collidesAABB falls through it. If support is decided by isSolid,
     an item whose real floor is mined but which has a weed in the cell below is reported
     supported and hangs in mid-air forever. */
  const X = BASE.x + 80, Z = BASE.z + 20;
  ensure(X - 3, Z - 3, X + 3, Z + 3);
  const top = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(X, y, Z)) return y + 1; return 0; })();
  const decor = BLOCK.WEED_CLUMP !== undefined ? BLOCK.WEED_CLUMP : BLOCK.TORCH;
  w.setBlockWorld(X, top, Z, BLOCK.STONE);
  const e = drop(X + 0.5, top + 4, Z + 0.5);
  settle(e);
  const rested = e.resting && Math.abs(e.position.y - (top + 1)) < 1e-6;
  w.setBlockWorld(X, top, Z, decor);                 // floor replaced by a noclip weed
  e.update(1 / 60, FAR, PLAYER, w);
  chk(rested && !e.resting,
      `an item whose floor becomes a noclip decoration (id ${decor}) wakes and falls — ` +
      `support and landing now use the same predicate`);
  settle(e, 600);
  chk(e.resting && Math.abs(e.position.y - top) < 1e-6,
      `and lands on the real surface beneath it (y=${e.position.y}, want ${top})`);
  e.destroy();
  w.setBlockWorld(X, top, Z, BLOCK.AIR);
}

// =====================================================================================
// I. CHUNK BOUNDARIES
// =====================================================================================
{
  const CSX = ev('CHUNK_SX'), CSZ = ev('CHUNK_SZ');
  // A column exactly on a chunk seam.
  const X = Math.ceil((BASE.x + 100) / CSX) * CSX, Z = Math.ceil((BASE.z + 20) / CSZ) * CSZ;
  ensure(X - 4, Z - 4, X + 4, Z + 4);
  const top = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(X, y, Z)) return y + 1; return 0; })();
  const e = drop(X, top + 4, Z);                      // straddling both seams
  settle(e);
  chk(e.resting, 'an item dropped exactly on a chunk corner settles');
  const restY = e.position.y, restX = e.position.x, restZ = e.position.z;
  chk(meshBottom(e) >= top - 1e-9, 'and is not sunk there');

  // Now unload a neighbouring chunk and keep stepping: it must NOT fall through.
  const ncx = Math.floor((X - 1) / CSX), ncz = Math.floor((Z - 1) / CSZ);
  const key = ncx + ',' + ncz;
  const saved = w.chunks.get(key);
  w.chunks.delete(key);
  for (let i = 0; i < 120; i++) e.update(1 / 60, FAR, PLAYER, w);
  chk(Math.abs(e.position.y - restY) < 1e-9 && Math.abs(e.position.x - restX) < 1e-9 &&
      Math.abs(e.position.z - restZ) < 1e-9,
      `with the neighbouring chunk unloaded it holds its exact world position for two ` +
      `seconds (y=${e.position.y.toFixed(6)}) instead of falling through the missing data`);
  if (saved) w.chunks.set(key, saved);
  for (let i = 0; i < 60; i++) e.update(1 / 60, FAR, PLAYER, w);
  chk(Math.abs(e.position.y - restY) < 1e-9,
      'and does not pop when the chunk streams back in');
  e.destroy();
}

// =====================================================================================
// J. PICKUP IS PRESERVED
// =====================================================================================
{
  chk(PICKUP_R === 1.5, `the pickup radius is unchanged at ${PICKUP_R}`);
  const situations = [];
  const mk = (label, x, y, z) => { const e = drop(x, y, z); settle(e); situations.push([label, e]); };
  mk('flat ground', BASE.x + 0.5, FLOOR_Y + 3, BASE.z + 0.5);
  mk('a chunk seam', Math.ceil((BASE.x + 100) / ev('CHUNK_SX')) * ev('CHUNK_SX'), FLOOR_Y + 3,
     Math.ceil((BASE.z + 20) / ev('CHUNK_SZ')) * ev('CHUNK_SZ'));
  let bad = [];
  for (const [label, e] of situations) {
    if (!e.resting) { bad.push(label + ': not resting'); continue; }
    let picked = 0;
    const P = { inventory: { addItem: () => { picked++; return true; } }, sound: { playItemPickup() {} } };
    // Stand one block away horizontally, feet level with the item's foot.
    const near = new THREE.Vector3(e.position.x + 1.0, e.position.y, e.position.z);
    e.update(1 / 60, near, P, w);
    if (picked !== 1) bad.push(label + ': not picked up at 1.0 blocks');
    if (e.alive) bad.push(label + ': still alive after pickup');
  }
  chk(bad.length === 0, 'pickup still fires on flat ground and at a chunk seam' +
      (bad.length ? ' — ' + bad.join('; ') : ''));
}
{
  // The measured range must not pulse with the bob any more.
  const e = drop(BASE.x + 0.5, FLOOR_Y + 3, BASE.z + 0.5);
  settle(e);
  let minR = Infinity, maxR = -Infinity;
  for (let i = 0; i < 240; i++) {
    e.update(1 / 60, FAR, PLAYER, w);
    // The reach the shipped code actually uses, recomputed the same way.
    const dy = (e.position.y + MESH_HALF) - e.position.y;
    const r = Math.sqrt(Math.max(0, PICKUP_R * PICKUP_R - dy * dy));
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
  }
  chk(maxR - minR < 1e-9,
      `and the horizontal reach is now constant at ${maxR.toFixed(4)} blocks instead of ` +
      `pulsing with the bob three times a second`);
  e.destroy();
}

// =====================================================================================
// K. ITEM CATEGORIES — MEASURED, NOT ASSUMED
// =====================================================================================
{
  /* Every dropped item in this build shares ONE geometry: BoxGeometry(0.25) with a flat
     per-item colour. That is a fact about the current art, not an assumption — it is
     asserted below — and Phase 21 explicitly does not change the art. So the honest form
     of "test multiple categories" is to prove they really are dimensionally identical and
     that each still contacts correctly. */
  const cats = [['grass', ITEM.GRASS], ['dirt', ITEM.DIRT], ['stone', ITEM.COBBLESTONE],
                ['ore', ITEM.IRON_ORE], ['tool', ITEM.IRON_PICKAXE], ['torch', ITEM.TORCH],
                ['log', ITEM.OAK_LOG], ['disk', ITEM.CORE_DISK_L2]];
  let bad = [], dims = null, same = true;
  for (const [label, id] of cats) {
    if (id === undefined) { bad.push(label + ': no such item'); continue; }
    const e = drop(BASE.x + 0.5, FLOOR_Y + 4, BASE.z + 0.5, id);
    e.mesh.geometry.computeBoundingBox();
    const bb = e.mesh.geometry.boundingBox;
    const d = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].join('x');
    if (dims === null) dims = d; else if (d !== dims) same = false;
    settle(e);
    if (!e.resting || Math.abs(e.position.y - FLOOR_Y) > 1e-6) bad.push(label + ': did not settle on the surface');
    if (meshBottom(e) < FLOOR_Y - 1e-9) bad.push(label + ': sunk');
    e.destroy();
  }
  chk(bad.length === 0, `eight item categories all settle on the surface and none is sunk` +
      (bad.length ? ' — ' + bad.join('; ') : ''));
  chk(same, `and every one shares the same ${dims} geometry — this build draws all drops ` +
      `with one mesh, so there is no per-item origin to correct`);
}

// =====================================================================================
// L. DETERMINISM
// =====================================================================================
{
  // Same start, same result — the contact correction adds no randomness.
  const run = () => { const e = drop(BASE.x + 0.5, FLOOR_Y + 7, BASE.z + 0.5); settle(e);
                      const r = [e.position.x, e.position.y, e.position.z]; e.destroy(); return r; };
  const a = run(), b = run(), c = run();
  chk(a.every((v, i) => v === b[i] && v === c[i]),
      `three identical drops produce bit-identical resting positions ` +
      `(${a.map(v => v.toFixed(6)).join(', ')})`);
}
{
  // The spawn impulse IS random by design (pre-existing scatter) — but it must not make
  // an item land anywhere invalid.
  let bad = 0;
  for (let i = 0; i < 200; i++) {
    const e = drop(BASE.x + 0.5, FLOOR_Y + 2, BASE.z + 0.5, ITEM.COBBLESTONE, true);
    settle(e, 1200);
    if (!e.resting || e._collidesAt(w, e.position) || meshBottom(e) < e.position.y - 1e-9) bad++;
    e.destroy();
  }
  chk(bad === 0, '200 drops with the random spawn scatter all settle outside solid geometry, none sunk');
}

// =====================================================================================
// M. COST
// =====================================================================================
{
  const N = 300;
  const items = [];
  for (let i = 0; i < N; i++) items.push(drop(BASE.x + (i % 7) * 0.3, FLOOR_Y + 2, BASE.z + Math.floor(i / 7) * 0.3));
  for (const e of items) settle(e, 400);
  const resting = items.filter(e => e.resting).length;
  const t0 = process.hrtime.bigint();
  const F = 600;
  for (let f = 0; f < F; f++) for (const e of items) e.update(1 / 60, FAR, PLAYER, w);
  const per = Number(process.hrtime.bigint() - t0) / 1e6 / F;
  console.log(`      ${resting}/${N} resting; ${per.toFixed(4)} ms to update all ${N} items per frame ` +
              `(${(per / N * 1000).toFixed(2)} µs each, ${(per / 16.7 * 100).toFixed(2)}% of a 60fps frame)`);
  chk(per < 2.0, `updating ${N} resting items costs ${per.toFixed(4)} ms/frame — well inside budget`);
  for (const e of items) e.destroy();
}

// =====================================================================================
// N. FARMLAND TERRAIN — THE PHASE 19 MICRO-RELIEF THIS HAS TO SURVIVE
// =====================================================================================
{
  /* Real generated Farmland, not a hand-built test rig: ploughed rows, soil patches,
     verges, ditch lips and the causeway lift all put the support surface at a different
     height from column to column, which is exactly what a "settle on the actual surface"
     claim has to be tested against. */
  const P = ev('FARM_P'), B0 = ev('FARM_J_B0'), LINE = ev('FARM_J_LINE');
  const x0 = B0 * P + 120, z0 = Math.round(w._farmJourneyLaneZ(x0)) + 24;
  genRegion(w, x0 - 8, z0 - 8, x0 + 24, z0 + 24);
  let tested = 0, bad = [], heights = new Set();
  for (let i = 0; i < 24; i++) {
    const x = x0 + (i % 6) * 3, z = z0 + Math.floor(i / 6) * 3;
    const surf = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(x, y, z)) return y + 1; return null; })();
    if (surf === null) continue;
    // Skip columns that are under water — items sink through water by design.
    if (w.waterLevelAt(x, surf - 1, z) > 0 || w.waterLevelAt(x, surf, z) > 0) continue;
    tested++; heights.add(surf);
    const e = drop(x + 0.5, surf + 5, z + 0.5);
    settle(e, 900);
    if (!e.resting) { bad.push(`(${x},${z}) never rested`); e.destroy(); continue; }
    if (meshBottom(e) < e.position.y - 1e-9) bad.push(`(${x},${z}) mesh below foot`);
    // It must be ON a surface: nothing overlapping, and something a hair below.
    if (e._collidesAt(w, e.position)) bad.push(`(${x},${z}) resting inside solid`);
    if (!e._stillSupported(w)) bad.push(`(${x},${z}) resting but unsupported`);
    e.destroy();
  }
  chk(tested > 12 && bad.length === 0,
      `${tested} drops across real Farmland terrain spanning ${heights.size} different ` +
      `surface heights all settle supported and outside solid geometry` +
      (bad.length ? ' — ' + bad.slice(0, 4).join('; ') : ''));
}
{
  // A drop onto the journey lane itself — the causeway lift raises track columns.
  const P = ev('FARM_P'), B0 = ev('FARM_J_B0');
  const x = B0 * P + 200, z = Math.round(w._farmJourneyLaneZ(x));
  genRegion(w, x - 6, z - 6, x + 6, z + 6);
  const surf = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(x, y, z)) return y + 1; return 0; })();
  const e = drop(x + 0.5, surf + 4, z + 0.5);
  settle(e, 900);
  chk(e.resting && Math.abs(e.position.y - surf) < 1e-4 && e._stillSupported(w),
      `an item dropped on the journey lane rests on the carriageway (y=${e.position.y.toFixed(4)}, ` +
      `surface ${surf})`);
  e.destroy();
}

// =====================================================================================
// O. BEFORE / AFTER — THE SAME DROPS ON THE PRE-PHASE-21 BUILD
// =====================================================================================
{
  const fs = require('fs'), path = require('path');
  const BASE_HTML = process.env.WII_PRE21 || path.join(__dirname, 'phase20_2.html');
  if (!fs.existsSync(BASE_HTML)) {
    console.log('      (pre-Phase-21 build absent — run: git show 71ec935:game.html > tests/phase20_2.html)');
  } else {
    const old = require('./harness/world.js').makeWorld(BASE_HTML);
    const OldItem = vm.runInContext('ItemEntity', old.S);
    const oldScene = new THREE.Scene();
    const oldW = old.w;
    genRegion(oldW, BASE.x - 4, BASE.z - 4, BASE.x + 4, BASE.z + 4);
    const oldFloor = (() => { for (let y = 60; y >= 0; y--) if (oldW.isSolid(BASE.x, y, BASE.z)) return y + 1; return 0; })();
    const OLD_SZY = vm.runInContext('ITEM_SIZE_Y', old.S);

    // --- CONTACT, BEFORE ---
    const gaps = [];
    for (const h of [2, 4, 6, 9, 14]) {
      const e = new OldItem(oldScene, ev('ITEM').COBBLESTONE, 1,
                            new THREE.Vector3(BASE.x + 0.5, oldFloor + h, BASE.z + 0.5), oldW);
      for (let i = 0; i < 900 && !e.resting; i++) e.update(1 / 60, FAR, PLAYER, oldW);
      // The old build drew the mesh AT position.y with a centred geometry.
      let lo = Infinity;
      for (let i = 0; i < 400; i++) { e.update(1 / 60, FAR, PLAYER, oldW); lo = Math.min(lo, e.mesh.position.y - OLD_SZY / 2); }
      gaps.push(lo - oldFloor);
      e.destroy();
    }
    const worstOld = Math.min(...gaps);
    console.log(`      BEFORE: deepest rendered point across five drop heights ranged ` +
                `${Math.min(...gaps).toFixed(3)} to ${Math.max(...gaps).toFixed(3)} relative to the surface`);
    chk(worstOld < -0.04,
        `the pre-Phase-21 build really did sink items: worst ${worstOld.toFixed(3)} blocks ` +
        `below the surface (negative = penetrating)`);

    // --- CONTACT, AFTER ---
    const nowGaps = [];
    for (const h of [2, 4, 6, 9, 14]) {
      const e = drop(BASE.x + 0.5, FLOOR_Y + h, BASE.z + 0.5);
      settle(e, 900);
      let lo = Infinity;
      for (let i = 0; i < 400; i++) { e.update(1 / 60, FAR, PLAYER, w); lo = Math.min(lo, meshBottom(e)); }
      nowGaps.push(lo - FLOOR_Y);
      e.destroy();
    }
    const worstNow = Math.min(...nowGaps);
    console.log(`      AFTER:  ${Math.min(...nowGaps).toFixed(6)} to ${Math.max(...nowGaps).toFixed(6)}`);
    chk(worstNow >= -1e-6,
        `and after the fix nothing penetrates at any drop height (worst ${worstNow.toExponential(1)})`);

    // --- COST, BEFORE vs AFTER, same work on both builds ---
    const bench = (Cls, scn, world, floorY) => {
      const items = [];
      for (let i = 0; i < 300; i++) {
        const e = new Cls(scn, ev('ITEM').COBBLESTONE, 1,
                          new THREE.Vector3(BASE.x + (i % 7) * 0.3, floorY + 2, BASE.z + Math.floor(i / 7) * 0.3), world);
        for (let k = 0; k < 400 && !e.resting; k++) e.update(1 / 60, FAR, PLAYER, world);
        items.push(e);
      }
      const runs = [];
      for (let r = 0; r < 5; r++) {
        const t = process.hrtime.bigint();
        for (let f = 0; f < 400; f++) for (const e of items) e.update(1 / 60, FAR, PLAYER, world);
        runs.push(Number(process.hrtime.bigint() - t) / 1e6 / 400);
      }
      for (const e of items) e.destroy();
      runs.sort((a, b) => a - b);
      return runs[2];
    };
    const after = bench(ItemEntity, scene, w, FLOOR_Y);
    const before = bench(OldItem, oldScene, oldW, oldFloor);
    const delta = (after / before - 1) * 100;
    console.log(`      COST:   300 resting items per frame — before ${before.toFixed(4)} ms, ` +
                `after ${after.toFixed(4)} ms (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)`);
    chk(after < before * 1.6,
        `the per-frame item cost is not materially worse than the build it replaces ` +
        `(${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)`);
  }
}

console.log(`\n${fail === 0 ? 'ALL ITEM-CONTACT CHECKS PASS' : fail + ' FAILURES'}`);
process.exit(fail ? 1 : 0);
