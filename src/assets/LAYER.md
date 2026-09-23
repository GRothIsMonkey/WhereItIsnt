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
| `asset-registry.js` | 294 | **WHAT EXISTS.** Keys, paths, status, collision modes, licences. Pure data plus four lookups. D1 Phase 4 added the first production row and the `FIRST-PARTY` licence status. |
| `asset-materials.js` | 190 | **WHAT SURFACES BECOME.** Colour space, filtering, shadow flags, within-asset material dedup, resource collection. |
| `asset-library.js` | 289 | **FILES.** GLTFLoader, cache, reference counting, disposal, failure latching, the transport aggregate. |
| `asset-collision.js` | 212 | **WHAT SHAPE A PLACED MODEL IS.** Declared proxies, world-space boxes, three PhysicalWorld-shaped queries, and (D1 Phase 2) the normalized raycast over those same proxies. |
| `asset-budgets.js` | 445 | **WHAT AN ASSET IS ALLOWED TO COST.** `VISUAL_RULE_BIBLE.md` section 9.1's measurable subset, the band/status vocabulary, and the validator. D1 Phase 3. |
| `asset-measure.js` | 566 | **WHAT SOMETHING ACTUALLY COSTS.** Geometry, materials, textures, texel density, live scene statistics, baseline comparison. The ONE counting definition. D1 Phase 3. |

## The rules that hold

- **NO CALL SITE HOLDS A MODEL FILE PATH.** A caller names a key; `modelAssetUrl` is the
  only place a key becomes a URL. Section 61's rule for audio, in the other subsystem.
- **AN ASSET WITHOUT AN ATTRIBUTION LINE IS A LICENCE BREACH, NOT UNTIDINESS.**
  `tests/assets.js` fails in both directions — an asset with no credit, a credit with no
  asset — and keeps the restricted-licence quarantine list current.
- **FIRST-PARTY IS A LICENCE STATUS, NOT THE ABSENCE OF ONE** (D1 Phase 4). Work authored
  for this project carries `FIRST-PARTY`: project-owned, unrestricted for this project's
  commercial use, with no external attribution required. It is earned. The credit must name
  an in-repo provenance record that exists and a SHA-256 the shipped file actually has, and
  the attribution document must carry the same hash. Every licence is either a third-party
  grant with a URL to its text or first-party. There is no "none".
- **`ASSET_STATUS.VALIDATION` IS NOT CONTENT.** A validation asset proves the pipeline. No
  dimension may reference one, and the test enforces it. E2.0a shipped exactly one asset,
  and it was a validation asset.
- **ONE PRODUCTION ASSET, INTEGRATED AND PLACED NOWHERE** (D1 Phase 4).
  `prop.rural-fence-post-01` is a byte-identical copy of the human-approved Revision 03
  export. It is budgeted `small-prop` with no exception, and its collision is two declared
  boxes fitted to its own vertices. No file under `src/` except the registry names it. The
  phase that places it changes that check on purpose. See ARCHITECTURE.md section 4.14.
- **THE GUARDRAIL LIVES HERE BECAUSE IT OUTLIVES THE RENDERER.** `asset-budgets.js` and
  `asset-measure.js` name **zero** `THREE` and `tests/architecture.js` §4i locks them there.
  They read duck-typed properties — `isMesh`, `geometry.index.count`, `matrixWorld.elements`
  — so the same code measures a three.js scene today and whatever Era 2's renderer rebirth
  produces tomorrow. Filing them under `rendering/` would have put the thing that MEASURES
  the rebuild inside the layer being rebuilt.
- **ONE COUNTING DEFINITION, AND `countNodeTriangles` IS IT.** Exactly one file declares it,
  no other asset module divides an index or vertex count by three, and both facts are
  asserted. `normalizeAssetMaterials` used to keep its own inline count which also divided a
  `Points` cloud's VERTEX count by three, so two numbers called "triangles" disagreed by a
  factor of four on a points-heavy asset. Two counts that disagree is the failure CLAUDE.md
  sections 61.05-61.07 name three times in the audio system.
- **A BUDGET IS A GUIDELINE AND THE MODEL SAYS SO IN ITS TYPES.** Every result carries a
  `band` (what the number is: within / near / over / unmeasured) and a `status` (what a gate
  should do: pass / advisory / fail / unavailable / exception). Collapsing them makes
  "clearly over budget" and "a hundred triangles past the boundary" the same message.
- **`unavailable` IS NOT `over`, AND NEITHER IS `pass`.** A texel density that cannot be
  computed returns a STATE with a reason, never a number with a fallback. Inventing a value
  to avoid saying "unavailable" turns a gap in the data into a verdict.
- **AN EXCEPTION IS LOCAL, STATED AND VISIBLE.** It lives on the asset row, names one
  metric, carries an allowance and a REASON, and a metric it covers reports `exception` —
  never `pass`. There is deliberately no global switch and `tests/budgets.js` greps for one.
- **VALIDATION IS A BUILD-TIME AND TEST-TIME TOOL.** `measureSceneResources` has no call
  site in the build and `tests/browser-budgets.js` counts zero calls across three seconds of
  real gameplay. A per-frame global scan is exactly the cost CLAUDE.md section 14 refuses.
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
| **A composite PhysicalWorld** | Still not here, and now it EXISTS — `src/world/composite-physical-world.js`, D1 Phase 1. It composes this layer's `AssetCollisionSet` with a terrain base. The resolution order lives with the world, not with the model pipeline. |
| **LOD** | The registry reserves the field. No selection, no switching, no generation. D1 Phase 3 added `ASSET_LOD_SCHEMA` and a CONSISTENCY check — levels are 0..n and each is meaningfully cheaper than the last — and nothing else. Without a selection policy there is nothing else to check. |
| **A texture platform** | Dimensions are read and compared. No compression, no transcoding, no atlas packing, no budget for VRAM (no browser API exposes it). |
| **A between-assets density check** | Section 9's real claim is that two assets should AGREE. That needs more than one production asset to exist, and there is one (D1 Phase 4, 64.37 px/m). Each asset is measured against its class target instead. |
| **An output colour transform / environment lighting** | D1 Phase 4 measured that the live renderer has neither. The fence shows at about 21% of its colour-managed brightness, and its metal strap has nothing to reflect. That is a renderer and lighting decision (E2.5), not an import-policy one, and this layer's sRGB marking is correct for PBR. `tests/browser-asset-scene.js` grades it and stays red until it is fixed. |
| **Instancing / BatchedMesh** | The resource test places clones on purpose, to establish the naive cost the later optimisation is measured against. |
| **Streaming** | Cache yes, proximity-driven load/unload no. |
| **KTX2 / Draco / meshopt** | Registry field reserved; nothing implemented; not in the vendored bundle until an asset needs it. |
| **Skinned meshes and animation** | `acquire()` uses `Object3D.clone()`, which is correct for static props and wrong for skinned ones. The phase that imports a creature adds `SkeletonUtils.clone` and says so. |
