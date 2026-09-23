/* D1 IMPLEMENTATION PHASE 3 — THE VISUAL BUDGET MODEL AND ITS MEASUREMENTS, OFFLINE.

   WHAT THIS PROVES. That the numbers in `asset-budgets.js` are the numbers in
   `VISUAL_RULE_BIBLE.md` section 9.1 — parsed out of the bible, not transcribed into this
   file, so a drift in EITHER direction is a failure here; that a triangle count means one
   thing in this repository and that the definition survives indexing, groups, instancing,
   sharing, hiding and collision-only geometry; that texel density is a measurement with an
   explicit unavailable state rather than a number with a fallback; that a guideline
   produces advisory findings and the one blocking rule produces failures; that an exception
   must be stated, local and justified, and is visible in the output; and that the runtime
   statistics are deterministic and mutate nothing.

   WHAT IT CANNOT PROVE. That any of this is the right art direction — that is
   `VISUAL_RULE_BIBLE.md`'s job and a person's. And it cannot prove a real GLB measures
   correctly: nothing offline in this repository can decode one (CLAUDE.md section 62.3).
   `tests/browser-budgets.js` makes that claim, in a real Chromium, over HTTP.

   EVERY FIXTURE IN SECTIONS 1-12 IS SYNTHETIC AND BUILT IN CODE, and none of those shapes
   may become D1 content. They are duck-typed plain objects rather than THREE objects on
   purpose — the measurement modules name no THREE, and measuring a plain object is how that
   claim is proved rather than asserted.

   SECTION 13 (D1 PHASE 4) IS THE ONE EXCEPTION: the first production asset, measured from
   the shipped GLB's own vertex, index and UV buffers and its PNG headers by
   `harness/glb.js`, through the UNCHANGED `measureAsset` and `validateAssetBudget`. That is
   an offline cross-check of the geometry and texture numbers, not a substitute for
   `tests/browser-budgets.js`, which measures the same file after the real GLTFLoader has
   decoded it. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'src', 'assets');

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (m) => console.log('      ' + m);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));
const near = (a, b, eps) => Math.abs(a - b) < (eps === undefined ? 1e-6 : eps);

const read = (f) => fs.readFileSync(path.join(ASSETS, f), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* The three modules, evaluated together in a bare context with NO THREE in it at all. If
   either of the two new ones needed a renderer, this boot would throw. */
const M = (() => {
  const ctx = vm.createContext({ Math, console, Object, Array, Set, Map, isFinite, JSON, Infinity });
  ctx.globalThis = ctx;
  for (const f of ['asset-budgets.js', 'asset-measure.js', 'asset-materials.js']) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  const EXPORTS = ['ASSET_BUDGET_CLASSES', 'ASSET_BUDGET_CLASS_KEYS', 'ASSET_BUDGET_BAND',
                   'ASSET_BUDGET_STATUS', 'ASSET_BUDGET_SEVERITY', 'ASSET_BUDGET_ENFORCEMENT',
                   'ASSET_BUDGET_NEAR', 'ASSET_TEXEL_WITHIN', 'ASSET_TEXEL_NEAR',
                   'ASSET_LOD_SCHEMA', 'ASSET_EXCEPTION_METRICS',
                   'assetBudgetClass', 'assetBudgetClassKeys', 'worseAssetStatus',
                   'validateAssetException', 'bandAssetRange', 'bandAssetTexture',
                   'bandAssetTexel', 'assetBudgetStatus', 'validateAssetBudget',
                   'validateAssetLods',
                   'countNodeTriangles', 'countNodeVertices', 'assetTextureSize',
                   'measureAssetGeometry', 'measureAssetMaterials', 'measureAssetTexelDensity',
                   'measureAsset', 'measureSceneResources', 'compareResourceMeasurements',
                   'ASSET_TEXEL_SAMPLE_CAP', 'ASSET_COMPARE_TOLERANCE',
                   'normalizeAssetMaterials', 'materialSignature'];
  vm.runInContext('globalThis.__M = {' + EXPORTS.join(',') + '};', ctx);
  return ctx.__M;
})();

/* ======================================================================================
   FIXTURES — synthetic, deterministic, built in code, and not production assets.
   ==================================================================================== */
const I4 = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

function attr(array, itemSize) {
  return {
    array, itemSize, count: array.length / itemSize,
    getX: (i) => array[i * itemSize],
    getY: (i) => array[i * itemSize + 1],
    getZ: (i) => array[i * itemSize + 2],
  };
}
function geom(spec) {
  const g = { attributes: {}, index: null, groups: null };
  if (spec.positions) g.attributes.position = attr(spec.positions, 3);
  if (spec.uvs) g.attributes.uv = attr(spec.uvs, 2);
  if (spec.index) g.index = attr(spec.index, 1);
  if (spec.groups) g.groups = spec.groups;
  return g;
}
function tex(w, h, id) {
  const t = { isTexture: true, uuid: 'tex-' + (id || (w + 'x' + h)) };
  if (w > 0) t.image = { width: w, height: h };
  return t;
}
function mat(spec) {
  const m = Object.assign({ type: 'MeshStandardMaterial', uuid: 'm' + (mat._n = (mat._n || 0) + 1),
                            roughness: 1, metalness: 0, opacity: 1, transparent: false,
                            side: 0, alphaTest: 0 }, spec || {});
  return m;
}
function node(spec) {
  return Object.assign({
    children: [], visible: true, userData: {},
    matrixWorld: { elements: I4.slice() },
    updateMatrixWorld() { this._updated = (this._updated || 0) + 1; },
    /* The one Object3D method the existing normaliser uses. Unconditional, exactly like
       three.js's — it is the normaliser's job to visit hidden nodes too. */
    traverse(fn) { fn(this); for (const c of (this.children || [])) c.traverse(fn); },
  }, spec || {});
}
function mesh(g, material, extra) {
  return node(Object.assign({ isMesh: true, geometry: g, material }, extra || {}));
}
function group(children) { return node({ children }); }

