"use strict";
/* =====================================================================================
   SIMPLEX NOISE
   ERA 1.5.1 — EXTRACTED VERBATIM FROM game.html.

   Pure deterministic math. Every seeded generator in the game stands on it.

   This is a CLASSIC script, not an ES module. It shares one global lexical scope with
   every other file in src/ and with game.html's inline <script>, which is why the move
   needed no code change. Load order is declared in game.html and mirrored by
   tests/harness/load.js; see ARCHITECTURE.md.
   ===================================================================================== */

class SimplexNoise {
  constructor(seed) {
    this.p = new Uint8Array(256);
    let s = seed >>> 0 || 1337;
    const rand = () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17; s >>>= 0;
      s ^= s << 5; s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
    for (let i = 0; i < 256; i++) this.p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = this.p[i]; this.p[i] = this.p[j]; this.p[j] = t;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
    this.grad3 = new Float32Array([
      1,1,0, -1,1,0, 1,-1,0, -1,-1,0,
      1,0,1, -1,0,1, 1,0,-1, -1,0,-1,
      0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1
    ]);
    this.F2 = 0.5 * (Math.sqrt(3) - 1);
    this.G2 = (3 - Math.sqrt(3)) / 6;
    this.F3 = 1 / 3;
    this.G3 = 1 / 6;
  }

  dot3(g, x, y, z) { return g[0] * x + g[1] * y + g[2] * z; }
  dot2(g, x, y) { return g[0] * x + g[1] * y; }

  noise2D(xin, yin) {
    const grad3 = this.grad3, perm = this.perm, permMod12 = this.permMod12;
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * this.F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * this.G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = xin - X0, y0 = yin - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + this.G2, y1 = y0 - j1 + this.G2;
    const x2 = x0 - 1 + 2 * this.G2, y2 = y0 - 1 + 2 * this.G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = permMod12[ii + perm[jj]] * 3;
      t0 *= t0; n0 = t0 * t0 * this.dot2([grad3[gi0], grad3[gi0 + 1]], x0, y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = permMod12[ii + i1 + perm[jj + j1]] * 3;
      t1 *= t1; n1 = t1 * t1 * this.dot2([grad3[gi1], grad3[gi1 + 1]], x1, y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = permMod12[ii + 1 + perm[jj + 1]] * 3;
      t2 *= t2; n2 = t2 * t2 * this.dot2([grad3[gi2], grad3[gi2 + 1]], x2, y2);
    }
    return 70 * (n0 + n1 + n2);
  }

  noise3D(xin, yin, zin) {
    const grad3 = this.grad3, perm = this.perm, permMod12 = this.permMod12;
    let n0, n1, n2, n3;
    const s = (xin + yin + zin) * this.F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * this.G3;
    const X0 = i - t, Y0 = j - t, Z0 = k - t;
    const x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0;
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1;j1=0;k1=0; i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0; i2=1;j2=0;k2=1; }
      else { i1=0;j1=0;k1=1; i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0) { i1=0;j1=0;k1=1; i2=0;j2=1;k2=1; }
      else if (x0 < z0) { i1=0;j1=1;k1=0; i2=0;j2=1;k2=1; }
      else { i1=0;j1=1;k1=0; i2=1;j2=1;k2=0; }
    }
    const x1 = x0 - i1 + this.G3, y1 = y0 - j1 + this.G3, z1 = z0 - k1 + this.G3;
    const x2 = x0 - i2 + 2*this.G3, y2 = y0 - j2 + 2*this.G3, z2 = z0 - k2 + 2*this.G3;
    const x3 = x0 - 1 + 3*this.G3, y3 = y0 - 1 + 3*this.G3, z3 = z0 - 1 + 3*this.G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    n0=n1=n2=n3=0;
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t0 >= 0) { const gi0 = permMod12[ii+perm[jj+perm[kk]]]*3; t0*=t0; n0 = t0*t0*this.dot3([grad3[gi0],grad3[gi0+1],grad3[gi0+2]],x0,y0,z0); }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 >= 0) { const gi1 = permMod12[ii+i1+perm[jj+j1+perm[kk+k1]]]*3; t1*=t1; n1 = t1*t1*this.dot3([grad3[gi1],grad3[gi1+1],grad3[gi1+2]],x1,y1,z1); }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 >= 0) { const gi2 = permMod12[ii+i2+perm[jj+j2+perm[kk+k2]]]*3; t2*=t2; n2 = t2*t2*this.dot3([grad3[gi2],grad3[gi2+1],grad3[gi2+2]],x2,y2,z2); }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 >= 0) { const gi3 = permMod12[ii+1+perm[jj+1+perm[kk+1]]]*3; t3*=t3; n3 = t3*t3*this.dot3([grad3[gi3],grad3[gi3+1],grad3[gi3+2]],x3,y3,z3); }
    return 32 * (n0 + n1 + n2 + n3);
  }

  fbm2(x, y, octaves, lacunarity, gain) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += this.noise2D(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  }
}
