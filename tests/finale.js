/* PHASE 33 — THE FINAL CREATURE.

   WHAT THIS FILE CAN AND CANNOT PROVE.

   It boots the REAL script into the offline harness and drives the REAL things: the real
   FINALE_BEATS table, a real FinalSequence against a stand-in Game, the real creature and
   the real finale scene built out of real THREE objects and measured, the real audio rig,
   the real save blocker. Where a claim is about the shipped SOURCE rather than about
   behaviour it says so, because `Game` cannot be constructed without a GPU — the live half
   (that it renders, that the credits appear, that pointer lock is released, that no audio
   survives the cut) is in browser-finale.js and is claimed only there.

   IT CANNOT PROVE THE ENDING WORKS. Whether a person mistakes a leg for a tower, whether
   the scale lands, whether the face is unsettling or silly, and whether anyone reaches the
   credits thinking "what the hell was that" are judgements for a person. The full human
   Era 1 playthrough is intentionally deferred until Phase 36; the phase report says so
   plainly and claims nothing about how any of this feels. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld } = require('./harness/world.js');
const THREE = require('three');

const ROOT = path.join(__dirname, '..');
const SRC = require('./harness/source.js').buildSource()   /* ERA 1.5: the WHOLE build — every
   src/ module plus the inline <script>. Reading game.html directly would scan less
   and less code as Era 1.5 extracts, while going on passing. See ARCHITECTURE.md §0. */;
const BIBLE = require('./harness/story.js');   /* ERA 1.5.2 — one parser, shared with
   story.js, haven.js and objectives.js. Ask by TITLE, never by section number. */
const STORY = BIBLE.TEXT;
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
                      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const LIVE = strip(SRC);

function classBody(src, name) {
  const i = src.indexOf('class ' + name + ' {');
  if (i < 0) return '';
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return '';
}
function methodBody(src, name) {
  const i = src.indexOf('\n  ' + name + '(');
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return null;
}

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

console.log('booting the real script...');
const { S, ev, w } = makeWorld();
const BEATS = ev('FINALE_BEATS.map(b => ({id:b.id, at:b.at, dur:b.dur}))');
const DURATION = ev('FINALE_DURATION');
const FOG = ev('Object.assign({}, FINALE_FOG)');
const PITCH = ev('Object.assign({}, FINALE_PITCH)');
const H = ev('FINAL_CREATURE_HEIGHT');
const DIST = ev('FINALE_CREATURE_DISTANCE');
const LANDMARKS = ev('FINALE_LANDMARKS.map(l => ({at:l.at, x:l.x, h:l.h, kind:l.kind}))');
const FinalSequence = ev('FinalSequence');

/* A stand-in Game. Deliberately NOT a real one: constructing a Game needs a GPU, and the
   sequence's contract is that it reads a player, a world, an env, a sound engine and a ui
   and writes only through named methods on them. Everything it touches is recorded. */
function harness(opts) {
  opts = opts || {};
  const rec = { beats: [], fog: [], finaleMode: [], climax: 0, audio: false, impacts: 0 };
  const player = {
    position: { x: opts.x || 200, y: opts.y || 30, z: opts.z || 200 },
    yaw: opts.yaw !== undefined ? opts.yaw : 2.3,
    pitch: opts.pitch !== undefined ? opts.pitch : -0.4,
    movementLocked: false, mining: true, eyeHeight: 1.62,
    velocity: { set() { this.zeroed = true; }, zeroed: false },
    highlight: { hidden: false, hide() { this.hidden = true; } },
  };
  const env = {
    fog: { density: 0.015 }, t: 0,
    setFinaleFog(d) { rec.fog.push(d); this.finaleFog = d; }, update() {},
  };
  const sound = {
    startFinaleAudio() { rec.audio = true; return true; },
    stopFinaleAudio() { rec.audio = false; return true; },
    setFinaleBeat(b) { rec.beats.push(b); return true; },
  };
  const ui = { setFinaleMode(v) { rec.finaleMode.push(!!v); } };
  const game = { player, world: w, env, sound, ui, _triggerClimax() { rec.climax++; } };
  return { game, player, env, rec, seq: new FinalSequence(game) };
}

// =====================================================================================
head('1. THE BEATS ARE A PURE FUNCTION OF ONE NUMBER');
// =====================================================================================
{
  chk(BEATS.length === 7, `the finale has ${BEATS.length} beats: ${BEATS.map(b => b.id).join(' -> ')}`);
  const want = ['silence', 'impression', 'scale', 'movement', 'face', 'impossible', 'cut'];
  chk(BEATS.map(b => b.id).join(',') === want.join(','),
      'and they are in the order the brief specifies');

  /* THE TABLE TILES THE SEQUENCE WITH NO GAP AND NO OVERLAP, sampled every twentieth of
     a second across the whole thing — the same discipline opening.js applies to
     FILM_BEATS and haven.js to HAVEN_STAGES. */
  let wrong = 0;
  /* The sample is ROUNDED before it is used on either side. Accumulating 0.05 in a float
     lands on 3.4999999999 where the table says 3.5, and comparing the rounded value the
     VM was given against the unrounded one this side is a test bug, not a finding. */
  for (let i = 0; i * 0.05 < DURATION; i++) {
    const t = +(i * 0.05).toFixed(2);
    const id = ev(`finaleBeatAt(${t})`);
    const expect = BEATS.filter(b => t >= b.at).pop();
    if (!expect || expect.id !== id) wrong++;
  }
  chk(wrong === 0, `every 0.05s of the ${DURATION}s sequence resolves to exactly the tabled beat`);
  let contiguous = true;
  for (let i = 1; i < BEATS.length; i++)
    if (Math.abs(BEATS[i].at - (BEATS[i - 1].at + BEATS[i - 1].dur)) > 1e-9) contiguous = false;
  chk(contiguous, 'each beat begins exactly where the last one ended — no gap, no overlap');

  // Total, because this runs inside the frame loop and may never throw.
  chk(ev("finaleBeatAt(-5)") === 'silence', 'a negative time clamps to the first beat');
  chk(ev(`finaleBeatAt(${DURATION + 900})`) === 'cut', 'and past the end it clamps to the last');
  chk(ev("finaleBeatAt(NaN)") === 'silence' && ev("finaleBeatAt('x')") === 'silence',
      'NaN and a string are answered too, rather than throwing');
  chk(ev('finaleBeatProgress(0)') === 0 && Math.abs(ev('finaleBeatProgress(3.4999)') - 1) < 0.01,
      'progress runs 0..1 inside a beat');
  chk(ev('finaleBeatAt(12)') === ev('finaleBeatAt(12)'),
      'the same second always resolves to the same beat');
}

