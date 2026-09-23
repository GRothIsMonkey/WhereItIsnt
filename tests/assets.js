/* ERA 2 E2.0a — THE ASSET PIPELINE, OFFLINE.

   WHAT THIS FILE CAN PROVE. That the registry and the attribution documents agree in both
   directions; that no file path escapes the registry; that no validation asset has leaked
   into a dimension; that the vendored renderer is the one the suites test against; that
   the four modules obey the layer rules; and that the registry's own lookups return what
   they claim.

   D1 PHASE 4 ADDED: that the first PRODUCTION asset is registered once, attributed under a
   licence status that is true (first-party, with an in-repo provenance record and a hash
   the shipped file actually has), declared into a real budget class, and that its declared
   collision boxes enclose its own timber — read out of the shipped GLB's vertex buffer by
   `harness/glb.js`, not taken from the authoring report — and answer the physical and ray
   queries correctly under a placed rotation and translation.

   WHAT IT CANNOT PROVE. That a GLB loads, that a material resolves, that a texture is in
   the right colour space, or that anything renders. Nothing offline in this repository
   can DECODE a GLB — `harness/glb.js` reads its buffers and PNG headers, which is not the
   same thing — the same reason `measure_runtime.js` had to be a browser tool to read 121
   MP3s (CLAUDE.md §62.3). `tests/browser-assets.js` is where those claims are made, in a
   real Chromium, over HTTP, against a real WebGL context. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const H = require('./harness/source.js');
const { readGlb } = require('./harness/glb.js');
const crypto = require('crypto');
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/* D1 PHASE 4 — THE FIRST PRODUCTION ASSET, and the approved review export it was copied
   from. Named here once so every section below is talking about the same pair of files. */
const FENCE = 'prop.rural-fence-post-01';
const FENCE_REVIEW_GLB = 'assets/_raw_review/rural_fence_post_01/revision_03/export/rural_fence_post_01_r03.glb';
const SRC = H.buildScript();

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (m) => console.log('      ' + m);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

const ASSET_DIR = path.join(ROOT, 'src', 'assets');
/* DERIVED FROM THE DIRECTORY, NOT TYPED OUT. D1 Phase 3 added two modules to this layer
   and a hand-written list would have gone on passing while covering four files out of six —
   the exact shape CLAUDE.md sections 61.05-61.07 name three times and section 62.10 names
   again for the DOM hooks. The four E2.0a modules are asserted present separately below, so
   deriving the list cannot hide a deletion either. */
const MODULES = fs.readdirSync(path.join(ROOT, 'src', 'assets'))
                  .filter((f) => f.endsWith('.js')).sort();
const E2_0A_MODULES = ['asset-collision.js', 'asset-library.js', 'asset-materials.js',
                       'asset-registry.js'];
