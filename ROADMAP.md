# WHERE IT ISN'T
# MASTER DEVELOPMENT ROADMAP

Former project name:
BLOCK & RUIN

Official current project name:
WHERE IT ISN'T

---

# 0. WHAT THIS ROADMAP IS

This file is the long-term development roadmap for Where It Isn't.

It exists so the project can be continued across development sessions,
context resets, model changes, and implementation environments without losing
the larger creative direction.

This roadmap describes:

- the game's identity
- the intended player experience
- the progression of major development eras
- completed phases
- current phase
- future phases
- major systems
- narrative direction
- visual direction
- horror philosophy
- technical direction
- permanent design decisions

The individual phase prompts contain the precise implementation requirements
for that phase.

This file provides the larger picture.

---

# 1. GAME IDENTITY

Where It Isn't is a stylized semi-realistic liminal survival horror game
built primarily using:

- HTML
- JavaScript
- CSS
- Three.js
- browser APIs
- procedural world generation
- chunk streaming
- custom geometry
- custom collision
- deterministic procedural systems
- environmental storytelling
- survival gameplay
- cinematic horror

The game uses a voxel/chunk foundation but is NOT intended to visually resemble
Minecraft.

The voxel technology is an implementation foundation.

It is not a creative restriction.

The world can use:

- cubes
- slabs
- half blocks
- stairs
- wedges
- roof slopes
- thin geometry
- custom meshes
- low-poly organic shapes
- furniture geometry
- custom architectural components
- custom creature geometry

The goal is to create a distinct visual identity.

---

# 2. CORE GAME CONCEPT

The central horror idea is:

The player enters a world that initially appears familiar and physically
believable.

As the game progresses, the player realizes that reality itself is unstable.

Places, environments, memories, structures, and familiar objects appear to be
being reconstructed incorrectly.

Something is attempting to imitate reality.

It does not understand reality perfectly.

This creates:

- incorrect spaces
- impossible architecture
- repeated places
- missing objects
- objects appearing where they should not
- connected dimensions
- Disconnected Homes
- Rifts
- memory failures
- Fake Haven
- increasingly impossible environments
- creatures associated with the damaged reality
- the final entity

The player should discover this gradually.

The game should not explain the entire truth at the beginning.

---

# 3. TITLE

The official title is:

WHERE IT ISN'T

The title should eventually become thematically meaningful.

The player repeatedly encounters situations where:

- something should be there but isn't
- something is where it shouldn't be
- a familiar place is misplaced
- a familiar object appears in an impossible context
- a place exists where it cannot physically exist
- memory and physical reality disagree

The title should not be reduced to a literal gimmick.

Its meaning should emerge through the player's experiences.

---

# 4. PRIMARY CREATIVE GOALS

Where It Isn't should be:

- memorable
- atmospheric
- mysterious
- unsettling
- beautiful in places
- frightening in places
- mechanically playable
- geographically interesting
- visually distinct
- narratively coherent

It should NOT become:

- Minecraft with horror mods
- a generic voxel survival game
- a generic procedural horror game
- a jumpscare simulator
- a gore simulator
- a monster combat game
- a sequence of disconnected horror gimmicks

---

# 5. HORROR PHILOSOPHY

Horror should primarily come from:

- anticipation
- uncertainty
- isolation
- silence
- scale
- environmental wrongness
- memory
- repetition
- impossible geometry
- distant movement
- subtle creature behavior
- familiar objects in unfamiliar contexts

Not everything should be scary.

Normality is part of the horror.

A peaceful field should sometimes just be peaceful.

A healthy animal should sometimes just be healthy.

A normal farmhouse should sometimes just be a farmhouse.

The game should establish a baseline of reality before violating it.

Rare strong horror moments should be much more effective because the game
does not use them constantly.

---

# 6. VISUAL PHILOSOPHY

The target visual style is:

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

The game should gradually become increasingly distinct from Minecraft.

Use:

- custom geometry
- stronger silhouettes
- richer architectural proportions
- layered materials
- low-poly organic forms
- sub-voxel architecture
- environmental depth
- visual hierarchy
- atmospheric perspective
- controlled lighting
- environmental detail

Do not make the world photorealistic.

Do not make it cartoonish.

---

# 7. GAMEPLAY PHILOSOPHY

The player should:

- explore
- survive
- gather
- craft
- discover
- investigate
- travel
- remember
- notice
- interpret

The game should use objectives to provide direction without turning the world
into a waypoint simulator.

The player should usually understand what they are doing without being told
every answer.

Whenever possible, the world itself should communicate:

- where to go
- what matters
- what is unusual
- what has happened
- what the player should investigate

---

# 8. TECHNICAL PHILOSOPHY

The game uses an effectively infinite / very large procedural world.

Important principles:

- deterministic generation
- chunk streaming
- chunk-local processing
- bounded simulations
- shared resources
- efficient memory use
- stable chunk boundaries
- persistent world edits
- regression testing
- measurable performance

Do not replace working architecture casually.

Do not create expensive global simulations when a bounded local system can
achieve the same gameplay result.

Do not create thousands of unnecessary scene objects.

---

# 9. DEVELOPMENT ERAS

The development roadmap is divided into broad eras.

## ERA 1
Complete the actual game.

Primary goals:

- complete all major gameplay systems
- establish the coherent story
- complete dimensions
- complete major destinations
- complete onboarding
- establish audio
- create Fake Haven
- create the finale
- make the game a fully playable alpha
- identify technical debt
- ensure the full experience works from start to finish

## ERA 2
Major visual identity revolution.

Primary goals:

- push the game far beyond its early voxel appearance
- improve architecture
- improve materials
- improve lighting
- improve environment detail
- improve creatures
- improve UI
- improve animation and presentation
- establish a consistent visual signature

## ERA 3
Deep horror and world depth.

Primary goals:

- deepen mystery
- increase systemic psychological horror
- expand environmental storytelling
- increase world reactivity
- develop recurring anomalies
- deepen creature/world relationships
- strengthen replayability and discovery

## ERA 4
Release quality.

Primary goals:

- polish
- optimization
- accessibility
- compatibility
- save robustness
- audio licensing verification
- final QA
- packaging
- store presentation
- launch preparation

---

# 10. ERA 1 — COMPLETE THE GAME

Era 1 is not intended to be the final visual version of the game.

Its purpose is to make the game:

- complete
- coherent
- playable
- narratively meaningful
- mechanically stable
- structurally sound

Era 2 will later perform the major visual revolution.

---

# 11. PHASE 13 — STATIC SUBURBIA VISUAL REBIRTH

STATUS:
COMPLETE

Purpose:

Transform Static Suburbia from a primitive cube-based environment into a
more believable suburban environment.

Major goals:

- sub-voxel architecture
- better houses
- better roads
- better curbs
- better sidewalks
- better driveways
- better street hierarchy
- better lamps
- better mailboxes
- better landscaping
- improved roofs
- more believable architecture

