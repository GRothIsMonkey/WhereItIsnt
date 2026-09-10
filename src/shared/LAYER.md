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
| 4324–4642 | `BLOCK` ids, `BLOCK_COLOR`, `BLOCK_DISPLAY_NAME`, hardness/tier tables | 1.5.2 |
| 4777–5148 | the shape/quad tables and their pure emit helpers | 1.5.2 |
| — | small math helpers currently inline in `VoxelWorld` | 1.5.3 |

> **AN ITEM ID AND A BLOCK ID ARE SAVE-FILE VALUES. APPEND, NEVER INSERT.**
> `CLAUDE.md` §57 and §62.2. Phase 31 shipped a bug by defining `artFamilyAlone` beside
> `artFamily`, where it belonged conceptually, and rewrote the chunk data of the entire
> suburb. `ITEM.ASH_LOG` is the last item id.
