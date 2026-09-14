# `src/core/` — LIFECYCLE, CLOCK, CONFIG, INPUT ROUTING

Boot, the application orchestrator, the frame loop, the two clocks, configuration, and
which subsystem an input event is for. Not what the input then does.

Since Era 1.5.4 this layer holds `Game` — the one obvious orchestration owner. It
constructs every subsystem, hands each one what it needs, runs the world's frame loop, and
coordinates saves, transitions and settings. It authors no content.

## May depend on
`shared/`, and — as the composition root — every layer it constructs.

## Must never
generate a chunk, author content, place a block, or decide what a dimension *means*.
Constructing the render stack is allowed here and nowhere else, under a named ceiling of
five THREE references that Era 1.5.5 should reduce.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| ✅ 1937–2170 | `GameSettings`, `SETTINGS_SCHEMA`, `GRAPHICS_PRESETS`, fullscreen helpers | **1.5.1 · done** |
| ✅ — | `game.js` — **all** of `Game`: composition root, frame loop, saves, transitions, settings policy | **1.5.4 · done** |
| ✅ — | `dev-tools.js` — the developer console. Deletable: one file, one `<script>` tag | **1.5.4 · done** |
| — | the boot listener **stays in game.html** — 11 lines, and it is the HTML boundary | **1.5.4 · decided** |
| 27881–28210 | `PlayerController`'s ten `document` listeners → input routing | 1.5.5 |

> **IT WAS NOT SPLIT INTO `*Manager` FILES, ON PURPOSE.** The 1.5.1 plan said "the
> composition root half of it only". Splitting 51 methods across three invented manager
> files would have produced a prettier diagram and the identical object graph: every method
> would still reach every field of the same `this`. One orchestrator, with its dependency
> surface declared and capped in `tests/architecture.js` §4d, is the honest version. See
> ARCHITECTURE.md §4.6.

> **TWO CLOCKS, AND THE DIFFERENCE IS LOAD-BEARING.** `dt` is clamped to 0.06 for physics
> safety; `filmDt` is unclamped wall time for the opening film, the Haven stages, the finale
> beats and the objective line. `tests/opening.js` enumerates `filmDt`'s consumers **by name**
> and separately asserts the five simulation systems are on the clamped delta. Adding a
> consumer to either means editing that test.