/* A flat quad of `size` metres on a side in the XZ plane, UV-mapped 0..1 across the whole
   quad. Two triangles, indexed. Its texel density is therefore exactly
   sqrt(texW*texH / size^2) px/m — a number this suite can predict. */
function quad(size, uvScale) {
  const s = size, u = (uvScale === undefined ? 1 : uvScale);
  return geom({
    positions: [0,0,0,  s,0,0,  s,0,s,  0,0,s],
    uvs:       [0,0,    u,0,    u,u,    0,u],
    index:     [0,1,2, 0,2,3],
  });
}
/* n triangles, non-indexed, no UVs. For pure counting. */
function tris(n) {
  const p = [];
  for (let i = 0; i < n; i++) p.push(0,0,0, 1,0,0, 0,1,0);
  return geom({ positions: p });
}

/* ======================================================================================
   1. THE MODEL IS THE BIBLE'S NUMBERS, PARSED OUT OF THE BIBLE
   ==================================================================================== */
head('1. THE BUDGETS ARE VISUAL_RULE_BIBLE.md SECTION 9.1, PARSED');

/* NOT TRANSCRIBED INTO THIS FILE. The bible is the creative source and the code implements
   its measurable subset; if either moves without the other, this section goes red. A test
   that carried its own copy of the numbers would agree with itself forever. */
const BIBLE = fs.readFileSync(path.join(ROOT, 'VISUAL_RULE_BIBLE.md'), 'utf8');
const sec91 = (() => {
  const i = BIBLE.indexOf('# 9.1. NUMERIC BUDGETS');
  const j = BIBLE.indexOf('\n# 10.', i);
  return i >= 0 ? BIBLE.slice(i, j > i ? j : undefined) : '';
})();
chk(sec91.length > 400, 'VISUAL_RULE_BIBLE.md section 9.1 was found and read');
chk(/guidelines, not absolute hard limits/i.test(sec91),
    'and it still says the budgets are GUIDELINES — the whole reason for advisory statuses');

const num = (s) => Number(String(s).replace(/[,\s]/g, ''));
const texTarget = (s) => {
  const t = String(s).trim();
  if (/^(\d+)²$/.test(t)) return num(RegExp.$1);
  if (/(\d+)K\s*$/.test(t)) return num(RegExp.$1) * 1024;
  const m = t.match(/(\d+)K/);              // "atlas / 512–1K" — the top of the range
  if (m) return num(m[1]) * 1024;
  return null;
};
const bibleRows = {};
for (const line of sec91.split('\n')) {
  const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([\d,]+)[–-]([\d,]+)\s*\|\s*([^|]+?)\s*\|\s*$/);
  if (!m) continue;
  bibleRows[m[1].trim()] = { min: num(m[2]), max: num(m[3]), texture: texTarget(m[4]),
                             atlas: /atlas/i.test(m[4]) };
}
const rowNames = Object.keys(bibleRows);
chk(rowNames.length === 6, 'the bible table has six asset classes (' + rowNames.length + ')');
note('bible rows: ' + rowNames.join(' | '));

chk(M.ASSET_BUDGET_CLASS_KEYS.length === 6, 'and the model declares exactly six');
const byLabel = {};
for (const k of M.ASSET_BUDGET_CLASS_KEYS) byLabel[M.ASSET_BUDGET_CLASSES[k].label] = k;
chk(rowNames.every((n) => byLabel[n]),
    'every bible row joins to a model class BY ITS OWN LABEL — the join key is the bible text');

for (const name of rowNames) {
  const b = bibleRows[name], k = byLabel[name];
  if (!k) continue;
  const c = M.ASSET_BUDGET_CLASSES[k];
  chk(c.triangles.min === b.min && c.triangles.max === b.max,
      name + ': triangles ' + c.triangles.min + '-' + c.triangles.max + ' matches the bible');
  chk(c.texture.target === b.texture,
      name + ': texture target ' + c.texture.target + ' matches the bible (' + b.texture + ')');
  chk(c.atlas === b.atlas, name + ': atlas flag matches the bible (' + b.atlas + ')');
}

/* Texel density comes from the prose under the table, not from the table. */
const std = sec91.match(/Standard:\s*~?(\d+)\s*px\/m/);
const hero = sec91.match(/Hero assets?:\s*up to\s*~?(\d+)\s*px\/m/);
chk(!!std && !!hero, 'the bible states a standard and a hero texel density (' +
    (std ? std[1] : '?') + ' / ' + (hero ? hero[1] : '?') + ' px/m)');
const HERO_CLASSES = ['hero-landmark', 'major-creature'];
for (const k of M.ASSET_BUDGET_CLASS_KEYS) {
  const want = HERO_CLASSES.indexOf(k) >= 0 ? Number(hero[1]) : Number(std[1]);
  chk(M.ASSET_BUDGET_CLASSES[k].texel.target === want,
      k + ': texel target ' + M.ASSET_BUDGET_CLASSES[k].texel.target + ' px/m');
}
chk(HERO_CLASSES.every((k) => M.ASSET_BUDGET_CLASSES[k].texture.target === 2048),
    'and the hero classes are exactly the two the bible gives a 2K texture target');

chk(Object.isFrozen(M.ASSET_BUDGET_CLASSES) &&
    M.ASSET_BUDGET_CLASS_KEYS.every((k) => Object.isFrozen(M.ASSET_BUDGET_CLASSES[k])),
    'the table is frozen — a budget is not something a runtime edits');

/* ======================================================================================
   2. ADVISORY VS BLOCKING IS EXPLICIT, AND UNDER-MINIMUM NEVER BLOCKS
   ==================================================================================== */
head('2. ENFORCEMENT, BANDS AND THE FOUR-WAY DISTINCTION');

