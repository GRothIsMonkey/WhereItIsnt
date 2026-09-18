# D1 — SHATTERED FARMLANDS

# CANONICAL CREATIVE DESIGN

**Status:** LOCKED ✅
**Dimension:** D1 — Shattered Farmlands
**Major landmarks:** 7
**Design purpose:** Complete canonical creative specification for the D1 landmark journey.

**This document is THE single detailed creative source of truth for D1.** Where any other
document in this repository describes D1 in detail and disagrees with this one, this one wins
and the other is stale.

Authority order for D1: this document → `STORY.md` (broader canon) → `ROADMAP.md`
(implementation direction) → `ERA2-PLAN.md` (technical planning). `STORY.md`, `ROADMAP.md`,
`PROGRESS.md`, `CLAUDE.md` and `ERA2-PLAN.md` carry only high-level D1 statements and point
here for detail; they must not re-specify a D1 sequence.

It expands the broader story canon without replacing it.

Implementation-level details may remain flexible where they depend on final assets, layout, optimization, or technical constraints, but the player-facing creative design below is locked.

---

# 0. D1 OVERALL DESIGN

## Core Experience

D1 is the player's first major exploration of the world outside the opening sequence.

It begins as a believable rural environment and gradually becomes increasingly wrong.

The emotional progression is:

**safe → familiar → curious → nostalgic → slightly wrong → unsettling → terrifying**

The Farmlands should feel like a real abandoned rural region rather than a sequence of horror attractions.

The player should explore because they are genuinely curious about what is out there, and the world should make that curiosity worthwhile.

## Landmark Philosophy

D1 contains seven major landmarks.

Each major landmark must have meaningful purposes rather than existing only as scenery.

Possible purposes include:

* Progression
* Story
* Navigation
* Survival
* Connection
* Horror

Each major landmark must have at least two meaningful purposes.

Across D1, survival-focused and horror-focused experiences should remain roughly balanced.

Major landmarks must have distinct identities and minimal role overlap.

D1 should feel long because the world is diverse and interconnected, not because the player repeatedly experiences the same landmark formula.

## Exploration Structure

D1 uses:

**linear macro-progression with semi-open local exploration**

The overall journey generally moves eastward, but the player can investigate side paths, smaller discoveries, optional areas, and surrounding locations.

The player should not need a GPS-style system to understand the world.

Navigation should primarily use:

* roads
* intersections
* recognizable structures
* silhouettes
* distant landmarks
* environmental relationships
* remembered locations

Major landmarks should be visible from meaningful distances often enough that players naturally notice them and think:

> “What is that?”

There should also be 10–20 smaller discoveries distributed throughout D1.

These smaller discoveries can provide:

* small useful items
* environmental story
* clues
* navigation information
* minor survival advantages
* connections to larger mysteries

The major-landmark discovery loop is:

**see something interesting → decide to investigate → travel there → discover something meaningful → receive a payoff → gain a reason to keep exploring**

---

# 0.1. D1 CREATURE CANON

Two distinct creatures appear in D1. They are separate entities. They must never be merged,
conflated, or given an invented relationship to one another.

## The Thing Below

Canonical identity:

* skinwalker-like
* human-like
* crawling
* extremely fast
* can stalk the player
* can frighten the player
* can chase the player
* can kill the player

The Thing Below is a major D1 horror presence and appears in multiple D1 situations.

It is separate from the Skin Stitcher, the Stalker, the Hollowed Behemoth, the Collector,
and the final creature.

**The Thing Below does NOT perform the Landmark 6 → Landmark 7 chase.**

Do not invent a deeper relationship between The Thing Below and any other creature.

## The Skin Stitcher

**The Skin Stitcher is the official name of the creature contained in the Landmark 6 cage.**

Earlier documentation called it "the cage creature" or "the caged creature". That language is
retired and must not be reintroduced.

Canonical behaviour:

* it is the massive creature encountered in Landmark 6
* it is severely cramped inside the cage
* it reacts violently to the player
* it is involved in the containment/machine sequence specified in section 10
* when it escapes it does **NOT** immediately chase the player
* it runs away into the woods
* the player escapes Landmark 6 without being pursued
* **later, on the route toward Landmark 7, the Skin Stitcher performs the major chase**

The Skin Stitcher is the D2 entity. The player witnesses an escape, never an origin.

## Chase ownership

The Landmark 6 → Landmark 7 chase belongs **exclusively to the Skin Stitcher**.

The correct order is:

**escape Landmark 6 → the Skin Stitcher runs away into the woods → later, on the route toward
Landmark 7, the Skin Stitcher performs the chase**

---

# 0.2. READABLE TEXT IN D1

**Readable environmental text is permitted in D1.**

Natural environmental writing is allowed, including handwritten notes, investigation notes,
logs, records, names, maps, school materials, warning signs, technical labels, annotations,
short messages, diagrams and other environmental writing.

The principle is:

> Readable text is allowed when it is natural, purposeful, and appropriately restrained.

What remains forbidden is not text but **exposition**:

* giant lore dumps
* unnatural exposition
* excessive text
* using text to explain mysteries the environment should deliver through discovery

`STORY.md` section 26 still governs what the game must never explain. Readable text may
imply; it may not confirm.

The Church's two final lines — "They're coming." and "We tried." — are **spoken audio lines**.
They are not a requirement for readable text and must not be converted into one.

---

# 0.3. THE D1 FLASHLIGHT — LOCKED

The flashlight is the player's one reliable tool in D1, and its resource model is now locked.

## The model

* **Permanent handheld flashlight.** The player carries it for the whole of D1. It is never
  taken away and never breaks permanently.
* **Finite battery charge**, which **drains while the flashlight is on**.
* **Batteries / charge pickups are found in the world.** That is the only way charge returns.
* **No automatic regeneration.** Charge does not refill by waiting, resting or progressing.
* **No flashlight crafting.** The flashlight is not built, and neither are its batteries.
* **It remains relevant throughout D1.** Later landmarks do not obsolete it.

## The Landmark 1 upgrade

Landmark 1's Water Tower cache contains an **upgraded flashlight**.

The upgrade improves **the flashlight itself** — beam quality, range, efficiency — and does
**not** replace it with a separate system, a second tool or a different item class. The player
ends Landmark 1 holding a better version of the thing they already had.

## The tension it is for

Battery management exists to make darkness a **decision**: whether to light this room, how far
to look, when to walk in the dark and listen instead. `STORY.md` section 4.3 is the standard —
the flashlight "does not make the player powerful", it gives "a small amount of certainty",
and the player must repeatedly confront that seeing one thing means not seeing everything else.

It must **not** become inventory micromanagement. The pressure is the choice of when to switch
it on, not the bookkeeping of a consumable.

