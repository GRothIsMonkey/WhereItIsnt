# WHERE IT ISN'T — ARCHITECTURE

**Status:** Era 1.5.1. This document is the architectural map, the ownership rules and the
contracts. It is a developer document. It contains no lore and no player-facing text.

> **THE SPLIT HAS NOT HAPPENED YET.** Era 1.5.1 drew the map; Era 1.5.2 moved the pure data
> and the pure helpers. The build is still a monolith: **37,072 of the build's 40,446 script
> lines are still in `game.html`'s inline `<script>`** — its body has shrunk by 2,920 lines
> across fifteen modules, 7.3% of the original 39,992 (843 in 1.5.1, 2,077 in 1.5.2). Every system that *does* anything —
> the world, the game loop, the renderer, the player, the UI, the audio engine — is exactly
> where it was. The dangerous extractions are Phases 1.5.3 – 1.5.5. **Do not describe the
> game as modular.**

Read alongside:

| File | Says |
| --- | --- |
| `CLAUDE.md` | the permanent project rules. It outranks this file on anything about design. |
| `ROADMAP.md` | what gets built, and in what order. Era 1.5 is section 12. |
| `PROGRESS.md` | what has been built. |
| `STORY.md` | what it means. Not a developer document; do not put architecture in it. |
| `ARCHITECTURE-INVENTORY.md` | the **measurements** this document reasons from. |
| `tests/architecture.js` | the parts of this document that are enforced rather than hoped for. |

---

## 0. THE ONE PROPERTY THE WHOLE PLAN STANDS ON

**Classic scripts share one global lexical scope.**

A `const`, `let`, `class` or `function` declared at the top level of one classic
`<script>` is visible to every script that runs after it in the same document — including
the inline `<script>`. It is not a global *property* (it does not land on `window`), it is
a binding in the global *lexical* environment, and that environment is shared.

This is why Era 1.5 can move code out of `game.html` **without changing a line of it**.
No `import`, no `export`, no bundler, no build step, no module loader, no `window.X = X`
re-export shims. A file move is a file move.

It was not assumed. It was measured, twice, before any code was moved:

* in Node's `vm` (which is what the 25 offline suites run in) — a second `runInContext`
  call sees the first's `const`, `class` and `function`;
* in a real Chromium over HTTP — `a.js` declares, `b.js` and a following inline
  `<script>` both read it, with no page errors.

Both probes are in `tests/architecture.js` so the property is re-proved on every run
rather than remembered.

### What follows from it

1. **`src/**/*.js` are CLASSIC scripts.** No `import`, no `export`, no `type="module"`.
   A module tag is `<script src="..."></script>` with no attributes. `tests/architecture.js`
   fails on any of those appearing under `src/`.
2. **ORDER IS THE CONTRACT.** `game.html` declares the order; nothing else may. A module may
   use a name declared in a later module only from inside a function body, never at load time.
3. **Every extracted file opens with `"use strict";`.** The inline script is strict; an
   external classic script is not, unless it says so. This is the one line the extraction
   adds, and it is added so that nothing else changes.
4. **A move is verbatim.** The payload of an extracted file must be byte-identical to the
   text removed from `game.html`. Cleaning up while moving makes a behaviour change
   indistinguishable from a relocation, and Era 1.5 has exactly one job: relocation.
   Improve it in a later commit, on its own, where a test can see it.
5. **`tests/harness/source.js` is how a test reads the build.** Eighteen offline suites grep
   the build as text. Left alone, each extraction would have shrunk what they scan while
   they went on passing. No suite reads `game.html` directly any more.

---

## 1. LAYERS

Eleven directories under `src/`. The layer's job is to make one question answerable —
*where does this belong?* — not to maximise the number of files.