for (const k of M.ASSET_BUDGET_CLASS_KEYS) {
  const c = M.ASSET_BUDGET_CLASSES[k];
  chk(c.triangles.enforcement === 'advisory' && c.texel.enforcement === 'advisory' &&
      c.texture.enforcement === 'blocking',
      k + ': triangles/texel advisory, texture blocking — the bible names 4K as the thing to prevent');
}

const B = M.ASSET_BUDGET_BAND;
chk(M.bandAssetRange(800, 200, 1500).band === B.WITHIN, 'inside the range is "within"');
chk(M.bandAssetRange(1700, 200, 1500).band === B.NEAR, 'just past the maximum is "near" (1700 of 1500)');
chk(M.bandAssetRange(1875, 200, 1500).band === B.NEAR, 'exactly at +25% is still "near"');
chk(M.bandAssetRange(1876, 200, 1500).band === B.OVER, 'one past +25% is "over"');
chk(M.bandAssetRange(190, 200, 1500).band === B.NEAR, 'just under the minimum is "near"');
chk(M.bandAssetRange(90, 200, 1500).band === B.OVER, 'far under the minimum is "over"');
chk(M.bandAssetRange(null, 200, 1500).band === B.UNMEASURED, 'and a missing value is "unmeasured"');
chk(M.bandAssetRange(NaN, 200, 1500).band === B.UNMEASURED, 'as is NaN — never silently zero');

/* THE BAND IS SCALE-FREE. The same 25% at both ends of the class list. */
chk(M.bandAssetRange(37500, 10000, 30000).band === B.NEAR &&
    M.bandAssetRange(37501, 10000, 30000).band === B.OVER,
    'the tolerance is a fraction of the BOUNDARY, so it scales with the class (hero: 37,500)');

const S = M.ASSET_BUDGET_STATUS;
chk(M.assetBudgetStatus(B.OVER, 'over', 'advisory', 9e9, null) === S.ADVISORY,
    'clearly over an ADVISORY rule is advisory — a guideline does not fail a build');
chk(M.assetBudgetStatus(B.OVER, 'over', 'blocking', 9e9, null) === S.FAIL,
    'clearly over a BLOCKING rule fails');
chk(M.assetBudgetStatus(B.OVER, 'under', 'blocking', 1, null) === S.ADVISORY,
    'but being UNDER a minimum never fails, even on a blocking rule — it is a misclassification hint');
chk(M.assetBudgetStatus(B.NEAR, 'over', 'blocking', 1, null) === S.ADVISORY,
    'and "near" is advisory whatever the enforcement');
chk(M.assetBudgetStatus(B.UNMEASURED, null, 'blocking', null, null) === S.UNAVAILABLE,
    'unmeasured is UNAVAILABLE — not a pass, and not a failure');

chk(M.worseAssetStatus(S.PASS, S.ADVISORY) === S.ADVISORY &&
    M.worseAssetStatus(S.ADVISORY, S.FAIL) === S.FAIL &&
    M.worseAssetStatus(S.EXCEPTION, S.UNAVAILABLE) === S.UNAVAILABLE &&
    M.worseAssetStatus(S.PASS, S.EXCEPTION) === S.EXCEPTION,
    'severity rolls up pass < exception < unavailable < advisory < fail');

/* ======================================================================================
   3. WHAT A TRIANGLE IS
   ==================================================================================== */
head('3. GEOMETRY — ONE COUNTING DEFINITION');

chk(M.countNodeTriangles(mesh(tris(10))) === 10, 'non-indexed geometry: position.count / 3');
chk(M.countNodeTriangles(mesh(quad(1))) === 2, 'indexed geometry: index.count / 3');
chk(M.countNodeTriangles(node({ isPoints: true, geometry: tris(30) })) === 0,
    'a Points cloud has ZERO triangles — the count it used to contribute was its vertices');
chk(M.countNodeTriangles(node({ isLine: true, geometry: tris(30) })) === 0, 'and so does a Line');
chk(M.countNodeTriangles(node({})) === 0, 'and a node with no geometry');

/* GROUPS PARTITION ONE INDEX BUFFER. They must not multiply. */
const grouped = quad(1);
grouped.groups = [{ start: 0, count: 3, materialIndex: 0 }, { start: 3, count: 3, materialIndex: 1 }];
const gm = mesh(grouped, [mat({}), mat({})]);
chk(M.countNodeTriangles(gm) === 2,
    'a two-group, two-material mesh is still 2 triangles — groups partition, they do not multiply');
chk(M.measureAssetGeometry(gm).drawGroups === 2, 'but its two draw groups are reported');

/* SHARED GEOMETRY IS DRAWN ONCE PER MESH. */
const sharedGeom = tris(100);
const sharedScene = group([mesh(sharedGeom), mesh(sharedGeom), mesh(sharedGeom)]);
const sg = M.measureAssetGeometry(sharedScene);
chk(sg.triangles === 300, 'three meshes sharing one geometry are 300 triangles — each is drawn');
chk(sg.uniqueGeometries === 1, 'and the upload cost is reported separately: 1 unique geometry');

/* INSTANCING COUNTS THE AUTHORED MESH, NOT THE PLANTING. */
const inst = mesh(tris(50), mat({}), { isInstancedMesh: true, count: 400 });
const ig = M.measureAssetGeometry(inst);
chk(ig.triangles === 50,
    'an InstancedMesh counts its SOURCE geometry once — a budget is about the mesh an artist authored');
chk(ig.instances === 400 && ig.instancedMeshes === 1, 'and the instance count is reported (400)');

/* HIDDEN AND COLLISION-ONLY ARE EXCLUDED AND ATTRIBUTED. */
const hiddenScene = group([
  mesh(tris(10)),
  mesh(tris(999), mat({}), { visible: false }),
  group([mesh(tris(7))]),
]);
const hg = M.measureAssetGeometry(hiddenScene);
chk(hg.triangles === 17, 'a hidden mesh is not counted (17, not 1016)');
chk(hg.hidden.meshes === 1 && hg.hidden.triangles === 999,
    'and what was skipped is reported rather than lost');
