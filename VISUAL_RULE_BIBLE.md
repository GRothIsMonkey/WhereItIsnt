# WHERE IT ISN'T

# VISUAL RULE BIBLE

**Status:** Canonical Era 2 Visual Authority
**Applies to:** D1, D2, D3, creatures, architecture, vegetation, props, vehicles, interiors, terrain, environmental assets, materials, lighting, and future AI-generated content
**Primary audience:** Game Director, Creative Director, Claude, Astra, Blender/asset-processing workflow, future contributors

---

# 0. PURPOSE

This document defines the visual identity of the final version of **WHERE IT ISN'T**.

It exists to prevent the final game from becoming:

* a collection of unrelated marketplace assets
* a collection of unrelated AI-generated models
* a mixture of realism levels
* a mixture of artistic styles
* an inconsistent collection of textures and materials
* a visually generic horror game
* a Minecraft-like visual experience
* three visually unrelated games stitched together

The final game must instead feel like:

> **One deliberately authored world with one underlying visual language, expressed differently as the player moves through increasingly disturbing layers of that world.**

Every asset, environment, creature, material, lighting setup, and visual effect must support that goal.

This document is more important than the visual appeal of any individual asset.

A beautiful asset that does not belong in the game is still a failed asset.

---

# 1. ABSOLUTE CREATIVE IDENTITY

## 1.1 Final game representation

The final game is a **traditional non-voxel 3D game**.

The finished game does NOT use:

* Minecraft-style block terrain
* arbitrary block destruction
* Minecraft-style block placement
* cube-based environmental construction
* voxel-style architecture as the dominant visual language
* block-grid visual limitations

The old voxel implementation is an Era 1 technical foundation and transitional implementation.

It is NOT the final visual identity.

The final world uses:

* continuous mesh terrain
* modeled architecture
* real 3D vegetation
* modeled props
* custom geometry
* GLB/GLTF assets
* semantic physical collision
* traditional 3D materials
* authored environments
* controlled procedural dressing where appropriate

---

# 2. MASTER VISUAL TARGET

The final visual target is:

> **Grounded cinematic realism with a subtle stylized edge, presented through dark survival-horror sensibilities, with a single unified material and construction language across the entire game.**

The game should feel:

* physically believable
* cinematic
* atmospheric
* grounded
* tactile
* detailed
* coherent
* authored
* regionally consistent
* unsettling when appropriate
* visually distinctive without becoming cartoonish

The game should NOT attempt to become photorealistic merely for the sake of photorealism.

Likewise, the game should NOT become strongly low-poly merely because low-poly production is easier.

The target is the middle ground:

**high visual fidelity + believable physical reality + controlled stylization + deliberate art direction**

---

# 3. MASTER ART PRINCIPLES

## 3.1 Believability before spectacle

The environment should first feel like a place that could physically exist.

The horror becomes more effective when the player accepts the environment as real.

Avoid making ordinary environments visually fantastical simply to make them interesting.

Ordinary objects should generally remain ordinary.

The world becomes frightening because the player discovers what is wrong with it.

---

## 3.2 One game, not an asset collection

Every asset must visually belong beside the other assets.

The following should remain coherent across the project:

* geometry language
* proportions
* material response
* roughness behavior
* texture/detail density
* color discipline
* weathering
* lighting response
* scale
* construction vocabulary

An individual model should never be evaluated only in isolation.

### Asset acceptance rule

An asset is not production-ready because:

> “The model looks good.”

It is production-ready only when:

> **“The model looks like it was made for WHERE IT ISN'T and belongs naturally beside the existing world.”**

---

## 3.3 Controlled stylization

Stylization should be subtle and purposeful.

Allowed stylization can appear through:

* slightly simplified geometry
* controlled silhouettes
* deliberate shape language
* restrained texture simplification
* intentional color relationships
* subtle material exaggeration
* clean visual readability

Stylization must not destroy:

* believable scale
* believable construction
* environmental plausibility
* material recognition
* grounded horror

---

# 4. GEOMETRY LANGUAGE

## 4.1 General geometry

Geometry should generally be:

* realistic in proportion
* moderately to highly detailed
* cleanly constructed
* optimized for real-time rendering
* visually coherent with neighboring assets
* slightly stylized where appropriate

Avoid unnecessarily complicated topology that produces no visible gameplay benefit.

---

## 4.2 Silhouettes

Important objects should have strong, readable silhouettes.

This is particularly important for:

