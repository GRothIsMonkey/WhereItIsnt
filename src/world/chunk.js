"use strict";
/* =====================================================================================
   Chunk — THE ENGINE'S STORAGE UNIT
   ERA 1.5.3 — MOVED VERBATIM OUT OF game.html.

   One 16x256x16 column of voxels as a Uint16Array, plus the three mesh handles the
   renderer hangs on it. It knows the world it belongs to only so that a read outside its
   own bounds can be answered by the neighbour; it knows nothing about any dimension, any
   structure, or what any id means.

   It lives beside VoxelWorld because it is the engine, not the content — and because
   `edit()` is the only write path in the build (see LAYER.md), and this is the array that
   path writes into.

   Byte-identical to the text that was in game.html.
   ===================================================================================== */

class Chunk {
  constructor(cx, cz, world) {
    this.cx = cx; this.cz = cz; this.world = world;
    /* PHASE 14 — sixteen bits per voxel instead of eight. See BLOCK_ID_COUNT: the
       interior vocabulary needs several hundred ids and the byte was full. Nothing else
       about the chunk changes — same layout, same indexing, same streaming, same edit
       records, same disposal. */
    this.data = new Uint16Array(CHUNK_SX * CHUNK_SY * CHUNK_SZ);
    this.mesh = null;
    this.waterMesh = null;
    // LEVEL 4 (PHASE 5A PART 3) — separate transparent pass for HAVEN_GLASS panes.
    this.glassMesh = null;
    this.dirty = true;
  }
  idx(x, y, z) { return (y * CHUNK_SZ + z) * CHUNK_SX + x; }
  get(x, y, z) {
    if (x < 0 || x >= CHUNK_SX || y < 0 || y >= CHUNK_SY || z < 0 || z >= CHUNK_SZ) {
      return this.world.getBlockWorld(this.cx * CHUNK_SX + x, y, this.cz * CHUNK_SZ + z);
    }
    return this.data[this.idx(x, y, z)];
  }
  set(x, y, z, id) {
    if (x < 0 || x >= CHUNK_SX || y < 0 || y >= CHUNK_SY || z < 0 || z >= CHUNK_SZ) return;
    this.data[this.idx(x, y, z)] = id;
    this.dirty = true;
  }
}
