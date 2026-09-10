# `src/ui/` — WHAT THE PLAYER IS TOLD

Main menu, HUD, settings panel, objective line, prompts, overlays, cinematic presentation.
**The HUD is a RENDERER.** It is handed values and paints them.

## May depend on
`shared/`, `core/`.

## Must never
invent gameplay state, read an objective table, own a gameplay value, or reach a block id, chunk or mesh.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| ✅ 1444–1824 | the hotbar item icons | **1.5.1 · done** |
| 33494–34935 | `UIManager` | 1.5.2 |
| 37640–37724 | `MainMenu` | 1.5.2 |
| 35015–35315 | `MenuAtmosphere` | 1.5.2 |
| 35804–36346 | `OpeningFilm`, `OpeningInstruction` | 1.5.2 |
| 7–1075 | the stylesheet | 1.5.5 |
| 1077–1323 | the markup, 92 element ids | 1.5.5 |

> **ALREADY CLEAN, AND MEASURED:** `UIManager` holds **0** THREE references and **0** block
> ids against 87 `document` references. Phase 27 built it that way; `tests/hud.js` keeps it
> that way. Health and perception must never converge on the same visual language — discrete
> vs continuous, DOM vs canvas, warm vs cool, still vs moving — and no stylesheet rule may
> reach both.
