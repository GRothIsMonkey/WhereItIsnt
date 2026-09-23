# rural_fence_post_01 — Revision 02

## Result

**NOT READY — visual-direction gate remains open.**

Revision 02 exists as a separate editable, exported and technically verified candidate. It improves the joint, physical timber shape and repair narrative. After comparing the renders, I do not consider it a sufficient demonstration of the requested grounded cinematic realism. At medium distance the main read remains a post and beam with a strap, and enlarged wood remains too soft and procedural-looking. Passing technical checks does not resolve that failure. This candidate must not be integrated or treated as approved.

## Visual-bible interpretation

The current VISUAL_RULE_BIBLE.md, D1_DESIGN.md, CLAUDE.md, asset-budgets.js and asset-registry.js were reread before modelling. The 12-rule pre-modelling summary is in working_summary.md. The rules applied were: believable rural construction; subtle stylization; ordinary objects without horror decoration; physical causes for imperfections; exposure-driven wear; material separation by reflectance and roughness; detail allocated first to silhouette and joint; coherent world-specific art direction; real metric scale; and a repeatable fence-family construction vocabulary.

D1's Farm Compound is a formerly working farm with livestock structures, muddy areas, fences and dirt paths. That supports an old housed timber joint reinforced later with practical metal. No symbols, gore, vegetation, supernatural damage, new landmark or second asset were authored. The canonical visual bible governs over the older voxel-oriented passages in CLAUDE.md. No current budget or registry rule was changed.

## Output location

All newly created files are inside:

