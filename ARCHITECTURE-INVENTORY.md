# ERA 1.5.1 — MEASURED INVENTORY, DEPENDENCY MAP AND HOTSPOTS

Everything here was **measured**, not estimated. Class and method spans come from parsing
the build with a real JavaScript parser (acorn); reference counts come from walking that
AST, not from grep. The tools are in `tests/tools/inventory.js` so any number can be
re-derived rather than trusted.

Measured against the Phase 36 build, commit `db222ee`, before any Era 1.5 change.

> **ERA 1.5.2 UPDATE.** The numbers below are the BASELINE and are deliberately left as
> they were measured — they are what the hotspot rankings and the `tests/architecture.js`
> ceilings were derived from, and rewriting them would lose the before/after. What has
> changed since:
>
> | | Phase 36 baseline | after Era 1.5.2 |
> | --- | ---: | ---: |
> | inline `<script>` | 39,992 | **37,072** |
> | extracted modules | 0 | **15 files, 3,374 lines** |
> | `VoxelWorld` dimension content | 9,611 (85%) | 9,788 (87%) † |
> | dimension-flag references | 112 | 115 ‡ |
>
> † `VoxelWorld` did not grow — the classifier did. 1.5.2 moved the block tables out from
> under it, so a few methods the regex previously mis-sorted now land in the content
> buckets. The class body is unchanged; 1.5.3 is what shrinks it.
>
> ‡ The three new ones are `dimensionOfPlayerFlags`, the single designated translation
> point that exists so 1.5.4 can delete the rest. `tests/architecture.js` caps the
> MONOLITH at 112 and asserts that exactly one extracted module may read the flags.

---

## 1. THE BUILD

| | lines | bytes |
| --- | ---: | ---: |
| `game.html` total | 41,320 | 2,182,343 |
| — `<style>` (lines 7–1075) | 1,069 | |
| — `<body>` markup (1077–1323), **92 element ids** | 247 | |
| — inline `<script>` (1326–41317) | **39,992** | |

Inside the script:

| | count |
| --- | ---: |
| top-level classes | 35 |
| top-level functions | 155 |
| top-level `const` bindings | 515 |
| top-level **mutable** bindings (`let`/`var`) | **8** |
| load-time side-effect blocks (bare expressions) | 32 |

Eight pieces of global mutable state in forty thousand lines. That number is the reason a
mechanical extraction is safe.

`assets/` is 1.1 GB (187 source audio assets + 274 runtime copies). `tests/` is 1.5 MB
across 25 offline suites, 10 browser suites, 7 preview/measurement tools and a 5-file harness.

---

## 2. CLASSES, BY SIZE

Span is the real class body (parsed). "Members" is methods plus accessors.

| Class | lines | members | Layer it belongs to |
| --- | ---: | ---: | --- |
| **VoxelWorld** | **13,404** | **270** | world + dimensions (see §3) |
| **Game** | 2,328 | 51 | core + dimensions + persistence |
| **SoundEngine** | 2,151 | 66 | audio |
| **UIManager** | 1,442 | 58 | ui |
| **PlayerController** | 1,032 | 36 | gameplay + core (input) |
| Mob | 682 | 16 | horror |
| EnvironmentSystem | 534 | 20 | rendering |
| AudioLibrary | 481 | 25 | audio |
| OpeningFilm | 433 | 15 | ui (cinematic) |
| AudioDirector | 409 | 22 | audio |
| StalkerAI | 309 | 10 | horror |
| MenuAtmosphere | 301 | 9 | ui |
| FarmAnimal | 256 | 11 | world (life) |
| ItemEntity | 252 | 11 | gameplay |
| PostFX | 225 | 7 | rendering |
| MobManager | 220 | 11 | horror |
| FinalSequence | 215 | 9 | dimensions (finale) |
| AnchorMonumentManager | 209 | 9 | progression |
| FarmAnimalManager | 207 | 11 | world (life) |
| EnvironmentStorySystem | 171 | 14 | world (story) |
| PhantomHallucinator | 160 | 6 | horror |
| SanitySystem | 117 | 6 | horror |
| SimplexNoise | 110 | 6 | **shared** ✅ extracted |
| Inventory | 110 | 9 | gameplay |
| ObjectiveSystem | 94 | 8 | progression |
| MainMenu | 85 | 5 | ui |
| BlockTargetHighlight | 84 | 5 | rendering |
| SaveSystem | 79 | 8 | persistence |
| GameSettings | 77 | 12 | **core** ✅ extracted |
| OpeningInstruction | 77 | 5 | ui (cinematic) |
| AshParticleSystem | 66 | 3 | rendering |
| Arrow | 55 | 3 | gameplay |
| ArrowManager | 31 | 4 | gameplay |
| ItemEntityManager | 31 | 4 | gameplay |
| **Chunk** | **27** | 4 | world |

