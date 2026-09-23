"use strict";
/* =====================================================================================
   THE ASSET REGISTRY — WHAT MODELS EXIST, AND UNDER WHAT LICENCE
   ERA 2, PHASE E2.0a — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY A TABLE AND NOT A LOAD CALL

   The audio system learned this the expensive way and CLAUDE.md section 61 wrote it down:
   adding a sound means adding a ROW, not a playback call, and no call site holds a
   Freesound id. The same rule holds here. **No call site in the build may hold a model
   file path.** A caller names a KEY; this table is the only place a key becomes a URL.

   That is what lets Era 2 repoint, rename or replace an asset without touching the code
   that places it, and it is what makes an attribution audit mechanical rather than
   a matter of remembering.

   ─────────────────────────────────────────────────────────────────────────────────────
   STATUS IS NOT DECORATION

   `ASSET_STATUS.VALIDATION` means: this asset exists to prove the PIPELINE works. It is
   not production content, no dimension may place it, and no creative decision rests on
   it. `tests/assets.js` fails if a validation asset is referenced from `src/dimensions/`
   or from any generator.

   `ASSET_STATUS.PRODUCTION` means the opposite. E2.0a shipped ZERO of them; D1
   Implementation Phase 4 integrated the FIRST — `prop.rural-fence-post-01`, a
   human-approved first-party asset — and it is registered here, budgeted, collided and
   attributed, but PLACED NOWHERE in the shipped world. Where it goes is the D1 layout
   phase's decision, not the pipeline's.

   ─────────────────────────────────────────────────────────────────────────────────────
   AN ASSET WITHOUT AN ATTRIBUTION LINE IS A LICENCE BREACH, NOT UNTIDINESS

   CLAUDE.md section 61, said about audio, and it is the same sentence here. Every row in
   `MODEL_ASSETS` must have a row in `ASSET_CREDITS`; every credit must name a licence
   from `ASSET_LICENCES`; and `tests/assets.js` fails in BOTH directions — an asset with
   no credit, and a credit with no asset.

   NonCommercial and similar restricted licences are LEGAL HERE and ILLEGAL in a paid,
   monetised or ad-supported release. `ASSET_LICENCES[x].restricted` marks them and the
   test keeps the quarantine list current, exactly as AUDIO_INDEX.md does for the
   eighteen restricted audio assets.

   FIRST-PARTY IS A LICENCE STATUS, NOT THE ABSENCE OF ONE (D1 Phase 4). An asset authored
   FOR this project is not under a Creative Commons licence and must not be dressed up as
   one. `ASSET_LICENCES['FIRST-PARTY']` states what it actually is — project-owned,
   unrestricted for this project's commercial use, no external attribution required — and
   it is EARNED, not declared: `tests/assets.js` requires a first-party credit to name an
   in-repo provenance record that exists and a SHA-256 the shipped file actually has. There
   is no "no licence" value, and there will not be one.

   ─────────────────────────────────────────────────────────────────────────────────────
   COLLISION IS DECLARED HERE AND DERIVED NOWHERE

   An asset does NOT bring its own physics. It declares a collision MODE, and the proxy
   that mode implies is what gameplay may ever be told about. A render mesh is never a
   collision surface — that is how a voxel dependency would come back in a new costume.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See src/assets/LAYER.md and ERA2-PLAN.md section E2.0a.
   ===================================================================================== */

/* The one place a key becomes a path prefix. */
const ASSET_ROOT = 'assets/models/';

/* THE ORIGIN IS KNOWABLE BEFORE ANY LOAD IS ATTEMPTED, and short-circuiting keeps a
   blocked run from producing one CORS error per asset. Byte-for-byte the audio system's
   AUDIO_TRANSPORT_BLOCKED, and for the same reason: a browser refuses `fetch` for a local
   file, so a page opened from disk can load NO model at all, permanently, in every
   session. CLAUDE.md section 61.07 is three phases of playtest reports caused by exactly
   this, in the other subsystem. */
const ASSET_TRANSPORT_BLOCKED = (() => {
  try {
    return (typeof location !== 'undefined' && location && location.protocol === 'file:');
  } catch (e) { return false; }         // an exotic embedding with no location at all
})();

const ASSET_STATUS = Object.freeze({
  VALIDATION: 'validation',   // proves the pipeline. NOT game content. Never placed.
  PRODUCTION: 'production',   // authored for the shipped game. D1 Phase 4 ships the first.
});

/* `none`  nothing to walk into — decoration, or something only ever seen at distance.
   `box`   one axis-aligned box, derived from the asset's own measured bounds.
   `boxes` an authored list of local-space boxes, for a shape one box lies about.
   THERE IS DELIBERATELY NO `mesh` MODE. A render mesh as a collision surface is the
   dependency this whole layer exists to avoid; when something genuinely needs it, it gets
   a phase and a reason, not a default. */
const ASSET_COLLISION = Object.freeze({
  NONE:  'none',
  BOX:   'box',
  BOXES: 'boxes',
});

