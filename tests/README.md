# WHERE IT ISN'T — VALIDATION SUITE

These are the checks Phase 20, its journey revision (20.1), the guidance pass (20.2), the
item-contact pass (21), the settings pass (22), the save/load pass (23), the story
foundation (24), the objective system (25), the XP removal (26), the HUD rebirth (27) and
the tutorial removal (28) were built against. They run the **real game code** — the
`<script>` body of `game.html` is loaded into a Node VM with a small DOM stub, and a real
`VoxelWorld` is constructed and asked to generate real chunks. Nothing here reimplements
the generator, and nothing here asserts on metadata where a player-facing property could
be measured instead.

Everything here is offline **except `browser-save.js`, `browser-onboarding.js` and
`preview-hud.js`**, which launch
Chromium, serve `game.html` over HTTP and drive the real page. Where a file is offline it says so, and
where a claim needs a browser it is made in that file and nowhere else.

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
node save.js                       # Phase 23 — save schema, validation, world round trip
node story.js                      # Phase 24 — the story bible, and the fragments it preserves
node objectives.js                 # Phase 25 — the objective tables, resolution and migration
node progression.js                # Phase 26 — XP absence, milestones, legacy-save migration
node hud.js                        # Phase 27 — condition, perception, objective, hotbar, prompt
node onboarding.js                 # Phase 28 — the tutorial's absence, the cues, the migration
node browser-save.js               # Phase 23 — the same thing in a REAL browser, see below
node browser-onboarding.js         # Phase 28 — the same thing in a REAL browser, see below
node red-light.js
node runtime.js
node regression.js                 # needs a baseline, see below
node performance.js                # needs a baseline, see below
node render-journey.js             # writes PNGs into tests/renders/
node preview-hud.js                # Phase 27 — REAL browser screenshots of the HUD
```

`regression.js`, `journey.js`, `chain.js` and `performance.js` compare against the build
**before** the change you are testing. Produce one with git and point the suite at it:

```
git show 1002f7b:game.html > tests/baseline.html     # the pre-Phase-20 build
# ...or somewhere else, and: WII_BASELINE=/path/to/old.html node regression.js
```

`hud.js` takes the **pre-Phase-27** build the same way, to count what the old HUD wrote to
the DOM on a steady frame against what the new one writes:

```
git show c05efbe:game.html > tests/phase26.html
# ...or: WII_PRE27=/path/to/old.html node hud.js
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
| `save.js` | Phase 23 save/load. The validator as a pure function: sixteen kinds of invalid save rejected with a reason, fifteen kinds of dented field repaired and every repair reported, absent fields and numeric strings coerced silently, an inventory of nonsense stripped without minting an item, malformed edit tables and crafted `__proto__` keys discarded. Then the property the phase rests on, against REAL chunks: a Farmland region is generated, mined and built in, captured, and replayed into a SECOND world booted from scratch — 107,584 blocks compared, zero differences — with the opened-chest ledger, the door registry, the Suburbia recognition ledger and the torch-decay timers coming back with it, and the one-shot mailbox anomaly reconciled so it cannot undo itself. Safe placement against real terrain, including the trap where an ungenerated chunk reads as clear air. Then the storage layer: a truncated primary recovered from the backup, a quota failure that leaves the previous good save intact, nine kinds of corrupt slot handled without throwing, 25 byte-stable cycles, and 1,000 reads that perform zero writes. The Game-level orchestration is asserted STRUCTURALLY against the real source — one teardown path, every verb through it, no write anywhere in the frame loop |
| `story.js` | Phase 24. Structural only, and says so: that `STORY.md` exists with all 22 required canonical sections plus the knowledge curve, the never-explain list and the Phase 31 opportunities; that the canon's five load-bearing mechanics (the tower's gaze-keyed light, the vanishing mailbox, the Stalker's freeze, the animals, Suburbia's rearrangement) are all still in the build, so the bible describes THIS game; that the retired project name is gone from every player-facing string; that the finale is not named on screen; that all 12 audited narrative fragments and all 11 journey objective lines **survived** the phase; and that no lore dump, note UI or new toast was smuggled in. **It makes no claim about whether the story is any good** |
| `objectives.js` | Phase 25. Drives the REAL objective tables with synthetic player states: every step of every chain in order; that a player who did three steps before being asked is credited with all three; that spending your last plank does **not** send you back to "Gather wood." (50 evaluations of an empty pack); override priority across 256 combinations of live state; the Farmland ordinal walked through all eleven authored lines; that no Suburbia objective reads a coordinate or a room index; the save round trip, eight kinds of corrupt mark, and a real **version 1 Phase 23 save migrated up the whole ladder** without losing the player's place. Also audits all 21 objective strings against STORY.md's internal-only vocabulary. Says plainly that it cannot judge whether the wording lands |
| `progression.js` | Phase 26. Two halves. The **absence** is proved lexically against the shipped source, because an absence has no function to call: no XP symbol is defined, no call site survives in executable code (comments stripped first — the phase left a lot of gravestones), the XP bar / level label / FINAL LEVEL row are not in the document, no stylesheet paints one, no recipe carries a level gate, and the only executable mentions left are the two `delete` lines in the migration, named rather than pattern-excused. The **behaviour** is run for real: the milestone table's shape, its grant path granting once against 500 repeats, the three wiring sites, an XP-era schema 2 save carrying level 6 and 175 max health migrated with the currency dropped and every consequence kept, the double-grant trap (a returning player replaying all three milestones gains nothing), a day-1 save deriving none, a malformed milestone list repaired, 20 byte-stable cycles, and that crafting, mining, combat, the Rift bridge and the Behemoth bridge all still work without it |
| `hud.js` | Phase 27. Drives the **real `UIManager`** against a DOM stub that records what was written to it: that the condition readout is ten ticks at 100 max health and seventeen at 170 — the endurance milestones lengthening the instrument rather than rescaling a bar — that 63/100 lights six whole ticks and fills the seventh three tenths, that the four states arrive in order and are proportional, that no heart, brain, vital bar or XP element is in the document; that the perception trace is a canvas whose line travels 0.83px when calm, 13.07px when lost, breaks into 27 pieces at the bottom, draws displaced fragments, is deterministic, and shares no stylesheet rule, colour or state name with health; that the objective arrives rather than flashing on the first line of a run, that its notification is 1.1s of opacity and four pixels of lift and nothing else, and that `UIManager` reads no objective table; that the strip marks one cell, prints a count of 12 and not a count of 1, and names the held item on a change; that the prompt table answers doors both ways, the Anchor and a chest, and that every exit of the look-target update and the gate above it clear it; that each of 18 HUD elements is in the document exactly once and rebuilding does not stack; death, respawn, New Game and load; the z-index ladder; that no render path writes gameplay state and no block id, chunk or mesh is reachable from the HUD at all; and that 600 steady frames cost 0 DOM writes, 0 icon redraws, 0 canvas strokes and 4.3 µs a frame, against 1,200 style writes and 600 icon redraws for the build it replaces. **It makes no claim about whether the HUD looks good** |
| `browser-save.js` | Phase 23 **in Chromium**, plus the Phase 26 and Phase 27 additions. Serves `game.html` over HTTP, boots it with a real WebGL context, plays, clicks SAVE in the real pause panel, **reloads the page**, clicks CONTINUE, and asserts on the live runtime: position, orientation, health, sanity, inventory and selected slot, stage and day, the day/night clock, the compass, **the objective line**, the opened chest, the Anchor Monument and its fuel, and the actual voxels the player dug and built. Then three loads in a row with no scene-graph growth, NEW GAME inheriting nothing, and a corrupt slot that still starts the game. Phase 26 adds: the XP bar and level label are absent from the **live** document, nothing rendered in the HUD reads Lv./XP/LEVEL UP, the live crafting menu shows no level requirement, and **placing an Anchor in the running game grants the shelter milestone once** — 41/100 to 61/120 — which then survives the reload as reached rather than being paid a second time. **This is the browser validation** — see below. Phase 27 adds thirteen live-document checks: the condition ticks laid out non-zero inside the viewport, real pixels in the perception canvas and visibly more of them broken at low sanity, the two readings aligned and clear of the hotbar and the objective, no heart/brain/bar in the live document, 8 health computing as critical on one part-lit tick, the hotbar computing as a continuous strip with a 2px brass rule under exactly one cell, **the frame loop raising the interaction prompt for a chest placed under the crosshair and dropping it when it is removed**, every HUD layer below the settings panel with a hit test to prove it, no two HUD clusters overlapping, and the readout matching the restored body after a reload with exactly one of every element |
| `preview-hud.js` | writes `renders/hud-{day,day-vitals,objective,mid,critical}.png` — **real Chromium screenshots of the real game**, the only browser capture in this suite. It boots `game.html`, plays far enough to have a hotbar and a compass, and captures the HUD over live terrain at full, half and near-death. It exists because the HUD's worst defects are invisible to assertions: the first capture of Phase 27 showed captions that were present, laid out, non-zero and the right colour, and completely unreadable against sunlit grass — which is how the caption ink, the trace's dark underlay and the unlit tick value were chosen. **It proves nothing and asserts nothing; it is for looking at.** As of Phase 28 it does not run in the development container at all: its first full-page `page.screenshot` times out after 30s under SwiftShader. That failure reproduces identically on the unmodified Phase 27 build at `e027719`, so it is the environment and not a regression — and since it gates nothing, no phase claim rests on it |
| `onboarding.js` | Phase 28. Two halves. The **absence** is asserted against the real document, the real stylesheet and the real running build: none of `TUTORIAL_PAGES`, `TutorialController` or `Game._openTutorial` is defined, none of the ten tutorial element ids is in the body, none of the ten `.tutorial-*` rules is in the stylesheet, no code reaches for a tutorial element, and none of the six deleted card titles survives anywhere. The **replacement** is driven for real: the objective chain walked from "Gather wood." through tool, coal, torches, Anchor and the first night, plus the night and Rift overrides, with an audit that no objective line names a key; the three cues resolved through the real `PlayerController._onboardingCue` over log / stone / dirt / nothing, each retiring permanently once answered, each verb a single upper-case word, and a real affordance always outranking a cue; the latch refusing an unknown id and being idempotent over repeats; the save ladder — a new game owing all three, a hostile list repaired, a version 3 save migrated to "knows all three", and a version 1 save still climbing the whole ladder. **It makes no claim that a person understood any of it** |
| `browser-onboarding.js` | Phase 28 **in Chromium**. Boots the real page and asserts on the live document: that none of the ten tutorial ids exists before OR after clicking BEGIN, that nothing anywhere carries a tutorial id or class, and that the only thing ever covering the viewport is the Phase 20.2 opening instruction; that the first gameplay frame is the first frame and the objective line is laid out and visible on it; that a log placed in a **real generated chunk** raises `LMB · CHOP` above the hotbar and stone raises `LMB · MINE`, that looking at nothing clears it, that felling one block retires the cue, that `E · CRAFT` opens the real bench and retires its own, that `RMB · PLACE` survives to a real placement, and that a chest still says `RMB · OPEN` after all three are done; that an open settings panel clears the prompt; that SAVE, a **page reload** and CONTINUE bring back no tutorial and keep the cues answered; that a hand-written schema-3 save in real `localStorage` loads fully onboarded; that NEW GAME owes them again; and that the resolver costs well under a microsecond either way. **This is the browser validation for this phase** |
| `preview-compass.js` | writes `renders/compass-tape.svg` — the compass at six headings, re-emitted from the real `updateCompass` draw calls onto the real panel colours. Derived from the shipped code; **not** a browser render |

## About the browser run

`browser-save.js` and `browser-onboarding.js` are the only files in this suite that are
browsers. They need Playwright and a Chromium build (both are present in the development
container; without them each file prints `SKIP` and exits 0). Each starts its own static
server on its own port, so nothing else has to be running and they do not collide.

`game.html` pulls three.js from a CDN. Drop the same file in `tests/vendor/` and the run
becomes hermetic — the request is intercepted and served locally instead:

```
mkdir -p tests/vendor
curl -o tests/vendor/three.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
```

It is gitignored, for the same reason the baselines are: reproducible from one command,
and 600 KB.

Headless Chromium renders through SwiftShader, so this run proves that the game **boots,
simulates and restores** in a browser. It does not prove anything about GPU performance
and does not claim to.

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
