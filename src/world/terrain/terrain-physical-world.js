"use strict";
/* =====================================================================================
   D1 TERRAIN — THE PHYSICAL WORLD IMPLEMENTATION
   ERA 2, PHASE E2.2 — NEW. **This is what E2.1 was built for.**

   ─────────────────────────────────────────────────────────────────────────────────────
   THE SECOND IMPLEMENTATION OF THE CONTRACT, AND THE FIRST ONE OVER MESH TERRAIN

   `src/world/physical-world.js` says, in its header: "Era 2 writes a second implementation
   over mesh terrain; gameplay does not change." This is that file. Every one of the eleven
   queries is answered here from the heightfield, with no voxel anywhere:

       collidesAABB · isSolid · groundHeightAt · waterLevelAt · isResidentAround
       editEpoch · hasOpenSkyAbove · lightLevelAt · nearestLightSourceDistance
       isInsideSafeZone · isInsideSoulAnchorZone

   `tests/terrain.js` compares this class's method list against the voxel implementation's
   and fails if either grows a query the other lacks — so the two cannot drift apart
   silently, which is the only way a "contract" is worth the word.

   ─────────────────────────────────────────────────────────────────────────────────────
   GROUND HEIGHT IS CONTINUOUS, AND THE CALLERS ARE THE REMAINING QUANTISER

   `groundHeightAt(x, z)` here returns a REAL number: the terrain function evaluated at the
   exact point. Nothing is rounded and nothing is snapped.

   **But ten call sites in the build floor their arguments** — `groundHeightAt(Math.floor(x),
   Math.floor(z))` — seven in game.html, one in dev-tools, two in save-lifecycle. Against
   the voxel world that is CORRECT and costs nothing, because the voxel answer is per
   integer column anyway. Against this implementation it quantises a continuous surface to
   a 1 m grid and reintroduces stepping through the caller rather than the terrain.

   **E2.2 DOES NOT CHANGE THEM.** They are legacy voxel gameplay, they are right for the
   world they currently serve, and rewriting live movement code in the phase that
   introduces a parallel terrain would be exactly the "two unrelated risky changes in one
   phase" ROADMAP section 43 forbids. What E2.2 does instead is MEASURE the consequence —
   `tests/terrain.js` reports the mean and worst-case error flooring introduces on this
   terrain — so the phase that makes this world live inherits a number rather than an
   argument. See ARCHITECTURE.md section 4.10.

   ─────────────────────────────────────────────────────────────────────────────────────
   COLLISION IS A HEIGHTFIELD TEST, NOT A MESH TEST, AND THAT IS A MEASURED CHOICE

   The visual mesh is the wrong collision representation here and it is worth saying why
   rather than asserting it: it has 32,768 triangles per region at the near LOD, it CHANGES
   with distance, and it is regenerated on every LOD swap. Colliding against it would make
   the ground's physical shape depend on where the camera is.

   Against a heightfield the same query is a handful of height samples and a comparison,
   it is exact, and it is identical at every LOD and whether or not the region is resident.
   For terrain that is a height function this is not an optimisation, it is the correct
   representation. Authored structures are a different problem and get the asset collision
   proxies E2.0a already built.

   CLASSIC script. See src/world/terrain/LAYER.md.
   ===================================================================================== */

/* How densely an AABB's footprint is probed. 0.5 m is half the player's half-width, so no
   feature narrower than the player can slip between samples; the corners and centre are
   always included regardless. Raising this is cheap and lowering it is wrong. */
const D1_COLLIDE_PROBE_STEP = 0.5;

class TerrainPhysicalWorld {
  /* `regions` is the streaming manager, or null. It is used ONLY to answer
     `isResidentAround` and to reach placed asset colliders — never to find the ground,
     which is why terrain queries work perfectly on a world with nothing streamed in and
     why a test can ask about a point on the far side of the map without loading it. */
  constructor(regions) {
    this.regions = regions || null;
    /* Authored zones that grant sanctuary. Empty in E2.2: the Anchor Monument is Era 1
       progression and whether D1 keeps it is a creative decision. The queries answer
       honestly rather than pretending. */
    this.safeZones = [];
    this._epoch = 0;
  }

  /* ---- SHAPE ---------------------------------------------------------------------- */