---

# 0.4. D1 WORLD EXTENT — LOCKED

## 4,096 m × 4,096 m

Centred on the origin of D1's own local space, running −2,048 m to +2,048 m on both axes.

**This is no longer provisional.** The figure is approved and the seven landmarks, the road
network and every authored coordinate are to be composed inside it.

The implementation already carries this value (`D1_WORLD_SIZE` in
`src/world/terrain/terrain-config.js`), which divides into a 16 × 16 grid of 256 m regions —
256 regions in total. Nothing needs to change in the terrain layer for this lock; what changed
is that the number is now a decision rather than a placeholder.

If a technical constraint ever makes this extent unworkable, that is a finding to **report
separately**, not a licence to change it quietly.

# 1. D1 MAJOR LANDMARK ORDER

## Landmark 1

**Farm Compound + Water Tower**

Role:
Exploration / Suspense / Story / Navigation / Survival / Connection

## Landmark 2

**Schoolhouse**

Role:
First major horror landmark / human aftermath / first significant encounter with The Thing Below

## Landmark 3

**Electrical Substation**

Role:
Infrastructure mystery / impossible underground depth / connection to larger system

## Landmark 4

**Rural Church**

Role:
Human history / unstable geography / crypt mystery / Suburbia foreshadowing

## Landmark 5

**Abandoned Motel**

Role:
Environmental and psychological horror / recurring evidence / perception / mystery surrounding The Thing Below

## Landmark 6

**Abandoned Grain Elevator**

Role:
Suspense climax / new creature discovery / containment horror / escalation toward the D1 finale

## Landmark 7

**Ordinary Barn / Hidden Underground Elevator System**

Role:
D1 finale / temporary refuge / culmination of the D1 mystery / impossible underground discovery / transition toward Suburbia

---

# 2. LANDMARK 1 — FARM COMPOUND + WATER TOWER

## Core Role

Landmark 1 introduces the D1 exploration philosophy.

It should teach the player that:

* the world is worth exploring
* distant structures matter
* ordinary places may contain important discoveries
* environmental clues can lead from one landmark to another
* suspense does not require constant attacks

Primary roles:

**Exploration + Story + Navigation**

Secondary roles:

**Survival + Connection + Suspense**

The landmark should be comparatively short/medium length.

It does not deliver a major creature encounter.

---

## Physical Structure

The landmark is a large rural farm compound containing:

* large two-story farmhouse
* large multi-level barn
* attached livestock structures
* sheds
* workshop/garage
* root cellar
* overgrown crop fields
* muddy livestock areas
* old machinery
* fences
* dirt paths
* water/irrigation features
* surrounding tree line

The compound should feel like a real farm rather than a single isolated game building.

The **Water Tower** is the dominant landmark.

It is extremely large and visually recognizable from far away.

It should become one of D1's main navigation references.

---

## Water Tower

The tower is unusually tall and visually dominant.

It has an unexplained red light.

The red light behaves differently depending on the player's viewing angle.

When viewed directly it behaves one way.

When the player looks slightly away, it can behave differently or appear to flash.

This is not a puzzle.

It is not a boss.

It is not a conventional objective.

It is an unexplained environmental anomaly.

The player should initially be able to dismiss it.

The important result is that the player remembers it.

---

## Farm Exploration

The farm should include believable rural exploration:

* farmhouse rooms
* barn areas
* machinery
* storage
* livestock evidence
* crop fields
* surrounding structures

A corrupted family photograph can be discovered.

Breaking/shattering it reveals a hidden blueprint.

The blueprint contains an X pointing toward the Water Tower and a clue to a key.

This creates an organic reason to investigate the tower.

---

## Farmhouse Horror

The farmhouse should use restrained suspense.

Important elements include:

* basement suspense
* mannequin/coat-display ambiguity
* unsettling text such as “IT KNOWS”
* “NOT YET”
* return upstairs
* silhouette visible through an upstairs window
* Water Tower visible outside

No active creature encounter occurs here.

The point is to establish:

> Something is wrong.

without immediately answering:

> What is wrong?

---

## Water Tower Exploration

The key allows the player to enter/climb the tower.

Inside/around the tower:

* markings
* names
* warnings
* traces of prior attention

At the top the player finds:

* the **upgraded flashlight** — an improvement to the flashlight the player already carries
  (beam quality, range, efficiency), never a replacement system. See section 0.3.
* partial surrounding map
* medical supplies
* **the Old Utility Master Key**
* **the Water Tower brass/survey/utility disk**

---

## The two Landmark 1 reward objects are NOT the same object

Landmark 1 yields two small objects that matter later. They serve different roles and must
never be conflated, merged, or presented as one item.

### Old Utility Master Key

A believable old heavy-duty utility/master key. It must read as ordinary hardware, never as
an obviously magical or videogame-like item.

* **Role:** practical progression.
* **Use:** it opens the locked maintenance/basement access door at the Schoolhouse
  (Landmark 2).
* **Thematic detail:** it carries an unusual stamped marking/symbol whose deeper
  significance is not initially understood.
* **What the player is told at Landmark 1:** nothing explicit. The player is not informed
  that this is a Landmark 2 progression item.

The intended reactions are, at Landmark 1:

> "Old utility key. This might be useful."

and later, at the Schoolhouse:

> "This opens this door."

The key's deeper meaning may become relevant as the D1 mystery develops. It is **not** one of
the four barn-puzzle objects.

### Water Tower brass/survey/utility disk

A small, old, mundane object associated with the Water Tower area.

* **Role:** it is **one of the four physical objects used in the Landmark 7 barn puzzle**
  (see section 15).
* It must not be presented as an obvious puzzle piece.

---

## Ending

The player leaves Landmark 1 with:

* better exploration capability
* a stronger understanding of the geography
* a major navigation landmark
* the Old Utility Master Key
* the Water Tower brass/survey/utility disk
* the first serious indication that the Farmlands are not normal
* unanswered questions

The landmark ends without a major chase or monster attack.

The player should leave thinking:

> “Something is wrong here.”

---

# 3. LANDMARK 2 — SCHOOLHOUSE

## Core Role

Landmark 2 is the first major horror landmark.

It is the point where the player realizes:

> “Something is actually dangerous.”

Primary roles:

**Horror + Story**

Secondary roles:

**Survival + Connection + Progression**

This landmark should be more disturbing than Landmark 1 but should not contain the biggest horror moment in D1.

---

## Physical Structure

The Schoolhouse is a larger rural single-story wooden school.

It includes:

* main school building
* attached gym
* basement
* playground
* small cafeteria/kitchen
* damaged surrounding grounds

The structure should remain believable as a rural school.

---

## Exterior

The school appears:

