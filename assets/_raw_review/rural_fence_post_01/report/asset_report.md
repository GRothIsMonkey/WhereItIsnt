# rural_fence_post_01 — raw / review asset report

**READY FOR HUMAN REVIEW: YES.** This is a review candidate, not an approved production asset. No runtime integration has been performed.

**ASSET ID:** rural_fence_post_01  
**PURPOSE:** Phase 4 first controlled production-asset / pipeline validation asset  
**BLENDER VERSION:** 5.2.2 LTS, build d13f752e3b9c  
**EXECUTABLE:** `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`  
**SOURCE FILE:** `C:\Users\rothc\OneDrive\Documents\grayson_github\WhereItIsnt\assets\_raw_review\rural_fence_post_01\source\rural_fence_post_01.blend`  
**GLB FILE:** `C:\Users\rothc\OneDrive\Documents\grayson_github\WhereItIsnt\assets\_raw_review\rural_fence_post_01\export\rural_fence_post_01.glb`

## Repository context and decisions

Read the relevant sections of VISUAL_RULE_BIBLE.md, CLAUDE.md, ARCHITECTURE.md, ROADMAP.md, PROGRESS.md, src/assets/LAYER.md, asset-registry.js, asset-materials.js, asset-measure.js, and asset-budgets.js. Inspected assets/models and the existing GLB naming and credit convention. No documented raw/review directory convention was found; this delivery uses the requested fallback.

The canonical Era 2 visual bible supersedes the older voxel-compatible direction near the start of CLAUDE.md. Phase 3's “no production asset, no Blender” text records the scope of that completed engineering phase; this explicit request authorizes only the present raw-review asset. There is no consequential conflict in scale, material count, or compatibility. The bible's general pipeline diagram places browser validation before approval; this task explicitly stops for human review before integration, and that narrower scope is preserved.

Small-prop guidance is 200–1,500 triangles, a 512² texture target, and approximately 64 px/m. The unchanged repository measurement and budget functions were executed against an adapter reading the actual GLB accessor buffers and embedded PNG headers. All three metrics return **within / pass**, with no exceptions and no warnings. This is an offline asset check, not browser/runtime validation.

## Measured technical summary

| Property | Result |
| --- | --- |
| Final dimensions, Blender metres X / Y / Z | 1.943795666 / 0.141224265 / 1.200000048 |
| Post height, measured from post vertices before joining | 1.200000048 m |
| Post nominal section | 0.140 × 0.140 m; small local edge irregularities |
| Rail nominal dimensions | 1.800 × 0.050 × 0.100 m |
| Rail centre height | 0.880 m |
| Final rendered triangles | **712**: wood 184; hanger and fasteners 528 |
| Source geometric vertices | **388**: wood 96; metal 292 |
| Exported render vertices | **1,520**: wood 512; metal 1,008 |
| Export mesh / node / primitive count | **2 / 2 / 2** |
| Visible asset material count | **2** |
| Materials | MAT_weathered_timber; MAT_galvanized_steel |
| Embedded images / texture objects | **5 / 5** |
| Approximate texel density | **64.018564 px/m**, repository area-weighted measurement |
| Density evidence | All 712 triangles sampled; 1.361754043 m²; 5,580.980825 texel-area units |
| Source file size | 169,843 bytes |
| GLB file size | 113,376 bytes |
| External GLB resource URIs | **0** |
| GLB extensions required / used | **None** |
| Cameras / lights / collision helpers in GLB | **0 / 0 / 0** |

Blender uses Z up. Standard glTF export converts to Y up: the GLB dimensions are X 1.943796, Y 1.200000, Z 0.141224 m. There is no scaling conversion hack. The source/re-import dimensions agree exactly at stored float precision.

Exported vertices are higher than source vertices because hard normals and UV discontinuities require separate attribute vertices. They do not indicate additional triangles. The project counts POSITION accessor entries, so **1,520 is the runtime-facing vertex count**.

## Texture files and PBR interpretation

All texture paths below are relative to this asset root. Each is embedded in the GLB and packed in the source blend; the editable standalone PNGs are also delivered.

| File | Purpose | Resolution | Interpretation | Bytes |
| --- | --- | --- | --- | ---: |
| textures/weathered_timber_basecolor.png | Dry gray-brown longitudinal grain, soft checks, end-grain region | 128² | sRGB base color | 21,193 |
| textures/weathered_timber_metallicroughness.png | G roughness, B metallic=0; R unused=1 | 128² | Non-Color linear data | 9,954 |
| textures/weathered_timber_normal.png | Restrained tangent-space grain relief | 128² | Non-Color, +Y normal convention, strength 0.55 | 23,921 |
| textures/galvanized_steel_basecolor.png | Subtle gray zinc-like mottle | 32² | sRGB base color | 1,495 |
| textures/galvanized_steel_metallicroughness.png | G roughness approximately 0.58–0.65, B metallic=1; R unused=1 | 32² | Non-Color linear data | 781 |

