"use strict";
/* =====================================================================================
   D1 — THE SHATTERED FARMLANDS: THE FINITE WORLD DEFINITION
   ERA 2, PHASE E2.2 — NEW. This file is the world's extent, and nothing else.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE FINITE DECISION, AND WHY IT IS A DECISION AT ALL

   The Era 1 Farmlands is 64,512 blocks square. Its own header says the arrival point sits
   at the centre with "2,016 chunks — 32,256 blocks — of farmland in every direction … on
   the order of two hours of walking to reach an edge", and that "a player cannot reach one
   in normal play". That is an EFFECTIVELY INFINITE world, and it was the right answer for
   a procedural dimension.

   It is the wrong answer for the final D1. A world nobody can cross cannot be composed:
   there is no far side, no silhouette on the horizon that means something, no "the
   schoolhouse is an hour east", and no way to author a journey — only a direction to walk
   and a hope of encountering content. The final D1 is a SPECIFIC PHYSICAL PLACE.

   So this world is finite, and the boundary is a real edge with a real location.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE EXTENT IS LOCKED AT 4,096 m SQUARE

   `D1_WORLD_SIZE` below is 4,096 m square. That figure is DERIVED, not chosen from taste,
   and the derivation is written out so it can be argued with:

     · The player's sustained ground speed in this build is ~4.3 m/s (WALK_SPEED in
       entity-tuning, times the measured sprint/terrain factors), so a straight corner-to-
       corner crossing of a 4,096 m square is ~22 minutes and an edge-to-edge run ~16.
     · The authored roster is SEVEN landmarks. Spread over 4,096 m that is roughly 1.2 km
       between neighbours on a wandering route — far enough that one is out of sight of
       the next in rolling farmland, close enough that a journey between them is a walk
       rather than a commute.
     · 4,096 m at the region size below is a 16 x 16 grid of 256 m regions: 256 regions,
       which is a tractable number to author against and to stream.

   **THIS FIGURE IS NOW APPROVED AND LOCKED.** It was provisional when this file shipped
   in E2.2; the creative decision has since been made and 4,096 m x 4,096 m is the final
   D1 extent. The seven landmarks and the route between them are composed inside it.

   It remains one constant that every other number in this file derives from, so it is
   still cheap to change — but changing it is now a CANON change, not a tuning tweak. If a
   technical constraint ever makes this extent unworkable, REPORT THAT SEPARATELY rather
   than editing the number. See D1_DESIGN.md section 0.4 and ARCHITECTURE.md section 4.10.

   ─────────────────────────────────────────────────────────────────────────────────────
   METRES, NOT BLOCKS

   Every number in this file and everything downstream of it is in METRES and may be
   fractional. The Era 1 world's unit happened to be one block; this world has no blocks,
   so the unit is simply a metre and the terrain is continuous within it. Nothing here
   divides by CHUNK_SX, floors a coordinate, or names a block id — asserted by
   `tests/architecture.js` and `tests/terrain.js`.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   ===================================================================================== */

/* THE ONE NUMBER. Metres, square, centred on the origin of D1's own local space. */
const D1_WORLD_SIZE = 4096;

/* A REGION is the streaming and authoring unit. 256 m is chosen against two measurements
   rather than by feel: it is large enough that a walking player crosses one in about a
   minute (so load events are rare), and small enough that one region's terrain mesh at
   the finest LOD below is ~33k triangles, which is a sane single geometry to build,
   upload and throw away. */
const D1_REGION_SIZE = 256;
const D1_REGION_GRID = D1_WORLD_SIZE / D1_REGION_SIZE;     // 16 x 16 = 256 regions

/* THE PLAYABLE RECTANGLE, in D1 local metres. Centred on the origin: the world runs from
   -2048 to +2048 on both axes. A centred origin means authored coordinates read as
   signed offsets from the middle of the map rather than as large positive numbers, and it
   puts the float precision sweet spot where the content is. */
const D1_WORLD_MIN_X = -D1_WORLD_SIZE / 2;
const D1_WORLD_MAX_X =  D1_WORLD_SIZE / 2;
const D1_WORLD_MIN_Z = -D1_WORLD_SIZE / 2;
const D1_WORLD_MAX_Z =  D1_WORLD_SIZE / 2;

