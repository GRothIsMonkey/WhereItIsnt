# `src/rendering/` — HOW IT IS SHOWN

Scene graph, camera, lighting, materials, post-processing, mesh construction and disposal.

## May depend on
`shared/`, `core/`.

## Must never
own progression, objectives, or any gameplay value; decide whether the player may act.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| 28876–29409 | `EnvironmentSystem` | 1.5.2 |
| 29626–29850 | `PostFX` | 1.5.2 |
| 29441–29506 | `AshParticleSystem` | 1.5.2 |
| 7062–7145 | `BlockTargetHighlight` | 1.5.2 |
| 7929–8055 | `buildBlockAtlas`, the tile painters | 1.5.2 |
| 29879–31088 | `buildStalkerMesh`, `buildBehemothMesh`, `buildSkeletonMesh`, `buildSpiderMesh` | 1.5.2 |
| 32482–32868 | `buildFarmAnimalMesh` | 1.5.2 |
| 10340–10598 | `buildFinalCreature`, `buildFinaleScene` | 1.5.2 |
| 11537–12356 | `buildSuburbFurniture`, `buildSuburbInteriorStructure` | 1.5.2 |
| 14137–27540 | the chunk mesher, currently inside `VoxelWorld` (P0-3, 66 edges) | 1.5.3 |

> **THE CHUNK MESHER IS THE ERA 2 HINGE.** It is the code that turns "what is there" into
> "what is drawn". `ARCHITECTURE.md` §4: the seam is at the **stamper**, not at the block.
