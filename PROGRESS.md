# WHERE IT ISN'T — PROJECT STATE

```
Current phase              20 — FARMLANDS JOURNEY + DISCONNECTED HOME 2.0
Phase 19                   COMPLETE
Phase 20                   COMPLETE
Phase 20 journey revision  COMPLETE           (20.1 — see section 0)
Phase 20.2 guidance        COMPLETE           (see section 0.5)
Authoritative build        game.html          (there is no other game file)
Offline validation suite   tests/             (see tests/README.md)
```

Phases 1–19 are as their sections in `ROADMAP.md` describe them. This file records the
state of Phase 20 specifically: what was built, what was measured, what was found and
fixed along the way, and what is honestly not verified.

**Sections 1–5 describe Phase 20 as it was first delivered. Section 0 describes the 20.1
journey revision that followed a human playtest and supersedes them wherever they
disagree** — principally the beat table, the landmark set, the distances, and the
performance figures. **Section 0.5 describes Phase 20.2**, which added the opening
instruction and the compass and changed no world generation at all.

---

## 0.5. PHASE 20.2 — JOURNEY GUIDANCE, LORE INSTRUCTION + COMPASS

### Why

Phase 20.1 built a journey the player had no reason to choose. The Farmlands arrival is a
genuine four-way crossroads and the authored chain runs east from it, but nothing told
anybody that — so the intended experience depended on the player guessing. 20.2 does not
move a single landmark or a single road. It gives the player two things: **a sentence**,
and **an instrument to act on it**.

### The instruction

At the end of the pre-gameplay flow, on black, in near-silence:

> *At the crossroads, go east.*
>
> *Go east.*

That is the entire text of the feature. It names no landmark, no destination and no
mechanic — `compass.js` asserts that, matching against the words themselves. It is
skippable, it is never repeated as an objective, and the journey objective line was
checked to make sure it never says "east" and so can never compete with it.

**There is no opening lore film yet** — the roadmap builds it in Phase 30 — so this is
authored as the beat that film will END on, behind one entry point (`OpeningInstruction`)
that Phase 30 can call as its last cue without unpicking anything. It deliberately does
not use the tutorial screen's vocabulary: no panel, no border, no button, no icon.

It sits in `Game._start()`, which is the single funnel both routes into gameplay pass
through — finishing the tutorial *and* skipping it — so it is the last thing before the
world on every route. `_start()` no longer starts the frame loop; that moved to
`_beginPlay()`, which the instruction calls when it finishes or is skipped.

**One recall, once.** The player hears this in the Overworld and reaches the Farmland
crossroads a long time later, so the same two lines surface a single time on first
arrival — over live gameplay, no backdrop, latched so it can never become a prompt.

### The compass

A **tape**, not a dial: a strip of heading sliding behind a fixed brass caret, in the same
panel fill, border, radius and parchment text as the existing `#clockWrap`, so it reads as
a second instrument on the same dashboard rather than a new piece of UI. A tape was chosen
over a needle precisely because a needle can be mistaken for something that *points at* a
destination, and requirement 8 turns on that distinction.

It shows N/E/S/W, the four intercardinals and 15° ticks. It reads **nothing but the
player's yaw** — no landmark, no position, no distance — and `compass.js` asserts that by
scanning the renderer's source for any such reference.

**Directions were derived, not assumed.** Three independent facts in the shipped build
agree: the movement basis is `forward = (-sin yaw, 0, -cos yaw)`; `farmlandsSpawnYaw` is
exactly `-π/2` and has been asserted since Phase 20 to be "facing east"; and every
landmark in the chain resolves at increasing x. So **EAST = +X**, and with UP = +Y a
right-handed frame forces **NORTH = -Z** — which is also the vocabulary the Farmlands
generator already describes itself in. The bearing is then `-yaw`, normalised.

### How it is earned

The **first Ancient Chest cracked in the Overworld**. That is already mission directive
[4] — "Crack an Ancient Chest for rare supplies" — so no structure was added, nothing
moved, no directive changed and no quest exists. It is granted before and outside the loot
roll, so it can never displace a roll or depend on the random pool, and it is gated to the
first dimension because both Disconnected Homes have chests of their own.

It is **not an inventory item**, deliberately: an item can be dropped, burned in a chest,
or lost on death, and a navigation aid the player can permanently lose is a trap. The flag
lives in the `Game` progression block beside `behemothSpawned` and `fakeHavenTriggered` —
the canonical container a Phase 23 save will serialise — and every dimension crossing
(Levels 2, 3, 4 and the dev teleports) re-applies it through `_syncProgressionHUD()`.

### What was NOT changed

No landmark moved: fallen tower 410, tower 793, barn 1179, tree 1625, Home 1944 — all
within 40 blocks of their 20.1 distances, asserted. No road changed. The four-way
crossroads was **verified intact** rather than rebuilt: both arrival lanes are still
forced, the 20.1 corridor suppression keeps the arrival crossing, and all four arms are
unbroken road for 400 blocks when followed along their own meandering centrelines.

