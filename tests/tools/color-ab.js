/* D1 IMPLEMENTATION PHASE 4 — THE LEGACY COLOUR A/B. AN INSTRUMENT: IT ASSERTS NOTHING.

   The renderer / PBR correction pass changed where every colour in the game is decoded and
   encoded, and re-expressed every Era 1 light in linear terms. This serves TWO builds —
   the one before the pass and the working tree — boots each in a real Chromium over HTTP,
   renders the same poses through each build's own PostFX pass, and prints what reached the
   screen: mean luma and the 10th / 50th / 90th percentiles, per pose, side by side.

   It is the tool that says whether a legacy scene moved, by how much, and where in its
   range. `tests/browser-color-pipeline.js` then asserts the properties that must HOLD
   (night is dark, one encode, nothing leaks); this file is what produced the numbers those
   properties were checked against, and what a later phase re-runs before touching colour.

   USAGE
       git worktree add /tmp/wii-before <commit-before-the-change>
       node tests/tools/color-ab.js /tmp/wii-before
   Frames are written to tests/renders/color-ab/{before,after}-<pose>.png.

   Clouds are hidden in both builds (their positions come from Math.random) and each frame is
   rendered synchronously inside one evaluate, so the day cannot move between the pose and
   the pixels. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const AFTER = path.join(__dirname, '..', '..');
const BEFORE = process.argv[2];
if (!BEFORE || !fs.existsSync(path.join(BEFORE, 'game.html'))) {
  console.log('usage: node tests/tools/color-ab.js <path to a checkout of the build before>');
  process.exit(2);
}
const OUT = path.join(__dirname, '..', 'renders', 'color-ab');

let chromium = null;
try { chromium = require('playwright').chromium; }
catch (e) { try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; } catch (e2) { chromium = null; } }
if (!chromium) { console.log('SKIP  playwright is not installed.'); process.exit(0); }

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
               '.glb': 'model/gltf-binary', '.png': 'image/png' };
function serve(root, port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'game.html';
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

/* The poses. `t` is the Overworld cycle second; `dim` picks a dev teleport. */
const POSES = [
  { name: 'overworld-noon',    dim: 'overworld', t: 200, yaw: 0.7,  pitch: -0.12 },
  { name: 'overworld-dusk',    dim: 'overworld', t: 410, yaw: 0.7,  pitch: -0.12 },
  { name: 'overworld-night',   dim: 'overworld', t: 560, yaw: 0.7,  pitch: -0.12 },
  { name: 'overworld-night-2', dim: 'overworld', t: 560, yaw: 3.6,  pitch: -0.25 },
  { name: 'farmlands-day',     dim: 'farmlands', t: 200, yaw: 1.2,  pitch: -0.08 },
  { name: 'suburbia',          dim: 'suburbia',  t: 200, yaw: 0.4,  pitch: -0.05 },
  { name: 'd1-terrain',        dim: 'd1' },
];

/* Reads the canvas the frame was just drawn into: mean and percentiles of display luma,
   plus the frame itself. Installed as an init script so it exists before the game does. */
const GRAB = () => {
  window.__grab = () => {
    const c = window.game.renderer.domElement, W = 275, H = 175;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d'); x.drawImage(c, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data, L = [];
    let s = 0;
    for (let i = 0; i < d.length; i += 4) { const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; L.push(l); s += l; }
    L.sort((a, b) => a - b);
    const q = (f) => L[Math.floor(L.length * f)];
    return { mean: s / L.length, p10: q(0.1), p50: q(0.5), p90: q(0.9), png: c.toDataURL('image/png') };
  };
};

/* Every page call gets its own limit, so one stalled pose costs that pose, not the run. */
const LIMIT_MS = 240000;
function withLimit(promise, what) {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(what + ' took over ' + LIMIT_MS / 1000 + ' s')), LIMIT_MS); })])
    .finally(() => clearTimeout(t));
}
const show = (tag, name, m) => console.log('  ' + tag.padEnd(7) + name.padEnd(20) +
  (m.error ? 'ERROR ' + m.error : m.mean.toFixed(3) + ' (' + m.p10.toFixed(3) + ' / ' + m.p50.toFixed(3) + ' / ' + m.p90.toFixed(3) + ')'));