/* THE EDGE IS NOT A WALL, AND THIS PHASE DOES NOT DECIDE WHAT IT IS.

   A finite world needs an honest boundary, and CLAUDE.md section 65 forbids invisible
   walls. The candidates — a river, a treeline that thickens, a collapsed road, terrain
   that rises past climbable — are all ENVIRONMENTAL AUTHORSHIP and therefore creative.
   What E2.2 provides is the margin they will be authored into, and a soft containment
   that is honest about being provisional: terrain continues to exist through the margin
   so nothing falls off, and `d1ClampToWorld` is where a future phase attaches the real
   treatment. The margin is inside the extent, not added to it. */
const D1_EDGE_MARGIN = 192;

/* THE RELIEF LAYERS. Amplitudes in METRES, wavelengths in METRES — everything real-world
   scale, per VISUAL_RULE_BIBLE section 15. Rolling farmland, not mountains: a water tower
   has to stay visible across the map (ROADMAP section 36) and a 300 m peak would hide it.

   These live HERE rather than with the noise that consumes them because they are the
   world's DIMENSIONS, and because the vertical budget below is derived from them. */
const D1_RELIEF = Object.freeze({
  continentalAmp: 26,  continentalLen: 1400,
  secondaryAmp:   11,  secondaryLen:   520,
  rollingAmp:      5,  rollingLen:     170,
  ridgeAmp:        4,  ridgeLen:       760,
  microAmp:      0.35, microLen:        11,
  baseLevel:      18,
});

/* How far the edge margin lowers the ground on its way out. */
const D1_EDGE_DROP = 9;

/* The lowland water table. One level across the map: the whole relief budget is small
   enough that a per-basin table would be invisible and would cost a second lookup on
   every query. CLAUDE.md section 30 forbids expensive global fluid and this is the cheap
   correct answer. */
const D1_WATER_LEVEL = 6.5;

/* THE VERTICAL BUDGET — DERIVED, NOT TYPED.

   These are the bounds the heightfield is GUARANTEED to stay inside, and they are what
   every region's bounding box and the collision broadphase are built from. The first
   version of this file hand-typed -8 and 72; the analytic worst case is about -33 and
   +64, so `tests/terrain.js` caught 4,000 random samples falling outside a budget that
   the region bounds were nonetheless being built from. A hand-typed bound drifts the
   moment an amplitude changes. This one cannot.

   Every additive layer is at worst ±its amplitude; the ridge band only ever ADDS; the edge
   margin only ever SUBTRACTS. One metre of slack absorbs the road cut and site grading,
   which both move the surface by less than that. */
const D1_MAX_Y = D1_RELIEF.baseLevel + D1_RELIEF.continentalAmp + D1_RELIEF.secondaryAmp +
                 D1_RELIEF.rollingAmp + D1_RELIEF.ridgeAmp + D1_RELIEF.microAmp + 1;
const D1_MIN_Y = D1_RELIEF.baseLevel - D1_RELIEF.continentalAmp - D1_RELIEF.secondaryAmp -
                 D1_RELIEF.rollingAmp - D1_RELIEF.microAmp - D1_EDGE_DROP - 1;

/* THE STREAMING RADII, in metres and measured from the camera. Load is generous because a
   region is cheap and a pop-in is not; unload has hysteresis so a player standing on a
   boundary does not thrash one region in and out every step. */
const D1_STREAM_LOAD_RADIUS = 768;      // 3 regions out
const D1_STREAM_UNLOAD_RADIUS = 1152;   // 4.5 — the hysteresis gap is deliberate
const D1_STREAM_BUDGET_MS = 4;          // per frame, matching the voxel streamer's budget

/* LOD BY DISTANCE. A region's mesh is built at one of these vertex spacings, in metres.
   The finest is 2 m, which is what "continuous" means in practice here: the heightfield
   is exact everywhere, and 2 m is where the MESH samples it. A 256 m region at 2 m is a
   129 x 129 grid — 32,768 triangles.

   These are a starting point and the numbers are measured in tests/browser-terrain.js
   rather than asserted; CLAUDE.md section 14 says measure before and after, and section
   80 says a failed optimisation is reverted and recorded. */
const D1_LOD_STEPS = Object.freeze([
  Object.freeze({ maxDistance: 384,      spacing: 2 }),
  Object.freeze({ maxDistance: 768,      spacing: 4 }),
  Object.freeze({ maxDistance: 1536,     spacing: 8 }),
  Object.freeze({ maxDistance: Infinity, spacing: 16 }),
]);

