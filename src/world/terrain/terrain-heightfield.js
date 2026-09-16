"use strict";
/* =====================================================================================
   D1 TERRAIN — THE CONTINUOUS HEIGHTFIELD
   ERA 2, PHASE E2.2 — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   THIS IS THE GROUND. THE MESH IS A PICTURE OF IT.

   The single most important property in this phase: **height is a pure function of (x, z)
   over the reals**, and it is authoritative. The visual mesh SAMPLES it. Collision
   QUERIES it. Vegetation is SCATTERED on it. Roads are CUT into it.

   That ordering is what makes the world non-voxel rather than voxel-with-smoothing. If
   the mesh were authoritative, ground height would be a raycast against triangles, it
   would change with LOD, and a player standing still while a region swapped LOD would
   step. Here the mesh can be any resolution — 2 m near, 16 m far — and the player walks
   on exactly the same surface at all of them, because the surface is the function.

   **NOTHING HERE IS FAKED ON TOP OF A VOXEL LOOKUP.** There is no block id, no chunk, no
   integer column, and no call into VoxelWorld anywhere in this file. It is noise, splines
   and arithmetic. `tests/terrain.js` asserts all of that by text and `tests/architecture.js`
   asserts it structurally.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY LAYERED NOISE AND NOT A HEIGHT IMAGE

   A painted heightmap would be authored, which sounds right — but nobody has authored one,
   and inventing the landform of D1 is a creative act this phase is explicitly forbidden to
   perform. Layered deterministic noise gives a believable rural landform with no authored
   intent in it, which is exactly the correct amount of opinion for a FOUNDATION: it is
   ground to stand on, it is not a map.

   When the real D1 landform is authored, `d1BaseElevation` is the one function that
   changes — or is replaced by a sampled image — and everything downstream (regions,
   collision, scatter, roads, the physical world) is unaffected, because all of them go
   through `d1TerrainHeight`.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE LAYERS, LARGEST TO SMALLEST

     CONTINENTAL   two octaves at kilometre scale — the broad rise and fall that decides
                   where the valleys are and which way water would run.
     ROLLING       field-scale undulation, the thing that actually reads as farmland.
     RIDGE         a ridged-noise band, weak, that keeps the large forms from looking like
                   a blurred blob by giving them occasional definite crests.
     MICRO         metre-scale, tiny. NOT visible as shape — it exists so that a flat field
                   is not a plane, which is what makes a rendered field read as ground
                   rather than as a polygon.

   VISUAL_RULE_BIBLE section 4.3 asks for imperfection and section 15 for coherent
   real-world scale; the amplitudes below are in metres and are chosen so the whole map
   stays inside the ~70 m budget D1_MIN_Y/D1_MAX_Y declare.

   CLASSIC script. See src/world/terrain/LAYER.md.
   ===================================================================================== */

/* Surface classification. What KIND of ground a point is — not a material name and not a
   block id. The renderer maps these to materials; the audio director will map them to
   footstep surfaces; gameplay may read them for traversal. Deliberately few. */
const D1_SURFACE = Object.freeze({
  FIELD:    0,    // dry pasture and crop ground — the default of this dimension
  SOIL:     1,    // worked earth, turned fields, bare patches
  ROAD:     2,    // a made surface: gravel, hardpack, the odd broken tarmac
  VERGE:    3,    // the scruffy metre either side of a road — neither field nor road
  LOWLAND:  4,    // drainage bottoms; wetter, darker, where water would collect
  ROCK:     5,    // exposed ground on the steepest faces, where soil would not hold
});

/* D1_RELIEF, D1_EDGE_DROP and D1_WATER_LEVEL live in terrain-config.js: they are the
   world's DIMENSIONS, and the vertical budget the region bounds are built from is derived
   from them there so the two can never disagree. */

/* The noise generators. Built ONCE, lazily, on first use — a module may not do work at
   load time (the classic-script rule ARCHITECTURE.md states), and SimplexNoise is
   declared in an earlier script whose evaluation order this file must not depend on. */
let _d1Noise = null;
function d1Noise() {
  if (_d1Noise) return _d1Noise;
  _d1Noise = {
    continental: new SimplexNoise(D1_TERRAIN_SEED),
    secondary:   new SimplexNoise(D1_TERRAIN_SEED + 17),
    rolling:     new SimplexNoise(D1_TERRAIN_SEED + 101),
    ridge:       new SimplexNoise(D1_TERRAIN_SEED + 257),
    micro:       new SimplexNoise(D1_TERRAIN_SEED + 613),
    soil:        new SimplexNoise(D1_TERRAIN_SEED + 911),
    scatter:     new SimplexNoise(D1_TERRAIN_SEED + 1231),
  };
  return _d1Noise;
}

/* Test hook: drop the cache so a suite can prove determinism across a rebuild rather than
   across a memoised object. Never called by the game. */
function d1ResetNoise() { _d1Noise = null; }

/* Ridged noise: |n| inverted, which turns smooth hills into crests. One line, but it is
   the difference between "blurry blob" and "landscape with structure". */
function _d1Ridge(n) { return 1 - Math.abs(n); }

/* ---- THE LANDFORM ------------------------------------------------------------------ */

/* The bare landform, before roads, before the edge margin. Metres.

   THIS IS THE FUNCTION A FUTURE PHASE REPLACES when the real D1 landform is authored. */