const hiddenParent = group([node({ visible: false, children: [mesh(tris(500)), mesh(tris(4))] })]);
const hpg = M.measureAssetGeometry(hiddenParent);
chk(hpg.triangles === 0 && hpg.hidden.triangles === 504,
    'hidden means hidden INCLUDING its children — the traversal stops at the subtree');

const collScene = group([mesh(tris(20)), mesh(tris(888), mat({}), { userData: { collisionOnly: true } })]);
const cg = M.measureAssetGeometry(collScene);
chk(cg.triangles === 20 && cg.collisionOnly.triangles === 888,
    'collision-only geometry does not inflate a VISUAL budget, and is reported (888)');
note('this project declares collision as boxes and has no collision meshes — the branch is');
note('schema for the first DCC that exports one, not a feature in use.');

/* DETERMINISM. */
const detScene = group([mesh(quad(1), mat({ map: tex(256, 256) })), mesh(tris(33)),
                        mesh(tris(4), mat({}), { visible: false })]);
const runs = [];
for (let i = 0; i < 50; i++) runs.push(JSON.stringify(M.measureAssetGeometry(detScene)));
chk(runs.every((r) => r === runs[0]), '50 repeated measurements of the same subtree are identical');

/* ======================================================================================
   4. MATERIALS AND TEXTURES
   ==================================================================================== */
head('4. MATERIALS AND TEXTURES');

const tA = tex(1024, 1024, 'a'), tB = tex(512, 512, 'b');
const sharedMat = mat({ map: tA });
const sharedMatScene = group([mesh(tris(1), sharedMat), mesh(tris(1), sharedMat), mesh(tris(1), sharedMat)]);
const sm = M.measureAssetMaterials(sharedMatScene);
chk(sm.materialSlots === 3 && sm.uniqueMaterials === 1,
    'one material used by three meshes: 3 slots, 1 unique — reuse is detectable');
chk(sm.sharedMaterialUses === 2, 'and the saving is reported as 2 shared uses');
chk(sm.textures === 1 && sm.maxTextureDim === 1024, 'its one texture is counted once (1024)');

/* EQUIVALENT MATERIALS INSTANTIATED REPEATEDLY — section 72's exporter problem. */
const dupScene = group([mesh(tris(1), mat({ map: tA })), mesh(tris(1), mat({ map: tA })),
                        mesh(tris(1), mat({ map: tA }))]);
const dm = M.measureAssetMaterials(dupScene);
chk(dm.uniqueMaterials === 3, 'three separate material objects');
chk(dm.materialSignatures === 1,
    'that would all render identically — one signature, so the duplication is visible');
chk(dm.duplicateMaterials === 2, 'reported as 2 duplicate materials (CLAUDE.md section 72)');

const mixed = group([mesh(tris(1), [mat({ map: tA }), mat({ map: tB })])]);
const mx = M.measureAssetMaterials(mixed);
chk(mx.materialSlots === 2 && mx.textures === 2, 'a material ARRAY is expanded, not counted as one');
chk(mx.maxTextureDim === 1024 && mx.textureDims.join(',') === '512,1024',
    'and the dimensions are reported sorted, largest available as maxTextureDim');

/* MISSING AND UNKNOWN TEXTURE DATA ARE DIFFERENT ANSWERS. */
const brokenTex = { isTexture: true, uuid: 'broken' };                     // never resolved
const undecodedTex = { isTexture: true, uuid: 'pending', image: {} };      // no dimensions yet
const bm = M.measureAssetMaterials(group([mesh(tris(1), mat({ map: brokenTex })),
                                          mesh(tris(1), mat({ normalMap: undecodedTex }))]));
chk(bm.missingTextureData === 1, 'a texture with no image at all is a MISSING reference');
chk(bm.unknownTextureSize === 1, 'a texture with an image but no dimensions is UNKNOWN SIZE, not missing');
chk(bm.maxTextureDim === null, 'and with nothing measurable, maxTextureDim is null — never 0');

chk(M.assetTextureSize(tex(2048, 1024)).w === 2048, 'assetTextureSize reads image.width/height');
chk(M.assetTextureSize({ isTexture: true, source: { data: { width: 64, height: 64 } } }).w === 64,
    'and the r152+ source.data spelling');
chk(M.assetTextureSize(brokenTex) === null, 'and returns NULL rather than a guess');

/* THE HIDDEN RULE APPLIES HERE TOO. */
const hiddenMat = M.measureAssetMaterials(group([mesh(tris(1), mat({ map: tA })),
                                                 mesh(tris(1), mat({ map: tex(4096, 4096) }), { visible: false })]));
chk(hiddenMat.maxTextureDim === 1024,
    'a hidden mesh\'s 4K texture does not enter the budget — the same exclusion rule as geometry');

/* ======================================================================================
   5. TEXEL DENSITY — A MEASUREMENT WITH AN EXPLICIT UNAVAILABLE STATE
   ==================================================================================== */
head('5. TEXEL DENSITY');

/* A 1 m quad, UVs 0..1, 64x64 map: texels = 4096, area = 1 m^2, density = sqrt(4096) = 64. */
const d1 = M.measureAssetTexelDensity(mesh(quad(1), mat({ map: tex(64, 64) })));
chk(d1.status === 'measured' && near(d1.pxPerMetre, 64, 1e-6),
    'a 1 m quad with a 64x64 map measures exactly 64 px/m (' + d1.pxPerMetre + ')');
chk(d1.samples === 2 && near(d1.worldArea, 1, 1e-9), 'from 2 triangles over 1 m² of surface');

/* Scale invariance: 2 m quad with a 128 map is the same density. */
const d2 = M.measureAssetTexelDensity(mesh(quad(2), mat({ map: tex(128, 128) })));
chk(d2.status === 'measured' && near(d2.pxPerMetre, 64, 1e-6),
    'a 2 m quad with a 128x128 map is also 64 px/m — the measure is a density, not a size');