Static Suburbia should feel like a real neighborhood.

The use of shaped geometry rather than only cubes is important.

This phase established the foundation for later visual progression.

---

# 12. PHASE 14 — STATIC SUBURBIA INTERIOR 2.0

STATUS:
COMPLETE

Purpose:

Turn Suburbia interiors into believable homes rather than empty cube shells.

Room systems include:

- living rooms
- kitchens
- hallways
- bathrooms
- bedrooms
- dining rooms
- laundry rooms
- garages

Furniture includes:

- couches
- chairs
- tables
- TVs
- shelves
- beds
- lamps
- cabinets
- counters
- refrigerators
- stoves
- sinks
- bathroom fixtures
- rugs
- wall objects

Important systems:

- reusable room modules
- furniture models
- interior generation
- functional doors
- walkability
- upper floors
- room reachability
- deterministic layout
- furniture collision awareness

Phase 14 established a strong residential foundation.

---

# 13. PHASE 15 — STATIC SUBURBIA MEMORY HORROR

STATUS:
COMPLETE

Purpose:

Make Static Suburbia psychologically unsettling without simply adding
more monsters.

Core concepts:

- deterministic anomalies
- memory failure
- repeated objects
- altered room relationships
- small inconsistencies
- doors changing
- windows changing
- subtle impossible spaces
- familiar objects appearing incorrectly

Important philosophy:

The neighborhood should mostly remain believable.

Only a small percentage of reality should feel wrong.

The player should begin questioning their memory.

No new monster is required to create the horror.

---

# 14. PHASE 16 — INFINITE SHATTERED FARMLANDS

STATUS:
COMPLETE

Purpose:

Transform the Farmlands from a small isolated area into a very large,
effectively infinite agricultural dimension.

Major systems:

- infinite/effectively infinite chunk generation
- agricultural biome fields
- Rotting Fields
- Ashen Forest
- field generation
- rural terrain
- agricultural layouts
- continuous world generation

Important technical decision:

Literal infinite precision is not possible at arbitrary floating-point
coordinates.

The Farmlands therefore use an effectively infinite region appropriate to
the game's coordinate system.

The world must remain deterministic across extremely long distances.

---

# 15. PHASE 17 — FARMLAND ABANDONED SETTLEMENTS + RURAL HORROR LANDMARKS

STATUS:
COMPLETE

Purpose:

Populate the Farmlands with agricultural settlements and memorable rural
structures.

Structure families include:

- farmhouse variants
- barns
- sheds
- workshops
- cabins
- equipment sheds
- granaries
- animal shelters
- utility structures
- silos
- wells

Rural landmarks include:

- graveyards
- chapels
- great barns
- deep wells
- memorials
- water infrastructure

Important composition:

house
→
driveway
→
yard
→
barn/outbuilding
→
field

Abandoned settlements should feel agricultural rather than randomly
scattered.

Horror landmarks remain rare.

---

# 16. PHASE 17.1 — FARMLAND DENSITY CORRECTION

STATUS:
COMPLETE

Purpose:

Correct the encounter density of farmsteads and rural structures.

The original generation used area spacing that translated into overly long
walking distances.

The system was corrected so the player can reasonably encounter:

- farms
- structures
- minor rural locations

during ordinary exploration.

Major horror landmarks remain rarer.

Important lesson:

Areal density is not the same as player walking encounter distance.

Future content should be validated in actual traversal terms.

---

# 17. PHASE 18 — FARMLAND ANIMALS + RURAL NAVIGATION

STATUS:
COMPLETE

Purpose:

Introduce harmless animals and stronger rural navigation.

Animals:

- cows
- sheep
- chickens
- horses

Animals are not enemies.

Behavior includes:

- idle
- walk
- stop
- turn
- feed
- wander
- grouping
- entering buildings
- unusual stillness
- staring
- alignment
- straight-line movement
- disappearing when unobserved
- freeze-when-watched behavior

Visual deterioration tiers:

- healthy
- slightly rotten
- moderately rotten
- severely rotten

Important rule:

Visual deterioration and behavioral wrongness are partially independent.

A healthy animal can behave incorrectly.

A severely deteriorated animal can behave normally.

Rural navigation was also expanded:

- meaningful paths
- destination relationships
- rural signs
- farm names
- Roth Farm
- route logic

---

# 18. PHASE 18.1 — FARMLAND ROUTE CHARACTER / PATH REBIRTH

STATUS:
COMPLETE

Problem:

The original Farmland roads technically contained route variation but still
looked almost perfectly straight.

Cause:

The previous offset system was structurally limited by the way the local
parcel lookup handled lane positions.

Solution:

- signed distance to lane lines
- curved actual path footprints
- route archetypes
- meaningful route variation
- better junctions
- better driveways
- route continuity

Important visual target:

The actual visible road must curve.

Moving metadata around underneath a straight-looking road is not sufficient.

Typical straight runs were substantially reduced.

---

# 19. PHASE 18.2 — FARMLAND ANIMAL VISUAL REBIRTH

STATUS:
COMPLETE

Problem:

The original animals were chopped/blocky placeholder-like models and their
deterioration was difficult to read.

Solution:

Complete animal visual redesign using custom low-poly parametric geometry.

Major species-specific identities:

COW:
- heavy barrel torso
- broad chest
- thick neck
- muzzle
- horns
- ears
- legs
- hooves
- tail

SHEEP:
- smaller body
- distinct wool masses
- narrow face
- short legs
- hooves
- wool-loss deterioration

CHICKEN:
- compact upright body
- neck
- head
- beak
- comb
- wattle
- wing geometry
- tail fan
- legs
- feet

HORSE:
- large torso
- long legs
- long arched neck
- long head
- mane
- tail
- hooves

Deterioration uses multiple channels:

- coat loss
- body recession
- exposed anatomy
- damaged parts
- asymmetry
- deeper eye sockets

Gore remains restrained.

The animals should be disturbing when deteriorated without becoming
excessive gore monsters.

---

# 20. PHASE 19 — FARMLAND ECOLOGY, ENVIRONMENT + WATER

STATUS:
COMPLETE

Purpose:

Make the Farmlands feel like a real agricultural region rather than a
collection of procedural objects.

Major environmental layers:

FOREGROUND:
- dry grass
- weeds
- stones
- sticks
- leaves
- crop remnants
- mud
- erosion
- small debris

MIDGROUND:
- fields
- farmhouses
- barns
- machinery
- fences
- orchards
- drainage
- ponds
- animals
- farm paths
- utility structures

BACKGROUND:
- barns
- silos
- water towers
- chapels
- tree masses
- Ashen Forest
- distant terrain
- distant water features

Additional systems:

- terrain microvariation
- terrain basins
- soil states
- crop states
- field edges
- fence deterioration
- abandoned machinery
- farmyard identity
- orchards
- drainage
- ashen ecology
- transition zones
- weathering
- debris
- environmental storytelling

