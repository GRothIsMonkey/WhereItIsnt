# ERA 2 — IMPLEMENTATION PLAN

**Status: PLAN ONLY. Nothing in Era 2 has been implemented.**

This document translates the locked creative canon into technically coherent phases. It
invents no creative content. Where an implementation detail has not been creatively
decided, it says **CREATIVE DECISION NEEDED** and stops.

**Authority order:** `D1_DESIGN.md` (for D1) → `STORY.md` → `ROADMAP.md` → this document. This
file is a *how*, never a *what*. If it ever disagrees with those, they win and this file is
wrong.

**D1's creative design is now locked in `D1_DESIGN.md`.** Statements in this plan about D1
creative decisions being open were true when it was written and have since been superseded;
they are corrected below rather than left standing.

**Canon resolutions settled before planning** (recorded in `ROADMAP.md` → CANON RESOLUTIONS):
the seven-landmark D1 chain is authoritative and the old six-beat chain is historical; the
**Skin Stitcher** IS the Suburbia entity and "belongs here" is behavioural, never an origin;
Rift Cores and the elevator both exist and neither replaces the other.

**Settled since**, in `D1_DESIGN.md`: The Thing Below and the Skin Stitcher are two distinct
creatures; the Skin Stitcher owns the Landmark 6 → 7 chase and does not pursue the player when
it escapes Landmark 6; readable environmental text is permitted; the Landmark 1 progression
item is the Old Utility Master Key; the barn puzzle takes four physical objects plus knowledge;
and **the D1 final transition is the elevator, not a Rift.**

---

# 0. WHAT ERA 1.5 ACTUALLY LEFT US

Measured on `55b9607`, not remembered.

| | |
| --- | ---: |
| script in modules | 24,189 lines / 40 modules (58.7%) |
| `game.html` inline | 17,050 lines |
| `src/rendering/` | 7 modules, 2,130 lines, 210 `THREE.`, **0 block ids** |
| `BLOCK.` references, whole build | **1,700** |
| — of which in the six `stampers.js` | 1,048 (62%) |
| — `block-properties.js` + catalogue + shapes | 404 |
| — still in `game.html` | 356 |
| save schema | **version 5, frozen** |

**The good news, and it is the thing Era 2 stands on:** the `generation.js` / `stampers.js`
seam holds. A `generation.js` names no block id at all. `ENV_SITES` is eight functions that
own every voxel-specific coordinate. `src/rendering/` knows nothing about blocks. Those are
real, asserted boundaries and Era 2 cuts along them.

**The bad news is in §11.** There is no asset pipeline of any kind, and collision is a voxel
grid scan that gameplay depends on directly.

---

# 1. PHASE SEQUENCE

`ROADMAP.md` §16–§33 already defines Era 2 Phases 1–18. **That sequence is authoritative and
this plan does not replace it.** What follows keeps its numbering and its intent, and adds
three phases the locked creative additions require but the roadmap predates.

| # | Phase | Roadmap | New? |
| --- | --- | --- | --- |
| **E2.1** | Foundation Rebuild — the Physical World contract | §16 | scoped |
| ~~**E2.0a**~~ | Render / Asset Pipeline Foundation | — | ✅ **DONE** |
| **E2.2** | Terrain Rebirth | §17 | |
| **E2.3** | Vegetation Rebirth | §18 | |
| **E2.4** | Architecture Rebirth | §19 | |
| **E2.5** | Lighting Rebirth | §20 | |
| **E2.6** | D1 Shattered Farmlands Rebirth | §21 | |
| **E2.7** | D1 Journey — the seven landmarks | §22 | content replaced |
| **E2.7e** | **Elevator & Layer Traversal System** | — | **NEW** |
| **E2.8** | D2 Static Suburbia Rebirth | §23 | |
| **E2.8d** | **Suburbia Deterioration & Collapse** | — | **NEW** |
| **E2.9** | D2 Entity — the escaped Skin Stitcher | §24 | content replaced |
| **E2.10** | The Below | §25 | |
| **E2.11** | The Collector | §26 | |
| **E2.12** | Horror Expansion | §27 | |
| **E2.13** | Haven Rebirth | §28 | |
| **E2.14** | Audio Rebirth | §29 | |
| **E2.15** | Cinematics | §30 | |
| **E2.16** | World Reactivity | §31 | |
| **E2.17** | World Polish | §32 | |
| **E2.18** | Release Candidate | §33 | |

