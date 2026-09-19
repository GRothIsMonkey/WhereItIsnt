"use strict";
/* =====================================================================================
   THE VISUAL BUDGET MODEL — WHAT AN ASSET IS ALLOWED TO COST
   D1 IMPLEMENTATION PHASE 3 — NEW. **Rules and a verdict. No measurement, no geometry.**

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY THIS EXISTS

   `VISUAL_RULE_BIBLE.md` section 9.1 is the human-readable source of the project's
   production budgets and REMAINS SO. It is a creative document and this file does not
   replace it. What this file does is carry the MEASURABLE SUBSET of those rules as one
   frozen table, so the repository can answer "is this asset following them" with a number
   instead of an opinion.

   The rule the audio library taught this project twice (CLAUDE.md sections 61 and 61.05)
   is the same one here: **an unbudgeted asset class costs whatever it costs at runtime,
   and nobody finds out until a human plays it.** A budget that lives only in prose is a
   budget nobody checks.

   ─────────────────────────────────────────────────────────────────────────────────────
   THESE ARE GUIDELINES AND THE MODEL SAYS SO IN ITS TYPES

   Section 9.1 opens with *"They are guidelines, not absolute hard limits. An asset that
   has a real reason to exceed one may, but the reason should be stated rather than
   assumed."* A validator that turns that into pass/fail is a validator that will be
   switched off within a month.

   So every result carries TWO fields and they answer different questions:

     `band`    WHAT THE NUMBER IS, against the rule alone.
               within · near · over · unmeasured

     `status`  WHAT A GATE SHOULD DO ABOUT IT, once enforcement and any stated exception
               are applied.
               pass · advisory · fail · unavailable · exception

   Collapsing those two is how "clearly over budget" and "a hundred triangles past the
   boundary" become the same message, and then neither means anything.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE BANDS ARE SCALE-FREE, WHICH IS WHY ONE FACTOR WORKS FOR EVERY CLASS

   `ASSET_BUDGET_NEAR` is a fraction of the BOUNDARY, not of the range width. 25% past
   1,500 is 375 triangles; 25% past 30,000 is 7,500. A fraction of the range width would
   have made the small-foliage band 112 triangles and the hero band 5,000, which is the
   same rule being strict on the class that matters least.

   **BEING UNDER A MINIMUM NEVER BLOCKS.** The minima exist to catch a MISCLASSIFIED
   asset — a 90-triangle object declared a standard prop is probably small foliage — not
   to demand triangles nobody asked for. Under-range is capped at `advisory`, always.

   ─────────────────────────────────────────────────────────────────────────────────────
   TEXTURE: ONE STEP OF SLACK, AND 4K IS THE THING THE BIBLE NAMES

   Section 9.1: *"Avoid unnecessary 4K textures. A 4K map on an object the player walks
   past is memory spent on detail nobody resolves."* So the texture rule is the one that
   BLOCKS, and the band is a doubling — one mip step, which is the unit textures actually
   come in:

       dim <= target            within
       target < dim <= 2x       near      (advisory: reviewable, not silently fine)
       dim > 2x                 over      (fail, because this rule blocks)

   A 4K map on a hero asset (2K target) therefore lands on `advisory` and a 4K map on a
   small prop (512 target) lands on `fail`. That is the bible's own asymmetry, kept.

   ─────────────────────────────────────────────────────────────────────────────────────
   TEXEL DENSITY: ONE OCTAVE, BECAUSE THAT IS THE UNIT

   ~64 px/m standard, up to ~128 px/m for hero assets. A factor of two in texel density is
   ONE MIP LEVEL, and the measurement itself (`measureAssetTexelDensity`) is an estimate
   built from UV area against world area — a number with real uncertainty in it. Banding
   tighter than the measurement's own error would produce findings that are noise.

   So: within one octave of target is `within`, within two is `near`, beyond that is
   `over`, and the rule is ADVISORY. Section 9's claim — two assets at different densities
   read as two games — is a comparison BETWEEN assets, and a between-assets check needs
   more than one production asset to exist. There are none yet. This file measures each
   asset against the target and says so.

   ─────────────────────────────────────────────────────────────────────────────────────
   EXCEPTIONS ARE LOCAL, STATED, AND VISIBLE

   There is deliberately NO global switch. An exception is a row on the ASSET, it names
   ONE metric, it carries an explicit allowance and a REASON, and an exception without a
   reason is INVALID rather than generous. A metric covered by a valid exception reports
   `exception`, never `pass` — the whole point is that a justified hero asset looks
   intentional in the validation output and an accidental 4K texture does not.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.13 and src/assets/LAYER.md.
   ===================================================================================== */