Water:

- shallow water
- deeper water
- ponds
- drainage
- channels
- waterlogged areas
- local deterministic flow
- block-break-triggered movement
- bounded simulation
- player wading/swimming
- shore escape
- crop protection
- road protection
- structure protection
- animal compatibility
- chunk continuity

Water must never become an uncontrolled global simulation.

Important visual philosophy:

The Farmlands should feel rural before they feel horrific.

---

# 21. PHASE 20 — FARMLANDS JOURNEY + DISCONNECTED HOME 2.0

STATUS:
COMPLETE  (revised — see below)

See PROGRESS.md for what was built, what was measured, and the known
limitations. The requirements below are unchanged and remain the
specification the phase was built and tested against.

JOURNEY REVISION:
COMPLETE

A human playtest found the systems working and the composition weak: the
Farmlands still read as a procedural grid of roads and destinations rather
than as one road that goes somewhere. The revision changed composition,
navigation and landmark staging only — nothing in Phases 16-19 was rebuilt,
and the water tower, the red light, the farmhouse and the Rift Core Disk are
unchanged.

The journey is now a single authored rural route roughly 1,950 blocks long,
with a landmark chain the eye can rank without any UI:

  ARRIVAL
  -> GIANT FALLEN WATER TOWER      (46 blocks long, 13 high, lying across the road)
  -> MASSIVE STANDING WATER TOWER  (38 tall — unchanged)
  -> GIANT BARN                    (21 to the ridge, 34 across, two silos)
  -> ENORMOUS LIVING TREE          (41 tall, 53 across, in dead land)
  -> DISCONNECTED HOME             (unchanged)

Inside the corridor the procedural lattice is suppressed — the main road is
five blocks wide against three, no road runs parallel to it, crossing lanes
survive at about a third and the doomed ones stop short of the verge. Outside
the corridor generation is unchanged.

See PROGRESS.md section 0 for the full account and the measurements.

PHASE 20.2 — JOURNEY GUIDANCE, LORE INSTRUCTION + COMPASS:
COMPLETE

20.1 built a journey the player had no reason to choose. 20.2 gives them a
reason and the means to act on it, and changes no world generation at all.

  THE INSTRUCTION.  The opening ends, on black and in near-silence, with
  "At the crossroads, go east." — a pause — "Go east." It names no landmark,
  no destination and no mechanic. There is no opening lore film yet (Phase 30
  builds it), so this is authored as the beat that film will END on, behind one
  entry point Phase 30 can call as its last cue.

  THE COMPASS.  A tape, not a dial — a strip of heading sliding behind a fixed
  mark, in the same panel material as the existing clock. It shows direction and
  nothing else: no landmark marks, no distance, no arrow. Earned from the first
  Ancient Chest cracked in the Overworld, which is already mission directive [4],
  so no structure, quest or directive was added. It is progression state rather
  than an inventory item, and it survives every dimension crossing.

  DIRECTIONS WERE DERIVED, NOT ASSUMED.  EAST = +X and NORTH = -Z, from the
  movement basis, the Farmlands spawn yaw and the landmark coordinates, all three
  of which already agreed.

  NOTHING MOVED.  The four-way crossroads is intact and was verified rather than
  rebuilt; all five landmarks are within 40 blocks of their 20.1 distances; the
  player can still go north, south, west or off-road.

See PROGRESS.md section 0.5.

This phase is intentionally broader than the original concept.

The original idea was simply:

build a believable abandoned farmhouse that eventually becomes spatially
impossible.

That remains mandatory.

However, this phase has been expanded because repeating Static Suburbia's
discovery formula would make the game feel repetitive.

Static Suburbia:

explore neighborhood
→
find strange house
→
investigate house

Farmlands:

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
red light anomaly
→
continue beyond tower
→
increasing isolation
→
geographic wrongness
→
evidence of missing farm
→
Disconnected Home
→
spatial horror

---

# 22. PHASE 20 — FARMLAND ARRIVAL

The player should arrive directly onto a meaningful rural path.

The world should NOT begin as:

- huge empty field
- dozens of meaningless paths
- aimless random branching
- obvious procedural maze

Instead the first route should communicate:

"This road goes somewhere."

The player remains free to walk away from it.

The road is a guide, not a prison.

---

# 23. PHASE 20 — WHEAT FIELD

The first meaningful stretch of the route should pass through a substantial
wheat field.

The first impression should be:

- open
- agricultural
- quiet
- beautiful
- slightly lonely

The player should see:

- crop rows
- field edges
- dry vegetation
- fences where appropriate
- distant structures
- broad horizons

Do not make the opening immediately horrifying.

---

# 24. PHASE 20 — ANIMAL ENCOUNTER

The route should naturally bring the player near:

- cows
- sheep
- chickens
- horses

These first encounters should mostly establish normality.

The player should feel:

"There are farms here."

Later, existing Phase 18/18.2 animal behavior can provide subtle wrongness.

---

# 25. PHASE 20 — BARN / FARMSTEAD ENCOUNTER

The path should naturally pass near:

- a barn
- farmyard
- fencing
- machinery
- animals
- fields
- farmhouse or supporting structures

The environment should read as an actual working/abandoned agricultural
property.

This is NOT the Disconnected Home.

It establishes normal Farmland life.

---

# 26. PHASE 20 — MASSIVE WATER TOWER

The signature landmark of the Farmland journey is a MASSIVE water tower.

It should be:

- enormous
- vertically dominant
- visible above fields
- visible above many tree lines
- recognizable from substantial distance
- believable as rural infrastructure
- memorable

Once introduced, it should be very difficult for the player to miss.

The tower serves as:

- navigation landmark
- destination
- visual icon
- horror object

---

# 27. PHASE 20 — WATER TOWER RED LIGHT

The tower has a red light at the top.

The light behaves strangely based on player attention.

When the player looks directly at the tower:

The light is generally dormant.

When the player looks slightly away:

The light may flash.

Important:

The flashes must NOT be rhythmic.

Do NOT use a simple:

flash
wait
flash
wait
flash

pattern.

Use irregular intervals.

The behavior should feel:

- meaningless
- inexplicable
- subtle
- peripheral
- difficult to verify

The player should think:

"Did that actually flash?"

No objective should explain it.

No puzzle should require it.

---

# 28. PHASE 20 — ROUTE BEYOND THE TOWER

The tower is NOT the Disconnected Home.

After the player reaches its vicinity, another route continues deeper.

Possible continuation:

- service road
- older farm road
- overgrown route
- field-edge path
- isolated rural track

The player should realize:

"There is somewhere beyond this."

---

# 29. PHASE 20 — INCREASING ISOLATION

After the water tower:

