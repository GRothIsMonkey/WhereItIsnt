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

Twelve directories under `src/`. The layer's job is to make one question answerable —
*where does this belong?* — not to maximise the number of files.

> **ERA 2 E2.0a added the twelfth: `assets/`.** It sits beside `rendering/` and is
> deliberately *not* part of it — `rendering/` describes shapes this game authors in code
> and Era 2 restyles every one of them; `assets/` describes how an **external file**
> becomes usable, which is the same problem before and after the voxel world is deleted.
> See §4.9.

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

**AND `core/` STOPPED BEING MESH-FREE IN ERA 1.5.4, FOR A REASON THAT IS THE POINT OF THE
LAYER.** It now holds the composition root, and a composition root constructs the render
stack — the `WebGLRenderer`, the `Scene`, the `Camera`, the `Clock`. Five references, named
and capped in `tests/architecture.js`. They are the ones Era 1.5.5 should reduce to roughly
zero by giving `rendering/` a real owner. What `core/` still may never do is *generate* or
*author* anything, which is the clause that actually protects the Era 2 seam.

**THREE IS BANNED EVERYWHERE ABOVE EXCEPT WHERE IT IS BUDGETED.** Until Era 1.5.3 the
`world/` and `dimensions/` directories held nothing but tables, so banning THREE in them
cost nothing. They now hold the voxel engine and the four dimension generators — code
whose whole job is to build geometry, and precisely the code Era 2 throws away. The ban
therefore still applies BY DEFAULT, and is lifted file by file in `tests/architecture.js`
under a ceiling measured on this build (81 references across eight files). A ceiling may
fall. It may never rise. Everything else in those two directories — the block tables, the
dimension descriptors, the generator table, the site table — is an Era 2 survivor and still
may not touch THREE at all.

### The dependency rule, in one line each

| Layer | May depend on | Must never |
| --- | --- | --- |
| `shared/` | nothing | know THREE, the DOM, a block id, or any game state |
| `core/` | shared | generate a chunk, author content, or decide what a dimension means |
| `gameplay/` | shared, core, world | touch the DOM, own a THREE object, or decide what is on screen |
| `world/` | shared, core | know the HUD, an objective, a save file, or a dimension's *meaning* |
| `dimensions/` | shared, core, world, progression | reach Game, the UI, audio, horror or the DOM · call another dimension |
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
Today: `VoxelWorld` — since Era 1.5.3 that is the whole class, 1,640 lines and 57 methods.

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

## 4.5. THE WORLD ENGINE AND THE DIMENSION CONTENT

*Delivered by Era 1.5.3. This is not the Era 2 architecture — it is the seam Era 2 cuts
along. The world below is still voxels, still `VoxelWorld`, still one prototype.*

`VoxelWorld` was 13,404 lines and 270 methods, of which 9,900 described PLACES. It is now
an engine of 1,640 lines and 57 methods, and four dimensions' worth of content in ten
files, all of which arrive on the same prototype through `registerWorldContent`. Nothing was rewritten: every method is
byte-identical to the text that was in `game.html`.

### The two responsibilities

| | **WORLD ENGINE** `src/world/` | **DIMENSION CONTENT** `src/dimensions/` |
| --- | --- | --- |
| answers | *how a voxel world works* | *what is in this particular place* |
| owns | chunk map and lifecycle, the one write path, meshing, light sources, doors, block and terrain queries, generation orchestration | terrain shape, structures, interiors, roads, props, the Haven cabin, the Disconnected Home |
| knows about dimensions | that they exist — three lifecycle edges, named below | only itself |
| Era 2 | replaced | `stampers.js` replaced; `generation.js` survives |
| may touch THREE | yes, under a ceiling | yes in stampers, under a ceiling |
| may touch Game / UI / audio / horror / DOM | `soundEngine` only (pre-existing, 11 refs) | **never — asserted at zero** |

### The module tree

```
src/world/                        THE ENGINE — and nothing else
  voxel-world.js          1,681   chunks · the write path · meshing · light · doors
  chunk.js                   45   a Uint16Array and four accessors
  world-content.js           95   registerWorldContent — the attach mechanism
  block-catalog.js                the block vocabulary (data)
  block-properties.js             hardness, tools, drops (data)
  block-shapes.js                 sub-voxel geometry (data)
  world-constants.js              chunk dimensions, radii (data)

src/dimensions/                   THE CONTENT
  dimension-descriptors.js        identity: stableId · creativeNumber · saveName
  dimension-registry.js           the DIMENSION enum
  dimension-generators.js    77   WHO FILLS A CHUNK — the dispatch, as a table
  shared/stampers.js        230   a shell, a roof, the env-story stamp
  overworld/generation.js   174   height, caves, cave-mouth siting
  overworld/stampers.js     292   terrain, trees, decor, chests, carving
  haven/generation.js       333   the pocket's geometry and its anomaly schedule
  haven/stampers.js         466   the cabin, its dressing, the corruption pass
  suburbia/generation.js  1,511   streets, lots, floor plans, the revision layer
  suburbia/stampers.js    2,107   houses, yards, interiors, the Disconnected Home
  farmlands/generation.js 2,760   the lattice, routes, water levels, journey columns
  farmlands/stampers.js   4,014   farmsteads, barns, the tower, the home, water
  finale/scene.js            70   the finale's own ground
```

### Dependency direction — one way only

```
        Game / UI / audio / horror          (1.5.4 — not reachable from here)
                  │
                  ▼
        ┌──────────────────────┐
        │  DIMENSION CONTENT   │   generation.js  → what goes where
        │  src/dimensions/     │   stampers.js    → how it is made
        └──────────────────────┘
                  │  calls the engine freely (99 edges)
                  ▼
        ┌──────────────────────┐
        │     WORLD ENGINE     │   chunks · one write path · meshing · light
        │     src/world/       │
        └──────────────────────┘
                  │  asks the table which dimension holds a chunk
                  ▼
        ┌──────────────────────┐
        │ dimension-generators │   3 rows: suburbia · farmlands · overworld
        └──────────────────────┘
```

The engine never names a dimension method to generate a chunk. It asks
`chunkGeneratorFor(cx, cz)` and hands over the chunk. Three edges from the engine into
content remain, and all three are LIFECYCLE rather than generation — the constructor's two
eager region builds and `setBlockWorld`'s water notification. They belong to Era 1.5.4,
which owns startup, and `tests/architecture.js` caps them at three so they cannot grow
while they wait.

### The three flows

```
GENERATION      updateChunks(x, z)                              engine
                  └─ _generateChunk(cx, cz)                     engine
                       └─ chunkGeneratorFor(cx, cz)             table   ← a row, not a branch
                            └─ _genFarmlandsChunk(chunk)        content
                                 └─ _farmStampStead(...)        stamper
                                      └─ _farmSet / _subSet     engine  ← the one write path

SITE            ENVIRONMENT_STORY_EVENTS  what is there, and why       (block-free)
                  └─ ENV_SITES            where that is, right now     (coordinates)
                       └─ ENV_STAMPERS    how it is made               (block ids)
                            └─ _envStoryStamp                  src/dimensions/shared/stampers.js

STAMPER         a stamper is the ONLY code that names a block id.
                every one of them is in a file called stampers.js.
                tests/architecture.js proves it, in both directions:
                  · no method outside a stampers.js places a block
                  · no method outside a stampers.js so much as names one
```