// =====================================================================================
head('2. THE TIMING IS WHAT THE BRIEF ASKED FOR');
// =====================================================================================
{
  chk(DURATION >= 20 && DURATION <= 40,
      `the sequence runs ${DURATION}s, inside the brief's 20-40s window`);
  chk(Math.abs(DURATION - 30) <= 5, `and within five seconds of the ~30s target`);

  const by = {};
  for (const b of BEATS) by[b.id] = b;
  /* Each beat's own window, from the brief. These are checked individually because the
     shape matters more than the total: a thirty-second sequence that spends twenty of
     them on the face is not this sequence. */
  const windows = {
    silence: [2, 4], impression: [4, 7], scale: [5, 8],
    movement: [3, 5], face: [3, 5], impossible: [3, 6], cut: [0.5, 2],
  };
  for (const id of Object.keys(windows)) {
    const [lo, hi] = windows[id];
    chk(by[id].dur >= lo && by[id].dur <= hi,
        `${id} runs ${by[id].dur}s (brief: ${lo}-${hi}s)`);
  }
  chk(by.silence.at === 0, 'the sequence opens on the silence, not on the creature');
  chk(by.face.at > by.scale.at && by.face.at > by.impression.at,
      'the face comes after the scale has been established, never before it');
  chk(by.impossible.at + by.impossible.dur === by.cut.at,
      'and the cut lands the instant the last composition is done');
}