- fewer animals
- fewer active-looking farms
- more empty fields
- older fencing
- more abandoned equipment
- fewer obvious destinations
- quieter ambience
- more isolated roads
- increasingly empty horizon

The player should slowly become aware of being alone.

Do not suddenly turn the entire environment into a horror zone.

---

# 30. PHASE 20 — GEOGRAPHIC WRONGNESS

Introduce increasingly subtle spatial/reality anomalies.

Possible examples:

- same fence appears twice
- same dead tree appears in impossible locations
- same object appears more than once
- familiar structure returns
- a road seems to lead somewhere unexpectedly
- a landmark seems strangely close again
- field boundaries feel duplicated
- an object from another dimension appears in the Farmlands

The goal is to create uncertainty about the player's perception and
the reliability of the environment.

---

# 31. PHASE 20 — MISSING FARM

Before revealing the Home, show evidence that a farm should exist nearby.

Possible evidence:

- fence posts
- old gate
- tire tracks
- mailbox
- well
- drainage
- field rows
- machinery
- property debris
- old service road

The player should realize:

"There used to be a farm here."

---

# 32. PHASE 20 — DISCONNECTED HOME DISCOVERY

The player eventually sees the farmhouse.

It should initially look believable.

The key problem is not:

"The farmhouse is haunted."

The key problem is:

"The farmhouse cannot physically belong where it is."

The surrounding geography should contradict the property.

Examples:

- tire tracks stop where the driveway should continue
- fence lines do not properly connect
- field rows terminate strangely
- mailbox exists without correct access
- well is positioned incorrectly
- barn relationship is impossible
- drainage suggests a farm that cannot fit in the available space
- the structure footprint contradicts surrounding terrain

The player should identify the Home through accumulated evidence.

Do not use a giant marker.

---

# 33. PHASE 20 — DISCONNECTED HOME EXTERIOR

The original Phase 20 exterior requirements remain mandatory.

Create:

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

Use strong believable rural architecture.

Use sub-voxel geometry where it improves quality.

The farmhouse must look like a real place where people lived.

---

# 34. PHASE 20 — DISCONNECTED HOME INTERIOR

The original required spaces remain mandatory:

- living room
- kitchen
- hallway
- bedroom
- utility/bathroom
- storage
- fireplace

Use rural furniture and environmental details.

Possible:

- couch
- chairs
- table
- kitchen
- cabinets
- stove
- sink
- beds
- shelves
- lamps
- rugs
- storage
- fireplace objects
- farm-related household objects

---

# 35. PHASE 20 — HUMAN HISTORY

The player should believe people lived here.

Use subtle evidence:

- family photographs
- calendars
- cookware
- dishes
- farm paperwork
- work clothes
- personal objects
- children's objects
- abandoned meals
- old farm records
- worn furniture

Do not turn the house into a collectible note hunt.

---

# 36. PHASE 20 — SPATIAL HORROR

The interior begins believable.

Then gradually becomes impossible.

Possible effects:

- hallway too long
- stairs that do not fit exterior geometry
- rooms larger than the house allows
- incorrect floor relationships
- impossible doorway relationships
- inverted rooms
- windows showing impossible directions
- fireplaces/chimneys that cannot physically align
- spaces extending beyond the known footprint

The player should eventually understand:

"The inside cannot physically fit inside the outside."

---

# 37. PHASE 20 — BROADER STORY CONNECTION

The Home should suggest that reality is being reconstructed incorrectly.

It is not simply a haunted farmhouse.

It should feel like:

something has reconstructed the concept of a farmhouse
without understanding the physical rules required for the farmhouse to exist.

This becomes an important bridge into the game's larger mystery.

---

# 38. PHASE 20 — LEVEL 2 RIFT CORE DISK

The Level 2 Rift Core Disk remains guaranteed.

It must never become inaccessible.

Test:

- fresh generation
- unload/reload
- leaving and returning
- structure regeneration
- acquisition

---

# 39. PHASE 21 — DROPPED ITEM GROUND CONTACT

STATUS:
COMPLETE

Two independent defects, both measured rather than guessed at, both fixed:

  THE MESH ORIGIN.  position is the item's FOOT, but THREE.BoxGeometry is
  centred on its origin and was drawn at position.y directly, so every dropped
  item was rendered 0.125 blocks below the surface it stood on. The bob, applied
  as +/-0.08 around that already-sunk centre, meant the rendered bottom sat
  between 0.045 and 0.205 blocks UNDER the ground and never once touched it.

  THE LANDING GAP.  On a downward collision the integrator reverted to the start
  of the substep instead of closing the gap, leaving items resting 0.002 to 0.037
  blocks in the air depending on impact speed — and, because the wake-up probe
  only reaches 0.02 down, unable to see their own floor.

Fixed by drawing the mesh where the collider already is, re-basing the bob to
swing up from the surface rather than through it (same rate, same travel, same
desync), bisecting onto the contact surface on the frame of landing, and making
support use the SAME predicate as landing instead of isSolid().

Rendered bottom relative to the support surface went from -0.205..-0.045 to
0.000..+0.160. The item system also ended up 54% CHEAPER than before.

See PROGRESS.md section 0.2.

Purpose:

Fix remaining dropped-item contact problems.

Audit:

- mesh origin
- collider
- ground contact
- uneven terrain
- corners
- walls
- chunk boundaries
- newly mined blocks

Requirements:

- no sinking
- no floating
- no tunneling
- pickup unchanged
- rotation unchanged
- resting bob unchanged
- support wake-up unchanged

---

# 40. PHASE 22 — SETTINGS + GAME OPTIONS

STATUS:
COMPLETE

Six settings, no more: master volume, music volume, SFX volume, mouse
sensitivity, graphics quality (Low / Medium / High) and fullscreen.

The panel is built from the game's own visual language — desaturated bands, a
thin rule, restrained type — rather than a generic web settings page. It opens
with O or from the start screen, closes with Escape, pauses simulation while
leaving the last rendered frame on screen, releases pointer lock on open and
restores it on close, and gates every gameplay input through the existing
UIManager.menuOpen path rather than a second, parallel gate.

Three things the audit found before any code was written, each of which would
have made a naive implementation wrong:

  THE SFX BUS WAS BYPASSED.  Eighteen sound sites connected straight to the
  master gain rather than to sfxBus, so an "SFX volume" slider wired to sfxBus
  would have silently missed most of the game's sounds. They were re-routed.

  MASTER GAIN WAS ALREADY OWNED.  The death sequence ramps master.gain down and
  latches it, so a user volume control writing the same node would fight it. A
  separate userGain node was inserted between master and the destination, which
  leaves every existing cinematic audio behaviour untouched.

  PIXEL RATIO IS NOT THE COST LEVER.  PostFX renders into a WebGLRenderTarget
  sized in CSS pixels and blits, so setPixelRatio alone changes almost nothing.
  The graphics presets drive the render target scale (0.70 / 0.85 / 1.00)
  alongside pixel ratio and shadow map size.