### Defects found and fixed

| what | found by | why it mattered |
|---|---|---|
| the repaint gate required the heading difference to be strictly `> 0`, which inverted it | counting real canvas draw calls over 600 still frames | a player standing still repainted the tape on **every frame** — the exact opposite of the gate's purpose |
| the gate subtracted bearings without wrapping | the same test, taken across the 0/360 seam | facing **due north** — a cardinal a player using a compass will deliberately sit on — the difference reads as ~2π, so it repainted forever there |
| the offline harness returned a plain `<div>` for `getElementById`, so HUD canvases had no 2D context | writing the first test that touches one | any canvas-based HUD element was untestable, and would have failed silently rather than loudly |

### Cost

Measured, not asserted. A **forced** repaint costs **3.3 µs** — 0.020% of a 60 fps frame —
and a stationary player pays a single float comparison and nothing else. With the compass
unearned, 600 frames of arbitrary heading cost zero draw calls. This phase adds **no world
generation work at all**, and `performance.js` is unchanged within noise.

---

## 0. THE JOURNEY REVISION (20.1)

### Why

A human playtest found the systems working and the **composition** weak. The Farmlands
still read as a procedural grid of roads and destinations rather than as one road that
goes somewhere: the journey was short, the route was one lane among many that looked the
same, cross-lanes met it every ninety blocks, and the water tower — the phase's signature
landmark — was four parcels from the arrival point and effectively the end of the walk.

Nothing was rebuilt. The animals, the ecology, the water, the routes, the tower, the red
light, the farmhouse and the buried volume are all untouched except where named below.
What changed is composition, navigation and landmark staging.

### The landmark chain

Five authored landmarks now span **1,950 blocks** instead of one at 300 and a house at
800. Every one of them is a physical structure in the world, placed by a clear-window
search in its own parcel column, with its own keep-out and its own silhouette range:

| column | blocks from arrival | landmark | how big |
|---|---|---|---|
| 0–5 | 0–380 | wheat, livestock, farmsteads, open country | Phase 17–19, unchanged |
| **6** | **410** | **the giant fallen water tower** | 46 blocks end to end, 13 high, lying **across** the road |
| **12** | **793** | **the massive standing water tower** | 38 tall — unchanged from Phase 20 |
| **18** | **1,179** | **the giant barn** | 21 to the ridge, 34 across, 50 with its silos |
| **25** | **1,625** | **the great tree**, in a ring of dead land | 41 tall, **53 across** |
| **30** | **1,944** | **the Disconnected Home** | unchanged from Phase 20 |

The scale hierarchy is the point and it is readable without any UI:
`ordinary barn 8 < fallen tower 13×46 < standing tower 38 < giant barn 21×34 << great
tree 41×53`. `tests/chain.js` measures every one of those numbers out of the generated
voxels rather than out of the constants.

**The fallen tower is the same object as the standing one.** Truss, drum, dome, mast and
lamp housing, laid along the ground in the order they occupy in the air, with the legs
sheared off four fieldstone footings, the drum split along a seam, a churned impact scar
and a main that has been leaking into the same puddle for decades. A player who walks
under it knows exactly how big the intact one on the horizon is, an hour before they
reach it — the chain teaches its own scale.

**The great tree wins on width, not height**, and that is arithmetic: chunk data stops at
y=63 and the heightfield reaches 29, so nothing in the dimension can stand much more than
thirty blocks above high ground and the standing tower has already spent that budget. A
crown fifty-three blocks across has no such ceiling. It is built as a union of eight
lobes resolved per column into a hollow shell — 9,259 voxels where a filled crown would
be roughly forty thousand.

**The dead land** is a graded radial ramp centred on the trunk: rotten ground out to 46
blocks, ordinary farmland by about 110, and a long, barely perceptible transition between
them that thins the crops before it kills them, retreats the woodland (16% canopy in the
inner ring becomes 0%), and rots the soil. Its rim is pushed in and out by up to eighteen
blocks by two hashed harmonics, so it is not a circle. The one living thing in the region
stands in the middle of it.

### The road hierarchy

The route is now visibly **the main road**, and the lattice is suppressed around it —
without deleting anything, and without touching a single parcel outside the corridor:

- the journey lane's carriageway is **five blocks wide with four-block verges** against
  three and two for every other lane: measured, 5.7 blocks of carriageway across it
  against 0.0 on an ordinary lane of the same lattice at the same x;
- **no road runs parallel to it** anywhere inside the corridor (0 parcels, from 15 before
  the band was made asymmetric — see below);
- crossing lanes survive at **34%**, and the ones that do are demoted to a single rut
  where they meet the road rather than opening into a crossroads apron;
- the ones that do not survive **fade out and stop eight blocks short of the verge**,
  which is what a field track nobody has driven in thirty years looks like;
- the junction apron is a third of its usual reach inside the corridor.

