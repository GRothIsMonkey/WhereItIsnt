/* ERA 2 E2.0a — THE ASSET PIPELINE, OFFLINE.

   WHAT THIS FILE CAN PROVE. That the registry and the attribution documents agree in both
   directions; that no file path escapes the registry; that no validation asset has leaked
   into a dimension; that the vendored renderer is the one the suites test against; that
   the four modules obey the layer rules; and that the registry's own lookups return what
   they claim.

   WHAT IT CANNOT PROVE. That a GLB loads, that a material resolves, that a texture is in
   the right colour space, or that anything renders. Nothing offline in this repository
   can decode a GLB — the same reason `measure_runtime.js` had to be a browser tool to
   read 121 MP3s (CLAUDE.md §62.3). `tests/browser-assets.js` is where those claims are
   made, in a real Chromium, over HTTP, against a real WebGL context. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const H = require('./harness/source.js');
const SRC = H.buildScript();

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (m) => console.log('      ' + m);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

const ASSET_DIR = path.join(ROOT, 'src', 'assets');
const MODULES = ['asset-registry.js', 'asset-materials.js', 'asset-library.js', 'asset-collision.js'];
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
chk(production.length === 0,
    'E2.0a ships ZERO production assets — the landmark specifications have not been supplied');

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

const coll = strip(read('asset-collision.js'));
for (const bad of ['BLOCK.', 'CHUNK_SX', 'CHUNK_SZ', 'getBlockWorld', 'voxel', 'chunk']) {
  chk(coll.indexOf(bad) < 0, 'asset-collision.js names no "' + bad + '"');
}
for (const q of ['collidesAABB', 'groundHeightAt', 'isSolid']) {
  chk(coll.indexOf(q + '(') >= 0, 'asset-collision.js answers the PhysicalWorld-shaped query ' + q);
}

// =====================================================================================
head('6. THE FOUR MODULES ARE CLASSIC SCRIPTS AND OBEY THE LAYER RULES');

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
