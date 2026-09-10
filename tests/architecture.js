/* ERA 1.5 — THE ARCHITECTURE, AS A TEST.

   ARCHITECTURE.md states rules. This file is the half of them that a machine can hold, so
   that four more extraction phases cannot quietly erode them.

   WHAT IT PROVES.
     · that classic scripts share one global lexical scope — the single property the whole
       extraction plan stands on — re-measured, not remembered;
     · that the module mechanism is intact: every declared module exists, loads in the
       declared order, is a classic script, and is strict;
     · that a move was VERBATIM: no name is declared twice, and nothing was lost from the
       build's text;
     · that no module references a later module at LOAD time, which is what makes the
       declared order a contract rather than a coincidence;
     · that `shared/` depends on nothing;
     · that the boundaries ARCHITECTURE.md claims are already clean really are — measured
       on the live build, not quoted from a comment;
     · and that the P0 hotspots do not GROW while the extraction runs. That last one is a
       ratchet, and it is the point: an extraction phase that adds a fourth dimension
       boolean, or a THREE reference to the HUD, fails here.

   WHAT IT DOES NOT PROVE. That the architecture is good. That is a judgement for a person.
   It also runs no browser and no game — the live build is exercised by the ten browser
   suites, and the world's bit-identity by regression/journey/chain/performance.

   Offline. Needs `acorn` for the AST half; without it those checks SKIP and say so, and
   the rest still run. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = require('./harness/source.js');

const ROOT = SRC.ROOT;
const SRCDIR = path.join(ROOT, 'src');
let fail = 0, skipped = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const skip = (msg) => { console.log('SKIP  ' + msg); skipped++; };

let acorn = null, walk = null;
try { acorn = require('acorn'); walk = require('acorn-walk'); } catch (e) { /* below */ }

console.log('=== 1. THE PROPERTY THE PLAN STANDS ON ===\n');

/* Not "we believe classic scripts share scope" — run two scripts in one context and look.
   This is the Node half. The browser half is proved every time a browser suite boots the
   real page, because game.html's inline script uses names four modules declared. */
{
  const s = { console: { log() {} } };
  vm.createContext(s);
  vm.runInContext('const _A_ = 41; class _K_ { v(){ return _A_ + 1; } } function _f_(){ return new _K_().v(); }', s);
  vm.runInContext('const _B_ = _f_();', s);
  chk(vm.runInContext('_B_', s) === 42,
      'a classic script sees the const, class and function a previous one declared');
  chk(vm.runInContext('typeof _K_', s) === 'function',
      'and a later evaluation reaches that class by name — which is how `ev(...)` works');
  chk(vm.runInContext('typeof globalThis._A_', s) === 'undefined',
      'a top-level `const` is a LEXICAL binding, not a property of the global object');
}

console.log('\n=== 2. THE MODULE MECHANISM ===\n');

const modules = SRC.modules();
chk(modules.length > 0, `game.html declares ${modules.length} repository module(s)`);
chk(modules.every(m => fs.existsSync(m.abs)),
    'every declared module exists on disk (a missing one is a broken build, never "nothing to scan")');

/* The order game.html declares must be the order the harness replays, or the offline
   suites are testing a program the browser never runs. */
{
  const declared = modules.map(m => m.rel);
  const html = SRC.html();
  const positions = declared.map(r => html.indexOf('src="' + r + '"'));
  const ascending = positions.every((p, i) => i === 0 || p > positions[i - 1]);
  chk(ascending && positions.every(p => p >= 0),
      'the module list is in document order — order is the contract');
  const inline = html.indexOf('\n<script>\n');
  chk(positions.every(p => p < inline),
      'every module is declared BEFORE the inline <script> that uses it');
}

/* Classic scripts only. An `import` under src/ silently changes the scope rules the whole
   plan depends on, and would break the harness without breaking the browser. */
function allSrcFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? allSrcFiles(path.join(dir, e.name))
                    : (e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
}
const srcFiles = allSrcFiles(SRCDIR);
chk(srcFiles.length === modules.length,
    `every .js under src/ is loaded by game.html (${srcFiles.length} files, ${modules.length} tags) — no orphans`);

{
  const bad = [];
  for (const f of srcFiles) {
    const t = fs.readFileSync(f, 'utf8');
    if (/^\s*(import|export)\s/m.test(t)) bad.push(path.relative(ROOT, f));
  }
  chk(bad.length === 0, 'no ES module syntax under src/ — these are CLASSIC scripts' +
      (bad.length ? ' — FOUND IN: ' + bad.join(', ') : ''));
  chk(!/type="module"/.test(SRC.html()), 'and game.html declares no module script');
}

