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

## 4.10. THE D1 NON-VOXEL TERRAIN FOUNDATION — ERA 2, E2.2

The first Era 2 *Rebirth* phase. `src/world/terrain/` is a finite, continuous, streamed,
non-voxel world for the final **Dimension 1 — Shattered Farmlands**: ten files, ~1,900
lines, **zero voxel tokens**.

> **STATUS: FOUNDATION. COMPLETE, RUNNING, AND NOT YET THE LIVE D1.**
> It generates, streams, collides, renders and disposes, and `tests/browser-terrain.js`
> drops a real player on it in a real browser. The playable chain still runs on the Era 1
> voxel implementation — see *Why it is parallel* below.

### The one property everything rests on

**Height is a pure function of (x, z) over the reals, and it is authoritative.** The mesh
SAMPLES it; collision QUERIES it; scatter is placed ON it; roads are CUT INTO it.

That ordering is what makes this non-voxel rather than voxel-with-smoothing. A region can
be rebuilt at 2 m or 16 m spacing and the ground the player walks on does not move, because
the ground is the function and the mesh is a picture of it. Measured: a body walking 900 m
across it never sees the surface step more than **0.151 m over a 0.5 m stride**.

### The finite world, and the number that is now locked

| | |
| --- | --- |
| extent | **4,096 m square**, centred on the origin |
| regions | 16 × 16 = **256**, of 256 m |
| vertical budget | **derived** from the relief amplitudes, not typed |
| LOD | 2 / 4 / 8 / 16 m vertex spacing by distance |
| seed | one constant; no `Math.random` anywhere in the layer |

The Era 1 Farmlands is 64,512 m square and its own header says a player "cannot reach an
edge in normal play". That is effectively infinite, and it is the wrong shape for a world
somebody has to compose: there is no far side, no silhouette that means anything, and no
way to author a journey.

