/* =====================================================================================
   PHASE 35 — MEASURE EVERY RUNTIME AUDIO ASSET, IN A REAL DECODER.

   NOT A TEST. It asserts nothing and changes nothing. It boots Chromium, serves the
   repository over HTTP, fetches every file in `assets/audio/runtime/` and decodes it with
   a real `AudioContext.decodeAudioData` — the same decoder the game uses — then reports
   what is actually in each file: duration, true peak, RMS, DC offset, samples pinned at
   full scale, and leading silence.

   WHY IT HAD TO BE A BROWSER. Half the runtime library is MP3, and nothing offline in
   this repository can decode one. Python's `wave` module can measure the 153 WAVs and is
   blind to the other 121 — which is exactly how a build-time fault could sit in the MP3
   half of the library unseen.

   WHAT IT FOUND THE FIRST TIME IT WAS RUN. `build_runtime.py` computes a one-shot's gain
   from `window_rms_db`, which decodes to MONO at 22.05 kHz — and then took the PEAK from
   that same downmix to enforce `PEAK_CEIL`. A 22 kHz downmix is low-passed at 11 kHz and
   averaged across channels, so it under-reads the true peak of exactly the material a
   one-shot is made of: transients. The ceiling was therefore never actually enforced for
   any `sfx`, eight of them shipped above it, and two shipped clipped.

   RUN IT AFTER ANY REBUILD OF assets/audio/runtime/:

       node tests/tools/measure_runtime.js            # the report
       node tests/tools/measure_runtime.js --json out.json
   ===================================================================================== */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..', '..');
const RUNTIME = path.join(ROOT, 'assets', 'audio', 'runtime');
const PORT = Number(process.env.WII_MEASURE_PORT || 8253);
const PEAK_CEIL_DB = -1.5;         // the ceiling build_runtime.py states and intends
/* PHASE 36 — a hundredth of a decibel of measurement tolerance. A file BUILT to land on
   the ceiling decodes at -1.4999... as often as at -1.5001..., and listing it as "above
   the ceiling" is arithmetic noise, not a finding. It is deliberately far too small to
   hide anything: the smallest real overshoot this instrument has ever reported was
   0.02 dB and the largest was 8.9. */
const PEAK_EPS_DB = 0.01;

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; }
}
if (!chromium) { console.log('SKIP  playwright is not installed — nothing measured.'); process.exit(0); }

const MIME = { '.html': 'text/html', '.js': 'application/javascript',
               '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
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

function list() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(ROOT, p).split(path.sep).join('/'));
    }
  };
  walk(RUNTIME);
  out.sort();
  return out;
}

(async () => {
  const files = list();
  const srv = await serve();
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(`http://127.0.0.1:${PORT}/tests/tools/measure_runtime.js`, { waitUntil: 'load' })
    .catch(() => {});
  await page.setContent('<!doctype html><title>measure</title>');

  const rows = await page.evaluate(async (args) => {
    const { port, files } = args;
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    const out = [];
    for (const f of files) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/${f}`);
        const buf = await r.arrayBuffer();
        const ab = await ctx.decodeAudioData(buf);
        let peak = 0, sum = 0, dc = 0, pinned = 0, n = 0, firstLoud = -1;
        const thr = Math.pow(10, -60 / 20);
        for (let c = 0; c < ab.numberOfChannels; c++) {
          const d = ab.getChannelData(c);
          for (let i = 0; i < d.length; i++) {
            const v = d[i], a = v < 0 ? -v : v;
            if (a > peak) peak = a;
            if (a >= 0.9995) pinned++;
            if (firstLoud < 0 && a > thr) firstLoud = i;
            sum += v * v; dc += v; n++;
          }
        }
        out.push({ f: f, ch: ab.numberOfChannels, sr: ab.sampleRate,
                   dur: +ab.duration.toFixed(2), peak: peak, rms: Math.sqrt(sum / n),
                   dc: dc / n, pinned: pinned,
                   lead: firstLoud < 0 ? ab.duration : +(firstLoud / ab.sampleRate).toFixed(3) });
      } catch (e) {
        out.push({ f: f, error: String(e && e.message || e) });
      }
    }
    return out;
  }, { port: PORT, files });

  await browser.close(); srv.close();

  const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
  const bad = rows.filter(r => r.error);
  const ok = rows.filter(r => !r.error);
  const hot = ok.filter(r => db(r.peak) > PEAK_CEIL_DB + PEAK_EPS_DB).sort((a, b) => db(b.peak) - db(a.peak));
  const clipped = ok.filter(r => r.pinned > 4).sort((a, b) => b.pinned - a.pinned);
  const dcy = ok.filter(r => Math.abs(r.dc) > 0.005).sort((a, b) => Math.abs(b.dc) - Math.abs(a.dc));
  const quiet = ok.filter(r => db(r.rms) < -60);

  console.log(`MEASURED ${ok.length} of ${rows.length} runtime assets in a real decoder ` +
              `(${ok.filter(r => /\.mp3$/.test(r.f)).length} mp3, ${ok.filter(r => /\.wav$/.test(r.f)).length} wav)`);
  if (bad.length) { console.log(`\nWOULD NOT DECODE (${bad.length}):`); for (const r of bad) console.log('  ' + r.f + ' — ' + r.error); }

  console.log(`\nPEAK ABOVE THE ${PEAK_CEIL_DB} dBFS CEILING (${hot.length}):`);
  for (const r of hot) console.log(`  ${r.f.replace('assets/audio/runtime/', '').padEnd(28)} peak ${db(r.peak).toFixed(2).padStart(7)} dBFS   rms ${db(r.rms).toFixed(1).padStart(6)}   ${r.pinned} samples at FS`);
  if (!hot.length) console.log('  none');

  console.log(`\nCLIPPED — more than four samples pinned at full scale (${clipped.length}):`);
  for (const r of clipped) console.log(`  ${r.f.replace('assets/audio/runtime/', '').padEnd(28)} ${r.pinned} samples`);
  if (!clipped.length) console.log('  none');

  console.log(`\nDC OFFSET above 0.005 (${dcy.length}):`);
  for (const r of dcy) console.log(`  ${r.f.replace('assets/audio/runtime/', '').padEnd(28)} ${r.dc.toFixed(4)}`);
  if (!dcy.length) console.log('  none');

  console.log(`\nNEAR-SILENT — rms under -60 dBFS (${quiet.length}):`);
  for (const r of quiet) console.log(`  ${r.f.replace('assets/audio/runtime/', '').padEnd(28)} rms ${db(r.rms).toFixed(1)} dBFS`);
  if (!quiet.length) console.log('  none');

  const rmsAll = ok.map(r => db(r.rms)).sort((a, b) => a - b);
  console.log(`\nRMS SPREAD across the whole library: ${rmsAll[0].toFixed(1)} .. ${rmsAll[rmsAll.length - 1].toFixed(1)} dBFS ` +
              `(median ${rmsAll[Math.floor(rmsAll.length / 2)].toFixed(1)})`);

  const jsonAt = process.argv.indexOf('--json');
  if (jsonAt > 0 && process.argv[jsonAt + 1]) {
    fs.writeFileSync(process.argv[jsonAt + 1], JSON.stringify(rows, null, 1));
    console.log('\nwrote ' + process.argv[jsonAt + 1]);
  }
})().catch(e => { console.error(e); process.exit(1); });