/* ---- THE VOCABULARY ---------------------------------------------------------------- */

/* WHAT THE NUMBER IS, against the rule alone. Enforcement plays no part in this. */
const ASSET_BUDGET_BAND = Object.freeze({
  WITHIN:     'within',       // inside the guidance range
  NEAR:       'near',         // outside it, but within the boundary tolerance
  OVER:       'over',         // clearly outside it
  UNMEASURED: 'unmeasured',   // the input does not support measuring this metric
});

/* WHAT A GATE SHOULD DO. `exception` is a status rather than a flag on purpose: a
   deliberate overrun must be as visible in the output as an accidental one. */
const ASSET_BUDGET_STATUS = Object.freeze({
  PASS:        'pass',
  ADVISORY:    'advisory',
  FAIL:        'fail',
  UNAVAILABLE: 'unavailable',
  EXCEPTION:   'exception',
});

/* Severity order, for rolling per-metric statuses up into one. `unavailable` outranks a
   stated exception because an unchecked metric is a gap and an exception is a decision;
   `advisory` outranks both because it is an actual finding about an actual number. */
const ASSET_BUDGET_SEVERITY = Object.freeze({
  pass: 0, exception: 1, unavailable: 2, advisory: 3, fail: 4,
});

/* Does breaking this rule stop anything, or only get written down? */
const ASSET_BUDGET_ENFORCEMENT = Object.freeze({
  ADVISORY: 'advisory',   // recorded; never fails a gate
  BLOCKING: 'blocking',   // a clear overrun fails
});

/* How far past a boundary still counts as NEAR it. A fraction of the boundary, not of the
   range — see the header. One number for every class, deliberately. */
const ASSET_BUDGET_NEAR = 0.25;

/* Texel density bands, as RATIOS to the class target. One octave is one mip level. */
const ASSET_TEXEL_WITHIN = 2.0;    // within a factor of two either way
const ASSET_TEXEL_NEAR   = 4.0;    // within a factor of four either way

/* ---- THE CLASSES ------------------------------------------------------------------- */

/* VISUAL_RULE_BIBLE.md section 9.1, transcribed. **These numbers are the bible's and are
   not this file's to change.** If they ever disagree, the bible is the creative source and
   this table is wrong. `tests/budgets.js` asserts every row against the numbers as written
   there, so a silent drift in either direction is a test failure.

   `texel.target` is not in the 9.1 table — it comes from the "Texel density" subsection
   just below it: ~64 px/m standard, up to ~128 px/m for hero assets. Which classes are
   hero is stated there ("hero assets"); the two 2K classes are the hero classes. */
const ASSET_BUDGET_CLASSES = Object.freeze({
  'small-prop': Object.freeze({
    label: 'Small prop',
    triangles: Object.freeze({ min: 200, max: 1500, enforcement: 'advisory' }),
    texture:   Object.freeze({ target: 512, enforcement: 'blocking' }),
    texel:     Object.freeze({ target: 64, enforcement: 'advisory' }),
    atlas: false,
  }),
  'standard-prop': Object.freeze({
    label: 'Standard prop',
    triangles: Object.freeze({ min: 1000, max: 5000, enforcement: 'advisory' }),
    texture:   Object.freeze({ target: 1024, enforcement: 'blocking' }),
    texel:     Object.freeze({ target: 64, enforcement: 'advisory' }),
    atlas: false,
  }),
  'architectural-module': Object.freeze({
    label: 'Architectural module',
    triangles: Object.freeze({ min: 1000, max: 6000, enforcement: 'advisory' }),
    texture:   Object.freeze({ target: 1024, enforcement: 'blocking' }),
    texel:     Object.freeze({ target: 64, enforcement: 'advisory' }),
    atlas: false,
  }),
  'hero-landmark': Object.freeze({
    label: 'Major / hero landmark',
    triangles: Object.freeze({ min: 10000, max: 30000, enforcement: 'advisory' }),
    texture:   Object.freeze({ target: 2048, enforcement: 'blocking' }),
    texel:     Object.freeze({ target: 128, enforcement: 'advisory' }),
    atlas: false,
  }),
  'major-creature': Object.freeze({
    label: 'Major creature',
    triangles: Object.freeze({ min: 10000, max: 25000, enforcement: 'advisory' }),
    texture:   Object.freeze({ target: 2048, enforcement: 'blocking' }),
    texel:     Object.freeze({ target: 128, enforcement: 'advisory' }),
    atlas: false,
  }),
  'small-foliage': Object.freeze({
    label: 'Small foliage instance',
    triangles: Object.freeze({ min: 50, max: 500, enforcement: 'advisory' }),
    /* "atlas / 512–1K" in the bible. The target is the TOP of that range because foliage
       shares one atlas across many instances, which is what `atlas: true` records. */
    texture:   Object.freeze({ target: 1024, enforcement: 'blocking' }),
    texel:     Object.freeze({ target: 64, enforcement: 'advisory' }),
    atlas: true,
  }),
});