**`D1_WORLD_SIZE` IS LOCKED AT 4,096 m × 4,096 m.** When E2.2 shipped this was flagged as a
provisional figure awaiting a creative decision; that decision has since been made and the
number is approved. Its derivation is written out in `terrain-config.js` (crossing time at the
build's real walk speed, seven landmarks, region count) and the shipped value already matches,
so nothing in the terrain layer changes — what changed is that the number is a decision rather
than a placeholder, and the seven landmarks are to be composed inside it.

The comment block at the head of `terrain-config.js` was updated to match (comment text only —
no executable line changed, and `tests/terrain.js` still passes). **If a technical constraint
ever makes this extent unworkable, that is a finding to report separately, not a licence to
change it quietly.**

The world's EDGE TREATMENT is a separate question and remains open: `D1_EDGE_MARGIN` and
`d1ClampToWorld` still describe themselves as provisional, correctly, because what the boundary
IS — a river, a thickening treeline, a collapsed road — is environmental authorship nobody has
decided. Locking the extent did not lock the edge.

**The finiteness is proved by termination, not by assertion.** `d1AllRegions()` returns 256
entries and stops; the streamer intersects its load radius with that fixed grid. Measured in
a real browser: at the map's far corner **11** regions are resident instead of 40 — the ring
is simply shorter — and a viewpoint 1,000 km outside the world streams in **nothing**.

### Why it is parallel, and not a replacement yet

Swapping the dimension now would take out the Phase 20 journey, the Disconnected Home, the
guaranteed Level 2 Core Disk and both rift crossings — all covered by suites that walk a
real New Game to the credits. ROADMAP §43 forbids combining a risky architectural change
with an unrelated gameplay redesign, and the E2.2 brief requires existing gameplay to keep
working. `tests/architecture.js` §4j asserts the voxel engine contains **no reference** to
the terrain layer, so "parallel" is a checked property rather than a claim.

### The E2.1 contract, second implementation

`TerrainPhysicalWorld` answers all eleven queries with no voxel in it. §4j asserts both
implementations expose the same set, so they cannot drift.

**Ground height is continuous — and ten call sites in the build floor their arguments.**
`groundHeightAt(Math.floor(x), Math.floor(z))`, seven in `game.html`, one in `dev-tools`,
two in `save-lifecycle`. Against the voxel world that is *correct* and free. Against this
one it quantises a continuous surface to a 1 m grid.

**E2.2 does not change them** — they are legacy voxel gameplay, right for the world they
serve. It **measures the consequence** instead, so the phase that makes this world live
inherits a number: flooring costs a mean of **0.066 m** and at worst **0.469 m** on this
terrain (3,000 samples, `tests/terrain.js` §6).

**Collision is a heightfield test, not a mesh test**, and that is reasoned rather than
asserted: the visual mesh has ~33k triangles per near region, it *changes* with distance,
and colliding against it would make the ground's physical shape depend on where the camera
is. Authored structures use the E2.0a asset collision proxies instead.

### The authored-content seam — three tables, all empty

`terrain-authoring.js` is the reason the phase exists. A site declares a footprint, a
terrain treatment (pad / grade / none), a scatter exclusion and a long-range visibility
distance; the treatment is applied *inside* the height function, so collision, scatter and
the mesh all agree without any of them knowing a site is there.

**`D1_AUTHORED_SITES`, `D1_ROAD_NETWORK` and `D1_SCATTER_SPECIES` all ship EMPTY, and three
tests enforce it.** Not one entry appears, *not even as a placeholder* — a placeholder
coordinate is what a later phase mistakes for approval. §4j also fails if a landmark name
appears as authored data anywhere in the layer.

> **UPDATED SINCE E2.2 SHIPPED.** When this phase landed, the seven landmarks were a roster
> with no design behind them. **`D1_DESIGN.md` now specifies all seven in full** — architecture,
> interiors, sequences, horror beats, progression and the finale — and it is the single detailed
> D1 source of truth. What is still **CREATIVE DECISION NEEDED** is narrower than this section
> originally said: the landmark **coordinates**, the **road route**, the **scatter species**,
> and the final `D1_WORLD_SIZE`. The comments inside `terrain-authoring.js` and
> `terrain-roads.js` still carry the original, broader wording and were deliberately not edited
> in the canon pass — that file is code, and the phase that fills these tables should correct
> them as it does so.

The machinery is nonetheless proven: test fixtures show a PAD site levels its footprint to
within **0.00001 m** and a lane flattens its carriageway to **0.105 m** against the natural
field's **0.248 m** over the same span.

### What it cost, measured

| | |
| --- | --- |
| initial load at map centre | **157 ms**, 40 regions |
| resident | 749,568 triangles / 381,992 vertices |
| one frame | **32 draw calls**, ~400k triangles |
| near region build | **67 ms** — down from 290 ms |

That 4.3× came from one change, and it is the phase's performance lesson: the first loop
called `d1TerrainHeight` for the position, `d1TerrainNormal` for four more, and
`d1SurfaceAt` for six more — **eleven evaluations per vertex**. Sampling a grid with a
one-cell border makes every vertex's neighbours already available, so normals and slope are
central differences over an array. CLAUDE.md §14: measure, then optimise.

### Resource lifetime

A region owns its **geometry** and not its **material**. Unload frees every geometry it
built; the six shared materials are module-owned and freed only on a full dimension
teardown. Verified in the browser across four load/unload cycles — counters return exactly
to baseline, and the shared material survives by uuid.

> **The first version of that resource test read `added 0, freed 0, residual 0` and passed.**
> `renderer.info.memory` only counts a geometry once it has been *uploaded*, which happens
> on first draw — so a test that builds and unloads without rendering measures nothing and
> scores perfectly. Rendering a frame between build and read is what makes the number real,
> and the suite now also asserts the counters *moved*. Same shape as every lesson in
> §61.05–61.07: ask which half of the claim the test actually covers.

---

## 4.11. THE COMPOSITE PHYSICAL WORLD — D1 IMPLEMENTATION PHASE 1

`src/world/composite-physical-world.js` — 225 lines, one class, **zero block ids and zero
`THREE.` references**. It is the physical world gameplay talks to when the world is made of
more than one thing.

### Why it exists

E2.1 gave gameplay eleven queries and E2.2 gave them a second implementation over the D1
heightfield. Both answer for ONE representation. The final D1 is terrain **plus** authored
architecture, and a building the player can walk into is exactly a place where the ground is
not the terrain. Something has to answer across both, and it must not be gameplay deciding
which backend to ask.

The composition already existed in the wrong place: `TerrainPhysicalWorld` reached through
`this.regions.assetCollision` in three of its eleven methods. That made a **terrain** backend
responsible for knowing assets exist, allowed exactly one provider, and left the resolution
policy implicit in three method bodies with nowhere to write it down. Phase 1 took it out of
the terrain backend and made it explicit.

```
GAMEPLAY
  |
  v
CompositePhysicalWorld            implements the full eleven-query contract
  |-- base      : a COMPLETE PhysicalWorld   (TerrainPhysicalWorld, or VoxelPhysicalWorld)
  `-- providers : zero or more PARTIAL shape providers   (AssetCollisionSet, ...)
```

The asymmetry is deliberate. A **base** answers everything. A **provider** may implement any
subset of `collidesAABB`, `isSolid` and `groundHeightAt`, and a method it does not implement
is never called. `AssetCollisionSet` answers three questions and has no opinion about water,
sky, light, sanctuary or streaming; requiring it to implement eleven would mean inventing
eight answers, which is how a composition layer starts lying.

### The resolution policy, per query

This is the part that matters, and it is different per query because each question means
something different.

| query | policy | why |
| --- | --- | --- |
| `collidesAABB` | **UNION** (OR) | Solid is additive. Nothing becomes passable by being next to something else — the rule that stops a wall being walk-through because its collision came from a mesh. |
| `isSolid` | **UNION** (OR) | Same, about a point. |
| `groundHeightAt` | **MAXIMUM**, base as floor | A floor is what you stand on. A barn floor above the terrain wins; where no provider has anything, the terrain answers unchanged. A provider's `null` means *no opinion* and is **never** read as zero. |
| `waterLevelAt` | **BASE ONLY** | No provider carries water information. Architecture above water does not drain it: letting a floor report dry ground below would be a new global water system, which Phase 1 is forbidden to build. |
| `editEpoch` | **base + provider revision** | The one composed non-shape query, and a correctness fix rather than a choice — adding or removing a proxy *does* change the world's shape, and a resting-item cache keyed on this must invalidate. `undefined` in gives `undefined` out: "cannot tell" never becomes a number. |
| `isResidentAround`, `hasOpenSkyAbove`, `lightLevelAt`, `nearestLightSourceDistance`, `isInsideSafeZone`, `isInsideSoulAnchorZone` | **BASE ONLY**, forwarded | Nothing in the build has a provider-side answer to offer, and inventing one is out of scope. |

### Lifecycle

`addProvider` is **idempotent** — a region that streams in twice does not register its
collision twice. `removeProvider` is a safe no-op for something never added or already
removed, because a disposed region is allowed to unregister sloppily. `clearProviders` drops
every provider and **does not touch the base**: it is a teardown of what was placed on the
world, not of the world. A removed provider leaves no entry behind and stops contributing on
the very next query — `tests/composite.js` proves the ground falls back to the terrain rather
than to a stale height.

### Streaming and cost

One array walk over the providers, short-circuited: a query the base already answered
affirmatively never consults a provider. Measured over 200,000 `groundHeightAt` calls —
terrain-only 460 ms, composite with no providers 458 ms (**−0.3%**), one proxy 465 ms,
twenty-four proxies 488 ms (**+6%**). No allocation per query, no global registry, nothing
that grows without bound.

The provider walk is linear in proxy count **by design**. `AssetCollisionSet` is a flat list
by its own deliberate decision, and choosing a spatial index before there is a distribution
to measure is a guess (CLAUDE.md section 14). The phase that places thousands adds one, with
a benchmark.

### Determinism

No `Math.random`, no clock, and — because UNION and MAXIMUM are both commutative — **the
answer does not depend on the order providers were added.** `tests/composite.js` proves that
by building two composites with the providers in opposite orders and comparing 1,800 answers.

### Why gameplay uses the composite and not a backend

Ask the composite and you do not need to know whether the floor under you is ground, a barn
or a catwalk. `D1TerrainWorld` exposes both: `world.physical` is the composite and is what
gameplay uses; `world.terrain` is the bare heightfield backend, kept reachable so a test that
wants the ground with nothing on it can ask for exactly that.

### What did not change

**The Era 1 voxel path is untouched.** `Game` still builds a `VoxelPhysicalWorld` directly and
`tests/browser-terrain.js` asserts it. The composite is available to it and is not forced on
it, because the voxel world has no mesh architecture to compose. The two implementations
remain valid and neither was deleted.

**And the answers did not change.** The A/B gate: the pre-phase `terrain-physical-world.js` is
loaded from git and driven alongside the new build over 12,000 comparisons — ground height,
water, `isSolid` and `collidesAABB` at 1,200 points across the map — plus 1,200 more with a
proxy placed. **Zero differences.** The new asset-collision capability is additive; nothing
about terrain moved.

---

## 4.12. THE NORMALIZED RAYCAST AND THE INTERACTION VOCABULARY — D1 IMPLEMENTATION PHASE 2

Two new files, and between them they answer a question the E2.1 contract deliberately left
open.

```
src/world/raycast.js        208 lines   the hit vocabulary and the ray/box primitive
src/gameplay/interaction.js 158 lines   three affordances, a registry, and a refusal
```

Neither names `THREE.`. Neither reaches the DOM. `interaction.js` contains no D1 noun —
`tests/raycast.js` greps for fifteen of them.

### Why it could not exist before, and what changed

`src/world/physical-world.js` shipped eleven queries and said, in its own header, why
`raycast` was not the twelfth: `voxelRaycast` returns `{ bx, by, bz, face }` — block
coordinates and a block face — while a mesh world returns a point, a normal and a surface.
Changing it in place meant rewriting mining, placement, door toggling and the look-target
prompt inside the phase that moved the collision seam. It ended: *"The interaction model gets
its own phase when it is rebuilt for meshes."*

**This is that phase, and `voxelRaycast` was not changed.** Its definition, its signature, its
return statement, the one call site (`PlayerController._getLookTarget`) and the four gameplay
paths that consume that result — mining, the break, placement and the interaction prompt — are
all exactly as they were, and `tests/raycast.js` asserts each of them by name. Phase 2 adds a
SECOND query beside it.

### The contract

```
raycast(origin, direction, maxDistance) -> hit | null
```

| term | rule | why it is a rule and not a convention |
| --- | --- | --- |
| `origin` | world space, built by the caller | The physical world is a world-query service and does not know what a camera is. Whoever has an eye builds the ray. |
| `direction` | **MUST be unit length** | Distances are compared ACROSS providers, so a provider that normalises and one that does not is exactly how two backends start disagreeing about which hit is nearer. `rayIsNormalized` exists for tests; runtime does not police it, because a per-ray square root is a cost paid forever to catch a bug once. |
| `maxDistance` | explicit, no default | A default here is a gameplay tuning constant, and this phase authors none. |
| a miss | **`null`** | Not `{ hit: false }`. Every call site is `if (h)`, and an object that is falsy-when-missing is a trap. `RAYCAST_MISS` documents the choice. |
| solidity | **from both sides** | Proxies are volumes, not sheets. A ray starting inside one reports distance 0. Backface culling would let a player inside a wall aim through it, and would need a facing convention the two backends have no way to share. |

A hit is `{ distance, point, normal, category, ref, providerId }` — a plain object, never a
`THREE.Vector3`, never a mesh, never a block id. `ref` is **opaque**: the producing provider's
handle for what was struck, meaningless to everyone else, and the hook a later phase resolves
an interaction target through.

### Four implementations, one answer shape

| backend | how it answers | notes |
| --- | --- | --- |
| `VoxelPhysicalWorld` | **adapts** `voxelRaycast` | Nothing reimplemented. The voxel world really does know where the ray meets a block; the adapter expresses that in the shared vocabulary. |
| `TerrainPhysicalWorld` | marches at `D1_COLLIDE_PROBE_STEP` (0.5 m), then 12 bisections | Normal from `d1TerrainNormal`'s analytic gradient. Starting below the surface returns distance 0. |
| `AssetCollisionSet` | slab test against **declared proxy boxes** | Never the render mesh. An asset with `ASSET_COLLISION.NONE` registers no box and is therefore not hittable at all — the same rule `collidesAABB` already followed. |
| `CompositePhysicalWorld` | **nearest hit across base and every provider** | See below. |

**ONE LIMIT IS RECORDED RATHER THAN HIDDEN.** `voxelRaycast` refines a hit against a shaped
block's own boxes but returns only the cell and the face, discarding the exact `t`. The
adapter recovers the distance by intersecting the ray with the hit CELL, which for a slab, a
stair or a fence is the cell's entry rather than the shape's. **The face is exact; the
distance can be up to one cell optimistic on a shaped block.** Correct for every full cube,
bounded, known, and fixing it means changing `voxelRaycast`'s return type — which is the one
thing this phase may not do. The voxel interaction path does not use this method.

### The composite's policy: nearest hit, and NO short-circuit

`collidesAABB` may stop at the first `true`, because solidity is a union. **A raycast may
not** — every provider must be consulted, because the nearest hit is not known until they all
have answered. That difference is written in the method.

At effectively the same distance (within `RAYCAST_TIE_EPSILON`, one millimetre) the tie is
broken by a **declared** order, never by registration order:

1. nearer wins;
2. then `RAYCAST_CATEGORY_RANK` — `asset` (0) beats `terrain` (1), because a floor laid exactly
   on the ground is a floor;
3. then the smaller **stable proxy id**.

That third step is why `AssetCollisionSet`'s id counter is **module-level rather than
per-set**. With a per-set counter, two sets composed as two providers both mint id 1, the
tie-break finds them equal, and the winner falls back to the order the composite happened to
consult them in — the one thing the rule exists to forbid. `tests/raycast.js` caught exactly
that: its two-provider tie test passed while comparing two DIFFERENT entries that merely
shared a number. The id is a runtime handle, never saved, never hashed, never fed into
generation.

### Cost — counted, not timed

A ray costs a **bounded, predictable number of heightfield samples**: one to reject "already
underground", one per half-metre of march, twelve bisections, four for the normal. A 5 m
crosshair ray is 22 samples; a 200 m ray that hits nothing is 401, exactly `maxDistance /
step`. Doubling `maxDistance` doubles the work and nothing worse.

**That is asserted by counting, not by a clock.** A wall-clock ceiling would have been
measuring the container — an empty 200,000-iteration arithmetic loop costs 245 ms in this
test VM — and CLAUDE.md section 62.11 is explicit that the answer to a drifty threshold is not
to raise it. The clock is still reported, as a ratio against the cost of the same samples
taken raw, which is a figure that survives a slow machine.

### The interaction vocabulary — and it does nothing

The moment a normalized raycast exists, an expensive confusion becomes possible: treating
"the ray hit something" as "the player can do something with it". Almost everything in the
world is hittable and almost nothing is interactive.

```
PHYSICAL HIT    ray met geometry. Says nothing about whether it can be acted on.
INTERACTABLE    a registered target with a stable id and declared affordances.
AFFORDANCE      none | inspect | use.   THREE WORDS, AND THAT IS ALL.
RESULT          { ok, refused, target, hit } — refusals are normal outcomes with reasons.
```

`InteractionRegistry` is a `Map` from a physical `ref` to an interactable. The gap between a
hit and an interaction **is that Map miss**, and it is deliberately one lookup.

**No D1-specific affordance may be added** — not `open_door`, not `read_note`, not
`activate_tower`. Every one of those is `use` or `inspect` plus a target that knows what it
is, and they belong to the phase that authors the content. It is not a dispatcher, holds no
handlers, calls nothing, and knows nothing about a camera, a key binding, a prompt or a
player. `tests/browser-raycast.js` asserts that exercising the whole vocabulary in the live
page adds **not one element to the document**.

### What did not change

The shipped game still builds a `VoxelPhysicalWorld`; mining, placement, doors and the
look-target prompt are untouched; no gameplay call site was rewritten; no interaction target,
prompt, verb or D1 content exists. The save schema is still **version 5**. `tests/raycast.js`
is 88 offline checks and `tests/browser-raycast.js` 37 live ones, over HTTP, in Chromium.

### Validation, and the two failures are A/B'd rather than explained away

All 33 offline suites green. 11 of 13 browser suites green, one at a time over HTTP. The two
that are not were both run against the pre-phase commit `2ab373e` in a separate worktree:

- **`browser-menu`** failed once during a back-to-back sweep on its canvas-resize check and
  **passes on both builds when run alone.** A race in the test's resize wait — the suite waits
  for `innerWidth` to settle but not for the window `resize` listener to repaint the canvas.
  Not a regression, and not fixed here.
- **`browser-playability`** throws at `browser-playability.js:588`, a 60-second wait for the
  Static Suburbia crossing. **The pre-phase build throws at the same line with the same
  message.** This is the `riftArming` defect section 4.6 recorded: the arming delay is
  decremented by the `dt` clamped to 0.06 for physics safety, so its real duration is
  `RIFT_ARM_TIME / min(realDt, 0.06)` and scales with frame rate. Nothing in this phase
  touched it, and an engineering foundation phase is not where gameplay timing gets changed.

And `browser-transitions` reached 51/0 here. **That is not a fix** — section 4.8's rule
stands: a green timing-sensitive suite means this container was fast enough, nothing more.

---

## 4.13. THE VISUAL BUDGET GUARDRAIL — D1 IMPLEMENTATION PHASE 3

Two new files in `src/assets/`, and between them they turn `VISUAL_RULE_BIBLE.md` section
9.1 from prose into something the repository can check.

```
src/assets/asset-budgets.js  445 lines   the rules, the vocabulary and the validator
src/assets/asset-measure.js  566 lines   every measurement, and the ONE counting definition
```

**Both name ZERO `THREE`.** They read duck-typed properties — `isMesh`,
`geometry.index.count`, `matrixWorld.elements` — so the same code measures a three.js scene
today and whatever Era 2's renderer rebirth produces tomorrow. That is why they live in
`src/assets/` (the layer documented as surviving Era 2) rather than in `src/rendering/` (the
layer documented as being rewritten wholesale): putting the thing that MEASURES the rebuild
inside the layer being rebuilt is the mistake this file exists to catch.

### Where the numbers live, and who owns them

`VISUAL_RULE_BIBLE.md` section 9.1 **remains the source**. It is a creative document and
`asset-budgets.js` implements its measurable subset. They are joined mechanically:
`tests/budgets.js` PARSES the bible's own table and asserts every range, texture target,
atlas flag and texel target against the model, matching rows by the bible's own label text.
A drift in either direction is a test failure, which is the only way two documents stay in
agreement without somebody remembering.

| class | triangles | texture | texel | atlas |
| --- | ---: | ---: | ---: | :---: |
| `small-prop` | 200–1,500 | 512 | 64 px/m | |
| `standard-prop` | 1,000–5,000 | 1024 | 64 px/m | |
| `architectural-module` | 1,000–6,000 | 1024 | 64 px/m | |
| `hero-landmark` | 10,000–30,000 | 2048 | 128 px/m | |
| `major-creature` | 10,000–25,000 | 2048 | 128 px/m | |
| `small-foliage` | 50–500 | 1024 | 64 px/m | ✔ |

### Two fields, because they answer different questions

Section 9.1 opens with *"They are guidelines, not absolute hard limits."* A validator that
turns that into pass/fail gets switched off within a month, and one that never fails is
decoration. So every metric result carries both:

| field | values | what it answers |
| --- | --- | --- |
| `band` | `within` · `near` · `over` · `unmeasured` | **what the number is**, against the rule alone |
| `status` | `pass` · `advisory` · `fail` · `unavailable` · `exception` | **what a gate should do**, once enforcement and any exception are applied |

Collapsing the two makes "clearly over budget" and "a hundred triangles past the boundary"
the same message, and then neither means anything.

**ADVISORY VS BLOCKING.** Triangles and texel density are `advisory` — they are guidelines
and a clear overrun produces an `advisory` with band `over`, which is loud and does not stop
anything. **Texture dimension is `blocking`**, because it is the one the bible names outright:
*"Avoid unnecessary 4K textures."* A 4K map on a 512-target small prop `fail`s; the same map
on a 2K-target hero is `advisory`. That asymmetry is the bible's, kept.

**BEING UNDER A MINIMUM NEVER BLOCKS.** The minima catch a MISCLASSIFIED asset — a
90-triangle object declared a standard prop is probably foliage — not an asset that needs
more triangles. Under-range is capped at `advisory`, on every rule, including the blocking one.

**THE TOLERANCE IS SCALE-FREE.** `ASSET_BUDGET_NEAR` is 25% **of the boundary**, not of the
range width. 25% past 1,500 is 375 triangles; 25% past 30,000 is 7,500. A fraction of the
range width would have made the foliage band 112 and the hero band 5,000 — the same rule
being strictest on the class that matters least.

**TEXEL DENSITY IS BANDED IN OCTAVES**, because a factor of two is one mip level and because
the measurement has real uncertainty in it (below). Within one octave of target is `within`,
two is `near`, beyond is `over`. Banding tighter than the measurement's own error produces
findings that are noise.

Severity rolls up `pass` < `exception` < `unavailable` < `advisory` < `fail`. An unchecked
metric outranks a reviewed decision; an actual finding outranks both.

### What a triangle is, exactly

Stated rather than implied, because every one of these is a real choice, and **one function
(`countNodeTriangles`) is the only place in the build that decides.** `tests/architecture.js`
§4i asserts exactly one file declares it and that no other asset module divides an index or
vertex count by three.

| case | rule |
| --- | --- |
| indexed | `index.count / 3` |
| non-indexed | `attributes.position.count / 3` |
| `Points` / `Line` | **zero.** Reported separately by vertex count |
| geometry `groups` | do **not** multiply — they partition one index buffer between materials |
| `InstancedMesh` | source geometry counted **once**; `instances` reported separately. A budget is about the mesh an artist authored |
| shared geometry | counted **once per mesh**, because it is drawn once per mesh. `uniqueGeometries` reports the upload cost |
| `visible === false` | excluded, subtree and all, and attributed under `hidden` |
| `userData.collisionOnly` | excluded and attributed. **Dead today** — this project declares collision as boxes and has no collision meshes — and present so the first DCC that exports one does not silently inflate a landmark's budget |

`normalizeAssetMaterials` now takes its `triangles` and `meshes` from this function.
It previously counted inline, in the loop that normalises materials — a loop that
deliberately includes `Points` and `Line` nodes because they have materials — so a points
cloud's **vertex** count was being divided by three and added to a triangle total. Its
normalising traversal is unchanged and still visits hidden nodes (it must; a hidden node may
be shown later); `report.normalized` records how many it touched.

### Textures, materials and what duplication looks like

| number | meaning |
| --- | --- |
| `materialSlots` | every material reference across every visible mesh |
| `uniqueMaterials` | distinct material **objects** |
| `materialSignatures` | distinct **rendered** materials, via `materialSignature` |
| `duplicateMaterials` | `uniqueMaterials − materialSignatures` — **CLAUDE.md section 72's exporter problem**: forty identical materials are forty shader programs |
| `sharedMaterialUses` | `materialSlots − uniqueMaterials` — reuse already happening |
| `missingTextureData` | a texture reference with no image at all |
| `unknownTextureSize` | an image with no resolvable dimensions. **A different answer** from missing |

`assetTextureSize` reads three spellings (`image`, r152+'s `source.data`, a compressed
texture's explicit width/height) and returns **null** rather than a guess. Null becomes
`unavailable`; an invented 512 would have become a pass.

### Texel density: the formula, and what makes it an estimate

For each sampled triangle of each mesh whose material has a base-colour map:

```
texels  = uvArea x texWidth x texHeight          (UV space is the unit square)
metres² = worldArea                              (positions through matrixWorld)
px/m    = sqrt( Σtexels / ΣworldArea )
```

The square root is because density is per **linear** metre. Each mesh contributes at **its
own** map's dimensions, so a 2K body map and a 512 detail map are weighted correctly rather
than measured against whichever texture happened to be biggest.

**The uncertainty is stated rather than buried.** UV area counts overlap twice, so mirrored
or stacked shells report denser than they are — the largest single source of error and one
with no cheap fix. Only meshes with a `map` are sampled. Above `ASSET_TEXEL_SAMPLE_CAP`
(4,096) triangles per mesh it **strides**, never samples randomly, so two runs give the
identical number. Non-uniform scale is handled (the world matrix is applied before the area
is taken); a texture repeated by `repeat` is not.

It returns a **state**: `measured` with the number and its evidence, `unavailable` with a
reason (no UVs, no map, no dimensions, no area), or `invalid`. **`unavailable` and "outside
guidance" are different answers**, and the validator keeps them different.

### Exceptions

`{ metric, allow, reason }` on the asset row. All three required; a reason shorter than
twelve characters is rejected, because "because" is not a reason and an exception nobody has
to justify is a global switch with extra steps.

- There is **no global bypass**, and `tests/budgets.js` greps for five spellings of one.
- An **invalid** exception excuses nothing and appears in the output with why it was refused.
- An exception for 40,000 does **not** excuse 90,000 — it states what was agreed.
- A metric a valid exception covers reports **`exception`**, never `pass`. A justified hero
  overrun should look intentional in the validation data; an accidental 4K texture should not.
- An exception that turned out **not to be needed** is itself a warning. A stale excuse is a
  finding.

### The registry's `budget` field, and why it is null

`MODEL_ASSETS` reserves `budget` exactly as it reserves `lod` and `compression`.
`assetBudgetSpecOf(key)` returns null for a row without one **and for any `VALIDATION` asset
whatever it declares** — a pipeline probe is not production content, and letting one claim a
class would put a fake entry in the only table that describes the shipped game.

**E2.0a ships zero production assets, so today nothing in this repository has a production
budget, and that is the correct state rather than a gap.** The validator answers
`unavailable` for the one asset present, and `tests/browser-budgets.js` asserts it.

### Runtime instrumentation

`measureSceneResources(scene, renderer)` reports what is resident right now: nodes, meshes,
triangles, vertices, unique geometries, draw groups, instances, hidden totals, materials,
signatures, duplicates, textures and the largest texture dimension — plus, **separately and
labelled**, `renderer.info`'s draw calls, drawn triangles, resident geometries and textures,
and program count.

**Drawn and resident are different numbers and are never conflated.** Measured live: 546,096
triangles resident in the Overworld scene, 190,722 drawn in one frame across 367 draw calls.

**AND `renderer.info.render` DESCRIBES THE LAST RENDER CALL, NOT THE LAST FRAME.** This
build's frame ends with the PostFX full-screen quad, so reading it cold reports **1 draw call
and 2 triangles** — which looks broken and is the correct answer to a differently-phrased
question. `browser-budgets.js` reports both readings and says which is which.

**STREAMING IS RESPECTED BY CONSTRUCTION.** It counts the scene graph as it stands, so a
region removed and disposed is not in it; a region resident but hidden is counted under
`hidden` rather than as live cost. There is no registry of "things that were ever loaded" to
go stale.

**IT MUTATES NOTHING AND IT IS NEVER SCHEDULED.** `measureAssetGeometry` updates world
matrices once when measuring a freshly loaded asset; `measureSceneResources` explicitly does
not, because the renderer already has. There is no call site in the build, and
`browser-budgets.js` proves it about the running game rather than the source: the functions
are wrapped, three seconds of real gameplay are played with three.js's own frame counter
advancing, and both are called **zero** times.

`compareResourceMeasurements(baseline, current)` gives a future phase the ability to say
"this added 16,442 triangles" instead of "this feels heavier". It **asserts nothing and sets
no threshold** — CLAUDE.md section 79 forbids claiming a performance budget from one machine,
and neither module contains the string `fps`.

### A budget that was declared and never enforced

`ASSET_BUDGET` in `tests/architecture.js` §4b has carried a per-file `THREE` ceiling for the
asset layer since E2.0a. The per-unit loop dutifully **counted** against it — and the roll-up
that checks ceilings compared only `APP_BUDGET` and `RENDER_BUDGET`. `FORBIDDEN.assets` does
not list `THREE` either. **Nothing, anywhere, ever compared those three numbers to anything.**

Found while adding two modules to that layer and reasoning that the ceiling would catch a
`THREE` reference in them. It would not have. The written numbers (4 / 4 / 1) were an estimate
of construction sites; the AST probe counts every `THREE` node including the `typeof THREE`
guard each lazy accessor opens with, so they were wrong from the day they were typed.

The ceilings are now **8 / 5 / 1**, enforced, and that is a ceiling being **set** rather than
raised: the same files measure 8 and 5 at the commit before this phase, and Phase 3 added no
`THREE` reference to any of them. From here the usual rule applies — **a ceiling may fall, it
may never rise.** The two new modules are in the table at **0**.

### Validation, and the one drifty suite is A/B'd rather than explained away

All **34 offline suites green, 0 failures**, including the new `budgets.js` at 216 checks.
**13 of 14 browser suites green**, one at a time over HTTP, including `browser-budgets.js`
at 38 and `browser-playability.js` at 71 — the latter crossing both rifts through the real
interaction path.

`browser-transitions.js` is the exception, and it is the `riftArming` defect section 4.6
recorded: it reaches **14 PASS / 0 FAIL** and then exceeds a hard 30-second wait for the
Farmlands crossing. The arming delay is decremented by the `dt` clamped to 0.06 for physics
safety, so its real duration is `RIFT_ARM_TIME / min(realDt, 0.06)` and scales with frame
rate. Nothing in this phase touched it.

**The first A/B said the opposite, and that is why there was a second.** One run of each had
this build failing and the pre-phase build passing — which is the shape of a regression.
Alternating three runs of each on the same container instead:

| | run 1 | run 2 | run 3 |
| --- | --- | --- | --- |
| this build | 14 | **51 PASS** | 14 |
| `948e527` | **51 PASS** | 14 | 14 |

**One pass in three, each.** Identical distribution, opposite order — the suite is a coin
toss on this container and a single A/B was not enough to say anything. Same lesson section
4.8 recorded for `performance.js`, sprung in a new place: **one sample of a drifty
measurement is not an A/B.** `browser-opening.js` also exited non-zero inside the sweep and
passes completely when run alone.

### What Phase 3 deliberately did NOT implement

No production asset, no D1 landmark, no vegetation, no architecture kit, no lighting, no
flashlight, no creature, no material system, no texture compression, no LOD selection or
generation (schema and a consistency check only), no asset browser, no renderer change, no
three.js upgrade, no Blender dependency and no Astra work. No gameplay, save-schema or
world-generation change. **The save schema is still version 5.**

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
