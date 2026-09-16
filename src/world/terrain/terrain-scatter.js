"use strict";
/* =====================================================================================
   D1 TERRAIN — PROCEDURAL SCATTER
   ERA 2, PHASE E2.2 — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT PROCEDURAL IS ALLOWED TO DECIDE, AND WHAT IT IS NOT

   The brief for this phase draws the line precisely, and it is the same line CLAUDE.md
   section 69 draws: procedural placement may decide where a tuft of grass goes and may
   never decide where a landmark goes. So scatter here is allowed to place vegetation,
   stones and small debris, and is structurally incapable of placing anything else — it
   has no access to the authoring table, and the authoring table is read by a different
   file that does not import this one.

   ─────────────────────────────────────────────────────────────────────────────────────
   DETERMINISTIC, AND THAT IS NOT OPTIONAL

   CLAUDE.md section 11: the same seed and the same coordinates produce the same world,
   whichever region generates first, on every reload, forever. Every decision below hashes
   from integer cell coordinates and the terrain seed — there is no `Math.random()` in this
   file and `tests/terrain.js` fails if one appears. A region unloaded and rebuilt is
   identical, which is also what makes the resource test meaningful: if scatter were random
   the counts would drift and a leak would be indistinguishable from noise.

   ─────────────────────────────────────────────────────────────────────────────────────
   ⚠ THIS PHASE SHIPS THE DISTRIBUTION, NOT THE PLANTS

   `D1_SCATTER_SPECIES` is EMPTY. Vegetation is E2.3's phase and the asset policy for E2.2
   says do not build the production library — so what exists here is the placement system,
   its density fields, its exclusion rules and its lifetime handling, and zero species to
   place. With no species the scatter builds nothing, costs nothing, and the terrain is
   bare ground, which is the honest state of a foundation.

   A species is added as a row naming an asset key the E2.0a registry already carries, and
   the instancing below picks it up with no code change. `tests/terrain.js` asserts the
   table is empty so a later phase cannot quietly add content here instead of in E2.3.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY INSTANCED, AND WHY THE CELL GRID

   VISUAL_RULE_BIBLE section 14 wants believable density with controlled species variation
   and no visible repetition of an identical plant. That means many thousands of placements
   per region, which is an InstancedMesh problem, not a Mesh-per-plant problem.

   Placement walks a fixed 4 m cell grid rather than scattering N random points, because a
   grid is enumerable: the same cells always exist, each cell's decision is a pure function
   of its coordinates, and a region can be rebuilt without remembering anything.

   CLASSIC script. See src/world/terrain/LAYER.md.
   ===================================================================================== */

/* The placement grid, in metres. Each cell offers at most one instance, jittered inside
   itself, so density is controlled by acceptance rather than by count. */
const D1_SCATTER_CELL = 4;

/* Nothing is placed within this of a road's edge — a tree in the carriageway is the
   clearest possible sign that scatter was not told about the authored world. */
const D1_SCATTER_ROAD_CLEARANCE = 1.5;

/* Nothing is placed on ground steeper than this. Degrees. */
const D1_SCATTER_MAX_SLOPE = 30;

/* ─────────────────────────────────────────────────────────────────────────────────────
   THE SPECIES TABLE — DELIBERATELY EMPTY. E2.3 fills it.

   A row looks like:
     { id:'grass-tuft', asset:'veg.grass-tuft', surfaces:[D1_SURFACE.FIELD],
       density:0.8, scale:[0.8,1.3], maxSlope:26 }

   `asset` must be a key the E2.0a registry knows. `tests/terrain.js` asserts this is empty.
   ───────────────────────────────────────────────────────────────────────────────────── */
const D1_SCATTER_SPECIES = Object.freeze([]);

let _d1Species = D1_SCATTER_SPECIES;
function d1SetScatterSpecies(list) { _d1Species = Object.freeze((list || []).slice()); return _d1Species.length; }
function d1ScatterSpecies() { return _d1Species; }
function d1ResetScatterSpecies() { _d1Species = D1_SCATTER_SPECIES; }

/* An integer hash. Deterministic, cheap, and good enough for placement jitter — this is
   not cryptography and it is not noise, it is a repeatable pseudo-random per cell. */
function d1CellHash(ix, iz, salt) {
  let h = (ix | 0) * 374761393 + (iz | 0) * 668265263 + (salt | 0) * 1274126177 + D1_TERRAIN_SEED;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;      // 0..1
}