* landmarks
* creatures
* large props
* vehicles
* major environmental structures

Silhouette should remain recognizable at normal gameplay viewing distances.

---

## 4.3 Imperfection

The world should not look procedurally perfect.

Objects may contain:

* slight asymmetry
* natural bends
* manufacturing variation
* small imperfections
* uneven wear
* slight damage
* environmental accumulation

However:

**random imperfection is not the goal.**

Imperfection must still feel physically plausible.

---

## 4.4 Hero detail

Important assets may receive substantially more geometric detail than background objects.

Hero assets include:

* major landmarks
* iconic horror objects
* creatures
* important story props
* close-up objects
* signature environmental structures

The extra detail must remain consistent with the game's overall style.

Do not create one hyper-detailed asset that makes every surrounding asset look low-quality.

---

# 5. DETAIL DISTRIBUTION

The project uses a **high-detail but intelligently allocated** philosophy.

## High detail

Prioritize detail for:

* landmarks
* structures frequently seen up close
* player-scale environments
* important props
* investigation objects
* creature models
* horror-signature objects
* visual story clues

## Moderate detail

Use moderate detail for:

* ordinary background structures
* distant props
* secondary environmental objects
* repeated modular pieces

## Reduced detail

Use reduced detail for:

* distant background scenery
* far-away vegetation
* objects rarely inspected
* scenery whose primary role is silhouette rather than inspection

The goal is not equal polygon counts.

The goal is:

> **consistent perceived quality at the player's actual viewing distance.**

---

# 6. MATERIAL LANGUAGE

All materials must belong to the same physical material system.

Important materials include:

* wood
* painted wood
* concrete
* asphalt
* dirt
* soil
* metal
* rusted metal
* glass
* plastic
* fabric
* vegetation
* stone
* roofing materials
* masonry

Each material should be immediately distinguishable through:

* roughness
* specular response
* surface detail
* color behavior
* imperfections
* wear

Do not rely entirely on color to differentiate materials.

---

# 7. SURFACE DETAIL

Surface detail must be:

* physically grounded
* restrained
* consistent
* story-driven

Avoid artificial “horror grime.”

Not every abandoned object needs:

* extreme dirt
* exaggerated blood
* random scratches
* enormous rust patches
* black stains
* dramatic damage

Weathering must reflect the object's actual history.

---

# 8. WEATHERING

Weathering follows a believable progression:

**new → used → weathered → neglected → damaged → severely deteriorated**

Each asset should occupy an intentional point on that spectrum.

Weathering should reflect:

* exposure to weather
* age
* maintenance history
* human use
* abandonment
* environmental conditions
* story events

Do not apply identical dirt/noise overlays to every asset.

---

# 9. TEXTURE AND DETAIL DENSITY

Texture detail should remain visually coherent across the project.

No individual asset should suddenly have:

* drastically higher texture sharpness
* drastically lower texture quality
* completely different texture treatment
* unrelated surface noise
* incompatible material scale

Texture density should feel consistent when assets are placed next to each other.

---

# 10. COLOR LANGUAGE

The overall game uses **cinematic color grading with controlled saturation**.

The game should not default to:

> “Everything is gray and brown because horror.”

Natural color is important.

Beautiful environments are allowed.

Color should help tell the progression of the game.

---

# 11. DIMENSION COLOR IDENTITIES

## D1 — SHATTERED FARMLANDS

Primary visual qualities:

* earthy
* rural
* natural
* weathered
* isolated
* exposed
* believable

Colors should generally draw from:

* grasses
* soil
* wood
* agricultural structures
* overcast/weathered materials
* natural sky and vegetation

The environment should feel like a real rural place before horror elements make it disturbing.

---

## D2 — STATIC SUBURBIA

Primary visual qualities:

* warm
* beautiful
* pastel
* nostalgic
* clean at first
* preserved
* liminal

D2 should initially contrast strongly with D1.

The suburb should be visually attractive.

Then the color language deteriorates:

**beautiful → aged → dirty → damaged → cracked → collapsing**

The loss of color and visual cleanliness should communicate progression.

D2 must not begin as a generic dark horror environment.

Its beauty is part of the horror.

---

## D3 — THE BELOW

Primary visual qualities:

* dark
* oppressive
* physically overwhelming
* enormous
* enclosed where appropriate
* hostile
* difficult to visually comprehend

D3 may use:

