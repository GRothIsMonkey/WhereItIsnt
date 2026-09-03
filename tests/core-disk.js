/* PHASE 20 — THE LEVEL 2 RIFT CORE DISK MUST NEVER BE UNREACHABLE.
   Walks the player's real body from the field outside the property, through the front
   door, down the pantry stair, along the corridor and into the room at the end. */
const { makeWorld, genRegion } = require('./harness/util.js');
const { walkReach } = require('./harness/walk.js');

const { w, ev } = makeWorld();
const H = w.farmHome;
const BLOCK = ev('BLOCK');

// Everything the walk can touch has to exist first.
genRegion(w, H.ox - 30, H.oz - 10, H.bigX0 + 20, H.z1 + 10);

let fail = 0;
const chestId = w.getBlockWorld(H.chest.x, H.chest.y, H.chest.z);
console.log(`${chestId === BLOCK.TREASURE_CHEST ? 'PASS' : 'FAIL'}  chest block present at ${H.chest.x},${H.chest.y},${H.chest.z} (id ${chestId})`);
if (chestId !== BLOCK.TREASURE_CHEST) fail++;

const key = H.chest.x + ',' + H.chest.y + ',' + H.chest.z;
console.log(`${w.homeChestKey === key ? 'PASS' : 'FAIL'}  homeChestKey matches the stamped chest (${w.homeChestKey})`);
if (w.homeChestKey !== key) fail++;

// Start in the field a dozen blocks west of the porch — where the approach leaves you.
const start = { x: H.hx - 14 + 0.5, y: H.padY + 3, z: H.hz + 4 + 0.5 };
const bounds = {
  x0: H.ox - 22, x1: H.bigX0 + 18,
  z0: H.oz - 6, z1: H.z1 + 6,
  y0: H.deepY - 3, y1: H.padY + 12,
};
const t0 = Date.now();
const r = walkReach(w, start, bounds, (p) =>
  Math.abs(p.x - (H.chest.x + 0.5)) < 1.6 && Math.abs(p.z - (H.chest.z + 0.5)) < 1.6 &&
  Math.abs(p.y - H.chest.y) < 1.6, 600000);
console.log(`${r.ok ? 'PASS' : 'FAIL'}  chest reachable on foot from the field outside — ${r.visited} positions searched, ${Date.now() - t0}ms` +
            (r.ok ? '' : `  (${r.why})`));
if (!r.ok) fail++;

// Milestones along the way, each proved separately so a failure says WHERE.
const legs = [
  ['front door / hall', H.hx + 2, H.padY, H.hz + 4],
  ['living room', H.hx + 3, H.padY, H.hz + 2],
  ['kitchen ell', H.hx + 7, H.padY, H.hz + 12],
  ['upper landing', H.hx + 10, H.upY, H.hz + 5],
  ['main bedroom', H.hx + 2, H.upY, H.hz + 1],
  ['box room', H.hx + 9, H.upY, H.hz + 1],
  ['pantry stair head', H.stairX0, H.padY, H.hallZ],
  ['long hall midpoint', H.hallX0 + 17, H.deepY, H.hallZ],
  ['duplicate bedroom', H.hallX0 + 7, H.deepY, H.hallZ - 6],
  ['inverted room', H.hallX0 + 22, H.deepY, H.hallZ - 6],
  ['suburbia window room', H.hallX0 + 13, H.deepY, H.hallZ + 5],
  ['the room at the end', H.bigX0 + 8, H.deepY, H.bigZ0 + 5],
];
for (const [name, gx, gy, gz] of legs) {
  const rr = walkReach(w, start, bounds, (p) =>
    Math.abs(p.x - (gx + 0.5)) < 1.1 && Math.abs(p.z - (gz + 0.5)) < 1.1 && Math.abs(p.y - gy) < 1.6, 600000);
  console.log(`${rr.ok ? 'PASS' : 'FAIL'}  reachable: ${name}`);
  if (!rr.ok) fail++;
}

/* THE WAY BACK OUT. A one-way drop would satisfy every "reachable" test above and
   still strand the player under a farmhouse with the Level 2 key in their pocket. */
{
  const back = walkReach(w, { x: H.chest.x + 1.5, y: H.chest.y + 1, z: H.chest.z + 2.5 }, bounds,
    (p) => p.x < H.hx - 4 && Math.abs(p.y - H.padY) < 2, 600000);
  console.log(`${back.ok ? 'PASS' : 'FAIL'}  the player can walk back out of the buried volume to the yard` +
              (back.ok ? '' : `  (${back.why})`));
  if (!back.ok) fail++;
}

console.log(`\n${fail === 0 ? 'ALL CORE-DISK ACCESSIBILITY CHECKS PASS' : fail + ' FAILURES'}`);
process.exit(fail ? 1 : 0);