One real defect was found by inspection and fixed: with the settings panel open,
E still opened the crafting bench and I/Tab still opened the backpack on top of
it, orphaning one overlay. Both are now guarded.

Settings persist to localStorage under a versioned key with a schema, per-field
coercion and clamping, so Phase 23 can adopt them without a migration. The full
save system was deliberately NOT built here.

See PROGRESS.md section 0.1.

Purpose:

Create cohesive settings.

Options:

- master volume
- music volume
- SFX volume
- mouse sensitivity
- graphics quality
- performance options where justified
- fullscreen

The settings interface must use the Where It Isn't visual identity.

It must:

- pause gameplay
- correctly release pointer lock
- restore pointer lock
- block gameplay input
- preserve audio state

Do not add excessive options.

---

# 41. PHASE 23 — SAVE / LOAD  — **COMPLETE**

Implement robust browser-local save/load.

Delivered. See `PROGRESS.md` section 0.0 for the schema, the world-delta representation,
the safe-placement rules, the corruption behaviour, what is deliberately NOT persisted
(XP), the one place saving is refused (the Fake Haven) and exactly what was validated in a
real browser.

Persist relevant information such as:

- player position
- current dimension
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
- necessary structure state
- settings

XP MUST NOT be persisted because XP is permanently removed.

Use edited-chunk/world-edit style persistence rather than giant snapshots
where practical.

Include:

- save version
- schema validation
- migration hooks
- repair logic
- invalid-save handling
- position safety
- dimension validation

Never load the player into:

- solid terrain
- invalid dimension
- impossible coordinates

---

# 42. PHASE 24 — CANONICAL STORY FOUNDATION  — **COMPLETE**

Delivered. The canon is in **`STORY.md`** — the authority on what the game means, what
every dimension and entity is for, the player knowledge curve, and the explicit list of
things that must never be explained. Read it before writing any player-facing text.

Purpose:

Create one coherent internal truth for the entire game.

The story must connect:

- Overworld
- Blood Nights
- Stalker
- Anchor Monument
- Hollowed Behemoth
- Rift Cores
- Shattered Farmlands
- Disconnected Homes
- Static Suburbia
- Fake Haven
- Final Entity

The canonical story should explain:

- why the player is here
- what changed
- what the Anchor is
- what the Rifts are
- why dimensions exist
- why the Farmlands became abandoned
- why Suburbia behaves incorrectly
- what Disconnected Homes represent
- why Fake Haven exists
- what the Final Entity represents

The internal truth can be more complete than what the player learns.

Do NOT expose the complete truth to the player.

---

# 43. PHASE 25 — DYNAMIC OBJECTIVE SYSTEM

Create a persistent player-facing objective system.

Objectives:

- guide
- do not spoon-feed
- reflect actual game state
- update after completion
- remain concise
- avoid giant markers

Early example:

Gather wood.

Then:

Craft a basic tool.

Then:

Find coal.

Then:

Craft torches.

Then:

Prepare for night.

Then:

Return to the Anchor.

Then:

Survive until dawn.

Then:

Investigate the Rift.

Farmland objectives should encourage exploration without immediately
spoiling the Disconnected Home.

Suburbia objectives should encourage:

- exploring
- investigating signals
- searching houses
- noticing what doesn't belong
- discovering the impossible house

Fake Haven may initially simply say:

REST.

---

# 44. PHASE 26 — REMOVE XP / REBUILD PROGRESSION

XP is permanently removed.

Remove:

- XP bar
- XP numbers
- XP gain
- XP requirements
- XP levels
- XP combat rewards
- XP tutorial references
- XP save references

Replace progression with:

- tools
- equipment
- recipes
- discoveries
- Rift Core milestones
- story milestones

Do not replace XP with another invisible number.

---

# 45. PHASE 27 — HEALTH / SANITY / HUD REBIRTH

Completely redesign the HUD.

The HUD must not look like Minecraft.

Health should represent:

physical condition
survival

Sanity should represent:

perception
reality instability

Do NOT simply recolor hearts.

Health and sanity should feel visually different.

Integrate:

- objectives
- hotbar
- interaction prompts
- status information

The entire HUD should share one Where It Isn't visual language.

---

# 46. PHASE 28 — REMOVE TUTORIAL / ORGANIC ONBOARDING

Delete the old multi-page tutorial.

Do NOT replace it with another giant tutorial.

Instead:

- objectives
- contextual prompts
- environmental guidance
- player experimentation

The player should learn by interacting with the world.

---

# 47. PHASE 29 — MAIN MENU REBIRTH

Completely redesign the main menu.

The menu itself should feel like part of the horror experience.

Desired qualities:

- quiet
- dark
- atmospheric
- subtle
- unsettling

Possible elements:

- barely visible environment
- slow camera
- subtle static
- distant movement
- environmental sound
- rare anomalies
- imperfect title treatment

Official title:

WHERE IT ISN'T

Menu:

- New Game
- Continue
- Settings

The title should visually feel like a horror game title.

Do not reveal major story information in the menu.

---

# 48. PHASE 30 — OPENING LORE FILM

Create an approximately 20-second horror film after New Game.

The player:

CAN:
- look around
- move the camera

CANNOT:
- walk
- mine
- attack
- open inventory
- manipulate the world

The sequence should:

1. begin in darkness
2. establish silence
3. reveal beautiful normal Overworld
4. introduce subtle wrongness
5. briefly show Stalker
6. briefly show Behemoth
7. show dimensional/Rift imagery
8. show impossible architecture
9. imply reality is being reconstructed
10. imply why the player is here
11. provide a final unexplained visual hint
12. hard-cut into gameplay

Creature appearances should be flashes.

Do not turn the opening into a monster montage.

Do not dump the lore.

The player should understand the premise and remain curious.

---

# 49. PHASE 31 — ENVIRONMENTAL STORYTELLING

Use the canonical story to make the world communicate information naturally.

Overworld:

- origin
- survival
- first warning signs

Farmlands:

- abandonment
- agricultural history
- human absence
- consequences

Static Suburbia:

- imitation
- memory failure
- repetition
- reality reconstruction

Disconnected Homes:

- evidence of impossible reconstruction

Use:

- objects
- layouts
- environments
- photographs
- repetition
- architectural inconsistencies
- subtle environmental clues

Do not turn the game into a note-collecting simulator.

---

# 50. PHASE 32 — FAKE HAVEN DREAM SEQUENCE

Fake Haven should become a genuine dreamlike refuge.

The player should experience approximately 30 seconds of:

- warmth
- comfort
- peace
- familiarity
- safety
- beautiful lighting
- calming audio

The player should initially believe:

"This is somewhere safe."

The sequence should then transition:

Haven
→
blur
→
dissolve
→
audio softening
→
separate final horror scene

Fake Haven should NOT immediately reveal the final monster.