The texture target is a guideline, not a required minimum. Smaller reusable sheets retain the actual 64 px/m standard without padding a 512² map around a tiny occupied region. The wood sheet represents 2 m per UV unit; the steel sheet represents 0.5 m. There are no Blender-only procedural shading dependencies, displacement, AO tricks, or baked lighting. The deterministic authoring script directly rasterizes the procedural source signals into portable PNG maps. Both visible families use Principled PBR and standard glTF texture slots.

## UV, topology, transforms, and origin

**UV STATUS:** One UVMap per mesh. Timber side faces form continuous perimeter strips with grain aligned along the physical timber length. Post and rail occupy separate grain strips. End caps intentionally reuse the small end-grain patch, and the metal sheet is intentionally reused across parts. These are reusable material UVs, not unique lightmap UVs. Longitudinal shells start with approximately three pixels of end padding and lie clear of the end-grain region. The map is fully authored; remaining sheet regions provide reusable variation. No obvious rotated grain or severe stretching was observed. Narrow bevels have small expected deviations from 64 px/m. Metal planar UVs can exceed 0–1 and deliberately repeat.

**NORMAL STATUS:** Source components are closed, outward-facing, and have no nonmanifold edges or degenerate triangles. Flat shading is intentional, with geometric chamfers on the timber and efficient formed metal edges. No weighted-normal modifier hides topology faults. Export re-import initially reports seam boundaries because the GLB splits vertices for normals/UVs. A temporary diagnostic weld at 0.000001 m restores 388 geometric vertices and zero nonmanifold edges; all 16 connected solids have positive signed volumes. The diagnostic never changes the delivered GLB or blend. No black/inverted faces were observed.

**TRANSFORM STATUS:** Both export objects have location (0,0,0), rotation (0,0,0), and scale (1,1,1). Geometry is authored in metric coordinates and final triangulation is applied. No abandoned modifiers.

**ORIGIN LOCATION:** Both mesh origins are (0,0,0), the nominal base centre of the post. No parent empty is required. The tiny timber irregularities do not change the logical placement origin.

**SCENE CLEANLINESS:** Two production objects in rural_fence_post_01. The separate REVIEW_ONLY_camera_lights_ground collection contains one neutral ground, one camera, and two area lights. Its one ground material is a review-only third material, excluded from the asset's visible-material count and GLB. Five source images are packed. Temporary meshes and orphan data were purged.

## Export and verification

**GLB EXPORT STATUS:** Successful. Selection-only export; standard PBR; embedded PNGs; no external dependencies, animation, helper empties, cameras, lights, or collision meshes.

**GLB VERIFICATION STATUS:** Successful fresh-scene import. Measured geometry counts, dimensions, transforms, UVs, material names, and five image dimensions survive. The source blend was separately reopened successfully. An additional render replaces the source meshes with the re-imported GLB under identical overcast review lighting.

Source versus round-trip render: mean absolute RGB difference **0.0000000498653**, maximum **1/255**, and **0%** of pixels exceeding 1/255 in any channel. This verifies the Blender export/import appearance, not future Three.js lighting or tone mapping.

Non-blocking Blender messages: its sandboxed user extension-cache and OS thumbnail writes were denied; requested artifact writes and source reopening succeeded. The glTF exporter warned about shared sampler selection for packed metallic/roughness channels; both channels use the same image node and sampler settings, and the round-trip appearance comparison passes. Blender also emitted forward-looking use_nodes deprecation warnings. No external installation or cache permission was needed for delivery.

## Review renders and visual self-review

All six PNGs are 1024 × 1024, rendered with **EEVEE**, AgX, and a neutral ground. No Cycles reference substitutes for real-time-oriented review.

| Path relative to asset root | Condition | Bytes |
| --- | --- | ---: |
| review/01_three_quarter_day.png | Entire asset, brighter directional daylight | 887,979 |
| review/02_side_day.png | Entire asset, near-side elevation | 851,645 |
| review/03_bracket_closeup.png | Hanger seat, attachment and material transition | 908,862 |
| review/04_overcast.png | Broad neutral overcast light | 874,299 |
| review/05_evening.png | Low illumination with subdued warm/cool separation | 872,626 |
| review/06_glb_reimport_overcast.png | Exported GLB replacing source under matching overcast light | 874,429 |