// =====================================================================================
head('3. THE CREATURE IS NOT A BOSS, A STALKER OR A BEHEMOTH');
// =====================================================================================
{
  const c = ev(`buildFinalCreature(${H})`);
  chk(c && c.group, 'the creature builds');
  chk(c.height === H && H >= 100, `it is ${H} metres tall`);

  /* SCALE, AGAINST THINGS THE PLAYER KNOWS. Measured off the shipped landmark table
     rather than asserted, so moving a landmark cannot silently make the shot smaller. */
  const tower = LANDMARKS.find(l => l.kind === 'tower');
  const cabin = LANDMARKS.find(l => l.kind === 'cabin');
  chk(!!tower && H / tower.h >= 5,
      `it is ${(H / tower.h).toFixed(1)}x the water tower, which is the tallest thing the player knows`);
  chk(!!cabin && H / cabin.h >= 15,
      `and ${(H / cabin.h).toFixed(0)}x the Haven cabin they just lost`);

  /* PROPORTION IS THE DESIGN. Measured from the built object, in world units. */
  const box = new THREE.Box3().setFromObject(c.group);
  const size = box.getSize(new THREE.Vector3());
  chk(size.y > H * 0.9, `the built object really is ${size.y.toFixed(0)}m tall`);
  const slender = size.y / Math.max(size.x, size.z);
  /* A human silhouette is roughly 4:1. Anything past 5.5 at this height is a proportion
     no skeleton supports, and the floor stops the figure quietly becoming a normal giant
     if a later phase ever thickens it again. */
  chk(slender > 5.5,
      `and ${slender.toFixed(1)}x taller than it is wide — a human is about 4:1, and this ` +
      `is ${H} metres tall`);

  /* THE ARMS. The single most legible wrongness, so it is measured rather than trusted:
     the ends of them must hang BELOW the knee. */
  const legTop = H * 0.63, kneeY = legTop * 0.55;
  const armEnd = c.shoulderY - (H * 0.30 + H * 0.34);
  chk(armEnd < kneeY,
      `the arms end at y=${armEnd.toFixed(0)}, below the knee at y=${kneeY.toFixed(0)} — a hand hanging past a knee`);
  chk(armEnd > 0, 'but not through the floor');

  /* THE HEAD IS SMALL, which is what makes the distance impossible to judge. */
  const headBox = new THREE.Box3().setFromObject(c.head);
  const headH = headBox.getSize(new THREE.Vector3()).y;
  chk(headH / H < 0.06, `the head is ${(100 * headH / H).toFixed(1)}% of the body — the eye cannot use it to judge distance`);

  /* IT IS A SILHOUETTE. No material in it responds to light, so nothing can accidentally
     turn the finale into a lit model showcase (requirement 14). */
  const mats = [];
  c.group.traverse(o => { if (o.material) mats.push(o.material); });
  chk(mats.length > 0 && mats.every(m => m.type === 'MeshBasicMaterial'),
      `all ${mats.length} materials are unlit — it can never be lit like an asset`);
  const dark = mats.filter(m => m.color && (m.color.r + m.color.g + m.color.b) < 0.2);
  chk(dark.length === mats.length - 1,
      `every part but one is near-black; the one exception is the face`);
  chk(!!c.faceMat && (c.faceMat.color.r + c.faceMat.color.g + c.faceMat.color.b) > 1.5,
      'and the face is the one pale thing in the shot');

  /* NO BOSS VOCABULARY, ANYWHERE. Checked against the shipped source of the builder. */
  const builder = LIVE.slice(LIVE.indexOf('function buildFinalCreature'),
                             LIVE.indexOf('function buildFinaleScene'));
  for (const banned of ['RingGeometry', 'TetrahedronGeometry', 'PointLight', 'emissive'])
    chk(builder.indexOf(banned) < 0, `no ${banned} — no rings, no shards, no glow, no light of its own`);
  chk(!/health|damage|attack|hp\b/i.test(builder), 'and nothing about health, damage or attacking');

  /* NOT THE STALKER AND NOT THE BEHEMOTH. Neither mesh is reachable from the finale. */
  const seq = classBody(LIVE, 'FinalSequence');
  chk(!/[Ss]talker/.test(seq) && !/[Bb]ehemoth/.test(seq),
      'the sequence never mentions the Stalker or the Behemoth');
  chk(!/[Ss]talker|[Bb]ehemoth/.test(builder), 'nor does the creature builder');
  const build = methodBody(LIVE, 'buildFinale') || '';
  chk(/buildFinalCreature\(/.test(build) && !/[Ss]talker|[Bb]ehemoth|Mob/.test(build),
      'and the scene builds exactly one creature, from its own builder');
  chk(ev('typeof buildVoidSovereignMesh') === 'undefined',
      'the old eight-metre monolith is gone from the build entirely');
}

// =====================================================================================
head('4. THE SCALE IS READ OFF THINGS THE PLAYER ALREADY KNOWS');
// =====================================================================================
{
  const sc = ev('buildFinaleScene()');
  chk(sc && sc.parts.length > 20, `the finale ground builds ${sc.parts.length} meshes`);

  const kinds = new Set(LANDMARKS.map(l => l.kind));
  for (const k of ['pole', 'tree', 'barn', 'house', 'cabin', 'tower', 'suburb'])
    chk(kinds.has(k), `the ladder includes a ${k}`);
  chk(kinds.size === 7,
      'and nothing else — every silhouette is something the player has stood next to');

  /* THE LADDER MARCHES AWAY. Each landmark is further than the last, so the eye reads
     depth rather than clutter, and the creature is beyond all of them. */
  let increasing = true;
  for (let i = 1; i < LANDMARKS.length; i++)
    if (LANDMARKS[i].at < LANDMARKS[i - 1].at) increasing = false;
  chk(increasing, 'the landmarks are ordered outward from the player');
  chk(LANDMARKS[LANDMARKS.length - 1].at < DIST,
      `every one of them is nearer than the creature (furthest ${LANDMARKS[LANDMARKS.length - 1].at}m vs ${DIST}m)`);
  chk(LANDMARKS[0].at > 20, 'and none is so close that it fills the frame');

  /* ANGULAR SIZE IS WHAT A PLAYER ACTUALLY SEES, so it is computed rather than assumed:
     the creature must subtend more of the screen than the biggest landmark despite being
     the furthest thing away. That is the entire trick of the shot. */
  const ang = (h, d) => Math.atan2(h, d) * 180 / Math.PI;
  const creatureAng = ang(H, DIST);
  const biggest = LANDMARKS.map(l => ang(l.h, l.at)).sort((a, b) => b - a)[0];
  /* THE CLAIM, STATED PROPERLY. It is not that the creature dwarfs everything by some
     multiple — a utility pole thirty-eight metres away legitimately fills a lot of
     screen, and demanding otherwise would only push the ladder away until it stopped
     working. It is that the creature is the FURTHEST thing in the shot and is still the
     LARGEST thing in it. That inversion is the whole trick, and it is what a player
     resolves as "how far away is that, then". */
  chk(creatureAng > biggest,
      `the creature subtends ${creatureAng.toFixed(1)}°, more than the largest landmark's ` +
      `${biggest.toFixed(1)}° — and it is the furthest object in the shot`);
  const nearest = LANDMARKS.map(l => ang(l.h, l.at)).sort((a, b) => b - a)[0];
  const furthestLandmark = LANDMARKS[LANDMARKS.length - 1];
  chk(creatureAng > ang(furthestLandmark.h, furthestLandmark.at) * 10,
      `and ten times the angular size of the furthest thing standing in front of it`);
  chk(creatureAng > 20, 'it needs the player to look up to take in');

  // The ground is one plane, not a terrain: it costs nothing and never regenerates.
  const groundParts = sc.parts.filter(p => p.geometry && p.geometry.type === 'PlaneGeometry');
  chk(groundParts.length === 1, 'the ground is a single plane');
}

// =====================================================================================
head('4b. THE PLAYER IS STANDING IN THE OPEN');
// =====================================================================================
{
  /* THE BUG THIS GUARDS, and it was found by looking at a screenshot rather than by any
     assertion: the first capture of the last beat was a wall of dark red voxels a metre
     from the camera. `corruptHaven()` decays the cabin in PLACE, and the player is inside
     it — so the finale was composing three hundred and twenty metres of sightline behind
     a rotting wall. */
  const clear = methodBody(LIVE, 'clearHavenForFinale') || '';
  chk(clear.length > 0, 'the Haven is taken out of the scene before the finale is built');
  chk(/disposeChunk\(chunk\)/.test(clear), 'its chunks are disposed');
  chk(/havenFogWall/.test(clear),
      'and so is the warm fog ring, which corruptHaven only recoloured — it would have ' +
      'been a wall of haze between the player and the thing they are meant to look at');
  chk(!/fakeHavenActive\s*=\s*false/.test(clear),
      'but the streaming lock is deliberately left alone: clearing it would have the ' +
      'streamer generate Overworld terrain underneath the finale');

  const begin = methodBody(LIVE, 'begin') || '';
  chk(begin.indexOf('clearHavenForFinale') < begin.indexOf('buildFinale'),
      'and it happens BEFORE the finale scene is built, not after');

  /* Driven: after clearing, no voxel stands between the player and the creature. The
     cabin sat within a dozen blocks of the player, so this walks the first fifty metres
     of the sightline and asserts every one of them is air. */
  S.__w = w;                       // the harness's handle, as haven.js sets it
  const spawn = ev('__w.generateFakeHaven()');
  ev('__w.corruptHaven()');
  let solidBefore = 0;
  for (let d = 1; d < 12; d++)
    if (w.getBlockWorld(Math.floor(spawn.x), Math.floor(spawn.y) + 1, Math.floor(spawn.z) - d) !== 0) solidBefore++;
  chk(solidBefore > 0, `the corrupted cabin really is in the way (${solidBefore} solid cells ahead)`);
  w.clearHavenForFinale();
  let solidAfter = 0;
  for (let d = 1; d < 50; d++)
    if (w.getBlockWorld(Math.floor(spawn.x), Math.floor(spawn.y) + 1, Math.floor(spawn.z) - d) !== 0) solidAfter++;
  chk(solidAfter === 0, 'and after clearing, fifty metres of sightline is empty');
  chk(w.chunks.size === 0, 'with no chunk left resident at all');
  chk(w.havenFogWall === null, 'and no fog ring');
  chk(w.fakeHavenActive === true, 'while the streaming lock is still held');
  w._resetHavenPocket();
}

// =====================================================================================
head('5. IT DOES NOT SHOW EVERYTHING');
// =====================================================================================
{
  /* THE FOG CURVE IS THE REVEAL, so the numbers are checked against the physics rather
     than eyeballed: FogExp2 visibility at distance d is exp(-(density*d)^2). */
  const vis = (density) => Math.exp(-Math.pow(density * DIST, 2));
  const order = BEATS.map(b => b.id);
  let opens = true;
  for (let i = 1; i < order.length; i++)
    if (FOG[order[i]] > FOG[order[i - 1]]) opens = false;
  chk(opens, 'the fog only ever thins — the sequence opens up and never closes again');
  chk(vis('silence' in FOG ? FOG.silence : 1) < 0.02,
      `at the silence beat the creature is ${(100 * vis(FOG.silence)).toFixed(1)}% visible — i.e. not there`);
  chk(vis(FOG.impression) < 0.10,
      `at first impression it is ${(100 * vis(FOG.impression)).toFixed(0)}% — a smudge, not a creature`);
  chk(vis(FOG.scale) > 0.10 && vis(FOG.scale) < 0.40,
      `at the scale beat ${(100 * vis(FOG.scale)).toFixed(0)}% — legible as columns, not as anatomy`);
  chk(vis(FOG.impossible) > 0.6 && vis(FOG.impossible) < 0.9,
      `and even at its clearest it is only ${(100 * vis(FOG.impossible)).toFixed(0)}% — never fully resolved`);

  /* A SILHOUETTE IS A CONTRAST, and this is the assertion that would have caught the
     first render being an empty plain: the creature must be materially darker than the
     air it is seen through, or heavy fog and the creature are the same colour and it can
     never emerge from one. Everything in the shot obeys the same rule. */
  const env = ev('new EnvironmentSystem(__scene)') || null;
  const skyHex = (() => {
    const m = /this\._finaleColor = new THREE\.Color\(0x([0-9a-fA-F]{6})\)/.exec(LIVE);
    return m ? parseInt(m[1], 16) : null;
  })();
  chk(skyHex !== null, 'the finale sky colour is declared');
  const lum = (hex) => {
    const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  const creatureHex = (() => {
    const m = /color: 0x([0-9a-fA-F]{6}), fog: true \}\);\s*const limbMat/.exec(LIVE) ||
              /const bodyMat = new THREE\.MeshBasicMaterial\(\{ color: 0x([0-9a-fA-F]{6})/.exec(LIVE);
    return m ? parseInt(m[1], 16) : null;
  })();
  chk(creatureHex !== null, 'and so is the creature body colour');
  chk(lum(skyHex) > lum(creatureHex) * 3,
      `the sky (${lum(skyHex).toFixed(3)} luma) is materially brighter than the creature ` +
      `(${lum(creatureHex).toFixed(3)}) — it can actually silhouette against it`);
  chk(lum(skyHex) < 0.25,
      `and still dark enough that the beat called "silence" reads as almost nothing (${lum(skyHex).toFixed(3)})`);

  /* THE LEFTOVER SCONCES. The cabin's two wall torches registered lights in the world's
     position-keyed registries, which disposeChunk does not reach; a scene probe found
     both still burning in the middle of the empty plain. */
  const clear2 = methodBody(LIVE, 'clearHavenForFinale') || '';
  chk(/torchLights/.test(clear2) && /torchProps/.test(clear2),
      'the Haven\'s wall sconces are taken down too — there is no light in this shot at all');

  /* THE FACE HAS NOTHING ON IT, and must never. */
  const builder = LIVE.slice(LIVE.indexOf('function buildFinalCreature'),
                             LIVE.indexOf('function buildFinaleScene'));
  chk(!/eye|mouth|teeth|jaw|pupil|nostril/i.test(builder),
      'the face has no eye, mouth, teeth or jaw — the player finishes it themselves');
  const c = ev(`buildFinalCreature(${H})`);
  chk(c.face.geometry.type === 'PlaneGeometry',
      'it is one flat plane, and there is nothing drawn on it');
  chk(c.faceMat.transparent && c.faceMat.opacity < 1,
      `and it is ${c.faceMat.opacity} opaque, so it reads as an area rather than a sticker`);
}

// =====================================================================================
head('6. THE CAMERA IS A DRIFT, NOT A RAIL');
// =====================================================================================
{
  const { seq, player, rec } = harness({ yaw: 2.3, pitch: -0.4 });
  seq.begin();
  chk(player.yaw === 0 && player.pitch === 0,
      'the sequence opens the player level and facing the place the creature stands');

  /* THE DRIFT IS A LERP, AND THE TEST IS THAT A PLAYER CAN FIGHT IT. Yaw is shoved a
     radian away mid-sequence; the drift must pull it back over seconds rather than snap
     it back on the next frame, or the view has been taken away from the player. */
  for (let i = 0; i < 60 * 12; i++) seq.tick(1 / 60);
  player.yaw = 1.0;
  const afterOneFrame = (() => { seq.tick(1 / 60); return player.yaw; })();
  chk(afterOneFrame > 0.98,
      `one frame later the yaw is still ${afterOneFrame.toFixed(3)} — the view is never snapped`);
  for (let i = 0; i < 60 * 4; i++) seq.tick(1 / 60);
  chk(player.yaw < 0.2 && player.yaw > 0,
      `but four seconds of drift has carried it most of the way back (${player.yaw.toFixed(3)})`);

  /* THE EYE LIFTS, AND LIFTS LAST. */
  const order = BEATS.map(b => b.id);
  let rises = true;
  for (let i = 1; i < order.length; i++)
    if (PITCH[order[i]] < PITCH[order[i - 1]]) rises = false;
  chk(rises, 'the authored pitch only ever rises — the eye is walked upward, never down');
  chk(PITCH.silence === 0, 'it starts level');
  chk(PITCH.impossible > PITCH.face * 1.5,
      `and the biggest lift is saved for the last composition (${PITCH.face} -> ${PITCH.impossible})`);
  chk(PITCH.cut < 0.6, 'and never goes so far that the player is looking at the sky');

  /* IT IS THE PLAYER'S OWN EYE. No second camera is created anywhere in the sequence. */
  const seqSrc = classBody(LIVE, 'FinalSequence');
  chk(!/new THREE\.(Perspective|Orthographic)Camera/.test(seqSrc),
      'no second camera is ever constructed — the viewpoint stays the player’s');
  chk(!/camera\.position\.set|camera\.lookAt/.test(seqSrc),
      'and the camera is never positioned or aimed directly; only yaw and pitch move');
}

// =====================================================================================
head('7. INPUT IS LOCKED, AND NOTHING ELSE IS INVENTED TO DO IT');
// =====================================================================================
{
  const { seq, player } = harness();
  seq.begin();
  chk(player.movementLocked === true, 'the body is locked');
  chk(player.velocity.zeroed, 'and its momentum dropped');
  chk(player.mining === false, 'mining is stopped');
  chk(player.highlight.hidden, 'and the selection box hidden, so nothing is left highlighted');

  /* NO NEW INPUT LAYER. movementLocked plus `running` is what Phase 30 used and what
     Phase 32 used; a third mechanism for the same thing is how a stuck key happens. */
  const seqSrc = classBody(LIVE, 'FinalSequence');
  chk(!/addEventListener|removeEventListener/.test(seqSrc),
      'the sequence binds no listener of its own');
  chk(!/keys\s*=|onKeyDown|onMouseDown/.test(seqSrc),
      'and invents no input handling');
  chk(/movementLocked = true/.test(seqSrc), 'it uses the flag three phases already test');

  /* THE OVERLAYS, WHICH IS A BUG THIS PHASE FOUND WITH A SCREENSHOT. `running` is true
     through the whole sequence — it IS the frame loop — so every overlay key still
     answered, and a browser capture of the scale beat caught the inventory grid open
     across the middle of the shot. The opening film never had this because it plays with
     `running === false`; the finale runs inside the loop and needed saying. */
  const playing = methodBody(LIVE, '_playing') || '';
  chk(/g\.finale && g\.finale\.active/.test(playing),
      'the gameplay-key gate is false while the final sequence is running');
  chk(/g\.climaxTriggered/.test(playing), 'and through the climax');
  chk(/g\.running/.test(playing),
      'without loosening what it already gated — the menu and the opening instruction');
  chk(!/inFakeHaven/.test(playing),
      'and the Haven is deliberately NOT terminal: its chest and backpack stay usable');

  /* Anything already open is closed on the way in. */
  chk(/storageOpen\) g\.ui\.closeStorage\(\)/.test(seqSrc) &&
      /craftingOpen\) g\.ui\.toggleCrafting\(\)/.test(seqSrc) &&
      /backpackOpen\) g\.ui\.toggleBackpack\(\)/.test(seqSrc),
      'and an overlay left open when the Haven ran out is closed as the finale begins');
}