The player should want to stay.

That makes the eventual collapse more powerful.

---

# 51. PHASE 33 — FINAL CREATURE / 30-SECOND HORROR FINALE

This is NOT a boss fight.

It is a cinematic horror sequence.

Sequence:

Fake Haven
→
~30 seconds of safety
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

The creature should be:

- absurdly tall
- extremely thin
- long-limbed
- disproportionately large
- dark
- alien
- difficult to understand
- visually disturbing

Use the provided reference only as inspiration.

Do NOT copy it literally.

The final entity should be much larger and more alien than Stalker or
Behemoth.

---

# 52. PHASE 34 — FINAL AUDIO / VISUAL CLIMAX

Integrate Fake Haven and the final creature into one cinematic climax.

Haven:

- warm
- quiet
- safe

Transition:

- audio softens
- environment blurs
- sound becomes distant

Final:

- silence
- distant movement
- spatial audio
- impact
- selective distortion
- horror music
- scale reveal
- hard cut

The strongest horror tools should be reserved for moments like this.

Do not spam:

- screen shake
- distortion
- horror music
- jumpscares

Their rarity creates impact.

---

# 53. PHASE 35 — COMPLETE DIMENSION / STORY COHESION PASS

Audit the complete relationship between:

Overworld
→
Farmlands
→
Static Suburbia
→
Fake Haven
→
Final Scene

For every dimension answer:

- What is this place?
- Why does it exist?
- What does it reveal?
- How does it change the player's understanding?

Overworld:

beautiful origin
+
survival
+
first warnings

Farmlands:

abandonment
+
history
+
consequences
+
rural isolation

Static Suburbia:

imitation
+
memory
+
reconstruction

Fake Haven:

false safety
+
dream
+
emotional manipulation

Final:

underlying horror

Do not add major gameplay simply for this phase.

Fix contradictions and weak connective tissue.

---

# 54. PHASE 36 — TECHNICAL DEBT / LEGACY CLEANUP

Purpose:

Audit the codebase before final alpha stabilization.

Review:

- duplicate systems
- dead code
- outdated comments
- stale constants
- unused assets
- deprecated APIs
- memory leaks
- duplicated materials
- duplicated geometries
- old tutorial remnants
- old XP remnants
- obsolete progression logic
- contradictory systems
- temporary debug systems
- accidental legacy systems

Do not perform a massive risky rewrite.

The goal is controlled cleanup.

---

# 55. PHASE 37 — SAVE ROBUSTNESS / RECOVERY HARDENING

Purpose:

Take the save/load system from functional to resilient.

Test:

- malformed saves
- incomplete saves
- future schema migrations
- interrupted writes
- invalid coordinates
- invalid dimensions
- corrupted edited chunks
- missing structure state
- old save versions
- repeated save/load
- dimension transitions
- world edits
- unusual player positions

The player should not casually lose their world.

Safe recovery is more important than preserving malformed state perfectly.

---

# 56. PHASE 38 — COMPLETE PLAYABLE ALPHA

Treat the game as a complete playable product.

Play through the intended full experience:

MAIN MENU
→
OPENING LORE FILM
→
OVERWORLD
→
OBJECTIVES
→
SURVIVAL
→
BLOOD NIGHTS
→
STALKER
→
ANCHOR
→
HOLLOWED BEHEMOTH
→
RIFT
→
SHATTERED FARMLANDS
→
ABANDONED SETTLEMENTS
→
FARMLAND ANIMALS
→
FARMLAND ECOLOGY
→
FARMLAND DISCONNECTED HOME
→
STATIC SUBURBIA
→
ENTERABLE HOMES
→
MEMORY HORROR
→
SUBURBIA DISCONNECTED HOME
→
FAKE HAVEN
→
BLUR / DISSOLVE
→
FINAL CREATURE
→
CREDITS

Audit:

GAMEPLAY:
- movement
- mining
- crafting
- combat
- knockback
- item drops
- progression

STORY:
- coherence
- clarity
- mystery
- consistency

OBJECTIVES:
- understandable
- correctly triggered
- not annoying
- no broken states

HUD:
- health
- sanity
- objectives
- inventory
- prompts

DIMENSIONS:
- identity
- streaming
- transition

AUDIO:
- ambience
- music
- horror
- transitions
- finale

SAVE:
- save
- load
- corruption
- recovery
- persistence

SETTINGS:
- volume
- controls
- graphics
- fullscreen

XP:
must remain completely absent.

OLD TUTORIAL:
must remain completely absent.

FULL-CUBE DEPENDENCY:
must not be required for newer architectural content.

---

# 57. ERA 1 COMPLETION DEFINITION

Era 1 is complete when:

- the game can be played from beginning to end
- all major dimensions exist
- progression works
- saving works
- objectives work
- onboarding works
- story is coherent
- major locations are complete
- Fake Haven works
- finale works
- audio works
- major regressions are resolved
- performance is understood
- the game qualifies as a complete playable alpha

Era 1 is NOT supposed to represent the final visual quality.

---

# ERA 2 — REBIRTH

Status: Planned

Target Start:
Immediately following completion of Era 1 Alpha.

---

# Vision

Era 1 proves that Where It Isn't works.

Era 2 transforms Where It Isn't into the game it was always meant to become.

The purpose of Era 2 is not to create a sequel.

The purpose of Era 2 is not to restart development.

The purpose of Era 2 is to rebuild the presentation, atmosphere, visual identity, and horror delivery while preserving the completed Era 1 experience.

Players should recognize:

- The same story
- The same journey
- The same dimensions
- The same landmarks
- The same progression
- The same mystery

But should no longer recognize the game as a voxel game.

By the end of Era 2:

Where It Isn't should stand visually beside modern indie horror games rather than voxel survival games.

---

# Core Rebirth Rules

## Rule 1

Never remove completed story content.

## Rule 2

Never remove dimensions.

## Rule 3

Never remove major landmarks.

## Rule 4

Never restart progression systems.

## Rule 5

Every Rebirth phase must reduce the game's voxel identity.

## Rule 6

Every Rebirth phase must increase the game's horror identity.

## Rule 7

Atmosphere always comes before realism.

## Rule 8

The game should feel lonely, hostile, and mysterious.

## Rule 9

If a feature only exists because the game was voxel-based, it should be reconsidered.

## Rule 10

Preserve the soul of the game at all costs.

---

# Phase 1 — Foundation Rebuild

Goal:

Prepare the engine for a non-voxel future.

---

## Tasks

- Separate gameplay from rendering
- Separate progression from rendering
- Separate AI from rendering
- Separate terrain generation from rendering
- Remove cube assumptions
- Create world abstraction layers
- Create rendering abstraction layers
- Future-proof all core systems

---

## Success Criteria

Nothing changes visually.

The player should not notice this phase.

This phase exists solely to make every future Rebirth phase possible.

---