{
  const bad = srcFiles.filter(f => !/^"use strict";/.test(fs.readFileSync(f, 'utf8')));
  chk(bad.length === 0,
      'every extracted file opens with "use strict" — an external classic script is not strict by default' +
      (bad.length ? ' — MISSING IN: ' + bad.map(f => path.relative(ROOT, f)).join(', ') : ''));
}

console.log('\n=== 3. A MOVE WAS VERBATIM ===\n');

if (!acorn) { skip('no acorn — the AST checks in sections 3-6 did not run (cd tests && npm install)'); }
else {
  const parts = modules.map(m => ({ name: m.rel, code: fs.readFileSync(m.abs, 'utf8') }));
  parts.push({ name: 'game.html:script', code: SRC.inlineBody().code });
  const units = parts.map(p => ({ ...p, ast: acorn.parse(p.code, { ecmaVersion: 2022, locations: true }) }));

  /* Top-level names, and where each was declared. A name declared twice means a block was
     copied rather than moved, and in a shared lexical scope the second one is a
     SyntaxError in the browser — but only at runtime, and only on that page load. */
  const declaredIn = new Map();
  const dupes = [];
  for (const u of units) {
    for (const n of u.ast.body) {
      const add = (name) => {
        if (declaredIn.has(name)) dupes.push(`${name} (${declaredIn.get(name)} and ${u.name})`);
        else declaredIn.set(name, u.name);
      };
      if (n.type === 'ClassDeclaration' || n.type === 'FunctionDeclaration') add(n.id.name);
      else if (n.type === 'VariableDeclaration') for (const d of n.declarations) {
        const pat = (p) => { if (!p) return;
          if (p.type === 'Identifier') add(p.name);
          else if (p.type === 'ObjectPattern') p.properties.forEach(q => pat(q.value || q.argument));
          else if (p.type === 'ArrayPattern') p.elements.forEach(pat); };
        pat(d.id);
      }
    }
  }
  chk(dupes.length === 0,
      `no top-level name is declared twice across the build (${declaredIn.size} names)` +
      (dupes.length ? ' — DUPLICATED: ' + dupes.join(', ') : ''));

  /* LOAD-TIME ORDER SAFETY. A module may name a later module's export inside a function
     body — that resolves at call time, and everything is loaded by then. Naming one at
     load time is a TDZ error. This is what makes the declared order safe to reason about. */
  const GLOBALS = new Set(['Math','JSON','Object','Array','String','Number','Boolean','Map','Set',
    'WeakMap','WeakSet','Promise','Symbol','Error','TypeError','RangeError','Date','console','window',
    'document','navigator','localStorage','performance','requestAnimationFrame','cancelAnimationFrame',
    'setTimeout','clearTimeout','setInterval','clearInterval','isNaN','isFinite','parseInt','parseFloat',
    'encodeURIComponent','decodeURIComponent','Uint8Array','Uint8ClampedArray','Int8Array','Uint16Array',
    'Int16Array','Uint32Array','Int32Array','Float32Array','Float64Array','ArrayBuffer','DataView','THREE',
    'undefined','NaN','Infinity','globalThis','self','AudioContext','webkitAudioContext','Image','fetch',
    'XMLHttpRequest','Audio','Function','RegExp','Proxy','Reflect','TextDecoder','TextEncoder','crypto',
    'URL','Blob','atob','btoa','alert','structuredClone','queueMicrotask']);
  const order = new Map(units.map((u, i) => [u.name, i]));
  const violations = [];
  for (const u of units) {
    const mine = order.get(u.name);
    const visit = (node, inFn) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(x => visit(x, inFn));
      if (!node.type) return;
      const isFn = /Function(Declaration|Expression)$/.test(node.type) || node.type === 'ArrowFunctionExpression';
      if (node.type === 'Identifier' && !inFn && !GLOBALS.has(node.name)) {
        const where = declaredIn.get(node.name);
        if (where !== undefined && order.get(where) > mine)
          violations.push(`${u.name} evaluates ${node.name} at load time, declared later in ${where}`);
      }
      for (const k in node) {
        if (k === 'loc' || k === 'start' || k === 'end' || k === 'range') continue;
        const c = node[k];
        if (!c || typeof c !== 'object') continue;
        if (node.type === 'MemberExpression' && k === 'property' && !node.computed) continue;
        if ((node.type === 'Property' || node.type === 'MethodDefinition') && k === 'key' && !node.computed) continue;
        visit(c, inFn || isFn);
      }
    };
    u.ast.body.forEach(n => visit(n, false));
  }
  chk(violations.length === 0,
      'no module reaches a LATER module at load time — the declared order is safe' +
      (violations.length ? '\n        ' + violations.slice(0, 6).join('\n        ') : ''));

  console.log('\n=== 4. `shared/` DEPENDS ON NOTHING ===\n');
  {
    const shared = units.filter(u => u.name.startsWith('src/shared/'));
    if (!shared.length) skip('nothing in src/shared/ yet');
    for (const u of shared) {
      const hits = [];
      walk.full(u.ast, (n) => {
        if (n.type !== 'Identifier') return;
        if (/^(THREE|document|window|localStorage|navigator|BLOCK)$/.test(n.name)) hits.push(n.name);
      });
      chk(hits.length === 0,
          `${u.name} touches no THREE, DOM, storage or block id` +
          (hits.length ? ' — FOUND: ' + [...new Set(hits)].join(', ') : ''));
    }
  }

  /* ---- the reference census the boundary checks below are all built on ---- */
  const owner = (u) => {
    const o = new Array(u.code.split('\n').length + 2).fill('<top-level>');
    for (const n of u.ast.body) if (n.type === 'ClassDeclaration')
      for (let l = n.loc.start.line; l <= n.loc.end.line; l++) o[l] = n.id.name;
    return o;
  };
  const ref = {};
  const bump = (o, p) => { (ref[o] = ref[o] || {})[p] = (ref[o][p] || 0) + 1; };
  for (const u of units) {
    const own = owner(u);
    walk.full(u.ast, (n) => {
      if (!n.loc) return;
      const o = own[n.loc.start.line];
      if (n.type === 'Identifier') {
        if (n.name === 'THREE') bump(o, 'THREE');
        else if (n.name === 'BLOCK') bump(o, 'BLOCK');
        else if (/^(document|window|localStorage|navigator)$/.test(n.name)) bump(o, 'DOM');
      }
      if (n.type === 'MemberExpression' && n.property && n.property.name) {
        const p = n.property.name;
        if (/^(createGain|createOscillator|createBufferSource|createBiquadFilter|createPanner|createStereoPanner|createAnalyser|createDynamicsCompressor|decodeAudioData|createBuffer|createWaveShaper|createDelay|createConvolver)$/.test(p))
          bump(o, 'WebAudio');
        if (/^(inFarmlands|inSuburbia|inFakeHaven)$/.test(p)) bump(o, 'DIMFLAG');
      }
    });
  }
  const R = (cls, kind) => (ref[cls] && ref[cls][kind]) || 0;

  console.log('\n=== 5. THE BOUNDARIES THAT ARE ALREADY CLEAN, AND MUST STAY CLEAN ===\n');

  chk(R('AudioDirector', 'WebAudio') === 0,
      'AudioDirector creates no AudioNode — it is POLICY (CLAUDE.md §61)');
  chk(R('AudioLibrary', 'BLOCK') === 0,
      'AudioLibrary reads no block id — it is FILES (CLAUDE.md §61)');
  chk(R('UIManager', 'BLOCK') === 0 && R('UIManager', 'THREE') === 0,
      'UIManager reaches no block id and no THREE — the HUD cannot see the world (CLAUDE.md §53)');
  chk(R('SaveSystem', 'THREE') === 0,
      'SaveSystem knows no renderer detail');
  chk(R('ObjectiveSystem', 'THREE') === 0 && R('ObjectiveSystem', 'BLOCK') === 0,
      'ObjectiveSystem owns no coordinate, mesh or block id');

  console.log('\n=== 6. THE P0 RATCHET — HOTSPOTS MAY SHRINK, NEVER GROW ===\n');

  /* Baselines measured on the Phase 36 build (commit db222ee), before any Era 1.5 change.
     These are CEILINGS. An extraction phase that makes one of them worse fails here and
     has to explain itself. Lower them when a phase actually improves one. */
  const CEILING = {
    dimensionFlagRefs: 112,  // P0-2 — player.inFarmlands / .inSuburbia / .inFakeHaven, 35 of them writes
    voxelWorldTHREE:   81,   // P0-3 — world generation building meshes
    playerDOM:         10,   // P1-2 — PlayerController binding raw input
  };
  const dimTotal = Object.values(ref).reduce((t, c) => t + (c.DIMFLAG || 0), 0);
  chk(dimTotal <= CEILING.dimensionFlagRefs,
      `dimension-flag references: ${dimTotal} (ceiling ${CEILING.dimensionFlagRefs}) — ` +
      'three booleans on the player, and P0-2 says do not add a fourth');
  chk(R('VoxelWorld', 'THREE') <= CEILING.voxelWorldTHREE,
      `VoxelWorld THREE references: ${R('VoxelWorld','THREE')} (ceiling ${CEILING.voxelWorldTHREE}) — P0-3`);
  chk(R('PlayerController', 'DOM') <= CEILING.playerDOM,
      `PlayerController DOM references: ${R('PlayerController','DOM')} (ceiling ${CEILING.playerDOM}) — P1-2`);
}

