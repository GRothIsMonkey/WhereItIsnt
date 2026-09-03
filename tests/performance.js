/* PHASE 20 — GENERATION COST, MEASURED AGAINST THE PRE-PHASE-20 BUILD.
   Same coordinates, same order, five runs each, median reported. The question is not
   "is it fast" but "what did this phase cost, and where". */
const { makeWorld } = require('./harness/util.js');
const NOW = makeWorld(), OLD = makeWorld(process.env.WII_BASELINE || require('path').join(__dirname, 'baseline.html'));
const ev = NOW.ev;
const P = ev('FARM_P'), LINE = ev('FARM_J_LINE'), B0 = ev('FARM_J_B0');
const H = NOW.w.farmHome, T = NOW.w.farmTower;

function timeRegion(world, x0, z0, nx, nz) {
  const cx0 = Math.floor(x0 / 16), cz0 = Math.floor(z0 / 16);
  // fresh chunk store each run so nothing is memoised across measurements
  for (const k of [...world.chunks.keys()]) if (!world.pinnedChunkKeys.has(k)) world.chunks.delete(k);
  const t = process.hrtime.bigint();
  let n = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { world._generateChunk(cx0 + i, cz0 + j); n++; }
  return { ms: Number(process.hrtime.bigint() - t) / 1e6, n };
}
function median(a) { const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; }
function bench(label, x0, z0, nx, nz) {
  const A = [], B = [];
  for (let r = 0; r < 5; r++) {
    A.push(timeRegion(NOW.w, x0, z0, nx, nz).ms);
    B.push(timeRegion(OLD.w, x0, z0, nx, nz).ms);
  }
  const a = median(A), b = median(B), n = nx * nz;
  const d = ((a - b) / b) * 100;
  console.log(`${label.padEnd(30)} ${(a / n).toFixed(2)} ms/chunk   baseline ${(b / n).toFixed(2)}   ` +
              `${d >= 0 ? '+' : ''}${d.toFixed(1)}%   (${n} chunks)`);
  return { a, b, n, d };
}
console.log('median of 5 runs, cold chunk store each run\n');
const ordinary = bench('ordinary farmland (5k away)', B0 * P - 5000, LINE * P - 5000, 6, 6);
const routeHeavy = bench('journey corridor cols 2-5', (B0 + 2) * P, (LINE - 1) * P, 8, 8);
const tower = bench('the water tower facility', T.ox - 16, T.oz - 16, 5, 5);
const property = bench('the property + buried volume', H.ox - 16, H.oz - 8, 8, 4);
const marks = bench('the echo columns 8-11', (B0 + 8) * P, (LINE - 1) * P, 8, 8);
const suburbia = bench('Static Suburbia (control)', ev('SUBURBIA_SPAWN_CHUNK') * 16, ev('SUBURBIA_SPAWN_CHUNK') * 16, 7, 7);

console.log('\n--- resident cost ---');
const scene = NOW.w.scene;
console.log('scene children after boot:', scene.children.length, ' (baseline', OLD.w.scene.children.length + ')');
NOW.w._farmTowerBuildBeacon();
console.log('scene children with the tower beacon built:', scene.children.length,
            ' — the proxy is one Group of', NOW.w.farmTowerProxy.children.length, 'meshes over 2 shared materials, plus a lamp core and a halo');
let lights = 0;
for (const c of NOW.w.chunks.values()) if (c.lightSources) lights += c.lightSources.length;
console.log('generated light sources across every chunk touched by this run:', lights);

let fail = 0;
const budget = ev('CHUNK_GEN_FRAME_BUDGET_MS');
for (const [name, r] of [['ordinary farmland', ordinary], ['journey corridor', routeHeavy], ['echo columns', marks]]) {
  const ok = Math.abs(r.d) < 12;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + `${name} stays within 12% of the baseline (${r.d >= 0 ? '+' : ''}${r.d.toFixed(1)}%)`);
  if (!ok) fail++;
}
for (const [name, r] of [['the tower facility', tower], ['the property', property]]) {
  const per = r.a / r.n;
  const ok = per < 12;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + `${name} generates at ${per.toFixed(2)} ms/chunk — the streamer's own per-frame budget is ${budget} ms and it spreads chunks across frames`);
  if (!ok) fail++;
}
/* THE SUBURBIA CONTROL IS A NOISE FLOOR, NOT A CLAIM. Its chunks generate in about a
   millisecond, so a 49-chunk sample moves several percent run to run on a shared box —
   measured at -9.5%, +2.8%, +4.0% and +12.4% across four runs of the identical code.
   Whether Suburbia changed is settled by regression.js, which proves its chunks are
   byte-identical; this line exists to catch something structural, not a few percent. */
const ok = Math.abs(suburbia.d) < 25;
console.log((ok ? 'PASS  ' : 'FAIL  ') + `Suburbia, which this phase does not touch and which regression.js proves byte-identical, shows no structural change (${suburbia.d >= 0 ? '+' : ''}${suburbia.d.toFixed(1)}% — this sample's run-to-run noise is around ten points)`);
if (!ok) fail++;
console.log(`\n${fail === 0 ? 'PERFORMANCE WITHIN BOUNDS' : fail + ' PERFORMANCE FAILURES'}`);
