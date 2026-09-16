"use strict";
/* =====================================================================================
   D1 TERRAIN — FINITE REGION STREAMING
   ERA 2, PHASE E2.2 — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   STREAMING A FINITE WORLD IS A DIFFERENT PROBLEM FROM STREAMING AN INFINITE ONE

   The voxel streamer walks a radius around the player and generates whatever it finds,
   because there is always more. This one walks a radius and INTERSECTS IT WITH A FIXED
   GRID OF 256 REGIONS. At the map edge the ring is simply shorter; there is no wrapping,
   no generation past the boundary, and no chunk coordinate that does not exist.

   `d1AllRegions()` returns 256 entries and terminates, and `tests/terrain.js` asserts that
   the streamer never produces a region outside the grid however far outside the world the
   viewpoint is put. That assertion is the practical definition of "this world is finite".

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT A REGION OWNS, AND THEREFORE WHAT IT MUST GIVE BACK

   OWNS (freed on unload): its terrain BufferGeometry, its water BufferGeometry, its two
   Meshes, and the scatter instance data it built.

   DOES NOT OWN (never freed on unload): the shared terrain material, the shared water
   material, and any GLB the asset library loaned it. E2.0a's library is reference counted
   precisely so a region can hand instances back without deciding whether anyone else still
   needs the source — `release()` decides, and a region calls it rather than disposing.

   Disposing a shared material because one of its users went away is the bug that reference
   counting exists to prevent, and `tests/browser-terrain.js` measures it directly: the
   shared material's uuid is captured before a full unload cycle and asserted still alive
   and still the same object afterwards.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE BUDGET IS PER FRAME AND IT IS NOT A TIMER

   `update()` builds regions until it has spent D1_STREAM_BUDGET_MS, then stops and
   continues next frame. Nothing here schedules: there is no setTimeout, no interval, and
   no queue that drains on its own — which is why a test can drive a hundred frames in a
   loop and why nothing can leak. Same rule CLAUDE.md section 61 put on the audio director.

   CLASSIC script. See src/world/terrain/LAYER.md.
   ===================================================================================== */

class D1TerrainRegions {
  /* `scene` is where meshes go. `assets` is the E2.0a AssetLibrary, or null — regions do
     not require it and the terrain works without a single GLB. `assetCollision` is the
     E2.0a proxy set, shared with the physical world so authored structures collide. */
  constructor(scene, assets, assetCollision) {
    this.scene = scene;
    this.assets = assets || null;
    this.assetCollision = assetCollision || null;

    this.regions = new Map();      // key -> region record
    this.stats = {
      built: 0, unloaded: 0, rebuiltForLod: 0,
      geometriesAlive: 0, peakResident: 0, buildMs: 0,
    };
    this._pending = [];
    this._lastViewKey = null;
  }

  get residentCount() { return this.regions.size; }

  /* ---- THE FRAME ------------------------------------------------------------------- */

  /* Bring the world up to date around a viewpoint. Called once per frame with the camera
     position; safe to call with the same position repeatedly, which is what makes it
     drivable from a test. */
  update(viewX, viewZ, budgetMs) {
    const budget = budgetMs === undefined ? D1_STREAM_BUDGET_MS : budgetMs;
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    this._unloadFar(viewX, viewZ);
    this._collectWanted(viewX, viewZ);

    let built = 0;
    while (this._pending.length) {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (built > 0 && now - t0 >= budget) break;
      const job = this._pending.shift();
      if (job.lodOnly) this._rebuildLod(job.rx, job.rz, job.spacing);
      else this._build(job.rx, job.rz, job.spacing);
      built++;
    }

    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.stats.buildMs += (t1 - t0);
    if (this.regions.size > this.stats.peakResident) this.stats.peakResident = this.regions.size;
    return built;
  }

