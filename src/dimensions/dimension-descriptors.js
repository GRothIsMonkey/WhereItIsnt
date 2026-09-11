"use strict";
/* =====================================================================================
   DIMENSION IDENTITY — STABLE TECHNICAL IDs ARE NOT CREATIVE DIMENSION NUMBERS
   ERA 1.5.2 — NEW. This is the only new code in the phase, and it exists because the
   two things below are routinely confused and one of them is a save-file value.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE TRAP, STATED ONCE AND PLAINLY

       stableId 1  is  the Overworld            (a save-file value, permanent)
       D1          is  the Shattered Farmlands  (the canon's creative order)

   A bare `1` therefore means two different places depending on which question is being
   asked, and NOTHING in a raw integer says which. That is the entire reason this file
   exists: every identity a dimension has is a NAMED FIELD, the accessors refuse to be
   handed the wrong kind of number, and `creativeNumber` is deliberately `null` for the
   two dimensions that do not have one — so code that assumed "the stable id IS the
   dimension number" breaks loudly instead of quietly pointing at the wrong world.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE FOUR IDENTITIES

     stableId       the permanent technical id. Written by saves, read by generators,
                    frozen forever. NEVER renumber one to tidy the creative order.
     creativeNumber the canon's D1 / D2 / D3, per STORY.md sections 4, 5 and 6. `null`
                    for a dimension the canon does not number.
     canonicalName  what STORY.md calls it. Player-facing where a banner shows it.
     saveName       the exact string the save file carries. Frozen at schema v5.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT THIS FILE DOES NOT DO

   It does not change how the running game tracks which dimension the player is in. That
   is still three booleans on the player — 112 references, hotspot P0-2 — and replacing
   them is Era 1.5.4's job, not this phase's. What is wired here is one thing: the save
   system's two dimension tables are now DERIVED from this registry instead of being
   hand-written beside it, so there is one source of truth rather than three.

   THE BELOW IS CANON AND IS NOT BUILT. It has a row in DIMENSION_PLAN, no stableId, and
   no generator. A later phase builds it; adding it then means adding a descriptor, not
   editing a branch in twelve files.
   ===================================================================================== */

/* The dimensions that EXIST IN THIS BUILD, keyed by stable technical id.
   `DIMENSION` (dimension-registry.js) supplies those ids and is the older, narrower
   spelling of the same fact; it is kept because ~10 call sites still use it. */
const DIMENSION_DESCRIPTORS = Object.freeze({
  [DIMENSION.OVERWORLD]: Object.freeze({
    stableId: DIMENSION.OVERWORLD,      // 1 — and NOT creative D1
    creativeNumber: null,               // ROADMAP.md: the Era 1 Overworld is discarded as
                                        // the final D1. It is where Era 1 starts, not a
                                        // numbered chapter of the finished game.
    canonicalName: 'The Overworld',
    saveName: 'overworld',
    saveLabel: 'The Overworld',       // what the CONTINUE button shows — FROZEN STRING

    status: 'legacy',                   // scheduled for replacement in Era 2
    saveable: true,
    respawnHere: true,
  }),
  [DIMENSION.FARMLANDS]: Object.freeze({
    stableId: DIMENSION.FARMLANDS,      // 2
    creativeNumber: 1,                  // STORY.md section 4 — DIMENSION 1
    canonicalName: 'Shattered Farmlands',   // STORY.md's name for it
    saveName: 'farmlands',
    saveLabel: 'The Shattered Farmlands',   // the SHIPPED label, which carries a 'The'.
                                            // Kept verbatim: deriving this from
                                            // canonicalName would silently change a
                                            // player-visible string, which Era 1.5 may
                                            // not do. Two fields because they are two
                                            // different strings, not one duplicated.

    status: 'built',
    saveable: true,
    respawnHere: true,
  }),
  [DIMENSION.SUBURBIA]: Object.freeze({
    stableId: DIMENSION.SUBURBIA,       // 3
    creativeNumber: 2,                  // STORY.md section 5 — DIMENSION 2
    canonicalName: 'Static Suburbia',
    saveName: 'suburbia',
    saveLabel: 'Static Suburbia',

    status: 'built',
    saveable: true,
    respawnHere: true,
  }),
  [DIMENSION.FAKE_HAVEN]: Object.freeze({
    stableId: DIMENSION.FAKE_HAVEN,     // 4
    creativeNumber: null,               // a refuge and a sequence, not a numbered chapter
    canonicalName: 'The Haven',
    saveName: null,
    saveLabel: null,
                     // CLAUDE.md section 58: the Haven is NEVER saved
    status: 'built',
    saveable: false,
    respawnHere: false,                 // Phase 5A carved it out of _respawn deliberately
  }),
});

