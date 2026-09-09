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
      const r = await page.evaluate(WALK, { secs: SECONDS / places.length });
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