// =====================================================================================
head('8. NO TIMERS, ONE TEARDOWN, NOTHING LEAKED');
// =====================================================================================
{
  const seqSrc = classBody(LIVE, 'FinalSequence');
  chk(!/setTimeout|setInterval|requestAnimationFrame/.test(seqSrc),
      'the sequence schedules nothing — every beat is derived from one accumulating number');

  const { seq, rec } = harness();
  seq.begin();
  chk(!!w.finale, 'begin() builds the scene');
  const built = w.finale.root.children.length;
  chk(seq.begin() === false, 'and beginning it twice is a no-op — there is never a second creature');
  chk(w.finale.root.children.length === built, 'the scene is not doubled');

  for (let i = 0; i < 60 * 33; i++) seq.tick(1 / 60);
  chk(rec.climax === 1, 'running it out reaches the credits exactly once');
  chk(!w.finale, 'and disposes the scene');
  chk(rec.audio === false, 'stops the audio');
  chk(rec.fog[rec.fog.length - 1] === null, 'hands the sky back');
  chk(rec.finaleMode[rec.finaleMode.length - 1] === false, 'and restores the HUD');
  chk(seq.active === false && seq.done === true, 'and marks itself finished');

  for (let i = 0; i < 600; i++) seq.tick(1 / 60);
  chk(rec.climax === 1, 'ticking it afterwards does nothing at all — the credits cannot double-fire');

  /* THE DISPOSE IS A REAL DISPOSE. A finale that only detaches its group leaks a hundred
     and fifty metres of geometry per playthrough. */
  const dispose = methodBody(LIVE, 'disposeFinale') || '';
  chk(/geometry\.dispose\(\)/.test(dispose) && /material/.test(dispose) && /traverse/.test(dispose),
      'disposeFinale disposes geometry and materials, not just the group');
  chk(/this\.finale = null;/.test(dispose) &&
      dispose.indexOf('this.finale = null') < dispose.indexOf('traverse'),
      'and nulls the handle first, so a second call cannot double-dispose');
  chk(w.disposeFinale() === false, 'calling it with nothing built is a no-op');
}