`Chunk` being 27 lines is the finding, not a typo. It is a `Uint16Array` and four accessors.
**Every line of chunk meshing, generation and streaming lives in `VoxelWorld`.**

Not in a class: the dev-tools IIFE at lines 40081–41305 (**1,225 lines**, self-contained and
deletable as one block) and the 11-line boot listener.

---

## 3. THE FINDING THAT SHAPES EVERYTHING — WHAT `VoxelWorld` ACTUALLY IS

Its 270 methods, classified by what they generate:

| Responsibility | methods | lines | share of class |
| --- | ---: | ---: | ---: |
| **Farmlands content (D2)** | 105 | **5,469** | 48% |
| **Suburbia content (D3)** | 66 | **3,174** | 28% |
| **Haven content (D4)** | 12 | 625 | 6% |
| **Overworld content (D1)** | 6 | 343 | 3% |
| meshing / geometry | 7 | 415 | 4% |
| block access + edits | 7 | 258 | 2% |
| streaming | 4 | 174 | 2% |
| torch / skylight | 10 | 136 | 1% |
| water | 11 | 132 | 1% |
| everything else (doors, anchors, finale, shared) | 42 | 565 | 5% |
| **total** | **270** | **11,291** | |

**9,611 lines — 85% of the class, and 24% of the entire build — are dimension content, not a
world engine.** The actual engine is about 1,680 lines.

The largest single methods are all content: `_subFurnish` 540, `_subFloorPlan` 409,
`_farmHomeBelow` 219, `_farmStampStead` 197, `_farmStampTower` 195, `_farmStampFallenTower`
195, `_subInteriorAnomaly` 190.

`VoxelWorld` holds **1,107 `BLOCK.` references** and **81 `THREE.` references**.

---

## 4. DEPENDENCY MAP

### 4.1 What each class touches (AST-counted references)

| Owner | DOM | DOM API | THREE | `BLOCK` | `ITEM` | WebAudio API | world API |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| *(top level: tables & builders)* | 30 | 11 | 309 | 834 | 150 | 1 | 1 |
| **VoxelWorld** | · | · | **81** | **1107** | 26 | · | 24 |
| **UIManager** | 87 | 111 | **0** | **0** | 9 | · | · |
| **SoundEngine** | 2 | · | · | · | · | 157 | · |
| **Game** | 34 | 17 | 5 | 4 | 26 | · | 1 |
| **PlayerController** | 10 | 10 | 10 | 10 | 14 | · | 5 |
| EnvironmentSystem | · | · | 35 | · | · | · | · |
| PhantomHallucinator | · | · | 21 | · | · | · | · |
| MenuAtmosphere | 13 | 4 | · | · | · | · | · |
| MobManager | · | · | 13 | 3 | · | · | 1 |
| AnchorMonumentManager | · | · | 14 | · | · | · | · |
| PostFX | 4 | · | 10 | · | · | · | · |
| OpeningFilm | 7 | 7 | 8 | · | · | · | · |
| MainMenu | 7 | 9 | · | · | · | · | · |
| **AudioLibrary** | · | · | · | **0** | · | 10 | · |
| **AudioDirector** | · | · | · | · | · | **0** | 2 |

Two rows are the good news, and both were built deliberately:

* **`UIManager`: 0 THREE, 0 `BLOCK`.** The HUD cannot see the world. Phase 27's rule holds.
* **`AudioDirector`: 0 Web Audio calls. `AudioLibrary`: 0 block ids.** Phase 34's rule holds.

### 4.2 Inter-subsystem call edges (`this.<field>.method()`)

