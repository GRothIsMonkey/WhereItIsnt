"use strict";
/* =====================================================================================
   THE SKY ENVIRONMENT — WHAT A PBR SURFACE SEES WHEN IT LOOKS AWAY FROM THE SUN
   D1 IMPLEMENTATION PHASE 4 — RENDERER / PBR CORRECTION. NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY IT EXISTS

   A `MeshStandardMaterial` gets two kinds of light: DIRECT (the sun, a lamp) and AMBIENT.
   three's ambient and hemisphere lights feed only the DIFFUSE half of the ambient term — and
   a metal has no diffuse half. So the approved fence's galvanised strap, metalness 1 by its
   own map, received the sun's highlight and nothing else, and read darker than the timber it
   is bolted to (D1 Phase 4, `tests/browser-asset-scene.js`). In Blender it reflects the sky.

   The physical answer is to give PBR materials the sky itself: `scene.environment`, a
   prefiltered (PMREM) environment map, which feeds BOTH the diffuse irradiance and the
   rough specular reflection every Standard material computes.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE SMALLEST VERSION THAT IS PHYSICALLY USEFUL

   The environment is not an HDR photograph. It is a gradient — zenith, horizon, ground —
   painted on the inside of one sphere, scaled by an intensity, and prefiltered once by
   three's own `PMREMGenerator`. That is enough for the thing it has to do (a rough metal
   reading as metal, a diffuse surface receiving sky light), costs one small cube render
   and blur per rebuild, and follows whatever sky the game is showing — which is what keeps
   night dark: at night the caller's intensity falls and the environment goes with it.

   IT REBUILDS ONLY WHEN THE SKY HAS CHANGED, at most once per `minInterval` seconds of GAME
   time, AND ONLY WHEN SOMETHING WILL READ IT: `update` asks whether any ATTACHED scene holds a
   Standard/Physical material (an early-exit walk, at most once per interval) and stands down
   if none does. A rebuild nobody sees is GPU work for nothing — measured at up to ~280 ms a
   time under a software rasteriser. Attaching a scene clears the cooldown, so a scene with PBR
   content is lit on the very next update. `update(dt)` subtracts from a number; there is no
   timer anywhere in this file.

   ATTACH IT ONLY TO A SCENE THAT HOLDS PBR CONTENT. r128 hands `scene.environment` to
   Standard/Physical materials alone, but r152+ hands it to LAMBERT AND PHONG too — so on the
   prepared r186 upgrade an environment on the voxel scene would add a second ambient term to
   the whole Era 1 world. Measured, not assumed: `tests/browser-color-pipeline.js --r186` saw
   160,955 channel values move when it was attached to the voxel scene. So the environment
   that follows the game's sky is OWNED by EnvironmentSystem and attached by whatever scene
   has PBR content (D1, when it is live); the voxel scene never gets one.

   ONE CAUTION FOR THE PHASE THAT LIGHTS D1 (E2.5). An ambient or hemisphere light ALSO feeds
   a Standard material's diffuse term, so a PBR scene lit by this AND a strong ambient light
   counts its sky twice. The representative scene uses a sun plus this and no ambient term.

   CLASSIC script. Names THREE only inside function bodies. See ARCHITECTURE.md section 4.15.
   ===================================================================================== */

const SKY_ENV_DEFAULTS = Object.freeze({
  minInterval: 2.0,     // seconds of game time between rebuilds, at most
  tolerance: 0.04,      // a rebuild needs a channel to move by 4% of its value (or 0.004)
  /* Measured on the Overworld's continuously-moving sky: about one rebuild every five game
     seconds across a whole day, each a few milliseconds of GPU work (tens under a software
     rasteriser). A 4% step in an ambient term is below what the eye tracks on a surface
     that is itself changing with the day. */
  segments: 32,         // the gradient sphere; the PMREM blur makes more pointless
});

class SkyEnvironment {
  constructor(renderer, opts) {
    const o = Object.assign({}, SKY_ENV_DEFAULTS, opts || {});
    this.renderer = renderer;
    this.minInterval = o.minInterval;
    this.tolerance = o.tolerance;
    this.segments = o.segments;
    this.texture = null;        // what scene.environment points at
    this._target = null;        // the PMREM render target that owns it
    this._pmrem = null;
    this._sphere = null;
    this._scene = null;
    this._built = null;         // the 9 numbers the current texture was built from
    this._pending = null;       // the 9 numbers most recently asked for
    this._cooldown = 0;
    this._scenes = new Set();   // scenes whose `.environment` this keeps current
    this.stats = { builds: 0, lastMs: 0, maxMs: 0, requests: 0, skippedNoConsumer: 0 };
  }

  /* What the environment should look like. Colours are THREE.Color (linear — the colour
     pipeline has already decoded any hex that made them) or hex numbers; `intensity`
     scales all three. Cheap: stores nine numbers. */
  request(zenith, horizon, ground, intensity) {
    const k = (typeof intensity === 'number' && isFinite(intensity)) ? Math.max(0, intensity) : 1;
    const lin = (c) => {
      const col = (c && typeof c.r === 'number') ? c : new THREE.Color(c === undefined ? 0 : c);
      return [col.r * k, col.g * k, col.b * k];
    };
    this._pending = lin(zenith).concat(lin(horizon), lin(ground));
    this.stats.requests++;
    return this;
  }

