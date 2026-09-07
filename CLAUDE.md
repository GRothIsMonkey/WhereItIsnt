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