const ASSET_LICENCES = Object.freeze({
  'CC-BY-4.0': Object.freeze({
    name: 'Creative Commons Attribution 4.0',
    url: 'http://creativecommons.org/licenses/by/4.0/',
    restricted: false,
  }),
  'CC-BY-NC-4.0': Object.freeze({
    name: 'Creative Commons Attribution-NonCommercial 4.0',
    url: 'http://creativecommons.org/licenses/by-nc/4.0/',
    restricted: true,      // legal here; illegal in a paid or monetised release
  }),
  /* D1 PHASE 4 — WORK AUTHORED FOR THIS PROJECT. Not a Creative Commons grant, and it does
     not borrow one's name or URL: nobody licensed this to the project, the project made
     it. `url` is null because there is no external licence text to point at; the
     provenance lives on the CREDIT row instead, as an in-repo path and a file hash. */
  'FIRST-PARTY': Object.freeze({
    name: 'First-party — authored for WHERE IT ISN\'T, project-owned',
    url: null,
    restricted: false,     // unrestricted for this project's releases, commercial included
    firstParty: true,
    attributionRequired: false,
  }),
});

const ASSET_LIMITS = Object.freeze({
  /* Consecutive failures with NOT ONE success before the whole transport is declared
     dead. Low, because the model library is small — unlike audio, where the ceiling had
     to clear the number of assets one scene asks for. */
  deadAfter: 3,
});

/* -------------------------------------------------------------------------------------
   THE MANIFEST

   `f`          path under ASSET_ROOT — the ONLY place this string appears in the build
   `status`     ASSET_STATUS — validation assets may not be placed by a dimension
   `collision`  ASSET_COLLISION — what gameplay may be told about this shape
   `boxes`      local-space [minX,minY,minZ,maxX,maxY,maxZ] list, `boxes` mode only
   `normalize`  null, or { targetHeight } — the pipeline rescales to that height in metres
   `credit`     key into ASSET_CREDITS
   `lod`        RESERVED, always null in E2.0a. Adding LODs later is a row edit.
   `compression` RESERVED, always null in E2.0a. KTX2/Draco is a later phase.
   `budget`     D1 PHASE 3. `null`, or { class, exceptions } — see below.
   ------------------------------------------------------------------------------------- */
const MODEL_ASSETS = Object.freeze({
  /* THE PIPELINE VALIDATION ASSET, AND NOTHING ELSE.

     Chosen because it is the only real GLB left in the repository after the obsolete D1
     set was withdrawn, and because a road sign is a shape whose real-world size everyone
     already knows — a scale error in one is visible in a second, which is the whole job
     of a first asset.

     IT IS NOT FINAL GAME CONTENT and nothing in `src/dimensions/` may reference it. The
     D1 landmark specifications have not been supplied and are not this phase's to invent. */
  'prop.road-signs': Object.freeze({
    f: 'props/road_signs.glb',
    status: ASSET_STATUS.VALIDATION,
    collision: ASSET_COLLISION.BOX,
    boxes: null,
    normalize: null,          // native scale is REPORTED by the measurement tool, not guessed at
    credit: 'prop.road-signs',
    lod: null,
    compression: null,
    /* D1 PHASE 3 — NULL, AND THAT IS THE CORRECT VALUE FOR THIS ROW.

       A VALIDATION asset exists to prove the pipeline and is never placed in the shipped
       world, so `VISUAL_RULE_BIBLE.md` section 9.1's PRODUCTION budgets do not apply to it
       and declaring a class here would invent a creative decision. At its native scale this
       model is 139.75 x 23.36 x 18.82 m — it is a scale probe, not a prop.

       `assetBudgetSpecOf` returns null for it and the validator answers `unavailable`,
       which is the honest outcome: E2.0a ships zero production assets, so there is nothing
       in this repository that a production budget applies to yet. */
    budget: null,
  }),

  /* D1 IMPLEMENTATION PHASE 4 — ASSET 001, AND THE FIRST PRODUCTION ROW.

     A weathered rural fence post with one rail and a bolted steel repair strap. Revision 03,
     HUMAN VISUALLY APPROVED; the runtime file is a byte-identical copy of the approved
     review GLB (the credit row carries its hash and `tests/assets.js` checks it). The art is
     not this row's to change: no re-export, no retexture, no simplification.

     AUTHORED AT REAL SCALE WITH A GROUND ORIGIN, SO `normalize` IS NULL. The post is
     1.200 m tall with its foot at y = 0, and the rail runs toward +X. A `targetHeight` of
     1.2 would rescale by 0.99999996 and — worse — would silently CORRECT a later re-export
     in the wrong units instead of failing on it. The browser suites assert the native
     height instead, so a units error is a red test rather than a quiet fix.

     COLLISION IS TWO DECLARED BOXES, NEVER THE ~2 m BOUNDING BOX. One box around the
     render bounds would put an invisible 1.75 m x 0.73 m wall in the open space under the
     rail — the gap an animal walks through and a player sees through. So:

       post   the leaning, bowed upright, full height, INCLUDING the housed joint where
              the rail enters it (the housing cheeks reach x +0.159 between 0.72 and
              0.94 m). One box: a slanted proxy is not a thing this vocabulary has, and a
              few centimetres of lean is not worth inventing one.
       rail   from the face of that housing to the split end, 0.727-0.893 m high — the
              full SAG envelope, so the rail is solid wherever its mesh actually is. The
              two boxes abut at x = 0.159, so there is no gap to aim through.

     Every timber vertex lies inside one of the two. The steel strap does NOT get a third
     box: it lies on the +Z faces of the post and rail (about 1 cm proud of the rail, under
     1 cm proud of the post) and no strap vertex is more than 1.0 cm outside the nearest
     proxy, so a ray aimed at it strikes the timber just behind it and returns the SAME
     stable ref — a hit's ref is the placed entry, not the box. Fitted to
     the GLB's own vertex data, and tests/assets.js section 5 re-derives both claims from
     the shipped file on every run. */
  'prop.rural-fence-post-01': Object.freeze({
    f: 'props/rural_fence_post_01.glb',
    status: ASSET_STATUS.PRODUCTION,
    collision: ASSET_COLLISION.BOXES,
    boxes: Object.freeze([
      Object.freeze([-0.082, 0.000, -0.081,  0.159, 1.200, 0.077]),   // post + joint housing
      Object.freeze([ 0.159, 0.727, -0.036,  1.914, 0.893, 0.036]),   // rail, sag envelope
    ]),
    normalize: null,
    credit: 'prop.rural-fence-post-01',
    lod: null,
    compression: null,
    /* Measured on the shipped file, not taken from the authoring report: 1,296 triangles,
       largest map 256 px, 64.4 px/m. Inside every small-prop guideline, so NO exception —
       and an empty list here is a statement, not an omission. */
    budget: Object.freeze({ class: 'small-prop', exceptions: Object.freeze([]) }),
  }),
});

