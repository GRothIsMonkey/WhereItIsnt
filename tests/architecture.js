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
  const dimFlagWrites = [];                // ERA 1.5.6 — every ASSIGNMENT to one, anywhere
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
      /* ERA 1.5.6 — A WRITE IS A DIFFERENT FACT FROM A READ, AND IT IS THE ONE THAT
         MATTERED. The booleans are derived getters now; an assignment to one cannot
         change where the player is, it can only diverge from it. There must be none. */
      if ((n.type === 'AssignmentExpression' || n.type === 'UpdateExpression')) {
        const t = n.type === 'AssignmentExpression' ? n.left : n.argument;
        if (t && t.type === 'MemberExpression' && t.property && t.property.name &&
            /^(inFarmlands|inSuburbia|inFakeHaven)$/.test(t.property.name)) {
          dimFlagWrites.push(`${u.name}:${n.loc.start.line} .${t.property.name}`);
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
    /* ERA 1.5.4 — THE SAME MECHANISM, FOR THE APPLICATION LAYER.

       `core/` and `persistence/` were declared THREE-free when they held a settings
       object and a table of schema constants. They now hold the COMPOSITION ROOT, and a
       composition root constructs the render stack — that is what makes it the
       composition root. Banning it outright would be a lie about what Game is; deleting
       the rule would let a settings table start building meshes unnoticed.

       So, exactly as 1.5.3 did for the world: the ban stands by default and is lifted
       file by file, by name, under a ceiling measured on this build. Each entry says what
       the references ARE, because a budget without a reason is just a bigger number.

       These are the ones Era 1.5.5 should reduce: when `rendering/` becomes a real layer
       and owns the renderer, the scene and the camera, game.js's five should fall to
       roughly zero. A CEILING MAY FALL. IT MAY NEVER RISE. */
    /* ERA 1.5.6 — THE SAME MECHANISM AGAIN, FOR THE RENDERING LAYER.

       `rendering/` was declared THREE-allowed and DOM-forbidden when it was an empty
       directory with a LAYER.md. It now holds the sky, the post pass, the particles, the
       target outline and every creature and animal mesh in the game.

       THREE was always going to be allowed here — that is what the layer is. DOM was not,
       and should not be: a mesh builder that reaches for the document is doing something
       wrong. Exactly one file needs it, for exactly one reason, and it is named rather
       than waved through. A CEILING MAY FALL. IT MAY NEVER RISE. */
    const RENDER_BUDGET = {
      'src/rendering/postfx.js': { DOM: 4 },
      //  DOM: window.innerWidth/innerHeight, twice — the render target's size and the
      //       uResolution uniform that must agree with it. A post-processing pass is
      //       sized to the VIEWPORT; there is nowhere else that number comes from.
      //       Everything else in this layer is 0 and must stay 0.
    };
    const APP_BUDGET = {
      'src/core/game.js':                  { THREE: 5, BLOCK: 4 },
      //  THREE: WebGLRenderer, PCFSoftShadowMap, Scene, PerspectiveCamera, Clock — the
      //         render stack the composition root builds. 1.5.5's to move.
      //  BLOCK: the starter torch, and the lantern/anchor test in the light bookkeeping.
      'src/core/dev-tools.js':             { THREE: 4 },
      //  THREE: Vector3 destinations for the developer teleports.
      'src/persistence/save-lifecycle.js': { THREE: 1, BLOCK: 2 },
      //  THREE: one Vector3, the fallback spawn saveFallbackSpawn returns.
      //  BLOCK: BLOCK.AIR twice, in findSafeLanding's headroom test. (`persistence` does
      //         not forbid BLOCK, so this pair is recorded rather than exempted.)
    };

    const threeSeen = {};
    const appSeen = {};
    let violations = 0;
    for (const u of units) {
      if (u.name === 'game.html:script') continue;
      const layer = u.name.split('/')[1];
      const declared = FORBIDDEN[layer];
      if (!declared) { chk(false, `${u.name} is in an unknown layer — add it to ARCHITECTURE.md §1`); continue; }
      const budgeted = Object.prototype.hasOwnProperty.call(WORLD_GEOMETRY_BUDGET, u.name);
      const app = APP_BUDGET[u.name] || RENDER_BUDGET[u.name] || null;
      const rules = declared.filter(r =>
        !(r === 'THREE' && budgeted) && !(app && Object.prototype.hasOwnProperty.call(app, r)));
      const hit = [];
      let threeCount = 0;
      const appCount = {};
      walk.full(u.ast, (n) => {
        if (PROBE.THREE(n)) threeCount++;
        if (app) for (const k of Object.keys(app)) if (PROBE[k](n)) appCount[k] = (appCount[k] || 0) + 1;
        for (const r of rules) if (PROBE[r](n) && hit.indexOf(r) < 0) hit.push(r);
      });
      if (budgeted) threeSeen[u.name] = threeCount;
      if (app) appSeen[u.name] = appCount;
      if (hit.length) violations++;
      chk(hit.length === 0,
          `${u.name} touches none of: ${rules.join(', ') || '(nothing left to forbid)'}` +
          (budgeted ? ` (THREE budgeted: ${threeCount}/${WORLD_GEOMETRY_BUDGET[u.name]})` : '') +
          (app ? ` (budgeted: ${Object.keys(app).map(k => k + ' ' + (appCount[k] || 0) + '/' + app[k]).join(', ')})` : '') +
          (hit.length ? `  — VIOLATES: ${hit.join(', ')}` : ''));
    }
    chk(violations === 0,
        `all ${units.length - 1} extracted modules obey their layer's dependency rule`);

    /* THE APPLICATION BUDGET IS AUDITED IN BOTH DIRECTIONS TOO. */
    {
      let over = 0, stale = 0;
      const BOTH = Object.assign({}, APP_BUDGET, RENDER_BUDGET);
      for (const name of Object.keys(BOTH)) {
        if (!appSeen[name]) { stale++; continue; }
        for (const k of Object.keys(BOTH[name]))
          if ((appSeen[name][k] || 0) > BOTH[name][k]) over++;
      }
      chk(stale === 0,
          'every file the application and rendering budgets name still exists — no stale exemption' +
          (stale ? ` — ${stale} gone; delete the entry` : ''));
      chk(over === 0,
          `and none of the ${Object.keys(BOTH).length} budgeted files is over its ceiling` +
          (over ? ` — ${over} over` : ''));
      /* AND THE REST OF THE LAYER IS CLEAN, WHICH IS THE HALF THAT MATTERS. One file
         needs the viewport; nothing else in rendering/ may touch the document at all. */
      const renderDOM = units.filter(u => /^src\/rendering\//.test(u.name) &&
                                          !RENDER_BUDGET[u.name]);
      chk(renderDOM.length > 0,
          `and the other ${renderDOM.length} rendering modules reach no DOM at all — ` +
          'a mesh builder has no business knowing there is a document');
    }

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

console.log('\n=== 4d. THE APPLICATION SEAM (ERA 1.5.4) ===\n');

/* WHY THIS SECTION IS NOT OPTIONAL.

   Under classic scripts, moving `Game` into its own file costs nothing and proves nothing.
   Every top-level name in the build still shares one global lexical scope, so Game can
   still reach anything it could reach before, and no diff would ever show it. A directory
   layout is not a boundary — this section is.

   What it does is make Game's dependency surface DECLARED. Every name Game reaches from
   outside its own file is listed below, attributed to the file that declares it. A new
   hidden dependency fails here. So does a stale one. That is what "the same-script
   dependencies have been addressed" can honestly mean in a build with no imports. */
{
  const seam = require('./harness/app-seam.js').analyseAppSeam(ROOT);

  /* ---- 1. GAME LEFT THE MONOLITH ---- */
  chk(seam.gameFile === 'src/core/game.js' && !seam.gameInInline,
      `Game is declared in ${seam.gameFile} and not in game.html (${seam.members.length} methods)`);

  /* ---- 2. THE DEPENDENCY MANIFEST ----

     This is the list Era 1.5.5 shrinks. Everything under `game.html:script` is a symbol
     Game reaches that has not been extracted yet — twenty of them are the subsystem
     classes the composition root constructs (PlayerController, UIManager, SoundEngine and
     the rest), which 1.5.4 deliberately did NOT swallow, and the remainder are tables that
     travel with them. Everything under a `src/` path is a dependency that is now a real
     module rather than a coincidence of file order. */
  const GAME_DEPENDS_ON = {
    'game.html:script': ['AnchorMonumentManager', 'ArrowManager', 'EnvironmentStorySystem', 'FARM_J_LINE', 'FARM_P', 'FarmAnimalManager', 'FinalSequence', 'HAVEN_ENDING_FROM', 'HAVEN_SHIFT_SECONDS', 'INVENTORY_SIZE', 'ItemEntityManager', 'MOB_CAP_BASE', 'MOB_CAP_MAX', 'MOB_CAP_PER_STAGE', 'MainMenu', 'MobManager', 'ObjectiveSystem', 'OpeningFilm', 'OpeningInstruction', 'PROGRESSION_MILESTONES', 'PROGRESSION_MILESTONE_IDS', 'PhantomHallucinator', 'PlayerController', 'SanitySystem', 'SoundEngine', 'StalkerAI', 'UIManager', 'buildBlockAtlas', 'farmJourneyOrd', 'farmlandsBiomeAt', 'havenDissolveAt', 'havenStageAt'],
    'src/audio/audio-tables.js': ['AUDIO_INDOOR_SETTLE', 'AUDIO_TRANSPORT_BLOCKED'],
    'src/core/game.js': ['Game'],                 // its own name, in a `new Game()` guard
    'src/core/settings.js': ['GameSettings', 'SETTINGS_STORAGE_KEY', 'isDocumentFullscreen', 'safeLocalStorage'],
    /* ERA 1.5.6 CUT A — Game no longer assigns dimension booleans. These two are what
       replaced the nine assignments: one setter, and one saveName lookup for the load
       path. Both are real src/ module dependencies, which is the direction this
       manifest exists to reward. */
    'src/dimensions/dimension-descriptors.js': ['dimensionBySaveName', 'setPlayerDimension'],
    'src/dimensions/dimension-registry.js': ['DIMENSION'],
    'src/gameplay/onboarding-cues.js': ['ONBOARDING_CUE_IDS'],
    'src/persistence/save-lifecycle.js': ['SaveSystem', 'captureWorldState', 'defaultSaveState', 'describeSaveState', 'findSafeLanding', 'restoreWorldState', 'saveFallbackSpawn'],
    'src/persistence/save-schema.js': ['SAVE_VERSION'],
    'src/shared/items-catalog.js': ['ITEM'],
    'src/world/block-catalog.js': ['BLOCK'],
    /* ERA 1.5.6 CUT B — the composition root builds the five-query view and hands it to
       SanitySystem, so the horror system never names the engine. */
    /* ERA 1.5.6 CUT 4 — three of Game's monolith dependencies became real module
       dependencies when the rendering boundary was drawn. Not one call changed; the
       declarations moved. This is the direction the manifest exists to reward, and it
       is why the monolith count is the number a future phase reduces. */
    'src/rendering/ash-particles.js': ['AshParticleSystem'],
    'src/rendering/environment-system.js': ['EnvironmentSystem'],
    'src/rendering/postfx.js': ['PostFX'],
    'src/world/sanity-world-view.js': ['SanityWorldView'],
    'src/world/voxel-world.js': ['VoxelWorld'],
    'src/world/world-constants.js': ['CHUNK_SX', 'CHUNK_SZ', 'SEA_LEVEL'],
  };
  {
    const declared = new Set();
    for (const f of Object.keys(GAME_DEPENDS_ON)) for (const n of GAME_DEPENDS_ON[f]) declared.add(n);
    const actual = new Set(seam.outbound.map(o => o.name));
    const added = [...actual].filter(n => !declared.has(n));
    const gone = [...declared].filter(n => !actual.has(n));
    chk(added.length === 0,
        `Game reaches ${actual.size} names outside its own file, and every one is in the manifest` +
        (added.length ? ` — UNDECLARED: ${added.join(', ')}` : ''));
    chk(gone.length === 0,
        'and the manifest has no stale entry — a dependency that went away is deleted from it' +
        (gone.length ? ` — STALE: ${gone.join(', ')}` : ''));

    /* Each name is attributed to the file that declares it, so a dependency cannot
       silently change owner underneath the manifest. */
    let misfiled = 0;
    for (const o of seam.outbound) {
      const home = GAME_DEPENDS_ON[o.from];
      if (!home || home.indexOf(o.name) < 0) misfiled++;
    }
    chk(misfiled === 0,
        'and each one is declared by the file the manifest says it is' +
        (misfiled ? ` — ${misfiled} moved without the manifest being updated` : ''));
  }

  /* THE NUMBER THAT MUST FALL. A ceiling, in the ratchet's usual direction. */
  /* ERA 1.5.6 lowered this from 35 by drawing the rendering boundary: the sky, the
     post pass and the particles became real module dependencies rather than names
     Game happened to share a scope with. A CEILING MAY FALL. IT MAY NEVER RISE. */
  const MONOLITH_DEPS_CEILING = 32;
  {
    const still = seam.outbound.filter(o => o.from === 'game.html:script');
    const inModules = seam.outbound.filter(o => o.from.startsWith('src/'));
    chk(still.length <= MONOLITH_DEPS_CEILING,
        `${still.length} of Game's dependencies are still in the monolith (ceiling ` +
        `${MONOLITH_DEPS_CEILING}) and ${inModules.length} are real modules — a later phase moves the rest`);
    console.log(`      host surface: ${seam.host.map(h => h[0] + ' ' + h[1]).join(', ')}`);
  }

  /* ---- 3. THE INBOUND SURFACE ----

     What the rest of the build is allowed to reach on a Game instance. It is small on
     purpose: the composition root hands each subsystem the things it needs (scene, world,
     sound, ui, camera) rather than handing it the whole application, which is why this
     list is five fields and one method rather than fifty. */
  const INBOUND_ALLOWED = {
    sound: 1, world: 1, ui: 1, player: 1, camera: 1,   // fields handed down
    _triggerClimax: 1,                                  // the one method called back into
  };
  {
    const bad = seam.inbound.filter(i => !Object.prototype.hasOwnProperty.call(INBOUND_ALLOWED, i.member));
    const touched = [...new Set(seam.inbound.map(i => i.member))].sort();
    chk(bad.length === 0,
        `the rest of the build reaches ${touched.length} things on a Game: ${touched.join(', ')}` +
        (bad.length ? ` — NOT ALLOWED: ${[...new Set(bad.map(b => b.owner + '.' + b.member))].join(', ')}` : ''));
    const methods = [...new Set(seam.inbound.filter(i => i.isMethod).map(i => i.member))];
    chk(methods.length === 1 && methods[0] === '_triggerClimax',
        'and exactly one Game METHOD is called from outside Game: _triggerClimax(), by the ' +
        'finale' + (methods.length === 1 ? '' : ` — ALSO: ${methods.join(', ')}`));
  }

  /* ---- 4. WHO HOLDS A GAME ----

     Four subsystems are handed the application itself. Naming them is the point: a fifth
     is a design decision, not a convenience, because every one of them is a place the
     dependency direction runs backwards. */
  {
    const HOLDERS = ['EnvironmentStorySystem', 'FinalSequence', 'OpeningFilm', 'MainMenu'];
    const src = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
    const assigns = [];
    const re = /^\s*this\.game = game\b/gm;
    let m;
    while ((m = re.exec(src))) {
      const line = src.slice(0, m.index).split('\n').length;
      let owner = '?';
      const before = src.slice(0, m.index);
      const k = before.lastIndexOf('\nclass ');
      if (k >= 0) owner = before.slice(k + 7).split(/[\s{]/)[0];
      assigns.push(owner);
    }
    const unexpected = assigns.filter(a => HOLDERS.indexOf(a) < 0);
    chk(assigns.length === HOLDERS.length && unexpected.length === 0,
        `exactly ${HOLDERS.length} subsystems are handed the Game itself: ${HOLDERS.join(', ')}` +
        (unexpected.length ? ` — ALSO: ${unexpected.join(', ')}` : '') +
        (assigns.length !== HOLDERS.length ? ` — found ${assigns.length}` : ''));
  }

  /* ---- 5. THE ENGINE'S BACK DOOR IS SHUT, AND STAYS SHUT ----

     VoxelWorld._playDoorSound reads `this.game && this.game.sound` as a fallback. Nothing
     in the build assigns `game` on a world, so that branch has never once been taken — it
     is a door in the engine that has never opened. Era 1.5.4 did not delete the two tokens
     (voxel-world.js is 1.5.3's file and this is not the Game boundary); it asserts instead
     that nobody ever wires it up, which is the half that actually matters. */
  {
    const files = [path.join(ROOT, 'game.html')].concat(
      seam.moduleFiles.map(f => path.join(ROOT, f)));
    const wired = [];
    for (const f of files) {
      const txt = fs.readFileSync(f, 'utf8');
      const re = /\b(world|this\.world|voxelWorld)\s*\.\s*game\s*=/g;
      if (re.test(txt)) wired.push(path.relative(ROOT, f));
    }
    chk(wired.length === 0,
        'nothing in the build assigns `game` on a world — the engine never reaches back up' +
        (wired.length ? ` — WIRED IN: ${wired.join(', ')}` : ''));
  }

  /* ---- 6. GAME OWNS THE GAMEPLAY FRAME LOOP ----

     requestAnimationFrame appears in several classes, and that is fine: a fade, a menu
     canvas and a one-shot mob animation each drive their own. What may exist only once is
     the loop that ticks the WORLD. `_animate` is that loop. */
  {
    const gameSrc = fs.readFileSync(path.join(ROOT, 'src/core/game.js'), 'utf8');
    const others = [path.join(ROOT, 'game.html')].concat(
      seam.moduleFiles.filter(f => f !== 'src/core/game.js').map(f => path.join(ROOT, f)));
    const elsewhere = others.filter(f => /requestAnimationFrame\s*\(\s*(this\.)?_animate/.test(fs.readFileSync(f, 'utf8')));
    const inGame = (gameSrc.match(/requestAnimationFrame\(this\._animate\)/g) || []).length;
    chk(inGame > 0 && elsewhere.length === 0,
        `the world's frame loop is scheduled from Game and nowhere else (${inGame} sites)` +
        (elsewhere.length ? ` — ALSO FROM: ${elsewhere.map(f => path.relative(ROOT, f)).join(', ')}` : ''));
    chk(/_loopRunning/.test(gameSrc),
        'and it is latched, so the two paths that both need it running cannot start two loops');
  }

  /* ---- 7. ONE ORCHESTRATOR, CONSTRUCTED ONCE ---- */
  {
    const files = [path.join(ROOT, 'game.html')].concat(seam.moduleFiles.map(f => path.join(ROOT, f)));
    let news = 0; const where = [];
    for (const f of files) {
      const n = (fs.readFileSync(f, 'utf8').match(/new Game\s*\(/g) || []).length;
      if (n) { news += n; where.push(path.relative(ROOT, f) + '×' + n); }
    }
    chk(news === 1 && /game\.html/.test(where[0]),
        `the application is constructed exactly once, by the bootstrap in game.html (${where.join(', ')})`);
  }

  /* ---- 8. THE BOOTSTRAP IS THE LAST THING IN THE FILE, AND IT IS SMALL ---- */
  {
    const last = seam.inlineTop[seam.inlineTop.length - 1];
    chk(last && last.type === 'ExpressionStatement' && last.lines <= 15,
        `the inline script ends with the bootstrap, ${last ? last.lines : '?'} lines of it — ` +
        'construct the application, publish the console handles, nothing else');
    console.log(`      game.html inline <script>: ${seam.inlineTop.length} top-level statements ` +
                'still to come out in 1.5.5 and after');
  }
}

console.log('\n=== 4e. THE PRESENTATION SEAM (ERA 1.5.5) ===\n');

/* Era 1.5.5 moved 1,067 lines of CSS out of game.html into seven stylesheets. The risk in
   that move is not that a rule goes missing — a missing rule is loud. It is that the
   CASCADE changes, which is silent, and that the ownership drifts back afterwards. These
   checks are about the second; the first was settled by comparing the computed style of
   every element in a real browser before and after the move. */
{
  const S = require('./harness/source.js');
  const doc = S.html();
  const markup = doc.slice(doc.indexOf('<body>'), doc.indexOf('\n<script>'));
  const css = S.buildStyles();
  const sheets = S.stylesheets();

  /* ---- 1. NO CSS IS LEFT IN THE DOCUMENT ---- */
  chk(!/<style[\s>]/.test(doc),
      'game.html contains no <style> element — all of the CSS is in stylesheets');
  chk(sheets.length >= 5 && sheets.every(r => r.rel.startsWith('styles/')),
      `${sheets.length} stylesheets, all under styles/: ` + sheets.map(r => r.rel.slice(7)).join(', '));

  /* ---- 2. ORDER IS THE CASCADE, AND base.css DEFINES WHAT THE REST READ ----

     The sheets are the same rules in the same sequence they had inside the single style
     block, so the cascade is the one that was there before. base.css must lead: every
     other sheet reads its custom properties. */
  chk(sheets.length > 0 && sheets[0].rel === 'styles/base.css',
      'and base.css is first — it defines the tokens every other sheet reads');
  {
    const fs2 = require('fs');
    /* A GLOBAL TOKEN is one declared on :root — section 73's palette, section 55.1's face,
       shadow and four-step scale. Those must have exactly one source, or "use the tokens"
       stops meaning anything. A custom property declared on an ELEMENT is a different
       thing entirely and is not counted: hud.css gives a condition tick `--f`, `--tick-lit`
       and `--tick-off` so five state classes can repaint one rule instead of five, and the
       HUD writes `--f` per frame through setProperty. That is a local mechanism, and
       forbidding it would forbid the instrument Phase 27 built. */
    const defs = [];
    for (const r of sheets) {
      const t = fs2.readFileSync(r.abs, 'utf8');
      const roots = [...t.matchAll(/:root[^{]*\{([^}]*)\}/g)].map(m => m[1]).join('\n');
      if (/--[a-z0-9-]+\s*:/.test(roots)) defs.push(r.rel);
    }
    chk(defs.length === 1 && defs[0] === 'styles/base.css',
        'and it is the ONLY sheet that declares a :root token — one token source, not seven' +
        (defs.length > 1 ? ` — ALSO DECLARED IN: ${defs.filter(d => d !== 'styles/base.css').join(', ')}` : ''));
  }

  /* ---- 3. THE TWO TRANSITIONS THAT ARE NOT DECORATION ----

     The Haven's wash and the finale's hard cut are TIMING, and Phase 32 and Phase 33 both
     wrote down what they must be. The wash carries a default duration that the runtime
     overwrites before every use, with a forced reflow between so the new duration is the
     one that animates. The hard cut carries no transition at all and must not grow one —
     a fade there is a different ending. */
  {
    const fade = (css.match(/#fadeWhite\s*\{[^}]*\}/) || [''])[0];
    const cut  = (css.match(/#blackCut\s*\{[^}]*\}/) || [''])[0];
    chk(/transition:\s*opacity/.test(fade),
        '#fadeWhite carries a default opacity transition, which the runtime overwrites per use');
    chk(cut.length > 0 && !/transition/.test(cut),
        '#blackCut carries NO transition — the hard cut is instantaneous, and stays that way' +
        (/transition/.test(cut) ? ' — IT HAS ONE NOW' : ''));
    const code = S.buildScript();
    /* Four sites write fadeWhite's transition, and they are two different operations.
       TWO ANIMATE (fadeToWhite / fadeFromWhite): they set a DURATION, force a reflow, then
       set opacity — and the order is the mechanism, because without the reflow the browser
       may coalesce the duration and the opacity into one style recalculation and animate
       the wash at the PREVIOUS duration, or not at all. TWO RESET (hardCutToBlack, and the
       presentation teardown a New Game runs): they set `none` and then opacity, which is
       instantaneous by construction and needs no reflow. Phase 33's rule that the hard cut
       is instantaneous depends on the second pair staying `none`. */
    const sites = [...code.matchAll(/fadeWhite\.style\.transition\s*=\s*([\s\S]{0,240}?)fadeWhite\.style\.opacity/g)]
                    .map(m => m[1]);
    const animate = sites.filter(t => /ms\}/.test(t) || /\$\{/.test(t));
    const reset   = sites.filter(t => /^\s*'none'/.test(t));
    chk(animate.length === 2 && animate.every(t => /offsetWidth/.test(t)),
        `and both directions of the wash set the duration, force a reflow, then set opacity ` +
        `(${animate.length} sites) — reordering those three lines silently kills the fade`);
    chk(reset.length === 2 && reset.every(t => !/offsetWidth/.test(t)) &&
        animate.length + reset.length === sites.length,
        `and the ${reset.length} teardown sites blank it with transition:none — an instant ` +
        'reset, not a wash, which is what the hard cut and a New Game both need');
  }

  /* ---- 4. THE DOM CONTRACT, DERIVED RATHER THAN LISTED ----

     UIManager and its neighbours reach elements by id. Rather than pin a hand-picked list
     that goes stale — the phase brief's own example list still named step1..step6, which
     Phase 28 deleted with the tutorial — this asks the build: every id the code looks up
     must exist in the markup. */
  {
    const ids = new Set([...markup.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
    const code = S.buildScript();
    const want = [...new Set([...code.matchAll(/getElementById\(\s*['"`]([A-Za-z0-9_-]+)['"`]\s*\)/g)].map(m => m[1]))];
    const qs = [...new Set([...code.matchAll(/querySelector(?:All)?\(\s*['"`]#([A-Za-z0-9_-]+)/g)].map(m => m[1]))];
    const missing = want.concat(qs).filter(x => !ids.has(x));
    chk(want.length > 40 && missing.length === 0,
        `every one of the ${want.length + qs.length} ids the code looks up exists in the markup ` +
        `(${ids.size} declared)` + (missing.length ? ` — MISSING: ${missing.join(', ')}` : ''));
  }

  /* ---- 5. PRESENTATION MUTATION IS CONFINED TO THE MONOLITH ----

     Not one extracted module writes a style. That is worth locking at zero now, while it
     is true: it is what lets Era 2 restyle the game without reading world, dimension,
     audio or persistence code. The monolith's own writes are capped and fall as 1.5.5+
     extracts UIManager. */
  {
    const fs2 = require('fs');
    const offenders = [];
    let monolith = 0;
    for (const r of S.modules()) {
      const n = (fs2.readFileSync(r.abs, 'utf8').match(/\.style\.[a-zA-Z]/g) || []).length;
      if (n) offenders.push(r.rel + ' ×' + n);
    }
    monolith = (S.inlineBody().code.match(/\.style\.[a-zA-Z]/g) || []).length;
    chk(offenders.length === 0,
        'no extracted module writes an element style — presentation mutation lives in one place' +
        (offenders.length ? ' — FOUND: ' + offenders.join(', ') : ''));
    /* MEASURED, not estimated: every one of these 54 references is a WRITE — 52 direct
       assignments and 2 setProperty calls, and the build contains no style READ at all.
       They are dynamic state CSS cannot hold: opacity ramps, display, a live transition
       duration, the condition tick's per-frame --f. The ceiling falls as 1.5.5+ extracts
       UIManager; it is never raised. */
    const STYLE_WRITE_CEILING = 54;
    chk(monolith <= STYLE_WRITE_CEILING,
        `and the monolith makes ${monolith} of them (ceiling ${STYLE_WRITE_CEILING}) — ` +
        'dynamic state, which CSS cannot hold: opacity ramps, display, a live transition duration');
  }

  /* ---- 6. INLINE STYLE ATTRIBUTES ARE CAPPED ---- */
  {
    const inline = (markup.match(/style="[^"]*"/g) || []);
    const INLINE_CEILING = 3;
    chk(inline.length <= INLINE_CEILING,
        `${inline.length} inline style attributes in the markup (ceiling ${INLINE_CEILING}) — ` +
        'everything else is in a stylesheet' + (inline.length ? ': ' + inline.join(' ') : ''));
  }

  /* ---- 7. A STYLESHEET IS NOT A PLACE TO KEEP GAME STATE ----

     CSS cannot execute, but it can still be made to carry meaning that belongs in code —
     a story line in a `content:`, a dimension name, an objective. STORY.md section 13
     forbids a readable human sentence in the world; a stylesheet is not an exemption. */
  {
    const contents = [...css.matchAll(/content:\s*(['"])([^'"]*)\1/g)].map(m => m[2]);
    const wordy = contents.filter(t => /\s/.test(t.trim()) && t.trim().length > 12);
    chk(wordy.length === 0,
        `${contents.length} generated-content strings, none of them a sentence` +
        (wordy.length ? ' — FOUND: ' + wordy.join(' | ') : ''));
  }
}


console.log('\n=== 4f. THE PRESENTATION PORT (ERA 1.5.6, CUT C) ===\n');

/* WHAT MAKES AN ERA 2 HUD EXPENSIVE IS NOT THE CALL COUNT. IT IS THAT THE REQUIRED
   SURFACE WAS UNDECLARED.

   §53 already forbids the HUD reading gameplay, and tests/hud.js enforces it. This is the
   other direction, and until this phase it was unbounded: gameplay reached 37 distinct
   UIManager methods from 110 places, and the only way to learn which 37 was to grep. A
   replacement HUD had no checklist.

   That is the identical problem §4.6 solved for Game, and it takes the identical
   solution: DECLARE the surface and assert it in both directions. An undeclared call is a
   failure; a port method that no longer exists on UIManager is a failure. Unlike an import
   list, it ratchets.

   THE FOUR KINDS ARE NOT DECORATION. They are what a future phase needs in order to know
   which calls are worth converting and which are not:

     state    the HUD mirrors a gameplay value. These are idempotent, the `view` cache
              makes them free when nothing moved, and they are the ones a frame loop can
              own. Era 1.5.6 moved sanity here and deleted seven redundant hotbar pushes.
     verb     the player opened or closed something. Imperative by nature.
     event    a one-shot the HUD performs. A toast, a flash, a wash, a cut.
     wiring   the composition root attaching the HUD to the application. Correct as-is,
              and NOT a coupling problem — this is what a composition root is for.

   DO NOT convert `verb` or `event` into observed state. A panel toggle and a jumpscare are
   genuinely imperative, and an observer framework over them buys nothing and costs a
   layer. */
{
  const PRESENTATION_PORT = {
    state: [
      'setCompassVisible', 'setDay', 'setFinaleMode', 'setHudVisible', 'setInteractPrompt',
      'setMiningProgress', 'setObjective', 'setPhase', 'setSanity', 'setSaveStatus',
      'updateCompass', 'updateHotbarSelection', 'updateObjectiveHUD', 'updateVitals',
    ],
    verb: [
      'closeSettings', 'closeStorage', 'openStorage',
      'toggleBackpack', 'toggleCrafting', 'toggleSettings',
    ],
    event: [
      'fadeFromWhite', 'fadeToWhite', 'flashDamage', 'hardCutToBlack', 'hideWinScreen',
      'showAudioNotice', 'showCredits', 'showToast', 'triggerBossVictory',
      'triggerJumpscare', 'triggerWinScreen',
    ],
    wiring: [
      'attachSaveActions', 'attachSettings', 'bindPlayer', 'resetPresentation',
      'syncSaveUI', 'syncSettingsUI',
    ],
  };

  const declared = new Set();
  for (const kind of Object.keys(PRESENTATION_PORT))
    for (const m of PRESENTATION_PORT[kind]) declared.add(m);

  /* Every ui.* call in the build, by file. The inline body and the modules alike. */
  const CALL = /(?:^|[^.\w])(?:this\.|g\.|game\.)?ui\.([a-zA-Z_][\w]*)\s*\(/g;
  const sources = [['game.html', SRC.inlineBody().code]]
    .concat(SRC.modules().map(r => [r.rel, fs.readFileSync(r.abs, 'utf8')]));
  const seen = new Map();            // method -> total calls
  const callerFiles = new Set();
  for (const [name, txt] of sources) {
    let m; CALL.lastIndex = 0;
    while ((m = CALL.exec(txt)) !== null) {
      seen.set(m[1], (seen.get(m[1]) || 0) + 1);
      callerFiles.add(name);
    }
  }
  const calls = [...seen.values()].reduce((a, b) => a + b, 0);
  const undeclared = [...seen.keys()].filter(m => !declared.has(m)).sort();
  chk(undeclared.length === 0,
      `${calls} calls into the HUD, over ${seen.size} methods, and every one is in the port` +
      (undeclared.length ? ` — UNDECLARED: ${undeclared.join(', ')}` : ''));

  /* THE OTHER DIRECTION. A port entry that UIManager does not implement is a lie about
     the contract, and a stale entry is exactly how a manifest rots into decoration. */
  const uiUnit = units.find(u => u.name === 'game.html:script');
  let uiMethods = new Set();
  if (uiUnit) {
    for (const n of uiUnit.ast.body) {
      if (n.type === 'ClassDeclaration' && n.id && n.id.name === 'UIManager')
        for (const el of n.body.body)
          if (el.key && el.key.name) uiMethods.add(el.key.name);
    }
  }
  const phantom = [...declared].filter(m => !uiMethods.has(m)).sort();
  chk(uiMethods.size > 0 && phantom.length === 0,
      `and every one of the ${declared.size} port methods is implemented by UIManager ` +
      `(${uiMethods.size} members)` +
      (phantom.length ? ` — NOT IMPLEMENTED: ${phantom.join(', ')}` : ''));
  const unused = [...declared].filter(m => !seen.has(m)).sort();
  chk(unused.length === 0,
      'and every port method is actually called — a declared surface nobody uses is ' +
      'decoration' + (unused.length ? ` — UNCALLED: ${unused.join(', ')}` : ''));

  /* WHO MAY TALK TO THE HUD AT ALL. The orchestrator, the developer console, and the
     monolith. No world, dimension, audio, persistence or progression module does — and
     that is what lets Era 2 replace the HUD without reading any of them. */
  const HUD_CALLERS = ['game.html', 'src/core/game.js', 'src/core/dev-tools.js'];
  const strays = [...callerFiles].filter(f => HUD_CALLERS.indexOf(f) < 0).sort();
  chk(strays.length === 0,
      `and only ${HUD_CALLERS.length} files call the HUD at all — no world, dimension, ` +
      'audio, persistence or progression module does' +
      (strays.length ? ` — ALSO: ${strays.join(', ')}` : ''));

  /* ERA 1.5.6 CUT C — THE TWO GAMEPLAY CLASSES THAT STOPPED BEING HUD CALLERS.
     Inventory pushed the hotbar from seven places; SanitySystem pushed the value from
     four. Both were redundant with, or belonged in, the frame loop's own sync. Neither
     holds a UIManager any more and neither may take one again. */
  for (const cls of ['Inventory', 'SanitySystem']) {
    const body = (SRC.inlineBody().code.match(
      new RegExp('class ' + cls + ' \\{[\\s\\S]*?\\n\\}')) || [''])[0];
    chk(body.length > 0 && !/\bthis\.ui\b/.test(body),
        `${cls} holds no UIManager — a ${cls === 'Inventory' ? 'data structure' : 'horror system'} ` +
        'does not paint');
  }
  chk(/new Inventory\(\)/.test(SRC.buildScript()) && !/new Inventory\([^)]/.test(SRC.buildScript()),
      'and Inventory is constructed with no argument at all');

  const byKind = Object.keys(PRESENTATION_PORT)
    .map(k => `${k} ${PRESENTATION_PORT[k].length}`).join(', ');
  console.log(`      the port: ${byKind} — ${calls} calls. Era 2 implements these ${declared.size} ` +
              'methods and the HUD is replaced.');
}


console.log('\n=== 4g. THE RENDERING BOUNDARY (ERA 1.5.6, CUT 4) ===\n');

/* `src/rendering/` was an empty directory with a LAYER.md listing ten units scheduled to
   move into it — nine in 1.5.2, the mesher in 1.5.3. None had arrived. Era 2 IS the
   renderer, so the one layer Era 2 rewrites wholesale was the one layer that had received
   nothing.

   Eleven of those units are here now. THREE are deliberately not, and that is the more
   important half of this block: they were filed under "rendering" by the 1.5.1 map and the
   measurement says they are not rendering at all. */
{
  const fs2 = require('fs');
  const dir = path.join(SRCDIR, 'rendering');
  const files = fs2.existsSync(dir) ? fs2.readdirSync(dir).filter(f => f.endsWith('.js')) : [];
  chk(files.length >= 7, `${files.length} rendering modules: ${files.join(', ')}`);

  /* THE INVARIANT WORTH LOCKING, AND IT IS LOCKED AT ZERO.

     Not one of these files names a block id. They describe SHAPES — a sky, a post pass, a
     creature's proportions, an animal's silhouette — and none of that is expressed in the
     voxel vocabulary. That is what makes them survive the voxel world's deletion as
     designs even though Era 2 restyles every one of them, and it is why the atlas and the
     two furniture registrars below could not come with them. */
  const renderUnits = units.filter(u => /^src\/rendering\//.test(u.name));
  const withBlock = renderUnits.filter(u => {
    let n = 0;
    walk.full(u.ast, (x) => { if (x.type === 'Identifier' && x.name === 'BLOCK') n++; });
    return n > 0;
  }).map(u => u.name);
  chk(renderUnits.length > 0 && withBlock.length === 0,
      `and not one of the ${renderUnits.length} names a block id — the rendering layer does ` +
      'not know what a block is' + (withBlock.length ? ` — NAMED IN: ${withBlock.join(', ')}` : ''));

  /* THE THREE DEFERRALS, ASSERTED SO THEY STAY DEFERRED FOR THEIR REASONS AND NOT BY
     ACCIDENT. A later phase reading the 1.5.1 map will see them still listed there; this
     is what says the omission was a decision. */
  const DEFERRED = {
    buildBlockAtlas:
      'paints one 16x16 tile per BLOCK ID into a strip the greedy mesher reads UVs from. ' +
      'It is the voxel texture atlas. Era 2 deletes it with the mesher.',
    buildSuburbFurniture:
      'holds ZERO THREE references. It is not a mesh builder — it allocates BLOCK IDS via ' +
      '_furnAlloc and writes SUB_SHAPE_DEF. Voxel block data. CLAUDE.md section 57: ' +
      'registration order IS the id, so moving it rewrites the suburb chunk data.',
    buildSuburbInteriorStructure:
      'the same, for partitions, openings and stairs. Also zero THREE.',
  };
  const inline = SRC.inlineBody().code;
  const renderSrc = files.map(f => fs2.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  for (const name of Object.keys(DEFERRED)) {
    const declaredInline = new RegExp('^function ' + name + '\\b', 'm').test(inline);
    const declaredRender = new RegExp('^function ' + name + '\\b', 'm').test(renderSrc);
    chk(declaredInline && !declaredRender,
        `${name} is deliberately NOT in rendering/ — ${DEFERRED[name]}`);
  }

  /* AND THE MESHER, WHICH 1.5.3 DECIDED AND 1.5.6 DID NOT REOPEN. */
  chk(!/greedy|_buildChunkMesh|_meshChunk/.test(renderSrc),
      'and the greedy voxel mesher did not move either — 1.5.3 decided that and this ' +
      'phase did not reopen it: lifting it out means inventing an interface for the ' +
      'thing Era 2 deletes');

  let renderTHREE = 0;
  for (const u of renderUnits) walk.full(u.ast, (x) => {
    if (x.type === 'Identifier' && x.name === 'THREE') renderTHREE++;
  });
  console.log(`      rendering/: ${renderTHREE} THREE references over ${renderUnits.length} files — ` +
              'presentation Era 2 rewrites, out of the monolith and behind a named boundary');
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
    /* P0-2. WAS 112 (81 reads / 35 writes) FROM THE PHASE 36 BUILD UNTIL ERA 1.5.6.
       Cut A made the three booleans DERIVED READ-ONLY GETTERS over one authoritative
       field, `player.dimension`. Every write went through setPlayerDimension() and the
       count fell to 79, all of them reads. THE CEILING FELL WITH IT — a ceiling may
       fall, it may never rise — and the write count is separately pinned at zero below,
       which is the assertion that actually holds the shape. */
    dimensionFlagRefs: 79,   // P0-2 — reads of the derived views; writes are pinned at 0
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
    /* ERA 1.5.6 lowered both of these by removing WRITES, not reads. Game was 47 and the
       developer console 33; the console is now 12 because seven triplet assignments
       became seven calls, and Game is 38 for the same reason. Every remaining entry is a
       READ of a derived view, which is exactly what those views are for: the reads were
       never the problem, and rewriting 78 of them would have been churn with a risk
       attached. A CEILING MAY FALL. IT MAY NEVER RISE. */
    'src/core/game.js':                      38,
    'src/core/dev-tools.js':                 12,
  };
  const inlineDim = dimFlagFiles['game.html:script'] || 0;
  const contentDim = Object.keys(CONTENT_DIM_READERS)
    .reduce((a, f) => a + (dimFlagFiles[f] || 0), 0);
  chk(inlineDim + contentDim <= CEILING.dimensionFlagRefs,
      `dimension-flag references outside the translator: ${inlineDim} in the monolith + ` +
      `${contentDim} in extracted modules = ${inlineDim + contentDim} ` +
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
      `and the only extracted modules that read them are the translator plus the ` +
      `${Object.keys(CONTENT_DIM_READERS).length} named above` +
      (otherReaders.length ? ` — ALSO READ BY: ${otherReaders.join(', ')}` : ''));
  let dimOver = 0;
  for (const f of Object.keys(CONTENT_DIM_READERS))
    if ((dimFlagFiles[f] || 0) > CONTENT_DIM_READERS[f]) dimOver++;
  chk(dimOver === 0,
      'and not one of them grew a new read — a moved dependency may shrink, never grow');
  /* ERA 1.5.6 — AND THE ASSERTION THAT ACTUALLY HOLDS THE SHAPE.

     Until this phase the translator was required to READ the booleans, because it was
     the one place that turned three flags into an answer. It does not read them any
     more: `player.dimension` IS the answer, and the translator now DEFINES the booleans
     as derived views over it. So the old "the translator still reads them" check has
     been replaced by the two below, which are strictly stronger.

     A READ of a derived view is harmless — it cannot be stale and it cannot disagree.
     A WRITE is the thing that could put the player in two dimensions at once, and there
     must not be one anywhere in the build. */
  chk(dimFlagWrites.length === 0,
      'NOT ONE assignment to a dimension boolean exists in the build — they are derived ' +
      'read-only views over player.dimension, and a view that cannot be written cannot drift' +
      (dimFlagWrites.length ? ` — ASSIGNED AT: ${dimFlagWrites.join(', ')}` : ''));
  {
    const src = require('fs').readFileSync(
      require('path').join(ROOT, DIM_TRANSLATOR), 'utf8');
    chk(/function definePlayerDimensionState/.test(src) &&
        /function setPlayerDimension/.test(src) &&
        /const PLAYER_DIMENSION_FLAG\b/.test(src),
        'and the translator is where they are DEFINED — one field, one setter, one flag table');
    chk(/Object\.defineProperty[\s\S]{0,220}?get\s*\(/.test(src) &&
        !/set\s*\(\s*[a-z]/.test(src.slice(src.indexOf('definePlayerDimensionState'),
                                           src.indexOf('function setPlayerDimension'))),
        'and the views are getters with NO setter — assignment fails loudly, not silently');
  }
  /* THE BELOW COSTS A DESCRIPTOR ROW, NOT A FOURTH BOOLEAN — and that is a structural
     claim, so it is measured structurally rather than by grepping for a name (an early
     version of this check grepped, and matched the sentence in the translator explaining
     why `inOverworld` must not exist).

     The flag table is a LEGACY COMPATIBILITY SHIM: three rows, for the three booleans
     that already had call sites. The registry holds more dimensions than the table holds
     flags, which is the proof that a dimension does not need one. */
  {
    const src = require('fs').readFileSync(
      require('path').join(ROOT, DIM_TRANSLATOR), 'utf8');
    const table = (src.match(/const PLAYER_DIMENSION_FLAG = Object\.freeze\(\{([\s\S]*?)\}\)/) || [null, ''])[1];
    const rows = (table.match(/\[DIMENSION\.[A-Z_]+\]:/g) || []);
    const descriptors = (src.match(/\[DIMENSION\.[A-Z_]+\]: Object\.freeze\(\{/g) || []);
    chk(rows.length === 3 && !/OVERWORLD/.test(table),
        `the legacy flag table is closed at ${rows.length} rows and the Overworld is not ` +
        'among them — it was never a boolean, and inventing one now would rebuild P0-2');
    chk(descriptors.length > rows.length,
        `and the registry already describes ${descriptors.length} dimensions against ` +
        `${rows.length} flags — a dimension does not need one, so The Below costs a row`);
  }

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
