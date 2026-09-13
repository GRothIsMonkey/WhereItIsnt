/* THE WORLD-ENGINE / DIMENSION-CONTENT SEAM, MEASURED FROM THE SOURCE.

   Era 1.5.3 split `VoxelWorld` into an engine (src/world/voxel-world.js) and the content
   of four dimensions (src/dimensions/<name>/{generation,stampers}.js), all of which land
   back on one prototype through registerWorldContent. Because they share a prototype, a
   dimension calling another dimension's method, or the engine reaching into a dimension,
   costs nothing at runtime and is invisible in a diff. This module is what makes it
   visible: it reads every file, works out who owns what, and derives the four facts the
   seam is actually made of.

     OWNERSHIP     which file, dimension and role declares each method
     WRITERS       which methods put a block in the world — the stampers
     DISPATCH      every place the engine calls into dimension content
     CROSSING      every place one dimension calls into another

   IT IS A STATIC READ, AND THAT IS DELIBERATE. Driving the generator would tell you what
   ran on one seed in one dimension; the seam is a property of the whole build, including
   code no test path reaches. Nothing here executes game code. */
const acorn = require('acorn');
const walk = require('acorn-walk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');

/* The engine's own write path. Everything that eventually puts a block in a chunk goes
   through one of these three — CLAUDE.md §62.2's "one write path" — so seeding the
   writer analysis with them and closing over callers finds every stamper in the build
   without anyone maintaining a list. */
const WRITE_PRIMITIVES = ['_subSet', 'setBlockWorld', '_writeBlockRaw'];

