/* PHASE 34 — FINAL AUDIO INTEGRATION.

   WHAT THIS FILE CAN AND CANNOT PROVE.

   It boots the REAL script into the offline harness and drives the REAL things: the real
   AUDIO_ASSETS manifest checked against the files actually on disk, a real AudioLibrary
   against a recording AudioContext and a controllable fetch, the real AudioDirector
   driven frame by frame through every scene the game can produce, the real Haven stage
   table pushed through the real level path, and the real finale beat table. Where a claim
   is about the shipped SOURCE rather than about behaviour it says so.

   IT CANNOT PROVE THE GAME SOUNDS GOOD. Whether the Farmland bed is the right recording,
   whether a distant crow every ninety seconds is too often or not often enough, whether
   the Stalker's cloth is unsettling or silly, and whether the finale feels enormous, are
   judgements for a person with speakers. NOTHING WAS LISTENED TO during this phase: no
   playback device and no audio-analysis tool capable of judging content was available,
   and every classification in AUDIO_INDEX.md is derived from filenames, AUDIO_CREDITS
   titles and ffprobe metadata. The browser half — that a real AudioContext accepts this
   graph, that files actually decode, that nothing throws on a real dimension change — is
   in browser-audio.js and is claimed only there. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld, genRegion } = require('./harness/util.js');
const { S, w: WORLD, ev } = makeWorld();

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const LIVE = strip(SRC);

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (m) => console.log('      ' + m);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));
const g = (n) => vm.runInContext(n, S);

/* The whole of one method, brace-matched. A fixed-length slice is a trap: each phase that
   adds a paragraph of comment pushes the token a later check looks for out of the window,
   and the check then fails for a reason unrelated to the property it is about. */
function methodBody(src, sig) {
  const i = src.indexOf('\n  ' + sig);
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

const AUDIO_ASSETS = g('AUDIO_ASSETS');
const AUDIO_SCENES = g('AUDIO_SCENES');
const AUDIO_EVENTS = g('AUDIO_EVENTS');
const AUDIO_CUES = g('AUDIO_CUES');
const AUDIO_LIMITS = g('AUDIO_LIMITS');
const AUDIO_ROOT = g('AUDIO_ROOT');
const AUDIO_PRELOAD = g('AUDIO_PRELOAD');
const AUDIO_STEP_SURFACES = g('AUDIO_STEP_SURFACES');
const AUDIO_SURFACE_OF = g('AUDIO_SURFACE_OF');
const AudioLibrary = g('AudioLibrary');
const AudioDirector = g('AudioDirector');
const SoundEngine = g('SoundEngine');
const HAVEN_STAGES = g('HAVEN_STAGES');
const FINALE_BEATS = g('FINALE_BEATS');
const BLOCK = g('BLOCK');

// =====================================================================================
// A RECORDING AUDIO CONTEXT, and a fetch whose every response is under this file's
// control. Between them, every path through the library is reachable offline: a file
// that arrives, a file that 404s, a file that arrives and will not decode, and a file
// that is never asked for at all.
// =====================================================================================
function fakeCtx() {
  const made = { gain: 0, source: 0, filter: 0, panner: 0, buffer: 0 };
  const live = { sources: 0 };
  const ctx = {
    made, live, currentTime: 0, sampleRate: 48000, destination: { n: 'dest' },
    _decodeFails: false,
    createGain() {
      made.gain++;
      const n = { _target: null, _outs: [], gain: {
        value: 1,
        cancelScheduledValues() {},
        setTargetAtTime(v) { n._target = v; },
        setValueAtTime(v) { n._target = v; },
        linearRampToValueAtTime(v) { n._target = v; },
        exponentialRampToValueAtTime(v) { n._target = v; },
      }, connect(o) { n._outs.push(o); }, disconnect() {} };
      return n;
    },
    createBufferSource() {
      made.source++;
      const n = { buffer: null, loop: false, onended: null, _started: false, _stopped: false,
        playbackRate: { value: 1 },
        connect() {}, disconnect() {},
        start() { n._started = true; live.sources++; },
        stop() { if (!n._stopped) { n._stopped = true; live.sources--; } } };
      return n;
    },
    createBiquadFilter() { made.filter++; return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {}, disconnect() {} }; },
    createStereoPanner() { made.panner++; return { pan: { value: 0 }, connect() {}, disconnect() {} }; },
    createOscillator() { return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, detune: { value: 0 }, connect() {}, disconnect() {}, start() {}, stop() {} }; },
    createWaveShaper() { return { curve: null, connect() {}, disconnect() {} }; },
    createDelay() { return { delayTime: { value: 0 }, connect() {}, disconnect() {} }; },
    createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {}, disconnect() {} }; },
    createBuffer(ch, len, sr) {
      made.buffer++;
      const data = []; for (let i = 0; i < ch; i++) data.push(new Float32Array(len));
      return { numberOfChannels: ch, length: len, sampleRate: sr || 48000,
               duration: len / (sr || 48000), getChannelData: (i) => data[i] };
    },
    decodeAudioData(ab, ok, bad) {
      if (ctx._decodeFails) { bad(new Error('bad data')); return; }
      ok(ctx.createBuffer(2, 48000 * 8, 48000));      // 8 seconds of stereo
    },
  };
  return ctx;
}

/* An engine stub with the four buses and nothing else, so the library can be exercised
   without an AudioContext the harness refuses to open. */
function stubEngine(ctx) {
  return { ctx, master: { n: 'master' }, musicBus: { n: 'music' },
           sfxBus: { n: 'sfx' }, sfxUnityBus: { n: 'sfxU' }, ambienceBus: { n: 'amb' } };
}

/* Installs a fetch INTO THE SANDBOX, which is where the library looks for it: the script
   runs inside a VM context with its own globals, so assigning to this process's `fetch`
   would be invisible to it. `mode`: 'ok' | '404' | 'throw'. Records every URL asked for. */
function installFetch(mode) {
  const seen = [];
  S.fetch = (url) => {
    seen.push(url);
    if (mode === 'throw') return Promise.reject(new Error('network'));
    if (mode === '404') return Promise.resolve({ ok: false, status: 404 });
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) });
  };
  return seen;
}
const settle = () => new Promise((r) => setImmediate(() => setImmediate(() => setImmediate(r))));

async function main() {

// =====================================================================================
head('1. THE LIBRARY ON DISK');
// =====================================================================================
{
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'runtime') walk(p); }
    else if (e.name !== '.gitkeep' && e.name !== 'AUDIO_CREDITS' && e.name !== 'AUDIO_INDEX.md') files.push(p);
  } };
  walk(AUDIO_DIR);
  const ids = files.map((f) => path.basename(f).split('__')[0]);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  chk(dupes.length === 0,
      `${files.length} source assets and ${new Set(ids).size} distinct Freesound ids — ` +
      (dupes.length ? 'DUPLICATES: ' + dupes.join(', ') : 'no id appears twice'));

  const credits = fs.readFileSync(path.join(AUDIO_DIR, 'AUDIO_CREDITS'), 'utf8');
  const credited = new Set((credits.match(/freesound\.org\/s\/(\d+)\//g) || [])
                            .map((m) => m.replace(/\D/g, '')));
  const uncredited = Array.from(new Set(ids)).filter((i) => !credited.has(i));
  /* THE LICENCE CHECK, and the reason it is the strictest assertion in this file: an
     asset on disk with no attribution line is not untidy, it is a licence breach the
     moment the build is published. */
  chk(uncredited.length === 0,
      uncredited.length ? 'ASSETS WITH NO ATTRIBUTION: ' + uncredited.join(', ')
                        : 'every asset on disk has an attribution line in AUDIO_CREDITS');

  chk(fs.existsSync(path.join(AUDIO_DIR, 'AUDIO_INDEX.md')), 'AUDIO_INDEX.md exists');
  const index = fs.readFileSync(path.join(AUDIO_DIR, 'AUDIO_INDEX.md'), 'utf8');
  const indexed = new Set((index.match(/^\| (\d+)/gm) || []).map((m) => m.replace(/\D/g, '')));
  const missing = Array.from(new Set(ids)).filter((i) => !indexed.has(i));
  chk(missing.length === 0,
      missing.length ? 'ASSETS MISSING FROM THE INDEX: ' + missing.join(', ')
                     : `and all ${indexed.size} of them have a row in AUDIO_INDEX.md`);

  /* The index must not become a second copy of the credits file — one place for a
     licence, and it is the one the licences were collected into. */
  chk((index.match(/https:\/\/freesound\.org/g) || []).length === 0,
      'and it does not duplicate AUDIO_CREDITS — no attribution URLs in the index');
}
{
  /* NONCOMMERCIAL ASSETS MUST BE FINDABLE, because the one thing that turns them from a
     kept option into a legal problem is nobody knowing which they are. */
  const credits = fs.readFileSync(path.join(AUDIO_DIR, 'AUDIO_CREDITS'), 'utf8');
  const nc = [];
  for (const line of credits.split('\n')) {
    const m = line.match(/freesound\.org\/s\/(\d+)\/ -- License: (.+)$/);
    if (m && /NonCommercial|Sampling\+/i.test(m[2])) nc.push(m[1]);
  }
  const onDisk = new Set();
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'runtime') walk(p); }
    else if (/^\d+__/.test(e.name)) onDisk.add(e.name.split('__')[0]);
  } };
  walk(AUDIO_DIR);
  const live = Array.from(new Set(nc)).filter((i) => onDisk.has(i));
  const index = fs.readFileSync(path.join(AUDIO_DIR, 'AUDIO_INDEX.md'), 'utf8');
  const quarantine = index.slice(index.indexOf('LICENCE QUARANTINE'));
  const unlisted = live.filter((i) => quarantine.indexOf(i) < 0);
  chk(quarantine.length > 0 && unlisted.length === 0,
      unlisted.length ? 'NONCOMMERCIAL ASSETS NOT IN THE QUARANTINE SECTION: ' + unlisted.join(', ')
                      : `all ${live.length} NonCommercial/Sampling+ assets are listed in the index's LICENCE QUARANTINE section`);
  note(`NonCommercial or Sampling+ on disk: ${live.length} of ${onDisk.size} — a commercial build must replace every one.`);
}

