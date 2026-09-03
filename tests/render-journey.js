const { makeWorld } = require('./harness/util.js');
const { save, tilePalette } = require('./harness/render.js');
const { w, ev } = makeWorld();
const P = ev('FARM_P'), LINE = ev('FARM_J_LINE'), B0 = ev('FARM_J_B0');
const H = w.farmHome, T = w.farmTower, A = w.farmApproach;
const F = w.farmFallen, GB = w.farmBarn, GT = w.farmTree;
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
const FOG = new THREE.Color(ROT[0] / 255, ROT[1] / 255, ROT[2] / 255);
const pcam = new THREE.PerspectiveCamera(70, 760 / 428, 0.1, 1200);
/* EVERY SILHOUETTE IN THE CHAIN IS DRIVEN, NOT JUST THE TOWER'S. The camera is placed at
   the real eye position, both proxy updaters are run exactly as the frame loop runs them,
   and whatever they leave visible is what gets drawn — so a shot showing two landmarks on
   the horizon is showing what the game would put there, and a shot showing none is
   evidence that nothing is there to see. */
function drive(eye, look) {
  pcam.position.set(eye[0], eye[1], eye[2]);
  pcam.lookAt(look[0], look[1], look[2]);
  pcam.updateMatrixWorld(true);
  w.updateFarmTowerLight(1 / 60, pcam, true, FOG);
  w.updateFarmLandmarkProxies(pcam, true, FOG);
  const groups = [w.farmTowerProxy];
  const vis = [];
  if (w.farmTowerProxy && w.farmTowerProxy.visible) vis.push('tower ' + w._towerProxyMats[0].opacity.toFixed(2));
  for (const e of (w._farmLandmarkProxies || [])) {
    groups.push(e.g);
    if (e.g.visible) vis.push(e.mats[0].m.opacity.toFixed(2));
  }
  return { groups, vis };
}
/* A shot taken from the lane, `d` blocks short of a landmark, looking at it. */
function laneShot(nm, site, d, aimY) {
  const x = site.cx - d, z = laneZ(x);
  build(x, z, 4);
  const eye = [x, gy(x, z) + 1.7, z];
  const look = [site.cx, site.padY + (aimY === undefined ? 14 : aimY), site.cz];
  const { groups, vis } = drive(eye, look);
  shot(nm, eye, look, { proxy: groups });
  console.log('     ^ ' + Math.hypot(site.cx - x, site.cz - z).toFixed(0) + ' blocks out; ' +
              'silhouettes drawn: ' + (vis.length ? vis.join(', ') : 'none (real geometry only)'));
}

// --- THE FALLEN TOWER --------------------------------------------------------------
build(F.cx, F.cz, 7);
laneShot('05-fallen-tower-from-200', F, 200, 8);
laneShot('06-fallen-tower-from-70', F, 70, 8);
{
  // The wreck lies across the road, so both shots are taken road-relative too.
  const inward = F.south ? 1 : -1, laneEdge = F.south ? F.oz : F.z1 - 1;
  const fz = (t) => laneEdge + inward * t;
  const drumZ = fz(8 + ev('FARM_TOWER_LEG_H') + 5);
  shot('07-fallen-tower-at-the-drum',
       [F.cx + 11, F.padY + 1.7, drumZ - 5], [F.cx, F.padY + 6, drumZ], { fov: 88 });
  // Broadside, from the field beside it: all forty-six blocks at once.
  shot('08-fallen-tower-broadside',
       [F.cx - 30, F.padY + 9, fz(22)], [F.cx, F.padY + 5, fz(22)], { fov: 88 });
}

// --- THE STANDING TOWER ------------------------------------------------------------
laneShot('09-tower-from-340', T, 340, 20);
laneShot('10-tower-from-140', T, 140, 20);
laneShot('11-tower-from-60', T, 60, 20);
shot('12-tower-underneath', [T.cx + 2, T.padY + 1.7, T.cz + 17], [T.cx, T.lampY, T.cz], { fov: 88 });
shot('13-tower-facility', [T.ox - 8, T.padY + 7, T.oz + 40], [T.cx, T.padY + 8, T.cz]);

// --- THE GIANT BARN ----------------------------------------------------------------
build(GB.cx, GB.cz, 8);
laneShot('14-barn-from-300', GB, 300, 14);
laneShot('15-barn-from-90', GB, 90, 14);
{
  /* The yard, from the road, on whichever side of the lane the site resolved onto. The
     layout comes off the resolved site descriptor rather than being re-derived here. */
  const ez = GB.laneEdge - GB.inward * 16;
  const ex = GB.bx + GB.bw + 24;
  shot('16-barn-and-silos', [ex, gy(ex, ez) + 2.4, ez],
       [GB.bx + GB.bw / 2, GB.padY + 12, GB.bz + GB.bd / 2]);
  // Down the LENGTH of it: thirty-four blocks of framed, unlit interior.
  shot('17-barn-interior', [GB.bx + 2, GB.padY + 1.7, GB.bz + GB.bd / 2],
       [GB.bx + GB.bw - 2, GB.padY + 5, GB.bz + GB.bd / 2], { fov: 88 });
}

// --- BEYOND, AND THE APPROACH ------------------------------------------------------
{
  const x = (B0 + ev('FARM_J_ECHO0')) * P + 26, z = laneZ(x);
  build(x, z, 4);
  shot('18-the-repeated-arrangement', [x - 6, gy(x - 6, z) + 1.7, z + 4], [x, gy(x, z) + 1, z + 22]);
}
{
  const x = (B0 + ev('FARM_J_ECHO0') + 1) * P + 40, z = laneZ(x) - 17;
  build(x, z, 3);
  shot('19-the-suburban-fragment', [x - 7, gy(x - 7, z) + 1.7, z - 5], [x + 2, gy(x, z) + 0.6, z + 2]);
}

