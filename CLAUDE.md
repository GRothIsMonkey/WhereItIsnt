# WHERE IT ISN'T
## Permanent Claude Code Project Instructions

---

# 1. PROJECT IDENTITY

Project name:

WHERE IT ISN'T

Previous working name:

BLOCK & RUIN

The project was originally called Block & Ruin, but the official name is now
Where It Isn't.

Do not revert the name to Block & Ruin unless explicitly instructed.

Where It Isn't is a browser-based stylized liminal survival horror game
built primarily with Three.js, HTML, CSS, and JavaScript.

The project uses a voxel/chunk-based technical foundation, but it is NOT a
Minecraft clone and must never visually or conceptually become one.

The game combines:

- procedural exploration
- survival
- environmental storytelling
- liminal horror
- psychological horror
- reality distortion
- impossible architecture
- interconnected dimensions
- subtle creature horror
- environmental anomalies
- rural exploration
- memory/repetition
- cinematic horror
- story-driven progression

The game should feel like its own game with its own identity.

---

# 2. CORE CREATIVE VISION

The single most important creative rule:

WHERE IT ISN'T SHOULD FEEL LIKE A WORLD THAT IS REAL,
FAMILIAR, PHYSICAL, AND BELIEVABLE UNTIL IT SLOWLY BECOMES CLEAR
THAT SOMETHING ABOUT REALITY IS WRONG.

The game is not supposed to be:

- Minecraft with horror mods
- a generic voxel survival game
- a monster arena
- a jumpscare simulator
- a gore game
- a generic procedural horror game
- a hallway simulator
- a game where every room is obviously haunted

The strongest horror comes from contrast.

Normality should exist.

Comfort should exist.

Silence should exist.

Beautiful environments should exist.

Ordinary animals should exist.

Believable architecture should exist.

Then the game violates the player's expectations in subtle, carefully
controlled ways.

---

# 3. VISUAL IDENTITY

The desired visual direction is:

STYLIZED
+
SEMI-REALISTIC
+
LOW-POLY / VOXEL-COMPATIBLE
+
ATMOSPHERIC
+
LIMINAL
+
HORROR

The game may use voxel geometry, but full cubes are NOT mandatory.

Sub-voxel geometry is encouraged whenever it improves the world.

Allowed geometry includes:

- full blocks
- half blocks
- slabs
- stairs
- wedges
- roof slopes
- thin geometry
- custom low-poly meshes
- curved/irregular low-poly forms
- furniture meshes
- architectural trim
- tapered geometry
- custom creature geometry
- custom environment geometry

The technical voxel foundation should be treated as a tool, NOT as a visual
restriction.

DO NOT automatically choose a cube merely because the game is voxel-based.

Ask:

"What geometry would make this object look believable?"

then implement the most efficient appropriate solution.

---

# 4. VISUAL GOAL: STOP LOOKING LIKE MINECRAFT

Avoid Minecraft-like visual shortcuts whenever possible.

Do not rely on:

- everything being a cube
- giant flat rectangular houses
- repetitive square roads
- generic cube animals
- flat single-color surfaces
- giant stacks of identical blocks
- simplistic furniture
- generic bright blue water
- obvious Minecraft-style UI
- Minecraft-style progression
- Minecraft-style survival presentation

The world can remain technically voxel-based.

The player should not mentally classify it as Minecraft.

---

# 5. HORROR PHILOSOPHY

Horror should usually be:

- subtle
- psychological
- atmospheric
- spatial
- environmental
- restrained
- unpredictable

Use:

- silence
- distance
- scale
- uncertainty
- strange repetition
- subtle movement
- incorrect geometry
- impossible relationships
- familiar objects in wrong places
- things disappearing
- things appearing where they should not be
- unusual creature behavior
- rare strong scares

Do not constantly use:

- jumpscares
- screaming faces
- loud stingers
- blood
- gore
- monster attacks
- screen shake
- distortion

A strong horror event should feel special because it is rare.

---

# 6. NORMALITY IS PART OF THE HORROR

Not everything should be scary.

Healthy animals should sometimes look healthy.

A farm should sometimes look like a farm.

A house should sometimes look like a house.

A road should sometimes just be a road.

A sunset should sometimes just be a beautiful sunset.

A quiet environment is not wasted time.

Normality establishes the baseline that makes wrongness meaningful.

---

# 7. THE CENTRAL MYSTERY

The deeper story direction developed for the game is:

Something is corrupting and/or reconstructing reality.

It is attempting to reproduce familiar places, environments, memories, and
structures.

It does not reproduce them correctly.

This creates:

- Rifts
- disconnected places
- impossible architecture
- memory failures
- repeated locations
- incorrect interiors
- dimension overlap
- familiar objects appearing in the wrong place
- Fake Haven
- Disconnected Homes
- increasingly impossible environments
- the final entity

This wording was the working sketch. It has now been superseded.

THE CANONICAL STORY IS ESTABLISHED IN:

STORY.md

Phase 24 completed the story foundation. STORY.md is the authority on what the
game means, what every location and entity is for, what the player learns and
when, and — importantly — what must never be explained.

Read STORY.md before writing any player-facing text, objective line,
environmental detail, cinematic, or creature.

The sketch above remains directionally correct. Where it and STORY.md differ,
STORY.md wins.

---

# 8. IMPORTANT STORY PRINCIPLE

The player should gradually DISCOVER the truth.

Do not explain everything early.

Do not dump the entire mythology in dialogue.

Do not tell the player:

"Reality is being reconstructed by X."

unless the story phase explicitly requires it.

Instead use:

- visual clues
- environmental storytelling
- repeated objects
- incorrect architecture
- strange geography
- subtle dialogue
- objective wording
- environmental state changes
- cinematic fragments

The player should build the understanding themselves.

---

# 9. GAME TITLE PHILOSOPHY

The official title is:

WHERE IT ISN'T

The title should eventually become thematically meaningful.

The player should repeatedly encounter situations where:

- something should be present but is absent
- something is present where it should not be
- a place exists where it cannot
- familiar things appear in the wrong context
- memory and physical reality disagree

Do not make the title a literal gimmick.

Let the meaning emerge naturally through the game.

---

# 10. CURRENT TECHNICAL FOUNDATION

The game uses:

- HTML
- JavaScript
- CSS
- Three.js
- browser APIs
- chunk-based procedural generation
- deterministic seeded generation
- shared resources
- procedural geometry
- streamed world regions
- custom collision
- environmental state systems
- structured progression
- save/load systems
- audio systems
- UI systems

The project may currently be contained in a large HTML file.

Do NOT assume that a large file is automatically bad.

Do NOT perform a huge refactor merely because the file is large.

Refactor only when it provides a clear benefit and can be done safely.

Preserve functioning behavior before improving architecture.

---

# 11. DETERMINISM IS CRITICAL

World generation must remain deterministic.

Given the same relevant:

- seed
- world coordinates
- dimension
- generation state

the game should produce the same world.

This includes things such as:

- terrain
- structures
- roads
- landmarks
- farmsteads
- animals
- animal condition
- animal behavior where persistent
- environmental variants
- important destination placement
- water generation
- Home placement
- story landmarks

Avoid uncontrolled randomness in persistent world generation.

If apparent randomness is desired, derive it from deterministic seeded data.

---

# 12. CHUNK / STREAMING RULES

The game is effectively infinite in important dimensions.

Do not replace the chunk system with an eagerly generated giant world.

Preserve:

- chunk streaming
- unload behavior
- deterministic generation
- chunk boundaries
- efficient memory use
- generation radius limits
- neighboring chunk continuity

Any new system must work correctly when:

- a chunk is generated alone
- a chunk is generated after neighbors
- a chunk is unloaded
- a chunk is reloaded
- the player travels very far
- the player returns to a previous location

---

# 13. WORLD COORDINATE PRECISION

The Farmlands uses an effectively infinite region rather than literally infinite
floating-point precision.

Do not assume infinite absolute coordinate precision.

When making new world systems:

- be careful with floating-point world coordinates
- preserve local/chunk-relative logic where possible
- test long-distance traversal
- test chunk crossings
- test return-to-origin consistency

---

# 14. PERFORMANCE PHILOSOPHY

Performance matters.

Do not casually introduce:

- thousands of scene objects
- per-cell objects
- per-frame global simulations
- expensive repeated world scans
- unbounded flood fills
- uncontrolled memory growth
- duplicate materials
- duplicate geometries
- unnecessary texture allocations

Prefer:

- shared geometry
- shared materials
- batching
- typed arrays where appropriate
- bounded simulation
- deterministic procedural functions
- chunk-local calculations
- efficient caches where benchmarks prove they help
- LOD
- streamed objects
- resource reuse

Measure before and after when practical.

Never fake performance results.

If an optimization makes something slower, revert it and document why.

---

# 15. VALIDATION PHILOSOPHY

Do NOT declare a feature complete just because code assertions pass.

Validation should use multiple layers:

1. automated tests
2. deterministic generation checks
3. regression tests
4. seam tests
5. persistence tests
6. performance tests
7. visual rendering where possible
8. actual first-person gameplay where possible

Visual problems often cannot be discovered through unit tests.

If browser/WebGL is unavailable:

- use the strongest available offline tools
- use actual geometry where possible
- render real geometry rather than invented mockups
- clearly state what was and was not browser-validated

Never claim browser validation that did not happen.

Never claim first-person validation if it was not actually observed.

---

# 16. DEVELOPMENT WORKFLOW

For every phase:

1. Read this file.
2. Read the roadmap.
3. Inspect the current code.
4. Determine what is already implemented.
5. Determine dependencies.
6. Preserve completed systems.
7. Implement the phase.
8. Test the phase.
9. Test regressions.
10. Test performance.
11. Inspect visual results where possible.
12. Fix real defects.
13. Re-run final validation on the final delivered build.
14. Only then declare completion.

Never restart a phase just because the code is unfamiliar.

Never rewrite a working system without reason.

Never duplicate an already-completed system.

---

# 17. NEVER PRETEND TO KNOW THE CURRENT STATE

If the repository already contains work:

INSPECT IT.

Do not assume the code still looks like an older version.

Do not rely on memory instead of examining the actual repository.

The current repository is authoritative.

This is especially important after context resets.

---

# 18. PHASE IMPLEMENTATION RULE

When starting a new phase:

FIRST:

Determine exactly what previous phases already implemented.

SECOND:

Identify what the new phase actually needs.

THIRD:

Integrate with existing systems.

Do not rebuild previous functionality under a new name.

Do not replace working systems without explicit justification.

---

# 19. PERMANENT GAMEPLAY DECISION: XP

XP has been permanently removed.

PHASE 26 CARRIED THIS OUT. As of Phase 26 the build contains no XP counter, no player
level, no XP threshold, no XP bar and no grant function of any kind. This section is now a
statement about the code, not an intention.

There must be NO:

- XP bar
- XP number
- XP gain
- XP requirements
- XP-based level progression
- XP save data
- XP tutorial language
- XP combat rewards

Do not reintroduce XP accidentally.

`tests/progression.js` is the guard: it fails if an XP symbol is defined, if a call site
appears in executable code, if an XP element returns to the document, or if a recipe grows
a level gate again. Run it before claiming a later phase is complete.

WHAT THE ACTIVE ARCHITECTURE IS NOW (Phase 26):

  ACCESS      the compass, a recipe's materials, a Core Disk, a dimension. Progression is
              what the player can DO because of something they found or opened.

  ENDURANCE   `PROGRESSION_MILESTONES` — exactly three one-shot survival milestones
              (first Anchor standing, first night survived, Behemoth felled), granting max
              health only, ceiling 170. Latched by id in a Set that the save carries;
              granted through the single path `Game._reachMilestone()`. Nothing counts
              toward them and none can be repeated.

  LEGACY      `attackBonus` and `miningSpeedBonus` still exist as PLAYER FIELDS with NO
              runtime source. They are there so a save written while XP was alive keeps
              what it already bought. Do not add a new source for either — combat
              progression is the weapon, mining progression is the tool.

Player progression should come from meaningful direct systems such as:

- equipment
- tools
- recipes
- discoveries
- Rift Cores
- story milestones
- world progression

Do not replace XP with an invisible XP-like number.

Do not add a fourth milestone, or a milestone that grants attack or mining, without a
deliberate design decision: three is the authored set, and a growing table is a curve.

---

# 20. ANIMAL PHILOSOPHY

The Farmlands currently has:

- cows
- sheep
- chickens
- horses

Animals are NOT enemies.

They do not use the enemy system as a substitute.

Animals should not become generic mobs unless explicitly instructed.

The animal system supports:

- wandering
- walking
- stopping
- turning
- feeding
- grouping
- entering structures
- strange stillness
- staring
- alignment
- straight walking
- freezing when watched
- subtle disappearance behavior
- strange groups

Behavioral wrongness must remain separate from visual deterioration.

---

# 21. ANIMAL VISUAL SYSTEM

Animals were completely redesigned in Phase 18.2.

They use custom parametric low-poly geometry rather than generic cubes.

The four species must remain visually distinct.

Cow:

- heavy torso
- barrel body
- broad chest
- thick neck
- muzzle
- horns
- ears
- legs
- hooves
- tail

Sheep:

- smaller body
- wool masses
- narrow face
- ears
- short legs
- hooves
- tail

Chicken:

- compact body
- neck
- head
- beak
- comb
- wattle
- wings
- legs
- feet
- tail

Horse:

- large torso
- long legs
- long neck
- muzzle
- ears
- mane
- tail
- hooves

Do not collapse them into reskins.

---

# 22. ANIMAL DETERIORATION

Animal condition currently includes:

- healthy
- slightly rotten
- moderately rotten
- severely rotten

Deterioration should be visible through:

- silhouette
- coat loss
- recession
- exposed anatomy
- damage
- asymmetry
- eye socket depth
- surface treatment

The game does NOT want excessive gore.

Use restrained anatomical horror.

Possible details include:

- tiny exposed bone-like shapes
- small tissue recesses
- missing coat
- damaged ears
- broken horn
- damaged tail
- sparse localized wounds

Do not turn the game into a gore simulator.

---

# 23. ANIMAL BEHAVIOR VS VISUAL CONDITION

This separation is PERMANENT and IMPORTANT.

A healthy-looking animal may:

- stare
- freeze
- align itself
- behave strangely

A severely deteriorated animal may:

- behave completely normally

Do not merge these systems just because it seems simpler.

The contrast is intentional horror design.