  /* THE ONE COLLISION QUERY. True when any part of the box is under the ground surface.

     Probing the footprint rather than testing the centre is what makes a slope solid: a
     player walking into a bank is stopped by the bank's height at the FAR edge of their
     box, not at their middle, which is the difference between climbing a hill and sinking
     into it. */
  collidesAABB(aabb) {
    const { minX, maxX, minY, minZ, maxZ } = aabb;
    const step = D1_COLLIDE_PROBE_STEP;

    for (let x = minX; ; x += step) {
      const px = Math.min(x, maxX);
      for (let z = minZ; ; z += step) {
        const pz = Math.min(z, maxZ);
        if (d1TerrainHeight(px, pz) > minY) return true;
        if (pz >= maxZ) break;
      }
      if (px >= maxX) break;
    }

    /* Authored structures, through the E2.0a proxy set. Terrain is the ground; a building
       is an asset with a declared collision proxy, and neither knows about the other. */
    if (this.regions && this.regions.assetCollision &&
        this.regions.assetCollision.collidesAABB(aabb)) return true;

    return false;
  }

  isSolid(x, y, z) {
    if (y < d1TerrainHeight(x, z)) return true;
    if (this.regions && this.regions.assetCollision &&
        this.regions.assetCollision.isSolid(x, y, z)) return true;
    return false;
  }

  /* CONTINUOUS. A real number, exact at the point asked, at any resolution, resident or
     not. Where an authored structure stands higher than the ground, the structure wins —
     a floor is what you stand on. */
  groundHeightAt(x, z) {
    const terrain = d1TerrainHeight(x, z);
    if (this.regions && this.regions.assetCollision) {
      const onAsset = this.regions.assetCollision.groundHeightAt(x, z);
      if (onAsset !== null && onAsset > terrain) return onAsset;
    }
    return terrain;
  }

  /* 0 dry / 1 wadeable / 2 swimmable, matching the voxel implementation's tri-state
     exactly — the callers compare against those three values and the contract's meaning
     must not shift because the representation did. The thresholds are the player's own
     proportions rather than block counts. */
  waterLevelAt(x, y, z) {
    const surface = D1_WATER_LEVEL;
    if (y >= surface) return 0;
    const ground = d1TerrainHeight(x, z);
    if (ground >= surface) return 0;
    return (surface - Math.max(y, ground)) >= 1.4 ? 2 : 1;
  }

  /* Is this footprint streamed in? For terrain the honest answer is that the GROUND is
     always known — it is a function, not data — so a query never falls through the world
     the way an unloaded voxel chunk let a dropped item fall. Residency is still reported
     truthfully for anything that depends on a region's CONTENTS being present. */
  isResidentAround(minX, minZ, maxX, maxZ) {
    if (!this.regions) return true;
    return this.regions.isResidentAround(minX, minZ, maxX, maxZ);
  }

  /* Terrain is generated, never edited — there is no block to break and no player editing
     in the final D1. The epoch therefore never moves, which is the correct answer and not
     a stub: a resting-item cache keyed on it simply never invalidates, because the ground
     under the item genuinely cannot change. */
  editEpoch() { return this._epoch; }

  /* ---- ILLUMINATION AND EXPOSURE -------------------------------------------------- */

  /* Open sky above a point. Terrain is a heightfield, so the only thing that can occlude
     the sky is an authored structure, and none exist yet. */
  hasOpenSkyAbove(x, y, z) {
    return d1HasSkyAbove(x, y, z);
  }

  /* DELIBERATELY NOT IMPLEMENTED FROM A LIGHT GRID, AND THIS IS A DEFERRAL.

     The voxel world propagates light through a per-cell grid and returns 0..15. Mesh
     terrain has no cells, and the real answer for Era 2 is the D1 lighting model — sun and
     moon elevation, overcast, the flashlight — which is E2.5's and E2.6's work and is
     explicitly out of scope here.

     So this returns the daylight term only, on the same 0..15 scale the contract promises,
     and it is honest about being partial rather than inventing a lighting system in a
     terrain phase. `daylight` is set by whoever owns the sky. */
  lightLevelAt(x, y, z) {
    const day = this.daylight === undefined ? 1 : this.daylight;
    return Math.round(Math.min(1, Math.max(0, day)) * 15);
  }

  /* No placed light sources exist in D1 yet. Infinity is what the voxel implementation
     returns when there are none, and it is what every 6-metre proximity test expects. */
  nearestLightSourceDistance(pos) {
    return Infinity;
  }

  /* ---- SANCTUARY ------------------------------------------------------------------- */

  isInsideSafeZone(pos) {
    for (const z of this.safeZones) {
      const dx = pos.x - z.x, dz = pos.z - z.z;
      if (dx * dx + dz * dz <= z.radius * z.radius) return true;
    }
    return false;
  }

  /* Soul Anchors are an Era 1 placeable and D1 has none. False, honestly. */
  isInsideSoulAnchorZone(pos) { return false; }
}
