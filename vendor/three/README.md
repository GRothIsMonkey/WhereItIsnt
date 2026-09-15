# `vendor/three/` — THE RENDERER, PINNED AND ON DISK

## What ships

| file | version | shipped? | what it is |
| --- | --- | --- | --- |
| `three.min.js` | **r128 (0.128.0)** | **YES** | the renderer `game.html` loads |
| `GLTFLoader.js` | r128 | **YES** | r128's own classic-script loader; attaches `THREE.GLTFLoader` |
| `three.global.js` | **r186 (0.186.0)** | no — prepared | three + GLTFLoader as one IIFE global, for the deferred upgrade and for the version-agnostic test |
| `entry.mjs` | — | n/a | the bundle entry point |

## Why vendored rather than a CDN

`game.html` loaded `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
until Era 2 E2.0a. The vendored file is **byte-identical** to it:

```
eb8549863a97355411c3259a3f93b8e1  cdnjs r128 three.min.js
eb8549863a97355411c3259a3f93b8e1  npm three@0.128.0 build/three.min.js
eb8549863a97355411c3259a3f93b8e1  vendor/three/three.min.js
eb8549863a97355411c3259a3f93b8e1  tests/vendor/three.min.js
```

So the swap changed nothing that renders. What it removed:

1. **A runtime dependency on a third party.** A CDN outage made the game unplayable.
2. **Two divergent copies.** The game loaded the CDN's; the suites injected
   `tests/vendor/three.min.js`. They happened to be the same file, by convention rather
   than by construction — exactly the shape of hole where a suite validates something
   other than the build (CLAUDE.md §62.8, §62.10). `tests/assets.js` now asserts the two
   are byte-identical, so it is a fact rather than a habit.
3. **Determinism.** §11's spirit: the same inputs produce the same output, including the
   renderer.

## THE VERSION DECISION, AND THE MEASUREMENT THAT SETTLED IT

The E2.0a decision pass recommended upgrading to current stable, vendored as an IIFE
global, and predicted Era 1 would take a **cosmetic** drift that a compatibility shim
would mostly absorb.

**That prediction was measured and it was wrong.** Same scene, same seed, same position,
same camera, same time of day, in a real Chromium over HTTP, framebuffer sampled at
160×100 with `preserveDrawingBuffer` forced on:

| build | mean RGB | vs r128 |
| --- | --- | --- |
| r128 | 97.3, 146.5, 73.1 | — |
| r186, defaults | 29.4, 48.4, 27.6 | 100% of subpixels changed, mean Δ **70.5**/255, max Δ 228 |
| r186 + `ColorManagement.enabled=false` + `outputColorSpace=LinearSRGBColorSpace` + every light ×π | 35.8, 56.2, 30.7 | 100% changed, mean Δ **64.7**/255, max Δ 224 |

**r186 renders the existing game about 2.7× darker, and the full compatibility shim moves
the mean by 0.1.** The ×π light rescale — the standard migration remedy for the removed
legacy light model — changed nothing measurable, so the cause is not light intensity; it
is somewhere in how `MeshLambertMaterial` and the voxel atlas resolve on the modern
shading core. Finding and re-tuning that is a **visual** job on the voxel renderer.

### So the upgrade is DEFERRED, and here is the reasoning

- The remedy is to re-tune Era 1's materials and lighting. That is a visual redesign.
  E2.0a is a foundation phase that was told not to rebuild or redesign anything, and
  CLAUDE.md §63 keeps Era 2 visual work in Era 2 phases.
- The natural home is **E2.5 Lighting Rebirth**, which re-authors the lighting model for
  each dimension anyway and can absorb a renderer change without a second unrelated risk
  (ROADMAP.md §43).
- The Era 1 build has **never been played by a human** (CLAUDE.md §84). Shipping a 2.7×
  darkening into the build that the outstanding playtest gate is supposed to evaluate
  would make that playtest measure something the project never authored.
- **Nothing is lost by waiting.** r128's GLTFLoader loads glTF 2.0 core and PBR
  correctly, which is everything E2.0a needs to prove. The extension gap
  (`KHR_materials_emissive_strength` and friends) bites when Era 2 *authors* assets, not
  when the pipeline is built.

### And nothing has to be rewritten when it happens

The pipeline resolves its loader through **one** function and asks which colour-space API
exists through **one** other, so it runs on both generations unmodified.
`tests/browser-assets.js` proves that by running the whole asset suite twice — once on
r128, once on r186. The upgrade is then a **one-line change** to `game.html`'s script tag
plus whatever lighting work E2.5 does.

## Rebuilding `three.global.js`

Requires network access to the npm registry. Output is committed; there is no build step
in the repository's normal flow — the same arrangement `assets/audio/runtime/` has with
`tests/tools/build_runtime.py`.

```sh
mkdir -p /tmp/three-build && cd /tmp/three-build
npm install --no-audit --no-fund three@0.186.0 esbuild
cp /path/to/repo/vendor/three/entry.mjs entry.mjs
./node_modules/.bin/esbuild entry.mjs --bundle --format=iife --minify \
    --target=es2020 --legal-comments=none --outfile=three.global.js
cp three.global.js /path/to/repo/vendor/three/three.global.js
```

Pin the version in **both** places when it changes: the command above and
`tests/assets.js`'s expected-revision assertion.

## Re-running the drift measurement

`tests/browser-assets.js --drift` serves the build twice from one server, swapping only
the renderer script tag, and prints the table above. Re-run it before any future attempt
at the upgrade — the numbers are evidence, not folklore, and they will move as Era 2
replaces the voxel renderer that produces them.