---

# 24. FARMLANDS IDENTITY

The Farmlands must feel like a real agricultural region.

It should contain:

- fields
- farmhouses
- barns
- farmyards
- animals
- roads
- curved paths
- drainage
- water
- orchards
- machinery
- rural infrastructure
- abandoned structures
- rural landmarks
- Ashen Forest
- wide horizons
- geographic scale

The Farmlands should feel different from Static Suburbia.

Do not make it:

"Static Suburbia but with farms."

---

# 25. FARMLANDS HORROR PHILOSOPHY

The Farmlands should generally be:

- rural
- lonely
- quiet
- abandoned
- beautiful in places
- slightly uncomfortable
- geographically large

Horror should emerge from:

- isolation
- strange animal behavior
- repetition
- impossible geography
- environmental inconsistencies
- distant silhouettes
- strange sounds
- empty structures
- subtle anomalies

Do not make every farm haunted.

---

# 26. PHASE 18 — FARMLAND ANIMALS — COMPLETE

Phase 18 established the Farmland animal system.

Completed requirements include:

- cows
- sheep
- chickens
- horses
- distinct species
- condition tiers
- behavior variants
- subtle abnormal behaviors
- freeze-when-watched behavior
- deterministic placement
- nearby simulation
- rural animal audio
- animal compatibility with rural navigation

Phase 18 has been accepted as complete.

Do not casually redesign the underlying behavior system.

---

# 27. PHASE 18.1 — FARMLAND PATH CHARACTER — COMPLETE

Phase 18.1 fixed the previously too-straight rural routes.

The original implementation technically contained curves but visually read
as nearly straight because the route lookup could not support large lateral
movement.

The corrected system includes:

- signed distance to lane lines
- curved route footprint
- variable route archetypes
- gentle and stronger bends
- softened curvature transitions
- meaningful path variation
- curved roads that preserve the actual road footprint
- rural route continuity across chunks
- improved junction behavior
- meaningful driveway behavior

Important:

Do NOT revert the route system to simplistic straight-grid roads.

Main roads, farm tracks, and driveways should retain different character.

The main road can be a guide, not a straight line.

---

# 28. PHASE 18.2 — ANIMAL VISUAL REBIRTH — COMPLETE

Phase 18.2 completely redesigned the animal visuals.

Architecture:

- parametric low-poly animal library
- loft-based geometry
- blades/lumps/patches/spikes as appropriate
- shared geometries
- shared materials
- deterministic variation
- species-specific deterioration archetypes
- LOD considerations
- restrained anatomical horror

Do not replace this with box-based animals.

---

# 29. PHASE 19 — FARMLAND ECOLOGY / ENVIRONMENT / WATER — COMPLETE

Phase 19 deeply expanded the Farmland environment.

Completed systems include:

- ground vocabulary
- soil states
- terrain micro-relief
- terrain basins
- dead crop ecology
- fence deterioration
- orchard ruin structure
- Ashen Forest ecology
- foreground details
- rural relics
- farmyard identity
- drainage
- water
- water depth
- water flow
- player wading/swimming
- shoreline escape
- crop protection
- road protection
- structure protection
- animal/water compatibility
- water chunk continuity
- bounded local water simulation

Water is Farmlands-only unless explicitly changed later.

---

# 30. PHASE 19 WATER RULES

Water is a lightweight local environmental system.

It should:

- obey gravity
- move toward available lower spaces
- spread locally
- settle
- update after relevant block breaking
- remain bounded
- remain deterministic

Do NOT implement expensive global fluid simulation.

Water must not:

- endlessly flood the dimension
- destroy main paths
- destroy important structures
- spawn crops underwater
- trap the player when reachable land exists
- flood important locations without explicit design intent

The player must be able to escape ordinary Farmland water.

---

# 31. PHASE 19 ENVIRONMENTAL DESIGN

Farmland environmental polish should be layered.

Foreground:

- dry grass
- weeds
- dirt variation
- mud
- stones
- sticks
- leaves
- crop remains
- erosion
- small debris

Midground:

- fields
- farms
- barns
- orchards
- machinery
- fences
- roads
- ponds
- drainage
- animal areas
- landmarks

Background:

- barns
- silos
- water towers
- chapels
- tree masses
- Ashen Forest
- terrain
- distant structures

The world should feel geographically large.

Do not fill every block with clutter.

Open space is important.

---

# 32. ENVIRONMENTAL STORYTELLING

Objects should have a reason to be there.

Examples:

tractor:
farmer used it

ditch:
field drainage

worn road:
vehicles used it

broken fence:
property boundary aged

abandoned orchard:
former agricultural use

stagnant pond:
drainage/low ground

Do not create random prop confetti.

---

# 33. PHASE 20 CURRENT DIRECTION

Phase 20 is:

FARMLANDS JOURNEY + DISCONNECTED HOME 2.0

This phase MUST NOT simply repeat the Static Suburbia formula.

Static Suburbia:

explore neighborhood
→
find strange house
→
investigate strange house

Farmland:

arrival
→
guided rural journey
→
wheat field
→
animals
→
barn/farmstead
→
open farmland
→
massive water tower
→
water tower anomaly
→
continue beyond tower
→
increasing isolation
→
geographic wrongness
→
missing-farm evidence
→
Disconnected Home
→
spatial horror

The journey itself is part of Phase 20.

---

# 34. FARMLAND STARTING ROUTE

When entering the Farmlands:

The player should spawn on a meaningful rural road/path.

The route should initially communicate one obvious forward direction.

This does NOT mean the player is trapped.

The player can leave the path.

The route simply prevents the Farmland from feeling like an aimless
procedural maze.

---

# 35. FARMLAND ROUTE Pacing

The intended route progression:

1. Player arrives.
2. Path leads through a large wheat field.
3. Player sees normal Farmland animals.
4. Path passes a meaningful barn/farmstead.
5. Player continues into open farmland.
6. The environment becomes slightly quieter.
7. A MASSIVE water tower becomes visible.
8. The player naturally follows the route toward it.
9. The water tower produces the first major subtle horror.
10. The route continues beyond the tower.
11. The environment becomes increasingly isolated.
12. Small geographic/reality inconsistencies begin.
13. The player discovers evidence of a missing farm.
14. The player eventually discovers the Disconnected Home.

The path is a guide.

It is not a rail.

---

# 36. MASSIVE FARMLAND WATER TOWER

The primary signature landmark of the Farmland journey is a MASSIVE
water tower.

It should:

- be enormous
- be visually dominant
- rise above fields
- rise above many tree lines
- be visible from substantial distance
- be clearly recognizable
- feel like believable rural infrastructure
- become a natural navigation compass

Once introduced, the player should have difficulty missing it.

It must not be hidden by excessive fog.

It is one of the most important visual anchors of the Farmland experience.

---

# 37. WATER TOWER RED LIGHT HORROR

The water tower has a red light at the top.

The horror comes from the player's gaze.

When the player looks directly at the tower:

The light should generally be dormant.

When the player looks slightly away:

The light may flash.

The flashes should be:

- irregular
- non-rhythmic
- subtle
- seemingly meaningless
- easy to question
- mostly noticed peripherally

Do NOT make this a puzzle.

Do NOT give the player an objective about it.

Do NOT explain it.

The intended reaction is:

"Wait... did that just flash?"

---

# 38. FARMLAND JOURNEY MUST REMAIN UNIQUE

Do NOT turn the Farmland journey into:

- haunted farmhouse immediately
- generic haunted road
- endless jumpscares
- monster chase
- obvious quest marker

Instead use:

- geography
- landmarks
- normality
- distance
- road direction
- environmental progression
- subtle anomalies
- carefully timed horror

---

# 39. DISCONNECTED HOME DISCOVERY

The player should NOT be told from the beginning that they are searching for
the Disconnected Home.

The Home should emerge naturally from the journey.

Before the Home is clearly visible, the player should encounter evidence that
a farm should exist.

Examples:

- fence posts
- old gates
- tire tracks
- mailbox
- well
- drainage
- field rows
- abandoned equipment
- property debris
- old service road

Then the player realizes:

A property should exist here.

But the surrounding geography cannot correctly contain it.

---

# 40. WHY THE HOME IS "DISCONNECTED"

The player should identify the Home through environmental contradiction.

Examples:

- tire tracks lead somewhere a driveway does not exist
- fences almost connect but do not
- field rows terminate unnaturally
- mailbox exists without proper access
- barn is positioned incorrectly relative to house/field
- well is inconsistent with property layout
- drainage implies a property that does not physically fit
- house footprint appears inconsistent with surrounding terrain

Do not simply put a glowing marker over the house.

The player should discover the truth through observation.

---

# 41. DISCONNECTED HOME 2.0 EXTERIOR

The farmhouse must look genuinely believable before horror begins.

Include:

- porch
- steps
- siding
- windows
- doors
- roof
- chimney
- yard
- vegetation
- possible shed relationship

Use custom/sub-voxel architecture where helpful.

The structure should look like a real rural farmhouse.

---

# 42. DISCONNECTED HOME 2.0 INTERIOR

Include:

- living room
- kitchen
- hallway
- bedroom
- utility/bathroom
- storage
- fireplace

The furniture and details should be specifically rural.

Possible objects:

- couch
- chairs
- dining table
- cabinets
- stove
- sink
- beds
- shelves
- lamps
- rugs
- storage
- fireplace objects
- agricultural household items

The player should believe people lived there.

---

# 43. HOME HORROR ESCALATION

Start normal.

Then introduce:

- hallway too long
- stairs that don't fit the exterior
- impossible room dimensions
- wrong floor relationships
- impossible doorway
- inverted interior
- window relationships that cannot be correct
- interior sections that cannot physically exist

The house should progressively become impossible.

---

# 44. HOME CENTRAL IDEA

The farmhouse is not simply "haunted."

The deeper idea is:

Something has reconstructed a farmhouse from fragments, memories, or some
other broken representation of reality.

It recreated the IDEA of the farmhouse.

It did not recreate the actual physical rules correctly.

This should connect to the larger story.

---

# 45. CORE DISK

The Level 2 Rift Core Disk in the Farmland Disconnected Home remains
guaranteed.

It must never become inaccessible.

Always validate:

- fresh generation
- unload/reload
- leave/return
- regeneration
- acquisition

---

# 46. STORY ROADMAP — ERA 1

Era 1 is about completing the actual playable game and establishing the
story foundation.

The current roadmap is approximately:

Phase 13 — Static Suburbia Visual Rebirth
Phase 14 — Static Suburbia Interior 2.0
Phase 15 — Static Suburbia Memory Horror
Phase 16 — Infinite Shattered Farmlands
Phase 17 — Farmland Abandoned Settlements / Rural Horror Landmarks
Phase 17.1 — Farmland Density Correction
Phase 18 — Distorted but Harmless Farmland Animals / Rural Navigation
Phase 18.1 — Farmland Route Character / Path Rebirth
Phase 18.2 — Farmland Animal Visual Rebirth
Phase 19 — Farmland Ecology / Environment / Water
Phase 20 — Farmland Journey + Disconnected Home 2.0
Phase 21 — Dropped Item Ground Contact
Phase 22 — Settings
Phase 23 — Save / Load
Phase 24 — Canonical Story Foundation
Phase 25 — Dynamic Objective System
Phase 26 — Remove XP / Rebuild Progression
Phase 27 — Health / Sanity / HUD Rebirth
Phase 28 — Remove Tutorial / Organic Onboarding   (COMPLETE — see section 54)
Phase 29 — Main Menu Rebirth + UI Typography     (COMPLETE — see section 55)
Phase 30 — Opening Lore Film                     (COMPLETE — see section 56)
Phase 31 — Environmental Storytelling            (COMPLETE — see section 57)
Phase 32 — Fake Haven Dream Sequence              (COMPLETE — see section 58)
Phase 33 — Final Creature / Horror Finale         (COMPLETE — see section 59)
Phase 34 — Final Audio Integration                (COMPLETE — see section 61)
Phase 34.1 — Audio Correction (human playtest)    (see section 61.05)
Phase 34.2 — Audio Runtime Correction             (see section 61.06 — awaiting replay)
Phase 34.3 — Audio Forensic Investigation         (see section 61.07 — awaiting replay)
Phase 35 — Complete Dimension Cohesion            (COMPLETE — see section 62)
Phase 36 — Complete Playable Alpha / Full Audit   (COMPLETE — see section 62.5)
Era 1.5.1 — Architecture inventory & contracts   (COMPLETE — see section 62.6)
Era 1.5.2-1.5.5 — the extraction phases, then Era 2

Exact numbering may evolve, but previous completed phases must not be lost.

---

# 47. PHASE 21 — ITEM GROUND CONTACT

When implementing Phase 21:

Fix dropped-item ground contact.

Audit:

- visual mesh origin
- collider
- ground contact
- terrain collision
- corners
- walls
- chunk boundaries
- newly mined blocks

No:

- sinking
- floating
- tunneling

Preserve:

- pickup
- rotation
- resting bob
- support wake-up

---

# 48. PHASE 22 — SETTINGS

Settings should include only useful options.

Current intended settings:

- master volume
- music volume
- SFX volume
- mouse sensitivity
- graphics quality/performance
- fullscreen

The UI should NOT resemble a generic Minecraft menu.

The menu should:

- pause gameplay
- release pointer lock
- restore pointer lock
- block gameplay input
- preserve audio state

---

# 49. PHASE 23 — SAVE / LOAD

The game needs robust browser-local save/load.

Persist relevant state such as:

- player position
- dimension
- inventory
- selected slot
- HP
- sanity
- stage
- day count
- progression
- opened chests
- anchors
- world edits
- structure state where necessary
- settings

Do NOT persist XP.

Use edited-chunk style persistence rather than giant full-world snapshots
where practical.

Include:

- save version
- schema validation
- migration hooks
- safe repair
- invalid-save handling
- player-position validation

Never load a player into:

- solid terrain
- invalid dimension
- impossible coordinates

---

# 50. PHASE 24 — CANONICAL STORY FOUNDATION — COMPLETE

Delivered. The canon lives in STORY.md; this section records the brief it answered.

The purpose was to define one coherent story connecting:

- Overworld
- Blood Nights
- Stalker
- Anchor Monument
- Hollowed Behemoth
- Rift Cores
- Farmlands
- Disconnected Homes
- Static Suburbia
- Fake Haven
- Final Entity

The story should explain:

