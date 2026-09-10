# `src/horror/` — WHAT IS WRONG

Observation, anomalies, the Stalker, the Behemoth, the Neighbour, Blood Nights, perception.
Horror **responds** to gameplay and world signals.

## May depend on
`shared/`, `core/`, `world/`, `gameplay/`.

## Must never
own the renderer or the HUD.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| 30081–30389 | `StalkerAI` | 1.5.3 |
| 30406–30565 | `PhantomHallucinator` | 1.5.3 |
| 31130–32032 | `Mob`, `MobManager` | 1.5.3 |
| 29508–29624 | `SanitySystem` | 1.5.5 (it reaches into `VoxelWorld`, P2-1) |
| 29879–31088 | the creature mesh builders → `rendering/` | 1.5.2 |

> **THE BELOW'S HORROR SYSTEMS PLUG IN HERE**, named by a `DimensionDescriptor.horror`
> list — never by a branch. That is the whole extension point.