// --- THE GREAT TREE AND THE DEAD LAND ------------------------------------------------
build(GT.cx, GT.cz, 9);
laneShot('20-tree-from-480', GT, 480, 30);
laneShot('21-tree-across-the-dead-land', GT, 150, 30);
{
  // Standing in the rotten ground, looking up: the one living thing in the region.
  const x = GT.cx - 44, z = GT.cz + 10;
  build(x, z, 4);
  shot('22-dead-ground-under-the-crown', [x, gy(x, z) + 1.7, z], [GT.cx, GT.padY + 26, GT.cz], { fov: 82 });
  shot('23-the-trunk', [GT.cx - 14, GT.padY + 1.7, GT.cz + 6], [GT.cx, GT.padY + 22, GT.cz], { fov: 88 });
}
build(H.cx, A.laneZ, 5);
build(H.cx, H.cz, 6);
build(H.ox - 20, H.cz, 4);
{
  const x = H.cx - 10, z = A.laneZ;
  shot('24-approach-from-the-lane', [x, gy(x, z) + 1.7, z], [H.hx + 6, H.padY + 4, H.hz + 5]);
  shot('25-the-mailbox-and-the-ruts', [H.cx - 16, gy(H.cx - 16, A.laneZ + 2) + 1.7, A.laneZ + 2],
       [H.cx - 8, gy(H.cx - 8, A.laneZ + 10) + 0.9, A.laneZ + 14]);
  shot('26-house-across-the-last-field', [H.hx - 30, H.padY + 1.7, H.hz + 5], [H.hx + 6, H.padY + 4, H.hz + 5]);
  shot('27-house-front-porch', [H.hx - 10, H.padY + 1.7, H.hz + 5], [H.hx + 4, H.padY + 3, H.hz + 5]);
  shot('28-house-rear-and-ell', [H.hx + 24, H.padY + 1.7, H.hz + 24], [H.hx + 6, H.padY + 5, H.hz + 12]);
  shot('29-yard-gate-and-shed', [H.ox + 3, H.padY + 1.7, H.oz + 30], [H.ox + 26, H.padY + 4, H.oz + 6]);
}
// --- INSIDE -------------------------------------------------------------------------
shot('30-hall-from-the-front-door', [H.hx + 0.6, H.padY + 1.6, H.hz + 5.5], [H.hx + 11, H.padY + 1.3, H.hz + 5.5], { fog: 0.004, sky: DARK, fov: 82 });
shot('31-living-room', [H.hx + 9, H.padY + 1.6, H.hz + 3.4], [H.hx + 2, H.padY + 1.3, H.hz + 1], { fog: 0.004, sky: DARK, fov: 82 });
shot('32-kitchen-ell', [H.hx + 6.5, H.padY + 1.6, H.hz + 10.5], [H.hx + 9.5, H.padY + 1.2, H.hz + 13], { fog: 0.004, sky: DARK, fov: 82 });
shot('33-upstairs-corridor', [H.hx + 10.4, H.upY + 1.6, H.hz + 4.5], [H.hx + 1, H.upY + 1.4, H.hz + 4.5], { fog: 0.004, sky: DARK, fov: 82 });
shot('34-main-bedroom', [H.hx + 6, H.upY + 1.6, H.hz + 3], [H.hx + 2, H.upY + 1.3, H.hz + 1], { fog: 0.004, sky: DARK, fov: 82 });
shot('35-box-room-door-to-nothing', [H.hx + 8, H.upY + 1.6, H.hz + 2.5], [H.hx + 12, H.upY + 1.5, H.hz + 2.5], { fog: 0.004, sky: DARK, fov: 82 });
shot('36-the-pantry-stair', [H.stairX0 - 2.5, H.padY + 1.6, H.hallZ + 0.5], [H.stairX0 + 8, H.padY - 3, H.hallZ + 0.5], { fog: 0.004, sky: DARK, fov: 82 });
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
shot('37-the-long-hall', [H.hallX0 + 1, H.deepY + 1.6, H.hallZ + 0.5], [H.hallX0 + 40, H.deepY + 1.5, H.hallZ + 0.5], { fog: 0.010, sky: DARK, fov: 82, lights: LIGHTS });
shot('38-the-duplicate-bedroom', [H.hallX0 + 7.5, H.deepY + 1.6, H.hallZ - 3.5], [H.hallX0 + 8, H.deepY + 1.3, H.hallZ - 9], { fog: 0.006, sky: DARK, fov: 82, lights: LIGHTS });
shot('39-the-inverted-room', [H.hallX0 + 22.5, H.deepY + 1.6, H.hallZ - 3.5], [H.hallX0 + 23, H.deepY + 2.4, H.hallZ - 9], { fog: 0.006, sky: DARK, fov: 82, lights: LIGHTS });
shot('40-the-suburbia-window', [H.hallX0 + 13.5, H.deepY + 1.6, H.hallZ + 4], [H.hallX0 + 13.5, H.deepY + 1.9, H.hallZ + 12], { fog: 0.006, sky: DARK, fov: 82, lights: LIGHTS });
shot('41-the-room-at-the-end', [H.bigX0 + 14, H.deepY + 1.6, H.bigZ0 + 9], [H.bigX0 + 8, H.deepY + 1.2, H.bigZ0 + 1], { fog: 0.006, sky: DARK, fov: 82, lights: LIGHTS });
console.log('chunks resident:', w.chunks.size);
