"use strict";
/* =====================================================================================
   THE COLOUR PIPELINE — WHERE A COLOUR IS DECODED, WHERE LIGHT IS SUMMED, AND WHERE THE
   ONE ENCODE HAPPENS
   D1 IMPLEMENTATION PHASE 4 — RENDERER / PBR CORRECTION. NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT WAS WRONG

   Until this file existed the game had NO output transform. Every frame was rendered into
   PostFX's 8-bit render target in linear light and then copied to the canvas by a
   ShaderMaterial that wrote `gl_FragColor` straight out — and a ShaderMaterial never
   encodes on its own, in r128 or r186. r128's `renderer.outputEncoding` stayed Linear
   besides. So a linear value of 0.2 reached an sRGB monitor as 0.2, where it should have
   been 0.48.

   Era 1 never noticed because NONE of its inputs was decoded either: r128 has no colour
   management, so every hex colour went into the shader as its display value, and every
   canvas texture was sampled raw. Display values in, display values out — wrong lighting
   maths in between, but the albedo came back looking as authored.

   The first PBR asset broke that symmetry. glTF base-colour maps are sRGB and the asset
   pipeline — correctly — DECODES them. With no matching encode the approved fence reached
   the screen at roughly its linear albedo: 21% of its colour-managed brightness, and the
   timber read near-black. (D1 Phase 4, `tests/browser-asset-scene.js`.)

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT HOLDS NOW, AND IT HOLDS ON r128 AND r186 ALIKE

     INPUTS ARE DECODED ONCE.  Hex and CSS colours are sRGB and become linear when they are
                               SET (`installColorManagement`), which is modern three's
                               ColorManagement, backported to r128 by one shim. Colour
                               textures are marked sRGB (`markColorTexture`) and the GPU
                               decodes them on sampling. Data maps stay linear.
     LIGHT IS SUMMED LINEARLY. Every material, light, fog and clear colour is linear.
     THE SCENE TARGET IS WIDE. Half float where the device can render to it, so the dark end
                               — which is most of this game — is not quantised to 8 bits of
                               LINEAR light (the first sRGB step above black would be 13/255).
     OUTPUT IS ENCODED ONCE.   In the PostFX shader, on every read of the scene target, before
                               any grading — `COLOR_PIPELINE_GLSL`. The grading was tuned on
                               display values and still runs on display values.
     NOTHING ENCODES TWICE.    The scene target is linear (no material encodes into it); the
                               post pass is a ShaderMaterial (three never encodes one); the
                               renderer's own output setting only reaches a built-in material
                               drawn STRAIGHT to the canvas, which the shipped frame never does.
                               `tests/browser-color-pipeline.js` proves a hex 0x808080 on an
                               unlit material reads back as 128 through BOTH paths.

   ─────────────────────────────────────────────────────────────────────────────────────
   ONE VERSION QUESTION, ASKED IN ONE PLACE

   `_assetUsesColorSpaceApi()` (src/assets/asset-materials.js) already answers "is this r152+
   or r128" for texture spellings. This file asks the SAME predicate for the renderer's
   spelling and never invents a second one. The colour-management shim asks a different,
   narrower question — does `THREE.ColorManagement` exist — because that is the feature it
   backports.

   CLASSIC script. Loaded FIRST among the rendering modules. It names THREE only inside
   function bodies; `installColorManagement()` is called as the first statement of
   game.html's inline script, which is where the first `THREE.Color`s are made.
   See ARCHITECTURE.md section 4.15 and src/rendering/LAYER.md.
   ===================================================================================== */

/* The transfer arithmetic (srgbToLinear, linearToSrgb, legacyLinear, legacyLightDecay) is
   pure maths and lives in src/shared/color-transfer.js, so Era 1 content below this layer
   can use it without reaching up into the renderer. */

/* THE ONE OUTPUT ENCODE, AS GLSL. The PostFX shader includes this and calls it on every
   read of the linear scene target. It clamps first: the half-float target can hold values
   above 1, and the display cannot. */
const COLOR_PIPELINE_GLSL = `
        vec3 linearToDisplay(vec3 c) {
          c = clamp(c, 0.0, 1.0);
          vec3 lo = c * 12.92;
          vec3 hi = 1.055 * pow(c, vec3(0.4166667)) - 0.055;
          return mix(hi, lo, step(c, vec3(0.0031308)));
        }
`;

/* What `installColorManagement` did, for tests and the debug report. */
let _colorManagementMode = null;   // 'native' | 'shim' | 'unavailable'

/* HEX AND CSS COLOURS ARE sRGB — MAKE THREE AGREE, ON EVERY VERSION WE SHIP OR TEST.

   r152+ does this itself (`THREE.ColorManagement.enabled`, on by default): `setHex`,
   `setStyle` and `setHSL` convert sRGB to the linear working space, and `getHex`,
   `getStyle` and `getHSL` convert back. r128 has no such thing, so here it is backported
   with the same semantics and nothing more:

     setHex / setStyle / setHSL   sRGB in  -> stored linear
     getHex / getStyle / getHSL   stored linear -> sRGB out
     setRGB, r/g/b, lerp, ...     linear, untouched — exactly as in r152+

   Idempotent, and a no-op on a THREE that is absent or stubbed (the offline suites).

   `setStyle` can call `setHex` (named colours) or `setHSL` (hsl()) internally; the depth
   counter makes sure a colour is converted exactly once, at the outermost setter. */
