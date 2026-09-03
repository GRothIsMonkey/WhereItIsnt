const { makeWorld } = require('./world.js');

function genRegion(w, x0, z0, x1, z1) {
  const c0 = Math.floor(x0 / 16), c1 = Math.floor(x1 / 16);
  const d0 = Math.floor(z0 / 16), d1 = Math.floor(z1 / 16);
  const out = [];
  for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) out.push(w._generateChunk(cx, cz));
  return out;
}
function hashChunk(c) {
  let h = 2166136261 >>> 0;
  const d = c.data;
  for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function blockAt(w, x, y, z) { return w.getBlockWorld(x, y, z); }

module.exports = { makeWorld, genRegion, hashChunk, blockAt };
