# `src/assets/` — WHAT IS IMPORTED, AND HOW IT GETS IN

The model pipeline. Everything about fetching, decoding, normalising, caching, cloning
and disposing an imported asset — and nothing about where one goes.

**THIS LAYER SURVIVES ERA 2.** It is not a renderer. `src/rendering/` describes shapes
this game authors in code and Era 2 restyles every one of them; this layer describes how
an *external* file becomes usable, which is the same problem before and after the voxel
world is deleted.

## May depend on
`shared/`, and the `THREE` global.

## Must never
name a block id, a chunk, a voxel coordinate, a dimension, an objective or a save key;
reach `Game`, the UI, the audio system or the DOM; decide where an asset is placed.
Asserted in `tests/architecture.js` §4i.

## The four modules, in load order

| module | lines | what it owns |
| --- | ---: | --- |
| `asset-registry.js` | 180 | **WHAT EXISTS.** Keys, paths, status, collision modes, licences. Pure data plus four lookups. |
| `asset-materials.js` | 190 | **WHAT SURFACES BECOME.** Colour space, filtering, shadow flags, within-asset material dedup, resource collection. |
| `asset-library.js` | 289 | **FILES.** GLTFLoader, cache, reference counting, disposal, failure latching, the transport aggregate. |
| `asset-collision.js` | 212 | **WHAT SHAPE A PLACED MODEL IS.** Declared proxies, world-space boxes, three PhysicalWorld-shaped queries, and (D1 Phase 2) the normalized raycast over those same proxies. |

## The rules that hold

- **NO CALL SITE HOLDS A MODEL FILE PATH.** A caller names a key; `modelAssetUrl` is the
  only place a key becomes a URL. Section 61's rule for audio, in the other subsystem.
- **AN ASSET WITHOUT AN ATTRIBUTION LINE IS A LICENCE BREACH, NOT UNTIDINESS.**
  `tests/assets.js` fails in both directions — an asset with no credit, a credit with no
  asset — and keeps the restricted-licence quarantine list current.
- **`ASSET_STATUS.VALIDATION` IS NOT CONTENT.** A validation asset proves the pipeline. No
  dimension may reference one, and the test enforces it. E2.0a ships exactly one asset and
  it is a validation asset; it ships **zero** production assets.
- **AN ASSET DOES NOT BRING ITS OWN PHYSICS.** Collision comes from a declared proxy.
  There is no `mesh` collision mode, deliberately — a render mesh as a collision surface is
  the coupling E2.1 exists to prevent, wearing a new costume. **D1 Phase 2 extended that to
  aiming**: `AssetCollisionSet.raycast` intersects the declared boxes, so an asset with
  `ASSET_COLLISION.NONE` registers nothing and cannot be aimed at any more than it can be
  walked into. `tests/raycast.js` proves it with a decorative fixture.
- **A PROXY'S ID IS A STABLE RUNTIME HANDLE AND THE COUNTER IS SHARED BY EVERY SET.** It is
  the raycast tie-break, and a per-set counter would let two sets mint the same number and
  push the decision back onto the order the composite consulted them in. Never saved, never
  hashed, never fed into generation. A hit's `ref` is that id — never the instance and never
  the mesh.
- **ONE SOURCE, MANY CLONES, ONE OWNER.** `acquire()` clones; clones share geometry,
  material and texture with the cached source; `release()` drops a reference and only the
  last one disposes. A caller never disposes anything it finds inside an instance.
- **A FAILED LOAD IS NOT STILL LOADING.** Failure is latched, final, and `isPending`
  answers false. The audio system's `setBed` left a failed slot marked `starting` forever
  and the whole engine could ask "is one on its way" and get yes, permanently.
- **A DEAD TRANSPORT IS A DIFFERENT FAULT FROM A DEAD ASSET.** One asset failing is a
  content bug; every asset failing is a missing subsystem whose remedy is a sentence about
  HTTP. `transportDead()` is the aggregate, latched from the origin before any load is
  attempted.
- **SCALE NORMALISATION IS EXPLICIT OR ABSENT.** A registry row states the height an asset
  is meant to be and the pipeline makes it so, or it says nothing and the native scale is
  used **and reported**. The pipeline never silently picks a number.
- **THE PIPELINE IS three.js-VERSION-AGNOSTIC AND IT IS TESTED THAT WAY.** One function
  resolves the loader (`AssetLibrary._gltfLoader`) and one asks which colour-space API
  exists (`_assetUsesColorSpaceApi`). `tests/browser-assets.js` runs the whole suite twice,
  once on the shipped r128 and once on the prepared r186 bundle. See `vendor/three/README.md`.

## What is deliberately not here

| thing | why |
| --- | --- |
| **Placement** | Where an asset goes is a creative decision. None has been supplied, and inventing one is out of scope. |
| **A composite PhysicalWorld** | Wiring asset collision into live gameplay means terrain + props + architecture with a resolution order. That belongs to the phase that introduces mesh terrain. |
| **LOD** | The registry reserves the field. No selection, no switching, no generation. |
| **Instancing / BatchedMesh** | The resource test places clones on purpose, to establish the naive cost the later optimisation is measured against. |
| **Streaming** | Cache yes, proximity-driven load/unload no. |
| **KTX2 / Draco / meshopt** | Registry field reserved; nothing implemented; not in the vendored bundle until an asset needs it. |
| **Skinned meshes and animation** | `acquire()` uses `Object3D.clone()`, which is correct for static props and wrong for skinned ones. The phase that imports a creature adds `SkeletonUtils.clone` and says so. |