```
                    ┌───────────────────────────────────────────┐
                    │  CORE      lifecycle · clock · config     │
                    │            input routing · game state     │
                    └───────────────────────────────────────────┘
                          │                           │
        ┌─────────────────┼───────────────┬───────────┴─────────────┐
        ▼                 ▼               ▼                         ▼
   ┌─────────┐     ┌────────────┐   ┌──────────┐            ┌─────────────┐
   │ GAMEPLAY│     │ DIMENSIONS │   │PROGRESSION│           │ PERSISTENCE │
   │ player  │     │ D-manager  │   │objectives│            │ save/load   │
   │ inventory│    │ transitions│   │milestones│            │ migration   │
   │ crafting│     │ rift       │   │ cores    │            │ repair      │
   │ mining  │     └────────────┘   └──────────┘            └─────────────┘
   │ combat  │            │
   └─────────┘            ▼
        │           ┌──────────┐        ┌──────────┐
        └──────────▶│  WORLD   │◀───────│  HORROR  │
                    │ terrain  │        │ stalker  │
                    │ chunks   │        │ behemoth │
                    │ edits    │        │ anomalies│
                    │ structures│       │observation│
                    └──────────┘        └──────────┘
                          │                   │
                          └─────────┬─────────┘
                                    ▼
            ┌───────────────────────────────────────────────┐
            │  RENDERING          │  AUDIO       │   UI      │
            │  scene · camera     │  SoundEngine │  menu     │
            │  lighting · postfx  │  AudioLibrary│  HUD      │
            │  materials · meshes │  AudioDirector│ settings │
            └───────────────────────────────────────────────┘
                                    │
                              ┌──────────┐
                              │  SHARED  │  math · ids · pure data
                              └──────────┘
```

`shared/` is at the bottom because everything may use it. It is the only layer with that
privilege, and the price is that **nothing in `shared/` may depend on anything at all** —
no THREE, no DOM, no block ids, no game state. It is pure values and pure functions.

### The dependency rule, in one line each

| Layer | May depend on | Must never |
| --- | --- | --- |
| `shared/` | nothing | know THREE, the DOM, a block id, or any game state |
| `core/` | shared | construct a mesh, generate a chunk, or draw |
| `gameplay/` | shared, core, world | touch the DOM, own a THREE object, or decide what is on screen |
| `world/` | shared, core | know the HUD, an objective, a save file, or a dimension's *meaning* |
| `dimensions/` | shared, core, world, progression | be named by anything outside its own descriptor table |
| `progression/` | shared, core | own a coordinate, a mesh, or a block id |
| `horror/` | shared, core, world, gameplay | own the renderer or the HUD |
| `audio/` | shared, core | read a block id (library) · create an AudioNode (director) |
| `rendering/` | shared, core | own progression, objectives, or any gameplay value |
| `ui/` | shared, core | invent gameplay state, or reach a block id / chunk / mesh |
| `persistence/` | shared, core | decide a gameplay outcome, or know a renderer detail |

Each layer's directory carries a `LAYER.md` repeating its rule and listing, by current
`game.html` line range, exactly what is scheduled to move into it and in which phase. Those
files are the work order for 1.5.2 – 1.5.5.

---

## 2. OWNERSHIP — WHO OWNS WHICH VALUE

Coupling is mostly an ownership question wearing a call-graph costume. These are the
answers this architecture commits to.

| Value | Owner | Everyone else |
| --- | --- | --- |
| the frame clock (`dt`) | CORE | is handed a delta; never reads `performance.now()` |
| the wall clock (`filmDt`) | CORE | is handed it *by name*; the five simulation systems get the clamped one |
| which dimension the player is in | DIMENSIONS | asks; does not keep a boolean of its own |
| the player's position and body | GAMEPLAY | reads; only GAMEPLAY writes |
| health, and what changes it | GAMEPLAY | requests damage/heal; does not assign `hp` |
| perception (Sanity) | HORROR | reads a fraction |
| voxels, chunks, edits | WORLD | asks WORLD; never reaches `chunk.data` |
| what is on screen | RENDERING | describes intent |
| what the player is told | UI | hands UI a value; never a DOM node |
| what the player has achieved | PROGRESSION | asks; never latches its own flag |
| what is audible | AUDIO | requests intent; never touches an AudioNode |
| what is written to disk | PERSISTENCE | exposes a snapshot; never calls `localStorage` |

Two of these already hold and are already guarded, and they are the proof that the rest is
achievable rather than aspirational:

