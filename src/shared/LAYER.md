# `src/shared/` — THE BOTTOM LAYER

Pure values and pure functions. Everything may use `shared/`, and the price of that
privilege is that `shared/` may use **nothing**.

## May depend on
**Nothing.** Not THREE, not the DOM, not a block id, not any game state.

## Must never
import anything, hold state, allocate a mesh, read the clock, or touch storage.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| ✅ 1826–1935 | `SimplexNoise` — every seeded generator stands on it | **1.5.1 · done** |
| ✅ 1328–1442 | `ITEM`, `ITEM_DATA`, `CRAFTING_RECIPES` | **1.5.1 · done** |
| ~~4324–4642~~ | ~~`BLOCK` ids and tables~~ — **went to `world/` instead, see below** | 1.5.2 |
| ~~4777–5148~~ | ~~the shape/quad tables~~ — **went to `world/` instead** | 1.5.2 |
| — | small math helpers currently inline in `VoxelWorld` | 1.5.3 |

> **A CORRECTION MADE IN 1.5.2.** The 1.5.1 work order filed the block tables here on
> the grounds that they are pure data. They are — but they are the VOCABULARY OF THE
> VOXEL WORLD, and Era 2 replaces them. `shared/` is for what survives the renderer, so
> they went to `src/world/` instead. The rule below is the reason the mistake was
> visible: `tests/architecture.js` fails a `shared/` module that names a block id, and it
> would have failed the module that DEFINES them.

> **AN ITEM ID AND A BLOCK ID ARE SAVE-FILE VALUES. APPEND, NEVER INSERT.**
> `CLAUDE.md` §57 and §62.2. Phase 31 shipped a bug by defining `artFamilyAlone` beside
> `artFamily`, where it belonged conceptually, and rewrote the chunk data of the entire
> suburb. `ITEM.ASH_LOG` is the last item id.
