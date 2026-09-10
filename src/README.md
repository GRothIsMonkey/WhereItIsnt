# `src/` — THE EXTRACTED BUILD

Era 1.5 is moving `game.html`'s inline `<script>` into this directory, one layer at a time.

**The split has not happened yet.** As of Era 1.5.1 four blocks have moved and everything
else is still in `game.html`. `ARCHITECTURE.md` is the map; each layer's `LAYER.md` is its
work order, listing by current line range exactly what arrives and in which phase.

## The three rules

**1 · These are CLASSIC scripts.** No `import`, no `export`, no `type="module"`, no bundler.
Classic scripts share one global lexical scope, so a `const`, `class` or `function` declared
in one file is visible to every file loaded after it and to `game.html`'s inline `<script>`.
That is the entire reason the extraction needs no code change — a file move is a file move.
The property was measured in Node's `vm` and in a real Chromium before anything was moved,
and `tests/architecture.js` re-proves it on every run.

**2 · ORDER IS THE CONTRACT.** `game.html` declares the load order and nothing else may. A
module may use a name declared in a later module only from inside a function body, never at
load time. `tests/architecture.js` checks that every declared module exists and that the
order in `game.html` matches the order the harness replays.

**3 · A MOVE IS VERBATIM.** The payload of an extracted file is byte-identical to the text
removed from `game.html`, plus a header and the `"use strict";` that an external classic
script does not get for free. Tidying while moving makes a behaviour change
indistinguishable from a relocation. Improve it afterwards, in its own commit, where a test
can see it.

## Layout

```
src/
  shared/       pure values and pure functions — may depend on NOTHING
  core/         lifecycle, clock, config, input routing
  gameplay/     player, inventory, crafting, mining, combat, items
  world/        voxels, chunks, streaming, edits, water, light — the ENGINE
  dimensions/   one descriptor per dimension, and the transition engine
  progression/  objectives, milestones, Core Disks, Anchors
  horror/       observation, anomalies, Stalker, Behemoth, perception
  audio/        SoundEngine · AudioLibrary · AudioDirector  (already clean)
  rendering/    scene, camera, lighting, materials, post-processing, meshes
  ui/           menu, HUD, settings, prompts, cinematic presentation
  persistence/  save, load, migration, validation, repair
```

## Adding a module

1. Decide the layer from its `LAYER.md`, not from where the code currently sits.
2. Move the text **verbatim**. Add the header and `"use strict";`.
3. Add `<script src="src/<layer>/<name>.js"></script>` to `game.html` in the right position —
   after everything it needs at load time, before anything that needs it at load time.
4. Nothing else. The harness discovers modules from `game.html`; there is no manifest to
   update, no test to register, and no import to write.
5. Run `node tests/architecture.js`, then the four comparison suites
   (`regression`, `journey`, `chain`, `performance`) against the pre-move build. World
   generation must come back **bit-identical**.