* **`UIManager` reaches no block id, chunk or mesh.** Measured: 0 `BLOCK` references,
  0 `THREE` references, against 87 `document` and 111 DOM-API references. Phase 27 built
  it that way and `tests/hud.js` keeps it that way.
* **The audio three-layer split holds.** Measured: `AudioDirector` makes 0 Web Audio calls;
  `AudioLibrary` reads 0 block ids. Phase 34 built it that way and `tests/audio.js` keeps it
  that way.

---

## 3. CONTRACTS

These describe intent, not implementation. They are what a caller is allowed to assume, and
they are what the extraction phases must preserve. Where a contract is already satisfied by
a shipped class, that class is named — several of these are descriptions of code that
already exists and only needs a boundary drawn around it.

### WorldService — *what is there, and what happens when it changes*
Today: `VoxelWorld` (the ~1,680 lines of it that are not dimension content).

```
  blockAt(x, y, z)                  -> id
  solidAt(x, y, z)                  -> bool
  surfaceY(x, z)                    -> y            ground height under a column
  collide(aabb)                     -> bool         the one collision query
  edit(x, y, z, id, cause)          -> applied?     the ONLY write path
  raycast(origin, dir, max)         -> hit | null
  streamAround(position)                            residency, budgeted
  snapshotEdits() / restoreEdits(s)                 persistence hook
```

Owns: voxel data, chunk residency, edit records, terrain queries, water.
Never: an objective, a HUD value, a save file, a dimension's meaning.

**`edit()` is the only write path, and that is the load-bearing clause.** Water reacts to
edits, chunk meshes rebuild from edits, the save is a list of edits, and the audio director
asks what surface the player is standing on. Anything that writes a voxel by another route
is invisible to all four.

### RenderService — *how it is shown*
Today: split between `VoxelWorld` (the mesher, 415 lines), `PostFX`, `EnvironmentSystem`,
and the mesh builders (`buildStalkerMesh`, `buildSuburbFurniture`, …).

```
  present(handle, description)     create / update a visual for a thing
  release(handle)                  and dispose its geometry and material
  camera(...)                      pose only — never a second camera
  light(profile)                   time of day, weather, dimension light
  effect(name, amount)             post-processing intent, 0..1
```

Owns: scene graph, camera, lights, materials, post-processing, disposal.
Never: progression, objectives, what a block *means*, whether the player may act.

### DimensionService — *where the player is, and what that implies*
Today: three booleans on `PlayerController` plus branches in `Game`. **This contract does
not exist yet and is the single most valuable thing 1.5 will add.** See §5.

```
  current()                        -> DimensionDescriptor
  enter(id, arrival)               teardown of the old, then setup of the new
  update(dt)                       whatever this dimension ticks, and nothing else
  exit()                           the reverse of enter, exactly
  spawn(context)                   -> position       arrival, respawn, load
```

### TransitionService — *the crossing*
Today: `Game._leaveDimension`, `_transitionToLevel2/3/4`, `_triggerHavenShift`,
`AnchorMonumentManager.powerRiftCore`, `riftArming`.

```
  prepare(from, to)                may it happen at all
  arm(seconds)                     the delay that exists so the player sees the rift fire
  open()                           the visual/audible event, in the world being left
  cross()                          leave, then arrive — in that order, once
  teardown(from)                   the ONE place a dimension is put down
  arrive(to, spawn)
```

Phase 35 wrote this rule and it stands: **a crossing puts down the dimension it is leaving
before it picks up the next one, and it does it in one place.** What a crossing must *not*
touch is as fixed as what it does: not the inventory, not the compass or the milestones,
not the environmental-story latch, not the save, and not the objective — the caller
re-resolves that *after* the dimension flags flip.

### AudioService — *intent, never nodes*
Today: `SoundEngine` / `AudioLibrary` / `AudioDirector`. **This one already works.**
Era 1.5 draws a boundary around it and changes nothing inside.

```
  scene(name)                      which place this is
  event(name, at?)                 a one-shot, optionally positioned
  cue(name)                        an interaction voice
  bed(slot, name, level)           a looping layer
  settings(volumes)
  suspendResume()                  a backgrounded tab must be able to come back
```