// =====================================================================================
head('9. REPLAY DOES NOT ACCUMULATE');
// =====================================================================================
{
  const counts = [];
  for (let run = 0; run < 3; run++) {
    const { seq, rec } = harness();
    seq.begin();
    counts.push(w.finale.root.children.length + w.scene.children.length);
    for (let i = 0; i < 60 * 33; i++) seq.tick(1 / 60);
    chk(rec.climax === 1, `run ${run + 1}: the credits fired once`);
  }
  chk(counts.every(c => c === counts[0]),
      `three full playthroughs build the same scene every time (${counts.join(', ')})`);
  chk(!w.finale, 'and none of them is left resident');

  /* reset() is the New Game path, and it must work from mid-sequence too. */
  const { seq, rec } = harness();
  seq.begin();
  for (let i = 0; i < 60 * 10; i++) seq.tick(1 / 60);
  chk(!!w.finale && seq.active, 'a sequence is running ten seconds in');
  seq.reset();
  chk(!w.finale, 'reset() from mid-sequence disposes the scene');
  chk(rec.audio === false && rec.fog[rec.fog.length - 1] === null,
      'stops the audio and hands the sky back');
  chk(rec.finaleMode[rec.finaleMode.length - 1] === false, 'restores the HUD');
  chk(seq.active === false && seq.done === false && seq.t === 0,
      'and clears the done latch, so a New Game can reach the ending again');
  chk(rec.climax === 0, 'without ever having reached the credits');
  chk(seq.begin() === true, 'and the sequence can be begun again afterwards');
  seq.reset();
}