# Phase 2 — Terrain Rebirth

Goal:

Destroy the blocky terrain silhouette.

---

## Tasks

- Smooth terrain rendering
- Natural slopes
- Natural hills
- Natural valleys
- Terrain blending
- Cliff systems
- Erosion systems
- Improved river generation
- Improved coastlines
- Improved horizons

---

## Success Criteria

The player no longer sees cube-shaped terrain.

The world immediately stops resembling Minecraft.

---

# Phase 3 — Vegetation Rebirth

Goal:

Remove voxel vegetation entirely.

---

## Tasks

- Real grass
- Real crops
- Real bushes
- Real trees
- Dead tree systems
- Wind simulation
- Seasonal support
- Terrain-specific vegetation

---

## Horror Objective

The environment should feel alive.

Not safe.

Not comfortable.

Alive.

---

## Success Criteria

Players stop noticing cubes.

Players start noticing silhouettes.

---

# Phase 4 — Lighting Rebirth

Goal:

Create the final atmosphere.

---

## Tasks

- Volumetric fog
- Dynamic fog density
- Dynamic shadows
- Improved darkness
- Better night rendering
- Sky overhaul
- Sunrise overhaul
- Sunset overhaul
- Distance haze
- Atmospheric color grading
- Weather systems

---

## Horror Objective

Darkness should feel oppressive.

Distance should feel uncertain.

---

## Success Criteria

A screenshot should immediately feel unsettling.

---

# Phase 5 — Overworld Rebirth

Goal:

Transform the weakest visual area of the game.

---

## Problems To Solve

Current Overworld risks:

- Minecraft comparisons
- Generic survival feeling
- Familiar terrain language
- Weak visual identity

---

## Tasks

- Terrain redesign
- Structure redesign
- Visual language redesign
- Environmental storytelling
- Landmark expansion
- Horror atmosphere improvements

---

## Preserve

- Blood Nights
- Stalkers
- Behemoths
- Rift progression

---

## Success Criteria

The Overworld becomes uniquely Where It Isn't.

---

# Phase 6 — Landmark Rebirth

Goal:

Turn every major landmark into something unforgettable.

---

## Great Tree

Tasks:

- Massive scale increase
- Disturbing silhouette
- Audio presence
- Visible for extreme distances

---

## Water Towers

Tasks:

- Real industrial design
- Rust
- Corrosion
- Structural decay

---

## Giant Barn

Tasks:

- Real architecture
- Interior storytelling
- Environmental clues

---

## Disconnected Home

Tasks:

- Complete visual overhaul
- Greater mystery
- Better horror presentation

---

## Success Criteria

Players remember landmarks years later.

---

# Phase 7 — Shattered Farmlands Rebirth

Goal:

Create the game's defining experience.

---

## Philosophy

Farmlands should feel endless.

Farmlands should feel wrong.

Farmlands should feel watched.

---

## Tasks

- Road redesign
- Field redesign
- Environmental storytelling
- Weather systems
- Distance fog
- Horizon improvements
- Landmark upgrades

---

## The Eastward Stalker

Major encounter system.

Stage 1:

Audio behind the player.

Stage 2:

Movement in distant fields.

Stage 3:

Brief sightings.

Stage 4:

Movement behind trees.

Stage 5:

Full reveal.

Stage 6:

Chase sequence.

Stage 7:

Escape sequence.

---

## Success Criteria

Farmlands becomes the most discussed dimension in the game.

---

# Phase 8 — Static Suburbia Rebirth

Goal:

Create one of the strongest liminal horror environments ever built into the project.

---

## Tasks

- Real neighborhoods
- Better streets
- Better houses
- Better interiors
- Impossible architecture
- Reality distortion systems
- Environmental storytelling

---

## The Neighbor

Primary horror encounter.

Stage 1:

Distant observation.

Stage 2:

Window sightings.

Stage 3:

Street sightings.

Stage 4:

Impossible appearances.

Stage 5:

Final confrontation.

---

## Success Criteria

Players become afraid to look behind them.

---

# Phase 9 — Fake Haven Rebirth

Goal:

Perfect false comfort.

---

## Tasks

- Beautiful visuals
- Warm lighting
- Safe atmosphere
- Comfortable architecture
- Environmental deception

---

## Horror Objective

Players should trust Haven.

Then regret trusting Haven.

---

## Success Criteria

The reveal lands harder than in Era 1.

---

# Phase 10 — Audio Rebirth

Goal:

Create the final audio identity.

---

## Music

- Overworld themes
- Blood Night themes
- Farmland themes
- Suburbia themes
- Haven themes
- Ending themes

---

## Horror Audio

- Distant sounds
- Environmental whispers
- Dynamic tension systems
- Chase themes
- Audio stingers

---

## Success Criteria

Players recognize Where It Isn't from audio alone.

---

# Phase 11 — Cinematics

Goal:

Deliver the final narrative presentation.

---

## Tasks

- Intro film
- Rift film
- Farmland film
- Suburbia film
- Haven film
- Ending film

---

## Success Criteria

The story reaches its final presentation quality.

---

# Phase 12 — Horror Expansion

Goal:

Create unforgettable moments.

---

## Rules

No cheap jumpscares.

No constant screaming.

No spam.

Every scare must matter.

---

## Tasks

- Stalker encounters
- Neighbor encounters
- Rare events
- Environmental scares
- Dynamic horror systems

---

## Success Criteria

Players remember specific moments years later.

---

# Phase 13 — World Polish

Goal:

Turn good areas into great areas.

---

## Tasks

- Environmental storytelling
- Detail passes
- Visual cleanup
- Additional discoveries
- Hidden lore
- Secret encounters

---

## Success Criteria

Every dimension feels complete.

---

# Phase 14 — Release Candidate

Goal:

Prepare for commercial launch.

---

## Tasks

- Optimization
- Bug fixing
- Performance
- Achievements
- Demo
- Trailer
- Steam page
- Final QA
- Marketing assets

---

# End of Era 2

Players should say:

"The game where you travel east through the broken countryside."

"The game with the impossible neighborhood."

"The game with the giant dead tree."

"The game with the thing following you through the fields."

Not:

"The Minecraft horror game."

The Rebirth is complete when the visual identity of Where It Isn't becomes entirely its own.

# 67. ERA 3 — DEEPER CREATURE HORROR

Potential future systems:

- stronger environmental reactions
- more sophisticated stalking
- more subtle entities
- unusual behavior
- creatures visible only indirectly
- creatures that respond to observation
- distant movement
- silhouettes
- sound-driven encounters

Do not turn every creature into a combat encounter.

---

# 68. ERA 4 — RELEASE QUALITY

Final production goals:

- performance
- compatibility
- save stability
- accessibility
- audio legality/licensing
- input reliability
- UI polish
- loading behavior
- error recovery
- browser compatibility
- asset verification
- packaging
- store screenshots
- trailer
- title treatment
- credits
- final QA