Measured over 2,000 blocks: **6 places where something meets the journey, against 18 on
an ordinary lane of the same lattice.** Outside the corridor, 240 surface samples six
parcel rows off the route are identical to the pre-revision build.

### Staged reveals

All four structural landmarks carry a fog-exempt silhouette proxy on the same machinery
the tower's used, with **four different ranges** so the horizon changes as the player
walks rather than presenting a list: the fallen tower fades in at 240 blocks, the giant
barn at 340, the standing tower at 380, and the great tree at **560** — further than
anything else in the dimension, and the only proxy that is not grey. At the busiest point
of the walk three are on the horizon at once; never four.

The standing tower is now **793 blocks from arrival against a 380-block silhouette
range**, so it cannot be on the horizon when the player lands. It appears at journey
column 7 — after the fallen tower, and with five columns still to walk. The route runs on
for **1,151 blocks past it**.

### Defects this revision found and fixed

| what | found by | why it mattered |
|---|---|---|
| `_farmClearWindow` still deducted margin for lanes the new hierarchy had suppressed | the fallen tower could not be placed at all | a 46-block plot rejected because two absent lanes each claimed ten blocks |
| the corridor band was symmetric, but a lane on line L belongs to parcel row L−1 half the time | `chain.js` parallel-road census | 15 parcels inside the corridor still carried a road running alongside the journey |
| doomed crossings faded to nothing only within 5 blocks of the road | `chain.js` meeting census: **21 meetings against 18** outside | the corridor was no quieter than the lattice it replaced, only narrower |
| the junction apron ran to full reach in the corridor | same census | every surviving farm track opened into a plaza where it met the road |
| the tower's and barn's gates were cut in an east edge, with the lane to the north or south | reading the stamper against the east-west axis | the service track had to leave the compound sideways to find the road |
| the fallen tower's mast ended **two blocks past its own levelled plot** | `chain.js` lamp-housing check | the nose of the wreck hung over unlevelled field |
| the wreck lay ALONG the journey, on the same axis the road runs | first-person render from seventy blocks | it was only ever seen END-ON — eleven blocks wide — so a forty-six-block landmark read as a small pale smudge. Its plot is now 26×46 and the whole thing is laid out road-relative, broadside to a player walking east |
| the crown's underside wrote leaf cells **inside the bole** | trunk-column inspection | a green block twenty-four courses up a solid trunk |
| limbs started at the trunk's axis, not its surface | same | limb geometry replacing bark in a stripe up the trunk |
| the great tree stood on **Ashen Forest floor**: its plot resolves at biome 0.09, and the ash test ran before the rot test | block census of the tree's chunks (1,498 ASH_GROUND) | the one living thing in the region standing in grey woodland litter instead of rotten farmland |
| the woodland stopped at the rot radius instead of retreating | canopy census against the pre-revision build | 16% canopy sixty to ninety blocks out; the crown had a tree line at its own level to be ranked against |
| the plot-levelling loops called `_farmBaseHeightAt` for every column instead of the rim | benchmark: 11.2 ms/chunk | twenty simplex evaluations × 1,196 columns for a retaining course that only exists at the edge |
| the barn's silos and machinery bay hung off the east and west edges of its 42-block plot | first-person render of the yard, and a plot-containment check | the pad has already begun banking back to the field there: footings in mid-air on one side, buried on the other. The plot is now 54×44 and the complex is laid out front-relative to the road |
| the barn's layout was derived independently in the stamper, the proxy, the tests and the render script | the loft check found half a floor after the barn moved three blocks | it is resolved once now, onto the site descriptor, and everything else reads it |
| living tussock grass and weed clumps grew on rotten ground | ground census forty blocks from the trunk | the soil, the crops and the woodland all retreated from the tree; the Phase 19 foreground layer did not |
| a fifth of the columns the rot's patch noise spared came back as `ASH_GROUND` sixty blocks out | the same census | the tree's plot is inside the Ashen Forest's contamination edge, and the ash test ran after the rot's fall-through |
| the silhouette proxies used the tower's fixed 90-block out-fade | render at 200 blocks | on a 240-block range that leaves a landmark at full strength for a 40-block window and fading everywhere else |
| the dead-land ramp was computed three times per column | benchmark | an inverse tangent, a square root and two sines per pass, in three passes |
| the performance suite compared two separately-taken medians | the same build measured +6.6% and +15.4% on consecutive runs | this process drifts ~9% over a suite; the method could not resolve a 10% effect |

### Performance, after the revision

Median of nine interleaved runs, cold chunk store each run.

