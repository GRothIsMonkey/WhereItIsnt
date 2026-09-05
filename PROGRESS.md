# WHERE IT ISN'T — PROJECT STATE

```
Current phase              28 — REMOVE TUTORIAL / ORGANIC ONBOARDING (complete)
Next phase                 29 — MAIN MENU REBIRTH
Phase 19                   COMPLETE
Phase 20                   COMPLETE
Phase 20 journey revision  COMPLETE           (20.1 — see section 0)
Phase 20.2 guidance        COMPLETE           (see section 0.5)
Phase 21                   COMPLETE           (see section 0.2)
Phase 22                   COMPLETE           (see section 0.1)
Phase 23                   COMPLETE           (see section 0.0)
Phase 24                   COMPLETE           (the canon lives in STORY.md)
Phase 25                   COMPLETE           (see section 0.000)
Phase 26                   COMPLETE           (see section 0.0000)
Phase 27                   COMPLETE           (see section 0.00000)
Phase 28                   COMPLETE           (see section 0.000000)
XP                         REMOVED            (no runtime XP exists; see section 0.0000)
Hearts / vital bars        REMOVED            (no runtime HUD bar exists; see section 0.00000)
Tutorial                   REMOVED            (no tutorial exists; see section 0.000000)
Save schema                VERSION 4          (3 -> 4 adds progression.onboarding)
Authoritative build        game.html          (there is no other game file)
Canonical story            STORY.md           (read before writing ANY player text)
Validation suite           tests/             (see tests/README.md)
```

Phases 1–19 are as their sections in `ROADMAP.md` describe them. This file records the
state of Phase 20 specifically: what was built, what was measured, what was found and
fixed along the way, and what is honestly not verified.

**Sections 0.000000–0.5 describe the phases that followed (28, 27, 26, 25, 23, 22, 21, 20.2). Sections 1–5
describe Phase 20 as it was first delivered, and Section 0 describes the 20.1 journey
revision that followed a human playtest and supersedes them wherever they disagree** — principally the beat table, the landmark set, the distances, and the
performance figures. **Section 0.5 describes Phase 20.2**, which added the opening
instruction and the compass and changed no world generation at all.

---

## 0.000000. PHASE 28 — REMOVE TUTORIAL / ORGANIC ONBOARDING

**The tutorial is gone.** Not disabled, not skipped by default, not hidden behind a flag:
the six-page card, its stylesheet, its markup, its page table, its controller and its
z-index layer are deleted, and BEGIN EXPEDITION now goes straight to the game. What
teaches the player instead is the objective line that was already on screen, the
interaction prompt that was already above the hotbar, and the world.

### WHAT THE TUTORIAL WAS, AND WHERE EACH FACT WENT

`TUTORIAL_PAGES` was six authored cards and twenty-one instructional sentences, shown
before the player had seen a single frame of the world. Every fact it stated is still in
the game. None of them is a sentence any more.

| the card | what it explained | what says it now |
|---|---|---|
| Welcome, Wanderer | "a survival horror expedition: gather by day, defend by night"; Stages get harder; "this quick walkthrough covers everything" | nothing. It was a description of the game, delivered to somebody who had not played it |
| Move & Look | WASD, mouse, SPACE, SHIFT | the start screen's control legend — no crosshair target exists for a cue to attach to |
| Mine & Gather | the white outline, hold Left Click, the crack animation, the progress bar, drops falling to the ground, Right Click places, 1-9 and scroll | the outline, the cracks and the bar are all visible; the drop lands at your feet; the cue **LMB · CHOP / MINE / BREAK** names the button once; **RMB · PLACE** names the other; the slot keys stay on the legend |
| Tools Change Everything | fists work on wood; stone needs a pickaxe; the outline turns red and reads NEEDS A PICKAXE; better tools bite faster | **the game already did all of this on screen.** The highlight really does turn red and the readout really does say NEEDS A PICKAXE. The card was narrating a thing the player was about to be shown |
| Craft & Carry | E opens the bench; Log → Planks → Sticks → Pickaxe; I / Tab for the backpack; Q drops | the cue **E · CRAFT**, raised the moment the player is holding a log. The recipe order is the bench's own list, with its own materials and results. I stays on the legend; Q is not essential to a first night |
| Survive the Night | fell trees, craft torches, place an Anchor, feed it, stay in the glow, Ancient Chests are worth a detour | the objective chain — *Craft torches.* → *Prepare for night.* → *Endure the nights.* — and the Anchor's own permanent affordance, **RMB · FEED THE ANCHOR**, which Phase 27 gave it |

### THE ONBOARDING FLOW, EXACTLY AS IT NOW RUNS

```
START SCREEN            title, CONTINUE (if a save validates), BEGIN EXPEDITION,
                        a two-line control legend, SETTINGS
   |  click BEGIN EXPEDITION
OPENING INSTRUCTION     black, ~9s, "At the crossroads, go east." / "Go east."
                        (Phase 20.2's, unchanged, skippable by any key or click)
   |
FIRST GAMEPLAY FRAME    the objective is already resolved and painted — see _beginPlay
                        HUD: CONDITION, PERCEPTION, the objective line, the hotbar
   |
"Gather wood."          player looks at a tree     -> LMB · CHOP
   |                    ...fells it                -> the cue is answered, forever
"Craft a basic tool."   player is holding a log    -> E · CRAFT
   |                    ...presses E               -> the bench, listing its own recipes
"Find coal."            the pickaxe gate teaches itself: red highlight, NEEDS A PICKAXE
"Craft torches."        the bench again; no cue, because E has already been learned
"Prepare for night."    the Anchor is crafted, then placed  -> RMB · PLACE (first time only)
   |                    looking at it              -> RMB · FEED THE ANCHOR (permanent)
"Endure the nights."    night, the dark, and the Anchor's glow explain themselves
"Enter the Rift."       a powered Anchor is unmistakable; walking into it is the interaction
```

The player may do any of this in any order. The objective chain credits the furthest step
whose completion test passes, which is Phase 25's behaviour and is untouched here.

### THE THREE CONTEXTUAL CUES, AND WHY THERE ARE ONLY THREE

The test applied to every candidate was: **can a player who has been told "Gather wood."
find this on their own, from the world, in under a minute?** Almost everything passes.
Three things fail, and all three fail for the same reason — a key with no visible surface
to click on.

| cue | key | verb | appears when | retired by |
|---|---|---|---|---|
| `break` | LMB | CHOP / MINE / BREAK | any solid block under the crosshair | breaking one block |
| `craft` | E | CRAFT | holding a log or planks | pressing E once, ever |
| `place` | RMB | PLACE | holding a placeable block, ground ahead | placing one block |

The verb of the first is chosen from the block: `CHOP` for the wood family, `MINE` for
anything the pickaxe gate covers, `BREAK` otherwise — so the first word the player reads is
about the world, not about the input device.

**They are drawn in the Phase 27 interaction prompt** — the same element, the same
renderer, the same two-word grammar, the same 140ms fade. There is no second prompt
system, no popup, no timer and no dismiss button. A cue is the **last** fallback in the
look-target path:

```js
this._setPrompt(this._promptForBlock(id) || this._havenPropPrompt() || this._onboardingCue(id));
```

so a door, the Anchor, an Ancient Chest or a Haven prop always takes the line first. The
world wins; the cue only ever fills space nothing else wanted. `UIManager` cannot tell the
difference between the two and never hears the word "onboarding" — it is still a renderer.

### WHAT IS *NOT* IN THIS PHASE

- No control screen, no keyboard reference, no "how to play", no hint popups, no tooltips,
  no arrows, no highlighting, no glowing objects, no quest log, no minimap, no waypoints.
- No new prompt system, no second onboarding layer, no tutorial-shaped state machine.
- No change to crafting, mining, resources, night, the Anchor, the Rift, the compass or
  the HUD. The objective tables are byte-identical apart from one comment.
- No wall of text anywhere: `tests/onboarding.js` fails if any string literal longer than
  140 characters appears in the build.

### THE START SCREEN'S CONTROL LEGEND

The legend was three lines and read as a keyboard reference:

```
WASD MOVE • MOUSE LOOK • SPACE JUMP/SWIM • SHIFT SPRINT
LEFT CLICK BREAK / ATTACK • RIGHT CLICK PLACE / FEED ANCHOR / SHOOT BOW • 1-9 / SCROLL SELECT SLOT
E CRAFTING • I INVENTORY • Q DROP ITEM
```

Every verb on the second and third lines is now taught in the world, at the moment it is
useful. Saying it twice would be exactly the duplicate onboarding the brief forbids, so
those lines were cut down to what no contextual prompt can reach — nothing on them has a
target under the crosshair:

```
WASD MOVE • MOUSE LOOK • SPACE JUMP/SWIM • SHIFT SPRINT
1-9 / SCROLL SELECT SLOT • I INVENTORY • O SETTINGS
```

`O SETTINGS` is the one addition. With the tutorial gone nothing else named the key that
opens the panel the game is saved from, and Escape alone is unreliable while the pointer
is locked (Phase 22 documented why).

**Phase 29 owns the main menu.** Nothing else about the start screen was touched: no art,
no layout, no copy, no button order.

### THE OPENING INSTRUCTION STAYED

Phase 20.2's *"At the crossroads, go east." / "Go east."* is **not tutorial content** and
was audited rather than assumed. It names a bearing and nothing else; it explains no
mechanic, no key and no system; the objective system never repeats it; and Phase 30 will
absorb it as the closing beat of the opening film. It already lived in `_start()` — the
funnel every route into gameplay passes through — specifically so that a player who
skipped the tutorial would still hear it. Removing the tutorial made that funnel narrower,
not different: `_start()` is now the **only** route in.

### SAVE / LOAD — SCHEMA 4, AND THE ONE THING IT COULD HAVE GOT WRONG

`progression.onboarding` is a list of the cues a run has answered. A new game has none.
Validated against the authored table exactly the way `milestones` is: an unknown id is
dropped, a duplicate collapses, the order is the table's, a field of the wrong type is
repaired to "none" rather than thrown over.

**A schema-3 save is not a new game.** It was written by somebody who reached the start
screen while the tutorial was still in front of it, and who has been playing long enough to
have a save. Defaulting them to "has learned nothing" would greet a returning player with
`LMB · CHOP` over the first tree they looked at — the exact patronising beat this phase
exists to delete. So the **3 → 4 migration marks every cue answered**, by the same
reasoning Phase 26's 2 → 3 migration used to derive milestones: work out what the old save
has already lived rather than letting a new field default to a lie.

Nothing else in the schema moved. Every version-3 field is carried across untouched, a
version-3 file remains fully loadable, and a version-1 file still climbs the whole ladder.
Verified against a **real stored file in a real browser**: `browser-onboarding.js` rewrites
`localStorage` to schema 3, reloads the page, clicks CONTINUE and asserts the run comes
back fully onboarded with no cue over a tree.

### WHAT WAS ACTUALLY DELETED

| layer | what went |
|---|---|
| markup | `#tutorialScreen` and its nine children; `#skipTutorialLink`; two lines of the control legend |
| stylesheet | `#tutorialScreen`, `#tutorialScreen.active` and ten `.tutorial-*` rule groups — 43 declarations, and the z-index 55 layer with them |
| script | `TUTORIAL_PAGES` (6 cards, 21 sentences), `class TutorialController` (75 lines), `Game._openTutorial()`, `this.tutorial = new TutorialController(...)`, the `#skipTutorialLink` listener, and two `tutorialScreen.classList.remove('active')` calls in `_start()` and `continueFromSave()` |
| tests | `tests/settings.js` no longer requires the skip link or the 55 layer; `tests/compass.js` asserts one route in instead of two; `tests/preview-settings.js` slices to `#winScreen`; the two browser files click `#clickPlay` |

Every remaining occurrence of the word "tutorial" in `game.html` is a **comment**
recording what stood where — five of them — plus this phase's own reasoning. There is no
executable reference and no element left to reach for. `tests/onboarding.js` asserts that
against the stripped source and the stripped body, not against a grep.

### WHAT WAS ADDED

| | |
|---|---|
| `ONBOARDING_CUES` / `ONBOARDING_CUE_IDS` | the frozen three-entry table, beside the objective system |
| `PlayerController._onboardingCue(targetId)` | resolves a cue, returns the same `{key, verb}` shape as `_promptForBlock` |
| `PlayerController._learn(id)` | the latch, called from three places |
| `Game.onboarding` / `Game.learnOnboarding(id)` | the Set, and its only writer outside a restore |
| `_svOnboarding` + `SAVE_MIGRATIONS[3]` | validation and the 3 → 4 migration |
| `tests/onboarding.js` | 116 offline checks |
| `tests/browser-onboarding.js` | 48 checks in a real Chromium |

### COST

Measured in the browser, under SwiftShader, over 4,000 calls each way:

| state | per resolve | share of a 60fps frame |
|---|---|---|
| all three cues answered (every run, after the first few minutes) | **0.08 µs** | 0.0004% |
| all three still owed (the worst case, and only at the very start) | **0.22 µs** | 0.0013% |

The first line of `_onboardingCue` is a `size >= 3` comparison against a frozen table, so a
fully-onboarded save pays that and nothing else — no ray, no world scan, no DOM, no
allocation. Removing the tutorial also removed a controller, six page objects, thirty DOM
writes at open time and forty-three CSS declarations from the document.

`tests/performance.js` and `tests/regression.js` both pass unchanged: this phase generates
no world and touches no generator, and Suburbia, the Overworld and the whole journey are
byte-identical.

### DEFECTS FOUND AND FIXED DURING THE PHASE

1. **`preview-settings.js` sliced the settings panel using `#tutorialScreen` as its end
   marker.** Deleting the element made the slice run to the end of the body. Re-pointed at
   `#winScreen`, with the intervening comment stripped.
2. **`tests/settings.js` required the skip link to exist** and required the settings panel
   to out-rank a z-index 55 layer that no longer exists. Both were correct assertions about
   Phase 22's world and are wrong about this one; updated, not deleted — the property they
   protect (the panel can never open behind an opaque screen) is still asserted against
   every screen that remains.
3. **The `RMB · PLACE` cue was initially unreachable in the browser test** at two blocks'
   range: placement goes on the face the ray entered, which for a target that close is
   inside the player's own bounding box, so `world.placeBlock` correctly refused. A test
   defect, not a game defect — the aiming helper now takes a distance.
4. **`tests/browser-save.js` asserted the schema was written at version 3.** Correct for
   Phase 23–27, wrong from this phase on; updated to 4, and it now also asserts the
   onboarding set is in the file, which is what stops a load re-teaching the keys.
5. **`tests/browser-save.js`'s live prompt check waited for the prompt to be shown AT
   ALL.** That was a sound proxy while the prompt was raised by affordances only: on a
   frame where the ray was off the chest, nothing was shown and the poll waited for the
   next frame. With the cues in, a brand new game owes `break`, which reads `LMB · BREAK`
   over ordinary ground — so the poll could return on a frame the ray had missed the chest
   on, and the check failed reading "LMB BREAK" while the chest prompt was working
   perfectly. **Confirmed as a test defect, not a game defect**: `browser-onboarding.js`
   drives the same path deliberately and gets `RMB · OPEN` from a chest every time. The
   predicate now waits for the chest's own text, which is what the check always claimed.

### KNOWN LIMITATION — `preview-hud.js` does not run in this container

`tests/preview-hud.js` (the Phase 27 screenshot generator) fails on its first full-page
`page.screenshot`, timing out after 30s under SwiftShader. **This is not caused by this
phase**: the identical failure was reproduced on the unmodified Phase 27 build at commit
`e027719`, at the same call, in the same container. It asserts nothing and gates nothing —
it exists to produce PNGs for a person to look at — so no claim in this report depends on
it. The two files that DO assert in a browser, `browser-save.js` and
`browser-onboarding.js`, both run to completion here and both pass.

### HONEST STATUS

| | |
|---|---|
| the tutorial is removed | **COMPLETE** — markup, CSS, script, state and tests |
| organic onboarding | **COMPLETE** — objective chain primary, three contextual cues |
| save / load compatibility | **COMPLETE** — schema 4, real 3 → 4 migration, old saves load |
| offline validation | **COMPLETE** — 116 checks in `tests/onboarding.js`, all pass |
| full regression suite | **COMPLETE** — 17 offline suites, 935 checks, 0 failures, **0 skipped** (the optional Phase 20 corridor baseline was supplied so `performance.js` skips nothing either) |
| browser validation | **COMPLETE** — `browser-onboarding.js`, 48 checks in a real Chromium with a real WebGL context and real `localStorage`, all pass; `browser-save.js` re-run and passing at 102 checks |
| **human playtest** | **NOT DONE.** No person has played this build. Nobody has answered "did I know what to do?", "did I learn without being lectured?" or "was anything frustratingly unclear?" — the eight questions the brief asks are all questions for a person, and this report claims none of them |

The single most valuable thing that could happen to this phase now is somebody who has
never played it starting a new game and trying to reach a torch before dark.

---