const ASSET_BUDGET_CLASS_KEYS = Object.freeze(Object.keys(ASSET_BUDGET_CLASSES));

/* THE LOD SCHEMA, AND IT IS A SCHEMA AND NOTHING ELSE.

   The registry reserves `lod` and nothing in the build selects, switches or generates one
   (src/assets/LAYER.md says so). Phase 3 does not build that system — it defines what a
   future one would be VALIDATED against, so the first asset that ships LODs does not also
   have to invent the vocabulary.

   An asset presenting LODs is expected to present them COARSENING: each level at or below
   the previous level's triangle count. `validateAssetLods` checks exactly that and nothing
   else, because nothing else can be checked without a selection policy to check it
   against. */
const ASSET_LOD_SCHEMA = Object.freeze({
  /* [{ level: 0, triangles: n }, ...] — level 0 is the one the budget class applies to. */
  levelField: 'level',
  triangleField: 'triangles',
  /* A level that is not meaningfully cheaper than the one before it is not a LOD. */
  minReductionRatio: 0.9,
});

/* ---- LOOKUPS ----------------------------------------------------------------------- */

function assetBudgetClass(name) {
  return ASSET_BUDGET_CLASSES[name] || null;
}

function assetBudgetClassKeys() {
  return ASSET_BUDGET_CLASS_KEYS.slice();
}

/* The worse of two statuses, by the declared severity order. */
function worseAssetStatus(a, b) {
  const sa = ASSET_BUDGET_SEVERITY[a], sb = ASSET_BUDGET_SEVERITY[b];
  if (sa === undefined) return b;
  if (sb === undefined) return a;
  return sa >= sb ? a : b;
}

/* ---- EXCEPTIONS -------------------------------------------------------------------- */

/* An exception is `{ metric, allow, reason }` and all three are required.

   `metric`  one of 'triangles' | 'texture' | 'texel'
   `allow`   the value this asset is permitted up to, in that metric's own units
   `reason`  a sentence. Not optional, not a placeholder, and the validator refuses one
             shorter than `ASSET_EXCEPTION_MIN_REASON` — "because" is not a reason and an
             exception nobody has to justify is a global switch with extra steps.

   Returns `{ ok, reason }` so an invalid exception is REPORTED rather than ignored: an
   asset that thinks it has an exception and does not is exactly the case that must be
   visible. */
const ASSET_EXCEPTION_METRICS = Object.freeze(['triangles', 'texture', 'texel']);
const ASSET_EXCEPTION_MIN_REASON = 12;

function validateAssetException(ex) {
  if (!ex || typeof ex !== 'object') return { ok: false, why: 'not an object' };
  if (ASSET_EXCEPTION_METRICS.indexOf(ex.metric) === -1) {
    return { ok: false, why: 'unknown metric "' + String(ex.metric) + '"' };
  }
  if (typeof ex.allow !== 'number' || !isFinite(ex.allow) || ex.allow <= 0) {
    return { ok: false, why: 'allow must be a positive finite number' };
  }
  if (typeof ex.reason !== 'string' || ex.reason.trim().length < ASSET_EXCEPTION_MIN_REASON) {
    return { ok: false, why: 'reason must be a stated sentence' };
  }
  return { ok: true, why: null };
}

/* ---- BANDING ----------------------------------------------------------------------- */

