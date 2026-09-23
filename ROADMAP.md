

WHERE IT ISN'T
MASTER DEVELOPMENT ROADMAP — REBIRTH EDITION
Official title: WHERE IT ISN'T

Project state: Era 1 mechanically complete; final human-playthrough gate remains; next development milestone is Era 1.5 Architecture Split, followed by Era 2 Rebirth.

This document replaces the previous master roadmap.

It is the long-term development source of truth for:

game identity

player experience

development eras

completed milestones

future phases

story/horror direction

technical direction

permanent design decisions

STORY.md is authoritative for story canon and horror principles.
ROADMAP.md is authoritative for development order and phase intent.
PROGRESS.md records what has actually been built and verified.
Individual phase prompts contain implementation-level instructions.

1. GAME IDENTITY
Where It Isn't is a cinematic, atmospheric survival horror game about a familiar world that is being reconstructed incorrectly.

The game is built for browser delivery using technologies including:

HTML

JavaScript

CSS

Three.js

browser APIs

procedural generation

streamed world systems

custom geometry

deterministic systems

authored environments

environmental storytelling

survival mechanics

cinematic horror

The visual foundation is temporary
The Era 1 build used a voxel/chunk foundation.

That was useful for proving:

procedural generation

traversal

survival

progression

dimension logic

persistence

horror systems

It is NOT the final visual identity.

The long-term creative direction is a full non-voxel presentation.

The final game should not visually resemble Minecraft.

Era 2 therefore replaces:

block terrain

voxel buildings

voxel vegetation

voxel-first composition

cube-dependent presentation

with:

mesh terrain

authored architectural proportions

natural terrain silhouettes

high-quality vegetation

intentional materials

cinematic lighting

controlled environmental composition

stronger creature presentation

The game keeps its soul, story, dimensions, progression concepts, landmarks, and major horror ideas while changing the underlying visual representation.

2. CORE GAME CONCEPT
The player enters a world that initially appears familiar.

Over time, the player discovers that:

spaces do not always agree

familiar objects recur in impossible places

people are absent

the same world can exist in multiple reconstructed forms

observation influences what remains stable

Rifts are seams between incompatible reconstructions

the farther the player descends, the more hostile and unreliable the world becomes

The game combines:

psychological horror

environmental horror

physical survival horror

pursuit

claustrophobia

darkness

impossible spaces

authored scares

rare jumpscares

cinematic escalation

The player should not merely be afraid of monsters.

The player should eventually be afraid that the world itself cannot be trusted.

3. THE HORROR ESCALATION
The final game intentionally becomes scarier as it progresses.

The dimensions do NOT repeat the same horror recipe.

Dimension 1 — Shattered Farmlands
Core feeling: exposure.

The player feels:

isolated

vulnerable

visible

surrounded by darkness

unable to see what is outside the flashlight

Primary fear:

Something is out there.

Physical horror tools:

darkness

flashlight limitation

huge open spaces

distant movement

sounds beyond the player's view

sudden crossings

stalking

rural structures

authored jumpscares

eventual physical danger

The player should learn that darkness is not empty.

Dimension 2 — Static Suburbia
Core feeling: pursuit.

The player can see farther.

The threat becomes:

smarter

more deliberate

better at interception

harder to escape

capable of using familiar architecture

Primary fear:

It knows where I am.

Physical horror tools:

open streets

visible threats

houses as temporary shelter

being cut off

impossible interiors

pursuit

interception

authored jumpscares

danger inside previously safe spaces

Dimension 3 — The Below
Core feeling: helplessness.

The player enters the game's most extreme environment.

It contains:

impossible architecture

scale shifts

enormous chambers

crushingly small spaces

familiar objects embedded in impossible places

roads where roads cannot exist

structures with incompatible interiors

Primary fear:

I was never supposed to be here.

Physical horror tools:

sound-sensitive threat

stealth pressure

hiding

loss of safe hiding places

active hunting

claustrophobic movement

overwhelming creature scale

authored chase sequences

sensory confusion

Haven
Core feeling: safety.

The player is allowed to relax.

Then:

The safe place stops being safe.

Finale
Core feeling: insignificance.

The reconstruction is removed.

The underlying subject is exposed.

The final creature is NOT a boss.

4. TITLE
The official title is:

WHERE IT ISN'T
The title accumulates meaning through experience.

Examples:

a thing is missing

a thing appears where it should not

a road does not connect correctly

a room does not fit inside its house

a structure exists where the terrain cannot support it

a creature is suddenly somewhere it was not

a safe place ceases to contain safety

Do not reduce the title to a literal joke or catchphrase.

Never explain the title in dialogue.

The player should understand the title through what the world does.

5. PRIMARY CREATIVE GOALS
The final game should be:

genuinely scary

atmospheric

memorable

mysterious

visually distinct

physically threatening

mechanically playable

narratively coherent

streamer-friendly without being artificial

beautiful when it needs to be

disturbing when it needs to be

capable of creating genuine panic

capable of creating quiet dread

It should NOT become:

Minecraft with horror

a generic voxel survival game

a generic liminal-space game

a jumpscare compilation

a gore simulator

a boss-rush game

a constant chase

a walking simulator with no physical danger

a generic demon/hell game

a lore exposition simulator

6. HORROR PHILOSOPHY
The horror should use both psychological and physical fear.

Psychological horror creates:
anticipation

paranoia

uncertainty

recognition

distrust

dread

Physical horror creates:
pursuit

confinement

danger

helplessness

survival decisions

panic

Ideal structure:

psychological setup → physical threat → aftermath

Example:

The player hears movement for several minutes.

Eventually the threat appears.

The player must actually escape.

Afterward, the player is afraid to return to the same place.

Neither half should replace the other.

7. STREAMER / SPECTATOR DESIGN
The game should create genuine moments people naturally want to talk about, clip, or share.

A strong streamer moment should have:

setup

tension

a readable event

realization

reaction

The audience should generally understand why the player reacted.

Avoid relying on:

nearly invisible changes

sounds too quiet to survive commentary

random one-frame glitches

unreadable darkness

exposition-only reveals

Good reactions should naturally be things like:

“What was that?”

“It moved.”

“It's following me.”

“That wasn't there.”

