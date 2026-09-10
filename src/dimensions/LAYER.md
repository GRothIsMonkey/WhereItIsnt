# `src/dimensions/` — WHERE THE PLAYER IS, AND WHAT THAT IMPLIES

One descriptor per dimension, and the transition engine. **Nothing outside this layer's
descriptor table may name a dimension.**

## May depend on
`shared/`, `core/`, `world/`, `progression/`.

## Must never
be named by another layer; be identified by a boolean on the player.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| 14137–27540 | the **9,611 lines** of dimension content inside `VoxelWorld` — as content / sites / stampers | 1.5.3 |
| 39009–39172 | `Game._transitionToLevel2/3/4` | 1.5.4 |
| 39191–39220 | `Game._leaveDimension` — the one teardown | 1.5.4 |
| 35588–35802 | `FinalSequence` | 1.5.4 |
| 8060–8268 | `AnchorMonumentManager` — the rift half | 1.5.4 |

> **P0-2 IS THE POINT OF THIS LAYER.** Dimension identity is today three booleans on the
> *player* — 10 writes, 73 reads, the Overworld encoded as "all false", and two-at-once
> representable. Adding The Below to that means a fourth boolean.
>
> **⚠ The dimension NUMBERING is contested** between the shipped code and the `STORY.md`
> uploaded after Phase 36. `ARCHITECTURE.md` §5 records the conflict. It is not the
> architecture's to resolve — which is exactly why a descriptor carries `id`, `saveName`
> and a display name as three separate fields.