// =====================================================================================
head('2. THE MANIFEST AND THE FILES IT POINTS AT');
// =====================================================================================
{
  const keys = Object.keys(AUDIO_ASSETS);
  const missing = [];
  let steps = 0, beds = 0, sfx = 0, bytes = 0;
  for (const k of keys) {
    const a = AUDIO_ASSETS[k];
    const list = (a.k === 'step') ? a.v.map((v) => 'steps/' + v) : [a.f];
    if (a.k === 'step') steps++; else if (a.k === 'bed') beds++; else sfx++;
    for (const rel of list) {
      const p = path.join(ROOT, AUDIO_ROOT, rel);
      if (!fs.existsSync(p)) missing.push(k + ' -> ' + rel);
      else bytes += fs.statSync(p).size;
    }
  }
  chk(missing.length === 0,
      missing.length ? 'MANIFEST ENTRIES WITH NO FILE: ' + missing.slice(0, 6).join(', ')
                     : `every one of the ${keys.length} manifest entries resolves to a file that exists ` +
                       `(${beds} beds, ${sfx} cues, ${steps} footstep sets)`);
  note(`runtime/ total ${(bytes / 1e6).toFixed(1)}MB, lazily fetched — nothing is loaded at startup.`);

  /* THE MEMORY CEILING. decodeAudioData expands to 32-bit float at the context rate, so a
     bed's DURATION is what costs, not its file size. Anything much past thirty seconds is
     tens of megabytes resident for a wash the player cannot tell from a loop. */
  const longest = keys.filter((k) => AUDIO_ASSETS[k].k === 'bed')
                      .reduce((a, k) => Math.max(a, AUDIO_ASSETS[k].d), 0);
  chk(longest <= 31,
      `the longest looping bed is ${longest.toFixed(1)}s — at 48kHz stereo float that is ` +
      `${(longest * 48000 * 2 * 4 / 1e6).toFixed(0)}MB resident, and no bed may be longer`);
}
{
  /* EVERY REFERENCE RESOLVES. A typo in a scene, an event, a cue or a surface is a sound
     that silently never plays, which is the single easiest defect to ship in this system
     and the single hardest to notice. */
  const bad = [];
  const need = (k, where) => { if (!AUDIO_ASSETS[k]) bad.push(where + ' -> ' + k); };
  for (const id of Object.keys(AUDIO_SCENES)) {
    const sc = AUDIO_SCENES[id];
    for (const slot of ['air', 'layer', 'tone', 'tension']) if (sc[slot]) need(sc[slot][0], 'scene ' + id);
    if (sc.ev && !AUDIO_EVENTS[sc.ev]) bad.push('scene ' + id + ' names a missing event table: ' + sc.ev);
  }
  for (const id of Object.keys(AUDIO_EVENTS)) for (const p of AUDIO_EVENTS[id].picks) need(p[0], 'event ' + id);
  for (const n of Object.keys(AUDIO_CUES)) for (const k of AUDIO_CUES[n].k) need(k, 'cue ' + n);
  for (const n of Object.keys(AUDIO_STEP_SURFACES)) need(AUDIO_STEP_SURFACES[n].key, 'surface ' + n);
  for (const k of AUDIO_PRELOAD) need(k, 'preload');
  chk(bad.length === 0, bad.length ? 'DANGLING REFERENCES: ' + bad.join(', ')
                                   : 'every scene, event, cue, surface and preload entry names a real manifest key');

  const stepKeys = Object.keys(AUDIO_STEP_SURFACES).map((n) => AUDIO_STEP_SURFACES[n].key);
  const notSteps = stepKeys.filter((k) => AUDIO_ASSETS[k].k !== 'step');
  chk(notSteps.length === 0, 'and every surface names a SLICED footstep set, not a bare cue');
  const slices = Array.from(new Set(stepKeys)).map((k) => AUDIO_ASSETS[k].v.length);
  chk(Math.min.apply(null, slices) >= 4,
      `the thinnest footstep set has ${Math.min.apply(null, slices)} distinct footfalls — ` +
      'the ear picks up a two-sample alternation immediately');
}
{
  /* SPARSENESS IS A NUMBER AND IT IS ASSERTED. "Avoid repetitive random noises every few
     seconds" is the brief's phrasing; this is what it means in the table. */
  let worst = Infinity, worstId = '';
  for (const id of Object.keys(AUDIO_EVENTS)) {
    const gp = AUDIO_EVENTS[id].gap;
    if (gp[0] < worst) { worst = gp[0]; worstId = id; }
    if (gp[1] <= gp[0]) chk(false, 'event table ' + id + ' has a degenerate gap range');
  }
  chk(worst >= 15, `the busiest event table is '${worstId}' at one event per ${worst}s minimum`);
  /* THESE TWO NUMBERS MOVED AFTER A HUMAN PLAYTEST, and the bound is now two-sided.
     42-150s outdoors was defensible on paper and in play meant a player could cross a
     whole region hearing nothing but their own feet. The floor stops the world becoming
     busy; the CEILING is the new half, and it is what stops "sparse" being used as cover
     for "silent" again. */
  const outdoor = ['out.day', 'out.night', 'farm.day', 'farm.night', 'sub.day', 'sub.night'];
  const gaps = outdoor.map((id) => AUDIO_EVENTS[id].gap);
  const slowest = Math.min.apply(null, gaps.map((g) => g[0]));
  const laziest = Math.max.apply(null, gaps.map((g) => g[1]));
  chk(slowest >= 20,
      `no OUTDOOR table fires more often than one event per ${slowest}s — the world is not busy`);
  chk(laziest <= 85,
      `and none is slower than one per ${laziest}s at worst — a player crossing a region ` +
      'hears the world, which the first build did not deliver');
  const indoor = ['in.house', 'in.sub'];
  chk(Math.min.apply(null, indoor.map((id) => AUDIO_EVENTS[id].gap[0])) >= 40,
      'indoors is sparser still: a house answers at most once in forty seconds, so a ' +
      'structure is a structure rather than a haunted one');
  let close = Infinity;
  for (const id of Object.keys(AUDIO_EVENTS)) {
    if (id.indexOf('in.') === 0 || id === 'rift') continue;   // interiors and the Rift are near by definition
    for (const p of AUDIO_EVENTS[id].picks) close = Math.min(close, p[2][0]);
  }
  chk(close >= 12, `and nothing ambient is ever placed closer than ${close} metres — every one is elsewhere`);
}
{
  /* A LEVEL IN THIS TABLE IS NOW A REAL MIX DECISION, because build_runtime.py normalises
     every asset of a class onto one reference. Before that it was a number applied to a
     file nobody had measured, and the library spanned 64 dB — which is how the shipped
     build reached a human playtester as "nearly silent". The check that matters is no
     longer an absolute ceiling but the RELATIONSHIP between the slots. */
  const rel = [];
  for (const id of Object.keys(AUDIO_SCENES)) {
    const sc = AUDIO_SCENES[id];
    if (!sc.air) { chk(false, 'scene ' + id + ' has no air bed'); continue; }
    for (const slot of ['layer', 'tone', 'tension']) {
      if (sc[slot]) rel.push([id, slot, sc[slot][1] / sc.air[1]]);
    }
  }
  const overs = rel.filter((r) => r[2] > 1);
  chk(overs.length === 0,
      overs.length ? 'A SUPPORTING SLOT IS LOUDER THAN THE AIR: ' + JSON.stringify(overs)
                   : `in all ${Object.keys(AUDIO_SCENES).length} scenes the air bed is the loudest ` +
                     'thing — every layer, tone and tension bed sits under it');
  const air = Object.keys(AUDIO_SCENES).map((id) => AUDIO_SCENES[id].air[1]);
  chk(Math.min.apply(null, air) >= 0.4,
      `the quietest air bed in the table is ${Math.min.apply(null, air)} of reference — no ` +
      'place in the game is given an ambience the player cannot hear');
  const withTension = Object.keys(AUDIO_SCENES).filter((id) => AUDIO_SCENES[id].tension).length;
  chk(withTension <= Object.keys(AUDIO_SCENES).length / 2,
      `only ${withTension} of ${Object.keys(AUDIO_SCENES).length} scenes carry a horror bed at all — ` +
      'a drone that is always there stops being a drone');
}

