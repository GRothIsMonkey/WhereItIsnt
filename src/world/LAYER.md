# `src/world/` — WHAT IS THERE

Voxels, chunks, streaming, edits, terrain queries, water, lighting, doors — the **engine**.
`VoxelWorld` is 1,640 lines and 57 methods; it was 13,404 and 270 before Era 1.5.3. Not the content: that is `dimensions/`, and since Era 1.5.3 the separation is
real rather than aspirational — `tests/architecture.js` fails if a single dimension method
is declared in here, or if a method in here names a place.

## May depend on
`shared/`, `core/`.

## Must never
know the HUD, an objective, a save file, or what a dimension *means*.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| ✅ — | `block-catalog.js` — BLOCK ids, colours, the id ceiling, door constants | **1.5.2 · done** |
| ✅ — | `block-shapes.js` — the sub-voxel shape system, flattened once at load | **1.5.2 · done** |
| ✅ — | `block-properties.js` — hardness, tool tiers, `computeBreakTime`, display names | **1.5.2 · done** |
| ✅ — | `world-constants.js` — chunk dims, cave-mouth tuning, streaming radii | **1.5.2 · done** |
| ✅ — | `chunk.js` — a `Uint16Array` and four accessors | **1.5.3 · done** |
| ✅ — | `world-content.js` — how dimension content attaches to the engine | **1.5.3 · done** |
| ✅ — | `voxel-world.js` — streaming, meshing, block access, edits, water, skylight, doors | **1.5.3 · done** |
| 13961–14131 | `EnvironmentStorySystem` — **deliberately left.** See ARCHITECTURE.md §4.5: the Phase 31 framework stays whole; only its stamper moved. | 1.5.4+ |
| 32887–33374 | `FarmAnimal`, `FarmAnimalManager` — entities, not world. Re-filed to `gameplay/`. | 1.5.4 |

> **THE MESHER DID NOT MOVE TO `rendering/`.** The 1.5.1 map scheduled the seven meshing
> methods (415 lines) into `src/rendering/` as "the Era 2 hinge". They stayed in
> `voxel-world.js`, because they are not a renderer — they are the greedy voxel mesher, and
> every one of them reads block ids, shapes and chunk neighbours through the engine's own
> state. Lifting them out would mean inventing an interface for the thing Era 2 deletes.
> Era 2 replaces the mesher and the engine together; separating them first is work thrown
> away. This is a deliberate departure from the 1.5.1 plan, recorded rather than silent.
>
> **`edit()` IS THE ONLY WRITE PATH.** Water reacts to edits, chunk meshes rebuild from
> edits, the save *is* a list of edits, and the audio director asks what surface the player
> stands on. A voxel written by any other route is invisible to all four.