const read = (f) => fs.readFileSync(path.join(ASSET_DIR, f), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* Run the registry alone, in a bare context, so its tables can be read as VALUES rather
   than matched as text. A data module that needs the rest of the build to be evaluated is
   not a data module. */
const REG = (() => {
  const ctx = vm.createContext({});
  /* A top-level `const` in a classic script is LEXICAL — it never becomes a property of
     the context object. Reading `ctx.MODEL_ASSETS` therefore returns undefined, and
     `Object.isFrozen(undefined)` is `true` per spec, so three freeze checks passed while
     testing nothing at all. The export line is how the values actually come out. */
  const EXPORTS = ['MODEL_ASSETS', 'ASSET_CREDITS', 'ASSET_LICENCES', 'ASSET_STATUS',
                   'ASSET_COLLISION', 'ASSET_LIMITS', 'ASSET_ROOT', 'ASSET_TRANSPORT_BLOCKED',
                   'modelAssetKeys', 'modelAssetUrl', 'isProductionAsset',
                   'restrictedLicenceAssets'];
  vm.runInContext(read('asset-registry.js') + '\n;globalThis.__REG = {' +
                  EXPORTS.join(',') + '};', ctx, { filename: 'asset-registry.js' });
  return ctx.__REG;
})();

// =====================================================================================
head('1. THE REGISTRY EVALUATES ALONE, AND ITS LOOKUPS ARE REAL');

chk(typeof REG.MODEL_ASSETS === 'object' && REG.MODEL_ASSETS !== null,
    'MODEL_ASSETS exists as a value, with the registry evaluated on its own');
chk(!!REG.MODEL_ASSETS && Object.isFrozen(REG.MODEL_ASSETS), 'MODEL_ASSETS is frozen');
chk(!!REG.ASSET_CREDITS && Object.isFrozen(REG.ASSET_CREDITS), 'ASSET_CREDITS is frozen');
chk(!!REG.ASSET_LICENCES && Object.isFrozen(REG.ASSET_LICENCES), 'ASSET_LICENCES is frozen');

const KEYS = REG.modelAssetKeys();
note('registry holds ' + KEYS.length + ' asset(s): ' + KEYS.join(', '));
chk(KEYS.length >= 1, 'the registry is not empty');

chk(REG.modelAssetUrl('prop.road-signs') === 'assets/models/props/road_signs.glb',
    'modelAssetUrl resolves a key to the shipped path');
chk(REG.modelAssetUrl(FENCE) === 'assets/models/props/rural_fence_post_01.glb',
    'and the first production key resolves under the production root, not the review tree');
chk(REG.modelAssetUrl('no.such.asset') === null,
    'modelAssetUrl returns null for an unknown key rather than throwing');

// =====================================================================================
head('2. EVERY ASSET IS ON DISK, AND EVERY PATH IS REACHED THROUGH THE REGISTRY');

for (const k of KEYS) {
  const url = REG.modelAssetUrl(k);
  const abs = path.join(ROOT, url);
  chk(fs.existsSync(abs), k + ' — the file exists: ' + url);
  if (fs.existsSync(abs)) note('  ' + (fs.statSync(abs).size / 1048576).toFixed(1) + ' MB');
}

/* NO CALL SITE HOLDS A MODEL FILE PATH. The registry is the one place the string appears.
   Section 61's rule for audio, enforced here from the start rather than after a phase
   spends a week finding paths in twelve files. */
const pathLits = [];
const reGlb = /['"][^'"]*\.(?:glb|gltf)['"]/gi;
let m;
while ((m = reGlb.exec(SRC)) !== null) pathLits.push(m[0]);
const inRegistry = (read('asset-registry.js').match(reGlb) || []).length;
chk(pathLits.length === inRegistry,
    'every .glb/.gltf literal in the whole build is in asset-registry.js (' +
    pathLits.length + ' found, ' + inRegistry + ' of them in the registry)');
if (pathLits.length !== inRegistry) note('stray: ' + pathLits.join(' '));

// =====================================================================================
head('3. ATTRIBUTION — BOTH DIRECTIONS, AND THE LICENCE QUARANTINE');

for (const k of KEYS) {
  const c = REG.ASSET_CREDITS[k];
  chk(!!c, k + ' — has an ASSET_CREDITS row');
  if (!c) continue;
  chk(!!(c.title && c.author && c.source), k + ' — credit names a title, an author and a source');
  chk(!!REG.ASSET_LICENCES[c.licence], k + ' — licence "' + c.licence + '" is a known licence');
  const doc = path.join(ROOT, c.file);
  chk(fs.existsSync(doc), k + ' — the attribution document it names exists: ' + c.file);
  if (fs.existsSync(doc)) {
    const text = fs.readFileSync(doc, 'utf8');
    chk(text.indexOf(c.author) >= 0, k + ' — that document actually credits ' + c.author);
    chk(text.indexOf(c.source) >= 0, k + ' — and carries the source link');
  }
}

for (const k of Object.keys(REG.ASSET_CREDITS)) {
  chk(KEYS.indexOf(k) >= 0, 'credit "' + k + '" belongs to an asset that exists in MODEL_ASSETS');
}

/* D1 PHASE 4 — FIRST-PARTY IS A LICENCE STATUS THAT MUST BE EARNED, NOT A LOOPHOLE.

   Every licence is either a third-party grant that points at its own text, or first-party
   work — and nothing else. There is no third kind of row, and in particular no "none". A
   first-party credit is only accepted with an in-repo provenance record that exists and a
   SHA-256 the shipped file actually has, so claiming first-party for a downloaded model is
   not a one-word edit. */
for (const id of Object.keys(REG.ASSET_LICENCES)) {
  const l = REG.ASSET_LICENCES[id];
  chk(Object.isFrozen(l) && typeof l.name === 'string' && l.name.length > 0 &&
      typeof l.restricted === 'boolean',
      'licence "' + id + '" is frozen, named, and states whether it is restricted');
  chk(l.firstParty === true || (typeof l.url === 'string' && /^https?:\/\//.test(l.url)),
      'licence "' + id + '" is either first-party or points at its own licence text — no licence is "nothing"');
}
chk(Object.keys(REG.ASSET_LICENCES).every((id) => !/^(none|n\/?a|unlicen[cs]ed|no.?licen[cs]e)$/i.test(id)),
    'no licence id means "no licence required"');
const FP = REG.ASSET_LICENCES['FIRST-PARTY'];
chk(!!FP && FP.firstParty === true && FP.restricted === false && FP.attributionRequired === false,
    'FIRST-PARTY exists: project-owned, unrestricted for this project, no external attribution');
chk(!!FP && FP.url === null && !/creative\s*commons|CC-BY/i.test(FP.name),
    'and it borrows no Creative Commons name or URL — nobody licensed this work to the project');
chk(Object.keys(REG.ASSET_LICENCES).filter((id) => REG.ASSET_LICENCES[id].firstParty === true).length === 1,
    'there is exactly one first-party status, not a family of convenient ones');

for (const k of KEYS) {
  const c = REG.ASSET_CREDITS[k];
  const l = c && REG.ASSET_LICENCES[c.licence];
  if (!l || l.firstParty !== true) continue;
  const prov = path.join(ROOT, c.source);
  chk(!/^https?:/.test(c.source) && fs.existsSync(prov),
      k + ' — first-party provenance is an in-repo record that exists: ' + c.source);
  chk(typeof c.sha256 === 'string' && /^[0-9a-f]{64}$/.test(c.sha256),
      k + ' — the credit pins a SHA-256 of the approved bytes');
  const shipped = path.join(ROOT, REG.modelAssetUrl(k));
  if (fs.existsSync(shipped)) {
    chk(sha256(shipped) === c.sha256,
        k + ' — the shipped runtime file IS those bytes (' + c.sha256.slice(0, 12) + '...)');
  }
  chk(typeof c.tools === 'string' && c.tools.length > 0 &&
      typeof c.approval === 'string' && c.approval.length > 0,
      k + ' — and records how it was made and what approved it (' + c.tools + '; ' + c.approval + ')');
  const docText = fs.existsSync(path.join(ROOT, c.file)) ? fs.readFileSync(path.join(ROOT, c.file), 'utf8') : '';
  chk(docText.indexOf(c.sha256) >= 0 && docText.indexOf(REG.modelAssetUrl(k)) >= 0,
      k + ' — and the provenance document carries the same hash and the runtime path');
}

/* The production copy and the approved review export are the SAME BYTES. Integration moved
   a file; it did not re-export, retexture or simplify one. The review export stays where it
   is as history. */
const reviewAbs = path.join(ROOT, FENCE_REVIEW_GLB);
chk(fs.existsSync(reviewAbs), 'the approved Revision 03 review export is still in place: ' + FENCE_REVIEW_GLB);
if (fs.existsSync(reviewAbs) && fs.existsSync(path.join(ROOT, REG.modelAssetUrl(FENCE)))) {
  chk(sha256(reviewAbs) === sha256(path.join(ROOT, REG.modelAssetUrl(FENCE))),
      'and the production runtime GLB is byte-identical to it — the approved art, unaltered');
}
/* Revision 01 predates the revision_NN convention and lives at the fence's review root. */
for (const [rev, f] of [['revision 01', 'export/rural_fence_post_01.glb'],
                        ['revision 02', 'revision_02/export/rural_fence_post_01_r02.glb'],
                        ['revision 03', 'revision_03/source/rural_fence_post_01_r03.blend']]) {
  chk(fs.existsSync(path.join(ROOT, 'assets', '_raw_review', 'rural_fence_post_01', f)),
      'the ' + rev + ' review history is preserved (' + f + ')');
}

/* An asset whose licence forbids a paid release is legal here and illegal there. The list
   has to stay current on its own, not in somebody's memory. */
const restricted = REG.restrictedLicenceAssets();
note('LICENCE QUARANTINE — ' + restricted.length + ' restricted asset(s)' +
     (restricted.length ? ': ' + restricted.join(', ') : ''));
chk(restricted.every((k) => !!REG.ASSET_CREDITS[k]),
    'every quarantined asset still has its credit row');

/* Every attribution document that shipped with an asset must be named by some credit, or
   it is an orphan and the asset it describes is not in the registry. */
const creditDocs = new Set(Object.values(REG.ASSET_CREDITS).map((c) => c.file));
const onDisk = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/credits?\.md$/i.test(e.name)) onDisk.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  }
})(path.join(ROOT, 'assets', 'models'));
for (const d of onDisk) {
  chk(creditDocs.has(d), 'attribution document "' + d + '" is claimed by a credit row');
}

