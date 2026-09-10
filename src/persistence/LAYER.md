# `src/persistence/` — WHAT IS WRITTEN TO DISK

Capture, validate, migrate, repair, apply. Persistence **serialises**; it never decides a
gameplay outcome.

## May depend on
`shared/`, `core/`.

## Must never
decide a gameplay outcome, or know a renderer detail.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| 37149–37227 | `SaveSystem` | 1.5.2 |
| 36393–36530 | `SAVE_VERSION`, keys, `SAVE_DIMENSIONS`, `SAVE_MIGRATIONS` | 1.5.2 |
| 36648–37130 | `validateSaveState`, `captureWorldState`, `findSafeLanding` | 1.5.2 |
| 37842–38363 | `Game.captureSaveState`, `_applyRestoredState`, `_teardownForRestore` | 1.5.4 |

> **THE SCHEMA STAYS AT VERSION 5 FOR THE WHOLE OF ERA 1.5.** Save keys, item ids,
> progression ids, dimension names and the edit representation are frozen. A new internal
> representation gets an **adapter**, not a version bump. A repair is always **reported**,
> never silent. `CLAUDE.md` §75.