“I know this place.”

“There's something in here.”

“Get me out.”

The goal is not to manufacture viral clips.

The goal is to make experiences worth sharing.

8. GAMEPLAY PHILOSOPHY
The player should:

explore

survive

gather when appropriate

craft when appropriate

investigate

travel

notice

interpret

hide

run

make mistakes

learn the world's rules

Objectives guide without turning the game into a waypoint simulator.

The world should communicate through:

roads

landmarks

sound

silhouettes

lighting

architecture

composition

recurring details

Do not rely on:

giant arrows

permanent waypoints

minimaps

excessive quest markers

constant tutorial popups

9. DEVELOPMENT ERAS
ERA 1 — GAME FOUNDATION
Status: mechanically complete

Purpose:

build the actual game

establish story

establish dimensions

establish progression

establish survival

establish environmental storytelling

establish audio

establish Haven

establish finale

prove normal progression

produce a playable alpha

Era 1 is intentionally not final visual quality.

ERA 1.5 — ARCHITECTURE SPLIT
Next major milestone

Purpose:

break the giant implementation into a maintainable architecture

separate gameplay from rendering

separate world logic from presentation

isolate major systems

create clear module boundaries

make Era 2 implementation safer

Target:
roughly 40 meaningful modules/files where justified.

ERA 1.5 is an architecture phase, not a visual rebirth and not a content expansion.

ERA 2 — REBIRTH
Next creative era

Purpose:

transform the game from voxel foundation to final non-voxel presentation

dramatically improve atmosphere

dramatically improve horror delivery

rebuild environments

rebuild creatures

rebuild lighting

rebuild audio presentation

rebuild cinematics

preserve the completed story and progression skeleton

Era 2 should feel like:

the same game, finally becoming the game it was always meant to be.

ERA 3 — DEEP HORROR / WORLD REACTIVITY
Potential later era.

Purpose:

deeper world memory

stronger systemic horror

more reactive encounters

more replayability

more environmental discoveries

more advanced creature behavior

Only pursue concepts that strengthen the core game.

ERA 4 — RELEASE
Purpose:

optimization

accessibility

compatibility

audio legality/licensing

save robustness

final QA

packaging

Steam/store presentation

launch preparation

10. ERA 1 — COMPLETED PHASES
The following phases are complete and form the current foundation.

PHASE 13 — STATIC SUBURBIA VISUAL REBIRTH
STATUS: COMPLETE

Improved:

suburban architecture

roads

curbs

sidewalks

driveways

lamps

mailboxes

landscaping

roofs

shaped geometry

Established the visual foundation for later Suburbia work.

PHASE 14 — STATIC SUBURBIA INTERIOR 2.0
STATUS: COMPLETE

Added structured residential interiors:

living rooms

kitchens

hallways

bathrooms

bedrooms

dining rooms

laundry rooms

garages

Added reusable furniture and deterministic room generation.

PHASE 15 — STATIC SUBURBIA MEMORY HORROR
STATUS: COMPLETE

Established:

deterministic anomalies

repeated objects

altered room relationships

subtle spatial inconsistency

memory uncertainty

observation-dependent changes

The neighborhood remains mostly believable.

PHASE 16 — INFINITE SHATTERED FARMLANDS
STATUS: COMPLETE

Established:

effectively infinite agricultural traversal

deterministic Farmland generation

fields

Rotting Fields

Ashen Forest

continuous generation

PHASE 17 — ABANDONED SETTLEMENTS + RURAL HORROR LANDMARKS
STATUS: COMPLETE

Added rural structure families and landmark logic:

farmhouses

barns

sheds

workshops

cabins

granaries

animal shelters

silos

wells

chapels

graveyards

memorials

PHASE 17.1 — FARMLAND DENSITY CORRECTION
STATUS: COMPLETE

Corrected encounter spacing so the Farmlands do not become functionally empty.

Validated density through real traversal distance rather than abstract area density.

PHASE 18 — FARMLAND ANIMALS + RURAL NAVIGATION
STATUS: COMPLETE

Animals:

cows

sheep

chickens

horses

Established:

animal behavior

rural paths

signs

farms

unusual stillness

observation behavior

PHASE 18.1 — FARMLAND ROUTE CHARACTER / PATH REBIRTH
STATUS: COMPLETE

Added:

curved route footprints

route archetypes

meaningful junctions

driveways

stronger travel composition

PHASE 18.2 — FARMLAND ANIMAL VISUAL REBIRTH
STATUS: COMPLETE

Rebuilt animal visuals using low-poly/custom geometry.

Established separate visual deterioration and behavioral wrongness.

PHASE 19 — FARMLAND ECOLOGY / ENVIRONMENT / WATER
STATUS: COMPLETE

Established:

environmental layering

terrain microvariation

crop/soil states

fences

machinery

orchards

drainage

vegetation

ponds

water behavior

rural ecosystem composition

PHASE 20 — FARMLANDS JOURNEY + DISCONNECTED HOME 2.0
STATUS: COMPLETE

Built the authored rural journey:

arrival

giant fallen water tower

massive standing water tower

giant barn

enormous living tree

Disconnected Home

Established a dedicated authored corridor through the procedural world.

PHASE 20.2 — GUIDANCE + COMPASS
STATUS: COMPLETE

Established:

“At the crossroads, go east.”

“Go east.”

earned compass

compass as persistent progression state

four real road directions

route guidance through environmental composition

PHASE 21 — DROPPED ITEM GROUND CONTACT
STATUS: COMPLETE

Fixed:

sinking

floating

landing gaps

ground support detection

Preserved:

pickup

rotation

bobbing

support wake-up

PHASE 22 — SETTINGS
STATUS: COMPLETE

Six settings:

master volume

music volume

SFX volume

mouse sensitivity

graphics quality

fullscreen

Established:

UI input gating

pointer-lock handling

pause behavior

localStorage persistence

PHASE 23 — SAVE / LOAD
STATUS: COMPLETE

Established:

browser-local save

schema versioning

migrations

corruption handling

repair logic

safe placement

persistent world edits

settings persistence

dimension persistence

Haven intentionally refuses save/load.

PHASE 24 — CANONICAL STORY FOUNDATION
STATUS: COMPLETE — SUPERSEDED BY NEW STORY BIBLE