  /* Which regions should exist, and at what LOD. Intersects the load radius with the FIXED
     grid — the loop bounds are clamped to the grid, so a viewpoint outside the world
     produces a shorter list and never an out-of-range region. */
  _collectWanted(viewX, viewZ) {
    this._pending.length = 0;
    const r = D1_STREAM_LOAD_RADIUS;
    const lo = d1RegionIndexAt(viewX - r, viewZ - r);
    const hi = d1RegionIndexAt(viewX + r, viewZ + r);

    const rx0 = Math.max(0, lo.rx), rx1 = Math.min(D1_REGION_GRID - 1, hi.rx);
    const rz0 = Math.max(0, lo.rz), rz1 = Math.min(D1_REGION_GRID - 1, hi.rz);

    const jobs = [];
    for (let rz = rz0; rz <= rz1; rz++) {
      for (let rx = rx0; rx <= rx1; rx++) {
        if (!d1RegionExists(rx, rz)) continue;
        const b = d1RegionBounds(rx, rz);
        const dx = Math.max(b.minX - viewX, 0, viewX - b.maxX);
        const dz = Math.max(b.minZ - viewZ, 0, viewZ - b.maxZ);
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > r) continue;

        const spacing = d1RegionLod(rx, rz, viewX, viewZ);
        const key = d1RegionKey(rx, rz);
        const have = this.regions.get(key);
        if (!have) jobs.push({ rx, rz, spacing, dist, lodOnly: false });
        else if (have.spacing !== spacing) jobs.push({ rx, rz, spacing, dist, lodOnly: true });
      }
    }
    /* Nearest first: the ground under the player's feet matters more than the horizon. */
    jobs.sort((a, b2) => a.dist - b2.dist);
    this._pending = jobs;
  }

  _unloadFar(viewX, viewZ) {
    const r = D1_STREAM_UNLOAD_RADIUS;
    for (const [key, region] of Array.from(this.regions.entries())) {
      const b = d1RegionBounds(region.rx, region.rz);
      const dx = Math.max(b.minX - viewX, 0, viewX - b.maxX);
      const dz = Math.max(b.minZ - viewZ, 0, viewZ - b.maxZ);
      if (Math.sqrt(dx * dx + dz * dz) > r) this._unload(key);
    }
  }

  /* ---- BUILD AND FREE --------------------------------------------------------------- */

  _build(rx, rz, spacing) {
    const key = d1RegionKey(rx, rz);
    if (this.regions.has(key)) return this.regions.get(key);

    const geo = d1BuildRegionGeometry(rx, rz, spacing);
    const mesh = new THREE.Mesh(geo, d1TerrainMaterial());
    mesh.matrixAutoUpdate = false;        // vertices are already world-space
    mesh.receiveShadow = true;
    mesh.castShadow = false;              // terrain casting onto itself costs and gains little
    mesh.name = 'd1-region-' + key;
    this.scene.add(mesh);

    let waterMesh = null;
    const waterGeo = d1BuildRegionWater(rx, rz);
    if (waterGeo) {
      waterMesh = new THREE.Mesh(waterGeo, d1WaterMaterial());
      waterMesh.matrixAutoUpdate = false;
      waterMesh.name = 'd1-water-' + key;
      this.scene.add(waterMesh);
    }

    const scatter = d1BuildRegionScatter(rx, rz, this.scene);

    const region = { rx, rz, key, spacing, mesh, geo, waterMesh, waterGeo, scatter };
    this.regions.set(key, region);
    this.stats.built++;
    this.stats.geometriesAlive += (waterGeo ? 2 : 1);
    return region;
  }

  /* An LOD change rebuilds the terrain geometry and nothing else: water is flat and
     scatter is placed from the heightfield, so neither depends on mesh resolution. */
  _rebuildLod(rx, rz, spacing) {
    const key = d1RegionKey(rx, rz);
    const region = this.regions.get(key);
    if (!region || region.spacing === spacing) return;

    const geo = d1BuildRegionGeometry(rx, rz, spacing);
    const old = region.geo;
    region.mesh.geometry = geo;
    region.geo = geo;
    region.spacing = spacing;
    if (old && old.dispose) old.dispose();
    this.stats.rebuiltForLod++;
  }

  _unload(key) {
    const region = this.regions.get(key);
    if (!region) return false;

    if (region.mesh) {
      this.scene.remove(region.mesh);
      /* The GEOMETRY is ours and is freed. The MATERIAL is shared across every region and
         is NOT — see the header. */
      if (region.geo && region.geo.dispose) region.geo.dispose();
      region.mesh.geometry = null;
    }
    if (region.waterMesh) {
      this.scene.remove(region.waterMesh);
      if (region.waterGeo && region.waterGeo.dispose) region.waterGeo.dispose();
      region.waterMesh.geometry = null;
    }
    if (region.scatter) d1DisposeRegionScatter(region.scatter, this.scene, this.assets);

    this.regions.delete(key);
    this.stats.unloaded++;
    this.stats.geometriesAlive -= (region.waterGeo ? 2 : 1);
    return true;
  }

  /* Drop everything. For a teardown — leaving the dimension, a New Game, a load. Shared
     materials are deliberately NOT freed here either: `d1DisposeTerrainMaterials()` is a
     separate, explicit call for shutting the whole dimension down for good. */
  unloadAll() {
    let n = 0;
    for (const key of Array.from(this.regions.keys())) if (this._unload(key)) n++;
    this._pending.length = 0;
    return n;
  }

  /* ---- QUERIES ---------------------------------------------------------------------- */

  isResident(rx, rz) { return this.regions.has(d1RegionKey(rx, rz)); }

  isResidentAround(minX, minZ, maxX, maxZ) {
    const lo = d1RegionIndexAt(minX, minZ);
    const hi = d1RegionIndexAt(maxX, maxZ);
    for (let rz = lo.rz; rz <= hi.rz; rz++)
      for (let rx = lo.rx; rx <= hi.rx; rx++) {
        if (!d1RegionExists(rx, rz)) continue;     // outside the world is not "missing"
        if (!this.isResident(rx, rz)) return false;
      }
    return true;
  }

  debugReport() {
    let tris = 0, verts = 0;
    for (const r of this.regions.values()) {
      const u = r.geo && r.geo.userData && r.geo.userData.d1;
      if (u) { tris += u.triangles || 0; verts += u.vertices || 0; }
    }
    const lods = {};
    for (const r of this.regions.values()) lods[r.spacing] = (lods[r.spacing] || 0) + 1;
    return {
      resident: this.regions.size,
      totalRegionsInWorld: D1_REGION_GRID * D1_REGION_GRID,
      triangles: tris, vertices: verts, lodCounts: lods,
      pending: this._pending.length,
      stats: Object.assign({}, this.stats),
    };
  }
}
