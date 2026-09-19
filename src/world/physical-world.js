"use strict";
/* =====================================================================================
   THE PHYSICAL WORLD — WHAT SHAPE IS THE WORLD HERE?
   ERA 2, PHASE E2.1 — NEW. This is the seam the non-voxel rebuild cuts along.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY IT EXISTS

   Gameplay asked the voxel engine voxel questions. `VoxelWorld.collidesAABB` floors an
   AABB to integer cells and tests block ids against per-shape rules; `findSpawnHeight`
   walks a column of cells downward; `_chunkReady` divided a world position by CHUNK_SX
   to ask whether a chunk was resident. Nine gameplay classes depended on that, directly.

   ERA 2 DELETES THE VOXEL ENGINE. Mesh terrain has no cells to floor an AABB into, no
   column to walk, and no chunk grid in those units. Every one of those call sites would
   have had to be found and rewritten during the terrain rebuild — which is the phase
   least able to absorb a second unrelated change (ROADMAP.md section 43).

   So the questions are asked in representation-neutral terms, and this file is the VOXEL
   ANSWER to them. Era 2 writes a second implementation over mesh terrain; gameplay does
   not change.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE CONTRACT — TEN READ-ONLY QUERIES

       collidesAABB(aabb)                        -> bool     the ONE collision query
       isSolid(x, y, z)                          -> bool     does this point block
       groundHeightAt(x, z)                      -> y        what a foot rests on
       waterLevelAt(x, y, z)                     -> 0|1|2    dry / wadeable / swimmable
       isResidentAround(minX, minZ, maxX, maxZ)  -> bool     is this footprint streamed in
       editEpoch()                               -> int|und  has the world changed since

       hasOpenSkyAbove(x, y, z)                  -> bool     nothing between here and sky
       lightLevelAt(x, y, z)                     -> 0..15    how lit this point is
       nearestLightSourceDistance(pos)           -> metres   Infinity when there is none
       isInsideSafeZone(pos)                     -> bool     an Anchor Monument's sanctuary
       isInsideSoulAnchorZone(pos)               -> bool     a placed Soul Anchor's

   EVERY ONE IS READ-ONLY. Nothing here writes, edits, streams, meshes or spawns. A
   caller that needs to CHANGE the world still talks to the world.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE LAST FIVE ARE ERA 1.5.6's, MOVED RATHER THAN DUPLICATED

   `SanityWorldView` asked exactly those five, for `SanitySystem`, and was the right shape
   for the wrong scope: the same questions were being asked by the player, the mobs, the
   items and the Stalker through the raw engine at the same time. Two views over one world
   is the duplication this file exists to avoid, so SanityWorldView is GONE and its
   contract is the second half of this one. `SanitySystem` is handed a PhysicalWorld and
   its five call sites did not change.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT IS DELIBERATELY NOT IN HERE, AND WHY

   RAYCAST. `voxelRaycast` returns `{ bx, by, bz, face }` — BLOCK COORDINATES AND A BLOCK
   FACE. A mesh world returns a point, a normal and a surface, which is a different type.
   Changing it means changing mining, placement, door toggling and the look-target prompt
   in the same phase that moves the collision seam, and ROADMAP.md section 43 says not to
   combine a risky architectural change with an unrelated gameplay redesign. The
   interaction model gets its own phase when it is rebuilt for meshes.

   BLOCK IDENTITY. `getBlockWorld` is a SEMANTIC read — what KIND of thing is this — not a
   physical one, and gameplay compares its result against BLOCK.* constants. That is the
   material/surface contract, and it is a different seam from this one. Era 1.5 already
   named where it lives: `AUDIO_SURFACE_OF` and `AudioDirector.surfaceAt()` (CLAUDE.md
   section 61).

   Neither omission is an oversight. Both are written down so a later phase does not have
   to rediscover the reasoning.

   ─────────────────────────────────────────────────────────────────────────────────────
   D1 PHASE 2 ANSWERED THE RAYCAST OMISSION, AND NOT BY CHANGING `voxelRaycast`

   The paragraph above is still true: `voxelRaycast` returns block coordinates and a block
   face, and mining, placement, door toggling and the look-target prompt all depend on that
   type. **All four are untouched, and so is `voxelRaycast` itself.**

   What Phase 2 added is a SECOND query — `raycast(origin, direction, maxDistance)` —
   returning the representation-neutral hit that `src/world/raycast.js` defines. This class
   implements it by ADAPTING the existing DDA rather than reimplementing one, which is the
   honest thing to do when a raycast concept already exists: the voxel world really does
   know where the ray meets a block, and the adapter's only job is to express that answer in
   the shared vocabulary.

   ONE LIMIT IS RECORDED RATHER THAN HIDDEN. `voxelRaycast` refines a hit against a shaped
   block's own boxes but returns only the cell and the face, discarding the exact `t` it
   computed. The adapter therefore recovers the distance by intersecting the ray with the
   hit CELL, which for a shaped block (a slab, a stair, a fence) is the cell's entry rather
   than the shape's. The face is exact; the distance can be up to one cell optimistic on a
   shaped block. That is correct for every full cube, it is bounded and known, and fixing it
   means changing `voxelRaycast`'s return type — which is precisely what this phase is
   forbidden to do. The voxel INTERACTION path does not use this method; it still calls
   `voxelRaycast` directly and is unaffected.

   ─────────────────────────────────────────────────────────────────────────────────────
   NO NUMBER IN HERE DECIDES ANYTHING

   This file OBTAINS values. Every rate, threshold, radius and rule stayed with the system
   that owns it. Era 2's implementation must return the same KIND of answer, not the same
   number — mesh ground is not at integer heights and is not supposed to be.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ERA2-PLAN.md section E2.1 and src/world/LAYER.md.
   ===================================================================================== */