Established:

record

reconstruction

observation

Anchor

Rift

Rift Core

Stalker

Behemoth

Farmlands

Disconnected Home

Static Suburbia

Haven

final creature

The original story canon has now been completely replaced by the current STORY.md.

PHASE 25 — DYNAMIC OBJECTIVE SYSTEM
STATUS: COMPLETE

Established:

persistent objectives

state-driven updates

concise guidance

observations rather than spoilers

PHASE 26 — REMOVE XP / REBUILD PROGRESSION
STATUS: COMPLETE

XP is permanently removed.

No:

XP bar

level system

XP thresholds

XP rewards

Progression is based on:

capability

discovery

Cores

survival milestones

world progression

PHASE 27 — HEALTH / PERCEPTION / HUD REBIRTH
STATUS: COMPLETE

Established:

health presentation

perception signal

objective line

hotbar

interaction prompts

unified visual tokens

Health and perception remain conceptually separate.

PHASE 28 — REMOVE TUTORIAL / ORGANIC ONBOARDING
STATUS: COMPLETE

Removed the old tutorial.

Established:

objective-driven onboarding

three contextual control cues

no traditional control screen

no duplicated tutorial layer

PHASE 29 — MAIN MENU REBIRTH
STATUS: COMPLETE

Rebuilt menu around:

landscape

atmosphere

subtle anomalies

restrained typography

minimal controls

menu ambience

PHASE 30 — OPENING LORE FILM
STATUS: COMPLETE

Established:

in-world opening

look-only presentation

controlled beats

subtle anomalies

minimal script

transition into eastward instruction

PHASE 31 — ENVIRONMENTAL STORYTELLING
STATUS: COMPLETE

Established:

absence

placement

repetition

contradiction

callbacks

traces

persistent noticing

PHASE 32 — FAKE HAVEN
STATUS: COMPLETE

Established:

genuine comfort

safety

delayed disruption

environmental removal

emotional contrast

PHASE 33 — FINAL CREATURE
STATUS: COMPLETE

Established:

enormous final silhouette

authored cinematic reveal

no conventional boss fight

no conventional combat

hard cut to ending

PHASE 34 — FINAL AUDIO INTEGRATION
STATUS: COMPLETE

Established:

centralized audio library

ambience

events

footsteps

animal audio

Stalker

Behemoth

Haven

finale

menu audio

34.1 / 34.2 / 34.3
STATUS: COMPLETE

Corrected:

loudness issues

ambience routing

event audibility

animal lookup

spatial assumptions

AudioContext lifecycle

transport failure

Critical discovery:
Recorded audio failed when the game was opened through file://.

Canonical testing environment:
HTTP/HTTPS only.

PHASE 35 — COMPLETE DIMENSION / STORY COHESION
STATUS: COMPLETE

Fixed:

Rift teardown

second Rift failure

progression dead ends

Behemoth gate persistence

powered Anchor recovery

lost Core recovery

respawn dimension errors

Suburbia sanity presentation

victory screen behavior

several stale-state issues

Proved:

real first Rift

real second Rift

Farmlands arrival

Suburbia arrival

Home traversal

save/load around transitions

no major state leaks

PHASE 36 — COMPLETE PLAYABLE ALPHA / FULL GAME AUDIT
STATUS: MECHANICALLY COMPLETE

The full normal progression has been validated in a browser without debug commands.

Found and fixed major failures involving:

Behemoth persistence

Anchor/Core recovery

victory-screen logic

ending reset

progression recovery

objective timing

Suburbia sanity

death/respawn

All major automated/browser suites passed in the delivered build.

Human gate
The final human full-playthrough remains the last validation step for Era 1.

The human test must use a served build.

Never use file:// as the audio test environment.

11. ERA 1 COMPLETION DEFINITION
Era 1 is considered mechanically complete when:

the game starts

opening works

progression works

both Rifts work

Farmlands works

Suburbia works

Haven works

finale works

save/load works

objectives work

settings work

audio works when served correctly

no major progression dead ends remain

automated validation is green

browser validation is green

Human playthrough is the final experiential gate.

12. ERA 1.5 — ARCHITECTURE SPLIT
Status: NEXT

This phase exists because the game is now large enough that continued development inside a giant monolithic file is unnecessarily risky.

Purpose
Turn the current working Era 1 build into a maintainable architecture.

Do NOT:

redesign the game

rebuild visuals

change story

change horror design

add new dimensions

start Era 2

rewrite systems merely for style

Target architecture
Separate major responsibilities such as:

Core
game lifecycle

state

input

timing

configuration

World
world abstraction

terrain

chunk management

generation

world edits

structures

Rendering
scene

camera

lighting

post-processing

materials

render layers

Player
movement

collision

health

perception

inventory

interaction

Progression
objectives

milestones

Core logic

dimension state

Dimensions
Farmlands

Suburbia

Haven

finale

future D3 interfaces

Horror
observation systems

anomalies

Stalker

Behemoth

Neighbor

future Below systems

Audio
library

director

buses

runtime audio loading

UI
main menu

HUD

settings

objectives

transitions

Persistence
save

load

migration

recovery

Success criteria
At the end of Era 1.5:

the game behaves the same

the story is unchanged

the horror is unchanged

the visuals are unchanged

save format remains compatible

the system is easier to modify

dependencies are explicit

future Era 2 rendering can be developed without rewriting gameplay

Architecture quality matters more than file-count for its own sake.

13. ERA 2 — REBIRTH
Central goal
Era 2 transforms the proven Era 1 game into the final visual and horror experience.

This is not a sequel.

This is not a reboot of the story.

It is a complete presentation and horror rebirth.

The player should recognize:

the same world

the same progression

the same mystery

the same landmarks where preserved

the same major encounters

But should no longer think:

“This looks like a voxel game.”

The final product should stand beside modern indie horror games visually and atmospherically.

14. ERA 2 CORE REBIRTH RULES
Rule 1 — Preserve the story
Never remove established canon without a deliberate canon decision.

Rule 2 — Preserve the progression spine
Do not casually remove critical progression relationships.

Rule 3 — Preserve meaningful landmarks
Landmarks can be rebuilt, resized, repositioned for composition, or redesigned.

