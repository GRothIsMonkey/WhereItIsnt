"use strict";
/* =====================================================================================
   ASSET MEASUREMENT — WHAT SOMETHING ACTUALLY COSTS
   D1 IMPLEMENTATION PHASE 3 — NEW. **Measurement only. No rules, no verdicts, no opinions.**

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY MEASUREMENT IS ITS OWN FILE

   `asset-budgets.js` is arithmetic over numbers. This file is where the numbers come from.
   Keeping them apart is what lets the budget model be tested without a renderer, a GLB or
   a browser, and it is why the validator cannot quietly redefine a metric to make an asset
   pass.

   **ONE COUNTING DEFINITION, USED EVERYWHERE.** `countNodeTriangles` is the only place in
   this repository that decides what a triangle is. The asset validator uses it, the live
   scene statistics use it, and `normalizeAssetMaterials` uses it — which matters, because
   that function had its own inline count that also counted a `Points` cloud's vertices as
   triangles. Two counts that disagree is the failure CLAUDE.md sections 61.05-61.07 name
   three times in the audio system, in a new place.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT A TRIANGLE IS, EXACTLY

   Stated rather than implied, because every one of these is a real choice:

     COUNTED      `node.isMesh` with a geometry. Indexed geometry counts `index.count / 3`;
                  non-indexed counts `attributes.position.count / 3`.

     NOT COUNTED  `isPoints` and `isLine`. They have no triangles. Their vertex counts are
                  reported separately so a points-heavy asset is still visible.

     GROUPS       do NOT multiply. A geometry's `groups` PARTITION one index buffer between
                  materials; the triangles are drawn once. A mesh with a four-material array
                  is one geometry's worth of triangles, not four.

     INSTANCING   an `InstancedMesh` counts its SOURCE geometry once and reports `instances`
                  separately. A budget is about the mesh an artist authored — the count they
                  can actually change — and multiplying by an instance count would make the
                  same model pass or fail depending on how many were planted.

     SHARED       a geometry used by three meshes counts three times, because it is DRAWN
                  three times. `uniqueGeometries` reports the upload cost separately.

     HIDDEN       `visible === false`, and everything under it, is excluded and reported
                  under `hidden`. An exporter's hidden helper geometry is not what the
                  player sees, and section 9.1's budgets are about what the player sees.

     COLLISION    a node with `userData.collisionOnly === true`, and everything under it, is
                  excluded and reported under `collisionOnly`. **This project declares
                  collision as boxes in the registry and has no collision meshes** (see
                  src/assets/LAYER.md — there is deliberately no `mesh` collision mode), so
                  today this branch is dead. It exists because the moment a DCC exports one,
                  the alternative is a landmark whose triangle budget silently includes
                  geometry the player can never see.

   ─────────────────────────────────────────────────────────────────────────────────────
   IT DOES NOT MUTATE, AND WHERE IT MIGHT, IT ASKS

   `measureAssetGeometry` updates world matrices by default, because an asset that has just
   been loaded and placed may not have them yet and a texel-density number computed from a
   stale matrix is wrong rather than unavailable.

   `measureSceneResources` does NOT, and must not: it is pointed at the LIVE scene, which
   the renderer has already updated this frame, and a measurement tool that writes to the
   thing it is measuring is not a measurement tool. CLAUDE.md section 62.11's rule, in a new
   place: a phase that changes how a value is OBTAINED owes proof it changed nothing else.

   ─────────────────────────────────────────────────────────────────────────────────────
   IT NAMES NO `THREE`, AND THAT IS LOAD-BEARING

   Every read here is a duck-typed property — `isMesh`, `geometry.index.count`,
   `matrixWorld.elements`. So this file measures a three.js scene today and measures
   whatever Era 2's renderer rebirth produces tomorrow, as long as that thing still has
   meshes with positions. `tests/architecture.js` locks it at zero.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.13 and src/assets/LAYER.md.
   ===================================================================================== */

/* How many triangles a texel-density estimate may sample from one mesh before it starts
   striding. A STRIDE, never a random sample — CLAUDE.md section 11: apparent randomness in
   anything persistent must be derived, and a measurement that changes between runs is not
   a measurement. */
const ASSET_TEXEL_SAMPLE_CAP = 4096;

