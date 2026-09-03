/* PHASE 20 — THE RED LIGHT.
   Drives updateFarmTowerLight with a real THREE camera at real positions and real
   headings, at a fixed 60Hz dt, and measures what a PLAYER would see. */
const THREE = require('three');
const { makeWorld } = require('./harness/util.js');
const { w, ev } = makeWorld();
const T = w.farmTower;
let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };

const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
const DT = 1 / 60;
// Stand 120 blocks south of the tower, eye height 1.7 above the pad.
const px = T.cx, pz = T.cz + 120, py = T.padY + 1.7;
cam.position.set(px, py, pz);

/* yawFor(deg): 0 = looking straight at the lamp; positive turns the camera away. The
   game's own convention is forward = (-sin y, 0, -cos y), and the camera is built the
   same way, so this is the heading a player would actually hold. */
function look(offsetDeg) {
  const dx = T.cx + 0.5 - px, dz = T.cz + 0.5 - pz;
  const base = Math.atan2(-dx, -dz);
  cam.rotation.set(0, base + offsetDeg * Math.PI / 180, 0, 'YXZ');
  cam.updateMatrixWorld(true);
  cam.quaternion.setFromEuler(cam.rotation);
}
function run(seconds, offsetDeg) {
  look(offsetDeg);
  let onFrames = 0, flashes = 0, wasOn = false;
  const gaps = [];
  let sinceLast = 0;
  for (let i = 0; i < seconds * 60; i++) {
    w.updateFarmTowerLight(DT, cam, true, null);
    const on = w.farmTowerLight.on;
    sinceLast += DT;
    if (on) onFrames++;
    if (on && !wasOn) { flashes++; gaps.push(sinceLast); sinceLast = 0; }
    wasOn = on;
  }
  return { onFrames, flashes, gaps, duty: onFrames / (seconds * 60) };
}

// --- 1. LOOKING STRAIGHT AT IT ----------------------------------------------------
const direct = run(180, 0);
chk(direct.flashes === 0 && direct.onFrames === 0,
    `three minutes looking straight at the tower: ${direct.flashes} flashes, ${direct.onFrames} lit frames`);

// --- 2. LOOKING SLIGHTLY AWAY -----------------------------------------------------
const per = run(180, 35);
chk(per.flashes > 30,
    `three minutes with the tower 35 degrees off-centre: ${per.flashes} flashes (duty ${(per.duty * 100).toFixed(1)}%)`);
chk(per.duty < 0.15, `the lamp is dark the overwhelming majority of the time (${(per.duty * 100).toFixed(1)}% lit)`);

// --- 3. IS IT RHYTHMIC? -----------------------------------------------------------
/* The brief rules out a fixed interval. Measured as the coefficient of variation of the
   gaps and as the largest share any single rounded gap value takes — a blinker on a
   timer would have CV near zero and one gap value taking everything. */
const g = per.gaps.slice(1);
const mean = g.reduce((a, b) => a + b, 0) / g.length;
const sd = Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / g.length);
const cv = sd / mean;
const hist = new Map();
for (const v of g) { const k = v.toFixed(1); hist.set(k, (hist.get(k) || 0) + 1); }
const topShare = Math.max(...hist.values()) / g.length;
chk(cv > 0.35, `the intervals are genuinely irregular: mean ${mean.toFixed(2)}s, sd ${sd.toFixed(2)}s, CV ${cv.toFixed(2)}`);
chk(topShare < 0.20, `no single interval dominates: the most common rounded gap is ${(topShare * 100).toFixed(0)}% of ${g.length} flashes`);
chk(Math.min(...g) < 1.0 && Math.max(...g) > 2.0,
    `gaps range from ${Math.min(...g).toFixed(2)}s to ${Math.max(...g).toFixed(2)}s`);

// --- 4. LOOK AWAY, LOOK BACK ------------------------------------------------------
/* The beat the brief actually describes. Turn away until the lamp lights, then snap
   back: it must be dark within one frame, every time. */
let caught = 0, trials = 0;
for (let t = 0; t < 400; t++) {
  look(40);
  let lit = false;
  for (let i = 0; i < 600 && !lit; i++) { w.updateFarmTowerLight(DT, cam, true, null); lit = w.farmTowerLight.on; }
  if (!lit) continue;
  trials++;
  look(0);
  w.updateFarmTowerLight(DT, cam, true, null);
  if (w.farmTowerLight.on) caught++;
}
chk(trials > 100 && caught === 0,
    `snapping back to the tower while it is lit: the lamp is dark in the same frame, ${trials - caught}/${trials} times`);

// --- 5. DETERMINISM ---------------------------------------------------------------
/* The schedule must be reproducible for a test and a save, while looking random to a
   player. Two fresh worlds driven with the same inputs must agree exactly. */
const A = makeWorld(), Bw = makeWorld();
function trace(world) {
  const T2 = world.farmTower;
  const c = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
  c.position.set(T2.cx, T2.padY + 1.7, T2.cz + 120);
  const dx = T2.cx + 0.5 - c.position.x, dz = T2.cz + 0.5 - c.position.z;
  c.rotation.set(0, Math.atan2(-dx, -dz) + 0.7, 0, 'YXZ');
  c.quaternion.setFromEuler(c.rotation);
  const out = [];
  for (let i = 0; i < 3600; i++) { world.updateFarmTowerLight(DT, c, true, null); out.push(world.farmTowerLight.on ? 1 : 0); }
  return out.join('');
}
const ta = trace(A.w), tb = trace(Bw.w);
chk(ta === tb, `the flash schedule is identical across two fresh worlds (${ta.length} frames compared)`);

// --- 6. OUT OF RANGE AND OUT OF DIMENSION ------------------------------------------
cam.position.set(T.cx, T.padY + 1.7, T.cz + 900);
look(40);
const farRun = (() => { let n = 0; for (let i = 0; i < 1200; i++) { w.updateFarmTowerLight(DT, cam, true, null); if (w.farmTowerLight.on) n++; } return n; })();
chk(farRun === 0, `beyond ${ev('FARM_TOWER_ACTIVE_R')} blocks the anomaly stops ticking entirely (${farRun} lit frames in 20s)`);
w.updateFarmTowerLight(DT, cam, false, null);
chk(!w.farmTowerProxy.visible && !w.farmTowerCore.visible,
    'outside the Farmlands the silhouette and the lamp are hidden');

console.log(`\n${fail === 0 ? 'ALL RED-LIGHT CHECKS PASS' : fail + ' FAILURES'}`);
process.exit(fail ? 1 : 0);
