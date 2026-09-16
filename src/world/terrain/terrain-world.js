"use strict";
/* =====================================================================================
   D1 — THE TERRAIN WORLD
   ERA 2, PHASE E2.2 — NEW. The composition of everything else in this directory.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT THIS IS, AND — IMPORTANTLY — WHAT IT IS NOT YET

   `D1TerrainWorld` is a complete, finite, non-voxel world foundation: it generates, it
   streams, it collides, it answers every query the E2.1 contract asks, and it disposes
   what it owns. It runs. A player can stand on it and walk across it, and
   `tests/browser-terrain.js` does exactly that in a real browser.

   **IT IS NOT THE LIVE D1 YET, AND THAT IS DELIBERATE.**

   The playable chain — Overworld → Farmlands → Suburbia → Haven → finale — still runs on
   the Era 1 voxel implementation. Swapping it now would take out the Phase 20 journey, the
   Disconnected Home, the guaranteed Level 2 Core Disk and the two rift crossings, all of
   which are covered by suites that walk a real New Game to the credits. The brief for this
   phase requires that existing gameplay remain functional, and ROADMAP section 43 forbids
   combining a risky architectural change with an unrelated gameplay redesign.

   So this world is built, tested and measured **in parallel**, and the dimension swap is
   the job of the phase that has landmarks to put in it. That is the honest classification:
   FOUNDATION, COMPLETE AND NOT YET LIVE. See ARCHITECTURE.md section 4.10.

   ─────────────────────────────────────────────────────────────────────────────────────
   IT OWNS ITS SCENE CONTENTS AND GIVES THEM BACK

   `dispose()` unloads every region, frees every geometry it built, removes every object it
   added, and — only when asked to shut down for good — frees the shared materials. It does
   not free anything the E2.0a asset library owns; it releases, and the library's reference
   counting decides.

   CLASSIC script. See src/world/terrain/LAYER.md.
   ===================================================================================== */

class D1TerrainWorld {
  /* `scene` is the THREE.Scene to build into. `assets` is the E2.0a AssetLibrary or null.
     `assetCollision` is the E2.0a AssetCollisionSet or null — shared with the physical
     world so authored structures collide through the proxies E2.0a already built. */
  constructor(scene, assets, assetCollision) {
    this.scene = scene;
    /* The collision set is SHARED with the physical world rather than owned twice, so an
       authored structure placed through the E2.0a library collides for gameplay and for
       the streamer with one registration. A caller that has one passes it; a caller that
       does not gets a private one, and the terrain still works with no assets at all. */
    this.assetCollision = assetCollision || new AssetCollisionSet();
    this.regions = new D1TerrainRegions(scene, assets, this.assetCollision);
    this.physical = new TerrainPhysicalWorld(this.regions);
    this.active = false;
  }

  /* ---- LIFECYCLE ------------------------------------------------------------------- */

  /* Bring the world up around a point and return the spawn position. Builds the regions
     immediately rather than over frames, because an arrival must not show the player a
     hole where the ground is. */
  begin(x, z) {
    this.active = true;
    /* A generous budget for the first frame only: this is a loading moment, not a
       steady-state one, and the alternative is visible pop-in at the arrival point. */
    this.regions.update(x, z, 5000);
    return this.spawnPointAt(x, z);
  }

  /* A standing position on the surface at (x, z), with the player's feet on the ground.
     Continuous — there is no column to find the top of. */
  spawnPointAt(x, z) {
    const clamped = d1ClampToWorld(x, z);
    const y = this.physical.groundHeightAt(clamped.x, clamped.z);
    return { x: clamped.x, y: y + 0.05, z: clamped.z, clamped: clamped.clamped };
  }

  /* The default arrival point: the centre of the map. NOT an authored spawn — where the
     player actually enters D1 is a creative decision tied to the journey, and the centre is
     simply the middle of a rectangle. */
  defaultSpawn() { return this.spawnPointAt(0, 0); }

  update(viewX, viewZ, budgetMs) {
    if (!this.active) return 0;
    return this.regions.update(viewX, viewZ, budgetMs);
  }

  /* Unload everything this world put in the scene. `full` also frees the SHARED materials,
     which is correct only when the dimension is being shut down for good — an ordinary
     unload must leave them alone or every other user loses them. */
  dispose(full) {
    const regions = this.regions.unloadAll();
    let materials = 0;
    if (full) materials = d1DisposeTerrainMaterials();
    this.active = false;
    return { regions, materials };
  }

  /* ---- REPORTING -------------------------------------------------------------------- */

  /* Everything a phase report, a browser test or a developer overlay wants, in one call.
     Honest about stage: nothing here claims to be production. */
  debugReport() {
    return {
      world: {
        sizeMetres: D1_WORLD_SIZE,
        bounds: { minX: D1_WORLD_MIN_X, maxX: D1_WORLD_MAX_X,
                  minZ: D1_WORLD_MIN_Z, maxZ: D1_WORLD_MAX_Z },
        regionSize: D1_REGION_SIZE,
        regionGrid: D1_REGION_GRID,
        totalRegions: D1_REGION_GRID * D1_REGION_GRID,
        finite: true,
        verticalBudget: { min: D1_MIN_Y, max: D1_MAX_Y },
        edgeMargin: D1_EDGE_MARGIN,
      },
      streaming: this.regions.debugReport(),
      materials: terrainMaterialStatus(),
      scatter: terrainScatterStatus(),
      authoring: terrainAuthoringStatus(),
      roads: { authored: D1_ROAD_NETWORK.length, active: d1RoadNetwork().length },
      stage: 'FOUNDATION — runs, streams, collides. NOT the live D1 dimension.',
    };
  }
}