/* Below this world-space area a triangle contributes nothing but floating-point noise to a
   density ratio. One square micrometre. */
const ASSET_AREA_EPSILON = 1e-12;

/* Default tolerance for "did this number actually move" in a baseline comparison. Two per
   cent: below the run-to-run drift of anything that streams. */
const ASSET_COMPARE_TOLERANCE = 0.02;

/* ---- PRIMITIVES -------------------------------------------------------------------- */

/* THE ONE TRIANGLE COUNT. Returns 0 for anything that is not a mesh with geometry. */
function countNodeTriangles(node) {
  if (!node || !node.isMesh) return 0;
  const g = node.geometry;
  if (!g) return 0;
  if (g.index && typeof g.index.count === 'number') return Math.floor(g.index.count / 3);
  const pos = g.attributes && g.attributes.position;
  if (pos && typeof pos.count === 'number') return Math.floor(pos.count / 3);
  return 0;
}

function countNodeVertices(node) {
  const g = node && node.geometry;
  const pos = g && g.attributes && g.attributes.position;
  return (pos && typeof pos.count === 'number') ? pos.count : 0;
}

/* A texture's pixel dimensions, or null when this build cannot tell.

   Three spellings, because three.js has had three: `image` on an ordinary texture,
   `source.data` since r152, and `image.data` plus explicit width/height on a compressed
   one. Returning NULL rather than a guess is the point — `asset-budgets.js` turns null
   into `unavailable`, and an invented 512 would turn a missing measurement into a pass. */
function assetTextureSize(tex) {
  if (!tex) return null;
  const candidates = [tex.image, tex.source && tex.source.data, tex.mipmaps && tex.mipmaps[0]];
  for (const c of candidates) {
    if (!c) continue;
    const w = c.width, h = c.height;
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) return { w, h };
  }
  if (typeof tex.width === 'number' && typeof tex.height === 'number' &&
      tex.width > 0 && tex.height > 0) return { w: tex.width, h: tex.height };
  return null;
}

/* Every texture one material points at, in a stable order (the material's own key order,
   which for a given three.js build is fixed). */
function materialTextures(m) {
  const out = [];
  if (!m) return out;
  for (const key of Object.keys(m)) {
    const v = m[key];
    if (v && v.isTexture) out.push(v);
  }
  return out;
}

function materialsOf(node) {
  const m = node && node.material;
  if (!m) return [];
  return Array.isArray(m) ? m.filter(Boolean) : [m];
}

/* Should this node and its subtree be measured at all? Returns a reason string when not,
   so the caller can attribute what it skipped rather than silently losing it. */
function assetSkipReason(node) {
  if (!node) return 'null';
  if (node.visible === false) return 'hidden';
  if (node.userData && node.userData.collisionOnly === true) return 'collisionOnly';
  return null;
}

/* Multiply a point by a column-major 4x4, with the perspective divide. Written out rather
   than borrowed from THREE so this file stays renderer-agnostic — see the header. */
