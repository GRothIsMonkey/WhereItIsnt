[PROGRESS.md](https://github.com/user-attachments/files/31799269/PROGRESS.md)
# WHERE IT ISN'T — PROJECT STATE

```
Current phase              20 — FARMLANDS JOURNEY + DISCONNECTED HOME 2.0
Phase 19                   COMPLETE
Phase 20                   COMPLETE
Authoritative build        game.html          (there is no other game file)
Offline validation suite   tests/             (see tests/README.md)
```

Phases 1–19 are as their sections in `ROADMAP.md` describe them. This file records the
state of Phase 20 specifically: what was built, what was measured, what was found and
fixed along the way, and what is honestly not verified.

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
