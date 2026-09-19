"use strict";
/* =====================================================================================
   THE COMPOSITE PHYSICAL WORLD
   D1 IMPLEMENTATION PHASE 1 — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY THIS EXISTS

   `src/world/physical-world.js` defines the eleven queries gameplay asks about the shape
   of the world, and Era 2 has two implementations of it: `VoxelPhysicalWorld` over the
   Era 1 engine and `TerrainPhysicalWorld` over the D1 heightfield. Both answer for ONE
   representation.

   The final D1 is not one representation. It is terrain PLUS authored architecture —
   a barn floor, a stairwell, a catwalk, a wall — and a building the player can walk into
   is exactly a place where the ground is not the terrain. Something has to answer "what
   shape is the world here" across both, and gameplay must not be the thing that decides
   which backend to ask.

   Before this file, the composition existed but in the wrong place: `TerrainPhysicalWorld`
   reached through `this.regions.assetCollision` in three of its methods. That made a
   TERRAIN backend responsible for knowing that assets exist, allowed exactly one provider,
   left the resolution policy implicit in three method bodies, and gave the policy no place
   to be written down. This file takes that composition out of the terrain backend and
   makes it explicit, extensible and testable.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE SHAPE

       GAMEPLAY
         |
         v
       CompositePhysicalWorld          <- implements the full eleven-query contract
         |-- base      : a COMPLETE PhysicalWorld (terrain, or voxel)
         `-- providers : zero or more PARTIAL shape providers (AssetCollisionSet, ...)

   The BASE is authoritative for everything the overlays have no opinion about, and it is
   the only thing that answers a question the overlays cannot express. A PROVIDER is a
   partial contributor: it may implement any subset of `collidesAABB`, `isSolid` and
   `groundHeightAt`, and a method it does not implement is simply not consulted.

   That asymmetry is deliberate. `AssetCollisionSet` answers three questions and has no
   opinion about water, sky, light, sanctuary or streaming. Requiring it to implement
   eleven would mean inventing eight answers, which is how a composition layer starts
   lying.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE RESOLUTION POLICY, PER QUERY. THIS IS THE PART THAT MATTERS.

   Each query composes differently, because each question means something different. The
   policy is stated here, documented in ARCHITECTURE.md, and asserted in
   `tests/composite.js`.

     collidesAABB   UNION (logical OR).  Solid is additive: a box that hits terrain OR any
                    provider collides. Nothing can make a solid thing passable by being
                    next to it, which is the rule that stops a wall becoming walk-through
                    because its collision came from a mesh instead of the ground.

     isSolid        UNION (logical OR), for the same reason and about a point.

     groundHeightAt MAXIMUM, with the base as the floor. The base always returns a number;
                    a provider returns a number or `null` meaning "no opinion here". The
                    answer is the highest surface anything claims. A floor is what you
                    stand on, so a barn floor above the terrain wins, and where no provider
                    has anything the terrain answers unchanged.

                    `null` is NOT zero and is never treated as one. That distinction is the
                    whole reason `AssetCollisionSet.groundHeightAt` returns null.

     waterLevelAt   BASE ONLY. No provider in the build carries water information, and the
                    terrain water table is the authority for what is wet. Architecture
                    standing in water does not drain it: the composite deliberately does
                    NOT let a floor above the surface report dry ground below it, because
                    inventing that would be a new global water system, which this phase is
                    forbidden to build. A provider that one day has a real water opinion is
                    a contract change with its own phase.

     raycast        NEAREST HIT. Every participant that can answer is asked for its own
                    nearest hit; misses are discarded; the smallest valid distance wins.
                    Added by D1 Implementation Phase 2 — see `src/world/raycast.js` for the
                    conventions and `rayHitBeats` for the tie-break, which is a DECLARED
                    category rank and a stable id rather than registration order.

     isResidentAround / editEpoch / hasOpenSkyAbove / lightLevelAt /
     nearestLightSourceDistance / isInsideSafeZone / isInsideSoulAnchorZone
                    BASE ONLY, forwarded unchanged — with ONE composition, below.

   THE ONE EXCEPTION IS `editEpoch`, AND IT IS A CORRECTNESS FIX RATHER THAN A CHOICE.
   That query means "has the world changed since I last asked", and a resting item re-probes
   the surface beneath it only when the number moves. Adding or removing a collision proxy
   DOES change the shape of the world, so the composite adds a revision that increments on
   every provider mutation. If the base answers `undefined` — the voxel world's "cannot
   tell" — the composite answers `undefined` too, because adding a number to an unknown
   would claim knowledge it does not have.

   ─────────────────────────────────────────────────────────────────────────────────────
   DETERMINISM

   No `Math.random`, no clock, no allocation per query, and — because UNION and MAXIMUM are
   both commutative and associative — **the answer does not depend on the order providers
   were added**. `tests/composite.js` proves that by shuffling the provider list and
   comparing every answer.

   ─────────────────────────────────────────────────────────────────────────────────────
   COST

   One array walk over the providers, short-circuited: a query the base already answered
   affirmatively never consults a provider at all. With no providers the composite is the
   base plus one length check. There is no global registry and nothing grows without bound;
   providers are held by the composer, and a provider that is cleared or removed stops
   contributing on the next query.

   THIS FILE IS NOT A SPATIAL INDEX. `AssetCollisionSet` is a flat list by its own
   deliberate decision, and choosing an index before there is a distribution to measure is
   a guess (CLAUDE.md section 14). The phase that places thousands of proxies adds one,
   with a benchmark.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.11 and src/world/LAYER.md.
   ===================================================================================== */