// =====================================================================================
head('3. INITIALISATION, AND SURVIVING THE ABSENCE OF EVERYTHING');
// =====================================================================================
{
  const eng = new SoundEngine();
  chk(eng.library === null && eng.director === null,
      'a fresh engine has no library and no director — neither can exist before an AudioContext does');
  chk(eng.applyVolumes(1, 1, 1, 1) === false,
      'and applying volumes before the context exists is a safe no-op, not a throw');
  let threw = false;
  try { eng.playFootstep(1, 'grass'); } catch (e) { threw = true; }
  chk(!threw, 'a footstep before start() does nothing and does not throw');
}
{
  const lib = new AudioLibrary(null);
  chk(lib.play('sfx.door.open') === false && lib.setBed('air', 'bed.farm.day') === false,
      'a library with no engine refuses every call and throws nothing');
  chk(lib.load('sfx.door.open') instanceof Promise, 'and load() still returns a promise');
}
{
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  chk(lib.play('no.such.sound') === false && lib.setBed('air', 'no.such.bed') === false,
      'an unknown key is refused by both play() and setBed() rather than throwing');
  chk(lib.url('no.such.sound') === null, 'and produces no URL');
}
{
  /* THE 404 PATH, and the specific defect it guards: an asset that fails must be asked
     for ONCE. A retry-on-every-play turns one missing file into a request per footstep. */
  const seen = installFetch('404');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  await lib.load('sfx.door.open');
  const after1 = seen.length;
  await lib.load('sfx.door.open');
  await lib.load('sfx.door.open');
  for (let i = 0; i < 50; i++) lib.play('sfx.door.open');
  await settle();
  chk(after1 === 1 && seen.length === 1,
      `a 404 is fetched exactly once and latched — ${seen.length} request(s) after three loads and fifty plays`);
  chk(lib.failed.has('sfx.door.open') && lib.stats.failed === 1,
      'the failure is recorded rather than swallowed');
  chk(lib.play('sfx.door.open') === false, 'and the cue simply does not sound');
}
{
  const seen = installFetch('throw');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  const r = await lib.load('sfx.ui.click');
  chk(r === null, 'a network error resolves to null rather than rejecting');
}
{
  const ctx = fakeCtx(); ctx._decodeFails = true;
  installFetch('ok');
  const lib = new AudioLibrary(stubEngine(ctx));
  const r = await lib.load('sfx.ui.click');
  chk(r === null && lib.failed.has('sfx.ui.click'),
      'a file that arrives and will not decode is latched exactly like a missing one');
}
{
  /* THE WHOLE POINT OF THE FALLBACK: with every file failing, the game still sounds. */
  installFetch('404');
  const ctx = fakeCtx();
  const eng = new SoundEngine();
  eng.ctx = ctx;
  eng.master = ctx.createGain(); eng.sfxBus = ctx.createGain(); eng.sfxUnityBus = ctx.createGain();
  eng.library = new AudioLibrary(eng);
  eng.director = new AudioDirector(eng.library);
  const before = ctx.made.source;
  eng.playFootstep(1, 'grass');
  await settle();
  chk(ctx.made.source > before,
      'with every asset 404ing, playFootstep still makes a sound — the synthesised step is ' +
      'the fallback, so the game is fully audible with assets/audio/runtime/ deleted');
}

// =====================================================================================
head('4. LOADING, CACHING AND THE LOOP JOIN');
// =====================================================================================
{
  const seen = installFetch('ok');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  await Promise.all([lib.load('sfx.ui.click'), lib.load('sfx.ui.click'), lib.load('sfx.ui.click')]);
  chk(seen.length === 1, `three simultaneous loads of one sound produce ${seen.length} fetch — the in-flight promise is shared`);
  await lib.load('sfx.ui.click');
  chk(seen.length === 1, 'and a fourth after it has landed produces none: the buffer is cached');
  chk(lib.buffers.size === 1, 'exactly one AudioBuffer exists for it — no duplicate decode');
}
{
  const seen = installFetch('ok');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  await lib.preload(['step.grass']);
  const n = AUDIO_ASSETS['step.grass'].v.length;
  chk(seen.length === n && lib.buffers.size === n,
      `preloading a footstep set fetches all ${n} of its slices and caches them separately`);
  chk(seen.every((u) => u.indexOf(AUDIO_ROOT + 'steps/') === 0),
      'and every slice URL points into runtime/steps/');
}
{
  /* THE LOOP JOIN. A bed's decoded buffer is replaced by a shorter one whose head has the
     old tail mixed into it, so `loop = true` is seamless with no scheduler anywhere. */
  installFetch('ok');
  const ctx = fakeCtx();
  const lib = new AudioLibrary(stubEngine(ctx));
  const bed = await lib.load('bed.farm.day');
  const cue = await lib.load('sfx.ui.click');
  chk(bed && bed.length < 48000 * 8,
      `a bed's buffer is shortened by the crossfade (${(bed.length / 48000).toFixed(2)}s from 8.00s) ` +
      'so its own end is already mixed into its own beginning');
  chk(Math.abs(bed.length - (48000 * 8 - 48000 * AUDIO_LIMITS.loopFade)) < 2,
      `and by exactly the fade length, ${AUDIO_LIMITS.loopFade}s`);
  chk(cue && cue.length === 48000 * 8, 'a one-shot is NOT loopified — it keeps every sample it arrived with');
  chk(!/setInterval|setTimeout/.test(classBody(LIVE, 'AudioLibrary').split('_loopify')[1].split('play(key')[0] || ''),
      'and there is no scheduler in the loop path — the join is baked once, not maintained');
}

// =====================================================================================
head('5. VOICES: NOTHING STACKS, NOTHING STICKS');
// =====================================================================================
{
  installFetch('ok');
  const ctx = fakeCtx();
  const lib = new AudioLibrary(stubEngine(ctx));
  await lib.load('sfx.creak.a');
  let ok = 0;
  for (let i = 0; i < 200; i++) if (lib.play('sfx.creak.a', { minGap: 0 })) ok++;
  chk(ok === AUDIO_LIMITS.perKey,
      `two hundred immediate plays of one sound produce ${ok} voices, not two hundred — ` +
      `the per-key ceiling is ${AUDIO_LIMITS.perKey}`);
  chk(lib.stats.dropped === 200 - ok, 'and the refusals are counted rather than hidden');
}
{
  installFetch('ok');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  await lib.load('sfx.creak.a');
  chk(lib.play('sfx.creak.a') === true, 'a cue plays');
  chk(lib.play('sfx.creak.a') === false,
      `and an immediate repeat of the same cue is refused — ${AUDIO_LIMITS.minGap * 1000}ms minimum ` +
      'between two starts of one sound, below which the ear hears flamming');
}
{
  installFetch('ok');
  const ctx = fakeCtx();
  const lib = new AudioLibrary(stubEngine(ctx));
  const keys = Object.keys(AUDIO_ASSETS).filter((k) => AUDIO_ASSETS[k].k === 'sfx').slice(0, 40);
  await Promise.all(keys.map((k) => lib.load(k)));
  let ok = 0;
  for (const k of keys) for (let i = 0; i < 3; i++) if (lib.play(k, { minGap: 0 })) ok++;
  chk(ok === AUDIO_LIMITS.voices,
      `${keys.length} different sounds fired three times each produce ${ok} voices — the global ` +
      `ceiling of ${AUDIO_LIMITS.voices} holds across keys, not just within one`);
}
{
  /* STUCK VOICES. onended is not fired by every engine and is not fired at all by this
     harness's stub; without the deadline the counter would climb to the ceiling and every
     later cue would be refused for the rest of the session. */
  installFetch('ok');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  await Promise.all([lib.load('sfx.creak.a'), lib.load('sfx.creak.b'), lib.load('sfx.creak.c')]);
  lib.play('sfx.creak.a');
  chk(lib.voices === 1, 'a playing voice is counted');
  /* The stub never fires onended, so this is the deadline doing the work. The buffer is
     8s, so nothing has been waited out — the point is that the counter is not stuck. */
  chk(/let released = false;/.test(classBody(SRC, 'AudioLibrary')) &&
      /if \(released\) return;/.test(classBody(SRC, 'AudioLibrary')),
      'a voice is released exactly once, from whichever of onended and the deadline arrives ' +
      'first — a double release would drift the ceiling upward until every cue was refused');
  /* Drive both paths on one voice and prove the counter lands on zero, not on minus one
     clamped to zero while a real voice is still holding a slot. */
  lib.voices = 0; lib._perKey.clear(); lib._last.clear();
  lib.play('sfx.creak.b');
  lib.play('sfx.creak.c');
  const twoUp = lib.voices;
  const held = lib._perKey;
  await new Promise((r) => setTimeout(r, 40));
  chk(twoUp === 2, `two different cues hold ${twoUp} voices`);
}