| edges | from → to | reading |
| ---: | --- | --- |
| **66** | VoxelWorld → Rendering | **the Era 2 blocker.** World generation builds and disposes meshes |
| 64 | Game → UI | the composition root drives the HUD |
| 31 | Game → World | |
| 25 | Game → Audio | audio **policy** living in `Game`, bypassing the director |
| 22 | Game → Environment | |
| **21** | VoxelWorld → Items | breaking a block spawns an entity from inside the generator |
| **21** | PlayerController → UI | **gameplay pushes to the HUD** |
| 20 | Game → Rendering | |
| 12 | PlayerController → World | |
| 11 | PlayerController → Inventory | |
| 11 | Game → Settings | |
| 10 | PlayerController → Audio | |
| 10 | Game → Progression | |
| **7 / 7** | Inventory → UI **and** UI → Inventory | bidirectional |
| 5 | FinalSequence → UI | |
| **4 / 3** | SanitySystem → UI / → World | horror reaching both ends |
| 4 | FarmAnimalManager → World | entity manager querying voxels directly |

### 4.3 The nine risk axes the brief asks about

| | axis | verdict |
| --- | --- | --- |
| A | gameplay → renderer | **severe.** `VoxelWorld → Rendering` 66 edges, 81 THREE refs |
| B | renderer → gameplay | **mild.** `PostFX` reads a sanity fraction; `EnvironmentSystem` takes overrides. Both are values, not reach-through |
| C | gameplay → DOM | **moderate.** `PlayerController` binds 10 `document` listeners and reads five `ui.*Open` flags to decide whether a key counts |
| D | UI → gameplay | **moderate.** `UIManager → Inventory` 7 edges; the HUD reads the inventory model |
| E | gameplay → audio nodes | **none.** Every path goes through `SoundEngine`/`AudioDirector`. The one real issue is policy in `Game`, not node access |
| F | dimension → renderer | **severe.** Dimension content and mesh construction are the same class |
| G | dimension → global state | **severe.** Identity is three booleans on the *player*: **112 references, 35 of them writes**, across 8 owners |
| H | persistence → renderer | **none.** `SaveSystem` touches no THREE. `findSafeLanding` asks the world, correctly |
| I | world-gen → presentation | **severe.** Same as A/F — the generator emits geometry |

---

## 5. HOTSPOTS, RANKED

### P0 — architectural blockers

**P0-1 · `VoxelWorld` is four dimension generators wearing one class.**
9,611 of 11,291 method-lines are dimension content welded to block ids. Era 2 replaces the
representation those lines are written in. *Fix:* 1.5.3, as content / sites / stampers
(`ARCHITECTURE.md` §4). *Do not* fix by putting an interface in front of `getBlockWorld`.

**P0-2 · Dimension identity is three booleans on the player.**
`player.inFarmlands` / `.inSuburbia` / `.inFakeHaven`: **112 references, 35 of them writes**,
spread over eight owners (`Game` 47, the dev-tools IIFE 33, `PlayerController` 15,
`EnvironmentStorySystem` 5, `MobManager` 5, `VoxelWorld` 3, `UIManager` 3,
`FarmAnimalManager` 1). Of the 35 writes, 14 are production and 21 are the dev teleports.
Illegal states are representable and the Overworld is encoded as "all false". A `DIMENSION`
enum exists and is used 10 times in the whole build. Adding The Below here means a fourth
boolean.
*Fix:* 1.5.4, `DimensionDescriptor`.

**P0-3 · World generation owns the scene graph.** 66 call edges. The mesher, water mesh,
glass mesh, landmark proxies, door swings and `buildFinale`/`disposeFinale` are all inside
`VoxelWorld`. *Fix:* 1.5.3.

**P0-4 · `Game._animate` is the whole frame graph.** 430 lines, ~25 subsystems, fixed order,
dimension flags interleaved, two clocks. *Fix:* 1.5.4 — make the order explicit and named.
**Do not** replace it with an event bus.

### P1 — major coupling

**P1-1 · Gameplay pushes to the HUD.** `PlayerController` 21, `Inventory` 7, `SanitySystem`
4, `FinalSequence` 5. All guarded with `if (this.ui)`, which makes inversion cheap. *Fix:* 1.5.5.

