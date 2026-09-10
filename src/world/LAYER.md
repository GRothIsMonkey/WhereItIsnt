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
| 10048–10074 | `Chunk` — a `Uint16Array` and four accessors | 1.5.3 |
| 14137–27540 | `VoxelWorld`: streaming, meshing, block access, edits, water, skylight | 1.5.3 |
| 13961–14131 | `EnvironmentStorySystem` | 1.5.3 |
| 32887–33374 | `FarmAnimal`, `FarmAnimalManager` | 1.5.3 |

> **`edit()` IS THE ONLY WRITE PATH.** Water reacts to edits, chunk meshes rebuild from
> edits, the save *is* a list of edits, and the audio director asks what surface the player
> stands on. A voxel written by any other route is invisible to all four.
