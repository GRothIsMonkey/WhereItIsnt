/* AN OFFLINE FIRST-PERSON RENDERER OVER THE GAME'S OWN CHUNK GEOMETRY.

   This is not a mockup and it is not a diagram. It rasterises the EXACT
   THREE.BufferGeometry that VoxelWorld.generateChunkMesh builds and hands to the GPU —
   the same vertices, the same normals, the same baked per-vertex skylight colours — with
   a z-buffer, a directional term matching the environment's sun, and the dimension's own
   exponential fog. What it does NOT have is the block atlas: every surface is drawn in
   its vertex colour rather than its texture, so read these as SILHOUETTE, MASSING,
   COMPOSITION and SCALE, which is what the phase needs verified, and not as final art.

   No WebGL and no browser are involved, and none is claimed. */
const fs = require('fs');
const zlib = require('zlib');
const THREE = require('three');

function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  const chunks = [];
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    chunks.push(len, td, crc);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunk('IHDR', ihdr); chunk('IDAT', idat); chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]);
}
let _crcTable = null;
function crc32(buf) {
  if (!_crcTable) {
    _crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; _crcTable[n] = c; }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = _crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

/* THE TILE PALETTE, reconstructed rather than sampled.

   buildBlockAtlas paints a real 16px-per-tile canvas, which needs a browser. The colour
   each tile is painted AROUND, though, is data: BLOCK_COLOR for the legacy strip and
   SUB_TILE_DEFS[].c for everything Phase 13 onward. The mesher writes atlas UVs, and the
   strip is one tile wide per material, so floor(u * COUNT) recovers the tile index and
   therefore the material. That is enough to read a render as architecture instead of as
   a grey mass — it is the material's base colour without its pattern, which is exactly
   the fidelity these images are being used at. */
function tilePalette(ev) {
  const BLOCK_COLOR = ev('BLOCK_COLOR');
  const DEFS = ev('SUB_TILE_DEFS');
  const BASE = 39;
  const COUNT = BASE + 1 + DEFS.length;
  const pal = new Array(COUNT);
  for (let i = 0; i < BASE; i++) {
    const e = BLOCK_COLOR[i + 1];
    const hex = e ? e[0] : 0x555555;
    pal[i] = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }
  const grass = BLOCK_COLOR[1] ? BLOCK_COLOR[1][0] : 0x4f8a3a;
  pal[BASE] = [((grass >> 16) & 255) / 255 * 0.8, ((grass >> 8) & 255) / 255 * 0.8, (grass & 255) / 255 * 0.8];
  for (let i = 0; i < DEFS.length; i++) {
    const hex = DEFS[i].c;
    pal[BASE + 1 + i] = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }
  return { pal, COUNT };
}

/* opts: { pos:[x,y,z], look:[x,y,z], W, H, fov, fog, sky, sun, palette } */
function render(world, opts) {
  const W = opts.W || 640, H = opts.H || 360;
  const fov = (opts.fov || 70) * Math.PI / 180;
  const cam = new THREE.PerspectiveCamera(opts.fov || 70, W / H, 0.1, 1200);
  cam.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  cam.lookAt(opts.look[0], opts.look[1], opts.look[2]);
  cam.updateMatrixWorld(true);
  const viewProj = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);

  const color = Buffer.alloc(W * H * 3);
  const depth = new Float32Array(W * H).fill(Infinity);
  const sky = opts.sky || [0x4a, 0x50, 0x46];
  for (let i = 0; i < W * H; i++) { color[i * 3] = sky[0]; color[i * 3 + 1] = sky[1]; color[i * 3 + 2] = sky[2]; }

  const fogD = opts.fog === undefined ? 0.028 : opts.fog;
  const sun = new THREE.Vector3(...(opts.sun || [0.45, 0.82, 0.35])).normalize();
  const eye = cam.position;

  const v = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  const sc = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const cl = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const wd = [0, 0, 0];

  const PAL = opts.palette || null;
  const LIGHTS = opts.lights || null;
  const GAIN = opts.gain === undefined ? 1.55 : opts.gain;
  const INV_G = 1 / (opts.gamma === undefined ? 1.25 : opts.gamma);
  let tris = 0;
  const meshes = [];
  for (const c of world.chunks.values()) {
    if (c.mesh) meshes.push(c.mesh);
    /* Glass meshes are DELIBERATELY skipped. They are the game's transparent pass at
       0.28 opacity; drawn opaquely here they would hide whatever they are supposed to be
       showing, which for the one window in this phase that matters is the entire point.
       A player sees a faint pane and the room beyond it; these renders show the room. */
    if (c.waterMesh) meshes.push(c.waterMesh);
  }
  for (const mesh of meshes) {
    const g = mesh.geometry;
    const pos = g.getAttribute('position'), nrm = g.getAttribute('normal'), col = g.getAttribute('color');
    const uv = g.getAttribute('uv');
    const idx = g.getIndex();
    if (!pos || !idx) continue;
    const N = idx.count;
    for (let t = 0; t < N; t += 3) {
      let behind = 0;
      for (let k = 0; k < 3; k++) {
        const i = idx.getX(t + k);
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        v[k].set(px, py, pz, 1).applyMatrix4(viewProj);
        if (v[k].w <= 0.001) behind++;
        wd[k] = Math.hypot(px - eye.x, py - eye.y, pz - eye.z);
        let lam = 1;
        if (nrm) {
          const d = nrm.getX(i) * sun.x + nrm.getY(i) * sun.y + nrm.getZ(i) * sun.z;
          lam = 0.42 + 0.58 * Math.max(0, d);
        }
        /* POINT LIGHTS. Generated torches are real THREE.PointLights in the game, and
           underground they are the ONLY thing lighting anything — the baked per-vertex
           skylight is zero down there. A render that ignored them showed the buried
           volume as black geometry, which is not what a player with a torch sees. This
           is the same inverse-square-with-range falloff THREE uses at decay 2. */
        if (LIGHTS) {
          for (let li = 0; li < LIGHTS.length; li++) {
            const L = LIGHTS[li];
            const ddx = L[0] - px, ddy = L[1] - py, ddz = L[2] - pz;
            const dd = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
            if (dd > L[4]) continue;
            const att = Math.max(0, 1 - dd / L[4]);
            lam += L[3] * att * att * 0.10;
          }
        }
        let cr = col ? col.getX(i) : 0.7, cg = col ? col.getY(i) : 0.7, cb = col ? col.getZ(i) : 0.7;
        if (PAL && uv) {
          const ti = Math.min(PAL.COUNT - 1, Math.max(0, Math.floor(uv.getX(i) * PAL.COUNT)));
          const m = PAL.pal[ti] || [0.5, 0.5, 0.5];
          cr *= m[0]; cg *= m[1]; cb *= m[2];
        }
        cl[k][0] = cr * lam; cl[k][1] = cg * lam; cl[k][2] = cb * lam;
      }
      if (behind) continue;
      for (let k = 0; k < 3; k++) {
        const iw = 1 / v[k].w;
        sc[k][0] = (v[k].x * iw * 0.5 + 0.5) * W;
        sc[k][1] = (1 - (v[k].y * iw * 0.5 + 0.5)) * H;
        sc[k][2] = v[k].w;
      }
      const minX = Math.max(0, Math.floor(Math.min(sc[0][0], sc[1][0], sc[2][0])));
      const maxX = Math.min(W - 1, Math.ceil(Math.max(sc[0][0], sc[1][0], sc[2][0])));
      const minY = Math.max(0, Math.floor(Math.min(sc[0][1], sc[1][1], sc[2][1])));
      const maxY = Math.min(H - 1, Math.ceil(Math.max(sc[0][1], sc[1][1], sc[2][1])));
      if (maxX < minX || maxY < minY) continue;
      const ax = sc[0][0], ay = sc[0][1], bx = sc[1][0], by = sc[1][1], cx2 = sc[2][0], cy2 = sc[2][1];
      const area = (bx - ax) * (cy2 - ay) - (cx2 - ax) * (by - ay);
      if (Math.abs(area) < 1e-9) continue;
      const ia = 1 / area;
      tris++;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const sx = x + 0.5, sy = y + 0.5;
          let w0 = ((bx - sx) * (cy2 - sy) - (cx2 - sx) * (by - sy)) * ia;
          let w1 = ((cx2 - sx) * (ay - sy) - (ax - sx) * (cy2 - sy)) * ia;
          let w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * sc[0][2] + w1 * sc[1][2] + w2 * sc[2][2];
          const o = y * W + x;
          if (z >= depth[o]) continue;
          depth[o] = z;
          const dist = w0 * wd[0] + w1 * wd[1] + w2 * wd[2];
          const f = Math.exp(-(dist * fogD) * (dist * fogD));
          let r = (w0 * cl[0][0] + w1 * cl[1][0] + w2 * cl[2][0]) * 255;
          let g2 = (w0 * cl[0][1] + w1 * cl[1][1] + w2 * cl[2][1]) * 255;
          let b2 = (w0 * cl[0][2] + w1 * cl[1][2] + w2 * cl[2][2]) * 255;
          /* EXPOSURE. The Rotting Fields' palette is deliberately dark — nothing in it is
             brighter than the fog — and a straight linear write comes out as a near-black
             plate that cannot be read for composition. A fixed gain and gamma lift it the
             way a screenshot with the monitor turned up would; it changes nothing about
             the geometry, and it is applied identically to every image here. */
          r = Math.pow(Math.min(1, (r / 255) * GAIN), INV_G) * 255;
          g2 = Math.pow(Math.min(1, (g2 / 255) * GAIN), INV_G) * 255;
          b2 = Math.pow(Math.min(1, (b2 / 255) * GAIN), INV_G) * 255;
          r = r * f + sky[0] * (1 - f); g2 = g2 * f + sky[1] * (1 - f); b2 = b2 * f + sky[2] * (1 - f);
          color[o * 3] = Math.max(0, Math.min(255, r | 0));
          color[o * 3 + 1] = Math.max(0, Math.min(255, g2 | 0));
          color[o * 3 + 2] = Math.max(0, Math.min(255, b2 | 0));
        }
      }
    }
  }
  /* THE FOG-EXEMPT LAYER. The water tower's distant silhouette is a scene Group, not
     chunk geometry, and it is the whole reason the landmark is visible past sixty blocks
     — so a render that leaves it out is not showing what a player sees. Drawn after the
     world, depth-tested against the same buffer (so terrain in front still occludes it),
     alpha-blended at whatever opacity updateFarmTowerLight computed, and with no fog,
     exactly as the material is configured in the game. */
  if (opts.proxy && opts.proxy.visible !== false) {
    opts.proxy.updateMatrixWorld(true);
    const m4 = new THREE.Matrix4();
    for (const child of opts.proxy.children) {
      const mat = child.material;
      if (!mat || mat.opacity <= 0.01) continue;
      const g = child.geometry;
      const pos = g.getAttribute('position');
      const idx = g.getIndex();
      const n = idx ? idx.count : pos.count;
      m4.copy(child.matrixWorld);
      const cr = mat.color.r * 255, cg = mat.color.g * 255, cb = mat.color.b * 255;
      const al = mat.opacity;
      for (let t = 0; t < n; t += 3) {
        let behind = 0;
        for (let k = 0; k < 3; k++) {
          const i = idx ? idx.getX(t + k) : t + k;
          v[k].set(pos.getX(i), pos.getY(i), pos.getZ(i), 1).applyMatrix4(m4).applyMatrix4(viewProj);
          if (v[k].w <= 0.001) behind++;
        }
        if (behind) continue;
        for (let k = 0; k < 3; k++) {
          const iw = 1 / v[k].w;
          sc[k][0] = (v[k].x * iw * 0.5 + 0.5) * W;
          sc[k][1] = (1 - (v[k].y * iw * 0.5 + 0.5)) * H;
          sc[k][2] = v[k].w;
        }
        const minX = Math.max(0, Math.floor(Math.min(sc[0][0], sc[1][0], sc[2][0])));
        const maxX = Math.min(W - 1, Math.ceil(Math.max(sc[0][0], sc[1][0], sc[2][0])));
        const minY = Math.max(0, Math.floor(Math.min(sc[0][1], sc[1][1], sc[2][1])));
        const maxY = Math.min(H - 1, Math.ceil(Math.max(sc[0][1], sc[1][1], sc[2][1])));
        if (maxX < minX || maxY < minY) continue;
        const ax = sc[0][0], ay = sc[0][1], bx = sc[1][0], by = sc[1][1], cx2 = sc[2][0], cy2 = sc[2][1];
        const area = (bx - ax) * (cy2 - ay) - (cx2 - ax) * (by - ay);
        if (Math.abs(area) < 1e-9) continue;
        const ia = 1 / area;
        for (let y = minY; y <= maxY; y++)
          for (let x = minX; x <= maxX; x++) {
            const sx = x + 0.5, sy = y + 0.5;
            const w0 = ((bx - sx) * (cy2 - sy) - (cx2 - sx) * (by - sy)) * ia;
            const w1 = ((cx2 - sx) * (ay - sy) - (ax - sx) * (cy2 - sy)) * ia;
            const w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const z = w0 * sc[0][2] + w1 * sc[1][2] + w2 * sc[2][2];
            const o = y * W + x;
            if (z >= depth[o]) continue;
            color[o * 3] = Math.max(0, Math.min(255, color[o * 3] * (1 - al) + cr * al)) | 0;
            color[o * 3 + 1] = Math.max(0, Math.min(255, color[o * 3 + 1] * (1 - al) + cg * al)) | 0;
            color[o * 3 + 2] = Math.max(0, Math.min(255, color[o * 3 + 2] * (1 - al) + cb * al)) | 0;
          }
      }
    }
  }

  return { png: encodePNG(W, H, color), tris };
}

function save(path, world, opts) {
  const r = render(world, opts);
  fs.writeFileSync(path, r.png);
  return r;
}
module.exports = { render, save, tilePalette };
