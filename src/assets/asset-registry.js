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

   `ASSET_STATUS.PRODUCTION` means the opposite, and E2.0a ships ZERO of them. The
   landmark and terrain assets are later phases' to author, and the creative
   specifications for them have not been supplied.

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
  PRODUCTION: 'production',   // authored for the shipped game. E2.0a ships none.
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

/* Assets whose licence forbids a paid, monetised or ad-supported release. The LICENCE
   QUARANTINE, in the same sense AUDIO_INDEX.md uses the phrase. */
function restrictedLicenceAssets() {
  return modelAssetKeys().filter((k) => {
    const c = ASSET_CREDITS[k];
    const l = c && ASSET_LICENCES[c.licence];
    return !!(l && l.restricted);
  });
}