The three-layer rule is permanent: **SoundEngine** owns the hardware, **AudioLibrary** owns
files, **AudioDirector** owns policy. A caller asks for intent. Nothing outside `audio/`
holds an `AudioNode` or a Freesound id.

### UIService — *render what you are handed*
Today: `UIManager`, `MainMenu`, `MenuAtmosphere`, and the settings panel.

```
  objective(line, status)
  condition(hp, maxHp)             discrete, DOM, warm, still
  perception(fraction)             continuous, canvas, cool, alive
  prompt(key, verb)                one system, for affordances AND onboarding cues
  hotbar(slots, selected)
  overlay(name, open)
  resetPresentation()              everything transient, cleared, from ONE teardown
```

Phase 27's rules hold and are guarded: health and sanity never converge on the same visual
language; the HUD is a **renderer** and may not read an objective table, own a gameplay
value, or reach a block id, chunk or mesh; `view` is a presentation cache and is never
authoritative.

### PersistenceService — *serialise, never decide*
Today: `SaveSystem`, `captureSaveState`, `validateSaveState`, `SAVE_MIGRATIONS`,
`captureWorldState`, `findSafeLanding`.

```
  capture()                        -> state          a pure snapshot
  validate(state)                  -> {ok, repairs}  and repairs are REPORTED
  migrate(state, from, to)
  apply(state)                     through the ONE teardown path
```

**Schema stays at version 5.** Save keys, item ids, progression ids, dimension names and
the edit representation are frozen for the whole of Era 1.5. If an internal representation
has to change, it gets an adapter, not a schema bump. A repair is never silent.

### ProgressionService — *what the player may now do*
Today: `ObjectiveSystem`, `PROGRESSION_MILESTONES`, `AnchorMonumentManager`, the Core Disks.

```
  objective()                      -> {line, status}
  resolve(snapshot)                after a dimension flip, never inside a teardown
  milestone(id)                    one-shot, latched by id, three of them
  cores()                          -> which disks are held / spent
  can(capability)                  compass, recipe, rift
```

Progression is **ACCESS**, plus three one-shot endurance milestones. There is no XP, no
level and no fourth milestone. `tests/progression.js` is the guard.

---

## 4. THE ERA 2 SEAM — *and it already exists in this repository*

Era 2 replaces voxel terrain with mesh terrain and voxel structures with authored geometry.
The architecture has to let that happen without rewriting the player, the objectives, the
save, the horror logic, the dimension progression, the story, the input or the audio policy.

The naive boundary — "put an interface in front of `getBlockWorld`" — does not help. The
problem is not block *access*. It is that **9,611 lines of `VoxelWorld` decide what is in
the world by writing block ids into cells**, so what a farmstead *is* and how a farmstead
is *made* are the same 197 lines of code. Replace the renderer and all of it is thrown away,
including the design.

**Phase 31 already solved this, for ten objects, and the shape it used is the answer.**
Environmental storytelling is three tables, not one:

| Table | Answers | Knows about blocks? |
| --- | --- | --- |
| `ENVIRONMENT_STORY_EVENTS` | *what* is there, and what it means | no |
| `ENV_SITES` | *where* that is, in the current world | coordinates only |
| `ENV_STAMPERS` | *how* it is made | **yes — and this is the only place** |

Phase 31 wrote the reason down: "the current voxel Overworld is not guaranteed to be the
final Dimension 1 … written [welded to parcel indices], the next hundred objects would be
thrown away with the renderer."

**Era 1.5's job is to generalise that pattern to the other 9,611 lines.** Every dimension
generator becomes:

```
   CONTENT  (what, and why)        deterministic, block-free, seed -> description
       │                            "a farmstead: house gable-roofed, barn to the north-east,
       │                             yard between them, sign 32% of the time"
       ▼
   SITES    (where)                coordinates in the CURRENT world representation
       │
       ▼
   STAMPERS (how)                  the ONLY code that knows what a block is
                                    ← Era 2 replaces exactly this
```

The seam is **at the stamper**, not at the block. Content and sites survive Era 2 because
they never mention a block; stampers are replaced wholesale. That is the difference between
Era 2 being a rewrite and Era 2 being a re-render.

