# First-party props — provenance record

Models in this directory that were **authored for WHERE IT ISN'T** rather than sourced from a
third party. They carry no Creative Commons licence because none was ever granted or needed:
they are project-owned work, usable in any release of this project, commercial included, and
they require no external attribution.

That is a legal status, not the absence of one. Every row below names where the work came
from, what approved it, and the exact bytes that shipped — `ASSET_LICENCES['FIRST-PARTY']` in
`src/assets/asset-registry.js` is the code-side half of this record, and `tests/assets.js`
fails if either half drifts from the other.

---

## Rural Fence Post 01 — `prop.rural-fence-post-01`

| field | value |
| --- | --- |
| runtime file | `assets/models/props/rural_fence_post_01.glb` |
| author | WHERE IT ISN'T (first-party) |
| authored with | Astra + Blender 5.2.2 LTS, under the project owner's direction |
| provenance | `assets/_raw_review/rural_fence_post_01/revision_03/` |
| approved revision | Revision 03 — HUMAN VISUALLY APPROVED, APPROVED FOR CLAUDE INTEGRATION |
| status | first-party, project-owned, unrestricted for this project's commercial use, no external attribution required |
| SHA-256 | `8f1d6934ac8e29427243ca658bcddb2fb942ebe555ee95089f9e6ca043935f91` |
| size | 218,176 bytes |

The runtime file is a **byte-identical copy** of
`assets/_raw_review/rural_fence_post_01/revision_03/export/rural_fence_post_01_r03.glb`.
Nothing was re-exported, re-textured, simplified or renamed inside the file; only the
filename changed, to drop the revision suffix. The review directory keeps the source `.blend`,
the five texture PNGs, the review renders and the validation reports, and Revisions 01 and 02
beside it as development history.