/* And every GLB physically present is in the registry — an unregistered model is an
   asset with no licence record, which is the breach this section exists to catch. */
const glbsOnDisk = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(glb|gltf)$/i.test(e.name)) glbsOnDisk.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  }
})(path.join(ROOT, 'assets', 'models'));
const registered = new Set(KEYS.map((k) => REG.modelAssetUrl(k)));
for (const g of glbsOnDisk) {
  chk(registered.has(g), 'model on disk is registered (and therefore attributed): ' + g);
}

// =====================================================================================
head('4. A VALIDATION ASSET IS NOT CONTENT');

const validation = KEYS.filter((k) => REG.MODEL_ASSETS[k].status === REG.ASSET_STATUS.VALIDATION);
const production = KEYS.filter((k) => REG.isProductionAsset(k));
note('validation: ' + validation.length + '   production: ' + production.length);
/* D1 PHASE 4 — EXACTLY ONE, AND IT IS THE APPROVED FENCE. E2.0a shipped zero; this phase
   integrated one human-approved asset and nothing else. A second production row needs its
   own approval, and changing this list is the reviewable statement that it has one. */
chk(production.length === 1 && production[0] === FENCE,
    'the registry ships exactly ONE production asset, the approved fence (' + production.join(', ') + ')');

/* REGISTERED EXACTLY ONCE: one row per file, and one copy of the bytes under the
   production root. A second row pointing at the same GLB, or the same GLB saved under a
   second name, would be two assets with one licence record. */