class VoxelPhysicalWorld {
  constructor(world) {
    this.world = world;
  }

  /* ---- SHAPE ---------------------------------------------------------------------- */

  collidesAABB(aabb) {
    return this.world.collidesAABB(aabb);
  }

  isSolid(x, y, z) {
    return this.world.isSolid(x, y, z);
  }

  /* WAS `findSpawnHeight`, AND THE NAME WAS THE ONLY THING WRONG WITH IT. Eleven of its
     twelve call sites are not spawning anything — they are asking where the ground is, for
     a mob's feet, an animal's footing, a dropped item, a camera, a safe landing. A name
     that says "spawn" would have carried that confusion into Era 2, where the answer stops
     being an integer. The implementation is untouched. */
  groundHeightAt(x, z) {
    return this.world.findSpawnHeight(x, z);
  }

  waterLevelAt(x, y, z) {
    return this.world.waterLevelAt(x, y, z);
  }

  /* THE NORMALIZED RAYCAST — an ADAPTER over `voxelRaycast`, see the header.

     `voxelRaycast` is named from inside this function body rather than at load time, which
     is the module rule that lets a `src/` file reach a name the monolith declares later
     (ARCHITECTURE.md section 0). Nothing is reimplemented here. */
  raycast(origin, direction, maxDistance) {
    const hit = voxelRaycast(this.world, origin, direction, maxDistance);
    if (!hit) return RAYCAST_MISS;

    /* The cell the DDA stopped in, as a world-space box. */
    const cell = { minX: hit.bx, minY: hit.by, minZ: hit.bz,
                   maxX: hit.bx + 1, maxY: hit.by + 1, maxZ: hit.bz + 1 };
    let t = rayAabbDistance(origin.x, origin.y, origin.z,
                            direction.x, direction.y, direction.z, cell, maxDistance);
    if (t === null) t = 0;                   // the ray began inside the cell

    /* The face `voxelRaycast` already resolved — exact, including for shaped blocks. */
    const f = hit.face;
    const normal = (f && (f[0] || f[1] || f[2])) ? { x: f[0], y: f[1], z: f[2] } : null;

    return makeRayHit(
      t,
      { x: origin.x + direction.x * t, y: origin.y + direction.y * t,
        z: origin.z + direction.z * t },
      normal,
      RAYCAST_CATEGORY.TERRAIN,
      null,
      null,
    );
  }

  /* IS THIS FOOTPRINT STREAMED IN? Asked in WORLD UNITS, not chunk units.

     ItemEntity._chunkReady used to divide the item's own footprint by CHUNK_SX/CHUNK_SZ
     and ask the engine for each chunk, because an unloaded chunk answers AIR for every
     voxel and an integrating item read "nothing under me" and fell through the world. The
     question is real and survives Era 2; the chunk arithmetic does not. */
  isResidentAround(minX, minZ, maxX, maxZ) {
    const w = this.world;
    if (!w.getChunk) return true;
    const x0 = Math.floor(minX / CHUNK_SX), x1 = Math.floor(maxX / CHUNK_SX);
    const z0 = Math.floor(minZ / CHUNK_SZ), z1 = Math.floor(maxZ / CHUNK_SZ);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++)
        if (!w.getChunk(cx, cz)) return false;
    return true;
  }

  /* HAS THE WORLD CHANGED SINCE I LAST ASKED?

     A resting item re-probes the surface under it only when this number moves, which is
     what makes an exact collision probe cheaper than the inexact scan it replaced. Every
     mutation bumps it — mining, placing, water flow — so the cache can never miss a
     change. `undefined` means "cannot tell", and the caller must then assume it changed;
     that is the behaviour of the raw field this replaces and it is preserved exactly. */
  editEpoch() {
    return this.world.worldEdits;
  }

  /* ---- ILLUMINATION AND EXPOSURE (Era 1.5.6's SanityWorldView, unchanged) ---------- */

  lightLevelAt(x, y, z) {
    return this.world.getLightWorld(x, y, z);
  }

  hasOpenSkyAbove(x, y, z) {
    return this.world.hasSkyAbove(x, y, z);
  }

  /* The engine keeps its light sources in a Map keyed by cell. The ITERATION is the part
     that leaked — a consumer should ask for a distance, not walk a collection it does not
     own. Returns Infinity when there are none, which is what the inline loops it replaced
     returned and what every 6-metre test expects. */
  nearestLightSourceDistance(pos) {
    const lights = this.world.torchLights;
    if (!lights) return Infinity;
    let best = Infinity;
    for (const light of lights.values()) {
      const d = light.position.distanceTo(pos);
      if (d < best) best = d;
    }
    return best;
  }

  /* ---- SANCTUARY — gameplay, forwarded ------------------------------------------- */

  isInsideSafeZone(pos) {
    const mgr = this.world.anchorManager;
    return !!(mgr && mgr.isInsideSafeZone(pos));
  }

  isInsideSoulAnchorZone(pos) {
    return !!(this.world.isInsideSoulAnchorZone && this.world.isInsideSoulAnchorZone(pos));
  }
}
