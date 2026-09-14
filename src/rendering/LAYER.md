# `src/rendering/` — HOW IT IS SHOWN

Scene graph, camera, lighting, materials, post-processing, mesh construction and disposal.

**THIS IS THE LAYER ERA 2 REWRITES WHOLESALE.** Everything here describes how the game
LOOKS. Nothing here decides what is true.

## May depend on
`shared/`, `core/`.

## Must never
own progression, objectives, or any gameplay value; decide whether the player may act;
**name a block id** — locked at zero, `tests/architecture.js` §4g.

## What is here (Era 1.5.6)

| module | lines | what it owns |
| --- | ---: | --- |
| `environment-system.js` | 554 | sky, sun, moon, fog, ambient and directional light, clouds, the 720-second day |
| `postfx.js` | 246 | the ONE post pass: grain, vignette, channel split, edge mirage |
| `ash-particles.js` | 82 | the Ashen Forest cinder field — bounded and pooled |
| `block-target-highlight.js` | 102 | the outline under the crosshair, and the crack overlay |
| `creature-meshes.js` | 659 | Stalker, Skeleton, Spider, Behemoth |
| `animal-meshes.js` | 406 | Phase 18.2's cow / sheep / chicken / horse, four condition tiers |
| `finale-meshes.js` | 220 | the final creature and the ground it stands on |

210 `THREE.` references, 7 files, **0 block ids**.

That last number is the point. These files describe SHAPES — a sky, a post pass, a
creature's proportions, an animal's silhouette — and none of it is expressed in the voxel
vocabulary. They survive the voxel world's deletion as *designs* even though Era 2 restyles
every one of them.

## Three things the 1.5.1 map filed here that do NOT belong here

Measured in Era 1.5.6 and deliberately left in `game.html`. `tests/architecture.js` §4g
asserts each one is still out, with its reason, so the omission reads as a decision rather
than an oversight.

| unit | lines | why not |
| --- | ---: | --- |
| `buildBlockAtlas` | 127 | paints one 16×16 tile per **block id** into a strip the greedy mesher reads UVs from. It is the voxel texture atlas. Era 2 deletes it with the mesher. |
| `buildSuburbFurniture` | 540 | **zero `THREE.` references.** Not a mesh builder — it allocates block ids through `_furnAlloc` and writes `SUB_SHAPE_DEF`, `BLOCK_HARDNESS`, `BLOCK_DISPLAY_NAME`. Voxel block data. CLAUDE.md §57: registration order IS the id, so moving it rewrites the whole suburb's chunk data. |
| `buildSuburbInteriorStructure` | 261 | the same, for partitions, cased openings and stairs. Also zero `THREE.` |

Filing any of the three here would put voxel block data in the layer that is supposed to
outlive the renderer — the exact failure the layer rule exists to catch.

## The chunk mesher is not here, and that was decided twice

Era 1.5.3 declined to move it and Era 1.5.6 did not reopen the decision. It is not a
renderer: it is the greedy voxel mesher, and every method in it reads block ids, shapes and
chunk neighbours through the engine's own state. Lifting it out means inventing an interface
for the thing Era 2 deletes.

> **THE ERA 2 SEAM IS AT THE STAMPER, NOT AT THE BLOCK** — `ARCHITECTURE.md` §4.5. What a
> place IS survives; how it is MADE does not.
