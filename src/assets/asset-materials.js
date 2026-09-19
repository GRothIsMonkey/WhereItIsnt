"use strict";
/* =====================================================================================
   ASSET MATERIALS — WHAT AN IMPORTED MODEL'S SURFACES BECOME
   ERA 2, PHASE E2.0a — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   A GLB ARRIVES WITH ITS AUTHOR'S OPINIONS. THIS IS WHERE THEY BECOME THIS GAME'S.

   glTF is an interchange format: an exporter decides filtering, wrap modes, face sides,
   whether shadows are cast, and — the one that actually matters — what COLOUR SPACE each
   texture is in. Left alone, twelve assets from twelve authors render twelve different
   ways under the same light, and the difference reads as bad art rather than as an
   unconfigured importer.

   So every asset goes through one function on the way in, and the policy lives in one
   frozen table rather than in the loader.

   ─────────────────────────────────────────────────────────────────────────────────────
   COLOUR SPACE IS THE ONE THAT IS SILENTLY WRONG

   Base colour and emissive are AUTHORED in sRGB. Normal, roughness, metalness and AO are
   DATA — linear — and pushing them through an sRGB decode bends every value. GLTFLoader
   sets this correctly for the maps it recognises; it cannot for anything it does not, and
   a wrong one produces art that looks slightly off in a way nobody can point at.

   Written against BOTH three.js generations deliberately. r128 spells it `texture.encoding
   = THREE.sRGBEncoding`; r152+ spells it `texture.colorSpace = THREE.SRGBColorSpace`, and
   the r128 spelling is GONE in r186. This file asks which one exists rather than assuming,
   which is what lets the pipeline outlive the version decision recorded in
   vendor/three/README.md.

   ─────────────────────────────────────────────────────────────────────────────────────
   DEDUPLICATION IS SECTION 72, MECHANISED

   CLAUDE.md section 72: avoid creating a unique material for every object. An exporter
   routinely emits one material per mesh even when forty of them are identical, and forty
   identical materials are forty shader programs and forty uniform uploads. Materials with
   the same SIGNATURE — same maps, same colour, same numbers — collapse to one instance
   inside an asset, and the count is reported so the saving is a measurement rather than a
   claim.

   It is deliberately scoped WITHIN one asset. Interning across assets would couple two
   models' lifetimes together and turn a disposal into a hunt for who else is using it,
   which is the bug this layer's refcounting exists to prevent.

   CLASSIC script. See src/assets/LAYER.md.
   ===================================================================================== */

/* The whole policy, in one place. No number in here is an art decision — they are import
   correctness, and the art direction they serve is recorded in ERA2-PLAN.md. */
const ASSET_MATERIAL_POLICY = Object.freeze({
  anisotropy: 4,            // cheap, and the difference on a ground-angle texture is large
  castShadow: true,
  receiveShadow: true,
  /* Which material slots hold AUTHORED COLOUR rather than data. Everything not named here
     is left linear, which is the correct default for a data map. */
  srgbSlots: Object.freeze(['map', 'emissiveMap', 'specularMap']),
});

/* Does this three.js build use the modern colour-space API? Asked once per call rather
   than cached at load time, because a module may not name THREE at load time — the
   classic-script rule ARCHITECTURE.md states and tests/architecture.js enforces. */
function _assetUsesColorSpaceApi() {
  return typeof THREE !== 'undefined' && THREE.SRGBColorSpace !== undefined;
}

/* Mark one texture as authored colour, in whichever spelling this build understands. */
function markTextureSrgb(tex) {
  if (!tex) return false;
  if (_assetUsesColorSpaceApi()) {
    tex.colorSpace = THREE.SRGBColorSpace;
  } else if (THREE.sRGBEncoding !== undefined) {
    tex.encoding = THREE.sRGBEncoding;
  } else {
    return false;
  }
  tex.needsUpdate = true;
  return true;
}

/* A stable identity for a material, so two that would render identically can become one.
   Built from what actually reaches the shader — maps by uuid, colours by hex, numbers as
   they are. Two materials with the same signature are interchangeable by construction. */
function materialSignature(m) {
  if (!m) return 'null';
  const t = (x) => (x && x.uuid) ? x.uuid : '-';
  const c = (x) => (x && x.getHexString) ? x.getHexString() : '-';
  return [
    m.type,
    c(m.color), c(m.emissive),
    t(m.map), t(m.normalMap), t(m.roughnessMap), t(m.metalnessMap), t(m.aoMap),
    t(m.emissiveMap), t(m.alphaMap),
    m.roughness, m.metalness, m.opacity, m.transparent ? 1 : 0,
    m.side, m.alphaTest, m.flatShading ? 1 : 0, m.vertexColors ? 1 : 0,
  ].join('|');
}