**Why E2.0a is numbered after E2.1 but listed second:** E2.1 needs no assets and can be
A/B-proven against the shipped voxel build today. E2.0a is a dependency spike that must land
before E2.2 but has no gameplay property to verify. See §12.

---

# 2. PURPOSE, CHANGES, DEPENDENCIES, FILES

## E2.1 — Foundation Rebuild (the Physical World contract) — ✅ **IMPLEMENTED**

> **DONE.** `src/world/physical-world.js`, eleven read-only queries, one voxel
> implementation. `SanityWorldView` folded in and deleted. `StalkerAI` and
> `PhantomHallucinator` hold no world at all. Proved behaviour-identical against the
> pre-phase build: **11,447 values, zero differences.** Asserted in
> `tests/architecture.js` §4h. The contract as built has eleven queries, not the six this
> section first sketched — `isSolid`, `isResidentAround` and `editEpoch` were added
> because the measurement found consumers asking for them, and `raycast` was dropped
> because its return type is block coordinates. Both changes are recorded in the file.

**Purpose.** Make gameplay stop asking the voxel world voxel questions, so the
representation can be swapped without touching gameplay. This is Era 1.5's method applied
one level deeper, and it is the only Era 2 phase that can be proven correct *before* any new
art exists.

**Changes.** One contract — working name `PhysicalWorld` — with the queries gameplay
actually makes:

```
  collides(aabb)                -> bool     the ONE collision query
  groundHeightAt(x, z)          -> y        what a foot rests on
  waterDepthAt(x, y, z)         -> 0|1|2    dry / wadeable / swimmable
  raycast(origin, dir, max)     -> hit|null what the crosshair is on
  hasOpenSkyAbove(x, y, z)      -> bool     already exists on SanityWorldView
  lightLevelAt(x, y, z)         -> 0..15    already exists on SanityWorldView
```

`VoxelPhysicalWorld` implements it over the existing engine. Nothing else changes.

**Primarily touches.** `src/world/voxel-world.js` (`collidesAABB`, `waterLevelAt`,
`findSpawnHeight`), `game.html`'s `PlayerController` / `Mob` / `ItemEntity` / `MobManager`,
`src/world/sanity-world-view.js` (fold into the same contract), `src/core/game.js`.

**Depends on.** Nothing. **Blocks.** E2.2 and everything after it.

**Do NOT yet.** Do not write a second implementation. Do not touch rendering. Do not change
what any number means.

## E2.0a — Render / Asset Pipeline Foundation — ✅ **IMPLEMENTED**

> **DONE.** `src/assets/` — four modules, 814 lines. three.js is vendored instead of
> fetched from a CDN. GLB loading, a registry with licence tracking, material
> normalisation, reference-counted disposal, honest failure handling, and a collision
> proxy that answers three of E2.1's queries with no voxel in it. Validated against one
> real GLB in a real browser over HTTP. See `ARCHITECTURE.md` §4.9 and
> `src/assets/LAYER.md`.

**Purpose.** There was no way to load a model or a texture. Every later phase produces art
that could not enter the game.

**What shipped.**

| | |
| --- | --- |
| `src/assets/asset-registry.js` | keys, paths, status, collision modes, licences. 0 `THREE.` |
| `src/assets/asset-materials.js` | colour space per map role, filtering, shadow flags, within-asset dedup, resource collection |
| `src/assets/asset-library.js` | GLTFLoader, cache, promise dedup, refcounting, disposal, failure latch, transport aggregate |
| `src/assets/asset-collision.js` | declared proxies → world-space boxes; `collidesAABB` / `groundHeightAt` / `isSolid` |
| `vendor/three/` | r128 + GLTFLoader (shipped), r186 bundle + build recipe (prepared, not shipped), and the measured evidence |
| `tests/assets.js` | 74 checks — registry, attribution both ways, layer rules, vendoring |
| `tests/browser-assets.js` | the real GLB in a real browser; runs on **both** renderer generations |

