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
| ✅ — | `save-schema.js` — version, keys, coordinate and edit ceilings | **1.5.2 · done** |
| ✅ — | `save-lifecycle.js` — `SAVE_MIGRATIONS`, `validateSaveState`, `describeSaveState`, `captureWorldState`, `restoreWorldState`, `findSafeLanding`, `saveFallbackSpawn`, `defaultSaveState`, `SaveSystem` | **1.5.4 · done** |
| — | `Game.captureSaveState`, `_applyRestoredState`, `_teardownForRestore` — **stayed in Game** | **1.5.4 · decided** |

> **PERSISTENCE OWNS THE FILE; THE ORCHESTRATOR OWNS WHAT GOES IN IT.** The 1.5.1 work
> order scheduled Game's three save-orchestration methods into this layer. They decide what
> of the *running application* belongs in a save and how the application is rebuilt from
> one — they read and write Game's fields across every subsystem. Moving them here means
> either handing the whole `game` object to persistence, or rewriting 380 lines of the save
> path in the same phase that moved the frame loop. ARCHITECTURE.md §4.6 records the call.

> **THE SCHEMA STAYS AT VERSION 5 FOR THE WHOLE OF ERA 1.5.** Save keys, item ids,
> progression ids, dimension names and the edit representation are frozen. A new internal
> representation gets an **adapter**, not a version bump. A repair is always **reported**,
> never silent. `CLAUDE.md` §75.