* weathered
* filthy
* damaged
* partially abandoned
* disturbing but recognizable

Details include:

* peeling paint
* broken/missing windows
* boarded openings
* faint interior lights despite no obvious power
* overgrown grass
* rusted playground
* abandoned school buses
* chain-link fence
* flagpole
* torn flag
* incomplete/missing-letter school sign

There is physical evidence that something happened:

* fence torn open
* bent posts
* gouges
* damaged bus doors
* objects dragged or knocked over
* evidence of people trying to enter or escape

---

## Interior

Inside:

* overturned desks
* damaged doors
* gouged walls
* bent/ripped lockers
* isolated stains/blood evidence
* drag marks
* broken windows
* barricades
* emergency supplies
* abandoned bags and coats
* hiding areas
* damaged hallway
* evidence that people fled toward the basement

The player should gradually reconstruct an event:

> something broke in → people realized they were in danger → people tried to survive → people attempted to escape or hide.

---

## Untouched Classroom

One classroom remains unusually neat.

It contains:

* neatly arranged desks
* dusty classroom
* lesson still written on board
* stopped clock
* clue
* evidence that something was recently removed

Important clues can include:

* student drawing of the Water Tower
* school map with one location circled
* teacher notes pointing toward the basement

D1 clocks should follow the established stopped-time rule.

---

## First Major The Thing Below Encounter

The Schoolhouse is the player's first real confirmation of The Thing Below.

The creature:

* watches from a distance
* crawls away when noticed
* can briefly follow
* produces subtle crawling/scratching sounds
* avoids light
* searches the basement for something
* approaches extremely close without immediately finding the player
* leaves when its attention shifts

The creature is not constantly attacking.

Its behavior is observational and predatory.

---

## Basement Access

The route down is **locked**. It is opened with the **Old Utility Master Key** recovered from
the Landmark 1 Water Tower.

This is the Old Utility Master Key's practical purpose and the reason Landmark 1 hands it over
without explanation. The player is not told at Landmark 1 that the key will be needed here;
they simply find that it fits.

The stamped marking on the key remains unexplained.

---

## Basement Object

The Thing Below is searching for a disturbing child-related object in the basement crawlspace.

The object initially appears ordinary.

Only after examination does the player realize it contains human material.

There is no cheap jumpscare at the moment of discovery.

---

## Exit

The player retraces the route out knowing:

* the creature exists
* it is still somewhere nearby
* the Schoolhouse was not simply abandoned
* something disturbing happened here

There is no second major creature appearance on the exit.

The player's takeaway should be:

> Creatures exist here.

and:

> The Farmlands are not simply empty.

---

# 4. LANDMARK 3 — ELECTRICAL SUBSTATION

## Core Role

The Substation changes the type of horror.

Instead of primarily focusing on a creature, it asks:

> **Why is this infrastructure still functioning?**

Primary roles:

**Infrastructure Mystery + Impossible Depth**

Secondary roles:

**Story + Connection**

---

## Physical Structure

The Substation is:

* medium-sized
* fenced
* old/outdated
* surrounded by rural landscape
* built around industrial electrical equipment

It includes a dedicated generator/control building.

The generator building should have:

* old concrete construction
* almost intact exterior
* overgrowth around it
* underground cable/tunnel network
* functioning control panels despite abandonment
* technical labels
* warnings
* an interior that feels newer than the outside

---

## Core Weirdness

The player discovers contradictions:

* power randomly cuts in and out
* most systems look dead
* one machine continues working
* something that should have no power is powered
* a generator runs despite no obvious fuel
* power is being sent somewhere unidentified
* power lines continue east toward an unexplained destination

The player investigates because the infrastructure itself is doing something impossible.

---

## Control Room

Access requires a combination of:

* restoring some power
* repairing a control panel
* finding a hidden manual override
* crawling through a damaged section

Inside the control room:

* status information
* evidence of the power network
* older operational records
* strange system information
* indications of where power is going
* information about the eastern line

---

## Underground Power Route

The player traces the eastern power.

The route:

* disappears deep underground
* cannot be fully accessed
* continues far deeper than normal infrastructure should
* gives no clear indication of its destination
* leaves the player wondering what could require this much power

The player eventually reaches:

* gigantic cable bundle
* deep shaft
* no visible bottom
* utility access point clearly not intended for normal workers

The player cannot reach the ultimate destination.

At this point:

**D1 player does NOT discover Suburbia.**

The meaning is delayed.

Later, in Suburbia, the player can realize:

> The same underground network is supplying Suburbia.

Thus the D1 question is:

> “Where is this power going?”

And the later realization is:

> “This is where it was going.”

---

## Investigative Evidence

The facility includes traces of previous investigators:

* abandoned tools
* shaft markings
* notes/logs
* damaged flashlight
* warning signs
* camera equipment

A camera contains recordings of investigators researching/descending into the shaft.

At the climax of the recording:

* The Thing Below notices them
* it attacks
* the footage ends in STATIC at the moment of attack

The final damaged camera remains near the shaft.

It contains:

* old timestamp
* earlier recordings
* a final disturbing footage detail

The player learns that people have investigated this system before.

They did not return.

---

## Ending

The player finds a route back to the surface.

The original access may become inaccessible.

The player leaves with:

* knowledge of a massive underground system
* evidence of previous investigators
* knowledge that The Thing Below can reach this area
* no knowledge of what actually lies at the end
* **an old ceramic/electrical component** — a believable part associated with the substation
  machinery, and one of the four physical objects used in the Landmark 7 barn puzzle
  (see section 15)

The component must not be presented as an obvious puzzle piece. It is a piece of hardware the
player picks up in a place full of hardware.

The power ultimately shuts off.

The substation does not reveal the final destination.

---

# 5. LANDMARK 4 — RURAL CHURCH

## Core Role

The Church changes the mystery again.

Primary roles:

**Human History + Unstable Geography**

Secondary roles:

**Story + Horror + Suburbia Foreshadowing + Connection**

The player should learn that people were actively trying to understand what was happening.

---

## Physical Structure

The Church is:

* large
* old
* rural
* stone-built
* visually distinct
* surrounded by trees
* attached to a cemetery
* supported by a tall bell tower
* connected to an underground crypt

It remains surprisingly intact.

It contains stained glass and recognizable religious architecture.

---

## Wrongness

The player notices:

* candles burning despite abandonment
* bell ringing by itself
* graves that don't match church records
* signs of violent struggle
* clocks stopped at D1 time
* evidence people hid inside

The horror is gradual.

---

## Crypt Access

The crypt is not immediately obvious.

The player must discover a hidden way inside using clues such as:

* hidden mechanism/lever
* concealed passage behind the altar
* clues left by people who hid there

---

## Crypt

