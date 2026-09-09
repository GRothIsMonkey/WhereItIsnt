/* PHASE 34 — LIVE AUDIO VALIDATION.

   WHAT THIS FILE ADDS THAT audio.js CANNOT. audio.js drives the real classes against a
   recording AudioContext and a fetch under its own control; it proves the logic. This
   boots the real page in a real Chromium, opens a REAL AudioContext, fetches the REAL
   files off a real HTTP server and decodes them with a real decoder — which is the only
   way to answer the questions that actually matter for shipping:

     * do the runtime files decode in a browser at all, or has a format been chosen that
       Chrome refuses (the exact defect that makes AIFF unusable)
     * does the graph the library builds get accepted by a real Web Audio implementation
     * does a real dimension change actually swap beds and leave nothing running
     * does the settings slider reach the ambience bus in a live graph
     * does the page throw

   WHAT IT STILL CANNOT DO IS LISTEN. Headless Chromium renders audio to a null device.
   Nothing here is a claim about how anything sounds; every such judgement is deferred to
   a person, and the phase report says so. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'renders');
const VENDOR_THREE = path.join(__dirname, 'vendor', 'three.min.js');
const PORT = Number(process.env.WII_AUDIO_PORT || 8244);

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; }
}
if (!chromium) {
  console.log('SKIP  playwright is not installed — browser validation not run.');
  process.exit(0);
}

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
               '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
               '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aiff': 'audio/aiff' };
let served = 0;
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'game.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      served++;
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

/* Everything read in ONE page call, so no two assertions can compare different moments. */
const SNAP = () => {
  const g = window.game, s = g.sound, lib = s.library, d = s.director;
  const bus = (n) => (s[n] ? +s[n].gain.value.toFixed(4) : null);
  return {
    running: !!g.running,
    ctx: !!s.ctx, ctxState: s.ctx ? s.ctx.state : null, sampleRate: s.ctx ? s.ctx.sampleRate : 0,
    hasLib: !!lib, hasDir: !!d,
    buses: { user: bus('userGain'), music: bus('musicBus'), sfx: bus('sfxBus'),
             sfxU: bus('sfxUnityBus'), amb: bus('ambienceBus') },
    scene: d ? d.scene : null,
    beds: lib ? Array.from(lib.slots.keys()).map((k) => k + '=' + lib.slots.get(k).key) : [],
    bedCount: lib ? lib.slots.size : -1,
    buffers: lib ? lib.buffers.size : -1,
    failed: lib ? Array.from(lib.failed) : [],
    voices: lib ? lib.voices : -1,
    stats: lib ? JSON.parse(JSON.stringify(lib.stats)) : null,
    dstats: d ? JSON.parse(JSON.stringify(d.stats)) : null,
    dim: g.player.inFakeHaven ? 'haven' : g.player.inSuburbia ? 'suburbia'
       : g.player.inFarmlands ? 'farmlands' : 'overworld',
  };
};