function applyMatrix4ToPoint(e, x, y, z, out) {
  const w = e[3] * x + e[7] * y + e[11] * z + e[15] || 1;
  out[0] = (e[0] * x + e[4] * y + e[8] * z + e[12]) / w;
  out[1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w;
  out[2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) / w;
  return out;
}

/* ---- GEOMETRY ---------------------------------------------------------------------- */

/* WALK A SUBTREE AND COUNT IT. Deterministic: sums only, no Map iteration affects a number,
   and identical input gives an identical object every time.

   The traversal is written by hand rather than through `Object3D.traverse` because traverse
   cannot be stopped at a subtree, and "hidden means hidden, including its children" is one
   of the counting rules above. */
function measureAssetGeometry(root, opts) {
  const o = opts || {};
  const out = {
    meshes: 0, triangles: 0, vertices: 0,
    instancedMeshes: 0, instances: 0,
    points: 0, pointVertices: 0, lines: 0, lineVertices: 0,
    uniqueGeometries: 0, drawGroups: 0,
    hidden: { meshes: 0, triangles: 0 },
    collisionOnly: { meshes: 0, triangles: 0 },
    nodes: 0,
  };
  if (!root) return out;
  if (o.updateMatrices !== false && root.updateMatrixWorld) root.updateMatrixWorld(true);

  const geoms = new Set();

  const excluded = (node, why) => {
    /* Attribute the whole skipped subtree, so a number that vanished is still visible. */
    const bucket = why === 'hidden' ? out.hidden : out.collisionOnly;
    const walk = (n) => {
      if (!n) return;
      if (n.isMesh) { bucket.meshes++; bucket.triangles += countNodeTriangles(n); }
      const kids = n.children || [];
      for (let i = 0; i < kids.length; i++) walk(kids[i]);
    };
    walk(node);
  };

  const visit = (node) => {
    if (!node) return;
    const skip = assetSkipReason(node);
    if (skip) { excluded(node, skip); return; }
    out.nodes++;

    if (node.isMesh) {
      out.meshes++;
      const t = countNodeTriangles(node);
      out.triangles += t;
      out.vertices += countNodeVertices(node);
      if (node.geometry) {
        geoms.add(node.geometry);
        const groups = node.geometry.groups;
        out.drawGroups += (groups && groups.length) ? groups.length : 1;
      }
      if (node.isInstancedMesh) {
        out.instancedMeshes++;
        out.instances += (typeof node.count === 'number' ? node.count : 0);
      }
    } else if (node.isPoints) {
      out.points++; out.pointVertices += countNodeVertices(node);
    } else if (node.isLine) {
      out.lines++; out.lineVertices += countNodeVertices(node);
    }

    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) visit(kids[i]);
  };
  visit(root);

  out.uniqueGeometries = geoms.size;
  return out;
}

/* ---- MATERIALS AND TEXTURES -------------------------------------------------------- */

/* WHAT THIS SUBTREE ASKS THE GPU TO HOLD, and how much of it is duplication.

     materialSlots      every material reference across every visible mesh
     uniqueMaterials    distinct material OBJECTS
     materialSignatures distinct RENDERED materials — two objects that would draw
                        identically collapse to one here
     duplicateMaterials uniqueMaterials - materialSignatures. **This is the number CLAUDE.md
                        section 72 is about**: an exporter routinely emits one material per
                        mesh when forty are identical, and forty identical materials are
                        forty shader programs.
     sharedMaterialUses materialSlots - uniqueMaterials. Reuse that is already happening.

   `materialSignature` comes from asset-materials.js and is named from inside this function
   body, which is the classic-script rule ARCHITECTURE.md section 0 states. Guarded, because
   this module is also loaded alone by tests. */
function measureAssetMaterials(root, opts) {
  const o = opts || {};
  const out = {
    materialSlots: 0, uniqueMaterials: 0, materialSignatures: 0,
    duplicateMaterials: 0, sharedMaterialUses: 0,
    textures: 0, textureSlots: 0, maxTextureDim: null, textureDims: [],
    missingTextureData: 0, unknownTextureSize: 0,
  };
  if (!root) return out;

  const mats = new Set();
  const sigs = new Set();
  const texs = new Set();
  const sizes = [];
  const canSign = (typeof materialSignature === 'function');

  const visit = (node) => {
    if (!node) return;
    if (assetSkipReason(node)) return;
    if (node.isMesh || node.isPoints || node.isLine) {
      for (const m of materialsOf(node)) {
        out.materialSlots++;
        if (mats.has(m)) continue;
        mats.add(m);
        if (canSign) sigs.add(materialSignature(m));
        for (const t of materialTextures(m)) {
          out.textureSlots++;
          if (texs.has(t)) continue;
          texs.add(t);
          const s = assetTextureSize(t);
          if (!s) {
            /* A texture with no resolvable image is either still decoding or a broken
               reference. Both are worth reporting; neither is a dimension. */
            if (t.image === undefined && !(t.source && t.source.data)) out.missingTextureData++;
            else out.unknownTextureSize++;
          } else {
            sizes.push(Math.max(s.w, s.h));
          }
        }
      }
    }
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) visit(kids[i]);
  };
  visit(root);

  out.uniqueMaterials = mats.size;
  out.materialSignatures = canSign ? sigs.size : mats.size;
  out.duplicateMaterials = Math.max(0, out.uniqueMaterials - out.materialSignatures);
  out.sharedMaterialUses = Math.max(0, out.materialSlots - out.uniqueMaterials);
  out.textures = texs.size;
  /* Sorted so the list is identical between runs regardless of traversal order of equal
     sizes — determinism is a property this file promises. */
  out.textureDims = sizes.slice().sort((a, b) => a - b);
  out.maxTextureDim = sizes.length ? Math.max.apply(null, sizes) : null;
  if (o.signatures === false) out.materialSignatures = null;
  return out;
}

