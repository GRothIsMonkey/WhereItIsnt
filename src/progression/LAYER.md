# `src/progression/` — WHAT THE PLAYER MAY NOW DO

Objectives, the three endurance milestones, Core Disks, Anchor progression. Progression is
**ACCESS**, not a number.

## May depend on
`shared/`, `core/`.

## Must never
own a coordinate, a mesh, or a block id.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| 37522–37615 | `ObjectiveSystem` | 1.5.2 |
| 37325–37438 | `OBJECTIVE_OVERRIDES`, `OBJECTIVE_CHAINS` | 1.5.2 |
| 8060–8268 | `AnchorMonumentManager` — the progression half | 1.5.4 |
| — | `PROGRESSION_MILESTONES` and `Game._reachMilestone` | 1.5.4 |

> **THERE IS NO XP AND THERE IS NO FOURTH MILESTONE.** `CLAUDE.md` §19. `attackBonus` and
> `miningSpeedBonus` are legacy PLAYER FIELDS with no runtime source, kept so a pre-Phase-26
> save keeps what it bought. **Do not clean them up.** `tests/progression.js` is the guard.