function installColorManagement() {
  if (_colorManagementMode) return _colorManagementMode;
  if (typeof THREE === 'undefined' || !THREE || typeof THREE.Color !== 'function') {
    return (_colorManagementMode = 'unavailable');
  }
  if (THREE.ColorManagement) {
    THREE.ColorManagement.enabled = true;
    return (_colorManagementMode = 'native');
  }
  const P = THREE.Color.prototype;
  if (typeof P.setHex !== 'function' || typeof P.convertSRGBToLinear !== 'function') {
    return (_colorManagementMode = 'unavailable');
  }
  if (P.__wiiColorManaged) return (_colorManagementMode = 'shim');

  const setHex = P.setHex, setStyle = P.setStyle, setHSL = P.setHSL;
  const getHex = P.getHex, getStyle = P.getStyle, getHSL = P.getHSL;
  const scratch = new THREE.Color();
  let depth = 0;
  const toLinear = (c) => { if (depth === 0) c.convertSRGBToLinear(); return c; };

  P.setHex = function (hex) { setHex.call(this, hex); return toLinear(this); };
  if (setHSL) P.setHSL = function (h, s, l) { setHSL.call(this, h, s, l); return toLinear(this); };
  if (setStyle) {
    P.setStyle = function (style) {
      depth++;
      try { setStyle.call(this, style); } finally { depth--; }
      return toLinear(this);
    };
  }
  if (getHex) P.getHex = function () { return getHex.call(scratch.copy(this).convertLinearToSRGB()); };
  if (getStyle) P.getStyle = function () { return getStyle.call(scratch.copy(this).convertLinearToSRGB()); };
  if (getHSL) {
    P.getHSL = function (target) { return getHSL.call(scratch.copy(this).convertLinearToSRGB(), target); };
  }
  Object.defineProperty(P, '__wiiColorManaged', { value: true });
  return (_colorManagementMode = 'shim');
}

function colorManagementMode() { return _colorManagementMode || 'not installed'; }

/* The renderer's own output setting. It governs built-in materials drawn STRAIGHT to the
   canvas — which the shipped frame never does, since everything goes through PostFX — so it
   is set for the paths that do (a direct diagnostic render, a future overlay pass) and so
   that no built-in material can ever put linear values on the screen. */
function configureRendererOutput(renderer) {
  if (!renderer) return null;
  if (_assetUsesColorSpaceApi()) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    return 'outputColorSpace=' + String(THREE.SRGBColorSpace);
  }
  renderer.outputEncoding = THREE.sRGBEncoding;
  return 'outputEncoding=' + String(THREE.sRGBEncoding);
}

/* HALF FLOAT IF THE DEVICE CAN RENDER TO IT, and 8-bit otherwise.

   A linear 8-bit target puts its first non-black step at sRGB 13/255, which is visible
   banding in exactly the shadows and night skies this game lives in. Half float doubles the
   target's memory (about 6 MB at 1100x700) and nothing else. r186 is WebGL2-only and has no
   `isWebGL2` flag, which is read here as true. */
function sceneTargetType(renderer) {
  const caps = renderer && renderer.capabilities;
  const ext = renderer && renderer.extensions;
  if (!caps || !ext || typeof ext.has !== 'function') return THREE.UnsignedByteType;
  const gl2 = caps.isWebGL2 !== false;
  const ok = gl2
    ? (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))
    : (ext.has('OES_texture_half_float') && ext.has('EXT_color_buffer_half_float'));
  return ok ? THREE.HalfFloatType : THREE.UnsignedByteType;
}

/* The linear scene target PostFX renders into. Its texture is left in its default, LINEAR,
   colour space on purpose: marking it sRGB would make r128 encode on write and the post
   pass would then encode again. */
function createSceneTarget(renderer, width, height) {
  return new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat, type: sceneTargetType(renderer),
  });
}

/* A texture whose texels are AUTHORED COLOUR — a painted canvas, a sprite, an atlas —
   rather than data. Every legacy canvas texture goes through this, because a canvas is
   painted with CSS colours and CSS colours are sRGB. The spelling lives in the asset
   pipeline's `markTextureSrgb`; this is the name the rendering side calls it by. */
function markColorTexture(tex) {
  return markTextureSrgb(tex);
}

/* Everything a test or a debug overlay needs to say what the pipeline is actually doing. */
function colorPipelineReport(renderer, target) {
  const api = _assetUsesColorSpaceApi();
  return {
    revision: typeof THREE !== 'undefined' ? String(THREE.REVISION) : null,
    colorManagement: colorManagementMode(),
    api: api ? 'colorSpace' : 'encoding',
    rendererOutput: renderer ? String(api ? renderer.outputColorSpace : renderer.outputEncoding) : null,
    srgbName: String(api ? THREE.SRGBColorSpace : THREE.sRGBEncoding),
    targetType: target && target.texture ? target.texture.type : null,
    targetHalfFloat: !!(target && target.texture && target.texture.type === THREE.HalfFloatType),
    targetColor: target && target.texture
      ? String(api ? target.texture.colorSpace : target.texture.encoding) : null,
  };
}
