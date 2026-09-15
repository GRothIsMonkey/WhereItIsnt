"use strict";
/* =====================================================================================
   THE ASSET LIBRARY — FETCH, DECODE, CACHE, CLONE, DISPOSE
   ERA 2, PHASE E2.0a — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE THREE LAYERS, THE SAME SPLIT SECTION 61 MADE FOR AUDIO

     asset-registry.js   WHAT EXISTS. Keys, paths, licences, collision modes. No code.
     asset-library.js    FILES. Fetching, decoding, caching, reference counting, disposal
                         and failing safely. Knows nothing about dimensions, chunks,
                         blocks, the player or the game.
     (a future director) POLICY. Which asset belongs in which place. NOT E2.0a's —
                         placing anything requires creative decisions that have not been
                         supplied.

   `tests/architecture.js` fails if this file names a block id, a chunk, a dimension or
   the DOM. It is handed a renderer and nothing else.

   ─────────────────────────────────────────────────────────────────────────────────────
   REQUESTED, LOADED, INSTANTIATED, DISPOSED ARE FOUR DIFFERENT CLAIMS

   CLAUDE.md section 61.06 wrote that sentence after two phases were spent reading state
   that reported success while the player heard silence. Every one of the four is counted
   separately in `stats`, and `debugReport()` prints them beside the renderer's OWN
   resource counters — `renderer.info.memory` — because what this library believes it has
   freed and what the renderer still holds are, again, two different claims, and only the
   second one is the truth.

   ─────────────────────────────────────────────────────────────────────────────────────
   ONE SOURCE, MANY CLONES, ONE OWNER

   `load()` produces a SOURCE — the decoded scene graph, normalised once. `acquire()`
   returns a CLONE of it; a clone shares its geometries, materials and textures with the
   source, which is the point: a hundred road signs are one geometry upload.

   So disposal is refcounted and the SOURCE owns the GPU resources. `release()` drops a
   reference; the last release disposes. **Nothing is ever disposed while a live instance
   still points at it**, which is the failure mode the user's brief names explicitly, and
   `tests/browser-assets.js` proves it against `renderer.info.memory` rather than against
   this file's own bookkeeping.

   ─────────────────────────────────────────────────────────────────────────────────────
   A DEAD TRANSPORT IS A DIFFERENT FAULT FROM A DEAD ASSET

   Section 61.07, in the other subsystem, cost three playtests. One asset failing is a
   content bug. EVERY asset failing is a missing subsystem, and its remedy is a sentence
   about serving the game over HTTP rather than anything in this repository. They are
   reported separately, and `transportDead()` is the aggregate.

   AND A FAILED LOAD IS NOT STILL LOADING. `setBed` left a failed audio slot marked
   `starting` forever; the same shape here would let a caller wait on a model that is
   never coming. A failure is latched, final, and answers `false` to `isPending`.

   CLASSIC script. See src/assets/LAYER.md and ERA2-PLAN.md section E2.0a.
   ===================================================================================== */

class AssetLibrary {
  /* `renderer` is used ONLY to read `renderer.info` for the resource report and to take
     the max anisotropy the hardware allows. The library never renders and never touches
     a scene. */
  constructor(renderer) {
    this.renderer = renderer || null;
    this.sources = new Map();    // key -> { root, resources, report, refs }
    this.pending = new Map();    // key -> Promise, so two callers share one fetch
    this.failed  = new Map();    // key -> reason string. Latched; never retried.
    this.enabled = true;
    this.stats = { requested: 0, loaded: 0, failed: 0, instantiated: 0, released: 0, disposed: 0 };
    this.last = null;            // the last asset that actually became a source
    /* Latched at construction from the ORIGIN, which is knowable before any load is
       attempted. A page opened from disk cannot fetch a local file, in any browser,
       ever — so 274 audio files and every model fail together, permanently. */
    this.transportBlocked = ASSET_TRANSPORT_BLOCKED;
    this._loader = null;
  }

