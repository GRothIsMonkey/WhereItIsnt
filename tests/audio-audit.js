/* PHASE 34 CORRECTION — RUNTIME AUDIO AUDIT.

   Not a test. A MEASUREMENT. It boots the real game in a real Chromium with a real
   AudioContext, instruments every path in the build that can make a sound, then drives
   each dimension and reports what actually happened.

   It exists because a human playtest found the shipped build nearly silent apart from
   footsteps and an unwanted retro music loop, and neither the offline suite nor the
   browser suite noticed — both proved the system CAN select and play things, which is a
   different claim from "the player hears it". This file answers the second question.

   Run it, read the tables, fix what they show. It asserts nothing. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_AUDIT_PORT || 8247);
const SECONDS = Number(process.env.WII_AUDIT_SECONDS || 25);

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) { try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; } }
if (!chromium) { console.log('SKIP  playwright is not installed.'); process.exit(0); }

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
               '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
               '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aiff': 'audio/aiff' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'game.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

const head = (t) => console.log('\n=== ' + t + ' ' + '='.repeat(Math.max(0, 72 - t.length)));
const row = (a, b) => console.log('  ' + String(a).padEnd(34) + ' ' + b);

/* Wraps every sound-producing method on the live SoundEngine and the live AudioLibrary
   so nothing can make a noise without being counted. Installed once, in the page. */
const INSTRUMENT = () => {
  const g = window.game, s = g.sound;
  if (window.__audit) return true;
  const A = window.__audit = { synth: {}, samples: {}, beds: [], scenes: [], surfaces: {},
                               refused: {}, log: [] };
  const SYNTH = ['playDayChord', 'playBlockBreak', 'playMiningHit', 'playMiningBlocked',
                 'playBlockPlace', 'playAnchorExecution', 'playItemPickup', 'playShieldZap',
                 'playChestOpen', 'playFootstep', 'playStalkerScreech', 'playAnimalCall',
                 'playTorchFizzle', 'playJumpscareHit', 'playWhisper', 'playDarknessWhisperBurst',
                 'playHavenChiptunePhrase', 'playHavenRestChime', 'playFinaleImpact',
                 'playMusicTrack', '_startCrtStatic', '_buildNightBed'];
  for (const m of SYNTH) {
    if (typeof s[m] !== 'function') continue;
    const real = s[m].bind(s);
    s[m] = function (...a) { A.synth[m] = (A.synth[m] || 0) + 1; return real(...a); };
  }
  const lib = s.library, d = s.director;
  if (lib) {
    const realPlay = lib.play.bind(lib);
    lib.play = function (key, o) {
      const ok = realPlay(key, o);
      const t = A.samples[key] || (A.samples[key] = { played: 0, refused: 0 });
      if (ok) t.played++; else t.refused++;
      return ok;
    };
    const realBed = lib.setBed.bind(lib);
    lib.setBed = function (slot, key, o) {
      A.beds.push({ t: +performance.now().toFixed(0), slot, key: key || null,
                    level: o && o.level });
      return realBed(slot, key, o);
    };
  }
  if (d) {
    const realScene = d.setScene.bind(d);
    d.setScene = function (id, f) {
      if (id !== d.scene) A.scenes.push({ t: +performance.now().toFixed(0), id });
      return realScene(id, f);
    };
    const realStep = d.footstep.bind(d);
    d.footstep = function (sp, surf) {
      const ok = realStep(sp, surf);
      const t = A.surfaces[surf || 'null'] || (A.surfaces[surf || 'null'] = { ok: 0, no: 0 });
      if (ok) t.ok++; else t.no++;
      return ok;
    };
  }
  return true;
};