## 0.00000. PHASE 27 — HEALTH / SANITY / HUD REBIRTH

**The HUD is not a survival game's HUD any more.** The heart, the brain, both vital bars,
the bordered MISSION DIRECTIVES panel and the nine separated gold-bordered hotbar boxes
are gone from the document. Nothing about the game underneath them changed.

### WHAT THE HUD WAS, AND WHAT EACH PIECE IS NOW

| the element | what it was | what it is |
|---|---|---|
| health | `❤` + a 180×12 red-gradient bar with a percentage width, top-left | **CONDITION** — a row of ticks, ten health each, bottom-left. Discrete, DOM, warm, still |
| sanity | `🧠` + a 180×14 red→amber→green gradient bar, top-left, with the brain pulsing under 30 | **PERCEPTION** — a signal traced on a 176×18 canvas under CONDITION. Continuous, canvas, cool, alive |
| objective | one italic line inside a bordered box titled STATUS, above six hidden `.obj-step` directives | one line of text against a hairline, top-left. No box, no title, and the six directives are **deleted**, not hidden |
| status | `Anchor Status: Unplaced \| Fuel: 0s` / `Memory Fragments: 0 / 3` / `Stage 1 • Day 1`, three stacked sentences | one dim line: `ANCHOR 42S · FRAGMENTS 1/3 · STAGE 2`, each part silent when it has nothing to say |
| hotbar | nine 48px boxes, 2px brass borders, 6px gaps, selection a gold border with an 8px glow | one continuous 9×40px strip divided by hairlines. Selection is a lit cell, a 2px brass under-rule and a 14% larger item |
| held item | never named | names itself for 1.5s when the selection changes, then fades |
| interaction | `showToast('Right-click to open', 1100)` at the top of the screen, doors only | a key chip and a verb above the hotbar — doors, the Anchor, Ancient Chests, and the Haven's bed and storage props |
| dimension label | `☠ THE SHATTERED FARMLANDS ☠` in a red-bordered plaque | the same name, letterspaced, under the compass, no plaque, no skulls |
| clock | a bordered plaque, top-right | the same reading in the HUD's own type, no plaque |
| mining readout | a 148×10 bordered bar with a glowing yellow fill | a 118×3 brass rule with the same six crack-stage ticks |
| toast | 16px glowing orange | 12px parchment, letterspaced, fading |
| compass | **unchanged instrument** | **unchanged instrument**, in a 1px frame instead of a 2px one |
| `#loseCrosshairMsg` | a permanently visible line reading "Look at it and hold your torch to banish it." | **deleted — see DEFECTS below** |

### WHY HEALTH AND PERCEPTION LOOK NOTHING ALIKE

The brief's hardest requirement is that sanity must not read as a second health bar, and
the easy failure is a red bar and a purple bar. The two readings are therefore separated
on **four axes at once**, so they cannot converge by accident:

| | CONDITION | PERCEPTION |
|---|---|---|
| geometry | discrete — ticks you can count | continuous — a line you read the shape of |
| medium | DOM elements | a canvas, drawn like the compass |
| colour | a warm ramp, parchment → rust as the body fails | cool ash, and it never changes hue |
| motion | still except when hurt or healed | alive whenever the mind is not steady |
| state names | `hp-steady` … `hp-gone` | `p-calm` … `p-lost` |

`tests/hud.js` fails if a single stylesheet rule reaches both of them, if the two state
vocabularies overlap, or if perception ever becomes a percentage-width fill.

**Ten health per tick** is the one decision worth defending. Phase 26 replaced the stat
curve with three one-shot endurance milestones that grant max health (100 → 120 → 145 →
170). A bar rescales, so those grants were invisible: the bar was full before and full
after. A ladder of fixed ticks gets longer — ten ticks at the start, seventeen for a
player who has stood at an Anchor, survived a night and felled the Behemoth. The
instrument is as long as the body is durable, and the thresholds are proportions, so
20/170 reads CRITICAL exactly as 12/100 does.

### WHAT PERCEPTION ACTUALLY DRAWS

A faint rule, and a signal traced against it — the rule stays visible where the signal is
not. As the value falls the trace gains amplitude, then starts **dropping segments**, and
below the last threshold short fragments of it appear displaced above and below the line:
pieces of the reading turning up where the reading isn't. There is no number, no
percentage, no hue and no word like "integrity" or "stability" anywhere near it.

It is deterministic — the same value at the same clock draws the same picture, from a
cheap integer hash rather than `Math.random` — so a screenshot is reproducible and the
same state never reads two different ways.

Measured, not asserted: the line travels **0.83px** at full perception, **3.47px** at 55,
and **13.07px** at 6, with **1** break when calm and **27** when lost. Those figures come
out of a recording canvas context in `tests/hud.js`, not out of a description.

### THE HUD OWNS NOTHING

`UIManager.view` is a presentation cache and says so in the source. Every field is a copy
of what was last **painted**, kept for one purpose: so a setter called from the frame loop
can compare and return without touching the DOM. Health lives on the player, sanity on
`SanitySystem`, the objective on the objective system, the selected slot on the player.
There is no `hudHp`, no `hudSanity`, no `hudObjective`.

`tests/hud.js` asserts, against brace-matched method bodies rather than a text window:

- no HUD render path writes health, sanity, death, the selected slot or the inventory;
- `UIManager` reads no objective table and knows no objective rule;
- and — the Era 2 requirement — no block id, chunk, mesh or geometry is reachable from
  `UIManager` at all. The HUD is semantic, so the non-voxel rebirth can reskin it without
  touching gameplay.

### COST

Health is event-driven and perception is capped. On a **steady frame** — health unmoved,
sanity unmoved, inventory unmoved, which is the overwhelming majority of frames — the
whole HUD performs **zero DOM writes, zero icon redraws and zero canvas strokes**, and
costs **4.3 µs**, or 0.026% of a 60fps frame. Counted, not estimated: the offline harness
records every write.

The build it replaces performed, over the same 600 steady frames, **1,200 style writes**
(one per `setSanity`, one per `updateVitals`) and **600 icon redraws** (nine `drawImage`
calls every frame to redraw the identical hotbar). The difference is the "has this
actually changed" guard, not cheaper drawing — what the new HUD draws is strictly more
than what it replaced.

A **forced** perception repaint costs 33 µs, and the cap allows at most fourteen a second,
so the trace's entire budget is **0.47 ms per second** at the worst sanity value in the
game. Above 85 sanity it draws once and stops.

### DEFECTS FOUND AND FIXED

1. **`#loseCrosshairMsg` had been on the screen for several phases.** A `position: fixed`
   line 80px above the bottom of the viewport reading *"Look at it and hold your torch to
   banish it."* — no rule ever hid it, no code ever wrote to it, and the mechanic it
   describes does not exist in this build (`banish` appears nowhere else in the file). It
   was visible over gameplay in every dimension. Removed.

2. **The new interaction prompt could stick to the screen.** `PlayerController.update`
   returns before the look-target work when the player is not pointer-locked, has a menu
   open, or is dead — so a prompt raised while looking at a door stayed up for as long as
   that lasted, offering an interaction the player could not perform. Found by the browser
   run, which could not make the prompt go away again; fixed by clearing it at that gate
   as well as at every exit of `_updateTargetHighlight` (all four of which are asserted).

Two smaller things were corrected in passing: `updateHotbarSelection` no longer rebuilds
the crafting and backpack grids on every frame they happen to be open (only when the
inventory actually changed), and the browser suite's Anchor-milestone wait, which raced
about half the time on a cold SwiftShader boot, was given a real timeout instead of five
seconds.

### VALIDATION

| what | result |
|---|---|
| `tests/hud.js` (new, 15 sections) | **PASS** — the real `UIManager` driven against a recording DOM |
| `tests/browser-save.js` (extended) | **PASS** — including 13 new live-document HUD checks |
| `determinism.js` `core-disk.js` `journey.js` `chain.js` `compass.js` `items.js` `settings.js` `save.js` `story.js` `objectives.js` `progression.js` `red-light.js` `runtime.js` `regression.js` | **PASS** |
| `performance.js` | **1 pre-existing failure — see below** |

The offline harness was upgraded to make this testable: `tests/harness/load.js` now gives
stub elements a **real `classList`** backed by a Set (kept in sync with `className` both
ways), a `style` object that remembers custom properties, and an `innerHTML` setter that
genuinely empties an element. Nothing in `game.html` reads `classList`, so this cannot
change what the game does — it only makes what the game wrote observable, which is the
difference between a HUD test that proves something and one that asserts against a no-op.