The crypt contains:

* hidden room
* personal belongings
* repeated strange symbol
* impossible passage
* evidence left by hidden people
* major story information

The hidden room contains:

* hundreds of names
* evidence of hiding
* evidence of studying The Thing Below
* old Farmlands photographs
* evidence something was dismantled/studied

This establishes that the phenomenon has a history.

---

## The Impossible Map

The major reveal is a confusing, heavily worked-over map involving **Suburbia**.

The map includes:

* redrawn routes
* crossed-out routes
* contradictory measurements
* question marks
* notes such as “again”
* notes such as “wrong”
* notes such as “it moved”

Different versions place Suburbia in different locations.

One version suggests it is east.

Another suggests it is below.

The author repeatedly failed to locate it.

The important realization is:

> **The mapper was not simply bad at mapping. The place itself was changing.**

---

## Final Notes

Notes imply:

* Suburbia was found
* then it disappeared
* it seemed to move
* a route downward was found
* the author could not return
* others are warned not to follow
* an elevator is mentioned

Important:

## The actual elevator is NOT discovered at the Church.

The Church only establishes that such a route/elevator exists.

---

## What the Church contributes to the barn puzzle

**Knowledge and interpretation. No physical barn-puzzle object.**

The Church yields no physical component for the Landmark 7 mechanism. What the player takes
away is understanding:

* the recurring symbol
* impossible / spatially unstable geography
* contradictory routes
* Suburbia
* the underground mystery
* evidence that the place itself may be changing

That understanding is what allows the player to interpret the mechanism at Landmark 7. See
section 15.

---

## Church Horror Ending

Near the end:

* all candles go out
* overlapping human whispers begin
* voices come from different directions
* some sound terrified
* some sound angry
* most are unintelligible
* the whispers get louder
* some sound extremely close
* everything stops simultaneously

Then two final intelligible lines are heard:

> **“They’re coming.”**

> **“We tried.”**

**These are SPOKEN AUDIO LINES.** They are heard, not read. They are not readable text and must
not be converted into a note, an inscription or any other written object. See section 0.2.

Nothing else immediately happens.

The player leaves through the main entrance.

Outside:

* everything appears normal
* the bell stops
* an upper window briefly shows a figure
* the figure disappears immediately
* it is unclear whether the figure was real

The Church ends by increasing uncertainty rather than giving a clean explanation.

---

# 6. LANDMARK 5 — ABANDONED MOTEL

## Core Role

Primary roles:

**Environmental/Psychological Horror + Recurring Evidence + Mystery Around The Thing Below**

The Motel must feel more intimate and psychologically disturbing than the larger locations.

Its purpose is not to give the player another standard creature encounter.

Its purpose is to make them question what they are seeing.

---

## Physical Structure

The motel is:

* small
* roadside
* roughly 1950s style
* arranged as one long row of rooms
* connected to a closed pool
* partially furnished

It should feel like an ordinary roadside motel abandoned in place.

---

## Arrival

When the player arrives:

* the motel is silent
* a few lights still work
* one room door is open
* the pool is empty but looks recently disturbed
* abandoned cars remain outside
* everything looks normal at first
* subtle details gradually become wrong

The emotional question progresses:

> “This place was abandoned.”

then:

> “When?”

then:

> “Why?”

---

## Main Motel Mystery

Different rooms appear to have been abandoned at different times.

Differences include:

* decay
* belongings
* degree of recent use
* rooms that look much older than others
* rooms that appear almost recently abandoned

But every room contains the same strange recurring objects:

## **Mirrors + Clocks**

These become the Motel's central visual motifs.

---

## Mirrors

At first the player barely notices anything.

Then:

* reflections are slightly delayed
* the delay becomes more obvious
* reflections can show things that are not physically present
* mirrors can appear to show another time/location
* The Thing Below can appear in a mirror before appearing physically

The player should begin questioning:

> “Am I looking at reality, or something else?”

---

## Mirror Escalation

Early:

Player moves.

Reflection responds slightly late.

Mid:

Player performs an action.

Reflection performs the action differently.

Later:

Player looks at the mirror.

The Thing Below is visible.

Player turns around.

Nothing.

Player looks back.

Nothing.

This establishes the Motel's horror identity without repeatedly spawning the creature physically.

---

## Clocks

All Motel clocks initially show the same stopped D1 time.

Then the rules begin breaking:

* clocks suddenly change
* hands move backward
* clocks behave inconsistently

The player already knows the clocks are wrong.

Now they realize:

> **Even the wrongness is unstable.**

---

## First Major Motel Scare

The major sequence is:

**The Thing Below in a mirror**

→ room door slams

→ knocking inside another room

→ phone rings

→ television turns on

The player answers the phone.

There is:

**complete silence**

Then the call abruptly cuts off.

Afterward:

* TV shuts off
* knocking stops
* room door slowly opens

The sequence should move from environmental uncertainty into direct interaction.

---

## Room Discovery

The player discovers:

* something directly connected to The Thing Below
* survival supplies
* bandages
* shotgun ammunition
* **an old motel key / key-fob** — the key associated with the relevant motel room and
  investigation, and one of the four physical objects used in the Landmark 7 barn puzzle
  (see section 15)

The key-fob must read as an ordinary motel key, not as a collectible.

But:

## There is no shotgun.

This creates the question of who prepared the room and why.

---

## Photographs

The room contains actual investigation photographs documenting The Thing Below.

The photographs show:

* different locations
* different circumstances
* different distances
* Schoolhouse
* Substation
* Motel
* locations the creature apparently should not have been able to reach

The implication:

> The Thing Below has been observed before.

---

## Especially Disturbing Photograph

One photograph shows:

* The Thing Below staring directly at the camera
* an unidentified person standing beside it
* the person's face obscured/distorted
* calm body language
* no visible fear
* apparent direction/interaction with The Thing Below

This person remains unidentified during D1.

---

## Second Person

Another photograph contains a barely visible second person.

They appear to be:

* watching the unidentified person
* connected to the larger mystery
* not identifiable

This does not become a major character reveal yet.

---

## Motel Connection

The unidentified person is tied directly to the motel.

Evidence includes:

* belongings in a room
* room apparently used specifically by them
* security footage
* their symbol
* evidence of repeated stays
* employee records mentioning them

This changes the meaning of the photograph.

It is no longer just a weird photograph.

It is evidence of a person with a real history connected to the motel.

---

## Key Photograph

A key photograph is clearly taken inside the Motel.

Details:

* room number visible
* room looks exactly like the current room
* same strange mirror
* photograph predates abandonment
* another person barely visible

The implication:

> The Motel looked essentially like this while people were still using it.

---

## Motel Psychological Progression

The sequence is:

**normal room**