**THE THREE.JS DECISION.** Vendored and pinned; the version **upgrade is deferred**, on
measurement rather than preference. r186 renders the existing game ~2.7× darker and no
cheap shim recovers it; the remedy is re-tuning the voxel renderer's lighting, which is
**E2.5 Lighting Rebirth**'s work. The pipeline is version-agnostic and tested on both, so
the switch is a one-line change whenever E2.5 wants it. Full table: `vendor/three/README.md`.

**THE VALIDATION ASSET.** `road_signs.glb` — `ASSET_STATUS.VALIDATION`, **not production
content**, referenced by no dimension and asserted to be referenced by none. E2.0a ships
**zero** production assets.

**What was explicitly deferred, and to where.**

| deferred | to |
| --- | --- |
| A **composite PhysicalWorld** (terrain + props + architecture, with a resolution order) so asset collision reaches live gameplay | E2.2, the phase that introduces mesh terrain |
| The three.js **version switch** and the Era 1 lighting re-tune it requires | E2.5 Lighting Rebirth |
| LOD, instancing / `BatchedMesh`, streaming, KTX2 / Draco / meshopt | the phases that have something to measure |
| Skinned meshes and animation (`acquire()` uses `Object3D.clone()`, correct for static props only) | the phase that imports a creature |
| An asset **director** — which asset belongs in which place | blocked on creative decisions that have not been supplied |
| A standalone `measure_assets.js` | not built: `browser-assets.js` already prints tri counts, material and texture counts, bounds and load time, and there is one asset. Build it when there are enough assets for a table to beat a suite. |

**Depends on.** Nothing technically; landed after E2.1 so the boundary existed first.
**Blocks.** E2.2–E2.5 and all content phases.

> **CREATIVE DECISION NEEDED — art direction target.** Unchanged and still open. The
> pipeline is built and the first *production* asset still needs texel density, polygon
> budgets, palette and whether D1/D2/D3 share one material language. E2.0a deliberately
> did not decide any of it: `ASSET_MATERIAL_POLICY` holds import-correctness values only,
> and the registry's `normalize` is null for the one asset present, so nothing was
> silently locked in.

## E2.2 — Terrain Rebirth · E2.3 Vegetation · E2.4 Architecture · E2.5 Lighting

**Purpose.** Replace the cube world with authored terrain, planting, buildings and light.

**Changes.** Mesh terrain with real slopes and a collision representation that satisfies
E2.1's contract; instanced vegetation with wind; modular architecture kits + GLB interiors;
the lighting model each dimension needs (D1 flashlight/darkness contrast, D2 flat daylight
legibility, D3 no horizon).

**Primarily touches.** `src/rendering/` (grows substantially), NEW
`src/world/terrain/`, and the six `stampers.js` files begin being *replaced* rather than
edited. `src/dimensions/*/generation.js` should survive largely intact — that is the whole
point of the 1.5.3 seam.

**Depends on.** E2.1 (collision), E2.0a (assets).

**Do NOT yet.** No landmark content. No creatures. No horror events. These four phases are
the vocabulary, not the sentences.

## E2.6 — D1 Shattered Farmlands Rebirth

**Purpose.** The first final-horror dimension: exposure, the flashlight, darkness as a
*condition* and not the whole identity (STORY §4.9).

**Changes.** The flashlight as a real gameplay tool; night/dusk/moonlight states; the
"something is out there" escalation ladder (STORY §4.8) as a system rather than a script.

**Primarily touches.** `src/dimensions/farmlands/`, `src/rendering/environment-system.js`,
`game.html`'s `PlayerController` (flashlight input), `src/horror/`.