  /* Rebuild if the requested sky differs from the built one and the cooldown allows.
     Returns true when it rebuilt. */
  update(dt) {
    this._cooldown -= (typeof dt === 'number' && isFinite(dt)) ? dt : 0;
    if (!this._pending || this._cooldown > 0 || !this._canBuild() || !this._differs()) return false;
    if (!this._hasConsumer()) {
      this._cooldown = this.minInterval;
      this.stats.skippedNoConsumer++;
      return false;
    }
    this._build();
    this._cooldown = this.minInterval;
    return true;
  }

  /* Build now, ignoring the cooldown — for a scene that is being set up, or a test. */
  buildNow() {
    if (!this._pending || !this._canBuild()) return false;
    this._build();
    this._cooldown = this.minInterval;
    return true;
  }

  attach(scene) {
    if (!scene) return;
    this._scenes.add(scene);
    scene.environment = this.texture;
    this._cooldown = 0;          // a newly attached scene is brought up to date on the next update
  }

  detach(scene) {
    if (!scene) return;
    this._scenes.delete(scene);
    if (scene.environment === this.texture) scene.environment = null;
  }

  /* Everything this owns: the PMREM target (and so its texture), the generator, the
     gradient sphere. Attached scenes lose their environment rather than keep a disposed
     texture. */
  dispose() {
    for (const s of this._scenes) if (s.environment === this.texture) s.environment = null;
    this._scenes.clear();
    if (this._target) this._target.dispose();
    if (this._pmrem) this._pmrem.dispose();
    if (this._sphere) { this._sphere.geometry.dispose(); this._sphere.material.dispose(); }
    this._target = this.texture = this._pmrem = this._sphere = this._scene = null;
    this._built = null;
  }

  debugReport() {
    return Object.assign({ built: !!this.texture, scenes: this._scenes.size,
                           sky: this._built ? this._built.slice() : null }, this.stats);
  }

  /* ---- internals -------------------------------------------------------------------- */

  /* A renderer and a real three — not the stub the offline suites evaluate the build with. */
  _canBuild() {
    return !!this.renderer && typeof THREE !== 'undefined' &&
           typeof THREE.PMREMGenerator === 'function' && typeof THREE.SphereGeometry === 'function';
  }

  /* Does any attached scene contain a material that reads `scene.environment`? An explicit
     stack walk that stops at the first one, so a scene with PBR content costs a handful of
     visits and a scene without costs one pass — at most once per interval. */
  _hasConsumer() {
    for (const scene of this._scenes) {
      const stack = [scene];
      while (stack.length) {
        const o = stack.pop();
        const m = o.material;
        if (m) {
          if (m.isMeshStandardMaterial) return true;
          if (Array.isArray(m)) for (const x of m) if (x && x.isMeshStandardMaterial) return true;
        }
        const ch = o.children;
        if (ch) for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
      }
    }
    return false;
  }

  _differs() {
    const a = this._pending, b = this._built;
    if (!b) return true;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > Math.max(0.004, this.tolerance * Math.max(a[i], b[i]))) return true;
    }
    return false;
  }

  _ensureScene() {
    if (this._scene) return;
    const geo = new THREE.SphereGeometry(10, this.segments, this.segments / 2);
    const count = geo.attributes.position.count;
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide,
                                              depthWrite: false, fog: false });
    this._sphere = new THREE.Mesh(geo, mat);
    this._scene = new THREE.Scene();
    this._scene.add(this._sphere);
  }

  /* Paint the gradient, then let three prefilter it. Above the horizon the sky blends from
     horizon to zenith; below it the ground takes over quickly, as it does outdoors. */
  _paint(p) {
    const pos = this._sphere.geometry.attributes.position;
    const col = this._sphere.geometry.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10;
      let a, b, t;
      if (y >= 0) { a = 3; b = 0; t = Math.pow(y, 0.6); }
      else        { a = 3; b = 6; t = Math.min(1, Math.pow(-y, 0.35)); }
      col.setXYZ(i, p[a] + (p[b] - p[a]) * t, p[a + 1] + (p[b + 1] - p[a + 1]) * t,
                 p[a + 2] + (p[b + 2] - p[a + 2]) * t);
    }
    col.needsUpdate = true;
  }

  _build() {
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
    this._ensureScene();
    this._paint(this._pending);
    if (!this._pmrem) this._pmrem = new THREE.PMREMGenerator(this.renderer);
    const next = this._pmrem.fromScene(this._scene, 0, 0.1, 100);
    const old = this._target;
    this._target = next;
    this.texture = next.texture;
    for (const s of this._scenes) s.environment = this.texture;
    if (old) old.dispose();
    this._built = this._pending.slice();
    const ms = ((typeof performance !== 'undefined') ? performance.now() : 0) - t0;
    this.stats.builds++;
    this.stats.lastMs = ms;
    if (ms > this.stats.maxMs) this.stats.maxMs = ms;
  }
}