/* A value against a { min, max } range. Returns a band and which side it fell off. */
function bandAssetRange(value, min, max) {
  if (typeof value !== 'number' || !isFinite(value)) {
    return { band: ASSET_BUDGET_BAND.UNMEASURED, side: null };
  }
  if (value >= min && value <= max) return { band: ASSET_BUDGET_BAND.WITHIN, side: null };
  if (value > max) {
    return { band: value <= max * (1 + ASSET_BUDGET_NEAR) ? ASSET_BUDGET_BAND.NEAR
                                                          : ASSET_BUDGET_BAND.OVER,
             side: 'over' };
  }
  return { band: value >= min * (1 - ASSET_BUDGET_NEAR) ? ASSET_BUDGET_BAND.NEAR
                                                        : ASSET_BUDGET_BAND.OVER,
           side: 'under' };
}

/* A texture's largest dimension against a class target. One doubling of slack. */
function bandAssetTexture(dim, target) {
  if (typeof dim !== 'number' || !isFinite(dim) || dim <= 0) {
    return { band: ASSET_BUDGET_BAND.UNMEASURED, side: null };
  }
  if (dim <= target) return { band: ASSET_BUDGET_BAND.WITHIN, side: null };
  if (dim <= target * 2) return { band: ASSET_BUDGET_BAND.NEAR, side: 'over' };
  return { band: ASSET_BUDGET_BAND.OVER, side: 'over' };
}

/* Texel density against a class target, in octaves. Symmetrical: far too little detail is
   as visible as far too much, and section 9 is about assets AGREEING. */
function bandAssetTexel(density, target) {
  if (typeof density !== 'number' || !isFinite(density) || density <= 0) {
    return { band: ASSET_BUDGET_BAND.UNMEASURED, side: null };
  }
  const ratio = density / target;
  const side = ratio > 1 ? 'over' : 'under';
  if (ratio >= 1 / ASSET_TEXEL_WITHIN && ratio <= ASSET_TEXEL_WITHIN) {
    return { band: ASSET_BUDGET_BAND.WITHIN, side: null };
  }
  if (ratio >= 1 / ASSET_TEXEL_NEAR && ratio <= ASSET_TEXEL_NEAR) {
    return { band: ASSET_BUDGET_BAND.NEAR, side };
  }
  return { band: ASSET_BUDGET_BAND.OVER, side };
}

/* ---- BAND + ENFORCEMENT + EXCEPTION -> STATUS -------------------------------------- */

/* The one place a band becomes a verdict, so the four inputs are combined identically for
   every metric. `exception` is the matching entry for this metric, already validated. */
function assetBudgetStatus(band, side, enforcement, value, exception) {
  if (band === ASSET_BUDGET_BAND.UNMEASURED) return ASSET_BUDGET_STATUS.UNAVAILABLE;
  if (band === ASSET_BUDGET_BAND.WITHIN) return ASSET_BUDGET_STATUS.PASS;

  /* A stated, valid exception that actually covers this value. An exception for 40,000
     triangles does not excuse 60,000 — it says what was agreed, not "ignore this". */
  if (exception && typeof value === 'number' && value <= exception.allow) {
    return ASSET_BUDGET_STATUS.EXCEPTION;
  }
  /* Under a minimum is a classification hint, never a gate. See the header. */
  if (side === 'under') return ASSET_BUDGET_STATUS.ADVISORY;
  if (band === ASSET_BUDGET_BAND.NEAR) return ASSET_BUDGET_STATUS.ADVISORY;
  return enforcement === ASSET_BUDGET_ENFORCEMENT.BLOCKING ? ASSET_BUDGET_STATUS.FAIL
                                                           : ASSET_BUDGET_STATUS.ADVISORY;
}

/* ---- THE VALIDATOR ----------------------------------------------------------------- */

/* GIVEN A MEASUREMENT AND A DECLARED CLASS, HOW DOES THIS ASSET COMPARE?

   `measured` is what `src/assets/asset-measure.js` produced, and this function does no
   measuring of its own — it is pure arithmetic over numbers somebody else established,
   which is what makes it testable without a renderer, a GLB or a browser.

       {
         assetClass, label,
         metrics: { triangles, texture, texel },   each { metric, value, band, side,
                                                           status, enforcement, limit }
         lods,                                     null, or the LOD consistency verdict
         exceptions: [{ ...ex, valid, why, applied }],
         warnings: [ string ],
         status                                    the worst of the metric statuses
       }

   An UNKNOWN CLASS is not an error and not a pass: it is `unavailable` with a warning.
   Era 2 ships zero production assets, so most things this is pointed at today have no
   declared class, and a validator that threw would simply never be run. */