→ subtle reflection delay

→ strange clock

→ impossible reflection

→ The Thing Below in mirror

→ phone

→ knocking

→ photographs

→ unidentified person

→ uncertainty about reality

The Motel does not deliver another major chase.

---

## Pacing

The Motel should be medium-length.

Long enough for:

* several room explorations
* room-to-room differences
* mirror system
* clock system
* phone event
* survival discovery
* photographs
* unidentified person discovery

But it should not become a giant maze.

---

## Ending

After the internal events, the player exits.

Outside:

* Motel looks completely normal
* parking lot is completely empty
* no final chase
* no final attack
* no final monster reveal

The player simply continues toward Landmark 6.

The emotional takeaway:

> **“Something has been happening here for much longer than I thought.”**

---

# 7. LANDMARK 6 — ABANDONED GRAIN ELEVATOR

## Core Role

Primary roles:

**Suspense Climax + New Creature Discovery + Containment Horror**

The Grain Elevator is the pressure chamber for D1.

The structure itself should feel dangerous.

The player's tension should become extremely high here without spending the biggest scare yet.

The major scare belongs to the transition into Landmark 7.

---

## Physical Structure

The complex contains:

* enormous concrete elevator towers
* multiple metal silos
* catwalks
* conveyor systems
* central processing building
* industrial machinery
* old grain trucks
* farm vehicles
* damaged fences
* severely cracked silo
* additional abandoned structures

It is visibly enormous from far away.

---

## Exterior Condition

The complex is:

* heavily deteriorated
* clearly abandoned
* still standing
* partially collapsed
* structurally dangerous

The environment itself becomes part of the traversal.

---

## First Impression

From a great distance:

* elevator towers dominate the skyline
* one silo has a huge vertical crack
* long conveyor structure extends toward another abandoned structure
* old grain trucks/farm machinery remain scattered around the site
* damaged chain-link fence surrounds the property

The player should immediately understand:

> **This is a major destination.**

---

## Interior

Inside:

* processing building almost completely dark even during daytime
* huge empty storage chambers
* machinery torn apart from within
* fresh-looking drag marks
* heavy movement somewhere above or below
* collapsed sections blocking routes

The player should not immediately know what is moving.

---

## Deep Exploration

The player progresses through:

**large industrial spaces**

→ **evidence of violent disturbance**

→ **collapsed/claustrophobic sections**

→ **large impossible depth**

This intentionally changes the player's sense of scale.

The player goes from enormous open industrial rooms to extremely tight spaces.

---

## Deeper Discoveries

The player finds:

* huge empty chamber where grain has somehow disappeared
* collapsed sections that force tight traversal
* enormous vertical shaft
* no visible bottom

The shaft has:

* rattling
* movement
* darkness
* huge cable disappearing downward

The flashlight cannot reach the bottom.

An object dropped into the shaft never produces a convincing impact.

---

## Rattling

The important sound from below is:

## **rattling**

The player has to investigate the source.

The sound should remain ambiguous.

It should not immediately sound like a recognizable monster.

---

# 8. THE SKIN STITCHER

The player eventually discovers a cage containing a completely new creature: **the Skin
Stitcher**. See section 0.1 for its canonical identity.

This creature is:

* not The Thing Below
* not the Stalker
* not the Hollowed Behemoth
* not the Collector
* not a minor variant
* not the final creature
* the D2 entity, encountered here for the first time

Its role is to communicate:

> **The player has not understood what this world contains.**

---

## Skin Stitcher Anatomy

Locked direction:

* massive
* muscular
* broadly humanoid
* physically unnatural
* physically incomplete in places

The Skin Stitcher is severely crammed into a cage obviously too small for its body.

It must remain ambiguous whether:

* it grew rapidly and outgrew the cage

or:

* it was deliberately forced into a cage far too small for it

The player does not receive a clean answer.

---

## Cage

The cage is visibly and intentionally:

* inadequate
* heavily built
* physically restraining
* **bolted into the concrete**

This tells the player someone expected the Skin Stitcher to be dangerous.

---

## Skin Stitcher Reaction

When the player approaches:

* the Skin Stitcher immediately notices them
* it violently throws itself against the cage
* its head turns toward the player while the rest of its body remains constrained

Then it stops.

It stares directly at the player.

---

## Secondary Sound

The surrounding lights begin flickering.

A huge metallic sound comes from deeper below.

The player realizes:

> **There is something farther down.**

The Skin Stitcher reacts to the sound.

This shows it is responding to something beyond the player.

---

# 9. SCIENTIST / HANDLER

The player hides behind machinery.

An intense heartbeat begins.

A scientist/handler enters.

The scientist should look wild and deeply unstable but still believable.

They should not become a cartoon villain.

The player learns through observation rather than exposition.

The scientist:

* calmly records observations
* checks the Skin Stitcher
* notices cage damage
* becomes visibly concerned
* operates the connected machine

The player watches this from concealment.

---

# 10. MACHINE / BREAKOUT

The machine triggers a violent reaction.

The Skin Stitcher:

* violently reacts
* breaks the cage
* shoves the scientist into the bottomless pit
* **runs away into the woods**

## It does NOT pursue the player.

This is crucial, and it is the single most misread beat in D1.

The Skin Stitcher does not chase the player out of Landmark 6. It leaves. The player escapes
Landmark 6 unpursued.

The Skin Stitcher behaves as though it has:

## **somewhere important to go**

It leaves with obvious purpose.

This creates the major question:

> **Where is it going?**

The Skin Stitcher returns later, on the route toward Landmark 7, and it is the creature that
performs the chase in section 11. That is a separate, later beat — not a continuation of this
one.

---

## Aftermath

The player:

* waits for an opening long enough to escape
* runs for the exit

Nothing pursues them.

The player also recovers, organically from the broken containment, **a metal component from
the cage** — one of the four physical objects used in the Landmark 7 barn puzzle (see section
15). It becomes available through the escape and its aftermath rather than being placed as a
collectible, and it must never feel like an arbitrary videogame pickup.

The shaft lights later return.

The scientist is gone.

The game does not cleanly explain what happened to the scientist.

The pit remains unexplained.

---

## Exterior Ending

Outside the Grain Elevator:

* the Skin Stitcher can be seen impossibly far away running through the fields
* a huge flock of birds suddenly takes off
* the objective updates toward Landmark 7

Then the Skin Stitcher disappears into the landscape.

The player continues.

---

# 11. LANDMARK 6 → LANDMARK 7 TRANSITION

This is the first truly horrifying physical encounter in D1.

## The chase belongs to the Skin Stitcher

**The Skin Stitcher owns this chase. The Thing Below does not.**

This is the Skin Stitcher's return. It left Landmark 6 into the woods without pursuing the
player (section 10); it reappears here, on the route toward Landmark 7.