function d1BaseElevation(x, z) {
  const N = d1Noise();
  const R = D1_RELIEF;

  let h = R.baseLevel;
  h += N.continental.noise2D(x / R.continentalLen, z / R.continentalLen) * R.continentalAmp;
  h += N.secondary.noise2D(x / R.secondaryLen, z / R.secondaryLen) * R.secondaryAmp;
  h += N.rolling.noise2D(x / R.rollingLen, z / R.rollingLen) * R.rollingAmp;

  /* The ridge band is MODULATED by the continental layer rather than added flat, so
     crests appear on the high ground and the valleys stay soft. A ridge running through
     a valley floor is the thing that makes procedural terrain look procedural. */
  const highness = Math.max(0, N.continental.noise2D(x / R.continentalLen, z / R.continentalLen));
  h += _d1Ridge(N.ridge.noise2D(x / R.ridgeLen, z / R.ridgeLen)) * R.ridgeAmp * highness;

  h += N.micro.noise2D(x / R.microLen, z / R.microLen) * R.microAmp;
  return h;
}

/* ---- THE FULL SURFACE -------------------------------------------------------------- */

/* THE AUTHORITATIVE GROUND HEIGHT AT ANY REAL (x, z), IN METRES.

   Continuous, deterministic, and independent of mesh resolution, region residency and
   LOD. Everything that needs to know where the ground is asks this. */
function d1TerrainHeight(x, z) {
  let h = d1BaseElevation(x, z);

  /* Roads flatten and cut the ground they run over. The road network is authored content
     (see terrain-roads.js); where there is none, this is a no-op and costs one call. */
  h = d1ApplyRoadsToHeight(x, z, h);

  /* Authored sites level or grade the ground they stand on, and win over a road that runs
     through them — a farmyard is not interrupted by its own entrance track. Applied inside
     the height function for the same reason roads are: collision, scatter and the mesh
     then agree about it without any of them knowing sites exist. No sites are authored in
     E2.2, so this costs one length check. */
  h = d1ApplySitesToHeight(x, z, h);

  /* The edge margin eases DOWN toward the boundary rather than walling up. A rim of
     mountains would be an invisible wall wearing a hat (CLAUDE.md section 65); ground
     that falls away toward a treeline or a floodplain is a place. What is actually at
     the edge is authored later; this only guarantees the terrain does not end abruptly. */
  const e = d1EdgeFalloff(x, z);
  if (e > 0) h -= e * D1_EDGE_DROP;

  return h;
}

/* Surface normal, by central differences on the height function itself — NOT from mesh
   triangles, so it is correct at every LOD and at points no vertex lands on. `eps` is 0.5 m:
   small enough to follow real slope, large enough that the micro layer does not turn every
   normal into noise. Returns a unit {x,y,z}. */
function d1TerrainNormal(x, z, eps) {
  const e = eps || 0.5;
  const hL = d1TerrainHeight(x - e, z), hR = d1TerrainHeight(x + e, z);
  const hD = d1TerrainHeight(x, z - e), hU = d1TerrainHeight(x, z + e);
  const nx = hL - hR, nz = hD - hU, ny = 2 * e;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

/* Slope in DEGREES from horizontal. The number AI traversal, scatter and surface
   classification all actually want. */
function d1TerrainSlope(x, z, eps) {
  const n = d1TerrainNormal(x, z, eps);
  return Math.acos(Math.min(1, Math.max(-1, n.y))) * 180 / Math.PI;
}

/* WHAT KIND OF GROUND IS THIS. Order matters: a road wins over everything it is built on,
   because that is what a road is.

   SPLIT IN TWO SO THE MESH BUILDER CAN STOP PAYING TWICE. Classifying a point needs its
   height and its slope, and a mesh builder already knows both for every vertex it just
   sampled. The convenience form computes them; the precomputed form takes them. That one
   split, with the same change made to normals, took a near region's build from 290 ms to
   the figure recorded in tests/browser-terrain.js — measured, per CLAUDE.md section 14,
   not assumed. */
function d1SurfaceAt(x, z) {
  return d1SurfaceAtPrecomputed(x, z, d1TerrainHeight(x, z), d1TerrainSlope(x, z, 1.5));
}

function d1SurfaceAtPrecomputed(x, z, h, slope) {
  const road = d1RoadSurfaceAt(x, z);
  if (road !== null) return road;

  if (h <= D1_WATER_LEVEL + 1.2) return D1_SURFACE.LOWLAND;
  if (slope > 34) return D1_SURFACE.ROCK;

  /* Worked ground comes in patches at field scale, not per metre — a field is ploughed or
     it is not, and the boundary is a field boundary. */
  const N = d1Noise();
  const soil = N.soil.noise2D(x / 240, z / 240);
  if (soil > 0.28) return D1_SURFACE.SOIL;

  return D1_SURFACE.FIELD;
}

/* Normal and slope from FOUR HEIGHTS THE CALLER ALREADY HAS. Identical arithmetic to
   d1TerrainNormal, without re-evaluating the terrain four times. */
function d1NormalFromHeights(hL, hR, hD, hU, eps) {
  const nx = hL - hR, nz = hD - hU, ny = 2 * eps;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

function d1SlopeFromNormal(n) {
  return Math.acos(Math.min(1, Math.max(-1, n.y))) * 180 / Math.PI;
}

/* Standing water depth in metres at a point: 0 where dry. The lowlands hold water; there
   is no simulation here and there should not be — CLAUDE.md section 30 forbids expensive
   global fluid, and a still water table across a small relief budget is both correct and
   free. */
function d1WaterDepthAt(x, z) {
  const h = d1TerrainHeight(x, z);
  return h < D1_WATER_LEVEL ? D1_WATER_LEVEL - h : 0;
}

/* Is this point standing in open air above the terrain? The continuous equivalent of the
   voxel world's sky test, for the horror systems that ask about exposure. Terrain is a
   heightfield, so anything above the surface has sky — until authored structures exist,
   at which point this grows a check against them and nothing else changes. */
function d1HasSkyAbove(x, y, z) {
  return y >= d1TerrainHeight(x, z) - 0.01;
}
