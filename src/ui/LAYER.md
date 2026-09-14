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
| ✅ 7–1074 | the stylesheet → `styles/*.css`, seven sheets | **1.5.5 · done** |
| — | the markup, 92 element ids | **stays in `game.html`** |

> **ALREADY CLEAN, AND MEASURED:** `UIManager` holds **0** THREE references and **0** block
> ids against 87 `document` references. Phase 27 built it that way; `tests/hud.js` keeps it
> that way. Health and perception must never converge on the same visual language — discrete
> vs continuous, DOM vs canvas, warm vs cool, still vs moving — and no stylesheet rule may
> reach both.

## The stylesheets

Era 1.5.5 moved the 1,067-line `<style>` block out of `game.html` into **seven sheets under
`styles/`**: `base.css` (the document, the canvas, and both token sets), `hud.css`,
`overlays.css`, `film.css`, `menu.css`, `settings.css`, `panels.css`.

They are not under `src/`, because they are not scripts: they are linked by the document and
ordered by it. **`game.html` declares the sheet order and nothing else may** — order IS the
cascade, exactly as the script order is the load contract. `base.css` must lead; every other
sheet reads its custom properties, and it is the only sheet allowed to declare a `:root`
token (`tests/architecture.js` §4e).

**The markup stayed in the document, deliberately.** ~250 lines of declarative structure with
no logic in it. Moving it into JS template strings makes it less declarative and hands
`UIManager` a second job; moving it into a partial needs a build step this project does not
have. No id and no class was renamed — 64 ids are looked up by name in code.

When `UIManager` finally moves here, the sheets do not move with it. A renderer and the rules
it renders under are different artefacts, and only one of them is JavaScript.
