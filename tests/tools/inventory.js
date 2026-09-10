/* ERA 1.5 — ARCHITECTURE INVENTORY. A MEASUREMENT TOOL, NOT A TEST.

   It asserts nothing. It parses the whole build with a real JavaScript parser and prints
   what is in it: class spans, method spans, what each class touches, the call graph
   between subsystems, and the dimension-flag census. Every number in
   ARCHITECTURE-INVENTORY.md comes from here, so any of them can be re-derived rather than
   trusted — and re-derived AFTER an extraction phase, to see what actually moved.

   It reads the build through tests/harness/source.js, so it sees src/ modules and the
   inline <script> as one program, exactly as the browser does.

   Needs `acorn`. Without it, it says so and exits 0 — it is a tool, not a gate.

     node tools/inventory.js                 summary: classes, top-level, totals
     node tools/inventory.js VoxelWorld      one class, methods largest first
     node tools/inventory.js --deps          what each class touches
     node tools/inventory.js --edges         inter-subsystem call edges
     node tools/inventory.js --dimensions    the dimension-flag census
     node tools/inventory.js --world         VoxelWorld by responsibility
*/
'use strict';
const path = require('path');
const SRC = require('../harness/source.js');

let acorn, walk;
try {
  acorn = require('acorn'); walk = require('acorn-walk');
} catch (e) {
  console.log('SKIP  acorn is not installed — inventory not run.');
  console.log('      cd tests && npm install --no-save acorn acorn-walk');
  process.exit(0);
}

/* ---- parse the build as the browser sees it: modules in order, then the inline body ---- */
const parts = SRC.modules().map(m => ({ name: m.rel, code: require('fs').readFileSync(m.abs, 'utf8') }));
parts.push({ name: 'game.html:script', code: SRC.inlineBody().code });

const units = parts.map(p => {
  const ast = acorn.parse(p.code, { ecmaVersion: 2022, locations: true });
  return { name: p.name, ast, lines: p.code.split('\n').length };
});

function classesOf(u) {
  return u.ast.body.filter(n => n.type === 'ClassDeclaration').map(n => ({
    file: u.name, name: n.id.name,
    start: n.loc.start.line, end: n.loc.end.line,
    lines: n.loc.end.line - n.loc.start.line + 1,
    members: n.body.body.map(m => ({
      name: m.key ? (m.key.name || m.key.value || '<computed>') : '?',
      lines: m.loc.end.line - m.loc.start.line + 1,
      static: !!m.static,
    })),
  }));
}
const allClasses = [].concat(...units.map(classesOf));

/* owner-of-line map, per unit */
function ownerMap(u) {
  const o = new Array(u.lines + 2).fill('<top-level>');
  for (const n of u.ast.body) if (n.type === 'ClassDeclaration')
    for (let l = n.loc.start.line; l <= n.loc.end.line; l++) o[l] = n.id.name;
  return o;
}

const arg = process.argv[2];

/* ------------------------------------------------------------------ --deps ---- */
function deps() {
  const counts = {};
  const bump = (o, p) => { (counts[o] = counts[o] || {})[p] = (counts[o][p] || 0) + 1; };
  for (const u of units) {
    const own = ownerMap(u);
    walk.full(u.ast, (n) => {
      if (!n.loc) return;
      const o = own[n.loc.start.line];
      if (n.type === 'Identifier') {
        const k = n.name;
        if (/^(document|window|localStorage|navigator)$/.test(k)) bump(o, 'DOM');
        else if (k === 'THREE') bump(o, 'THREE');
        else if (k === 'BLOCK') bump(o, 'BLOCK');
        else if (k === 'ITEM') bump(o, 'ITEM');
        else if (k === 'DIMENSION') bump(o, 'DIMENSION');
      }
      if (n.type === 'MemberExpression' && n.property && n.property.name) {
        const p = n.property.name;
        if (/^(createGain|createOscillator|createBufferSource|createBiquadFilter|createPanner|createStereoPanner|createAnalyser|createDynamicsCompressor|decodeAudioData|createBuffer|createWaveShaper|createDelay|createConvolver)$/.test(p)) bump(o, 'WebAudio');
        if (/^(getElementById|querySelector|querySelectorAll|createElement|appendChild|addEventListener)$/.test(p)) bump(o, 'DOM-API');
        if (/^(getBlockWorld|setBlockWorld|destroyBlock|placeBlock)$/.test(p)) bump(o, 'worldAPI');
      }
    });
  }
  const cols = ['DOM', 'DOM-API', 'THREE', 'BLOCK', 'ITEM', 'DIMENSION', 'WebAudio', 'worldAPI'];
  console.log('WHAT EACH CLASS TOUCHES\n');
  console.log('OWNER'.padEnd(24) + cols.map(c => c.slice(0, 9).padStart(10)).join(''));
  console.log('-'.repeat(24 + 10 * cols.length));
  Object.entries(counts)
    .sort((a, b) => cols.reduce((t, c) => t + (b[1][c] || 0), 0) - cols.reduce((t, c) => t + (a[1][c] || 0), 0))
    .forEach(([o, c]) => console.log(o.padEnd(24) + cols.map(k => String(c[k] || '·').padStart(10)).join('')));
}