class CompositePhysicalWorld {
  /* `base` is a complete PhysicalWorld and is required — the composite has no answers of
     its own and refuses to pretend otherwise. `providers` is an optional iterable of
     partial shape providers. */
  constructor(base, providers) {
    if (!base) throw new Error('CompositePhysicalWorld requires a base PhysicalWorld');
    this.base = base;
    this.providers = [];
    this._revision = 0;
    if (providers) for (const p of providers) this.addProvider(p);
  }

  /* ---- PROVIDER LIFECYCLE ---------------------------------------------------------- */

  /* Add a partial shape provider. IDEMPOTENT: adding the same provider twice does not
     double it, which is what stops a region that streams in twice from registering its
     collision twice. Returns true when the set actually changed. */
  addProvider(p) {
    if (!p || this.providers.indexOf(p) !== -1) return false;
    this.providers.push(p);
    this._revision++;
    return true;
  }

  /* Remove a provider. Safe to call for one that was never added, and safe to call twice —
     a disposed region unregistering is allowed to be sloppy. Returns true when the set
     actually changed. */
  removeProvider(p) {
    const i = this.providers.indexOf(p);
    if (i === -1) return false;
    this.providers.splice(i, 1);
    this._revision++;
    return true;
  }

  /* Drop every provider. The BASE is untouched — this is not a teardown of the world, it
     is a teardown of what was placed on it. */
  clearProviders() {
    if (!this.providers.length) return 0;
    const n = this.providers.length;
    this.providers.length = 0;
    this._revision++;
    return n;
  }

  hasProvider(p) { return this.providers.indexOf(p) !== -1; }

  get providerCount() { return this.providers.length; }

  /* ---- SHAPE — UNION ---------------------------------------------------------------- */

  collidesAABB(aabb) {
    if (this.base.collidesAABB(aabb)) return true;
    for (let i = 0; i < this.providers.length; i++) {
      const p = this.providers[i];
      if (p.collidesAABB && p.collidesAABB(aabb)) return true;
    }
    return false;
  }

  isSolid(x, y, z) {
    if (this.base.isSolid(x, y, z)) return true;
    for (let i = 0; i < this.providers.length; i++) {
      const p = this.providers[i];
      if (p.isSolid && p.isSolid(x, y, z)) return true;
    }
    return false;
  }

  /* ---- SHAPE — MAXIMUM -------------------------------------------------------------- */

  /* The highest surface anything claims over this column. `null` from a provider means it
     has no opinion and is skipped; it is never read as a height of zero. */
  groundHeightAt(x, z) {
    let best = this.base.groundHeightAt(x, z);
    for (let i = 0; i < this.providers.length; i++) {
      const p = this.providers[i];
      if (!p.groundHeightAt) continue;
      const h = p.groundHeightAt(x, z);
      if (h !== null && h !== undefined && h > best) best = h;
    }
    return best;
  }

  /* ---- SHAPE — NEAREST HIT ---------------------------------------------------------- */

  /* WHAT IS ALONG THIS RAY. The nearest hit from the base and every provider that can
     answer one, or null.

     `direction` MUST be normalized by the caller and `maxDistance` is explicit — one
     convention for every participant, stated in `src/world/raycast.js`, so the distances
     coming back are directly comparable and "nearest" means something.

     A participant that has no `raycast` method is simply skipped, exactly as the shape
     queries skip a provider that cannot answer them. That is what lets a provider be
     partial without the composite inventing an answer on its behalf.

     THERE IS NO SHORT-CIRCUIT HERE, and that is the difference from `collidesAABB`.
     Collision asks "is anything solid", so the first yes ends it. This asks "what is
     NEAREST", and a provider consulted later can still win — so every participant is
     asked, every time, and `rayHitBeats` decides. */
  raycast(origin, direction, maxDistance) {
    let best = this.base.raycast ? this.base.raycast(origin, direction, maxDistance) : null;
    if (best && best.distance > maxDistance) best = null;

    for (let i = 0; i < this.providers.length; i++) {
      const p = this.providers[i];
      if (!p.raycast) continue;
      const h = p.raycast(origin, direction, maxDistance);
      if (!h || h.distance > maxDistance) continue;
      if (rayHitBeats(h, best)) best = h;
    }
    return best || RAYCAST_MISS;
  }

  /* ---- BASE ONLY -------------------------------------------------------------------- */

  /* Water is the base's. See the policy note in the header: architecture above the water
     does not drain it, and no provider in this build has a water opinion to offer. */
  waterLevelAt(x, y, z) { return this.base.waterLevelAt(x, y, z); }

  /* Streaming residency is a property of the base's own region system. */
  isResidentAround(minX, minZ, maxX, maxZ) {
    return this.base.isResidentAround(minX, minZ, maxX, maxZ);
  }

  /* THE ONE COMPOSED NON-SHAPE QUERY. A provider mutation changes the world, so a cache
     keyed on this must invalidate. `undefined` in means `undefined` out — "cannot tell"
     does not become a number. */
  editEpoch() {
    const base = this.base.editEpoch();
    if (base === undefined) return undefined;
    return base + this._revision;
  }

  hasOpenSkyAbove(x, y, z) { return this.base.hasOpenSkyAbove(x, y, z); }
  lightLevelAt(x, y, z) { return this.base.lightLevelAt(x, y, z); }
  nearestLightSourceDistance(pos) { return this.base.nearestLightSourceDistance(pos); }
  isInsideSafeZone(pos) { return this.base.isInsideSafeZone(pos); }
  isInsideSoulAnchorZone(pos) { return this.base.isInsideSoulAnchorZone(pos); }
}
