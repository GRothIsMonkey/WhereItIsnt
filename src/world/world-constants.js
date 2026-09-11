"use strict";
/* =====================================================================================
   CHUNK GEOMETRY, CAVE-MOUTH TUNING AND STREAMING RADII
   ERA 1.5.2 — EXTRACTED VERBATIM FROM game.html.

   Three groups of flat numbers that describe the world rather than generate it: the
   chunk dimensions and sea level, the Phase 8 cave-entrance tuning, and the radial
   streaming budget with its load/unload hysteresis band.

   CHUNK_SX / SY / SZ ARE SAVE-ADJACENT. SAVE_CHUNK_VOXELS is their product and the save
   validator bounds an edit list against it, which is why this file has to load before
   src/persistence/save-schema.js.

   THE CAVE-MOUTH ROWS ARE OVERWORLD CONTENT TUNING and will follow the Overworld
   generator into src/dimensions/ in Era 1.5.3. They are here rather than there because
   moving them now would pre-empt that phase's split, and they are contiguous with the
   chunk constants in the source.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md and src/world/LAYER.md.
   ===================================================================================== */

const CHUNK_SX = 16, CHUNK_SY = 64, CHUNK_SZ = 16;
const WORLD_CHUNKS_X = 5, WORLD_CHUNKS_Z = 5; // legacy bootstrap footprint, spawn-centering only
const SEA_LEVEL = 22;

/* ---------------------------------------------------------------------------------
   PHASE 8 — CAVE ENTRANCE TUNING
   All values are flat constants; the pass adds no biomes, ores, mobs or materials.
   --------------------------------------------------------------------------------- */
const CAVE_MOUTH_SEED = 60817;         // fixed world seed for entrance placement
const CAVE_MOUTH_CHUNK_CHANCE = 0.35;  // candidate rate before the slope/height gates
// Measured against this terrain: an 8-block span has a median gradient of 1.4 and a
// 99th percentile of 4.5, so 2.6 selects roughly the steepest 10% of ground. Combined
// with the chance above this yields about one entrance per 29 chunks.
const CAVE_MOUTH_MIN_SLOPE = 2.6;      // required terrain gradient — hillsides only
const CAVE_MOUTH_SLOPE_SAMPLE = 4;     // blocks either side used to measure that slope
const CAVE_MOUTH_MIN_ABOVE_SEA = 3;    // keeps mouths from opening into lakes
const CAVE_MOUTH_MIN_Y = 6;            // tunnels stop descending here
const CAVE_MOUTH_STEP = 0.5;           // march resolution along the tunnel axis
const CAVE_MOUTH_LIP = 2.0;            // blocks carved outward of the site, forming the mouth
const CAVE_MOUTH_NIBBLE = 0.30;        // per-voxel wall irregularity (0 = smooth shell)
const CAVE_MOUTH_APRON = 3;            // exposed-rock radius beyond the mouth width
const CAVE_MOUTH_APRON_DENSITY = 0.85; // how solidly the apron fills in
const CAVE_MOUTH_BOWL_FRAC = 0.42;     // depression radius as a fraction of the apron
const CAVE_MOUTH_SPAWN_CLEAR = 48;     // no entrances within this radius of world spawn
const CAVE_MOUTH_REGION_MARGIN = 64;   // buffer around Farmlands / Suburbia / Fake Haven
// Blocks a cave mouth must never remove, whatever it overlaps.
const CAVE_MOUTH_NEVER_CARVE = new Set([
  BLOCK.SAFEHOUSE_ANCHOR, BLOCK.SOUL_ANCHOR, BLOCK.TREASURE_CHEST,
  BLOCK.TORCH, BLOCK.LANTERN, BLOCK.WATER, BLOCK.HAVEN_BARRIER,
]);

// RADIAL CHUNK STREAMING — chunks within CHUNK_LOAD_RADIUS (in chunk units) of the
// player are generated/meshed on demand as the player crosses chunk boundaries;
// chunks beyond CHUNK_UNLOAD_RADIUS get their GPU geometries/materials/collision
// data (chunk.data itself backs collision queries) instantly disposed to hold a
// locked 60 FPS. The gap between the two radii is a hysteresis band so chunks
// right at the boundary don't thrash load/unload every frame.
const CHUNK_LOAD_RADIUS = 8;
const CHUNK_UNLOAD_RADIUS = 10;
// Per-frame time budget (ms) for generating+meshing newly-entered chunks. Heightmap/
// cave noise sampling is batched through this budget across frames (an async batched
// task loop) instead of a Web Worker: chunk generation is tightly coupled to
// itemManager/anchorManager/decor-group/mimic-candidate state that isn't easily
// structured-clone-friendly, so a budgeted main-thread batch avoids frame-drop
// spikes without a risky worker-boundary rewrite of that coupling.
const CHUNK_GEN_FRAME_BUDGET_MS = 4;
// PHASE 11 — how strongly the stream queue favours chunks along the direction of
// travel. Expressed in the same units as squared chunk distance, so at the load
// radius of 8 (d2 = 64) a bonus of 6 reorders chunks about one ring apart without
// ever letting a distant chunk overtake a near one.
const CHUNK_STREAM_FORWARD_BIAS = 6;
