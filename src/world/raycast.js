"use strict";
/* =====================================================================================
   THE NORMALIZED RAYCAST — WHAT IS ALONG THIS RAY
   D1 IMPLEMENTATION PHASE 2 — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY THIS EXISTS, AND WHY IT COULD NOT EXIST BEFORE

   `src/world/physical-world.js` deliberately left `raycast` OUT of the eleven-query
   contract, and said why: `voxelRaycast` returns `{ bx, by, bz, face }` — block
   coordinates and a block face — while a mesh world returns a point, a normal and a
   surface, which is a different type. Changing the voxel one in place would have meant
   rewriting mining, placement, door toggling and the look-target prompt in the same phase
   that moved the collision seam. It ends: *"The interaction model gets its own phase when
   it is rebuilt for meshes."*

   **THIS IS THAT PHASE, AND IT DOES NOT CHANGE `voxelRaycast`.** That function, its one call
   site (`PlayerController._getLookTarget`) and the four gameplay paths that consume its
   result — mining, the break, placement and the interaction prompt — are all untouched.

   What Phase 2 adds is a SECOND, NORMALIZED query alongside it, whose result type is
   representation-neutral — so a caller can ask "what is along this ray" of terrain, of
   placed architecture, or of a voxel world, and get back the same shape of answer without
   knowing which answered.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE RESULT IS A PLAIN OBJECT AND NAMES NOTHING FROM THREE

   A hit carries a distance, a point, a normal, the category that produced it, and an
   optional opaque reference. It never carries a `THREE.Mesh`, a geometry, a material or a
   block id. That is the whole point: gameplay that reads a hit must not acquire a
   dependency on the renderer, and `tests/raycast.js` fails if this file names THREE.

   A MISS IS `null`. Not a hit object with `hit: false`, not a sentinel — `null`, because
   every call site is going to be `if (h)` and an object that is falsy-when-missing is a
   trap. `RAYCAST_MISS` is exported as documentation of that choice and is `null` itself.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE CONVENTIONS, AND THEY ARE ONE SET FOR EVERY PROVIDER

   ORIGIN      World space. The physical world is a world-query service and NEVER derives
               an origin from a camera — `PhysicalWorld` does not know what a camera is.
               Whoever has an eye builds the ray.

   DIRECTION   **MUST BE NORMALIZED BY THE CALLER.** One rule, every provider, testable
               through `rayIsNormalized` rather than silently fixed at runtime: a provider
               that normalizes and one that does not is exactly how two backends start
               disagreeing about distance. Distances are therefore in world units
               along the ray and are directly comparable across providers, which is what
               makes the nearest-hit rule meaningful.

   MAX DISTANCE Explicit at the caller. There is no default, because a default here would
               be a gameplay tuning constant and this phase authors none. A provider must
               not return a hit beyond it.

   SOLID FROM BOTH SIDES. Collision proxies are VOLUMES, not sheets, so there is no
               backface culling: a ray that starts inside a solid volume reports a hit at
               distance 0. Culling backfaces would mean a player standing inside a wall
               could aim through it, and the two providers would have to agree on a facing
               convention they have no way to share. Documented, uniform, tested.

   ─────────────────────────────────────────────────────────────────────────────────────
   CATEGORY AND THE TIE-BREAK

   Every hit names the CATEGORY of the thing that produced it. That is what lets a caller
   distinguish "I am looking at the ground" from "I am looking at a placed structure"
   without asking the renderer.

   `RAYCAST_CATEGORY_RANK` exists for ONE reason: when two providers report hits at
   effectively the same distance, something has to break the tie deterministically, and it
   may not be "whichever provider was registered first". The rank is a fixed, declared
   order and it never changes with registration.

   When the rank ties too, the smaller `providerId` wins — a stable id the producing
   provider mints. `AssetCollisionSet`'s counter is MODULE-LEVEL for exactly this: with a
   per-set counter two sets both mint id 1, the comparison finds them equal, and the winner
   falls back to consultation order, which is the thing this rule forbids.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.12 and src/world/LAYER.md.
   ===================================================================================== */

/* A MISS. Deliberately `null` — see the header. */
const RAYCAST_MISS = null;

/* What KIND of thing answered. A caller may filter on these; nothing here is a D1
   interaction category and none may be added for one. */
const RAYCAST_CATEGORY = Object.freeze({
  TERRAIN: 'terrain',   // the ground itself, from a heightfield or a voxel column
  ASSET:   'asset',     // a placed authored structure, through its declared proxy
});

/* THE TIE-BREAK ORDER, and it is a DECLARATION rather than an accident of registration.
   Lower wins at equal distance. An authored structure beats the ground it stands on,
   because a floor laid exactly on the terrain is a floor. */