/* =====================================================================================
   PHASE 34.2 — THE METER, AND THE FOUR WORDS THIS FILE NOW DISTINGUISHES.

   Everything above this line counts CALLS. That is what Phase 34 and 34.1 both measured,
   and both times the game shipped nearly silent with the counts looking healthy — because
   "the code asked for a crow" and "the player heard a crow" are different claims and only
   the first one was ever checked.

   This taps the real audio graph with an AnalyserNode per bus and reports the signal that
   is actually on it. Combined with the bed truth below, the audit can now separate:

     REQUESTED  a call was made                          (the counters above)
     STARTED    a real BufferSource exists on the slot   (bed.state === 'LIVE')
     CONNECTED  it is on a gain node in the live graph   (bed.gain !== null)
     AUDIBLE    signal is measurably present on the bus  (the dBFS columns)

   A bed can be REQUESTED and never STARTED — setBed claims its slot before the decode
   lands and leaves it claimed if the fetch fails, which is exactly the case that reported
   a playing bed while nothing played. It can be STARTED and CONNECTED and still not
   AUDIBLE, if its level, its bus or the master is at zero. Only the last column is a
   statement about the player.

   Headless Chromium renders to a null device, so this measures the signal and NOT how it
   sounds. Loudness is arithmetic and can be checked here; whether it is the right sound
   in the right place is a person's job, and the report says so. */
const METER = () => {
  const s = window.game.sound;
  if (!s.ctx || window.__meter) return false;
  const ctx = s.ctx;
  const M = window.__meter = { an: {}, acc: {}, n: {}, peak: {} };
  /* An analyser is a dead end and a dead end is not guaranteed to be pulled, so each one
     also runs into a silent gain that IS connected to the destination. */
  const sink = ctx.createGain();
  sink.gain.value = 0;
  sink.connect(ctx.destination);
  for (const name of ['master', 'musicBus', 'sfxBus', 'sfxUnityBus', 'ambienceBus']) {
    const node = s[name];
    if (!node) continue;
    const a = ctx.createAnalyser();
    a.fftSize = 2048;
    a.smoothingTimeConstant = 0;
    node.connect(a);
    a.connect(sink);
    M.an[name] = a; M.acc[name] = 0; M.n[name] = 0; M.peak[name] = 0;
  }
  M.buf = new Float32Array(2048);
  M.timer = setInterval(() => {
    for (const k in M.an) {
      M.an[k].getFloatTimeDomainData(M.buf);
      let ss = 0, m = 0;
      for (let i = 0; i < M.buf.length; i++) {
        const v = M.buf[i];
        ss += v * v;
        const av = Math.abs(v);
        if (av > m) m = av;
      }
      M.acc[k] += ss / M.buf.length;
      M.n[k]++;
      if (m > M.peak[k]) M.peak[k] = m;
    }
  }, 20);
  return true;
};
const METER_RESET = () => {
  const M = window.__meter;
  if (!M) return false;
  for (const k in M.acc) { M.acc[k] = 0; M.n[k] = 0; M.peak[k] = 0; }
  return true;
};
const METER_READ = () => {
  const M = window.__meter, s = window.game.sound, lib = s.library;
  const db = (v) => (v <= 1e-9 ? -999 : +(20 * Math.log10(v)).toFixed(1));
  const levels = {};
  if (M) for (const k in M.acc) {
    levels[k] = { rms: db(Math.sqrt(M.acc[k] / Math.max(1, M.n[k]))), peak: db(M.peak[k]) };
  }
  /* BED TRUTH. Not the slot table — the nodes. */
  const beds = [];
  if (lib) for (const [slot, e] of lib.slots) {
    beds.push({ slot, key: e.key,
                state: e.starting ? 'LOADING' : (e.src && e.gain ? 'LIVE' : 'DEAD'),
                gain: e.gain ? +e.gain.gain.value.toFixed(3) : null,
                decoded: lib.buffers.has(e.key) });
  }
  return { levels, beds, ctxState: s.ctx ? s.ctx.state : null,
           failed: lib ? Array.from(lib.failed) : [] };
};

/* One dimension: teleport, walk a straight line for `secs` of REAL time letting the real
   frame loop drive everything, sampling what the audio system settled on. */
