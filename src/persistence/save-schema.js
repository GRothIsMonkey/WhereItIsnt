"use strict";
/* =====================================================================================
   THE SAVE SCHEMA CONSTANTS
   ERA 1.5.2 — EXTRACTED VERBATIM FROM game.html.

   The version, the two storage keys, the saveable-dimension list, the coordinate
   ceiling, the voxels-per-chunk product and the edit-count ceiling.

   SCHEMA v5 IS FROZEN FOR THE WHOLE OF ERA 1.5, and so are the two storage keys. These
   are not tuning numbers: SAVE_STORAGE_KEY is what an existing player's save is filed
   under, and changing it loses their game.

   SAVE_DIMENSIONS is DERIVED from the dimension registry (Era 1.5.2) — see
   src/dimensions/dimension-descriptors.js. Its value is pinned at runtime by
   tests/save.js.

   ONLY THE CONSTANTS MOVED. SAVE_MIGRATIONS, validateSaveState, captureWorldState and
   findSafeLanding are all still in game.html: they are the save LIFECYCLE, and moving
   that is Era 1.5.4's job.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md and src/persistence/LAYER.md.
   ===================================================================================== */

const SAVE_VERSION = 5;
const SAVE_STORAGE_KEY = 'whereitisnt.save.v1';
const SAVE_BACKUP_KEY = 'whereitisnt.save.v1.backup';

/* THE DIMENSIONS A SAVE MAY NAME. Strings, not the numeric DIMENSION ids: a save file
   outlives the enum, and "farmlands" cannot silently become a different dimension the
   way `2` can. The Fake Haven is deliberately absent — see SAVE_BLOCKED_REASON.

   ERA 1.5.2 — DERIVED from the dimension registry rather than hand-written beside it.
   The list is unchanged (['overworld', 'farmlands', 'suburbia'], in that order, which is
   stable-id order) and tests/save.js pins it; what changed is that "which dimensions are
   saveable" now has ONE source of truth instead of a descriptor table and an array that
   could drift apart. Adding a saveable dimension is now a descriptor field. */
const SAVE_DIMENSIONS = SAVEABLE_DIMENSIONS;

/* Coordinate ceiling. The Farmlands sit at x >= -65,536 and the water simulation's cell
   key is documented exact only for |w| < 2^20, so that is the honest outer bound of the
   world's addressable space and therefore of a legal saved coordinate. */
const SAVE_COORD_LIMIT = 1 << 20;
const SAVE_CHUNK_VOXELS = CHUNK_SX * CHUNK_SY * CHUNK_SZ;
/* A soft ceiling on the number of voxel edits a save will carry. Mining and building
   produce these one at a time; the Farmland water simulation can produce a few hundred
   from a single dam break. A million would be a runaway, not a player. */
const SAVE_MAX_EDITS = 400000;
