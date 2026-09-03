/* PHASE 20 — RUNTIME WIRING. Everything the frame loop and the HUD reach for must exist,
   and the one-shot horror event must fire once, in the right conditions, and never again. */
const vm = require('vm');
const THREE = require('three');
const { makeWorld, genRegion } = require('./harness/util.js');
const { w, ev, S } = makeWorld();
let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };

for (const m of ['updateFarmTowerLight', 'updateFarmHomeAnomaly', '_farmTowerBuildBeacon',
                 '_farmResolveJourney', '_farmStampTower', '_farmStampJourneyMarks',
                 '_farmStampApproach', '_farmStampHome', '_farmHomeBelow', '_farmSitePad']) {
  chk(typeof w[m] === 'function', `VoxelWorld.${m} exists`);
}
chk(vm.runInContext('typeof Game.prototype._updateFarmJourneyObjective', S) === 'function',
    'Game._updateFarmJourneyObjective exists');
chk(vm.runInContext('typeof UIManager.prototype.setJourneyStep', S) === 'function',
    'UIManager.setJourneyStep exists');
chk(vm.runInContext('typeof debugTeleportToWaterTower', S) === 'function' &&
    vm.runInContext('typeof debugFarmJourney', S) === 'function',
    'the Phase 20 dev commands are registered');

// The frame loop calls both new updates; neither may throw outside the Farmlands.
const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
cam.position.set(0, 30, 0); cam.updateMatrixWorld(true);
let threw = null;
try {
  w.updateFarmTowerLight(1 / 60, cam, false, null);
  w.updateFarmHomeAnomaly(1 / 60, new THREE.Vector3(0, 30, 0), cam, false);
} catch (e) { threw = e; }
chk(!threw, 'both frame-loop hooks are safe outside the Farmlands' + (threw ? ': ' + threw.message : ''));

// --- THE ONE-SHOT EVENT ------------------------------------------------------------
const H = w.farmHome;
genRegion(w, H.hallX0 - 8, H.hallZ - 12, H.bigX0 + 18, H.hallZ + 14);
const m = w.farmHomeMailbox;
chk(!!m, 'the diorama mailbox is registered');
const BLOCK = ev('BLOCK');
chk(w.getBlockWorld(m.x, m.y, m.z) === BLOCK.MAILBOX_Z, 'and it is there to begin with');

const pos = new THREE.Vector3();
const step = (x, y, z, lookAtMailbox) => {
  pos.set(x, y, z);
  const dx = m.x + 0.5 - x, dz = m.z + 0.5 - z;
  const yaw = lookAtMailbox ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
  cam.rotation.set(0, yaw, 0, 'YXZ');
  cam.quaternion.setFromEuler(cam.rotation);
  w.updateFarmHomeAnomaly(1 / 60, pos, cam, true);
};
// Standing far away and looking elsewhere must NOT fire it — the player has not seen it.
for (let i = 0; i < 60; i++) step(m.x + 30, H.deepY, m.z + 30, false);
chk(w.getBlockWorld(m.x, m.y, m.z) === BLOCK.MAILBOX_Z,
    'it does not vanish before the player has stood in the room it looks out of');
// Stand in the room.
for (let i = 0; i < 10; i++) step(m.rx + 3.5, H.deepY, m.rz + 2.5, true);
chk(w.getBlockWorld(m.x, m.y, m.z) === BLOCK.MAILBOX_Z, 'nor while they are standing there');
// Walk away, still looking back at it: still there.
for (let i = 0; i < 30; i++) step(m.x - 16, H.deepY, m.z - 2, true);
chk(w.getBlockWorld(m.x, m.y, m.z) === BLOCK.MAILBOX_Z, 'nor while they are still looking at it');
// Turn away.
for (let i = 0; i < 5; i++) step(m.x - 16, H.deepY, m.z - 2, false);
chk(w.getBlockWorld(m.x, m.y, m.z) === BLOCK.AIR, 'it is gone once they are away from it and not looking');
// ...and it never comes back, and nothing else fires.
const before = w._farmMailboxGone;
for (let i = 0; i < 600; i++) step(m.rx + 3.5, H.deepY, m.rz + 2.5, true);
chk(before && w._farmMailboxGone && w.getBlockWorld(m.x, m.y, m.z) === BLOCK.AIR,
    'and it stays gone: the event is one-shot for the session');

console.log(`\n${fail === 0 ? 'ALL RUNTIME CHECKS PASS' : fail + ' FAILURES'}`);
process.exit(fail ? 1 : 0);