const WALK = async (dims) => {
  const g = window.game, p = g.player, s = g.sound;
  const out = { samples: [], surfaces: {}, err: null };
  const t0 = performance.now();
  let n = 0;
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1]];
  while (performance.now() - t0 < dims.secs * 1000) {
    /* Walk by MOVING THE BODY, not by pressing keys: a headless page has no pointer lock,
       so the controller ignores input. The frame loop still runs, so streaming, the scene
       picker and everything downstream behave exactly as they do in play. */
    const dir = dirs[(n / 24 | 0) % dirs.length];
    p.position.x += dir[0] * 1.6;
    p.position.z += dir[1] * 1.6;
    const surf = s.director ? s.director.surfaceAt(g.world, p.position.x, p.position.y, p.position.z) : '?';
    out.surfaces[surf] = (out.surfaces[surf] || 0) + 1;
    /* One footfall per two samples, at the cadence the controller would use. */
    if (n % 2 === 0 && s.playFootstep) s.playFootstep(0.9, surf);
    if (n % 8 === 0) {
      const lib = s.library;
      out.samples.push({
        t: +((performance.now() - t0) / 1000).toFixed(1),
        y: Math.round(p.position.y),
        scene: s.director ? s.director.scene : null,
        beds: lib ? Array.from(lib.slots.keys()).map((k) => k + '=' + lib.slots.get(k).key +
                     '@' + (lib.slots.get(k).level || 0).toFixed(2)).join(' ') : '',
        surf,
      });
    }
    n++;
    await new Promise((r) => setTimeout(r, 60));
  }
  return out;
};

/* Event rates cannot be measured in real time — the tables are minutes apart. This drives
   the REAL director with the REAL scene for a long simulated span and counts. */
const RATES = (arg) => {
  const state = arg.state, simSeconds = arg.simSeconds;
  const d = window.game.sound.director;
  const before = JSON.parse(JSON.stringify(d.stats));
  const dt = 0.25;                       // the director's own clamp
  const frames = Math.round(simSeconds / dt);
  for (let i = 0; i < frames; i++) d.update(dt, state);
  const after = d.stats;
  return { events: after.events - before.events, scene: d.scene,
           perHour: +(((after.events - before.events) / simSeconds) * 3600).toFixed(1) };
};