**In a real browser** (Chromium, SwiftShader, hermetic three.js): the condition ticks are
laid out and non-zero inside the viewport; the perception canvas has real pixels drawn
into it and visibly breaks across more rows at low sanity; the two readings are aligned
with each other and clear of the hotbar and the objective; no heart, brain or vital bar is
in the live document; 8 health puts the live readout into its critical state on one
part-lit tick; the hotbar computes as one continuous strip with a 2px brass rule under
exactly one cell; **the frame loop raises the interaction prompt for a chest placed under
the crosshair and drops it again when the chest is removed**; every HUD layer computes
below the settings panel and a hit test at the top of the open panel belongs to the panel;
no two HUD clusters overlap and all are inside the viewport; and after a reload the
condition readout, the hotbar mark and both vital states match the restored body with
exactly one of every HUD element in the document.

One measurement had to be taken differently in the browser than intended: under
SwiftShader the *animated* opacity of the interaction prompt read back on the main thread
lagged the class by seconds, at random, which made "did it become visible" unanswerable
from a poll. The browser run therefore suppresses the 140ms transition and measures the
end state; that the fade exists at all is asserted in the offline stylesheet audit. This
is a measurement compromise and is recorded as one.

### THE PERFORMANCE FAILURE, HONESTLY

`performance.js` reports **`the revised journey costs +12.8% per chunk against the Phase 20
build`**, against a 12% gate. It is not this phase's.

This phase changed no world generation, and `regression.js` proves the chunks are
byte-identical. The gate was checked against the **Phase 26 build** (`c05efbe`, the
accepted `origin/main`) on the same machine, in the same conditions: it reads **+11.4%,
+15.2%, +12.8%** — median 12.8%, the same median this build reads (**+12.8%, +14.8%,
+8.8%**). The gate straddles its threshold on this hardware for the build that was already
accepted.

It was **not** loosened to make this phase green. It is a pre-existing, environment-
dependent failure and it is left failing and recorded here.

### WHAT WAS NOT VALIDATED

**No human played this build.** Nothing here is a claim that the HUD looks good, that the
perception trace is unsettling rather than merely busy, that ten ticks read faster than a
bar in the middle of a fight, or that the interface says "indie horror game" rather than
"survival game with a different palette". Those are judgements for a person, and the
automated suite can only prove presence, state, transitions, layout and cost. The offline
suite and the browser suite both say so in their own output.

### WHERE IT IS IN `game.html`

| what | where |
|---|---|
| HUD tokens (`:root`) | top of the stylesheet, immediately after `#gameCanvas` |
| vitals, objective, hotbar, prompt styling | the PHASE 27 blocks through the stylesheet |
| small-viewport rules | one media query at the end of the compass block |
| HUD markup | the single `<div id="hud">`, mounted once |
| `HUD_HP_PER_TICK`, `HUD_TRACE_*`, `hudNoise` | immediately above `class UIManager` |
| the view cache | `UIManager` constructor, under the PHASE 27 banner |
| condition | `updateVitals` / `_buildConditionTicks` / `_paintCondition` |
| perception | `setSanity` / `_drawPerception` |
| prompt | `UIManager.setInteractPrompt`, driven from `PlayerController._promptForBlock` and `_havenPropPrompt` |
| clearing between runs | `UIManager.resetPresentation`, called only from `Game._teardownForRestore` |

---

## 0.0000. PHASE 26 — REMOVE XP / REBUILD PROGRESSION

**XP is gone.** Not hidden, not renamed, not moved behind a flag: there is no XP counter,
no level, no threshold, no bar and no function anywhere in the build that a kill, a broken
block or an opened chest can call to increase a progression number.

### WHAT XP WAS, AND EVERYTHING THAT DEPENDED ON IT

The system was six pieces and seven dependants. Every one is listed here because "we
removed XP" is only checkable against a list of what XP actually was.

| the system | what it was | now |
|---|---|---|
| `LEVEL_XP_BASE` / `LEVEL_XP_GROWTH` / `xpForLevel()` | the curve: 30 × 1.35^(n-1) | **deleted** |
| `XP_REWARDS` | per-block payout table (log 2, iron ore 5, obsidian 7…) | **deleted** |
| `CHEST_XP_REWARD` | 12 per Ancient Chest | **deleted** |
| `player.xp` / `player.level` | the counter and the level it fed | **deleted** |
| `PlayerController.addXP()` | the only grant path: +15 max HP, +1 attack, +18% mining per level | **deleted, and nothing replaced it as a function** |
| `MOB_STATS[*].xp` / `Mob.xpReward` | 14 / 12 / 250 per mob type, scaled by difficulty | **deleted** |

| what depended on it | how | what it depends on now |
|---|---|---|
| **combat** | melee and arrow kills paid `mob.xpReward` | nothing. A kill pays its loot table. Damage progression is the **weapon** (wood 4 → stone 7 → iron 10) |
| **mining** | every broken block paid 1–7 XP; levels bought `miningSpeedBonus` | nothing. Break-speed progression is the **tool** (the existing pickaxe/axe tier tables — an Iron Pickaxe takes stone in 0.60s where bare hands take 8.00s and drop nothing) |
| **chests** | 12 XP on top of the loot | nothing. The loot is the reward, and in the Overworld the first chest still carries the compass |
| **crafting** | twelve recipes carried `levelReq` (1–7); the menu printed "Requires Level 3" | **materials, which are themselves discoveries.** Every one of those numbers stood in front of an ingredient the player either had found or had not — ore is underground, string is off a spider, obsidian is deep, Corrupted Stone comes out of a Rift. Removing the gate handed it back to the world |
| **the HUD** | an XP bar, a `Lv.N` label, a `LEVEL UP — LEVEL n` toast | health is the only bar on that row. The toast element survives, renamed `#hudToast`, carrying Core Disk pickups and milestone notices |
| **the credits** | a `FINAL LEVEL` row | removed. Kills, days, disks, dimensions and chests remain |
| **stat growth** | +15 max HP / +1 attack / +18% mining, every level, forever | three authored milestones, below |

**Story progression, Rift progression, Behemoth progression and the objective system never
depended on XP at all.** That was checked before anything was changed rather than assumed:
the Rift opens because a Core Disk was fed to an Anchor, the Behemoth bridge is its Core
Disk landing in the pack, and not one of the 21 Phase 25 objectives reads a level or a
total. Nothing in any of them was touched.

### WHAT REPLACED IT

Two shapes, and neither is a number the player accumulates.

**ACCESS** — what the player can now *do*, because of something they found or opened. The
compass out of the first Ancient Chest. A recipe, because the ore for it is in the pack. A
dimension, because a Core Disk is in the Anchor. None of these is new; all of them were
already direct, and XP was sitting in front of some of them for no reason.

**ENDURANCE** — `PROGRESSION_MILESTONES`, and it is three rows long:

| id | the event | grant |
|---|---|---|
| `shelter` | the first Safehouse Anchor is standing | +20 max health |
| `firstNight` | the first night survived | +20 max health |
| `behemoth` | the Hollowed Behemoth is down and its Core Disk is in the pack | +30 max health |

A run therefore ends at **170 max health and that is the ceiling** — there is no fourth
milestone, no repeat, and nothing counts toward any of them. Each is latched by id in a
`Set`, the `Set` is what the save carries, and `Game._reachMilestone()` adds the id
*before* it grants anything, so a caller that fires every frame grants once and returns
`false` forever after (tested against 500 repeats, and in a real browser). Each hangs off
an event that already existed: the dawn branch, the Behemoth defeat latch, and the anchor
standing.

**Attack and mining growth were not replaced.** `attackBonus` and `miningSpeedBonus`
survive as fields with **no runtime source at all** — they exist only so a save written
while XP was alive keeps what it paid for. New runs leave both at zero and get their damage
from weapons and their break speed from tools, which is the direct progression the phase
was asked for.

**Why these three and not a longer table.** They are drawn from the phase brief's own
"survival progression" list, they are the three moments the game already treats as
turning points, and none of them can be farmed. A fourth would have started to look like a
curve with different triggers, which is the thing the brief calls "another grind system".

### THE SAVE, AND THE ONE THING THIS COULD HAVE GOT WRONG

Schema **2 → 3**. The migration drops `player.level` (and `player.xp`, which this game
never wrote but a hand-edited file may carry) and leaves `maxHp`, `attackBonus` and
`miningSpeedBonus` completely untouched: **remove the currency, keep the consequences.**

The hard part is `progression.milestones`. A schema 2 save was written by a player who has
already survived nights, may already have felled the Behemoth, and whose `maxHp` **already
includes whatever XP paid them for it**. Defaulting their milestone set to empty would
leave all three armed, so the next dawn would hand them health for a night they survived
weeks ago. So the migration **derives** which milestones that save has already lived, out
of state it already carries — an anchor in the file, `dayCount > 1`, the `behemothDefeated`
latch — and marks them reached **without granting anything**:

| the schema 2 save | derives |
|---|---|
| anchor, day 9, Behemoth defeated | `shelter, firstNight, behemoth` — nothing left to grant |
| anchor, day 9, no Behemoth | `shelter, firstNight` |
| no anchor, day 1, no Behemoth | none — all three genuinely still ahead of them |

This consumes old XP-era data exactly once, at migration, to preserve progression. It does
not keep XP alive: nothing it writes is a currency, and the runtime it hands the save to
has none. The validator rebuilds the list from the authored ids rather than trusting it, so
a file cannot invent a milestone, list one twice, or choose the order.

### WHAT WAS MEASURED, AND WHAT WAS NOT

`tests/progression.js` is new and is described in `tests/README.md`. The claims worth
repeating here:

- an **XP-era schema 2 save** — level 6, 175 max health, +5 attack, +0.9 mining, an Iron
  Pickaxe, a Core Disk, a compass, an anchor, 9 days, in the Farmlands — loads, loses `xp`
  and `level`, and keeps **every** other thing it was: health, bonuses, pack, position,
  dimension, compass, journey ordinal, objective marks, world edits, opened chests;
- replaying all three milestones against that restored player grants **nothing**;
- a version 1 Phase 23 save climbs the whole ladder to 3 with the same result;
- 20 save/load cycles are byte-stable — nothing accumulates;
- crafting, mining, combat, the Rift bridge and the Behemoth bridge all still work.

**In a real browser** (`browser-save.js`, Chromium + SwiftShader, hermetic three.js): the
XP bar and level label are absent from the live document, nothing rendered in the HUD reads
`Lv.` / `XP` / `LEVEL UP`, the live crafting menu shows no level requirement on any recipe,
and **placing an Anchor granted the shelter milestone in the running game** — 41/100 to
61/120 — which then survived a full page reload as *reached*, granting nothing a second
time.

**Not verified.** No human played a run from a new game to the Behemoth to confirm the
three milestones land at the right emotional moments; that is a judgement, not a test, and
nothing here claims otherwise. The `performance.js` journey-revision gate fails at +13.6%,
which is **pre-existing** — the same gate fails at +12.9% on the Phase 25 build this phase
started from, the difference is inside that file's own stated run-to-run noise, and Phase
26 changes no world generation whatsoever.

### PERFORMANCE

Removing XP removed work: `addXP` (and its `while` loop, its `Math.pow` and its two UI
calls) is no longer invoked on every broken block, every kill and every chest. Nothing
per-frame replaced it. The three milestone triggers are two branches inside events that
already ran once each, plus one `Set.has` on a three-element set beside a line that was
already reading `activeAnchor` for the HUD.

### WHERE THINGS ARE

| what | search for |
|---|---|
| the design, and what it replaced | `PHASE 26 — DIRECT PROGRESSION, AND WHAT IT REPLACED` |
| the milestone table | `PROGRESSION_MILESTONES` / `PROGRESSION_MILESTONE_IDS` |
| the single grant path | `Game._reachMilestone` |
| the three triggers | `_reachMilestone('shelter'` / `'firstNight'` / `'behemoth'` |
| the latch set on the Game | `this.milestones` |
| the schema bump and the migration | `SAVE_VERSION` (3) / `SAVE_MIGRATIONS[2]` |
| milestone validation | `_svMilestones` |
| what the recipe gate is now | `PHASE 26 — THERE IS NO LEVEL GATE ON A RECIPE` |
| the surviving legacy fields, and why | `LEGACY EARNED VALUES, NOT PROGRESSION` |
| the renamed toast | `#hudToast` / `showToast` |

---

## 0.000. PHASE 25 — DYNAMIC OBJECTIVE SYSTEM

One line on screen, and it is **derived, not driven**.

### ARCHITECTURE

Three pieces, and the first two are plain data:

| piece | what it is |
|---|---|
| `OBJECTIVE_OVERRIDES` | situational objectives, priority-ordered. Night, an open Rift, the Haven, the climax. **First match wins**, which makes "two contradictory objectives" structurally impossible rather than a thing to remember. |
| `OBJECTIVE_CHAINS` | one ordered list per dimension — `overworld`, `farmlands`, `suburbia`, `haven`. The slow spine. |
| `ObjectiveSystem` | holds one integer per chain, resolves overrides then chain, writes the line only when the text changes. |

`Game._objectiveSnapshot()` gathers everything the tables may look at into one small plain
object: inventory predicates, the Anchor, the clock, the journey ordinal, the chest
ledger, the dimension flags. **It never touches a mesh, a chunk, a coordinate or the
camera** — `tests/objectives.js` asserts that, because Era 2 replaces the renderer and
this phase must survive it.

### THE PROGRESSION

| chain | lines, in order |
|---|---|
| **Overworld** | Gather wood. → Craft a basic tool. → Find coal. → Craft torches. → Prepare for night. → Endure the nights. → Investigate the Rift. |
| **Farmlands** | the eleven Phase 20 journey lines, **unchanged** — Explore the Shattered Farmlands. → Follow the old farm road. → Follow the road east. → Investigate the water tower. → Continue beyond the tower. → Keep to the road. → Something here feels familiar. → Follow the old route. → The fields are dying. → Investigate the property. → Investigate the farmhouse. |
| **Suburbia** | Explore the neighbourhood. → Investigate the houses. → Find what doesn't belong. → Keep going. |
| **Haven** | Rest. — and then nothing at all |
| **Situational** | Enter the Rift. / Bring it to the Anchor. / Return to the Anchor. / Survive until dawn. |

Twenty-one lines. The longest is 33 characters. None of them names a destination the
player has not reached, and `tests/objectives.js` audits every one against STORY.md §24's
internal-only vocabulary — no "record", "reconstruct", "copy", "Stalker", "Behemoth".

### WHY A HIGH-WATER MARK IS THE ONLY NEW STATE

Almost every step is derivable from live state, but **live state is consumable**. A player
who spends their last plank on an Anchor has no wood, and a purely derived system would
cheerfully tell them to go and gather some. So each chain keeps one integer: how far it
has ever got. Four integers, 52 bytes, monotonic, bounded by the chain length.

It advances to the **furthest** step whose completion test passes, not merely the next one,
so a player who comes back from a cave with a stone pickaxe and coal before anyone
suggested either is credited with both. Exploring ahead is free rather than punished.

The Farmlands need no mark at all: the journey ordinal is already monotonic and already
saved, so that chain is a threshold table read straight off it.

### SAVE / LOAD

**Schema version 1 → 2, with a real migration.** A version 1 (Phase 23) save has no
objectives block; the migration inserts zeroed marks, and zeroing is *lossless* rather than
merely safe because the marks re-derive on the first evaluation after the load. A Phase 23
save of a player who already had torches, an Anchor and a Core Disk is credited with all
three the moment the world comes back. `tests/objectives.js` loads a real version 1 payload
and proves it.

### WHAT WAS REMOVED

The six-line **MISSION DIRECTIVES** checklist. It was a second objective authority sitting
directly above the first and, in three of the four dimensions, describing a game the player
was no longer playing. It is hidden once at boot (`retireDirectives`), its markup left in
place for Phase 27's HUD rebirth. The panel now carries **status** — Anchor fuel, fragments,
stage and day — and the one objective line above it.

### DEFECT FOUND AND FIXED

**"The fields are dying." could never appear.** `FARM_J_TREE - 3` and `FARM_J_ECHO0 + 2`
are both parcel 22, and the route line was tested first, so an authored Phase 20 objective
was unreachable at every ordinal in the game. The dead land belongs to the great tree, so
it moved to `FARM_J_TREE - 1`. Both lines are now reachable and the test walks the ordinal
to prove it.

**A dangling `hasAnchor` reference** in `updateObjectiveHUD` after its signature changed —
caught by the browser suite's page-error assertion, which is exactly the class of bug the
offline harness cannot see because it cannot construct `Game`.

### COST

Evaluated on a 0.25s accumulator, and the snapshot is passed as a **thunk** — on the
fifty-nine frames out of sixty that return early, nothing is built and nothing is
allocated. 600 frames build ~37 snapshots. 20,000 forced resolutions run in 17ms
(0.8µs each). The DOM is written only when the text actually changes.

### VALIDATION

