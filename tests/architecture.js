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
  const dimFlagFiles = {};                 // file -> how many flag references it makes
  let monolithWorldTHREE = 0;              // VoxelWorld geometry still inside game.html
  const bump = (o, p) => { (ref[o] = ref[o] || {})[p] = (ref[o][p] || 0) + 1; };
  for (const u of units) {
    const own = owner(u);
    walk.full(u.ast, (n) => {
      if (!n.loc) return;
      const o = own[n.loc.start.line];
      if (n.type === 'Identifier') {
        if (n.name === 'THREE') {
          bump(o, 'THREE');
          /* P0-3 is counted per FILE in section 4b and per CLASS here, so a VoxelWorld
             body that has been moved into a budgeted module would be counted twice. Only
             what is still in the monolith is added to the section 6 total. */
          if (u.name === 'game.html:script' && o === 'VoxelWorld') monolithWorldTHREE++;
        }
        else if (n.name === 'BLOCK') bump(o, 'BLOCK');
        else if (/^(document|window|localStorage|navigator)$/.test(n.name)) bump(o, 'DOM');
      }
      if (n.type === 'MemberExpression' && n.property && n.property.name) {
        const p = n.property.name;
        if (/^(createGain|createOscillator|createBufferSource|createBiquadFilter|createPanner|createStereoPanner|createAnalyser|createDynamicsCompressor|decodeAudioData|createBuffer|createWaveShaper|createDelay|createConvolver)$/.test(p))
          bump(o, 'WebAudio');
        if (/^(inFarmlands|inSuburbia|inFakeHaven)$/.test(p)) {
          bump(o, 'DIMFLAG');
          dimFlagFiles[u.name] = (dimFlagFiles[u.name] || 0) + 1;
        }
      }
    });
  }
  const R = (cls, kind) => (ref[cls] && ref[cls][kind]) || 0;

  console.log('\n=== 4b. EACH LAYER OBEYS ITS OWN DEPENDENCY RULE ===\n');

  /* ARCHITECTURE.md section 1 states, per layer, what it may never touch. This turns that
     table into assertions, and it generalises: it holds for every module that lands in
     these directories in 1.5.3, 1.5.4 and 1.5.5 without anyone editing this test.

     A DATA MODULE THAT CONSTRUCTS A MESH IS NOT A DATA MODULE, and the whole point of
     Era 2 is that the renderer can be replaced — which is only true if the things that
     describe the world do not build it. */
  let worldGeometryTHREE = 0;              // filled in below; re-asserted by the §6 ratchet
  {
    const FORBIDDEN = {
      shared:      ['THREE', 'DOM', 'STORAGE', 'AUDIO', 'BLOCK'],
      world:       ['THREE', 'DOM', 'STORAGE', 'AUDIO'],
      dimensions:  ['THREE', 'DOM', 'STORAGE', 'AUDIO'],
      progression: ['THREE', 'DOM', 'STORAGE', 'AUDIO', 'BLOCK'],
      persistence: ['THREE', 'AUDIO'],
      audio:       ['THREE', 'DOM'],
      gameplay:    ['THREE', 'DOM', 'AUDIO'],
      horror:      ['DOM'],
      rendering:   ['DOM', 'AUDIO'],
      ui:          ['THREE', 'BLOCK'],
      core:        ['THREE', 'BLOCK'],
    };
    const PROBE = {
      THREE:   (n) => n.type === 'Identifier' && n.name === 'THREE',
      DOM:     (n) => n.type === 'Identifier' && /^(document|window|navigator)$/.test(n.name),
      STORAGE: (n) => n.type === 'Identifier' && n.name === 'localStorage',
      AUDIO:   (n) => n.type === 'Identifier' && /^(AudioContext|webkitAudioContext)$/.test(n.name),
      BLOCK:   (n) => n.type === 'Identifier' && n.name === 'BLOCK',
    };
    /* ERA 1.5.3 — WHY THREE IS STILL BANNED IN THESE TWO LAYERS, AND STILL LIFTED EIGHT
       TIMES BY NAME.

       Until this phase `world/` and `dimensions/` held nothing but tables, so banning
       THREE outright cost nothing. They now hold the voxel ENGINE and the four dimension
       generators — code whose entire job is to build geometry, and precisely the code
       Era 2 throws away. A blanket ban would be a lie about what was moved. Deleting the
       rule would be worse: the Era 2 SURVIVORS live in these same two directories (the
       block tables, the dimension descriptors, the site table, world-content.js), and a
       survivor that quietly starts building meshes is the one failure this rule exists to
       catch.

       So the ban stands BY DEFAULT — a new file in either layer may not touch THREE — and
       is lifted file by file, each under a ceiling measured on this build. A CEILING MAY
       FALL. IT MAY NEVER RISE. The eight entries sum to 81, which is the P0-3 figure
       section 6 has capped since 1.5.1; that total is re-asserted there, so the split
       cannot hollow the hotspot out by scattering it. */
    const WORLD_GEOMETRY_BUDGET = {
      'src/world/voxel-world.js':                  36,  // the engine: meshes, materials, lights
      'src/dimensions/overworld/stampers.js':       1,  // the decor group
      'src/dimensions/haven/generation.js':         9,
      'src/dimensions/haven/stampers.js':           5,  // hearth light, cosy light, two positions
      'src/dimensions/suburbia/generation.js':      4,
      'src/dimensions/suburbia/stampers.js':        8,  // window positions, a porch light
      'src/dimensions/farmlands/generation.js':    17,
      'src/dimensions/finale/scene.js':             1,  // the finale's own scene root
    };
    const threeSeen = {};
    let violations = 0;
    for (const u of units) {
      if (u.name === 'game.html:script') continue;
      const layer = u.name.split('/')[1];
      const declared = FORBIDDEN[layer];
      if (!declared) { chk(false, `${u.name} is in an unknown layer — add it to ARCHITECTURE.md §1`); continue; }
      const budgeted = Object.prototype.hasOwnProperty.call(WORLD_GEOMETRY_BUDGET, u.name);
      const rules = declared.filter(r => !(r === 'THREE' && budgeted));
      const hit = [];
      let threeCount = 0;
      walk.full(u.ast, (n) => {
        if (PROBE.THREE(n)) threeCount++;
        for (const r of rules) if (PROBE[r](n) && hit.indexOf(r) < 0) hit.push(r);
      });
      if (budgeted) threeSeen[u.name] = threeCount;
      if (hit.length) violations++;
      chk(hit.length === 0,
          `${u.name} touches none of: ${rules.join(', ')}` +
          (budgeted ? ` (THREE budgeted: ${threeCount}/${WORLD_GEOMETRY_BUDGET[u.name]})` : '') +
          (hit.length ? `  — VIOLATES: ${hit.join(', ')}` : ''));
    }
    chk(violations === 0,
        `all ${units.length - 1} extracted modules obey their layer's dependency rule`);

    /* THE BUDGET IS AUDITED IN BOTH DIRECTIONS. An entry that no longer matches a file is
       a stale exemption, and a stale exemption is a hole. */
    let overBudget = 0, missing = 0, total = 0;
    for (const name of Object.keys(WORLD_GEOMETRY_BUDGET)) {
      if (!Object.prototype.hasOwnProperty.call(threeSeen, name)) { missing++; continue; }
      total += threeSeen[name];
      if (threeSeen[name] > WORLD_GEOMETRY_BUDGET[name]) overBudget++;
    }
    chk(missing === 0,
        'every file the THREE budget exempts still exists — no stale exemption' +
        (missing ? ` — ${missing} named file(s) are gone; delete the entry` : ''));
    chk(overBudget === 0,
        `and none of the ${Object.keys(WORLD_GEOMETRY_BUDGET).length} exempt files is over its ceiling` +
        (overBudget ? ` — ${overBudget} over` : ''));
    console.log(`      world + dimension geometry: ${total} THREE references across ` +
                `${Object.keys(threeSeen).length} files — the whole of what Era 2 replaces`);
    worldGeometryTHREE = total;

    /* THE ONE DELIBERATE EXCEPTION, ASSERTED RATHER THAN LEFT SILENT. `audio` is the only
       layer above whose forbidden list omits BLOCK, because AUDIO_SURFACE_GROUPS maps
       block ids to footstep surfaces — which Phase 34 already named, along with
       AudioDirector.surfaceAt(), as the two things Era 2 replaces. The exception is
       exactly one table; the LIBRARY reading a block id is still a failure (section 5). */
    const audioUnit = units.find(u => u.name === 'src/audio/audio-tables.js');
    if (audioUnit) {
      let blockRefs = 0;
      walk.full(audioUnit.ast, (n) => { if (n.type === 'Identifier' && n.name === 'BLOCK') blockRefs++; });
      chk(blockRefs > 0,
          `src/audio/audio-tables.js names ${blockRefs} block ids — the ONE audio table that ` +
          'may, and one of the two things Era 2 replaces');
    }
  }