The game should be evaluated as a product, not just a prototype.

---

# 69. PERMANENT DESIGN DECISIONS

These should not be reversed casually.

## GAME NAME

Where It Isn't.

## XP

Removed permanently.

## VISUAL IDENTITY

Voxel foundation is allowed.

Minecraft appearance is not the goal.

## ANIMALS

Animals are not enemies.

## ANIMAL DETERIORATION

Visual deterioration and behavior remain partially independent.

## HORROR

Normality and restraint are important.

## FARMLANDS

Farmlands must have their own identity.

## STATIC SUBURBIA

Static Suburbia and Farmlands must not feel like reskins of each other.

## DISCONNECTED HOMES

Disconnected Homes represent deeper spatial/reality problems.

## FAKE HAVEN

Fake Haven should initially feel safe and comforting.

## FINAL CREATURE

Not a boss fight.

## FINAL CREATURE SCALE

Much larger and more alien than ordinary creatures.

## WATER

Water remains restrained and gameplay-safe.

## GUIDED ROUTES

Routes can guide the player without becoming forced rails.

---

# 70. FARMLANDS PERMANENT IDENTITY

The Farmlands should represent:

- agriculture
- rural history
- isolation
- geographic scale
- abandoned human infrastructure
- harmless animals
- water
- fields
- barns
- roads
- orchards
- Ashen Forest
- subtle rural horror

The Farmlands should not represent:

- constant monsters
- constant blood
- constant jumpscares
- swamp everywhere
- random horror objects everywhere

---

# 71. STATIC SUBURBIA PERMANENT IDENTITY

Static Suburbia should represent:

- familiarity
- artificial normality
- memory
- repetition
- suburban architecture
- houses
- subtle reality errors
- impossible interiors
- reconstructed familiarity

---

# 72. OVERWORLD PERMANENT IDENTITY

The Overworld should represent:

- the baseline
- beauty
- survival
- familiarity
- first warning signs
- the player's initial understanding of reality

---

# 73. FAKE HAVEN PERMANENT IDENTITY

Fake Haven should represent:

- comfort
- memory
- safety
- emotional manipulation
- false reality
- dreamlike perfection

It should not initially feel evil.

---

# 74. FINAL ENTITY PERMANENT IDENTITY

The final entity should represent something much deeper than an ordinary
enemy.

It should feel:

- ancient or incomprehensible
- impossible
- enormous
- difficult to perceive
- unlike ordinary creatures
- connected to the deepest mystery

The player should not receive a complete explanation simply because
they see it.

---

# 75. ENVIRONMENTAL STORYTELLING PRINCIPLE

Whenever possible:

SHOW instead of TELL.

Prefer:

- objects
- architecture
- layouts
- sound
- repetition
- environmental changes
- visual clues

over:

- huge lore paragraphs
- NPC exposition
- giant text dumps

---

# 76. PLAYER GUIDANCE PRINCIPLE

Good guidance:

- road
- landmark
- sound
- silhouette
- sign
- lighting
- environmental composition
- distant structure

Bad guidance:

- giant glowing arrow
- constant waypoint beam
- invisible wall
- unexplained teleport
- giant objective marker spoiling mystery

---

# 77. MEMORABILITY PRINCIPLE

The player should be able to remember specific images.

Examples:

- a massive water tower in distant fog
- a red light flashing only when looked away from
- an enormous rural landscape
- an impossible farmhouse
- a repeated object
- a suburban house that cannot fit its interior
- Fake Haven's comfort
- the final creature's scale

The game should create moments the player talks about afterward.

---

# 78. FEW STRONG IDEAS > MANY WEAK IDEAS

Do not add content merely to increase feature count.

A system should contribute to at least one:

- gameplay
- atmosphere
- story
- world identity
- player memory
- horror
- exploration

If it contributes to none of those, question whether it belongs.

---

# 79. AUTHORED VS PROCEDURAL CONTENT

Procedural generation is essential for large environments.

But major experiences should use authored design.

Prefer authored or strongly controlled systems for:

- major horror events
- Disconnected Homes
- Fake Haven
- finale
- signature landmarks
- major story sequences
- opening cinematic

Procedural generation should provide scale and variation.

It should not replace authored experiences.

---

# 80. PERFORMANCE PRINCIPLE

Never assume a feature is acceptable because it works once.

Measure:

- chunk generation
- chunk streaming
- memory
- objects
- geometry
- materials
- long-distance traversal
- interaction
- water updates
- animal simulation
- cinematic transitions

When optimizing:

- measure
- change
- benchmark
- compare
- keep only actual improvements

Never fake benchmark results.

---

# 81. VALIDATION PRINCIPLE

Every major phase should test both:

WHAT THE CODE SAYS
and
WHAT THE PLAYER ACTUALLY EXPERIENCES.

Automated tests are necessary.

They are not sufficient.

Whenever practical, validate through:

- first-person play
- rendered imagery
- traversal
- interaction
- persistence
- deterministic comparison
- chunk seam inspection
- performance benchmarking

---

# 82. CONTEXT RESET PRINCIPLE

Development sessions may reset.

The project must remain understandable without the old chat.

The repository should provide:

- source code
- CLAUDE.md
- ROADMAP.md
- future progress/state files
- useful test information

Claude Code should inspect the repository before making assumptions.

---

# 83. CURRENT PROJECT STATUS

Current completed milestone:

Phase 24 — Canonical Story Foundation
(Phase 23 save/load, Phase 22 settings, Phase 21 dropped item ground contact, and
Phase 20 including the 20.1 journey revision and the 20.2 guidance pass —
see PROGRESS.md, and STORY.md for the canon)

Current next major phase:

Phase 25 — Dynamic Objective System

Current game build baseline:

game.html

Repository version:

Where-It-Isnt

Official game title:

Where It Isn't

---

# 84. CURRENT DEVELOPMENT ORDER

Proceed in phase order.

Do not skip major phases simply because a later visual idea sounds exciting.

Era 1 should first produce a coherent playable alpha.

Era 2 should then perform the major visual revolution.

Era 3 should deepen the horror and world.

Era 4 should prepare the game for release.

---

# 85. FINAL DEVELOPMENT NORTH STAR

The ultimate goal is not:

"Make the biggest voxel horror game."

The goal is:

"Create a memorable horror world where familiar places slowly become
untrustworthy, where the player learns through exploration, and where the
world itself eventually becomes the thing they fear."

Where It Isn't should make the player wonder:

- "Was that there before?"
- "Why is that here?"
- "Where did that road come from?"
- "Why does that place look familiar?"
- "How can this room fit inside this house?"
- "Was that light really flashing?"
- "Why does this feel like somewhere I've already been?"
- "What is actually real?"

The player should not simply fear monsters.

They should eventually fear the reliability of the world itself.

---

# END OF ROADMAP
