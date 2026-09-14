/* THE APPLICATION SEAM, MEASURED FROM THE SOURCE.

   Era 1.5.4 moved `Game` out of game.html. Under classic scripts that move costs nothing
   and proves nothing on its own: every top-level name in the build still shares one global
   lexical scope, so Game can still reach anything, and nothing in a diff would show it.
   This module is what makes the boundary visible.

   It derives four things, all statically, executing no game code:

     OUTBOUND   every name Game reaches that it does not declare itself, attributed to the
                file that declares it — the "hidden same-script dependency" list, made
                explicit so it can be bounded and can only shrink.
     INBOUND    every place outside Game that reaches into a Game instance, and what it
                touches. This is the surface a future phase has to keep working.
     FRAME      which class owns requestAnimationFrame. There must be exactly one.
     BOOTSTRAP  what is left at the top level of the inline <script>.

   WHY STATIC. Driving the game would tell you what one session happened to touch. The
   seam is a property of the whole build, including paths no test reaches. */
const acorn = require('acorn');
const walk = require('acorn-walk');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/* Host and language names are not dependencies in the sense this module measures — they
   are the platform. They are reported separately so the host surface is still visible. */
const HOST = /^(window|document|localStorage|navigator|console|requestAnimationFrame|cancelAnimationFrame|performance|setTimeout|setInterval|clearTimeout|clearInterval|AudioContext|webkitAudioContext|alert|prompt|confirm|fetch|URL|Blob|Image|FileReader)$/;
const LANG = /^(Math|JSON|Date|Object|Array|Set|Map|WeakMap|WeakSet|Number|String|Boolean|Symbol|Error|TypeError|RangeError|isNaN|isFinite|parseInt|parseFloat|Promise|Proxy|Reflect|BigInt|RegExp|Function|globalThis|undefined|NaN|Infinity|Uint8Array|Uint16Array|Uint32Array|Int8Array|Int16Array|Int32Array|Float32Array|Float64Array|Uint8ClampedArray|ArrayBuffer|DataView|THREE)$/;

function inlineScript(html) {
  const lines = html.split('\n');
  let s = -1, e = -1;
  for (let i = 0; i < lines.length; i++) {
    if (s < 0 && /^<script>\s*$/.test(lines[i])) { s = i + 1; continue; }
    if (s >= 0 && /^<\/script>\s*$/.test(lines[i])) { e = i; break; }
  }
  if (s < 0 || e < 0) throw new Error('could not locate the inline <script> body');
  return { code: lines.slice(s, e).join('\n'), firstLine: s + 1 };
}

function topLevelNames(ast) {
  const out = new Map();
  for (const n of ast.body) {
    if ((n.type === 'ClassDeclaration' || n.type === 'FunctionDeclaration') && n.id) out.set(n.id.name, n.type);
    else if (n.type === 'VariableDeclaration') for (const d of n.declarations)
      if (d.id.type === 'Identifier') out.set(d.id.name, n.kind);
  }
  return out;
}

/* Free identifiers of a subtree: every name read that no enclosing scope inside the
   subtree declares. Property keys, labels and method names are not reads. */