/* THE SEED. Deterministic generation is CLAUDE.md section 11 and it is not negotiable:
   the same seed and the same coordinates produce the same world, on every machine, on
   every reload, in every region, whichever region generated first. */
const D1_TERRAIN_SEED = 0x5ADFA12;

/* ---- QUERIES ---------------------------------------------------------------------- */

function d1IsInsideWorld(x, z) {
  return x >= D1_WORLD_MIN_X && x < D1_WORLD_MAX_X &&
         z >= D1_WORLD_MIN_Z && z < D1_WORLD_MAX_Z;
}

/* Inside the authored interior — i.e. not in the edge margin. This is the area landmarks
   and routes may be authored into. */
function d1IsInsidePlayArea(x, z) {
  const m = D1_EDGE_MARGIN;
  return x >= D1_WORLD_MIN_X + m && x < D1_WORLD_MAX_X - m &&
         z >= D1_WORLD_MIN_Z + m && z < D1_WORLD_MAX_Z - m;
}

/* 0 at the edge of the play area, rising to 1 at the world edge. The authored boundary
   treatment, whatever it turns out to be, is a function of this. */
function d1EdgeFalloff(x, z) {
  const m = D1_EDGE_MARGIN;
  const dx = Math.min(x - D1_WORLD_MIN_X, D1_WORLD_MAX_X - x);
  const dz = Math.min(z - D1_WORLD_MIN_Z, D1_WORLD_MAX_Z - z);
  const d = Math.min(dx, dz);
  if (d >= m) return 0;
  if (d <= 0) return 1;
  const t = 1 - d / m;
  return t * t * (3 - 2 * t);           // smoothstep, so the margin has no crease at its lip
}

/* Keep a position inside the world. PROVISIONAL, and deliberately soft: it does not stop
   a player, it reports. Whoever authors the boundary decides what happens at it. */
function d1ClampToWorld(x, z) {
  const e = 0.001;
  return {
    x: Math.min(Math.max(x, D1_WORLD_MIN_X), D1_WORLD_MAX_X - e),
    z: Math.min(Math.max(z, D1_WORLD_MIN_Z), D1_WORLD_MAX_Z - e),
    clamped: !d1IsInsideWorld(x, z),
  };
}

/* Region index <-> world metres. Regions are indexed from the world minimum so an index
   is always a non-negative integer, which makes a region key a plain string and a grid
   walk a pair of for loops with no sign handling. */
function d1RegionIndexAt(x, z) {
  return {
    rx: Math.floor((x - D1_WORLD_MIN_X) / D1_REGION_SIZE),
    rz: Math.floor((z - D1_WORLD_MIN_Z) / D1_REGION_SIZE),
  };
}

function d1RegionKey(rx, rz) { return rx + ',' + rz; }

function d1RegionExists(rx, rz) {
  return rx >= 0 && rx < D1_REGION_GRID && rz >= 0 && rz < D1_REGION_GRID;
}

/* The world-space rectangle a region covers. */
function d1RegionBounds(rx, rz) {
  const minX = D1_WORLD_MIN_X + rx * D1_REGION_SIZE;
  const minZ = D1_WORLD_MIN_Z + rz * D1_REGION_SIZE;
  return { minX, minZ, maxX: minX + D1_REGION_SIZE, maxZ: minZ + D1_REGION_SIZE,
           centreX: minX + D1_REGION_SIZE / 2, centreZ: minZ + D1_REGION_SIZE / 2 };
}

/* Which LOD a region gets from a viewpoint. Measured from the region's nearest point, not
   its centre, so a large region the player is standing at the edge of is not coarse. */
function d1RegionLod(rx, rz, viewX, viewZ) {
  const b = d1RegionBounds(rx, rz);
  const dx = Math.max(b.minX - viewX, 0, viewX - b.maxX);
  const dz = Math.max(b.minZ - viewZ, 0, viewZ - b.maxZ);
  const d = Math.sqrt(dx * dx + dz * dz);
  for (const step of D1_LOD_STEPS) if (d <= step.maxDistance) return step.spacing;
  return D1_LOD_STEPS[D1_LOD_STEPS.length - 1].spacing;
}

/* Every region the world contains, as a flat list. THE PROOF THAT THE WORLD IS FINITE is
   that this function terminates and returns 256 entries. */
function d1AllRegions() {
  const out = [];
  for (let rz = 0; rz < D1_REGION_GRID; rz++)
    for (let rx = 0; rx < D1_REGION_GRID; rx++) out.push({ rx, rz });
  return out;
}