(async () => {
  const hermetic = fs.existsSync(VENDOR_THREE);
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
           '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  const errors = [];
  let deliberate404 = false;
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/pointer ?lock/i.test(t)) return;
    if (/AudioContext|user gesture/i.test(t)) return;
    /* Section 3 deliberately asks the server for a file that is not there, to prove the
       missing-asset path. Chromium logs that as a console error; it is this file's own
       doing and is not a defect in the build. Nothing else 404s — section 8 asserts the
       library's own failure count is exactly the one this test caused. */
    if (/definitely-not-here/.test(t)) return;
    if (/404 \(Not Found\)/.test(t) && deliberate404) return;
    errors.push('console: ' + t);
  });
  const requests = [];
  page.on('request', (r) => { if (/assets\/audio\//.test(r.url())) requests.push(r.url()); });
  if (hermetic) {
    const body = fs.readFileSync(VENDOR_THREE, 'utf8');
    await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('!!window.game', null, { timeout: 120000 });
    await page.waitForTimeout(400);

    // =================================================================================
    head('1. NOTHING IS LOADED BEFORE THE PLAYER PLAYS');
    // =================================================================================
    {
      const menuRequests = requests.slice();
      chk(menuRequests.length === 0,
          `the main menu fetches ${menuRequests.length} audio files — the library is entirely ` +
          'lazy, so the page is interactive without downloading a byte of it');
      const boot = await page.evaluate('!!(window.game.sound && window.game.sound.library)');
      chk(boot === false,
          'and no library exists yet, because no AudioContext does: a browser will not open ' +
          'one before the player has interacted with the page');
    }

    await page.click('#clickPlay');
    await page.waitForTimeout(700);
    await page.evaluate('window.game.film && window.game.film.active && window.game.film.skip()');
    await page.waitForFunction('window.game.running === true', null, { timeout: 60000 });
    await page.waitForTimeout(1500);

    // =================================================================================
    head('2. A REAL AUDIOCONTEXT, A REAL GRAPH');
    // =================================================================================
    const live = await page.evaluate(SNAP);
    chk(live.ctx && live.sampleRate > 8000,
        `a real AudioContext is open at ${live.sampleRate}Hz (state: ${live.ctxState})`);
    chk(live.hasLib && live.hasDir, 'and both the library and the director were built on it');
    chk(live.buses.user !== null && live.buses.music !== null && live.buses.sfx !== null &&
        live.buses.sfxU !== null && live.buses.amb !== null,
        `all five gain nodes exist in the live graph: user ${live.buses.user}, music ` +
        `${live.buses.music}, sfx ${live.buses.sfx}/${live.buses.sfxU}, ambience ${live.buses.amb}`);

    // =================================================================================
    head('3. THE FILES ACTUALLY DECODE IN A BROWSER');
    // =================================================================================
    {
      /* THE ONE QUESTION NO OFFLINE TEST CAN ANSWER. Every encode the build ships is
         decoded here by the real decoder: if a format had been chosen that Chrome refuses
         — which is exactly what AIFF is — this is where it shows. One of each encode
         class plus the five assets whose ORIGINALS were in a format the browser cannot
         use, so the conversion itself is validated rather than assumed. */
      const keys = ['sfx.door.open', 'sfx.ui.pickup',            // wav cues
                    'bed.farm.day', 'bed.sub.night',             // mp3 beds
                    'sfx.clock.wrong',                           // mp3 long cue
                    'step.grass',                                // a sliced footstep set
                    'step.plain', 'sfx.branch', 'sfx.swell.long',// were AIFF
                    'sfx.clang.far', 'sfx.clang.low',            // were AIFF
                    'sfx.crow', 'sfx.door.open2',                // were FLAC
                    'sfx.door.screen'];                          // was M4A/AAC
      const res = await page.evaluate(async (ks) => {
        const lib = window.game.sound.library;
        const out = {};
        for (const k of ks) {
          const b = await lib.load(k);
          out[k] = b ? { ch: b.numberOfChannels, dur: +b.duration.toFixed(2), sr: b.sampleRate } : null;
        }
        return out;
      }, keys);
      const dead = keys.filter((k) => !res[k]);
      chk(dead.length === 0,
          dead.length ? 'FILES THE BROWSER WOULD NOT DECODE: ' + dead.join(', ')
                      : `all ${keys.length} probe assets fetched and decoded in a real browser — ` +
                        'including every one whose original was AIFF, FLAC or AAC');
      for (const k of ['step.plain', 'sfx.branch', 'sfx.clang.far'])
        note(`${k}: ${res[k] ? res[k].dur + 's, ' + res[k].ch + 'ch @ ' + res[k].sr + 'Hz' : 'FAILED'}`);
      const bed = res['bed.farm.day'];
      chk(bed && bed.dur > 20 && bed.dur < 30,
          `and a bed comes back crossfade-joined at ${bed ? bed.dur : 0}s — shorter than the file, ` +
          'because its own tail is now mixed into its own head');
    }
    {
      /* THE MISSING-FILE PATH, LIVE. A key pointed at a file that is not there must fail
         once, quietly, and leave the game running. */
      deliberate404 = true;
      const r = await page.evaluate(async () => {
        const lib = window.game.sound.library;
        const before = lib.stats.failed;
        const url = lib.url.bind(lib);
        lib.url = () => 'assets/audio/runtime/definitely-not-here.wav';
        const a = await lib.load('sfx.rift.knack');
        const again = await lib.load('sfx.rift.knack');
        lib.url = url;
        return { a, again, failedDelta: lib.stats.failed - before, latched: lib.failed.has('sfx.rift.knack') };
      });
      chk(r.a === null && r.again === null && r.failedDelta === 1 && r.latched,
          'a real 404 against a real server resolves to null, is counted once, and is latched — ' +
          'the second request never leaves the browser');
      chk(errors.length === 0, 'and the page did not throw');
    }

    // =================================================================================
    head('4. BEDS IN A LIVE GRAPH');
    // =================================================================================
    {
      /* THE CORRECTION'S HEADLINE CLAIM, in a live browser: exploration is no longer
         scored, and the ambience the player is left with is genuinely there. */
      const music = await page.evaluate(() => {
        const s = window.game.sound;
        let chords = 0;
        const has = typeof s.playDayChord === 'function';
        s.playDayChord = () => { chords++; };
        for (let i = 0; i < 4000; i++) s.updateDayTrack(0.25, true);   // ~16 simulated minutes
        return { has, chords, recordedLive: s._recordedBedLive() };
      });
      chk(music.has === false,
          'playDayChord does not exist on the live engine — the retro exploration ' +
          'soundtrack is gone from the running build, not merely from the source');
      chk(music.chords === 0,
          `and sixteen simulated minutes of daylight schedule ${music.chords} chords`);
      chk(music.recordedLive === true,
          'while a recorded bed IS sounding, so the synthesised night bed has stood down for it');
    }
    {
      const a = await page.evaluate(SNAP);
      chk(a.scene !== null, `the director settled on a scene by itself: '${a.scene}'`);
      chk(a.bedCount > 0, `and put ${a.bedCount} bed(s) on it: ${a.beds.join(', ')}`);
      const held = await page.evaluate(async () => {
        const d = window.game.sound.director, lib = window.game.sound.library;
        const before = d.stats.scenes;
        for (let i = 0; i < 400; i++) d.update(0.016, { dimension: 'overworld' });
        return { swaps: d.stats.scenes - before, beds: lib.slots.size };
      });
      chk(held.swaps === 0,
          `four hundred more frames in the same place cause ${held.swaps} bed rebuilds — the scene ` +
          'is compared, not reapplied');
    }
    {
      /* THE SCENE CHANGE THROUGH THE REAL FRAME PATH, not by calling the director. The
         game loop is running and calls _updateEnvironmentAudio every frame, so anything
         this test pushed into the director directly would be overwritten by the next
         frame — which is itself worth knowing, and is why this drives the GAME STATE the
         frame path reads and lets the loop do the rest.

         Two of the three inputs are set on the real objects (night, stage). The third,
         indoors, is the world's own hasSkyAbove predicate, wrapped for a few seconds
         because standing inside a real building would mean walking the player there. */
      const r = await page.evaluate(async () => {
        const g = window.game, lib = g.sound.library;
        const beds = () => Array.from(lib.slots.keys()).map((k) => k + '=' + lib.slots.get(k).key).sort();
        const wait = (ms) => new Promise((res) => setTimeout(res, ms));
        const out = { day: beds(), y: Math.round(g.player.position.y) };
        /* NIGHT IS SET ON THE CLOCK, not on the flag: EnvironmentSystem recomputes
           isNight from `t` every frame, so writing the flag lasts exactly one frame. */
        const clock0 = g.env.t;
        const settle = async (want) => {
          const t = performance.now();
          while (g.sound.director.scene !== want && performance.now() - t < 40000) await wait(250);
          await wait(2500);
        };
        g.env.t = 560;  await settle('overworld.night');
        out.night = beds(); out.nightScene = g.sound.director.scene;
        g.stage = 3;    await settle('overworld.blood');
        out.blood = beds(); out.bloodScene = g.sound.director.scene;
        const sky = g.world.hasSkyAbove.bind(g.world);
        g.world.hasSkyAbove = () => false;
        /* WAITED ON, NOT SLEPT THROUGH. The indoor reading has to HOLD for
           AUDIO_INDOOR_SETTLE seconds of simulated time before the mix acts on it, and
           simulated time is accumulated dt — which on this software renderer, at two
           frames a second, runs several times slower than the wall clock. At a real frame
           rate the two are the same; here they are not, and a fixed sleep measured the
           renderer rather than the feature. */
        await settle('in.house');
        out.indoors = beds(); out.indoorScene = g.sound.director.scene;
        g.world.hasSkyAbove = sky;
        g.stage = 1;
        /* The clock is NOT restored to where it started. Each settle above waits on a real
           condition rather than a fixed sleep, and the game's own day runs while it does —
           so which outdoor scene we come back to depends on how long the software renderer
           took. The claim being tested is that the mix comes back OUT, not which hour it
           is when it does. */
        const outdoor = ['overworld.day', 'overworld.night'];
        const t2 = performance.now();
        while (outdoor.indexOf(g.sound.director.scene) < 0 && performance.now() - t2 < 40000) await wait(250);
        await wait(2000);
        out.back = beds(); out.backScene = g.sound.director.scene;
        out.count = lib.slots.size;
        return out;
      });
      chk(r.nightScene === 'overworld.night' && r.night.some((s) => s.indexOf('bed.overworld.night') >= 0),
          `night falls and the frame path swaps the beds by itself: ${r.night.join(', ')}`);
      chk(r.bloodScene === 'overworld.blood' && r.blood.some((s) => s.indexOf('bed.blood') >= 0),
          `the escalation brings up the Blood Night floor: ${r.blood.join(', ')}`);
      chk(r.indoorScene === 'in.house' && r.indoors.some((s) => s.indexOf('bed.interior.house') >= 0) &&
          !r.indoors.some((s) => s.indexOf('bed.blood') >= 0),
          `and stepping under a roof at y ${r.y} gives a ROOM and not a basement: ${r.indoors.join(', ')}`);
      chk(/^overworld\./.test(r.backScene || '') && r.back.some((s) => s.indexOf('bed.overworld') >= 0),
          `and walking back out returns an outdoor scene ('${r.backScene}'): ${r.back.join(', ')}`);
      chk(r.count <= 3, `${r.count} beds resident after four scene changes, not an accumulation`);
      chk(errors.length === 0, 'and still nothing has thrown');
    }

    // =================================================================================
    head('5. THE SLIDERS REACH THE LIVE GRAPH');
    // =================================================================================
    {
      const r = await page.evaluate(async () => {
        const g = window.game, s = g.sound;
        const read = () => ({ user: +s.userGain.gain.value.toFixed(3),
                              music: +s.musicBus.gain.value.toFixed(3),
                              sfx: +s.sfxBus.gain.value.toFixed(3),
                              amb: +s.ambienceBus.gain.value.toFixed(3) });
        const wait = () => new Promise((res) => setTimeout(res, 260));
        const out = { start: read() };
        g.settings.set('ambienceVolume', 0); await wait(); out.ambZero = read();
        g.settings.set('musicVolume', 0);    await wait(); out.musicZero = read();
        g.settings.set('ambienceVolume', 1);
        g.settings.set('musicVolume', 1);    await wait(); out.back = read();
        return out;
      });
      chk(r.ambZero.amb < 0.05 && r.ambZero.music > 0.5 && r.ambZero.sfx > 1,
          `the AMBIENCE slider at zero silences the ambience bus (${r.ambZero.amb}) and leaves ` +
          `music (${r.ambZero.music}) and effects (${r.ambZero.sfx}) alone`);
      chk(r.musicZero.music < 0.05 && r.musicZero.amb < 0.05,
          'and the music slider is genuinely a different control');
      chk(r.back.amb > 0.9 && r.back.music > 0.5, 'both come back');
    }
    {
      const el = await page.evaluate(() => {
        const n = document.getElementById('setAmb');
        return n ? { type: n.type, min: n.min, max: n.max } : null;
      });
      chk(el && el.type === 'range', 'the AMBIENCE slider exists in the settings panel');
      const wired = await page.evaluate(async () => {
        const n = document.getElementById('setAmb');
        n.value = '30'; n.dispatchEvent(new Event('input'));
        await new Promise((r) => setTimeout(r, 260));
        return { setting: window.game.settings.get('ambienceVolume'),
                 bus: +window.game.sound.ambienceBus.gain.value.toFixed(3),
                 label: document.getElementById('setAmbVal').textContent };
      });
      chk(Math.abs(wired.setting - 0.3) < 1e-6 && wired.bus < 0.4 && wired.label === '30%',
          `dragging it to 30% writes the setting (${wired.setting}), moves the live bus ` +
          `(${wired.bus}) and updates the readout (${wired.label})`);
      await page.evaluate("window.game.settings.set('ambienceVolume', 1)");
    }

    // =================================================================================
    head('6. FOOTSTEPS, CUES AND THE FALLBACK, LIVE');
    // =================================================================================
    {
      const r = await page.evaluate(async () => {
        const s = window.game.sound, d = s.director, lib = s.library;
        await lib.preload(['step.grass', 'step.pavement',
                           'sfx.door.open', 'sfx.door.open2', 'sfx.door.close', 'sfx.door.close2']);
        const before = d.stats.steps;
        let ok = 0;
        for (let i = 0; i < 12; i++) {
          if (d.footstep(1, i % 2 ? 'grass' : 'pavement')) ok++;
          await new Promise((res) => setTimeout(res, 70));
        }
        const doors = d.cue('door.open') && await new Promise((res) => setTimeout(() => res(d.cue('door.close')), 80));
        return { ok, delta: d.stats.steps - before, doors, voices: lib.voices, dropped: lib.stats.dropped };
      });
      chk(r.ok >= 10 && r.delta === r.ok,
          `${r.ok} of twelve footfalls on two surfaces sounded through the real graph`);
      chk(r.doors === true, 'and a door opened and closed with recorded cues');
      chk(r.voices <= 20, `${r.voices} voices live — the ceiling holds in a real context`);
    }
    {
      /* THE SURFACE IS READ FROM THE REAL WORLD, not from a stub — and since the playtest
         the thing that matters is that WALKING CHANGES IT. This moves the player along the
         real Farmland journey corridor and records which recording each footfall used. */
      const r = await page.evaluate(async () => {
        const g = window.game, d = g.sound.director, p = g.player;
        window.debugTeleportToFarmlands();
        await new Promise((res) => setTimeout(res, 3000));
        const seen = {}, fams = new Set();
        const base = { x: p.position.x, z: p.position.z };
        for (let i = 0; i < 90; i++) {
          p.position.x = base.x + i * 4;
          p.position.z = base.z + ((i * 7) % 40) - 20;
          const y = g.world.findSpawnHeight(Math.floor(p.position.x), Math.floor(p.position.z));
          if (y > 0) p.position.y = y + 1;
          const surf = d.surfaceAt(g.world, p.position.x, p.position.y, p.position.z);
          seen[surf] = (seen[surf] || 0) + 1;
          if (d.footstep(0.9, surf)) fams.add(d.lastStepSurface());
          await new Promise((res) => setTimeout(res, 14));
        }
        return { seen, fams: Array.from(fams) };
      });
      const walked = Object.keys(r.seen);
      chk(walked.length >= 3,
          `walking 360 blocks of the real Farmland corridor crosses ${walked.length} surfaces: ` +
          Object.entries(r.seen).map(([k, v]) => `${k}×${v}`).join(' '));
      chk(r.fams.length >= 3,
          `and the footstep system actually switched recording ${r.fams.length} ways doing it: ` +
          r.fams.join(', '));
    }

    // =================================================================================
    head('7. THE HAVEN AND THE FINALE, THROUGH THEIR REAL ENTRY POINTS');
    // =================================================================================
    {
      const r = await page.evaluate(async () => {
        const s = window.game.sound, lib = s.library;
        s.startHavenAmbience();
        await new Promise((res) => setTimeout(res, 1500));
        const on = Array.from(lib.slots.keys()).filter((k) => k.indexOf('haven.') === 0);
        const stages = [];
        for (const st of HAVEN_STAGES) {
          s.setHavenAmbienceLevels(st.room, st.outside, st.hearth);
          stages.push([st.id, +lib.slots.get('haven.room').level.toFixed(4),
                       +lib.slots.get('haven.fire').level.toFixed(4)]);
        }
        s.stopHavenAmbience();
        await new Promise((res) => setTimeout(res, 2600));
        const off = Array.from(lib.slots.keys()).filter((k) => k.indexOf('haven.') === 0);
        return { on, stages, off, worldScene: s.director.scene };
      });
      chk(r.on.length === 4,
          `the real startHavenAmbience() raised ${r.on.length} recorded layers alongside the ` +
          'synthesised rig: ' + r.on.join(', '));
      let rose = false;
      for (let i = 1; i < r.stages.length; i++) {
        if (r.stages[i][1] > r.stages[i - 1][1] + 1e-9 || r.stages[i][2] > r.stages[i - 1][2] + 1e-9) rose = true;
      }
      chk(!rose, 'driven through the REAL Phase 32 stage table, no recorded layer ever rises');
      const last = r.stages[r.stages.length - 1];
      chk(last[1] === 0 && last[2] === 0, `and the last stage ('${last[0]}') leaves the room and the fire at zero`);
      chk(r.off.length === 0, 'the real stopHavenAmbience() releases every one of them');
    }
    {
      const r = await page.evaluate(async () => {
        const s = window.game.sound, lib = s.library;
        s.startFinaleAudio();
        await new Promise((res) => setTimeout(res, 1500));
        const on = Array.from(lib.slots.keys()).filter((k) => k.indexOf('fin.') === 0);
        const rows = [];
        for (const b of FINALE_BEATS) {
          s.setFinaleBeat(b.id);
          rows.push([b.id, +lib.slots.get('fin.deep').level.toFixed(4)]);
        }
        s.stopFinaleAudio();
        await new Promise((res) => setTimeout(res, 1200));
        const off = Array.from(lib.slots.keys()).filter((k) => k.indexOf('fin.') === 0);
        return { on, rows, off };
      });
      chk(r.on.length === 3, `the real startFinaleAudio() raised ${r.on.length} recorded layers`);
      let fell = false;
      for (let i = 1; i < r.rows.length; i++) if (r.rows[i][1] < r.rows[i - 1][1] - 1e-9) fell = true;
      chk(!fell && r.rows[0][1] === 0,
          "driven through the REAL Phase 33 beat table it only ever rises, and opens on silence");
      chk(r.off.length === 0, 'and the real stopFinaleAudio() releases every one of them');
    }

    // =================================================================================
    head('8. TEARDOWN, AND THE PAGE ITSELF');
    // =================================================================================
    {
      /* THE FRAME LOOP REBUILDS THE SCENE ON THE VERY NEXT FRAME, which is correct — a
         reset is not an off switch — and it means the teardown cannot be observed while
         the loop is driving it. So the loop's one audio call is held for a second, the
         teardown is measured, and then it is put back and the rebuild is measured too.
         Nothing else about the frame is touched. */
      const r = await page.evaluate(async () => {
        const g = window.game, s = g.sound, lib = s.library;
        const wait = (ms) => new Promise((res) => setTimeout(res, ms));
        /* PUT THE PLAYER SOMEWHERE KNOWN FIRST. Earlier blocks teleport across three
           dimensions and stub a world predicate; measuring a teardown against whatever
           they happened to leave behind measures those blocks, not this one. */
        window.debugTeleportToOverworld();
        const t = performance.now();
        while (lib.slots.size === 0 && performance.now() - t < 40000) await wait(250);
        await wait(1500);
        const before = lib.slots.size;
        const buffersBefore = lib.buffers.size;
        const real = g._updateEnvironmentAudio;
        g._updateEnvironmentAudio = () => null;
        await wait(120);
        s.director.reset();
        await wait(900);
        const after = lib.slots.size, voices = lib.voices, scene = s.director.scene;
        g._updateEnvironmentAudio = real;
        await wait(1600);
        return { before, after, voices, scene, buffersBefore, buffersAfter: lib.buffers.size,
                 rebuilt: lib.slots.size };
      });
      chk(r.before > 0 && r.after === 0,
          `reset() takes ${r.before} live beds to ${r.after} in a real graph`);
      chk(r.buffersAfter === r.buffersBefore && r.buffersAfter > 0,
          `while keeping all ${r.buffersAfter} decoded buffers — re-entering a place does not re-download it`);
      chk(r.voices === 0 && r.scene === null,
          'the voice counter is clear and the scene is forgotten');
      chk(r.rebuilt > 0,
          `and the frame loop puts ${r.rebuilt} bed(s) straight back once it resumes — the ` +
          'teardown is a reset, not an off switch');
    }
    {
      const final = await page.evaluate(SNAP);
      chk(final.running, 'the game is still running after all of that');
      chk(errors.length === 0,
          errors.length ? 'PAGE ERRORS: ' + errors.slice(0, 4).join(' | ')
                        : 'and not one page error or console error was raised in the whole run ' +
                          '(the single 404 this file asked for on purpose excepted)');
      chk(final.stats.failed === 1,
          `the library recorded ${final.stats.failed} failed load in the whole session, which is ` +
          'exactly the one section 3 caused — every real asset it asked for arrived');
      note(`the browser requested ${requests.length} audio files, all under assets/audio/runtime/: ` +
           `${requests.every((u) => /\/assets\/audio\/runtime\//.test(u)) ? 'no original was ever fetched' : 'AN ORIGINAL WAS FETCHED'}`);
      chk(requests.length > 0 && requests.every((u) => /\/assets\/audio\/runtime\//.test(u)),
          'the game only ever fetches runtime copies — the 926MB of originals are never served');
      note(`library stats: ${JSON.stringify(final.stats)}`);
      note(`director stats: ${JSON.stringify(final.dstats)}`);
    }

  } catch (e) {
    chk(false, 'the run threw: ' + (e && e.message));
    console.log(e && e.stack);
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (fail) { console.log(`${fail} FAILURES`); process.exit(1); }
  console.log('ALL PHASE 34 BROWSER AUDIO CHECKS PASS');
  note('A real Chromium, a real AudioContext, a real HTTP server and the real files: every');
  note('encode the build ships was fetched and decoded by a real decoder, the beds were swapped');
  note('in a live graph across three scenes, the settings panel moved a live gain node, and the');
  note('Haven and finale were driven through their own real entry points.');
  note('');
  note('NOT CLAIMED: that any of it sounds right. Headless Chromium renders to a null device —');
  note('nothing was heard here either. Whether the mix is good is a judgement for a person.');
})();