  /* THE REGISTRY ROW FOR A KEY, through one indirection.

     `MODEL_ASSETS` is a classic-script `const` — LEXICAL, not a property of `window` —
     so nothing outside this file can present a different table by assigning to a global,
     and the table is frozen besides. One accessor is the whole seam: it costs a method
     call, it keeps the registry immutable, and it is how `tests/browser-assets.js` proves
     the scale-normalisation path without inventing a production row for an asset that is
     not production content. */
  _spec(key) { return MODEL_ASSETS[key]; }

  has(key) { return !!this._spec(key); }
  url(key) {
    const a = this._spec(key);
    return a ? ASSET_ROOT + a.f : null;
  }
  isLoaded(key) { return this.sources.has(key); }
  isPending(key) { return this.pending.has(key); }
  isFailed(key) { return this.failed.has(key); }

  /* Has the whole transport failed rather than one asset? True when the origin cannot
     fetch at all, or when enough consecutive attempts failed with NOT ONE success. */
  transportDead() {
    return this.transportBlocked ||
           (this.stats.loaded === 0 && this.stats.failed >= ASSET_LIMITS.deadAfter);
  }

  /* THE ONE PLACE THE PIPELINE TOUCHES A three.js LOADER, and the reason the pipeline is
     version-agnostic. r128 ships GLTFLoader as a classic script that hangs itself on the
     THREE global; the r186 bundle in vendor/three/ puts it in the same place on purpose.
     Asked for lazily, never at load time — a module may not name THREE at load time. */
  _gltfLoader() {
    if (this._loader) return this._loader;
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader !== 'function') return null;
    this._loader = new THREE.GLTFLoader();
    return this._loader;
  }

  /* Resolves to a SOURCE record, or to null — and NEVER rejects. A null is final: the key
     is latched into `failed` and every later call short-circuits on it, so a broken asset
     costs one request for the life of the session rather than one per attempt. */
  load(key) {
    if (!this.enabled) return Promise.resolve(null);
    if (this.sources.has(key)) return Promise.resolve(this.sources.get(key));
    if (this.failed.has(key)) return Promise.resolve(null);
    if (this.pending.has(key)) return this.pending.get(key);

    if (!this.has(key)) return Promise.resolve(this._fail(key, 'not in MODEL_ASSETS'));
    if (this.transportBlocked) return Promise.resolve(this._fail(key, 'transport blocked (file://)'));

    const loader = this._gltfLoader();
    if (!loader) return Promise.resolve(this._fail(key, 'no GLTFLoader on THREE'));

    const url = this.url(key);
    this.stats.requested++;
    const p = new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      try {
        loader.load(
          url,
          (gltf) => {
            try { done(this._adopt(key, gltf)); }
            catch (e) { done(this._fail(key, 'adopt: ' + (e && e.message))); }
          },
          undefined,
          (err) => done(this._fail(key, 'load: ' + ((err && (err.message || err.type)) || 'error'))),
        );
      } catch (e) {
        done(this._fail(key, 'loader threw: ' + (e && e.message)));
      }
    }).then((v) => { this.pending.delete(key); return v; });

    this.pending.set(key, p);
    return p;
  }

  /* A decoded glTF becomes a source: normalised once, measured once, its resources
     collected once. Everything after this is cloning. */
  _adopt(key, gltf) {
    const spec = this._spec(key) || {};
    const root = gltf && gltf.scene ? gltf.scene : null;
    if (!root) return this._fail(key, 'glTF contained no scene');

    const report = normalizeAssetMaterials(root);
    const bounds = this._measure(root);

    /* SCALE NORMALISATION IS EXPLICIT OR ABSENT. An exporter's units are its own opinion;
       a registry row may state the height this asset is supposed to be and the pipeline
       will make it so, or it may say nothing and the native scale is used AND REPORTED.
       What the pipeline must never do is silently pick a number — CLAUDE.md section 14 is
       about not lying to the player with a label, and a guessed scale is exactly that. */
    let scale = 1;
    if (spec.normalize && spec.normalize.targetHeight > 0 && bounds.size[1] > 1e-6) {
      scale = spec.normalize.targetHeight / bounds.size[1];
      root.scale.setScalar(scale);
      root.updateMatrixWorld(true);
    }

    const resources = collectAssetResources(root);
    const src = {
      key, root, resources, report, refs: 0, scale,
      nativeBounds: bounds,
      bounds: scale === 1 ? bounds : this._measure(root),
    };
    this.sources.set(key, src);
    this.stats.loaded++;
    this.last = key;
    return src;
  }

  _measure(root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(), centre = new THREE.Vector3();
    if (box.isEmpty()) { box.set(new THREE.Vector3(), new THREE.Vector3()); }
    box.getSize(size); box.getCenter(centre);
    return {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
      size: [size.x, size.y, size.z],
      centre: [centre.x, centre.y, centre.z],
    };
  }

  _fail(key, why) {
    this.failed.set(key, why || 'unknown');
    this.stats.failed++;
    return null;
  }

  /* ---- INSTANCES ------------------------------------------------------------------ */

  /* Resolves to an Object3D the caller may add to a scene, or to null. The clone shares
     every geometry, material and texture with the source — that is what makes a hundred
     of these one upload — so the caller must NOT dispose anything it finds inside. It
     calls `release()` and the library decides. */
  acquire(key) {
    return this.load(key).then((src) => {
      if (!src) return null;
      const inst = src.root.clone(true);
      inst.userData.assetKey = key;
      src.refs++;
      this.stats.instantiated++;
      return inst;
    });
  }

  /* Drop one reference. Detaches the instance from whatever it was added to, and disposes
     the shared source ONLY when the last instance is gone. Safe to call twice: the second
     call finds no key and does nothing, rather than double-decrementing a counter into a
     premature disposal. */
  release(inst) {
    if (!inst) return false;
    const key = inst.userData && inst.userData.assetKey;
    if (!key) return false;
    inst.userData.assetKey = null;
    if (inst.parent) inst.parent.remove(inst);
    this.stats.released++;

    const src = this.sources.get(key);
    if (!src) return false;
    src.refs--;
    if (src.refs > 0) return true;
    if (src.refs < 0) src.refs = 0;
    this._dispose(key);
    return true;
  }

  /* Free one source's GPU resources and forget it. Called only with refs at zero. */
  _dispose(key) {
    const src = this.sources.get(key);
    if (!src) return false;
    for (const t of src.resources.textures) { if (t && t.dispose) t.dispose(); }
    for (const m of src.resources.materials) { if (m && m.dispose) m.dispose(); }
    for (const g of src.resources.geometries) { if (g && g.dispose) g.dispose(); }
    this.sources.delete(key);
    this.stats.disposed++;
    return true;
  }

  /* Drop everything, whatever the reference counts say. For a teardown — a New Game, a
     load, a dimension leaving — where the scene is being emptied anyway and the instances
     are going with it. NOT for ordinary use; `release()` is. */
  disposeAll() {
    let n = 0;
    for (const key of Array.from(this.sources.keys())) { if (this._dispose(key)) n++; }
    this.pending.clear();
    return n;
  }

  /* ---- WHAT ACTUALLY HAPPENED ----------------------------------------------------- */

  /* The library's own counters BESIDE the renderer's, because they answer different
     questions and only the renderer's is the truth about the GPU.

     AND A LIMIT WORTH STATING PLAINLY: `renderer.info.memory` counts three.js OBJECTS
     the renderer still holds — geometries and textures. It is not VRAM, no browser API
     exposes VRAM, and nothing here should pretend otherwise. What it CAN prove is that
     repeated load/unload does not leak engine-managed resources, which is the property
     the brief actually asks for. */
  debugReport() {
    const info = this.renderer && this.renderer.info ? this.renderer.info.memory : null;
    return {
      stats: Object.assign({}, this.stats),
      resident: this.sources.size,
      pending: this.pending.size,
      failed: Array.from(this.failed.entries()).map(([k, v]) => k + ': ' + v),
      transportDead: this.transportDead(),
      refs: Array.from(this.sources.entries()).map(([k, s]) => k + '=' + s.refs),
      rendererGeometries: info ? info.geometries : -1,
      rendererTextures: info ? info.textures : -1,
    };
  }
}