- **Silhouette:** Ordinary square rural post with a slim rail and restrained millimetre-scale edge variation. Small chamfers catch light without large rounded cartoon edges.
- **Construction:** A 2 mm folded galvanized seat supports the rail underside; a 3 mm rear mounting plate transfers the connection to the post. Four post fasteners and two visible rail fasteners explain attachment. This is a simplified fabricated hanger, not a rated hardware specification. The delivered single rail is a modular span: its far end would need another support when placed as a fence. No additional support or fence system is authored here.
- **Wood treatment:** Dry desaturated gray-brown, longitudinal variation, subtle end grain, and narrow age checks. The first render was too smooth/light; the final maps strengthen weathering. No rot holes, horror scratches, moss, or decorative grime.
- **Metal treatment:** Dull gray, fully metallic with moderate roughness and restrained cell-like variation. It catches smaller highlights than the wood without chrome or excessive rust.
- **Scale and realism:** Human-scale proportions and plausible rail section. The ordinary infrastructure intent is preserved. Human review should especially judge whether the deliberately simplified grain is sufficient for the intended camera distance.
- **Stylization / Minecraft resemblance:** Simplification is concentrated in surface detail and economical chamfers. No voxel construction, stylized color blocks, oversized hardware, or deliberately spooky motifs. The real timber's naturally rectangular section is retained.
- **Lighting:** Daylight shows the grain and thin bracket edges clearly; overcast reduces contrast while retaining material separation. Evening remains readable in silhouette, with surface detail receding naturally.
- **Repetition / noise concerns:** No whole-length longitudinal texture repeat occurs on either timber. End caps and small metal parts intentionally reuse regions. Grain is soft and visibly simplified when enlarged; no photographic grain or speckle overlay is used. The high-magnification bracket crop makes the low texel density obvious. This is the principal visual compromise, rather than a concealed claim of close-up photorealism.

## Collision recommendation

Use two future semantic box proxies owned by the project's PhysicalWorld/AssetCollisionSet architecture. Do not derive gameplay collision from render triangles. No proxies have been registered or exported.

Suggested conservative local bounds, **Blender Z-up**, in metres:

- Post: min (-0.072, -0.072, 0.000), max (0.072, 0.072, 1.200).
- Rail: min (0.073, -0.027, 0.828), max (1.873, 0.027, 0.932).

For the project's glTF/Three.js **Y-up** coordinates, using (x,y,z) → (x,z,-y):

- Post: `[-0.072, 0.000, -0.072, 0.072, 1.200, 0.072]`.
- Rail: `[0.073, 0.828, -0.027, 1.873, 0.932, 0.027]`.

These intentionally ignore tiny fastener and bracket protrusions. Integration may conservatively widen the connection region if gameplay requires it.

## Known limitations and approval boundary

- Close-up timber and zinc detail is soft at the required approximately 64 px/m; these maps prioritize coherent ordinary-prop density. A higher-resolution file alone would not solve this without increasing UV density. No hero-density exception was taken.
- No in-game/browser scene validation, collision integration, placement, LOD, or compression was performed. Those belong to a later approved integration step.
- No existing production asset set is available here for side-by-side art-direction comparison. Review readiness is not a claim of final world-wide visual consistency.
- No unresolved technical export defect was discovered. Final art acceptance belongs to the human reviewer.

## Provenance

All geometry and texture pixels were authored during this task specifically for WHERE IT ISN'T, using deterministic Blender Python and NumPy bundled with Blender. No third-party mesh, downloaded texture, scan, paid asset, external image reference, or generated-image service was used. No external source/license attribution is required for borrowed content because none was incorporated. The three scripts are delivered for reproducibility and independent inspection.

## Files created — complete inventory

Exactly **20 new files**, all under:

`C:\Users\rothc\OneDrive\Documents\grayson_github\WhereItIsnt\assets\_raw_review\rural_fence_post_01\`

1. source/build_asset.py
2. source/verify_asset.py
3. source/check_project_budget.cjs
4. source/rural_fence_post_01.blend
5. export/rural_fence_post_01.glb
6. textures/weathered_timber_basecolor.png
7. textures/weathered_timber_metallicroughness.png
8. textures/weathered_timber_normal.png
9. textures/galvanized_steel_basecolor.png
10. textures/galvanized_steel_metallicroughness.png
11. review/01_three_quarter_day.png
12. review/02_side_day.png
13. review/03_bracket_closeup.png
14. review/04_overcast.png
15. review/05_evening.png
16. review/06_glb_reimport_overcast.png
17. report/technical_validation.json
18. report/roundtrip_validation.json
19. report/project_budget_validation.json
20. report/asset_report.md

## Repository safety

**EXISTING FILES MODIFIED: NONE.** Existing tracked and staged diffs are empty; the initial worktree was clean and final changes are exclusively these new raw-review files. No game code, project documentation, registry, package, test, rendering, collision, or gameplay file was edited. No existing project file was deleted or overwritten. Iterations only replaced files newly created for this asset during this task.

**GIT ACTIONS: NONE that mutate repository state.** Only read-only status/diff inspection; no branch switch, configuration change, stage, commit, push, reset, merge, or rebase.

**READY FOR HUMAN REVIEW: YES.** Inspect 01_three_quarter_day.png and 03_bracket_closeup.png first, then compare 04_overcast.png and 05_evening.png. Keep the asset at RAW → REVIEW until explicit human approval. Do not integrate based solely on the passing technical budget result.