The sequence is locked:

1. Landmark 6 ends.
2. Player heads toward Landmark 7.
3. Movement in the surrounding fields stops.
4. Player sees Landmark 7 clearly.
5. Complete silence.
6. Something suddenly appears behind the player.
7. **The Skin Stitcher is there.**
8. Player runs forward.
9. Nothing is ahead.
10. Player turns back.
11. **The Skin Stitcher is gone.**
12. Player turns forward again.
13. **The Skin Stitcher is suddenly directly in front of them.**
14. Massive jumpscare sound.
15. Full chase begins, toward Landmark 7.

---

## Chase

Locked chase behavior:

* The Skin Stitcher moves extremely fast.
* The player constantly hears it behind them even when it cannot be seen.
* The player dodges obstacles and damaged/collapsed structures.

The chase should feel physical and immediate.

It ends at the barn (section 12).

---

# 12. LANDMARK 7 — ORDINARY BARN / D1 FINALE

## Core Role

Primary roles:

**D1 Finale + Survival Refuge + Story Culmination + Dimensional Transition**

The landmark begins immediately after the chase.

The player has just survived the first major physical terror of D1.

The barn initially acts as a refuge.

Then that refuge becomes the doorway into something impossible.

---

## Exterior

The structure is:

## **an ordinary rural barn**

It should look believable.

It must not externally resemble:

* bunker
* laboratory
* giant underground complex
* supernatural temple

It should fit naturally into the Farmlands.

---

## Arrival

The chase ends at the barn.

Locked arrival behavior:

* player reaches entrance
* door slams shut behind them
* the Skin Stitcher is cut off
* the Skin Stitcher lunges at the player immediately before they get inside
* once inside, player hears the Skin Stitcher violently hit the exterior
* entrance had already been open, as though something expected the player

This creates:

**terror → refuge**

---

## Why This Is the Final Landmark — THE DESTINATION SIGNAL, LOCKED

The player recognizes Landmark 7 through converging environmental clues. There is **no quest
marker, no glowing waypoint and no supernatural "final landmark" indicator**, and none may be
added — `CLAUDE.md` sections 65 and 66 forbid exactly that, and a marker over the barn would
undo the discovery the whole of D1 has been building.

The locked signal, in order:

1. **The barn is an ordinary rural barn.** Nothing about its appearance announces it. That is
   the point: it must read as believable farmland infrastructure right up until the floor
   opens.
2. **It matches the location represented on the Church map.** The player has already seen that
   map at Landmark 4. Recognition does the work a marker would otherwise do.
3. **An exterior work light is still on.** One light, still burning in an abandoned region — a
   subtle, entirely mundane reason to notice the building and walk toward it. It is
   infrastructure, not a beacon.
4. **After entering, the entrance slams shut behind the player.**
5. **Heavy movement is heard outside.**
6. **The objective changes to a survival/hiding state.**

Beats 4–6 are what confirm the barn was the destination — *after* the player has committed to
it, never before. The player is not told where to go; they are told what has happened once they
are inside.

**Evidence that someone deliberately prepared the barn as a hiding place** (section 13) is
found after this, inside, and deepens the recognition rather than delivering it.

---

# 13. THE BARN AS A HIDING PLACE

The barn itself should initially be believable.

Locked:

**A + B + C + D + G**

The barn contains:

### A

Evidence that someone was living there temporarily and preparing for attacks.

### B

Physical barricades on doors/windows, implying someone was terrified of something outside.

### C

Supplies including food, water, blankets, medical materials, and other survival necessities.

### D

A concealed hiding area behind ordinary farm equipment so it initially appears natural.

### G

Evidence that whoever prepared the barn knew about the underground facility.

This makes the barn feel genuinely like a survival refuge rather than a videogame puzzle room.

---

# 14. THE HIDDEN MECHANISM

Inside the barn, the player discovers a sealed mechanism hidden in the floor.

It cannot be opened normally.

The solution uses information and physical objects collected throughout D1.

The required progression pieces must already have been collected before the objective system allowed the player to leave earlier landmarks.

Therefore:

## **The final puzzle never requires arbitrary backtracking.**

The player should feel like they are finally understanding things they encountered earlier.

---

# 15. FINAL BARN PUZZLE

The mechanism requires:

* **four physical objects** collected during D1
* **knowledge accumulated from previous landmarks**

The player does not simply enter a password.

The player must recognize relationships between earlier discoveries.

---

## The four physical objects

There are **four**, and only four. Each comes from a different landmark, and each is picked up
naturally in the course of that landmark rather than presented as a puzzle piece.

| Landmark | Contribution | Object |
| --- | --- | --- |
| **1 — Farm Compound + Water Tower** | PHYSICAL OBJECT | Old brass/survey/utility disk — a small, old, mundane object associated with the Water Tower area |
| **2 — Schoolhouse** | ENVIRONMENTAL KNOWLEDGE | *no physical barn-puzzle object* |
| **3 — Electrical Substation** | PHYSICAL OBJECT | Old ceramic/electrical component associated with the substation machinery |
| **4 — Rural Church** | ENVIRONMENTAL KNOWLEDGE / INTERPRETATION | *no physical barn-puzzle object* |
| **5 — Abandoned Motel** | PHYSICAL OBJECT | Old motel key / key-fob associated with the relevant room and investigation |
| **6 — Abandoned Grain Elevator** | PHYSICAL OBJECT | Skin Stitcher cage-related metal component, available organically through the escape and its aftermath |

**Landmark 2 and Landmark 4 contribute knowledge, not objects.** Landmark 2's contribution is
environmental knowledge, including spatial and location relationships and the other clues
specified in section 3. Landmark 4's is the interpretation described in section 5 — the
recurring symbol, impossible and spatially unstable geography, contradictory routes, Suburbia,
the underground mystery, and evidence that the place itself may be changing.

**The Old Utility Master Key is NOT one of these four objects.** It is the Landmark 1 → 2
progression item and is spent opening the Schoolhouse maintenance/basement access. See section
2.

---

## Mechanism Behavior

Locked:

**B + C + F + G + H**

The barn contains a hidden mechanism beneath the floor, with **four physical input
locations/sockets**.

The objects should NOT be presented as obvious puzzle pieces. They should feel like ordinary
objects that later turn out to matter.

The player inserts the relevant objects.

Then:

* each object activates part of the mechanism
* the mechanism reveals hidden information
* some objects are altered/revealed through activation
* wrong combinations trigger disturbing sounds from underneath
* the correct combination causes the barn to shake
* a final hidden component appears

The mechanism should feel **physical and mechanical**:

* metal plates move
* components engage
* parts rotate
* hidden sections open
* symbols align
* panels shift