/* Should this cell carry this species, and where exactly. Returns null for "no".

   The density field is noise-modulated so plants CLUSTER — an evenly-sprinkled field of
   grass reads as a texture, while clumps and bare patches read as ground. VISUAL_RULE_BIBLE
   section 14 asks for natural clustering by name. */
function d1ScatterPlacement(species, ix, iz, salt) {
  const jx = d1CellHash(ix, iz, salt);
  const jz = d1CellHash(ix, iz, salt + 7);
  const x = (ix + jx) * D1_SCATTER_CELL;
  const z = (iz + jz) * D1_SCATTER_CELL;

  if (!d1IsInsideWorld(x, z)) return null;

  const N = d1Noise();
  const clump = (N.scatter.noise2D(x / 60, z / 60) + 1) * 0.5;      // 0..1
  const want = species.density * (0.35 + clump * 0.9);
  if (d1CellHash(ix, iz, salt + 19) > want) return null;

  if (d1IsOnRoad(x, z, D1_SCATTER_ROAD_CLEARANCE)) return null;

  /* An authored site's footprint suppresses procedural placement automatically, so no
     species table ever has to know a landmark is there. */
  if (d1IsSiteExcluded(x, z)) return null;

  const surface = d1SurfaceAt(x, z);
  if (species.surfaces && species.surfaces.indexOf(surface) < 0) return null;

  const slope = d1TerrainSlope(x, z, 1.5);
  if (slope > (species.maxSlope === undefined ? D1_SCATTER_MAX_SLOPE : species.maxSlope)) return null;

  const y = d1TerrainHeight(x, z);
  if (y < D1_WATER_LEVEL) return null;             // nothing is planted underwater

  const s0 = species.scale ? species.scale[0] : 1;
  const s1 = species.scale ? species.scale[1] : 1;
  return {
    x, y, z,
    scale: s0 + (s1 - s0) * d1CellHash(ix, iz, salt + 31),
    rotation: d1CellHash(ix, iz, salt + 43) * Math.PI * 2,
  };
}

/* Build one region's scatter. With no species this returns an empty record immediately and
   costs one length check, which is the state E2.2 ships in. */
function d1BuildRegionScatter(rx, rz, scene) {
  const record = { rx, rz, instanced: [], placements: 0 };
  if (_d1Species.length === 0) return record;

  const b = d1RegionBounds(rx, rz);
  const ix0 = Math.floor(b.minX / D1_SCATTER_CELL), ix1 = Math.ceil(b.maxX / D1_SCATTER_CELL);
  const iz0 = Math.floor(b.minZ / D1_SCATTER_CELL), iz1 = Math.ceil(b.maxZ / D1_SCATTER_CELL);

  for (let si = 0; si < _d1Species.length; si++) {
    const species = _d1Species[si];
    const spots = [];
    for (let iz = iz0; iz < iz1; iz++)
      for (let ix = ix0; ix < ix1; ix++) {
        const p = d1ScatterPlacement(species, ix, iz, si * 101 + 1);
        if (p) spots.push(p);
      }
    if (!spots.length) continue;
    record.placements += spots.length;
    /* The geometry a species instances comes from the E2.0a asset library and does not
       exist yet, so the placements are RECORDED and not realised. When E2.3 supplies the
       species, this is where the InstancedMesh is built from `spots`. */
    record.instanced.push({ species: species.id, count: spots.length, spots });
  }
  return record;
}

/* Give back everything a region's scatter owns. Instanced geometry is the region's; the
   SOURCE asset is the library's and is released, never disposed — E2.0a's reference
   counting decides when the last user has gone. */
function d1DisposeRegionScatter(record, scene, assets) {
  if (!record) return 0;
  let n = 0;
  for (const group of record.instanced) {
    if (group.mesh) {
      if (scene) scene.remove(group.mesh);
      if (group.mesh.geometry && group.ownsGeometry && group.mesh.geometry.dispose) {
        group.mesh.geometry.dispose(); n++;
      }
      if (group.instance && assets) assets.release(group.instance);
      group.mesh = null;
    }
  }
  record.instanced.length = 0;
  record.placements = 0;
  return n;
}

function terrainScatterStatus() {
  return {
    stage: 'FOUNDATION',
    species: _d1Species.length,
    note: _d1Species.length === 0
      ? 'Distribution system complete; ZERO species. Vegetation is E2.3 and the E2.2 asset ' +
        'policy forbids building the production library. The terrain is bare ground.'
      : _d1Species.length + ' species installed (test fixture or E2.3 content).',
  };
}