function sourceFiles(root) {
  return execSync(`find ${path.join(root, 'src')} -name '*.js'`, { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean).sort();
}

/* THE CONSTRUCTOR COUNTS. It is where the Farmlands and the suburb are built eagerly,
   so excluding it would hide two of the engine's dispatch edges — and hiding an edge is
   the one thing this module exists not to do. */
function methodsOf(classNode) {
  return classNode.body.body.filter(m => m.type === 'MethodDefinition' && m.key && m.key.name);
}

/* THE ONE DEFINITION EVERYTHING ELSE HANGS ON: WHAT COUNTS AS PLACING A BLOCK.

   A method PLACES a block if its OWN body does, not if something it calls does. Without
   that distinction the analysis is useless in both directions: close over callers and
   `updateChunks` becomes a stamper, close over nothing and `_farmStampSurface` — which
   writes every ground cell in the Farmlands through `this._farmSet` — does not.

   So a write is one of four things, all of them visible in the method's own text:

     1. a call to one of the engine's three write primitives on `this`;
     2. an assignment into chunk storage (`chunk.data[i] = id`);
     3. a call to an INJECTED or LOCAL setter with four or more arguments — the repo's
        `S(wx, y, wz, id)` convention, which is how every farmhouse wall is built. Locals
        are RESOLVED by reading them, so `box(w,h,d,x,y,z,m)` building a mesh is not
        mistaken for a write;
     4. a call to a DIMENSION WRITE HELPER.

   And a dimension write helper is derived, never listed: a content method that writes by
   1, 2 or 3 and calls NO other content method. `_farmSet` and `_wSet` are the only two in
   the build. The "calls nothing else" clause is what keeps the definition from running
   away — `_farmStampSurface` writes, but it also asks `_farmInPad` and `_farmHash`
   questions, so it is a stamper rather than a helper, and its callers are orchestrators
   rather than stampers. A new dimension's private setter is found the same way, with
   nothing to maintain. */
function directWrites(fnNode, prim, params) {
  const locals = Object.create(null);
  walk.full(fnNode, (q) => {
    if (q.type === 'VariableDeclarator' && q.id.type === 'Identifier' &&
        q.init && /Function/.test(q.init.type)) locals[q.id.name] = q.init;
  });
  const scan = (node, seen) => {
    let hit = false;
    walk.full(node, (q) => {
      if (q.type === 'AssignmentExpression' && q.left.type === 'MemberExpression' &&
          q.left.computed && q.left.object.type === 'MemberExpression' &&
          /^(data|blocks)$/.test(q.left.object.property.name || '')) hit = true;
      if (q.type !== 'CallExpression') return;
      const c = q.callee;
      if (c.type === 'MemberExpression' && c.object.type === 'ThisExpression' &&
          c.property.name && prim.has(c.property.name)) hit = true;
      if (c.type === 'Identifier' && params.indexOf(c.name) >= 0 && q.arguments.length >= 4) hit = true;
      if (c.type === 'Identifier' && locals[c.name] && !seen.has(c.name)) {
        seen.add(c.name);
        if (scan(locals[c.name], seen)) hit = true;
      }
    });
    return hit;
  };
  return scan(fnNode, new Set());
}

function analyseWorldSeam(root) {
  root = root || ROOT;
  const methods = Object.create(null);   // name -> record
  const files = Object.create(null);     // file -> { dimension, role, names[] }

  const record = (m, rel, dimension, role) => {
    const params = m.value.params.filter(p => p.type === 'Identifier').map(p => p.name);
    const calls = new Set();
    walk.full(m.value, (q) => {
      if (q.type === 'CallExpression' && q.callee.type === 'MemberExpression' &&
          q.callee.object.type === 'ThisExpression' && q.callee.property.name)
        calls.add(q.callee.property.name);
    });
    methods[m.key.name] = {
      name: m.key.name, file: rel, dimension, role, params, calls,
      node: m, lines: m.loc.end.line - m.loc.start.line + 1,
    };
    (files[rel] = files[rel] || { dimension, role, names: [] }).names.push(m.key.name);
  };

  let sawEngineClass = false, sawRegistrar = false;
  for (const abs of sourceFiles(root)) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    const code = fs.readFileSync(abs, 'utf8');
    if (!/registerWorldContent\s*\(|class VoxelWorld \{/.test(code)) continue;
    const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });
    walk.full(ast, (n) => {
      if (n.type === 'CallExpression' && n.callee.name === 'registerWorldContent' &&
          n.arguments.length === 3 && n.arguments[2].type === 'ClassExpression') {
        sawRegistrar = true;
        for (const m of methodsOf(n.arguments[2]))
          record(m, rel, n.arguments[0].value, n.arguments[1].value);
      }
      if (n.type === 'ClassDeclaration' && n.id && n.id.name === 'VoxelWorld') {
        sawEngineClass = true;
        for (const m of methodsOf(n)) record(m, rel, 'engine', 'engine');
      }
    });
  }

  /* WRITE HELPERS, then WRITERS. Two passes, no closure over callers — see directWrites.
     The helper pass is iterated only so that a helper written in terms of another helper
     is still found; in this build it settles after one. */
  const prim = new Set(WRITE_PRIMITIVES);
  const helpers = [];
  for (let pass = 0, changed = true; changed && pass < 8; pass++) {
    changed = false;
    for (const name of Object.keys(methods)) {
      const r = methods[name];
      if (prim.has(name) || r.dimension === 'engine') continue;
      const callsContent = [...r.calls].some(c => methods[c] && c !== name && !prim.has(c));
      if (!callsContent && directWrites(r.node.value, prim, r.params)) {
        prim.add(name); helpers.push(name); changed = true;
      }
    }
  }
  const writers = Object.keys(methods).filter(n =>
    !prim.has(n) && directWrites(methods[n].node.value, prim, methods[n].params))
    .concat(helpers);

  /* THE TABLE DISPATCH. Era 1.5.3 moved the engine's if/else-if/else into
     src/dimensions/dimension-generators.js, where each row calls its dimension's methods
     through a `world` PARAMETER rather than `this`. Those calls are still the seam; they
     are simply not on the prototype any more, so they are read here explicitly. Leaving
     them unread would have made "the dispatch is three edges" true and meaningless —
     which is the failure CLAUDE.md §61.07 names in its sharpest form. */
  const tableDispatch = [];
  const genFile = path.join(root, 'src/dimensions/dimension-generators.js');
  let generatorRows = 0;
  if (fs.existsSync(genFile)) {
    const ast = acorn.parse(fs.readFileSync(genFile, 'utf8'), { ecmaVersion: 2022, locations: true });
    const rowOf = (objNode) => {
      const out = { dimension: null, calls: [] };
      for (const p2 of objNode.properties) {
        if (!p2.key) continue;
        if (p2.key.name === 'dimension' && p2.value.type === 'Literal') out.dimension = p2.value.value;
      }
      walk.full(objNode, (q) => {
        if (q.type === 'CallExpression' && q.callee.type === 'MemberExpression' &&
            q.callee.object.type === 'Identifier' && q.callee.property.name)
          out.calls.push(q.callee.property.name);
      });
      return out;
    };
    walk.full(ast, (n) => {
      if (n.type !== 'ObjectExpression') return;
      const r = rowOf(n);
      if (!r.dimension) return;
      generatorRows++;
      for (const c of r.calls)
        if (methods[c]) tableDispatch.push({ from: 'DIMENSION_CHUNK_GENERATORS', to: c, dimension: methods[c].dimension, row: r.dimension });
    });
  }

  /* DISPATCH and CROSSING, from the same call edges. An edge to a name nothing declares
     is a call to a Game or Chunk method and is not the seam's business. */
  const dispatch = [], crossing = [];
  for (const name of Object.keys(methods)) {
    const from = methods[name];
    for (const to of from.calls) {
      const t = methods[to];
      if (!t || t === from) continue;
      if (from.dimension === 'engine' && t.dimension !== 'engine')
        dispatch.push({ from: name, to, dimension: t.dimension, in: from.file });
      if (from.dimension !== 'engine' && t.dimension !== 'engine' &&
          from.dimension !== t.dimension && t.dimension !== 'shared')
        crossing.push({ from: name, fromDimension: from.dimension, to, toDimension: t.dimension });
    }
  }

  return {
    methods, files, writers, helpers, dispatch, crossing, tableDispatch, generatorRows,
    writePrimitives: WRITE_PRIMITIVES.slice(),
    sawEngineClass, sawRegistrar,
    engineNames: Object.keys(methods).filter(n => methods[n].dimension === 'engine'),
    contentNames: Object.keys(methods).filter(n => methods[n].dimension !== 'engine'),
  };
}

module.exports = { analyseWorldSeam, WRITE_PRIMITIVES, ROOT };