- why the player is here
- what changed
- what the Anchor is
- what the Rift is
- why dimensions exist
- why Farmlands were abandoned
- why Suburbia behaves incorrectly
- what Disconnected Homes represent
- why Fake Haven exists
- what the final entity represents

Do not dump this entire truth onto the player.

---

# 51. PHASE 25 — DYNAMIC OBJECTIVES

Objectives should guide progression without spoiling mystery.

Early examples:

Gather wood.

Craft a basic tool.

Find coal.

Craft torches.

Prepare for night.

Return to the Anchor.

Survive until dawn.

Investigate the Rift.

Farmland objective philosophy:

- explore the region
- investigate meaningful locations
- follow routes
- investigate anomalies
- discover progression structures

Avoid giant floating quest markers.

Avoid revealing future dimensions too early.

---

# 52. PHASE 26 — PROGRESSION — COMPLETE

XP is permanently removed, and Phase 26 removed it.

Progression was replaced with:

- equipment (weapon damage IS the combat progression)
- tools (the pickaxe/axe tier tables ARE the mining progression)
- recipes (gated by materials, which are themselves discoveries — no recipe carries a
  level requirement any more)
- discoveries (the compass, earned at the first Overworld Ancient Chest)
- Rift Core milestones (the Rift opens because a Core Disk was fed to an Anchor)
- story milestones (three one-shot survival milestones — see section 19)

The save schema went to version 3. Its 2 → 3 migration drops `level` and `xp`, keeps
`maxHp` / `attackBonus` / `miningSpeedBonus`, and DERIVES which milestones an old save has
already lived so a returning player is not granted health twice for a night they already
survived. See `PROGRESS.md` section 0.0000.

Never substitute XP with another meaningless hidden number.

---

# 53. PHASE 27 — HEALTH / SANITY / HUD — COMPLETE

PHASE 27 CARRIED THIS OUT. The heart, the brain, both vital bars and the bordered
objective panel are gone from the document; the hotbar is a strip; every element is
made of one set of tokens. This section is now a statement about the code, not an
intention. See `PROGRESS.md` section 0.00000 for the full record.

WHAT THE HUD IS NOW:

  CONDITION   a row of ticks, ten health per tick, bottom-left. Discrete, DOM, warm,
              still. It grows with max health, so the endurance milestones are visible
              in it. States: hp-steady / hp-worn / hp-failing / hp-critical / hp-gone.

  PERCEPTION  a signal traced on a small canvas, directly under CONDITION. Continuous,
              canvas, cool, alive. It carries no hue, no number and no label that reads
              as a diagnostic: what it reports is how steady the line is, and at the
              worst states the line loses pieces of itself and turns up displaced.
              States: p-calm / p-drifting / p-breaking / p-lost.

  OBJECTIVE   one line of text against a hairline, top-left, plus a dim status line.
              No panel, no title, no checklist. The objective SYSTEM still owns the
              text; the HUD only renders what it is handed.

  HOTBAR      one continuous strip, bottom-centre. Selection is a lit cell, a brass
              under-rule and a slightly larger item — never a glowing gold box.

  PROMPT      a key chip and a verb above the hotbar, raised by the look-target path
              when something under the crosshair can be acted on.

RULES THAT NOW HOLD:

- Health and sanity must never converge on the same visual language. They are kept
  apart on four axes deliberately — discrete vs continuous, DOM vs canvas, warm vs
  cool, still vs moving — and `tests/hud.js` fails if a stylesheet rule reaches both
  or if either becomes a percentage-width fill.
- The HUD is a RENDERER. `UIManager` may not read an objective table, own a gameplay
  value, or reach a block id, chunk or mesh — the last of those is what lets Era 2
  reskin it without touching gameplay. `tests/hud.js` asserts all four.
- `UIManager.view` is a PRESENTATION CACHE. It mirrors what was last painted so a
  frame-loop setter can compare and return. It is never authoritative.
- Anything transient must be cleared in `UIManager.resetPresentation()`, which is
  called from the one teardown path a New Game and a Load both run.
- Do not reintroduce hearts, a vital bar, a quest panel, or a nine-box hotbar.

---

# 54. PHASE 28 — ORGANIC ONBOARDING — COMPLETE

PHASE 28 CARRIED THIS OUT. There is no tutorial in this build: the six-page card, its
stylesheet, its markup, its page table, its controller and its z-index layer are deleted,
and BEGIN EXPEDITION goes straight to the game. This section is now a statement about the
code, not an intention. See `PROGRESS.md` section 0.000000 for the full record.

WHAT THE ONBOARDING IS NOW:

  OBJECTIVES   the Phase 25 chain is the PRIMARY onboarding and owns broad direction.
               "Gather wood." → "Craft a basic tool." → "Find coal." → "Craft torches."
               → "Prepare for night." → "Endure the nights." → "Investigate the Rift."
               No objective line names a key, a mouse button or a UI element; direction
               is the chain's job and keys are the cue's.

  CUES         `ONBOARDING_CUES` — exactly THREE contextual prompts, each naming one key,
               each retired permanently the first time that key does its work:

                   break   LMB · CHOP / MINE / BREAK   any solid block under the crosshair
                   craft   E · CRAFT                   holding a log or planks
                   place   RMB · PLACE                 a placeable block, ground ahead

               They are drawn in the Phase 27 interaction prompt — the same element, the
               same renderer, the same two-word grammar — and they are the LAST fallback
               in the look-target path, so a door, the Anchor, an Ancient Chest or a Haven
               prop always takes the line first.

  THE WORLD    everything else. The white outline, the crack animation, the progress bar,
               the red highlight reading NEEDS A PICKAXE, the drop landing at your feet,
               the bench's own recipe list, the Anchor's glow, the dark.

  LEGEND       two lines on the start screen, and only what has no crosshair target for a
               cue to attach to: WASD / mouse / space / shift, the slot keys, I, and O.

RULES THAT NOW HOLD:

- No tutorial, and no tutorial in another shape. No control screen, no keyboard
  reference, no "how to play", no hint popups, no tooltips, no arrows, no highlighting,
  no quest log, no minimap, no waypoints. `tests/onboarding.js` fails if any string
  literal longer than 140 characters appears in the build.
- ONE prompt system. Do not build a second. A cue and an affordance are the same
  `{ key, verb }` spec and `UIManager` cannot tell them apart — that is deliberate.
- A cue teaches a VERB, in one upper-case word. The moment it needs a clause it has
  become the tutorial again.
- A FOURTH CUE IS A DESIGN DECISION, not a convenience. The test every candidate must
  fail before it earns one: "can a player who has been told 'Gather wood.' find this on
  their own, from the world, in under a minute?" Three things fail it, all for the same
  reason — a key with no visible surface to click on.
- NOTHING IS SAID TWICE. The verbs the world teaches were removed from the start screen's
  legend. Putting them back is duplicate onboarding.
- The opening instruction ("At the crossroads, go east.") is NOT tutorial content. It
  names a bearing and explains no mechanic. Phase 30 absorbed it as the closing beat of
  the opening film and calls it through its one existing entry point; do not delete it,
  and do not reimplement it inside the film.
- A pre-Phase-28 save loads FULLY ONBOARDED (save schema 4, the 3 → 4 migration). Never
  re-teach a returning player.

---

# 55. PHASE 29 — MAIN MENU REBIRTH + UI TYPOGRAPHY — COMPLETE

PHASE 29 CARRIED THIS OUT. The bordered card, the ember particles, the brass corner
brackets, the gradient title bloom, the eyebrow and BEGIN EXPEDITION are gone; the menu is
a landscape with words in its sky. This section is now a statement about the code, not an
intention. See `PROGRESS.md` section 0.0000000 for the full record.

The official title is, and remains:

WHERE IT ISN'T