/* Over guidance, by a lot. */
const d3 = M.measureAssetTexelDensity(mesh(quad(1), mat({ map: tex(512, 512) })));
chk(d3.status === 'measured' && near(d3.pxPerMetre, 512, 1e-6),
    'a 1 m quad with a 512 map is 512 px/m — eight times standard guidance');

/* A world matrix is applied, so a scaled instance measures its ACTUAL size. */
const scaled = mesh(quad(1), mat({ map: tex(64, 64) }));
scaled.matrixWorld.elements = [4,0,0,0, 0,4,0,0, 0,0,4,0, 0,0,0,1];   // x4 in every axis
const d4 = M.measureAssetTexelDensity(scaled);
chk(d4.status === 'measured' && near(d4.pxPerMetre, 16, 1e-6),
    'scaling a quad 4x drops its density 4x (16 px/m) — the world matrix is applied');

/* EVERY UNAVAILABLE REASON IS ITS OWN ANSWER. */
const noUv = M.measureAssetTexelDensity(mesh(tris(4), mat({ map: tex(64, 64) })));
chk(noUv.status === 'unavailable' && /UV/.test(noUv.why), 'no UV attribute -> unavailable, with a reason');
const noMap = M.measureAssetTexelDensity(mesh(quad(1), mat({})));
chk(noMap.status === 'unavailable' && /map/.test(noMap.why), 'no base-colour map -> unavailable');
const noSize = M.measureAssetTexelDensity(mesh(quad(1), mat({ map: brokenTex })));
chk(noSize.status === 'unavailable' && /dimension/.test(noSize.why), 'unsized texture -> unavailable');
chk(M.measureAssetTexelDensity(null).status === 'unavailable', 'no root -> unavailable');
const degenerate = geom({ positions: [0,0,0, 0,0,0, 0,0,0], uvs: [0,0, 1,0, 1,1] });
chk(M.measureAssetTexelDensity(mesh(degenerate, mat({ map: tex(64, 64) }))).status === 'unavailable',
    'a degenerate zero-area triangle -> unavailable, NOT an infinite density');

/* Per-mesh map dimensions, not one global maximum. */
const twoMaps = group([mesh(quad(1), mat({ map: tex(64, 64) })),
                       mesh(quad(1), mat({ map: tex(64, 64) }))]);
chk(near(M.measureAssetTexelDensity(twoMaps).pxPerMetre, 64, 1e-6),
    'two meshes each at 64 px/m average to 64, not to their combined texture area');

/* Sampling is a STRIDE and therefore repeatable. */
const bigQuad = (() => {
  const n = M.ASSET_TEXEL_SAMPLE_CAP * 2;   // forces striding
  const p = [], u = [];
  for (let i = 0; i < n; i++) { p.push(0,0,0, 1,0,0, 0,0,1); u.push(0,0, 1,0, 0,1); }
  return geom({ positions: p, uvs: u });
})();
const s1 = M.measureAssetTexelDensity(mesh(bigQuad, mat({ map: tex(64, 64) })));
const s2 = M.measureAssetTexelDensity(mesh(bigQuad, mat({ map: tex(64, 64) })));
chk(s1.status === 'measured' && s1.pxPerMetre === s2.pxPerMetre,
    'above the sample cap it strides deterministically — two runs give the identical number');
chk(s1.samples <= M.ASSET_TEXEL_SAMPLE_CAP + 1,
    'and the sample count is bounded (' + s1.samples + ' of ' + (M.ASSET_TEXEL_SAMPLE_CAP * 2) + ')');

const T = M.bandAssetTexel;
chk(T(64, 64).band === B.WITHIN && T(128, 64).band === B.WITHIN && T(32, 64).band === B.WITHIN,
    'one octave either side of target is "within" — one mip level, which is the unit');
chk(T(200, 64).band === B.NEAR && T(20, 64).band === B.NEAR, 'two octaves is "near"');
chk(T(512, 64).band === B.OVER, 'eight times target is "over"');
chk(T(null, 64).band === B.UNMEASURED, 'and no measurement is "unmeasured"');

/* ======================================================================================
   6. ASSET CLASS VALIDATION — EVERY CLASS, FOUR WAYS
   ==================================================================================== */
head('6. VALIDATION ACROSS EVERY ASSET CLASS');

for (const k of M.ASSET_BUDGET_CLASS_KEYS) {
  const c = M.ASSET_BUDGET_CLASSES[k];
  const mid = Math.round((c.triangles.min + c.triangles.max) / 2);

  const good = M.validateAssetBudget({ triangles: mid, maxTextureDim: c.texture.target,
                                       texelDensity: c.texel.target, texelStatus: 'measured' }, k);
  chk(good.status === S.PASS, k + ': a compliant asset passes every metric');

  const boundary = M.validateAssetBudget({ triangles: Math.round(c.triangles.max * 1.1),
                                           maxTextureDim: c.texture.target * 2,
                                           texelDensity: c.texel.target * 3, texelStatus: 'measured' }, k);
  chk(boundary.status === S.ADVISORY, k + ': a boundary asset is ADVISORY, not a failure');
  chk(boundary.metrics.triangles.band === B.NEAR && boundary.metrics.texture.band === B.NEAR,
      k + ': and both bands say "near" rather than "over"');

  const over = M.validateAssetBudget({ triangles: c.triangles.max * 10,
                                       maxTextureDim: c.texture.target * 8,
                                       texelDensity: c.texel.target * 10, texelStatus: 'measured' }, k);
  chk(over.status === S.FAIL, k + ': a clearly over-budget asset FAILS (on the blocking texture rule)');
  chk(over.metrics.triangles.status === S.ADVISORY && over.metrics.triangles.band === B.OVER,
      k + ': its triangle overrun is "over" but only advisory — the bible says guideline');
  chk(over.metrics.texture.status === S.FAIL, k + ': its texture overrun is the one that fails');

  const excused = M.validateAssetBudget(
    { triangles: c.triangles.max * 2, maxTextureDim: c.texture.target, texelDensity: c.texel.target,
      texelStatus: 'measured' }, k,
    [{ metric: 'triangles', allow: c.triangles.max * 2,
       reason: 'authored overrun recorded for this fixture' }]);
  chk(excused.metrics.triangles.status === S.EXCEPTION,
      k + ': a stated exception makes the overrun read as EXCEPTION, never as pass');
  chk(excused.status === S.EXCEPTION, k + ': and the overall status carries it');
}