/* Walk one loaded asset and make it this game's. Returns a report — counts, not
   opinions — so a test and the measurement tool can both read what happened.

   MUTATES the source object the library caches, deliberately and exactly once: every
   instance is a clone of it, so normalising here means every instance is already correct
   and no per-instance work exists to forget. */
function normalizeAssetMaterials(root, opts) {
  const o = opts || {};
  const policy = ASSET_MATERIAL_POLICY;
  const report = {
    meshes: 0, materialsBefore: 0, materialsAfter: 0, deduped: 0,
    textures: 0, srgbMarked: 0, triangles: 0, normalized: 0,
  };
  if (!root) return report;

  const seenMat = new Set();
  const seenTex = new Set();
  const bySignature = new Map();

  root.traverse((node) => {
    if (!node.isMesh && !node.isPoints && !node.isLine) return;
    report.normalized++;
    node.castShadow = o.castShadow !== undefined ? o.castShadow : policy.castShadow;
    node.receiveShadow = o.receiveShadow !== undefined ? o.receiveShadow : policy.receiveShadow;

    const mats = Array.isArray(node.material) ? node.material : [node.material];
    const out = [];
    for (const m of mats) {
      if (!m) { out.push(m); continue; }
      if (!seenMat.has(m.uuid)) {
        seenMat.add(m.uuid);
        report.materialsBefore++;
        /* Colour space first — the signature reads texture uuids, and marking a texture
           does not change its uuid, so order is not load-bearing here. It is done first
           anyway so that a material kept by dedup is already correct. */
        for (const slot of policy.srgbSlots) {
          const tex = m[slot];
          if (tex && !seenTex.has(tex.uuid)) { if (markTextureSrgb(tex)) report.srgbMarked++; }
        }
        for (const key of Object.keys(m)) {
          const v = m[key];
          if (v && v.isTexture && !seenTex.has(v.uuid)) {
            seenTex.add(v.uuid);
            report.textures++;
            if (v.anisotropy !== undefined) v.anisotropy = policy.anisotropy;
          }
        }
      }
      const sig = materialSignature(m);
      if (bySignature.has(sig)) {
        const keep = bySignature.get(sig);
        if (keep !== m) { report.deduped++; out.push(keep); continue; }
        out.push(keep);
      } else {
        bySignature.set(sig, m);
        out.push(m);
      }
    }
    node.material = Array.isArray(node.material) ? out : out[0];
  });

  report.materialsAfter = bySignature.size;

  /* D1 PHASE 3 — THE COUNTS COME FROM THE ONE COUNTING DEFINITION.

     This function used to count triangles inline, in the same loop that normalises
     materials, and that loop deliberately includes `isPoints` and `isLine` nodes because
     they have materials to normalise. So a points cloud's VERTEX count was being divided by
     three and added to a triangle total, and a hidden helper mesh counted as fully as a
     visible one. Neither is what section 9.1's budgets mean.

     `measureAssetGeometry` is now the only place in the build that decides what a triangle
     is (src/assets/asset-measure.js), and this report takes both of its player-facing counts
     from it. The normalising traversal above is UNCHANGED and still touches hidden nodes —
     it must, because a hidden node may be shown later and an unnormalised material is a
     rendering bug whenever it appears. `normalized` records how many nodes it touched, so
     the two numbers are both available and neither is pretending to be the other.

     Named from inside a function body, which is the classic-script rule, and guarded because
     asset-materials.js is evaluated alone by tests. */
  if (typeof measureAssetGeometry === 'function') {
    const geo = measureAssetGeometry(root, { updateMatrices: false });
    report.meshes = geo.meshes;
    report.triangles = geo.triangles;
  } else {
    report.meshes = report.normalized;
    report.triangles = Math.round(report.triangles);
  }
  return report;
}

/* Every distinct GPU-backed resource one asset owns. The disposal list, collected by
   walking rather than by trusting a loader to report it — a material reached through an
   array slot is as real as one reached directly, and a texture is only free when nothing
   in this set still points at it. */
function collectAssetResources(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  if (!root) return { geometries, materials, textures };
  root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    const mats = Array.isArray(node.material) ? node.material : (node.material ? [node.material] : []);
    for (const m of mats) {
      if (!m) continue;
      materials.add(m);
      for (const key of Object.keys(m)) {
        const v = m[key];
        if (v && v.isTexture) textures.add(v);
      }
    }
  });
  return { geometries, materials, textures };
}