Their narrative role must survive.

Rule 4 — Reduce voxel identity
Every major Rebirth phase should move the game further away from cube-first presentation.

Rule 5 — Increase horror identity
Every major Rebirth phase should improve fear, tension, physical danger, or atmosphere.

Rule 6 — Atmosphere before realism
The game does not need photorealism.

It needs believable, deliberate, scary spaces.

Rule 7 — Each dimension has a different fear
Do not give every dimension:

the same darkness

the same fog

the same chase

the same creature

the same scare pattern

Rule 8 — Physical fear matters
The final game must have:

danger

pursuit

confinement

escape

consequences

Psychological horror alone is insufficient.

Rule 9 — Do not overuse the strongest tools
The most powerful:

jumpscares

stingers

chases

reveals

distortions

should remain rare enough to matter.

Rule 10 — Preserve player agency where possible
The player should usually:

choose where to look

decide whether to investigate

decide when to run

decide where to hide

decide whether to continue

Forced moments are most powerful when used deliberately.

15. ERA 2 — DEVELOPMENT PRINCIPLES
Authored experiences > random spectacle
Procedural systems should create:

scale

variation

consistency

repeatability

Authored systems should create:

major scares

signature encounters

landmarks

key cinematic moments

Disconnected Homes

Haven

finale

Normality is still necessary
Do not make everything scary.

The player needs:

quiet

beauty

routine

empty travel

relief

before those things can be broken.

16. ERA 2 — PHASE 1 — FOUNDATION REBUILD
Goal:

Separate the final non-voxel world representation from gameplay.

Tasks:

world abstraction

render abstraction

terrain interface

entity interface

structure interface

interaction interface

dimension interface

save compatibility

audio integration

collision abstraction

Do not change the visible game more than necessary.

Success:
Gameplay systems do not depend directly on voxel rendering.

17. ERA 2 — PHASE 2 — TERRAIN REBIRTH
Goal:

Replace cube-shaped ground with authored natural terrain.

Tasks:

mesh terrain

natural slopes

hills

valleys

cliffs

erosion

path integration

riverbeds

drainage

horizon control

terrain blending

Success:
A screenshot no longer reads as voxel terrain.

18. ERA 2 — PHASE 3 — VEGETATION REBIRTH
Goal:

Replace voxel vegetation with final vegetation.

Tasks:

realistic/stylized grass

crops

bushes

trees

dead trees

fallen trees

stumps

ferns

rocks

moss

ashen vegetation

wind motion

Vegetation must support each dimension's identity.

19. ERA 2 — PHASE 4 — ARCHITECTURE REBIRTH
Goal:

Replace cube-built structures with intentional architecture.

Tasks:

houses

barns

sheds

farm buildings

cabins

utility structures

suburban buildings

interiors

furniture

roofs

windows

trim

porches

doors

stairs

structural details

Use:

GLB models

custom meshes

modular architectural pieces

authored compositions

Preferred asset direction:

high texture quality

reasonable polygon count

optimized runtime size

GLB where appropriate

20. ERA 2 — PHASE 5 — LIGHTING REBIRTH
Goal:

Create the final visual atmosphere.

Tasks:

dynamic lighting

realistic darkness

fog

volumetric effects where practical

atmospheric perspective

interior/exterior contrast

dusk

night

sunrise

weather lighting

shadow quality

cinematic color control

Do not make every dimension dark.

Each dimension needs its own visual relationship with light.

21. ERA 2 — PHASE 6 — DIMENSION 1 / SHATTERED FARMLANDS REBIRTH
This is the first final horror dimension.

The current Era 1 Overworld is discarded as the final D1.

The final D1 is the Shattered Farmlands.

D1 core fear
Something is out there.

Physical feeling
The player should feel:

exposed

alone

small

visible

vulnerable

Major tools
Flashlight
A useful but limited cone of certainty.

It should:

reveal enough to travel

never illuminate the whole environment

create meaningful blind areas

LOCKED RESOURCE MODEL: a permanent handheld flashlight with a finite battery charge that drains
while it is on. Batteries and charge pickups are found in the world; there is no automatic
regeneration and no crafting. It stays relevant for the whole of D1. Landmark 1 yields an
UPGRADE TO THE FLASHLIGHT ITSELF — beam quality, range, efficiency — not a replacement system.
Battery management should create tension, not inventory micromanagement. See `D1_DESIGN.md`
section 0.3.

D1 WORLD EXTENT: 4,096 m x 4,096 m, centred on the origin of D1's local space. LOCKED, not
provisional. See `D1_DESIGN.md` section 0.4.

Darkness
Used deliberately rather than permanently.

The player should experience:

dusk

moonlight

lit buildings

dark fields

forest edges

near-total darkness in authored sequences

The environment
Use:

giant fields

tree lines

farmhouses

barns

sheds

fences

roads

utility poles

isolated lights

the water tower

Physical threats
Build toward:

distant movement

branch/vegetation disturbances

visible crossings

following sounds

staged stalking

real chase sequences

Signature escalation
Early:
quiet rural normality

Middle:
things occur outside the flashlight

Late:
the player discovers the darkness contains an actual threat

Final:
a deliberate physical encounter/chase forces the player to survive

The previously approved Farmlands jumpscare remains part of the final design.

22. ERA 2 — PHASE 7 — FARMLANDS JOURNEY / LANDMARK HORROR
Turn the rural route into a cinematic journey.

THE CURRENT FINAL-GAME CHAIN IS THE SEVEN AUTHORED LANDMARKS:

1. Farm Compound + Water Tower

2. Schoolhouse

3. Electrical Substation

4. Rural Church

5. Abandoned Motel

6. Abandoned Grain Elevator

7. Ordinary Barn / underground elevator facility

Landmark 6 holds the Skin Stitcher; Landmark 7 holds the barn puzzle and the underground
elevator.

**`D1_DESIGN.md` IS THE DETAILED D1 SOURCE OF TRUTH.** It owns every landmark's architecture,
interiors, sequences, horror beats, progression relationships and the finale. This roadmap
carries sequencing and implementation direction only and must not re-specify a D1 sequence.
Where this file and `D1_DESIGN.md` disagree about D1, `D1_DESIGN.md` wins.