const unknown = M.validateAssetBudget({ triangles: 10 }, 'not-a-class');
chk(unknown.status === S.UNAVAILABLE && unknown.warnings.length > 0,
    'an unknown class is UNAVAILABLE with a warning — not a pass, and not a throw');
const undeclared = M.validateAssetBudget({ triangles: 10 }, null);
chk(undeclared.status === S.UNAVAILABLE, 'and an asset with no declared class is the same');

const noTexel = M.validateAssetBudget({ triangles: 800, maxTextureDim: 512,
                                        texelDensity: null, texelStatus: 'unavailable',
                                        texelWhy: 'no UV attribute' }, 'small-prop');
chk(noTexel.metrics.texel.status === S.UNAVAILABLE, 'an unmeasurable texel density is UNAVAILABLE');
chk(noTexel.status === S.UNAVAILABLE && /no UV attribute/.test(noTexel.warnings.join(' ')),
    'and the reason is carried into the warnings — "unknown" is not "outside guidance"');

/* ======================================================================================
   7. EXCEPTIONS ARE EXPLICIT, LOCAL AND REVIEWABLE
   ==================================================================================== */
head('7. EXCEPTIONS');

chk(M.validateAssetException({ metric: 'triangles', allow: 50000, reason: 'a real stated reason' }).ok,
    'a complete exception validates');
chk(!M.validateAssetException({ metric: 'triangles', allow: 50000 }).ok, 'one with no reason does not');
chk(!M.validateAssetException({ metric: 'triangles', allow: 50000, reason: 'because' }).ok,
    'and neither does "because" — a reason must be a stated sentence');
chk(!M.validateAssetException({ metric: 'everything', allow: 1, reason: 'a real stated reason' }).ok,
    'an exception naming an unknown metric is rejected');
chk(!M.validateAssetException({ metric: 'triangles', allow: -5, reason: 'a real stated reason' }).ok,
    'and one with a nonsensical allowance is rejected');

const rejected = M.validateAssetBudget(
  { triangles: 90000, maxTextureDim: 2048, texelDensity: 128, texelStatus: 'measured' },
  'hero-landmark', [{ metric: 'triangles', allow: 90000 }]);
chk(rejected.metrics.triangles.status === S.ADVISORY,
    'an INVALID exception does not excuse anything — the overrun still reports');
chk(rejected.exceptions[0].valid === false && /reason/.test(rejected.exceptions[0].why),
    'and the rejection is in the output with its reason, not silently dropped');

const tooSmall = M.validateAssetBudget(
  { triangles: 90000, maxTextureDim: 2048, texelDensity: 128, texelStatus: 'measured' },
  'hero-landmark', [{ metric: 'triangles', allow: 40000, reason: 'agreed overrun for the tower' }]);
chk(tooSmall.metrics.triangles.status === S.ADVISORY,
    'an exception for 40,000 does not excuse 90,000 — it states what was agreed');

const unneeded = M.validateAssetBudget(
  { triangles: 20000, maxTextureDim: 2048, texelDensity: 128, texelStatus: 'measured' },
  'hero-landmark', [{ metric: 'triangles', allow: 40000, reason: 'agreed overrun for the tower' }]);
chk(unneeded.status === S.PASS && /was not needed/.test(unneeded.warnings.join(' ')),
    'an exception that was not needed is reported — a stale excuse is a finding');

const dup = M.validateAssetBudget(
  { triangles: 20000, maxTextureDim: 2048, texelDensity: 128, texelStatus: 'measured' },
  'hero-landmark', [{ metric: 'triangles', allow: 40000, reason: 'agreed overrun for the tower' },
                    { metric: 'triangles', allow: 90000, reason: 'a second bite at the cherry' }]);
chk(/duplicate exception/.test(dup.warnings.join(' ')),
    'and a second exception for the same metric is refused rather than taking the larger one');

/* NO GLOBAL SWITCH, ANYWHERE IN THE SOURCE. */
const budgetSrc = strip(read('asset-budgets.js'));
for (const bad of ['ignoreAll', 'skipBudget', 'disableBudget', 'BYPASS', 'bypass']) {
  chk(budgetSrc.indexOf(bad) < 0, 'asset-budgets.js has no "' + bad + '" escape hatch');
}
chk(M.ASSET_EXCEPTION_METRICS.length === 3,
    'exceptions may name exactly the three measured metrics, and no others');

/* ======================================================================================
   8. LOD — SCHEMA ONLY, AND IT SAYS SO
   ==================================================================================== */
head('8. LOD PREPARATION');

const regSrc = strip(read('asset-registry.js'));
chk(/lod:\s*null/.test(regSrc), 'the registry still reserves `lod` and every row is null — no LOD system');
chk(M.validateAssetLods([{ level: 0, triangles: 20000 }, { level: 1, triangles: 8000 },
                         { level: 2, triangles: 2000 }]).ok,
    'a coarsening LOD chain is consistent');
const flat = M.validateAssetLods([{ level: 0, triangles: 20000 }, { level: 1, triangles: 19500 }]);
chk(!flat.ok && /not meaningfully cheaper/.test(flat.warnings.join(' ')),
    'a level that barely reduces anything is not a LOD, and is reported');