console.log('\n=== 4c. THE WORLD-ENGINE / DIMENSION-CONTENT SEAM (ERA 1.5.3) ===\n');

/* WHY THIS SECTION IS NOT OPTIONAL.

   The engine and the four dimensions share ONE prototype. That is what made the split
   possible without changing a line of the code that moved — and it is also why nothing
   stops the Farmlands from calling a suburban method, or the engine from reaching into
   the Haven: at runtime they are all just `this.`. A directory layout is not a boundary.
   These checks are the boundary.

   Every number below is DERIVED from the source by tests/harness/world-seam.js, which
   reads who declares what, who writes blocks, and who calls whom. Nothing here counts
   lines: a smaller file is evidence that work happened, not the contract. */
{
  const seam = require('./harness/world-seam.js').analyseWorldSeam(ROOT);

  chk(seam.sawEngineClass && seam.sawRegistrar,
      `the seam is readable: ${seam.engineNames.length} engine methods and ` +
      `${seam.contentNames.length} registered content methods across ` +
      `${Object.keys(seam.files).length} files`);

  /* ---- 1 & 8. THE ENGINE DECLARES NO DIMENSION CONTENT, AND NO COPY SURVIVES ----

     registerWorldContent already refuses at LOAD TIME to attach a name the engine
     declares, so a duplicate cannot reach a player. This is the static half: a method
     whose name says which place it belongs to has no business in a class that is
     supposed to know only how a voxel world works. */
  const DIMENSION_PREFIX = /^(_farm|_sub|_haven|_home|_w[A-Z]|update(Farm|Suburbia|Haven)|generateFakeHaven|corruptHaven|_gen(Farmlands|StaticSuburbia|Suburbia|DisconnectedHome))/;
  /* THE THREE NAMED EXCEPTIONS, AND THEY ARE A NAMING WART, NOT A LEAK. `_subSet`,
     `_subGet` and `_subHits` were written for the suburb and then used by every
     dimension; they are the engine's generic stamping primitives and every stamper in
     the build goes through them. Renaming them would touch several hundred call sites
     for a cosmetic gain, so Era 1.5.3 left the names and wrote them down instead. */
  const ENGINE_WART = ['_subSet', '_subGet', '_subHits'];
  const misplaced = seam.engineNames.filter(n => DIMENSION_PREFIX.test(n) && ENGINE_WART.indexOf(n) < 0);
  chk(misplaced.length === 0,
      'the engine declares nothing that names a dimension, beyond the three generic ' +
      'stamping primitives that kept their suburban names' +
      (misplaced.length ? ' — FOUND: ' + misplaced.join(', ') : ''));
  for (const w of ENGINE_WART)
    chk(seam.engineNames.indexOf(w) >= 0,
        `${w} is declared by the engine — a generic primitive with a suburban name, and it stays generic`);
  const dupes = seam.contentNames.filter(n => seam.engineNames.indexOf(n) >= 0);
  chk(dupes.length === 0,
      'and no name is declared twice — no dimension content survives inside the engine' +
      (dupes.length ? ' — BOTH: ' + dupes.join(', ') : ''));
  {
    const reg = fs.readFileSync(path.join(ROOT, 'src/world/world-content.js'), 'utf8');
    chk(/already declared on the/.test(reg) && /already owned by/.test(reg),
        'which registerWorldContent ALSO refuses at load time — once for a name the engine ' +
        'declares and once for a name another dimension owns, so the halves cannot diverge');
  }

  /* ---- 7. EVERY STAMPER IS IN A stampers.js ----

     The Era 1.5.3 finish line, and the sharpest single statement of the Era 2 seam: the
     only code that puts a block in the world, or even names one, is in a file called
     stampers.js. Everything else about a dimension — where a farm goes, how a street is
     laid out, which chunk holds what — survives the renderer. */
  const contentWriters = seam.writers.filter(n => seam.methods[n].dimension !== 'engine');
  const strays = contentWriters.filter(n => !/\/stampers\.js$/.test(seam.methods[n].file));
  chk(strays.length === 0,
      `all ${contentWriters.length} dimension methods that place a block live in a stampers.js` +
      (strays.length ? ' — OUTSIDE: ' + strays.map(n => seam.methods[n].file + '::' + n).join(', ') : ''));
  console.log('      write helpers derived from the source, not listed: ' + seam.helpers.join(', '));

  {
    const namers = [];
    for (const n of seam.contentNames) {
      const m = seam.methods[n];
      if (/\/stampers\.js$/.test(m.file)) continue;
      let hit = false;
      walk.full(m.node.value, (q) => {
        if (q.type === 'MemberExpression' && q.object && q.object.name === 'BLOCK') hit = true;
      });
      if (hit) namers.push(m.file + '::' + n);
    }
    chk(namers.length === 0,
        'and no method outside one so much as NAMES a block id — a generation.js survives Era 2' +
        (namers.length ? ' — FOUND: ' + namers.join(', ') : ''));
  }

  /* Every dimension that generates ground has both halves, so the split is real rather
     than a file that happens to be empty. */
  for (const dim of ['overworld', 'haven', 'suburbia', 'farmlands']) {
    const gen = Object.keys(seam.files).filter(f => seam.files[f].dimension === dim && seam.files[f].role === 'generation');
    const st  = Object.keys(seam.files).filter(f => seam.files[f].dimension === dim && seam.files[f].role === 'stampers');
    chk(gen.length === 1 && st.length === 1,
        `${dim} has exactly one generation.js and one stampers.js` +
        (gen.length === 1 && st.length === 1 ? ` (${seam.files[gen[0]].names.length} + ${seam.files[st[0]].names.length} methods)` : ''));
  }

  /* ---- 2, 3, 4. DIMENSION CONTENT DEPENDS ON NOTHING ABOVE IT ----

     A dimension describes a place. It does not know there is a game around it, a HUD in
     front of it, a sound engine beside it or a creature walking through it. This is what
     lets Era 2 rebuild a dimension without reading any of those, and 1.5.4 move Game
     without reading any of these. */
  {
    const ABOVE = {
      Game:   /^(Game|game)$/,
      UI:     /^(UIManager|ui|uiManager)$/,
      audio:  /^(SoundEngine|AudioLibrary|AudioDirector|soundEngine)$/,
      horror: /^(StalkerManager|BehemothManager|FinalSequence|Stalker|Behemoth)$/,
      DOM:    /^(document|window|localStorage|navigator)$/,
    };
    const found = {};
    for (const u of units) {
      if (!u.name.startsWith('src/dimensions/')) continue;
      walk.full(u.ast, (n) => {
        if (n.type !== 'Identifier') return;
        for (const k of Object.keys(ABOVE)) if (ABOVE[k].test(n.name)) (found[k] = found[k] || []).push(u.name);
      });
    }
    for (const k of Object.keys(ABOVE))
      chk(!found[k], `no dimension module reaches ${k}` +
          (found[k] ? ' — ' + [...new Set(found[k])].join(', ') : ''));
    /* And not through `this` either: a content method calling a method nothing in the
       world declares would be reaching into whatever else happens to be on the object. */
    const foreign = [];
    for (const n of seam.contentNames)
      for (const c of seam.methods[n].calls)
        if (!seam.methods[c] && !/^(idx|key)$/.test(c)) foreign.push(n + ' -> this.' + c + '()');
    chk(foreign.length === 0,
        'and no content method calls a `this` method the world does not declare' +
        (foreign.length ? ' — ' + [...new Set(foreign)].slice(0, 6).join(', ') : ''));
  }

  /* ---- 9. CROSS-DIMENSION DEPENDENCIES ----

     One, and it is named with its reason in src/dimensions/shared/stampers.js: the shared
     roof stamper asks Suburbia for the deterministic hash it was originally written
     against. A second one is a failure, not a precedent. */
  const CROSS_ALLOWED = [{ from: '_subStampRoof', to: '_subHash' }];
  const unexpected = seam.crossing.filter(c =>
    !CROSS_ALLOWED.some(a => a.from === c.from && a.to === c.to));
  chk(unexpected.length === 0,
      `${seam.crossing.length} cross-dimension call edge in the whole build, and it is the ` +
      'documented one' +
      (unexpected.length ? ' — UNEXPECTED: ' + unexpected.map(c => c.fromDimension + '::' + c.from + ' -> ' + c.toDimension + '::' + c.to).join(', ') : ''));
  for (const a of CROSS_ALLOWED)
    chk(seam.crossing.some(c => c.from === a.from && c.to === a.to),
        `and the exemption is not stale: ${a.from} still calls ${a.to}`);

  /* ---- 10. THE DISPATCH, AND WHICH WAY IT POINTS ----

     Dimension content calling the engine is the architecture working. The engine calling
     dimension content is the seam, and the whole of it must stay enumerable: if it is a
     short list, a fifth dimension is a row rather than a search.

     Era 1.5.3 turned `_generateChunk`'s if/else-if/else into a TABLE, so eight of the
     eleven edges the 1.5.1 inventory measured are now rows in
     src/dimensions/dimension-generators.js. Both halves are asserted. Reading only the
     prototype would report "three edges" and mean nothing — the failure CLAUDE.md §61.07
     names in its sharpest form. */
  const DISPATCH_ROWS = ['suburbia', 'farmlands', 'overworld'];
  chk(seam.generatorRows === DISPATCH_ROWS.length,
      `chunk generation is a table of ${seam.generatorRows} rows, resolved in order: ` +
      DISPATCH_ROWS.join(' -> ') + ' (the Overworld answers last, as the fallback)');
  chk(seam.tableDispatch.length === 8,
      `and the table carries all ${seam.tableDispatch.length} generation edges the engine used to name itself`);
  for (const d of seam.tableDispatch) console.log(`      row ${d.row}  ->  ${d.to}  (${d.dimension})`);
  {
    const gc = seam.methods._generateChunk;
    const named = gc ? [...gc.calls].filter(c => seam.methods[c] && seam.methods[c].dimension !== 'engine') : ['(no _generateChunk)'];
    chk(named.length === 0,
        '_generateChunk names no dimension method at all — it asks the table and hands over the chunk' +
        (named.length ? ' — STILL NAMES: ' + named.join(', ') : ''));
  }

  /* WHAT IS LEFT ON THE PROTOTYPE, AND WHY IT IS LEFT. Two eager region builds in the
     constructor and one water notification. Both are LIFECYCLE — when a dimension is
     built, and what happens after a block is written — which Era 1.5.4 owns along with
     the rest of startup. 1.5.3 does not reach into it, and the ceiling makes sure it does
     not grow while waiting. */
  const DISPATCHERS = ['constructor', 'setBlockWorld'];
  const DISPATCH_CEILING = 3;
  const fromOther = seam.dispatch.filter(d => DISPATCHERS.indexOf(d.from) < 0);
  chk(fromOther.length === 0,
      `the engine itself reaches dimension content from exactly ${DISPATCHERS.length} places: ` +
      DISPATCHERS.join(' and ') + ' — both lifecycle, both deferred to Era 1.5.4' +
      (fromOther.length ? ' — ALSO FROM: ' + [...new Set(fromOther.map(d => d.from))].join(', ') : ''));
  chk(seam.dispatch.length <= DISPATCH_CEILING,
      `and that is ${seam.dispatch.length} edges (ceiling ${DISPATCH_CEILING}, was 11 before this phase)`);
  for (const d of seam.dispatch) console.log(`      deferred  ${d.from} -> ${d.to}  (${d.dimension})`);
  chk(seam.dispatch.concat(seam.tableDispatch).filter(d => d.dimension === 'haven').length === 0,
      'and the Haven is in neither — the pocket is built on demand, never streamed (CLAUDE.md §58)');

  /* ---- src/world/ IS THE ENGINE AND NOTHING ELSE ---- */
  const contentInWorld = Object.keys(seam.files)
    .filter(f => f.startsWith('src/world/') && seam.files[f].dimension !== 'engine');
  chk(contentInWorld.length === 0,
      'src/world/ holds the engine and no dimension content' +
      (contentInWorld.length ? ' — FOUND: ' + contentInWorld.join(', ') : ''));
}

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
  /* THE FLAGS MAY NOT SPREAD, AND THAT IS A SHARPER RULE THAN A RAW COUNT.

     The ceiling covers the MONOLITH — the inline script, where all 112 of them live.
     Era 1.5.2 added a translation helper (dimensionOfPlayerFlags) whose entire purpose
     is to be the one place that reads these booleans so Era 1.5.4 can delete them, and
     it tripped the raw count on its first run. Raising the ceiling for it would have
     been the wrong answer: the number to hold down is how much of the BUILD depends on
     the booleans, and a single designated reader that exists in order to remove them is
     the opposite of that.

     So: the inline script is capped, and exactly one extracted module may read them. */
  const DIM_TRANSLATOR = 'src/dimensions/dimension-descriptors.js';

  /* ERA 1.5.3 SPLIT THE THING BOTH OF THESE CEILINGS WERE MEASURING, AND THAT IS THE
     TRAP THIS BLOCK EXISTS TO AVOID.

     `VoxelWorld` used to be one class declaration holding all 81 THREE references and
     `game.html:script` used to hold every dimension-flag read that was not in the
     translator. Both counts were therefore a single lookup. After the carve the same code
     sits in twelve files, so a per-class or per-file count would have gone on PASSING
     while measuring a fraction of what it was written to bound — the exact failure shape
     CLAUDE.md §61.05-61.07 names three times, and the one §62.6 wrote the source harness
     to prevent.

     So both ceilings are now measured across the WHOLE BUILD: the monolith plus every
     module the engine and its dimension content were carved into. The numbers are
     unchanged because the code is unchanged — it moved. */
  const CONTENT_DIM_READERS = {
    'src/dimensions/haven/stampers.js':       1,   // corruptHaven, guarding on inFakeHaven
    'src/dimensions/suburbia/generation.js':  2,
  };
  const inlineDim = dimFlagFiles['game.html:script'] || 0;
  const contentDim = Object.keys(CONTENT_DIM_READERS)
    .reduce((a, f) => a + (dimFlagFiles[f] || 0), 0);
  chk(inlineDim + contentDim <= CEILING.dimensionFlagRefs,
      `dimension-flag references outside the translator: ${inlineDim} in the monolith + ` +
      `${contentDim} in moved content = ${inlineDim + contentDim} ` +
      `(ceiling ${CEILING.dimensionFlagRefs}) — three booleans on the player, and P0-2 ` +
      'says do not add a fourth');

  /* THE READER SET IS CLOSED AND NAMED. Era 1.5.2 allowed exactly one extracted module to
     read the booleans: the translator, which exists in order to delete them. The carve
     moved three PRE-EXISTING reads out of the monolith with the content they belong to —
     no read was added, and neither file is new coupling. They are named here rather than
     waved through by a raw count, so a fourth reader is a failure and not a rounding
     error. Era 1.5.4 owns removing the booleans; these two entries go with them. */
  const allowedDimReaders = [DIM_TRANSLATOR].concat(Object.keys(CONTENT_DIM_READERS));
  const otherReaders = Object.keys(dimFlagFiles)
    .filter(f => f !== 'game.html:script' && allowedDimReaders.indexOf(f) < 0);
  chk(otherReaders.length === 0,
      `and the only extracted modules that read them are the translator plus ${Object.keys(CONTENT_DIM_READERS).length} ` +
      'moved content files, named above' +
      (otherReaders.length ? ` — ALSO READ BY: ${otherReaders.join(', ')}` : ''));
  let dimOver = 0;
  for (const f of Object.keys(CONTENT_DIM_READERS))
    if ((dimFlagFiles[f] || 0) > CONTENT_DIM_READERS[f]) dimOver++;
  chk(dimOver === 0,
      'and neither of those two grew a new read — a moved dependency may shrink, never grow');
  chk((dimFlagFiles[DIM_TRANSLATOR] || 0) > 0,
      'which does read them — it is the translation point Era 1.5.4 deletes the rest through');

  /* P0-3 IS NOW THE ENGINE PLUS ITS CONTENT, NOT ONE CLASS BODY. §4b summed the eight
     budgeted files; anything still inside a `class VoxelWorld` declaration IN THE MONOLITH
     is added here, so the check survives the class being put back or carved further and
     never counts the same reference twice. */
  const worldTHREE = worldGeometryTHREE + monolithWorldTHREE;
  chk(worldTHREE <= CEILING.voxelWorldTHREE,
      `world-building THREE references: ${worldTHREE} (ceiling ${CEILING.voxelWorldTHREE}) — P0-3, ` +
      `now measured across the engine and all four dimensions' content, not one class body`);
  chk(worldGeometryTHREE > 0,
      `and ${worldGeometryTHREE} of them are in extracted modules — the ratchet did not ` +
      'quietly start measuring an empty set');
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
  /* ERA 1.5.2 — SAVE_DIMENSIONS is now DERIVED from the dimension registry, so the
     literal this used to match no longer exists. The VALUE is pinned at runtime in
     tests/save.js, which is the stronger place for it; what belongs here is the
     structural claim: there is ONE source of truth and it is the registry. */
  chk(/const SAVE_DIMENSIONS = SAVEABLE_DIMENSIONS;/.test(build),
      'the saveable-dimension list is DERIVED from the dimension registry, not duplicated');
  chk(/const SAVE_DIMENSION_NAMES = SAVEABLE_DIMENSION_NAMES;/.test(build),
      'and so are the labels — one source of truth, not three');
  for (const n of ['overworld', 'farmlands', 'suburbia'])
    chk(new RegExp("saveName: '" + n + "'").test(build),
        `the registry still declares saveName '${n}' — a save-file value, frozen at v5`);
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