The player must combine the four physical objects **and** the knowledge gathered from previous
landmarks.

Wrong combinations create disturbing sounds from beneath the barn. Those sounds exist to create
tension. They are not a conventional videogame "wrong answer" punishment system and must not
become one.

On the correct combination:

* the mechanism fully engages
* the barn shakes
* dust and debris react
* something deep beneath responds
* the final hidden component appears
* the player can use the mechanism

The mechanism should feel like a physical system that was waiting for the correct combination of pieces.

---

# 16. WHAT THE MECHANISM REVEALS

Locked:

**C + F + H**

The objects reveal:

* a diagram showing where objects belong
* a map fragment revealing the underground facility
* a strange additional revelation the player must interpret

The more specific final reveal includes:

* the repeated strange symbol
* a crude elevator representation
* a distorted image of an unknown place
* evidence that Suburbia somehow exists below the barn

The map should reinforce that the underground structure does not physically fit beneath the barn.

---

# 17. FLOOR REVEAL

Locked:

## **C**

A section of the barn floor:

## **folds back**

revealing a huge concrete stairwell descending into darkness.

It should not immediately reveal the elevator.

The player should initially have no idea how deep it goes.

This is more unsettling than simply finding a hidden lift.

---

# 18. STAIRWELL

At the top of the stairwell:

* distant mechanical hum starts
* stairs descend far beyond what should fit beneath the barn
* an elevator bell can be heard deep underground

The implication is:

> **There is an enormous elevator system underneath this ordinary barn.**

---

# 19. DESCENT

The player immediately descends.

The objective becomes:

## **Find the elevator**

As the player continues:

* the stairway reaches additional landings
* elevator bell sounds become closer
* mechanical hum grows louder
* lights begin flickering off behind the player
* the stairs are revealed to be far older than the barn
* the player eventually reaches a massive underground chamber

---

# 20. UNDERGROUND CHAMBER

The chamber contains all of the following:

* enormous scale where the opposite wall cannot be seen
* gigantic elevator platform
* multiple elevator shafts
* huge cables disappearing upward and downward
* massive metal doors
* abandoned but strangely maintained infrastructure
* dim lights extending deep into the facility
* architecture built at a scale far larger than humans should require

The player should understand:

> **The barn was only the entrance.**

---

# 21. THE ELEVATOR

## The D1 final transition is the elevator. It is NOT a Rift.

The earlier Rift-based D1 transition is **obsolete**. The barn does not reveal a Rift, and no
Rift is used to leave D1. The chain is:

**barn → hidden mechanism → concrete stairwell → massive underground chamber → giant elevator
→ elevator descent → D2 transition**

Rift Cores remain the three progression hinges of the wider game (`STORY.md` section 11) and
there is no fourth. The elevator is the physical traversal mechanism, not a progression token.
Do not reintroduce a D1 Rift and do not invent a replacement for it.

---

The elevator:

* opens automatically
* has no normal floor buttons
* has only one large downward arrow
* is absurdly large
* begins moving slightly before the player enters

The elevator should feel like something that is already operating independently of the player.

---

# 22. IMPOSSIBLE DESCENT

The elevator:

* closes its doors unusually slowly
* passes enormous underground levels
* displays strange symbols rather than normal floor numbers
* keeps descending far longer than physically possible
* sometimes reveals impossible glimpses when shaft walls disappear
* flickers and briefly shows something apparently standing inside with the player
* ultimately stops in complete darkness

This is the endpoint of D1's physical escalation.

---

# 23. NOSTALGIA BEFORE THE DIMENSIONAL SHIFT

Before the elevator does anything else:

## **familiar nostalgic music begins playing**

It should feel comforting.

It should evoke something familiar from the world above.

Then:

* emergency lights slowly come on
* the elevator is completely empty
* the player hears a distant suburban sound, like a car far away
* the elevator suddenly begins moving sideways

The emotional progression is:

**comfort → confusion → impossible movement**

---

# 24. SIDEWAYS TRANSITION

Locked:

**B + D + E + F + H**

After the elevator begins moving sideways:

### B

The nostalgic music gradually becomes distorted.

### D

Distant suburban sounds gradually become louder.

### E

The elevator briefly reveals a normal suburban street outside.

### F

The elevator passes several impossible environments, each visible for only a moment.

### H

The nostalgic music abruptly stops before the destination.

This is the end of the D1 authored transition.

The player should not yet receive an exposition dump explaining what is happening.

The next dimension is encountered physically.

---

# 25. D1 FINAL EMOTIONAL PROGRESSION

The complete authored D1 progression is:

**ordinary rural world**

→ Farm Compound

→ Water Tower

→ Schoolhouse

→ The Thing Below becomes real

→ Electrical Substation

→ impossible underground power

→ Rural Church

→ evidence of unstable geography

→ Suburbia mentioned but not reached

→ Abandoned Motel

→ distorted perception

→ historical evidence

→ Grain Elevator

→ impossible depth

→ the Skin Stitcher, caged

→ scientist

→ containment failure

→ the Skin Stitcher escapes into the woods, without pursuing

→ player continues toward final barn

→ the Skin Stitcher returns

→ appears behind

→ disappears

→ appears directly in front

→ massive jumpscare

→ full chase

→ ordinary barn

→ temporary refuge

→ accumulated D1 objects and knowledge connect

→ hidden mechanism

→ impossible stairwell

→ enormous underground facility

→ impossible elevator

→ endless descent

→ darkness

→ nostalgic music

→ suburban sound

→ sideways movement

→ distorted nostalgia

→ impossible glimpses

→ music stops

## D1 ends here.

The actual arrival and exploration of Suburbia belong to D2 documentation.

---

# 26. D1 DESIGN RULES

The following rules apply across all seven landmarks.

## Never turn every landmark into a monster encounter.

The Thing Below should not repeatedly attack simply because the player entered a named location.

The player should spend significant time wondering whether something is wrong before receiving confirmation.

## Preserve normality.

Ordinary rural architecture, believable furniture, realistic decay, familiar roads, and realistic objects are important because they create contrast with the impossible.

## Horror should primarily use:

* silence
* distance
* isolation
* scale
* darkness
* environmental evidence
* subtle movement
* recurring details
* spatial contradiction
* impossible geography
* restrained audio

Avoid relying on constant:

* jumpscares
* screaming faces
* gore
* loud stingers
* monster attacks
* supernatural effects

## Use escalation.

D1 should get progressively more intense.

Do not spend the final D1 chase-level intensity at Landmark 1.

Do not spend the final dimensional revelation at Landmark 3.

The biggest physical D1 scare belongs to the transition into Landmark 7.

## Do not over-explain.

Important mysteries should remain mysteries.