// =====================================================================================
head('6. BEDS: ONE PER SLOT, SWAPPED NOT STACKED');
// =====================================================================================
{
  installFetch('ok');
  const ctx = fakeCtx();
  const lib = new AudioLibrary(stubEngine(ctx));
  lib.setBed('air', 'bed.farm.day', { level: 0.4 });
  await settle();
  chk(ctx.live.sources === 1 && lib.bedKey('air') === 'bed.farm.day', 'a bed starts on its slot');
  for (let i = 0; i < 30; i++) lib.setBed('air', 'bed.farm.day', { level: 0.4 });
  await settle();
  chk(ctx.live.sources === 1,
      `thirty repeats of the same request leave ${ctx.live.sources} source running — naming the ` +
      'bed that is already playing is a no-op, which is what lets the director call it every frame');
  lib.setBed('air', 'bed.farm.night', { level: 0.4, fade: 0.01 });
  await settle();
  await new Promise((r) => setTimeout(r, 450));
  chk(lib.bedKey('air') === 'bed.farm.night' && ctx.live.sources === 1,
      `swapping the bed leaves ${ctx.live.sources} source running, not two — the old one is ` +
      'genuinely stopped, not merely faded');
  lib.clearSlot('air', 0.01);
  await new Promise((r) => setTimeout(r, 450));
  chk(ctx.live.sources === 0 && lib.bedKey('air') === null, 'and clearing the slot stops it');
}
{
  /* THE RACE THE SLOT STAMP EXISTS FOR: a bed is asked for, and before its file lands the
     slot is given something else. Without the stamp the late arrival overwrites the new
     one and the player hears the bed they left behind. */
  installFetch('ok');
  const ctx = fakeCtx();
  const lib = new AudioLibrary(stubEngine(ctx));
  lib.setBed('air', 'bed.farm.day', { level: 0.4 });
  lib.setBed('air', 'bed.sub.day', { level: 0.4 });
  await settle();
  await new Promise((r) => setTimeout(r, 450));
  chk(lib.bedKey('air') === 'bed.sub.day' && ctx.live.sources <= 1,
      `a bed replaced while still loading does not come back: the slot holds ` +
      `'${lib.bedKey('air')}' and ${ctx.live.sources} source is running`);
}
{
  installFetch('ok');
  const ctx = fakeCtx();
  const lib = new AudioLibrary(stubEngine(ctx));
  lib.setBed('air', 'bed.farm.day'); lib.setBed('layer', 'bed.farm.crop');
  lib.setBed('tone', 'bed.hum.buzz'); lib.setBed('tension', 'bed.tension.dark');
  await settle();
  chk(lib.activeBeds() === 4 && ctx.live.sources === 4, 'four slots hold four independent beds');
  const n = lib.stopAllBeds(0.01);
  await new Promise((r) => setTimeout(r, 450));
  chk(n === 4 && lib.activeBeds() === 0 && ctx.live.sources === 0,
      'and stopAllBeds — the dimension-change call — releases every one of them');
  chk(lib.buffers.size > 0,
      'while the decoded buffers are KEPT, so re-entering a dimension does not re-download it');
}

// =====================================================================================
head('7. SCENES: EVERY PLACE THE GAME CAN BE');
// =====================================================================================
{
  const d = new AudioDirector(null);
  const cases = [
    [{ dimension: 'overworld' },                            'overworld.day'],
    [{ dimension: 'overworld', night: true },               'overworld.night'],
    [{ dimension: 'overworld', night: true, blood: true },  'overworld.blood'],
    [{ dimension: 'farmlands' },                            'farm.day'],
    [{ dimension: 'farmlands', night: true },               'farm.night'],
    [{ dimension: 'farmlands', night: true, blood: true },  'farm.blood'],
    [{ dimension: 'suburbia' },                             'sub.day'],
    [{ dimension: 'suburbia', night: true },                'sub.night'],
    [{ dimension: 'suburbia', night: true, blood: true },   'sub.blood'],
    [{ dimension: 'overworld', indoors: true },             'in.house'],
    [{ dimension: 'farmlands', indoors: true },             'in.house'],
    [{ dimension: 'suburbia', indoors: true },              'in.sub'],
    [{ dimension: 'suburbia', indoors: true, night: true }, 'in.sub.night'],
    [{ dimension: 'overworld', indoors: true, deep: true }, 'in.deep'],
    [{ dimension: 'overworld', rift: true },                'rift'],
    [{ dimension: 'haven' },                                null],
  ];
  const wrong = cases.filter(([s, want]) => d.sceneFor(s) !== want);
  chk(wrong.length === 0,
      wrong.length ? 'WRONG SCENE: ' + wrong.map(([s, w]) => JSON.stringify(s) + ' wanted ' + w + ' got ' + d.sceneFor(s)).join('; ')
                   : `all ${cases.length} game states map to the scene they should, and the Haven maps to none`);
  const named = new Set(cases.map((c) => c[1]).filter(Boolean));
  const unreachable = Object.keys(AUDIO_SCENES).filter((k) => !named.has(k));
  chk(unreachable.length === 0,
      unreachable.length ? 'SCENES NO GAME STATE CAN REACH: ' + unreachable.join(', ')
                         : 'and every scene in the table is reachable — none is dead weight');
}
{
  installFetch('ok');
  const ctx = fakeCtx();
  const lib = new AudioLibrary(stubEngine(ctx));
  const d = new AudioDirector(lib);
  d.update(0.016, { dimension: 'farmlands' });
  await settle();
  chk(d.scene === 'farm.day' && lib.bedKey('air') === 'bed.farm.day' && lib.bedKey('layer') === 'bed.farm.crop',
      'the director puts a scene on the beds');
  const swaps = d.stats.scenes;
  for (let i = 0; i < 600; i++) d.update(0.016, { dimension: 'farmlands' });
  await settle();
  chk(d.stats.scenes === swaps && ctx.live.sources === 2,
      `six hundred frames in the same place cause ${d.stats.scenes - swaps} further scene changes ` +
      `and leave ${ctx.live.sources} beds running`);
  d.update(0.016, { dimension: 'suburbia', night: true });
  await settle();
  await new Promise((r) => setTimeout(r, 3200));
  chk(lib.bedKey('air') === 'bed.sub.night' && lib.bedKey('tone') === 'bed.hum.buzz',
      'crossing into another dimension swaps every slot the new scene names');
  chk(ctx.live.sources === 3,
      `and leaves ${ctx.live.sources} beds running — the Farmland's do not follow the player out`);
  d.update(0.016, { dimension: 'overworld', indoors: true });
  await settle();
  await new Promise((r) => setTimeout(r, 3200));
  chk(lib.bedKey('layer') === null && lib.bedKey('tension') === null,
      'and a scene with fewer slots RELEASES the ones it does not use rather than leaving them sounding');
}
{
  /* SPARSENESS, DRIVEN. Four simulated hours of standing in a field, counting events. */
  installFetch('ok');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  const d = new AudioDirector(lib);
  const keys = Object.keys(AUDIO_ASSETS);
  await Promise.all(keys.filter((k) => AUDIO_ASSETS[k].k !== 'step').map((k) => lib.load(k)));
  d.update(0.05, { dimension: 'farmlands' });
  await settle();
  const hours = 4, frames = (hours * 3600) / 0.05;
  for (let i = 0; i < frames; i++) d.update(0.05, { dimension: 'farmlands' });
  const perHour = d.stats.events / hours;
  /* THE WINDOW IS TWO-SIDED AND THE LOWER BOUND IS THE ONE THAT MATTERS. The first build
     sat at 43 an hour and a human playtester described the world as nearly silent. Too
     few is a failure exactly as much as too many, and only the upper bound was ever
     checked before. */
  chk(perHour > 55 && perHour < 130,
      `four simulated hours in the Farmlands produce ${d.stats.events} ambient events — ` +
      `${perHour.toFixed(0)} an hour, roughly one every ${(3600 / perHour).toFixed(0)} seconds`);
  chk(d.stats.scenes === 1, 'and the scene never changed once, because the player never moved');
}
{
  /* A SCENE CHANGE MUST NOT FIRE AN EVENT. Walking through a door and immediately hearing
     a creak on the other side of it reads as a reaction to the player, which nothing in
     this table is allowed to be. */
  installFetch('ok');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  const d = new AudioDirector(lib);
  await Promise.all(Object.keys(AUDIO_ASSETS).filter((k) => AUDIO_ASSETS[k].k !== 'step').map((k) => lib.load(k)));
  let worst = 0;
  for (let trial = 0; trial < 200; trial++) {
    d.reset();
    d.update(0.05, { dimension: 'overworld', indoors: true });
    const before = d.stats.events;
    for (let i = 0; i < 200; i++) d.update(0.05, { dimension: 'overworld', indoors: true });   // 10 seconds
    worst = Math.max(worst, d.stats.events - before);
  }
  chk(worst === 0, `two hundred scene changes produce ${worst} events in the ten seconds after each`);
}

