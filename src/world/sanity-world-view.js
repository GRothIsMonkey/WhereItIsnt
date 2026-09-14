"use strict";
/* =====================================================================================
   WHAT THE WORLD DOES TO A PERSON STANDING IN IT — THE SANITY SEAM
   ERA 1.5.6, CUT B — NEW. This is the only new class in the phase.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY IT EXISTS

   `SanitySystem` is a HORROR system. It decides how fast a player's perception degrades
   from how dark, how exposed and how sheltered their position is. None of that is a
   voxel question — but until this phase it was asked in voxel terms, by reaching three
   times into the engine's internals:

       world.torchLights          the engine's Map of light-source objects, iterated
       world.getLightWorld(x,y,z) the baked voxel light level
       world.hasSkyAbove(x,y,z)   a column walk through chunk data

   Era 2 deletes the voxel engine. A horror system that iterates a chunk light map does
   not survive that, and it should not have to: the three reads are all the SAME QUESTION
   in different clothes — *how illuminated and how exposed is this point?*

   ─────────────────────────────────────────────────────────────────────────────────────
   THE CONTRACT — FIVE READ-ONLY QUERIES, AND THIS FILE IS THE ONLY VOXEL ANSWER TO THEM

       lightLevelAt(x, y, z)            -> 0..15   how lit this cell is
       hasOpenSkyAbove(x, y, z)         -> bool    nothing between here and the sky
       nearestLightSourceDistance(pos)  -> metres  Infinity when there is none
       isInsideSafeZone(pos)            -> bool    an Anchor Monument's sanctuary
       isInsideSoulAnchorZone(pos)      -> bool    a placed Soul Anchor's weaker one

   The first three are ILLUMINATION and this file answers them out of the voxel engine.
   The last two are GAMEPLAY — the Anchor is crafted, placed and owned by progression,
   not by the renderer — and they are forwarded unchanged. They are in the same view
   because they are the same question from the system's point of view (*is this place
   survivable?*) and because splitting 117 lines of consumer across two ports would be
   ceremony, not a boundary.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT ERA 2 DOES WITH THIS

   Replaces this file. Nothing else. `SanitySystem` names no world member any more, and
   `tests/architecture.js` fails if it grows one back. Five methods is the entire cost of
   keeping the horror system when the voxel world goes.

   NO GAMEPLAY NUMBER LIVES HERE. Every rate, floor, threshold and radius stayed in
   `SanitySystem` where it was. This file obtains values; it does not decide anything.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md §9.6 and src/world/LAYER.md.
   ===================================================================================== */

class SanityWorldView {
  constructor(world) {
    this.world = world;
  }

  /* ILLUMINATION — the three that were reaching into the engine. */

  lightLevelAt(x, y, z) {
    return this.world.getLightWorld(x, y, z);
  }

  hasOpenSkyAbove(x, y, z) {
    return this.world.hasSkyAbove(x, y, z);
  }

  /* The engine keeps its light sources in a Map keyed by cell. The ITERATION is the part
     that was leaking — a consumer should ask for a distance, not walk a collection it
     does not own. Returns Infinity when the world has no light sources at all, which is
     what the previous inline loop returned and what the 6-metre test wants. */
  nearestLightSourceDistance(pos) {
    const lights = this.world.torchLights;
    if (!lights) return Infinity;
    let best = Infinity;
    for (const light of lights.values()) {
      const d = light.position.distanceTo(pos);
      if (d < best) best = d;
    }
    return best;
  }

  /* SANCTUARY — gameplay, forwarded. Both are defensive in exactly the way the call
     sites they replaced were: the Anchor manager is attached to the world after
     construction, and the Soul Anchor query post-dates some saved worlds. */

  isInsideSafeZone(pos) {
    const mgr = this.world.anchorManager;
    return !!(mgr && mgr.isInsideSafeZone(pos));
  }

  isInsideSoulAnchorZone(pos) {
    return !!(this.world.isInsideSoulAnchorZone && this.world.isInsideSoulAnchorZone(pos));
  }
}