* deeper shadows
* darker materials
* restricted light
* larger contrast
* more aggressive atmospheric depth
* visual scale extremes

D3 can become visually more extreme than D1/D2.

However, it must still belong to the same game.

---

# 12. ARCHITECTURAL LANGUAGE

Buildings must look like they belong to the same geographic/world context.

Architecture should share recognizable vocabulary through:

* windows
* doors
* trim
* materials
* roof construction
* hardware
* signage
* structural logic
* proportions
* construction methods

Use **asset families**, not isolated one-off models.

Example:

A fence system should contain:

* straight sections
* corners
* gates
* damaged sections
* end posts
* alternate lengths
* weathering variants

rather than many unrelated fence models.

The same principle applies to:

* windows
* doors
* utility poles
* street signs
* furniture
* vehicles
* roofing
* building components
* vegetation

---

# 13. CONTROLLED REPETITION

Repetition is not inherently bad.

Real environments repeat manufactured systems.

The goal is:

> **recognizable family + controlled variation**

rather than:

> **completely unique object every time**

Variation can come from:

* rotation
* scale within believable limits
* color variation
* weathering
* damage
* configuration
* accessory differences
* placement
* environmental context

Do not randomly mutate assets into implausible forms.

---

# 14. VEGETATION

Vegetation has multiple intentional roles.

Depending on the location, vegetation can communicate:

* realism
* vulnerability
* beauty
* navigation
* environmental history
* concealment
* absence
* predator advantage
* deterioration

Vegetation must share the same:

* material language
* realism level
* scale standards
* detail density

Avoid identical copies of the same tree/plant repeatedly appearing.

Use controlled species variation.

Distant vegetation can be simplified.

Close vegetation should support the high-detail target.

---

# 15. SCALE

The project must maintain a coherent real-world scale.

Important relative measurements include:

* player
* doors
* stairs
* desks
* vehicles
* fences
* houses
* trees
* utility poles
* road widths
* windows
* furniture
* creatures

An asset is rejected if its scale is visibly inconsistent with its surroundings.

Do not “eyeball” important scale relationships when a real-world measurement is available.

---

# 16. LIGHTING

The lighting system has a naturalistic foundation with cinematic control.

Lighting must serve:

* realism
* composition
* atmosphere
* visibility
* horror
* progression

Lighting is not merely decoration.

Visibility is part of gameplay.

---

# 17. D1 LIGHTING

D1 emphasizes:

* natural daylight
* isolated artificial lights
* nighttime darkness
* flashlight dependence
* large exposed spaces
* strong contrast between illuminated and unilluminated areas

Open rural spaces should sometimes make the player feel exposed.

---

# 18. D2 LIGHTING

D2 begins with:

* warm evening illumination
* inviting interiors
* soft suburban light
* attractive neighborhood presentation

As D2 deteriorates:

* shadows deepen
* lighting becomes fragmented
* practical lights fail
* areas fall into darkness
* the environment becomes less inviting

---

# 19. D3 LIGHTING

D3 uses:

* limited visibility
* large dark spaces
* isolated practical lights
* oppressive shadows
* strong scale concealment
* environmental silhouettes
* darkness that prevents the player from confidently reading the environment

Darkness must remain readable enough for gameplay.

---

# 20. PRACTICAL LIGHT SOURCES

Whenever possible, visible light should have a physical reason.

Examples:

* streetlights
* windows
* warning lights
* generators
* emergency lights
* machinery
* flashlights
* electrical equipment

Practical lights may be used artistically, but they should not feel arbitrarily placed.

---

# 21. CINEMATIC PRESENTATION

The game uses cinematic presentation without abandoning physical believability.

Important tools include:

* framing
* depth
* silhouettes
* contrast
* atmosphere
* fog
* exposure
* practical lighting
* environmental composition

Do not use visual effects merely because they are technically impressive.

---

# 22. ENVIRONMENTAL AUTHORSHIP

The final world is a **finite, intentionally designed environment**.

It is NOT an infinite procedural world.

The game should feel like:

> **a specific place designed for a specific journey.**

Important locations must be deliberately positioned.

Important roads, landmarks, sightlines, environmental clues, transitions, and horror beats must be authored.

Procedural systems may be used for:

* vegetation distribution
* minor environmental dressing
* debris
* background variation
* terrain variation
* repeated modular placement
* non-critical environmental detail

Procedural generation must not decide the important story locations randomly.

---

# 23. ASSET FAMILY RULE

Whenever possible, create assets as families.