// =====================================================================================
head('10. THE AUDIO');
// =====================================================================================
{
  const { seq, rec } = harness();
  seq.begin();
  for (let i = 0; i < 60 * 33; i++) seq.tick(1 / 60);
  chk(rec.beats.join(',') === BEATS.map(b => b.id).join(','),
      'every beat is handed to the audio engine exactly once, in order');

  const sound = classBody(LIVE, 'SoundEngine');
  const start = methodBody(sound, 'startFinaleAudio') || '';
  const stop = methodBody(sound, 'stopFinaleAudio') || '';
  const setBeat = methodBody(sound, 'setFinaleBeat') || '';
  chk(/if \(!this\.ctx \|\| this\.finaleAudio\) return false/.test(start),
      'starting the rig twice is a no-op');
  chk(/this\.finaleAudio = null/.test(stop) &&
      stop.indexOf('this.finaleAudio = null') < stop.indexOf('setTimeout'),
      'stopping it nulls the handle before the teardown, so it cannot double-stop a source');
  chk(/const a = this\.finaleAudio;\s*if \(!a\) return false;/.test(stop),
      'and stopping it twice is a no-op too');
  const started = (start.match(/\.start\(now\)/g) || []).length;
  chk(started === 3, `the rig starts ${started} sources`);
  chk(/for \(const n of \[a\.sub, a\.air, a\.press\]\)/.test(stop),
      'and the teardown stops all three by name');

  /* NO SECOND AUDIOCONTEXT, structurally: nothing in the rig can make one. */
  chk(!/new (AudioContext|webkitAudioContext)/.test(start + stop + setBeat),
      'no second AudioContext is created anywhere in the finale audio');

  /* THE SOUND GETS LOWER AND LARGER, NOT LOUDER AND BUSIER. */
  const table = setBeat.slice(setBeat.indexOf('const L = {'), setBeat.indexOf('}[beat]'));
  const rows = {};
  for (const m of table.matchAll(/(\w+):\s*\[([\d.]+),\s*([\d.]+),\s*([\d.]+)\]/g))
    rows[m[1]] = [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
  chk(Object.keys(rows).length === 7, 'there is a level row for every beat');
  chk(rows.silence[0] === 0 && rows.silence[1] === 0 && rows.silence[2] === 0,
      'the silence beat is actually silent');
  const ids = BEATS.map(b => b.id);
  let monotone = true;
  for (let i = 1; i < ids.length; i++)
    for (let k = 0; k < 3; k++) if (rows[ids[i]][k] < rows[ids[i - 1]][k]) monotone = false;
  chk(monotone, 'and no layer ever gets quieter — the floor only ever thickens');
  chk(rows.cut[0] > rows.impression[0] * 3,
      'by the cut the sub is several times what it was at first sight');

  /* ONE EVENT, AND IT IS NOT A ROAR. */
  chk(/if \(beat === 'face'\) this\.playFinaleImpact\(\);/.test(setBeat),
      'exactly one audio event fires in the sequence, on the face beat');
  const impact = methodBody(sound, 'playFinaleImpact') || '';
  chk(!/WaveShaper|curve|tanh/.test(impact), 'and it is not distorted — no shaper, no clipping');
  chk(/exponentialRampToValueAtTime/.test(impact) && /2\.0/.test(impact),
      'it is a low strike with a long tail rather than a stinger');
  chk(ev('typeof SoundEngine.prototype.playVoidSovereignRoar') === 'undefined',
      'and the old roar is gone from the build — the creature has no lungs');
}

// =====================================================================================
head('11. THE ENVIRONMENT, AND WHAT IT DOES NOT DO');
// =====================================================================================
{
  /* The finale's air must beat every dimension override, or the Haven's blue sky or the
     nightmare's red one repaints over the top of it. */
  /* Scoped to EnvironmentSystem: `update(` appears on a dozen classes and the first one
     in the file is not the sky. */
  const upd = methodBody(classBody(LIVE, 'EnvironmentSystem'), 'update') || '';
  const iFin = upd.indexOf('this.finaleFog !== null');
  const iNight = upd.indexOf('this.nightmareActive');
  const iHaven = upd.indexOf('this.fakeHavenActive');
  chk(iFin > 0 && iFin < iNight && iFin < iHaven,
      'the finale sky is checked before the nightmare and Haven overrides, so nothing repaints it');

  /* NO SCREEN EFFECTS. Requirement 13: the creature is the effect. */
  const shift = methodBody(LIVE, '_triggerHavenShift') || '';
  chk(/setVoidGlitch\(0\)/.test(shift), 'the handoff drops the void glitch to zero');
  chk(/setHorrorEnabled\(false\)/.test(shift), 'leaves the horror grading off');
  chk(/this\.shakeTime = 0/.test(shift), 'and stops the camera shake');
  chk(/setNightmareOverride\(false\)/.test(shift), 'and clears the blood-red sky');
  const seqSrc = classBody(LIVE, 'FinalSequence');
  chk(!/setVoidGlitch|shake\(|triggerJumpscare|setHorrorEnabled\(true\)/.test(seqSrc),
      'and the sequence itself never shakes the camera, glitches the screen or fires a jumpscare');
}

// =====================================================================================
head('12. IT NEVER EXPLAINS ANYTHING');
// =====================================================================================
{
  const seqSrc = classBody(LIVE, 'FinalSequence');
  chk(!/showToast|textContent\s*=/.test(seqSrc),
      'the sequence writes no text to the screen at all');
  /* A string literal cannot contain a newline, and allowing one makes this match the code
     BETWEEN two short quoted beat ids rather than any literal at all. */
  const longest = (seqSrc.match(/'[^'\n]{10,}'/g) || []).map(s => s.length).sort((a, b) => b - a)[0] || 0;
  chk(longest < 30, `the longest string literal in it is ${longest} characters`);

  /* THE CANON'S INTERNAL VOCABULARY IS NEVER ON SCREEN. STORY.md sections 19, 22 and 24. */
  const builder = LIVE.slice(LIVE.indexOf('function buildFinalCreature'),
                             LIVE.indexOf('function buildFinaleScene'));
  const zone = seqSrc + builder + (methodBody(LIVE, 'buildFinale') || '');
  for (const word of ['the record', 'reconstruction', 'Void Sovereign', 'Sovereign'])
    chk(!new RegExp("['\"`][^'\"`\\n]*" + word + "[^'\"`\\n]*['\"`]", 'i').test(zone),
        `"${word}" appears in no string the finale can show`);
  chk(!/name|title|caption|label/i.test(seqSrc.replace(/\/\/[^\n]*/g, '')),
      'the creature is never named or labelled');

  /* AND THE CANON STILL SAYS WHAT IT SAID. */
  /* ERA 1.5.2 — asked of the shared bible parser by TITLE. The final creature moved from
     section 19 to section 17 when the author rewrote STORY.md. Every rule below is the
     same rule; two of them are now stated more plainly than before. */
  const beast = BIBLE.byTitle('THE FINAL CREATURE');
  chk(beast.length > 200, 'the bible\'s final-creature section is present and is what this was built from');
  chk(/a god/i.test(beast) && /a demon/i.test(beast) && /an alien/i.test(beast) &&
      /a final boss/i.test(beast),
      'it says the creature is not a god, a demon, an alien or a boss');
  chk(/the reason the world is broken/i.test(beast),
      'and is not the cause of the damage');
  chk(/It is a removal/i.test(beast),
      'and that seeing it is a removal rather than a revelation');
  /* The name's retirement lives in the vocabulary table, which is where retirements are
     recorded for every term rather than only for this one. */
  chk(/Void Sovereign[^\n]*retired/i.test(BIBLE.byTitle('CANONICAL VOCABULARY')),
      'and that the internal name is retired from player-facing text');
  chk(/no dialogue/i.test(beast) && /no motive/i.test(beast) && /no weakness/i.test(beast) &&
      /no explained origin/i.test(beast),
      'and forbids giving it dialogue, a motive, a weakness or an origin');
  chk(/That was always there/i.test(beast),
      'and fixes the intended player thought, which the credits line still carries');
}

// =====================================================================================
head('13. NO BOSS MECHANICS ANYWHERE IN IT');
// =====================================================================================
{
  const seqSrc = classBody(LIVE, 'FinalSequence');
  for (const banned of ['hp', 'health', 'damage', 'attack', 'hit', 'kill', 'dodge', 'weapon'])
    chk(!new RegExp('\\b' + banned + '\\b', 'i').test(seqSrc.replace(/\/\*[\s\S]*?\*\//g, '')),
        `the sequence contains no "${banned}"`);
  chk(!/mobs\.|stalker\.|phantoms\.|arrows\./.test(seqSrc),
      'and touches no combat system of any kind');

  /* NOTHING HOSTILE CAN EXIST HERE: the Haven already latched spawning off before the
     handoff, and the finale never turns it back on. */
  const flush = methodBody(LIVE, '_transitionToLevel4') || '';
  chk(/spawningDisabled\s*=\s*true|behemothSpawned\s*=\s*true/.test(flush),
      'spawning was already latched off on the way into the Haven');
  chk(!/spawningDisabled\s*=\s*false/.test(seqSrc),
      'and the finale never turns it back on');
}

// =====================================================================================
head('14. THE CREATURE CANNOT APPEAR EARLY');
// =====================================================================================
{
  const buildCalls = (LIVE.match(/\.buildFinale\(/g) || []).length;
  chk(buildCalls === 1, `the finale scene is built from exactly ${buildCalls} call site`);
  const beginCalls = (LIVE.match(/finale\.begin\(\)/g) || []).length;
  chk(beginCalls === 1, `and the sequence is begun from exactly ${beginCalls} call site`);
  const shift = methodBody(LIVE, '_triggerHavenShift') || '';
  chk(/this\.finale\.begin\(\)/.test(shift),
      'and that site is the Haven shift, which is latched and reachable only once');
  const haven = methodBody(LIVE, '_updateHaven') || '';
  chk(!/finale\.begin|buildFinale/.test(haven),
      'nothing in the intact Haven can start it');
  const film = classBody(LIVE, 'OpeningFilm');
  chk(!/buildFinalCreature|FinalSequence|finale\./.test(film),
      'and nothing in the opening film can either — Phase 30 keeps its shapes unresolved');

  /* Driven: a sequence that has never been begun has built nothing. */
  const { seq } = harness();
  chk(!w.finale, 'a fresh sequence has no scene');
  seq.tick(5);
  chk(!w.finale && seq.t === 0, 'and ticking one that was never begun does nothing whatsoever');
}

// =====================================================================================
head('15. THE ENDING CANNOT TOUCH THE SAVE');
// =====================================================================================
{
  const blocked = methodBody(LIVE, 'saveBlockedReason') || '';
  chk(/climaxTriggered/.test(blocked) && /fakeHavenTriggered/.test(blocked),
      'saving is refused from the moment the Haven sequence starts and through the climax');
  const load = methodBody(LIVE, 'loadGame') || '';
  chk(/climaxTriggered|inFakeHaven/.test(load), 'and loading is refused too');
  const dims = ev('SAVE_DIMENSIONS.slice()');
  chk(dims.indexOf('haven') < 0 && dims.indexOf('finale') < 0,
      `no save may name the finale or the Haven as a dimension (${dims.join(', ')})`);

  const seqSrc = classBody(LIVE, 'FinalSequence');
  chk(!/save|autosave|localStorage/i.test(seqSrc.replace(/\/\*[\s\S]*?\*\//g, '')),
      'and the sequence itself never writes, reads or touches a save');

  /* The teardown path a New Game runs must clear the finale, or a second run starts with
     a creature already standing in it. */
  const teardown = methodBody(LIVE, '_teardownForRestore') || '';
  chk(/this\.finale\.reset\(\)/.test(teardown),
      'the one teardown path both New Game and Load run resets the sequence');
  chk(/climaxTriggered = false/.test(teardown), 'and clears the climax latch');
}

// =====================================================================================
head('16. THE CREDITS FIRE ONCE, AND ARE NOT REDESIGNED');
// =====================================================================================
{
  const climax = methodBody(LIVE, '_triggerClimax') || '';
  chk(/if \(this\.climaxTriggered\) return;/.test(climax),
      'the climax is latched — the credits cannot be triggered twice');
  chk(/hardCutToBlack\(\)/.test(climax), 'it hard-cuts to black');
  chk(/silenceAll\(\)/.test(climax), 'silences every audio source');
  chk(/showCredits\(/.test(climax), 'and shows the credits');
  chk(!/fadeToWhite|fadeFromWhite/.test(climax), 'with no fade — requirement 7 wants a hard cut');

  const finish = methodBody(LIVE, 'finish') || '';
  chk(/_triggerClimax\(\)/.test(finish), 'the sequence ends by calling it');
  chk(finish.indexOf('_teardown()') < finish.indexOf('_triggerClimax'),
      'and tears itself down BEFORE handing over, so nothing of it survives into the credits');

  /* Requirement 23: the credits presentation is not this phase's to redesign. */
  const cut = methodBody(LIVE, 'hardCutToBlack') || '';
  chk(/exitPointerLock/.test(cut), 'the cut releases pointer lock');
  chk(/display = 'none'/.test(cut), 'and takes the HUD down');
}

// =====================================================================================
head('17. COST');
// =====================================================================================
{
  const c = ev(`buildFinalCreature(${H})`);
  let meshes = 0, mats = new Set(), geos = new Set();
  c.group.traverse(o => { if (o.isMesh) { meshes++; mats.add(o.material); geos.add(o.geometry); } });
  chk(meshes <= 16, `the creature is ${meshes} meshes`);
  chk(mats.size <= 4, `over ${mats.size} shared materials`);

  const sc = ev('buildFinaleScene()');
  let sMeshes = 0, sMats = new Set();
  sc.group.traverse(o => { if (o.isMesh) { sMeshes++; sMats.add(o.material); } });
  chk(sMeshes <= 60, `the scene is ${sMeshes} meshes`);
  chk(sMats.size <= 3, `over ${sMats.size} shared materials — no per-object material`);

  let lights = 0, textures = 0;
  for (const root of [c.group, sc.group]) root.traverse(o => {
    if (o.isLight) lights++;
    if (o.material && o.material.map) textures++;
  });
  chk(lights === 0, 'neither builds a light — the finale is a silhouette, not a lit scene');
  chk(textures === 0, 'and neither loads a texture');

  /* THE PER-FRAME COST, measured on the real tick against the stand-in game. */
  const { seq } = harness();
  seq.begin();
  const N = 200000;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) seq.tick(1 / 6000);   // tiny dt so it never finishes
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  chk(ms < 0.02, `the whole sequence costs ${ms.toFixed(5)} ms/frame against a 16.7 ms budget`);
  seq.reset();
}

console.log('');
if (fail) { console.log(`${fail} PHASE 33 FINALE CHECK(S) FAILED`); process.exit(1); }
console.log('ALL PHASE 33 FINALE CHECKS PASS');
note('Offline. The real beat table driven frame by frame, the real creature and scene built');
note('and MEASURED (height, slenderness, arm reach, head fraction, angular size against the');
note('landmark ladder, fog visibility at each beat), the real audio rig, the real teardown');
note('and the real save blocker. Whether any of it is frightening is a judgement for a');
note('person: the full human Era 1 playthrough is intentionally deferred until Phase 36.');