Landmarks must remain materially distinct in architecture, atmosphere, story function
and horror function.

HISTORICAL NOTE — THE OBSOLETE SIX-BEAT CHAIN.
This section previously listed: arrival / fallen water tower / standing water tower /
giant barn / great tree / disconnected home. That was the ERA 1 PHASE 20 journey, built
on the voxel Farmlands. It is historical material and is NOT current Era 2 design. Do not
implement it, and do not treat it as a chain the seven landmarks must preserve. What
survives from it is the WATER TOWER, which is Landmark 1, and the Disconnected Home as a
canonical structure type (STORY.md section 12) rather than a fixed beat in this sequence.

Improve:

composition

distance

scale

weather

visibility

environmental storytelling

audio

transitions

authored encounters

The water tower remains a major visual anchor.

Its red light remains unexplained.

23. ERA 2 — PHASE 8 — STATIC SUBURBIA REBIRTH
This is Dimension 2.

Core fear
It knows where I am.

Suburbia should NOT copy Farmland horror.

It should often be:

visible

lit

readable

geographically understandable

Then the player discovers that visibility is not safety.

Main horror tools
Open streets
Long sightlines allow the threat to be seen.

Interception
The threat can get ahead of the player.

Houses
Temporary shelter that can become traps.

Impossible interiors
Spaces cease to obey exterior geometry.

Repetition
The same house/object appears where it should not.

Observation
Changes are discovered, not watched happening.

The previously approved Suburbia jumpscare remains.

24. ERA 2 — PHASE 9 — SUBURBIA ENTITY / NEIGHBOR
Build the primary Suburbia hunting entity.

It should feel:

at home

familiar

person-shaped

wrong

deliberate

physically dangerous

Behavior escalation:

distant observation

window sightings

street sightings

positioning

interception

entry into occupied spaces

chase

temporary player escape

Do not make it:

a talking villain

a conventional boss

a lore dump

a generic monster

Its personality should be expressed through behavior.

25. ERA 2 — PHASE 10 — THE BELOW REBIRTH
Dimension 3.

This is the strongest horror chapter.

Core fear
I was never supposed to be here.

Environment
Not literal Hell.

No:

lava

generic demons

infernal symbols

generic underworld imagery

Instead:

impossible interiors

giant chambers

tiny crawlspaces

roads inside buildings

houses embedded in walls

upside-down bedrooms

forests inside rooms

towers embedded in ceilings

architecture that cannot fit together

The world should look physically wrong rather than generically evil.

Scale contrast
Move between:

enormous spaces

narrow tunnels

giant shafts

small rooms

claustrophobic corridors

The player should lose comfortable spatial intuition.

26. ERA 2 — PHASE 11 — THE BELOW CREATURE
Working/internal name:

The Collector

Do not assume this is its final in-game name.

Core behavior
The creature hunts through:

sound

movement

environmental response

The player can:

walk quietly

run loudly

hide

make mistakes

attract danger

Escalation
Early:
the player hears distant movement

Middle:
sound produces responses

Later:
the creature actively hunts

Late:
hiding places stop being reliable

Final:
the player must physically escape

The creature should rarely show its entire body early.

Use:

silhouettes

limbs

partial faces

movement behind architecture

impossible scale

27. ERA 2 — PHASE 12 — HORROR EXPANSION
Goal:

Implement the game's strongest authored scare library.

Categories:

Farmlands
darkness encounters

distant sightings

rural pursuit

existing signature jumpscare

rare large events

Suburbia
interception

house invasion

existing signature jumpscare

street pursuit

impossible safe rooms

Below
sound hunting

hiding failures

impossible-space chase

creature encounters

escape sequences

Haven
safety collapse

invasion

physical threat inside the refuge

Rules
No:

scare spam

constant stingers

constant chase music

random monster placement everywhere

Strong scares need contrast.

28. ERA 2 — PHASE 13 — HAVEN REBIRTH
Goal:

Make Haven the most emotionally comfortable place in the game.

Tasks:

beautiful materials

warm lighting

high-quality furniture

specific objects

fire

room detail

atmospheric sound

comfortable pacing

The player should genuinely want to stay.

Then the safety fails.

The failure should be:

gradual

physical

unnerving

emotionally meaningful

Do not reveal the final creature early.

29. ERA 2 — PHASE 14 — AUDIO REBIRTH
Goal:

Create the final audio identity.

Preserve the working architecture.

Improve:

mix

source quality

environment-specific beds

spatial placement where appropriate

transitions

threat audio

silence

room tone

chase intensity

Audio must serve dimension identity:

Farmlands
wind

distant rural sounds

sparse animal calls

open-space distance

darkness

Suburbia
electrical hum

houses

distant traffic

footsteps

occupancy

street ambience

Below
extreme quiet

structural sounds

sound-response cues

low environmental pressure

intense chase audio

deliberate silence

Haven
warmth

fire

soft ambience

emotional comfort

Never return to the old retro exploration music.

30. ERA 2 — PHASE 15 — CINEMATICS
Rebuild:

opening

the D1 barn → stairwell → elevator descent → D2 transition (the elevator, not a Rift)

remaining Rift transitions where they are still used

Farmlands signature sequences

Suburbia sequences

Haven transition

finale

Cinematics must:

use the final art direction

preserve the story

avoid over-explaining

support horror pacing

avoid taking control away for too long

31. ERA 2 — PHASE 16 — WORLD REACTIVITY / THE WORLD REMEMBERS
Potential first version of the later reactive concept.

Possible memory inputs:

repeated routes

repeated hiding locations

objects the player moves

places where the player spends significant time

death locations

frequently inspected objects

Effects should remain subtle.

Never show:

memory meters

relationship stats

visible "the world remembers you" systems

The feeling should be:

“This place noticed me.”

32. ERA 2 — PHASE 17 — WORLD POLISH
Goal:

Make every surviving environment feel intentional.

Audit:

composition

landmarks

lighting

materials

vegetation

audio

transitions

interactions

horror pacing

performance

Remove:

obvious procedural repetition

placeholder objects

inconsistent materials

visual noise

accidental dead spaces

33. ERA 2 — PHASE 18 — RELEASE CANDIDATE REBIRTH
Goal:

