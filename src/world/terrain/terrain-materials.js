"use strict";
/* =====================================================================================
   D1 TERRAIN — MATERIALS
   ERA 2, PHASE E2.2 — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   FOUNDATION MATERIALS, AND THE WORD IS LOAD-BEARING

   These are **not** the final D1 surfaces. VISUAL_RULE_BIBLE sections 6, 7, 9 and 11 ask
   for physically grounded response, restrained surface detail, coherent texture density
   and an earthy weathered rural palette — all of which arrive with authored albedo,
   roughness and normal maps, and none of which is authored yet. E2.0a built the pipeline
   that will carry them; the asset policy for this phase says do not build the production
   library.

   So what ships is one PBR material per surface class, untextured, with colour and
   roughness chosen inside the bible's palette so the terrain reads as ground rather than
   as a grey engine demo — and every one of them is REPLACED, not tuned, when the real
   surfaces exist. `terrainMaterialStatus()` reports that in as many words, and
   `tests/terrain.js` asserts the status stays honest.

   ─────────────────────────────────────────────────────────────────────────────────────
   ONE MATERIAL PER SURFACE, SHARED ACROSS EVERY REGION

   CLAUDE.md section 72: shared resources, no unique material per object. Six materials
   exist for the whole world however many regions are resident, so a region's disposal
   frees its GEOMETRY and never touches a material — which is exactly the shared-resource
   rule E2.0a's library follows, applied to terrain.

   Vertex colours carry the per-point surface blend, so one draw call covers a region with
   six surface types in it rather than six draw calls or a splat shader. That is the cheap
   correct answer at this fidelity and it is replaced along with the materials.

   CLASSIC script. See src/world/terrain/LAYER.md.
   ===================================================================================== */

/* Palette in linear-ish sRGB hex, inside VISUAL_RULE_BIBLE section 11's D1 identity:
   grasses, soil, wood, agricultural structures, overcast weathered materials. Desaturated
   — a saturated green field is the single fastest way to look like a toy. */
const D1_SURFACE_STYLE = Object.freeze({
  [D1_SURFACE.FIELD]:   Object.freeze({ color: 0x6b6f43, roughness: 0.92, name: 'field'   }),
  [D1_SURFACE.SOIL]:    Object.freeze({ color: 0x5a4a38, roughness: 0.96, name: 'soil'    }),
  [D1_SURFACE.ROAD]:    Object.freeze({ color: 0x6e6860, roughness: 0.88, name: 'road'    }),
  [D1_SURFACE.VERGE]:   Object.freeze({ color: 0x66684a, roughness: 0.94, name: 'verge'   }),
  [D1_SURFACE.LOWLAND]: Object.freeze({ color: 0x4a5040, roughness: 0.90, name: 'lowland' }),
  [D1_SURFACE.ROCK]:    Object.freeze({ color: 0x70706a, roughness: 0.80, name: 'rock'    }),
});

let _d1Materials = null;

/* THE ONE TERRAIN MATERIAL, built lazily and shared by every region.

   One material, vertex-coloured. `vertexColors` lets the mesh builder write the surface
   blend per vertex, so a field running into a road running into a ditch is one geometry
   and one draw call. */
function d1TerrainMaterial() {
  if (_d1Materials && _d1Materials.terrain) return _d1Materials.terrain;
  if (!_d1Materials) _d1Materials = {};
  _d1Materials.terrain = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.93,
    metalness: 0.0,
    flatShading: false,
  });
  _d1Materials.terrain.name = 'd1-terrain-foundation';
  return _d1Materials.terrain;
}

/* Standing water in the lowlands. One shared material, deliberately plain: real water
   treatment is a lighting-and-shader question and belongs with E2.5. */
function d1WaterMaterial() {
  if (_d1Materials && _d1Materials.water) return _d1Materials.water;
  if (!_d1Materials) _d1Materials = {};
  _d1Materials.water = new THREE.MeshStandardMaterial({
    color: 0x3a4440, roughness: 0.22, metalness: 0.0,
    transparent: true, opacity: 0.82,
  });
  _d1Materials.water.name = 'd1-water-foundation';
  return _d1Materials.water;
}

/* The vertex colour for a surface class, as LINEAR {r,g,b} in 0..1.

   D1 PHASE 4 — the palette above is hex, and hex is sRGB, so each channel is decoded once
   here exactly as a THREE.Color decodes a hex (src/shared/color-transfer.js). Unpacked raw,
   the display values went into the shader as linear light and the terrain rendered pale
   and washed out on the corrected renderer. Vertex colours are the one colour input
   three never decodes for you. */
function d1SurfaceColor(surface) {
  const style = D1_SURFACE_STYLE[surface] || D1_SURFACE_STYLE[D1_SURFACE.FIELD];
  const c = style.color;
  return { r: srgbToLinear(((c >> 16) & 255) / 255), g: srgbToLinear(((c >> 8) & 255) / 255),
           b: srgbToLinear((c & 255) / 255) };
}

/* Shared materials are owned by the MODULE, not by a region, and are freed only on a full
   teardown — never when a region unloads. Disposing a shared material because one of its
   users went away is the exact bug E2.0a's reference counting exists to prevent. */
function d1DisposeTerrainMaterials() {
  if (!_d1Materials) return 0;
  let n = 0;
  for (const k of Object.keys(_d1Materials)) {
    const m = _d1Materials[k];
    if (m && m.dispose) { m.dispose(); n++; }
  }
  _d1Materials = null;
  return n;
}

/* Honest status, for the phase report and for anyone who opens this file later. */
function terrainMaterialStatus() {
  return {
    stage: 'FOUNDATION',
    textured: false,
    note: 'Untextured PBR stand-ins inside the D1 palette. Replaced wholesale when the ' +
          'authored surface library exists; not the final D1 look.',
    surfaces: Object.keys(D1_SURFACE_STYLE).length,
  };
}