/* ----------------------------------------------------------------- --edges ---- */
const FIELD = { world:'World', player:'Player', ui:'UI', sound:'Audio', audio:'Audio',
  audioDir:'Audio', library:'Audio', env:'Environment', mobs:'Mobs', stalker:'Horror',
  phantoms:'Horror', sanity:'Sanity', postfx:'Render', renderer:'Render', camera:'Render',
  scene:'Render', objectives:'Progression', save:'Persistence', saves:'Persistence',
  settings:'Settings', anchorManager:'Progression', itemManager:'Items', arrows:'Items',
  farmAnimals:'Animals', envStory:'EnvStory', film:'Cinematic', finale:'Cinematic',
  instruction:'Cinematic', menu:'Menu', inventory:'Inventory' };

function edges() {
  const e = {};
  for (const u of units) {
    const own = ownerMap(u);
    walk.full(u.ast, (n) => {
      if (n.type !== 'CallExpression' || !n.callee || n.callee.type !== 'MemberExpression') return;
      const obj = n.callee.object;
      if (!obj || obj.type !== 'MemberExpression' || !obj.property) return;
      const to = FIELD[obj.property.name];
      if (!to) return;
      const from = own[n.loc.start.line];
      if (from === to) return;
      e[from + ' -> ' + to] = (e[from + ' -> ' + to] || 0) + 1;
    });
  }
  console.log('INTER-SUBSYSTEM CALL EDGES  (this.<field>.method() form)\n');
  Object.entries(e).sort((a, b) => b[1] - a[1]).filter(r => r[1] >= 3)
    .forEach(([k, v]) => console.log(String(v).padStart(5) + '  ' + k));
}

/* ------------------------------------------------------------ --dimensions ---- */
function dimensions() {
  const FLAG = /^(inFarmlands|inSuburbia|inFakeHaven)$/;
  const reads = {}; let writes = 0, total = 0;
  for (const u of units) {
    const own = ownerMap(u);
    walk.full(u.ast, (n) => {
      if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression'
          && n.left.property && FLAG.test(n.left.property.name)) writes++;
      if (n.type === 'MemberExpression' && n.property && FLAG.test(n.property.name)) {
        total++;
        const o = own[n.loc.start.line];
        reads[o] = (reads[o] || 0) + 1;
      }
    });
  }
  console.log('DIMENSION-FLAG CENSUS  (player.inFarmlands / .inSuburbia / .inFakeHaven)\n');
  Object.entries(reads).sort((a, b) => b[1] - a[1])
    .forEach(([o, c]) => console.log(String(c).padStart(5) + '  ' + o));
  console.log('-'.repeat(40));
  console.log(String(total).padStart(5) + '  TOTAL references');
  console.log(String(writes).padStart(5) + '  of which are WRITES');
  console.log('\nHOTSPOT P0-2. Three booleans, on the PLAYER, encoding one value, with the');
  console.log('Overworld as "all false" and two-at-once representable. See ARCHITECTURE.md §5.');
}