`C:\Users\rothc\OneDrive\Documents\grayson_github\WhereItIsnt\assets\_raw_review\rural_fence_post_01\revision_02\`

- Source: `source/rural_fence_post_01_r02.blend`
- Export: `export/rural_fence_post_01_r02.glb`
- Textures: `textures/`
- Review renders: `review/`
- This report: `report/asset_report.md`
- Exact full-path inventory of every new file: `report/files_created.txt`
- Original-file hash preservation and final safety evidence: `report/revision_01_preservation.json` and `report/repository_safety.json`

The production identity remains rural_fence_post_01. The r02 suffix only distinguishes delivered revision files. No Revision 01 file was moved, replaced or deleted, including the pre-existing .blend1 backup found at the start of this revision task.

## What changed and self-critique against Revision 01

| Question | Concrete Revision 02 change | Remaining concern |
| --- | --- | --- |
| 1. Silhouette | Thicker tapered post, 16 mm authored long-axis bow, sloped crown, rail sag and dropped repair-strap end | Still predominantly two squared timbers at gameplay distance; insufficiently distinctive under the user's explicit gate |
| 2. Post geometry | Ten longitudinal rings; varying chamfers; one principal drying check with a smaller opposite check; uneven upper cut; actual blind rail socket; two shallow staple holes | Crown and face character are still restrained enough to read too clean |
| 3. Rail geometry | Reduced tongue and visible shoulder; 22 mm mid-span sag; modest taper/twist; softened end; shallow modeled longitudinal checking | Long front surface remains visually broad and simple |
| 4. Connection | Rail enters a blind housed joint rather than resting in a generic box hanger. A formed 3 mm strap bends from the post face onto the inset rail face. Three domed heads with washers replace six hex fasteners | The repair is clearer, but not yet convincing enough to carry the entire art-direction goal |
| 5. Wood material | Warm underlying colour, cooler faded regions, lower-post darkening, irregular fibre ribbons instead of periodic R01 sine bands, separate end-grain region and roughness/normal maps | At 64 px/m, enlarged fibres and growth rings are soft; end grain becomes an overly simple ring pattern |
| 6. Metal material | Cool galvanized colour, cell-like zinc variation and roughness breakup; smoothed sheet bends and domed fasteners | Zinc pattern is weak at distance, while a grazing highlight can still appear too clean |
| 7. History/use | Timber housing predates reinforcement; drying checks, staple holes, sag, faded crown and dark lower wood give physical causes for age | The used/neglected state needs a stronger material treatment without arbitrary grime |
| 8. Less generic | The asymmetrical formed repair and housed shoulder are specific to the supplied repair concept | Specific construction alone has not made this a distinctive high-quality environmental prop |
| 9. Bible consistency | More geometry spent on timber and joinery; ordinary rural history; plausible scale; two physically distinct material families; no horror motifs | Cinematic realism and tactile close-up quality remain below the stated target |
| 10. Intentionally simple | One rail, one post, three fasteners, two materials; no hidden shafts, rated engineering detail, tiny rust geometry, foliage, LOD or new variants | This is appropriate scope, but does not excuse the visual weaknesses above |

Several iterations were made before this verdict. The first R02 render showed excess faceting, weak material variation, a pinched strap bend and a socket UV error. Subsequent passes corrected UV density, moved the strap bend clear of the post, smoothed shallow angular transitions, added shallow staple holes and removed their accidental UV patch, strengthened exposure variation, and corrected the context scene's distant illumination. The final candidate is the result of those iterations, not the first successful export.

## Measured technical summary

Authoring executable: `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` — **Blender 5.2.2 LTS**. No Microsoft Store executable used.

| Measurement | Result |
| --- | --- |
| Dimensions, Blender X / Y / Z | **1.962397426 / 0.166591883 / 1.199825048 m** |
| Visible post height | **1.199825048 m**, measured from post vertices |
| Post nominal section | Approximately 0.166 × 0.154 m at lower rings, tapering upward |
| Rail length including tongue | 1.858 m, x=0.022 to 1.880 |
| Rail nominal full section | Approximately 0.122 × 0.068 m, tapering and sagging along length |
| Post base / origin | (0,0,0), nominal post base centre |
| Final triangles after triangulation | **1,224**: wood **780**, metal **444** |
| Source geometric vertices | **630**: wood **394**, metal **236** |
| GLB POSITION vertices | **1,812**; attribute seams require more vertices than source geometry |
| Export mesh objects / nodes / primitives | **2 / 2 / 2** |
| Visible asset materials | **2**: MAT_weathered_timber, MAT_galvanized_steel |
| Embedded images / textures | **5 / 5** |
| Texel density, unchanged repository measurement | **64.120197562 px/m** |
| Density samples | All **1,224** triangles; **1.514127043 m²** surface area |
| Source blend size | **278,074 bytes** |
| GLB size | **214,660 bytes** |
| External GLB resource URIs | **0** |
| Required/used GLB extensions | **None** |
| GLB review lights, cameras, ground, repeated copies and fog | **Excluded** |

Blender uses Z up. Standard glTF export uses Y up, so GLB dimensions are X 1.962397426, Y 1.199825048, Z 0.166591883 m. Re-imported dimensions match the source at stored precision. Both asset objects have zero location/rotation and unit scale. No scaling normalization is needed.

## Materials and UVs

| Texture filename | Size | Interpretation / role |
| --- | --- | --- |
| r02_weathered_timber_basecolor.png | 256 × 256 | sRGB, warm/faded timber and reserved end grain |
| r02_weathered_timber_metallicroughness.png | 256 × 256 | Non-Color; G roughness, B metallic=0, R unused=1 |
| r02_weathered_timber_normal.png | 256 × 256 | Non-Color; tangent-space +Y normal, strength 0.7 |
| r02_galvanized_steel_basecolor.png | 128 × 128 | sRGB, cool gray zinc-like variation |
| r02_galvanized_steel_metallicroughness.png | 128 × 128 | Non-Color; G roughness, B metallic=1, R unused=1 |

These remain below the 512² small-prop target. The larger sheets relative to R01 provide more source variation and separate wood/end-grain regions while UV scale holds approximately 64 px/m. I did not use a 512 map simply to fill the allocation or increase close-up density. This is an intentional lower-size choice, not a claim that the full material quality request has been met. Increasing map dimensions without changing physical density would not by itself resolve the current softness.

All five maps are packed in the blend and embedded in the GLB. Direct deterministic pixel authoring rasterizes the procedural signals into portable PNGs; there is no Blender-only runtime material dependency. Both visible materials use standard Principled PBR. No AO, displacement, baked lighting, external image or hidden higher-density detail layer.

One intentional UVMap exists on each mesh. Grain follows post height and rail length. Post and rail sample different regions. Caps deliberately reuse an end-grain region. Small metal parts reuse a physical-scale sheet. Socket and bore interior UVs are explicitly projected at the same physical scale. UV overlap is intentional material reuse, not a unique lightmap atlas. Narrow chamfers and planar projections account for the small deviation from exactly 64 px/m. No visible wrong-way grain was found; micro-detail remains unresolved.

## Topology, normals and round-trip verification

Final triangulation is applied. Source meshes have zero degenerate faces, and a diagnostic seam weld yields zero nonmanifold edges in source and re-import. All nine connected solids have positive signed volume: two timbers, one strap, three heads and three washers. Shallow face transitions are smooth; joinery and steep checks remain sharp. No weighted-normal modifier is used to conceal faulty topology.

Fresh GLB import preserves dimensions, geometry, UVs, material names, image counts and image dimensions. The source blend was reopened successfully with all five packed images. The re-imported GLB was rendered under the identical neutral camera and lighting.

Round-trip image comparison:

- Mean absolute RGB difference: **0.000000838558**.
- Maximum difference: **2/255** in an RGB channel.
- Pixels with a channel difference greater than 1/255: **0.00115646%**.

This is a close Blender round-trip match, not browser validation. **BROWSER STATUS: UNVERIFIED**, as authorized for this pre-integration task.

Blender emitted non-blocking user-cache/thumbnail permission messages and use_nodes deprecation messages. The glTF exporter emitted its packed metallic/roughness sampler warning; channels use the same image and sampler settings, and the round-trip check shows no material loss. The requested files saved successfully.

## Actual project budget result

The delivered check_project_budget.cjs reads the revised GLB accessor buffers and embedded PNG headers, then executes the CURRENT, UNMODIFIED `src/assets/asset-measure.js` and `src/assets/asset-budgets.js` offline.

| Metric | Value | Actual validator band / status |
| --- | ---: | --- |
| Triangles | 1,224 | within / pass |
| Maximum texture dimension | 256 | within / pass |
| Texel density | 64.120197562 | within / pass |

**Overall: pass. No warnings or exceptions.** This does not pass the separate visual-direction gate. No registry row, loader, test, runtime scene or budget rule was modified.

## Review renders and distance findings

All PNGs are **1400 × 1050**, EEVEE, AgX. The neutral views show the object without obscuring environmental effects. The context setup uses the same asset as linked repeats, a simple earth/grass-coloured ground, broad sky-coloured sun/fill and modest finite air haze. It is a material-and-scale review backdrop, not a recreation of the Farm Compound and not a new production scene.

| File in review/ | Purpose |
| --- | --- |
| 01_neutral_three_quarter.png | Entire revised asset, clear neutral light |
| 02_neutral_side.png | Bow, sag and profile assessment |
| 03_joint_closeup.png | Housed shoulder, strap, fasteners and old holes |
| 04_post_top_closeup.png | Uneven crown, modeled check and end grain |
| 05_d1_context_overcast.png | Linked repeats in muted rural review colours |
| 06_d1_context_distance.png | Medium/distant context |
| 07_d1_context_evening.png | Reduced illumination and material separation |
| 08_flashlight_grazing.png | Local grazing highlight response |
| 09_distance_01m.png | 1 m camera-to-joint target, perspective |
| 09_distance_05m.png | 5 m camera-to-asset-centre target |
| 09_distance_15m.png | 15 m camera-to-asset-centre target |
| 09_distance_30m.png | 30 m camera-to-asset-centre target |
| 10_glb_reimport_neutral.png | GLB under matching neutral setup |
| 11_revision_01_matched_comparison.png | Untouched R01 GLB rendered with R02 neutral camera/light |

Distance views use a fixed **50 mm lens / 36 mm sensor**, with camera-to-target distances measured to floating-point precision. This is a reproducible review lens, not a claim to match the game's current FOV.

- **1 m:** Actual joint and two old holes are legible. Materials distinguish wood from metal, but the timber grain and end-grain response still fail the requested tactile close-up bar. This is where further triangles alone would buy little improvement.
- **5 m:** Rail sag, post taper and repair-strap silhouette are readable. It remains a simple repeated fence form; the material still lacks richness.
- **15 m:** Fence rhythm and cool repair patches survive. Individual bolts, holes and checks mostly disappear. The broad rectangular read still dominates; the improvement is not strong enough to claim the requested distance-quality gate.
- **30 m:** Post/rail rhythm remains legible and plausible. Small detail cannot be evaluated at this scale. Exact linked repeats reveal repetition; this is a family-vocabulary test, not authored variations.

Under overcast light the steel separates by value/temperature and reflectance. Evening keeps silhouette and a small amount of metal contrast but hides most timber information. The flashlight render confirms tighter metal highlights, while also exposing their still-clean appearance. Neutral and daylight images govern the rejection; darkness is not used as evidence of success.

## Collision recommendation

Keep collision independent of the render meshes. Two future semantic box proxies remain appropriate. No collision objects were registered or exported.

Suggested conservative bounds in Blender Z-up metres:

- Post: min (-0.084,-0.081,0), max (0.093,0.081,1.200).
- Rail: min (0.022,-0.037,0.789), max (1.880,0.037,0.938).

Converted to Three.js/glTF Y-up `[minX,minY,minZ,maxX,maxY,maxZ]`:

- Post: `[-0.084,0,-0.081,0.093,1.200,0.081]`.
- Rail: `[0.022,0.789,-0.037,1.880,0.938,0.037]`.

These deliberately ignore tiny hardware protrusions. The free rail end needs another future support; repeating the same component in the review scene only illustrates spacing and is not a complete engineered fence kit.

## Provenance and repository safety

All geometry, material pixels and review apparatus were authored specifically for this task using Blender Python and its bundled NumPy. No downloaded mesh, external texture, paid content or third-party visual resource was used. The R01 GLB was read only for the matched comparison. Its comparison render is new and resides under revision_02.

Only new Revision 02 files were created or revised. All pre-existing R01 files were hashed before modelling and checked after delivery; see repository_safety.json. Read-only Git status/diff inspection confirms no tracked or staged project changes. No game code, documentation authority, tests, asset registry, renderer or budget definitions were edited. No commit, push, stage, branch switch or integration was performed.

## Human inspection

Inspect **01_neutral_three_quarter.png**, **03_joint_closeup.png**, and **05_d1_context_overcast.png** first. Compare 01 with 11_revision_01_matched_comparison.png for a fair camera/light comparison. These are diagnostic review files for a candidate marked NOT READY, not a request to approve an asset I consider visually complete.