WHAT THE MAIN MENU IS NOW:

  ONE SCREEN    `#startScreen`, with `#clickPlay` (NEW GAME), `#continuePlay` (CONTINUE)
                and `#startSettingsLink` (SETTINGS). Those ids are the stable API: Game
                binds them, Phase 22 reaches for them, three browser suites drive them.

  MainMenu      the LIFECYCLE. Owns the scene, the ambience and the CONTINUE label, and
                NOTHING else. It binds no button. show()/hide() are idempotent, every
                listener it needs is bound once in the constructor and gated on `open`.

  MenuAtmosphere  the SCENE. One 2D canvas — never Three.js, never a second world. The
                landscape (horizon, two tree ridges, water tower, barn and silo, poles and
                wire, mist, field furrows) is drawn ONCE into an offscreen canvas and
                blitted; per frame it adds two fog bands, a lamp and at most one walker,
                at ~30fps.

  ANOMALIES     exactly THREE, all scheduled by `MENU_EVENTS` as a pure function of the
                seed: `lamp` (the tower's red light, 0.22s, not before 14s), `walker`
                (a 2px silhouette crossing, 11s, not before 34s), `shift` (the tree line
                redrawn a few pixels along, not before 76s).

  AUDIO         `SoundEngine.startMenuAmbience()` / `stopMenuAmbience()` — brown noise at
                210Hz plus a 47Hz sine, on `musicBus`, idempotent, armed on the first
                gesture because no browser opens an AudioContext before one.

RULES THAT NOW HOLD FOR THE MENU:

- ONE menu authority. Do not add a second start screen, a second controller, or button
  handlers inside `MainMenu`. The split is by KIND — presentation vs verbs — not by
  control.
- THE MENU IS PRESENTATION. It may not generate terrain, tick a clock, spawn anything,
  advance an objective or write a save. `tests/menu.js` and `browser-menu.js` both check.
- NOTHING ANNOUNCES ITSELF. An anomaly a player cannot doubt has failed. Keep the first
  one past ten seconds, keep the light under 1% duty, keep the figure two pixels wide.
- NO CREATURE AND NO ANSWER. No Stalker, Behemoth, Neighbour or final entity, and no menu
  text may use the canon's internal vocabulary (`tests/menu.js` audits every word on it).
- CONTINUE appears only when a save VALIDATES, and is hidden otherwise. Never fake it.
- Four button states, and none of them colour alone. Keyboard focus must be distinguishable
  from hover.

# 55.1. UI TYPOGRAPHY — THE RULES THAT CAME OUT OF IT

THE HUD WAS NEVER BLURRED. It was set in Courier New — a typewriter face whose stems are
hairlines by design — at 8-10px, behind a 12px glow. A hairline stem at that size lands on
a fraction of a pixel and arrives grey, and a halo behind small text is a grey cloud the
shape of the letters. Both are fixed and neither may come back.

  THE FACE      `--ui-face`: ui-monospace / SF Mono / Cascadia Mono / Segoe UI Mono /
                Roboto Mono / Menlo / Consolas / DejaVu Sans Mono / Liberation Mono /
                monospace. Still monospace — that was always the identity — but never
                Courier New, and `font-synthesis: none` so a missing bold is not smeared.

  THE SHADOW    `--hud-shadow` is four 1px shadows (a real contour) plus one short drop.
                `--hud-shadow-hard` is the full-strength version for the captions and the
                status line, which sit over the most terrain. Not a glow. Never a glow.

  THE SCALE     `--t-primary` 15px (the objective, and only the objective)
                `--t-secondary` 12px (the interaction prompt, the held item)
                `--t-label` 11px (CONDITION, PERCEPTION, the clock, the key chip)
                `--t-tertiary` 10px (counts, the status line)
                Strictly descending. New HUD text uses a step; it does not invent a size.

- MINIMAL IS NOT TINY. Nothing in the HUD goes below 10px — including in the
  small-viewport media query, which gives up SPACE and drops optional glyphs rather than
  shrinking type. Nothing goes above 16px either: this is not a console UI.
- Type the player reads under pressure carries weight (600+). Ultra-light strokes at small
  sizes are half of what "blurry" meant.
- NEVER BLUR HUD TEXT FOR ATMOSPHERE. Atmosphere is restraint, spacing, colour and
  position. `tests/menu.js` fails on a HUD filter blur or a wide text-shadow.
- HUD CANVASES ARE FITTED TO THE DEVICE PIXEL RATIO (`UIManager._fitCanvas`), which scales
  the backing store and the context together so drawing stays in logical units. Any new
  HUD canvas goes through it.
- Phase 27's instruments were made bigger, not redesigned. Condition is still discrete DOM
  ticks; perception is still a continuous canvas trace; no rule may reach both.

---

# 56. PHASE 30 — OPENING LORE FILM — COMPLETE

PHASE 30 CARRIED THIS OUT. NEW GAME plays a sixty-eight second in-world cinematic before the
crossroads instruction; CONTINUE never does. This section is now a statement about the code,
not an intention. See `PROGRESS.md` section 0.00000000 for the full record.

WHAT THE OPENING IS NOW:

  IN THE WORLD  The film is the real Overworld at the real spawn, generated by the real
                seeded generator and drawn by the real renderer, with the player in
                look-only. It is not a video, not a second scene and not a new render path.
                The player finishes it standing in the place they just watched — which is
                the whole point, because the film's job is to establish the baseline of
                normality that every later wrongness is measured against (section 6).

  THE GATE      No input layer was invented. `player.movementLocked` (the Fake Haven
                freeze, which drops velocity, input and mining but still syncs the camera
                from yaw/pitch) plus `running === false` (which every gameplay verb and
                overlay key was already gated on) is the whole of it.

  FILM_BEATS    A frozen table of ten beats tiling 0-68s with no gap: dark, reveal,
                familiar, anomaly, closer, vast, seam, unresolved, calm, out. NOTHING is
                scheduled by a timer — every fade, line and placement is a pure function of
                `film.t`. That is why settings can pause it, why a test can drive it, and
                why there is nothing to leak.

  FILM_LIGHT    One cycle-second per beat (697 -> 16 on the 720-second day), so the light
                walks across a real dawn. The day is never TICKED: the film sets the hour
                and `_teardown()` puts the game's own second back.

  THE SHAPES    Three: two tapered five-sided columns (12m) and one enormous one (88m).
                Untextured, unlit, featureless. Not the Stalker mesh, not the Behemoth mesh,
                not anything nameable.

  THE LINES     "I know this place." and "Some of it is right." That is the entire script.

  THE END       The film hands to the Phase 20.2 opening instruction — "At the crossroads,
                go east." / "Go east." — exactly as 20.2 authored it to be handed to.

RULES THAT NOW HOLD:

- THE FILM IS PRESENTATION. It may not tick the clock, advance an objective, stream a chunk,
  spawn anything, damage the player or write a save. `tests/opening.js` and
  `tests/browser-opening.js` both check.
- ONE TEARDOWN. Five exits (running out, skip, skip on the first frame, a second film, a
  film that never rendered) all land in `_teardown()`, which restores movement lock, eye
  height and the borrowed hour and disposes every geometry and material. Anything added in
  `begin()` is removed there. Do not add a second exit path.
- NO TIMERS ANYWHERE IN IT. `tests/opening.js` fails if a `setTimeout` appears in the class.
  Listeners are bound once in the constructor and gated on `active`.
- ESCAPE BELONGS TO THE PANEL FIRST. The film's key listener is a CAPTURE listener on
  `window` for exactly this reason: `PlayerController` binds Escape on `document`, which
  bubbles first, so a bubble listener could never see the panel it was written to stand
  down for. One press closed the panel AND skipped the film until this was fixed.
- NOTHING RESOLVES. A silhouette that becomes a creature has spent Phase 33's reveal in the
  first minute of the game. STORY.md sections 5, 6 and 19 want that meeting later and
  elsewhere. Keep them shapes.
- A VANTAGE IS A COMPOSITION, NOT A SPAWN. The film raises the EYE (`eyeHeight`), never the
  body. The player is standing exactly where the film found them when it hands over, so the
  crossroads instruction still points from the right place.
- SIZE AND DISTANCE ARE A PAIR. The scene fog is `FogExp2` at 0.008. Anything placed for
  this film is sized from that curve, not guessed — a shape at 210m is six per cent visible,
  and the first version of the vast one was invisible for exactly that reason.
- NO NEW GRAPHICS PIPELINE. The film uses the existing renderer, the existing postfx pass
  and the existing audio buses. It adds one CSS layer (z-index 55) and three meshes.
- THE FILM DOES NOT KNOW ABOUT SAVES. There is no "seen the intro" flag and the save schema
  did not change. NEW GAME plays it; CONTINUE does not. That is the whole rule.
- THE LENGTH IS A KNOWN DISAGREEMENT. The Phase 30 brief asked for 60-120s; STORY.md section
  25 says "roughly 20 seconds". Twelve narrative beats cannot fit in twenty, so the film sits
  at the bottom of the brief's window (68s, ~77s with the instruction). STORY.md was NOT
  changed — this is two briefs disagreeing, not a canon contradiction.

# 57. PHASE 31 — ENVIRONMENTAL STORYTELLING — COMPLETE

PHASE 31 CARRIED THIS OUT. The world now tells the player things without saying anything,
and the way it does so is a small data-driven language rather than a pile of objects. This
section is now a statement about the code, not an intention. See `PROGRESS.md` section
0.000000000 for the full record.

WHY IT IS A LANGUAGE AND NOT CONTENT. The current voxel Overworld is not guaranteed to be
the final Dimension 1, and Era 2 intends to rebuild these dimensions without voxels.
Phases 17-20 wrote their storytelling by hand, welded to parcel indices; written that way,
the next hundred objects would be thrown away with the renderer. So this phase built the
vocabulary and spent ten events demonstrating it.

WHAT THE FRAMEWORK IS:

  ENV_READS       SIX CLOSED CATEGORIES — absence, placement, repetition, contradiction,
                  callback, trace. An event that fits none of them is a set piece, and a
                  set piece belongs to a phase with a name on it.

  ENV_PERSIST     generated / noticed / world / session. Almost everything is GENERATED —
                  a pure function of the seed, re-derived on every stream-in, therefore
                  not state and not in the save. This is why the phase added one save
                  field rather than a ledger.

  ENV_SITES       THE ERA 2 SEAM, and the most important thing in the phase. An event
                  carries the NAME of a place; this table says where that place currently
                  is. Every voxel-specific number lives in these eight functions and
                  nowhere else. A site may also name something an earlier phase already
                  built — two of them point at Phase 20 objects and add no blocks at all.

  ENV_STAMPERS    the only code that knows what a block is, kept out of both the event
                  table and VoxelWorld. This is the part Era 2 replaces.

  EnvironmentStorySystem   the runtime. It does two things: latches which of THREE tracked
                  events the player has stood in front of (2Hz, distance and facing, the
                  same test the water tower's lamp uses), and answers "does this exist
                  yet" for chunk generation. It has no timer, no listener, no geometry and
                  no UI, and `tests/environment.js` fails if it grows one.

RULES THAT NOW HOLD:

- IT NEVER SPEAKS. No notes, no journals, no handwriting, no readable human sentence
  anywhere (STORY.md section 13). No toast, no objective line, no marker, no waypoint, no
  discovery sound. A player who does not notice does not notice. `tests/environment.js`
  fails if a string literal in the phase gets long enough to be a sentence.
- IT NEVER RESOLVES. STORY.md section 22's list is the boundary. Imply, never confirm.
- NOTHING CHANGES WHILE IT IS BEING WATCHED. Section 16 rule 1, which the water tower's
  lamp, the diorama mailbox and the Phase 15 revision layer already obey. A callback
  appears in a chunk the player has not reached; it is discovered, never witnessed.
- REPETITION IS LITERAL. The four farmstead yard arrangements are stamped VERBATIM — not
  varied, not mirrored, not re-seeded per farm — in the same corner of every yard. A
  variation is a different object and defeats the entire point.
- A CALLBACK REQUIRES ITS ORIGINAL. Three events exist only once the player has stood in
  front of something in another dimension. A callback nobody has the memory for is a prop,
  and the test proves each one is absent without its prerequisite.
- ONLY WHAT GATES SOMETHING IS TRACKED. Three events out of ten. If a new event needs no
  callback, it needs no runtime, and giving it one is cost for nothing.
- THE AUDIO BUDGET IS NOT SPENT ON DISCOVERY. A sound that fires when the player finds
  something is a confirmation with the confidence knocked off it. The one cue in this
  phase is OCCUPANCY: a single quiet footfall in a suburban house the player has been
  inside before, standing still, at most once per house and never within forty seconds of
  another. It is attached to no event and cannot be found.
- PHASE 15 WAS EXTENDED, NOT SHADOWED. The seventh revision effect (the family photograph
  losing one of its two figures) rides on `_subStageEffect`. There is still exactly one
  Suburbia revision system, and there must never be two.
- ANYTHING ADDED TO THE FURNITURE CATALOGUE GOES ON THE END. `_furnNextId` hands out block
  ids in registration order; defining `artFamilyAlone` beside `artFamily`, where it
  belongs conceptually, shifted every id after it by four and rewrote the chunk data of
  the entire suburb. The same is true of `SUB_TILE_DEFS`.
- THE SITE TABLE IS WHERE A FUTURE PHASE LOOKS FIRST. Adding a piece of environmental
  storytelling means adding a row to `ENVIRONMENT_STORY_EVENTS`, a site, and — only if it
  is genuinely new geometry — a stamper. It does not mean writing another `_farmStamp*`.

# 58. PHASE 32 — FAKE HAVEN — COMPLETE

PHASE 32 CARRIED THIS OUT. The Haven is six stages over 178 seconds, of which the first 82
contain nothing different at all; the four captions that told the player how to feel are
deleted; and the cabin can no longer be chopped down for timber. This section is now a
statement about the code, not an intention. See `PROGRESS.md` section 0.0000000000.

Fake Haven is still, and must remain:

- beautiful
- warm
- comforting
- safe
- dreamlike

The player should WANT to remain there. It must not scream "this is a trap."

WHAT THE HAVEN IS NOW:

  HAVEN_STAGES  a frozen table of SIX stages tiling 0-178s with no gap: arrival, settled,
                perfect, noticing, thinning, ending. NOTHING is scheduled — the stage and
                the dissolve are pure functions of `havenTimer`, which is why settings can
                pause it, why a test can drive it, and why there is nothing to leak.
                `setTimeout` appears nowhere in the sequence.

  THE ARC       comfort (0-82s, in which nothing whatsoever changes) -> one quiet
                repetition -> stillness -> removal.

  THE AMBIENCE  three layers on `musicBus` — room, outside, hearth — started and stopped
                with the dimension on the same contract as Phase 30's film ambience.

  THE ANOMALY   ONE. A second mug on the mantel, the same block id as the one already on
                the low table, committed only while the hearth is out of shot and the
                player is five blocks away.

  THE DISSOLVE  26 seconds, one pure ramp, read independently by the shader (one uniform
                on the existing pass), the sky, the cabin's own lamps and the objective.

  THE EXITS     TWO, and both reach `_triggerHavenShift` through ONE line: the record
                running out, and lying down. The bed is an ENDING, not a skip — it moves
                the clock to the START of the removal, so the rest lands in full and the
                player gets the whole dissolution.

RULES THAT NOW HOLD:

- **NOTHING IS ADDED TO FRIGHTEN THE PLAYER. THINGS STOP.** Removal is the only horror
  vocabulary this dimension gets. A sting, a stinger, a whisper, a silhouette or a shadow
  in the Haven is a different game. `tests/haven.js` fails if any ambience level or the
  music state ever RISES between stages.
- **THE HAVEN SAYS NOTHING.** No toast, no caption, no narration. "Somewhere safe.
  Somewhere warm." told the player the conclusion the room has to earn; "The warmth was
  never yours." reframed the whole sequence as a betrayal, which STORY.md section 18
  explicitly forbids. Both are deleted and `tests/story.js` fails if either returns. The
  objective is one word, "Rest.", and then nothing.
- **THE SAFETY IS REAL AND SO IS THE REST.** The bed genuinely restores health and sanity,
  from the first frame, and does not punish the player for using it.
- **THE CABIN CANNOT BE TAKEN APART.** `_havenIsReadOnly()` refuses mining and placement,
  silently. The bed and the storage chest still work — they are the two contextual
  interactions the Haven allows. No mining, crafting, gathering, building or farming, and
  no prompt may offer a verb the dimension refuses.
- **NOTHING CHANGES WHILE IT IS BEING WATCHED.** STORY.md section 16 rule 1, obeyed here
  as everywhere. The one committed change is DISCOVERED, never witnessed; a player who
  never turns their back on the fireplace never gets it, and that is correct.
- **NOTHING IS OVERTLY WRONG BEFORE THE SHIFT** (STORY.md section 23). The Haven's three
  env-story events are a callback, a repetition and an absence. Not one of them is broken,
  spooky, or addressed to the player.
- **NO CREATURE, AND NO FORESHADOWING OF ONE.** No Stalker, no Behemoth, no final entity.
  The entity is spawned from exactly one call site in the build and it is downstream of the
  shift. Both test suites walk the entire intact sequence proving nothing has spawned.
- **THE HAVEN IS NEVER SAVED.** Saving and loading are both refused; `SAVE_DIMENSIONS` does
  not contain it. The save schema did NOT change in this phase.
- **A NEW GAME PUTS THE POCKET BACK.** `_resetHavenPocket()` undoes everything the
  generator did. Before it existed, a second visit in a later run arrived in an empty
  pocket with no ground and no cabin, and the bed and fog ring were left in the new run's
  Overworld. Anything a future phase adds to `generateFakeHaven` must be removed there.
- **THE LENGTH IS A KNOWN DISAGREEMENT.** ROADMAP.md section 50 says ~30 seconds; the
  Phase 32 brief asks for 1-2 minutes of calm and gradual wrongness after it. The build
  follows the brief at 178s. ROADMAP.md was NOT rewritten; see PROGRESS.md.
- **`_triggerHavenShift()` IS THE BOUNDARY.** Phase 32 ends there; Phase 33 owns everything
  past it. Do not add a third caller.

---

# 59. PHASE 33 — FINAL CREATURE — COMPLETE

PHASE 33 CARRIED THIS OUT. The eight-metre monolith is deleted; the finale is 32 seconds of
seven beats ending in the existing hard cut. This section is now a statement about the code,
not an intention. See `PROGRESS.md` section 0.00000000000.

WHAT THE FINALE IS NOW:

  FINALE_BEATS  a frozen table of SEVEN beats tiling 0-32s with no gap: silence,
                impression, scale, movement, face, impossible, cut. The beat, the fog, the
                camera target and every ramp are PURE FUNCTIONS of one accumulating number.
                `setTimeout` appears nowhere in FinalSequence.

  THE CREATURE  150 metres, 10.7:1 slender, arms that end below the knee, a head that is
                4.5% of the body, three unlit materials and twelve meshes. A SILHOUETTE,
                not a model. No light of its own, no texture, no rings, no shards, no
                emissive, and one pale featureless patch where a face would be.

  THE GROUND    the finale builds its own: a dark plane and fifteen familiar silhouettes
                at authored distances — poles, trees, a barn, a farmhouse, the Haven cabin,
                the WATER TOWER, a suburban row — every one nearer than the creature and
                every one smaller on screen.

  THE CAMERA    a DRIFT, not a rail. Pitch and yaw are lerped toward the beat's target at
                dt*1.1 and dt*0.55, so a player who does nothing is carried through the
                composition and a player who fights it can look away and is merely pulled
                back. Nothing is ever set outright.

  THE AUDIO     three low layers on the existing musicBus that only ever thicken, and ONE
                event in thirty-two seconds — a low strike on the face beat.

RULES THAT NOW HOLD:

- **IT IS NOT A BOSS AND HAS NO MECHANICS.** No health, damage, attack, dodge, weapon, QTE
  or arena. The creature does not know the player exists until it looks at them once.
  `tests/finale.js` fails if any of those words appears in the sequence.
- **IT IS NEVER SHOWN WHOLE AND NEVER LIT.** The fog densities are computed from
  `exp(-(density*d)^2)` at the creature's 320m: 0.3% visible at the silence beat, and only
  77% at its clearest. Every material is `MeshBasicMaterial`, so no lamp, sun or effect can
  ever resolve it into a lit asset.
- **THE FACE HAS NOTHING ON IT.** No eye, no mouth, no teeth, no jaw, ever. The player's
  imagination finishes it, which is the point of requirement 6.
- **IT EXPLAINS NOTHING.** No name, no label, no text, no lore, no stats. The longest string
  literal in the whole sequence is under thirty characters. STORY.md sections 19 and 22.
- **IT CANNOT APPEAR EARLY.** Built from exactly one call site, begun from exactly one call
  site, and that site is the Haven shift. Both suites walk the intact Haven proving nothing
  has spawned.
- **NOT THE STALKER, NOT THE BEHEMOTH.** Neither mesh, name, nor behaviour is reachable from
  the finale, and the tests assert it.
- **THE PLAYER'S EYE STAYS THEIRS.** No second camera is ever constructed and the camera is
  never positioned or aimed directly — only yaw and pitch move, and only by a fraction per
  frame.
- **A TERMINAL CINEMATIC DISABLES GAMEPLAY KEYS.** `PlayerController._playing()` is false
  while the finale is active and through the climax. It was not, and a screenshot caught
  the inventory grid open across the middle of the reveal. The Haven is deliberately NOT
  terminal — its chest and backpack stay usable.
- **ONE TEARDOWN.** `FinalSequence` disposes its scene's geometry and materials, stops its
  audio, hands back the sky and restores the HUD — from `finish()` and from `reset()`, which
  the one New Game / Load path calls. Reaching the ending three times builds the same scene
  three times.
- **THE CREDITS ARE NOT THIS PHASE'S TO REDESIGN** and were not touched. `_triggerClimax` is
  latched, so they fire exactly once.
- **THE HUD IS RESTORED BY CLEARING THE INLINE STYLE, NOT THE CLASS.** `hardCutToBlack`
  writes `style.display='none'`; a class removal cannot beat it, and a New Game from the
  credits left the HUD invisible for the rest of the session until this was fixed.

Target: approximately 30 seconds. Delivered at 32.

Sequence:

Fake Haven
→
blur/dissolve
→
new environment
→
distant movement
→
partial glimpse
→
strong scare
→
scale realization
→
full reveal
→
hard cut
→
credits

The final creature should be:

- enormous
- absurdly tall
- thin
- long-limbed
- disproportionate
- dark
- non-human
- difficult to understand visually
- psychologically disturbing

Do not copy a supplied reference literally.

Use it only as visual inspiration.

The final creature should be MUCH larger and more alien than Stalker or
Behemoth.

---

# 60. FINAL CREATURE HORROR LANGUAGE

Rarely used strongest horror tools can be reserved for the finale:

- silence
- horror music
- sudden audio
- spatial sound
- controlled distortion
- camera movement
- one or two powerful jumpscares
- scale reveal

Do not use these constantly elsewhere.

Their rarity gives them power.

---

# 61. PHASE 34 — FINAL AUDIO INTEGRATION — COMPLETE

PHASE 34 CARRIED THIS OUT. The collected library is audited, indexed and wired through one
centralized system; the game has recorded footsteps, ambience, doors, animals, a Stalker,
a Haven and a finale. This section is now a statement about the code, not an intention.
See `PROGRESS.md` section 0.000000000000 for the full record.

THE THREE LAYERS. This split is PERMANENT and it is what lets Era 2 replace a dimension
without touching the audio system:

  SoundEngine    the AudioContext, the buses, and every synthesised voice Phases 1-33
                 built. UNCHANGED by this phase. It is the only thing that talks to the
                 hardware.
  AudioLibrary   FILES. Fetching, decoding, caching, voice limits, panning, distance,
                 looping beds, fades, and failing safely. It knows nothing about
                 dimensions, blocks, chunks, meshes or the player.
  AudioDirector  POLICY. Which bed belongs to which place, which surface a footstep is on,
                 how rarely a distant sound may happen. It reads game state and calls the
                 library. It never touches an AudioNode.

`tests/audio.js` fails if the director grows the ability to create an AudioNode, or the
library the ability to read a block id.

WHAT THE TABLES ARE. Adding a sound means adding a ROW, not a playback call:

  AUDIO_ASSETS         the manifest. GENERATED — regenerate with
                       tests/tools/build_runtime.py, do not hand-edit.
  AUDIO_SCENES         fourteen scenes over four slots (air / layer / tone / tension).
  AUDIO_EVENTS         nine sparse one-shot tables, each with a gap in SECONDS.
  AUDIO_CUES           the interaction vocabulary. No call site holds a Freesound id.
  AUDIO_STEP_SURFACES  ten ground materials.
  AUDIO_SURFACE_OF     the ONLY place the audio system knows a block id exists. This and
                       AudioDirector.surfaceAt() are the two things Era 2 replaces.

RULES THAT NOW HOLD:

- THE SYNTHESISED ENGINE IS THE FALLBACK, NOT AN ALTERNATIVE. Where a recording exists it
  is tried first and the procedural voice runs when it does not sound. The build is fully
  audible with `assets/audio/runtime/` deleted, and `tests/audio.js` proves it by 404ing
  every asset and asserting a footstep still makes a sound. Never remove a synthesised
  voice because a recording covers it.
- ORIGINALS ARE NEVER TOUCHED. `assets/audio/` holds 187 source assets and the game never
  reads one. `assets/audio/runtime/` holds browser-ready copies and is ENTIRELY
  DISPOSABLE — delete it and re-run `tests/tools/build_runtime.py`.
- FILENAMES ARE NEVER REWRITTEN. The Freesound id is the first field of every filename and
  it is the join key between the file, `AUDIO_CREDITS` and `AUDIO_INDEX.md`.
- AN ASSET WITHOUT AN ATTRIBUTION LINE IS A LICENCE BREACH, not untidiness.
  `tests/audio.js` fails if any file on disk lacks one. Eighteen assets are NonCommercial
  or Sampling+; they are legal here and illegal in a paid, monetised or ad-supported
  release, and AUDIO_INDEX.md's LICENCE QUARANTINE section lists every one. The test fails
  if that list falls out of date.
- BEDS ARE CAPPED AT 30 SECONDS, AND IT IS A MEMORY RULE. `decodeAudioData` expands to
  32-bit float at the context rate, so a 208-second drone is 73MB resident. The loop join
  is BAKED at decode (the tail mixed back over the head, buffer shortened by the fade) so
  a bed loops seamlessly with `loop = true` and NO SCHEDULER. Do not add one.
- THE DIRECTOR SCHEDULES NOTHING. Every countdown in it is a number `dt` is subtracted
  from, which is why a test can drive four hours of it and why it cannot leak.
  `tests/audio.js` fails on a `setTimeout` in the director. The library uses exactly two,
  both for deferred teardown.
- SILENCE IS A STATE AND IT IS ASSERTED. No outdoor event table fires more often than once
  per 40 seconds, indoors is once per 70, nothing ambient is placed closer than 12 metres,
  the loudest bed level is 0.42 against a footstep at 0.5, and 11 of 14 scenes carry NO
  horror bed at all — including all four ordinary daytime places. A drone that is always
  there is a room tone, not a drone.
- A SCENE CHANGE MUST NEVER FIRE AN EVENT. Walking through a door and immediately hearing
  a creak reads as a reaction to the player, which nothing in these tables may be.
- THE HAVEN AND THE FINALE ARE MIRRORS AND NEITHER'S TIMING WAS TOUCHED. The Haven's
  recorded layers ride the SAME three numbers `HAVEN_STAGES` hands the synthesised rig,
  from the same call, on the same frame: they can never rise. The finale's ride
  `FINALE_BEATS` and can never fall. Both suites drive the real tables and assert it.
- NO ROAR IN THE FINALE. There is exactly ONE one-shot in the sequence and it is a massive
  structure flexing. `tests/audio.js` greps for the word.
- THE STALKER IS ALWAYS QUIETER THAN THE PLAYER. Its loudest cue is 0.34 against a
  footstep at 0.5. It stops completely beyond 34 metres and inside the Haven and the
  finale. `playStalkerScreech` remains Phase 5's ONE loud Stalker event; the recorded path
  cannot reach it.
- NO LEGIBLE HUMAN SPEECH IS REACHABLE (STORY.md section 13). The two assets in the
  library that are sentences are catalogued and deliberately NOT wired.
- ONE SETTINGS SYSTEM. `ambienceVolume` is the seventh key in the EXISTING Phase 22
  schema and `ambienceBus` the fourth and last bus, at unity, so the mix at default
  settings is unchanged. The fourth argument to `applyVolumes` DEFAULTS, so every
  pre-Phase-34 call site still lands on the shipped mix. The save schema did not change.
- DIMENSION 1's AUDIO IS DELIBERATELY THIN, per the brief: the current Overworld is
  scheduled for replacement, so it gets a correct bed set and none of the hand-authored
  placement the Farmlands got. That is compatibility work, not final sound design.

WHAT IS HONESTLY NOT DONE: nothing was listened to (no playback or content-analysis tool
was available, so every classification comes from filenames, AUDIO_CREDITS titles and
ffprobe metadata); no human has played the build; weather and water are loaded but placed
by no scene, because the game has no weather state and no cheap water-proximity query —
both are Phase 35 work.

---

# 61.05. PHASE 34.1 — THE AUDIO CORRECTION, AND THE RULE IT PRODUCED

Phase 34 passed 117 offline and 42 browser checks. A human then played it and found the
game nearly silent apart from footsteps, over an unwanted retro music loop. Both suites had
proved that the system CAN select and play a sound. Neither had asked whether a player
hears one. See `PROGRESS.md` section 0.0000000000000 for the full record.

THE RULE THAT CAME OUT OF IT, and it applies to more than audio:

  A TEST THAT ONLY BOUNDS ONE SIDE IS HALF A TEST. Every sparseness check in this phase
  asserted that events were rare ENOUGH. None asserted they were frequent enough, and
  "sparse" quietly became cover for "silent". Both event tables and bed levels now carry
  a floor as well as a ceiling.

RULES THAT NOW HOLD FOR AUDIO, in addition to section 61:

- **EXPLORATION IS NOT SCORED.** `playDayChord` is deleted. Music exists in exactly four
  places and every one is a MOMENT: the menu, the opening film, the Haven's chiptune and
  the finale. `tests/audio.js` fails if a scheduler for exploration music reappears, and
  `browser-audio.js` checks the live engine rather than the source.
- **A LEVEL IS ONLY MEANINGFUL IF THE FILE WAS MEASURED.** `build_runtime.py` normalises
  every asset onto a class reference (−26 dBFS beds, −20 one-shots, −22 footfalls). Before
  it did, the library spanned 64 dB and the hand-written mix reached the player at −56 to
  −82 dBFS. Never hand-tune a level against an unmeasured recording; rebuild instead.
- **ONE-SHOTS ARE MEASURED OVER THEIR LOUDEST 300ms**, not their whole duration, or every
  transient cue lands twenty decibels too quiet. **FOOTFALLS ARE NORMALISED PER SET**, not
  per slice, or every step in a set becomes exactly as loud as every other and a walk stops
  sounding like a person.
- **NEVER PEAK-NORMALISE A FOOTSTEP.** Loudness is half of what tells a player the ground
  changed; peak-normalising throws it away and was a direct cause of "they all sound the
  same".
- **THE GROUND PROBE READS THE CELL THE FEET ARE IN FIRST.** Crop, weeds and litter are
  noclip decoration in the player's own cell. Reading only downward classified a wheat
  field as bare soil, which is how the whole Farmlands became one surface.
- **AN UNGENERATED CHUNK IS NOT A ROOM**, and a single frame is not enough to swap the mix.
  `hasSkyAbove` returns false for a chunk that is not resident; the chunk is checked first,
  and the reading must hold for `AUDIO_INDOOR_SETTLE` before the beds move — a tree, a
  porch and a bridge are not rooms.
- **RUN `tests/audio-audit.js` BEFORE CLAIMING AUDIO WORK IS DONE.** It asserts nothing. It
  boots the real game, wraps every method that can make a sound, walks every dimension and
  prints what actually happened. It is the tool that would have caught all of this, and it
  is the tool to reach for when the question is "what does the player get" rather than
  "does the code run".
- **AND THEN A HUMAN PLAYS IT.** Neither suite can hear. Nothing in this repository has
  been listened to. A phase that changes what the game sounds like is not complete until
  someone has played it and said so.

---

# 61.06. PHASE 34.2 — THE RUNTIME CORRECTION, AND THE RULES IT PRODUCED

Phase 34.1 fixed the loudness of every FILE and shipped green. The same human played it and
reported the Farmlands still audible only as footsteps, and Suburbia WORSE than before. The
chain was traced end to end in a real browser with a meter on every bus. Most of it was
healthy — all 274 runtime files present, every bed decoded, started, connected and
measurably sounding at −25 dBFS — which is exactly why two passes had missed the fault.
See `PROGRESS.md` section 0.00000000000000 for the full record.

RULES THAT NOW HOLD:

- **A DECORATIVE DISTANCE IS NOT A PHYSICAL ONE.** `playAt()` had applied a bare
  inverse-square law to the authored gain of an ambient event — but that event's distance
  is drawn at random from its own row purely so the sound reads as elsewhere, and the
  player can never walk to it or test it. A tractor authored at 0.24 reached the ear at
  0.008; a crow at 0.46 reached it at 0.032. Every distant one-shot in the game was
  computed into inaudibility. The curve now carries a **floor** — the fraction of the
  authored gain distance may never remove — and DISTANCE IS CARRIED BY COLOUR AND BEARING:
  the air filter runs 18kHz at the listener to 2.1kHz at the far edge. Level says "this is
  small"; colour says "this is far". Only the second survives being audible.
- **PICK THE FLOOR BY WHETHER THE PLAYER CAN ACT ON THE DISTANCE.** 0.70 for an ambient
  event (decorative), 0.55 for the Behemoth's one arrival, 0.40 for an animal (a real thing
  at a real place), 0.12 for the Stalker (closing distance IS the cue, and it keeps a
  13.3 dB sweep across its approach). Nothing ambient may exceed the player's own footstep.
- **THE STALKER CEILING FROM SECTION 61 STILL HOLDS.** Its loudest cue is 0.311 against a
  footstep at 0.46. Never raise a floor in a way that breaks that.
- **SUBURBIA KEEPS AN ELECTRICAL LAYER IN EVERY SCENE.** 34.1 deleted `bed.hum.crt` from
  `sub.day` and `sub.blood` believing it doubled the Phase 5A procedural CRT static. It did
  not: that one is SPATIALISED to the nearest window, measures −45 dBFS, and exists only
  within about ten metres of a house — it had merely been the only audible thing before the
  beds were fixed. A television in a window is a positioned object; the hum of a street of
  air-conditioning plant is a bed. They are different sounds and both belong.
  `tests/audio.js` fails if any Suburbia scene loses its tone slot.
- **`species` IS AN INTEGER AND THE AUDIO TABLE MUST BE INDEXED BY ONE.** `playAnimalCall`
  looked its recording up with string keys while every caller passed
  `a.desc.species` — `FARM_ANIM_SPECIES`, the integers 0-3. The subscript was `undefined`
  on every call in every build, so all four animal recordings were UNREACHABLE, not
  merely rare, and every animal the player has ever heard was the synthesised fallback.
  The offline test passed because it asked the selection function in the wrong alphabet.
  **A SELECTION TEST IS NOT A PATH TEST.** Where a recording is chosen by a value that
  comes from a game entity, the test must drive the ENTITY, with the value that entity
  actually stores.
- **A SCENE CHANGE STILL MAY NOT FIRE AN EVENT, BUT ARRIVAL MAY NOT BE SILENT EITHER.** The
  first event after a scene change was up to 66 seconds out, which is indistinguishable
  from a dimension with no sound in it. It is now 11-24s. The eleven-second floor is
  load-bearing: below ten and the sound reads as a reaction to the door the player just
  walked through. Do not lower it.
- **THE AUDIO SYSTEM HAS A VOICE FOR THE INTERFACE, AND IT IS BOUND ONCE.** `ui.click` sat
  in `AUDIO_CUES` from Phase 34 with no call site at all. It is now ONE delegated
  capture-phase listener over a list of interface controls — never a play call added to
  each button, which is fifteen chances to double it or miss one. Gameplay surfaces (the
  hotbar, the inventory, the crafting rows) are excluded: they already have their own
  voices and a menu click on top would be two sounds for one action.
- **THE FIRST CLICK OF A SESSION CANNOT USE A RECORDING.** It is the click that opens the
  AudioContext, so nothing can be decoded yet. `playUiClick` therefore follows the same
  rule as every other cue: the recording is tried first and a synthesised voice answers
  when it is not there. Verified live — first click synthesised, second recorded.
- **A SUSPENDED CONTEXT MUST BE ABLE TO COME BACK.** The build called `ctx.resume()`
  NOWHERE. A backgrounded tab returned with a perfect graph and permanent silence, and
  every diagnostic reported success. There is now one `resumeContext()`, armed on
  visibilitychange, on focus, on the next gesture, and on every dimension change. **Never
  work around a suspended context with an always-playing silent buffer.**
- **DEBUG ENTRY IS NOT A SEPARATE AUDIO PATH AND MUST NOT BECOME ONE.** The director is
  driven from player state every frame rather than from an entry hook, so a teleport, a
  save load, a New Game and normal progression are indistinguishable to it. That is why
  the developer teleports were never the cause. Keep it that way.
- **REQUESTED, STARTED, CONNECTED, AUDIBLE ARE FOUR DIFFERENT CLAIMS.** `setBed()` claims
  its slot BEFORE the decode lands and leaves it claimed if the load fails, so the slot
  table will report a bed playing when nothing plays. `tests/audio-audit.js` now meters the
  live graph and reports all four separately. When the question is "what does the player
  get", this is the tool.
- **AND THE 34.1 LESSON, RESTATED BECAUSE IT RECURRED.** A test that only bounds one side
  is half a test. "Sparse" became cover for "silent" in Phase 34; "distant" became cover
  for "silent" in 34.1. Every level check added here carries a FLOOR as well as a CEILING,
  including the Behemoth's arrival, which previously passed at 0.008.
- **AND THEN A HUMAN PLAYS IT.** Unchanged and permanent. Nothing in this repository has
  been listened to.

---

# 61.07. PHASE 34.3 — THE FORENSIC INVESTIGATION, AND THE ROOT CAUSE OF ALL THREE REPORTS

Phase 34.2 traced the chain in a real browser and shipped green again. The same human
played it again and reported: menu clicks work, some Stalker sounds work, and the
Overworld, the Farmlands and Static Suburbia have no ambience at all. This time one sound
was traced through the entire live path with a meter on every bus, and the fault was not
in the audio system. See `PROGRESS.md` section 0.000000000000000 for the full record.

**THE ROOT CAUSE: THE GAME WAS BEING OPENED AS A FILE, NOT SERVED.**

From a `file://` page a browser refuses `fetch` and `XMLHttpRequest` for a local file, and
taint-silences the one transport that does load (an `<audio>` element reaches
`createMediaElementSource` as digital silence). All three were measured in Chromium during
this phase. There is no fourth route: **Web Audio cannot receive a local file from a
`file://` page**, and no amount of work inside this repository can change that.

So every one of the 274 runtime files failed, permanently, in every session. Measured at
the master bus before the fix, in daylight: the Overworld **-inf dBFS**, the Farmlands
**-inf dBFS**, Static Suburbia **-59.9 dBFS**. Not quiet. Silent.

**WHY IT LOOKED LIKE A MIX PROBLEM FOR THREE PHASES.** Every sound the player still heard
has a SYNTHESISED twin that runs when the recording does not — the footstep, the menu
click, the Stalker's proximity pulse. Every sound that vanished is recording-only, and
environmental ambience is all of it. Three consecutive playtests reported exactly the
procedural voices and never once a recording, which is why normalising every file (34.1)
and rewriting the distance curve (34.2) changed nothing a human could hear: both were
corrections to files that were never arriving.

RULES THAT NOW HOLD:

- **THE GAME MUST BE SERVED OVER HTTP. OPENING `game.html` FROM DISK CANNOT PLAY ANY
  RECORDING.** `python3 -m http.server 8000` in the repository root, then
  `http://localhost:8000/game.html`. This is a browser security property, not a bug, and
  it is now the first thing `PROGRESS.md` and `tests/README.md` say.
- **A DEAD TRANSPORT IS A DIFFERENT FAULT FROM A DEAD ASSET, AND IT IS REPORTED.** Failure
  is a normal, latched, silent outcome per key — correct for one file and wrong for all of
  them at once, because losing the whole library is a missing SUBSYSTEM. `transportDead()`
  is the aggregate the library never had, and `Game._reportAudioTransport()` states the
  cause AND the remedy, once, on the start screen, in the settings panel and in the
  console. Never in the HUD and never in the world — sections 53 and 57 are not suspended
  because a message is technical.
- **A BED THAT FAILED IS NOT STILL LOADING.** `setBed` left a failed slot marked
  `starting` forever, so the whole engine could ask "is a recording on its way" and get
  yes, permanently, for a file that was never coming. One assignment; the state is honest
  and the overlay's LOADING / DEAD distinction is now true.
- **THE FALLBACK CONTRACT IN SECTION 61 WAS HALF TRUE AND IS NOW WHOLE.** "The build is
  fully audible with `assets/audio/runtime/` deleted" held for one-shots and was FALSE for
  ambience: the synthesised bed was scaled by `nightAmount`, which is zero at noon, and
  Static Suburbia returned before reaching the switch at all. A build with no audio files
  was silent in daylight. `AUDIO_FALLBACK_BED` closes both holes.
- **A FALLBACK MUST BE INVISIBLE TO A HEALTHY BUILD.** It engages only when no recording
  is live AND none is pending AND that has held for `AUDIO_FALLBACK_SETTLE`, and it stands
  down through the Haven and the finale. Measured across five real bed crossfades and
  three dimension teleports on a served build: peak **0.00000**. The first version used a
  timer alone and swelled to 0.218 across a teleport — the browser probe caught it, which
  is the whole argument for building the probe.
- **AND THE LESSON, FOR THE THIRD TIME, IN ITS SHARPEST FORM.** `tests/audio.js` already
  404ed every asset and asserted a footstep still sounded, and called that "fully
  audible". It tested the one category that has a synthesised twin and never asked about
  the category that does not. "Sparse" became cover for "silent" in Phase 34; "distant"
  became cover for "silent" in 34.1; **"a footstep still sounds" became cover for "the
  world is silent" in 34.2.** When a test stands in for a whole claim, ask which half of
  the claim it actually covers.
- **A GAIN VALUE IS NOT A SIGNAL.** Every silent bed in every playtest had `gain 0.85`,
  a live source, a connected graph and a running context. Reading those proved nothing and
  cost two phases. `debugAudioTrace()` hangs an AnalyserNode off every bus and reports what
  FLOWED; `debugAudioProbe(key)` plays one asset flat and spatialised for comparison. Both
  are read-only and leave nothing behind. Reach for them before reading source.
- **AND THEN A HUMAN PLAYS IT.** Unchanged and permanent. Nothing in this repository has
  been listened to. This phase changes what the game sounds like and is not complete until
  someone has played it — **served over HTTP** — and said so.

# 61.1. PHASE 34's ORIGINAL BRIEF — CLIMAX AUDIO / VISUAL INTEGRATION

Kept because it is still the standard the climax is held to.

Fake Haven and the final scene should feel like one connected experience.

Haven:

- warm
- safe
- quiet
- comforting

Transition:

- audio softens
- world blurs
- environment becomes distant

Final:

- silence/minimal ambience
- distant sound
- movement
- partial reveal
- impact
- horror music
- scale reveal
- hard cut

Do not spam screen shake.

---

# 62. PHASE 35 — COMPLETE DIMENSION COHESION — COMPLETE

PHASE 35 CARRIED THIS OUT. The chain from the Overworld to Static Suburbia was BROKEN in
normal play and is not any more; every dimension crossing now runs one teardown; and the
Farmlands contain the material the next rift needs. This section is now a statement about
the code, not an intention. See `PROGRESS.md` section 0.0000000000000000.

The original brief is kept below, because it is still the standard the dimensions are
held to.

# 62.1. THE FAULT PHASE 35 EXISTED FOR

**THE LEVEL 2 -> 3 RIFT COULD NOT BE OPENED. AT ALL. IN ANY BUILD.**

`AnchorMonumentManager.powerRiftCore` refuses outright if a rift is already open on that
manager — correctly, since one Anchor holds one record. Nothing put the rift down when
the player walked through one: `removeAnchor()` was called when the Anchor BLOCK was
broken and by the New Game / Load teardown, and by nothing else.

So `riftActive` stayed true from the moment the player first crossed into the Farmlands,
and every consequence followed from that one boolean:

- A player who reached the Farmlands, found the Level 2 Rift Core Disk exactly where
  section 45 guarantees it, raised an Anchor and fed the Disk to it got **nothing** — no
  rift, no glyph, and the Disk not even consumed. **Static Suburbia, the Fake Haven and
  the finale were unreachable without a developer command.**
- A powered rift is the highest-priority objective override in the game, so
  **"Enter the Rift." was on screen from the first frame of the Farmlands and never
  left** — the whole Phase 20 journey chain was unreachable.
- The audio director selects the Rift scene within 20m of a powered Anchor, against an
  `activeAnchor` whose coordinates were in a dimension that had been unloaded.
- The monument's chunk stayed pinned, so a chunk of the previous dimension stayed
  resident for the rest of the session.

It was measured in a real browser before and after, and both are in
`tests/browser-transitions.js`, which now walks the entire chain with no debug command
in it.

# 62.2. THE RULES THAT CAME OUT OF IT

- **A CROSSING PUTS DOWN THE DIMENSION IT IS LEAVING BEFORE IT PICKS UP THE NEXT ONE, AND
  IT DOES IT IN ONE PLACE.** `Game._leaveDimension()`. There were four ways out of a
  dimension and each put down a different amount: the Haven's teardown was thorough, the
  developer teleports kept a second copy of it, and the two RIFT transitions — the ones a
  player actually uses — wiped the chunks and flipped a boolean. There is one now, and the
  dev teleports call it rather than keeping their own list, which is what makes "no
  transition needs a debug command" a structural property instead of something to
  re-check.
- **WHAT A CROSSING DOES NOT TOUCH IS AS FIXED AS WHAT IT DOES.** Not the inventory (what
  the player carries is theirs), not the compass or the milestones (progression, not
  dimension state), not the environmental-story latch (a callback needs the memory of its
  original — that is the entire point of Phase 31), not the save, and not the objective:
  the caller re-resolves that AFTER flipping the dimension flags, because an objective
  resolved inside the teardown is resolved against the dimension being left.
  `tests/transitions.js` asserts both halves.
- **AN ANCHOR IS A BLOCK, AND THE BLOCK STAYS WHERE IT IS.** This is STORY.md section 7
  and section 9 read literally: an Anchor is crafted, not found, and feeding it a Core
  does not move the player — "the world around them is re-decided, and they are standing
  in the result". The monument is part of the volume being re-decided. It does not cross.
  So the player raises a NEW one on the other side, which is the canon's own model of
  progression: they assert, they are not awarded.
- **THEREFORE A DIMENSION THAT HANDS OUT A CORE DISK MUST CONTAIN FOUR PLANKS.** The
  Farmlands did not. `ASH_WOOD` is the only tree in the dimension, it is in `WOOD_BLOCKS`,
  it takes an axe, the Phase 28 cue reads CHOP against it — and `destroyBlock` dropped
  **nothing** for it, in every build. `ITEM.ASH_LOG` and one recipe row close it. It is
  its own item rather than a second source of Oak Log, because an ashen trunk is not an
  oak and section 14 is about not lying to the player with a label.
- **AN ITEM ID IS A SAVE-FILE VALUE. APPEND, NEVER INSERT.** The same rule section 57
  wrote for the furniture catalogue, and for the same reason. `ASH_LOG` is the last id.
- **A RIFT DOES NOT FIRE ON THE FRAME IT OPENS.** The trigger is a radius around the
  monument and the monument is something the player RIGHT-CLICKS, so they are standing
  inside the radius at the moment they feed it the Disk: the dome recolouring, the glyph
  spinning up and the zap were all being rendered into a world that had already been
  replaced. `riftArming` is one number `dt` is subtracted from — not a countdown, not a
  mechanic, and nothing to escape. Standing outside the radius is unaffected.
- **A PLAYER RESPAWNS IN THE DIMENSION THEY DIED IN.** Phase 5A carved the Haven out of
  `_respawn` because the Overworld was no longer loaded and sending them there was
  sending them into a void. Every word of that was equally true of the Farmlands and
  Suburbia, and `_respawn` sent them there anyway — with the Core Disk spent and the
  Anchor in another dimension, one death would have ended the run in place. Latent rather
  than live, because nothing in Levels 2 or 3 damages the player; closed now, before
  something does.
- **AN ANCHOR IN A SAVE BELONGS TO THE DIMENSION THE SAVE NAMES.** The three dimensions
  are disjoint bands of one coordinate space, so this is a pure coordinate test
  (`dimensionOfWorldPos`). A record that fails it is dropped and the repair is reported —
  which is how a save written by a pre-Phase-35 build in the Farmlands, carrying the
  Overworld's powered Anchor, is repaired in place instead of rebuilding the fault.
- **THE RIFT CHAIN IS ONE-WAY, AND THAT IS THE DESIGN.** There is no return rift, and
  there should not be: there are exactly three Cores and each is a hinge (STORY.md
  section 9). "Returning through a Rift where intended" is therefore satisfied vacuously,
  and a future phase that wants a return needs a fourth Core, which section 9 forbids.

# 62.3. AND THE AUDIO LESSON, IN A NEW PLACE

`build_runtime.py` states a peak ceiling of -1.5 dBFS and says no asset may clip once its
gain is applied. It computed a one-shot's peak from a **mono 22.05 kHz downmix** — which
low-passes at 11 kHz and averages the channels, i.e. destroys exactly the measurement it
was being used for — and then applied the gain to the full-rate file. The ceiling was
never enforced for any `sfx`: fourteen shipped above it and three shipped clipped.

- **MEASURE THE THING YOU ARE ABOUT TO BOUND, NOT SOMETHING NEAR IT.** The level came
  from a windowed RMS, which that downmix is right for. The peak came from the same
  downmix, which it is wrong for. Every bed in the library is correct because a bed has
  always taken both numbers from `measure()`.
- **`tests/tools/measure_runtime.js` IS THE INSTRUMENT THAT WOULD HAVE CAUGHT IT**, and it
  asserts nothing: it decodes all 274 runtime files in a real browser and prints what is
  in them. It had to be a browser, because 121 of them are MP3 and nothing offline in this
  repository can decode one — which is how a fault could sit in half the library unseen.
  Run it after any rebuild of `assets/audio/runtime/`.
- **NO RUNTIME ASSET WAS EDITED BY THIS PHASE.** Attenuating a file that is already
  flat-topped does not un-clip it, and lowering it below its class reference would degrade
  the mix that was tuned against it. The build tool is fixed; the remedy is a rebuild on a
  machine with a full ffmpeg, and this container has none.

# 62.4. THE ORIGINAL BRIEF, KEPT

Audit:

Overworld
→
Farmlands
→
Static Suburbia
→
Fake Haven
→
Final scene

Every dimension should answer:

- What is this?
- Why does it exist?
- What does it reveal?
- How does it change understanding?

Do not add unnecessary major gameplay during cohesion work.

---

# 62.5. PHASE 36 — COMPLETE PLAYABLE ALPHA / FULL GAME AUDIT — COMPLETE

PHASE 36 CARRIED THIS OUT. The whole game has been walked from a real New Game to the
credits in a real browser, over HTTP, with no debug command in it — and five ways the
build could take a run away from a player were found and closed. This section is now a
statement about the code, not an intention. See `PROGRESS.md` section 0.00000000000000000.

**THE FINDING THAT MATTERS MOST IS NOT ANY OF THE FIVE BUGS.** All thirty-one offline
suites and all nine browser suites were GREEN on the build this phase started from. Every
fault below was found by reading the shipped code against the question "what happens to a
player here". None of them was a broken function. This is the same shape as 34.1, 34.2 and
34.3, and it is the reason Phase 36 exists as a gate rather than as a feature.

# 62.5.1. THE FIVE WAYS A RUN COULD END, AND WHAT NOW HOLDS

- **A GATE THAT DECIDES WHETHER THE GAME CAN BE FINISHED MAY NOT BE A ONE-SHOT BOOLEAN
  UNLESS THE THING IT GATES IS SAVED.** `behemothSpawned` was written into the save; the
  Behemoth was not, because no mob is. Save on the third night, or refresh the page and
  press CONTINUE, and the gate had fired on a creature that no longer existed — and it
  carries the only Level 1 Core Disk in the game, so everything after it was unreachable
  for the rest of that save. The same dead end was reachable with no save at all: walk
  away from it past `CHUNK_UNLOAD_RADIUS` and it falls through a disposed chunk forever.
  The gate now asks LIVE STATE — `dayCount >= 3`, the Disk never collected, no Disk on the
  ground, no Behemoth standing. `behemothSpawned` is still written and still saved and no
  longer decides anything.

- **A MOB BELOW `MOB_VOID_Y` IS REAPED, AND IT IS NOT A DEATH.** No loot, no kill count,
  no sound. It was never killed; it is not there. Without this the Behemoth's own gate
  would stay shut on a Behemoth nobody can reach.

- **A POWERED ANCHOR HANDS ITS DISK BACK WHEN IT IS BROKEN.** Feeding a Disk consumes it;
  the monument is a block with three seconds of hardness that the game has spent the whole
  run teaching the player to left-click. One click destroyed the rift and the only key
  that could open it. Refusing the break would have been an invisible wall (section 65);
  returning the Disk is the honest answer and needs no rule explained. It returns the
  RIGHT Disk — a Level 1 Disk is inert against a Farmlands Anchor.

- **A BUTTON MUST DO WHAT IT SAYS.** The Behemoth's victory screen offered ENTER THE
  SHATTERED FARMLANDS and ran `_advanceStage()` — difficulty up, nights required three to
  four, and the player teleported back to the world spawn away from the Anchor they had
  just raised. `pendingLevel2Transition` is never true when that screen is up. The screen
  now dismisses and says `CORE DISK RECOVERED` / `CONTINUE`; the crossing is the rift and
  has been since Phase 5A. `UIManager.winScreenMode` is the record of which screen is up,
  and the Behemoth's no longer borrows `awaitingAdvance`, which means one thing and is
  saved.

- **A FULL-SCREEN PANEL WITH ONE BUTTON IS NOT PART OF PLAY, SO THE WORLD STOPS BEHIND
  IT.** Same shape as the Phase 22 settings pause and written directly above it. The
  Behemoth's screen arrives in the middle of the third night, over live mobs, with pointer
  lock released.

- **EVERYTHING FULL-SCREEN IS CLEARED IN `resetPresentation()`.** `#blackCut` (z 65),
  `#creditsScreen` (z 70), `#fadeWhite` (z 60) and `#winScreen` (z 60) were added and
  never removed by anything, and all four sit ABOVE the settings panel at 56 — which is
  where a New Game is taken from. Phase 33 fixed the HUD's inline `display` for exactly
  this reason and stopped there. Section 53's rule now covers the whole document.

# 62.5.2. THE RULES THAT CAME OUT OF IT

- **A PROGRESSION ITEM THAT EXISTS ONLY AS A DROPPED ENTITY IS UNSAVED, AND THEREFORE
  LOSABLE.** A Rift Core Disk lives in a container, then on the ground, then in the pack.
  The middle state is not in the save and Q drops the held stack. The loader now returns a
  Disk that was HELD, is not carried, and has not been SPENT — three questions answered by
  fields the save already had (`riftDisks`, the inventory, `dimensionsBreached` / the
  anchor record / `fakeHavenTriggered`). Reported like every other repair. **The save
  schema did not change and is still version 5.**

- **THE OBJECTIVE LINE IS PRESENTATION AND TICKS ON WALL-CLOCK TIME.** `dt` is clamped to
  0.06 for physics safety, which makes elapsed time a function of frame rate: on a slow
  machine the quarter-second accumulator took five real seconds and the line lagged the
  state it described. It takes `filmDt`, for the reason Phase 30 wrote down. `filmDt`'s
  consumers are now ENUMERATED BY NAME in `tests/opening.js` rather than counted, and the
  five simulation systems are separately asserted to be on the clamped delta.

- **A DRAIN THAT ONLY BOUNDS ONE SIDE IS HALF A MECHANIC.** Static Suburbia's Sanity had
  two negative rates and no floor, so a player reached zero in sixty-seven seconds and
  stayed there for the whole of the longest unguided search in the game — reading the
  street through full-strength grain, a 1.15 vignette, channel split and the edge mirage.
  Worse, "standing still is punished" cannot be felt from the bottom of the scale. Walking
  now settles at 34 (`p-breaking`), standing still falls to 8 (`p-lost`), and walking
  recovers at 2.2/s. Nothing else about the dimension changed and Sanity still costs no
  health anywhere. This is the same sentence 61.05 wrote about audio, in a different
  system.

- **AND THE AUDIO LESSON, FOR THE THIRD TIME, IN ITS SHARPEST FORM YET: WHEN A NUMBER IS A
  LIMIT, CHECK THAT THE THING MEASURING IT CAN REPRESENT A VALUE PAST THE LIMIT.**
  `volumedetect` converts to 16-bit before it counts, and 16-bit CLAMPS — so it reported
  `max_volume: 0.0 dB` for a float source whose true peak was **+8.89 dBFS**, and that
  source was `sfx.ui.click`, the interface click bound to every control in the game. It
  shipped with 132 samples pinned flat. `astats` reads the float domain and does not
  clamp. Then a second layer under it: **a computed gain is a PREDICTION**, and
  sample-rate conversion and lossy encoding both raise the peak above the highest sample
  they were given — up to 1.33 dB, measured. `encode_within_ceiling()` encodes, measures
  what came out, and encodes once more FROM THE ORIGINAL if it landed over. Result across
  the 274-file library: **clipped 3 -> 0**, over the ceiling 17 -> 8, of which six measure
  exactly -1.50.

- **REBUILD WHAT CHANGED, NOT EVERYTHING.** A full rebuild rewrites 177 binaries;
  recomputing every gain and comparing showed 145 unchanged. `build_runtime.py` takes a
  comma-separated list of asset KEYS as well as a kind, and 27 files were rebuilt. **No
  original was touched and no filename changed**, so `AUDIO_CREDITS` and `AUDIO_INDEX.md`
  still join.

- **`PLAYTEST.md` IS THE HUMAN GATE AND IT IS PART OF THE BUILD.** It says, first and in
  the largest words available, to SERVE THE GAME OVER HTTP. Everything else in it is a
  list of things to look at and the six questions to ask in each place. A phase that
  changes what the game feels like is not complete until somebody has played it.

- **`tests/playability.js` AND `tests/browser-playability.js` ARE THE GATE'S OWN SUITES.**
  The browser one walks New Game -> opening -> Overworld timber -> real recipes -> a real
  Anchor -> the third night -> the Behemoth's OWN GATE -> a save and a page reload -> the
  kill -> the Disk -> the victory screen's button -> the rift -> the Farmlands -> ash ->
  the guaranteed chest -> the second rift -> Suburbia -> the Disconnected Home -> the
  Level 3 Disk -> the Haven -> the shift -> the finale -> the hard cut -> the credits -> a
  New Game from the credits. **The Suburbia -> Haven leg had never been walked by any
  suite.** Add to these when a future phase finds a new way to strand a player.

# 62.5.3. WHAT PHASE 36 DELIBERATELY DID NOT DO

- **NO ERA 2 WORK AND NO ARCHITECTURE SPLIT.** The voxel renderer, the terrain, the
  structures and the one-file build are all untouched. That is Phase 37 and after.
- **DIMENSION 1 WAS AUDITED FOR CORRECTNESS AND NOT IMPROVED.** It is slow and thin and it
  is scheduled for replacement; polishing it is work thrown away. Its six structural
  problems are written down in ROADMAP.md section 83.1 for the phase that rebuilds it. Do
  not "fix" it with filler.
- **NOTHING WAS ADDED.** No dimension, no mechanic, no enemy, no crafting, no quest. Every
  change in the phase is a repair, a floor on an existing curve, or a test.

---

# 62.6. ERA 1.5.1 — ARCHITECTURE INVENTORY & CONTRACTS — COMPLETE

ERA 1.5.1 CARRIED THIS OUT. The build was measured rather than described, the map and the
contracts were written down, the module skeleton exists, and four isolated blocks were moved
to prove the mechanism end to end. See `ARCHITECTURE.md`, `ARCHITECTURE-INVENTORY.md` and
`PROGRESS.md` section 0.000000000000000000.

**THE SPLIT HAS NOT HAPPENED. DO NOT SAY IT HAS.** 843 lines moved out of 39,992 — 2.1%. The
correct description is: "Era 1.5.1 established the architectural map, contracts and module
skeleton required for the remaining Era 1.5 extraction phases."

THE ONE PROPERTY EVERYTHING ELSE STANDS ON:

  **CLASSIC SCRIPTS SHARE ONE GLOBAL LEXICAL SCOPE.** A `const`, `class` or `function`
  declared at the top level of one classic `<script>` is visible to every script after it,
  including the inline one. So Era 1.5 can move code out of `game.html` WITHOUT CHANGING A
  LINE OF IT — no `import`, no `export`, no bundler, no `window.X =` shims. It was measured
  in Node's `vm` and in a real Chromium BEFORE anything moved, and `tests/architecture.js`
  re-proves it on every run rather than remembering it.

WHAT THE MEASUREMENTS FOUND (all AST-derived, all re-derivable with `tests/tools/inventory.js`):

  **`VoxelWorld` IS FOUR DIMENSION GENERATORS WEARING ONE CLASS.** 13,404 lines, 270
  methods — and 9,611 of those lines (85% of the class, 24% of the whole build) are
  dimension CONTENT, not a world engine: Farmlands 5,469, Suburbia 3,174, Haven 625,
  Overworld 343. The actual engine — streaming, meshing, block access, edits, water,
  light — is about 1,680 lines. It holds 1,107 `BLOCK.` references and 81 `THREE.` ones.

  **DIMENSION IDENTITY IS THREE BOOLEANS ON THE PLAYER.** `player.inFarmlands` /
  `.inSuburbia` / `.inFakeHaven`: 112 references, 35 of them WRITES, across eight owners,
  the Overworld encoded as "all false", and two-true representable. A `DIMENSION` enum
  exists and is used TEN times in the entire build. Adding The Below means a fourth boolean.

  **AND EIGHT PIECES OF GLOBAL MUTABLE STATE IN FORTY THOUSAND LINES.** That is the reason
  a mechanical extraction is safe at all, and it is the best news in the inventory.

RULES THAT NOW HOLD:

- **`src/**/*.js` ARE CLASSIC SCRIPTS.** No `import`, no `export`, no `type="module"`.
  `tests/architecture.js` fails on any of them.
- **ORDER IS THE CONTRACT.** `game.html` declares the load order and nothing else may. A
  module may name a later module only from inside a function body, never at load time —
  which is asserted, not hoped for.
- **A MOVE IS VERBATIM.** The payload of an extracted file must be byte-identical to the
  text removed, plus a header and the `"use strict";` an external classic script does not
  get for free. Tidying while moving makes a behaviour change indistinguishable from a
  relocation. Improve it afterwards, on its own, where a test can see it.
- **NO SUITE READS `game.html` DIRECTLY ANY MORE.** Eighteen of them scanned it as text.
  Left alone, each extraction would have shrunk their coverage while they went on passing —
  the exact failure shape sections 61.05-61.07 name three times. `tests/harness/source.js`
  reassembles the whole build and is what `SRC` means now. **A future phase that adds a
  text-scanning suite uses it too.**
- **THE ERA 2 SEAM IS AT THE STAMPER, NOT AT THE BLOCK.** Putting an interface in front of
  `getBlockWorld` does not help: the problem is that what a farmstead IS and how it is MADE
  are the same 197 lines. Phase 31 already solved this for ten objects — content (`what`,
  block-free) / sites (`where`) / stampers (`how`, and the only code that knows a block id).
  Era 1.5.3 generalises that shape to the other 9,611 lines. Content and sites survive Era 2;
  stampers are replaced wholesale.
- **`tests/architecture.js` IS A RATCHET.** The P0 hotspot counts are CEILINGS measured on
  the Phase 36 build. A phase that adds a fourth dimension boolean, or a THREE reference to
  the HUD, fails. Lower a ceiling when a phase actually improves it; never raise one.
- **THE SAVE SCHEMA IS FROZEN AT VERSION 5 FOR THE WHOLE OF ERA 1.5.** Save keys, item ids,
  block ids, progression ids, dimension names and the edit representation with it. A new
  internal representation gets an ADAPTER, not a version bump.
- **THE AUDIO SYSTEM IS NOT TO BE IMPROVED WHILE IT IS MOVED.** Section 61's three layers
  were re-measured and both hold: `AudioDirector` makes 0 Web Audio calls, `AudioLibrary`
  reads 0 block ids. `SoundEngine` is 2,151 lines of synthesis that works. Move it; change
  nothing in it.

**⚠ AN UNRESOLVED CANON CONFLICT, FLAGGED AND NOT ACTED ON** (section 64 says to flag rather
than implement through it). The `STORY.md` and `ROADMAP.md` uploaded after Phase 36 renumber
the dimensions — new D1 = Shattered Farmlands, D2 = Static Suburbia, **D3 = The Below** —
while the code, this file, the `DIMENSION` enum and `SAVE_DIMENSIONS` all still have D1 =
Overworld. `ROADMAP.md` also says the Era 1 Overworld is discarded as the final D1.
**Nothing was changed to resolve this.** The architecture is deliberately built not to care:
a dimension descriptor carries `id`, `saveName` and a display name as three separate fields,
so a renumbering costs one table edit and no migration.

**AND THE BASELINE IS NOT ALL GREEN, AND IT WAS NOT WHEN THIS PHASE STARTED.** Those same
two doc commits restructured `STORY.md` from `## N. HEADING` markdown to bare numbered
lines and renumbered its sections, which fails 22 document-structure assertions in
`story.js`, `objectives.js`, `haven.js` and `finale.js`. Not one of them is a gameplay or
code check. They were failing before Era 1.5.1 touched anything and they fail identically
after. Reconciling those suites with the new `STORY.md` is a canon decision, not an
architecture one, and it is the author's to make.


# 63. ERA 2

Era 2 is the major visual identity revolution.

Era 1 is about completing the game and establishing its foundation.

Do not start massive Era 2 visual changes prematurely during Era 1 unless
explicitly instructed.

Era 2 is where the project can aggressively push:

- custom geometry
- materials
- visual identity
- environmental detail
- architectural sophistication
- lighting
- post-processing
- creature presentation
- overall anti-Minecraft identity

---

# 64. STORY CONSISTENCY

New content should fit with:

- existing story
- existing dimensions
- Rifts
- Disconnected Homes
- the reconstruction mystery
- Fake Haven
- final entity

Do not invent contradictory mythology just to make one phase interesting.

If a new idea would conflict with the existing story:

stop and flag the conflict before implementing it.

---

# 65. DO NOT OVERWRITE PLAYER FREEDOM

Guided routes are allowed.

Objectives are allowed.

Cinematics are allowed.

But the game should generally avoid:

- invisible walls
- forced movement
- excessive scripted sequences
- artificial corridors
- unexplained teleportation

Whenever possible, guide the player through:

- geography
- architecture
- lighting
- sightlines
- sound
- environmental clues
- destination design

---

# 66. ENVIRONMENTAL GUIDANCE

Good guidance:

- visible landmark
- road bending toward destination
- smoke
- tower
- unusual silhouette
- sign
- water feature
- architectural landmark
- sound source

Bad guidance:

- giant floating arrow
- glowing quest beam
- giant objective marker over mystery
- invisible walls
- arbitrary teleport

The world should communicate where to go naturally.

---

# 67. FAMILIARITY / MEMORY HORROR

Use repetition carefully.

Possible recurring motifs:

- mailbox
- painting
- chair
- fence pattern
- road sign
- tree
- telephone pole arrangement
- architectural detail
- object from another dimension

A familiar object appearing somewhere impossible can be scarier than a monster.

Do not overuse repetition.

If everything repeats, nothing feels special.

---

# 68. IMPORTANT DESIGN RULE:
# FEW STRONG IDEAS > MANY WEAK IDEAS

Do not add mechanics merely because they are technically possible.

A feature should serve at least one of:

- gameplay
- atmosphere
- story
- environmental identity
- player memory
- horror

If a feature does none of these, question whether it belongs.

---

# 69. DO NOT MAKE EVERYTHING PROCEDURAL

Procedural generation is essential for scale.

But some things should be strongly authored.

Especially:

- signature landmarks
- major horror moments
- Disconnected Homes
- Fake Haven
- finale
- important story objects
- major environmental sequences

Procedural systems can place authored components.

Do not assume procedural = better.

---

# 70. MAJOR HORROR LOCATIONS SHOULD FEEL EARNED

A major location should usually be discovered through:

- journey
- geography
- curiosity
- environmental clues
- story progression

not:

"the game spawned the next scary building."

---

# 71. AUDIO PHILOSOPHY

Audio should be spatial and atmospheric.

Use:

- environmental ambience
- wind
- distant sounds
- animal sounds
- machinery
- footsteps
- silence
- music
- horror tones
- spatial creature sounds

Silence is a valid audio state.

Do not fill every second with music.

Music should have a purpose.

Only use legally usable/licensed/free music appropriate for the project.

---

# 72. ASSET / RESOURCE RULES

Prefer:

- shared resources
- reusable models
- reusable geometry
- reusable textures/materials
- bounded pools
- deterministic variants

Avoid creating a unique Three.js material for every object or animal unless
there is a justified reason.

Monitor:

- geometry count
- material count
- texture count
- scene object count
- memory

---

# 73. UI STYLE

UI should eventually feel like:

WHERE IT ISN'T

not:

Minecraft

Avoid:

- generic survival HUD
- giant colorful UI
- childish icons
- Minecraft-like hearts
- generic quest panels

Future UI should emphasize:

- subdued colors
- restrained typography
- atmospheric framing
- functional clarity
- horror identity

Phase 27 established the tokens the whole interface is now built from. They live in
one `:root` block at the top of the stylesheet:

- `--hud-ink` / `--hud-ink-dim` / `--hud-ink-faint`  parchment, for everything read
- `--hud-rule`                                        hairlines
- `--hud-ground`                                      the dark panel fill
- `--hud-brass`                                       selection, and nothing else
- `--hud-warn`                                        a failing body, and nothing else
- `--hud-shadow`                                      legibility over any terrain

Use them. A new interface element that invents its own colour is how the HUD became
five unrelated widgets the first time.

Phase 29 added the TYPE side of the same system — one face, one shadow token, one
four-step size scale — in section 55.1. Use those too: a new interface element that
invents its own size or its own colour is how the HUD became five unrelated widgets the
first time.

Do not redesign the entire HUD outside its scheduled phase unless required
to fix a bug.

---

# 74. OBJECTIVE STYLE

Objective text should be:

- short
- clear
- purposeful
- atmospheric when appropriate

Avoid overly long quest descriptions.

Objectives should not spoil mysteries.

Do not reveal a destination before the player has earned the discovery.

---

# 75. SAVE SAFETY

Never make a save-system change without considering:

- malformed state
- old saves
- version migrations
- missing values
- invalid coordinates
- world-state edits
- unloaded chunks
- dimension transitions

Never silently destroy user progress.

---

# 76. CODE QUALITY

Prefer:

- descriptive names
- consistent naming
- small utilities for reusable logic
- structured data where helpful
- comments around non-obvious systems
- deterministic helper functions
- defensive checks
- bounded loops
- clear state transitions

Typical conventions:

camelCase:
functions and variables

PascalCase:
classes

UPPER_CASE:
major constants

Use comments for WHY something is complicated,
not merely WHAT one obvious line does.

---

# 77. TESTING RULE

A test should prove something meaningful.

Do not create weak tests such as:

"offset function returns more than one value"

when the real requirement is:

"the road visibly bends."

Whenever possible, test the actual player-facing property.

Prefer:

- spatial metrics
- rendered geometry
- traversal
- interaction
- persistence
- real generated chunks
- regression against known baselines

Do not confuse metadata correctness with gameplay correctness.

---

# 78. VISUAL BUG INVESTIGATION

When a visual problem is reported:

Do not immediately guess.

First:

- reproduce
- instrument
- measure
- render
- inspect
- identify cause
- patch
- re-render
- validate

Use the same philosophy that successfully caught:

- chopped animal geometry
- invisible cow legs
- floating sheep wool
- detached horse head
- straight-looking Farmland paths
- yard decoration being overwritten
- chequerboard soil
- trees growing through farmsteads

---

# 79. HONEST REPORTING

Final reports must distinguish:

COMPLETED
PARTIALLY COMPLETE
UNVERIFIED
KNOWN LIMITATION
FAILED / NEEDS FIX

Never say:

"all tests pass"

if some tests were skipped.

Never say:

"browser validated"

if browser validation was unavailable.

Never say:

"looks good"

based solely on code assertions.

Never hide performance regressions.

Never fabricate screenshots.

---

# 80. WHEN AN OPTIMIZATION FAILS

If an optimization is benchmarked and found slower:

- revert it
- document the result
- preserve the correct implementation
- do not fake improvement

A measured negative result is useful project knowledge.

---

# 81. CURRENT REPOSITORY PHILOSOPHY

The repository should remain easy for another development session to
understand.

Before beginning major work:

Read:

- CLAUDE.md
- ROADMAP.md
- current game file

If additional project-state files exist, read them as well.

Do not assume that a previous conversation is available.

The repository itself should contain enough information to continue.

---

# 82. NEVER DELETE BACKUPS CASUALLY

If versioned builds exist:

- do not delete them casually
- do not overwrite historical milestones unless intentionally requested
- preserve known-good baselines

Git history should eventually provide additional protection.

---

# 83. PHASE COMPLETION STANDARD

A phase is complete only when:

- implementation exists
- integration works
- regressions pass
- deterministic behavior is preserved
- performance is understood
- major player-facing requirements are actually tested
- known limitations are recorded
- final build is delivered

"Code exists" is not the definition of complete.

---

# 84. CURRENT DEVELOPMENT PRIORITY

The project is currently in Era 1, and Era 1's implementation work is COMPLETE.

**THE OUTSTANDING GATE IS A HUMAN PLAYTHROUGH.** Phase 36 walked the whole game from a
real New Game to the credits in a real browser and repaired five ways the build could take
a run away from a player, but nothing in this repository has been played and nothing in it
has been listened to. `PLAYTEST.md` is the script, and it must be played from a SERVED
build (`python3 -m http.server 8000`, then `http://localhost:8000/game.html`) — opening
the file from disk plays none of the 274 recorded sounds.

The project is also in ERA 1.5, the architecture split. Era 1.5.1 is COMPLETE (section
62.6): the map, the contracts and the module skeleton exist and four blocks have moved.
**The split itself has not happened** — 843 lines of 39,992, 2.1%. `ARCHITECTURE.md` is the
map and each `src/*/LAYER.md` is that layer's work order, listing by current line range
what moves there and in which phase. The next implementation phase is Era 1.5.2.

The section below is kept because it is still the standard the Farmland chapter is held
to. Phase 20 is COMPLETE.

The immediate phase after Phase 19 was:

PHASE 20:
FARMLANDS JOURNEY + DISCONNECTED HOME 2.0

The most important creative goal is to make the Farmland experience feel
like a unique, memorable chapter rather than a repeat of Static Suburbia.

The main journey should communicate:

You arrived somewhere.
You have somewhere meaningful to go.
The world is interesting enough to make you want to travel.
Something gradually becomes wrong.
You are being guided somewhere.
You eventually realize the place you reached should not exist.

---

# 85. PHASE 20 SIGNATURE EXPERIENCE

The ideal Farmland sequence is approximately:

PLAYER ARRIVAL
↓
MEANINGFUL RURAL ROAD
↓
LARGE WHEAT FIELD
↓
ANIMALS
↓
BARN / FARMSTEAD
↓
OPEN FARMLAND
↓
MASSIVE WATER TOWER
↓
IRREGULAR RED LIGHT ANOMALY
↓
CONTINUE BEYOND TOWER
↓
INCREASING ISOLATION
↓
FAMILIAR / REPEATED DETAILS
↓
GEOGRAPHIC WRONGNESS
↓
MISSING FARM EVIDENCE
↓
DISCONNECTED HOME
↓
BELIEVABLE FARMHOUSE
↓
SPATIAL IMPOSSIBILITY
↓
RIFT CORE DISK

The player can leave the route at any point and explore.

---

# 86. DO NOT TURN PHASE 20 INTO A LINEAR LEVEL

The Farmland is still effectively infinite.

The guided route should be a strong authored thread inside the procedural
world.

The player should be able to:

- leave
- explore
- return
- investigate optional content
- see other farms
- encounter animals
- discover landmarks
- explore water
- wander toward other regions

The route should make the intended journey enjoyable,
not make other exploration impossible.

---

# 87. FINAL RULE

When deciding between two implementation approaches:

Prefer the option that better supports:

BELIEVABILITY
+
PLAYER EXPERIENCE
+
WORLD COHESION
+
DETERMINISM
+
PERFORMANCE

rather than the option that is merely easiest to code.

The project is building a world, not just a collection of mechanics.

The final question for major decisions should be:

"Does this make Where It Isn't feel more like a distinct, memorable horror
game, or does it merely make the code more complicated?"

Choose accordingly.

---

# END OF CLAUDE.md