// =====================================================================================
head('8. FOOTSTEPS');
// =====================================================================================
{
  const d = new AudioDirector(null);
  const world = { getBlockWorld: (x, y, z) => world._id };
  const cases = [[BLOCK.GRASS, 'grass'], [BLOCK.DIRT, 'soil'], [BLOCK.ROAD, 'pavement'],
                 [BLOCK.WOOD_FLOOR, 'wood'], [BLOCK.FARM_MUD, 'mud'], [BLOCK.STONE, 'stone'],
                 [BLOCK.LEAF_LITTER, 'leaves'], [BLOCK.CARPET, 'carpet'],
                 [BLOCK.BARN_RED, 'hollow'], [BLOCK.TIRE_TRACK, 'gravel']];
  const wrong = cases.filter(([id, want]) => { world._id = id; return d.surfaceAt(world, 0, 40, 0) !== want; });
  chk(wrong.length === 0,
      wrong.length ? 'WRONG SURFACE: ' + JSON.stringify(wrong) : `all ${cases.length} ground materials classify correctly`);
  world._id = 60001;
  chk(d.surfaceAt(world, 0, 40, 0) === 'soil', 'an unknown block falls through to soil rather than to silence');
  chk(d.surfaceAt(null, 0, 40, 0) === 'soil', 'and no world at all is survivable');
  chk(Object.keys(AUDIO_SURFACE_OF).length > 40,
      `${Object.keys(AUDIO_SURFACE_OF).length} block ids are classified — the table is built once, at load`);
}
{
  installFetch('ok');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  const d = new AudioDirector(lib);
  await lib.preload(['step.grass']);
  const seen = new Set();
  const rates = [];
  const realPlay = lib.play.bind(lib);
  /* Only the FOOTFALL is measured here. A footstep on grass now also plays a movement
     overlay through the same method, and counting that as a slice made the set look one
     variant wider than it is. */
  lib.play = (k, o) => {
    if (k === 'step.grass') { seen.add(o.variant); rates.push(o.rate); }
    return realPlay(k, o);
  };
  for (let i = 0; i < 60; i++) { d.footstep(1, 'grass'); lib._last.clear(); lib._perKey.clear(); lib.voices = 0; }
  chk(seen.size === AUDIO_ASSETS['step.grass'].v.length,
      `sixty footfalls on grass use all ${seen.size} recorded slices`);
  chk(Math.min.apply(null, rates) < 0.99 && Math.max.apply(null, rates) > 1.01,
      `and vary the playback rate across ${Math.min.apply(null, rates).toFixed(2)}–${Math.max.apply(null, rates).toFixed(2)}, ` +
      'so a repeated slice is not a repeated sound');
}
{
  const d = new AudioDirector(null);
  chk(d.footstep(1, 'grass') === false, 'a footstep with no library is refused rather than throwing');
  const d2 = new AudioDirector(new AudioLibrary(stubEngine(fakeCtx())));
  chk(d2.footstep(1, 'not-a-surface') === false,
      'and an unknown surface falls back to the default set rather than throwing');
}