**RESOLVED — flashlight resource model.** Locked in `D1_DESIGN.md` section 0.3: a permanent
handheld flashlight, finite battery charge that drains while on, batteries and charge pickups
found in the world, **no** automatic regeneration and **no** crafting. Relevant throughout D1.
Landmark 1 yields an upgrade to the flashlight itself (beam quality, range, efficiency), not a
replacement system. Battery management is meant to create tension without becoming inventory
micromanagement.

Technically this means: a light the player toggles, one charge value that drains on a timer
while lit, a pickup item type, and an upgrade that changes the light's parameters rather than
swapping the item. It touches `PlayerController` (input), the lighting work in E2.5, and the
item catalogue — where an item id is a save-file value and is **appended, never inserted**.

## E2.7 — D1 Journey: the seven landmarks

**Purpose.** The authored spine of D1. Seven materially distinct beats, one continuous
increasingly disturbing rural region.

**Changes.** Each landmark as an authored site: Farm Compound + Water Tower, Schoolhouse,
Electrical Substation, Rural Church, Abandoned Motel, Abandoned Grain Elevator, Ordinary
Barn. Plus the Grain Elevator cage sequence, the Scientist, the barn puzzle, and the D1
chase (performed by **the Skin Stitcher**).

**The creative design for all seven landmarks is locked in `D1_DESIGN.md`.** Read it first;
this section is the technical plan for building what it specifies.

**Primarily touches.** `src/dimensions/farmlands/generation.js` (placement — survives Era
2), a replacement for `farmlands/stampers.js` (construction — does not survive),
`ENV_SITES`, `src/progression/objective-tables.js`, NEW `src/gameplay/puzzle/`.

**Depends on.** E2.2–E2.6, E2.7e (the elevator the barn opens onto).

**The no-backtracking gate is the load-bearing technical requirement.** `D1_DESIGN.md` section
28 and `STORY.md`'s Landmark 7 canon both require that the objective system withhold departure
until the required pieces are held. Implementation: extend the **existing** `progression.noticed` string-id Set
(Phase 31, already in the save) with landmark-visit and piece-possession ids, and add a
per-landmark `requires` clause to the objective chain. **This needs no schema change** —
`noticed` is already a saved set of opaque ids.

**RESOLVED — the puzzle's content and Landmarks 2–5.** This section previously recorded both
as open creative decisions. `D1_DESIGN.md` has since specified all seven landmarks in full, and
its section 15 fixes the barn puzzle at **four physical objects plus knowledge**: the Water
Tower brass/survey/utility disk (L1), a ceramic/electrical component (L3), a motel key/key-fob
(L5) and a Skin Stitcher cage metal component (L6), with Landmarks 2 and 4 contributing
knowledge rather than objects. The separate **Old Utility Master Key** (L1 → L2) is not a
barn-puzzle object. Build against `D1_DESIGN.md`, not against this paragraph.

**RESOLVED — the barn destination signal.** Locked in `D1_DESIGN.md` section 12. It is
environmental and there is **no marker of any kind**: the barn matches the location on the
Church map the player saw at Landmark 4, and one exterior work light is still on — a mundane
reason to notice it. Confirmation arrives only *after* the player commits: the entrance slams
shut, heavy movement is heard outside, and the objective changes to a survival/hiding state.

Technically: a site row with the work light as authored geometry, one objective-chain state
for the hiding instruction, and a scripted door event. **No waypoint, marker or beam** —
`CLAUDE.md` sections 65 and 66 forbid it and a test should assert it.

## E2.7e — Elevator & Layer Traversal System (NEW)

**Purpose.** The elevator is canon-critical, spans all three dimensions, and is a *system*,
not a set piece. Building it inside E2.7 would strand D2 and D3 with a copy.

**Changes.** Elevator chamber/car/shaft as reusable authored architecture; the descent as a
controlled sequence (not a cutscene — STORY §2567 wants the player *in* it); the D2 exposed
section; the D3 arrival with slow doors.

