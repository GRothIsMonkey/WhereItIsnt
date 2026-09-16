# `src/world/terrain/` — THE D1 NON-VOXEL WORLD FOUNDATION

The finite, continuous, streamed ground of the final **Dimension 1 — Shattered Farmlands**.
Ten files, ~1,900 lines, and **not one voxel token among them**.

> **STATUS: FOUNDATION. COMPLETE, RUNNING, AND NOT YET THE LIVE D1.**
> The playable chain still runs on the Era 1 voxel implementation. This world generates,
> streams, collides and disposes, and `tests/browser-terrain.js` walks a real player across
> it in a real browser — but swapping the dimension over is the job of the phase that has
> landmarks to put in it. See ARCHITECTURE.md section 4.10.

## The one property everything else rests on

**Height is a pure function of (x, z) over the reals, and it is authoritative.**

The mesh SAMPLES it. Collision QUERIES it. Scatter is placed ON it. Roads are CUT INTO it.
So a region can be rebuilt at 2 m or at 16 m spacing and the ground the player walks on does
not move, because the ground is the function and the mesh is a picture of it.

Nothing here is faked on top of a voxel lookup. There is no block id, no chunk, no integer
column and no call into `VoxelWorld` anywhere in the directory — `tests/architecture.js`
section 4j asserts it file by file.

## The files, in load order

| file | lines | owns |
| --- | ---: | --- |
| `terrain-config.js` | 232 | **THE FINITE WORLD.** Extent, regions, LOD steps, relief amplitudes, the derived vertical budget, the seed. Pure data plus queries. 0 THREE. |
| `terrain-roads.js` | 214 | **ROUTES.** Polyline representation, distance queries, terrain conformity. **Network EMPTY.** 0 THREE. |
| `terrain-authoring.js` | 194 | **THE AUTHORED SEAM.** Site table, terrain treatment under sites, scatter exclusion, long-range visibility. **Table EMPTY.** 0 THREE. |
| `terrain-heightfield.js` | ~215 | **THE GROUND.** Layered noise, surface classification, normals, slope, water depth, sky. 0 THREE. |
| `terrain-materials.js` | 118 | Shared PBR stand-ins, one per surface class. |
| `terrain-mesh.js` | ~200 | Region geometry, skirts, water planes, LOD sampling. |
| `terrain-scatter.js` | 189 | Deterministic placement. **Species EMPTY.** 0 THREE. |
| `terrain-regions.js` | 250 | **FINITE STREAMING.** Load, LOD swap, unload, resource lifetime. |
| `terrain-physical-world.js` | 194 | **THE E2.1 CONTRACT**, second implementation. 0 THREE. |
| `terrain-world.js` | 117 | Composition, lifecycle, reporting. |

## May depend on
`shared/` (SimplexNoise), `src/assets/` (the E2.0a library and collision proxies), and
`THREE` in the three files budgeted for it.

## Must never
name a block id, a chunk, or anything in the voxel engine; reach `Game`, the UI, the audio
system or the DOM; call `Math.random`; schedule a timer; or place authored content.

## The rules that hold

- **THE WORLD IS FINITE AND IT IS PROVED BY TERMINATION.** `d1AllRegions()` returns exactly
  256 entries. The streamer intersects its load radius with that fixed grid, so a viewpoint
  1,000 km outside the world streams in **nothing** rather than generating forever.
- **THE AUTHORED TABLES SHIP EMPTY, ALL THREE OF THEM.** Roads, scatter species and
  authored sites. The seven landmarks are a roster, not a design — coordinates,
  architecture, interiors and routes are **CREATIVE DECISION NEEDED**, and a placeholder
  coordinate is the kind of thing a later phase mistakes for approval. The tests enforce
  emptiness so content cannot arrive here by accident.
- **PROCEDURAL MAY PLACE A TUFT OF GRASS AND MAY NEVER PLACE A LANDMARK.** Scatter has no
  access to the authoring table, and the authoring table is read by a file that does not
  import scatter. CLAUDE.md section 69.
- **DETERMINISTIC, WITH NO `Math.random` ANYWHERE.** Every placement decision hashes from
  integer cell coordinates and the seed. This is CLAUDE.md section 11, and it is also what
  makes a resource measurement meaningful: a rebuilt region is the *same* region, so drift
  in a counter is a leak and not noise.
- **THE VERTICAL BUDGET IS DERIVED, NOT TYPED.** A hand-typed bound drifts the moment an
  amplitude changes — and it did: the first version declared −8..72 while the analytic worst
  case was −34..65, and the region bounding boxes were being built from the wrong one.
  `D1_MIN_Y` / `D1_MAX_Y` are now computed from `D1_RELIEF`.
- **A REGION OWNS ITS GEOMETRY AND NOT ITS MATERIAL.** Unload frees every geometry it built
  and never touches the shared materials — disposing a shared resource because one user went
  away is the bug E2.0a's reference counting exists to prevent, and the browser suite checks
  the material survives a full unload cycle by uuid.
- **NOTHING SCHEDULES.** `update()` spends a per-frame budget and stops. A test drives a
  hundred frames in a loop; there is nothing to leak.
- **COLLISION IS A HEIGHTFIELD TEST, NOT A MESH TEST**, and that is a reasoned choice rather
  than an optimisation: the visual mesh has 33k triangles per near region, it CHANGES with
  distance, and colliding against it would make the ground's physical shape depend on where
  the camera is.

## Deferred, by name

| deferred | to |
| --- | --- |
| Making this the live D1 dimension | the phase with landmarks to place |
| The ten `groundHeightAt(Math.floor(x), …)` call sites (measured: mean 0.066 m, worst 0.469 m of quantisation) | the phase that makes this world live |
| Vegetation species and the production surface library | E2.3 / the asset phases |
| The authored landform (replacing `d1BaseElevation`) | whoever authors the D1 map |
| The world-edge treatment | environmental authorship |
| Navigation / navmesh / AI traversal | the AI phase — see ARCHITECTURE.md 4.10 |
| Real lighting (`lightLevelAt` returns the daylight term only) | E2.5 |