### Dimension identity

Content modules carry **no** identity of their own. A dimension's name, its stable save id
and its creative number live in `dimension-descriptors.js` (§5), its coordinate band lives
in the predicates the generator table calls, and its content lives in
`src/dimensions/<name>/`. The three are joined by the directory name and by the first
argument to `registerWorldContent` — a string from a closed list. That is the whole
coupling, which is why renumbering the creative order costs one table edit and no
migration. **A stable id is never renumbered to tidy the creative order** (§5).

### `ENV_SITES` — the ownership decision, made and recorded

Era 1.5.2 flagged `ENV_SITES` for a decision in this phase. The decision is: **the site
table stays whole, in one place, and does not move into the dimension modules.**

Every one of its nine entries is dimension-specific in the sense that its coordinates fall
in one band — so the naive reading says split it four ways. That reading is wrong, and for
the reason the table exists. CLAUDE.md §57 names `ENV_SITES` "THE ERA 2 SEAM, and the most
important thing in the phase … Every voxel-specific number lives in these eight functions
and nowhere else", and "THE SITE TABLE IS WHERE A FUTURE PHASE LOOKS FIRST." Splitting it
turns one place Era 2 must edit into four, and turns one table the event rows resolve
against into four tables plus a dispatch that does not exist today. That is the opposite of
this phase's mission.

What *did* move is the half that belongs with its kind: **`_envStoryStamp`, the only part
of the framework that knows what a block is, is now in
`src/dimensions/shared/stampers.js`** with every other stamper in the build, and is
therefore covered by the same assertion. Content stays content, sites stay sites, the
stamper moved to the stampers.

---

## 4.6. THE APPLICATION LAYER

*Delivered by Era 1.5.4. `Game` is out of `game.html`. It is still one class of 2,328
lines and it still reaches thirty-five names that live in the monolith — the difference is
that all thirty-five are now written down and capped.*

### What `Game` is

One class, and deliberately one: the brief for this phase asked for "one obvious
orchestration owner", and splitting 51 methods across three invented `*Manager` files
would have produced a prettier diagram and the same object graph. What Game owns:

| | methods | lines | |
| --- | ---: | ---: | --- |
| composition root | 1 | 201 | constructs every subsystem and hands each one what it needs |
| the frame loop | 1 | 430 | `_animate` — the one loop that ticks the world |
| save orchestration | 13 | 516 | what of the application goes into a save, and how it is rebuilt from one |
| dimension transitions | 9 | 371 | the rift crossings, the Haven, the climax |
| settings / audio / graphics policy | 11 | 192 | which knob reaches which subsystem |
| progression and objectives | 11 | 151 | milestones, the compass, the objective snapshot |
| camera shake | 2 | 15 | |

### The dependency direction

```
        game.html          markup, the <script> order, and an 11-line bootstrap
            │              `new Game()`; publish the console handles; nothing else
            ▼
   ┌───────────────────┐
   │   src/core/       │   game.js      the orchestrator
   │                   │   dev-tools.js the developer console (deletable: one file, one tag)
   │                   │   settings.js
   └───────────────────┘
            │  constructs, and hands each subsystem what it needs
            ▼
   ┌───────────────────┐   PlayerController · UIManager · SoundEngine · MobManager · …
   │  runtime systems  │   still in game.html — 1.5.5 and after
   └───────────────────┘
            │
            ▼
   ┌───────────────────┐   src/world/ (the engine)  ·  src/dimensions/ (the content)
   │   world layer     │   src/persistence/ · src/audio/ · src/progression/ · src/shared/
   └───────────────────┘
```

Four subsystems are handed the application itself — `EnvironmentStorySystem`,
`OpeningFilm`, `FinalSequence`, `MainMenu`. Everything else receives only what it uses
(`scene`, `world`, `sound`, `ui`, `camera`, `canvas`). That is why the inbound surface is
**five fields and one method**: `sound`, `world`, `ui`, `player`, `camera`, and
`_triggerClimax()`, which the finale calls to roll the credits. `tests/architecture.js`
fails if a sixth appears.

### The dependency manifest, and what "explicit" can mean here

There are no imports in this build and there will not be: `src/**/*.js` are classic
scripts sharing one global lexical scope (§0), which is the property the whole of Era 1.5
stands on. So moving `Game` into its own file does not, by itself, constrain anything —
Game could still reach every name in the build and no diff would show it.

What replaces an import list is a **declared manifest**. `tests/architecture.js` §4d lists
every name Game reaches outside its own file, attributed to the file that declares it, and
fails on an undeclared one, a stale one, or one that changed owner. It is checkable,
reviewable and it ratchets, which is the part an import list actually buys you.

| Game's dependencies | count | |
| --- | ---: | --- |
| real `src/` modules | 23 | settings, save lifecycle, block and item catalogues, world constants, audio tables, the dimension registry |
| still in the monolith | **35** | 20 subsystem classes + 15 tables that travel with them — **the number 1.5.5 reduces** |
| host surface | 6 kinds | `window` 23, `document` 11, `setTimeout` 4, `requestAnimationFrame` 2, `clearTimeout` 1, `console` 1 |

### The frame loop

Unchanged, and deliberately so — this phase moved it and did not touch its timing model.
`_animate` is scheduled from Game and nowhere else, and it is latched on `_loopRunning`
because both `_start()` (the film) and `_beginPlay()` (gameplay) need it running and a New
Game runs both; without the latch the second call would start a second `requestAnimationFrame`
chain and the world would simulate at double speed for the rest of the session.

Other classes call `requestAnimationFrame` — a fade, a menu canvas, a one-shot mob
animation — and that is fine. What may exist only once is the loop that ticks the world.

### The save boundary, and a deliberate departure from the 1.5.1 work order

`src/persistence/LAYER.md` scheduled `Game.captureSaveState`, `_applyRestoredState` and
`_teardownForRestore` to move into `persistence/` in this phase. **They stayed in Game**,
and the split runs one level lower instead:

* **`src/persistence/save-lifecycle.js`** — migrations, validation, world capture and
  restore, safe landing, and `SaveSystem`. This is persistence: it serialises, validates
  and repairs, and it decides no gameplay outcome.
* **`Game.captureSaveState` / `_applyRestoredState` / `_teardownForRestore`** — these
  decide *what of the running application* belongs in a save and how the application is
  rebuilt from one. They read and write Game's own fields across every subsystem. Moving
  them into `persistence/` means either handing the whole `game` object to the persistence
  layer — the "giant singleton" this phase was told not to build — or rewriting 380 lines
  of the save path semantically, in the same phase that moves the frame loop.

The honest boundary is: persistence owns the file; the orchestrator owns what goes in it.

---