Create the first truly final-looking build.

Check:

visual identity

performance

stability

horror

progression

audio

save/load

accessibility

compatibility

controls

final asset licensing

credits

packaging

34. ERA 3 — DEEP HORROR / REPLAYABILITY
Potential systems:

more sophisticated world memory

stronger entity behavior

rare alternate events

persistent environmental consequences

deeper environmental storytelling

hidden discoveries

controlled replay variation

Do not add systems merely because they sound impressive.

35. ERA 4 — RELEASE
Final goals:

performance

compatibility

accessibility

legal/audio licensing review

save robustness

input reliability

loading

error recovery

credits

packaging

trailer

Steam page

screenshots

demo if appropriate

achievements if appropriate

final QA

The game must be evaluated as a product, not simply as a finished prototype.

36. PERMANENT DESIGN DECISIONS
GAME NAME
Where It Isn't.

XP
Removed permanently.

TUTORIAL
Removed permanently.

VISUAL IDENTITY
Final game is non-voxel.

DIMENSION 1
Final D1 is Shattered Farmlands.

DIMENSION 2
Final D2 is Static Suburbia.

DIMENSION 3
Final D3 is The Below, pending final naming.

ANIMALS
Animals are not default enemies.

HORROR
Psychological + physical.

ESCALATION
Each dimension becomes scarier in a different way.

JUMPSCARES
Allowed, rare, authored, meaningful.

FINAL CREATURE
Not a boss.

HAVEN
Must begin genuinely safe.

STORY
Mystery remains stronger than explanation.

STREAMER VALUE
Design for genuine reactions, not artificial content bait.

37. DIMENSION IDENTITY SUMMARY
Dimension	Core Fear	Main Tools
D1 — Shattered Farmlands	exposure	flashlight, darkness, distance, unseen threat, rural pursuit
D2 — Static Suburbia	pursuit	visible threat, interception, houses, impossible interiors
D3 — The Below	helplessness	sound hunting, claustrophobia, impossible architecture, overwhelming creature
Haven	loss of safety	comfort, invasion, shrinking safety
Finale	insignificance	scale, removal, exposure
38. DEVELOPMENT VALIDATION PRINCIPLE
Every major phase must test two things:

What the code says
Automated tests, deterministic checks, browser tests, performance measurements.

What the player experiences
Human playtesting.

No phase involving:

horror

pacing

audio

atmosphere

navigation

visual readability

should be considered experientially complete from automation alone.

39. PLAYTESTING PRINCIPLE
The human tester should report:

what felt scary

what felt boring

where they got confused

where they felt safe

where safety failed

which sounds stood out

which sounds were missing

where they wanted to stop

which moments they remembered afterward

whether important locations were findable

Do not require the human tester to diagnose implementation.

The player's reaction is evidence about the experience.

40. PROCEDURAL VS AUTHORED PRINCIPLE
Use procedural systems for:

scale

variation

repeatability

background life
NEW KEY ADDITION:
# ERA 2 CREATIVE EXPANSION — CURRENT LOCKED D1/D2 DIRECTION

These additions translate the current creative design into implementation-facing milestones.

**For D1, `D1_DESIGN.md` is the detailed source of truth.** This section carries
implementation-facing milestones only. The staged D1 implementation order is in the
"D1 — Shattered Farmlands Implementation" section at the end of this file. Between the three,
there is exactly one authority for each kind of information: `D1_DESIGN.md` for what D1 *is*,
this section for what the milestones *are*, and the tail section for what order to *build* them
in. None of them may re-specify a D1 sequence that `D1_DESIGN.md` owns.

## Era 2 — Dimension 1: Shattered Farmlands

The final Farmlands should contain a substantial authored journey with seven major landmark beats:

1. Farm Compound + Water Tower
2. Schoolhouse
3. Electrical Substation
4. Rural Church
5. Abandoned Motel
6. Abandoned Grain Elevator
7. Ordinary Barn / hidden underground elevator facility

The purpose is variety and authored progression, not arbitrary landmark count.

### Landmark 6 — Abandoned Grain Elevator

Implement as:
- huge visible industrial landmark
- deteriorated but standing
- partial collapse
- large industrial interiors
- huge storage spaces
- claustrophobic collapsed routes
- bottomless shaft
- rattling/mechanical activity below

Add the **Skin Stitcher** discovery sequence. The Skin Stitcher is the official name of the
creature contained in the cage.

The Skin Stitcher is a major D2-facing entity and must survive the D1 → D2 narrative
transition. When it escapes it runs into the woods and does **not** immediately pursue the
player.

### Landmark 7 — Ordinary Barn / Underground Elevator

Surface:
- believable rural barn
- mostly ordinary
- one exterior work light still on — the subtle reason to notice and approach it

Destination signal (LOCKED, and it is environmental):
- the barn matches the location on the Church map from Landmark 4
- the exterior work light is still burning
- on entering, the entrance slams shut behind the player
- heavy movement is heard outside
- the objective changes to a survival/hiding state
- **no quest marker, no glowing waypoint, no supernatural "final landmark" indicator**

Interior:
- final progression puzzle
- **four physical objects** plus knowledge gathered across earlier landmarks
- no arbitrary backtracking
- final hidden mechanism
- concrete stairwell
- enormous underground elevator chamber

This elevator becomes the canonical physical bridge between reconstruction layers.

**The D1 final transition is the elevator, not a Rift.** The barn does not reveal a Rift. Rift
Cores remain the three progression hinges and there is no fourth; the elevator is physical
traversal. Do not reintroduce a D1 Rift transition.

### D1 progression items

- **Old Utility Master Key** — found in the Landmark 1 Water Tower cache. It opens the locked
  maintenance/basement access at the Schoolhouse (Landmark 2). It carries an unusual stamped
  marking whose significance is not initially understood. It is **not** a barn-puzzle object.
- **The four barn-puzzle objects** — Water Tower brass/survey/utility disk (L1), ceramic/
  electrical component (L3), motel key/key-fob (L5), Skin Stitcher cage metal component (L6).
  Landmarks 2 and 4 contribute **knowledge**, not objects.

`D1_DESIGN.md` sections 2 and 15 own the detail.