function freeIdentifiers(root) {
  const scopes = [];
  const free = new Map(), host = new Map();
  const declared = (nm) => { for (const s of scopes) if (s.has(nm)) return true; return false; };
  const pat = (p, set) => {
    if (!p) return;
    if (p.type === 'Identifier') set.add(p.name);
    else if (p.type === 'ObjectPattern') for (const q of p.properties) pat(q.value || q.argument, set);
    else if (p.type === 'ArrayPattern') for (const q of p.elements) pat(q, set);
    else if (p.type === 'AssignmentPattern') pat(p.left, set);
    else if (p.type === 'RestElement') pat(p.argument, set);
  };
  const visit = (node, parent) => {
    if (!node || typeof node.type !== 'string') return;
    let pushed = false;
    if (/Function|ArrowFunction|CatchClause|BlockStatement|ForStatement|ForOfStatement|ForInStatement/.test(node.type)) {
      const set = new Set();
      if (node.params) for (const p of node.params) pat(p, set);
      if (node.param) pat(node.param, set);
      const body = node.body && node.body.type === 'BlockStatement' ? node.body : node;
      if (body && Array.isArray(body.body)) for (const st of body.body) {
        if (st.type === 'VariableDeclaration') for (const d of st.declarations) pat(d.id, set);
        if ((st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') && st.id) set.add(st.id.name);
      }
      for (const k of ['init', 'left']) if (node[k] && node[k].type === 'VariableDeclaration')
        for (const d of node[k].declarations) pat(d.id, set);
      scopes.push(set); pushed = true;
    }
    if (node.type === 'Identifier' && parent) {
      const isKey =
        (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
        ((parent.type === 'Property' || parent.type === 'MethodDefinition') && parent.key === node && !parent.computed) ||
        /^(LabeledStatement|BreakStatement|ContinueStatement)$/.test(parent.type);
      if (!isKey && !declared(node.name)) {
        if (HOST.test(node.name)) host.set(node.name, (host.get(node.name) || 0) + 1);
        else if (!LANG.test(node.name)) free.set(node.name, (free.get(node.name) || 0) + 1);
      }
    }
    for (const k in node) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'type') continue;
      const c = node[k];
      if (Array.isArray(c)) { for (const x of c) if (x && typeof x.type === 'string') visit(x, node); }
      else if (c && typeof c.type === 'string') visit(c, node);
    }
    if (pushed) scopes.pop();
  };
  visit(root, null);
  return { free, host };
}

function analyseAppSeam(root) {
  root = root || ROOT;
  const html = fs.readFileSync(path.join(root, 'game.html'), 'utf8');
  const inline = inlineScript(html);
  const inlineAst = acorn.parse(inline.code, { ecmaVersion: 2022, locations: true });

  const modRels = (html.match(/src="(src\/[^"]+)"/g) || []).map(m => m.slice(5, -1));
  const declaredIn = new Map();           // name -> file
  const asts = new Map();
  for (const rel of modRels) {
    const ast = acorn.parse(fs.readFileSync(path.join(root, rel), 'utf8'), { ecmaVersion: 2022, locations: true });
    asts.set(rel, ast);
    for (const [nm] of topLevelNames(ast)) declaredIn.set(nm, rel);
  }
  for (const [nm] of topLevelNames(inlineAst)) if (!declaredIn.has(nm)) declaredIn.set(nm, 'game.html:script');

  /* Find the Game class, wherever it is. */
  let gameNode = null, gameFile = null;
  for (const [rel, ast] of asts) for (const n of ast.body)
    if (n.type === 'ClassDeclaration' && n.id && n.id.name === 'Game') { gameNode = n; gameFile = rel; }
  let gameInInline = false;
  for (const n of inlineAst.body)
    if (n.type === 'ClassDeclaration' && n.id && n.id.name === 'Game') { gameInInline = true; if (!gameNode) { gameNode = n; gameFile = 'game.html:script'; } }

  const members = new Set();
  if (gameNode) for (const m of gameNode.body.body)
    if (m.type === 'MethodDefinition' && m.key && m.key.name) members.add(m.key.name);

  /* OUTBOUND */
  const { free, host } = gameNode ? freeIdentifiers(gameNode) : { free: new Map(), host: new Map() };
  const outbound = [...free].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({
    name, count, from: declaredIn.get(name) || '(unresolved)',
  }));

  /* INBOUND — anything outside Game that reaches a Game instance. Game is handed to a
     subsystem as `this.game`, or reached through the window handles the bootstrap sets. */
  const inbound = [];
  const scan = (ast, unit, code) => {
    const owners = [];
    for (const n of ast.body) if (n.type === 'ClassDeclaration' && n.id)
      owners.push([n.loc.start.line, n.loc.end.line, n.id.name]);
    const ownerOf = (ln) => { for (const [a, b, nm] of owners) if (ln >= a && ln <= b) return nm; return '<top-level>'; };
    walk.full(ast, (n) => {
      if (!n.loc || n.type !== 'MemberExpression' || !n.property || !n.property.name) return;
      const owner = ownerOf(n.loc.start.line);
      if (owner === 'Game') return;
      const objSrc = code.slice(n.object.start, n.object.end);
      if (!/(^|\.)(game|__game)$/.test(objSrc)) return;
      inbound.push({ unit, owner, via: objSrc, member: n.property.name, isMethod: members.has(n.property.name) });
    });
  };
  for (const [rel, ast] of asts) scan(ast, rel, fs.readFileSync(path.join(root, rel), 'utf8'));
  scan(inlineAst, 'game.html:script', inline.code);

  /* FRAME — who calls requestAnimationFrame, and from which class. */
  const frameOwners = new Set();
  const noteFrames = (ast, unit) => {
    const owners = [];
    for (const n of ast.body) if (n.type === 'ClassDeclaration' && n.id)
      owners.push([n.loc.start.line, n.loc.end.line, n.id.name]);
    walk.full(ast, (n) => {
      if (n.type !== 'CallExpression') return;
      const c = n.callee;
      const named = (c.type === 'Identifier' && c.name === 'requestAnimationFrame') ||
        (c.type === 'MemberExpression' && c.property && c.property.name === 'requestAnimationFrame');
      if (!named || !n.loc) return;
      let who = unit + ':<top-level>';
      for (const [a, b, nm] of owners) if (n.loc.start.line >= a && n.loc.start.line <= b) who = nm;
      frameOwners.add(who);
    });
  };
  for (const [rel, ast] of asts) noteFrames(ast, rel);
  noteFrames(inlineAst, 'game.html:script');

  /* BOOTSTRAP — what is left at the top level of the inline script. */
  const inlineTop = inlineAst.body.map(n => ({
    type: n.type,
    name: (n.id && n.id.name) || (n.declarations && n.declarations[0].id.name) || null,
    lines: n.loc.end.line - n.loc.start.line + 1,
  }));

  return {
    gameFile, gameInInline, members: [...members],
    outbound, host: [...host].sort((a, b) => b[1] - a[1]),
    inbound, frameOwners: [...frameOwners], inlineTop,
    moduleFiles: modRels,
  };
}

module.exports = { analyseAppSeam, ROOT };