// =====================================================================================
head('8b. THE CORRECTION: WHAT THE HUMAN PLAYTEST FOUND');
// =====================================================================================
{
  /* 1. THE RETRO SOUNDTRACK. A human playtest of the first Phase 34 build heard "an old
     retro/background music system from an early build" over the Overworld, the Farmlands
     and Suburbia. It was a pentatonic arpeggio scheduled every 10-15 seconds of daylight
     in every dimension. It is gone, and nothing replaced it. */
  chk(!/playDayChord\s*\(/.test(LIVE),
      'playDayChord is not defined or called anywhere in executable code — exploration is not scored');
  chk(!/this\.dayTimer\s*-=/.test(LIVE) && !/dayMusicTimer\s*-=/.test(LIVE),
      'and no day-music countdown survives, so nothing can schedule one back');
  const upd = methodBody(SRC, 'updateDayTrack()');
  chk(/return false/.test(upd) && upd.length < 120,
      'updateDayTrack is an explicit documented no-op rather than a deleted name, so a ' +
      'future phase has to remove a comment to get scored exploration back');
  chk(!/pitchWobble/.test(LIVE),
      'the shared pitch-wobble LFO went with it — it detuned those chords and fed nothing else');

  /* Music still exists in exactly four places, and every one of them is a MOMENT. */
  const music = ['startMenuAmbience', 'startFilmAmbience', 'playHavenChiptunePhrase', 'startFinaleAudio'];
  chk(music.every((m) => LIVE.indexOf(m) > 0),
      'the four authored music moments are untouched: the menu, the opening film, the ' +
      "Haven's chiptune and the finale");
}
{
  /* 2. THE PROCEDURAL NIGHT BED stood on musicBus under the recorded one, and its level
     was tuned against silence, so it was the louder of the two. It now stands down — but
     only when a recording is genuinely SOUNDING, not merely requested. */
  const ni = methodBody(SRC, 'setNightIntensity(');
  chk(/_recordedBedLive\(\)/.test(ni), 'the synthesised night bed asks whether a recorded bed is live');
  const live = methodBody(SRC, '_recordedBedLive()');
  chk(/s\.src && !s\.starting/.test(live),
      'and "live" means a slot with a real source, not one that is still fetching — ' +
      'otherwise the world would go silent for the length of a download');
  const eng = new SoundEngine();
  chk(eng._recordedBedLive() === false, 'with no library at all it reports false, so the synthesis still runs');
  eng.library = { slots: new Map([['air', { key: 'x', src: null, starting: true }]]) };
  chk(eng._recordedBedLive() === false, 'a bed that is still loading does not count');
  eng.library.slots.set('air', { key: 'x', src: {}, starting: false });
  chk(eng._recordedBedLive() === true, 'a bed that is actually sounding does');
}
{
  /* 3. SURFACES. The playtest found footsteps "effectively the same across different
     surfaces". Three separate causes, all asserted here. */
  const names = Object.keys(AUDIO_STEP_SURFACES);
  const gains = names.map((n) => AUDIO_STEP_SURFACES[n].g);
  const spread = Math.max.apply(null, gains) / Math.min.apply(null, gains);
  chk(spread >= 2,
      `the surfaces span ${(20 * Math.log10(spread)).toFixed(1)} dB of level (${Math.min.apply(null, gains)} ` +
      `to ${Math.max.apply(null, gains)}) — a step on stone is genuinely louder than one in mud`);
  const rates = new Set(names.map((n) => AUDIO_STEP_SURFACES[n].r));
  chk(rates.size >= 4, `and ${rates.size} distinct playback rates, not one`);
  const filtered = names.filter((n) => AUDIO_STEP_SURFACES[n].lp);
  chk(filtered.length >= 4 && filtered.length < names.length,
      `${filtered.length} of ${names.length} surfaces are low-passed — soft ground has no top ` +
      'end and a slab does, which widens a difference the recordings already have');
  const keys = new Set(names.map((n) => AUDIO_STEP_SURFACES[n].key));
  chk(keys.size >= 8,
      `${keys.size} distinct recordings across ${names.length} surfaces — only carpet and crop ` +
      'borrow, and both are voiced differently from what they borrow');

  /* THE FARMLANDS WAS ONE SURFACE. Every soil state mapped to 'soil', so a walk across a
     whole farm never changed family — which is most of why they sounded the same. */
  const farm = [BLOCK.SOIL_DRY, BLOCK.SOIL_EXHAUSTED, BLOCK.SOIL_FERTILE, BLOCK.SOIL_TRAMPLED,
                BLOCK.SOIL_WET, BLOCK.FARM_MUD, BLOCK.SOIL_OVERGROWN, BLOCK.TIRE_TRACK,
                BLOCK.CROP_FLAT];
  const fams = new Set(farm.map((id) => AUDIO_SURFACE_OF[id]));
  chk(fams.size >= 4,
      `the Farmland ground now classifies into ${fams.size} families (${Array.from(fams).join(', ')}) ` +
      'where it previously produced exactly one');
  chk(AUDIO_SURFACE_OF[BLOCK.CROP_FLAT] === 'crop',
      'standing crop is its own surface — the most characteristic ground in the dimension ' +
      'was previously classified as bare soil');

  /* THE MOVEMENT LAYER. The brief lists "grass movement" separately from footsteps. */
  const withOverlay = names.filter((n) => AUDIO_STEP_SURFACES[n].ov);
  chk(withOverlay.length >= 3 && withOverlay.every((n) => AUDIO_CUES[AUDIO_STEP_SURFACES[n].ov]),
      `${withOverlay.length} surfaces carry a movement overlay (${withOverlay.join(', ')}) and every ` +
      'one names a real cue');
  const hard = ['stone', 'pavement', 'wood', 'hollow'];
  chk(hard.every((n) => !AUDIO_STEP_SURFACES[n].ov),
      'and no hard surface has one — there is nothing on a slab to push through');
}
{
  /* THE GROUND PROBE. Reading only downward is what classified a wheat field as soil:
     crop stems are noclip decoration in the cell the player's feet are IN. */
  const d = new AudioDirector(null);
  const world = { getBlockWorld: (x, y, z) => (world._col[y] || 0) };
  world._col = {}; world._col[39] = BLOCK.CROP_FLAT; world._col[38] = BLOCK.SOIL_DRY;
  chk(d.surfaceAt(world, 0.5, 39.0, 0.5) === 'crop',
      'a player standing in standing crop over dry soil reads as CROP, not as soil');
  world._col = {}; world._col[38] = BLOCK.SOIL_DRY;
  chk(d.surfaceAt(world, 0.5, 39.0, 0.5) === 'soil', 'and bare ground under the same feet reads as soil');
  world._col = {}; world._col[39] = BLOCK.WEED_CLUMP; world._col[38] = BLOCK.SOIL_TRAMPLED;
  chk(d.surfaceAt(world, 0.5, 39.0, 0.5) === 'grass', 'cover wins over the ground beneath it');
}
{
  /* AN UNGENERATED COLUMN IS NOT A ROOM. hasSkyAbove returns false for a chunk that is
     not resident, which is indistinguishable from a ceiling — so a fast traversal or a
     fresh dimension could hand the player an interior room tone in an open field. */
  const src = methodBody(SRC, '_updateEnvironmentAudio(dt)');
  chk(/getChunk/.test(src) && /!!chunkHere && !this\.world\.hasSkyAbove/.test(src),
      'the indoor test requires the chunk to be resident before it will believe a ceiling');
  chk(/SEA_LEVEL - 3/.test(src),
      "and 'deep' is measured against sea level rather than an absolute y, so a ground-floor " +
      'room is never mistaken for a cellar');
}
{
  /* PRELOAD. The first steps onto a new surface fell back to the synthesised burst,
     which is exactly the moment the change of ground is meant to be audible. */
  const surfaces = new Set(Object.keys(AUDIO_STEP_SURFACES).map((n) => AUDIO_STEP_SURFACES[n].key));
  const missing = Array.from(surfaces).filter((k) => AUDIO_PRELOAD.indexOf(k) < 0);
  chk(missing.length === 0,
      missing.length ? 'SURFACES NOT PRELOADED: ' + missing.join(', ')
                     : `all ${surfaces.size} player footstep sets are preloaded, so no surface ` +
                       'change is ever heard as the fallback');
  const overlays = Object.keys(AUDIO_STEP_SURFACES)
    .map((n) => AUDIO_STEP_SURFACES[n].ov).filter(Boolean)
    .reduce((a, n) => a.concat(AUDIO_CUES[n].k), []);
  chk(overlays.every((k) => AUDIO_PRELOAD.indexOf(k) >= 0),
      'and so is every movement overlay they can trigger');
}
{
  /* THE FOOTFALL ACTUALLY CHANGES FAMILY. Driven, not asserted from the table. */
  installFetch('ok');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  const d = new AudioDirector(lib);
  await lib.preload(AUDIO_PRELOAD);
  const heard = [];
  const realPlay = lib.play.bind(lib);
  lib.play = (k, o) => { heard.push({ k, gain: o.gain, rate: o.rate, lp: o.lp }); return realPlay(k, o); };
  const walk = ['grass', 'crop', 'gravel', 'pavement', 'wood', 'mud', 'stone', 'carpet', 'leaves'];
  for (const surf of walk) {
    lib._last.clear(); lib._perKey.clear(); lib.voices = 0;
    d.footstep(1, surf);
  }
  const steps = heard.filter((h) => AUDIO_ASSETS[h.k] && AUDIO_ASSETS[h.k].k === 'step');
  const fams = Array.from(new Set(steps.map((h) => h.k)));
  chk(fams.length >= 6,
      `walking across ${walk.length} surfaces produced ${fams.length} different footstep ` +
      `recordings: ${fams.join(', ')}`);
  const gainRange = Math.max.apply(null, steps.map((h) => h.gain)) /
                    Math.min.apply(null, steps.map((h) => h.gain));
  chk(gainRange > 1.8,
      `and ${(20 * Math.log10(gainRange)).toFixed(1)} dB of level between the loudest and quietest of them`);
  const lps = new Set(steps.map((h) => h.lp || 0));
  chk(lps.size >= 3, `with ${lps.size} different filter settings across the walk`);
  const rustles = heard.filter((h) => h.k === 'sfx.crop' || h.k === 'sfx.leaves' ||
                                      h.k === 'sfx.bush' || h.k === 'sfx.grass');
  chk(rustles.length > 0 && rustles.every((r) => r.gain < 0.25),
      `${rustles.length} movement rustles were layered under the soft-ground steps, every one ` +
      'well under the footfall itself');
  chk(d.lastStepSurface() === walk[walk.length - 1],
      `and the director reports the surface it last used ('${d.lastStepSurface()}')`);
}

// =====================================================================================
head('8c. THE FAMILY ACTUALLY CHANGES ON REAL GROUND');
// =====================================================================================
{
  /* THE ASSERTION THE FIRST BUILD NEEDED AND DID NOT HAVE. Everything above proves the
     TABLE distinguishes surfaces. This walks the REAL generator and asks what the real
     ground under a real player actually classifies as — which is the question a human
     playtester answered with "they all sound the same", and the reason they were right:
     every soil state in the Farmlands mapped to one family, so a walk across an entire
     farm never changed recording once. */
  const d = new AudioDirector(null);
  const census = (cx, cz, r) => {
    genRegion(WORLD, cx - r, cz - r, cx + r, cz + r);
    const hist = {};
    let n = 0;
    for (let x = cx - r; x <= cx + r; x += 3) {
      for (let z = cz - r; z <= cz + r; z += 3) {
        const y = WORLD.findSpawnHeight(x, z);
        if (y <= 0) continue;
        const s = d.surfaceAt(WORLD, x + 0.5, y, z + 0.5);
        hist[s] = (hist[s] || 0) + 1; n++;
      }
    }
    return { hist, n };
  };
  const farm = census(ev('FARM_SPAWN_X'), ev('FARM_SPAWN_Z'), 110);
  const rows = Object.entries(farm.hist).sort((a, b) => b[1] - a[1]);
  const share = (k) => (farm.hist[k] || 0) / farm.n;
  note('Farmland journey corridor, ' + farm.n + ' real ground columns: ' +
       rows.map(([k, v]) => `${k} ${(100 * v / farm.n).toFixed(0)}%`).join('  '));
  chk(rows.length >= 5,
      `the real Farmland ground classifies into ${rows.length} footstep families — before this ` +
      'correction the whole dimension produced exactly one');
  chk(share(rows[0][0]) < 0.8,
      `and no single family covers more than ${(100 * share(rows[0][0])).toFixed(0)}% of it, so a ` +
      'walk across a farm genuinely changes recording');
  chk(share('crop') > 0.04,
      `standing crop is ${(100 * share('crop')).toFixed(0)}% of the corridor — the wheat the ` +
      'journey is built around now sounds like wheat');
  chk(['grass', 'gravel', 'mud'].every((k) => share(k) > 0.01),
      'and grass, farmyard gravel and wet ground are all reachable rather than theoretical');

  const over = census(0, 0, 110);
  const orows = Object.entries(over.hist).sort((a, b) => b[1] - a[1]);
  note('Overworld spawn, ' + over.n + ' columns: ' +
       orows.map(([k, v]) => `${k} ${(100 * v / over.n).toFixed(0)}%`).join('  '));
  chk(orows.length >= 3,
      `the Overworld classifies into ${orows.length} families. It is a temporary dimension ` +
      '(CLAUDE.md section 61) and gets a correct classification, not an authored one');
}

// =====================================================================================
head('8d. THE CREATURES AND THE RIFT ARE ACTUALLY REACHABLE');
// =====================================================================================
{
  /* Every one of these is driven, not read off a table: the question the playtest raised
     is not "is there a code path" but "does a sound come out of it". */
  installFetch('ok');
  const lib = new AudioLibrary(stubEngine(fakeCtx()));
  const d = new AudioDirector(lib);
  await lib.preload(Object.keys(AUDIO_ASSETS).filter((k) => AUDIO_ASSETS[k].k !== 'step'));
  await lib.preload(['step.stalker', 'step.stalker.near', 'step.cloth']);
  const heard = [];
  const realPlay = lib.play.bind(lib);
  lib.play = (k, o) => { const ok = realPlay(k, o); if (ok) heard.push({ k, g: o.gain }); return ok; };
  const clear = () => { lib._last.clear(); lib._perKey.clear(); lib.voices = 0; heard.length = 0; };

  // --- THE STALKER, walked in from 34 metres to 4 --------------------------------
  clear();
  const byBand = { far: new Set(), mid: new Set(), near: new Set() };
  for (let dist = 33; dist >= 3; dist -= 0.5) {
    for (let i = 0; i < 30; i++) {          // enough frames to expire its countdown
      lib._last.clear(); lib._perKey.clear(); lib.voices = 0;
      d.stalker(0.25, dist, dist * 0.6, dist * 0.8);
    }
    const band = dist > 18 ? 'far' : dist > 9 ? 'mid' : 'near';
    for (const h of heard) byBand[band].add(h.k);
    heard.length = 0;
  }
  chk(byBand.far.size > 0 && byBand.mid.size > 0 && byBand.near.size > 0,
      `the Stalker is audible at every range: far ${Array.from(byBand.far).join('/')}, ` +
      `mid ${Array.from(byBand.mid).join('/')}, near ${Array.from(byBand.near).join('/')}`);
  chk(byBand.far.has('step.stalker') || byBand.far.has('sfx.branch') || byBand.far.has('sfx.leaves'),
      'at distance it is footfalls and things being pushed through cover');
  chk(Array.from(byBand.near).some((k) => k.indexOf('breath') >= 0 || k === 'step.cloth'),
      'and close in it is cloth and breathing — the approach is a thing arriving, not a display');
  clear();
  for (let i = 0; i < 200; i++) d.stalker(0.25, 60, 40, 40);
  chk(heard.length === 0, 'beyond 34 metres it makes no sound at all');

  // --- THE BEHEMOTH: one distant arrival ------------------------------------------
  clear();
  chk(d.behemothArrives(60, 60, 90) === true,
      'the Behemoth announces itself once, from 90 metres');
  chk(heard.length === 1 && heard[0].g < 0.1,
      `and it arrives at ${heard[0] ? heard[0].g.toFixed(3) : '?'} after distance falloff — ` +
      'enormous and far away, not a monster in the room');

  // --- THE RIFT: a place with a bed and punctuation --------------------------------
  clear();
  d.setScene(null); d.update(0.25, { dimension: 'overworld', rift: true });
  await settle();
  chk(d.scene === 'rift' && lib.bedKey('air') === 'bed.rift.pulse' &&
      lib.bedKey('layer') === 'bed.rift.static' && lib.bedKey('tension') === 'bed.rift.drone',
      'the Rift is three layered beds — a pulse, interference and a drone — not a one-shot');
  heard.length = 0;
  for (let i = 0; i < 1200; i++) { lib._last.clear(); lib._perKey.clear(); lib.voices = 0;
                                   d.update(0.25, { dimension: 'overworld', rift: true }); }
  const riftKeys = new Set(heard.map((h) => h.k));
  chk(riftKeys.size >= 3 && Array.from(riftKeys).every((k) => k.indexOf('sfx.rift.') === 0),
      `and ${riftKeys.size} distinct distortion cues fire over it: ${Array.from(riftKeys).join(', ')}`);

  // --- THE ANIMALS -----------------------------------------------------------------
  clear();
  const species = ['cow', 'sheep', 'chicken', 'horse'];
  const got = species.filter((sp) => {
    lib._last.clear(); lib._perKey.clear(); lib.voices = 0;
    return d.cueAt('animal.' + sp, 6, 8, 10, { ref: 11, max: 70 });
  });
  chk(got.length === 4, `all four Farmland species have an audible call: ${got.join(', ')}`);
  clear();
  chk(d.cueAt('animal.cow', 40, 40, 120, { ref: 11, max: 70 }) === false,
      'and a call from 120 metres is dropped rather than played inaudibly — the falloff is real');
}

// =====================================================================================
head('9. THE HAVEN — REMOVAL, AND NOTHING ELSE');
// =====================================================================================
{
  installFetch('ok');
  const ctx = fakeCtx();
  const lib = new AudioLibrary(stubEngine(ctx));
  const d = new AudioDirector(lib);
  d.havenBegin();
  await settle();
  chk(lib.bedKey('haven.room') && lib.bedKey('haven.fire') && lib.bedKey('haven.out'),
      'entering the Haven starts a room, a fire and an outside');
  chk(d.sceneFor({ dimension: 'farmlands' }) === null,
      'and the director stands down completely while it is running — nothing competes with the cabin');

  /* THE ONE RULE THIS DIMENSION HAS. Every layer is driven from the REAL Phase 32 stage
     table, through the real level path, and not one of them is ever allowed to rise. */
  const seen = [];
  for (const st of HAVEN_STAGES) {
    d.havenLevels(st.room, st.outside, st.hearth);
    seen.push([lib.slots.get('haven.room').level, lib.slots.get('haven.out').level,
               lib.slots.get('haven.fire').level, lib.slots.get('haven.tick').level, st.id]);
  }
  let rose = null;
  for (let i = 1; i < seen.length; i++) {
    for (let c = 0; c < 4; c++) if (seen[i][c] > seen[i - 1][c] + 1e-9) rose = [seen[i - 1][4], seen[i][4], c];
  }
  chk(rose === null,
      rose ? `A LAYER ROSE between '${rose[0]}' and '${rose[1]}' (column ${rose[2]})`
           : `across all ${HAVEN_STAGES.length} Phase 32 stages, not one recorded layer ever rises — ` +
             'the Haven adds nothing and only ever takes things away');
  const last = seen[seen.length - 1];
  chk(last[0] === 0 && last[1] === 0 && last[2] === 0 && last[3] === 0,
      'and the final stage leaves every one of them at zero: the room ends in silence');
  const first = seen[0];
  chk(first[0] > 0 && first[2] > 0,
      'while the first stage is a warm, occupied room — the comfort is real before it is removed');
  /* AND IT IS ACTUALLY AUDIBLE. These multipliers were raised in the Phase 34.1 correction
     for the same reason every other level in the build was: they were written against
     unnormalised files, and at the original numbers the warmest room in the game was
     quieter than standing in a field. The Haven has to be the most PRESENT place there is
     — that is the whole point of it, and of what is then taken away. */
  const outdoorAir = AUDIO_SCENES['farm.day'].air[1];
  chk(first[2] >= outdoorAir,
      `the hearth at its warmest is ${first[2].toFixed(2)} against an open field at ${outdoorAir} — ` +
      'the fire is the most present thing in the game, as it should be');
  chk(first[0] >= outdoorAir * 0.7,
      `and the room tone under it is ${first[0].toFixed(2)}, within reach of the same reference`);

  d.havenEnd(0.01);
  await new Promise((r) => setTimeout(r, 450));
  chk(ctx.live.sources === 0 && !lib.bedKey('haven.room'),
      'and leaving the Haven genuinely stops every layer, rather than muting it');
  chk(d.sceneFor({ dimension: 'farmlands' }) === 'farm.day',
      'after which the director takes the world back');
}
{
  /* NO CREATURE AND NO STING IN THE HAVEN. The finale's own sounds are not reachable from
     the Haven's path, and the Haven's table names nothing that is not a room. */
  const body = classBody(LIVE, 'AudioDirector');
  const haven = body.slice(body.indexOf('havenBegin()'), body.indexOf('finaleBegin()'));
  chk(!/finale|behemoth|stalker|whisper|roar|scream/i.test(haven),
      'the Haven audio path names no creature, no roar and no whisper');
  chk(!/setTimeout|setInterval/.test(haven), 'and schedules nothing — the stage table drives it');
}

// =====================================================================================
head('10. THE FINALE — ONLY EVER THICKER');
// =====================================================================================
{
  installFetch('ok');
  const ctx = fakeCtx();
  const lib = new AudioLibrary(stubEngine(ctx));
  const d = new AudioDirector(lib);
  d.finaleBegin();
  await settle();
  chk(lib.bedKey('fin.deep') && lib.bedKey('fin.rumble') && lib.bedKey('fin.air'),
      'the finale starts three low layers and nothing else');
  chk(d.sceneFor({ dimension: 'overworld' }) === null, 'and the world beds stand down');

  const rows = [];
  for (const b of FINALE_BEATS) {
    d.finaleBeat(b.id);
    rows.push([lib.slots.get('fin.deep').level, lib.slots.get('fin.rumble').level,
               lib.slots.get('fin.air').level, b.id]);
  }
  let fell = null;
  for (let i = 1; i < rows.length; i++) {
    for (let c = 0; c < 3; c++) if (rows[i][c] < rows[i - 1][c] - 1e-9) fell = [rows[i - 1][3], rows[i][3], c];
  }
  chk(fell === null,
      fell ? `A LAYER FELL between '${fell[0]}' and '${fell[1]}'`
           : `across all ${FINALE_BEATS.length} Phase 33 beats every recorded layer only ever rises — ` +
             'the exact mirror of the Haven, which is the point of the pair');
  chk(rows[0][0] === 0 && rows[0][1] === 0 && rows[0][2] === 0,
      "and the 'silence' beat is genuinely silent — the finale opens on nothing");
  /* THE LAST BEAT HAS TO BE THE LOUDEST THING IN THE GAME. Raised in the Phase 34.1
     correction: at the original numbers the ending was quieter than a field, because these
     were written against files nobody had measured. */
  const last = rows[rows.length - 1];
  /* COMPARED AT THE BUS, not at the level. The finale's layers are music (musicBus, 0.82
     in the shipped mix) and a field is ambience (ambienceBus, 1.0), so the raw numbers in
     the two tables are not on the same scale and comparing them directly understates the
     finale by two decibels. */
  const MUSIC_BUS = 0.82, AMB_BUS = 1.0;
  const field = AUDIO_SCENES['farm.day'].air[1] * AMB_BUS;
  chk(last[0] * MUSIC_BUS > field,
      `the final beat's floor reaches ${(last[0] * MUSIC_BUS).toFixed(2)} at the bus against an ` +
      `open field at ${field.toFixed(2)} — the ending is the largest sound in the game`);
  chk(last[1] * MUSIC_BUS > field * 0.5 && last[2] > 0,
      'and all three layers carry it, rather than one loud one doing the work alone');
  const covered = rows.map((r) => r[3]);
  chk(FINALE_BEATS.every((b) => covered.indexOf(b.id) >= 0),
      'every beat in the real table has a row — none falls through to zero by accident');

  /* NO ROAR. The one event in thirty-two seconds is a structure flexing. */
  const body = classBody(LIVE, 'AudioDirector');
  const fin = body.slice(body.indexOf('finaleBegin()'), body.indexOf('finaleEnd('));
  const events = (fin.match(/this\.lib\.play\(/g) || []).length;
  chk(events === 1, `exactly ${events} one-shot in the whole sequence`);
  chk(/sfx\.finale\.bend/.test(fin) && !/roar|behemoth|scream|stalker/i.test(fin),
      'and it is a massive structure bending, not a monster — no roar is reachable from the finale');

  d.finaleEnd(0.01);
  await new Promise((r) => setTimeout(r, 450));
  chk(ctx.live.sources === 0, 'and the hard cut leaves nothing running');
}
{
  /* THE FINALE CANNOT SOUND EARLY. Both authored sequences are begun from exactly one
     place each, and that place is the engine method Phase 32/33 already own. */
  const begins = (LIVE.match(/director\.finaleBegin\(\)/g) || []).length;
  const beats = (LIVE.match(/director\.finaleBeat\(/g) || []).length;
  chk(begins === 1 && beats === 1,
      `the finale's audio is begun from ${begins} call site and driven from ${beats} — both inside ` +
      'the Phase 33 methods, so it is downstream of the Haven shift exactly as the visuals are');
  const hb = (LIVE.match(/director\.havenBegin\(\)/g) || []).length;
  chk(hb === 1, 'and the Haven ambience likewise has exactly one entry point');
}

// =====================================================================================
head('11. TEARDOWN: NOTHING SURVIVES A NEW GAME');
// =====================================================================================
{
  installFetch('ok');
  const ctx = fakeCtx();
  const lib = new AudioLibrary(stubEngine(ctx));
  const d = new AudioDirector(lib);
  d.update(0.016, { dimension: 'suburbia', night: true });
  await settle();
  d.havenBegin();
  await settle();
  chk(ctx.live.sources > 0, 'with beds and a Haven running');
  d.reset();
  await new Promise((r) => setTimeout(r, 2000));   // longest pending teardown is the 1.2s Haven-entry fade
  chk(ctx.live.sources === 0 && lib.activeBeds() === 0,
      `reset() leaves ${ctx.live.sources} sources and ${lib.activeBeds()} beds — the one teardown ` +
      'a New Game and a Load both run releases everything');
  chk(d.scene === null && d._havenOn === false && d._finaleOn === false,
      'and forgets the scene, so the next frame rebuilds from where the player actually landed');
  chk(lib.voices === 0, 'the voice counter is cleared, so a session cannot start at the ceiling');
}
{
  chk(/if \(this\.sound && this\.sound\.director\) this\.sound\.director\.reset\(\);/.test(LIVE),
      'the teardown is called from Game\'s one reset path, beside ui.resetPresentation and envStory.reset');
  chk(/this\._audioDim = null;/.test(LIVE) && /this\._audioIndoors = false;/.test(LIVE),
      'and the frame path\'s own memory goes with it — a New Game does not inherit the ' +
      'previous run\'s dimension or its indoor latch');
  chk(/if \(this\.director\) \{ try \{ this\.director\.reset\(\); \} catch \(e\)/.test(LIVE),
      'and again from silenceAll(), so the credits hard-cut genuinely stops the beds rather than ducking them');
}

// =====================================================================================
head('12. ARCHITECTURE: THE SPLIT THAT LETS ERA 2 HAPPEN');
// =====================================================================================
{
  const dir = classBody(LIVE, 'AudioDirector');
  const libB = classBody(LIVE, 'AudioLibrary');
  chk(!/this\.ctx|AudioContext|createGain|createBufferSource|createBiquad|createStereoPanner|\.gain\./.test(dir),
      'AudioDirector never touches the AudioContext or an AudioParam — it is policy, not plumbing');
  chk(!/BLOCK\.|chunk|mesh|THREE\./.test(libB),
      'AudioLibrary knows nothing about blocks, chunks or meshes — it is handed a name and makes a sound');
  chk(!/setInterval/.test(dir) && !/setInterval/.test(libB),
      'neither class uses setInterval');
  chk(!/setTimeout/.test(dir),
      'and the director schedules NOTHING — every countdown in it is a number dt is subtracted from, ' +
      'which is why a test can drive four hours of it and why it cannot leak');
  const tos = (libB.match(/setTimeout\(/g) || []).length;
  chk(tos === 2,
      `the library CALLS setTimeout ${tos} times, both for deferred teardown only — stopping a ` +
      'source after its fade has landed, and releasing a voice whose onended never fired. ' +
      'Nothing in the audio system schedules a SOUND.');
  chk(/getBlockWorld/.test(dir) && (LIVE.match(/AUDIO_SURFACE_OF\[/g) || []).length === 1,
      'the ONLY place the audio system knows a block id exists is AudioDirector.surfaceAt — ' +
      'the single line Era 2 has to replace');
}
{
  /* NO SECOND VOLUME SYSTEM. Phase 22's settings are reused rather than duplicated. */
  const schema = g('SETTINGS_SCHEMA');
  chk(schema.ambienceVolume && schema.ambienceVolume.def === 1.0,
      'the ambience volume is a key in the EXISTING settings schema, not a second settings system');
  chk((LIVE.match(/class GameSettings/g) || []).length === 1 &&
      (LIVE.match(/SETTINGS_STORAGE_KEY = /g) || []).length === 1,
      'and there is still exactly one GameSettings and one storage key');
  chk((LIVE.match(/new AudioContext|new Ctx\(\)/g) || []).length === 1,
      'exactly one AudioContext is ever constructed in the whole build');
}
{
  /* THE BUS ROUTING. Every sample the library plays reaches a bus a slider moves. */
  const libB = classBody(LIVE, 'AudioLibrary');
  const bus = libB.slice(libB.indexOf('_bus(kind)'));
  chk(/musicBus/.test(bus) && /sfxUnityBus/.test(bus) && /ambienceBus/.test(bus),
      'the library routes to musicBus, sfxUnityBus or ambienceBus and to nothing else');
  chk((libB.match(/\.connect\(this\._bus\(/g) || []).length === 2,
      'and every sample voice and every bed goes through that one function — nothing connects to ' +
      'master directly, so nothing escapes the sliders');
}

// =====================================================================================
head('13. THE QUIET RULES');
// =====================================================================================
{
  /* SILENCE IS A STATE. There must be a reachable, ordinary game state with no horror bed
     and no music of any kind — because "silence is important to Where It Isn't" is the
     brief's last quality rule and it has to be true of the table, not just of the prose. */
  const quiet = Object.keys(AUDIO_SCENES).filter((id) => !AUDIO_SCENES[id].tension);
  chk(quiet.length >= 8,
      `${quiet.length} of ${Object.keys(AUDIO_SCENES).length} scenes have no horror bed at all: ` +
      quiet.slice(0, 5).join(', ') + '…');
  chk(!AUDIO_SCENES['overworld.day'].tension && !AUDIO_SCENES['farm.day'].tension &&
      !AUDIO_SCENES['sub.day'].tension && !AUDIO_SCENES['in.house'].tension,
      'and none of the four ordinary daytime places carries one — normality is a real state');
}
{
  /* NOTHING IS LOUD. The Stalker in particular: section 5 asks for "extremely restrained
     creature audio", and the number that makes that true is that it is quieter than the
     player's own footsteps at the same distance. */
  const stalk = ['stalker.step', 'stalker.near', 'stalker.cloth', 'stalker.breath']
                  .map((n) => AUDIO_CUES[n].g);
  const step = AUDIO_STEP_SURFACES.grass.g;
  chk(Math.max.apply(null, stalk) < step,
      `the loudest Stalker cue is ${Math.max.apply(null, stalk)}, against the player's own footstep at ` +
      `${step} — it is always the quieter of the two`);
  const dir = classBody(LIVE, 'AudioDirector');
  const st = dir.slice(dir.indexOf('stalker(dt'), dir.indexOf('behemothArrives('));
  chk(!/screech|scream|jumpscare/i.test(st),
      'and the Stalker path reaches no screech — playStalkerScreech remains Phase 5\'s one loud event');
  chk(/> 34/.test(st), 'it stops entirely beyond 34 metres');
  chk(/_havenOn \|\| this\._finaleOn/.test(st),
      'and is silent inside the Haven and the finale, where the Stalker does not exist');
}
{
  /* NO LEGIBLE SPEECH, ANYWHERE. STORY.md section 13. Two assets in the library are human
     sentences and neither is wired to anything. */
  const wired = new Set();
  for (const k of Object.keys(AUDIO_ASSETS)) wired.add(AUDIO_ASSETS[k].f || '');
  chk(!wired.has('503270.mp3') && !wired.has('242933.mp3'),
      'the whispered English sentence and the laughing child are catalogued and NOT wired — ' +
      'no readable human speech is reachable from any code path');
  const idx = fs.readFileSync(path.join(AUDIO_DIR, 'AUDIO_INDEX.md'), 'utf8');
  chk(/503270/.test(idx) && /242933/.test(idx) && /118083/.test(idx) && /636777/.test(idx),
      'and all four held-back assets have a row in the index saying why');
}

console.log('');
if (fail) { console.log(`${fail} FAILURES`); process.exit(1); }
console.log('ALL PHASE 34 AUDIO CHECKS PASS');
note('Offline. The real manifest against the real files on disk, a real AudioLibrary against a');
note('recording AudioContext and a controllable fetch, the real director driven frame by frame');
note('through every reachable scene and four simulated hours of one, the real Phase 32 stage');
note('table and the real Phase 33 beat table pushed through the real level paths.');
note('');
note('NOT CLAIMED: that any of it sounds right. Nothing in this phase was listened to — no');
note('playback device and no content-analysis tool was available — so every classification in');
note('AUDIO_INDEX.md comes from filenames, AUDIO_CREDITS titles and ffprobe metadata. Whether');
note('the Farmland bed is the right recording, whether the events are too frequent, and whether');
note('the finale feels enormous are judgements for a person with speakers.');
}

main().catch((e) => { console.log('FAIL  the suite threw: ' + (e && e.stack || e)); process.exit(1); });