### D1 finale

The Farmlands finale includes the previously approved physical chase, and **the Skin Stitcher
performs it** — not The Thing Below:

While travelling toward Landmark 7 the Skin Stitcher appears behind the player, disappears,
then reappears directly in front of them for the major authored jumpscare, followed by a
physical chase into the barn. `D1_DESIGN.md` section 11 owns the beat list.

---

## Era 2 — Phase 8: Static Suburbia Rebirth

Build Static Suburbia as:
- beautiful
- liminal
- nostalgic
- empty
- preserved
- memory-like

Do not treat it as an inhabited suburban society.

### D2 progression

The player must have a concrete reason to explore:
- obtain meaningful survival resources
- gather progression components
- follow the route deeper
- discover how Farmlands and Suburbia relate

Use authored recognition:
- Farmlands objects
- repeated objects
- photographs
- symbols
- familiar road relationships
- callbacks to prior landmarks

The player should discover:
“This is the same place.”

### D2 deterioration

The visual progression is:

perfect suburb
→ subtle aging
→ dirt
→ damage
→ structural failure
→ spreading road cracks
→ enormous exposed depths
→ complete reconstruction collapse

This deterioration is a major progression/pacing mechanic, not random cosmetic corruption.

---

## Era 2 — Phase 9: Suburbia Entity / the Skin Stitcher

The primary Suburbia entity is the same creature first encountered in the Farmlands Grain Elevator.

Do not create a second unrelated D2 entity unless a future explicit design decision changes this.

Behavior:

observation
→ positioning
→ interception
→ pursuit
→ cornering

The entity should feel like it belongs in Suburbia.

It should increasingly appear ahead of the player rather than simply chase from behind.

The player's eventual understanding should be:

“It is getting ahead of me.”

---

## D2 signature horror sequence

Near the end of Suburbia:

- large suburban house
- final progression item
- lights fail
- doors/windows lock
- creature hunts inside
- player hides and evades
- sound-based uncertainty
- one major authored jumpscare

Preserve the previously approved authored hallway scare.

Do not replace it with multiple conventional jumpscares.

---

## D2 center / Water Tower sequence

At the center of Suburbia:

- massive converging intersection
- enormous Water Tower callback
- frantic red warning light
- damage and rust
- legs disappearing into deep cracks
- creature trail leading there

The Water Tower should become the major visual anchor of the D2 collapse.

---

## D2 → D3 transition

The collapse of Suburbia reveals the elevator system beneath the reconstruction.

Do not use a generic portal or generic falling transition.

Use the elevator as the canonical bridge into The Below.

Sequence:

Suburbia collapses
→ elevator system exposed
→ player reaches elevator
→ nostalgic music briefly returns
→ music distorts
→ the Skin Stitcher heard moving deeper
→ impossible descent
→ elevator stops
→ doors open extremely slowly
→ The Below begins

---

## Era 2 — Phase 10: The Below

The Below must remain the strongest horror chapter.

Core fear:
“I was never supposed to be here.”

Build:
- impossible interiors
- giant chambers
- tiny crawlspaces
- roads inside buildings
- houses embedded in walls
- upside-down rooms
- forests inside rooms
- giant shafts
- impossible architecture
- extreme scale contrast

D2 should build anticipation for this chapter rather than competing with it through constant jumpscares.

---

## CANON RESOLUTIONS — SETTLED, DO NOT RE-LITIGATE

Three ambiguities were raised during Era 2 planning and answered by the project owner.
They are recorded here so a future session does not flag them again or invent a compromise.

### 1. The seven landmarks are the D1 chain

The six-beat chain that used to head section 22 is obsolete historical material from the
Era 1 Phase 20 voxel journey. Section 22 now carries the seven landmarks and says so.

### 2. The Skin Stitcher IS the Suburbia entity, and "it belongs here" is BEHAVIOURAL

**The Skin Stitcher** — formerly called "the cage creature" — is the creature caged in the D1
Grain Elevator, and it is the same entity that hunts the player in Static Suburbia. Its cage
encounter and escape are canonical, and it also performs the Landmark 6 → 7 chase.

STORY.md section 5.7 says the Suburbia entity should feel like it "belongs here". That
means: ONCE IT REACHES SUBURBIA IT BEHAVES AS THOUGH THE NEIGHBOURHOOD IS ITS TERRITORY.

It does NOT mean the creature has a Suburbia origin, a mythology, or a lore explanation.
There is no conflict between section 5.7 and the cage encounter: the player witnesses an
ESCAPE, never an ORIGIN. Where the creature came from, what the cage was for, who built
it and why the creature is going deeper all remain unexplained, per section 26.

Do not add a second unrelated D2 entity, and do not write an origin story for this one.

### 3. Rift Cores AND the elevator both exist, and neither replaces the other

RIFT CORES remain the three progression hinges — fragments of the record, exactly as
STORY.md sections 11 and 9 describe. THERE IS NO FOURTH CORE.

THE ELEVATOR is the PHYSICAL TRAVERSAL MECHANISM connecting the reconstruction layers. It
is a place the player walks into and rides, not a progression token.

The two are different kinds of thing and must coexist:

    a Core is WHY the next layer becomes reachable
    the elevator is HOW the player physically gets there

Do not collapse one into the other, do not gate the elevator on a fourth Core, and
DO NOT CHANGE THE SAVE SCHEMA to accommodate the elevator. The schema is version 5 and
the elevator is world state, not progression state.

---

## Creative continuity rule

Before implementing any Era 2 D1/D2/D3 phase, read:
- STORY.md
- ROADMAP.md
- current architecture documentation

Do not assume that older Era 1 implementation details are still the intended final-game presentation.

The final game remains fully non-voxel.

Story mystery remains stronger than explanation.

traversal

Use authored systems for:

major horror events

signature scares

Disconnected Homes

landmark staging

Haven

finale

critical transitions

major creature encounters

The final game should feel authored even when large portions of the world are generated.

41. PERFORMANCE PRINCIPLE
Measure before optimizing.

Track:

generation

streaming

rendering

memory

entity counts

audio nodes

terrain meshes

lighting

interiors

transitions

long traversal

worst-case horror scenes

Do not make performance claims without measurements.