`tests/objectives.js` (new, 73 checks) drives the **real tables** with synthetic states:
every step of every chain in order, early completion, the monotonic guarantee across 50
empty-inventory evaluations, override priority over 256 combinations of live state, the
Farmland ordinal walk, Suburbia's freedom from coordinates, the save round trip, eight
kinds of corrupt mark, and the version 1 migration.

`tests/browser-save.js` grew **7 objective checks** in a real Chromium: the line is visible
and laid out on a new game, the retired checklist is gone from the screen, the objective
advances with real progress, **survives a page reload and Continue**, resets on New Game,
and is replaced — not left stale — by a real dimension crossing.

### INTENTIONALLY DEFERRED

- **No hint system.** The brief allows a restrained one; the objective lines plus the world
  are doing the job, and a hint layer is easier to add later than to remove.
- **The `#objectiveHUD` panel styling** is Phase 27's. The objective line is functional and
  restrained on purpose: one italic line that brightens for two seconds when it changes.
- **No fail states, no timers, no markers, no minimap, no quest log.** None were built.

---

## 0.00. PHASE 24 — CANONICAL STORY FOUNDATION

**The canon itself is in `STORY.md`, not here.** This section records what Phase 24 did
to the repository; the story lives in one file so a future session has one place to look.

### THE METHOD

The canon was **derived from the build, not imposed on it.** Five systems written across
five separate phases — the water tower's red light, the Disconnected Home's mailbox, the
Stalker's freeze, the farm animals, and Suburbia's rearrangement — all independently key
off the same thing: **they change only when nobody is looking.** Nobody planned that as a
theme; it emerged because it is what felt frightening each time it was built.

Phase 24's central decision was to promote that accident to the canon:

> The world resolves under attention and lets go of what nobody is looking at.

Everything else in `STORY.md` follows from that one sentence, which is why the canon
explains the existing mechanics instead of sitting beside them.

### THE PREMISE, IN ONE PARAGRAPH

Reality was damaged. Something is rebuilding it from an incomplete **record** of what was
there, and the rebuild only resolves under observation. The record holds geometry, roads
and compass directions perfectly and holds **people not at all**. The further the player
travels, the worse the record gets and the more of the work is being done from copies of
copies — until the distinction between the place and the imitation stops being answerable.
Nothing in the game ever names the thing doing the rebuilding, and nothing ever explains
why.

### WHAT EACH DIMENSION IS FOR

| stage | what it is |
|---|---|
| Overworld | the thickest part of the record — the baseline the rest violates |
| Shattered Farmlands | the thin part: buildings came back, people did not |
| Disconnected Home | two records (outside and inside) that were never reconciled |
| Static Suburbia | the record rebuilt **from a rebuild** — a second-generation copy |
| Fake Haven | a small record rebuilt perfectly, because it was *loved* rather than merely observed |
| The final scene | the record's subject, with nothing left in front of it |

### THE AUDIT — EXISTING LORE, AND WHAT IT COST

Every narrative string in `game.html` was inventoried before anything was written:
tutorial pages, the opening instruction, journey objective lines, dimension banners,
toasts, win screens, credits, farm sign names, and the entity comment blocks.

**Kept, and now explained rather than replaced:**

- *"At the crossroads, go east." / "Go east."* — untouched
- *"A brass compass, still true. North holds."* — now canon: direction is one of the few
  things the record kept perfectly
- the journey's observation-only objective lines — the model Phase 25 must follow
- the farm signs (ROTH / JOHNSON / MILLER FARM) — canon: a name on a board is geometry,
  so it survives; the family does not
- every observation-keyed behaviour listed above — now the load-bearing wall

**Contradictions found and fixed (four strings, no logic):**

1. `<title>Block &amp; Ruin</title>` — the retired project name, in the browser tab
2. the start screen `<h1>BLOCK &amp; RUIN</h1>`
3. the credits title `BLOCK &amp; RUIN`
4. the tutorial's opening line, *"**Block & Ruin** is a survival horror expedition…"*

All four are forbidden by `CLAUDE.md` §1. They now read **WHERE IT ISN'T**. Four
dev-console banner strings were changed too, so the retired name is gone from the file.

**One further correction:** the credits read `STARRING — THE VOID SOVEREIGN`, which
credits the finale like a boss with a marquee. `STORY.md` §19 is explicit that the final
creature is not a boss and must never be named on screen. It now reads
`AND — WHATEVER WAS ALWAYS THERE`. The internal name survives in code comments only.

### DELIBERATELY NOT CHANGED

- **No lore was added to the game.** No notes, no journals, no exposition, no HUD text.
  Phase 24 wrote a document; the player-facing string count went **down**, not up.
- The win screen's *"PURGE COMPLETE / THE RUIN GROWS DARKER"* still uses the old title's
  vocabulary. It is not the retired name, it is scheduled for the Phase 27 HUD rebirth,
  and rewriting it now would be doing Phase 27 badly and early. **Recorded, not fixed.**
- The tutorial survives as-is apart from the name. Phase 28 removes it.

### VALIDATION

`tests/story.js` (new) — structural checks only: the bible exists with all 22 required
canonical sections plus the knowledge curve, the mystery/explanation split and the
environmental-storytelling list; the retired project name appears nowhere in `game.html`;
the finale is not named in player-facing text; and every narrative marker the audit
catalogued (the opening lines, the compass toast, the journey lines, the banners, the farm
signs) is **still present** — the point being that Phase 24 must not have quietly deleted
the story fragments it was supposed to preserve.

**It does not, and cannot, test whether the story is any good.** No test in this
repository makes a claim about literary quality, and none should.

Every pre-existing suite was re-run and is green, including the Phase 23 browser run.

### INTENTIONALLY LEFT OPEN

`STORY.md` §22 is the list of things that must never be answered — among them what is
doing the rebuilding, why, whose memory the Haven is, and whether the player is original.
Those are not gaps to be filled by a later phase. **They are the deliverable.**

---

## 0.0. PHASE 23 — SAVE / LOAD

One slot, one schema, one restore path.

### THE MODEL

Nothing is snapshotted. The save holds the STATE the world is a function of, and the load
reconstructs the world by running the same deterministic generators against the same
coordinates and replaying the player's edit deltas over them:

```
deterministic generation  +  persistent player edits  =  the current world
```

which is exactly what the chunk streamer already does every time a chunk unloads and
comes back. No renderer, no scene object, no mesh, no material, no texture, no DOM node,
no AudioContext, no listener and no frame timer is ever serialised — `save.js` asserts
that by reading the capture function's own source.

### SCHEMA

`whereitisnt.save.v1` (primary) and `whereitisnt.save.v1.backup`. `SAVE_VERSION = 1`.
`SAVE_MIGRATIONS` is an empty table with a working ladder behind it: a future version adds
one entry, and nothing in the loader changes. There are no fabricated future versions.

| block | fields |
|---|---|
| root | `version`, `savedAt`, `dimension` (`overworld` / `farmlands` / `suburbia`) |
| player | `position{x,y,z}`, `yaw`, `pitch`, `hp`, `maxHp`, `dead`, `attackBonus`, `miningSpeedBonus`, `chestsOpened`, `selectedSlot`, `inventory[36]` — **`level` was here until Phase 26 removed it (schema 3)** |
| — | `sanity` |
| progression | `stage`, `dayCount`, `memoryFragments`, `nightsRequired`, `awaitingAdvance`, `behemothDefeated`, `behemothSpawned`, **`compassAcquired`**, `pendingLevel2Transition`, `fakeHavenTriggered`, **`milestones[]`** (added by Phase 26, schema 3), `farmCrossroadsRecalled`, `farmJourneyOrd`, `farmHouseSeen`, `killCount`, `riftDisks[]`, `dimensionsBreached[]` |
| time | `cycleSeconds` (seconds within the 720s cycle, not the raw accumulating `t`), `wasNight` |
| anchor | `x`, `y`, `z`, `fuel`, `riftActive`, `riftTargetLevel` — or `null` |
| world | `edits{chunkKey: [idx, id, …]}`, `openedChests[]`, `doors[]`, `torchDecay[]`, `suburbiaVisits[]`, `suburbiaStage[]`, `suburbiaDoorOverrides[]`, `mailboxSeen`, `mailboxGone` |
| settings | a snapshot through `GameSettings.toJSON()` |

**XP IS NOT IN THE SCHEMA, AND SINCE PHASE 26 NEITHER IS `level`.** The `xp` counter was
never written; `level` went out with schema 3, and a schema 2 save's copy is dropped by the
2 → 3 migration. What XP has already BOUGHT — max health, attack bonus, mining bonus — is
still persisted, because losing those on load would be destroying progress rather than
declining to store a number. Section 0.0000 describes what replaced the system, and what
the migration has to do so a returning player is not paid twice.

