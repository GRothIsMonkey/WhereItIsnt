# `src/core/` — LIFECYCLE, CLOCK, CONFIG, INPUT ROUTING

Boot, the frame loop's *shape*, the two clocks, configuration, and which subsystem an
input event is for. Not what the input then does.

## May depend on
`shared/`.

## Must never
construct a mesh, generate a chunk, draw anything, or know what a dimension means.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| ✅ 1937–2170 | `GameSettings`, `SETTINGS_SCHEMA`, `GRAPHICS_PRESETS`, fullscreen helpers | **1.5.1 · done** |
| 37726–40053 | `Game` — the composition root half of it only | 1.5.4 |
| 39623–40052 | `Game._animate` — the frame order, made explicit and named | 1.5.4 |
| 27881–28210 | `PlayerController`'s ten `document` listeners → input routing | 1.5.5 |
| 41307–41317 | the boot listener | 1.5.4 |

> **TWO CLOCKS, AND THE DIFFERENCE IS LOAD-BEARING.** `dt` is clamped to 0.06 for physics
> safety; `filmDt` is unclamped wall time for the opening film, the Haven stages, the finale
> beats and the objective line. `tests/opening.js` enumerates `filmDt`'s consumers **by name**
> and separately asserts the five simulation systems are on the clamped delta. Adding a
> consumer to either means editing that test.