42. ASSET PIPELINE PRINCIPLE
Final Era 2 assets should prioritize:

strong visual quality

coherent art direction

appropriate scale

reasonable file size

efficient runtime materials

GLB when practical

clear attribution

Original source files and credit information must remain intact.

Runtime processing must never erase source attribution.

43. CODEBASE PRINCIPLE
Until Era 1.5:

do not perform the architecture split accidentally

During Era 1.5:

architecture becomes the primary target

During Era 2:

final rendering/world representation should be independent of gameplay logic

Never combine a risky architectural rewrite with an unrelated giant gameplay redesign unless explicitly planned.

44. CONTEXT RESET PRINCIPLE
The repository must remain understandable without the development chat.

The project should contain:

code

CLAUDE.md

ROADMAP.md

PROGRESS.md

STORY.md

audio index/credits

tests

useful development documentation

A new development session should read the repository before making assumptions.

45. CURRENT PROJECT STATUS
Era 1
Mechanically complete.

Current build:

playable

progression complete

Rifts functional

Farmlands functional

Suburbia functional

Haven functional

finale functional

audio functional when properly served

save/load functional

settings functional

browser validation green

Outstanding Era 1 gate
Human full-playthrough of the final Phase 36 build.

This must be:

normal play

served via HTTP/HTTPS

no debug commands

no save editing

Next development milestone
ERA 1.5 — ARCHITECTURE SPLIT

Then:

ERA 2 — REBIRTH

46. NORTH STAR
The ultimate goal is not:

Make a large voxel horror game.

It is:

Create a horror world that begins familiar, becomes physically frightening, and ultimately makes the player afraid of the reliability of reality itself.

The player should remember:

the first time they walked through the dark Farmlands

the first time something appeared where it shouldn't

the first time Suburbia actively hunted them

the first time they realized a house was not safe

the first time they entered The Below

the first time the Below creature found them

the moment Haven felt safe

the moment that safety disappeared

the final creature's impossible scale

The ideal final reaction is not merely:

“That was scary.”

It is:

“I don't want to go back there.”

And after the ending:

“What the hell was that?”

The game should answer enough to make the experience coherent.
## D1 — Shattered Farmlands Implementation

**This is the D1 implementation staging order. It is the only place in this file that defines
one.** The creative design it implements is locked in `D1_DESIGN.md`; the milestone list is in
the ERA 2 CREATIVE EXPANSION section above.

D1 implementation must follow `D1_DESIGN.md`.

Implementation should proceed through the finalized seven-landmark chain:

1. Farm Compound + Water Tower
2. Schoolhouse
3. Electrical Substation
4. Rural Church
5. Abandoned Motel
6. Abandoned Grain Elevator
7. Ordinary Barn / Underground Elevator System

Implementation work should be staged rather than building all seven landmarks simultaneously.

Recommended implementation order (status is tracked in `PROGRESS.md`):

**Phase 1 — Composite PhysicalWorld: COMPLETE.** One gameplay-facing physical world composes
terrain with mesh/architecture collision, which is the prerequisite for any enterable D1
building. Engineering only — it builds no landmark. See `ARCHITECTURE.md` section 4.11.

**Phase 2 — Normalized raycast + interaction vocabulary: COMPLETE.** The physical world can be
asked what is along a ray and answers in representation-neutral terms, and there is one shared
vocabulary for the difference between *the ray hit something* and *the player can do something
with it* — three affordances, a registry, and refusals with reasons. `voxelRaycast` and every
one of its gameplay callers were left exactly as they were. Engineering only: **no interaction
target, no prompt, no verb and no D1 content is authored by it.** See `ARCHITECTURE.md`
section 4.12.

**Phase 3 — Visual rules + production budget enforcement: COMPLETE.** `VISUAL_RULE_BIBLE.md`
section 9.1's production budgets are now a measurable model with a validator, and geometry,
materials, textures, texel density and live scene resources can all be measured
deterministically. Budgets stay GUIDELINES: every result reports both what the number is and
what a gate should do about it, only the texture rule blocks, and a deliberate overrun must
be stated on the asset with a reason and reads as an exception rather than a pass.
Engineering only: **no production asset, no Blender, no Astra, no D1 content.** See
`ARCHITECTURE.md` section 4.13.

**Phase 4 — Production assets: IN PROGRESS. Asset 001 (`prop.rural-fence-post-01`) is
INTEGRATED.** The human-approved Revision 03 fence is in the production pipeline:
byte-identical runtime copy, registry row, `FIRST-PARTY` provenance, `small-prop` budget
(PASS, no exception), two declared collision boxes, and representative-scene validation in the
live renderer. It is **placed nowhere** in the shipped world. D1 layout is not started. The
representative scene found two renderer-wide gaps: no output colour transform and no
environment lighting. They make every sRGB-textured PBR asset render far too dark and every
metal read dark. They are recorded in `ARCHITECTURE.md` section 4.14 as E2.5 decisions, not
asset defects.

*Phase 4 planning note — asset sourcing (TENTATIVE, project owner's current direction, not yet
implemented):* a HYBRID strategy. **Generic / common assets** should prefer high-quality,
legally usable sourced base assets where appropriate, then be normalised and touched up to
`VISUAL_RULE_BIBLE.md`. **Unique / signature assets** should prefer Astra / custom authoring.
No sourcing system exists yet. Every asset still enters through the registry with an explicit
licence status: a third-party grant, or `FIRST-PARTY`.

1. D1 world/layout foundation
2. landmark placement and traversal
3. reusable rural/environment assets
4. Landmark 1
5. Landmark 2
6. Landmark 3
7. Landmark 4
8. Landmark 5
9. Landmark 6
10. Landmark 7
11. D1-wide progression integration
12. D1-wide audio/horror integration
13. save/load and persistence validation
14. full first-person D1 playtest
15. performance and regression pass

Do not redesign D1 during implementation.

If an implementation constraint requires a change, preserve the intended player experience and update the detailed design document explicitly rather than silently changing canon.

D1 implementation must not begin by inventing replacement landmark concepts.

The creative source of truth is `D1_DESIGN.md`, with `STORY.md` remaining the broader story canon.


It should never answer enough to make the experience harmless.

END OF ROADMAP