Two of Phase 31's own sites already point at objects built by Phase 20 and add no blocks at
all — proof the indirection costs nothing when the geometry is already there.

### What this does not mean

It does not mean writing an abstract `ITerrainProvider` now. It means that when 1.5.3 lifts
the Farmlands generator out of `VoxelWorld`, it lifts it **as content + sites + stampers**,
because that is the only lift that Era 2 gets to keep.

---

## 5. THE DIMENSION EXTENSION POINT — AND DIMENSION 3, THE BELOW

### What is there now

Dimension identity is three booleans on the **player**:

```js
    player.inFarmlands      // Level 2
    player.inSuburbia       // Level 3
    player.inFakeHaven      // Level 4
```

referenced **112 times, of which 35 are writes**, from eight different owners. The
Overworld is "none of them true". A
`DIMENSION = { OVERWORLD: 1, FARMLANDS: 2, SUBURBIA: 3, FAKE_HAVEN: 4 }` enum exists and is
referenced **ten times in the entire build**. Illegal states are representable — two
booleans true is a world that is two places at once, and nothing rejects it.

Adding The Below to *this* means a fourth boolean and 112 sites to re-audit. That is
precisely the "giant branch of `if (dimension === ...)` code across the whole application"
the brief says the architecture must prevent.

### What replaces it

**One descriptor per dimension, in one table, and nothing outside that table names a
dimension.**

```
  DimensionDescriptor {
    id                 the stable internal id — a save-file value, APPEND NEVER INSERT
    saveName           what PersistenceService writes ('overworld' | 'farmlands' | ...)
    bounds             the coordinate band it occupies, and the test for "am I in it"
    generate(chunk)    content -> sites -> stampers  (§4)
    spawn(context)     arrival | respawn | load — a dimension answers for its own ground
    enter() / exit()   its own setup and its own teardown, symmetrical
    update(dt)         what this dimension ticks, and nothing else
    environment        light, fog, sky, weather profile
    audioScenes        which AUDIO_SCENES rows belong to it
    horror             which horror systems are live here
    transitions        what may be crossed to, and what opens it
    rules              read-only? saveable? terminal? does the player respawn here?
  }
```

The engine iterates descriptors. `current()` returns one. Adding The Below is **adding a
row** — plus its generator and its stampers, which is the actual creative work — and
touching no other layer.

The three existing rules that this must preserve, all written by Phase 35 and all still
true, become properties of the descriptor rather than special cases in `Game`:

* an Anchor is a block and does not cross;
* a player respawns in the dimension they died in (`rules.respawnHere`);
* the Haven is never saved (`rules.saveable === false`, and `SAVE_DIMENSIONS` is derived
  from the table rather than hand-written beside it).

### THE TWO NUMBERS — SETTLED IN ERA 1.5.2

The `STORY.md` and `ROADMAP.md` uploaded after Phase 36 renumber the dimensions. Era 1.5.1
flagged that as an unresolved conflict; the project owner then locked the answer, and it is
that **there are two different numbers and they must never be confused**:

| | stable technical id | creative number |
| --- | --- | --- |
| Overworld | **1** | — (none; `ROADMAP.md`: discarded as the final D1) |
| Shattered Farmlands | **2** | **D1** (`STORY.md` §4) |
| Static Suburbia | **3** | **D2** (`STORY.md` §5) |
| The Below | *not assigned* | **D3** (`STORY.md` §6) |
| The Haven | **4** | — (a refuge, not a numbered chapter) |

```
    stable id 1  is  the Overworld            — a save-file value, permanent
    D1           is  the Shattered Farmlands  — the canon's creative order
```

A bare `1` therefore means two different places, and nothing in the integer says which.
`src/dimensions/dimension-descriptors.js` makes that impossible to get wrong:

* every identity is a **named field** — `stableId`, `creativeNumber`, `canonicalName`,
  `saveName` (plus `saveLabel`, because what the CONTINUE button shows and what the canon
  calls a place are two different strings);
* `dimensionByStableId` and `dimensionByCreativeNumber` **throw** on the other kind of
  number, with an error that names the confusion, rather than coercing it;
