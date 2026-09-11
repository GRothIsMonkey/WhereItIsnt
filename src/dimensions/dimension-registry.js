"use strict";
/* =====================================================================================
   DIMENSION IDENTITY
   ERA 1.5.2 — EXTRACTED VERBATIM FROM game.html.

   Extracted so the stable technical ids have one home. The descriptor table that
   distinguishes a stable id from a creative dimension number is appended below, in
   src/dimensions/dimension-descriptors.js, which loads after this file.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md and src/dimensions/LAYER.md.
   ===================================================================================== */

/* ---------------------------------------------------------------------------------
   DIMENSION IDS — PHASE 5A PART 3. Previously the game tracked "which level am I
   in" only through a pair of loose booleans on the player (inFarmlands/inSuburbia),
   which is exactly what let _genDisconnectedHomeL3() stamp itself into the ordinary
   Overworld chunk grid with nothing to check against. Every dimension-scoped
   generator now takes one of these explicitly and refuses to run for any other.
   --------------------------------------------------------------------------------- */
const DIMENSION = { OVERWORLD: 1, FARMLANDS: 2, SUBURBIA: 3, FAKE_HAVEN: 4 };
