# `src/gameplay/` — THE PLAYER AND WHAT THEY DO

Movement, collision, health, inventory, crafting, mining, combat, interaction, dropped
items. The verbs.

## May depend on
`shared/`, `core/`, `world/`.

## Must never
touch the DOM, own a THREE object, or decide what is on screen.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| 27649–28680 | `PlayerController` — the gameplay half; input routing goes to `core/` | 1.5.5 |
| 8655–8764 | `Inventory` | 1.5.2 |
| 8365–8648 | `ItemEntity`, `ItemEntityManager` | 1.5.2 |
| 33380–33466 | `Arrow`, `ArrowManager` | 1.5.2 |
| 5254–5445 | `computeBreakTime` and the mining constants | 1.5.2 |

> **P1-1.** Gameplay currently pushes straight to the HUD — `PlayerController` 21 call
> edges, `Inventory` 7. All of them are guarded `if (this.ui)`, which is what makes the
> inversion cheap in 1.5.5. Do not add a twenty-second.