```
                               ms/chunk   vs pre-Phase-20   vs Phase 20   chunks
ordinary farmland (5k away)      4.87         +0.4%            +5.1%        36
journey corridor cols 2-5        5.63         +2.2%            -3.2%        64
the fallen tower                 8.61        +53.9%           +57.5%        24
the water tower facility         8.51        +62.3%           +59.4%        25
the giant barn complex           9.55        +74.2%           +75.0%        36
the great tree + dead land       7.62        +41.5%           +46.5%        36
the property + buried volume     7.64        +35.1%           +38.2%        32
the echo columns 20-23           5.95        +13.6%           +16.3%        64
Static Suburbia (control)        1.79         -0.7%           -10.0%        49

whole corridor, each build over its own ground:
  6.39 ms/chunk over 1,064 chunks   against   5.77 over 456   =   +10.8% per chunk
```

Ordinary farmland and the journey corridor are at parity with the build that predates the
journey entirely. **The revision costs about 11% per chunk over the Phase 20 build, for
2.3× the ground and three more authored landmarks.** The five landmark sites cost 35–75%
more for the 153 chunks they occupy in an effectively infinite region; the streamer
spreads chunk generation across frames on a 4 ms budget.

The echo columns' +16% against the Phase 20 build is not a regression in them: the
revision MOVED the marks pass from column 8 to column 20, so the Phase 20 build has bare
field on the ground being measured. The whole-corridor figure is the one that compares
like with like, and it is the one the suite gates on.

The absolute numbers here are higher than section 3's because they were taken on a
different machine — the ratios are what compare, and the suite now takes them as the
median of nine **paired** runs for exactly that reason.

### Validation after the revision

Every suite below was green on the delivered build. `chain.js` is new; the others are the
Phase 20 suites re-run, with `journey.js` rewritten where the revision changed what the
right answer is.

| suite | result |
|---|---|
| `chain.js` | **PASS** — 40 checks. The five landmarks in journey order with a 335-block minimum gap; the route unbroken over all 1,952 blocks (977/977 stations, worst lateral offset 0) and winding over the whole of it (140 blocks of lateral travel, 25.4 of spread, longest straight 102); 5.7 blocks of carriageway against 0.0 on an ordinary lane; 6 side-road meetings per 2,000 blocks against 18; 0 parallel roads; 240 surface samples outside the corridor identical to the pre-revision build; the scale hierarchy measured out of the voxels (8 / 13×46 / 38 / 23×34 / 41×53); four distinct reveal distances with at most three landmarks on the horizon at once; the dead-land ramp monotone, gradual (0.63 at sixty blocks) and non-circular (rim varying by 32 blocks); 0 other trees within sixty blocks against 161 in the pre-revision build; and a real player body walked under the wreck, in through the barn door and up to the trunk |
| `journey.js` | **PASS** — 38 checks, including the two the revision inverted: the tower is now 793 blocks from arrival against a 380-block silhouette range (it *cannot* be on the horizon when the player lands) and appears at journey column 7, and the terrain sightline to the lamp is clear from all four columns approaching it |
| `determinism.js` | **PASS** — 374 chunks byte-identical between two independently booted worlds and in reverse generation order |
| `core-disk.js` | **PASS** — unchanged; a real player body still walks to the Rift Core Disk and back out |
| `red-light.js` | **PASS** — unchanged in behaviour and in result |
| `runtime.js` | **PASS** |
| `regression.js` | **PASS** — the Phase 18.1 route spine bit-identical; farmstead, landmark, minor-structure and animal placement unchanged past the journey; Suburbia and the Overworld byte-identical; 5,000 blocks away the only difference in 196 chunks is still the Phase 20 intact-window fix |
| `performance.js` | **PASS** — see above |
| `render-journey.js` | 41 offline first-person renders of the whole chain, with every silhouette proxy driven by a real camera |

### What the revision did NOT touch

The Phase 18.1 route spine is bit-identical. Farmstead, landmark, minor-structure and
animal placement past the journey are unchanged. Static Suburbia and the Overworld are
byte-identical. The red light's behaviour, thresholds and schedule are unchanged and
`red-light.js` is green on every check. The farmhouse, its interior and the buried volume
are unchanged, and `core-disk.js` still walks a real player body to the Rift Core Disk and
back out.

---

## 1. WHAT PHASE 20 CHANGED

### The journey

The Farmlands had everything a player could want to look at and nothing telling them
where to go. Phase 20 adds a **thread**, not a level: a set of rules that bias the
existing Phase 16–19 generators along one lane, costing a couple of integer comparisons
for the ~0.1% of parcels on it and returning untouched behaviour everywhere else.