const RAYCAST_CATEGORY_RANK = Object.freeze({
  asset: 0,
  terrain: 1,
});

/* How close two distances have to be to count as the same hit. One millimetre: far below
   anything a player can perceive and far above float noise on a 4 km map. */
const RAYCAST_TIE_EPSILON = 1e-3;

/* Build a normalized hit. `ref` is an OPAQUE handle the producing provider may use to
   identify what was struck — an id, an entry, anything — and gameplay must treat it as
   meaningless except to hand back to that provider. It is the hook D1 Phase 3 resolves an
   interaction target through, and it carries no renderer object today. */
function makeRayHit(distance, point, normal, category, ref, providerId) {
  return {
    distance: distance,
    point: point,                 // { x, y, z } — plain, never a THREE.Vector3
    normal: normal,               // { x, y, z } unit, or null where the provider has none
    category: category,
    ref: ref === undefined ? null : ref,
    providerId: providerId === undefined ? null : providerId,
  };
}

/* IS `b` A BETTER HIT THAN `a`? The nearest-hit rule, in one place so every composer uses
   the same one. Nearer wins; at effectively equal distance the declared category rank
   wins; if that ties too, the smaller stable provider id wins. Deterministic, and
   independent of the order providers were consulted. */
function rayHitBeats(candidate, incumbent) {
  if (!candidate) return false;
  if (!incumbent) return true;
  const d = candidate.distance - incumbent.distance;
  if (d < -RAYCAST_TIE_EPSILON) return true;
  if (d > RAYCAST_TIE_EPSILON) return false;

  const rc = RAYCAST_CATEGORY_RANK[candidate.category];
  const ri = RAYCAST_CATEGORY_RANK[incumbent.category];
  const rankC = rc === undefined ? 99 : rc;
  const rankI = ri === undefined ? 99 : ri;
  if (rankC !== rankI) return rankC < rankI;

  const pc = candidate.providerId, pi = incumbent.providerId;
  if (typeof pc === 'number' && typeof pi === 'number' && pc !== pi) return pc < pi;
  return false;                                   // genuinely indistinguishable: keep the incumbent
}

/* THE SLAB TEST. Ray against an axis-aligned box, returning the entry distance along the
   ray, or null.

   Returns 0 when the origin is INSIDE the box — solid from both sides, per the header.
   `box` is { minX, minY, minZ, maxX, maxY, maxZ }, the vocabulary `AssetCollisionSet`
   already speaks. Allocates nothing. */
function rayAabbDistance(ox, oy, oz, dx, dy, dz, box, maxDistance) {
  let tMin = 0, tMax = maxDistance;

  /* X */
  if (dx !== 0) {
    const inv = 1 / dx;
    let t1 = (box.minX - ox) * inv, t2 = (box.maxX - ox) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  } else if (ox < box.minX || ox > box.maxX) return null;

  /* Y */
  if (dy !== 0) {
    const inv = 1 / dy;
    let t1 = (box.minY - oy) * inv, t2 = (box.maxY - oy) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  } else if (oy < box.minY || oy > box.maxY) return null;

  /* Z */
  if (dz !== 0) {
    const inv = 1 / dz;
    let t1 = (box.minZ - oz) * inv, t2 = (box.maxZ - oz) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  } else if (oz < box.minZ || oz > box.maxZ) return null;

  return tMin;
}

/* The outward normal of the box face the ray entered through, at distance `t`. Chosen by
   which slab the entry landed on, with a small tolerance so a grazing hit on an edge picks
   one face deterministically rather than by float luck. Returns null for an origin already
   inside the box, where "the face you came through" has no answer. */
function rayAabbNormal(ox, oy, oz, dx, dy, dz, box, t) {
  if (t <= 0) return null;
  const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
  const e = 1e-6;
  if (Math.abs(px - box.minX) < e) return { x: -1, y: 0, z: 0 };
  if (Math.abs(px - box.maxX) < e) return { x: 1, y: 0, z: 0 };
  if (Math.abs(py - box.minY) < e) return { x: 0, y: -1, z: 0 };
  if (Math.abs(py - box.maxY) < e) return { x: 0, y: 1, z: 0 };
  if (Math.abs(pz - box.minZ) < e) return { x: 0, y: 0, z: -1 };
  if (Math.abs(pz - box.maxZ) < e) return { x: 0, y: 0, z: 1 };
  return null;
}

/* Is this direction unit length? The contract REQUIRES the caller to normalize; this is
   what the tests assert with, and what a provider may use in a development check. It is
   deliberately not called on every query — a per-ray square root to police the caller is a
   cost paid forever to catch a bug once. */
function rayIsNormalized(dx, dy, dz) {
  const l2 = dx * dx + dy * dy + dz * dz;
  return Math.abs(l2 - 1) < 1e-6;
}