## 4.7. THE PRESENTATION LAYER

*Era 1.5.5. The CSS is out of `game.html`.*

`game.html` held a single 1,067-line `<style>` block: the token sets, the HUD instruments,
the readouts, every full-screen overlay, the opening film, the menu, the settings panel and
the three key-opened panels, in one sheet with no internal boundary except its comments. It
is now **seven stylesheets under `styles/`**, and the document is 1,059 lines smaller.

### The sheets, and why seven

| sheet | lines | what it owns |
| --- | ---: | --- |
| `base.css` | 99 | the document, the canvas, and **both token sets** — §73's palette, §55.1's face, shadow and four-step scale |
| `hud.css` | 389 | crosshair, mining readout, hotbar, held item, CONDITION, PERCEPTION, objective, status, clock, compass, interaction prompt |
| `overlays.css` | 115 | damage flash, dimension banner, the wash, the hard cut, credits, storage, toast |
| `film.css` | 107 | the opening film's one overlay, plus `#vignetteFX` and `#jumpscareFlash` |
| `menu.css` | 263 | the main menu and the win screen |
| `settings.css` | 131 | the settings panel and the audio-transport notice |
| `panels.css` | 50 | crafting, backpack, inventory |

Seven, not thirty and not one. The brief asked for "a small number of coherent
stylesheets", and the split follows the boundaries the comments in the original block
already drew — which is also why no rule had to move past another one to get there.

### ORDER IS THE CASCADE

The same sentence Era 1.5.2 wrote about scripts, in the other language:

> **`game.html` declares the sheet order and nothing else may.**

Two rules of equal specificity are resolved by which one comes later. So a stylesheet split
is not a file move — it is a **reordering risk**, and the risk is silent: nothing errors,
nothing logs, a button is simply a different colour on some screen nobody opened during the
phase. Each sheet therefore keeps the position its rules held inside the original block, and
`base.css` leads because every other sheet reads its custom properties.

`hud.css` is the one sheet assembled from **two non-adjacent slices** — the instruments, then
the readouts. The screen overlays used to sit between them and are now in `overlays.css`,
which loads after. The two HUD groups target disjoint elements, so nothing was resequenced
relative to anything it could tie with.

### How the move was proved

Not by reasoning about specificity. **By measuring.** A tool serves the pre-split and
post-split builds side by side, walks every element in the document, and compares the
*entire* computed style of each one — with the overlay and transition state classes toggled
on, so the rules that only apply mid-fade were measured too.

```
359 elements · 150,810 computed properties · 0 differences
```

That is the honest form of "the visual design did not change", and it is the only form that
covers a cascade.

### `file://` was checked, not assumed

Seven sheets are seven new subresource loads, and this project has form with browser rules
that only apply to a page opened from disk (CLAUDE.md §61.07). **It is fine**: all seven load
and apply from `file://`, with no console error — a browser blocks `fetch` and `XHR` for a
local file, not a `<link rel="stylesheet">`.

One thing *is* different. From `file://` each sheet is cross-origin for **scripting**, so
`document.styleSheets[n].cssRules` throws: the rules apply, the CSSOM is opaque. Nothing in
the build or the suites reads `cssRules`, `styleSheets` or `insertRule`, and nothing should
start — it would work over HTTP and fail silently from disk, which is this project's
signature bug. Serve it over HTTP anyway, for the audio.

### The test harness had the same hole, one layer over

Era 1.5.1 closed "a text suite silently scans less" for **scripts** by reassembling the
build in `tests/harness/source.js`. Eight suites read CSS out of that build — six with a literal
`SRC.indexOf('<style>')`, `settings.js` with a regex over the block, `progression.js` through
the head-and-markup split. Left alone, every one of them would have started reading the empty
string — **and passing**.

So `source.js` now reassembles the sheets exactly as it reassembles the modules:
`buildStyles()` returns all of the CSS in cascade order, and `buildSource()` folds the seven
sheets back into **one** `<style>` block where the first `<link>` stood. Not one of the
eight suites changed, and all eight still read all of the CSS.

The fix for "a test silently scans less" must not itself make a test silently scan less —
the same trap, sprung one layer over, caught by looking for it.

### What stayed, and why

* **The markup stayed in `game.html`.** ~250 lines of declarative structure with no logic in
  it. Moving it into JS template strings would make it *less* declarative and hand
  `UIManager` a second job; moving it into an HTML partial needs a build step or a fetch,
  and this project has neither. Markup in the HTML document is where markup belongs.
* **No id and no class was renamed.** 64 ids are looked up by name in code and 92 are
  declared. A rename would have been a gratuitous break of every browser suite, the
  `UIManager` contract and the phase's own no-visual-change rule.
* **The 54 runtime `.style.*` writes stayed in JS.** They are not presentation — they are
  **dynamic state CSS cannot hold**: opacity ramps, `display`, a live transition duration,
  the condition tick's per-frame `--f`. Mechanically converting them to classes would have
  changed behaviour, which §8 of the brief forbids. Three inline `style=` attributes remain
  in the markup, all of them initial state.

### The wash and the cut, which are timing and not decoration

Four sites write `#fadeWhite`'s transition, and they are two different operations:

* **Two animate** (`fadeToWhite` / `fadeFromWhite`): duration → **forced reflow** → opacity.
  The order is the mechanism. Without the reflow the browser may coalesce the duration and
  the opacity into one style recalculation and animate at the *previous* duration, or not at
  all.
* **Two reset** (`hardCutToBlack`, and the presentation teardown a New Game runs):
  `transition: none` → opacity. Instantaneous by construction, and Phase 33's rule that the
  hard cut is instant depends on them staying that way.

`tests/architecture.js` §4e asserts both pairs separately, and that `#blackCut` still carries
no transition at all.

### What §4e locks

Twelve assertions. The ones that matter most:

* **No `<style>` element survives in the document**, and every sheet is under `styles/`.
* **`base.css` is first, and it is the only sheet that declares a `:root` token.** One token
  source, not seven. (A custom property declared on an *element* is a different thing and is
  not counted: `hud.css` gives a condition tick `--f`, `--tick-lit` and `--tick-off` so five
  state classes repaint one rule instead of five. That is the instrument Phase 27 built.)
* **Every id the code looks up exists in the markup** — derived from the build, not pinned as
  a hand-written list that goes stale. The phase brief's own example list still named
  `step1`…`step6`, which Phase 28 deleted with the tutorial.
* **No extracted module writes an element style. Zero, and locked at zero.** That is what
  lets Era 2 restyle the game without reading world, dimension, audio or persistence code.
  The monolith's own 54 writes are capped and fall as `UIManager` comes out.

### And the strongest statement about this phase needs no test at all

`buildScript()` — every module in load order plus the inline body, the whole of the build's
JavaScript — is **2,161,902 bytes before and 2,161,902 bytes after, byte for byte identical**.
This phase moved CSS and nothing else, so no gameplay, world-generation, save, audio,
objective, transition or timing behaviour can have changed. Two known slow-container failures
(`browser-transitions`'s `riftArming` wait from §9.5, and `browser-haven`'s 2Hz anomaly sweep,
which passes when run alone) are both settled by that fact and by A/B against the pre-split
build. See `PROGRESS.md` §6.