/* ---- TEXEL DENSITY ----------------------------------------------------------------- */

/* PIXELS OF TEXTURE PER METRE OF SURFACE, ESTIMATED, AND HONEST ABOUT BEING AN ESTIMATE.

   THE FORMULA. For one triangle:

       texels = uvArea * texWidth * texHeight          (UV space is the unit square)
       metres² = worldArea                             (positions through matrixWorld)

   summed over every sampled triangle of every mesh whose material has a base-colour map,
   and then

       px/m = sqrt( totalTexels / totalWorldArea )

   The square root is because density is per LINEAR metre and the ratio above is per square
   metre. Each mesh contributes at ITS OWN map's dimensions, so an asset with a 2K body map
   and a 512 detail map is weighted correctly rather than measured against whichever texture
   happened to be biggest.

   WHAT MAKES IT AN ESTIMATE, stated rather than buried:
     - UV area counts OVERLAP twice. Mirrored or stacked UV shells report denser than they
       are. This is the largest single source of error and there is no cheap fix.
     - Only meshes with a `map` are sampled. An untextured mesh has no density.
     - Above ASSET_TEXEL_SAMPLE_CAP triangles per mesh it STRIDES. Deterministic, and both
       areas come from the same sampled triangles so the ratio stays right.
     - Non-uniform scale is handled correctly (the world matrix is applied to the positions
       before the area is taken), but a texture repeated by `repeat` is not.

   THE RETURN IS A STATE, NOT A NUMBER WITH A FALLBACK:

       { status: 'measured',    pxPerMetre, worldArea, texels, samples, meshes }
       { status: 'unavailable', why }      no UVs, no map, no dimensions, no area
       { status: 'invalid',     why }      the arithmetic produced something impossible

   `unavailable` and `over guidance` are DIFFERENT ANSWERS and the difference matters: one
   is a gap in the data and the other is a finding about the asset. Inventing a number to
   avoid saying "unavailable" is the thing this shape exists to prevent. */