* `creativeNumber` is deliberately `null` for the Overworld and the Haven, so any code
  that assumed "the stable id is the dimension number" fails loudly instead of quietly
  returning the wrong world.

**No stable id was renumbered. No save migration was introduced. Schema stays v5.**
`SAVE_DIMENSIONS` and `SAVE_DIMENSION_NAMES` are now *derived* from the registry, so
"which dimensions are saveable" has one source of truth instead of three.

**The Below is representable and not implemented.** `DIMENSION_PLAN` carries it at
creative 3 with `stableId: null`, no generator and no entity. `tests/architecture.js`
asserts all three, and `tests/story.js` asserts its entity is nowhere in the build.

## 6. THE TRANSITION LIFECYCLE

The order is not negotiable — Phase 35 exists because it was wrong.

```
   1. prepare      may this crossing happen?      (a rift needs a Core; one Anchor, one record)
   2. arm          RIFT_ARM_TIME                  so the player SEES the rift fire, standing in it
   3. open         the dome, the glyph, the zap   rendered into the world being LEFT
   4. teardown     _leaveDimension()              ONE place. entities, chunks, pins, overrides, audio
   5. arrive       generate, place, flip flags
   6. re-resolve   objective, audio scene, HUD    AFTER the flags — never inside the teardown
```

**Crossed by a crossing:** the inventory, the compass, the milestones, the environmental
story latch, the save. These are the player's, not the dimension's.

**Not crossed:** the Anchor block (it is part of the volume being re-decided), the chunk
residency, the audio scene, the environment override, every live entity.

---

## 7. THE FRAME

There is one frame loop and it is `Game._animate` — 430 lines driving ~25 subsystems in a
fixed order. Era 1.5 does **not** rewrite it into an event bus or a system scheduler. It
gets an explicit, named order, in one place, so that the order is a decision rather than an
accident.

Two clocks, and the distinction is load-bearing:

* **`dt`, clamped to 0.06** — physics, mobs, animals, items, water. The clamp is there so a
  frame hitch cannot tunnel the player through the floor.
* **`filmDt`, unclamped wall time** — the opening film, the Haven stages, the finale beats,
  and the objective line. Phase 36 found the objective ticking on clamped time, which made
  elapsed time a function of frame rate. Its consumers are enumerated by name in
  `tests/opening.js`; the five simulation systems are separately asserted to be on the
  clamped delta. **Adding a consumer to either means editing that test.**

---

## 8. WHAT IS ALREADY RIGHT

Not everything needs moving, and knowing which parts are finished is worth as much as
knowing which are not.

| Already clean | Evidence |
| --- | --- |
| audio's three layers | director makes 0 Web Audio calls; library reads 0 block ids |
| the HUD as a renderer | `UIManager`: 0 THREE, 0 `BLOCK`, 0 chunk, 0 mesh |
| the environmental-story framework | content / sites / stampers, already separated |
| one teardown per crossing | `Game._leaveDimension`, Phase 35 |
| one presentation reset | `UIManager.resetPresentation`, Phases 27/33/36 |
| the dev teleports | self-contained IIFE; drives the real transition, keeps no second copy |
| global mutable state | **8 top-level `let`/`var` bindings in 40,000 lines** |
| determinism | seeded, pure, and guarded by four comparison suites |

That last one deserves emphasis: for a file this size, eight pieces of global mutable state
is remarkable, and it is the main reason a mechanical extraction is safe at all.

---

## 9. WHAT ERA 1.5 MUST NOT DO

* not change gameplay, story, horror, visuals, progression, balance, or the save schema;
* not rewrite a working system for tidiness — `SoundEngine` in particular is 2,151 lines of
  synthesis that works and is not to be "improved" during a move;
* not add an event bus, a DI container, a factory layer, or an interface with one
  implementation and no second one in sight;
* not start Era 2, and not touch the current D1 beyond relocating it;
* not weaken a test to fit an architecture. If a test asserts on something the split is
  meant to remove, it is **replaced with a stronger behaviour-level assertion**, not deleted.

---

## 9.5. HANDOFF TO ERA 1.5.3 — THE `VoxelWorld` SPLIT

