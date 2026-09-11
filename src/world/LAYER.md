# `src/world/` — WHAT IS THERE

Voxels, chunks, streaming, edits, terrain queries, water, lighting, doors — the **engine**,
about 1,680 lines of today's `VoxelWorld`. Not the content: that is `dimensions/`.

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
| 10048–10074 | `Chunk` — a `Uint16Array` and four accessors | 1.5.3 |
| 14137–27540 | `VoxelWorld`: streaming, meshing, block access, edits, water, skylight | 1.5.3 |
| 13961–14131 | `EnvironmentStorySystem` | 1.5.3 |
| 32887–33374 | `FarmAnimal`, `FarmAnimalManager` | 1.5.3 |

> **`edit()` IS THE ONLY WRITE PATH.** Water reacts to edits, chunk meshes rebuild from
> edits, the save *is* a list of edits, and the audio director asks what surface the player
> stands on. A voxel written by any other route is invisible to all four.
