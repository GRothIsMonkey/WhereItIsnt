"use strict";
/* =====================================================================================
   COLOUR TRANSFER — THE ARITHMETIC, AND NOTHING ELSE
   D1 IMPLEMENTATION PHASE 4 — RENDERER / PBR CORRECTION. NEW.

   Pure numbers. No THREE, no DOM, no state. The renderer's colour pipeline
   (src/rendering/color-pipeline.js) uses these, and so does every piece of Era 1 content that
   has to translate a level it was AUTHORED in into the level the corrected renderer needs.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY ERA 1 NEEDS A TRANSFER AT ALL

   Every Era 1 light intensity, and every brightness multiplier the voxel mesher bakes into
   vertex colours, was tuned by eye against a renderer that had NO output encode. On that
   renderer a surface lit at level L showed at L times its colour, in DISPLAY units. On a
   correct renderer the same L is linear light and shows at L^(1/2.2) — so a night ambient
   of 0.16 that used to read at 16% reads at 43%, and the night is gone.

   `legacyLinear(L) = L^2.2` is the level that reproduces the authored appearance where that
   light dominates. It is applied to the AUTHORED BASE of each Era 1 light and shade, never
   to a multiplier layered on top (a flicker, a dissolve), so every "half as bright" in the
   game is still exactly half of the same linear light.

   Point lights also need their FALLOFF transferred. r128's legacy light model attenuates a
   point light by (1 - d/cutoff)^decay; raising that to 2.2 is exactly a decay of
   2.2 x decay. `legacyLightDecay` is that factor and nothing else.

   ERA 2 CONTENT DOES NOT USE THIS. A PBR asset is authored in linear light against a
   physically-based reference; the transfer exists so the old world keeps its look on the
   new renderer, and it goes away with the old world.

   CLASSIC script. See ARCHITECTURE.md section 4.15.
   ===================================================================================== */

/* The exponent Era 1's appearance was, in effect, authored through. */
const LEGACY_DISPLAY_GAMMA = 2.2;

/* Exact sRGB transfer functions (IEC 61966-2-1), the ones three uses. */
function srgbToLinear(c) {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}
function linearToSrgb(c) {
  return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/* An Era 1 level (a light intensity, a baked shade multiplier) -> the linear level that
   looks the same on the corrected renderer. Monotonic, 0 -> 0, 1 -> 1. */
function legacyLinear(level) {
  return level > 0 ? Math.pow(level, LEGACY_DISPLAY_GAMMA) : 0;
}

/* An Era 1 point light's decay exponent -> the one that gives the transferred falloff. */
function legacyLightDecay(decay) {
  return decay * LEGACY_DISPLAY_GAMMA;
}