const urls = KEYS.map((k) => REG.modelAssetUrl(k));
chk(new Set(urls).size === urls.length, 'no two registry rows point at the same file');
const glbHashes = glbsOnDisk.map((g) => sha256(path.join(ROOT, g)));
chk(new Set(glbHashes).size === glbHashes.length,
    'and no model under assets/models/ is a duplicate copy of another (' + glbHashes.length + ' files, all distinct)');

/* EVERY PRODUCTION ROW DECLARES A REAL BUDGET CLASS AND A REAL COLLISION MODE. The class
   is checked against the budget model itself, evaluated beside the registry, so a typo is a
   failure rather than an `unavailable` verdict nobody reads. */
const BUD = (() => {
  const ctx = vm.createContext({});
  vm.runInContext(read('asset-registry.js') + '\n' + read('asset-budgets.js') +
                  '\n;globalThis.__B = { assetBudgetSpecOf, assetBudgetClass, validateAssetException };',
                  ctx, { filename: 'registry+budgets' });
  return ctx.__B;
})();
for (const k of production) {
  const spec = BUD.assetBudgetSpecOf(k);
  chk(!!spec && !!BUD.assetBudgetClass(spec.class),
      k + ' — declares the budget class "' + (spec && spec.class) + '", which the budget model knows');
  chk(!!spec && Array.isArray(spec.exceptions) &&
      spec.exceptions.every((e) => BUD.validateAssetException(e).valid !== false),
      k + ' — and its exception list is explicit (' + (spec ? spec.exceptions.length : '?') + ' exception(s))');
}
chk(BUD.assetBudgetSpecOf(FENCE) && BUD.assetBudgetSpecOf(FENCE).class === 'small-prop' &&
    BUD.assetBudgetSpecOf(FENCE).exceptions.length === 0,
    'the fence is a small-prop with NO budget exception');

/* INTEGRATED, NOT PLACED. Phase 4 puts the fence in the pipeline; where it stands in D1 is
   the layout phase's decision. Only the registry may name it until then — the phase that
   places it changes this check on purpose, in the diff that places it. */
const srcFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) srcFiles.push(p);
  }
})(path.join(ROOT, 'src'));
const namers = srcFiles.filter((f) => f !== path.join(ASSET_DIR, 'asset-registry.js') &&
                                      fs.readFileSync(f, 'utf8').indexOf(FENCE) >= 0)
                       .map((f) => path.relative(ROOT, f));
chk(namers.length === 0 && H.html().indexOf(FENCE) < 0,
    'no game code outside the registry names the fence — integrated into the pipeline, placed nowhere' +
    (namers.length ? ' (named in ' + namers.join(', ') + ')' : ''));

/* No dimension, generator or stamper may name a validation asset. */
const dimFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) dimFiles.push(p);
  }
})(path.join(ROOT, 'src', 'dimensions'));
let leaked = 0;
for (const f of dimFiles) {
  const t = fs.readFileSync(f, 'utf8');
  for (const k of validation) if (t.indexOf(k) >= 0) { leaked++; note('LEAK ' + path.relative(ROOT, f) + ' names ' + k); }
}
chk(leaked === 0, 'no validation asset is referenced from src/dimensions/');

let leakedWorld = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'src', 'world')).filter((n) => n.endsWith('.js'))) {
  const t = fs.readFileSync(path.join(ROOT, 'src', 'world', f), 'utf8');
  for (const k of validation) if (t.indexOf(k) >= 0) leakedWorld++;
}
chk(leakedWorld === 0, 'and none from src/world/');

