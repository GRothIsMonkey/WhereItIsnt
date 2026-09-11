# WHERE IT ISN'T — VALIDATION SUITE

> **RUN THE GAME FROM A SERVER, NOT FROM DISK.** Opening `game.html` with a `file://` URL
> plays **no recorded audio at all** — a browser refuses `fetch` and `XMLHttpRequest` for a
> local file and taint-silences a media element, so every one of the 274 runtime assets
> fails and only the synthesised fallbacks are heard. This was the root cause of three
> consecutive "the game is silent" playtest reports; see `CLAUDE.md` section 61.07.
>
> ```
> cd /path/to/WhereItIsnt && python3 -m http.server 8000
> # then open http://localhost:8000/game.html
> ```
>
> The human playtest script is `PLAYTEST.md` in the repository root and it says the same
> thing first.
>
> Every suite here already serves the page over HTTP, which is precisely why none of them
> could see the fault.

These are the checks Phase 20, its journey revision (20.1), the guidance pass (20.2), the
item-contact pass (21), the settings pass (22), the save/load pass (23), the story
foundation (24), the objective system (25), the XP removal (26), the HUD rebirth (27) and
the tutorial removal (28), the main-menu rebirth + typography pass (29), the opening
film (30), the environmental-storytelling framework (31), the Fake Haven sequence (32) and
the final creature (33) were built against. They run the **real game code** — the
`<script>` body of `game.html` is loaded into a Node VM with a small DOM stub, and a real
`VoxelWorld` is constructed and asked to generate real chunks. Nothing here reimplements
the generator, and nothing here asserts on metadata where a player-facing property could
be measured instead.

Everything here is offline **except `browser-save.js`, `browser-onboarding.js`,
`browser-menu.js`, `browser-opening.js`, `browser-environment.js`, `browser-haven.js`,
`preview-hud.js`, `preview-opening.js` and `preview-environment.js`**, which launch
Chromium, serve `game.html` over HTTP and drive the real page.

**The browser suites need `three.js` locally**, because the page loads it from a CDN that a
sandboxed or offline machine cannot reach — without it `window.game` never appears and every
browser suite times out after ninety seconds looking for it. Vendor it once:

```
mkdir -p tests/vendor
cp tests/node_modules/three/build/three.min.js tests/vendor/three.min.js
# ...or: curl -o tests/vendor/three.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
```