const gap = M.validateAssetLods([{ level: 0, triangles: 20000 }, { level: 2, triangles: 500 }]);
chk(!gap.ok && /consecutive/.test(gap.warnings.join(' ')), 'and a gap in the level numbering is reported');
const withLods = M.validateAssetBudget(
  { triangles: 20000, maxTextureDim: 2048, texelDensity: 128, texelStatus: 'measured',
    lods: [{ level: 0, triangles: 20000 }, { level: 1, triangles: 19900 }] }, 'hero-landmark');
chk(withLods.status === S.ADVISORY && withLods.lods && withLods.lods.ok === false,
    'an inconsistent LOD chain makes the whole verdict advisory, and the detail is in `lods`');

/* ======================================================================================
   9. RUNTIME INSTRUMENTATION
   ==================================================================================== */
head('9. RUNTIME RESOURCE STATISTICS');

const liveScene = group([
  mesh(quad(1), sharedMat),
  mesh(tris(120), sharedMat),
  mesh(tris(9), mat({ map: tex(256, 256) }), { visible: false }),
  group([mesh(tris(40), mat({ map: tA }))]),
]);
const fakeRenderer = { info: { render: { calls: 7, triangles: 162, points: 0, lines: 0 },
                               memory: { geometries: 4, textures: 2 }, programs: [1, 2] } };

const r1 = M.measureSceneResources(liveScene, fakeRenderer);
chk(r1.scene.triangles === 162, 'the scene reports its resident visible triangles (162)');
chk(r1.scene.hiddenTriangles === 9, 'and the hidden ones separately — streaming-safe by construction');
chk(r1.scene.materials === 2 && r1.scene.textures === 1,
    'unique materials (2) and textures (1) are counted — the hidden mesh\'s 256 map is excluded');
chk(r1.renderer.available === true && r1.renderer.drawCalls === 7,
    'renderer.info is reported SEPARATELY — drawn is not resident');
chk(r1.renderer.drawnTriangles === 162 && r1.renderer.programs === 2,
    'including draw calls, drawn triangles and program count where the renderer exposes them');

const noRenderer = M.measureSceneResources(liveScene, null);
chk(noRenderer.renderer.available === false && noRenderer.scene.triangles === 162,
    'with no renderer the scene half still measures and the renderer half says UNAVAILABLE, not zero');

/* IT MUTATES NOTHING. */
const before = JSON.stringify(liveScene, (k, v) => (k === 'getX' || k === 'getY' || k === 'getZ') ? undefined : v);
for (let i = 0; i < 20; i++) M.measureSceneResources(liveScene, fakeRenderer);
const after = JSON.stringify(liveScene, (k, v) => (k === 'getX' || k === 'getY' || k === 'getZ') ? undefined : v);
chk(before === after, 'twenty measurements leave the scene graph byte-identical — it writes nothing');
chk(liveScene._updated === undefined,
    'and it does NOT call updateMatrixWorld on a live scene — the renderer already did');
chk(mesh(quad(1), sharedMat) && (() => { const m0 = mesh(quad(1), sharedMat);
    M.measureAssetGeometry(m0); return m0._updated === 1; })(),
    'whereas measuring a freshly loaded ASSET does update its matrices, once, on purpose');

const det = [];
for (let i = 0; i < 30; i++) det.push(JSON.stringify(M.measureSceneResources(liveScene, fakeRenderer)));
chk(det.every((d) => d === det[0]), '30 repeated runtime measurements are identical');

/* STREAMING: WHAT LEFT THE SCENE IS NOT COUNTED. */
const streamed = group([mesh(tris(100))]);
const region = group([mesh(tris(5000))]);
streamed.children.push(region);
chk(M.measureSceneResources(streamed, null).scene.triangles === 5100, 'a resident region is counted');
streamed.children.splice(1, 1);
chk(M.measureSceneResources(streamed, null).scene.triangles === 100,
    'and an unloaded one is not — there is no registry of things that were ever loaded to go stale');

/* ======================================================================================
   10. BASELINE COMPARISON
   ==================================================================================== */
head('10. BASELINE COMPARISON');

const base = M.measureSceneResources(streamed, null);
streamed.children.push(group([mesh(tris(900))]));
const now = M.measureSceneResources(streamed, null);
const cmp = M.compareResourceMeasurements(base, now);
chk(cmp.fields.triangles.from === 100 && cmp.fields.triangles.to === 1000,
    'a comparison reports from and to (100 -> 1000)');
chk(cmp.fields.triangles.delta === 900 && cmp.fields.triangles.changed === true,
    'with the delta and a changed flag');
chk(cmp.changed.indexOf('triangles') >= 0 && cmp.changed.indexOf('textures') < 0,
    'and only the fields that moved are listed as changed');
const same = M.compareResourceMeasurements(base, base);
chk(same.changed.length === 0, 'comparing a measurement with itself reports no change at all');
const tiny = M.compareResourceMeasurements({ triangles: 10000 }, { triangles: 10100 });
chk(tiny.fields.triangles.changed === false,
    'a 1% move is inside the default tolerance — a comparison is not a tripwire');
const tight = M.compareResourceMeasurements({ triangles: 10000 }, { triangles: 10100 }, { tolerance: 0.001 });
chk(tight.fields.triangles.changed === true, 'and the tolerance is the caller\'s to set');
chk(budgetSrc.indexOf('fps') < 0 && strip(read('asset-measure.js')).indexOf('fps') < 0,
    'neither module mentions FPS — CLAUDE.md section 79 forbids a performance claim from one machine');

/* ======================================================================================
   11. THE ONE COUNTING DEFINITION REACHES THE EXISTING PIPELINE
   ==================================================================================== */
head('11. THE NORMALISER NOW USES THE SAME COUNT');

const pointsAsset = group([mesh(tris(10), mat({})), node({ isPoints: true, geometry: tris(30),
                                                            material: mat({}), children: [] })]);
const rep = M.normalizeAssetMaterials(pointsAsset);
chk(rep.triangles === 10,
    'normalizeAssetMaterials reports 10 triangles for a 10-triangle asset with a 90-vertex points cloud');