**Primarily touches.** NEW `src/gameplay/elevator.js` + `src/rendering/` elevator assets,
`src/core/game.js` (`_leaveDimension` is the one teardown — the elevator is a new caller,
and Era 1.5.5 §62.2 says a crossing puts down the old dimension in ONE place).

**How Cores and the elevator coexist** (settled, see CANON RESOLUTIONS): a Core is *why* the
next layer becomes reachable; the elevator is *how* the player physically gets there. Three
Cores, no fourth. Concretely: the elevator is **world state** (does this shaft exist, is it
powered, which layer is it at) and lives in the save's existing `world` key or as `noticed`
ids. Core possession stays exactly where it is in `progression`. **Save schema stays v5.**

> **CREATIVE DECISION NEEDED — where the three Cores now sit in the Era 2 chain.** Era 1 had
> Core 1 from the Behemoth, Core 2 in the Farmlands Disconnected Home, Core 3 in Suburbia.
> Era 2 discards the Overworld, so the Behemoth's Core has no home. Which landmark or
> sequence yields each of the three Cores is undecided and it is the single biggest open
> item in the progression spine.

## E2.8 / E2.8d — Static Suburbia, and its deterioration

**Purpose.** The opposite fear: you can see everything and you are still not safe. Then the
reconstruction physically fails.

**Changes (E2.8).** Beautiful, empty, liminal, nostalgic suburb; long sightlines; houses as
unreliable shelter; impossible interiors; recognition callbacks to D1; progression items.

**Changes (E2.8d).** Deterioration as a **progression-driven global state** with six authored
stages — perfect → aged → dirty → damaged → cracked → collapsing — plus the Water Tower
callback and the downward collapse. STORY §2501 and CLAUDE.md both call this "part of
narrative progression", **not** cosmetic corruption, so it is a staged world state and not a
shader ramp.

**Primarily touches.** `src/dimensions/suburbia/`, `src/rendering/materials.js` (stage
variants), NEW `src/dimensions/suburbia/deterioration.js`, `src/progression/`.

**This is the phase with the worst performance risk in Era 2** — see §10.

> **CREATIVE DECISION NEEDED — what advances the deterioration stage.** Objective progress,
> landmark count, elapsed time, entity encounters, or distance to the centre? §2501 gives the
> order and the imagery, not the trigger.

## E2.9 — The D2 entity (the escaped Skin Stitcher)

**Purpose.** The same creature from the D1 cage — **the Skin Stitcher** — hunting. Observation →
positioning → interception → pursuit → cornering.

**Changes.** An AI that gets *ahead* of the player rather than following — the horror in
STORY §5.4 is specifically interception; the large-house hunt; the one authored hallway
jumpscare (closet → quiet → hallway → sound → turn → three flicker-steps → impact).

**Primarily touches.** NEW `src/horror/neighbour/` (or similar), `src/rendering/creature-meshes.js`,
`src/audio/`, `src/dimensions/suburbia/generation.js` (the large house is authored).

**Depends on.** E2.8 (streets and sightlines to intercept along), E2.7 (the cage encounter
the player must remember).

**Never.** No second unrelated D2 entity. No origin story. No dialogue. No boss fight.

## E2.10 / E2.11 — The Below, and The Collector

**Purpose.** The strongest chapter: helplessness, claustrophobia, sensory threat.

**Changes.** Impossible interiors with no comfortable horizon; aggressive scale contrast;
sound as the survival relationship (STORY §6.4 — and explicitly **not** a stealth meter);
hiding that degrades in four stages (§6.7); the recorded-player phenomenon (§6.8); the
impossible chase (§6.9).

**Primarily touches.** NEW `src/dimensions/below/`, a descriptor row (already planned:
`DIMENSION_PLAN` carries The Below at creative 3 with `stableId: null`), `src/audio/`,
a new objective chain id (`OBJECTIVE_CHAIN_IDS` is a data table — cheap).