function measureAssetTexelDensity(root, opts) {
  const o = opts || {};
  if (!root) return { status: 'unavailable', why: 'no root' };
  if (o.updateMatrices !== false && root.updateMatrixWorld) root.updateMatrixWorld(true);

  let texels = 0, worldArea = 0, samples = 0, meshes = 0;
  let sawMesh = false, sawUv = false, sawMap = false, sawSize = false;

  const pa = [0, 0, 0], pb = [0, 0, 0], pc = [0, 0, 0];

  const visit = (node) => {
    if (!node) return;
    if (assetSkipReason(node)) return;
    if (node.isMesh && node.geometry) {
      sawMesh = true;
      const g = node.geometry;
      const pos = g.attributes && g.attributes.position;
      const uv = g.attributes && (g.attributes.uv || g.attributes.uv1 || g.attributes.uv2);
      if (uv) sawUv = true;
      /* The base-colour map is what texel density is ABOUT — it is the map whose pixels the
         player resolves. A normal map at a different resolution is a separate decision. */
      let dims = null;
      for (const m of materialsOf(node)) {
        if (m && m.map) {
          sawMap = true;
          const s = assetTextureSize(m.map);
          if (s) { sawSize = true; dims = s; break; }
        }
      }
      if (pos && uv && dims) {
        const idx = g.index;
        const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
        const stride = Math.max(1, Math.ceil(triCount / ASSET_TEXEL_SAMPLE_CAP));
        const e = (node.matrixWorld && node.matrixWorld.elements) ? node.matrixWorld.elements : null;
        let used = 0;
        for (let t = 0; t < triCount; t += stride) {
          const i0 = idx ? idx.getX(t * 3) : t * 3;
          const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
          const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

          if (e) {
            applyMatrix4ToPoint(e, pos.getX(i0), pos.getY(i0), pos.getZ(i0), pa);
            applyMatrix4ToPoint(e, pos.getX(i1), pos.getY(i1), pos.getZ(i1), pb);
            applyMatrix4ToPoint(e, pos.getX(i2), pos.getY(i2), pos.getZ(i2), pc);
          } else {
            pa[0] = pos.getX(i0); pa[1] = pos.getY(i0); pa[2] = pos.getZ(i0);
            pb[0] = pos.getX(i1); pb[1] = pos.getY(i1); pb[2] = pos.getZ(i1);
            pc[0] = pos.getX(i2); pc[1] = pos.getY(i2); pc[2] = pos.getZ(i2);
          }
          const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2];
          const vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
          const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
          const wArea = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
          if (!(wArea > ASSET_AREA_EPSILON)) continue;

          const au = uv.getX(i0), av = uv.getY(i0);
          const bu = uv.getX(i1), bv = uv.getY(i1);
          const cu = uv.getX(i2), cv = uv.getY(i2);
          const uvArea = Math.abs((bu - au) * (cv - av) - (cu - au) * (bv - av)) * 0.5;

          worldArea += wArea;
          texels += uvArea * dims.w * dims.h;
          used++;
        }
        if (used) { samples += used; meshes++; }
      }
    }
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) visit(kids[i]);
  };
  visit(root);

  if (!sawMesh) return { status: 'unavailable', why: 'no visible mesh' };
  if (!sawMap) return { status: 'unavailable', why: 'no base-colour map on any material' };
  if (!sawSize) return { status: 'unavailable', why: 'texture dimensions unknown' };
  if (!sawUv) return { status: 'unavailable', why: 'no UV attribute' };
  if (!samples) return { status: 'unavailable', why: 'no triangle with both UVs and a sized map' };
  if (!(worldArea > ASSET_AREA_EPSILON)) return { status: 'unavailable', why: 'degenerate world area' };

  const px = Math.sqrt(texels / worldArea);
  if (!isFinite(px) || px <= 0) return { status: 'invalid', why: 'non-finite density' };
  return { status: 'measured', pxPerMetre: px, worldArea, texels, samples, meshes };
}

/* ---- ONE CALL, ONE ASSET ----------------------------------------------------------- */

/* Everything `validateAssetBudget` needs, from one subtree, in one pass-shaped call. The
   flat fields at the top are the validator's inputs; the nested ones are the evidence. */
function measureAsset(root, opts) {
  const geometry = measureAssetGeometry(root, opts);
  const materials = measureAssetMaterials(root, opts);
  const texel = measureAssetTexelDensity(root, Object.assign({}, opts, { updateMatrices: false }));
  return {
    triangles: geometry.triangles,
    maxTextureDim: materials.maxTextureDim,
    texelDensity: texel.status === 'measured' ? texel.pxPerMetre : null,
    texelStatus: texel.status,
    texelWhy: texel.why || null,
    lods: (opts && Array.isArray(opts.lods)) ? opts.lods : null,
    geometry, materials, texel,
  };
}

/* ---- THE LIVE SCENE ---------------------------------------------------------------- */

/* WHAT IS RESIDENT RIGHT NOW. Explicitly called, never scheduled.

   **THIS IS NOT A FRAME LOOP AND MUST NOT BECOME ONE.** CLAUDE.md section 14: a per-frame
   global scan is exactly the cost this project refuses. It is a tool a test calls and a
   developer types into a console — every function in this file is a top-level `function`
   declaration, so a served page can call them from the console without a debug command
   being added to the build. `tests/budgets.js` asserts there is no call site in the whole
   build, and `tests/browser-budgets.js` asserts the stronger version live: three seconds of
   real gameplay call them zero times.

   **STREAMING IS RESPECTED BY CONSTRUCTION.** It counts the scene graph as it stands, so a
   region that has been removed and disposed is not in it and is not counted, and a region
   still resident but hidden is counted under `hidden` rather than as live cost. There is no
   registry of "things that were ever loaded" to go stale.

   `renderer.info` is reported SEPARATELY and labelled as the renderer's own numbers, because
   they mean something different: the traversal above is what is RESIDENT, and `render.*` is
   what was DRAWN after culling. Reporting one as the other is how a draw-call budget starts
   lying. Measured live on the Overworld: 546,096 resident, 190,722 drawn across 367 calls.

   **AND `render.*` DESCRIBES THE LAST RENDER CALL, NOT THE LAST FRAME.** This build's frame
   ends with the PostFX full-screen quad, so reading it at an arbitrary moment reports ONE
   DRAW CALL AND TWO TRIANGLES — the post pass. That is not a broken measurement; it is the
   correct answer to a differently-phrased question, and a caller who wants the world's
   numbers renders the world and reads immediately after. Written down because it looks
   exactly like a bug and is not one.

   When no renderer is passed, that half is `unavailable` rather than zero. */
