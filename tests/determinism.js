/* PHASE 20 — DETERMINISM, SEAM AND RELOAD SUITE.
   Two independently constructed worlds, and one world asked the same question twice in
   different orders, must produce byte-identical chunk data across the whole journey. */
const { makeWorld, genRegion, hashChunk } = require('./harness/util.js');

const A = makeWorld(), B = makeWorld();
const wa = A.w, wb = B.w;
const H = wa.farmHome, T = wa.farmTower;

// Regions: arrival, tower, echoes, approach + property, and the buried volume's far end.
const regions = [
  ['arrival', A.ev('FARM_SPAWN_X') - 40, A.ev('FARM_SPAWN_Z') - 40, A.ev('FARM_SPAWN_X') + 90, A.ev('FARM_SPAWN_Z') + 140],
  ['tower', T.ox - 40, T.oz - 40, T.x1 + 40, T.z1 + 40],
  ['echoes', H.ox - 120, H.oz - 300, H.ox + 60, H.oz - 120],
  ['property', H.ox - 40, H.oz - 20, H.x1 + 20, H.z1 + 20],
  ['buried', H.hallX0 - 20, H.hallZ - 20, H.bigX0 + 20, H.hallZ + 20],
];

let fail = 0, chunks = 0;
for (const [name, x0, z0, x1, z1] of regions) {
  const ca = genRegion(wa, x0, z0, x1, z1);
  // World B generates the SAME chunks in reverse order, which is the seam test: a
  // structure that reads a neighbour it happens to have generated first would diverge.
  const cb = [];
  {
    const c0 = Math.floor(x0 / 16), c1 = Math.floor(x1 / 16);
    const d0 = Math.floor(z0 / 16), d1 = Math.floor(z1 / 16);
    for (let cx = c1; cx >= c0; cx--) for (let cz = d1; cz >= d0; cz--) cb.push(wb._generateChunk(cx, cz));
  }
  const mb = new Map(cb.map(c => [c.cx + ',' + c.cz, c]));
  let bad = 0;
  for (const c of ca) {
    chunks++;
    const o = mb.get(c.cx + ',' + c.cz);
    if (!o) { bad++; continue; }
    if (hashChunk(c) !== hashChunk(o)) bad++;
  }
  console.log(`${bad === 0 ? 'PASS' : 'FAIL'}  ${name.padEnd(10)} ${ca.length} chunks, ${bad} mismatched (fresh world + reverse generation order)`);
  if (bad) fail++;
}

// Reload: dispose a chunk that carries the farmhouse and regenerate it.
{
  const cx = Math.floor((H.hx + 6) / 16), cz = Math.floor((H.hz + 5) / 16);
  const first = wa._generateChunk(cx, cz);
  const h1 = hashChunk(first);
  wa.chunks.delete(wa.key(cx, cz));
  const again = wa._generateChunk(cx, cz);
  const h2 = hashChunk(again);
  console.log(`${h1 === h2 ? 'PASS' : 'FAIL'}  reload     farmhouse chunk ${cx},${cz} regenerates identically`);
  if (h1 !== h2) fail++;
}
// ...and one that carries only the buried corridor, far from the property.
{
  const cx = Math.floor((H.hallX0 + 24) / 16), cz = Math.floor(H.hallZ / 16);
  const first = wa._generateChunk(cx, cz);
  const h1 = hashChunk(first);
  wa.chunks.delete(wa.key(cx, cz));
  const h2 = hashChunk(wa._generateChunk(cx, cz));
  console.log(`${h1 === h2 ? 'PASS' : 'FAIL'}  reload     buried-corridor chunk ${cx},${cz} regenerates identically`);
  if (h1 !== h2) fail++;
}

// The resolved sites must agree between two independent boots.
const same = JSON.stringify([wa.farmHome.ox, wa.farmHome.oz, wa.farmHome.padY, wa.farmHome.chest]) ===
             JSON.stringify([wb.farmHome.ox, wb.farmHome.oz, wb.farmHome.padY, wb.farmHome.chest]) &&
             wa.homeChestKey === wb.homeChestKey &&
             JSON.stringify([wa.farmTower.cx, wa.farmTower.cz, wa.farmTower.padY]) ===
             JSON.stringify([wb.farmTower.cx, wb.farmTower.cz, wb.farmTower.padY]);
console.log(`${same ? 'PASS' : 'FAIL'}  resolve    journey sites and chest key identical across two boots`);
if (!same) fail++;

console.log(`\n${chunks} chunks compared. ${fail === 0 ? 'ALL DETERMINISM CHECKS PASS' : fail + ' FAILURES'}`);
process.exit(fail ? 1 : 0);