/* ---------------------------------------------------------------- --world ---- */
function world() {
  const vw = allClasses.find(c => c.name === 'VoxelWorld');
  if (!vw) return console.log('VoxelWorld not found.');
  const rules = [
    ['Farmlands content (D2)', /^_farm|^_genFarmlands|^updateFarmTowerLight|^updateFarmLandmarkProxies|^updateFarmHomeAnomaly/],
    ['Suburbia content (D3)',  /^_sub|^_genSuburbia|^_genStaticSuburbia|^_stampSuburbHouse|^_rearrangeSuburbia|^updateSuburbia|^_genDisconnectedHomeL3|^_stampDisconnectedHome|^applyMimicHallucination|^nearestSuburbiaWindow|^_restampSuburbiaLot|^_chunksOverlappingLot|^_home/],
    ['Haven content (D4)',     /Haven/i],
    ['Overworld content (D1)', /^_generateTerrain|^_generateTrees|^_generateDecor|^_carveCaveMouth|^_caveMouthSiteAt|^_generateChunk$|^_generateCaveMouths|^_isCaveMouthProtected|^_isCaveAt|^_cmHash|^_overworld/],
    ['meshing / geometry',     /Mesh|^_bakeChunkSkylight|^disposeChunk|^_spawnDoorSwing|^_buildChunkGeometry/],
    ['block access + edits',   /^getBlockWorld|^setBlockWorld|^destroyBlock|^placeBlock|^toggleDoor|^openChest|^collidesAABB|^findSpawnHeight/],
    ['streaming',              /^updateChunks|^wipeAllChunks|^wipeOverworldChunks|^_eagerLoadAround|^_markNeighborsDirty/],
    ['torch / skylight',       /torch|Torch|light|Light|Skylight|hasSkyAbove/],
    ['water',                  /^_w[A-Z]|[Ww]ater/],
  ];
  const groups = new Map(rules.map(r => [r[0], []]));
  groups.set('other / shared', []);
  for (const m of vw.members) {
    const hit = rules.find(r => r[1].test(m.name));
    groups.get(hit ? hit[0] : 'other / shared').push(m);
  }
  console.log('VoxelWorld BY RESPONSIBILITY  (' + vw.lines + ' lines, ' + vw.members.length + ' members)\n');
  let content = 0, all = 0;
  for (const [k, v] of groups) {
    const L = v.reduce((a, b) => a + b.lines, 0); all += L;
    if (/content/.test(k)) content += L;
    console.log(k.padEnd(26) + String(v.length).padStart(5) + ' methods' + String(L).padStart(8) + ' lines');
  }
  console.log('-'.repeat(52));
  console.log('dimension CONTENT'.padEnd(26) + ' '.repeat(12) + String(content).padStart(8) + ' lines  (' +
              Math.round(100 * content / all) + '% of the class)');
  console.log('world ENGINE'.padEnd(26) + ' '.repeat(12) + String(all - content).padStart(8) + ' lines');
}

/* ---------------------------------------------------------------- summary ---- */
function summary() {
  let tlc = 0, tlf = 0, tlv = 0, tlm = 0, tle = 0, total = 0;
  for (const u of units) {
    total += u.lines;
    for (const n of u.ast.body) {
      if (n.type === 'ClassDeclaration') tlc++;
      else if (n.type === 'FunctionDeclaration') tlf++;
      else if (n.type === 'VariableDeclaration') { if (n.kind === 'const') tlv++; else tlm++; }
      else if (n.type === 'ExpressionStatement') tle++;
    }
  }
  console.log('THE BUILD\n');
  units.forEach(u => console.log('  ' + String(u.lines).padStart(7) + '  ' + u.name));
  console.log('  ' + '-'.repeat(40));
  console.log('  ' + String(total).padStart(7) + '  total script lines');
  const extracted = total - units[units.length - 1].lines;
  console.log('  ' + String(extracted).padStart(7) + '  extracted so far (' + Math.round(1000 * extracted / total) / 10 + '%)');
  console.log('\n  top-level:  ' + tlc + ' classes, ' + tlf + ' functions, ' + tlv + ' const, ' +
              tlm + ' MUTABLE (let/var), ' + tle + ' load-time expressions');
  console.log('\nCLASSES, BY SIZE\n');
  console.log('  ' + 'CLASS'.padEnd(24) + 'LINES'.padStart(7) + 'MEMBERS'.padStart(9) + '   FILE');
  allClasses.sort((a, b) => b.lines - a.lines).forEach(c =>
    console.log('  ' + c.name.padEnd(24) + String(c.lines).padStart(7) + String(c.members.length).padStart(9) +
                '   ' + c.file));
}

if (arg === '--deps') deps();
else if (arg === '--edges') edges();
else if (arg === '--dimensions') dimensions();
else if (arg === '--world') world();
else if (arg && !arg.startsWith('--')) {
  const c = allClasses.find(x => x.name === arg);
  if (!c) { console.log('no such class: ' + arg); process.exit(1); }
  console.log(c.name + ' — ' + c.members.length + ' members, ' + c.lines + ' lines, in ' + c.file + '\n');
  c.members.slice().sort((a, b) => b.lines - a.lines)
    .forEach(m => console.log(String(m.lines).padStart(6) + '  ' + (m.static ? 'static ' : '') + m.name));
} else summary();