function measureSceneResources(scene, renderer, opts) {
  const o = opts || {};
  const geometry = measureAssetGeometry(scene, Object.assign({ updateMatrices: false }, o));
  const materials = measureAssetMaterials(scene, o);
  const out = {
    scene: {
      nodes: geometry.nodes,
      meshes: geometry.meshes,
      triangles: geometry.triangles,
      vertices: geometry.vertices,
      uniqueGeometries: geometry.uniqueGeometries,
      drawGroups: geometry.drawGroups,
      instancedMeshes: geometry.instancedMeshes,
      instances: geometry.instances,
      hiddenMeshes: geometry.hidden.meshes,
      hiddenTriangles: geometry.hidden.triangles,
      materials: materials.uniqueMaterials,
      materialSignatures: materials.materialSignatures,
      duplicateMaterials: materials.duplicateMaterials,
      textures: materials.textures,
      maxTextureDim: materials.maxTextureDim,
    },
    renderer: null,
  };
  if (renderer && renderer.info) {
    const i = renderer.info;
    out.renderer = {
      available: true,
      drawCalls: i.render ? i.render.calls : null,
      drawnTriangles: i.render ? i.render.triangles : null,
      drawnPoints: i.render ? i.render.points : null,
      drawnLines: i.render ? i.render.lines : null,
      geometriesResident: i.memory ? i.memory.geometries : null,
      texturesResident: i.memory ? i.memory.textures : null,
      programs: (i.programs && typeof i.programs.length === 'number') ? i.programs.length : null,
    };
  } else {
    out.renderer = { available: false, why: 'no renderer passed' };
  }
  return out;
}

/* ---- BASELINE COMPARISON ----------------------------------------------------------- */

/* DID THIS CHANGE MATERIALLY INCREASE WHAT THE WORLD COSTS?

   Compares two measurements taken the same way and reports the delta per field. It asserts
   NOTHING and sets no threshold on what is acceptable: CLAUDE.md section 79 forbids
   claiming a performance budget from one machine, and a triangle count is not a frame rate.
   What it gives a future phase is the ability to say "this added 40,000 triangles" instead
   of "this feels heavier".

   `tolerance` is a fraction; a field that moved by less is `changed: false`. Only numeric
   fields are compared; anything else is reported as `incomparable` rather than skipped, so
   a field that changed TYPE is visible. */
function compareResourceMeasurements(baseline, current, opts) {
  const o = opts || {};
  const tol = typeof o.tolerance === 'number' ? o.tolerance : ASSET_COMPARE_TOLERANCE;
  const out = { fields: {}, changed: [], tolerance: tol, incomparable: [] };
  const a = (baseline && baseline.scene) ? baseline.scene : baseline;
  const b = (current && current.scene) ? current.scene : current;
  if (!a || !b) return out;

  const keys = Object.keys(a).concat(Object.keys(b).filter((k) => !(k in a))).sort();
  for (const k of keys) {
    const from = a[k], to = b[k];
    if (typeof from !== 'number' || typeof to !== 'number') {
      out.incomparable.push(k);
      out.fields[k] = { from: from === undefined ? null : from, to: to === undefined ? null : to,
                        delta: null, ratio: null, changed: from !== to };
      if (from !== to) out.changed.push(k);
      continue;
    }
    const delta = to - from;
    const ratio = from === 0 ? (to === 0 ? 1 : Infinity) : to / from;
    const changed = from === 0 ? to !== 0 : Math.abs(delta / from) > tol;
    out.fields[k] = { from, to, delta, ratio, changed };
    if (changed) out.changed.push(k);
  }
  return out;
}