> **TECHNICAL + CREATIVE DECISION NEEDED — The Below's spatial model.** The three existing
> dimensions are disjoint bands of one coordinate space and generate from a chunk grid.
> "Impossible architecture" and "roads inside buildings" are not a heightmap. This is
> probably authored volumes rather than generated terrain, which makes The Below the one
> dimension whose world representation may differ fundamentally from D1/D2. Decide before
> E2.10, because it determines whether `PhysicalWorld` needs a third implementation.

## E2.12–E2.18

Unchanged in intent from `ROADMAP.md` §27–§33. E2.14 (Audio) must preserve the three-layer
split (§61) and the served-over-HTTP rule (§61.07). E2.15 (Cinematics) inherits Phase 30's
rules: no timers, pure functions of an accumulating number, one teardown.

---

# 3. DEPENDENCY GRAPH

```
E2.1 Physical World contract
  ├─> E2.2 Terrain ──> E2.3 Vegetation ──┐
  └─> (nothing else blocked)             ├─> E2.6 D1 ──> E2.7 Landmarks ──┐
E2.0a Asset pipeline                     │                                │
  ├─> E2.2, E2.3, E2.4 Architecture ─────┤          E2.7e Elevator ───────┤
  └─> E2.5 Lighting ─────────────────────┘                                │
                                                                          v
                        E2.8 Suburbia ──> E2.8d Deterioration ──> E2.9 Entity
                                                                          │
                                                                          v
                                            E2.10 The Below ──> E2.11 Collector
                                                                          │
                              E2.12 Horror ──> E2.13 Haven ──> E2.14 Audio│
                                                      │                   │
                                                      v                   v
                                    E2.15 Cinematics ──> E2.16 ──> E2.17 ──> E2.18
```

**The one non-obvious edge:** E2.7e (Elevator) must be designed before E2.7 ships, because
the barn stairwell descends into it, and before E2.8d, because the collapse exposes it.

---

# 4. WHAT MUST NOT BE IMPLEMENTED YET

* **No invented D1 content.** All seven landmarks are now specified in `D1_DESIGN.md`. Build
  what it says; do not invent replacements, and do not treat an implementation constraint as
  permission to redesign a landmark.
* **No second D2 entity**, no creature origin story, no Collector backstory. The D2 entity is
  the Skin Stitcher and nothing else.
* **Do not merge The Thing Below with the Skin Stitcher**, or with any other creature, and do
  not invent a relationship between them. They are separate entities.
* **Do not give the Landmark 6 → 7 chase to The Thing Below.** It belongs to the Skin Stitcher.
* **No fourth Rift Core**, and no save-schema change for the elevator.
* **No D1 Rift transition.** The D1 finale is the barn → stairwell → chamber → elevator. Do not
  reintroduce the obsolete Rift transition and do not invent a replacement for it.
* **No red-light explanation**, ever. It must never become an objective or a warning.
* **No Below content before its spatial model is decided.**
* **No Era 3 world-memory systems** (§34) — E2.16 is a first version only.
* **Do not delete the voxel path until a dimension is fully replaced.** The old and new
  representations must coexist behind `PhysicalWorld` long enough to A/B them.

---

# 5. VALIDATION GATES

Era 1.5's discipline carries forward. Every phase:

| Gate | Applies to |
| --- | --- |
| all offline suites green | every phase |
| all browser suites green, one at a time, **served over HTTP** | every phase |
| `tests/architecture.js` boundaries hold; **no ceiling raised** | every phase |
| **A/B against the previous build** before calling any failure a regression | every phase |
| behaviour-identical proof for a representation swap | E2.1 |
| screenshot regression (render N fixed viewpoints, diff) | E2.2–E2.5 |
| walkable-route proof: the seven landmarks reachable on foot, in order | E2.7 |
| **no-backtracking proof**: every puzzle piece obtainable before departure is gated | E2.7, E2.8 |
| Core reachability: all three Cores obtainable in a single clean run | E2.7e onward |
| `browser-playability` walks New Game → credits with **no debug command** | E2.7 onward |
| attribution intact for every shipped asset | E2.0a onward |
| **a human plays it** | every content phase |