---

## 4.8. THE COUPLING CUTS AND THE RENDERING BOUNDARY

*Era 1.5.6. The proposal is §9.6; this is what was built. Every number is measured.*

**THE PHASE'S ONE TEST WAS: would this boundary materially interfere with replacing the
voxel presentation and world with a non-voxel game?** Four things failed it and were fixed.
Three things an earlier `LAYER.md` had scheduled passed it — they are not rendering, Era 2
deletes them — and were explicitly deferred, with the deferral asserted so it reads as a
decision.

**Module count was not a goal and did not move for its own sake.** `SoundEngine`,
`UIManager` and `PlayerController` are still in `game.html`, on purpose: none of the three
is a coupling problem, and moving them is bookkeeping.

### Cut A — dimension identity

Three independent booleans on the player became **one field and three derived views**.

```
  player.dimension                 ONE writable field, a stable id
  inFarmlands / inSuburbia / …     getters over it, with NO setter
  setPlayerDimension(p, id)        the one write path
  definePlayerDimensionState(p)    installs them, once, from the constructor
```

| | before | after |
| --- | ---: | ---: |
| references | 116 | 79 |
| **writes** | **35**, in 12 places | **0** |
| owners | 6 | 6 (reads only) |

**The measurement that made this mechanical rather than a redesign** was in the writes: all
35 sat in 12 places and every one assigned the complete triplet. They were already "set the
dimension", spelled as three statements. Keeping the booleans as derived views meant all 81
reads carried on untouched — that is the whole reason the cut was safe.

Four defects go with the representation:

1. **The Overworld was the absence of evidence** — "all three false" is also what a
   half-initialised object looks like.
2. **Two-true was representable**, and the readers resolved it in different orders.
3. **Writes were partial.** `player.inFarmlands = true` on the Level 1 → 2 crossing set one
   of three; correct because of where it sat, not by construction.
4. **A fourth dimension cost a fourth boolean.** The Below is canon and already a row in
   `DIMENSION_PLAN`; it was priced at a 116-site refactor and now costs a descriptor row.

**No save-file value moved.** No `stableId` renumbered, no `saveName` changed, no
`creativeNumber` touched, schema still **v5**.

### Cut B — `SanitySystem` stops reading the voxel engine

`src/world/sanity-world-view.js` — five read-only queries. Three were reads straight into
the engine (`torchLights` iterated, `getLightWorld`, `hasSkyAbove`); two are gameplay (the
Anchor and Soul Anchor zones) and are forwarded unchanged. The constructor goes
`(env, world, ui)` → `(env, view)`.

**Era 2 replaces one file and the horror system does not change.**

**Not one gameplay number moved, and that is proved rather than claimed**: both builds
driven over 128 branch combinations, both Suburbia rates for fifteen simulated minutes,
`drain()` and `fraction` — **118,256 values compared, zero differences.**

### Cut C — gameplay stops pushing to the HUD

§53 forbids the HUD reading gameplay and `tests/hud.js` enforces it. This was the
unguarded direction: **110 call sites over 37 methods**, and the expensive part was never
the count — it was that *the required surface was undeclared*. A replacement HUD had no
checklist; the only way to learn the 37 was to grep.

* **The presentation port is declared** in four kinds — **state 14, verb 6, event 11,
  wiring 6** — and asserted in both directions. An undeclared call fails, a port method
  `UIManager` does not implement fails, an uncalled entry fails, and only three files in the
  build may call the HUD at all. Same answer §4.6 gave for `Game`, for the same reason.
* **`Inventory` dropped its `UIManager`.** Its seven `updateHotbarSelection()` pushes were
  redundant: `_animate` pushes the hotbar unconditionally once a frame and `player.update`
  runs **324 lines earlier in the same frame**. `new Inventory()` takes no argument now.
* **`SanitySystem` dropped its `UIManager`.** Its four pushes were the one value the frame
  block did not already carry, so the block gained one line.

110 → **100** call sites, and two gameplay classes stopped being HUD callers.

**The `verb` and `event` calls were deliberately not converted.** A panel toggle and a
jumpscare are genuinely imperative; an observer framework over them buys nothing.

### Cut 4 — the rendering boundary

`src/rendering/` held one file, `LAYER.md`, listing ten units scheduled to arrive — nine in
1.5.2, the mesher in 1.5.3. **None had.** Eleven units, **2,130 lines**, are there now:

| module | lines | THREE |
| --- | ---: | ---: |
| `environment-system.js` | 554 | 35 |
| `creature-meshes.js` (Stalker, Skeleton, Spider, Behemoth) | 659 | 103 |
| `animal-meshes.js` | 406 | 29 |
| `postfx.js` | 246 | 10 |
| `finale-meshes.js` | 220 | 21 |
| `block-target-highlight.js` | 102 | 7 |
| `ash-particles.js` | 82 | 5 |

**210 `THREE.` references, 7 files, and ZERO block ids — locked at zero.** That last number
is the one that matters: these files describe *shapes*, and none of it is expressed in the
voxel vocabulary. They survive the voxel world's deletion as designs even though Era 2
restyles every one.

Every payload is **byte-identical** to the text removed, proved by comparing the
declaration text before and after rather than by review.

### The three deferrals, and why they are deferrals

The 1.5.1 map filed all three under "rendering". The measurement says they are not.

| unit | lines | THREE | why not |
| --- | ---: | ---: | --- |
| `buildSuburbFurniture` | 540 | **0** | not a mesh builder — it allocates **block ids** through `_furnAlloc` and writes `SUB_SHAPE_DEF`, `BLOCK_HARDNESS`, `BLOCK_DISPLAY_NAME`. §57: registration order **is** the id, so moving it rewrites the suburb's chunk data. |
| `buildSuburbInteriorStructure` | 261 | **0** | the same, for partitions, cased openings and stairs. |
| `buildBlockAtlas` | 127 | 5 | paints one 16×16 tile per **block id** into the strip the greedy mesher reads UVs from. The voxel texture atlas. |

All three are voxel data that Era 2 deletes. Filing them here would put voxel block data in
the layer that outlives the renderer — the exact failure the layer rule exists to catch.
`tests/architecture.js` §4g asserts each is still *out*, with its reason.

**The greedy mesher did not move, and 1.5.3's decision was not reopened.**

### What §4f and §4g lock

Beyond the port and the block-id zero: the rendering layer reaches **no DOM** except
`postfx.js`, which needs `window.innerWidth`/`innerHeight` for its render target and the
uniform that must agree with it — four references, named and budgeted. The other six are at
zero and stay there.

### Ratchets: three fell, none rose

| | before | after |
| --- | ---: | ---: |
| P0-2 dimension-flag references | 112 | **79** |
| — of which writes | 35 | **0** (newly pinned) |
| Game's monolith dependencies | 35 | **32** |
| Game's real module dependencies | 23 | **29** |
| P0-3 world-building THREE | 81 | 81 (untouched — the mesh builders were never in it) |

