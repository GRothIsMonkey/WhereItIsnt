"use strict";
/* =====================================================================================
   THE INTERACTION VOCABULARY
   D1 IMPLEMENTATION PHASE 2 — NEW. **Vocabulary and a data boundary. No behaviour.**

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT THIS FILE IS FOR

   Phase 2 adds a normalized raycast, and the moment that exists a confusion becomes
   possible and expensive: treating "the ray hit something" as "the player can do something
   with it". Almost everything in the world is hittable and almost nothing is interactive.
   This file exists so that later systems can tell those apart without inventing their own
   words for it, and without reaching into the renderer to find out.

   FOUR TERMS, AND THE DISTINCTION BETWEEN THEM IS THE WHOLE POINT:

     PHYSICAL HIT     A ray intersected world geometry. Terrain, a wall, a floor. This
                      says NOTHING about whether the thing can be acted on. It is
                      `src/world/raycast.js`'s business and does not appear in this file.

     INTERACTABLE     A registered target that DECLARES it can be acted on. It has a
                      stable id and a set of affordances. It is not geometry and it does
                      not own geometry; it is attached to a physical `ref` so a hit can
                      find it.

     AFFORDANCE       A semantic statement of what is permitted. Three words, below.

     INTERACTION      The normalized outcome of ASKING to do something. It says whether
     RESULT           the request was accepted, and when refused, why — it does not carry
                      out anything.

   ─────────────────────────────────────────────────────────────────────────────────────
   THREE AFFORDANCES, AND THE RESTRAINT IS DELIBERATE

       none      declares nothing; the target is inert
       inspect   look at it more closely
       use       operate it

   That is the entire vocabulary and it must stay that way until a phase with content in it
   proves a fourth is needed. **No D1-specific affordance may be added here** — not
   `open_door`, not `pickup_key`, not `read_note`, not `break_photo`, not
   `activate_tower`. Those are content, they belong to the phase that authors the content,
   and every one of them is expressible as `use` or `inspect` plus a target that knows what
   it is. `tests/raycast.js` fails if a fourth affordance appears here.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT THIS FILE IS NOT

   Not an entity-component framework. Not a scripting language. Not a content database.
   Not an editor. Not UI. Not a dispatcher — nothing here CALLS anything, and there is no
   registry of handlers. It answers two questions: *is there a target behind this hit*, and
   *does that target permit this*.

   It also knows nothing about a camera, a key binding, a prompt or a player. Ray
   construction is the caller's; rendering a prompt is `UIManager`'s; deciding what `use`
   means for one particular object is the content phase's.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.12 and src/gameplay/LAYER.md.
   ===================================================================================== */

/* THE WHOLE VOCABULARY. Three words. Adding a fourth is a design decision with a phase
   attached, not a convenience. */
const INTERACTION_AFFORDANCE = Object.freeze({
  NONE:    'none',
  INSPECT: 'inspect',
  USE:     'use',
});

const INTERACTION_AFFORDANCES = Object.freeze(['none', 'inspect', 'use']);

/* Why a request was refused. A refusal is a normal outcome, not an error, and it is
   explicit so a caller never has to guess from a false. */
const INTERACTION_REFUSED = Object.freeze({
  NO_TARGET:      'no-target',       // the hit has nothing registered behind it
  NOT_AFFORDED:   'not-afforded',    // the target exists and does not permit this
  UNKNOWN_VERB:   'unknown-verb',    // the verb is not in the vocabulary at all
});

/* AN INTERACTABLE. Stable identity, a declared affordance set, and an opaque `meta` the
   owning system may hang anything on — this file never reads it.

   `id` is the caller's and must be stable across a stream-out and back in: it is what a
   later system will key saved state on, and a generated-per-load id would silently lose
   that state. Nothing here generates one. */
function makeInteractable(id, affordances, meta) {
  const list = Array.isArray(affordances) ? affordances : [affordances];
  const clean = [];
  for (const a of list) {
    if (INTERACTION_AFFORDANCES.indexOf(a) === -1) continue;   // unknown words are dropped
    if (a === INTERACTION_AFFORDANCE.NONE) continue;           // `none` is the absence, not a member
    if (clean.indexOf(a) === -1) clean.push(a);
  }
  return Object.freeze({
    id: id,
    affordances: Object.freeze(clean),
    meta: meta === undefined ? null : meta,
  });
}

/* THE REGISTRY. A flat map from a physical `ref` to the interactable behind it.

   It is keyed on the ref a raycast hit carries, which is what joins the two layers without
   either knowing about the other: the physical side hands out an opaque handle, and this
   side says whether anything is attached to it. Registration and removal are the owning
   system's business and follow the same lifecycle as the collision proxy — an unregistered
   ref resolves to nothing, immediately. */
class InteractionRegistry {
  constructor() { this.byRef = new Map(); }

  get size() { return this.byRef.size; }

  /* Attach an interactable to a physical ref. Returns the interactable. Re-registering the
     same ref REPLACES, rather than accumulating — a region that streams in twice must not
     end up with two targets on one surface. */
  register(ref, interactable) {
    if (ref === null || ref === undefined || !interactable) return null;
    this.byRef.set(ref, interactable);
    return interactable;
  }

  unregister(ref) { return this.byRef.delete(ref); }

  clear() { const n = this.byRef.size; this.byRef.clear(); return n; }

  /* THE RESOLUTION STEP. A physical hit in, an interactable or null out.

     This is the only place the two vocabularies meet, and it is deliberately one lookup:
     a hit is not an interaction, and the gap between them is exactly this Map miss. */
  resolve(hit) {
    if (!hit || hit.ref === null || hit.ref === undefined) return null;
    return this.byRef.get(hit.ref) || null;
  }
}

/* Does this target permit this verb? Pure, and it is the whole affordance check. */
function interactionAfforded(target, affordance) {
  if (!target) return false;
  return target.affordances.indexOf(affordance) !== -1;
}

/* THE NORMALIZED OUTCOME OF ASKING. Accepts or refuses with a reason, and does NOT act —
   carrying the request out belongs to whatever owns that target. A caller that wants to
   know "can I show a prompt here" asks this and reads `ok`. */
function resolveInteraction(registry, hit, affordance) {
  if (INTERACTION_AFFORDANCES.indexOf(affordance) === -1 ||
      affordance === INTERACTION_AFFORDANCE.NONE) {
    return { ok: false, refused: INTERACTION_REFUSED.UNKNOWN_VERB, target: null, hit: hit || null };
  }
  const target = registry ? registry.resolve(hit) : null;
  if (!target) {
    return { ok: false, refused: INTERACTION_REFUSED.NO_TARGET, target: null, hit: hit || null };
  }
  if (!interactionAfforded(target, affordance)) {
    return { ok: false, refused: INTERACTION_REFUSED.NOT_AFFORDED, target: target, hit: hit || null };
  }
  return { ok: true, refused: null, target: target, hit: hit || null, affordance: affordance };
}