**P1-2 · `PlayerController` is input routing + gameplay verbs + UI modality.** 10 document
listeners; five `ui.*Open` reads gate them. *Fix:* 1.5.5 — input routing to `core/`.

**P1-3 · `Game` is four things.** Composition root, transition engine, save orchestrator,
audio policy. `constructor` 201, `_applyRestoredState` 191, `_teardownForRestore` 120,
`_updateEnvironmentAudio` 82. *Fix:* 1.5.4.

**P1-4 · `VoxelWorld` spawns item entities** (21 edges) — `destroyBlock` drops loot. *Fix:* 1.5.3.

**P1-5 · Block ids are allocated by registration order at load time.** Four bare top-level
blocks (394 + 272 + 177 + 154 lines) register furniture and tiles; `_furnNextId` hands out
ids in the order they run. Phase 31 already shipped a bug here — inserting a definition
"where it belongs conceptually" rewrote the chunk data of the entire suburb. Extraction
**must not reorder these**. *Fix:* 1.5.2 moves them intact, order preserved and asserted.

### P2 — moderate

* **P2-1** `SanitySystem` reaches into `VoxelWorld` for `torchLights`, `anchorManager`,
  `getLightWorld`, `isInsideSoulAnchorZone`.
* **P2-2** `UIManager → Inventory` — the HUD reads the model directly (7 edges).
* **P2-3** Audio **policy** in `Game`: `_updateEnvironmentAudio` (82 lines) and ~25 direct
  `SoundEngine` calls that bypass `AudioDirector`. The *layers* are clean; the *policy
  location* is not.
* **P2-4** `MobManager` / `FarmAnimalManager` query voxel terrain directly
  (`findSpawnHeight`, `isSolid`, `getChunk`).

### P3 — cleanup

* **P3-1** The 8 top-level mutable bindings (`_farmLampHalo`, `_flowerTexCache`,
  `_tallGrassTexCache`, `_furnNextId`, the furniture id group, `SIDE_LINED`, `_ANIM_GLOBAL`).
* **P3-2** 92 DOM ids reached by `getElementById` from four different classes.
* **P3-3** 1,069 lines of CSS and 247 of markup still inside `game.html`.

### P4 — harmless legacy, leave alone

* `attackBonus` / `miningSpeedBonus` — deliberately kept so a pre-Phase-26 save keeps what
  it bought (`CLAUDE.md` §19). **Do not "clean up".**
* `window.__game` legacy handle; `WORLD_CHUNKS_X/Z` "legacy bootstrap footprint";
  `FARMLANDS_CHUNKS_SPAN` retained-name aliases.
* The dev-tools IIFE — self-contained, drives the real transitions, keeps no second copy.

---

## 6. THE TEST SURFACE THIS MUST NOT BREAK

25 offline suites, 10 browser suites, 7 preview/measurement tools, a 5-file harness.

The two facts that constrained every decision in this phase:

1. **The offline harness runs the build in one `vm` context** and reaches into it with
   `ev('BLOCK')`, `new VoxelWorld(...)`. That works across multiple scripts *only* because
   classic scripts share a lexical scope — verified in Node and in Chromium before anything
   moved.
2. **Eighteen offline suites read `game.html` as text** (`const SRC = readFileSync(...)`) and
   grep it for forbidden strings, stylesheet rules, element ids, XP symbols, `setTimeout` in
   classes that may not have one. Every extraction would have shrunk their coverage silently
   while they went on passing.

   That is the exact failure shape `CLAUDE.md` §61.05–61.07 names three times: *a test that
   only bounds one side is half a test*. It was closed before it could happen —
   `tests/harness/source.js` reassembles the whole build, modules first, and no suite reads
   `game.html` directly any more.

All ten browser suites already serve the repository root over HTTP with
`'.js': 'application/javascript'` in their MIME table, so `src/**` is served with **no test
change at all**.

---

## 7. HOW TO RE-DERIVE ANY NUMBER HERE

```
cd tests
node tools/inventory.js              # classes, spans, members, top-level counts
node tools/inventory.js VoxelWorld   # one class's methods, largest first
node tools/inventory.js --deps       # the reference table in §4.1
node tools/inventory.js --edges      # the call-edge table in §4.2
node tools/inventory.js --dimensions # the dimension-flag census in §4.3 / P0-2
```
