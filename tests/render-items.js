/* PHASE 21 — ITEM CONTACT, SEEN.

   Renders a dropped item resting on real generated terrain, BEFORE and AFTER the phase,
   from the same camera at the same place. It reuses the project's existing offline
   rasteriser (harness/render.js) over the REAL chunk BufferGeometry, and draws the item's
   REAL mesh through the same depth-tested overlay path the landmark silhouettes use — so
   the item is occluded by ground in front of it exactly as it would be in the engine.

   IT IS NOT A BROWSER AND NOT WebGL, and it does not claim to be. There is no block
   atlas, so surfaces are flat material colours; read these for CONTACT — whether the cube
   meets the ground, sits under it, or hovers — which is the one thing this phase is about.

   Writes tests/renders/item-contact-{before,after}-*.png */
const vm = require('vm');
const path = require('path');
const fs = require('fs');
const THREE = require('three');
const { makeWorld, genRegion } = require('./harness/util.js');
const { save, tilePalette } = require('./harness/render.js');

const OUT = path.join(__dirname, 'renders');
fs.mkdirSync(OUT, { recursive: true });

const FAR = new THREE.Vector3(9999, 9999, 9999);
const PLAYER = { inventory: { addItem: () => true }, sound: { playItemPickup() {} } };

/* Build one labelled scene from a given build of the game. Returns what was rendered so
   the two runs can be compared numerically as well as visually. */
function shoot(htmlPath, tag) {
  const { w, ev, S } = makeWorld(htmlPath);
  const ItemEntity = vm.runInContext('ItemEntity', S);
  const ITEM = ev('ITEM'), BLOCK = ev('BLOCK');
  const PAL = tilePalette(ev);
  const scene = new THREE.Scene();

  // A flat patch of ordinary Overworld, plus a step and a wall to show contact against
  // more than one surface.
  const X = 64, Z = 64;
  genRegion(w, X - 14, Z - 14, X + 14, Z + 14);
  const natural = (() => { for (let y = 60; y >= 0; y--) if (w.isSolid(X, y, Z)) return y + 1; return 0; })();
  /* A LEVELLED DIORAMA, deliberately. The point of these two images is to see whether a
     cube meets the ground it is standing on, and natural relief around the camera makes
     that harder to read, not easier — the contact line is the subject. So a flat pad of
     real blocks is written through the real setBlockWorld, with the air above it cleared,
     and the step and wall stand on it. Everything about the ITEM is untouched. */
  const floor = natural;
  for (let dx = -8; dx <= 8; dx++)
    for (let dz = -8; dz <= 8; dz++) {
      w.setBlockWorld(X + dx, floor - 1, Z + dz, BLOCK.GRASS);
      for (let dy = 0; dy < 6; dy++) w.setBlockWorld(X + dx, floor + dy, Z + dz, BLOCK.AIR);
    }
  for (let dy = 0; dy < 1; dy++) w.setBlockWorld(X + 2, floor + dy, Z, BLOCK.STONE);      // a step
  for (let dy = 0; dy < 3; dy++) w.setBlockWorld(X + 4, floor + dy, Z, BLOCK.STONE);      // a wall
  for (const c of w.chunks.values()) { if (c.mesh) { scene.remove(c.mesh); c.mesh = null; } }
  for (const c of w.chunks.values()) if (!c.mesh) w.generateChunkMesh(c);

  // Three drops: flat ground, on the step, and hard against the wall.
  const spots = [[X + 0.5, Z + 0.5], [X + 2.5, Z + 0.5], [X + 3.6, Z + 0.5]];
  const group = new THREE.Group();
  const items = [];
  for (const [px, pz] of spots) {
    const e = new ItemEntity(scene, ITEM.IRON_ORE, 1, new THREE.Vector3(px, floor + 5, pz), w);
    for (let i = 0; i < 900 && !e.resting; i++) e.update(1 / 60, FAR, PLAYER, w);
    // Hold the bob at its LOWEST point — the worst case for penetration.
    let lowest = Infinity, bestAge = e.age;
    for (let i = 0; i < 200; i++) { e.update(1 / 60, FAR, PLAYER, w); if (e.mesh.position.y < lowest) { lowest = e.mesh.position.y; bestAge = e.age; } }
    e.age = bestAge; e.update(0, FAR, PLAYER, w);
    scene.remove(e.mesh);
    group.add(e.mesh);
    items.push(e);
  }
  group.updateMatrixWorld(true);

  const SZY = vm.runInContext('ITEM_SIZE_Y', S);
  const bottoms = items.map(e => +(e.mesh.position.y - SZY / 2).toFixed(4));

  // A low, close camera so the contact line between cube and ground fills the frame.
  const eye = [X - 1.3, floor + 0.72, Z - 2.0];
  const look = [X + 2.0, floor + 0.30, Z + 0.5];
  const r = save(path.join(OUT, `item-contact-${tag}.png`), w, {
    pos: eye, look, W: 760, H: 428, palette: PAL, fov: 52,
    sky: [0x4a, 0x50, 0x46], fog: 0.006, proxy: group,
  });
  console.log(`${tag.padEnd(7)} floor y=${floor}  rendered mesh bottoms ` +
              `[${bottoms.join(', ')}]  -> relative to floor ` +
              `[${bottoms.map(b => (b - floor).toFixed(4)).join(', ')}]   ${r.tris} tris`);
  return { floor, bottoms };
}

const before = shoot(process.env.WII_PRE21 || path.join(__dirname, 'phase20_2.html'), 'before');
const after = shoot(path.join(__dirname, '..', 'game.html'), 'after');

console.log();
const worstBefore = Math.min(...before.bottoms.map(b => b - before.floor));
const worstAfter = Math.min(...after.bottoms.map(b => b - after.floor));
console.log(`BEFORE the worst rendered contact is ${worstBefore.toFixed(4)} blocks relative to the ` +
            `support surface (negative = sunk into it)`);
console.log(`AFTER  it is ${worstAfter.toFixed(4)}.`);
console.log('\nNOTE: offline rasteriser over the real chunk + item geometry. Not a browser render.');