This is the phase the whole of Era 1.5 exists for, and the most dangerous one. What
follows is the map as measured after 1.5.2 (`node tests/tools/inventory.js --world`).

### What is engine, and what is content

| | methods | lines | goes to |
| --- | ---: | ---: | --- |
| **Farmlands content** | 106 | **5,492** | `src/dimensions/farmlands/` |
| **Suburbia content** | 75 | **3,280** | `src/dimensions/suburbia/` |
| **Haven content** | 12 | 625 | `src/dimensions/haven/` |
| **Overworld content** | 12 | 391 | `src/dimensions/overworld/` |
| meshing / geometry | 7 | 415 | `src/rendering/` — **the Era 2 hinge** |
| block access + edits | 8 | 273 | `src/world/` — the `edit()` write path |
| streaming | 5 | 184 | `src/world/` |
| torch / skylight | 11 | 144 | `src/world/` |
| water | 10 | 117 | `src/world/` |
| doors, anchors, finale, shared | 24 | 370 | `src/world/` mostly; audit each |
| | | | |
| **content total** | 205 | **9,788 (87%)** | `dimensions/` |
| **engine total** | 65 | **1,503** | `world/` + `rendering/` |

### The order to do it in

1. **Take the engine out first, not the content.** The ~1,500 engine lines are what every
   generator calls; lifted first, each dimension can then be moved against a stable
   interface instead of against a moving one.
2. **Then one dimension at a time, smallest first** — Overworld (391), Haven (625),
   Suburbia (3,280), Farmlands (5,492). Run the four comparison suites between each.
3. **Move each dimension AS content / sites / stampers** (§4). This is the whole point. A
   generator lifted as one 5,000-line lump is a generator Era 2 throws away.

### Where each piece belongs

* **Stampers** — `src/dimensions/<dim>/stampers.js`. The only code in the dimension that
  names a block id. Era 2 replaces these files and nothing else.
* **`ENV_SITES`** — stays with the environmental-story framework, but its eight functions
  are the template: a site says *where*, never *what it is made of*.
* **Content tables** — `src/dimensions/<dim>/content.js`. Deterministic, seed-driven,
  block-free. These survive Era 2.
* **The cave-mouth tuning** currently in `src/world/world-constants.js` follows the
  Overworld generator into `src/dimensions/overworld/`. It is parked, not filed.
* **`SAVE_MIGRATIONS`, `validateSaveState`, `captureWorldState`, `findSafeLanding`** are
  1.5.4's, not 1.5.3's — save lifecycle, not world.

### What must NOT move in 1.5.3

`Game`, the frame loop, the transition engine, `PlayerController`, `UIManager`, the audio
engine, the CSS and the markup. And the three dimension booleans: `dimensionOfPlayerFlags`
already exists as the single translation point, but **deleting the booleans is 1.5.4's
job**, after the descriptor table is load-bearing.

### The Era 2 seam is ready when

every block id inside `src/dimensions/` lives in a file named `stampers.js`, and
`tests/architecture.js` can assert it. That assertion is the finish line for 1.5.3.

---

## 10. THE REMAINING PHASES

| Phase | Moves | Risk |
| --- | --- | --- |
| ~~**1.5.2**~~ | ✅ **DONE.** Pure data and pure helpers: block catalogue, shape tables, block properties, audio tables, objective tables, entity tuning, world constants, save-schema constants, onboarding cues — plus the dimension registry. 15 modules; the inline body shrank by 2,077 lines. | low |
| **1.5.3** | `VoxelWorld` split: engine (streaming, meshing, edits, water, light) away from the four dimension generators — **as content / sites / stampers**, which is the Era 2 seam. The largest and most dangerous phase. | high |
| **1.5.4** | `Game` split: composition root away from the transition engine, the save orchestrator and the audio policy. Introduce `DimensionDescriptor` and delete the three player booleans. | high |
| **1.5.5** | boundary repair: gameplay stops pushing to the HUD, input routing leaves `PlayerController`, `SanitySystem` stops reaching into `VoxelWorld`, CSS and markup leave `game.html`. | medium |

Each phase ends the way this one did: the four comparison suites proving world generation is
**bit-identical**, every offline suite, every browser suite, and a clean tree.