Each suite routes `**/three.min.js` to that file when it exists, so the run is hermetic.
`tests/vendor/` is gitignored. Where a file is offline it says so, and
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
node menu.js                       # Phase 29 — the menu, its anomalies, the HUD type scale
node opening.js                    # Phase 30 — the film's beats, lines, lifecycle, teardown
node environment.js                # Phase 31 — the story framework, its content and its latch
node browser-save.js               # Phase 23 — the same thing in a REAL browser, see below
node browser-onboarding.js         # Phase 28 — the same thing in a REAL browser, see below
node browser-menu.js               # Phase 29 — the same thing in a REAL browser, see below
node browser-opening.js            # Phase 30 — the same thing in a REAL browser, see below
node browser-environment.js        # Phase 31 — the same thing in a REAL browser, see below
node red-light.js
node runtime.js
node regression.js                 # needs a baseline, see below
node performance.js                # needs a baseline, see below
node render-journey.js             # writes PNGs into tests/renders/
node preview-hud.js                # Phase 27 — REAL browser screenshots of the HUD
node preview-opening.js            # Phase 30 — REAL screenshots of every beat of the film
node preview-environment.js        # Phase 31 — REAL screenshots of every object it adds
node haven.js                      # Phase 32 — the Haven stages, cabin, anomaly, save block
node browser-haven.js              # Phase 32 — the sequence in a real Chromium
node finale.js                     # Phase 33 — the beats, the creature, the scale, the cut
node browser-finale.js             # Phase 33 — the whole ending in a real Chromium
node audio.js                      # Phase 34 — the library, the manifest, the scenes, the mix
node browser-audio.js              # Phase 34 — real files through a real decoder, see below
node audio-audit.js                # Phase 34.1 — MEASUREMENT, not a test. See below.
node transitions.js                # Phase 35 — the rift chain, the Anchor, the crossings
node browser-transitions.js        # Phase 35 — BOTH rifts opened and walked in a real browser
node tools/measure_runtime.js      # Phase 35 — MEASUREMENT of every runtime audio file
node preview-suburbia-sanity.js    # Phase 36 — REAL screenshots of the Sanity ramp
node playability.js                # Phase 36 — the five ways a run could end
node browser-playability.js        # Phase 36 — THE WHOLE GAME, New Game to credits
node architecture.js               # Era 1.5 — the module mechanism and the boundaries
node tools/inventory.js            # Era 1.5 — MEASUREMENT of the build's shape
node tools/launch-check.js         # Era 1.5 — does it still BOOT AND PLAY? (~1 min)
```

## ERA 1.5 — THE BUILD IS NO LONGER ONE FILE

`game.html` now loads ordered **classic** `<script src>` modules from `src/` before its
inline `<script>`, and Era 1.5 will keep moving code out there for several more phases.
Two things follow, and both are already handled:

**No suite reads `game.html` directly any more.** Eighteen of them scanned it as text — for
a forbidden string, a stylesheet rule, an element id, an XP symbol, a `setTimeout` in a
class that may not have one. Every extraction would have shrunk what they scan while they
went on passing, which is exactly the failure shape `CLAUDE.md` §61.05–61.07 names three
times. `harness/source.js` reassembles the whole build — modules in declared order, then
the inline body — and that is what `SRC` is now.

```js
const SRC = require('./harness/source.js').buildSource();   // the WHOLE build, as text
```

**The offline harness replays the modules in order** into the one VM context, exactly as a
browser does. This works because classic scripts share one global lexical scope, which is
also the reason the extraction needed no code change at all. `architecture.js` re-measures
that property rather than assuming it.

`node architecture.js` is the gate for any future extraction: it proves every declared
module exists and loads in order, that nothing is declared twice, that no module reaches a
later one at load time, that `src/shared/` depends on nothing, that stable dimension ids
are kept distinct from creative dimension numbers, and that the P0 hotspots in
`ARCHITECTURE-INVENTORY.md` have not grown. It needs `acorn`; without it the AST half skips
and says so.

**`harness/story.js` is the one reader of STORY.md**, shared by `story.js`, `haven.js`,
`finale.js` and `objectives.js`. Ask it for a section **by title** — `byTitle('THE FINAL
CREATURE')` — never by number. Before it existed each suite sliced the bible with its own
hard-coded `indexOf('## 18. FAKE HAVEN')`, which is why one authored revision of STORY.md
broke twenty-two checks across four files at once. Numbers are the author's to change.

**After ANY extraction, run `node tools/launch-check.js` first.** It opens the real page
in a real Chromium, checks every declared module was served and is in scope, presses NEW
GAME, walks the player forward and screenshots the result — the one question no offline
suite can answer, in about a minute rather than twenty.

**Then run the four comparison suites against the pre-move build.** World
generation must come back bit-identical:

```
git show <pre-move-ref>:game.html > tests/baseline.html
node regression.js && node journey.js && node chain.js && node performance.js
```

**`browser-playability.js` is the one that answers the question the whole suite exists
for.** Everything else here tests a system, a dimension or a sequence. That one walks a
real New Game through every one of them to the credits, in a real Chromium, over HTTP,
with no `debugTeleportTo*` in it — and it is the file to extend when a future phase finds
a new way to strand a player. It is also the slowest thing here (about four minutes) and
it must not be run alongside another browser suite.

**AND THEN A HUMAN PLAYS IT.** `PLAYTEST.md` in the repository root is the script. No
suite in this directory can hear, and none of them can tell you whether a person could
work out what to do. Both of those are Phase 36's actual gate and neither is met by
anything below.

**Run the browser suites ONE AT A TIME.** They wait on rendered state, and two Chromium
instances starve each other's frame loop badly enough to produce false failures — and, if
two runs of the same file overlap, they collide on a port and on each other's output.

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
| `audio.js` | Phase 34. Two halves. The **library on disk**: 187 assets and 187 distinct Freesound ids with no duplicate copy, every asset carrying an attribution line in `AUDIO_CREDITS` (an unattributed file is a licence breach, not untidiness — this is the strictest assertion in the file), every asset carrying a row in `AUDIO_INDEX.md`, the index not duplicating the credits, and every NonCommercial/Sampling+ asset listed in the index's quarantine section. Then the **system**, driven for real: every manifest entry resolving to a file that exists and no bed longer than the 30s memory ceiling; every scene, event, cue, surface and preload key resolving to a real asset; sparseness asserted as numbers (no outdoor table faster than one event per 40s, indoors 70s, nothing placed closer than 12m, no bed louder than a footstep, 11 of 14 scenes with no horror bed at all); a real `AudioLibrary` against a recording AudioContext and a controllable fetch — a 404 fetched once and latched through fifty plays, a file that will not decode latched identically, a network error resolving rather than rejecting, and **with every asset 404ing a footstep still sounds**, because the synthesised voice is the fallback; the crossfade loop join measured on a real buffer; two hundred immediate plays of one sound producing three voices; forty sounds producing twenty; a bed named thirty times starting once; a bed replaced mid-load not coming back; all sixteen game states mapping to the scene they should and every scene being reachable; four simulated hours of one field producing 170 events and two hundred scene changes producing none in the ten seconds after each; ten ground materials classifying and an unknown one falling through; the REAL Phase 32 stage table proving no recorded layer ever rises and the REAL Phase 33 beat table proving none ever falls; one one-shot in the finale and no roar reachable from it; the teardown; and the architecture — the director unable to touch an AudioContext, the library unable to read a block id, exactly one place in the build that knows a block id exists, and no scheduler in either |
| `browser-audio.js` | Phase 34 in a real Chromium with a real AudioContext at 44.1kHz, a real HTTP server and a real decoder: the menu fetching zero audio files and no library existing until the player clicks; all five buses in the live graph at their shipped values; fourteen probe assets fetched and decoded, **including every one whose original was AIFF, FLAC or AAC**, so the conversion is validated rather than assumed; a bed coming back crossfade-joined at 28.8s from a 30s file; a real 404 against a real server latched after one request; four scene changes driven through the REAL frame path (night falling, the escalation, stepping under a roof, walking back out into the morning) each swapping the beds by itself and never accumulating; the AMBIENCE slider silencing its bus and leaving music and effects alone, and the settings panel's own input moving a live gain node; twelve footfalls on two surfaces sounding through the real graph and the ground under the player classifying from the real generated world; the real `startHavenAmbience`/`setHavenAmbienceLevels`/`stopHavenAmbience` and the real `startFinaleAudio`/`setFinaleBeat`/`stopFinaleAudio`; the teardown observed and the loop's rebuild after it; and the whole run raising no page error and exactly one failed load — the one the test asked for. **It found the defect that no offline test could**: `deep` was written as an absolute `y < 26`, which is above sea level, so an ordinary ground-floor room got the basement room tone |
| `audio-audit.js` | Phase 34.1. **Not a test — a measurement, and it asserts nothing.** Boots the real game in a real Chromium, wraps every sound-producing method on the live `SoundEngine` and `AudioLibrary`, walks the Overworld, Farmlands and Suburbia by day and night, and prints what actually happened: the scene chosen, the beds on it and their levels, the surfaces the real ground classified as, every sample played or refused, every synthesised call, every bed and scene change with a timestamp, and a simulated two-hour ambient event rate for each of nine game states. Run it whenever the question is "what does the player get" rather than "does the code run" |
| `preview-suburbia-sanity.js` | writes `renders/sanity-suburbia-{100,60,34,30,8,0}.png` — **real Chromium screenshots of the real street** at each step of the post-FX ramp. It exists because Static Suburbia used to pin the player at Sanity zero within about a minute and stay there for the whole dimension, and no assertion can say what that looks like: at 34 the street is atmospheric and completely legible, at 0 it is a grey rectangle. Those two pictures are the entire argument for the floors Phase 36 added. **It proves nothing and asserts nothing; it is for looking at** |
| `playability.js` | Phase 36, and every check in it is a regression test for a way the build could take a run away from a player — **all five found by reading the shipped code on a day when every suite here was green.** The Behemoth gate proved to be live state rather than a saved latch (it was saved, the mob was not, and a reload on the third night made the game unfinishable), with the real `MobManager` driven to prove `hasBehemoth()` answers for a spawned boss, a reaped one and an ordinary hostile; a mob below `MOB_VOID_Y` removed from the loop **without** being counted as a kill, and one standing on real terrain left alone; the real `AnchorMonumentManager` and the real `destroyBlock` proving a powered Anchor returns the RIGHT Core Disk and an unpowered one returns only itself; the victory screen's two modes, its button's three destinations, and four things `_dismissBossVictory` must not do (raise the stage, teleport the player, lengthen the nights, raise the difficulty); the frame loop returning before the streamer or a single mob on a win screen; four full-screen layers taken down by `resetPresentation`; the lost-Disk recovery's three "spent" tests evaluated against real save shapes; the chain's hinges still one apiece; and no debug command reachable from any transition. Then the real `SanitySystem` driven for fourteen simulated minutes of Static Suburbia, proving the drain SETTLES instead of pinning at zero, that standing still is still a punishment, that walking recovers, and that ten minutes of walking never gets back to comfortable. And one claim nothing had ever made: **a body with the player's real dimensions, walked through the game's own collision from the street into Static Suburbia's Disconnected Home** — the strangest structure in the game, its roof laid on the ground and its chest hanging in mid-air — landing 5.76 blocks from eye to chest against a reach of 6, with no block broken |
| `browser-playability.js` | Phase 36 **in Chromium, over HTTP, and it is the whole game**. A real New Game; the film skipped through its own control; a real oak felled through the real `destroyBlock`, collected through the real pickup radius, and turned into an Anchor Monument by the real recipe table and raised with a real right-click; the clock moved to the third night and **the Behemoth arriving through its OWN GATE** — `spawnBehemoth` is never called by the test; then the regression the phase exists for, a real SAVE, a real page RELOAD, a real CONTINUE, and **a Behemoth coming back**; the kill through the real damage path; the Disk collected off the ground; the victory screen measured to have STOPPED the world (the clock and the streamer both frozen across 1.2s) and its button measured not to move the player or the stage; the Disk fed to the Anchor; **the Anchor then broken on purpose and the Disk recovered off the floor** and fed to a second one; the rift walked into on the shipped movement code; the Farmlands paying for their own Anchor out of an ashen trunk; the guaranteed chest opened with a real right-click; the second rift walked; and then **the leg no suite had ever walked** — the Disconnected Home stamped by the real generator in Static Suburbia, its chest reached from the floor of the inverted room (6.5 blocks, inside the 6-block reach) and opened, the Level 3 Disk collected, and the Fake Haven firing by itself from the frame loop; the Haven refusing to save; the shift; the finale; the hard cut; the credits; and a New Game taken FROM the credits leaving no black overlay, no credits screen, no white wash and no win screen behind it. Five screenshots, and no page error anywhere in it |
| `transitions.js` | Phase 35. The dimension crossings, offline against the real objects. The real `AnchorMonumentManager` driven through the exact sequence that used to dead-end the game: a rift opened, an Anchor put down, a SECOND rift opened on the far side — `powerRiftCore(3)` returned false forever before this phase, because nothing closed the first rift when the player walked through it, and Static Suburbia, the Fake Haven and the finale were therefore unreachable in normal play. Then: every crossing running the ONE teardown and that teardown clearing the Anchor, the mobs, the Stalker, the hallucinations, the arrows, the dropped items, the animal rigs and the stationary timer while touching neither the inventory, the compass, the milestones, the environmental-story latch nor the save; the rift arming window driven at a real timestep and proved not to fire on the frame it opens; the Farmlands proved to contain wood a player can pick up, through the real `destroyBlock`, the real recipe table and the real `Inventory`, because an Anchor costs four planks and an ashen trunk dropped NOTHING in every previous build; `dimensionOfWorldPos` against all four regions; the save validator dropping an Anchor that stands in a different dimension from the one the save names, which is the repair a pre-Phase-35 save needs; the objective a player is actually shown on the far side of each crossing; and the respawn proved to keep the player in the dimension they died in |
| `browser-transitions.js` | Phase 35 in a real Chromium over HTTP, and it walks the whole chain with no debug command in it: a real New Game, an Anchor placed with a real right-click on real ground, a real Hollowed Behemoth killed through the real damage path so the Core Disk arrives as a real dropped entity and is collected by the real pickup radius, the real right-click that feeds it to the Anchor, the real trigger radius walked into — THE SHATTERED FARMLANDS — a real ashen trunk chopped and collected, the real recipes turning it into an Anchor, the guaranteed chest opened for the Level 2 Disk, that Disk fed to the second Anchor and that rift walked into — STATIC SUBURBIA. On each arrival it measures that the previous dimension's Anchor, rift, pin, entities and audio beds are gone, that the objective is the destination's, that the player can walk on what they landed on, and that a save written there validates. Then a page reload and CONTINUE. Four screenshots, and the whole run raising no page error |
| `tools/measure_runtime.js` | Phase 35. **Not a test — a measurement, and it asserts nothing.** Fetches all 274 files in `assets/audio/runtime/` over HTTP and decodes each one with a real `AudioContext`, then reports duration, true peak, RMS, DC offset, samples pinned at full scale and leading silence. It had to be a browser because 121 of those files are MP3 and nothing offline here can decode one — which is exactly how a build-time fault could sit in half the library unseen. **It found one on its first run**: `build_runtime.py` took a one-shot's PEAK from a mono 22.05 kHz downmix, which low-passes at 11 kHz and averages the channels, so `PEAK_CEIL` was never enforced for any `sfx` — fourteen shipped above the ceiling and three shipped clipped. Run it after any rebuild of the runtime directory |
| `finale.js` | Phase 33. The beat table tiles all 32s with no gap and every beat's duration sits inside the brief's own window; the creature is BUILT and MEASURED — 150m tall, 10.7:1 slender, arms ending below the knee, a head 4.5% of the body, every material unlit and exactly one of them pale; no RingGeometry, TetrahedronGeometry, PointLight or emissive anywhere in it; the landmark ladder marches outward and the creature subtends more of the screen than any of it despite being the furthest thing in the shot; the fog curve is checked against `exp(-(density*d)^2)` so the creature is 0.3% visible at the silence beat and never more than 77%; the camera drift is driven and a shoved yaw is proved not to snap; gameplay keys are gated through a terminal cinematic; the audio rig is idempotent, starts three sources, stops all three by name and never gets quieter; the sequence is begun from one call site downstream of the shift, spawns nothing hostile, writes no text, touches no save, tears down before handing to the credits, and costs 0.00165 ms/frame |
| `browser-finale.js` | Phase 33 in a real Chromium with a real WebGL context: a real New Game, the real Haven run out, the real handoff, the renderer measured clean at the boundary, the creature measured at 145m in world units with zero lit materials, all seven beats walked live, the fog measured opening and the eye measured lifting, the arm and head measured moving and staying moved, leaning on the keyboard proved to move nothing and open nothing, the hard cut, the credits exactly once, the save byte-identical, and a New Game followed by a second full ending leaving no duplicate mesh, audio rig or scene object |
| `haven.js` | Phase 32. The stage table tiles all 178s with no gap and resolves identically for the same second; the comfort is measured (nothing changes for 82s) and every stage is a subtraction — no ambience layer or music state may ever rise; the dissolve is a monotonic ramp reaching exactly 1; the real cabin is read out of real chunk data and found closed, floored, roofed, furnished and lit; the one committed change is driven from four camera positions and refused from three of them; the armchair callback is present with its prerequisite and absent without it, and is literally the same furniture id the Farmlands stamps; the cabin refuses mining and placement while the bed and chest still work; the finale entity is spawned from one call site downstream of the shift; the ambience rig is idempotent and stops all five of its sources; the save is refused and a forged Haven save never loads; and no string the sequence can show is longer than sixty characters |
| `browser-haven.js` | Phase 32 in a real Chromium with a real WebGL context: a real New Game, the real entry point, the world genuinely flushed to the nine-chunk pocket, control and pointer lock returned, forty frames of holding the break button at a cabin wall removing nothing, a real save written from the Overworld and not moved by a byte from inside the Haven, all six stages walked against a live renderer, the mug appearing only once the player has looked away, the fog and shader and lights measurably collapsing, the handoff handing the renderer back on the same frame, and a New Game followed by a second visit leaving no duplicate light, chunk, audio loop or timer |
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
| `menu.js` | Phase 29. Two halves. The **menu**: that there is exactly one start screen and one of each of its three controls, that `startEmbers` is undefined rather than disabled, that neither `MainMenu` nor `MenuAtmosphere` touches an objective, a save, the world, the clock, progression, the player, a mob or pointer lock, that 40 open/close cycles leave zero window listeners, that the three gesture listeners are bound once in the constructor and gated on being open, that the three anomalies are frozen at three, that nothing happens for the first 14 seconds and the figure not before 34, that five minutes produces a countable handful of events, that the schedule is deterministic in the seed and monotonic, that the tower light is lit 0.6% of the time, and that no menu text uses the canon's internal vocabulary. The **typography**: that Courier New is gone from the stylesheet, that the replacement names a real face per platform and disables faux-bold, that nine measured HUD sizes are at or above their floor and none is above 16px, that the type the player reads is 600+ weight, that the four-step scale is strictly descending with a 10px floor the media query also obeys, that nothing is blurred and no HUD text-shadow reads as a halo, and that `_fitCanvas` scales backing store and context together and no-ops at ratio 1. **It makes no claim that the menu is atmospheric or that the HUD is comfortable** |
| `browser-menu.js` | Phase 29 **in Chromium**. Boots the real page onto the real menu and reads back real pixels, real computed styles and real layout boxes: that the scene canvas is sized to the window and has genuinely been painted (luminance range down the centre column, near-black silhouette across the tower's row); that the title resolves to `WHERE IT ISN’T` at a sane size; that NEW GAME and SETTINGS are laid out, on top and hit-testable; that CONTINUE is hidden with no save and shown, labelled and clickable with one; that settings opens over the menu, its controls are reachable, and Escape closes it without taking pointer lock; that pressing E / I / W / A / 3 / Q / Tab and clicking the background leaves the bench shut, the backpack shut, the Phase 28 cue unburned, no key held, no pointer lock, no frame loop, no clock movement, no objective, no save write, no chunk generated **and the menu still up**; that the anomalies really appear on the canvas over 100 simulated seconds and are absent for 99.5% of them; that nine HUD readings resolve at or above their floors at 1280x720 **and** at 900x600 with nothing overlapping or off-screen; that the menu survives 640x480; that 25 show/hide cycles leave one screen and one canvas; and that a save, a reload and CONTINUE restore the same HUD with no duplicated elements. **This is the browser validation for this phase.** Screenshots are best-effort and reported as written or not — see the note below |
| `preview-hud-type.js` | writes `renders/hud-type-{bright,dark}.png` plus zoomed crops of the vitals and the hotbar — the **real HUD markup and the real stylesheet** over sunlit grass and over a dark interior, rendered in real Chromium with **no WebGL**, so it captures instantly where a live capture times out. It exists because the Phase 29 readability problem was found in a screenshot and can only be checked in another one; it caught two defects a dark background hid completely (the tick ring reading as empty boxes, and the translucent unlit tick vanishing into daylight). **It proves nothing and asserts nothing; it is for looking at** |
| `opening.js` | Phase 30. Drives the **real `OpeningFilm`** against a stand-in for the parts of `Game` it touches: that the beat table is frozen, unique-id'd and tiles the whole film with no gap or overlap; that it opens on real darkness and holds a real stretch of ordinary world before anything happens to it; that the film says exactly two short lines and that neither they nor any string on the layer uses the canon's internal vocabulary or explains a mechanic; that `begin` is idempotent, locks movement, hides the HUD, starts the ambience and asks for pointer lock; that FIVE different exits (running out, skipping at any point, skipping on the first frame, a second film, a film that never rendered) all land in the one teardown and put back movement lock, eye height and the borrowed hour, dispose every geometry and material and leave the scene graph exactly as it was found; that the film contains no `setTimeout` and binds its listeners once; that the shapes are untextured engine primitives with no anatomy and none of the game's creatures; that the moving shape moves only while it is NOT being looked at; that the save schema did not change and carries no cinematic flag; and that the Phase 20.2 instruction is still the film's closing beat and still has exactly one authority. **It cannot prove the film is any good** |
| `browser-opening.js` | Phase 30 **in Chromium**. Boots the real page, clicks NEW GAME and watches the real film in a real WebGL context: that the frame loop draws it while `running` stays false; that the world genuinely does not move behind it — no day advanced, no objective created, no block changed, no chunk streamed, no health or sanity touched; that E, I, the movement keys and both mouse buttons do nothing and do not end it; that O opens settings **over** it and genuinely pauses it, and that Escape then closes the panel without also skipping the film; that the beats arrive, the shapes appear and are gone again by the calm beat, and the film ends itself and hands to the crossroads instruction; that gameplay begins with the HUD, the crosshair, the first objective and movement restored; that the SKIP control is a real hit-testable target that lands in exactly the same state a watched film does; that CONTINUE never enters the film at all; and that six films in a row leave the scene graph, the document and the audio unchanged. **This is the browser validation for this phase** |
| `preview-opening.js` | writes `renders/film-{dark,reveal,familiar,anomaly,closer,vast,seam,unresolved,calm}.png` — **real Chromium screenshots of the real film in the real world**, one per beat, taken by driving the film's own clock through its own `update()` and drawing one frame by hand (this container renders the Overworld at about one frame a second, so waiting in real time is not possible). It exists because every composition defect in this film was invisible to assertions and obvious in a picture: the first vantage was inside a tree, the first vast shape was below the horizon and inside the fog, the second read as a brown rectangular building, and the human-sized silhouettes could not be seen at all from above a canopy. **It proves nothing and asserts nothing; it is for looking at** |
| `environment.js` | Phase 31. Drives the **real generator** — real chunks, real farmsteads, real Suburbia lots, the real Haven cabin — and the real `EnvironmentStorySystem`: that the event table is a frozen, unique-id'd, audited vocabulary in which every event names a closed storytelling category, a persistence class, a dimension by name and a PLACE rather than a coordinate; that fifteen kinds of malformed definition are all rejected and none of them throws, including a callback whose original is never tracked; that sixteen chunks around a story site are byte-identical across two worlds generating in opposite orders and that a story chunk unloaded and regenerated comes back the same; that every object is actually in the world at the coordinate its site resolves to, that the held place contains no Anchor block, and that the released one is the same square with nothing on it; that the farm yard vocabulary is stamped on a minority of farmsteads and every repeat of an arrangement is **byte-identical**; that no Overworld object reaches the Farmlands and no Farmlands object reaches the Overworld; that a milestone brings one event into existence and moves nothing else; that each of the three callbacks is absent without its prerequisite, present with it, and that noticing one original brings back exactly one callback; that the notice latch round-trips through the real save validator and drops invented ids; that the 4 → 5 migration derives nothing; that the runtime cannot reach the HUD, an objective, a marker or a timer, and that not one string literal in the phase is long enough to be a sentence. **It cannot prove any of it is noticeable** |
| `browser-environment.js` | Phase 31 **in Chromium**. Boots the real page, plays, walks a real player to a real object in a real streamed chunk and reads it back out of chunk data; latches it through the real notice sweep inside the real frame loop and asserts that the objective, the toast, the prompt, health, sanity, the milestone set, the scene graph and every overlay are exactly what they were; generates the Suburbia callback in one browser that has noticed the original and in a second browser that has not; saves, reloads the page, hits CONTINUE and finds the latch and the callback still there; clears it through the in-session New Game and through a fresh page; and confirms settings, the backpack, the HUD and walking still work. **This is the browser validation for this phase** |
| `preview-environment.js` | writes `renders/env-{holding,released,crossing,farmyard,sub-holding,sub-board}.png` plus `env-photographs.png` — **real Chromium screenshots of the real objects in the real world**, one per piece of content, plus a 14x crop of the two family photographs taken straight out of the live texture atlas because the difference between them is eleven pixels. **It proves nothing and asserts nothing; it is for looking at** |
| `preview-compass.js` | writes `renders/compass-tape.svg` — the compass at six headings, re-emitted from the real `updateCompass` draw calls onto the real panel colours. Derived from the shipped code; **not** a browser render |

## About the browser run

`browser-save.js`, `browser-onboarding.js`, `browser-menu.js`, `browser-opening.js`,
`browser-environment.js`, `browser-haven.js`, `browser-finale.js`, `browser-audio.js`,
`browser-transitions.js` and `browser-playability.js` are the files in this
suite that are browsers. They need Playwright and a Chromium build (both are present in
the development container; without them each file prints `SKIP` and exits 0). Each starts
its own static server on its own port, so nothing else has to be running and they do not
collide.

**Screenshots in this container are unreliable and the suites say so rather than
pretending otherwise.** Capturing the page while the WebGL frame loop is running times out
under SwiftShader — the limitation Phase 28 recorded against `preview-hud.js` and
reproduced there on an unmodified build. `browser-menu.js` therefore treats every capture
as best-effort and prints which ones were actually written; the menu captures (no frame
loop) succeed, the in-game ones usually do not. No assertion anywhere depends on a
screenshot.

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

## About the audio (Phase 34)

The game plays files from `assets/audio/runtime/`, which is **built, not authored**. It
holds browser-ready copies of the collected originals and is entirely disposable:

```
python3 tests/tools/build_runtime.py          # rebuilds every runtime copy and footstep slice
python3 tests/tools/gen_audio_index.py        # regenerates assets/audio/AUDIO_INDEX.md
```

Both need `ffmpeg` on the path. `tests/tools/audio_inventory.py` is the single source of
truth for what each asset is and what it is for — a new sound is a row there, then a
rebuild, then a row in `AUDIO_SCENES`/`AUDIO_EVENTS`/`AUDIO_CUES` in `game.html`.
**Nothing in these tools ever writes to an original**, and `assets/audio/` is never read
by the game.

Headless Chromium renders audio to a null device, so `browser-audio.js` proves the files
**fetch, decode and reach a live graph**. Nothing in this repository has been listened to
and no test claims otherwise.

### `audio-audit.js` — run this before claiming audio work is done

It is **not a test and asserts nothing.** It boots the real game in a real Chromium, wraps
every method in the build that can make a sound, walks each dimension and prints what
actually happened: which scene was chosen, which beds were on it at what level, which
surfaces the ground classified as, every sample that played or was refused, every
synthesised call, and the simulated ambient event rate for each state.

It exists because Phase 34 shipped with both suites green and a human playtester found the
game nearly silent under an unwanted music loop. The suites proved the system CAN select
and play a sound; they could not answer "what does the player get". This can, and its first
run produced every finding in `PROGRESS.md` section 0.0000000000000.

**Phase 34.2 added a meter, and four words it now keeps apart.** Everything described above
counts CALLS, which is what both earlier passes measured — and both times the game shipped
nearly silent with the counts looking healthy, because "the code asked for a crow" and "the
player heard a crow" are different claims. There is now an `AnalyserNode` on every bus and
a bed-state reader that looks at the NODES rather than the slot table:

```
REQUESTED  a call was made                          (the counters)
STARTED    a real BufferSource exists on the slot   (reported LIVE / LOADING / DEAD)
CONNECTED  it is on a gain node in the live graph
AUDIBLE    signal measurably present on the bus     (rms/peak dBFS, measured)
```

This distinction is not academic: `AudioLibrary.setBed()` claims its slot **before** the
decode lands and leaves it claimed if the load fails, so the slot table cheerfully reports
a bed playing when nothing is playing. The `IS IT AUDIBLE` section flags any bus carrying
live beds that still reads silence, and any asset that failed to load.

It still cannot listen — headless Chromium renders to a null device. It measures the
signal; whether that signal is the right sound in the right place is a person's judgement.

```
node audio-audit.js                       # ~25s of walking per dimension
WII_AUDIT_SECONDS=90 node audio-audit.js  # longer, if a rare event is being chased
```

**In a live session**, `debugAudioOverlay()` in the browser console shows the same picture
in real time: context state, dimension, scene, bus levels, every bed and whether it is LIVE
/ LOADING / DEAD, the last cue played and its gain, the footstep surface and the family it
selected, the countdown to the next ambient event, and any dead assets.
`debugAudioOverlay(false)` removes it. It is developer-only and nothing is created,
listened to or scheduled until it is asked for.

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