Examples:

### Fence family

* straight
* corner
* gate
* broken
* damaged
* weathered

### Window family

* square
* wide
* narrow
* broken
* boarded
* dirty

### Door family

* exterior
* interior
* service
* damaged
* boarded
* reinforced

### Utility family

* poles
* transformers
* boxes
* cable components
* warning signs
* utility hardware

This creates coherence while preventing copy/paste monotony.

---

# 24. ASTRA PRODUCTION RULES

Astra is an **asset-production assistant**, not the creative authority.

Astra must never independently determine:

* what a landmark should be
* what a creature should look like
* what the game's art style should be
* what materials the project uses
* what colors define a dimension
* what architecture belongs in the world

Those decisions come from the project art bible and approved creative direction.

Astra should receive:

1. asset specification
2. environment context
3. style requirements
4. material requirements
5. scale requirements
6. quality requirements
7. optimization requirements
8. integration requirements

---

# 25. ASTRA ASSET PIPELINE

The desired workflow is:

**Creative Specification**
↓
**Astra generation/assistance**
↓
**Blender / automated processing**
↓
**Engine-ready GLB**
↓
**Era 2 Asset Pipeline**
↓
**Claude integration**
↓
**Browser validation**
↓
**Human visual approval**

Do not treat raw AI output as automatically production-ready.

---

# 26. ASSET PROCESSING

Generated or sourced assets may require:

* origin normalization
* scale correction
* rotation correction
* mesh cleanup
* topology optimization
* UV validation
* material consolidation
* texture optimization
* collision proxy creation
* LOD creation where justified
* GLB compression
* naming normalization
* metadata validation

The amount of processing should depend on the asset.

Do not over-process assets unnecessarily.

---

# 27. AI ASSET ACCEPTANCE TEST

Before an AI-generated asset becomes production content, evaluate:

### Style

Does it match the visual language?

### Scale

Does it match the world?

### Materials

Do its materials behave like the rest of the game?

### Geometry

Is its detail level appropriate?

### Construction

Does it make physical sense?

### Regional fit

Does it belong to the same geographic/world context?

### Variation

Does it belong to an existing asset family?

### Camera read

Does it look correct from the actual gameplay camera?

### Horror fit

Does it support the intended emotional function?

### Performance

Is it efficient enough?

### Integration

Does it look correct beside existing assets?

If any of these fail significantly, the asset is not production-ready.

---

# 28. ANTI-PATTERNS

The following are prohibited unless a specific creative decision explicitly overrides the rule.

## 28.1 Asset zoo

Do not combine unrelated assets simply because each looks good individually.

## 28.2 Mixed realism

Do not place:

* photorealistic objects
* cartoon objects
* PS1-style objects
* aggressively low-poly objects

together without deliberate justification.

## 28.3 Random grime

Do not add generic dirt to every surface.

## 28.4 Random variation

Do not alter objects randomly simply to avoid repetition.

## 28.5 Scale drift

Do not allow doors, trees, vehicles, buildings, furniture, or creatures to drift into inconsistent scales.

## 28.6 Style drift

Do not introduce a new material or modeling style because an individual asset looks attractive.

## 28.7 Marketplace appearance

The game should never feel like:

> “This asset came from one store and that asset came from another store.”

The source of an asset should be visually invisible after integration.

---

# 29. SOURCE ASSETS / LICENSING

Every external asset must have its license and attribution tracked.

No asset should enter the final commercial production set if its license is incompatible with the game's intended distribution.

If an asset has a non-commercial restriction, it must be quarantined from commercial production.

The visual bible does not override licensing requirements.

---

# 30. MODULARITY

Use modular systems where they increase coherence and production efficiency.

Good candidates include:

* fences
* walls
* windows
* doors
* road pieces
* utility systems
* roof components
* interior furniture
* structural components

Modularity should support authored design.

It should not turn the world into visibly repetitive procedural construction.

---

# 31. D1 SPECIAL RULES

D1 should feel:

* open
* exposed
* rural
* believable
* isolated
* weathered
* grounded

Its horror should come largely from the contrast between:

**ordinary believable environment**

and

**things that absolutely do not belong there.**

The environment should not constantly announce that it is a horror level.

---

# 32. D2 SPECIAL RULES

D2 should initially feel:

* beautiful
* preserved
* nostalgic
* inviting
* empty

The environment's deterioration should be visually legible over time.

The visual progression is:

