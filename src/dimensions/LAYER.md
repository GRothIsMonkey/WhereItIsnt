# `src/dimensions/` — WHERE THE PLAYER IS, AND WHAT THAT IMPLIES

One descriptor per dimension, the content of every place, and (later) the transition
engine. **Nothing outside this layer's descriptor table may name a dimension.**

Since Era 1.5.3 this layer also holds what the four dimensions ARE. Each has two files and
the split between them is the Era 2 seam:

* **`<dim>/generation.js`** — where things go. Terrain shape, lattices, street grids, floor
  plans, route columns, chunk orchestration. It may not name a block id, and because of
  that it survives Era 2.
* **`<dim>/stampers.js`** — how they are made. **The only code in the build that names a
  block id or places one.** Era 2 replaces these files and nothing else.

`dimension-generators.js` is the dispatch: three rows saying who fills a chunk. A fifth
dimension is a row there, not a branch in the engine.

## May depend on
`shared/`, `core/`, `world/`, `progression/`.

## Must never
be named by another layer; be identified by a boolean on the player; reach `Game`, the UI,
the audio system, the horror systems or the DOM (all five asserted at **zero**); call
another dimension's content (asserted at exactly one documented edge).

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| ✅ — | `dimension-registry.js` — the `DIMENSION` enum | **1.5.2 · done** |
| ✅ — | `dimension-descriptors.js` — **stableId / creativeNumber / canonicalName / saveName** | **1.5.2 · done** |
| ✅ — | `dimension-generators.js` — which generator fills a chunk, as a 3-row table | **1.5.3 · done** |
| ✅ — | `shared/stampers.js` — a shell, a roof, the env-story stamp | **1.5.3 · done** |
| ✅ — | `overworld/` — 12 methods, 466 lines | **1.5.3 · done** |
| ✅ — | `haven/` — 12 methods, 799 lines | **1.5.3 · done** |
| ✅ — | `suburbia/` — 66 methods, 3,618 lines | **1.5.3 · done** |
| ✅ — | `farmlands/` — 118 methods, 6,774 lines | **1.5.3 · done** |
| ✅ — | `finale/scene.js` — the finale's own ground | **1.5.3 · done** |
| 39009–39172 | `Game._transitionToLevel2/3/4` | 1.5.4 |
| 39191–39220 | `Game._leaveDimension` — the one teardown | 1.5.4 |
| 35588–35802 | `FinalSequence` | 1.5.4 |
| 8060–8268 | `AnchorMonumentManager` — the rift half | 1.5.4 |

> **P0-2 IS THE POINT OF THIS LAYER.** Dimension identity is today three booleans on the
> *player* — 10 writes, 73 reads, the Overworld encoded as "all false", and two-at-once
> representable. Adding The Below to that means a fourth boolean.
>
> **THE NUMBERING QUESTION IS SETTLED, AND THE ANSWER IS THAT THERE ARE TWO NUMBERS.**
> Era 1.5.2 implemented the project owner's locked decision:
>
> ```
>     stable id 1  is  the Overworld            (a save-file value, permanent)
>     D1           is  the Shattered Farmlands  (the canon's creative order)
> ```
>
> A bare integer says nothing about which question is being asked, so every identity is a
> NAMED field — `stableId` / `creativeNumber` / `canonicalName` / `saveName` — the
> accessors THROW on the wrong kind of number rather than coercing it, and
> `creativeNumber` is deliberately `null` for the Overworld and the Haven so that code
> which assumed "the stable id IS the dimension number" fails loudly.
>
> **No stable id was renumbered and no save migration was introduced.** `DIMENSION_PLAN`
> carries The Below at creative 3 with `stableId: null`: representable, not implemented.