// =====================================================================================
head('5. COLLISION IS DECLARED, NEVER DERIVED FROM A MESH');

chk(REG.ASSET_COLLISION.MESH === undefined,
    'there is no `mesh` collision mode — a render mesh is never a collision surface');
for (const k of KEYS) {
  const mode = REG.MODEL_ASSETS[k].collision;
  const known = Object.values(REG.ASSET_COLLISION).indexOf(mode) >= 0;
  chk(known, k + ' — declares a known collision mode (' + mode + ')');
  if (mode === REG.ASSET_COLLISION.BOXES) {
    chk(Array.isArray(REG.MODEL_ASSETS[k].boxes) && REG.MODEL_ASSETS[k].boxes.length > 0,
        k + ' — `boxes` mode actually carries boxes');
  }
}

/* ---- D1 PHASE 4 — THE FENCE'S PROXIES AGAINST THE FENCE'S OWN VERTICES -------------

   The boxes were fitted by hand to the approved mesh. That is a claim, and this section
   re-derives it from the shipped file on every run: if a later re-export moves the rail,
   the fit goes red here rather than being discovered as a player walking through timber. */
const fenceSpec = REG.MODEL_ASSETS[FENCE];
const FB = fenceSpec.boxes;
chk(fenceSpec.collision === REG.ASSET_COLLISION.BOXES && Array.isArray(FB) && FB.length === 2,
    'the fence declares exactly TWO local-space boxes — a post and a rail');
chk(Object.isFrozen(FB) && FB.every((b) => Object.isFrozen(b) && b.length === 6 &&
    b[0] < b[3] && b[1] < b[4] && b[2] < b[5]),
    'both are frozen, six numbers, and non-degenerate (min < max on every axis)');

const glb = readGlb(path.join(ROOT, REG.modelAssetUrl(FENCE)));
const inBox = (p, b, e) => p[0] >= b[0] - e && p[0] <= b[3] + e && p[1] >= b[1] - e &&
                           p[1] <= b[4] + e && p[2] >= b[2] - e && p[2] <= b[5] + e;
const outside = (p) => Math.min(...FB.map((b) => Math.max(b[0] - p[0], p[0] - b[3], b[1] - p[1],
                                                             p[1] - b[4], b[2] - p[2], p[2] - b[5], 0)));
const timber = glb.positions('rural_fence_post_01_wood');
const strap = glb.positions('rural_fence_post_01_bracket');
note('shipped GLB: ' + glb.nodes.length + ' mesh nodes, ' + timber.length + ' timber and ' +
     strap.length + ' strap vertices');
chk(timber.length > 0 && strap.length > 0, 'the timber and the steel strap were both read from the shipped file');
const timberOut = timber.filter((p) => !FB.some((b) => inBox(p, b, 1e-6)));
chk(timberOut.length === 0,
    'EVERY timber vertex lies inside a proxy — nothing solid-looking can be walked or aimed through (' +
    timberOut.length + ' outside)');
const strapWorst = Math.max(...strap.map(outside));
chk(strapWorst <= 0.015,
    'no strap vertex is more than 1.5 cm outside the nearest proxy (worst ' + (strapWorst * 100).toFixed(1) +
    ' cm) — which is why the strap is not a third box');

/* NO INVISIBLE WALL. The whole reason for two boxes rather than one: the open space under
   the rail is open. Measured as a volume and as the points a body actually passes through. */
const vol = (b) => (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2]);
const all = timber.concat(strap);
const bb = [0, 1, 2].map((i) => Math.min(...all.map((p) => p[i]))).concat(
           [0, 1, 2].map((i) => Math.max(...all.map((p) => p[i]))));
const ratio = FB.reduce((a, b) => a + vol(b), 0) / vol(bb);
note('render bounds ' + [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]].map((v) => v.toFixed(3)).join(' x ') +
     ' m; proxies fill ' + (100 * ratio).toFixed(1) + '% of that box');
chk(Math.abs((bb[4] - bb[1]) - 1.2) < 0.001 && Math.abs((bb[3] - bb[0]) - 1.9955) < 0.001,
    'the shipped geometry is the approved size — 1.2 m tall, ~1.996 m long, measured from the file');
chk(ratio < 0.25, 'the two proxies occupy under a quarter of the bounding box — it is not one giant solid');
for (const [x, y] of [[1.0, 0.05], [1.0, 0.40], [0.6, 0.70], [1.8, 0.30], [1.0, 1.10]]) {
  chk(!FB.some((b) => inBox([x, y, 0], b, 0)),
      'open air at (' + x + ', ' + y + ', 0) — ' + (y > 0.9 ? 'above' : 'under') + ' the rail — is not solid');
}

