# WHERE IT ISN'T — OFFLINE VALIDATION SUITE

These are the checks Phase 20 was built against. They run the **real game code** — the
`<script>` body of `game.html` is loaded into a Node VM with a small DOM stub, and a real
`VoxelWorld` is constructed and asked to generate real chunks. Nothing here reimplements
the generator, and nothing here asserts on metadata where a player-facing property could
be measured instead.

## Running them

```
cd tests
npm install three@0.128.0          # the version game.html loads from the CDN
node determinism.js
node core-disk.js
node journey.js
node red-light.js
node runtime.js
node regression.js                 # needs a baseline, see below
node performance.js                # needs a baseline, see below
node render-journey.js             # writes PNGs into tests/renders/
```

`regression.js`, `journey.js` and `performance.js` compare against the build **before**
the change you are testing. Produce one with git and point the suite at it:

```
git show <ref>:game.html > tests/baseline.html
# ...or somewhere else, and: WII_BASELINE=/path/to/old.html node regression.js
```

## What each one proves

| file | what it measures |
|---|---|
| `determinism.js` | two independently booted worlds, and one world generating the same chunks in reverse order, produce byte-identical chunk data across the journey; a disposed chunk regenerates identically; the resolved journey sites and the Rift Core chest key agree across boots |
| `core-disk.js` | the Level 2 Rift Core Disk is **reachable on foot** — a body with the player's real dimensions is walked from the field outside the property, through the house, down the cellar stair, along the corridor and into the room at the end, and back out again |
| `journey.js` | the beats: spawn on the carriageway facing the journey, crop density in the opening field, livestock and farmsteads met, the spine still bends, the tower's height/structure/biome/sightlines, the isolation ramp against the baseline, the repetition and cross-dimensional marks, the missing-farm evidence, and that leaving the route breaks nothing |
| `red-light.js` | the gaze anomaly: no flash while looking at the tower, flashes while it is peripheral, irregular intervals (CV and histogram), dark within one frame when the player looks back, identical schedules across two boots, silent out of range and out of dimension |
| `runtime.js` | the frame-loop hooks and HUD entry points exist and are safe outside the Farmlands, and the Home's one stronger horror event fires once, only after the player has stood in the room, only when they are away and not looking, and never again |
| `regression.js` | the lane lattice, the route spine, parcel programmes, farmstead/landmark/minor/animal placement, Suburbia and the Overworld are unchanged; chunks 5,000 blocks from the journey differ **only** by the intact-window fix |
| `performance.js` | chunk generation timing against the baseline, per region, median of five runs |
| `render-journey.js` | offline first-person renders of the whole journey |

## About the renders

`harness/render.js` rasterises the **actual `THREE.BufferGeometry`** that
`VoxelWorld.generateChunkMesh` builds — same vertices, same normals, same baked
per-vertex skylight — with a z-buffer, a directional term, the dimension's own
exponential fog, generated torches as point lights, and the water tower's fog-exempt
silhouette proxy driven by a real camera.

**It is not a browser and it is not WebGL, and it does not claim to be.** It has no block
atlas, so every surface is drawn in its material's base colour rather than its texture,
and a fixed gain and gamma are applied so the Rotting Fields' deliberately dark palette is
legible on a page. Read these images for **silhouette, massing, composition and scale** —
which is what they were used to verify, and what caught the chequerboard yard, the red
runner standing up out of the floor and the black window in the basement. Do not read them
as final art.