/* THE CANON'S CREATIVE ORDER, which is a different list with a different length.
   STORY.md sections 4, 5 and 6. The Below has no stableId because it does not exist. */
const DIMENSION_PLAN = Object.freeze([
  Object.freeze({ creativeNumber: 1, canonicalName: 'Shattered Farmlands', stableId: DIMENSION.FARMLANDS }),
  Object.freeze({ creativeNumber: 2, canonicalName: 'Static Suburbia',     stableId: DIMENSION.SUBURBIA }),
  Object.freeze({ creativeNumber: 3, canonicalName: 'The Below',           stableId: null }),
]);

/* ─────────────────────────────────────────────────────────────────────────────────────
   ACCESSORS. Each one names the KIND of number it takes, and rejects the other kind.
   A function that silently accepted either is how a stable id becomes a creative number.
   ───────────────────────────────────────────────────────────────────────────────────── */

const DIMENSION_STABLE_IDS = Object.freeze(
  Object.values(DIMENSION).slice().sort((a, b) => a - b));

function isStableDimensionId(v) {
  return typeof v === 'number' && DIMENSION_STABLE_IDS.indexOf(v) >= 0;
}
function isCreativeDimensionNumber(v) {
  return typeof v === 'number' && DIMENSION_PLAN.some(d => d.creativeNumber === v);
}

/* Throws rather than returning undefined. An identity mix-up that returns the wrong
   world quietly is worse than one that stops. */
function dimensionByStableId(stableId) {
  if (!isStableDimensionId(stableId)) {
    throw new Error('dimensionByStableId: ' + stableId + ' is not a stable dimension id. ' +
                    'Stable ids are ' + DIMENSION_STABLE_IDS.join(', ') +
                    '. If you meant the canon\'s D1/D2/D3, use dimensionByCreativeNumber.');
  }
  return DIMENSION_DESCRIPTORS[stableId];
}

function dimensionByCreativeNumber(n) {
  if (!isCreativeDimensionNumber(n)) {
    throw new Error('dimensionByCreativeNumber: ' + n + ' is not a creative dimension number. ' +
                    'The canon numbers D1-D3. If you meant the technical id, use ' +
                    'dimensionByStableId — note that stable id 1 is the Overworld, ' +
                    'while creative D1 is the Shattered Farmlands.');
  }
  const planned = DIMENSION_PLAN.find(d => d.creativeNumber === n);
  return planned.stableId === null ? planned : DIMENSION_DESCRIPTORS[planned.stableId];
}

function dimensionBySaveName(name) {
  for (const id of DIMENSION_STABLE_IDS) {
    const d = DIMENSION_DESCRIPTORS[id];
    if (d && d.saveName === name) return d;
  }
  return null;
}

/* The list the save validator checks a loaded dimension against, and the map the
   CONTINUE button labels itself from — DERIVED, so the registry is the one source of
   truth rather than one of three. Order is stable-id order, which is the order the
   hand-written array had. */
const SAVEABLE_DIMENSIONS = Object.freeze(
  DIMENSION_STABLE_IDS
    .map(id => DIMENSION_DESCRIPTORS[id])
    .filter(d => d && d.saveable && d.saveName)
    .map(d => d.saveName));

const SAVEABLE_DIMENSION_NAMES = Object.freeze(
  DIMENSION_STABLE_IDS.reduce((acc, id) => {
    const d = DIMENSION_DESCRIPTORS[id];
    if (d && d.saveable && d.saveName) acc[d.saveName] = d.saveLabel;
    return acc;
  }, {}));

/* TRANSLATION FROM THE LEGACY STATE, for the phase that removes it.

   The running game still keeps dimension identity as three booleans on the player
   (hotspot P0-2). This reads them and answers with a descriptor. It is NOT wired into
   gameplay — Era 1.5.4 owns that change — but it is the shape the replacement takes, and
   having it here means 1.5.4 deletes call sites rather than inventing semantics.

   Note the precedence: the Haven wins, then Suburbia, then the Farmlands. That is the
   order the existing branches use, and two flags true at once is a state the booleans
   can represent and a descriptor cannot. */
function dimensionOfPlayerFlags(player) {
  if (!player) return DIMENSION_DESCRIPTORS[DIMENSION.OVERWORLD];
  if (player.inFakeHaven) return DIMENSION_DESCRIPTORS[DIMENSION.FAKE_HAVEN];
  if (player.inSuburbia)  return DIMENSION_DESCRIPTORS[DIMENSION.SUBURBIA];
  if (player.inFarmlands) return DIMENSION_DESCRIPTORS[DIMENSION.FARMLANDS];
  return DIMENSION_DESCRIPTORS[DIMENSION.OVERWORLD];
}
