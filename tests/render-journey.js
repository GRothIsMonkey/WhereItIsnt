const { makeWorld } = require('./harness/util.js');
const { save, tilePalette } = require('./harness/render.js');
const { w, ev } = makeWorld();
const P = ev('FARM_P'), LINE = ev('FARM_J_LINE'), B0 = ev('FARM_J_B0');
const H = w.farmHome, T = w.farmTower, A = w.farmApproach;
const laneZ = (x) => w._farmJourneyLaneZ(x);
const PAL = tilePalette(ev);
/* The Rotting Fields' own fog colour, read straight off the environment rather than
   invented: EnvironmentSystem.rottingFogColor is what the scene background is set to. */
const ROT = [0x2d, 0x33, 0x28];   // EnvironmentSystem.rottingFogColor, exactly
const DARK = [0x07, 0x07, 0x08];

function build(x, z, r) {
  const cx0 = Math.floor(x / 16), cz0 = Math.floor(z / 16);
  const cs = [];
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) cs.push(w._generateChunk(cx0 + i, cz0 + j));
  for (const c of cs) if (!c.mesh) w.generateChunkMesh(c);
}
function shot(name, pos, look, opts) {
  const r = save(require('path').join(__dirname, 'renders', name + '.png'), w,
    Object.assign({ pos, look, W: 760, H: 428, palette: PAL, sky: ROT }, opts || {}));
  console.log(name.padEnd(30), r.tris + ' tris');
}
const gy = (x, z) => w._farmHeightAt(Math.round(x), Math.round(z));

// --- THE JOURNEY, IN ORDER --------------------------------------------------------
const sp = w.farmlandsSpawn;
build(sp.x, sp.z, 7);
shot('01-arrival-facing-east', [sp.x, sp.y + 1.6, sp.z], [sp.x + 80, sp.y + 1.0, laneZ(sp.x + 80)]);
{
  const x = B0 * P + 44, z = laneZ(x);
  shot('02-wheat-field', [x, gy(x, z) + 1.6, z], [x + 30, gy(x, z) + 1.0, z - 40]);
}
{
  const st = w._farmSteadAt(B0 + 1, LINE);
  build(st.ox, st.oz, 5);
  const x = st.ox + 18, z = laneZ(x);
  shot('03-farmstead-and-pasture', [x, gy(x, z) + 1.6, z], [st.ox + 22, st.padY + 4, st.oz + 16]);
  shot('04-pasture-side', [x, gy(x, z) + 1.6, z], [x + 30, gy(x, z) + 2, z - 45]);
}
build(T.cx, T.cz, 9);
/* THE DISTANT SILHOUETTE IS PART OF WHAT THE PLAYER SEES, so the proxy is driven for
   each of these with a real camera at the real position and then drawn. */
const THREE = require('three');
const pcam = new THREE.PerspectiveCamera(70, 760 / 428, 0.1, 1200);
function towerShot(nm, d) {
  const x = T.cx - d, z = laneZ(x);
  build(x, z, 4);
  const eye = [x, gy(x, z) + 1.7, z];
  pcam.position.set(eye[0], eye[1], eye[2]);
  pcam.lookAt(T.cx, T.padY + 20, T.cz);
  pcam.updateMatrixWorld(true);
  w.updateFarmTowerLight(1 / 60, pcam, true, new THREE.Color(ROT[0] / 255, ROT[1] / 255, ROT[2] / 255));
  const op = w.farmTowerProxy.visible ? w._towerProxyMats[0].opacity : 0;
  shot(nm, eye, [T.cx, T.padY + 20, T.cz], { proxy: w.farmTowerProxy });
  console.log('     ^ proxy ' + (w.farmTowerProxy.visible ? 'visible at opacity ' + op.toFixed(2) : 'hidden') +
              ', real distance ' + Math.hypot(T.cx - x, T.cz - z).toFixed(0) + ' blocks');
}
towerShot('05-tower-from-250', 250);
towerShot('06-tower-from-140', 140);
towerShot('07-tower-from-60', 60);
shot('08-tower-underneath', [T.cx + 2, T.padY + 1.7, T.cz + 17], [T.cx, T.lampY, T.cz], { fov: 88 });
shot('09-tower-facility', [T.ox - 8, T.padY + 7, T.oz + 40], [T.cx, T.padY + 8, T.cz]);