**perfect**
→ **worn**
→ **aged**
→ **dirty**
→ **damaged**
→ **cracked**
→ **collapsing**
→ **gone**

This progression is authored and deliberate.

---

# 33. D3 SPECIAL RULES

D3 may push the visual language harder.

It should emphasize:

* extreme scale contrast
* oppressive spaces
* enormous structures
* claustrophobic spaces
* darkness
* physical danger
* environmental evidence of things far larger than the player
* architecture that implies a purpose beyond ordinary human needs

However:

D3 must still feel like it belongs to the same overall game.

It must not become a completely unrelated visual style.

---

# 34. HORROR-FIRST VISUAL PRINCIPLE

The purpose of visual fidelity is not spectacle.

The purpose is to make the horror believable.

A technically impressive visual is inferior to a simpler visual if the simpler visual creates more fear.

Every visual decision should support one or more of:

* tension
* uncertainty
* recognition
* vulnerability
* isolation
* scale
* anticipation
* dread
* discovery
* environmental storytelling

---

# 35. SIGNATURE MOMENTS

The game is allowed—and encouraged—to contain highly distinctive visual moments.

Examples may include:

* the Water Tower
* enormous underground structures
* major landmarks
* creature reveals
* dramatic environmental changes
* signature horror imagery
* key transitions

These can have stronger visual identity than ordinary background objects.

However, they must still obey the master visual language.

---

# 36. CAMERA-FIRST VALIDATION

Assets should be evaluated through the actual gameplay camera.

A model that looks perfect in Blender may fail in-game because:

* its silhouette is weak
* detail disappears at gameplay distance
* proportions look wrong
* textures become noisy
* materials become flat
* scale is inconsistent

Final approval must happen in the actual game environment whenever practical.

---

# 37. WORLD-FIRST ASSET DESIGN

Major assets should be designed as part of a location.

Do not design:

> “a cool creepy school.”

Design:

> **the Schoolhouse belonging to Shattered Farmlands.**

It must fit:

* terrain
* roads
* surrounding vegetation
* nearby buildings
* regional architecture
* weathering
* lighting
* horror sequence
* story function
* player path

The environment owns the asset—not the other way around.

---

# 38. REUSE WITHOUT MONOTONY

Reusing assets is encouraged.

The solution to repetition is:

**variation inside a family**

not:

**replace everything with unrelated models.**

Variation can come from:

* orientation
* configuration
* wear
* damage
* accessories
* placement
* scale within believable limits
* surrounding context

---

# 39. ENVIRONMENTAL CONSISTENCY CHECK

Before a major environment is approved, inspect:

### Ground

Does terrain match the world?

### Architecture

Do structures share a construction vocabulary?

### Vegetation

Does nature belong to the region?

### Props

Do objects belong to the same visual ecosystem?

### Materials

Do surfaces share the same physical language?

### Lighting

Does the lighting match the dimension's identity?

### Scale

Are proportions consistent?

### Weathering

Does aging make sense?

### Color

Does the palette fit the dimension?

### Horror

Does the environment help create the intended emotion?

---

# 40. FINAL ASSET APPROVAL RULE

The final question for every asset is:

> **“Would a player who never saw the source asset believe that this object was specifically created for WHERE IT ISN'T?”**

If the answer is no:

**Reject, modify, or integrate differently.**

---

# 41. FINAL WORLD APPROVAL RULE

The final question for every environment is:

> **“Does this feel like one intentionally authored place rather than a collection of assets assembled together?”**

If the answer is no:

Do not add more random detail.

Fix the underlying visual relationships.

---

# 42. FINAL AUTHORITY

Creative decisions are governed in this order:

1. Current explicit Game Director decision
2. Current approved creative design documents
3. This Visual Rule Bible
4. Current technical implementation constraints
5. Individual asset convenience

An individual AI output never overrides the project's creative direction.

A technically convenient solution never overrides a locked creative rule without explicit approval.

---

# 43. MASTER PHRASE

When in doubt, use this principle:

> **BELIEVABLE WORLD. CONSISTENT LANGUAGE. DELIBERATE AUTHORSHIP. CONTROLLED STYLIZATION. CINEMATIC HORROR.**

The final game should not feel like:

* an asset pack
* an AI demo
* a procedural world
* a Minecraft derivative
* three unrelated dimensions

It should feel like:

> **one believable world whose deeper layers become progressively more impossible, oppressive, and horrifying while remaining visually connected to everything that came before.**