### THE WORLD DELTA

`editedChunks` is the representation the roadmap asks for, written per chunk as a flat
`[index, id, index, id, …]` array — roughly a third of the JSON an object of index keys
would cost, and it round-trips through a `Map` with no key parsing. A session that dug a
ten-block shaft, built a pillar and stripped a patch of topsoil — 61 edits — serialises to
**825 bytes**. A raw snapshot of the same 41×41 columns would be 210 KB of voxels alone.

One reconciliation lives here: the Disconnected Home's one-shot mailbox anomaly is written
with `_writeBlockRaw`, which deliberately records no edit. A save is not a stream-out, so
`captureWorldState` emits that single voxel as an edit when the latch is set. Without it
the horror beat quietly undid itself on the next load.

### SAFE PLACEMENT

The saved position is a hypothesis. It is accepted only once its chunks are resident AND a
body of the player's real dimensions fits there. Every repair is deterministic:

1. the saved spot, if a real `collidesAABB` query says it is clear
2. up to 8 blocks up, then up to 8 down, in the same column
3. a deterministic ring walk outward, nearest first, on real `findSpawnHeight` ground
4. the dimension's own arrival point — the same one its transition uses

A column only counts if the chunk is **resident**. `getBlockWorld` answers AIR for an
ungenerated chunk, so without that test an out-of-range coordinate would read as beautifully
clear and drop the player through the bottom of the world. `save.js` tests exactly that trap.

The validator refuses a position before placement ever runs when it is non-finite, outside
the world, or **in the wrong dimension for the coordinates it names** — the three regions
are disjoint bands of one coordinate space, so that is decidable.

### CORRUPTION, AND NEVER LOSING A GOOD SAVE

`JSON.parse` succeeding is not validity. Unknown dimensions, a version from a newer build,
a missing player block and a non-object payload are hard rejections with a reason. Dented
fields are repaired and every repair is reported to the player. An empty or negative stack
is DROPPED rather than clamped up: a loader must never mint an item.

Writes copy the current payload to the backup key first and restore it if the write throws,
so a quota failure cannot be the thing that loses the run. A truncated primary falls
through to the backup rather than reporting "no save".

### ONE RESTORE PATH

`_teardownForRestore()` exists once and has exactly one caller, `_applyRestoredState()`,
and Save, Load, Continue and New Game all go through it. **New Game is that same path
applied to `defaultSaveState()`**, which is what makes "a new game inherits nothing" a
structural property. It does not delete the stored save — starting fresh is not a request
to destroy the run you already have.

Order is the contract: registries replaced → region cores rebuilt (so the replay lands as
each chunk is first built) → ground loaded → player placed → progression → presentation.

### SAVING IS REFUSED IN THE FAKE HAVEN

The Haven is a terminal scripted sequence: movement is taken away, the world behind the
player has been flushed, and it ends in the credits under a minute later. Its cabin is
built from scene props with no teardown path, so a "restore" would have to rebuild an
illusion the game only ever builds once. Save and Load both refuse there, in one place,
with a message. This is a **known limitation**, recorded as one.

### SETTINGS

Phase 22 keeps its authority. The browser-global `whereitisnt.settings.v1` is where
settings live; the save carries a validated snapshot that is applied **only** when the
browser has no settings of its own (cleared site data, a different profile), which makes
the save a recovery path rather than a competing owner.

### UI

No new menu framework. Three buttons in one more `.settings-group` at the top of the
existing pause panel (SAVE / LOAD / NEW GAME, with NEW GAME asking twice), a status line
under them, and a CONTINUE button on the existing start screen that appears only when a
save actually validates. Autosave fires on the two dimension crossings and nowhere else —
no timer, no per-frame write.

### VALIDATION

`tests/save.js` — 152 offline checks against the real code, including the round trip that
generates a Farmland region, mines and builds in it, captures, boots a **second world from
scratch**, restores, and compares **107,584 blocks with zero differences**.

`tests/browser-save.js` — **56 checks in a real Chromium with a real WebGL context.** It
plays, clicks SAVE in the real panel, **reloads the page**, clicks CONTINUE, and asserts on
the live runtime. This is the browser validation; it was run and it passes.

Measured in that browser: capture 0.5 ms, validate + write 0.8 ms. A full load —
teardown, region rebuild, eager chunk load and restore — is about 1.0 s, which is world
reconstruction and is expected to cost more than a save.

### NOT VERIFIED

- **No human has played a save/load cycle.** Everything above is automated, including the
  browser run. Chromium renders through SwiftShader, so nothing here is a claim about GPU
  performance or about how any of it looks.
- The Fake Haven is not saveable, by design, and therefore not tested as a restore target.
- Lantern and Soul Anchor lights are re-registered only for chunks resident at load time.
  That matches the existing streaming behaviour (their blocks persist; their lights come
  back with the chunk) and is not made worse, but it is not made better either.

---

## 0.1. PHASE 22 — SETTINGS MENU + GAME OPTIONS

Six settings, one state object, and no new frameworks.

| setting | default | range | notes |
|---|---|---|---|
| Master volume | 100% | 0–100% | multiplies a **new** `userGain` node, not `master.gain` |
| Music volume | 100% | 0–100% | multiplies the shipped `musicBus` gain of 0.82 |
| SFX volume | 100% | 0–100% | multiplies **both** SFX buses (1.35 and 1.0) |
| Mouse sensitivity | 1.00× | 0.25–3.00× | multiplies the unchanged 0.0022 rad/px base |
| Graphics | High | Low / Medium / High | High **is** the configuration the build already shipped |
| Fullscreen | off | — | browser Fullscreen API, prefixed spellings handled |

**Every default reproduces the previous build exactly.** A player who never opens the
menu sees and hears precisely what they did before it existed — asserted, not assumed.

### Audit findings, fixed as part of the work

**`sfxBus` existed but eleven cues bypassed it.** The whispers, item pickup, chest open,
anchor execution, shield zap, stalker screech, torch fizzle, jumpscare hit, the Sovereign's
roar, the void static and the Haven tear were wired straight to `master`. They are
unambiguously gameplay SFX and the SFX slider has to reach them — but re-pointing them at
`sfxBus` would have made all eleven **35% louder**, because that bus carries a deliberate
+1.35 lift for footsteps and block hits. They now go through a second bus at unity, so both
answer the slider and the mix is bit-identical at defaults.

**`master.gain` is not free real estate.** `playDeathCollapse()` fades it to zero at the
climax and nothing restores it — it doubles as a permanent "silence everything" latch. Had
the Master slider written there, nudging it after the credits would have brought the whole
soundtrack back from the dead. One `userGain` node between master and the destination keeps
the engine's ducking and the player's volume from being able to undo each other.

**The render target is the real graphics lever, not the pixel ratio.** The scene is drawn
once into the PostFX target at 1× CSS pixels and then blitted through the grading shader,
so `setPixelRatio` only ever affected one fullscreen quad. Quality scales the *target*.

### Defect found by inspection and fixed