// --- BEYOND, AND THE APPROACH ------------------------------------------------------
{
  const x = (B0 + ev('FARM_J_ECHO0')) * P + 26, z = laneZ(x);
  build(x, z, 4);
  shot('10-the-repeated-arrangement', [x - 6, gy(x - 6, z) + 1.7, z + 4], [x, gy(x, z) + 1, z + 22]);
}
{
  const x = (B0 + ev('FARM_J_ECHO0') + 1) * P + 40, z = laneZ(x) - 17;
  build(x, z, 3);
  shot('11-the-suburban-fragment', [x - 7, gy(x - 7, z) + 1.7, z - 5], [x + 2, gy(x, z) + 0.6, z + 2]);
}
build(H.cx, A.laneZ, 5);
build(H.cx, H.cz, 6);
build(H.ox - 20, H.cz, 4);
{
  const x = H.cx - 10, z = A.laneZ;
  shot('12-approach-from-the-lane', [x, gy(x, z) + 1.7, z], [H.hx + 6, H.padY + 4, H.hz + 5]);
  shot('13-the-mailbox-and-the-ruts', [H.cx - 16, gy(H.cx - 16, A.laneZ + 2) + 1.7, A.laneZ + 2],
       [H.cx - 8, gy(H.cx - 8, A.laneZ + 10) + 0.9, A.laneZ + 14]);
  shot('14-house-across-the-last-field', [H.hx - 30, H.padY + 1.7, H.hz + 5], [H.hx + 6, H.padY + 4, H.hz + 5]);
  shot('15-house-front-porch', [H.hx - 10, H.padY + 1.7, H.hz + 5], [H.hx + 4, H.padY + 3, H.hz + 5]);
  shot('16-house-rear-and-ell', [H.hx + 24, H.padY + 1.7, H.hz + 24], [H.hx + 6, H.padY + 5, H.hz + 12]);
  shot('17-yard-gate-and-shed', [H.ox + 3, H.padY + 1.7, H.oz + 30], [H.ox + 26, H.padY + 4, H.oz + 6]);
}
// --- INSIDE -------------------------------------------------------------------------
shot('18-hall-from-the-front-door', [H.hx + 0.6, H.padY + 1.6, H.hz + 5.5], [H.hx + 11, H.padY + 1.3, H.hz + 5.5], { fog: 0.004, sky: DARK, fov: 82 });
shot('19-living-room', [H.hx + 9, H.padY + 1.6, H.hz + 3.4], [H.hx + 2, H.padY + 1.3, H.hz + 1], { fog: 0.004, sky: DARK, fov: 82 });
shot('20-kitchen-ell', [H.hx + 6.5, H.padY + 1.6, H.hz + 10.5], [H.hx + 9.5, H.padY + 1.2, H.hz + 13], { fog: 0.004, sky: DARK, fov: 82 });
shot('21-upstairs-corridor', [H.hx + 10.4, H.upY + 1.6, H.hz + 4.5], [H.hx + 1, H.upY + 1.4, H.hz + 4.5], { fog: 0.004, sky: DARK, fov: 82 });
shot('22-main-bedroom', [H.hx + 6, H.upY + 1.6, H.hz + 3], [H.hx + 2, H.upY + 1.3, H.hz + 1], { fog: 0.004, sky: DARK, fov: 82 });
shot('23-box-room-door-to-nothing', [H.hx + 8, H.upY + 1.6, H.hz + 2.5], [H.hx + 12, H.upY + 1.5, H.hz + 2.5], { fog: 0.004, sky: DARK, fov: 82 });
shot('24-the-pantry-stair', [H.stairX0 - 2.5, H.padY + 1.6, H.hallZ + 0.5], [H.stairX0 + 8, H.padY - 3, H.hallZ + 0.5], { fog: 0.004, sky: DARK, fov: 82 });
// --- BELOW ---------------------------------------------------------------------------
build(H.hallX0, H.hallZ, 2);
build(H.hallX0 + 24, H.hallZ, 2);
build(H.bigX0 + 8, H.hallZ, 2);
/* Every generated torch in the buried volume, as a point light, so the renders below show
   what a player standing down there actually sees rather than black geometry. */
const LIGHTS = [];
for (const c of w.chunks.values()) {
  if (!c.lightSources) continue;
  for (const [lx, ly, lz, bid] of c.lightSources) if (ly < H.padY) LIGHTS.push([lx + 0.5, ly + 0.7, lz + 0.5, 2.4, 13]);
}
console.log('buried point lights:', LIGHTS.length);
shot('25-the-long-hall', [H.hallX0 + 1, H.deepY + 1.6, H.hallZ + 0.5], [H.hallX0 + 40, H.deepY + 1.5, H.hallZ + 0.5], { fog: 0.010, sky: DARK, fov: 82, lights: LIGHTS });
shot('26-the-duplicate-bedroom', [H.hallX0 + 7.5, H.deepY + 1.6, H.hallZ - 3.5], [H.hallX0 + 8, H.deepY + 1.3, H.hallZ - 9], { fog: 0.006, sky: DARK, fov: 82, lights: LIGHTS });
shot('27-the-inverted-room', [H.hallX0 + 22.5, H.deepY + 1.6, H.hallZ - 3.5], [H.hallX0 + 23, H.deepY + 2.4, H.hallZ - 9], { fog: 0.006, sky: DARK, fov: 82, lights: LIGHTS });
shot('28-the-suburbia-window', [H.hallX0 + 13.5, H.deepY + 1.6, H.hallZ + 4], [H.hallX0 + 13.5, H.deepY + 1.9, H.hallZ + 12], { fog: 0.006, sky: DARK, fov: 82, lights: LIGHTS });
shot('29-the-room-at-the-end', [H.bigX0 + 14, H.deepY + 1.6, H.bigZ0 + 9], [H.bigX0 + 8, H.deepY + 1.2, H.bigZ0 + 1], { fog: 0.006, sky: DARK, fov: 82, lights: LIGHTS });
console.log('chunks resident:', w.chunks.size);
