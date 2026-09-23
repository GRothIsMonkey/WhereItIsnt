# `src/rendering/` — HOW IT IS SHOWN

Scene graph, camera, lighting, materials, post-processing, mesh construction and disposal.

**THIS IS THE LAYER ERA 2 REWRITES WHOLESALE.** Everything here describes how the game
LOOKS. Nothing here decides what is true.

## May depend on
`shared/`, `core/`, and exactly one function in `assets/`: `markTextureSrgb` (with its
predicate `_assetUsesColorSpaceApi`). That pair is the build's one answer to "which
three.js colour-space spelling is this", and the colour pipeline asks it rather than keeping
a second copy (D1 Phase 4).

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
| `color-pipeline.js` | 202 | **D1 Phase 4.** Colour management (r128 backport), renderer output, the linear half-float scene target, the ONE output encode PostFX runs |
| `sky-environment.js` | 231 | **D1 Phase 4.** The sky as a PMREM `scene.environment` for PBR scenes that attach it; follows the day, rebuilds only on change and only with a PBR consumer, disposes what it makes |

**THE COLOUR RULES, SINCE D1 PHASE 4** (ARCHITECTURE.md section 4.15):

- **Encode once, in PostFX, and nowhere else.** A second post pass, a custom shader writing
  to the canvas, or an sRGB-marked scene target would encode twice.
  `tests/browser-color-pipeline.js` reads `#808080` back as 128 to prove it.
- **Every colour texture is marked** (`markColorTexture`); every data texture is not.
- **An Era 1 light's authored level goes through `legacyLinear`**, and a point light's decay
  through `legacyLightDecay`. A new Era 2 light is authored in linear light and does not.
- **The sky environment is attached only to a scene that holds PBR content**, never to the
  Lambert voxel scene. r128 gives `scene.environment` to Standard/Physical materials only,
  but r152+ gives it to Lambert and Phong too, so on the upgrade it would add a second
  ambient to the whole Era 1 world. The suite asserts the voxel scene carries none.

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