**A ceiling may fall. It may never rise.**

### Validation

30 of 31 offline suites green (`architecture.js` 173/0, including §4f's 7 port checks and
§4g's 6 boundary checks); **all 10 browser suites green**, one at a time over HTTP; and
`launch-check` boots, plays and streams with all 40 modules loaded.

`performance.js`'s one drifty assertion failed at +17.3% against a 14% ceiling — **and so
does the build this phase started from**: alternating A/B on the same container gave the
baseline +16.2 / +13.8 / +22.8 and this build +19.5 / +13.3 / +12.8. The threshold was not
raised. See `PROGRESS.md` §6.1.

**`browser-transitions` passed for the first time in three phases, and `riftArming` is not
fixed.** Nothing here touched `AnchorMonumentManager`; the container was fast enough to get
under a 30-second wait. Same for `browser-haven`'s frame-rate-sensitive sweep. A green
timing-sensitive suite is evidence the build is sound, not evidence the timing defect is
gone.

---

## 4.9. THE ASSET PIPELINE — ERA 2, E2.0a

Era 2 replaces a world made of code with a world made of **files**. Nothing in the build
could load one. This is the layer that can.

### The four modules

| module | lines | owns |
| --- | ---: | --- |
| `asset-registry.js` | 180 | **WHAT EXISTS** — keys, paths, status, collision modes, licences, and four lookups. Zero `THREE.` references; it is data. |
| `asset-materials.js` | 190 | **WHAT SURFACES BECOME** — colour space per map role, filtering, shadow flags, within-asset material dedup, resource collection. |
| `asset-library.js` | 289 | **FILES** — GLTFLoader, cache, promise dedup, reference counting, disposal, failure latching, the transport aggregate. |
| `asset-collision.js` | 155 | **WHAT SHAPE A PLACED MODEL IS** — declared proxies transformed to world space, and three PhysicalWorld-shaped queries. |

### Why it is its own layer and not part of `rendering/`

`src/rendering/` is the layer Era 2 **rewrites wholesale**. This one it keeps. A GLTF
loader, a reference-counted cache and a colour-space policy are not opinions about how
this game looks; they are how any three.js game turns a file into geometry, and they are
as true of mesh terrain as of a voxel world. Filing them under `rendering/` would schedule
them for a deletion they should not be part of.

The test that settles it is the same one §4.8 used in the other direction: `rendering/`
names **zero block ids** because it describes shapes; `assets/` names zero block ids
*and* zero voxel anything, because it never learns what kind of world it is loading into.

### The rules, and where they came from

- **NO CALL SITE HOLDS A MODEL FILE PATH.** Section 61's rule for audio. `tests/assets.js`
  counts every `.glb`/`.gltf` string literal in the reassembled build and fails if one is
  outside the registry.
- **AN ASSET WITHOUT AN ATTRIBUTION LINE IS A LICENCE BREACH.** Checked in both
  directions, plus every credit document on disk must be claimed and every model on disk
  must be registered. Restricted licences (NonCommercial and kin) are enumerated by
  `restrictedLicenceAssets()` — legal here, illegal in a paid release.
- **`ASSET_STATUS.VALIDATION` IS NOT CONTENT.** A validation asset proves the pipeline and
  may not be referenced from `src/dimensions/` or `src/world/`. E2.0a ships **one**
  validation asset and **zero** production assets, because the landmark specifications
  have not been supplied.
- **AN ASSET DOES NOT BRING ITS OWN PHYSICS.** Collision is a declared proxy. There is
  deliberately **no `mesh` collision mode** — a render mesh as a collision surface is the
  coupling E2.1 exists to prevent, in a new costume.
- **ONE SOURCE, MANY CLONES, ONE OWNER.** Clones share geometry, materials and textures
  with the cached source; only the last `release()` disposes. Proved against
  `renderer.info.memory`, not against the library's own bookkeeping.
- **A FAILED LOAD IS NOT STILL LOADING**, and **a dead transport is a different fault from
  a dead asset**. Both are section 61.07's lessons, applied to a new subsystem *before* it
  costs three playtests instead of after.

### The E2.1 contract, answered over meshes for the first time

`AssetCollisionSet` implements `collidesAABB`, `groundHeightAt` and `isSolid` over placed
proxies with no voxel in it. That is the first evidence that E2.1's contract is
representation-neutral **in fact** rather than in its header comment — the same three
questions, the same kinds of answer, a completely different representation.

One difference is deliberate: `groundHeightAt` returns **null** where the set has nothing,
not a number. A collection of props knows about props, and "no opinion" is a different
answer from "the ground is at zero". Whoever composes this with terrain decides what a
null means — and that composition, a **composite PhysicalWorld**, is the terrain phase's
job, not this one's. It is deferred explicitly rather than half-built.

### three.js is vendored, and the upgrade is deferred on measured evidence

`game.html` loaded r128 from cdnjs. It now loads `vendor/three/three.min.js`, which is
**byte-identical** to it (md5 `eb85498…`), so nothing that renders changed — what went
away is a runtime dependency on a third party and the *two divergent copies* the game and
the suites were using. `tests/harness/source.js` excludes `vendor/` from reassembly, or
eighteen text-scanning suites would silently start reading 700KB of minified three.js.

The E2.0a decision pass recommended upgrading to current stable and predicted a cosmetic
drift. **Measured in a real browser, the drift is not cosmetic**: r186 renders the
existing game about **2.7× darker**, and a full compatibility shim (ColorManagement off,
linear output, every light ×π) moves the mean by 0.1. The remedy is to re-tune the voxel
renderer's materials and lighting, which is a *visual* job and belongs to **E2.5 Lighting
Rebirth** — not to a foundation phase, and not to the build whose human playtest gate is
still open. The full table is in `vendor/three/README.md`.

Nothing has to be rewritten when it happens: the pipeline resolves its loader in **one**
place and asks which colour-space API exists in **one** other, and
`tests/browser-assets.js` runs the whole suite on both generations.

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

## 9.5. HANDOFF — WHAT 1.5.4 LEFT, AND WHAT IS LEFT NOW

> **ERA 1.5.6 IS DONE AND CLOSED FOUR OF THE ITEMS BELOW.** The CSS went in 1.5.5 (§4.7);
> the dimension booleans, `SanitySystem`'s engine reads, the gameplay→HUD direction and the
> rendering boundary went in 1.5.6 (§4.8). What remains under "what the next phase owns" is
> **`SoundEngine`, `UIManager` and `PlayerController` as file moves, and Game's remaining 32
> monolith dependencies** — none of which is a coupling problem, all of which are module
> bookkeeping. The section is kept because its reasoning about what was deliberately left
> alone is still the record.

### The original 1.5.4 handoff

Era 1.5.4 is done: `Game` is in `src/core/game.js`, its dependency surface is declared and
capped, and the application seam is asserted in `tests/architecture.js` §4d (§4.6 above).
Era 1.5.5 is done: the CSS is in seven sheets under `styles/`, the presentation seam is
asserted in §4e (§4.7 above), and the markup deliberately stayed in the document.

**THE SPLIT STILL IS NOT FINISHED.** `PlayerController`, `UIManager`, `SoundEngine`, the
mobs, the animals and the horror systems are all still in `game.html`. Do not describe the
game as modular.

### What the next phase owns

1. **The three runtime systems 1.5.4 deliberately did not swallow.** The brief for this
   phase said to move a supporting piece out of Player/UI/Audio only if the Game boundary
   genuinely required it. None of them did, so none of them moved.

   | | lines | members |
   | --- | ---: | ---: |
   | `SoundEngine` | 2,151 | 66 |
   | `UIManager` | 1,442 | 58 |
   | `PlayerController` | 1,032 | 36 |

   `SoundEngine` in particular is synthesis that works: move it, change nothing in it
   (CLAUDE.md §62.6).

2. **Game's 35 remaining monolith dependencies.** They are listed by name in
   `tests/architecture.js` §4d's manifest and capped there. Twenty are the subsystem
   classes above and their siblings; fifteen are tables that travel with them
   (`MOB_CAP_*`, `HAVEN_*`, `FARM_*`, `PROGRESSION_MILESTONES`, `INVENTORY_SIZE`,
   `buildBlockAtlas`). Each one extracted turns a coincidence of file order into a real
   module dependency, and the ceiling falls by one.

3. **`core/`'s five THREE references.** The composition root builds the `WebGLRenderer`,
   the `Scene`, the `PerspectiveCamera` and the `Clock` because no other layer owns them
   yet. When `rendering/` becomes real, those five should approach zero. The budget entry
   in §4b names them individually for exactly this reason.

4. ~~**CSS and markup out of `game.html`.**~~ ✅ **Done in 1.5.5** — see §4.7. The CSS is
   seven sheets under `styles/`; the markup stayed, with its reason. What is left here is
   the **54 runtime `.style.*` writes in the monolith**, capped in §4e and falling as
   `UIManager` comes out. Extracted modules make **zero**, and that is locked at zero.

5. **The three dimension booleans.** Still 112 references outside the translator, and the
   distribution is now visible: **Game 47, the developer console 33, the monolith 29,
   moved content 3.** `dimensionOfPlayerFlags` in `src/dimensions/dimension-descriptors.js`
   is still the single designated translation point. 1.5.4 did not redesign this, on
   purpose — a state redesign in the same phase that moves the frame loop and the save
   path is how a refactor becomes a bug hunt.

### What 1.5.4 left alone, with its reasons

* **The three lifecycle edges from the engine into dimension content** — the constructor's
  two eager region builds and `setBlockWorld`'s water notification. 1.5.3 handed these to
  1.5.4; 1.5.4 looked at them and left them. Turning them into descriptor rows means
  changing *when a dimension is built*, which is a startup-ordering change, and this phase
  had already moved startup. They are still three, still capped, still named in §4c.
* **`Game.captureSaveState` / `_applyRestoredState` / `_teardownForRestore`** — see §4.6.
  Persistence owns the file; the orchestrator owns what goes in it.
* **`riftArming` ticks on the clamped physics delta.** Still latent, still unfixed, and
  1.5.4 did not touch `AnchorMonumentManager`. `AnchorMonumentManager.update(dt)` takes the
  `dt` clamped to 0.06 for physics safety, so the arming delay's real duration is
  `RIFT_ARM_TIME / min(realDt, 0.06)` — 1.6s at 60fps, about 27s at 1fps. It is a
  presentation delay and presentation ticks on `filmDt`. Whoever touches that method next
  should move this one number onto `filmDt` and add it to the enumerated consumer list in
  `tests/opening.js`.
* **`VoxelWorld._playDoorSound` reads `this.game && this.game.sound`.** Nothing in the build
  assigns `game` on a world, so that branch has never been taken — a door in the engine
  that has never opened. 1.5.4 did not delete the two tokens (`voxel-world.js` is 1.5.3's
  file and this is not the Game boundary) and instead asserts that nobody ever wires it up,
  which is the half that matters. Delete it whenever `voxel-world.js` is next opened.

### The comparison fixtures are not tracked — regenerate them before trusting a red

Unchanged from 1.5.3 and worth repeating: `journey.js`, `chain.js`, `regression.js`,
`performance.js`, `hud.js`, `items.js` and `render-items.js` all compare against an older
build held in `tests/*.html`, and **none of those files is in git**. `tests/README.md` names
the commit for each. A stale fixture fails in the direction of "no difference", which reads
as a broken feature rather than a broken test.

---

## 9.6. ERA 1.5.6 — COUPLING CUTS + RENDERING BOUNDARY — THE SCOPE PROPOSAL

> **THIS IS THE PROPOSAL, KEPT AS WRITTEN.** It was produced from measurement before any
> code changed, and it is left here unedited because the measurements are the argument
> for what was and was not done. **What was actually built is §4.8**, and §9.6.7's
> acceptance criteria are answered there. Where the two differ, §4.8 is the build.

*Every number below is AST-derived from the `b9d1dae` build and re-derivable.*

**THE PHASE'S ONE TEST.** Not "is the architecture tidy" but: **would this boundary
materially interfere with replacing the voxel presentation and world with a non-voxel
game?** Anything that fails that test is deferred, including things an earlier `LAYER.md`
scheduled.

### 9.6.1. THE RENDERING BOUNDARY — WHAT WAS MEASURED

`src/rendering/` contains one file, `LAYER.md`, listing ten units scheduled to move there —
nine in 1.5.2, the mesher in 1.5.3. **None arrived.** `game.html` holds 455 `THREE.`
references; `src/rendering/` holds none.

| unit | kind | lines | game.html | THREE | DOM | voxel-coupled | helps Era 2 | verdict |
| --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| `EnvironmentSystem` | class | 534 | 11670–12203 | 35 | 0 | no | **yes** — sky, sun, fog and the day cycle are exactly what Era 2 re-authors | **MOVE** → `environment-system.js` |
| `PostFX` | class | 225 | 12420–12644 | 10 | 2 | no | **yes** — the one post pass; Era 2 keeps or replaces it whole | **MOVE** → `postfx.js` |
| `AshParticleSystem` | class | 66 | 12235–12300 | 5 | 0 | no | yes (small, and it is pure presentation) | **MOVE** → `ash-particles.js` |
| `BlockTargetHighlight` | class | 84 | 3427–3510 | 7 | 0 | no (one word in a comment) | yes — any first-person game needs a target outline | **MOVE** → `block-target-highlight.js` |
| `buildStalkerMesh` | fn | 201 | 12673–12873 | 23 | 0 | no | **yes** — creature presentation is Era 2's subject | **MOVE** → `creature-meshes.js` |
| `buildBehemothMesh` | fn | 235 | 13648–13882 | 33 | 0 | no | yes | **MOVE** → `creature-meshes.js` |
| `buildSkeletonMesh` | fn | 122 | 13402–13523 | 28 | 0 | no | yes | **MOVE** → `creature-meshes.js` |
| `buildSpiderMesh` | fn | 78 | 13526–13603 | 19 | 0 | no | yes | **MOVE** → `creature-meshes.js` |
| `buildFarmAnimalMesh` | fn | 387 | 15276–15662 | 29 | 0 | no | yes — §21's parametric animal library | **MOVE** → `animal-meshes.js` |
| `buildFinalCreature` | fn | 130 | 6538–6667 | 14 | 0 | no | yes | **MOVE** → `finale-meshes.js` |
| `buildFinaleScene` | fn | 68 | 6728–6795 | 7 | 0 | no | yes | **MOVE** → `finale-meshes.js` |
| `buildBlockAtlas` | fn | 127 | 4294–4420 | 5 | 1 | **YES** | **no** | **DEFER** |
| `buildSuburbFurniture` | fn | 540 | 7735–8274 | **0** | 0 | **YES** | **no** | **DEFER** |
| `buildSuburbInteriorStructure` | fn | 261 | 8294–8554 | **0** | 0 | **YES** | **no** | **DEFER** |

**MOVE: 11 units, 2,130 lines. DEFER: 3 units, 928 lines.**

### 9.6.2. WHY THE THREE DEFERRALS ARE DEFERRALS AND NOT LAZINESS

The 1.5.1 map filed all three under "rendering". The measurement says they are not
rendering at all.

**`buildSuburbFurniture` (540 lines) and `buildSuburbInteriorStructure` (261) hold ZERO
`THREE.` references.** They are not mesh builders. They are **sub-voxel block-catalogue
registrars**: they call `_furnAlloc()` for a block id and write `SUB_SHAPE_DEF`,
`BLOCK_SHADE_BOOST`, `BLOCK_HARDNESS` and `BLOCK_DISPLAY_NAME` — data the greedy mesher
later consumes. Filing them under `rendering/` would put voxel block data in the one layer
that is supposed to survive Era 2, which is the exact failure the §4b layer rule exists to
catch. And CLAUDE.md §57 makes the move actively dangerous: `_furnNextId` hands out ids in
registration order, so disturbing that order rewrites the chunk data of the entire suburb.
Era 2 deletes both with the voxel world.

**`buildBlockAtlas` (127 lines)** paints one 16×16 tile per block id into a strip indexed
by block id, for the mesher's UVs. It is the voxel texture atlas. Era 2 deletes it with the
mesher, and 1.5.3's reasoning for the mesher applies unchanged.

**The greedy voxel mesher stays where it is, and 1.5.3's decision is not reopened.** It
reads block ids, shapes and chunk neighbours through the engine's own state; lifting it out
means inventing an interface for the thing Era 2 deletes.

### 9.6.3. CUT A — DIMENSION IDENTITY

Measured: **116 references — 81 reads, 35 writes — across six owners.**

```
  47  (38r / 9w)  src/core/game.js
  33  (12r /21w)  src/core/dev-tools.js
  30  (25r / 5w)  game.html
   3  ( 3r / 0w)  src/dimensions/dimension-descriptors.js   (the designated translator)
   2  ( 2r / 0w)  src/dimensions/suburbia/generation.js
   1  ( 1r / 0w)  src/dimensions/haven/stampers.js
```

**The decisive finding is in the writes.** All 35 occur in **12 places, and every one of
them assigns the complete triplet.** They are already "set the dimension", spelled as three
statements. That makes the cut mechanical rather than a redesign:

* `player.dimension` becomes the **single authoritative field**, holding a **stable id**
  from the existing `DIMENSION` enum. No id is renumbered, no `saveName` changes, no
  creative number is touched, and the save schema stays at **version 5** — the save already
  stores `dimension` as a `saveName` string and that is not touched either.
* `inFarmlands` / `inSuburbia` / `inFakeHaven` become **derived accessor properties**. All
  81 reads keep working, unmodified — which is what makes this safe.
* Every write goes through one setter. **35 assignments → 12 calls.**
* Two-true becomes **unrepresentable**, and the Overworld stops being encoded as the
  absence of evidence.
* Adding The Below costs a descriptor row. `DIMENSION_PLAN` already carries it.

This is the `DimensionService` identity half that §3 calls *"the single most valuable thing
1.5 will add"*.

### 9.6.4. CUT B — `SanitySystem` → `VoxelWorld`

`SanitySystem` (117 lines, `game.html` 12302–12418) reads five things off `world`. Three
are voxel-engine internals and two are gameplay:

| read | what it is | verdict |
| --- | --- | --- |
| `world.torchLights` | the engine's light-source `Map`, iterated for a nearest-distance | **cut** |
| `world.getLightWorld(x,y,z)` | baked voxel light level | **cut** |
| `world.hasSkyAbove(x,y,z)` | a column query into chunk data | **cut** |
| `world.anchorManager.isInsideSafeZone(pos)` | the Anchor — gameplay | **keep** |
| `world.isInsideSoulAnchorZone(pos)` | the Soul Anchor — gameplay | **keep** |

The three cuts are all the same question in different clothes: *how illuminated and how
exposed is this point?* So the port is three read-only queries — `lightLevelAt`,
`hasOpenSkyAbove`, `nearestLightSourceDistance` — satisfied by the voxel world today and by
whatever Era 2 builds tomorrow. `SanitySystem` never changes again.

The two keeps stay, but stop arriving *through* the world: they reach `SanitySystem` as
what they are rather than as fields hung on the engine by the composition root.

**No gameplay number moves.** Every rate, floor, threshold and radius in §62.5.2's Suburbia
curve is preserved exactly.

### 9.6.5. CUT C — GAMEPLAY → HUD

Measured: **110 call sites over 37 distinct `ui.*` methods** (`src/core/game.js` 64,
`game.html` 43, `src/core/dev-tools.js` 3). §53 already forbids the HUD reading gameplay
and `tests/hud.js` enforces it; this is the unguarded direction.

**What makes Era 2's HUD replacement expensive is not the count — it is that the required
surface is undeclared.** A replacement must implement exactly the right set of methods, and
today the only way to learn that set is to grep. That is the identical problem 1.5.4 solved
for `Game`, and it takes the identical solution (§4.6: *moving a class into a file is not a
boundary; the declared manifest is*).

**C1 — declare the presentation port.** A frozen table naming every method gameplay may
call, grouped by kind — *state* (the HUD mirrors a value), *verb* (the player opened a
panel), *event* (a one-shot), *wiring* (the composition root). `tests/architecture.js`
asserts, in both directions, that every `ui.*` call site names a port method and every port
method exists on `UIManager`. An undeclared call is a failure. Era 2 gets a checklist
instead of a grep, and it ratchets.

**C2 — delete the pushes the frame loop already makes.** `_animate` (`game.js` 1912–2341)
unconditionally calls `updateHotbarSelection()`, `updateVitals()` and `setPhase()` at lines
2328–2330, and `player.update(dt)` runs at line 2004 — **324 lines earlier in the same
frame**. So `Inventory`'s seven `updateHotbarSelection()` pushes repaint a HUD that is about
to be repainted anyway, at zero frames of latency saved. Deleting them lets **`Inventory`
drop its `ui` field entirely**: a pure data structure stops knowing the HUD exists. Its
constructor goes `Inventory(ui)` → `Inventory()`.

The four early returns in `_animate` — `climaxTriggered`, `winScreenMode`, `settingsOpen`,
`film.active` — are the safety argument, and they all point the right way: in each, the
world is not simulating, so no value the HUD mirrors can change.

**C3 — `SanitySystem` drops `ui`.** Its four `setSanity` pushes are the one case where the
frame block does *not* already carry the value, so the block gains one line and sanity
becomes symmetric with vitals. Paired with cut B, `SanitySystem`'s constructor goes
`(env, world, ui)` → `(env, port)` and a horror system stops depending on both the voxel
engine and the HUD.

**Not in scope:** no `UIManager` rewrite, no HUD design change, no event bus, no
observer framework, and no conversion of the *verb* and *event* calls — a panel toggle and a
jumpscare are genuinely imperative and pretending otherwise buys nothing.

### 9.6.6. WHAT THIS PHASE EXPLICITLY DEFERS

* **`buildBlockAtlas`, `buildSuburbFurniture`, `buildSuburbInteriorStructure`** — 928 lines
  of voxel block catalogue and atlas, deleted by Era 2 (§9.6.2).
* **The greedy voxel mesher** — 1.5.3's decision, not reopened.
* **`riftArming` on the clamped physics delta** — a gameplay-timing fix, recorded in §9.5.
* **`SoundEngine`, `UIManager` and `PlayerController` as file moves** — none of the three is
  a coupling problem. Audio's three layers are already Era-2-proof (§61); `UIManager` is
  already block-free and THREE-free (§53). Moving them is module bookkeeping, and this phase
  does not treat module count as a goal.
* **`Game`'s remaining monolith dependencies** — that number falls as a *consequence* of
  moves, and is not itself a target.

### 9.6.7. ACCEPTANCE CRITERIA

1. `src/rendering/` holds the 11 moved units; every payload **byte-identical** to the text
   removed, plus a header. Proved by reassembly, not by review.
2. The three booleans have **no assignment anywhere** in the build; `player.dimension` is
   the only writable dimension state; two-true is unrepresentable.
3. `SanitySystem` reaches `torchLights`, `getLightWorld` and `hasSkyAbove` **zero times**,
   and holds no `ui`.
4. `Inventory` holds no `ui` and takes no `ui` argument.
5. The presentation port is declared and asserted in both directions.
6. **Save schema still version 5.** No id renumbered, no `saveName` changed, no creative
   number touched.
7. Every existing ratchet holds or falls. **None rises.**
8. All 31 offline suites green. All 10 browser suites at or above their `b9d1dae` results.

### 9.6.8. REGRESSION PLAN

* **World generation must be bit-identical.** `determinism.js`, `regression.js`,
  `journey.js`, `chain.js` — plus a direct chunk-hash comparison across all four dimension
  bands against the pre-phase build, because cut A touches the flags that `suburbia/
  generation.js` and `haven/stampers.js` read.
* **Sanity must be numerically identical.** Cut B changes how the three values are
  *obtained*, not what they are: drive the real `SanitySystem` on both builds over the same
  inputs and assert the curves match exactly.
* **The HUD must paint the same things.** `hud.js` drives the real `UIManager` against a
  recording DOM stub, including its 600-steady-frame zero-write performance contract, which
  C2 and C3 must not disturb.
* **Two known failures are pre-existing and must not be reported as new.**
  `browser-transitions` stops at the Farmlands crossing on the `riftArming` clamped-delta
  defect (§9.5); `browser-haven`'s 2Hz anomaly sweep is frame-rate sensitive and passes when
  run alone. **Neither may be called a regression without an A/B against `b9d1dae`.**
* Everything full-screen still cleared by `resetPresentation()` (§62.5.1).

---

## 10. THE REMAINING PHASES

| Phase | Moves | Risk |
| --- | --- | --- |
| ~~**1.5.2**~~ | ✅ **DONE.** Pure data and pure helpers: block catalogue, shape tables, block properties, audio tables, objective tables, entity tuning, world constants, save-schema constants, onboarding cues — plus the dimension registry. 15 modules; the inline body shrank by 2,077 lines. | low |
| ~~**1.5.3**~~ | ✅ **DONE.** `VoxelWorld` split: a 1,640-line engine away from four dimensions' content, **as generation / stampers**, which is the Era 2 seam. 15 modules, 13,866 lines; the chunk dispatch became a 3-row table; every block id in `src/dimensions/` is now in a `stampers.js`. See §4.5. | high |
| ~~**1.5.4**~~ | ✅ **DONE.** `Game` out of `game.html` into `src/core/game.js`, with the save LIFECYCLE under it in `src/persistence/` and the developer console in `src/core/dev-tools.js`. Its dependency surface is declared and capped; the inbound surface is five fields and one method. The player booleans were NOT redesigned — see §9.5. | high |
| ~~**1.5.5**~~ | ✅ **DONE.** The presentation seam: the 1,067-line `<style>` block out of `game.html` into **seven stylesheets** under `styles/`, proved by computed-style A/B over 359 elements and 150,810 properties with **0** differences. `tests/harness/source.js` reassembles the sheets so no CSS-slicing suite scans less than before. The markup stayed, and nothing was renamed or redesigned. See §4.7. | medium |
| ~~**1.5.6**~~ | ✅ **DONE.** The coupling cuts and the rendering boundary. Dimension identity becomes one field and three derived views (**35 writes → 0**); `SanitySystem` stops reading the voxel engine (**118,256 values proved identical**); the gameplay→HUD surface is declared and two gameplay classes stop being HUD callers; 11 units and 2,130 lines land in `src/rendering/` with **zero block ids**. Three units the 1.5.1 map filed as rendering are voxel block data and were explicitly deferred. See §4.8. | medium |

**ERA 1.5 IS COMPLETE. The architecture is ready for Era 2.**

What Era 2 replaces is now bounded and named: `src/rendering/` (7 files), the six
`stampers.js` files, `VoxelWorld`, `sanity-world-view.js`, the presentation port's 37
methods, and the voxel block data still in `game.html` — the atlas and the two furniture
registrars. What survives is everything else: the dimension content's `generation.js`, the
site table, the descriptors, the audio layers, the save schema, the objective chain.

**What is left is bookkeeping, not coupling.** `SoundEngine` (2,151 lines), `UIManager`
(1,442) and `PlayerController` (1,032) are still in `game.html`, and Game still names 32
monolith dependencies. None of the four is a boundary problem — §61 already proves audio's
three layers Era-2-proof, §53 already proves `UIManager` block-free and THREE-free — and a
phase that moves them should say it is tidying, not that it is unblocking Era 2.

Each phase ended the way this one did: the four comparison suites proving world generation is
**bit-identical**, every offline suite, every browser suite, and a clean tree.