console.log('\n=== 7. WHAT ERA 1.5 IS FORBIDDEN TO CHANGE ===\n');

{
  const build = SRC.buildSource();
  chk(/const SAVE_VERSION = 5;/.test(build),
      'the save schema is still version 5 — frozen for the whole of Era 1.5');
  chk(/const SAVE_STORAGE_KEY = 'whereitisnt\.save\.v1';/.test(build),
      "and the save key is still 'whereitisnt.save.v1'");
  chk(/const SAVE_DIMENSIONS = \['overworld', 'farmlands', 'suburbia'\];/.test(build),
      'and the saved dimension names are unchanged');
  chk(/const DIMENSION = \{ OVERWORLD: 1, FARMLANDS: 2, SUBURBIA: 3, FAKE_HAVEN: 4 \};/.test(build),
      'and the DIMENSION ids are unchanged — an id is a save-file value');
  /* The build's TEXT must still contain what the eighteen text-scanning suites look for.
     If buildSource() ever returned only game.html, this is the check that would notice. */
  chk(build.length > SRC.html().length,
      'buildSource() is larger than game.html — the modules really are being reassembled');
  chk(/class SimplexNoise/.test(build) && /const ITEM = \{/.test(build) && /class GameSettings/.test(build),
      'and it contains the extracted code, so no text suite silently scans less than before');

  /* AND IT MUST BE ONE BLOCK. A suite does not only grep this string: story.js walks it
     for ^<script> / ^</script> to isolate "the code a player actually meets", and two
     suites split on '<script>' to get the markup. An early version of buildSource()
     handed back five script blocks; story.js took the FIRST — a 115-line module — and
     three checks that had been reading forty thousand lines quietly started reading a
     hundred and fifteen. The fix for "a test silently scans less" must not itself make a
     test silently scan less. */
  const opens = (build.match(/^<script>$/gm) || []).length;
  const closes = (build.match(/^<\/script>$/gm) || []).length;
  chk(opens === 1 && closes === 1,
      `buildSource() yields exactly ONE <script> block (${opens} open, ${closes} close) — ` +
      'the line-walking idiom in story.js depends on it');

  const lines = build.split('\n');
  let a = -1, b = -1;
  for (let i = 0; i < lines.length; i++) {
    if (a < 0 && /^<script>\s*$/.test(lines[i])) { a = i + 1; continue; }
    if (a >= 0 && /^<\/script>\s*$/.test(lines[i])) { b = i; break; }
  }
  const body = lines.slice(a, b).join('\n');
  chk(/class SimplexNoise/.test(body) && /class VoxelWorld/.test(body) && /class GameSettings/.test(body),
      'and that block holds BOTH the extracted modules and the inline body — ' +
      `${b - a} lines, not ${SRC.inlineBody().code.split('\n').length}`);
}

console.log('\n=== 8. THE SKELETON IS DOCUMENTED ===\n');

{
  const layers = ['shared','core','gameplay','world','dimensions','progression','horror',
                  'audio','rendering','ui','persistence'];
  const missing = layers.filter(l => !fs.existsSync(path.join(SRCDIR, l, 'LAYER.md')));
  chk(missing.length === 0,
      `all ${layers.length} layers carry a LAYER.md stating what they own and what moves there` +
      (missing.length ? ' — MISSING: ' + missing.join(', ') : ''));
  chk(fs.existsSync(path.join(ROOT, 'ARCHITECTURE.md')), 'ARCHITECTURE.md exists');
  chk(fs.existsSync(path.join(ROOT, 'ARCHITECTURE-INVENTORY.md')), 'ARCHITECTURE-INVENTORY.md exists');
}

console.log('');
if (skipped) console.log(skipped + ' CHECK GROUP(S) SKIPPED');
if (fail) { console.log(fail + ' ARCHITECTURE CHECK(S) FAILED'); process.exit(1); }
console.log('ALL ERA 1.5 ARCHITECTURE CHECKS PASS');
console.log('      Offline. This proves the module mechanism and the boundaries — not that');
console.log('      the architecture is good, which is a judgement for a person. The live');
console.log('      build is exercised by the ten browser suites; world bit-identity by');
console.log('      regression / journey / chain / performance.');
