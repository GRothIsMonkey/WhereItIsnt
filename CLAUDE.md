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
Phase 28 — Remove Tutorial / Organic Onboarding
Phase 29 — Main Menu Rebirth
Phase 30 — Opening Lore Film
Phase 31 — Environmental Storytelling
Phase 32 — Fake Haven Dream Sequence
Phase 33 — Final Creature / Horror Finale
Phase 34 — Final Audio / Visual Climax
Phase 35 — Complete Dimension Cohesion
Phase 36 — Complete Playable Alpha / Full Audit

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

# 54. PHASE 28 — ORGANIC ONBOARDING

Remove the legacy multi-page tutorial.

Do NOT replace it with another giant tutorial.

Use objectives and contextual prompts.

The player should learn by interacting with the world.

---

# 55. PHASE 29 — MAIN MENU REBIRTH

The main menu should establish the game's horror identity.

Desired atmosphere:

- quiet
- dark
- subtle
- atmospheric
- unsettling

Potential elements:

- barely visible environment
- slow camera
- distant movement
- faint environmental sound
- subtle static
- rare anomalies
- integrated title

Menu options:

- New Game
- Continue
- Settings

The official title is:

WHERE IT ISN'T

The title treatment should be distinctive.

---

# 56. PHASE 30 — OPENING LORE FILM

Phase 30 has been redesigned into a roughly 20-second horror film.

It should:

- begin with darkness
- establish beautiful normality
- introduce subtle wrongness
- briefly show Stalker
- briefly show Behemoth
- show Rifts
- show impossible architecture
- imply dimensions are connected
- imply reality is being reconstructed incorrectly
- hint at why the player is there
- hint at something much larger
- hard-cut into gameplay

The film should NOT explain the entire story.

The player should understand the premise and remain curious.

Creatures should appear in flashes, not become a monster slideshow.

Silence should be used strategically.

Do not spoil the final entity.

---

# 57. PHASE 31 — ENVIRONMENTAL STORYTELLING

Environmental storytelling should communicate the canonical story without
giant lore dumps.

Overworld:

- origin
- survival
- first signs

Farmlands:

- abandonment
- history
- consequence
- rural human traces

Static Suburbia:

- imitation
- repetition
- memory failure
- reality reconstruction

Disconnected Homes:

- increasingly direct evidence of broken reconstruction

The player should learn through:

- seeing
- exploring
- remembering
- noticing

Do not turn the game into a collectible note simulator.

---

# 58. PHASE 32 — FAKE HAVEN

Fake Haven should initially be:

- beautiful
- warm
- comforting
- safe
- dreamlike

The player should ideally WANT to remain there.

The intended structure:

Fake Haven
→
roughly 30 seconds of safety
→
blur/dissolve
→
separate final horror scene

Fake Haven should not immediately scream "this is a trap."

---

# 59. PHASE 33 — FINAL CREATURE

The final creature is NOT a boss fight.

It is a short cinematic horror sequence.

Target:

approximately 30 seconds.

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

# 61. PHASE 34 — CLIMAX AUDIO / VISUAL INTEGRATION

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

# 62. PHASE 35 — DIMENSION COHESION

Eventually audit:

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

The project is currently in Era 1.

The immediate phase after Phase 19 is:

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