/* THE REAL COLLISION MODULE AND THE REAL RAYCAST, WITH THE REAL REGISTRY ROW. Only
   `THREE.Vector3.applyMatrix4` is stubbed — the one renderer call AssetCollisionSet.add
   makes — so the answers below are the shipped code's. */
const COLL = (() => {
  const ctx = vm.createContext({ Math, Infinity, Object, Array });
  vm.runInContext(`var THREE = { Vector3: function (x, y, z) {
      this.x = x; this.y = y; this.z = z;
      this.applyMatrix4 = function (m) { var e = m.elements, X = this.x, Y = this.y, Z = this.z;
        this.x = e[0]*X + e[4]*Y + e[8]*Z + e[12]; this.y = e[1]*X + e[5]*Y + e[9]*Z + e[13];
        this.z = e[2]*X + e[6]*Y + e[10]*Z + e[14]; return this; }; } };`, ctx);
  for (const f of ['src/assets/asset-registry.js', 'src/world/raycast.js', 'src/assets/asset-collision.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext('globalThis.__C = { AssetCollisionSet, RAYCAST_CATEGORY };', ctx);
  return ctx.__C;
})();
/* A placed instance: yaw `a` about +Y, then translate. Column-major, as three.js stores it. */
const placedFence = (a, tx, ty, tz) => {
  const c = Math.cos(a), s = Math.sin(a);
  return { userData: { assetKey: FENCE }, updateMatrixWorld() {},
           matrixWorld: { elements: [c, 0, -s, 0,  0, 1, 0, 0,  s, 0, c, 0,  tx, ty, tz, 1] } };
};
const aabb = (x, y, z, h) => ({ minX: x - h, maxX: x + h, minY: y - h, maxY: y + h, minZ: z - h, maxZ: z + h });

const set = new COLL.AssetCollisionSet();
const T = [100, 2, -50];
chk(set.add(placedFence(0, T[0], T[1], T[2]), null) === 2,
    'a placed fence registers its two boxes — no loaded mesh, no source bounds, only the row');
chk(set.collidesAABB(aabb(T[0] + 0.02, T[1] + 0.6, T[2], 0.02)) === true, 'the post is solid');
chk(set.collidesAABB(aabb(T[0] + 1.0, T[1] + 0.81, T[2], 0.02)) === true, 'the rail is solid at mid-span');
chk(set.collidesAABB(aabb(T[0] + 1.0, T[1] + 0.35, T[2], 0.1)) === false,
    'a 20 cm body in the gap under the rail touches nothing');
chk(set.isSolid(T[0] + 1.0, T[1] + 0.2, T[2]) === false && set.isSolid(T[0] + 1.0, T[1] + 0.8, T[2]) === true,
    'isSolid agrees: air under the rail, timber in it');
chk(Math.abs(set.groundHeightAt(T[0], T[2]) - (T[1] + 1.2)) < 1e-9,
    'groundHeightAt over the post is its crown (' + (T[1] + 1.2) + ')');
chk(Math.abs(set.groundHeightAt(T[0] + 1.0, T[2]) - (T[1] + 0.893)) < 1e-9,
    'and over the rail is the rail top — the highest proxy surface in that column');
chk(set.groundHeightAt(T[0] + 1.0, T[2] + 0.5) === null,
    'and NULL half a metre off the fence line — "no opinion", left to the terrain');

/* THE NORMALIZED RAYCAST, AT EYE HEIGHT AND BELOW THE RAIL. */
const ray = (ox, oy, oz, dx, dy, dz, max) => set.raycast({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz }, max);
const hRail = ray(T[0] + 1.0, T[1] + 0.8, T[2] + 3, 0, 0, -1, 10);
chk(!!hRail && Math.abs(hRail.distance - (3 - 0.036)) < 1e-6 && hRail.category === COLL.RAYCAST_CATEGORY.ASSET,
    'a ray at rail height strikes the rail face at ' + (hRail ? hRail.distance.toFixed(3) : '-') +
    ' m, category ASSET');
chk(!!hRail && hRail.normal && hRail.normal.z === 1 && hRail.normal.x === 0 && hRail.normal.y === 0,
    'with the outward normal of the face it entered (+Z)');
chk(!!hRail && typeof hRail.ref === 'number' && hRail.ref === set.entries[0].id,
    'and its ref is the placed entry\'s stable id — not a mesh, not a box index');
chk(ray(T[0] + 1.0, T[1] + 0.4, T[2] + 3, 0, 0, -1, 10) === null,
    'the same ray 40 cm lower passes UNDER the rail and hits nothing');
const hPost = ray(T[0] + 1.0, T[1] + 0.5, T[2], -1, 0, 0, 10);
chk(!!hPost && Math.abs(hPost.distance - (1.0 - 0.159)) < 1e-6 && hPost.normal.x === 1,
    'a ray along the fence line below the rail stops at the post\'s joint face (' +
    (hPost ? hPost.distance.toFixed(3) : '-') + ' m)');
/* The strap's own face where the ray meets it, read from the file, not assumed. */
const strapBand = strap.filter((p) => Math.abs(p[0] - 0.4) < 0.05 && p[1] > 0.82 && p[1] < 0.86);
const strapFace = Math.max(...strapBand.map((p) => p[2]));
const hStrap = ray(T[0] + 0.4, T[1] + 0.84, T[2] + 2, 0, 0, -1, 10);
chk(strapBand.length > 0 && !!hStrap && hStrap.ref === hRail.ref &&
    Math.abs((T[2] + 2 - hStrap.distance) - T[2] - strapFace) < 0.015,
    'a ray aimed at the steel strap resolves to the same fence, ' +
    (hStrap ? ((strapFace - (2 - hStrap.distance)) * 100).toFixed(1) : '?') + ' cm behind the strap face');

/* ROTATION AND TRANSLATION. Yaw +90 degrees carries local +X to world -Z, so the rail now
   runs south of the post; the boxes are re-fitted, not rotated in place. */
const rot = new COLL.AssetCollisionSet();
const R = [-20, 0, 40];
rot.add(placedFence(Math.PI / 2, R[0], R[1], R[2]), null);
chk(rot.isSolid(R[0], R[1] + 0.81, R[2] - 1.0) === true && rot.isSolid(R[0] + 1.0, R[1] + 0.81, R[2]) === false,
    'yawed 90 degrees, the rail runs along -Z and is no longer along +X');
const rb = rot.entries[0].boxes[1];
chk(Math.abs(rb.minZ - (R[2] - 1.914)) < 1e-9 && Math.abs(rb.maxZ - (R[2] - 0.159)) < 1e-9 &&
    Math.abs(rb.minX - (R[0] - 0.036)) < 1e-9 && Math.abs(rb.maxX - (R[0] + 0.036)) < 1e-9,
    'and its world box is exactly the local box carried through the placement');
const hRot = rot.raycast({ x: R[0] + 3, y: R[1] + 0.8, z: R[2] - 1.0 }, { x: -1, y: 0, z: 0 }, 10);
chk(!!hRot && Math.abs(hRot.distance - (3 - 0.036)) < 1e-6 && hRot.normal.x === 1,
    'and the raycast finds it there, from the side it now faces');
const skew = new COLL.AssetCollisionSet();
skew.add(placedFence(Math.PI / 6, 0, 0, 0), null);
const sb = skew.entries[0].boxes[1];
chk(sb.maxX - sb.minX > 1.4 && sb.maxZ - sb.minZ > 0.8,
    'at 30 degrees the rail box grows to an honest axis-aligned fit rather than pretending to rotate');

const coll = strip(read('asset-collision.js'));
for (const bad of ['BLOCK.', 'CHUNK_SX', 'CHUNK_SZ', 'getBlockWorld', 'voxel', 'chunk']) {
  chk(coll.indexOf(bad) < 0, 'asset-collision.js names no "' + bad + '"');
}
for (const q of ['collidesAABB', 'groundHeightAt', 'isSolid']) {
  chk(coll.indexOf(q + '(') >= 0, 'asset-collision.js answers the PhysicalWorld-shaped query ' + q);
}

// =====================================================================================
head('6. EVERY MODULE IN THE LAYER IS A CLASSIC SCRIPT AND OBEYS THE LAYER RULES');

note('src/assets/ holds ' + MODULES.length + ' modules: ' + MODULES.join(', '));
for (const f of E2_0A_MODULES) {
  chk(MODULES.indexOf(f) >= 0, 'the E2.0a module ' + f + ' is still here');
}

for (const f of MODULES) {
  const raw = read(f);
  const live = strip(raw);
  chk(/^"use strict";/.test(raw), f + ' — opens with "use strict"');
  chk(!/^\s*(import|export)\s/m.test(live), f + ' — no import/export (classic script)');
  chk(live.indexOf('BLOCK.') < 0, f + ' — names no block id');
  chk(!/\bdocument\./.test(live), f + ' — does not reach the DOM');
  chk(live.indexOf('window.game') < 0, f + ' — does not reach the Game');
}

/* THREE may not be named at LOAD TIME — the classic-script rule the whole of Era 1.5
   stands on. Every reference must be inside a function or method body. */
for (const f of MODULES) {
  const live = strip(read(f));
  const topLevel = live.split('\n').filter((l) => /^(const|let|var)\s+\w+\s*=.*\bTHREE\./.test(l));
  chk(topLevel.length === 0, f + ' — no top-level THREE reference');
  if (topLevel.length) note(topLevel.join(' | '));
}

const lib = strip(read('asset-library.js'));
chk(lib.indexOf('setTimeout') < 0, 'asset-library.js schedules nothing');
chk(lib.indexOf('.scene') < 0 || lib.indexOf('gltf.scene') >= 0,
    'asset-library.js touches a scene only as the glTF payload');

// =====================================================================================
head('7. THE VENDORED RENDERER IS THE ONE THE SUITES TEST AGAINST');

const vendor = H.vendorRefs().map((r) => r.rel);
note('vendored: ' + vendor.join(', '));
chk(vendor.indexOf('vendor/three/three.min.js') >= 0, 'game.html loads three from vendor/, not a CDN');
chk(H.html().indexOf('cdnjs.cloudflare.com') < 0, 'and no CDN script tag remains in game.html');
chk(vendor.indexOf('vendor/three/GLTFLoader.js') >= 0, 'GLTFLoader ships beside it');

const md5 = (p) => require('crypto').createHash('md5').update(fs.readFileSync(p)).digest('hex');
const shipped = md5(path.join(ROOT, 'vendor', 'three', 'three.min.js'));
const tested = md5(path.join(__dirname, 'vendor', 'three.min.js'));
chk(shipped === tested,
    'the renderer the game ships and the one the browser suites inject are byte-identical');
note('md5 ' + shipped);

/* Vendored code is a DEPENDENCY, not the build. If it ever lands in the reassembled
   source, eighteen text-scanning suites silently start reading three.js. */
chk(SRC.indexOf('THREE.REVISION=') < 0 && SRC.length < 3000000,
    'vendored three is NOT inlined into the reassembled build (' +
    (SRC.length / 1048576).toFixed(2) + ' MB)');
chk(H.modules().every((r) => r.rel.indexOf('vendor/') !== 0),
    'and modules() excludes vendor/ by construction');

/* The prepared upgrade is present and is NOT shipped. */
const prepared = path.join(ROOT, 'vendor', 'three', 'three.global.js');
chk(fs.existsSync(prepared), 'the prepared r186 bundle is committed for the version-agnostic test');
chk(vendor.indexOf('vendor/three/three.global.js') < 0, 'and game.html does NOT load it');
if (fs.existsSync(prepared)) {
  /* EVALUATED, not grepped. The bundle is minified, so `REVISION = "186"` survives as
     `sd="186"` behind an export getter and no text match can see it. Running it in a bare
     context and reading the global it publishes is both stronger and version-proof. */
  let rev = null, hasLoader = false, threw = null;
  try {
    const ctx = vm.createContext({ window: {}, self: {}, document: {} });
    vm.runInContext('globalThis.window=globalThis;' + fs.readFileSync(prepared, 'utf8') +
                    '\n;globalThis.__R=[THREE.REVISION, typeof THREE.GLTFLoader];', ctx,
                    { filename: 'three.global.js' });
    rev = ctx.__R[0]; hasLoader = ctx.__R[1] === 'function';
  } catch (e) { threw = e.message; }
  chk(String(rev) === '186', 'the prepared bundle evaluates and reports r' + rev +
      (threw ? ' (threw: ' + threw + ')' : ''));
  chk(hasLoader, 'and publishes THREE.GLTFLoader on the same global the classic build does');
}
chk(fs.existsSync(path.join(ROOT, 'vendor', 'three', 'README.md')),
    'vendor/three/README.md records the version strategy and the measured drift');

// =====================================================================================
head('8. THE LIBRARY IS WIRED INTO THE ONE COMPOSITION ROOT AND THE ONE TEARDOWN');

const game = fs.readFileSync(path.join(ROOT, 'src', 'core', 'game.js'), 'utf8');
chk(/this\.assets\s*=\s*new AssetLibrary\(/.test(game), 'Game constructs the AssetLibrary');
chk(/new AssetLibrary\(this\.renderer\)/.test(game), 'and hands it the renderer and nothing else');
chk(/this\.assets\.disposeAll\(\)/.test(game), 'and disposes it on the teardown a New Game and a Load both run');
chk((game.match(/new AssetLibrary\(/g) || []).length === 1, 'there is exactly ONE AssetLibrary in the build');

console.log('\n' + (fail ? 'FAILED — ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
process.exit(fail ? 1 : 0);