console.log('\n=== 7b. STABLE IDs ARE NOT CREATIVE DIMENSION NUMBERS ===\n');

/* THE LOCKED ARCHITECTURE DECISION, MADE MECHANICAL.

   stable id 1 is the Overworld. Creative D1 is the Shattered Farmlands. A bare integer
   says nothing about which question is being asked, so the registry gives every identity
   a NAMED field and the accessors refuse the wrong kind of number. These checks are
   here, in the architecture suite, because this is an architecture rule rather than a
   gameplay one — and because the cost of getting it wrong is a save file. */
{
  const reg = fs.existsSync(path.join(SRCDIR, 'dimensions', 'dimension-descriptors.js'))
    ? fs.readFileSync(path.join(SRCDIR, 'dimensions', 'dimension-descriptors.js'), 'utf8') : '';
  chk(reg.length > 0, 'the dimension registry exists');
  for (const field of ['stableId', 'creativeNumber', 'canonicalName', 'saveName'])
    chk(new RegExp('\\b' + field + ':').test(reg),
        `it distinguishes ${field} as its own named field`);

  /* The Overworld and the Haven must carry NO creative number. That is what makes code
     which assumed "the stable id is the dimension number" fail loudly. */
  chk(/DIMENSION\.OVERWORLD\]:[\s\S]{0,400}?creativeNumber: null/.test(reg),
      'the Overworld carries creativeNumber null — it is not the canon\'s D1');
  chk(/DIMENSION\.FAKE_HAVEN\]:[\s\S]{0,400}?creativeNumber: null/.test(reg),
      'and so does the Haven — a refuge is not a numbered chapter');
  chk(/DIMENSION\.FARMLANDS\]:[\s\S]{0,400}?creativeNumber: 1/.test(reg),
      'the Shattered Farmlands is creative D1 on stable id 2 — the two numbers differ, by design');
  chk(/DIMENSION\.SUBURBIA\]:[\s\S]{0,400}?creativeNumber: 2/.test(reg),
      'and Static Suburbia is creative D2 on stable id 3');

  /* Both accessors must REJECT the other kind of number rather than coerce it. */
  chk(/function dimensionByStableId[\s\S]{0,600}?throw new Error/.test(reg),
      'dimensionByStableId throws on a value that is not a stable id');
  chk(/function dimensionByCreativeNumber[\s\S]{0,700}?throw new Error/.test(reg),
      'dimensionByCreativeNumber throws on a value that is not a creative number');

  /* THE BELOW IS REPRESENTABLE AND NOT IMPLEMENTED. */
  chk(/canonicalName: 'The Below',\s*stableId: null/.test(reg),
      'The Below has a planned row with NO stable id — representable, not implemented');
  const belowBuilt = /generateBelow|_belowChunk|BELOW_SPAWN/.test(SRC.buildScript());
  chk(!belowBuilt, 'and no generator for it exists anywhere in the build');
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