The spine is the forced **east–west arrival lane**, walked **east**. The direction was
chosen by measurement, not taste: the biome field puts 6 of the first 15 parcels in the
Ashen Forest going south (the water tower's own parcel at 0.44 — deep woodland), 6 going
west, 2 going north, and **1 going east**, with the tower's parcel at 0.04, just under the
threshold. East is the only direction that puts the phase's landmark in open fields with
the forest edge beyond it.

Beats, by parcel column from the arrival crossroads:

| column | beat | how |
|---|---|---|
| 0 | wheat field | both flanking parcels cast to a standing crop at field state 0 |
| 1 | livestock + farmstead | pasture cast on the north side; an **unforced** working farmstead already sits on the south side |
| 2–3 | open farmland | nothing at all; the quiet the tower lands against |
| 4 | **the water tower** | authored, 37 blocks, placed in the clear window the routes leave |
| 5–7 | isolation | farmstead / minor-structure / animal acceptance ramped down |
| 8–11 | wrongness | three identical arrangements, a suburban fragment, an armchair in a field, a lying sign |
| 12 | the property | the missing-farm evidence and the Disconnected Home |
| 13+ | release | density back to the ordinary region |

Only the crop and the pasture are cast. Both farmsteads the player passes were already
there. Roth Farm is untouched, still forced, still one parcel south of arrival.

### The water tower

Thirty-seven blocks from footings to lamp — 4.6× the tallest Phase 17 barn. Four heavy
stanchions on fieldstone footings, three courses of cross-bracing, a thirteen-block
riveted drum with two rib hoops, a stepped dome, a mast, a service ladder up one leg, a
catwalk gallery under the tank, a riser and a water main out to a pump house, a stop
valve, a wire fence with a field gate, drainage, and a worn service track back to the
lane. Fourteen new block ids; everything else is Phase 16/17/19 vocabulary reused.

Its pad is floored at the water table and capped at 24, which is arithmetic rather than
taste: chunk data is 64 tall and the heightfield can reach 29, so an uncapped pad would
truncate the mast.

**The distant silhouette.** The Rotting Fields run a fixed exponential fog at 0.028 and
the streamer holds eight chunks, so past ~60 blocks the real tower is neither loaded nor
visible — and requirement 36 is explicit that fog must not hide it. Thinning the fog would
take the dimension's whole close horizon with it, so the tower gets what real games give
real landmarks: a **fog-exempt proxy**, fifteen boxes over two shared materials, drawn at
the tower's true position with distance-driven opacity and its colour lerped toward the
fog, depth-tested so terrain still occludes it, faded out by 70 blocks where the real
structure takes over. Its colours are lighter than the fog (0x2D3328), because a
silhouette darker than the air disappears into it — measured, in a render, at 250 blocks.

**The red light** is a gaze mechanic whose only input is the camera. Inside 14° of the
tower's axis the lamp is forced dark and its schedule stops advancing; outside it the
schedule runs on hashed intervals. A flash in progress is extinguished the frame the
player looks back. The clock runs full speed while the tower is peripheral and slower once
it is behind them. There is no objective, no prompt, no sound and no explanation.

The gaze test is against the tower's **axis**, sampled at five stations, not against the
lamp: a player 120 blocks away looking level at the structure is 17° off the lamp, and
tested against the lamp alone the light flashed 102 times in three minutes while they
stared straight at it.

### The Disconnected Home 2.0

The Phase 5A placeholder — a 7×7 obsidian box with a chest hanging from an inverted
ceiling — is gone. In its place:

**Outside**, a believable two-storey farmhouse: fieldstone plinth, clapboard over the
suburb's own mass→shell→roof pipeline, a gable roof with eaves, a brick chimney, a
covered porch the depth of the road side with posts, a rail, a plank ceiling and steps, a
kitchen ell dropped a storey off the back, a shed, a well, a fence with a hole in the side
facing the road, a gate, a mailbox, planting gone to seed, hay bales and a plough in the
yard.

**Inside**, a hall, a living room with a hearth, a dining room, a kitchen in the ell, a
utility room, a pantry, a staircase, two bedrooms, a box room and a linen store, furnished
from the Phase 14 catalogue with the objects of people who farmed.

**Then it stops making sense**, and it does it with geometry:

- a door on the upper landing that opens onto plaster;
- a stair down from the pantry with no cellar door outside and an unbroken plinth all the
  way round, descending eleven blocks;
- **a corridor thirty-four blocks long** — longer than the whole property — papered,
  floored and lit exactly like the hallway upstairs, with a red runner, framed pictures
  and doors on both sides;
- a bedroom off it furnished identically to the one upstairs;
- a doorway with solid ground a block behind it;
- an inverted room where the floor is a ceiling and the table, chairs and rug hang from
  above — the same inversion the Level 1 and Level 3 Disconnected Homes use, quoted rather
  than invented;
- a window looking out on six sealed cells of Static Suburbia — turf, poured sidewalk, a
  picket fence, a suburban mailbox, a lid of flat sky;
- and at the end, **sixteen by twelve**, larger than the farmhouse standing over it, the
  living room again: same hearth, same rug, same couch, same chair, same picture. Built a
  second time, bigger, underground, with no chimney above it.

The Level 2 Rift Core Disk sits on that second hearth.

All of it is buried at least five blocks under the lowest ground the heightfield can
produce, so the exterior stays completely honest.

**The one stronger horror event** is the quietest thing in the phase: the suburban mailbox
behind the impossible window is there when the player looks at it, and once they have
stood in that room, walked away and turned their back, it is not. One voxel, once per
session, no sound and no message.

### Elsewhere

- The player now **arrives on the carriageway facing east** instead of on the verge facing
  a field. The landing pad is eight blocks square and the Phase 18.1 spine wanders up to
  fourteen, so the pad could not be relied on to contain the road.
- One line in the objective HUD, shown only in the Farmlands, italic and unnumbered so it
  reads as a note rather than a quest step. It never names the farmhouse until the player
  is close enough to be looking at it, and it is monotonic on the furthest journey column
  reached, so wandering off the route never rewinds it.
- Two dev commands: `debugTeleportToWaterTower(dist)` and `debugFarmJourney()`.

---

## 2. DEFECTS FOUND AND FIXED

Every one of these was found by a test or a render, not by reading the code. Six of the
eight were invisible to a block census.

| what | found by | why it mattered |
|---|---|---|
| `BLOCK.WINDOW` does not exist — **every intact window in every Farmlands building since Phase 17** wrote `undefined`, which lands as 0 = AIR | reading `_farmOpenings` while writing the Home's windows | a square hole instead of a pane on every decay-0 building in the dimension |
| the levelled property and tower pads were hard rectangles, leaving a 2–3 block cliff | walk traversal: the front door was unreachable from the field | the entire property was unenterable on foot |
| the pad bank called `_farmBaseHeightAt` for every column in the region | benchmark: **14.1 ms/chunk against 3.5** | a four-fold generation regression, as bad 5,000 blocks away as on the plot |
| the front door was cut into a partition row, not the hall | walk traversal | the player could stand in the doorway and go no further |
| the cellar stair's shaft walls ran to head height inside the house | walk traversal | fieldstone filled the pantry; the whole back of the house, and the Core Disk, unreachable |
| a shelf and a barrel stood on the one-cell back passage | walk traversal | same |
| the corridor's arrival cell had 1.7 blocks of headroom against a 1.8-block body | walk traversal | the corridor, its four rooms and the Rift Core Disk sealed off |
| the yard's ground state was a per-column roll | first-person render of the porch | a chequerboard — the exact defect Phase 19 named and solved dimension-wide |
| the hall runner was a full cube standing on the floor | first-person render of the corridor | a row of waist-high red boxes down the middle of the hallway |
| the impossible window used an opaque pane | first-person render of the room | a black rectangle; the beat's whole point is that it is seen |
| the isolation ramp was a smoothstep, flat at both ends | structure census against the baseline | the country did not start emptying until the player was nearly at the property |

Two more things were **cut rather than shipped broken** and are recorded in the source at
the point they would have gone: a box-room window backed with obsidian (a one-block wall
has no cavity to hide the backing in), and the second farmstead at column 3, which the
tower's keep-out legitimately clears.

---

## 3. VALIDATION

Run from `tests/` — see `tests/README.md`. Every suite below was green on the delivered
build.

| suite | result |
|---|---|
| `determinism.js` | **PASS** — 382 chunks across arrival, tower, echoes, property and buried volume: byte-identical between two independently booted worlds and in reverse generation order; disposed chunks regenerate identically; sites and chest key agree across boots |
| `core-disk.js` | **PASS** — the chest is present, its key matches, and a body with the player's real dimensions walks to it from the field outside and back out again; thirteen named waypoints each proved separately |
| `journey.js` | **PASS** — 30 checks: spawn on the track facing east; the opening field 27%/28% dense; livestock in the first three columns; unforced farmsteads at columns 0 and 1 and nothing beside the road at 3–4; the spine still bends (57 blocks of lateral travel, 21.3 of spread, longest straight 102 over 832); the tower 37 blocks, in open Rotting Fields, 4.8% canopy within 40 blocks; clear terrain sightline to the lamp from every column; the isolation ramp removing 40% of what the lattice would build; all six marks; all five pieces of missing-farm evidence; the property 43 blocks off the road with no track touching it; and a 110-block off-road walk |
| `red-light.js` | **PASS** — 0 flashes and 0 lit frames in three minutes of direct gaze; 102 flashes at 35° off-centre with a 14% duty cycle; interval CV 0.41 with no rounded gap over 10% of the sample; dark in the same frame on 400/400 snap-backs; identical 3,600-frame schedules across two boots; silent beyond 420 blocks and outside the dimension |
| `runtime.js` | **PASS** — every frame-loop hook and HUD entry point exists and is safe outside the Farmlands; the one-shot event fires exactly once, only after the player has stood in the room, only away and not looking, and never again |
| `regression.js` | **PASS** — lane lattice, route spine and 4,200 parcel programmes unchanged; farmstead (1,196), landmark, minor-structure and animal (1,013 animals, including condition, behaviour and variant) placement unchanged past the journey; Suburbia and the Overworld byte-identical; **5,000 blocks from the journey the only difference in 196 chunks is the intact-window fix** (44 WIN_X, 37 WIN_Z, previously holes) |
| `performance.js` | **PASS** — median of 5 runs against the pre-Phase-20 build |

### Performance, in full

```
ordinary farmland (5k away)    3.27 ms/chunk   baseline 3.44    -4.9%
journey corridor cols 2-5      3.85            baseline 3.75    +2.6%
the water tower facility       6.26            baseline 3.57   +75.1%   (25 chunks)
the property + buried volume   5.14            baseline 3.47   +48.0%   (32 chunks)
the echo columns 8-11          3.37            baseline 3.49    -3.4%
Static Suburbia (control)      1.18            baseline 1.21    -2.1%
```

Ordinary farmland and the journey corridor are at the baseline. The two authored sites
cost 48–75% more for the 57 chunks they occupy in an effectively infinite region, and the
streamer spreads chunk generation across frames on a 4 ms budget. Resident cost: the
silhouette proxy is one Group of 15 meshes over 2 shared materials plus a lamp core and a
halo; the whole buried volume holds 7 generated point lights; scene object count after
boot is unchanged from the baseline.

---

## 4. KNOWN LIMITATIONS — HONEST LIST

**Not browser-validated.** No WebGL context, no browser and no human playthrough were
available in the environment this phase was built in, and none is claimed. What was done
instead is stated precisely:

- Every generation check ran against the **real `VoxelWorld`** loaded out of `game.html`.
- Every traversal claim was proved by walking a body with the player's real dimensions
  through the game's **own `collidesAABB`**, with the game's own step height and a jump
  allowance below what the real jump can clear.
- Every visual claim was checked against **offline renders of the actual chunk
  `BufferGeometry`** — same vertices, same normals, same baked skylight — with a z-buffer,
  the dimension's own fog, generated torches as point lights, and the tower proxy driven
  by a real camera. Those renders have **no block atlas**, so materials appear as flat
  base colours, and they carry a fixed gain and gamma for legibility. They were used to
  judge silhouette, massing, composition and scale, and they caught three defects nothing
  else did.
- The red light was driven with a **real `THREE.PerspectiveCamera`** at 60 Hz through
  every gaze state, for tens of thousands of frames.

**Specifically unverified, and it should be checked in a browser before the phase is
built on:**

1. **Frame rate with the whole journey resident.** Generation cost is measured; render
   cost with the tower's 13-wide tank and the furnished house on screen at once is not.
2. **How the red light actually feels.** The statistics are right — irregular, rare, never
   caught lit. Whether it produces "wait… did that just flash?" rather than "the light is
   broken" is a judgement only a player can make.
3. **Whether the tower reads as intended at every distance.** The proxy's colour, opacity
   and haze were tuned against offline renders at 250, 140 and 60 blocks with the real fog
   colour, but never against a real GPU frame.
4. **The audio of the journey.** Nothing in this phase touched the sound engine; the
   tower, the corridor and the property are silent beyond the existing ambience.
5. **The Suburbia diorama's lighting in-game.** Two generated torches light it, and the
   offline renderer models point lights only crudely.

**Design decisions worth knowing about:**

- The **journey's direction is fixed east**, chosen against this seed's biome field. If
  `FARM_SEED` or the biome noise ever changes, re-run the four-direction measurement in
  the comment above `FARM_J_LINE` before assuming east is still right.
- The **Disconnected Home moved** from 62 blocks off the arrival pad to ~800 blocks down
  the journey. `FARM_HOME_X/Z/W/H/PAD` are gone; everything derives from
  `world.farmHome`. Any future code wanting the Home's position must read that.
- The **tower's 74-block keep-out** clears whatever the lattice would otherwise build
  beside it, which is the point, and it cost the journey a farmstead at column 3.
- The buried volume is **not lit by design** apart from seven torches. A player without a
  light source will find it very dark. That is intended; it is also the one place the
  phase leans on the player having brought a torch.

**Added by the journey revision, and honestly unverified:**

6. **Whether the journey is now the right LENGTH.** Nineteen hundred and fifty blocks is
   roughly six and a half minutes of continuous walking at the player's speed, before any
   exploring. Every measurable property of the composition is green; whether that is a
   good pace or a long one is a judgement only a player can make, and it is the single
   most likely thing to need tuning. If it does, `FARM_J_FALLEN`, `FARM_J_TOWER`,
   `FARM_J_BARN`, `FARM_J_TREE` and `FARM_J_HOME` are the whole dial — everything else
   derives from them.
7. **Whether the four silhouettes read at their intended distances on a GPU.** Their
   ranges, opacities and haze were tuned against offline renders at 480, 340, 300, 200,
   140, 90 and 70 blocks with the real fog colour, and the fallen tower's hand-over was
   moved forward twenty blocks because a render at seventy showed it as a smudge. None of
   that was seen in a browser.
8. **How the great tree reads in colour.** The offline renderer has no block atlas, so
   the crown is drawn in `greatLeaf`'s flat base colour (0x4E7A3A) with no pattern. The
   whole landmark depends on a living green mass against dead ground; the massing and the
   silhouette were verified, the colour relationship was not.
9. **The dead land's first impression.** The ramp is measured, monotone and gradual in
   block terms. Whether a player walking east actually notices the crops thinning before
   they notice why is exactly the sort of thing an offline census cannot answer.
10. **The barn interior's darkness.** It is a thirty-four by twenty-four windowless
    volume with one open door, and it is unlit on purpose. The offline renderer models
    light crudely; whether it is atmospheric or simply black is a browser question.

**Added by Phase 20.2, and honestly unverified:**

11. **NO AUDIO WAS HEARD.** The opening instruction schedules the existing
    `SoundEngine.playWhisper()` under each line. The harness has no `AudioContext`, so
    what was tested is that the sequence runs, schedules the right cues, and does not
    throw when audio is unavailable. Whether the whisper sits right under the words — or
    is audible at all at 0.05 gain — is a browser question and nobody has listened.
12. **The compass has never been seen on a GPU.** `tests/preview-compass.js` re-emits the
    real `updateCompass` draw calls as SVG at the element's real 252×26 geometry on the
    real panel colours, and the layout is asserted numerically (E right of centre facing
    north; turning right slides the tape left). But whether a 252-pixel strip at the top
    of the screen is genuinely "clean and unobtrusive" over a live 3D scene, and whether
    it reads at a glance while moving, is exactly the judgement an offline render cannot
    make.
13. **The pacing of the instruction.** The beat is roughly 8.9 seconds: 0.8s of black,
    the first line, a 1.6s pause, the second line, then the world. Those numbers are a
    guess at "eerie and intentional" and are the single most likely thing to want tuning.
    They are all in one place — the `at(...)` cues in `OpeningInstruction.play` — and
    changing them touches nothing else.
14. **Whether the instruction is actually remembered.** The player hears it in the
    Overworld and reaches the Farmland crossroads a long time later. The one-shot recall
    on arrival is the mitigation; whether the whole arrangement produces "I was told to go
    east" rather than "what was I supposed to do?" needs a real playthrough.
15. **Phase 23 does not exist, so save/load could not be tested.** There is no save system
    in the build at all — `localStorage` appears zero times in `game.html`. What Phase
    20.2 could do, and did, is put `compassAcquired` in the canonical `Game` progression
    block beside the other one-shot latches, so it is serialised by construction when
    Phase 23 persists that object, and expose `_syncProgressionHUD()` as the single call a
    load should make after restoring it. **The claim is that it is save-ready, not that it
    was observed surviving a save.**

---

## 5. WHERE THINGS ARE IN `game.html`

| what | search for |
|---|---|
| journey constants, beats, isolation ramp | `PHASE 20 — THE FARMLAND JOURNEY` |
| the water tower's block vocabulary | `PHASE 20 — THE JOURNEY WATER TOWER` |
| the tower's shapes | `buildPhase20Shapes` |
| site resolution (tower + home placement) | `_farmResolveJourney` |
| the tower itself | `_farmStampTower` |
| repetition and cross-dimensional marks | `_farmStampJourneyMarks` |
| missing-farm evidence | `_farmStampApproach` |
| the property, house, interior | `_farmHomeYard` / `_farmHomeExterior` / `_farmHomeInterior` |
| everything under the house | `_farmHomeBelow` |
| the silhouette proxy and the red light | `updateFarmTowerLight` |
| the one-shot horror event | `updateFarmHomeAnomaly` |
| the journey objective line | `_updateFarmJourneyObjective` |

### Added by the journey revision

| what | search for |
|---|---|
| the landmark chain's sizes, and why each is that size | `THE LANDMARK CHAIN — SIZES` |
| the corridor band and the road hierarchy | `farmInCorridor` / `THE ROAD HIERARCHY, APPLIED` |
| the giant fallen water tower | `_farmStampFallenTower` |
| the giant barn and its silos | `_farmStampJourneyBarn` |
| the great tree | `_farmStampGreatTree` |
| the dead land around it | `_farmDeadLand` |
| the other three silhouette proxies | `_farmBuildLandmarkProxies` / `updateFarmLandmarkProxies` |

### Added by Phase 20.2

| what | search for |
|---|---|
| the direction convention, and how it was derived | `PHASE 20.2 — WORLD DIRECTIONS` |
| the bearing maths | `compassBearingFromYaw` / `compassCardinal` |
| the compass tape renderer | `PHASE 20.2 — THE COMPASS TAPE` |
| its panel styling | `#compassWrap` |
| earning it | `grantCompass` (and the chest branch that calls it) |
| keeping it across dimensions | `_syncProgressionHUD` |
| the opening instruction | `OPENING_INSTRUCTION_LINES` / `class OpeningInstruction` |
| where it runs | `Game._start` / `Game._beginPlay` |
| the one-shot Farmlands recall | `farmCrossroadsRecalled` |
| dev commands | `debugGrantCompass` / `debugOpeningInstruction` |