**Overlays could stack on the settings panel.** With settings open — pointer lock already
released, world already paused — pressing **E** opened the crafting bench and **I**/**Tab**
opened the backpack on top of it, leaving one overlay orphaned the moment the other closed.
Both are now inert while settings are up, and settings cannot open on top of them either.

### How it integrates

Settings joins the **existing** `menuOpen` getter, which every gameplay input path already
consults — mouse look, mining, placing, dropping, the hotbar wheel and click-to-relock all
stop for exactly the same reason they stop for the inventory. On top of that the frame loop
*genuinely pauses* the simulation (the same shape the climax freeze already uses) while
still rendering, so the panel sits over a live world rather than over black, and the frame
delta is still consumed each frame so resuming cannot deliver one huge `dt`.

Persistence is `localStorage` behind a probe, debounced 250 ms — 101 slider steps produce
zero writes while dragging and one on flush. The whole state is a flat JSON object with
`toJSON()` / `applyJSON()`, so **Phase 23 can fold it into the save file without touching
this code**.

Access: **O** toggles in gameplay, **Escape** closes, and a SETTINGS link sits on the start
screen next to the existing skip link.

### Hotfix — the start-screen SETTINGS button appeared dead

Reported after the phase shipped, and worth recording because the symptom pointed away from
the cause. The button was not unclickable: the listener fired, `openSettings()` ran and the
overlay got its `.active` class every time. The panel was authored at **z-index 45** — above
the crafting, backpack and storage overlays (all 40), which is all the in-game **O** key
needs — while `#startScreen` sits at **50** and paints an opaque background across the whole
viewport. The panel opened correctly and opened *behind an opaque wall*.

Fixed by moving the overlay to **z-index 56**: above every screen it can legitimately be
opened from (the start screen, and the tutorial screen at 55, where the same defect existed
because the O key listener is live from `Game` construction onward), and still below the
layers that must never be covered — the opening instruction and win screen (60), the Haven
white wash (60), the hard black cut (65) and the credits (70).

One declaration changed. No settings logic, persistence, audio routing, graphics preset,
fullscreen or sensitivity code was touched. `tests/settings.js` now parses the game's own
stylesheet and compares the layers directly rather than only asserting that a listener
exists; those checks fail on the old value and pass on the new one.

---

## 0.2. PHASE 21 — DROPPED ITEM GROUND CONTACT

### The defect, measured

`ItemEntity.position` is the item's **foot**: the collider spans `[y, y + ITEM_SIZE_Y]`,
and landing, the spawn-overlap escape and the support test are all written against that.
The **mesh did not agree**. `THREE.BoxGeometry` is centred on its origin — measured off
the real BufferGeometry, bounds −0.125…+0.125 — and was drawn at `position.y` directly, so
the rendered cube's bottom sat **0.125 blocks below** the surface it was standing on.

The bob made it worse rather than better. Applied as ±0.08 around that already-sunk
centre, the rendered bottom oscillated between **0.045 and 0.205 blocks under the ground**.
A dropped item never once touched the surface it was resting on, and was at its deepest at
the bottom of every bob cycle.

Then the tests found a **second, independent defect**. The integrator, on a downward
collision, reverted to the position at the start of the substep:

```js
p.y += this.velocity.y * sdt;
if (this._collidesAt(world, p)) { p.y = prevY; ... }
```

That leaves the item wherever the substep grid happened to put it — up to a full substep
of travel above the thing it just hit. Measured on real drops: items came to rest between
**0.002 and 0.037 blocks in the air**, the amount varying with impact speed, so no two
drops floated by the same amount. It also broke support: the wake-up probe reaches 0.02
down, so an item resting 0.026 up could not see its own floor, woke, fell, floated again,
and cycled forever.

### What was changed

Four small, isolated changes. **No player physics, no collision architecture, no mining,
no placement, no world generation.**

| change | why |
|---|---|
| the mesh is drawn at `position.y + ITEM_MESH_HALF_Y` | puts the centred geometry's bottom face on the collider's bottom face — draw it where the collider already is, rather than moving the collider |
| the bob is a **raised cosine**, `(1 − cos)·½·0.16` | same 3.0 rad/s rate, same 0.16 peak-to-peak travel, same per-item phase desync; only its zero point moved, from "centred on the floor" to "resting on the floor" |
| on a downward collision, **bisect** between the last free height and the first colliding one | closes the residual gap to float precision. Runs only on the frame of contact — a couple of dozen cheap AABB tests once per landing, never per frame |
| support is `collidesAABB` at −0.02, not an `isSolid` scan | landing and support now ask the **same predicate**. `isSolid` answers "is there a block id here" and is true for every noclip decoration in the game — weeds, tussock, stubble, leaf litter, reeds, ladders — while `collidesAABB` correctly falls through them. Two systems disagreeing about what counts as ground is the root of a whole family of "item hangs in the air" bugs |

Plus two robustness fixes the tests demanded: `_chunkReady` now checks **every chunk the
item's footprint touches**, not just the one containing its centre (an item on a seam has a
collider spanning two chunk columns, and an unloaded chunk answers AIR for every voxel);
and pickup is measured from the item's **collider centre** rather than `mesh.position`,
which oscillates — an item at the edge of reach used to flicker in and out of range three
times a second. The pickup radius, trigger, inventory call, sound and destroy are all
untouched.

### Result

| | rendered bottom, relative to the support surface |
|---|---|
| **before** | −0.205 … −0.045 (always penetrating; deepest at the bottom of the bob) |
| **after** | 0.000000 … +0.160 (touches down once per bob, never below) |

Across five drop heights the worst before was −0.205; the worst after is `7e-7`.

### Cost

The item system ended up **54% cheaper** than the build it replaces — 300 resting items
per frame went from 0.332 ms to 0.153 ms. The exact support probe alone cost 37% *more*
than the cheap-but-wrong `isSolid` scan; a monotonic `worldEdits` counter on VoxelWorld,
bumped by the only two paths that mutate chunk data after generation, lets a resting item
skip a probe whose answer cannot have changed. It is a cache invalidated by the one thing
that could invalidate it. World generation is untouched — `performance.js` unchanged.

### Honest scope note

**Every dropped item in this build shares one geometry**: `BoxGeometry(0.25)` with a flat
per-item colour. That is asserted by the suite across eight item categories rather than
assumed. So "audit the mesh origin for every item category" has one answer, not many, and
Phase 21 deliberately did not add per-item meshes — that would be an art change, which the
brief forbids.

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
**Added by Phase 21, and honestly unverified:**

16. **No browser or WebGL validation, again.** Every item-contact result is a geometry or
    simulation measurement: the real `ItemEntity` stepped against real generated chunks,
    with contact read off the real mesh's world position. `tests/render-items.js` draws
    the real item mesh depth-tested over the real chunk geometry and shows the defect and
    the fix side by side, but it is a CPU rasteriser with no block atlas, not a frame from
    the engine. Nobody has watched an item land in a browser.
17. **How the new bob FEELS.** Rate, travel and phase desync are preserved exactly and
    asserted, but the bob now swings up from the surface instead of through it, so the
    item touches down once per cycle rather than hovering around a midpoint. That is what
    the brief asked for and it is measurably correct; whether it reads as livelier or
    busier than before is a judgement only a player can make.
18. **Pickup at the extreme of reach.** The radius is unchanged and pickup is asserted to
    fire on flat ground and at a chunk seam, but the measured point moved from the bobbing
    mesh to the stable collider centre. Effective horizontal reach is now a constant
    1.4948 blocks instead of pulsing between roughly 1.473 and 1.498. That is an
    improvement on paper; it has not been felt.
19. **Blocks placed INTO a resting item.** Support wake-up covers removal — mining below,
    beside, and a floor replaced by decoration are all tested. A block *placed* into the
    cell a resting item occupies would leave it embedded, because `placeBlock` tests the
    player's AABB but not item AABBs. That is pre-existing behaviour, is not in Phase 21's
    brief (which lists only removals), and was left alone rather than widened into.
20. **Items in water.** Drops sink through water by design and the Farmland terrain test
    skips flooded columns. Phase 21 did not change water interaction and did not test it.
15. ~~**Phase 23 does not exist, so save/load could not be tested.**~~ **RESOLVED BY
    PHASE 23.** The compass now genuinely survives a save: `compassAcquired` is persisted
    from the `Game` progression block it was deliberately put in, `_syncProgressionHUD()`
    is the call the restore makes, and `browser-save.js` asserts in a real Chromium that
    the tape is back on screen after a page reload — and that the compass is still not an
    inventory item. See section 0.0.

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

### Added by Phase 21

| what | search for |
|---|---|
| the root cause, and the mesh/collider relationship | `PHASE 21 — DROPPED ITEM GROUND CONTACT` |
| the mesh lift and the re-based bob | `ITEM_MESH_HALF_Y` / `ITEM_BOB_TRAVEL` |
| snapping onto the contact surface | `SNAP ONTO THE SURFACE INSTEAD OF REVERTING` |
| support via the landing predicate | `_stillSupported` |
| the edit-epoch cache | `worldEdits` |
| footprint-aware chunk readiness | `_chunkReady` |
| allocation-free collision queries | `_collidesAtY` / `_itemAABB` |

### Added by Phase 23

| what | search for |
|---|---|
| the whole module, and what it refuses to serialise | `PHASE 23 — SAVE / LOAD` |
| the schema, the keys, the migration ladder | `SAVE_VERSION` / `SAVE_MIGRATIONS` |
| validation and repair | `validateSaveState` |
| the world delta, and the mailbox reconciliation | `captureWorldState` / `restoreWorldState` |
| safe placement, and the resident-chunk trap | `findSafeLanding` / `saveFallbackSpawn` |
| storage, backup and the write order | `class SaveSystem` |
| capture, teardown, restore | `captureSaveState` / `_teardownForRestore` / `_applyRestoredState` |
| the four verbs | `saveGame` / `loadGame` / `newGame` / `continueFromSave` |
| why the Fake Haven refuses | `saveBlockedReason` |
| the panel controls | `attachSaveActions` / `id="setSave"` |
| the start-screen button | `id="continuePlay"` / `_refreshContinueButton` |
| the documented initial state | `defaultSaveState` |

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