**New harness work Era 2 needs** (none of it exists): a screenshot-regression tool; a
frame-time budget probe; an asset-manifest/attribution checker; a traversal prover that
walks a body through authored geometry (extend `tests/core-disk.js`'s approach).

---

# 6. ASSET PIPELINE IMPLICATIONS

Currently: **zero**. No `GLTFLoader`, no `.glb`, no `TextureLoader`. The only texture in the
game is a canvas atlas of 16×16 tiles painted by `buildBlockAtlas`. All geometry is
procedural `THREE` primitives.

Era 2 needs, in order: a three.js upgrade (r128 is from 2021 and predates most of what this
needs); GLB loading with Draco/meshopt; KTX2/Basis textures; a material convention; an
instancing path for vegetation and suburban repetition; LOD; and an attribution manifest
that survives runtime processing (ROADMAP §42, and the §61 audio precedent — the Freesound
id is the join key and filenames are never rewritten; do the same for models).

**Licensing is a shipping gate, not tidiness.** The audio library already has eighteen
NonCommercial/Sampling+ assets quarantined in `AUDIO_INDEX.md`. Model assets need the same
register from the first asset, not retrofitted.

---

# 7. PERFORMANCE RISKS, RANKED

1. **Suburbia deterioration (E2.8d).** Six visual stages × a whole neighbourhood. Naive
   implementation = six material sets resident, or a full rebuild on every stage change.
   Mitigation to evaluate: one material with stage parameters, vertex-blended damage,
   streamed swap at chunk granularity.
2. **The Suburbia collapse.** Everything sinking at once is the most expensive single frame
   in the game, and it must not stutter — it is a scripted emotional beat.
3. **Vegetation density in D1.** "Fields large enough to make the player feel small" is an
   instancing problem; get it wrong and D1 never hits frame rate.
4. **Dynamic lighting + flashlight shadows in D1.** Real-time shadow casting from a moving
   cone is the classic budget killer.
5. **The Below's impossible geometry.** Portals/overlapping volumes can defeat frustum
   culling entirely.
6. **GLB memory.** The audio system already learned this (§61: a 208-second drone is 73MB
   resident). Models will be worse. Budget before authoring.

ROADMAP §41: *measure before optimising; do not make performance claims without
measurements.* The project already has `tests/performance.js`; it measures chunk generation
and will need a frame-time analogue.

---

# 8. TECHNICAL BLOCKERS FOUND IN THE CURRENT CODEBASE

Measured, not assumed.

1. **Collision is a voxel grid scan.** `VoxelWorld.collidesAABB` floors an AABB to integer
   cells and tests block ids against per-shape rules. Mesh terrain has no representation
   here. **This is the deepest gameplay↔voxel coupling in the build** and it is E2.1's
   entire reason for existing.
2. **No asset pipeline at all** (§6 above).
3. **three.js r128, loaded from a CDN.** Old, and the browser suites vendor a local copy —
   an upgrade touches `game.html`, `tests/vendor/`, and every browser suite's route stub.
4. **`waterLevelAt` returns 0/1/2 from block ids** and `PlayerController` reads it directly.
   Same shape of problem as collision, smaller.
5. **The save's `world` key is voxel edits.** Schema is frozen at v5. A non-voxel world needs
   an *adapter*, not a version bump (CLAUDE.md §62.6 already states this rule).
6. **Dimension coordinate bands.** The three dimensions are disjoint bands of one coordinate
   space; The Below has no band and `DIMENSION_PLAN` gives it `stableId: null`.
7. **`riftArming` still ticks on the clamped physics delta.** Pre-existing, documented in
   `ARCHITECTURE.md` §9.5. Era 2 rebuilds the transitions — **fix it there.**
8. **1,048 of 1,700 `BLOCK.` references are in the six `stampers.js` files.** That is the
   good news restated: the thing Era 2 deletes is concentrated exactly where 1.5.3 put it.

---

# 9. THE FIRST THREE PHASES — RECOMMENDED ORDER

### 1st — **E2.1, the Physical World contract**

**This is the best first implementation phase.** Reasons, in order of weight:

* **It is the only Era 2 phase that can be proven correct against the shipped game.** No new
  art, no visual change, one implementation over the existing engine — so the gate is
  behaviour-identical A/B, exactly the method that just carried five Era 1.5 phases.
* **It is the actual blocker.** Terrain cannot land until gameplay stops asking the voxel
  world where the floor is.
* **It fails safely.** If the contract is wrong, it is wrong while there is still a working
  game to compare against. Discovering it after terrain lands means debugging two new things.
* It is ROADMAP §16 Phase 1, correctly scoped down from a nine-item list to the one seam that
  matters.

### 2nd — **E2.0a, Render / Asset Pipeline Foundation**

Second because it has no gameplay property to verify and a three.js upgrade is safer landing
against an existing boundary. Needs the art-direction decision before the first *asset*, but
not before the *pipeline*.

### 3rd — **E2.2, Terrain Rebirth — D1 only**

Scoped to one dimension deliberately: it is the first real proof the seam works, and doing it
once teaches what doing it three times costs. Gate: a screenshot no longer reads as voxel
terrain, and the player walks the same routes.

---

# 10. OPEN CREATIVE DECISIONS, COLLECTED

Nothing below is invented here. Each is a place the canon stops.

### Still open

| # | Decision | Blocks |
| --- | --- | --- |
| 1 | **Where the three Rift Cores sit in the Era 2 chain.** The broader game keeps the existing **three**-Core progression and there is **no fourth**. The Overworld is discarded, so the Behemoth's Core has no home. This is **not** a D1-finale blocker: D1 ends through the barn → underground chamber → elevator, which reveals no Rift and is gated on no Core. | the wider progression spine |
| 6 | **What advances Suburbia's deterioration stage.** | E2.8d |
| 7 | **The Below's spatial model** — authored volumes vs. generated. | E2.10 |
| 9 | **Where Haven sits in the new chain** — Era 1 had it after Suburbia; with The Below inserted, its position is unstated. | E2.13 |
| 10 | **The Behemoth's and the Stalker's roles in Era 2.** Both are canonical entities (STORY §7, §8) with no place in the seven-landmark D1. | E2.6 |

### Resolved since this plan was written

| # | Was | Resolved by |
| --- | --- | --- |
| 2 | Landmarks 2–5 content — Schoolhouse, Substation, Church, Motel | **`D1_DESIGN.md`** specifies all seven landmarks in full: architecture, atmosphere, story function, horror function and puzzle contribution |
| 3 | The barn puzzle's objects and solve action | **`D1_DESIGN.md` section 15** — four physical objects (L1 disk, L3 component, L5 motel key, L6 cage component) into four sockets, plus knowledge from L2 and L4. The recurring symbol's *visual design* remains an art task, not a canon gap |
| 4 | What signals the player that the barn is the destination | **`D1_DESIGN.md` section 12** — Church-map match, exterior work light, then door slam / heavy movement / objective change once inside. No marker of any kind |
| 5 | Flashlight resource model | **`D1_DESIGN.md` section 0.3** — permanent, finite battery, world pickups, no regeneration, no crafting, L1 upgrades the light itself |
| 8 | Art direction numbers | **`VISUAL_RULE_BIBLE.md` section 9.1** — per-class triangle and texture targets, texel density ~64 px/m standard and ~128 px/m hero. Guidelines, not hard limits |
| — | D1 world extent | **`D1_DESIGN.md` section 0.4** — **4,096 m × 4,096 m, locked**, no longer provisional |

---

# 11. WHAT THIS PLAN DELIBERATELY DOES NOT DO

It does not re-sequence `ROADMAP.md`'s Era 2 phases, invent content for the four unspecified
landmarks, resolve any of §10, choose a three.js version, or touch `STORY.md`. It changed
exactly two documents: `ROADMAP.md` §22 (the obsolete chain, as instructed) and the CANON
RESOLUTIONS block, plus the matching clarification in `CLAUDE.md`.

**And nobody has played this game.** Still true, still permanent since Phase 34.1.
