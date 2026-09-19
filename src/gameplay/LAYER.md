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
| ✅ — | `entity-tuning.js` — knockback, step assist, dropped-item physics, rift arming | **1.5.2 · done** |
| ✅ — | `onboarding-cues.js` — the three cues, and there are only ever three | **1.5.2 · done** |
| ✅ — | `interaction.js` — three affordances, a registry keyed on a physical `ref`, and a refusal. **Vocabulary only: no behaviour, no dispatcher, no UI.** | **D1 Phase 2 · new** |
| ~~5254–5445~~ | `computeBreakTime` and the mining constants — **went to `world/block-properties.js`**, because one load-time loop writes hardness and display names together | 1.5.2 |

> **D1 Phase 2.** `interaction.js` has **three** affordances — `none`, `inspect`, `use` —
> and no D1-specific one may be added. `open_door`, `read_note`, `activate_tower` are all
> `use` or `inspect` plus a target that knows what it is, and they belong to the phase that
> authors the content. It calls nothing, holds no handlers, and knows nothing about a
> camera, a key binding, a prompt or a player. `tests/raycast.js` fails on a fourth word or
> on any D1 noun in the file.

> **P1-1.** Gameplay currently pushes straight to the HUD — `PlayerController` 21 call
> edges, `Inventory` 7. All of them are guarded `if (this.ui)`, which is what makes the
> inversion cheap in 1.5.5. Do not add a twenty-second.