async function measure(root, port, tag) {
  const srv = await serve(root, port);
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  await page.addInitScript(() => {
    const o = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, a) {
      if (/webgl/.test(t)) a = Object.assign({}, a || {}, { preserveDrawingBuffer: true });
      return o.call(this, t, a);
    };
  });
  await page.addInitScript(GRAB);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 160)));
  const out = {};
  try {
    await page.goto('http://127.0.0.1:' + port + '/game.html', { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => !!window.game, null, { timeout: 90000 });
    await page.evaluate(() => document.getElementById('clickPlay').click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (window.game.film && window.game.film.active) window.game.film.skip(); });
    await page.waitForFunction(() => window.game.running === true, null, { timeout: 120000 });

    for (const P of POSES) {
      if (P.dim === 'd1') {
        out[P.name] = await page.evaluate(() => {
          /* browser-terrain.js's own rig, unchanged: the E2.2 foundation as it was tested. */
          const g = window.game;
          const scene = new THREE.Scene();
          scene.add(new THREE.AmbientLight(0xffffff, 0.55));
          const sun = new THREE.DirectionalLight(0xffffff, 1.1);
          sun.position.set(-180, 260, 120); scene.add(sun);
          const w = new D1TerrainWorld(scene, null, null);
          w.begin(0, 0);
          const cam = new THREE.PerspectiveCamera(70, 1100 / 700, 0.1, 3000);
          const s = w.spawnPointAt(0, 0);
          cam.position.set(s.x, s.y + 1.6, s.z); cam.lookAt(s.x + 60, s.y + 2, s.z + 60);
          const p = g.postfx, o = { scene: p.scene, camera: p.camera };
          p.scene = scene; p.camera = cam;
          try { p.render(0, 1.0); } finally { p.scene = o.scene; p.camera = o.camera; }
          const res = window.__grab();
          w.dispose(false);
          return res;
        }).catch((e) => ({ error: e.message }));
        show(tag, P.name, out[P.name]);
      } else {
        await withLimit(page.evaluate((P) => {
          const g = window.game;
          if (P.dim === 'farmlands' && !g.player.inFarmlands) window.debugTeleportToFarmlands();
          if (P.dim === 'suburbia' && !g.player.inSuburbia) window.debugTeleportToSuburbia();
          g.player.velocity.set(0, 0, 0); g.player.yaw = P.yaw; g.player.pitch = P.pitch;
          g.world.updateChunks(g.player.position);
        }, P), P.name + ' pose');
        for (let i = 0; i < 6; i++) {
          await page.evaluate(() => window.game.world.updateChunks(window.game.player.position));
          await page.waitForTimeout(700);
        }
        await page.waitForTimeout(1500);
        out[P.name] = await withLimit(page.evaluate((P) => {
          const g = window.game;
          g.player.yaw = P.yaw; g.player.pitch = P.pitch;
          g.camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
          g.env.t = P.t;
          g.env.cloudGroup.visible = false;
          g.env.update(0);
          g.postfx.render(0, 1.0);
          return window.__grab();
        }, P), P.name + ' frame').catch((e) => ({ error: e.message }));
        show(tag, P.name, out[P.name]);
      }
    }
    /* THE COST SIDE, LAST, so a slow machine loses it rather than the poses. Back at the
       Overworld spawn at noon: draw calls for one world frame, what the renderer holds
       resident, and the mean wall time of five full frames through PostFX, each made to
       finish by a 1-pixel readback. Under a software rasteriser this is CPU time; it compares
       the two builds, it does not predict a GPU. */
    out.__cost = await withLimit(page.evaluate(() => {
      const g = window.game, r = g.renderer, gl = r.getContext();
      if (g.player.inSuburbia || g.player.inFarmlands) window.debugTeleportToOverworld();
      g.env.t = 200; g.env.cloudGroup.visible = false; g.env.update(0);
      const px = new Uint8Array(4);
      const frame = () => { g.postfx.render(0, 1.0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      frame();
      r.setRenderTarget(g.postfx.target); r.render(g.scene, g.camera); r.setRenderTarget(null);
      const calls = r.info.render.calls, tris = r.info.render.triangles;
      const t0 = performance.now();
      for (let i = 0; i < 5; i++) frame();
      const ms = (performance.now() - t0) / 5;
      return { calls, tris, ms, textures: r.info.memory.textures, geometries: r.info.memory.geometries,
               programs: r.info.programs ? r.info.programs.length : null,
               targetType: g.postfx.target.texture.type };
    }), 'cost').catch((e) => ({ error: e.message }));
  } catch (e) {
    out.__error = e.message;
  } finally {
    out.__errors = errors;
    await browser.close(); srv.close();
  }
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const before = await measure(BEFORE, 8431, 'before');
  const after = await measure(AFTER, 8432, 'after');

  console.log('\nLEGACY COLOUR A/B — mean luma (p10 / p50 / p90), through each build\'s own PostFX pass');
  console.log('pose'.padEnd(20) + 'before'.padEnd(34) + 'after'.padEnd(34) + 'mean ratio');
  for (const P of POSES) {
    const a = before[P.name], b = after[P.name];
    const f = (m) => (!m || m.error) ? ('ERROR ' + (m && m.error || 'missing')).padEnd(34)
      : (m.mean.toFixed(3) + ' (' + m.p10.toFixed(3) + ' / ' + m.p50.toFixed(3) + ' / ' + m.p90.toFixed(3) + ')').padEnd(34);
    const ratio = (a && b && a.mean && b.mean) ? (b.mean / a.mean).toFixed(2) : '-';
    console.log(P.name.padEnd(20) + f(a) + f(b) + ratio);
    for (const [tag, m] of [['before', a], ['after', b]]) {
      if (m && m.png) fs.writeFileSync(path.join(OUT, tag + '-' + P.name + '.png'),
                                       Buffer.from(m.png.split(',')[1], 'base64'));
    }
  }
  console.log('\nCOST AT THE OVERWORLD NOON POSE (one world frame; mean of 20 synchronised PostFX frames)');
  for (const [tag, r] of [['before', before], ['after', after]]) {
    const c = r.__cost;
    if (!c) { console.log(tag.padEnd(8) + 'not measured'); continue; }
    console.log(tag.padEnd(8) + 'draw calls ' + c.calls + ', triangles ' + c.tris.toLocaleString() + ', textures ' + c.textures +
                ', geometries ' + c.geometries + ', programs ' + c.programs + ', scene target type ' + c.targetType +
                ', frame ' + c.ms.toFixed(1) + ' ms');
  }
  for (const [tag, r] of [['before', before], ['after', after]]) {
    if (r.__error) console.log(tag + ' run error: ' + r.__error);
    if (r.__errors && r.__errors.length) console.log(tag + ' page errors: ' + r.__errors.join(' | '));
  }
  console.log('\nframes: tests/renders/color-ab/');
})();