(async () => {
  const hermetic = fs.existsSync(VENDOR_THREE);
  const srv = await serve();
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
           '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (hermetic) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('!!window.game', null, { timeout: 120000 });
    await page.click('#clickPlay');
    await page.waitForTimeout(600);
    await page.evaluate('window.game.film && window.game.film.active && window.game.film.skip()');
    await page.waitForFunction('window.game.running === true', null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate(INSTRUMENT);
    await page.evaluate(METER);

    const places = [
      ['OVERWORLD  day',   "window.debugTeleportToOverworld && window.debugTeleportToOverworld(); window.game.env.t = 200;"],
      ['OVERWORLD  night', "window.game.env.t = 560;"],
      ['FARMLANDS  day',   "window.debugTeleportToFarmlands(); window.game.env.t = 200;"],
      ['FARMLANDS  night', "window.game.env.t = 560;"],
      ['SUBURBIA   day',   "window.debugTeleportToSuburbia(); window.game.env.t = 200;"],
      ['SUBURBIA   night', "window.game.env.t = 560;"],
    ];
    const walks = [];
    for (const [name, setup] of places) {
      await page.evaluate(setup);
      await page.waitForTimeout(2500);
      /* The meter is zeroed AFTER the crossfade has settled, so a reading describes the
         place rather than the transition into it. */
      await page.evaluate(METER_RESET);
      const r = await page.evaluate(WALK, { secs: SECONDS / places.length });
      r.meter = await page.evaluate(METER_READ);
      walks.push([name, r]);
    }

    head('WHAT THE PLAYER ACTUALLY GETS, WALKING');
    for (const [name, r] of walks) {
      console.log('\n' + name);
      const scenes = Array.from(new Set(r.samples.map((s) => s.scene)));
      row('scene(s) selected', scenes.join(', ') || '(none)');
      const beds = Array.from(new Set(r.samples.map((s) => s.beds))).filter(Boolean);
      row('beds', beds[beds.length - 1] || '(NONE — SILENT)');
      const surf = Object.entries(r.surfaces).sort((a, b) => b[1] - a[1]);
      row('surfaces walked', surf.map(([k, v]) => `${k}×${v}`).join('  '));
    }

    // =================================================================================
    head('IS IT AUDIBLE — REQUESTED vs STARTED vs CONNECTED vs AUDIBLE');
    // =================================================================================
    console.log('  A bed is LIVE only when a real source and gain node exist for it.');
    console.log('  LOADING = the slot is claimed and the decode has not landed.');
    console.log('  DEAD    = the slot is claimed and nothing is playing on it.');
    console.log('  dBFS is the signal measured on the bus, not a level anyone wrote down.\n');
    for (const [name, r] of walks) {
      const m = r.meter;
      if (!m) { console.log('  ' + name + '  (no meter)'); continue; }
      console.log('  ' + name + '   context ' + (m.ctxState || '?'));
      for (const b of m.beds) {
        const flag = b.state === 'LIVE' ? '  ' : '!!';
        console.log('    ' + flag + ' ' + b.state.padEnd(8) + b.slot.padEnd(10) +
                    b.key.padEnd(22) + (b.gain === null ? '' : 'gain ' + b.gain) +
                    (b.decoded ? '' : '   [NOT DECODED]'));
      }
      if (!m.beds.length) console.log('    !! NO BEDS AT ALL');
      const L = m.levels;
      const col = (k) => (L[k] ? String(L[k].rms).padStart(7) + ' /' + String(L[k].peak).padStart(7) : '      -');
      console.log('    rms/peak dBFS   master' + col('master') + '   amb' + col('ambienceBus'));
      console.log('                    sfx   ' + col('sfxUnityBus') + '   mus' + col('musicBus'));
      /* THE ONE LINE THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. A bus carrying beds
         that are all LIVE and still reading silence is the failure this pass fixed. */
      const amb = L.ambienceBus ? L.ambienceBus.rms : -999;
      const liveBeds = m.beds.filter((b) => b.state === 'LIVE').length;
      if (liveBeds && amb < -45) console.log('    !! ' + liveBeds + ' live bed(s) and the ambience bus is SILENT');
      if (m.failed.length) console.log('    !! dead assets: ' + m.failed.join(', '));
      console.log('');
    }

    const A = await page.evaluate('window.__audit');
    head('EVERY SOUND-PRODUCING CALL MADE DURING THE WALK');
    console.log('\nSYNTHESISED (the pre-Phase-34 engine):');
    for (const [k, v] of Object.entries(A.synth).sort((a, b) => b[1] - a[1])) row(k, v);
    console.log('\nSAMPLES (played / refused):');
    const rows = Object.entries(A.samples).sort((a, b) => b[1].played - a[1].played);
    for (const [k, v] of rows) row(k, `${v.played} played, ${v.refused} refused`);
    if (!rows.length) row('(none)', 'NO SAMPLE PLAYED AT ALL');
    console.log('\nFOOTSTEP SURFACE SELECTION (recorded ok / fell back to synth):');
    for (const [k, v] of Object.entries(A.surfaces)) row(k, `${v.ok} recorded, ${v.no} synth`);
    console.log('\nBED CHANGES:');
    for (const b of A.beds) row(b.slot, `${b.key || '(cleared)'} @ ${b.level}`);
    console.log('\nSCENE CHANGES:');
    for (const s of A.scenes) row(s.t + 'ms', s.id);

    head('AMBIENT EVENT RATES (simulated, 1 hour per state)');
    const states = [
      ['overworld day',   { dimension: 'overworld' }],
      ['overworld night', { dimension: 'overworld', night: true }],
      ['farmlands day',   { dimension: 'farmlands' }],
      ['farmlands night', { dimension: 'farmlands', night: true }],
      ['suburbia day',    { dimension: 'suburbia' }],
      ['suburbia night',  { dimension: 'suburbia', night: true }],
      ['indoors house',   { dimension: 'overworld', indoors: true }],
      ['indoors suburb',  { dimension: 'suburbia', indoors: true }],
      ['rift',            { dimension: 'overworld', rift: true }],
    ];
    for (const [name, st] of states) {
      /* Wrapped, because a throw here used to end the run silently and take the whole
         rates table with it — and that table is the half of this audit that answers "is
         the world too quiet", which is the question the human playtest actually raised. */
      try {
        const r = await page.evaluate(RATES, { state: st, simSeconds: 3600 });
        row(name, `${r.scene || '(none)'} — ${r.events} events/h = one per ` +
                  `${r.events ? Math.round(3600 / r.events) : '∞'}s`);
      } catch (e) { row(name, 'FAILED: ' + (e && e.message)); }
    }

    head('PAGE ERRORS');
    console.log(errors.length ? errors.slice(0, 6).join('\n') : '  none');
  } catch (e) {
    console.log('AUDIT THREW: ' + (e && e.stack || e));
  } finally {
    await browser.close();
    srv.close();
  }
})();