The player should leave D1 understanding more than they did at the beginning, but still have major unanswered questions.

## Curiosity must matter.

The player should repeatedly experience:

> “I wonder what's over there.”

and be rewarded for investigating.

---

# 27. D1 LANDMARK DISTINCTIVENESS CHECK

## Landmark 1

**Farm / visual navigation / suspense**

## Landmark 2

**School / human aftermath / first creature confirmation**

## Landmark 3

**Industrial infrastructure / impossible depth**

## Landmark 4

**Church / human history / unstable geography**

## Landmark 5

**Motel / perception / historical creature evidence**

## Landmark 6

**Grain Elevator / containment / new creature / suspense climax**

## Landmark 7

**Barn / culmination / impossible underground system / D1 transition**

No two landmarks should feel like the same experience with different architecture.

---

# 28. D1 PROGRESSION INTEGRITY

Every required progression piece must be acquired before the objective system allows the player to leave the relevant landmark.

The player should never be forced to revisit several previous landmarks simply because the final barn puzzle unexpectedly needs an item.

The final barn puzzle should instead make earlier exploration feel meaningful.

Earlier clues should become more valuable in hindsight.

---

# 29. D1 ASSET REQUIREMENTS

The asset library will eventually need dedicated support for:

## Landmark 1

* farmhouse
* barn
* livestock structures
* sheds
* workshop
* root cellar
* water tower
* rural machinery
* fields
* fencing
* family photographs
* blueprint
* tower markings
* tower key
* Old Utility Master Key (with its stamped marking)
* Water Tower brass/survey/utility disk
* flashlight, flashlight upgrade, and battery / charge pickups
* medical supplies

## Landmark 2

* schoolhouse
* classrooms
* gym
* cafeteria
* playground
* school buses
* lockers
* desks
* barricades
* notebooks
* drawings
* basement/crawlspace
* child-related story object
* The Thing Below

## Landmark 3

* substation equipment
* generator building
* transformers
* control panels
* technical signage
* cables
* underground conduit
* shaft
* camera
* investigator equipment
* ceramic/electrical component
* notes
* warnings

## Landmark 4

* rural church
* bell tower
* cemetery
* crypt
* candles
* stained glass
* records
* hidden room
* maps
* names
* photographs
* symbols
* notes

## Landmark 5

* 1950s motel
* motel rooms
* pool
* office
* parking lot
* beds
* lamps
* phones
* TVs
* furniture
* mirrors
* clocks
* photographs
* records
* security footage
* unidentified-person belongings
* survival supplies
* bandages
* shotgun ammunition
* motel key / key-fob

## Landmark 6

* grain elevator towers
* silos
* catwalks
* conveyors
* processing machinery
* grain trucks
* industrial vehicles
* damaged fencing
* cracked silo
* collapsed structures
* empty grain chamber
* shaft
* cables
* cage
* the Skin Stitcher
* cage metal component
* scientist equipment
* notebook/device
* machine

## Landmark 7

* ordinary barn
* hay
* farm equipment
* tools
* storage
* barricades
* survival supplies
* hidden mechanism
* D1 progression objects
* symbols
* map fragments
* stairwell
* underground chamber
* elevator
* giant cables
* doors
* strange floor indicator
* elevator lighting
* transition audio

---

# 30. D1 VALIDATION STANDARD

D1 should eventually be validated as one connected player experience, not just as seven isolated structures.

## World

* landmarks appear in intended geographic relationships
* landmarks are recognizable from useful distances
* rural traversal remains believable
* optional exploration remains available
* eastward macro-progression remains intact

## Landmark 1

* farm compound
* tower visibility
* photograph/blueprint sequence
* tower access
* tower reward
* Old Utility Master Key obtained
* Water Tower brass/survey/utility disk obtained
* no unintended major creature encounter

## Landmark 2

* school accessibility
* maintenance/basement access opened with the Old Utility Master Key
* basement accessibility
* story clues
* creature observation behavior
* child-related object
* safe exit

## Landmark 3

* power behavior
* control room access
* cable route
* shaft
* investigator evidence
* camera sequence
* no premature Suburbia reveal

## Landmark 4

* church access
* cemetery
* crypt
* hidden room
* unstable map
* whisper sequence
* exit behavior

## Landmark 5

* all rooms accessible
* mirror behavior
* clock behavior
* phone sequence
* TV sequence
* photograph sequence
* unidentified person evidence
* quiet outside reset
* persistence

## Landmark 6

* large-scale traversal
* claustrophobic section
* shaft
* rattling audio
* cage
* the Skin Stitcher
* scientist
* machine
* breakout
* the Skin Stitcher runs into the woods and does NOT pursue the player
* cage metal component obtained
* scientist disappearance
* exterior Skin Stitcher sighting
* transition toward Landmark 7

## Landmark 7

* the chase is performed by the Skin Stitcher
* barn arrival
* the destination signal: Church-map match, exterior work light, door slam, heavy movement
  outside, objective changes to survival/hiding — and NO marker or waypoint anywhere
* hiding-place logic
* all four physical objects already held on arrival — no backtracking
* puzzle logic
* mechanism
* floor opening
* stairwell
* underground chamber
* elevator
* impossible descent
* nostalgia sequence
* sideways transition

## Determinism

For a fixed world/save state:

* landmark placement
* landmark structure
* story objects
* progression objects
* puzzle state
* recurring environmental details
* intended scripted events

must remain deterministic.

## Performance

Landmark-heavy areas should be tested for:

* geometry count
* materials
* lights
* memory
* loading
* traversal
* object count
* browser performance

Optimization must not remove meaningful creative features simply to improve a benchmark.

---

# 31. D1 COMPLETION CRITERIA

D1 creative design is considered complete when all seven major landmarks are formally represented and the full journey is understandable as one continuous experience:

> **Farm Compound + Water Tower**
>
> → **Schoolhouse**
>
> → **Electrical Substation**
>
> → **Rural Church**
>
> → **Abandoned Motel**
>
> → **Abandoned Grain Elevator**
>
> → **Ordinary Barn**
>
> → **underground elevator system**
>
> → **sideways transition toward Suburbia**

The player should finish D1 feeling:

> **“I thought I was exploring an abandoned rural place. I was actually discovering the entrance to something much larger.”**

---

# 32. CANONICAL STATUS

**D1 — SHATTERED FARMLANDS: LOCKED ✅**

The seven-major-landmark structure is locked.

The creative purpose, identity, major sequences, major horror beats, progression relationships, and D1 finale are locked.

Implementation-specific details may change only where required by:

* technical constraints
* asset constraints
* performance requirements
* interaction implementation
* level layout
* playtesting

Any such changes must preserve the player-facing creative intent above.