function validateAssetBudget(measured, assetClass, exceptions) {
  const cls = assetBudgetClass(assetClass);
  const warnings = [];
  const out = {
    assetClass: assetClass || null,
    label: cls ? cls.label : null,
    metrics: {},
    lods: null,
    exceptions: [],
    warnings,
    status: ASSET_BUDGET_STATUS.UNAVAILABLE,
  };

  if (!cls) {
    warnings.push(assetClass ? 'unknown asset class "' + String(assetClass) + '"'
                             : 'no asset class declared — nothing to validate against');
    return out;
  }

  /* Validate every stated exception BEFORE any of them is honoured, and keep the invalid
     ones in the output. An exception that does not apply is a finding. */
  const byMetric = {};
  const list = Array.isArray(exceptions) ? exceptions : (exceptions ? [exceptions] : []);
  for (const ex of list) {
    const v = validateAssetException(ex);
    const entry = { metric: ex && ex.metric, allow: ex && ex.allow, reason: ex && ex.reason,
                    valid: v.ok, why: v.why, applied: false };
    out.exceptions.push(entry);
    if (!v.ok) { warnings.push('exception rejected: ' + v.why); continue; }
    if (byMetric[ex.metric]) { warnings.push('duplicate exception for "' + ex.metric + '"'); continue; }
    byMetric[ex.metric] = entry;
  }

  const m = measured || {};
  const put = (name, value, rule, banded) => {
    const ex = byMetric[name] || null;
    const status = assetBudgetStatus(banded.band, banded.side, rule.enforcement, value, ex);
    if (status === ASSET_BUDGET_STATUS.EXCEPTION && ex) ex.applied = true;
    out.metrics[name] = {
      metric: name,
      value: (typeof value === 'number' && isFinite(value)) ? value : null,
      band: banded.band,
      side: banded.side,
      status,
      enforcement: rule.enforcement,
      limit: rule.max !== undefined ? { min: rule.min, max: rule.max } : { target: rule.target },
    };
    out.status = worseAssetStatus(out.status, status);
  };

  out.status = ASSET_BUDGET_STATUS.PASS;
  put('triangles', m.triangles, cls.triangles, bandAssetRange(m.triangles, cls.triangles.min, cls.triangles.max));
  put('texture', m.maxTextureDim, cls.texture, bandAssetTexture(m.maxTextureDim, cls.texture.target));
  put('texel', m.texelDensity, cls.texel, bandAssetTexel(m.texelDensity, cls.texel.target));

  if (m.texelStatus && m.texelStatus !== 'measured' && out.metrics.texel) {
    out.metrics.texel.status = ASSET_BUDGET_STATUS.UNAVAILABLE;
    out.metrics.texel.band = ASSET_BUDGET_BAND.UNMEASURED;
    out.metrics.texel.detail = m.texelStatus;
    out.status = worseAssetStatus(out.status, ASSET_BUDGET_STATUS.UNAVAILABLE);
    warnings.push('texel density ' + m.texelStatus + ' — ' + (m.texelWhy || 'no reason given'));
  }

  if (Array.isArray(m.lods) && m.lods.length) {
    out.lods = validateAssetLods(m.lods);
    if (!out.lods.ok) {
      out.status = worseAssetStatus(out.status, ASSET_BUDGET_STATUS.ADVISORY);
      for (const w of out.lods.warnings) warnings.push(w);
    }
  }

  for (const ex of out.exceptions) {
    if (ex.valid && !ex.applied) {
      warnings.push('exception for "' + ex.metric + '" was not needed — the metric is within guidance');
    }
  }
  return out;
}

/* LOD CONSISTENCY, AND ONLY CONSISTENCY. See ASSET_LOD_SCHEMA: without a selection policy
   there is nothing else to check, and inventing one here would be building the system this
   phase is told not to build. */
function validateAssetLods(lods) {
  const warnings = [];
  const levels = lods.slice().sort((a, b) => a.level - b.level);
  let ok = true;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i].level !== i) { warnings.push('LOD levels are not 0..n consecutive'); ok = false; break; }
  }
  for (let i = 1; i < levels.length && ok; i++) {
    const prev = levels[i - 1].triangles, cur = levels[i].triangles;
    if (!(cur <= prev * ASSET_LOD_SCHEMA.minReductionRatio)) {
      warnings.push('LOD ' + levels[i].level + ' is not meaningfully cheaper than LOD ' +
                    levels[i - 1].level + ' (' + cur + ' vs ' + prev + ')');
      ok = false;
    }
  }
  return { ok, levels: levels.length, warnings, triangles: levels.map((l) => l.triangles) };
}
