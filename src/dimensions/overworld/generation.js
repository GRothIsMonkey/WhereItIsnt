"use strict";
/* =====================================================================================
   THE OVERWORLD — WHAT IS THERE, AND WHERE
   ERA 1.5.3 — MOVED VERBATIM OUT OF VoxelWorld.

   Terrain sampling, cave-mouth site selection and the decor pass. The legacy Era 1
   starting dimension: stable technical id 1, and deliberately NOT the canon's creative
   D1 — see src/dimensions/dimension-descriptors.js.

   ROADMAP.md schedules this dimension for replacement in Era 2. It is extracted here so
   that replacing it is deleting a directory rather than picking it out of the engine.

   Every method below is byte-identical to the text that was in game.html, comments and
   all. It is attached to VoxelWorld's prototype by registerWorldContent, which copies
   property descriptors so a moved method is indistinguishable from a declared one.
   See src/world/world-content.js and ARCHITECTURE.md.
   ===================================================================================== */

registerWorldContent('overworld', 'generation', class {

  // Replicates _generateTerrain's height formula for a single (wx,wz) column
  // without needing that chunk generated yet — lets fixed-coordinate structures
  // (like the Disconnected Home below) sit flush with normal terrain height.
  _overworldHeightAt(wx, wz) {
    const raw = this.noise.fbm2(wx * 0.018, wz * 0.018, 3, 2.0, 0.45);
    const shaped = raw < 0 ? raw * 0.35 : raw * 0.7;
    return 24 + Math.floor(shaped * 10);
  }

  /* ---------------------------------------------------------------------------------
     PHASE 8 — NATURAL CAVE ENTRANCES

     A controlled post-pass over the ordinary overworld terrain. It does not touch the
     terrain generator itself, add biomes/ores, or alter the existing 3D worm caves —
     it only opens a small number of mouths that connect the surface to the cave space
     already generated underneath.

     DETERMINISM AND SEAMS. Every cave mouth is owned by one chunk coordinate, but its
     geometry routinely spills across chunk borders. So each generating chunk examines
     the 3x3 block of chunk coordinates around itself, resolves each neighbour's site
     from a pure hash of that chunk's coordinates, and carves only the voxels that fall
     inside ITSELF. Because a site's parameters depend on nothing but its own chunk
     coords and the world seed, every chunk overlapping a mouth carves an identical
     portion of it, in any load order — so there are no seams and no dependence on
     which chunk streamed in first. All per-voxel variation likewise hashes WORLD
     coordinates, never a per-chunk running RNG, for the same reason.

     PLAYER EDITS. This runs inside _generateChunk BEFORE editedChunks is reapplied, so
     anything the player has built or mined always overrides a cave mouth.
     --------------------------------------------------------------------------------- */

  // Deterministic 0..1 hash from integer world coordinates.
  _cmHash(a, b, c) {
    let s = ((a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 2147483647 + CAVE_MOUTH_SEED) >>> 0;
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return (s % 100000) / 100000;
  }

  /* Mirrors _generateTerrain's cave test exactly, but for an arbitrary world point
     without needing that chunk generated. Used to steer a tunnel toward real cave
     space and to know when it has broken through. */
  _isCaveAt(wx, y, wz) {
    const h = this._overworldHeightAt(wx, wz);
    if (!(y < 32 && y > 2 && y < h - 3)) return false;
    const caveVal = this.caveNoise.noise3D(wx * 0.085, y * 0.085, wz * 0.085);
    return (1 - Math.abs(caveVal)) > 0.89;
  }

  /* SAFETY GATE. Keeps mouths out of the spawn bowl and every scripted pocket region
     (with a margin), so they can never eat a dimension's terrain or its entrances. */
  _isCaveMouthProtected(wx, wz) {
    const sx = WORLD_CHUNKS_X * CHUNK_SX / 2, sz = WORLD_CHUNKS_Z * CHUNK_SZ / 2;
    if (Math.hypot(wx - sx, wz - sz) < CAVE_MOUTH_SPAWN_CLEAR) return true;
    const M = CAVE_MOUTH_REGION_MARGIN;
    const inRegion = (offC, spanC) => {
      const min = offC * CHUNK_SX - M;
      const max = offC * CHUNK_SX + spanC * CHUNK_SX + M;
      return wx >= min && wx < max && wz >= min && wz < max;
    };
    if (inRegion(FARMLANDS_CHUNK_OFFSET, FARMLANDS_CHUNKS_SPAN)) return true;
    if (inRegion(SUBURBIA_CHUNK_OFFSET, SUBURBIA_CHUNKS_SPAN)) return true;
    if (inRegion(FAKE_HAVEN_CHUNK_OFFSET, FAKE_HAVEN_CHUNKS_SPAN)) return true;
    return false;
  }

  /* Resolves whether the chunk at (scx, scz) owns a cave mouth, and with what shape.
     Pure function of the chunk coords + world seed — no chunk data is read. */
  _caveMouthSiteAt(scx, scz) {
    if (this._cmHash(scx, scz, 7) > CAVE_MOUTH_CHUNK_CHANCE) return null;

    const lx = 3 + Math.floor(this._cmHash(scx, scz, 11) * (CHUNK_SX - 6));
    const lz = 3 + Math.floor(this._cmHash(scx, scz, 13) * (CHUNK_SZ - 6));
    const wx = scx * CHUNK_SX + lx, wz = scz * CHUNK_SZ + lz;
    if (this._isCaveMouthProtected(wx, wz)) return null;

    // Must sit clear of the waterline, or the mouth would open into a lake.
    const h = this._overworldHeightAt(wx, wz);
    if (h < SEA_LEVEL + CAVE_MOUTH_MIN_ABOVE_SEA) return null;

    /* Entrances belong in hillsides, so the site is rejected unless the local terrain
       gradient is steep enough. This is also what makes them feel placed rather than
       scattered: flat ground never gets one. */
    const S = CAVE_MOUTH_SLOPE_SAMPLE;
    const gx = this._overworldHeightAt(wx + S, wz) - this._overworldHeightAt(wx - S, wz);
    const gz = this._overworldHeightAt(wx, wz + S) - this._overworldHeightAt(wx, wz - S);
    const slope = Math.hypot(gx, gz);
    if (slope < CAVE_MOUTH_MIN_SLOPE) return null;

    // Tunnel drives INTO the hill (uphill); the mouth therefore faces downhill.
    const inv = 1 / slope;
    const inX = gx * inv, inZ = gz * inv;

    // Archetype. Weights chosen so the dramatic ones stay rare.
    const r = this._cmHash(scx, scz, 17);
    let type, rw, rh, depth, drop, sink;
    if (r < 0.34) {            // small crack — easy to miss, rewarding to spot
      type = 'crack';
      rw = 1.0 + this._cmHash(scx, scz, 23) * 0.5;
      rh = 2.2 + this._cmHash(scx, scz, 29) * 0.9;
      depth = 7 + Math.floor(this._cmHash(scx, scz, 31) * 5);
      drop = 0.55; sink = 0.0;
    } else if (r < 0.66) {     // medium opening — the workhorse
      type = 'medium';
      rw = 1.8 + this._cmHash(scx, scz, 23) * 0.7;
      rh = 2.0 + this._cmHash(scx, scz, 29) * 0.7;
      depth = 9 + Math.floor(this._cmHash(scx, scz, 31) * 6);
      drop = 0.50; sink = 0.2;
    } else if (r < 0.86) {     // large overhang — wide and low, with rock left above
      type = 'overhang';
      rw = 3.0 + this._cmHash(scx, scz, 23) * 1.2;
      rh = 1.7 + this._cmHash(scx, scz, 29) * 0.6;
      depth = 6 + Math.floor(this._cmHash(scx, scz, 31) * 4);
      drop = 0.38; sink = 1.4;   // sunk under the slope so the hillside forms the lip
    } else {                   // shallow stone hollow — an alcove, often a dead end
      type = 'hollow';
      rw = 2.4 + this._cmHash(scx, scz, 23) * 0.9;
      rh = 1.8 + this._cmHash(scx, scz, 29) * 0.6;
      depth = 3 + Math.floor(this._cmHash(scx, scz, 31) * 3);
      drop = 0.15; sink = 0.6;
    }

    return { wx, wz, h, inX, inZ, type, rw, rh, depth, drop, sink, scx, scz };
  }

  /* Carves every mouth in the 3x3 chunk neighbourhood, clipped to this chunk. */
  _generateCaveMouths(chunk) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const site = this._caveMouthSiteAt(chunk.cx + dx, chunk.cz + dz);
        if (site) this._carveCaveMouth(chunk, site);
      }
    }
  }

  /* THE OVERWORLD SURFACE, AS A PURE FUNCTION OF POSITION (PHASE 31).

     `y` of the first air block above the ground — precisely the number _generateTerrain
     computes for each of its columns, factored out so that a structure spanning chunks
     can ask about a column belonging to a chunk that does not exist yet. That is the
     same service _farmHeightAt has provided the Farmlands since Phase 16, and its
     absence is why nothing in the Overworld has ever been able to stamp across a chunk
     border. Phase 31's stampers are the first callers. The extraction is behaviour-
     preserving by construction and regression.js proves the terrain is byte-identical. */
  _overworldSurfaceY(wx, wz) {
    // FLATTER SURFACE NOISE: lower frequency + fewer octaves than the original reads as
    // gentle rolling hills instead of steep jagged peaks. The raw fbm is then
    // asymmetrically compressed — the below-midline half (valley floors) is squashed
    // much harder than the above-midline half (hill crests) — so low ground flattens out
    // into spacious building zones while hills still get to roll softly.
    const raw = this.noise.fbm2(wx * 0.018, wz * 0.018, 3, 2.0, 0.45);
    const shaped = raw < 0 ? raw * 0.35 : raw * 0.7;
    return 24 + Math.floor(shaped * 10);
  }
});