/* One row per asset. The `file` field names the attribution document that shipped with
   the asset — the join key between the model on disk, this table and that document, the
   same role the Freesound id plays for audio. Filenames are never rewritten. */
const ASSET_CREDITS = Object.freeze({
  'prop.road-signs': Object.freeze({
    title: 'Road Signs',
    author: 'FrodoUndead',
    source: 'https://skfb.ly/oFIJX',
    licence: 'CC-BY-4.0',
    file: 'assets/models/props/Props_Credits.md',
  }),
  /* FIRST-PARTY. `source` is the in-repo provenance record — the approved revision's
     review directory, with its .blend, textures, renders and validation reports — because
     there is no external page to link. `sha256` pins the exact bytes that were approved. */
  'prop.rural-fence-post-01': Object.freeze({
    title: 'Rural Fence Post 01 (Revision 03)',
    author: 'WHERE IT ISN\'T (first-party)',
    source: 'assets/_raw_review/rural_fence_post_01/revision_03/',
    licence: 'FIRST-PARTY',
    file: 'assets/models/props/First_Party_Credits.md',
    tools: 'Astra + Blender 5.2.2 LTS',
    approval: 'Revision 03 — human visual approval',
    sha256: '8f1d6934ac8e29427243ca658bcddb2fb942ebe555ee95089f9e6ca043935f91',
  }),
});

/* Every asset the build may ask for, as a plain list — for the audit tools, so neither
   has to know how the manifest is shaped. */
function modelAssetKeys() {
  return Object.keys(MODEL_ASSETS);
}

/* The ONE place a key becomes a URL. Returns null for an unknown key rather than
   throwing, because a missing asset is a normal, reportable, non-fatal outcome. */
function modelAssetUrl(key) {
  const a = MODEL_ASSETS[key];
  return a ? ASSET_ROOT + a.f : null;
}

/* Is this asset allowed to be placed in the shipped world? Validation assets are not. */
function isProductionAsset(key) {
  const a = MODEL_ASSETS[key];
  return !!(a && a.status === ASSET_STATUS.PRODUCTION);
}

/* D1 PHASE 3 — THE BUDGET A ROW DECLARES, OR NULL.

   `{ class, exceptions }` where `class` is a key of `ASSET_BUDGET_CLASSES` and `exceptions`
   is an optional list of `{ metric, allow, reason }`. The exception lives on the ASSET and
   nowhere else, which is what makes it reviewable in a diff — `asset-budgets.js` refuses a
   global switch and refuses an exception with no stated reason.

   Returns null for a row with no budget AND for any VALIDATION asset, whatever it declares.
   A pipeline probe is not production content and section 9.1's budgets are production
   guidance; letting one claim a class would put a fake entry in the only table that is
   supposed to describe the shipped game. */
function assetBudgetSpecOf(key) {
  const a = MODEL_ASSETS[key];
  if (!a || !a.budget) return null;
  if (a.status !== ASSET_STATUS.PRODUCTION) return null;
  return a.budget;
}

/* Assets whose licence forbids a paid, monetised or ad-supported release. The LICENCE
   QUARANTINE, in the same sense AUDIO_INDEX.md uses the phrase. */
function restrictedLicenceAssets() {
  return modelAssetKeys().filter((k) => {
    const c = ASSET_CREDITS[k];
    const l = c && ASSET_LICENCES[c.licence];
    return !!(l && l.restricted);
  });
}