note('before this phase it reported 40: the points cloud\'s vertex count divided by three.');
chk(rep.normalized === 2, 'and it still NORMALISED both nodes — the traversal did not change');
chk(rep.meshes === 1, 'while `meshes` now means what the budget means by it');
const matSrc = strip(read('asset-materials.js'));
chk(/measureAssetGeometry\(root/.test(matSrc),
    'because it delegates to the one counting definition rather than keeping its own');
chk(!/report\.triangles\s*\+=/.test(matSrc), 'and its inline triangle arithmetic is gone');

/* ======================================================================================
   12. LAYER RULES
   ==================================================================================== */
head('12. THE NEW MODULES OBEY THE ASSET LAYER');

for (const f of ['asset-budgets.js', 'asset-measure.js']) {
  const raw = read(f), live = strip(raw);
  chk(/^"use strict";/.test(raw), f + ' — opens with "use strict"');
  chk(!/^\s*(import|export)\s/m.test(live), f + ' — classic script, no import/export');
  chk((live.match(/\bTHREE\./g) || []).length === 0,
      f + ' — names NO THREE: it measures duck-typed objects and outlives the renderer');
  chk(!/\bdocument\./.test(live) && live.indexOf('window.') < 0, f + ' — does not reach the DOM');
  chk(live.indexOf('BLOCK.') < 0 && live.indexOf('CHUNK_S') < 0, f + ' — names no voxel vocabulary');
  chk(live.indexOf('window.game') < 0 && live.indexOf('UIManager') < 0, f + ' — reaches nothing above it');
  chk(live.indexOf('setTimeout') < 0 && live.indexOf('setInterval') < 0 &&
      live.indexOf('requestAnimationFrame') < 0, f + ' — schedules nothing, ever');
  chk(!/Math\.random|Date\.now|performance\.now/.test(live), f + ' — nothing random or time-dependent');
}

/* THE INSTRUMENTATION HAS NO CALL SITE IN THE FRAME LOOP. CLAUDE.md section 14: a per-frame
   global scan is exactly the cost this project refuses. */
const H = require('./harness/source.js');
const BUILD = H.buildScript();
const inline = typeof BUILD === 'string' ? BUILD : String(BUILD);
const callSites = (inline.match(/measureSceneResources\(/g) || []).length;
chk(callSites === 1,
    'measureSceneResources appears exactly ONCE in the whole build — its own declaration (' +
    callSites + ')');
chk((inline.match(/measureAsset\(/g) || []).length <= 1,
    'and measureAsset has no call site in the build either — validation is a test-time tool');

/* ======================================================================================
   13. D1 PHASE 4 — THE FIRST PRODUCTION ASSET, FROM ITS OWN BYTES
   ==================================================================================== */
head('13. THE FIRST PRODUCTION ASSET, MEASURED FROM THE SHIPPED FILE');

{
  const REGB = (() => {
    const ctx = vm.createContext({});
    vm.runInContext(read('asset-registry.js') +
                    '\n;globalThis.__R = { assetBudgetSpecOf, modelAssetUrl };', ctx);
    return ctx.__R;
  })();
  const KEY = 'prop.rural-fence-post-01';
  const spec = REGB.assetBudgetSpecOf(KEY);
  chk(!!spec && spec.class === 'small-prop' && Array.isArray(spec.exceptions) && spec.exceptions.length === 0,
      KEY + ' declares small-prop with an explicit, empty exception list');

  const { readGlb } = require('./harness/glb.js');
  const glb = readGlb(path.join(ROOT, REGB.modelAssetUrl(KEY)));
  const m = M.measureAsset(glb.root);
  note('shipped file: ' + glb.byteLength.toLocaleString() + ' bytes, ' + m.geometry.meshes + ' meshes, ' +
       m.triangles.toLocaleString() + ' triangles, ' + m.geometry.vertices.toLocaleString() + ' vertices');
  note('materials ' + m.materials.uniqueMaterials + ', textures ' + m.materials.textures +
       ' [' + m.materials.textureDims.join(', ') + '], texel ' +
       (m.texelDensity ? m.texelDensity.toFixed(2) + ' px/m' : m.texelStatus));
  chk(m.triangles === 1296, 'the real counting definition finds 1,296 triangles in the shipped file');
  chk(m.geometry.meshes === 2 && m.materials.uniqueMaterials === 2,
      'across two meshes and two materials — timber and galvanised steel');
  chk(m.materials.textures === 5 && m.maxTextureDim === 256,
      'five embedded maps, the largest 256 px — inside the 512 small-prop target');
  chk(m.texelStatus === 'measured' && near(m.texelDensity, 64.37, 0.05),
      'texel density MEASURED at ' + (m.texelDensity || 0).toFixed(2) + ' px/m, on the ~64 px/m standard');

  const v = M.validateAssetBudget(m, spec.class, spec.exceptions);
  note('verdict: ' + v.status + ' — triangles ' + v.metrics.triangles.band + ', texture ' +
       v.metrics.texture.band + ', texel ' + v.metrics.texel.band);
  chk(v.status === 'pass' && v.warnings.length === 0 && v.exceptions.length === 0,
      'the validator PASSES it as a small-prop with no warning and no exception');
  chk(['triangles', 'texture', 'texel'].every((k) => v.metrics[k].band === 'within'),
      'and every metric is WITHIN its band, not merely tolerated');
}

console.log('');
if (fail === 0) {
  console.log('ALL VISUAL BUDGET CHECKS PASS');
  note('Offline, on synthetic fixtures plus the first production GLB read from its own');
  note('buffers. It does not prove a DECODED GLB measures correctly — nothing offline here');
  note('can decode one — and it does not prove the art direction is right.');
} else {
  console.log(fail + ' VISUAL BUDGET FAILURES');
}
process.exit(fail === 0 ? 0 : 1);
