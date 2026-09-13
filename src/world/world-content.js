"use strict";
/* =====================================================================================
   THE WORLD-CONTENT REGISTRY — HOW A DIMENSION ATTACHES ITS CONTENT TO THE ENGINE
   ERA 1.5.3 — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE PROBLEM THIS SOLVES

   `VoxelWorld` was 13,404 lines, and 9,900 of them described PLACES rather than
   implementing a voxel world: farmsteads, suburban interiors, the Haven cabin, cave
   mouths. Era 2 replaces the renderer and the terrain representation, and every one of
   those lines would have been dragged along with it.

   So the class is now the ENGINE — how a voxel world works — and each dimension supplies
   WHAT ITS PLACE IS from its own files under src/dimensions/.

   ─────────────────────────────────────────────────────────────────────────────────────
   HOW, AND WHY IT IS A PROTOTYPE TRANSPLANT RATHER THAN A REWRITE

   Content arrives as a CLASS EXPRESSION whose prototype descriptors are copied onto
   VoxelWorld's. That is deliberate, and it is the only shape that let 9,900 lines move
   without a single character of any method body changing:

     · a class body needs no commas between members, so the moved text is byte-identical
       to the text removed — a diff can prove the move was a move;
     · `Object.getOwnPropertyDescriptors` preserves non-enumerability exactly, so a moved
       method is indistinguishable from a declared one (an object literal with
       `Object.assign` would have made every method enumerable, which `for...in` can see);
     · `this` still resolves to the world, so no call site changed either.

   WHAT THIS IS NOT. It is not a plugin framework and there is nothing to configure. It
   is one function, a Map for ownership, and a rule.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT IT BUYS BEYOND FILE TIDINESS

   `ownerOf(method)` makes the seam ASSERTABLE. `tests/architecture.js` uses it to prove
   that the engine file declares no dimension content, that no dimension's methods leak
   into another's file, and that every block-writing method lives in a `stampers.js`.
   Without the registry those would be name-prefix greps, which is how the misfiled
   `_home*` helpers hid in the first place.

   HONEST LIMIT, STATED PLAINLY: `this` is still the world object, so dimension content
   can still reach any engine internal it likes. The seam this phase creates is one of
   OWNERSHIP AND FILE BOUNDARY, not of access. Narrowing the call surface to a declared
   API is later work, and ARCHITECTURE.md says so.
   ===================================================================================== */

/* dimension key -> { role -> [method names] }, and method name -> owner. */
const WORLD_CONTENT_OWNERS = new Map();   // methodName -> { dimension, role }
const WORLD_CONTENT_BY_DIMENSION = new Map();

/* A dimension may only be registered with a key the registry knows. A typo that silently
   created a fifth dimension would be invisible until a test went looking for it. */
const WORLD_CONTENT_KEYS = Object.freeze([
  'overworld', 'haven', 'suburbia', 'farmlands', 'finale', 'shared',
]);

function registerWorldContent(dimension, role, holder) {
  if (WORLD_CONTENT_KEYS.indexOf(dimension) < 0) {
    throw new Error('registerWorldContent: unknown dimension "' + dimension + '". ' +
                    'Known keys: ' + WORLD_CONTENT_KEYS.join(', ') + '.');
  }
  if (role !== 'stampers' && role !== 'generation') {
    throw new Error('registerWorldContent: role must be "stampers" (it writes voxels) ' +
                    'or "generation" (it decides what and where). Got "' + role + '".');
  }
  const descriptors = Object.getOwnPropertyDescriptors(holder.prototype);
  delete descriptors.constructor;          // the holder's own, never wanted

  const names = Object.keys(descriptors);
  for (const name of names) {
    const prior = WORLD_CONTENT_OWNERS.get(name);
    if (prior) {
      throw new Error('registerWorldContent: "' + name + '" is already owned by ' +
                      prior.dimension + '/' + prior.role + '. A method has exactly one home.');
    }
    if (Object.prototype.hasOwnProperty.call(VoxelWorld.prototype, name)) {
      throw new Error('registerWorldContent: "' + name + '" is already declared on the ' +
                      'engine. Dimension content may not shadow an engine method.');
    }
    WORLD_CONTENT_OWNERS.set(name, { dimension: dimension, role: role });
  }
  Object.defineProperties(VoxelWorld.prototype, descriptors);

  const byDim = WORLD_CONTENT_BY_DIMENSION.get(dimension) || {};
  byDim[role] = (byDim[role] || []).concat(names);
  WORLD_CONTENT_BY_DIMENSION.set(dimension, byDim);
  return names;
}

/* Which dimension owns a method — the question the architecture suite asks. */
function worldContentOwnerOf(name) { return WORLD_CONTENT_OWNERS.get(name) || null; }
function worldContentOf(dimension) { return WORLD_CONTENT_BY_DIMENSION.get(dimension) || {}; }
