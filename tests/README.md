# WHERE IT ISN'T — OFFLINE VALIDATION SUITE

These are the checks Phase 20, its journey revision (20.1), the guidance pass (20.2) and
the item-contact pass (21) and the settings pass (22) were built against. They run the **real game code** — the
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
node chain.js                      # the journey revision; needs a baseline, see below
node compass.js                    # Phase 20.2 — compass, instruction, crossroads
node items.js                      # Phase 21 — dropped-item ground contact
node settings.js                   # Phase 22 — settings state, persistence, pause, audio
node red-light.js
node runtime.js
node regression.js                 # needs a baseline, see below
node performance.js                # needs a baseline, see below
node render-journey.js             # writes PNGs into tests/renders/
```

`regression.js`, `journey.js`, `chain.js` and `performance.js` compare against the build
**before** the change you are testing. Produce one with git and point the suite at it:

```
git show 1002f7b:game.html > tests/baseline.html     # the pre-Phase-20 build
# ...or somewhere else, and: WII_BASELINE=/path/to/old.html node regression.js
```

`items.js` and `render-items.js` take the **pre-Phase-21** build the same way, to measure
the contact defect and the per-frame cost before and after:

```
git show 71ec935:game.html > tests/phase20_2.html
# ...or: WII_PRE21=/path/to/old.html node items.js
```

`performance.js` also takes an optional **second** baseline, and the distinction matters.
`baseline.html` is the build that predates the journey entirely, which answers "what did
the whole feature cost". `phase20.html` is the Phase 20 build itself, which answers "what
did REVISING the journey cost" — the only question a revision can fairly be gated on,
because a figure measured against the older build carries all of Phase 20 with it:

```
git show b2bc032:game.html > tests/phase20.html      # the Phase 20 build
# ...or: WII_PHASE20=/path/to/phase20.html node performance.js
```

Both are gitignored: they are reproducible from git and each is over a megabyte.

## What each one proves

| file | what it measures |
|---|---|
| `determinism.js` | two independently booted worlds, and one world generating the same chunks in reverse order, produce byte-identical chunk data across the journey; a disposed chunk regenerates identically; the resolved journey sites and the Rift Core chest key agree across boots |
| `core-disk.js` | the Level 2 Rift Core Disk is **reachable on foot** — a body with the player's real dimensions is walked from the field outside the property, through the house, down the cellar stair, along the corridor and into the room at the end, and back out again |
| `journey.js` | the beats: spawn on the carriageway facing the journey, crop density in the opening field, livestock and farmsteads met, the spine still bends, the tower's height/structure/biome/sightlines, the isolation ramp against the baseline, the repetition and cross-dimensional marks, the missing-farm evidence, and that leaving the route breaks nothing |
| `chain.js` | the journey **revision**: the five landmarks resolve in order with room between them, the route is unbroken and winding over all 1,950 blocks from arrival to the property, it is measurably the widest road in the region, the procedural lattice is suppressed inside the corridor and byte-identical outside it, the scale hierarchy is readable in blocks, the reveals are staged at four different distances, the dead land is a graded ramp with a non-circular rim, the woodland retreats from the great tree, and each new landmark is somewhere a player can actually walk to and into |
| `compass.js` | Phase 20.2 guidance. That the compass's EAST is the journey's EAST, derived from the movement basis rather than assumed, and that the bearing matches the direction the player would actually walk at all 1081 headings tested (including past ±360°); that the tape is not mirrored — E right of centre facing north, and turning right slides the strip left; that it draws nothing but the eight compass points and reads nothing but the yaw; that it is earned once from the first Overworld chest, is not an inventory item, lives in the Game progression block, and is re-applied on every dimension crossing; that the opening instruction is the two required lines and names nothing; that the world does not start until it resolves; that the recall is latched and no HUD text repeats it; and that all four arms of the arrival crossroads are unbroken road for 400 blocks |
| `items.js` | Phase 21 dropped-item ground contact. Drives the **real `ItemEntity`** against real generated chunks: that the geometry origin is centred (measured from the BufferGeometry, not assumed) and the mesh is lifted to match the collider; that an item's foot lands exactly on the surface from five drop heights; that across a full bob cycle it never goes below the surface nor above the bob's own travel; that rotation, bob rate, bob travel and per-item phase desync are unchanged; that the substep budget cannot tunnel at terminal velocity on the longest frame the loop allows; staircases, pits and shaped blocks; walls, floor/wall corners, two-wall corners and a one-block shaft; mined support waking it, a mined neighbour not waking it, and a floor replaced by noclip decoration waking it; a chunk corner with a neighbour unloaded and streamed back; pickup radius and firing preserved, and no longer pulsing with the bob; eight item categories; determinism over repeated drops and 200 randomised spawn impulses; and a before/after cost comparison against the pre-Phase-21 build |
| `settings.js` | Phase 22 settings. The six settings and their defaults; every coercion case (out of range clamps, NaN/Infinity/null/undefined/wrong-type fall back, numeric strings coerce, unknown enum and non-boolean fall back, unknown keys rejected); nine kinds of corrupt stored data loading safely; a storage accessor that throws on every call; persistence across a simulated reload; the debounce (101 slider steps → 0 writes while dragging, 1 on flush); the Phase 23 `toJSON`/`applyJSON` hand-off; audio applied to a recording AudioContext stub proving master/music/SFX are independent, that defaults reproduce the shipped mix exactly, and that 200 slider steps create zero new nodes; that master volume drives a separate node from the climax duck; that sensitivity multiplies the unchanged base and inverts nothing; preset monotonicity and that High is the shipped configuration; fullscreen helpers degrading safely where unsupported; the frame loop genuinely pausing; every gameplay input path gated on `menuOpen`; pointer lock released and restored; 25 open/close cycles binding listeners exactly once; and that no overlay can stack on the panel in either direction |
| `red-light.js` | the gaze anomaly: no flash while looking at the tower, flashes while it is peripheral, irregular intervals (CV and histogram), dark within one frame when the player looks back, identical schedules across two boots, silent out of range and out of dimension |
| `runtime.js` | the frame-loop hooks and HUD entry points exist and are safe outside the Farmlands, and the Home's one stronger horror event fires once, only after the player has stood in the room, only when they are away and not looking, and never again |
| `regression.js` | the lane lattice, the route spine, parcel programmes, farmstead/landmark/minor/animal placement, Suburbia and the Overworld are unchanged; chunks 5,000 blocks from the journey differ **only** by the intact-window fix |
| `performance.js` | chunk generation timing per region, as the median of nine **paired** runs — each repeat times both builds back to back, because this process drifts by about nine per cent over the length of a suite and comparing two separately-taken medians could not resolve a ten per cent effect. Reports against both baselines, and gates the revision on the whole corridor rather than on a fixed rectangle, since the two journeys put their authored beats in different places |
| `render-journey.js` | offline first-person renders of the whole journey |
| `render-items.js` | writes `renders/item-contact-{before,after}.png` — an item resting on real terrain, on a step and against a wall, drawn from the **real item mesh** depth-tested over the **real chunk geometry**, at the worst point of the bob. Reuses the existing rasteriser; **not** a browser render |
| `preview-settings.js` | writes `renders/settings-panel.html` — the real `#settingsOverlay` markup and the real stylesheet lifted out of `game.html`, populated from the real defaults. Static HTML for judging layout and density; **not** a browser render |
| `preview-compass.js` | writes `renders/compass-tape.svg` — the compass at six headings, re-emitted from the real `updateCompass` draw calls onto the real panel colours. Derived from the shipped code; **not** a browser render |

## About the renders

`harness/render.js` rasterises the **actual `THREE.BufferGeometry`** that
`VoxelWorld.generateChunkMesh` builds — same vertices, same normals, same baked
per-vertex skylight — with a z-buffer, a directional term, the dimension's own
exponential fog, generated torches as point lights, and every one of the four fog-exempt
landmark silhouette proxies driven by a real camera at the real eye position — so a shot
showing two landmarks on the horizon is showing what the game would put there, and a shot
showing none is evidence that there is nothing to see.

**It is not a browser and it is not WebGL, and it does not claim to be.** It has no block
atlas, so every surface is drawn in its material's base colour rather than its texture,
and a fixed gain and gamma are applied so the Rotting Fields' deliberately dark palette is
legible on a page. Read these images for **silhouette, massing, composition and scale** —
which is what they were used to verify, and what caught the chequerboard yard, the red
runner standing up out of the floor and the black window in the basement. Do not read them
as final art.
